/**
 * Constantes do gráfico de candles (dimensões, chaves, opções).
 */

import { RENKO_CACHE_TICK_INTERVALS, TRADE_CACHE_TRADE_INTERVALS } from "@/app/lib/renkoKlineCache2Build";

export const ASPECT_BREAKPOINT = 480;
export const MIN_CHART_HEIGHT = 180;
export const PAD_Y = 0.02;
/** Offset 0 = visão original; 1..3 = espaço igual em cima e embaixo (↑ aumenta, ↓ reduz). */
export const Y_PAD_OFFSET_MIN = 0;
export const Y_PAD_OFFSET_MAX = 3;
export const BODY_WIDTH_RATIO = 0.7;
export const Y_AXIS_WIDTH = 60;
export const GAP_PLOT_Y_AXIS = 8;
/** Margem esquerda do plot: 0 para o gráfico ocupar até a lateral (painel pode encostar). */
export const MARGIN_LEFT = 0;
export const MARGIN_TOP = 16;
/** Altura da faixa de indicadores; a base da faixa fica alinhada ao topo da área de plot. */
export const INDICATOR_STRIP_HEIGHT = 18;
/** Padding no topo do container do gráfico para os displays dos indicadores não serem cortados. */
export const CHART_TOP_PADDING = 0;
export const MARGIN_BOTTOM_TABLE = 28;
/** Margem abaixo do último painel secundário para não encostar no rodapé. */
export const PANEL2_BOTTOM_MARGIN = 24;
/** Espaçamento entre o gráfico principal e o primeiro painel (2/3/4). */
export const MAIN_TO_PANEL_GAP = 14;
/** Espaçamento vertical entre os painéis 2, 3 e 4. */
export const PANEL_GAP = 16;
/** Altura dos painéis 2/3/4 em % da altura do gráfico principal (30–50%). */
export const SECONDARY_PANEL_HEIGHT_MIN = 30;
export const SECONDARY_PANEL_HEIGHT_MAX = 50;
export const SECONDARY_PANEL_HEIGHT_DEFAULT = 50;
/** Desktop (16:9): tamanho do gráfico em % da altura base (100 = padrão, 200 = dobro). */
export const CHART_SIZE_PERCENT_MIN = 100;
export const CHART_SIZE_PERCENT_MAX = 200;
export const CHART_SIZE_PERCENT_DEFAULT = 100;
export const CHART_SIZE_PERCENT_STEP = 25;
export const VISIBLE_OPTIONS = [30, 50, 100, 150, 200] as const;
export type VisibleCount = (typeof VISIBLE_OPTIONS)[number];
export const VISIBLE_COUNT_MIN = 7;
export const VISIBLE_COUNT_MAX = 200;
export const DEFAULT_VISIBLE: VisibleCount = 50;
export const INVISIBLE_CANDLES_END = 3;
/** Teto interno de slots à direita (nuvem Ichimoku + velas invisíveis configuráveis). */
export const INVISIBLE_CANDLES_END_MAX = 50;

export const SIDEBAR_WIDTH = 40;
export const KLINE_PREFS_KEY = "backcrypto-klines-prefs";
/** Preferência do usuário: quantidade de candles, tipo de gráfico, exibir/ocultar desenhos (e magnético em KLINE_DRAW_MAGNETIC_KEY). Carregar do localStorage tem preferência sobre o layout. */
export const KLINE_LOCAL_PREFS_KEY = "backcrypto-klines-local-prefs";
export const KLINE_LAST_LAYOUT_KEY = "backcrypto-klines-last-layout";
/** Disparado após `setKlineLastLayoutStorage` (mesmo separador de tabs). */
export const KLINES_LAYOUT_SLOT_CHANGED_EVENT = "backcrypto-klines-layout-slot";

/** Slot 0 (modelo default): `null`, `"default"` ou `"0"` no localStorage. */
export function isKlinesDefaultLayoutStorageRaw(raw: string | null): boolean {
  return raw == null || raw === "default" || raw === "0";
}

export function setKlineLastLayoutStorage(value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KLINE_LAST_LAYOUT_KEY, value);
  window.dispatchEvent(new Event(KLINES_LAYOUT_SLOT_CHANGED_EVENT));
}
/** Máximo de indicadores permitidos quando o layout ativo é um modelo default (ChartModel). */
export const DEFAULT_MODEL_MAX_INDICATORS = 2;
/** No layout default, só estes tipos de indicador podem ser selecionados. Nos layouts 1–7, todos. */
export const DEFAULT_LAYOUT_ALLOWED_INDICATOR_TYPES: readonly string[] = ["SMA", "EMA", "RSI", "MACD", "Stochastic", "Volume", "Bollinger"];
/** No modelo default só é permitida uma estratégia. */
export const DEFAULT_MODEL_MAX_STRATEGIES = 1;
export const KLINE_GROUP_MINUTES_KEY = "backcrypto-klines-group-minutes";
export const KLINE_SYMBOL_KEY = "backcrypto-klines-symbol";
export const KLINE_DRAW_SEGMENTS_KEY = "backcrypto-klines-draw-segments";
export const KLINE_DRAW_VISIBLE_KEY = "backcrypto-klines-draw-visible";

