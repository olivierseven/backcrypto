import type { Wma2TimeUnit } from "../KlinesIndicatorsContext";
import { isAggFastGroupMinutes } from "../KlinesChartConstants";

/** Teto do valor da janela temporal em UI e persistência (n.º de dias, horas ou minutos — SMA2/EMA2/WMA2). */
export const MA2_MAX_WINDOW_VALUE = 9999;

/** Teto de segurança (candles) para o período pedido; evita valores absurdos no custo O(n×período). */
export const WMA2_MAX_REQUESTED_PERIOD_CANDLES = 1_000_000;

/** Acima disto SMA2/EMA2/WMA2 não desenham neste timeframe (série vazia), alinhado ao teto típico de klines carregados. */
export const WMA2_MAX_DISPLAY_PERIOD_CANDLES = 1000;

export function isTimeWindowMa2Type(type: string): boolean {
  return type === "WMA2" || type === "SMA2" || type === "EMA2";
}

/** Valor por defeito da janela consoante a unidade (horas/dias/minutos). */
export function defaultMa2TimeValueForUnit(unit: Wma2TimeUnit): number {
  if (unit === "days") return 7;
  if (unit === "hours") return 168;
  return 60;
}

/**
 * Garante coerência com a unidade. Ex.: 168 é o default em horas; se a unidade for `days` e o valor
 * ficou 168 (troca de unidade ou layout antigo), trata-se como 7 dias (= 168 h em duração).
 */
/** Limita o número introduzido pelo utilizador (1 … {@link MA2_MAX_WINDOW_VALUE}). */
export function clampMa2TimeWindowUserValue(n: number): number {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return 1;
  return Math.max(1, Math.min(MA2_MAX_WINDOW_VALUE, Math.round(x)));
}

export function normalizeMa2TimeValueForUnit(unit: Wma2TimeUnit, value: number): number {
  const v = clampMa2TimeWindowUserValue(Number(value) || 1);
  if (unit === "days" && v === 168) return 7;
  return v;
}

/** Índice 0 = candle mais recente: anula pontos onde não cabe janela completa de `period` candles. */
export function ma2NullIndicesBeyondFullWindow(col: (number | null)[], rowCount: number, period: number): void {
  const lastFullIdx = rowCount - period;
  for (let i = lastFullIdx + 1; i < rowCount; i++) col[i] = null;
}

/** Minutos totais da janela configurada pelo utilizador. */
export function wma2WindowTotalMinutes(unit: Wma2TimeUnit, value: number): number {
  const v = normalizeMa2TimeValueForUnit(unit, value);
  if (unit === "days") return v * 24 * 60;
  if (unit === "hours") return v * 60;
  return v;
}

/** Período em candles: ceil(janela em minutos ÷ minutos do candle), limitado a {@link WMA2_MAX_REQUESTED_PERIOD_CANDLES}. */
export function wma2RequestedPeriodCandles(groupMinutes: number, unit: Wma2TimeUnit, value: number): number {
  const chartMin = Math.max(1, Math.floor(Number(groupMinutes)) || 1);
  const windowMin = wma2WindowTotalMinutes(unit, value);
  const raw = Math.ceil(windowMin / chartMin);
  return Math.max(1, Math.min(WMA2_MAX_REQUESTED_PERIOD_CANDLES, raw));
}

/** true = não calcular / não mostrar linha (SMA2, EMA2, WMA2): período > 1000 ou menos candles que o período. */
export function wma2ShouldOmitSeries(rowCount: number, requestedPeriod: number): boolean {
  return requestedPeriod > WMA2_MAX_DISPLAY_PERIOD_CANDLES || rowCount < requestedPeriod;
}

/**
 * SMA2/EMA2/WMA2 usam janela em tempo (dias/horas/minutos) por candle temporal.
 * Gráficos atemporais (Renko, Range, Kagi, Renko 2×, velas por contagem de trades) não têm esse eixo — a linha não deve ter efeito.
 */
export function wma2ShouldOmitSeriesOnChart(groupMinutes: number, rowCount: number, requestedPeriod: number): boolean {
  if (isAggFastGroupMinutes(groupMinutes)) return true;
  return wma2ShouldOmitSeries(rowCount, requestedPeriod);
}
