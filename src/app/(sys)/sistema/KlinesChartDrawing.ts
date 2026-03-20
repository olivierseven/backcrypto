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
  /** Tipo: segmento de reta, retração de Fibonacci, retração livre, canal, stop/gain, retângulo, reta horizontal, reta vertical, seta, texto ou lápis (desenho livre). Default: segment */
  type?: "segment" | "fibonacci" | "freeRetracement" | "channel" | "stopGain" | "rectangle" | "horizontalLine" | "verticalLine" | "arrow" | "text" | "pencil";
  /** Deslocamento em preço da reta paralela (só canal). Default: 0 */
  channelOffset?: number;
  /** Proporção ganho (acima da linha do meio). Mín 1, máx 10, 2 decimais. Só stopGain. Default: 1 */
  stopGainRatioUp?: number;
  /** Proporção perda (abaixo da linha do meio). Mín 1, máx 10, 2 decimais. Só stopGain. Default: 1 */
  stopGainRatioDown?: number;
  /** Abertura total em preço (distribuída pela proporção). Só stopGain. Default: 0 */
  stopGainOpenAmount?: number;
  /** Opacidade do preenchimento verde (ganho) e vermelho (perda), 0.1–0.7. Só stopGain. Default: 0.5 */
  stopGainFillOpacity?: number;
  /** Exibir percentuais (ganho/perda em % em relação ao meio). Só stopGain. Default: false */
  stopGainShowPercent?: boolean;
  /** Marcar os valores (meio, ganho, perda) no eixo Y. Só stopGain. Default: false */
  stopGainShowValuesOnYAxis?: boolean;
  /** Grossura dos traços do Stop/Gain: fino ou médio. Default: medium */
  stopGainStrokeWidth?: "thin" | "medium";
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
  /** Exibir nível fixo em 161,8% (1.618). Só Fibonacci. Default: false */
  fibShow1618?: boolean;
  /** Marcar os valores dos níveis no eixo Y. Só Fibonacci. Default: false */
  fibShowValuesOnYAxis?: boolean;
  /** Primeiro nível da retração livre em percentual (0–50). Só freeRetracement. Default: 33.33 */
  freeRetracementLevelPct1?: number;
  /** Terceiro nível da retração livre em percentual (50–100). Só freeRetracement. Default: 61.8 */
  freeRetracementLevelPct?: number;
  /** Nível de extensão da retração livre em percentual (100–200). Só freeRetracement. Default: 100 */
  freeRetracementLevelPctExt?: number;
  /** Marcar os valores dos níveis no eixo Y. Só freeRetracement. Default: false */
  freeRetracementShowValuesOnYAxis?: boolean;
  /** Número de índices que a linha da retração livre se estende à direita em pontilhado. Só freeRetracement. */
  freeRetracementExtensionIndices?: number;
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
  /** Pontos do traço livre (índice + preço). Só pencil. index1/price1 e index2/price2 = primeiro e último. */
  pencilPoints?: { index: number; price: number }[];
  /** Espessura do traço do lápis: fina, média ou grossa. Só pencil. Default: medium */
  pencilStrokeWidth?: "thin" | "medium" | "thick";
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
  fibonacci: Partial<Pick<DrawSegment, "color" | "fibLevel618Color" | "showPercent" | "showValues" | "fibStrokeWidth" | "fibLevel618StrokeWidth" | "fibLevelPct1" | "fibShow1618" | "fibShowValuesOnYAxis">>;
  freeRetracement: Partial<Pick<DrawSegment, "color" | "freeRetracementLevelPct1" | "freeRetracementLevelPct" | "freeRetracementLevelPctExt" | "freeRetracementShowValuesOnYAxis" | "freeRetracementExtensionIndices" | "fibStrokeWidth" | "showPercent" | "showValues">>;
  channel: Partial<Pick<DrawSegment, "color" | "channelExtremityColor" | "channelMidStrokeWidth" | "channelExtremityStrokeWidth" | "showValues">>;
  stopGain: Partial<Pick<DrawSegment, "stopGainRatioUp" | "stopGainRatioDown" | "stopGainFillOpacity" | "stopGainShowPercent" | "stopGainShowValuesOnYAxis" | "stopGainStrokeWidth">>;
  rectangle: Partial<Pick<DrawSegment, "color" | "rectangleStrokeWidth" | "rectangleFilled">>;
  horizontalLine: Partial<Pick<DrawSegment, "color" | "horizontalLineStrokeWidth" | "horizontalLineStrokeStyle" | "horizontalLineShowValue" | "horizontalLineExtendToEnd" | "horizontalLineShowOnYAxis">>;
  verticalLine: Partial<Pick<DrawSegment, "color" | "verticalLineStrokeWidth" | "verticalLineStrokeStyle" | "verticalLineShowDateTimeOnXAxis" | "verticalLineExtendToPanels">>;
  arrow: Partial<Pick<DrawSegment, "color" | "arrowSize" | "arrowAngle">>;
  text: Partial<Pick<DrawSegment, "color" | "textBold" | "textSize">>;
  pencil: Partial<Pick<DrawSegment, "color" | "pencilStrokeWidth">>;
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