/** Chave de storage para desenhos/visibilidade: símbolo|intervalo ou só intervalo. Usado por KlinesChart e DrawingsPanel. */
export function getDrawStorageKey(symbol: string | null | undefined, groupMinutes: number): string {
  return symbol ? `${String(symbol)}|${groupMinutes}` : String(groupMinutes);
}

/** Retas H/V com "todos os períodos" por símbolo (mesmo símbolo, qualquer intervalo). Só com símbolo definido. */
export function getDrawSharedIntervalsKey(symbol: string | null | undefined): string | null {
  if (symbol == null || symbol === "") return null;
  return `${String(symbol)}|__allIntervals__`;
}
export const KLINE_DRAW_MAGNETIC_KEY = "backcrypto-klines-draw-magnetic";
export const KLINE_DRAW_DEFAULTS_KEY = "backcrypto-klines-draw-defaults";
/** Preferência do usuário: opções do segmento recolhidas (true) ou expandidas (false). */
export const KLINE_SEGMENT_OPTIONS_COLLAPSED_KEY = "backcrypto-klines-segment-options-collapsed";
export const KLINE_USER_INDICATORS_KEY = "backcrypto-klines-user-indicators";
export const KLINE_STRATEGIES_KEY = "backcrypto-klines-strategies";
export const KLINE_STRATEGIES_APPLIED_KEY = "backcrypto-klines-strategies-applied";
export const KLINE_HEIKIN_ASHI_KEY = "backcrypto-klines-heikin-ashi";
/**
 * Migração legada: antes Renko/Range/Kagi viviam em KLINE_AGG_SERIES_KEY; agora são `groupMinutes` sentinel.
 * @see GROUP_MINUTES_RENKO_FAST, GROUP_MINUTES_CACHE2_BASE
 */
export const KLINE_AGG_SERIES_KEY = "backcrypto-klines-agg-series";

/** Intervalos “virtuais” legados (900001–900005): migrados para faixa cache2 (920000+). */
export const GROUP_MINUTES_RENKO_FAST = 900001;
export const GROUP_MINUTES_RANGE_FAST = 900002;
export const GROUP_MINUTES_KAGI_FAST = 900003;
export const GROUP_MINUTES_RENKO2X_FAST = 900004;
export const GROUP_MINUTES_TRADES500_FAST = 900005;

/** Base da codificação cache2 em `groupMinutes` (BinanceKlineCache2: chartKind + interval). */
export const GROUP_MINUTES_CACHE2_BASE = 920000;
/** Espaço por tipo tick (renko/range/kagi/renko2×): 7 tiers 0–6 + margem. */
export const CACHE2_TICK_KIND_STRIDE = 80;
/** Bloco trades (6 tiers): 500 … 10000 trades por vela. */
export const GROUP_MINUTES_CACHE2_TRADES_BASE = 920320;

export type AggChartKind = "renko" | "range" | "kagi" | "renko2x" | "trades500";

/** Converte sentinel legado 900001–900005 para o código cache2 equivalente (tier base). */
export function normalizeAggGroupMinutes(groupMinutes: number): number {
  switch (groupMinutes) {
    case GROUP_MINUTES_RENKO_FAST:
      return GROUP_MINUTES_CACHE2_BASE + 0 * CACHE2_TICK_KIND_STRIDE;
    case GROUP_MINUTES_RANGE_FAST:
      return GROUP_MINUTES_CACHE2_BASE + 1 * CACHE2_TICK_KIND_STRIDE;
    case GROUP_MINUTES_KAGI_FAST:
      return GROUP_MINUTES_CACHE2_BASE + 2 * CACHE2_TICK_KIND_STRIDE;
    case GROUP_MINUTES_RENKO2X_FAST:
      return GROUP_MINUTES_CACHE2_BASE + 3 * CACHE2_TICK_KIND_STRIDE;
    case GROUP_MINUTES_TRADES500_FAST:
      return GROUP_MINUTES_CACHE2_TRADES_BASE;
    default:
      return groupMinutes;
  }
}

