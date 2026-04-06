/** JSONB por vezes chega como string dupla; Prisma Json pode ser objeto ou string. */
function normalizeSpotOrderRawJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  let v: unknown = raw;
  for (let depth = 0; depth < 3 && typeof v === "string"; depth++) {
    const s = v.trim();
    if (s === "") return null;
    try {
      v = JSON.parse(s) as unknown;
    } catch {
      return null;
    }
  }
  if (v == null || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function isPositivePriceString(s: string): boolean {
  const n = parseFloat(s.trim());
  return Number.isFinite(n) && n > 0;
}

/** Preço médio de execução a partir dos `fills` (vários preços → média ponderada por quantidade). */
function weightedAvgPriceFromFills(o: Record<string, unknown>): string | null {
  const fills = o.fills;
  if (!Array.isArray(fills) || fills.length === 0) return null;
  let sumPxQty = 0;
  let sumQty = 0;
  for (const fill of fills) {
    if (fill == null || typeof fill !== "object") continue;
    const f = fill as Record<string, unknown>;
    const fp = f.price;
    const fq = f.qty;
    if (typeof fp !== "string" || typeof fq !== "string") continue;
    const pN = parseFloat(fp);
    const qN = parseFloat(fq);
    if (!Number.isFinite(pN) || !Number.isFinite(qN) || qN <= 0) continue;
    sumPxQty += pN * qN;
    sumQty += qN;
  }
  if (sumQty <= 0) return null;
  return String(sumPxQty / sumQty);
}

/** `cummulativeQuoteQty` / `executedQty` → preço médio em USDT por unidade de base (par spot USDT). */
function avgPriceFromCumAndExecuted(o: Record<string, unknown>): string | null {
  const cum = o.cummulativeQuoteQty;
  const exec = o.executedQty;
  if (typeof cum !== "string" || typeof exec !== "string") return null;
  const c = parseFloat(cum);
  const e = parseFloat(exec);
  if (!Number.isFinite(c) || !Number.isFinite(e) || e <= 0) return null;
  return String(c / e);
}

/**
 * Preço a gravar em `UserBinanceSpotOrder.price` / UI: Binance envia `price` = "0" em MARKET;
 * o preço real vem dos fills ou de cummulativeQuoteQty/executedQty (execução é na hora; não é “atraso”).
 */
export function deriveSpotOrderExecutionPriceString(o: Record<string, unknown>): string | null {
  const p = o.price;
  if (typeof p === "string" && p.trim() !== "" && isPositivePriceString(p)) {
    return p.trim();
  }
  const w = weightedAvgPriceFromFills(o);
  if (w != null) return w;
  return avgPriceFromCumAndExecuted(o);
}

export function deriveSpotOrderExecutionPriceFromRawJson(raw: unknown): string | null {
  const o = normalizeSpotOrderRawJson(raw);
  return o ? deriveSpotOrderExecutionPriceString(o) : null;
}

/** Extrai campos do `raw_json` da Binance (resposta de ordem) para o gráfico / API. */
export function parseSpotOrderRawJson(raw: unknown): {
  transactTimeMs: number | null;
  quoteQty: string | null;
  avgPrice: string | null;
  commission: string | null;
  commissionAsset: string | null;
} {
  const empty = {
    transactTimeMs: null as number | null,
    quoteQty: null as string | null,
    avgPrice: null as string | null,
    commission: null as string | null,
    commissionAsset: null as string | null,
  };
  const o = normalizeSpotOrderRawJson(raw);
  if (o == null) return empty;
  let transactTimeMs: number | null = null;
  const toMs = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    if (typeof v === "bigint") return Number(v);
    return null;
  };
  transactTimeMs = toMs(o.transactTime);
  if (transactTimeMs == null) transactTimeMs = toMs(o.workingTime);
  const cum = o.cummulativeQuoteQty;
  const quoteQty = typeof cum === "string" && cum.trim() !== "" ? cum : null;
  let avgPrice: string | null = weightedAvgPriceFromFills(o);
  if (avgPrice == null) avgPrice = avgPriceFromCumAndExecuted(o);
  let commission: string | null = null;
  let commissionAsset: string | null = null;
  const fills = o.fills;
  if (Array.isArray(fills) && fills.length > 0 && fills[0] != null && typeof fills[0] === "object") {
    const f = fills[0] as Record<string, unknown>;
    if (avgPrice == null && typeof f.price === "string" && f.price.trim() !== "") avgPrice = f.price;
    if (typeof f.commission === "string" && f.commission.trim() !== "") commission = f.commission;
    if (typeof f.commissionAsset === "string" && f.commissionAsset.trim() !== "") commissionAsset = f.commissionAsset;
  }
  return { transactTimeMs, quoteQty, avgPrice, commission, commissionAsset };
}

function distToClosedInterval(t: number, open: number, close: number): number {
  const lo = Math.min(open, close);
  const hi = Math.max(open, close);
  const hiSlack = hi + 1000;
  if (t < lo) return lo - t;
  if (t > hiSlack) return t - hiSlack;
  return 0;
}

/**
 * Vela cujo intervalo [open, close] está mais próximo de `transactMs` (mesma escala que [0]/[6] das velas).
 * Se o ponto cair dentro de uma vela, devolve essa (a primeira encontrada).
 * `klines[0]` = mais recente.
 */
export function findNearestKlineIndexForTransactMs(
  klines: readonly (readonly (string | number | null)[])[],
  transactMs: number,
): number | null {
  if (!Number.isFinite(transactMs) || klines.length === 0) return null;
  let bestIdx: number | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < klines.length; i++) {
    const open = Number(klines[i][0]);
    const close = Number(klines[i][6]);
    if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
    const d = distToClosedInterval(transactMs, open, close);
    if (d === 0) return i;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestDist !== Infinity && bestIdx != null ? bestIdx : null;
}

