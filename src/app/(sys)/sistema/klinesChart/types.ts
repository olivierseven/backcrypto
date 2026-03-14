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
  /** Exibir valor do indicador no eixo Y (default true). */
  showLastValueOnYAxis?: boolean;
  /** Tipo do indicador: RSI e Stochastic usam escala 0–100 no gráfico; MACD, OBV e demais usam escala automática no painel. */
  type?: "SMA" | "EMA" | "WMA" | "RSI" | "MACD" | "Stochastic" | "WilliamsR" | "OBV" | "SAR" | "ATR" | "ADX" | "VWAP" | "Bollinger" | "Volume";
  /** Só para ADX: qual das 3 linhas (+DI, -DI, ADX). */
  adxPart?: "plusDi" | "minusDi" | "adx";
  adxPlusDiColor?: string;
  adxPlusDiLineWidth?: "thin" | "normal";
  adxPlusDiLineStyle?: "solid" | "dotted" | "dashed";
  adxMinusDiColor?: string;
  adxMinusDiLineWidth?: "thin" | "normal";
  adxMinusDiLineStyle?: "solid" | "dotted" | "dashed";
  adxAdxColor?: string;
  adxAdxLineWidth?: "thin" | "normal";
  adxAdxLineStyle?: "solid" | "dotted" | "dashed";
  /** Só para ADX: escala fixa 0–100 (true) ou ajustar aos dados (false). */
  adxFixedScale?: boolean;
  adxLimits?: boolean;
  adxLimitUpper?: number;
  adxLimitLower?: number;
  adxLimitColor?: string;
  adxLimitLineWidth?: "thin" | "normal";
  adxLimitLineStyle?: "solid" | "dotted" | "dashed";
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

export type IntervalOption = { value: number; label: string; param: string };

/** Overlay de estratégia: pinta o candle com a cor quando a condição é verdadeira. results[i] = true para klines[i] (klines[0] = mais recente). */
export interface StrategyCandleOverlay {
  id: string;
  name: string;
  color: string;
  results: boolean[];
}

export type KlinesChartProps = {
  klines: Kline[];
  groupMinutes: number;
  /** Fuso do utilizador (horas, -12..12) aplicado pela API a openTime; usado para contar fechamento em UTC. */
  timezoneOffset?: number;
  intervalLabel?: string;
  /** Opções de tempo (ex.: 1m, 5m, 4h) para o seletor na sidebar. */
  intervalOptions?: IntervalOption[];
  onIntervalChange?: (value: number) => void;
  width: number;
  indicatorLines?: ChartIndicatorLine[];
  /** slot 0 = layout padrão (não sobrescreve appliedStrategyIds); 1–7 = layout do usuário. source='user-load' = usuário clicou em Carregar; nesse caso o layout tem prioridade sobre localStorage. */
  onLayoutConfigLoaded?: (config: Record<string, unknown>, slot?: number, source?: "api" | "user-load") => void;
  /** Chamado ao salvar o layout; o retorno é mesclado ao config (ex.: userIndicators, prefs do painel). */
  getLayoutExtraConfig?: () => Record<string, unknown>;
  /** Incrementado ao aplicar layout no carregamento; força o gráfico a re-renderizar com strategyCandleOverlays atualizados. */
  layoutAppliedTick?: number;
  maxChartHeight?: number;
  /** Chamado quando as dimensões do gráfico mudam (ex.: tamanho 125%). Permite ao container se ajustar sem scroll horizontal. sizePercent = 100 | 125 para cálculo estável. */
  onChartDimensionsChange?: (width: number, height: number, sizePercent: number) => void;
  /** Símbolo exibido no rodapé (ex.: BTCUSDT). */
  symbol?: string;
  /** Abre o painel de seleção de símbolo (header/footer). */
  onOpenSymbolPanel?: () => void;
  /** Quando aplicado, pinta o candle com a cor da estratégia se a condição for verdadeira. */
  strategyCandleOverlays?: StrategyCandleOverlay[];
  /** Gráfico em modo Heikin Ashi (OHLC suavizado). */
  heikinAshi?: boolean;
  /** Alterna modo Heikin Ashi; ao ativar, a tabela e o gráfico passam a usar OHLC Heikin Ashi. */
  onHeikinAshiChange?: (enabled: boolean) => void;
  /** Indicador vertical "volume no preço": usa cache do intervalo mapeado (ex.: 1h → 15m). */
  volumeAtPriceEnabled?: boolean;
  /** Klines do intervalo de cache para VAP (mesma moeda, tempo menor); quando definido, usa em vez de klines. */
  volumeAtPriceKlines?: (string | number)[][];
  volumeAtPriceBuckets?: number;
  /** Percentual (20–100%) do máximo de velas do cache para o VAP; passo 1%. */
  volumeAtPricePercent?: number;
  onVolumeAtPricePercentChange?: (v: number) => void;
  /** Texto ex.: "15 dias" para exibir ao lado do controle (equivalente em tempo do VAP). */
  vapTimeSpanLabel?: string;
  volumeAtPriceOpacity?: number;
  /** Escala da largura das barras: 30–100% da largura máxima (120px). */
  volumeAtPriceWidthPercent?: number;
  volumeAtPriceSide?: "left" | "right";
  volumeAtPriceColorAbove?: string;
  volumeAtPriceColorBelow?: string;
  onVolumeAtPriceEnabledChange?: (v: boolean) => void;
  onVolumeAtPriceBucketsChange?: (v: number) => void;
  onVolumeAtPriceOpacityChange?: (v: number) => void;
  onVolumeAtPriceWidthPercentChange?: (v: number) => void;
  onVolumeAtPriceSideChange?: (v: "left" | "right") => void;
  onVolumeAtPriceColorAboveChange?: (v: string) => void;
  onVolumeAtPriceColorBelowChange?: (v: string) => void;
  /** Preço ao vivo do último fechamento (ex.: WebSocket). Quando definido, a linha e o label de "último fechamento" usam este valor em vez de klines[0][4], evitando mostrar preço do par anterior após troca de símbolo. */
  liveLastClose?: number | string | null;
  /** Chamado quando o layout em uso muda (nome ou slot), para exibir no container (ex.: canto esquerdo da última atualização). */
  onCurrentLayoutLabelChange?: (label: string) => void;
  /** Admin: pode renomear modelos ChartModels (slot 0) na seção Carregar. */
  isAdmin?: boolean;
  /** Usuário free: só layout default; não pode salvar/carregar layouts; modal de upgrade ao tentar. */
  isFreeUser?: boolean;
}

/** Dados para desenho do volume no preço: intervalos simétricos no eixo Y com volume acumulado por faixa de fechamento. */
export interface VolumeAtPriceData {
  buckets: { priceLow: number; priceHigh: number; volume: number }[];
  maxVolume: number;
}