/** Decodifica `groupMinutes` cache2 → chartKind + interval (DB / API). Null se não for cache2. */
export function groupMinutesToCache2Params(groupMinutes: number): { chartKind: AggChartKind; interval: string } | null {
  const n = Math.floor(Number(groupMinutes));
  if (!Number.isFinite(n)) return null;

  if (n >= GROUP_MINUTES_CACHE2_TRADES_BASE && n < GROUP_MINUTES_CACHE2_TRADES_BASE + TRADE_CACHE_TRADE_INTERVALS.length) {
    const idx = n - GROUP_MINUTES_CACHE2_TRADES_BASE;
    const trades = TRADE_CACHE_TRADE_INTERVALS[idx];
    return { chartKind: "trades500", interval: `${trades}trades` };
  }

  if (n < GROUP_MINUTES_CACHE2_BASE || n > GROUP_MINUTES_CACHE2_BASE + 3 * CACHE2_TICK_KIND_STRIDE + RENKO_CACHE_TICK_INTERVALS.length - 1) {
    return null;
  }
  const rel = n - GROUP_MINUTES_CACHE2_BASE;
  const kindIndex = Math.floor(rel / CACHE2_TICK_KIND_STRIDE);
  const tierIndex = rel % CACHE2_TICK_KIND_STRIDE;
  if (kindIndex > 3 || tierIndex < 0 || tierIndex >= RENKO_CACHE_TICK_INTERVALS.length) return null;
  const ticks = RENKO_CACHE_TICK_INTERVALS[tierIndex];
  const kinds: AggChartKind[] = ["renko", "range", "kagi", "renko2x"];
  return { chartKind: kinds[kindIndex]!, interval: `${ticks}ticks` };
}

/** Rótulo curto no header (ex. P15, 1kT). */
export function formatCache2IntervalShortLabel(chartKind: AggChartKind, interval: string): string {
  if (chartKind === "trades500") {
    const m = /^(\d+)trades$/.exec(interval.trim());
    const tr = m ? Number(m[1]) : NaN;
    if (!Number.isFinite(tr)) return interval;
    if (tr >= 1000) {
      const k = tr / 1000;
      const s = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(/\.0$/, "");
      return `${s}kT`;
    }
    return `${tr}T`;
  }
  const m = /^(\d+)ticks$/.exec(interval.trim());
  const ticks = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(ticks)) return interval;
  const letter = chartKind === "renko" ? "P" : chartKind === "range" ? "N" : chartKind === "kagi" ? "K" : "R";
  return `${letter}${ticks}`;
}

/**
 * @deprecated O gráfico agrega ao vivo para **qualquer** tier (P5–P200, 500T–10kT) a partir da fonte 5ticks/500trades.
 * Mantido por compatibilidade; preferir `isAggFastGroupMinutes`.
 */
export function isAggCache2BaseTierForLiveMerge(groupMinutes: number): boolean {
  const n = normalizeAggGroupMinutes(groupMinutes);
  const p = groupMinutesToCache2Params(n);
  if (!p) return false;
  return p.interval === "5ticks" || p.interval === `${TRADE_CACHE_TRADE_INTERVALS[0]}trades`;
}

export function isAggFastGroupMinutes(groupMinutes: number): boolean {
  return groupMinutesToCache2Params(normalizeAggGroupMinutes(groupMinutes)) != null;
}

/** No layout default não se pode usar 1m nem intervalos atemporais (Renko/Range/Kagi/Renko2×/trades). */
export function isIntervalForbiddenOnDefaultLayout(groupMinutes: number): boolean {
  if (groupMinutes === 1) return true;
  return isAggFastGroupMinutes(groupMinutes);
}

/** Se for intervalo agregado (Fast legado ou cache2), retorna o kind da API / WS; senão null (OHLC clássico). */
export function groupMinutesToAggKind(groupMinutes: number): AggChartKind | null {
  const p = groupMinutesToCache2Params(normalizeAggGroupMinutes(groupMinutes));
  return p ? p.chartKind : null;
}

/**
 * Minutos por “candle” para janelas temporais de SMA2/EMA2/WMA2.
 * Nos intervalos Fast (Renko/Range/Kagi) o eixo segue a cadência ~5m; o sentinel 900001+ não pode ser usado no cálculo (senão 7D virava ~1 candle).
 */
export function chartMinutesForTimeWindowMa2(groupMinutes: number): number {
  if (isAggFastGroupMinutes(groupMinutes)) return 5;
  const n = Math.floor(Number(groupMinutes));
  return Math.max(1, Number.isFinite(n) && n > 0 ? n : 1);
}
export const KLINE_VOLUME_AT_PRICE_KEY = "backcrypto-klines-volume-at-price";
/** Largura máxima (px) das barras do volume no preço; o usuário pode reduzir até 70% via escala. */
export const VOLUME_AT_PRICE_MAX_WIDTH_PX = 120;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
