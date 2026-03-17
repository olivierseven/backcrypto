/**
 * Constantes do gráfico de candles (dimensões, chaves, opções).
 */

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
export const KLINE_DRAW_MAGNETIC_KEY = "backcrypto-klines-draw-magnetic";
export const KLINE_DRAW_DEFAULTS_KEY = "backcrypto-klines-draw-defaults";
/** Preferência do usuário: opções do segmento recolhidas (true) ou expandidas (false). */
export const KLINE_SEGMENT_OPTIONS_COLLAPSED_KEY = "backcrypto-klines-segment-options-collapsed";
export const KLINE_USER_INDICATORS_KEY = "backcrypto-klines-user-indicators";
export const KLINE_STRATEGIES_KEY = "backcrypto-klines-strategies";
export const KLINE_STRATEGIES_APPLIED_KEY = "backcrypto-klines-strategies-applied";
export const KLINE_HEIKIN_ASHI_KEY = "backcrypto-klines-heikin-ashi";
export const KLINE_VOLUME_AT_PRICE_KEY = "backcrypto-klines-volume-at-price";
/** Largura máxima (px) das barras do volume no preço; o usuário pode reduzir até 70% via escala. */
export const VOLUME_AT_PRICE_MAX_WIDTH_PX = 120;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
