const BINANCE_BASE = (process.env.BINANCE_API_BASE_URL ?? "https://api.binance.com").replace(/\/$/, "");

export type LotSizeFilter = {
  stepSize: string;
  minQty: string;
  maxQty: string;
};

export type PriceFilter = {
  tickSize: string;
  minPrice?: string;
  maxPrice?: string;
};

export type SymbolSpotFilters = {
  lot: LotSizeFilter | null;
  price: PriceFilter | null;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const symbolFiltersCache = new Map<string, { at: number; value: SymbolSpotFilters }>();

/** Timeout por pedido a exchangeInfo (serverless pode ser lento; evita falhar em silêncio). */
const EXCHANGE_INFO_FETCH_MS = 22_000;
const EXCHANGE_INFO_RETRIES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Cache em memória mesmo fora do TTL — útil quando o fetch fresco falha em produção. */
export function peekStaleSymbolSpotFilters(symbol: string): SymbolSpotFilters | null {
  const hit = symbolFiltersCache.get(symbol.trim().toUpperCase());
  return hit?.value ?? null;
}

export function mergeSymbolSpotFilters(a: SymbolSpotFilters, b: SymbolSpotFilters | null): SymbolSpotFilters {
  if (!b) return a;
  return {
    price: a.price ?? b.price,
    lot: a.lot ?? b.lot,
  };
}

export type GetSymbolSpotFiltersOptions = {
  /** Ignora leitura do cache (recomendado ao submeter ordens para evitar PRICE_FILTER com tick desatualizado). */
  bypassCache?: boolean;
};

/**
 * LOT_SIZE + PRICE_FILTER num único exchangeInfo (cache por símbolo).
 * Não grava cache em falhas HTTP — evita servir `{ price: null }` por 5 min após um timeout.
 */
export async function getSymbolSpotFilters(
  symbol: string,
  opts?: GetSymbolSpotFiltersOptions
): Promise<SymbolSpotFilters> {
  const sym = symbol.trim().toUpperCase();
  const now = Date.now();
  if (!opts?.bypassCache) {
    const hit = symbolFiltersCache.get(sym);
    if (hit && now - hit.at < CACHE_TTL_MS) {
      return hit.value;
    }
  }

  const url = `${BINANCE_BASE}/api/v3/exchangeInfo?symbol=${encodeURIComponent(sym)}`;
  const empty: SymbolSpotFilters = { lot: null, price: null };

  for (let attempt = 0; attempt < EXCHANGE_INFO_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(EXCHANGE_INFO_FETCH_MS),
      });
      if (!res.ok) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      const data = (await res.json()) as {
        symbols?: {
          filters?: {
            filterType?: string;
            stepSize?: string;
            minQty?: string;
            maxQty?: string;
            tickSize?: string;
            minPrice?: string;
            maxPrice?: string;
          }[];
        }[];
      };
      const filters = data.symbols?.[0]?.filters ?? [];
      const lotRaw = filters.find((f) => f.filterType === "LOT_SIZE");
      const priceRaw = filters.find((f) => f.filterType === "PRICE_FILTER");

      let lot: LotSizeFilter | null = null;
      if (lotRaw?.stepSize && lotRaw?.minQty) {
        lot = {
          stepSize: lotRaw.stepSize,
          minQty: lotRaw.minQty,
          maxQty: lotRaw.maxQty ?? "0",
        };
      }

      let price: PriceFilter | null = null;
      if (priceRaw?.tickSize) {
        price = {
          tickSize: priceRaw.tickSize,
          minPrice: priceRaw.minPrice,
          maxPrice: priceRaw.maxPrice,
        };
      }

      const value: SymbolSpotFilters = { lot, price };
      symbolFiltersCache.set(sym, { at: Date.now(), value });
      return value;
    } catch (e) {
      await sleep(300 * (attempt + 1));
      if (attempt === EXCHANGE_INFO_RETRIES - 1) {
        console.error("[getSymbolSpotFilters] failed after retries", sym, e);
      }
    }
  }

  return empty;
}