/** Largura estimada por linha: média por carácter + pequeno ajuste por glifos tipicamente largos (sem inflar a caixa toda). */
function estimateLineContentWidthPx(line: string, approxCharWidth: number): number {
  if (!line.length) return approxCharWidth * 0.35;
  let wideCount = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    // Dígitos, @, %; letras tipicamente largas (M, W, m, w)
    if ((c >= 0x30 && c <= 0x39) || c === 0x25 || c === 0x40) wideCount += 1;
    else if (c === 77 || c === 87 || c === 109 || c === 119) wideCount += 0.65;
    else if (c > 0xff) wideCount += 0.5; // latinos estendidos / CJK
  }
  return line.length * approxCharWidth + wideCount * approxCharWidth * 0.22;
}

/**
 * Calcula dimensões da caixa de texto ao redor do conteúdo (sem wrap por palavra).
 * Largura ≈ a linha mais larga (estimativa ajustada); margem mínima + clipPath no SVG cobre picos.
 */
export function getTextSegmentBox(
  lines: string[],
  textSize: TextSize,
  baseFontSize: number,
  textBold?: boolean
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
  /** Largura média por carácter (UI sans-serif), ligeiramente acima do mínimo para não ficar folga enorme à direita. */
  const charWidthFactor = textSize === "small" ? 0.45 : textSize === "medium" ? 0.49 : 0.56;
  const approxCharWidth = textFontSize * charWidthFactor;
  const lineHeight = textFontSize * 1.35;
  const wrappedLines = lines.length ? lines : [""];
  const lineContentWidths = wrappedLines.map((l) => estimateLineContentWidthPx(l, approxCharWidth));
  const widest = Math.max(approxCharWidth, ...lineContentWidths);
  /** Pouca folga: negrito um pouco mais; o clipPath no render corta overflow residual. */
  const widthSafety = textBold ? 1.04 : 1.02;
  const contentW = widest * widthSafety;
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

/** Distância mínima do ponto (px, py) à polilinha definida por segmentToPixel e pontos { index, price }[]. */
export function distanceToPencilPath(
  px: number,
  py: number,
  points: { index: number; price: number }[],
  segmentToPixel: (index: number, price: number) => { x: number; y: number }
): number {
  if (points.length < 2) {
    if (points.length === 1) {
      const p = segmentToPixel(points[0].index, points[0].price);
      return Math.hypot(px - p.x, py - p.y);
    }
    return Infinity;
  }
  let minD = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = segmentToPixel(points[i].index, points[i].price);
    const b = segmentToPixel(points[i + 1].index, points[i + 1].price);
    const d = distanceToSegment(px, py, a.x, a.y, b.x, b.y);
    if (d < minD) minD = d;
  }
  return minD;
}
