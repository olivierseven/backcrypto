/**
 * Tipos do gráfico de candles (OHLC).
 */

export type Kline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  number,
  ...(number | null)[],
];

/** Indicador a desenhar no gráfico: coluna (índice 12+), cor, espessura, tipo de traço e rótulo para a faixa no topo. */
export interface ChartIndicatorLine {
  columnIndex: number;
  color: string;
  lineWidth?: "thin" | "normal";
  lineStyle?: "solid" | "dotted" | "dashed";
  /** Rótulo exibido na faixa de indicadores no topo (ex.: "SMA(7) Close"). */
  label?: string;
  /** Rótulo resumido para o display (ex.: "SMA(7) C"). */
  shortLabel?: string;
  /** Tipo do indicador: RSI usa escala 0–100 no gráfico; MACD e demais usam escala automática no painel. */
  type?: "SMA" | "EMA" | "WMA" | "RSI" | "MACD";
  /** Onde renderizar: main ou panel2/panel3/panel4 (para RSI). */
  panel?: "main" | "panel2" | "panel3" | "panel4";
  /** Só para RSI: true = escala fixa 0–100 no eixo Y; false ou ausente (para não-RSI) = escala automática. */
  rsiFixedScale?: boolean;
  /** Só para RSI: desenhar linha horizontal em 50%. */
  rsiCenterLine?: boolean;
  rsiCenterLineColor?: string;
  rsiCenterLineWidth?: "thin" | "normal";
  rsiCenterLineStyle?: "solid" | "dotted" | "dashed";
  /** Só para RSI: limites superior/inferior. */
  rsiLimits?: boolean;
  rsiLimitUpper?: number;
  rsiLimitLower?: number;
  rsiLimitColor?: string;
  rsiLimitLineWidth?: "thin" | "normal";
  rsiLimitLineStyle?: "solid" | "dotted" | "dashed";
  /** Desenho: linha (default) ou barras (histograma MACD). */
  display?: "line" | "histogram";
  /** Cor das barras do histograma acima de zero. */
  histogramColorAbove?: string;
  /** Cor das barras do histograma abaixo de zero. */
  histogramColorBelow?: string;
}

export type KlinesChartProps = {
  klines: Kline[];
  groupMinutes: number;
  intervalLabel?: string;
  width: number;
  indicatorLines?: ChartIndicatorLine[];
  onLayoutConfigLoaded?: (config: Record<string, unknown>) => void;
  maxChartHeight?: number;
};