/** Se o fetch vier incompleto ou falhar, preenche com a última entrada em memória desta instância (qualquer par). */
function mergeWithStaleInstanceCache(sym: string, fresh: SymbolSpotFilters): SymbolSpotFilters {
  return mergeSymbolSpotFilters(fresh, peekStaleSymbolSpotFilters(sym));
}

/**
 * UI (modal): respeita cache TTL; se o fetch falhar ou vier incompleto, complementa com cache expirado na instância.
 */
export async function getSymbolSpotFiltersForUi(symbol: string): Promise<SymbolSpotFilters> {
  const sym = symbol.trim().toUpperCase();
  const fresh = await getSymbolSpotFilters(sym);
  return mergeWithStaleInstanceCache(sym, fresh);
}

/**
 * Submissão de ordens: tenta exchangeInfo fresco (bypass TTL), depois merge com cache expirado na instância.
 * Comportamento alinhado para todos os símbolos (sem valores fixos por moeda).
 */
export async function getSymbolSpotFiltersForOrder(symbol: string): Promise<SymbolSpotFilters> {
  const sym = symbol.trim().toUpperCase();
  const fresh = await getSymbolSpotFilters(sym, { bypassCache: true });
  return mergeWithStaleInstanceCache(sym, fresh);
}

/**
 * Lê LOT_SIZE (stepSize, minQty) na exchangeInfo pública da Binance.
 */
export async function getLotSizeFilter(symbol: string): Promise<LotSizeFilter | null> {
  const { lot } = await getSymbolSpotFilters(symbol);
  return lot;
}

/** Número de casas decimais significativas no stepSize (ex.: "0.00010000" → 4). */
function decimalsFromStepSize(stepSizeStr: string): number {
  const t = stepSizeStr.trim();
  if (!t.includes(".")) return 0;
  const frac = t.split(".")[1] ?? "";
  const trimmed = frac.replace(/0+$/, "");
  return trimmed.length;
}

/**
 * Arredonda a quantidade **para baixo** para o múltiplo de `stepSize` exigido pela Binance (filtro LOT_SIZE).
 */
export function floorQuantityToLotStep(quantityStr: string, stepSizeStr: string): string {
  const step = parseFloat(stepSizeStr);
  const qty = parseFloat(quantityStr);
  if (!Number.isFinite(step) || step <= 0 || !Number.isFinite(qty) || qty <= 0) {
    return quantityStr;
  }
  const dec = decimalsFromStepSize(stepSizeStr);
  const factor = 10 ** dec;
  const stepUnits = Math.round(step * factor);
  const qtyUnits = Math.floor((qty * factor) / stepUnits) * stepUnits;
  const rounded = qtyUnits / factor;
  if (!Number.isFinite(rounded) || rounded <= 0) return "0";
  return rounded.toFixed(dec).replace(/\.?0+$/, "").replace(/\.$/, "");
}

/**
 * Arredonda o preço **para baixo** ao múltiplo de `tickSize` (filtro PRICE_FILTER da Binance).
 */
export function floorPriceToTick(priceStr: string, tickSizeStr: string): string {
  const tick = parseFloat(tickSizeStr);
  const p = parseFloat(priceStr);
  if (!Number.isFinite(tick) || tick <= 0 || !Number.isFinite(p) || p <= 0) {
    return priceStr;
  }
  const dec = decimalsFromStepSize(tickSizeStr);
  const factor = 10 ** dec;
  const tickUnits = Math.round(tick * factor);
  const priceUnits = Math.floor((p * factor) / tickUnits) * tickUnits;
  const rounded = priceUnits / factor;
  if (!Number.isFinite(rounded) || rounded <= 0) return priceStr;
  return rounded.toFixed(dec).replace(/\.?0+$/, "").replace(/\.$/, "");
}
