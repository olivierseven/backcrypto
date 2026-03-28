/** Máximo de indicadores no painel principal (main). */
export const MAIN_MAX_INDICATORS = 7;
/** Máximo de indicadores em cada painel secundário (2, 3 ou 4). */
export const SECONDARY_MAX_INDICATORS = 3;

/** Paleta de cores para indicadores (nomes clássicos). */
export const INDICATOR_COLOR_PALETTE = [
  "#FFFFFF", // white
  "#000000", // black
  "#808080", // gray
  "#000080", // navy
  "#0000FF", // blue
  "#00FFFF", // aqua / cyan
  "#7FFFD4", // aquamarine
  "#008000", // green
  "#00FF00", // lime
  "#808000", // olive
  "#DAA520", // goldenrod
  "#8B4513", // saddle brown
  "#8B008B", // dark magenta
  "#A020F0", // purple
  "#FF00FF", // fuchsia / magenta
  "#FF1493", // deep pink
  "#FF0000", // red
  "#FF8C00", // dark orange
  "#FFFF00", // yellow
];

export const INTERVAL_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "1m" },
  { value: 3, label: "3m" },
  { value: 5, label: "5m" },
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 45, label: "45m" },
  { value: 60, label: "1h" },
  { value: 120, label: "2h" },
  { value: 180, label: "3h" },
  { value: 240, label: "4h" },
  { value: 360, label: "6h" },
  { value: 480, label: "8h" },
  { value: 720, label: "12h" },
  { value: 1440, label: "1D" },
  { value: 4320, label: "3D" },
  { value: 10080, label: "1w" },
  { value: 43200, label: "1month" },
];
