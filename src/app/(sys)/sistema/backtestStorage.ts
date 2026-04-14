/** Intervalo de velas e saldo virtual USDT para backtest (localStorage). */

import { API_BASE } from "@/app/constants";

export const CRYPTO_SISTEMA_BACKTEST_RUN_EVENT = "crypto-sistema-backtest-run";
export const CRYPTO_SISTEMA_BACKTEST_ERROR_EVENT = "crypto-sistema-backtest-error";
/** Abre o painel Backtest no gráfico; `detail.robotId` opcional para pré-selecionar o robô. */
export const CRYPTO_SISTEMA_BACKTEST_OPEN_PANEL_EVENT = "crypto-sistema-backtest-open-panel";

export const BACKTEST_STORAGE_KEY = "crypto_sistema_backtest_range_v1";

/** USDT livre simulado (não é o saldo real da Binance). */
export const BACKTEST_SPOT_USDT_DEFAULT = 50_000;
const BACKTEST_SPOT_USDT_MAX = 1e12;

/** Comissão por lado (%), ex. 0.1 = 0,1% em cada compra e em cada venda (Binance spot típico com BNB discount pode ser menor). */
export const BACKTEST_FEE_PCT_PER_SIDE_DEFAULT = 0.1;
/** Alinhado ao máx. da Conta › Binance (taxa taker fallback). */
const BACKTEST_FEE_PCT_PER_SIDE_MAX = 5;

/** Slippage máx. (%), passo {@link BACKTEST_SLIPPAGE_PCT_STEP}. Compra: preço × (1+s); venda/stop: × (1−s). */
export const BACKTEST_SLIPPAGE_PCT_MAX = 0.5;
export const BACKTEST_SLIPPAGE_PCT_STEP = 0.05;

export type BacktestExecutionMode = "conservative" | "optimistic";

export type BacktestRangeSettings = {
  startBar: number;
  endBar: number;
  spotUsdtFree: number;
  /** % por operação (compra ou venda). Default {@link BACKTEST_FEE_PCT_PER_SIDE_DEFAULT}. */
  feePercentPerSide: number;
  /** Slippage % (0 a {@link BACKTEST_SLIPPAGE_PCT_MAX}, passo {@link BACKTEST_SLIPPAGE_PCT_STEP}). */
  slippagePercent: number;
  /** Conservador: compra/venda no fecho. Otimista: compra no min(abertura,fecho), venda no max(abertura,fecho). */
  executionMode: BacktestExecutionMode;
};

const DEFAULTS: BacktestRangeSettings = {
  startBar: 1,
  endBar: 50,
  spotUsdtFree: BACKTEST_SPOT_USDT_DEFAULT,
  feePercentPerSide: BACKTEST_FEE_PCT_PER_SIDE_DEFAULT,
  slippagePercent: 0,
  executionMode: "conservative",
};

export function clampBacktestExecutionMode(v: unknown): BacktestExecutionMode {
  return v === "optimistic" ? "optimistic" : "conservative";
}

export function clampFeePercentPerSide(pct: number): number {
  if (!Number.isFinite(pct) || pct < 0) return BACKTEST_FEE_PCT_PER_SIDE_DEFAULT;
  return Math.min(BACKTEST_FEE_PCT_PER_SIDE_MAX, pct);
}

export function clampSlippagePercent(pct: number): number {
  if (!Number.isFinite(pct) || pct < 0) return 0;
  const capped = Math.min(BACKTEST_SLIPPAGE_PCT_MAX, pct);
  const snapped =
    Math.round(capped / BACKTEST_SLIPPAGE_PCT_STEP) * BACKTEST_SLIPPAGE_PCT_STEP;
  return Math.min(BACKTEST_SLIPPAGE_PCT_MAX, Math.max(0, Number(snapped.toFixed(2))));
}

/** Taxa decimal por lado (0,1% → 0,001). */
export function backtestFeeRateFromPercent(pct: number): number {
  return clampFeePercentPerSide(pct) / 100;
}

/**
 * Formata taxa decimal por lado (ex. 0,00075) para texto em % (ex. "0,075" sem o símbolo %).
 * Evita `toFixed(2)` no resumo, que mostrava 0,075% como "0,07%".
 */
