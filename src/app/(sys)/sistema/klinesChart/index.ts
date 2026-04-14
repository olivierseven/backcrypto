/**
 * Módulo do gráfico de candles: tipos, paletas e componentes de UI.
 */
export type { Kline, ChartIndicatorLine, KlinesChartProps } from "./types";
export {
  CANDLE_COLOR_PRESETS,
  DEFAULT_CANDLE_PRESET,
  SEGMENT_COLOR_PALETTE,
  SEGMENT_CAP_OPTIONS,
  BACKGROUND_PALETTE,
  DEFAULT_BACKGROUND,
  LINE_GRID_PALETTE,
  DEFAULT_LINE_TABLE_COLOR,
  DEFAULT_SECONDARY_GRID_COLOR,
  TEXT_PALETTE,
  DEFAULT_TEXT_COLOR,
} from "./palettes";
export type {
  CandleColorPresetId,
  BackgroundId,
  LineGridId,
  TextColorId,
} from "./palettes";
export { KlinesChartSidebar } from "./KlinesChartSidebar";
export type { KlinesChartSidebarProps, KlinesChartSidebarTranslations } from "./KlinesChartSidebar";
export { KlinesChartYAxis } from "./KlinesChartYAxis";
export type { KlinesChartYAxisProps } from "./KlinesChartYAxis";
export { KlinesChartFooter } from "./KlinesChartFooter";
export type { KlinesChartFooterProps } from "./KlinesChartFooter";
export { KlinesChartSvg } from "./KlinesChartSvg";
export type { KlinesChartSvgProps } from "./KlinesChartSvg";
