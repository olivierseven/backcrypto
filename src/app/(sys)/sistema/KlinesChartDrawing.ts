/**
 * Módulo de desenho no gráfico de candles.
 * Tipos e funções puras para segmentos de reta, hit-test e conversão.
 * O estado e a UI de desenho ficam em useKlinesChartDrawing.
 */

/** Ponta do segmento: nenhuma, círculo ou seta. */
export type SegmentCap = "none" | "point" | "arrow";

/** Segmento em espaço de dados (índice global + preço) — não se move ao rolar o gráfico. */
export type DrawSegment = {
  index1: number;
  price1: number;
  index2: number;
  price2: number;
  /** Tipo: segmento de reta, retração de Fibonacci, canal, retângulo ou reta horizontal. Default: segment */
  type?: "segment" | "fibonacci" | "channel" | "rectangle" | "horizontalLine";
  /** Deslocamento em preço da reta paralela (só canal). Default: 0 */
  channelOffset?: number;
  /** Cor do traço (hex). Default: #000000 */
  color?: string;
  /** Ponta no início do segmento. Default: none (fibonacci ignora) */
  startCap?: SegmentCap;
  /** Ponta no fim do segmento. Default: none (fibonacci ignora) */
  endCap?: SegmentCap;
  /** Exibir diferença percentual no meio do segmento. Default: true (só para segment) */
  showPercent?: boolean;
  /** Exibir valores (preço) no início e no fim do segmento. Default: false */
  showValues?: boolean;
  /** Cor do nível 61,8% (só Fibonacci). Se não definido, usa color. */
  fibLevel618Color?: string;
  /** Largura do traço do Fibonacci (modelo). Só Fibonacci. */
  fibStrokeWidth?: FibStrokeWidth;
  /** Largura da linha do nível 61,8%. Só Fibonacci. */
  fibLevel618StrokeWidth?: FibStrokeWidth;
  /** Número de índices (candles) que as 5 linhas se estendem à direita em pontilhado. Só Fibonacci. */
  fibExtensionIndices?: number;
  /** Primeiro nível do Fibonacci em percentual (0–50). Default: 33.33. */
  fibLevelPct1?: number;
  /** Cor das linhas das extremidades (paralelas). Só canal. Se não definido, usa color. */
  channelExtremityColor?: string;
  /** Largura do traço da linha do meio. Só canal. */
  channelMidStrokeWidth?: FibStrokeWidth;
  /** Largura do traço das linhas das extremidades. Só canal. */
  channelExtremityStrokeWidth?: FibStrokeWidth;
  /** Número de índices (candles) que as 3 linhas do canal se estendem à direita em pontilhado. Só canal. */
  channelExtensionIndices?: number;
  /** Largura do traço da borda. Só retângulo. */
  rectangleStrokeWidth?: FibStrokeWidth;
  /** Preenchimento do retângulo com a cor da borda a 30% de opacidade. Só retângulo. */
  rectangleFilled?: boolean;
  /** Espessura do traço. Só reta horizontal. */
  horizontalLineStrokeWidth?: FibStrokeWidth;
  /** Tipo de traço: contínuo, tracejado ou pontilhado. Só reta horizontal. */
  horizontalLineStrokeStyle?: "solid" | "dashed" | "dotted";
};

/** Largura do traço: fino, médio ou grosso (só Fibonacci). */
export type FibStrokeWidth = "thin" | "medium" | "thick";

export const FIB_STROKE_WIDTH_VALUES: Record<FibStrokeWidth, number> = { thin: 1, medium: 2, thick: 3 };

export const FIB_STROKE_WIDTH_OPTIONS: FibStrokeWidth[] = ["thin", "medium", "thick"];

/** Padrões iniciais para novos desenhos (persistidos no localStorage). */
export type DrawDefaults = {
  segment: Partial<Pick<DrawSegment, "color" | "startCap" | "endCap" | "showPercent" | "showValues">>;
  fibonacci: Partial<Pick<DrawSegment, "color" | "fibLevel618Color" | "showPercent" | "showValues" | "fibStrokeWidth" | "fibLevel618StrokeWidth" | "fibLevelPct1">>;
  channel: Partial<Pick<DrawSegment, "color" | "channelExtremityColor" | "channelMidStrokeWidth" | "channelExtremityStrokeWidth" | "showValues">>;
  rectangle: Partial<Pick<DrawSegment, "color" | "rectangleStrokeWidth" | "rectangleFilled">>;
  horizontalLine: Partial<Pick<DrawSegment, "color" | "horizontalLineStrokeWidth" | "horizontalLineStrokeStyle">>;
};

/** strokeDasharray para reta horizontal: contínuo, tracejado, pontilhado. */
export type HorizontalLineStrokeStyle = "solid" | "dashed" | "dotted";

export const HORIZONTAL_LINE_STROKE_STYLE_DASH: Record<HorizontalLineStrokeStyle, string> = {
  solid: "none",
  dashed: "8 4",
  dotted: "2 2",
};

export const DEFAULT_SEGMENT_COLOR = "#000000";

/** Parâmetros para converter entre pixel e dados (preenchido pelo chart a cada render). */
export type DrawConversionParams = {
  startIndex: number;
  gap: number;
  MARGIN_LEFT: number;
  MARGIN_TOP: number;
  chartH: number;
  chartW: number;
  yMin: number;
  yRange: number;
  n: number;
  /** Índice máximo para desenho (inclui área dos candles invisíveis à direita). */
  maxDrawIndex: number;
  logScale: boolean;
  yLogMin: number;
  yLogRange: number;
  drawMagnetic: boolean;
};

/** Distância do ponto (px, py) ao segmento de reta (x1,y1)-(x2,y2). */
export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}
