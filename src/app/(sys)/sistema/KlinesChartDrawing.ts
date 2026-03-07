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
  /** Tipo: segmento de reta ou retração de Fibonacci. Default: segment */
  type?: "segment" | "fibonacci";
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
};

/** Padrões iniciais para novos desenhos (persistidos no localStorage). */
export type DrawDefaults = {
  segment: Partial<Pick<DrawSegment, "color" | "startCap" | "endCap" | "showPercent" | "showValues">>;
  fibonacci: Partial<Pick<DrawSegment, "color" | "fibLevel618Color" | "showPercent" | "showValues">>;
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
