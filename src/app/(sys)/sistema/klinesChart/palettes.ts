/**
 * Paletas de cores e presets do gráfico de candles.
 */
import type { SegmentCap } from "../KlinesChartDrawing";

export const CANDLE_COLOR_PRESETS = [
  { id: "greenRed" as const, bull: "#059669", bear: "#dc2626" },
  { id: "blueOrange" as const, bull: "#2563eb", bear: "#ea580c" },
  { id: "blackWhite" as const, bull: "#f5f5f5", bear: "#171717" },
  { id: "purpleAmber" as const, bull: "#7c3aed", bear: "#f59e0b" },
  { id: "cyanRose" as const, bull: "#0891b2", bear: "#e11d48" },
] as const;
export type CandleColorPresetId = (typeof CANDLE_COLOR_PRESETS)[number]["id"];
export const DEFAULT_CANDLE_PRESET: CandleColorPresetId = "greenRed";

export const SEGMENT_COLOR_PALETTE = [
  "#000000", "#ffffff", "#dc2626", "#ea580c", "#ca8a04", "#65a30d", "#059669", "#0891b2", "#2563eb", "#7c3aed", "#db2777", "#78716c",
] as const;

export const SEGMENT_CAP_OPTIONS: { value: SegmentCap; labelKey: "capNone" | "capPoint" | "capArrow" }[] = [
  { value: "none", labelKey: "capNone" },
  { value: "point", labelKey: "capPoint" },
  { value: "arrow", labelKey: "capArrow" },
];

export const BACKGROUND_PALETTE = [
  { id: 0, hex: "#ffffff", labelKey: "bgWhite" as const },
  { id: 1, hex: "#f5f5f5", labelKey: "bgLightGray" as const },
  { id: 2, hex: "#e5e5e5", labelKey: "bgGray" as const },
  { id: 3, hex: "#a3a3a3", labelKey: "bgMediumGray" as const },
  { id: 4, hex: "#525252", labelKey: "bgDarkGray" as const },
  { id: 5, hex: "#171717", labelKey: "bgBlack" as const },
  { id: 6, hex: "#d6d3d1", labelKey: "bgLightBrown" as const },
  { id: 7, hex: "#78716c", labelKey: "bgBrown" as const },
  { id: 8, hex: "#57534e", labelKey: "bgDarkBrown" as const },
  { id: 9, hex: "#292524", labelKey: "bgVeryDarkBrown" as const },
] as const;
export type BackgroundId = (typeof BACKGROUND_PALETTE)[number]["id"];
export const DEFAULT_BACKGROUND: BackgroundId = 0;

export const LINE_GRID_PALETTE = [
  { id: 0, hex: "#ffffff", labelKey: "lineWhite" as const },
  { id: 1, hex: "#000000", labelKey: "lineBlack" as const },
  { id: 2, hex: "#dc2626", labelKey: "lineRed" as const },
  { id: 3, hex: "#16a34a", labelKey: "lineGreen" as const },
  { id: 4, hex: "#2563eb", labelKey: "lineBlue" as const },
  { id: 5, hex: "#9333ea", labelKey: "linePurple" as const },
  { id: 6, hex: "#0891b2", labelKey: "lineCyan" as const },
  { id: 7, hex: "#ca8a04", labelKey: "lineYellow" as const },
  { id: 8, hex: "#ea580c", labelKey: "lineOrange" as const },
  { id: 9, hex: "#71717a", labelKey: "lineGray" as const },
  { id: 10, hex: "#78716c", labelKey: "lineBrown" as const },
] as const;
export type LineGridId = (typeof LINE_GRID_PALETTE)[number]["id"];
export const DEFAULT_LINE_TABLE_COLOR: LineGridId = 1;
export const DEFAULT_SECONDARY_GRID_COLOR: LineGridId = 9;

export const TEXT_PALETTE = [
  { id: 0, hex: "#ffffff", labelKey: "textWhite" as const },
  { id: 1, hex: "#000000", labelKey: "textBlack" as const },
  { id: 2, hex: "#f5f5f5", labelKey: "textLightGray" as const },
  { id: 3, hex: "#a3a3a3", labelKey: "textGray" as const },
  { id: 4, hex: "#525252", labelKey: "textDarkGray" as const },
  { id: 5, hex: "#78716c", labelKey: "textBrown" as const },
  { id: 6, hex: "#dc2626", labelKey: "textRed" as const },
  { id: 7, hex: "#2563eb", labelKey: "textBlue" as const },
  { id: 8, hex: "#9333ea", labelKey: "textPurple" as const },
  { id: 9, hex: "#71717a", labelKey: "textMediumGray" as const },
] as const;
export type TextColorId = (typeof TEXT_PALETTE)[number]["id"];
export const DEFAULT_TEXT_COLOR: TextColorId = 1;