/**
 * Escolhe o índice da vela para uma ordem: compara UTC+offset, UTC puro e UTC−offset (velas já vêm com
 * `applyTimezoneOffset` no GET klines; nem sempre o estado do cliente coincide na 1.ª frame).
 */
export function resolveKlineIndexForSpotOrder(
  klines: readonly (readonly (string | number | null)[])[],
  transactUtcMs: number,
  timezoneOffsetHours: number,
): number | null {
  if (!Number.isFinite(transactUtcMs) || klines.length === 0) return null;
  const tzH = Math.max(-12, Math.min(12, timezoneOffsetHours));
  const tzMs = tzH * 60 * 60 * 1000;
  const candidates = [transactUtcMs + tzMs, transactUtcMs, transactUtcMs - tzMs];
  let bestIdx: number | null = null;
  let bestDist = Infinity;
  for (const t of candidates) {
    const idx = findNearestKlineIndexForTransactMs(klines, t);
    if (idx == null) continue;
    const open = Number(klines[idx][0]);
    const close = Number(klines[idx][6]);
    if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
    const d = distToClosedInterval(t, open, close);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = idx;
    }
  }
  return bestIdx;
}

/** Para painel de debug: mesmo critério que `resolveKlineIndexForSpotOrder`, com candidatos explícitos. */
export type SpotOrderPlacementDebug = {
  timezoneOffsetHours: number;
  tzMs: number;
  transactUtcMs: number;
  candidates: Array<{
    key: "utc+tz" | "utc" | "utc-tz";
    tMs: number;
    nearestIndex: number | null;
    distToInterval: number | null;
    candleOpen: number | null;
    candleClose: number | null;
  }>;
  resolvedIndex: number | null;
  bestDist: number | null;
};

export function debugSpotOrderPlacement(
  klines: readonly (readonly (string | number | null)[])[],
  transactUtcMs: number,
  timezoneOffsetHours: number,
): SpotOrderPlacementDebug | null {
  if (!Number.isFinite(transactUtcMs) || klines.length === 0) return null;
  const tzH = Math.max(-12, Math.min(12, timezoneOffsetHours));
  const tzMs = tzH * 60 * 60 * 1000;
  const keys = ["utc+tz", "utc", "utc-tz"] as const;
  const ts = [transactUtcMs + tzMs, transactUtcMs, transactUtcMs - tzMs];
  const candidates: SpotOrderPlacementDebug["candidates"] = [];
  let resolvedIndex: number | null = null;
  let bestDist = Infinity;
  for (let j = 0; j < 3; j++) {
    const t = ts[j];
    const idx = findNearestKlineIndexForTransactMs(klines, t);
    let distToInterval: number | null = null;
    let candleOpen: number | null = null;
    let candleClose: number | null = null;
    if (idx != null) {
      candleOpen = Number(klines[idx][0]);
      candleClose = Number(klines[idx][6]);
      if (Number.isFinite(candleOpen) && Number.isFinite(candleClose)) {
        distToInterval = distToClosedInterval(t, candleOpen, candleClose);
        if (distToInterval < bestDist) {
          bestDist = distToInterval;
          resolvedIndex = idx;
        }
      }
    }
    candidates.push({
      key: keys[j],
      tMs: t,
      nearestIndex: idx,
      distToInterval,
      candleOpen,
      candleClose,
    });
  }
  return {
    timezoneOffsetHours: tzH,
    tzMs,
    transactUtcMs,
    candidates,
    resolvedIndex,
    bestDist: bestDist === Infinity ? null : bestDist,
  };
}

export type ChartSpotOrderApiRow = {
  binanceOrderId: string;
  side: string;
  orderType: string;
  status: string | null;
  executedQty: string | null;
  /** Preço limite (coluna DB); fallback visual no gráfico se `avgPrice` vier vazio. */
  price?: string | null;
  /** Ms UTC da Binance; se `raw_json` não tiver tempo, o GET usa `createdAt`. */
  transactTimeMs: number | null;
  quoteQty: string | null;
  avgPrice: string | null;
  commission: string | null;
  commissionAsset: string | null;
  createdAt?: string;
};

export function buildSpotOrderMarkerTitle(
  o: ChartSpotOrderApiRow,
  baseAsset: string,
  t: Record<string, string>,
): string {
  const sideLabel =
    o.side === "SELL"
      ? (t.spotOrderMarkerSideSell ?? "Sell")
      : (t.spotOrderMarkerSideBuy ?? "Buy");
  const type = (o.orderType ?? "").trim() || "—";
  const lines: string[] = [`${sideLabel} · ${type}`];
  if (o.quoteQty && o.quoteQty.trim() !== "") {
    lines.push(`${t.spotOrderMarkerTotal ?? "Total (USDT)"}: ${o.quoteQty}`);
  }
  if (o.executedQty && o.executedQty.trim() !== "") {
    lines.push(`${t.spotOrderMarkerQty ?? "Filled"}: ${o.executedQty} ${baseAsset}`);
  }
  if (o.avgPrice && o.avgPrice.trim() !== "") {
    lines.push(`${t.spotOrderMarkerAvg ?? "Avg price"}: ${o.avgPrice}`);
  }
  if (o.commission && o.commissionAsset) {
    lines.push(`${t.spotOrderMarkerFee ?? "Fee"}: ${o.commission} ${o.commissionAsset}`);
  }
  if (o.transactTimeMs != null && Number.isFinite(o.transactTimeMs)) {
    const d = new Date(o.transactTimeMs);
    lines.push(
      `${t.spotOrderMarkerTime ?? "Time"}: ${d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" })}`,
    );
  }
  return lines.join("\n");
}