export function formatFeeDecimalAsPercentLabel(decimalRate: number): string {
  const pct = decimalRate * 100;
  if (!Number.isFinite(pct)) return String(BACKTEST_FEE_PCT_PER_SIDE_DEFAULT);
  if (Math.abs(pct) < 1e-12) return "0";
  if (pct % 1 === 0) return String(pct);
  return pct.toFixed(4).replace(/\.?0+$/, "");
}

/**
 * Taxa usada no backtest: se em Conta › Binance existir **Taxa taker estimada (fallback)** guardada,
 * usa esse valor (decimal, ex. 0,00075 = 0,075%); senão usa o % do painel Backtest.
 * Só em cliente (fetch à API).
 */
export async function resolveBacktestFeeRatePerSide(panelFeePercentPerSide: number): Promise<number> {
  const panelRate = backtestFeeRateFromPercent(panelFeePercentPerSide);
  if (typeof window === "undefined") return panelRate;
  try {
    const res = await fetch(`${API_BASE}/user/binance-connection`, { credentials: "include" });
    if (!res.ok) return panelRate;
    const data = (await res.json()) as { connected?: boolean; feeEstimateTakerFallback?: string | null };
    if (!data.connected) return panelRate;
    const fb = data.feeEstimateTakerFallback;
    if (fb == null || String(fb).trim() === "") return panelRate;
    const r = parseFloat(String(fb));
    if (!Number.isFinite(r) || r < 0 || r > 0.05) return panelRate;
    return r;
  } catch {
    return panelRate;
  }
}

function clampSpotUsdt(n: number): number {
  if (!Number.isFinite(n) || n < 0) return DEFAULTS.spotUsdtFree;
  return Math.min(BACKTEST_SPOT_USDT_MAX, n);
}

export function loadBacktestRange(): BacktestRangeSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(BACKTEST_STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as unknown;
    if (p == null || typeof p !== "object") return { ...DEFAULTS };
    const o = p as Record<string, unknown>;
    const startBar =
      typeof o.startBar === "number" && Number.isFinite(o.startBar) && o.startBar >= 1
        ? Math.floor(o.startBar)
        : DEFAULTS.startBar;
    const endBar =
      typeof o.endBar === "number" && Number.isFinite(o.endBar) && o.endBar >= 1
        ? Math.floor(o.endBar)
        : DEFAULTS.endBar;
    const spotRaw = o.spotUsdtFree;
    const spotUsdtFree =
      typeof spotRaw === "number" && Number.isFinite(spotRaw) && spotRaw >= 0
        ? clampSpotUsdt(spotRaw)
        : DEFAULTS.spotUsdtFree;
    const feeRaw = o.feePercentPerSide;
    const feePercentPerSide =
      typeof feeRaw === "number" && Number.isFinite(feeRaw) && feeRaw >= 0
        ? clampFeePercentPerSide(feeRaw)
        : DEFAULTS.feePercentPerSide;
    const slipRaw = o.slippagePercent;
    const slippagePercent =
      typeof slipRaw === "number" && Number.isFinite(slipRaw) && slipRaw >= 0
        ? clampSlippagePercent(slipRaw)
        : DEFAULTS.slippagePercent;
    const executionMode = clampBacktestExecutionMode(o.executionMode);
    return {
      startBar,
      endBar: Math.max(startBar, endBar),
      spotUsdtFree,
      feePercentPerSide,
      slippagePercent,
      executionMode,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function persistBacktestRange(range: BacktestRangeSettings) {
  if (typeof window === "undefined") return;
  try {
    const startBar = Math.max(1, Math.floor(range.startBar));
    const endBar = Math.max(startBar, Math.floor(range.endBar));
    const spotUsdtFree = clampSpotUsdt(range.spotUsdtFree);
    const feePercentPerSide = clampFeePercentPerSide(range.feePercentPerSide);
    const slippagePercent = clampSlippagePercent(range.slippagePercent);
    const executionMode = clampBacktestExecutionMode(range.executionMode);
    window.localStorage.setItem(
      BACKTEST_STORAGE_KEY,
      JSON.stringify({
        startBar,
        endBar,
        spotUsdtFree,
        feePercentPerSide,
        slippagePercent,
        executionMode,
      })
    );
  } catch {
    /* ignore */
  }
}
