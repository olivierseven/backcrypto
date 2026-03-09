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
  /** Tipo: segmento de reta, retração de Fibonacci, canal, retângulo, reta horizontal, reta vertical, seta ou texto. Default: segment */
  type?: "segment" | "fibonacci" | "channel" | "rectangle" | "horizontalLine" | "verticalLine" | "arrow" | "text";
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
  /** Mostrar valor do primeiro ponto (texto centralizado em cima da reta). Só reta horizontal. Default: false */
  horizontalLineShowValue?: boolean;
  /** Estender a reta horizontalmente até o final do gráfico em pontilhado. Só reta horizontal. Default: false */
  horizontalLineExtendToEnd?: boolean;
  /** Indicar o valor no eixo Y. Só reta horizontal. Default: false */
  horizontalLineShowOnYAxis?: boolean;
  /** Espessura do traço. Só reta vertical. */
  verticalLineStrokeWidth?: FibStrokeWidth;
  /** Tipo de traço: contínuo, tracejado ou pontilhado. Só reta vertical. */
  verticalLineStrokeStyle?: "solid" | "dashed" | "dotted";
  /** Mostrar data e hora no eixo X (estilo do crosshair). Só reta vertical. Default: false */
  verticalLineShowDateTimeOnXAxis?: boolean;
  /** Estender a reta vertical para baixo nos demais painéis visíveis. Só reta vertical. Default: false */
  verticalLineExtendToPanels?: boolean;
  /** Tamanho da seta: pequeno, médio ou grande. Só arrow. Default: medium */
  arrowSize?: ArrowSize;
  /** Ângulo da seta em graus (0–360). 0 = direita, 90 = cima. Só arrow. */
  arrowAngle?: number;
  /** Conteúdo do texto (UTF-8). Quebras de linha com \\n. Caixa compacta ao redor do texto. Só text. */
  textContent?: string;
  /** Texto em negrito. Só text. */
  textBold?: boolean;
  /** Tamanho da fonte do texto. Só text. Default: medium */
  textSize?: TextSize;
};

/** Tamanho da fonte do texto (pequeno, médio, grande). */
export type TextSize = "small" | "medium" | "large";

export const TEXT_SIZE_OPTIONS: TextSize[] = ["small", "medium", "large"];

/** Fator multiplicador do fontSize base para cada tamanho de texto. */
export const TEXT_SIZE_FACTOR: Record<TextSize, number> = { small: 1.25, medium: 2, large: 2.75 };

/** Tamanho da seta (pequeno, médio, grande). */
export type ArrowSize = "small" | "medium" | "large";

export const ARROW_SIZE_OPTIONS: ArrowSize[] = ["small", "medium", "large"];

/** Comprimento da seta em pixels por tamanho (para criação e preview). */
export const ARROW_LENGTH_PX: Record<ArrowSize, number> = { small: 16, medium: 28, large: 42 };

/** Opacidade fixa das setas (0–1). */
export const ARROW_OPACITY = 1;

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
  horizontalLine: Partial<Pick<DrawSegment, "color" | "horizontalLineStrokeWidth" | "horizontalLineStrokeStyle" | "horizontalLineShowValue" | "horizontalLineExtendToEnd" | "horizontalLineShowOnYAxis">>;
  verticalLine: Partial<Pick<DrawSegment, "color" | "verticalLineStrokeWidth" | "verticalLineStrokeStyle" | "verticalLineShowDateTimeOnXAxis" | "verticalLineExtendToPanels">>;
  arrow: Partial<Pick<DrawSegment, "color" | "arrowSize" | "arrowAngle">>;
  text: Partial<Pick<DrawSegment, "color" | "textBold" | "textSize">>;
};

/** strokeDasharray para reta horizontal: contínuo, tracejado, pontilhado. */
export type HorizontalLineStrokeStyle = "solid" | "dashed" | "dotted";

export const HORIZONTAL_LINE_STROKE_STYLE_DASH: Record<HorizontalLineStrokeStyle, string> = {
  solid: "none",
  dashed: "8 4",
  dotted: "2 2",
};

export const DEFAULT_SEGMENT_COLOR = "#000000";

/** Cor padrão do texto (estilo ANSI / terminal). */
export const DEFAULT_TEXT_COLOR = "#1a1a1a";

const TEXT_PAD_X = 4;
const TEXT_PAD_Y = 4;

/**
 * Calcula dimensões da caixa de texto de forma compacta ao redor do conteúdo (sem limite de largura).
 * baseFontSize: tamanho base da fonte (ex.: 10).
 */
export function getTextSegmentBox(
  lines: string[],
  textSize: TextSize,
  baseFontSize: number
): {
  wrappedLines: string[];
  boxW: number;
  boxH: number;
  contentW: number;
  lineHeight: number;
  approxCharWidth: number;
  textFontSize: number;
} {
  const textFontSize = baseFontSize * TEXT_SIZE_FACTOR[textSize];
  const charWidthFactor = textSize === "small" ? 0.42 : textSize === "medium" ? 0.46 : 0.54;
  const approxCharWidth = textFontSize * charWidthFactor;
  const lineHeight = textFontSize * 1.35;
  const wrappedLines = lines.length ? lines : [""];
  const maxLineLen = Math.max(1, ...wrappedLines.map((l) => l.length));
  const contentW = maxLineLen * approxCharWidth;
  const boxW = Math.ceil(contentW) + TEXT_PAD_X * 2;
  const boxH = Math.ceil(wrappedLines.length * lineHeight) + TEXT_PAD_Y * 2;
  return { wrappedLines, boxW, boxH, contentW, lineHeight, approxCharWidth, textFontSize };
}

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
