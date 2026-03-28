/**
 * Tick padrão Crypto: fechamento do último dia (candle diário UTC já fechado)
 * × 0,01 %, sempre em valor fracionário (em unidades de preço do par, ex.: USDT).
 */
export function defaultTickFromDailyClose(close: number): number {
  if (!Number.isFinite(close) || close <= 0) return 0;
  const raw = close * (0.01 / 100);
  const fractional = Number(raw.toFixed(8));
  return fractional > 0 ? fractional : 0.00000001;
}

export function parseBinanceCloseString(s: string): number {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
