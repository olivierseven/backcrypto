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
  /** Tipo do indicador: RSI e Stochastic usam escala 0–100 no gráfico; MACD, OBV e demais usam escala automática no painel. */
  type?: "SMA" | "EMA" | "WMA" | "RSI" | "MACD" | "Stochastic" | "WilliamsR" | "OBV" | "SAR" | "ATR" | "VWAP" | "Bollinger" | "Volume";
  /** Onde renderizar: main ou panel2/panel3/panel4 (para RSI). */
  panel?: "main" | "panel2" | "panel3" | "panel4" | "panel5";
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
  /** Desenho: linha (default), barras (histograma MACD) ou pontos (SAR). */
  display?: "line" | "histogram" | "points";
  /** Só para display "points" (SAR): tamanho do ponto (thin = mais fino, normal = mais grosso). */
  pointSize?: "thin" | "normal";
  /** Cor das barras do histograma acima de zero. */
  histogramColorAbove?: string;
  /** Cor das barras do histograma abaixo de zero. */
  histogramColorBelow?: string;
  /** Só para Volume: exibir em USDT (quote); default false. */
  volumeInUsdt?: boolean;
  /** Só para Stochastic: limites superior/inferior (0–100). */
  stochLimits?: boolean;
  stochLimitUpper?: number;
  stochLimitLower?: number;
  stochLimitColor?: string;
  stochLimitLineWidth?: "thin" | "normal";
  stochLimitLineStyle?: "solid" | "dotted" | "dashed";
  /** Só para Williams %R: limites (escala -100 a 0; ex. -20 / -80). */
  williamsRLimits?: boolean;
  williamsRLimitUpper?: number;
  williamsRLimitLower?: number;
  williamsRLimitColor?: string;
  williamsRLimitLineWidth?: "thin" | "normal";
  williamsRLimitLineStyle?: "solid" | "dotted" | "dashed";
  /** Só para Bollinger: colunas upper/middle/lower em columnIndex, columnIndex+1, columnIndex+2. */
  bollingerShowUpper?: boolean;
  bollingerShowLower?: boolean;
  bollingerShowMiddle?: boolean;
  /** Opacidade da faixa entre limite e média (0–0.3). */
  bollingerBandOpacity?: number;
  bollingerLimitsColor?: string;
  bollingerLimitsLineStyle?: "solid" | "dotted" | "dashed";
  bollingerLimitsLineWidth?: "thin" | "normal";
  bollingerMiddleColor?: string;
  bollingerMiddleLineStyle?: "solid" | "dotted" | "dashed";
  bollingerMiddleLineWidth?: "thin" | "normal";
}

export type KlinesChartProps = {
  klines: Kline[];
  groupMinutes: number;
  intervalLabel?: string;
  width: number;
  indicatorLines?: ChartIndicatorLine[];
  onLayoutConfigLoaded?: (config: Record<string, unknown>) => void;
  /** Chamado ao salvar o layout; o retorno é mesclado ao config (ex.: userIndicators, prefs do painel). */
  getLayoutExtraConfig?: () => Record<string, unknown>;
  maxChartHeight?: number;
};
