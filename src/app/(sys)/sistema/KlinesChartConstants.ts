/**
 * Constantes do gráfico de candles (dimensões, chaves, opções).
 */

export const ASPECT_BREAKPOINT = 480;
export const MIN_CHART_HEIGHT = 180;
export const PAD_Y = 0.02;
export const BODY_WIDTH_RATIO = 0.7;
export const Y_AXIS_WIDTH = 56;
export const GAP_PLOT_Y_AXIS = 8;
export const MARGIN_LEFT = 8;
export const MARGIN_TOP = 16;
/** Altura da faixa de indicadores no topo do gráfico (alinhada à área de plot). */
export const INDICATOR_STRIP_HEIGHT = 26;
/** Deslocamento da faixa de indicadores para cima em relação ao topo da área (px). */
export const INDICATOR_STRIP_OFFSET_UP = 18;
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
export const VISIBLE_OPTIONS = [30, 50, 100, 150] as const;
export type VisibleCount = (typeof VISIBLE_OPTIONS)[number];
export const DEFAULT_VISIBLE: VisibleCount = 50;
export const INVISIBLE_CANDLES_END = 3;

export const SIDEBAR_WIDTH = 40;
export const KLINE_PREFS_KEY = "backcrypto-klines-prefs";
export const KLINE_LAST_LAYOUT_KEY = "backcrypto-klines-last-layout";
export const KLINE_DRAW_SEGMENTS_KEY = "backcrypto-klines-draw-segments";
export const KLINE_DRAW_VISIBLE_KEY = "backcrypto-klines-draw-visible";
export const KLINE_USER_INDICATORS_KEY = "backcrypto-klines-user-indicators";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
