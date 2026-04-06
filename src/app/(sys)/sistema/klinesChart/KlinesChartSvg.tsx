"use client";

/**
 * SVG do gráfico de candles: faixa de indicadores, grade, candles, crosshair, tooltip OHLC, segmentos e overlay de desenho.
 */
import { useId, useRef, useState, useEffect, type RefObject, type ReactNode } from "react";
import { ASSET_PREFIX } from "@/app/constants";
import { MARGIN_LEFT, MARGIN_TOP, INDICATOR_STRIP_HEIGHT, VOLUME_AT_PRICE_MAX_WIDTH_PX } from "../KlinesChartConstants";
import { parseNum } from "../klinesFormatters";
import { formatTimeLabel, formatDateLabel, formatDateYyyyMmDd, formatMonthOnly, formatAbbreviated } from "../klinesFormatters";
import { FIB_STROKE_WIDTH_VALUES, HORIZONTAL_LINE_STROKE_STYLE_DASH, type DrawSegment, type DrawDefaults } from "../KlinesChartDrawing";
import { DrawSegmentRender } from "./DrawSegmentRender";
import { DrawOverlay } from "./DrawOverlay";
import { DrawSegmentHandles, type DrawDraggingPoint } from "./DrawSegmentHandles";
import { DrawTextInputOverlay } from "./DrawTextInputOverlay";
import { DEFAULT_TEXT_COLOR } from "../KlinesChartDrawing";
import type {
  ChartIndicatorLine,
  ChartStyle,
  RegressionOverlayPath,
  SpotOrderMarker,
  StrategyCandleOverlay,
} from "./types";

function lineWidthToStroke(w: "thin" | "normal" | "thick" | undefined): number {
  return w === "thin" ? 0.5 : w === "thick" ? 2 : 1;
}

export interface KlinesChartSvgProps {
  chartSvgRef: RefObject<SVGSVGElement | null>;
  crosshairOverlayRef: RefObject<SVGRectElement | null>;
  width: number;
  chartHeight: number;
  chartW: number;
  chartH: number;
  gap: number;
  candleW: number;
  /** "candles" = candle sticks; "bars" = OHLC bar; "line" = close line only; "linePoints" = close line with points; "area" = line with area below filled (70% opacity); "kagiClassic" = Kagi ortogonal com cores de reversão. */
  chartStyle?: ChartStyle;
  /** Se true: liga fechos em caminho ortogonal (H depois V), estilo próximo ao Kagi clássico. Só aplica a line/linePoints/area. */
  closeLineStepPath?: boolean;
  /** When "hollow": candle de alta = vazio (só contorno), de baixa = preenchido. */
  candleBodyStyle?: "filled" | "hollow";
  y: (price: number) => number;
  cx: (i: number) => number;
  segmentToPixel: (index: number, price: number) => { x: number; y: number };
  snapToCandlePoint: (px: number, py: number) => { index: number; price: number };
  windowSlice: (number | string | null)[][];
  fullReversed: (number | string | null)[][];
  startIndex: number;
  windowN: number;
  /** windowN + velas invisíveis efetivas (Ichimoku pode estender até 100). */
  totalSlots: number;
  n: number;
  candleColors: { bull: string; bear: string };
  yTickValues: number[];
  verticalIndicesFiltered: number[];
  /** Mesma âncora que a principal; passo mais curto (~dobro de colunas tracejadas). */
  secondaryVerticalIndicesFiltered: number[];
  /** Posições X (px) dos marcadores de meia-noite no fuso UTC da conta (interpoladas entre velas). */
  utcDayStartMarkerXs?: number[];
  /** Texto para tooltip dos marcadores (ex.: início do dia + UTC±N). */
  utcDayStartMarkerTitle?: string;
  dateBreaksFiltered: { index: number; dateStr: string; openTime?: number }[];
  dayBreaksFiltered: { index: number; label: string; openTime?: number; mainAxisKind?: "month" | "day" | "hour" }[];
  showMainAxis: boolean;
  showSecondaryAxis: boolean;
  showLastCloseLine: boolean;
  showLastClose: boolean;
  lastCloseY: number;
  volumeOnPrice: boolean;
  volumeOnPriceOpacity: number;
  lineTableHex: string;
  lineTableStrokeWidth?: "thin" | "normal" | "thick";
  lineTableStrokeStyle?: "solid" | "dotted" | "dashed";
  secondaryGridHex: string;
  lastCloseLineHex: string;
  lastCloseLineStrokeWidth?: "thin" | "normal" | "thick";
  lastCloseLineStrokeStyle?: "solid" | "dotted" | "dashed";
  /** Linhas horizontais: ordens limite de compra abertas (Binance) + preço na boleta. */
  showLimitBuyLine?: boolean;
  limitBuyLineYs?: number[];
  limitBuyLineHex?: string;
  /** Pré-visualização Ctrl: compra limite válida (≥0,1% abaixo do último). */
  ctrlLimitBuyPreviewLineY?: number | null;
  ctrlLimitBuyPreviewHex?: string;
  /** Pré-visualização Alt: venda limite válida (≥0,1% acima do último). */
  altLimitSellPreviewLineY?: number | null;
  altLimitSellPreviewHex?: string;
  /** Ordens limite de venda abertas (Binance). */
  showLimitSellLine?: boolean;
  limitSellLineYs?: number[];
  limitSellLineHex?: string;
  chartBgHex: string;
  backgroundTextHex: string;
  formatYAxis: (v: number) => string;
  hasPanel2: boolean;
  hasPanel3: boolean;
  hasPanel4: boolean;
  hasPanel5: boolean;
  panel2Top: number;
  panel3Top: number;
  panel4Top: number;
  panel5Top: number;
  panelTop: (p: "panel2" | "panel3" | "panel4" | "panel5") => number;
  panelHeight: (p: "panel2" | "panel3" | "panel4" | "panel5") => number;
  panelExtents: Record<"panel2" | "panel3" | "panel4" | "panel5", { min: number; max: number }>;
  indicatorLines: ChartIndicatorLine[];
  getPanel: (ind: ChartIndicatorLine) => "main" | "panel2" | "panel3" | "panel4" | "panel5";
  yValInPanel: (val: number, top: number, h: number, pMin: number, pMax: number) => number;
  hasIndicatorStrip: boolean;
  isDarkBg: boolean;
  crosshairPoint: { index: number; price: number; panelClickY?: number; panelValue?: number } | null;
  crosshairDragging: boolean;
  setCrosshairPoint: (p: { index: number; price: number } | null) => void;
  setCrosshairDragging: (v: boolean) => void;
  drawingsVisible: boolean;
  drawSegments: DrawSegment[];
  setDrawSegments: React.Dispatch<React.SetStateAction<DrawSegment[]>>;
  drawDefaults: DrawDefaults;
  drawPending: { index1: number; price1: number } | null;
  setDrawPending: (p: { index1: number; price1: number } | null) => void;
  drawPendingRectSecond: { index: number; price: number } | null;
  setDrawPendingRectSecond: (p: { index: number; price: number } | null) => void;
  drawPendingFibSecond: { index: number; price: number } | null;
  setDrawPendingFibSecond: (p: { index: number; price: number } | null) => void;
  drawPendingFreeRetraceSecond: { index: number; price: number } | null;
  setDrawPendingFreeRetraceSecond: (p: { index: number; price: number } | null) => void;
  drawPendingLineSecond: { index: number; price: number } | null;
  setDrawPendingLineSecond: (p: { index: number; price: number } | null) => void;
  drawPendingChannelSecond: { index: number; price: number } | null;
  setDrawPendingChannelSecond: (p: { index: number; price: number } | null) => void;
  drawPendingStopGainSecond: { index: number; price: number } | null;
  setDrawPendingStopGainSecond: (p: { index: number; price: number } | null) => void;
  drawPendingHorizontalSecond: { index: number; price: number } | null;
  setDrawPendingHorizontalSecond: (p: { index: number; price: number } | null) => void;
  drawPendingArrow: { index1: number; price1: number; angleRad: number } | null;
  setDrawPendingArrow: (p: { index1: number; price1: number; angleRad: number } | null) => void;
  drawPendingText: { index1: number; price1: number } | null;
  setDrawPendingText: (p: { index1: number; price1: number } | null) => void;
  drawPendingPencil: { index: number; price: number }[] | null;
  setDrawPendingPencil: (p: { index: number; price: number }[] | null) => void;
  onCreateTextSegment?: (textContent: string) => void;
  pixelToData: (x: number, y: number) => { index: number; price: number };
  selectedSegmentIndex: number | null;
  setSelectedSegmentIndex: (i: number | null) => void;
  drawMode: boolean;
  drawTool: "line" | "fibonacci" | "freeRetracement" | "channel" | "stopGain" | "rectangle" | "horizontalLine" | "verticalLine" | "arrow" | "text" | "ruler" | "select" | "pencil";
  setDrawDragging: React.Dispatch<React.SetStateAction<{ segmentIndex: number; point: DrawDraggingPoint } | null>>;
  /** Com mão ativa: arrastar no retângulo (fora de segmento) navega candles. Delta: + = futuro, - = passado. Velocidade limitada no SVG. */
  onSelectToolPan?: (deltaCandles: number) => void;
  /** Clique no número (2)(3)… na faixa de indicadores: permuta painéis secundários adjacentes. */
  onSwapSecondaryPanel?: (panel: "panel2" | "panel3" | "panel4" | "panel5") => void;
  /** Chamado quando o usuário clica no gráfico para desenhar (segmento ou Fibonacci), para fechar a caixa de opções. */
  onChartDrawClick?: () => void;
  /** Chamado quando um novo segmento é criado (segundo clique). Recebe o índice do novo segmento para selecioná-lo e abrir opções. */
  onSegmentCreated?: (newIndex: number) => void;
  t: Record<string, string>;
  volumeAtPriceData?: { buckets: { priceLow: number; priceHigh: number; volume: number }[]; maxVolume: number } | null;
  volumeAtPriceOpacity?: number;
  /** Escala da largura das barras: 30–100% de VOLUME_AT_PRICE_MAX_WIDTH_PX. */
  volumeAtPriceWidthPercent?: number;
  volumeAtPriceSide?: "left" | "right";
  volumeAtPriceColorAbove?: string;
  volumeAtPriceColorBelow?: string;
  /** Escala dos textos (indicadores, etc.): 0.6–1 quando o plot está reduzido. */
  textScale?: number;
  /** Quando aplicado, pinta o candle com a cor da estratégia se a condição for verdadeira. */
  strategyCandleOverlays?: StrategyCandleOverlay[];
  /** Etiquetas B/S de ordens spot; com preço médio, ancora no eixo Y nesse preço. */
  spotOrderMarkers?: SpotOrderMarker[];
  /** Regressões (linear/quadrática) sobre série de indicador no painel principal. */
  regressionOverlayPaths?: RegressionOverlayPath[];
}

export function KlinesChartSvg({
  chartSvgRef,
  crosshairOverlayRef,
  width,
  chartHeight,
  chartW,
  chartH,
  gap,
  candleW,
  chartStyle = "candles",
  closeLineStepPath = false,
  candleBodyStyle = "filled",
  y,
  cx,
  segmentToPixel,
  snapToCandlePoint,
  windowSlice,
  fullReversed,
  startIndex,
  windowN,
  totalSlots,
  n,
  candleColors,
  yTickValues,
  verticalIndicesFiltered,
  secondaryVerticalIndicesFiltered,
  utcDayStartMarkerXs = [],
  utcDayStartMarkerTitle = "",
  dateBreaksFiltered,
  dayBreaksFiltered,
  showMainAxis,
  showSecondaryAxis,
  showLastCloseLine,
  showLastClose,
  lastCloseY,
  volumeOnPrice,
  volumeOnPriceOpacity,
  lineTableHex,
  lineTableStrokeWidth = "thin",
  lineTableStrokeStyle = "dashed",
  secondaryGridHex,
  lastCloseLineHex,
  lastCloseLineStrokeWidth = "thin",
  lastCloseLineStrokeStyle = "dashed",
  showLimitBuyLine = false,
  limitBuyLineYs = [],
  limitBuyLineHex = "#059669",
  ctrlLimitBuyPreviewLineY = null,
  ctrlLimitBuyPreviewHex = "#d97706",
  altLimitSellPreviewLineY = null,
  altLimitSellPreviewHex = "#dc2626",
  showLimitSellLine = false,
  limitSellLineYs = [],
  limitSellLineHex = "#dc2626",
  chartBgHex,
  backgroundTextHex,
  formatYAxis,
  hasPanel2,
  hasPanel3,
  hasPanel4,
  hasPanel5,
  panel2Top,
  panel3Top,
  panel4Top,
  panel5Top,
  panelTop,
  panelHeight,
  panelExtents,
  indicatorLines,
  getPanel,
  yValInPanel,
  hasIndicatorStrip,
  isDarkBg,
  crosshairPoint,
  crosshairDragging,
  setCrosshairPoint,
  setCrosshairDragging,
  drawingsVisible,
  drawSegments,
  setDrawSegments,
  drawDefaults,
  drawPending,
  setDrawPending,
  drawPendingRectSecond,
  setDrawPendingRectSecond,
  drawPendingFibSecond,
  setDrawPendingFibSecond,
  drawPendingFreeRetraceSecond,
  setDrawPendingFreeRetraceSecond,
  drawPendingLineSecond,
  setDrawPendingLineSecond,
  drawPendingChannelSecond,
  setDrawPendingChannelSecond,
  drawPendingStopGainSecond,
  setDrawPendingStopGainSecond,
  drawPendingHorizontalSecond,
  setDrawPendingHorizontalSecond,
  drawPendingArrow,
  setDrawPendingArrow,
  drawPendingText,
  setDrawPendingText,
  drawPendingPencil,
  setDrawPendingPencil,
  onCreateTextSegment,
  pixelToData,
  selectedSegmentIndex,
  setSelectedSegmentIndex,
  drawMode,
  drawTool,
  setDrawDragging,
  onSelectToolPan,
  onSwapSecondaryPanel,
  onChartDrawClick,
  onSegmentCreated,
  t,
  textScale = 1,
  strategyCandleOverlays = [],
  spotOrderMarkers = [],
  regressionOverlayPaths = [],
  volumeAtPriceData = null,
  volumeAtPriceOpacity = 40,
  volumeAtPriceWidthPercent = 100,
  volumeAtPriceSide = "left",
  volumeAtPriceColorAbove = "#059669",
  volumeAtPriceColorBelow = "#dc2626",
}: KlinesChartSvgProps) {
  const selectPanLastClientX = useRef(0);
  const justPannedRef = useRef(false);
  const [selectPanActive, setSelectPanActive] = useState(false);

  useEffect(() => {
    if (!selectPanActive || !onSelectToolPan) return;

    /** Toque: menos eventos por frame — coalesced + 1 atualização/frame + pixels/candle menor. */
    let pointerKind: "mouse" | "pen" | "touch" = "mouse";
    let pendingCandles = 0;
    let rafScheduled = false;
    let rafId: number | null = null;

    const pixelsPerCandle = () => (pointerKind === "touch" ? 3 : 5);

    const flushPending = () => {
      rafScheduled = false;
      rafId = null;
      if (pendingCandles === 0) return;
      const d = pendingCandles;
      pendingCandles = 0;
      onSelectToolPan(d);
    };

    const scheduleFlush = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      rafId = window.requestAnimationFrame(flushPending);
    };

    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      if (e.pointerType === "touch" || e.pointerType === "pen" || e.pointerType === "mouse") {
        pointerKind = e.pointerType;
      }
      const ppc = pixelsPerCandle();
      const coalesced = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
      const events: PointerEvent[] = coalesced.length > 0 ? [...coalesced, e] : [e];
      for (const ev of events) {
        const deltaX = ev.clientX - selectPanLastClientX.current;
        selectPanLastClientX.current = ev.clientX;
        pendingCandles += -Math.round(deltaX / ppc);
      }
      scheduleFlush();
    };

    const onUp = () => {
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      rafScheduled = false;
      flushPending();
      setSelectPanActive(false);
      justPannedRef.current = true;
    };

    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      if (rafId != null) window.cancelAnimationFrame(rafId);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [selectPanActive, onSelectToolPan]);

  const fontSize = Math.round(10 * textScale);
  /** Eixo X (data/hora): só reduz em plot estreito; em desktop ≥ ref não amplia (evita “negrito” vs 12×textScale). */
  const axisWidthRefPx = 380;
  const axisWidthFactor =
    chartW >= axisWidthRefPx ? 1 : Math.max(0.55, chartW / axisWidthRefPx);
  const fontSizeAxis = Math.max(7, Math.round(12 * textScale * axisWidthFactor));
  const volumeOnPriceClipId = useId();
  const plotClipId = useId();
  /** Mira fixa no último ponto até novo clique; índice pode sair da janela ao rolar — ainda lemos de fullReversed. */
  const showCrosshairValues =
    crosshairPoint !== null && crosshairPoint.index >= 0 && crosshairPoint.index < fullReversed.length;

  const strip = (panelKey: "main" | "panel2" | "panel3" | "panel4" | "panel5", topY: number, lines: ChartIndicatorLine[]) => (
    <div
      key={panelKey}
      className="absolute left-0 z-10 flex items-end gap-1 flex-wrap pointer-events-none"
      style={{
        top: topY === 0 ? MARGIN_TOP - INDICATOR_STRIP_HEIGHT : topY - INDICATOR_STRIP_HEIGHT,
        height: INDICATOR_STRIP_HEIGHT,
        width,
        paddingLeft: Math.max(4, MARGIN_LEFT),
        paddingTop: 0,
        paddingBottom: 0,
        lineHeight: 1.1,
      }}
      role="list"
      aria-label={t.indicatorsOnChart ?? "Indicadores no gráfico"}
    >
      {panelKey !== "main" && (() => {
        const num = panelKey.replace("panel", "");
        const otherNum = panelKey === "panel5" ? "4" : String(Number(num) + 1);
        const ariaTpl = t.swapSecondaryPanelAria ?? "Swap panel {a} with panel {b}";
        const ariaLabel = ariaTpl.replace("{a}", num).replace("{b}", otherNum);
        const chipStyle = {
          fontSize: `${fontSize}px`,
          backgroundColor: isDarkBg ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)",
          boxShadow: "0 0 3px rgba(0,0,0,0.12)",
        } as const;
        if (onSwapSecondaryPanel) {
          return (
            <button
              type="button"
              className="font-medium text-zinc-500 px-1 py-0 rounded shrink-0 leading-tight pointer-events-auto cursor-pointer hover:text-zinc-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              style={chipStyle}
              title={t.swapSecondaryPanelHint}
              aria-label={ariaLabel}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onSwapSecondaryPanel(panelKey);
              }}
            >
              ({num})
            </button>
          );
        }
        return (
          <span
            className="font-medium text-zinc-500 px-1 py-0 rounded shrink-0 leading-tight"
            style={chipStyle}
            aria-label={panelKey === "panel2" ? "Panel 2" : panelKey === "panel3" ? "Panel 3" : panelKey === "panel4" ? "Panel 4" : "Panel 5"}
          >
            ({num})
          </span>
        );
      })()}
      {lines.map((ind, idx) => {
        const crosshairVal =
          showCrosshairValues && crosshairPoint
            ? (() => {
                // Span A e Span B: valor desenhado no candle vem do candle (index - disp) em fullReversed
                const isSpanAB = ind.type === "Ichimoku" && (ind.ichimokuPart === "spanA" || ind.ichimokuPart === "spanB");
                const disp = isSpanAB ? Math.max(0, Math.min(500, ind.ichimokuDisplacement ?? 26)) : 0;
                const readIndex = isSpanAB ? crosshairPoint.index - disp : crosshairPoint.index;
                if (readIndex < 0 || readIndex >= fullReversed.length) return null;
                const raw = fullReversed[readIndex]?.[ind.columnIndex];
                if (raw == null) return null;
                const v = Number(raw);
                if (!Number.isFinite(v)) return null;
                return (ind.type === "RSI" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "CCI") ? v.toFixed(1) : ind.type === "CMF" ? v.toFixed(3) : formatYAxis(v);
              })()
            : null;
        return (
          <span
            key={idx}
            className="flex items-center gap-1 font-light px-1 py-0 rounded leading-tight"
            style={{
              fontSize: `${fontSize}px`,
              color: ind.color,
              backgroundColor: isDarkBg ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)",
              boxShadow: "0 0 3px rgba(0,0,0,0.12)",
            }}
            role="listitem"
          >
            <span className="w-1.5 h-0.5 rounded-full shrink-0" style={{ backgroundColor: ind.color }} aria-hidden />
            <span>{ind.shortLabel ?? ind.label ?? `Ind ${idx + 1}`}</span>
            {crosshairVal != null && <span className="font-mono opacity-90">{crosshairVal}</span>}
          </span>
        );
      })}
    </div>
  );

  const mainLines = indicatorLines.filter((ind) => getPanel(ind) === "main");
  // Watermark responsivo ao tamanho do plot (mantém proporção 2:1).
  const logoW = Math.max(64, Math.min(120, chartW * 0.18));
  const logoH = logoW / 2;
  const logoX = MARGIN_LEFT + (chartW - logoW) / 2;
  const logoY = MARGIN_TOP + Math.max(6, chartH * 0.02);

  return (
    <div className="flex flex-shrink-0 relative" style={{ width }}>
      {hasIndicatorStrip && (
        <>
          {mainLines.length > 0 && strip("main", 0, mainLines)}
          {hasPanel2 && strip("panel2", panel2Top, indicatorLines.filter((ind) => getPanel(ind) === "panel2"))}
          {hasPanel3 && strip("panel3", panel3Top, indicatorLines.filter((ind) => getPanel(ind) === "panel3"))}
          {hasPanel4 && strip("panel4", panel4Top, indicatorLines.filter((ind) => getPanel(ind) === "panel4"))}
          {hasPanel5 && strip("panel5", panel5Top, indicatorLines.filter((ind) => getPanel(ind) === "panel5"))}
        </>
      )}
      <svg
        ref={chartSvgRef}
        width={width}
        height={chartHeight}
        className={`flex-shrink-0 ${isDarkBg ? "text-zinc-400" : "text-zinc-700"}`}
      >
        <rect x={MARGIN_LEFT} y={MARGIN_TOP} width={chartW} height={chartH} fill={chartBgHex} />
        <image
          href={`${ASSET_PREFIX}/assets/logo.webp`}
          x={logoX}
          y={logoY}
          width={logoW}
          height={logoH}
          opacity={0.1}
          preserveAspectRatio="xMidYMid meet"
          pointerEvents="none"
        />
        <defs>
          <clipPath id={plotClipId}>
            <rect x={MARGIN_LEFT} y={MARGIN_TOP} width={chartW} height={chartH} />
          </clipPath>
          {hasPanel2 && <clipPath id={`${plotClipId}-panel2`}><rect x={MARGIN_LEFT} y={panelTop("panel2")} width={chartW} height={panelHeight("panel2")} /></clipPath>}
          {hasPanel3 && <clipPath id={`${plotClipId}-panel3`}><rect x={MARGIN_LEFT} y={panelTop("panel3")} width={chartW} height={panelHeight("panel3")} /></clipPath>}
          {hasPanel4 && <clipPath id={`${plotClipId}-panel4`}><rect x={MARGIN_LEFT} y={panelTop("panel4")} width={chartW} height={panelHeight("panel4")} /></clipPath>}
          {hasPanel5 && <clipPath id={`${plotClipId}-panel5`}><rect x={MARGIN_LEFT} y={panelTop("panel5")} width={chartW} height={panelHeight("panel5")} /></clipPath>}
        </defs>
        {showSecondaryAxis && (
          <>
            {secondaryVerticalIndicesFiltered.map((idx) => (
              <line
                key={`dash-${idx}`}
                x1={cx(idx)}
                y1={MARGIN_TOP}
                x2={cx(idx)}
                y2={MARGIN_TOP + chartH}
                stroke={secondaryGridHex}
                strokeOpacity={0.5}
                strokeDasharray="4 2"
              />
            ))}
            {yTickValues.map((v, i) => (
              <line
                key={i}
                x1={MARGIN_LEFT}
                y1={y(v)}
                x2={MARGIN_LEFT + chartW}
                y2={y(v)}
                stroke={secondaryGridHex}
                strokeOpacity={0.5}
                strokeDasharray="2 2"
              />
            ))}
          </>
        )}
        {showLastCloseLine && showLastClose && (
          <line
            x1={MARGIN_LEFT}
            y1={lastCloseY}
            x2={MARGIN_LEFT + chartW}
            y2={lastCloseY}
            stroke={lastCloseLineHex}
            strokeWidth={lineWidthToStroke(lastCloseLineStrokeWidth)}
            strokeDasharray={lastCloseLineStrokeStyle === "solid" ? undefined : lastCloseLineStrokeStyle === "dotted" ? "1 2" : "4 2"}
          />
        )}
        {showLimitBuyLine &&
          limitBuyLineYs.map((yy, i) => (
            <line
              key={`limit-buy-${i}`}
              x1={MARGIN_LEFT}
              y1={yy}
              x2={MARGIN_LEFT + chartW}
              y2={yy}
              stroke={limitBuyLineHex}
              strokeWidth={lineWidthToStroke("thin")}
              strokeDasharray="1 2"
            />
          ))}
        {showLimitSellLine &&
          limitSellLineYs.map((yy, i) => (
            <line
              key={`limit-sell-${i}`}
              x1={MARGIN_LEFT}
              y1={yy}
              x2={MARGIN_LEFT + chartW}
              y2={yy}
              stroke={limitSellLineHex}
              strokeWidth={lineWidthToStroke("thin")}
              strokeDasharray="1 2"
            />
          ))}
        {ctrlLimitBuyPreviewLineY != null && Number.isFinite(ctrlLimitBuyPreviewLineY) && (
          <line
            x1={MARGIN_LEFT}
            y1={ctrlLimitBuyPreviewLineY}
            x2={MARGIN_LEFT + chartW}
            y2={ctrlLimitBuyPreviewLineY}
            stroke={ctrlLimitBuyPreviewHex}
            strokeWidth={lineWidthToStroke("normal")}
            strokeDasharray="8 4"
            opacity={0.92}
          />
        )}
        {altLimitSellPreviewLineY != null && Number.isFinite(altLimitSellPreviewLineY) && (
          <line
            x1={MARGIN_LEFT}
            y1={altLimitSellPreviewLineY}
            x2={MARGIN_LEFT + chartW}
            y2={altLimitSellPreviewLineY}
            stroke={altLimitSellPreviewHex}
            strokeWidth={lineWidthToStroke("normal")}
            strokeDasharray="8 4"
            opacity={0.92}
          />
        )}
        {showMainAxis &&
          dateBreaksFiltered.map((b) => (
            <line
              key={`date-${b.index}`}
              x1={cx(b.index)}
              y1={MARGIN_TOP}
              x2={cx(b.index)}
              y2={MARGIN_TOP + chartH}
              stroke={lineTableHex}
              strokeWidth={lineWidthToStroke(lineTableStrokeWidth)}
              strokeDasharray={lineTableStrokeStyle === "solid" ? undefined : lineTableStrokeStyle === "dotted" ? "1 2" : "4 2"}
            />
          ))}
        {(() => {
          const tableTop = MARGIN_TOP + chartH;
          const rowH = 12;
          const labelOffsetDown = 4;
          const yRow1 = tableTop + rowH - 2 + labelOffsetDown;
          return (
            <>
              <g className="font-mono" fill={backgroundTextHex}>
                {dayBreaksFiltered.map((b) => {
                  const openTimeMs = b.openTime ?? (b.index < windowN ? (windowSlice[b.index][0] as number) : 0);
                  const x = cx(b.index);
                  const mainKind = b.mainAxisKind ?? (b.label === "01" ? "month" : "day");
                  if (mainKind === "month") {
                    return (
                      <text
                        key={b.index}
                        x={x}
                        y={yRow1}
                        textAnchor="middle"
                        className="font-mono"
                        style={{ fontSize: fontSizeAxis }}
                        fill={backgroundTextHex}
                        transform={`rotate(-45, ${x}, ${yRow1})`}
                      >
                        {formatMonthOnly(openTimeMs)}
                      </text>
                    );
                  }
                  return (
                    <text key={b.index} x={x} y={yRow1} textAnchor="middle" style={{ fontSize: fontSizeAxis }}>
                      {b.label}
                    </text>
                  );
                })}
              </g>
            </>
          );
        })()}
        {(["panel2", "panel3", "panel4", "panel5"] as const).map((panelId) => {
          const hasPanel = panelId === "panel2" ? hasPanel2 : panelId === "panel3" ? hasPanel3 : panelId === "panel4" ? hasPanel4 : hasPanel5;
          const top = panelTop(panelId);
          const h = panelHeight(panelId);
          if (!hasPanel || h <= 0) return null;
          const panelLines = indicatorLines.filter((ind) => getPanel(ind) === panelId);
          const { min: pMin, max: pMax } = panelExtents[panelId];
          const pRange = pMax - pMin || 1;
          const yPanel = (val: number) => yValInPanel(val, top, h, pMin, pMax);
          const tickVals = [pMin, pMin + pRange * 0.25, pMin + pRange * 0.5, pMin + pRange * 0.75, pMax];
          return (
            <g key={panelId}>
              <rect x={MARGIN_LEFT} y={top} width={chartW} height={h} fill={chartBgHex} />
              {showSecondaryAxis && (
                <>
                  {secondaryVerticalIndicesFiltered.map((idx) => (
                    <line
                      key={`${panelId}-dash-${idx}`}
                      x1={cx(idx)}
                      y1={top}
                      x2={cx(idx)}
                      y2={top + h}
                      stroke={secondaryGridHex}
                      strokeOpacity={0.5}
                      strokeDasharray="4 2"
                    />
                  ))}
                  {tickVals.map((v) => (
                    <line
                      key={`${panelId}-h-${v}`}
                      x1={MARGIN_LEFT}
                      y1={yPanel(v)}
                      x2={MARGIN_LEFT + chartW}
                      y2={yPanel(v)}
                      stroke={secondaryGridHex}
                      strokeOpacity={0.5}
                      strokeDasharray="2 2"
                    />
                  ))}
                </>
              )}
              <g clipPath={`url(#${(`${plotClipId}-${panelId}`).replace(/:/g, "\\:")})`}>
              {panelLines.map((ind, indIdx) => {
                const col = ind.columnIndex;
                if (ind.type === "Bollinger") {
                  const upperPts: { i: number; val: number }[] = [];
                  const middlePts: { i: number; val: number }[] = [];
                  const lowerPts: { i: number; val: number }[] = [];
                  for (let i = 0; i < windowSlice.length; i++) {
                    const u = windowSlice[i][col];
                    const m = windowSlice[i][col + 1];
                    const l = windowSlice[i][col + 2];
                    if (u != null && typeof u === "number" && Number.isFinite(u)) upperPts.push({ i, val: u });
                    if (m != null && typeof m === "number" && Number.isFinite(m)) middlePts.push({ i, val: m });
                    if (l != null && typeof l === "number" && Number.isFinite(l)) lowerPts.push({ i, val: l });
                  }
                  const bandColor = ind.bollingerLimitsColor ?? "#6366f1";
                  const bandOpacity = Math.max(0, Math.min(0.3, ind.bollingerBandOpacity ?? 0.2));
                  const limitsStrokeWidth = lineWidthToStroke(ind.bollingerLimitsLineWidth);
                  const limitsDash = ind.bollingerLimitsLineStyle === "dotted" ? "1 2" : ind.bollingerLimitsLineStyle === "dashed" ? "6 4" : undefined;
                  const middleColor = ind.bollingerMiddleColor ?? ind.color ?? "#6366f1";
                  const middleLw = ind.bollingerMiddleLineWidth ?? ind.lineWidth;
                  const middleLs = ind.bollingerMiddleLineStyle ?? ind.lineStyle;
                  const middleStrokeWidth = lineWidthToStroke(middleLw);
                  const middleDash = middleLs === "dotted" ? "1 2" : middleLs === "dashed" ? "6 4" : undefined;
                  const toPathPanel = (pts: { i: number; val: number }[]) => pts.length < 2 ? "" : pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${cx(p.i)} ${yPanel(p.val)}`).join(" ");
                  const upperD = toPathPanel(upperPts);
                  const middleD = toPathPanel(middlePts);
                  const lowerD = toPathPanel(lowerPts);
                  const upperToMiddlePoly = upperPts.length >= 2 && middlePts.length >= 2
                    ? (() => {
                        const uMap = new Map(upperPts.map((p) => [p.i, p.val]));
                        const mMap = new Map(middlePts.map((p) => [p.i, p.val]));
                        const indices = [...new Set([...uMap.keys(), ...mMap.keys()])].sort((a, b) => a - b);
                        let d = "";
                        for (const i of indices) {
                          const u = uMap.get(i);
                          const m = mMap.get(i);
                          if (u != null && m != null) d += `${d ? " L" : "M"} ${cx(i)} ${yPanel(u)}`;
                        }
                        for (let j = indices.length - 1; j >= 0; j--) {
                          const i = indices[j]!;
                          const m = mMap.get(i);
                          const u = uMap.get(i);
                          if (m != null && u != null) d += ` L ${cx(i)} ${yPanel(m)}`;
                        }
                        return d ? `${d} Z` : "";
                      })()
                    : "";
                  const lowerToMiddlePoly = lowerPts.length >= 2 && middlePts.length >= 2
                    ? (() => {
                        const lMap = new Map(lowerPts.map((p) => [p.i, p.val]));
                        const mMap = new Map(middlePts.map((p) => [p.i, p.val]));
                        const indices = [...new Set([...lMap.keys(), ...mMap.keys()])].sort((a, b) => a - b);
                        let d = "";
                        for (const i of indices) {
                          const l = lMap.get(i);
                          const m = mMap.get(i);
                          if (l != null && m != null) d += `${d ? " L" : "M"} ${cx(i)} ${yPanel(l)}`;
                        }
                        for (let j = indices.length - 1; j >= 0; j--) {
                          const i = indices[j]!;
                          const m = mMap.get(i);
                          const l = lMap.get(i);
                          if (m != null && l != null) d += ` L ${cx(i)} ${yPanel(m)}`;
                        }
                        return d ? `${d} Z` : "";
                      })()
                    : "";
                  return (
                    <g key={indIdx}>
                      {upperToMiddlePoly && <path d={upperToMiddlePoly} fill={bandColor} fillOpacity={bandOpacity} stroke="none" />}
                      {lowerToMiddlePoly && <path d={lowerToMiddlePoly} fill={bandColor} fillOpacity={bandOpacity} stroke="none" />}
                      {ind.bollingerShowUpper !== false && upperD && <path d={upperD} fill="none" stroke={bandColor} strokeWidth={limitsStrokeWidth} strokeDasharray={limitsDash} strokeLinecap="round" strokeLinejoin="round" />}
                      {ind.bollingerShowLower !== false && lowerD && <path d={lowerD} fill="none" stroke={bandColor} strokeWidth={limitsStrokeWidth} strokeDasharray={limitsDash} strokeLinecap="round" strokeLinejoin="round" />}
                      {ind.bollingerShowMiddle === true && middleD && <path d={middleD} fill="none" stroke={middleColor} strokeWidth={middleStrokeWidth} strokeDasharray={middleDash} strokeLinecap="round" strokeLinejoin="round" />}
                    </g>
                  );
                }
                if (ind.type === "Keltner") {
                  const upperPts: { i: number; val: number }[] = [];
                  const middlePts: { i: number; val: number }[] = [];
                  const lowerPts: { i: number; val: number }[] = [];
                  for (let i = 0; i < windowSlice.length; i++) {
                    const u = windowSlice[i][col];
                    const m = windowSlice[i][col + 1];
                    const l = windowSlice[i][col + 2];
                    if (u != null && typeof u === "number" && Number.isFinite(u)) upperPts.push({ i, val: u });
                    if (m != null && typeof m === "number" && Number.isFinite(m)) middlePts.push({ i, val: m });
                    if (l != null && typeof l === "number" && Number.isFinite(l)) lowerPts.push({ i, val: l });
                  }
                  const bandColor = ind.keltnerLimitsColor ?? "#6366f1";
                  const bandOpacity = Math.max(0, Math.min(0.3, ind.keltnerBandOpacity ?? 0.2));
                  const limitsStrokeWidth = lineWidthToStroke(ind.keltnerLimitsLineWidth);
                  const limitsDash = ind.keltnerLimitsLineStyle === "dotted" ? "1 2" : ind.keltnerLimitsLineStyle === "dashed" ? "6 4" : undefined;
                  const middleColor = ind.color ?? "#6366f1";
                  const middleStrokeWidth = lineWidthToStroke(ind.lineWidth);
                  const middleDash = ind.lineStyle === "dotted" ? "1 2" : ind.lineStyle === "dashed" ? "6 4" : undefined;
                  const toPathPanel = (pts: { i: number; val: number }[]) => pts.length < 2 ? "" : pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${cx(p.i)} ${yPanel(p.val)}`).join(" ");
                  const upperD = toPathPanel(upperPts);
                  const middleD = toPathPanel(middlePts);
                  const lowerD = toPathPanel(lowerPts);
                  const upperToMiddlePoly = upperPts.length >= 2 && middlePts.length >= 2
                    ? (() => {
                        const uMap = new Map(upperPts.map((p) => [p.i, p.val]));
                        const mMap = new Map(middlePts.map((p) => [p.i, p.val]));
                        const indices = [...new Set([...uMap.keys(), ...mMap.keys()])].sort((a, b) => a - b);
                        let d = "";
                        for (const i of indices) {
                          const u = uMap.get(i);
                          const m = mMap.get(i);
                          if (u != null && m != null) d += `${d ? " L" : "M"} ${cx(i)} ${yPanel(u)}`;
                        }
                        for (let j = indices.length - 1; j >= 0; j--) {
                          const i = indices[j]!;
                          const m = mMap.get(i);
                          const u = uMap.get(i);
                          if (m != null && u != null) d += ` L ${cx(i)} ${yPanel(m)}`;
                        }
                        return d ? `${d} Z` : "";
                      })()
                    : "";
                  const lowerToMiddlePoly = lowerPts.length >= 2 && middlePts.length >= 2
                    ? (() => {
                        const lMap = new Map(lowerPts.map((p) => [p.i, p.val]));
                        const mMap = new Map(middlePts.map((p) => [p.i, p.val]));
                        const indices = [...new Set([...lMap.keys(), ...mMap.keys()])].sort((a, b) => a - b);
                        let d = "";
                        for (const i of indices) {
                          const l = lMap.get(i);
                          const m = mMap.get(i);
                          if (l != null && m != null) d += `${d ? " L" : "M"} ${cx(i)} ${yPanel(l)}`;
                        }
                        for (let j = indices.length - 1; j >= 0; j--) {
                          const i = indices[j]!;
                          const m = mMap.get(i);
                          const l = lMap.get(i);
                          if (m != null && l != null) d += ` L ${cx(i)} ${yPanel(m)}`;
                        }
                        return d ? `${d} Z` : "";
                      })()
                    : "";
                  return (
                    <g key={indIdx}>
                      {upperToMiddlePoly && <path d={upperToMiddlePoly} fill={bandColor} fillOpacity={bandOpacity} stroke="none" />}
                      {lowerToMiddlePoly && <path d={lowerToMiddlePoly} fill={bandColor} fillOpacity={bandOpacity} stroke="none" />}
                      {ind.keltnerShowUpper !== false && upperD && <path d={upperD} fill="none" stroke={bandColor} strokeWidth={limitsStrokeWidth} strokeDasharray={limitsDash} strokeLinecap="round" strokeLinejoin="round" />}
                      {ind.keltnerShowLower !== false && lowerD && <path d={lowerD} fill="none" stroke={bandColor} strokeWidth={limitsStrokeWidth} strokeDasharray={limitsDash} strokeLinecap="round" strokeLinejoin="round" />}
                      {ind.keltnerShowMiddle === true && middleD && <path d={middleD} fill="none" stroke={middleColor} strokeWidth={middleStrokeWidth} strokeDasharray={middleDash} strokeLinecap="round" strokeLinejoin="round" />}
                    </g>
                  );
                }
                if (ind.type === "Donchian") {
                  const upperPts: { i: number; val: number }[] = [];
                  const middlePts: { i: number; val: number }[] = [];
                  const lowerPts: { i: number; val: number }[] = [];
                  for (let i = 0; i < windowSlice.length; i++) {
                    const u = windowSlice[i][col];
                    const m = windowSlice[i][col + 1];
                    const l = windowSlice[i][col + 2];
                    if (u != null && typeof u === "number" && Number.isFinite(u)) upperPts.push({ i, val: u });
                    if (m != null && typeof m === "number" && Number.isFinite(m)) middlePts.push({ i, val: m });
                    if (l != null && typeof l === "number" && Number.isFinite(l)) lowerPts.push({ i, val: l });
                  }
                  const bandColor = ind.donchianLimitsColor ?? "#6366f1";
                  const bandOpacity = Math.max(0, Math.min(0.3, ind.donchianBandOpacity ?? 0.2));
                  const limitsStrokeWidth = lineWidthToStroke(ind.donchianLimitsLineWidth);
                  const limitsDash = ind.donchianLimitsLineStyle === "dotted" ? "1 2" : ind.donchianLimitsLineStyle === "dashed" ? "6 4" : undefined;
                  const middleColor = ind.donchianMiddleColor ?? ind.color ?? "#6366f1";
                  const middleLw = ind.donchianMiddleLineWidth ?? ind.lineWidth;
                  const middleLs = ind.donchianMiddleLineStyle ?? ind.lineStyle;
                  const middleStrokeWidth = lineWidthToStroke(middleLw);
                  const middleDash = middleLs === "dotted" ? "1 2" : middleLs === "dashed" ? "6 4" : undefined;
                  const toPathPanel = (pts: { i: number; val: number }[]) => pts.length < 2 ? "" : pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${cx(p.i)} ${yPanel(p.val)}`).join(" ");
                  const upperD = toPathPanel(upperPts);
                  const middleD = toPathPanel(middlePts);
                  const lowerD = toPathPanel(lowerPts);
                  const upperToMiddlePoly = upperPts.length >= 2 && middlePts.length >= 2
                    ? (() => {
                        const uMap = new Map(upperPts.map((p) => [p.i, p.val]));
                        const mMap = new Map(middlePts.map((p) => [p.i, p.val]));
                        const indices = [...new Set([...uMap.keys(), ...mMap.keys()])].sort((a, b) => a - b);
                        let d = "";
                        for (const i of indices) {
                          const u = uMap.get(i);
                          const m = mMap.get(i);
                          if (u != null && m != null) d += `${d ? " L" : "M"} ${cx(i)} ${yPanel(u)}`;
                        }
                        for (let j = indices.length - 1; j >= 0; j--) {
                          const i = indices[j]!;
                          const m = mMap.get(i);
                          const u = uMap.get(i);
                          if (m != null && u != null) d += ` L ${cx(i)} ${yPanel(m)}`;
                        }
                        return d ? `${d} Z` : "";
                      })()
                    : "";
                  const lowerToMiddlePoly = lowerPts.length >= 2 && middlePts.length >= 2
                    ? (() => {
                        const lMap = new Map(lowerPts.map((p) => [p.i, p.val]));
                        const mMap = new Map(middlePts.map((p) => [p.i, p.val]));
                        const indices = [...new Set([...lMap.keys(), ...mMap.keys()])].sort((a, b) => a - b);
                        let d = "";
                        for (const i of indices) {
                          const l = lMap.get(i);
                          const m = mMap.get(i);
                          if (l != null && m != null) d += `${d ? " L" : "M"} ${cx(i)} ${yPanel(l)}`;
                        }
                        for (let j = indices.length - 1; j >= 0; j--) {
                          const i = indices[j]!;
                          const m = mMap.get(i);
                          const l = lMap.get(i);
                          if (m != null && l != null) d += ` L ${cx(i)} ${yPanel(m)}`;
                        }
                        return d ? `${d} Z` : "";
                      })()
                    : "";
                  return (
                    <g key={indIdx}>
                      {upperToMiddlePoly && <path d={upperToMiddlePoly} fill={bandColor} fillOpacity={bandOpacity} stroke="none" />}
                      {lowerToMiddlePoly && <path d={lowerToMiddlePoly} fill={bandColor} fillOpacity={bandOpacity} stroke="none" />}
                      {ind.donchianShowUpper !== false && upperD && <path d={upperD} fill="none" stroke={bandColor} strokeWidth={limitsStrokeWidth} strokeDasharray={limitsDash} strokeLinecap="round" strokeLinejoin="round" />}
                      {ind.donchianShowLower !== false && lowerD && <path d={lowerD} fill="none" stroke={bandColor} strokeWidth={limitsStrokeWidth} strokeDasharray={limitsDash} strokeLinecap="round" strokeLinejoin="round" />}
                      {ind.donchianShowMiddle === true && middleD && <path d={middleD} fill="none" stroke={middleColor} strokeWidth={middleStrokeWidth} strokeDasharray={middleDash} strokeLinecap="round" strokeLinejoin="round" />}
                    </g>
                  );
                }
                if (ind.type === "Ichimoku" && ind.ichimokuPart) {
                  const part = ind.ichimokuPart;
                  const baseCol = col - (part === "tenkan" ? 0 : part === "kijun" ? 1 : part === "spanA" ? 2 : part === "spanB" ? 3 : 4);
                  const disp = Math.max(0, Math.min(500, ind.ichimokuDisplacement ?? 26));
                  const pts: { i: number; val: number }[] = [];
                  for (let i = 0; i < windowSlice.length; i++) {
                    const v = windowSlice[i][col];
                    if (v == null || typeof v !== "number" || !Number.isFinite(v)) continue;
                    if (part === "spanA" || part === "spanB") {
                      const j = i + disp;
                      if (j < totalSlots) pts.push({ i: j, val: v });
                    } else {
                      pts.push({ i, val: v });
                    }
                  }
                  const show = part === "tenkan" ? (ind.ichimokuShowTenkan !== false) : part === "kijun" ? (ind.ichimokuShowKijun !== false) : part === "spanA" ? (ind.ichimokuShowSpanA !== false) : part === "spanB" ? (ind.ichimokuShowSpanB !== false) : (ind.ichimokuShowChikou === true);
                  const toPath = (p: { i: number; val: number }[]) => p.length < 2 ? "" : p.map((pt, idx) => `${idx === 0 ? "M" : "L"} ${cx(pt.i)} ${yPanel(pt.val)}`).join(" ");
                  const strokeVal = (w: "thin" | "normal" | "thick" | undefined, style: "solid" | "dotted" | "dashed" | undefined) => ({ width: lineWidthToStroke(w), dash: style === "dotted" ? "1 2" : style === "dashed" ? "6 4" : undefined });
                  const s = strokeVal(ind.lineWidth, ind.lineStyle);
                  let cloudEl: ReactNode = null;
                  if (part === "tenkan") {
                    const spanAPts: { i: number; val: number }[] = [];
                    const spanBPts: { i: number; val: number }[] = [];
                    for (let i = 0; i < windowSlice.length; i++) {
                      const j = i + disp;
                      if (j >= totalSlots) continue;
                      const a = windowSlice[i][baseCol + 2];
                      const b = windowSlice[i][baseCol + 3];
                      if (a != null && typeof a === "number" && Number.isFinite(a)) spanAPts.push({ i: j, val: a });
                      if (b != null && typeof b === "number" && Number.isFinite(b)) spanBPts.push({ i: j, val: b });
                    }
                    const cloudOpacity = Math.max(0, Math.min(0.7, ind.ichimokuCloudOpacity ?? 0.3));
                    const greenCloud = "#22c55e";
                    const redCloud = "#ef4444";
                    const aMap = new Map(spanAPts.map((p) => [p.i, p.val]));
                    const bMap = new Map(spanBPts.map((p) => [p.i, p.val]));
                    const indices = [...new Set([...aMap.keys(), ...bMap.keys()])].sort((x, y) => x - y);
                    const cloudPaths: { d: string; fill: string }[] = [];
                    let segStart: number | null = null;
                    let segAboveA: boolean | null = null;
                    for (let idx = 0; idx < indices.length; idx++) {
                      const i = indices[idx]!;
                      const a = aMap.get(i);
                      const b = bMap.get(i);
                      if (a == null || b == null) continue;
                      const aboveA = a >= b;
                      if (segStart === null) {
                        segStart = i;
                        segAboveA = aboveA;
                      } else if (aboveA !== segAboveA) {
                        const segIndices = indices.filter((j) => j >= segStart! && j <= i);
                        let d = "";
                        for (const j of segIndices) {
                          const av = aMap.get(j);
                          const bv = bMap.get(j);
                          if (av != null && bv != null) d += `${d ? " L" : "M"} ${cx(j)} ${yPanel(segAboveA ? av : bv)}`;
                        }
                        for (let j = segIndices.length - 1; j >= 0; j--) {
                          const jj = segIndices[j]!;
                          const av = aMap.get(jj);
                          const bv = bMap.get(jj);
                          if (av != null && bv != null) d += ` L ${cx(jj)} ${yPanel(segAboveA ? bv : av)}`;
                        }
                        if (d) cloudPaths.push({ d: `${d} Z`, fill: segAboveA ? greenCloud : redCloud });
                        segStart = i;
                        segAboveA = aboveA;
                      }
                    }
                    if (segStart !== null && segAboveA !== null) {
                      const segIndices = indices.filter((j) => j >= segStart!);
                      let d = "";
                      for (const j of segIndices) {
                        const av = aMap.get(j);
                        const bv = bMap.get(j);
                        if (av != null && bv != null) d += `${d ? " L" : "M"} ${cx(j)} ${yPanel(segAboveA ? av : bv)}`;
                      }
                      for (let j = segIndices.length - 1; j >= 0; j--) {
                        const jj = segIndices[j]!;
                        const av = aMap.get(jj);
                        const bv = bMap.get(jj);
                        if (av != null && bv != null) d += ` L ${cx(jj)} ${yPanel(segAboveA ? bv : av)}`;
                      }
                      if (d) cloudPaths.push({ d: `${d} Z`, fill: segAboveA ? greenCloud : redCloud });
                    }
                    cloudEl = <>{cloudPaths.map((cp, ci) => <path key={ci} d={cp.d} fill={cp.fill} fillOpacity={cloudOpacity} stroke="none" />)}</>;
                  }
                  return (
                    <g key={indIdx}>
                      {cloudEl}
                      {show && toPath(pts) && <path d={toPath(pts)} fill="none" stroke={ind.color} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinecap="round" strokeLinejoin="round" />}
                    </g>
                  );
                }
                if (ind.type === "Volume") {
                  const barW = Math.max(1, gap * 0.6);
                  const colorAbove = ind.histogramColorAbove ?? "#10b981";
                  const colorBelow = ind.histogramColorBelow ?? "#ef4444";
                  const panelId = (["panel2", "panel3", "panel4", "panel5"] as const).find((p) => getPanel(ind) === p) ?? "panel2";
                  const panelBottomY = panelTop(panelId) + panelHeight(panelId);
                  return (
                    <g key={indIdx}>
                      {windowSlice.map((row, i) => {
                        const v = row[col];
                        if (v == null) return null;
                        const numVal = typeof v === "number" ? v : Number(v);
                        if (!Number.isFinite(numVal) || numVal < 0) return null;
                        const openRaw = row[1];
                        const closeRaw = row[4];
                        const open = typeof openRaw === "string" ? parseFloat(openRaw) : Number(openRaw);
                        const close = typeof closeRaw === "string" ? parseFloat(closeRaw) : Number(closeRaw);
                        const fill = (Number.isFinite(open) && Number.isFinite(close) && close >= open) ? colorAbove : colorBelow;
                        const yVal = yPanel(numVal);
                        const yTop = Math.min(panelBottomY, yVal);
                        const yBottom = Math.max(panelBottomY, yVal);
                        const barH = Math.max(1, yBottom - yTop);
                        return (
                          <rect
                            key={i}
                            x={cx(i) - barW / 2}
                            y={yTop}
                            width={barW}
                            height={barH}
                            fill={fill}
                            stroke="none"
                          />
                        );
                      })}
                    </g>
                  );
                }
                if (ind.display === "histogram") {
                  const barW = Math.max(1, gap * 0.6);
                  const colorAbove = ind.histogramColorAbove ?? "#059669";
                  const colorBelow = ind.histogramColorBelow ?? "#dc2626";
                  const yZero = yPanel(0);
                  return (
                    <g key={indIdx}>
                      {windowSlice.map((row, i) => {
                        const v = row[col];
                        if (v == null || typeof v !== "number" || !Number.isFinite(v)) return null;
                        const yVal = yPanel(v);
                        const yTop = Math.min(yZero, yVal);
                        const yBottom = Math.max(yZero, yVal);
                        const barH = Math.max(1, yBottom - yTop);
                        const fill = v >= 0 ? colorAbove : colorBelow;
                        return (
                          <rect
                            key={i}
                            x={cx(i) - barW / 2}
                            y={yTop}
                            width={barW}
                            height={barH}
                            fill={fill}
                            stroke="none"
                          />
                        );
                      })}
                    </g>
                  );
                }
                const points: { i: number; val: number }[] = [];
                for (let i = 0; i < windowSlice.length; i++) {
                  const raw = windowSlice[i][col];
                  const v = raw != null ? Number(raw) : NaN;
                  if (Number.isFinite(v)) points.push({ i, val: v });
                }
                if (points.length < 2) return null;
                const d = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${cx(p.i)} ${yPanel(p.val)}`).join(" ");
                const strokeWidth = lineWidthToStroke(ind.lineWidth);
                const strokeDasharray = ind.lineStyle === "dotted" ? "1 2" : ind.lineStyle === "dashed" ? "6 4" : undefined;
                return (
                  <path
                    key={indIdx}
                    d={d}
                    fill="none"
                    stroke={ind.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}
              {panelLines.filter((ind) => (ind.type === "RSI" && ind.rsiCenterLine) || (ind.type === "MFI" && ind.mfiCenterLine)).map((ind, idx) => {
                const y50 = yPanel(50);
                const cStrokeWidth = ind.type === "RSI" ? lineWidthToStroke(ind.rsiCenterLineWidth) : lineWidthToStroke(ind.mfiCenterLineWidth);
                const cStrokeDasharray = ind.type === "RSI" ? (ind.rsiCenterLineStyle === "dotted" ? "1 2" : ind.rsiCenterLineStyle === "dashed" ? "6 4" : undefined) : (ind.mfiCenterLineStyle === "dotted" ? "1 2" : ind.mfiCenterLineStyle === "dashed" ? "6 4" : undefined);
                const cColor = ind.type === "RSI" ? (ind.rsiCenterLineColor ?? "#71717a") : (ind.mfiCenterLineColor ?? "#71717a");
                return (
                  <line
                    key={`center-${idx}`}
                    x1={MARGIN_LEFT}
                    y1={y50}
                    x2={MARGIN_LEFT + chartW}
                    y2={y50}
                    stroke={cColor}
                    strokeWidth={cStrokeWidth}
                    strokeDasharray={cStrokeDasharray}
                  />
                );
              })}
              {panelLines.filter((ind) => ind.type === "RSI" && ind.rsiLimits).map((ind, idx) => {
                const upper = Math.max(0, Math.min(100, ind.rsiLimitUpper ?? 90));
                const lower = Math.max(0, Math.min(100, ind.rsiLimitLower ?? 10));
                const yUpper = yPanel(upper);
                const yLower = yPanel(lower);
                const lStrokeWidth = lineWidthToStroke(ind.rsiLimitLineWidth);
                const lStrokeDasharray = ind.rsiLimitLineStyle === "dotted" ? "1 2" : ind.rsiLimitLineStyle === "dashed" ? "6 4" : undefined;
                const stroke = ind.rsiLimitColor ?? "#dc2626";
                return (
                  <g key={`limits-${idx}`}>
                    <line x1={MARGIN_LEFT} y1={yUpper} x2={MARGIN_LEFT + chartW} y2={yUpper} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                    <line x1={MARGIN_LEFT} y1={yLower} x2={MARGIN_LEFT + chartW} y2={yLower} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                  </g>
                );
              })}
              {panelLines.filter((ind) => ind.type === "MFI" && ind.mfiLimits).map((ind, idx) => {
                const upper = Math.max(0, Math.min(100, ind.mfiLimitUpper ?? 80));
                const lower = Math.max(0, Math.min(100, ind.mfiLimitLower ?? 20));
                const yUpper = yPanel(upper);
                const yLower = yPanel(lower);
                const lStrokeWidth = lineWidthToStroke(ind.mfiLimitLineWidth);
                const lStrokeDasharray = ind.mfiLimitLineStyle === "dotted" ? "1 2" : ind.mfiLimitLineStyle === "dashed" ? "6 4" : undefined;
                const stroke = ind.mfiLimitColor ?? "#dc2626";
                return (
                  <g key={`mfi-limits-${idx}`}>
                    <line x1={MARGIN_LEFT} y1={yUpper} x2={MARGIN_LEFT + chartW} y2={yUpper} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                    <line x1={MARGIN_LEFT} y1={yLower} x2={MARGIN_LEFT + chartW} y2={yLower} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                  </g>
                );
              })}
              {panelLines.filter((ind) => ind.type === "Stochastic" && ind.stochLimits).map((ind, idx) => {
                const upper = Math.max(0, Math.min(100, ind.stochLimitUpper ?? 80));
                const lower = Math.max(0, Math.min(100, ind.stochLimitLower ?? 20));
                const yUpper = yPanel(upper);
                const yLower = yPanel(lower);
                const lStrokeWidth = lineWidthToStroke(ind.stochLimitLineWidth);
                const lStrokeDasharray = ind.stochLimitLineStyle === "dotted" ? "1 2" : ind.stochLimitLineStyle === "dashed" ? "6 4" : undefined;
                const stroke = ind.stochLimitColor ?? "#dc2626";
                return (
                  <g key={`stoch-limits-${idx}`}>
                    <line x1={MARGIN_LEFT} y1={yUpper} x2={MARGIN_LEFT + chartW} y2={yUpper} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                    <line x1={MARGIN_LEFT} y1={yLower} x2={MARGIN_LEFT + chartW} y2={yLower} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                  </g>
                );
              })}
              {panelLines.filter((ind) => ind.type === "WilliamsR" && ind.williamsRLimits).map((ind, idx) => {
                const upper = Math.max(-100, Math.min(0, ind.williamsRLimitUpper ?? -20));
                const lower = Math.max(-100, Math.min(0, ind.williamsRLimitLower ?? -80));
                const yUpper = yPanel(upper);
                const yLower = yPanel(lower);
                const lStrokeWidth = lineWidthToStroke(ind.williamsRLimitLineWidth);
                const lStrokeDasharray = ind.williamsRLimitLineStyle === "dotted" ? "1 2" : ind.williamsRLimitLineStyle === "dashed" ? "6 4" : undefined;
                const stroke = ind.williamsRLimitColor ?? "#dc2626";
                return (
                  <g key={`williams-r-limits-${idx}`}>
                    <line x1={MARGIN_LEFT} y1={yUpper} x2={MARGIN_LEFT + chartW} y2={yUpper} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                    <line x1={MARGIN_LEFT} y1={yLower} x2={MARGIN_LEFT + chartW} y2={yLower} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                  </g>
                );
              })}
              {panelLines.filter((ind) => ind.type === "ADX" && ind.adxLimits && ind.adxPart === "plusDi").map((ind, idx) => {
                const upper = Math.max(0, Math.min(100, ind.adxLimitUpper ?? 25));
                const lower = Math.max(0, Math.min(100, ind.adxLimitLower ?? 20));
                const yUpper = yPanel(upper);
                const yLower = yPanel(lower);
                const lStrokeWidth = lineWidthToStroke(ind.adxLimitLineWidth);
                const lStrokeDasharray = ind.adxLimitLineStyle === "dotted" ? "1 2" : ind.adxLimitLineStyle === "dashed" ? "6 4" : undefined;
                const stroke = ind.adxLimitColor ?? "#71717a";
                return (
                  <g key={`adx-limits-${idx}`}>
                    <line x1={MARGIN_LEFT} y1={yUpper} x2={MARGIN_LEFT + chartW} y2={yUpper} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                    <line x1={MARGIN_LEFT} y1={yLower} x2={MARGIN_LEFT + chartW} y2={yLower} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                  </g>
                );
              })}
              {panelLines.filter((ind) => ind.type === "CCI" && ind.cciLimits).map((ind, idx) => {
                const upper = Math.max(-500, Math.min(500, ind.cciLimitUpper ?? 100));
                const lower = Math.max(-500, Math.min(500, ind.cciLimitLower ?? -100));
                const yUpper = yPanel(upper);
                const yLower = yPanel(lower);
                const lStrokeWidth = lineWidthToStroke(ind.cciLimitLineWidth);
                const lStrokeDasharray = ind.cciLimitLineStyle === "dotted" ? "1 2" : ind.cciLimitLineStyle === "dashed" ? "6 4" : undefined;
                const stroke = ind.cciLimitColor ?? "#dc2626";
                return (
                  <g key={`cci-limits-${idx}`}>
                    <line x1={MARGIN_LEFT} y1={yUpper} x2={MARGIN_LEFT + chartW} y2={yUpper} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                    <line x1={MARGIN_LEFT} y1={yLower} x2={MARGIN_LEFT + chartW} y2={yLower} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                  </g>
                );
              })}
              {panelLines.filter((ind) => ind.type === "CMF" && ind.cmfLimits).map((ind, idx) => {
                const upper = Math.max(-1, Math.min(1, ind.cmfLimitUpper ?? 0.25));
                const lower = Math.max(-1, Math.min(1, ind.cmfLimitLower ?? -0.25));
                const yUpper = yPanel(upper);
                const yLower = yPanel(lower);
                const lStrokeWidth = lineWidthToStroke(ind.cmfLimitLineWidth);
                const lStrokeDasharray = ind.cmfLimitLineStyle === "dotted" ? "1 2" : ind.cmfLimitLineStyle === "dashed" ? "6 4" : undefined;
                const stroke = ind.cmfLimitColor ?? "#dc2626";
                return (
                  <g key={`cmf-limits-${idx}`}>
                    <line x1={MARGIN_LEFT} y1={yUpper} x2={MARGIN_LEFT + chartW} y2={yUpper} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                    <line x1={MARGIN_LEFT} y1={yLower} x2={MARGIN_LEFT + chartW} y2={yLower} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                  </g>
                );
              })}
              </g>
            </g>
          );
        })}
        <g clipPath={`url(#${plotClipId.replace(/:/g, "\\:")})`}>
        {(chartStyle === "line" || chartStyle === "linePoints" || chartStyle === "area" || chartStyle === "kagiClassic") ? (
          chartStyle === "kagiClassic" ? (
            (() => {
              const closes = windowSlice.map((k) => parseNum(String(k[4] ?? "")));
              const linePoints = windowSlice.map((k, i) => ({ x: cx(i), y: y(closes[i]) }));
              const bullHex = candleColors.bull === "#f5f5f5" ? "#171717" : candleColors.bull;
              const bearHex = candleColors.bear === "#f5f5f5" ? "#171717" : candleColors.bear;
              const neutralHex = isDarkBg ? "#94a3b8" : "#64748b";
              const segments: { d: string; stroke: string; strokeWidth: number }[] = [];
              for (let i = 1; i < linePoints.length; i++) {
                const prev = linePoints[i - 1];
                const cur = linePoints[i];
                const dc = closes[i] - closes[i - 1];
                const dPrev = i >= 2 ? closes[i - 1] - closes[i - 2] : NaN;
                const sign = dc === 0 ? 0 : dc > 0 ? 1 : -1;
                const prevSign = !Number.isFinite(dPrev) || dPrev === 0 ? 0 : dPrev > 0 ? 1 : -1;
                const reversal = i >= 2 && prevSign !== 0 && sign !== 0 && sign !== prevSign;
                const stroke = dc > 0 ? bullHex : dc < 0 ? bearHex : neutralHex;
                const strokeWidth = reversal ? 1.15 : 2.35;
                segments.push({
                  d: `M ${prev.x} ${prev.y} L ${cur.x} ${prev.y} L ${cur.x} ${cur.y}`,
                  stroke,
                  strokeWidth,
                });
              }
              return (
                <g key="kagi-classic">
                  {segments.map((s, idx) => (
                    <path
                      key={idx}
                      d={s.d}
                      stroke={s.stroke}
                      strokeWidth={s.strokeWidth}
                      fill="none"
                      strokeLinecap="butt"
                      strokeLinejoin="miter"
                    />
                  ))}
                  {linePoints.map((p, i) => {
                    const dc = i === 0 ? 0 : closes[i] - closes[i - 1];
                    const fill = dc > 0 ? bullHex : dc < 0 ? bearHex : neutralHex;
                    return (
                      <circle key={`kagi-pt-${i}`} cx={p.x} cy={p.y} r={2.25} fill={fill} stroke={chartBgHex} strokeWidth={0.75} />
                    );
                  })}
                </g>
              );
            })()
          ) : (
          (() => {
            const linePoints = windowSlice.map((k, i) => ({ x: cx(i), y: y(parseNum(String(k[4] ?? ""))) }));
            const lineColor = candleColors.bull === "#f5f5f5" ? "#171717" : candleColors.bull;
            const d =
              closeLineStepPath && linePoints.length > 0
                ? (() => {
                    let s = `M ${linePoints[0].x} ${linePoints[0].y}`;
                    for (let i = 1; i < linePoints.length; i++) {
                      const prev = linePoints[i - 1];
                      const cur = linePoints[i];
                      s += ` L ${cur.x} ${prev.y} L ${cur.x} ${cur.y}`;
                    }
                    return s;
                  })()
                : linePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
            const bottomY = MARGIN_TOP + chartH;
            const areaD =
              linePoints.length > 0 && chartStyle === "area"
                ? closeLineStepPath
                  ? (() => {
                      let s = d;
                      s += ` L ${linePoints[linePoints.length - 1].x} ${bottomY} L ${linePoints[0].x} ${bottomY} Z`;
                      return s;
                    })()
                  : `${d} L ${linePoints[linePoints.length - 1].x} ${bottomY} L ${linePoints[0].x} ${bottomY} Z`
                : "";
            return (
              <g key="close-line">
                {chartStyle === "area" && areaD ? (
                  <path d={areaD} fill={lineColor} fillOpacity={0.7} stroke="none" />
                ) : null}
                <path d={d} stroke={lineColor} strokeWidth={2} fill="none" />
                {chartStyle === "linePoints" && linePoints.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={lineColor} stroke={chartBgHex} strokeWidth={1} />
                ))}
              </g>
            );
          })()
          )
        ) : windowSlice.map((k, i) => {
          const openP = parseNum(String(k[1] ?? ""));
          const highP = parseNum(String(k[2] ?? ""));
          const lowP = parseNum(String(k[3] ?? ""));
          const closeP = parseNum(String(k[4] ?? ""));
          const bull = closeP >= openP;
          const x = cx(i);
          const bodyTop = y(Math.max(openP, closeP));
          const bodyBottom = y(Math.min(openP, closeP));
          const bodyH = Math.max(1, bodyBottom - bodyTop);
          const wickTop = y(highP);
          const wickBottom = y(lowP);
          const klinesIndex = n - 1 - startIndex - i;
          const paintOverlay = strategyCandleOverlays.find((o) => o.results[klinesIndex] && o.visualizationMode !== "signal");
          const strategyColor = paintOverlay?.color;
          const color = strategyColor ?? (bull ? candleColors.bull : candleColors.bear);
          const strokeColor = color === "#f5f5f5" ? "#171717" : color;
          const slotLeft = MARGIN_LEFT + i * gap;
          const tickLen = Math.max(2, candleW / 2);
          const openY = y(openP);
          const closeY = y(closeP);
          if (chartStyle === "bars") {
            return (
              <g key={i}>
                <rect x={slotLeft} y={MARGIN_TOP} width={gap} height={chartH} fill="transparent" />
                <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={strokeColor} strokeWidth={1} />
                <line x1={x - tickLen} y1={openY} x2={x} y2={openY} stroke={strokeColor} strokeWidth={1} />
                <line x1={x} y1={closeY} x2={x + tickLen} y2={closeY} stroke={strokeColor} strokeWidth={1} />
              </g>
            );
          }
          const bodyFill = chartStyle === "candles" && candleBodyStyle === "hollow" && bull ? chartBgHex : color;
          return (
            <g key={i}>
              <rect x={slotLeft} y={MARGIN_TOP} width={gap} height={chartH} fill="transparent" />
              <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={strokeColor} strokeWidth={1} />
              <rect
                x={x - candleW / 2}
                y={bodyTop}
                width={candleW}
                height={bodyH}
                fill={bodyFill}
                stroke={strokeColor}
                strokeWidth={1}
              />
            </g>
          );
        })}
        {strategyCandleOverlays.some((o) => o.visualizationMode === "signal") && (
          <g key="strategy-signals" pointerEvents="none">
            {windowSlice.map((k, i) => {
              const klinesIndex = n - 1 - startIndex - i;
              const highP = parseNum(String(k[2] ?? ""));
              const lowP = parseNum(String(k[3] ?? ""));
              const wickTop = y(highP);
              const wickBottom = y(lowP);
              const x = cx(i);
              const SIGNAL_OFFSET = 8;
              return strategyCandleOverlays
                .filter((o) => o.visualizationMode === "signal" && o.results[klinesIndex])
                .map((o, oIdx) => {
                  const pos = o.signalPosition === "above" ? wickTop - SIGNAL_OFFSET : wickBottom + SIGNAL_OFFSET;
                  const shape = o.signalShape ?? "arrowUp";
                  const col = o.color ?? "#6366f1";
                  const r = 5;
                  if (shape === "circle") {
                    return <circle key={`${o.id}-${i}-${oIdx}`} cx={x} cy={pos} r={r} fill="none" stroke={col} strokeWidth={1.5} />;
                  }
                  if (shape === "x") {
                    const d = 4;
                    return (
                      <g key={`${o.id}-${i}-${oIdx}`} stroke={col} strokeWidth={1.5}>
                        <line x1={x - d} y1={pos - d} x2={x + d} y2={pos + d} />
                        <line x1={x + d} y1={pos - d} x2={x - d} y2={pos + d} />
                      </g>
                    );
                  }
                  const arrowH = 6;
                  const arrowW = 4;
                  if (shape === "arrowUp") {
                    return (
                      <path
                        key={`${o.id}-${i}-${oIdx}`}
                        d={`M ${x} ${pos - arrowH} L ${x - arrowW} ${pos + arrowH} L ${x} ${pos + arrowH * 0.3} L ${x + arrowW} ${pos + arrowH} Z`}
                        fill={col}
                        stroke={col}
                        strokeWidth={1}
                      />
                    );
                  }
                  if (shape === "arrowDown") {
                    return (
                      <path
                        key={`${o.id}-${i}-${oIdx}`}
                        d={`M ${x} ${pos + arrowH} L ${x - arrowW} ${pos - arrowH} L ${x} ${pos - arrowH * 0.3} L ${x + arrowW} ${pos - arrowH} Z`}
                        fill={col}
                        stroke={col}
                        strokeWidth={1}
                      />
                    );
                  }
                  return null;
                });
            })}
          </g>
        )}
        </g>
        {spotOrderMarkers.length > 0 && (
          <g key="spot-order-markers" pointerEvents="auto">
            {spotOrderMarkers.map((m, mi) => {
              const i = n - 1 - startIndex - m.klinesIndex;
              if (i < 0 || i >= windowSlice.length) return null;
              const k = windowSlice[i];
              const lowP = parseNum(String(k[3] ?? ""));
              const wickBottom = y(lowP);
              const x = cx(i);
              const bw = Math.max(7, 8 * textScale);
              const bh = Math.max(10, 11 * textScale);
              const stack = m.stackIndex ?? 0;
              const gap = Math.max(1, 1.5 * textScale);
              const pad = 4 * textScale;
              const cy = wickBottom + pad + stack * (bh + gap);
              const letter = m.side === "SELL" ? "S" : "B";
              const fill = m.side === "SELL" ? "#dc2626" : "#059669";
              return (
                <g key={`${m.binanceOrderId}-${mi}`} transform={`translate(${x - bw / 2}, ${cy})`}>
                  <title>{m.title}</title>
                  <rect
                    width={bw}
                    height={bh}
                    rx={2 * textScale}
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                  <text
                    x={bw / 2}
                    y={bh * 0.72}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={7 * textScale}
                    fontWeight={700}
                    fontFamily='system-ui, ui-sans-serif, sans-serif'
                  >
                    {letter}
                  </text>
                </g>
              );
            })}
          </g>
        )}
        {utcDayStartMarkerXs.length > 0 && (
          <g pointerEvents="none">
            {utcDayStartMarkerXs.map((px, mi) => {
              const bottomY = MARGIN_TOP + chartH;
              const tickH = Math.max(3, Math.min(6, 4 * textScale));
              return (
                <g key={`utc-day-start-${mi}-${px}`}>
                  {utcDayStartMarkerTitle ? <title>{utcDayStartMarkerTitle}</title> : null}
                  <line
                    x1={px}
                    x2={px}
                    y1={bottomY - tickH}
                    y2={bottomY}
                    stroke={secondaryGridHex}
                    strokeOpacity={0.85}
                    strokeWidth={1}
                  />
                </g>
              );
            })}
          </g>
        )}
        {volumeAtPriceData && volumeAtPriceData.buckets.length > 0 && volumeAtPriceData.maxVolume > 0 && (() => {
          const widthPercent = Math.max(30, Math.min(100, volumeAtPriceWidthPercent ?? 100)) / 100;
          const maxWidthBase = Math.min(VOLUME_AT_PRICE_MAX_WIDTH_PX, chartW / 3);
          const maxBarWidth = maxWidthBase * widthPercent;
          const opacity = Math.max(0.1, Math.min(0.7, (volumeAtPriceOpacity ?? 40) / 100));
          const side = volumeAtPriceSide ?? "left";
          const colorAbove = volumeAtPriceColorAbove ?? "#059669";
          const colorBelow = volumeAtPriceColorBelow ?? "#dc2626";
          const mid = Math.floor(volumeAtPriceData.buckets.length / 2);
          return (
            <g key="volume-at-price" pointerEvents="none" clipPath={`url(#${plotClipId})`}>
              {volumeAtPriceData.buckets.map((b, i) => {
                const yTop = y(b.priceHigh);
                const yBottom = y(b.priceLow);
                const h = Math.max(1, yBottom - yTop);
                const w = maxBarWidth * (b.volume / volumeAtPriceData.maxVolume);
                const fillColor = i >= mid ? colorAbove : colorBelow;
                const x = side === "right" ? MARGIN_LEFT + chartW - w : MARGIN_LEFT;
                return (
                  <rect
                    key={i}
                    x={x}
                    y={yTop}
                    width={w}
                    height={h}
                    fill={fillColor}
                    fillOpacity={opacity}
                    stroke="#000000"
                    strokeOpacity={opacity}
                    strokeWidth={1}
                  />
                );
              })}
            </g>
          );
        })()}
        <g clipPath={`url(#${plotClipId.replace(/:/g, "\\:")})`}>
        {indicatorLines.filter((ind) => getPanel(ind) === "main").map((ind, indIdx) => {
          const col = ind.columnIndex;
          if (ind.type === "Bollinger") {
            const upperPts: { i: number; val: number }[] = [];
            const middlePts: { i: number; val: number }[] = [];
            const lowerPts: { i: number; val: number }[] = [];
            for (let i = 0; i < windowSlice.length; i++) {
              const u = windowSlice[i][col];
              const m = windowSlice[i][col + 1];
              const l = windowSlice[i][col + 2];
              if (u != null && typeof u === "number" && Number.isFinite(u)) upperPts.push({ i, val: u });
              if (m != null && typeof m === "number" && Number.isFinite(m)) middlePts.push({ i, val: m });
              if (l != null && typeof l === "number" && Number.isFinite(l)) lowerPts.push({ i, val: l });
            }
            const bandColor = ind.bollingerLimitsColor ?? "#6366f1";
            const bandOpacity = Math.max(0, Math.min(0.3, ind.bollingerBandOpacity ?? 0.2));
            const limitsStrokeWidth = lineWidthToStroke(ind.bollingerLimitsLineWidth);
            const limitsDash = ind.bollingerLimitsLineStyle === "dotted" ? "1 2" : ind.bollingerLimitsLineStyle === "dashed" ? "6 4" : undefined;
            const middleColor = ind.bollingerMiddleColor ?? ind.color ?? "#6366f1";
            const middleLw = ind.bollingerMiddleLineWidth ?? ind.lineWidth;
            const middleLs = ind.bollingerMiddleLineStyle ?? ind.lineStyle;
            const middleStrokeWidth = lineWidthToStroke(middleLw);
            const middleDash = middleLs === "dotted" ? "1 2" : middleLs === "dashed" ? "6 4" : undefined;
            const toPath = (pts: { i: number; val: number }[]) => pts.length < 2 ? "" : pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${cx(p.i)} ${y(p.val)}`).join(" ");
            const upperD = toPath(upperPts);
            const middleD = toPath(middlePts);
            const lowerD = toPath(lowerPts);
            const upperToMiddlePoly = upperPts.length >= 2 && middlePts.length >= 2
              ? (() => {
                  const uMap = new Map(upperPts.map((p) => [p.i, p.val]));
                  const mMap = new Map(middlePts.map((p) => [p.i, p.val]));
                  const indices = [...new Set([...uMap.keys(), ...mMap.keys()])].sort((a, b) => a - b);
                  let d = "";
                  for (const i of indices) {
                    const u = uMap.get(i);
                    const m = mMap.get(i);
                    if (u != null && m != null) d += `${d ? " L" : "M"} ${cx(i)} ${y(u)}`;
                  }
                  for (let j = indices.length - 1; j >= 0; j--) {
                    const i = indices[j]!;
                    const m = mMap.get(i);
                    const u = uMap.get(i);
                    if (m != null && u != null) d += ` L ${cx(i)} ${y(m)}`;
                  }
                  return d ? `${d} Z` : "";
                })()
              : "";
            const lowerToMiddlePoly = lowerPts.length >= 2 && middlePts.length >= 2
              ? (() => {
                  const lMap = new Map(lowerPts.map((p) => [p.i, p.val]));
                  const mMap = new Map(middlePts.map((p) => [p.i, p.val]));
                  const indices = [...new Set([...lMap.keys(), ...mMap.keys()])].sort((a, b) => a - b);
                  let d = "";
                  for (const i of indices) {
                    const l = lMap.get(i);
                    const m = mMap.get(i);
                    if (l != null && m != null) d += `${d ? " L" : "M"} ${cx(i)} ${y(l)}`;
                  }
                  for (let j = indices.length - 1; j >= 0; j--) {
                    const i = indices[j]!;
                    const m = mMap.get(i);
                    const l = lMap.get(i);
                    if (m != null && l != null) d += ` L ${cx(i)} ${y(m)}`;
                  }
                  return d ? `${d} Z` : "";
                })()
              : "";
            return (
              <g key={indIdx}>
                {upperToMiddlePoly && <path d={upperToMiddlePoly} fill={bandColor} fillOpacity={bandOpacity} stroke="none" />}
                {lowerToMiddlePoly && <path d={lowerToMiddlePoly} fill={bandColor} fillOpacity={bandOpacity} stroke="none" />}
                {ind.bollingerShowUpper !== false && upperD && <path d={upperD} fill="none" stroke={bandColor} strokeWidth={limitsStrokeWidth} strokeDasharray={limitsDash} strokeLinecap="round" strokeLinejoin="round" />}
                {ind.bollingerShowLower !== false && lowerD && <path d={lowerD} fill="none" stroke={bandColor} strokeWidth={limitsStrokeWidth} strokeDasharray={limitsDash} strokeLinecap="round" strokeLinejoin="round" />}
                {ind.bollingerShowMiddle === true && middleD && <path d={middleD} fill="none" stroke={middleColor} strokeWidth={middleStrokeWidth} strokeDasharray={middleDash} strokeLinecap="round" strokeLinejoin="round" />}
              </g>
            );
          }
          if (ind.type === "Keltner") {
            const upperPts: { i: number; val: number }[] = [];
            const middlePts: { i: number; val: number }[] = [];
            const lowerPts: { i: number; val: number }[] = [];
            for (let i = 0; i < windowSlice.length; i++) {
              const u = windowSlice[i][col];
              const m = windowSlice[i][col + 1];
              const l = windowSlice[i][col + 2];
              if (u != null && typeof u === "number" && Number.isFinite(u)) upperPts.push({ i, val: u });
              if (m != null && typeof m === "number" && Number.isFinite(m)) middlePts.push({ i, val: m });
              if (l != null && typeof l === "number" && Number.isFinite(l)) lowerPts.push({ i, val: l });
            }
            const bandColor = ind.keltnerLimitsColor ?? "#6366f1";
            const bandOpacity = Math.max(0, Math.min(0.3, ind.keltnerBandOpacity ?? 0.2));
            const limitsStrokeWidth = lineWidthToStroke(ind.keltnerLimitsLineWidth);
            const limitsDash = ind.keltnerLimitsLineStyle === "dotted" ? "1 2" : ind.keltnerLimitsLineStyle === "dashed" ? "6 4" : undefined;
            const middleColor = ind.color ?? "#6366f1";
            const middleStrokeWidth = lineWidthToStroke(ind.lineWidth);
            const middleDash = ind.lineStyle === "dotted" ? "1 2" : ind.lineStyle === "dashed" ? "6 4" : undefined;
            const toPath = (pts: { i: number; val: number }[]) => pts.length < 2 ? "" : pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${cx(p.i)} ${y(p.val)}`).join(" ");
            const upperD = toPath(upperPts);
            const middleD = toPath(middlePts);
            const lowerD = toPath(lowerPts);
            const upperToMiddlePoly = upperPts.length >= 2 && middlePts.length >= 2
              ? (() => {
                  const uMap = new Map(upperPts.map((p) => [p.i, p.val]));
                  const mMap = new Map(middlePts.map((p) => [p.i, p.val]));
                  const indices = [...new Set([...uMap.keys(), ...mMap.keys()])].sort((a, b) => a - b);
                  let d = "";
                  for (const i of indices) {
                    const u = uMap.get(i);
                    const m = mMap.get(i);
                    if (u != null && m != null) d += `${d ? " L" : "M"} ${cx(i)} ${y(u)}`;
                  }
                  for (let j = indices.length - 1; j >= 0; j--) {
                    const i = indices[j]!;
                    const m = mMap.get(i);
                    const u = uMap.get(i);
                    if (m != null && u != null) d += ` L ${cx(i)} ${y(m)}`;
                  }
                  return d ? `${d} Z` : "";
                })()
              : "";
            const lowerToMiddlePoly = lowerPts.length >= 2 && middlePts.length >= 2
              ? (() => {
                  const lMap = new Map(lowerPts.map((p) => [p.i, p.val]));
                  const mMap = new Map(middlePts.map((p) => [p.i, p.val]));
                  const indices = [...new Set([...lMap.keys(), ...mMap.keys()])].sort((a, b) => a - b);
                  let d = "";
                  for (const i of indices) {
                    const l = lMap.get(i);
                    const m = mMap.get(i);
                    if (l != null && m != null) d += `${d ? " L" : "M"} ${cx(i)} ${y(l)}`;
                  }
                  for (let j = indices.length - 1; j >= 0; j--) {
                    const i = indices[j]!;
                    const m = mMap.get(i);
                    const l = lMap.get(i);
                    if (m != null && l != null) d += ` L ${cx(i)} ${y(m)}`;
                  }
                  return d ? `${d} Z` : "";
                })()
              : "";
            return (
              <g key={indIdx}>
                {upperToMiddlePoly && <path d={upperToMiddlePoly} fill={bandColor} fillOpacity={bandOpacity} stroke="none" />}
                {lowerToMiddlePoly && <path d={lowerToMiddlePoly} fill={bandColor} fillOpacity={bandOpacity} stroke="none" />}
                {ind.keltnerShowUpper !== false && upperD && <path d={upperD} fill="none" stroke={bandColor} strokeWidth={limitsStrokeWidth} strokeDasharray={limitsDash} strokeLinecap="round" strokeLinejoin="round" />}
                {ind.keltnerShowLower !== false && lowerD && <path d={lowerD} fill="none" stroke={bandColor} strokeWidth={limitsStrokeWidth} strokeDasharray={limitsDash} strokeLinecap="round" strokeLinejoin="round" />}
                {ind.keltnerShowMiddle === true && middleD && <path d={middleD} fill="none" stroke={middleColor} strokeWidth={middleStrokeWidth} strokeDasharray={middleDash} strokeLinecap="round" strokeLinejoin="round" />}
              </g>
            );
          }
          if (ind.type === "Donchian") {
            const upperPts: { i: number; val: number }[] = [];
            const middlePts: { i: number; val: number }[] = [];
            const lowerPts: { i: number; val: number }[] = [];
            for (let i = 0; i < windowSlice.length; i++) {
              const u = windowSlice[i][col];
              const m = windowSlice[i][col + 1];
              const l = windowSlice[i][col + 2];
              if (u != null && typeof u === "number" && Number.isFinite(u)) upperPts.push({ i, val: u });
              if (m != null && typeof m === "number" && Number.isFinite(m)) middlePts.push({ i, val: m });
              if (l != null && typeof l === "number" && Number.isFinite(l)) lowerPts.push({ i, val: l });
            }
            const bandColor = ind.donchianLimitsColor ?? "#6366f1";
            const bandOpacity = Math.max(0, Math.min(0.3, ind.donchianBandOpacity ?? 0.2));
            const limitsStrokeWidth = lineWidthToStroke(ind.donchianLimitsLineWidth);
            const limitsDash = ind.donchianLimitsLineStyle === "dotted" ? "1 2" : ind.donchianLimitsLineStyle === "dashed" ? "6 4" : undefined;
            const middleColor = ind.donchianMiddleColor ?? ind.color ?? "#6366f1";
            const middleLw = ind.donchianMiddleLineWidth ?? ind.lineWidth;
            const middleLs = ind.donchianMiddleLineStyle ?? ind.lineStyle;
            const middleStrokeWidth = lineWidthToStroke(middleLw);
            const middleDash = middleLs === "dotted" ? "1 2" : middleLs === "dashed" ? "6 4" : undefined;
            const toPath = (pts: { i: number; val: number }[]) => pts.length < 2 ? "" : pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${cx(p.i)} ${y(p.val)}`).join(" ");
            const upperD = toPath(upperPts);
            const middleD = toPath(middlePts);
            const lowerD = toPath(lowerPts);
            const upperToMiddlePoly = upperPts.length >= 2 && middlePts.length >= 2
              ? (() => {
                  const uMap = new Map(upperPts.map((p) => [p.i, p.val]));
                  const mMap = new Map(middlePts.map((p) => [p.i, p.val]));
                  const indices = [...new Set([...uMap.keys(), ...mMap.keys()])].sort((a, b) => a - b);
                  let d = "";
                  for (const i of indices) {
                    const u = uMap.get(i);
                    const m = mMap.get(i);
                    if (u != null && m != null) d += `${d ? " L" : "M"} ${cx(i)} ${y(u)}`;
                  }
                  for (let j = indices.length - 1; j >= 0; j--) {
                    const i = indices[j]!;
                    const m = mMap.get(i);
                    const u = uMap.get(i);
                    if (m != null && u != null) d += ` L ${cx(i)} ${y(m)}`;
                  }
                  return d ? `${d} Z` : "";
                })()
              : "";
            const lowerToMiddlePoly = lowerPts.length >= 2 && middlePts.length >= 2
              ? (() => {
                  const lMap = new Map(lowerPts.map((p) => [p.i, p.val]));
                  const mMap = new Map(middlePts.map((p) => [p.i, p.val]));
                  const indices = [...new Set([...lMap.keys(), ...mMap.keys()])].sort((a, b) => a - b);
                  let d = "";
                  for (const i of indices) {
                    const l = lMap.get(i);
                    const m = mMap.get(i);
                    if (l != null && m != null) d += `${d ? " L" : "M"} ${cx(i)} ${y(l)}`;
                  }
                  for (let j = indices.length - 1; j >= 0; j--) {
                    const i = indices[j]!;
                    const m = mMap.get(i);
                    const l = lMap.get(i);
                    if (m != null && l != null) d += ` L ${cx(i)} ${y(m)}`;
                  }
                  return d ? `${d} Z` : "";
                })()
              : "";
            return (
              <g key={indIdx}>
                {upperToMiddlePoly && <path d={upperToMiddlePoly} fill={bandColor} fillOpacity={bandOpacity} stroke="none" />}
                {lowerToMiddlePoly && <path d={lowerToMiddlePoly} fill={bandColor} fillOpacity={bandOpacity} stroke="none" />}
                {ind.donchianShowUpper !== false && upperD && <path d={upperD} fill="none" stroke={bandColor} strokeWidth={limitsStrokeWidth} strokeDasharray={limitsDash} strokeLinecap="round" strokeLinejoin="round" />}
                {ind.donchianShowLower !== false && lowerD && <path d={lowerD} fill="none" stroke={bandColor} strokeWidth={limitsStrokeWidth} strokeDasharray={limitsDash} strokeLinecap="round" strokeLinejoin="round" />}
                {ind.donchianShowMiddle === true && middleD && <path d={middleD} fill="none" stroke={middleColor} strokeWidth={middleStrokeWidth} strokeDasharray={middleDash} strokeLinecap="round" strokeLinejoin="round" />}
              </g>
            );
          }
          if (ind.type === "Ichimoku" && ind.ichimokuPart) {
            const part = ind.ichimokuPart;
            const baseCol = col - (part === "tenkan" ? 0 : part === "kijun" ? 1 : part === "spanA" ? 2 : part === "spanB" ? 3 : 4);
            const disp = Math.max(0, Math.min(500, ind.ichimokuDisplacement ?? 26));
            const pts: { i: number; val: number }[] = [];
            for (let i = 0; i < windowSlice.length; i++) {
              const v = windowSlice[i][col];
              if (v == null || typeof v !== "number" || !Number.isFinite(v)) continue;
              if (part === "spanA" || part === "spanB") {
                const j = i + disp;
                if (j < totalSlots) pts.push({ i: j, val: v });
              } else {
                pts.push({ i, val: v });
              }
            }
            const show = part === "tenkan" ? (ind.ichimokuShowTenkan !== false) : part === "kijun" ? (ind.ichimokuShowKijun !== false) : part === "spanA" ? (ind.ichimokuShowSpanA !== false) : part === "spanB" ? (ind.ichimokuShowSpanB !== false) : (ind.ichimokuShowChikou === true);
            const toPathI = (p: { i: number; val: number }[]) => p.length < 2 ? "" : p.map((pt, idx) => `${idx === 0 ? "M" : "L"} ${cx(pt.i)} ${y(pt.val)}`).join(" ");
            const strokeVal = (w: "thin" | "normal" | "thick" | undefined, style: "solid" | "dotted" | "dashed" | undefined) => ({ width: lineWidthToStroke(w), dash: style === "dotted" ? "1 2" : style === "dashed" ? "6 4" : undefined });
            const s = strokeVal(ind.lineWidth, ind.lineStyle);
            let cloudEl: ReactNode = null;
            if (part === "tenkan") {
              const spanAPts: { i: number; val: number }[] = [];
              const spanBPts: { i: number; val: number }[] = [];
              for (let i = 0; i < windowSlice.length; i++) {
                const j = i + disp;
                if (j >= totalSlots) continue;
                const a = windowSlice[i][baseCol + 2];
                const b = windowSlice[i][baseCol + 3];
                if (a != null && typeof a === "number" && Number.isFinite(a)) spanAPts.push({ i: j, val: a });
                if (b != null && typeof b === "number" && Number.isFinite(b)) spanBPts.push({ i: j, val: b });
              }
              const cloudOpacity = Math.max(0, Math.min(0.7, ind.ichimokuCloudOpacity ?? 0.3));
              const greenCloud = "#22c55e";
              const redCloud = "#ef4444";
              const aMap = new Map(spanAPts.map((p) => [p.i, p.val]));
              const bMap = new Map(spanBPts.map((p) => [p.i, p.val]));
              const indices = [...new Set([...aMap.keys(), ...bMap.keys()])].sort((x, y) => x - y);
              const cloudPaths: { d: string; fill: string }[] = [];
              let segStart: number | null = null;
              let segAboveA: boolean | null = null;
              for (let idx = 0; idx < indices.length; idx++) {
                const i = indices[idx]!;
                const a = aMap.get(i);
                const b = bMap.get(i);
                if (a == null || b == null) continue;
                const aboveA = a >= b;
                if (segStart === null) {
                  segStart = i;
                  segAboveA = aboveA;
                } else if (aboveA !== segAboveA) {
                  const segIndices = indices.filter((j) => j >= segStart! && j <= i);
                  let d = "";
                  for (const j of segIndices) {
                    const av = aMap.get(j);
                    const bv = bMap.get(j);
                    if (av != null && bv != null) d += `${d ? " L" : "M"} ${cx(j)} ${y(segAboveA ? av : bv)}`;
                  }
                  for (let j = segIndices.length - 1; j >= 0; j--) {
                    const jj = segIndices[j]!;
                    const av = aMap.get(jj);
                    const bv = bMap.get(jj);
                    if (av != null && bv != null) d += ` L ${cx(jj)} ${y(segAboveA ? bv : av)}`;
                  }
                  if (d) cloudPaths.push({ d: `${d} Z`, fill: segAboveA ? greenCloud : redCloud });
                  segStart = i;
                  segAboveA = aboveA;
                }
              }
              if (segStart !== null && segAboveA !== null) {
                const segIndices = indices.filter((j) => j >= segStart!);
                let d = "";
                for (const j of segIndices) {
                  const av = aMap.get(j);
                  const bv = bMap.get(j);
                  if (av != null && bv != null) d += `${d ? " L" : "M"} ${cx(j)} ${y(segAboveA ? av : bv)}`;
                }
                for (let j = segIndices.length - 1; j >= 0; j--) {
                  const jj = segIndices[j]!;
                  const av = aMap.get(jj);
                  const bv = bMap.get(jj);
                  if (av != null && bv != null) d += ` L ${cx(jj)} ${y(segAboveA ? bv : av)}`;
                }
                if (d) cloudPaths.push({ d: `${d} Z`, fill: segAboveA ? greenCloud : redCloud });
              }
              cloudEl = <>{cloudPaths.map((cp, ci) => <path key={ci} d={cp.d} fill={cp.fill} fillOpacity={cloudOpacity} stroke="none" />)}</>;
            }
            return (
              <g key={indIdx}>
                {cloudEl}
                {show && toPathI(pts) && <path d={toPathI(pts)} fill="none" stroke={ind.color} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinecap="round" strokeLinejoin="round" />}
              </g>
            );
          }
          const points: { i: number; val: number }[] = [];
          for (let i = 0; i < windowSlice.length; i++) {
            const v = windowSlice[i][col];
            if (v != null && typeof v === "number" && Number.isFinite(v)) points.push({ i, val: v });
          }
          if (ind.display === "points") {
            const r = ind.pointSize === "thin" ? 1.5 : 2.5;
            return (
              <g key={indIdx}>
                {points.map((p, i) => (
                  <circle
                    key={i}
                    cx={cx(p.i)}
                    cy={y(p.val)}
                    r={r}
                    fill={ind.color}
                    stroke="none"
                  />
                ))}
              </g>
            );
          }
          if (points.length < 2) return null;
          const d = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${cx(p.i)} ${y(p.val)}`).join(" ");
          const strokeWidth = lineWidthToStroke(ind.lineWidth);
          const strokeDasharray = ind.lineStyle === "dotted" ? "1 2" : ind.lineStyle === "dashed" ? "6 4" : undefined;
          return (
            <path
              key={indIdx}
              d={d}
              fill="none"
              stroke={ind.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        </g>
        {regressionOverlayPaths.length > 0 && (
          <g clipPath={`url(#${plotClipId.replace(/:/g, "\\:")})`} pointerEvents="none">
            {regressionOverlayPaths.map((p) => (
              <path
                key={p.id}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={p.strokeWidth}
                strokeDasharray={p.strokeDasharray}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
        )}
        {volumeOnPrice && (() => {
          const volTop = MARGIN_TOP + (chartH * 2) / 3;
          const volH = chartH / 3;
          const volBottom = volTop + volH;
          /** Coluna 7 = quote asset volume (USDT em pares USDT); coluna 5 = volume na base (muito pequeno em BTC, etc.). */
          const VOL_COL = 7;
          let maxVol = 0;
          for (let i = 0; i < windowSlice.length; i++) {
            const v = windowSlice[i][VOL_COL];
            const numVal = v != null ? (typeof v === "number" ? v : Number(v)) : 0;
            if (Number.isFinite(numVal) && numVal > maxVol) maxVol = numVal;
          }
          const barW = Math.max(1, gap * 0.6);
          const opacity = Math.max(0, Math.min(1, volumeOnPriceOpacity / 100));
          return (
            <g pointerEvents="none">
              <clipPath id={volumeOnPriceClipId}>
                <rect x={MARGIN_LEFT} y={volTop} width={chartW} height={volH} />
              </clipPath>
              <g clipPath={`url(#${volumeOnPriceClipId.replace(/:/g, "\\:")})`}>
                {windowSlice.map((row, i) => {
                  const v = row[VOL_COL];
                  const numVal = v != null ? (typeof v === "number" ? v : Number(v)) : 0;
                  if (!Number.isFinite(numVal) || numVal < 0 || maxVol <= 0) return null;
                  const openRaw = row[1];
                  const closeRaw = row[4];
                  const open = typeof openRaw === "string" ? parseFloat(openRaw) : Number(openRaw);
                  const close = typeof closeRaw === "string" ? parseFloat(closeRaw) : Number(closeRaw);
                  const fill = (Number.isFinite(open) && Number.isFinite(close) && close >= open) ? candleColors.bull : candleColors.bear;
                  const barHeight = Math.max(1, (numVal / maxVol) * volH);
                  const yTop = volBottom - barHeight;
                  return (
                    <rect
                      key={i}
                      x={cx(i) - barW / 2}
                      y={yTop}
                      width={barW}
                      height={barHeight}
                      fill={fill}
                      fillOpacity={opacity}
                      stroke="none"
                    />
                  );
                })}
              </g>
            </g>
          );
        })()}
        {crosshairPoint && (() => {
          const showCrosshair =
            crosshairPoint.index >= 0 && crosshairPoint.index < n;
          if (!showCrosshair) return null;
          let crossX = segmentToPixel(crosshairPoint.index, crosshairPoint.price).x;
          let crossY = crosshairPoint.panelClickY != null ? crosshairPoint.panelClickY : y(crosshairPoint.price);
          if (crosshairDragging) {
            crossX = Math.max(MARGIN_LEFT, Math.min(MARGIN_LEFT + chartW, crossX));
            crossY = Math.max(MARGIN_TOP, Math.min(MARGIN_TOP + chartH, crossY));
          }
          const tableTop = MARGIN_TOP + chartH;
          const chartBottom = hasPanel5
            ? panelTop("panel5") + panelHeight("panel5")
            : hasPanel4
              ? panelTop("panel4") + panelHeight("panel4")
              : hasPanel3
                ? panelTop("panel3") + panelHeight("panel3")
                : hasPanel2
                  ? panelTop("panel2") + panelHeight("panel2")
                  : tableTop;
          const openTimeMs = crosshairPoint.index >= 0 && crosshairPoint.index < n ? Number(fullReversed[crosshairPoint.index][0]) : null;
          const boxPad = 6;
          const lineH = 10;
          const boxW = 72;
          const boxH = lineH * 2 + boxPad * 2;
          const boxX = Math.max(MARGIN_LEFT, Math.min(MARGIN_LEFT + chartW - boxW, crossX - boxW / 2));
          const boxY = tableTop + 2;
          return (
            <g pointerEvents="none">
              <line x1={crossX} y1={MARGIN_TOP} x2={crossX} y2={chartBottom} stroke={lineTableHex} strokeWidth={1} strokeDasharray="4 2" />
              <line x1={MARGIN_LEFT} y1={crossY} x2={MARGIN_LEFT + chartW} y2={crossY} stroke={lineTableHex} strokeWidth={1} strokeDasharray="4 2" />
              <circle cx={crossX} cy={crossY} r={3} fill={lineTableHex} stroke="none" />
              {openTimeMs != null && (
                <g>
                  <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={2} fill="#000000" fillOpacity={0.8} />
                  <text x={boxX + boxW / 2} y={boxY + boxPad + lineH - 1} textAnchor="middle" className="font-mono" style={{ fontSize }} fill="#ffffff">
                    {formatDateYyyyMmDd(openTimeMs)}
                  </text>
                  <text x={boxX + boxW / 2} y={boxY + boxPad + lineH * 2 - 1} textAnchor="middle" className="font-mono" style={{ fontSize }} fill="#ffffff">
                    {formatTimeLabel(openTimeMs)}
                  </text>
                </g>
              )}
            </g>
          );
        })()}
        {crosshairPoint !== null && crosshairPoint.index >= startIndex && crosshairPoint.index < startIndex + windowN && (() => {
          const localIndex = crosshairPoint.index - startIndex;
          const k = windowSlice[localIndex];
          if (!k) return null;
          const openP = parseNum(String(k[1] ?? ""));
          const highP = parseNum(String(k[2] ?? ""));
          const lowP = parseNum(String(k[3] ?? ""));
          const closeP = parseNum(String(k[4] ?? ""));
          if (crosshairPoint.price < lowP || crosshairPoint.price > highP) return null;
          const openTimeMs = Number(k[0]);
          const prevK = localIndex > 0 ? windowSlice[localIndex - 1] : null;
          const prevClose = prevK ? parseNum(String(prevK[4] ?? "")) : 0;
          const amplitude = closeP - openP;
          const amplitudePct = openP > 0 ? (amplitude / openP) * 100 : 0;
          const pctVsPrev = prevClose > 0 ? ((closeP - prevClose) / prevClose) * 100 : 0;
          const pctVsPrevStr = pctVsPrev >= 0 ? `+${pctVsPrev.toFixed(2)}%` : pctVsPrev.toFixed(2) + "%";
          const volume = parseNum(String(k[5] ?? ""));
          const volumeUsdt = parseNum(String(k[7] ?? ""));
          /** `klinesIndex` nos marcadores é índice na série API (0 = mais recente); `crosshairPoint.index` é índice em `fullReversed` (0 = mais antiga). */
          const klinesIndexNewestFirst = n - 1 - crosshairPoint.index;
          const spotOrdersHere = spotOrderMarkers
            .filter((m) => m.klinesIndex === klinesIndexNewestFirst)
            .sort((a, b) => (a.stackIndex ?? 0) - (b.stackIndex ?? 0));
          const x = cx(localIndex);
          const wickTop = y(highP);
          const bodyBottom = y(Math.min(openP, closeP));
          const tk = t as Record<string, string>;
          const tw = Math.max(130, spotOrdersHere.length > 0 ? 168 : 130);
          const lineH = 11;
          const pad = 6;
          const numLines = 11 + spotOrdersHere.length;
          const th = pad * 2 + lineH * numLines;
          const tx = Math.max(MARGIN_LEFT + 4, Math.min(MARGIN_LEFT + chartW - tw - 4, x - tw / 2));
          const showAbove = wickTop - th - 4 >= MARGIN_TOP;
          const ty = showAbove ? wickTop - th - 4 : bodyBottom + 4;
          const fmt = (v: number) => formatYAxis(v);
          const y1 = ty + pad + 9;
          const blue = "#2563eb";
          const green = "#059669";
          const red = "#dc2626";
          return (
            <g pointerEvents="none" opacity={0.8}>
              <rect x={tx} y={ty} width={tw} height={th} rx={4} ry={4} fill="white" stroke="#e4e4e7" strokeWidth={1} />
              <text x={tx + pad} y={y1} className="font-mono" style={{ fontSize }} fill="#171717">{t.date}: {formatDateLabel(openTimeMs)}</text>
              <text x={tx + pad} y={y1 + lineH} className="font-mono" style={{ fontSize }} fill="#171717">{t.time}: {formatTimeLabel(openTimeMs)}</text>
              <text x={tx + pad} y={y1 + lineH * 2} className="font-mono font-medium" style={{ fontSize }} fill="#171717">{t.open}: {fmt(openP)}</text>
              <text x={tx + pad} y={y1 + lineH * 3} className="font-mono" style={{ fontSize }} fill="#171717">{t.high}: {fmt(highP)}</text>
              <text x={tx + pad} y={y1 + lineH * 4} className="font-mono" style={{ fontSize }} fill="#171717">{t.low}: {fmt(lowP)}</text>
              <text x={tx + pad} y={y1 + lineH * 5} className="font-mono" style={{ fontSize }} fill="#171717">{t.close}: {fmt(closeP)}</text>
              <text x={tx + pad} y={y1 + lineH * 6} className="font-mono" style={{ fontSize }} fill={blue}>{t.amplitude}: {fmt(amplitude)}</text>
              <text x={tx + pad} y={y1 + lineH * 7} className="font-mono" style={{ fontSize }} fill={blue}>{t.amplitudeVar}: {amplitudePct.toFixed(2)}%</text>
              <text x={tx + pad} y={y1 + lineH * 8} className="font-mono" style={{ fontSize }} fill={pctVsPrev >= 0 ? green : red}>{t.vsPrevClose} {pctVsPrevStr}</text>
              <text x={tx + pad} y={y1 + lineH * 9} className="font-mono" style={{ fontSize }} fill="#171717">{t.volumeBtc}: {formatAbbreviated(volume)}</text>
              <text x={tx + pad} y={y1 + lineH * 10} className="font-mono" style={{ fontSize }} fill="#171717">{t.volUsdt}: {formatAbbreviated(volumeUsdt)}</text>
              {spotOrdersHere.map((m, oi) => {
                const ap = m.avgPrice;
                const priceShown =
                  ap != null && Number.isFinite(ap) && ap > 0 ? fmt(ap) : (tk.spotOrderHoverNoPrice ?? "—");
                const label =
                  m.side === "SELL" ? (tk.spotOrderHoverPriceSell ?? "Price (S):") : (tk.spotOrderHoverPriceBuy ?? "Price (B):");
                const rowY = y1 + lineH * (11 + oi);
                const col = m.side === "SELL" ? red : green;
                return (
                  <text key={m.binanceOrderId} x={tx + pad} y={rowY} className="font-mono" style={{ fontSize }} fill={col}>
                    {label} {priceShown}
                  </text>
                );
              })}
            </g>
          );
        })()}
        {!drawMode && (
          <rect
            ref={crosshairOverlayRef}
            x={MARGIN_LEFT}
            y={MARGIN_TOP}
            width={chartW}
            height={chartH}
            fill="transparent"
            style={{ pointerEvents: "none" }}
            aria-hidden
          />
        )}
        <g clipPath={`url(#${plotClipId.replace(/:/g, "\\:")})`}>
        {drawingsVisible && drawSegments.map((seg, idx) => (
          <DrawSegmentRender
            key={idx}
            segment={seg}
            index={idx}
            segmentToPixel={segmentToPixel}
            isSelected={selectedSegmentIndex === idx}
            setDrawDragging={setDrawDragging}
            formatYAxis={formatYAxis}
            fullReversed={fullReversed}
            n={n}
            fontSize={fontSize}
            maxVisibleIndex={startIndex + windowN - 1}
            mainChartTopY={MARGIN_TOP}
            mainChartBottomY={MARGIN_TOP + chartH}
          />
        ))}
        <DrawOverlay
          chartSvgRef={chartSvgRef}
          chartW={chartW}
          chartH={chartH}
          drawMode={drawMode}
          drawTool={drawTool}
          drawPending={drawPending}
          setDrawPending={setDrawPending}
          drawPendingRectSecond={drawPendingRectSecond}
          setDrawPendingRectSecond={setDrawPendingRectSecond}
          drawPendingFibSecond={drawPendingFibSecond}
          setDrawPendingFibSecond={setDrawPendingFibSecond}
          drawPendingFreeRetraceSecond={drawPendingFreeRetraceSecond}
          setDrawPendingFreeRetraceSecond={setDrawPendingFreeRetraceSecond}
          drawPendingLineSecond={drawPendingLineSecond}
          setDrawPendingLineSecond={setDrawPendingLineSecond}
          drawPendingChannelSecond={drawPendingChannelSecond}
          setDrawPendingChannelSecond={setDrawPendingChannelSecond}
          drawPendingStopGainSecond={drawPendingStopGainSecond}
          setDrawPendingStopGainSecond={setDrawPendingStopGainSecond}
          drawPendingHorizontalSecond={drawPendingHorizontalSecond}
          setDrawPendingHorizontalSecond={setDrawPendingHorizontalSecond}
          drawPendingArrow={drawPendingArrow}
          setDrawPendingArrow={setDrawPendingArrow}
          drawPendingText={drawPendingText}
          setDrawPendingText={setDrawPendingText}
          drawPendingPencil={drawPendingPencil}
          setDrawPendingPencil={setDrawPendingPencil}
          segmentToPixel={segmentToPixel}
          snapToCandlePoint={snapToCandlePoint}
          pixelToData={pixelToData}
          drawSegments={drawSegments}
          setDrawSegments={setDrawSegments}
          drawDefaults={drawDefaults}
          fullReversed={fullReversed}
          n={n}
          selectedSegmentIndex={selectedSegmentIndex}
          setSelectedSegmentIndex={setSelectedSegmentIndex}
          drawingsVisible={drawingsVisible}
          onChartDrawClick={onChartDrawClick}
          onSegmentCreated={onSegmentCreated}
          onSelectToolPan={onSelectToolPan}
          selectPanActive={selectPanActive}
          setSelectPanActive={setSelectPanActive}
          selectPanLastClientXRef={selectPanLastClientX}
          justPannedRef={justPannedRef}
        />
        {drawPendingText && onCreateTextSegment && (
          <DrawTextInputOverlay
            x={segmentToPixel(drawPendingText.index1, drawPendingText.price1).x}
            y={segmentToPixel(drawPendingText.index1, drawPendingText.price1).y}
            defaultColor={drawDefaults.text?.color ?? DEFAULT_TEXT_COLOR}
            onSubmit={onCreateTextSegment}
            onCancel={() => setDrawPendingText(null)}
            tOk={t.drawTextOk}
            tCancel={t.drawTextCancel}
          />
        )}
        {drawingsVisible && drawMode && selectedSegmentIndex !== null && drawSegments[selectedSegmentIndex] && (
          <DrawSegmentHandles
            segment={drawSegments[selectedSegmentIndex]!}
            selectedSegmentIndex={selectedSegmentIndex}
            segmentToPixel={segmentToPixel}
            setDrawDragging={setDrawDragging}
            t={t}
            mainChartTopY={MARGIN_TOP}
            mainChartBottomY={MARGIN_TOP + chartH}
          />
        )}
        </g>
        {drawingsVisible && (() => {
          const extendedBottomY = hasPanel5
            ? panelTop("panel5") + panelHeight("panel5")
            : hasPanel4
              ? panelTop("panel4") + panelHeight("panel4")
              : hasPanel3
                ? panelTop("panel3") + panelHeight("panel3")
                : hasPanel2
                  ? panelTop("panel2") + panelHeight("panel2")
                  : null;
          if (extendedBottomY == null) return null;
          return drawSegments.map((seg, idx) => {
            if (seg.type !== "verticalLine" || seg.verticalLineExtendToPanels !== true) return null;
            const vx = segmentToPixel(seg.index1, seg.price1).x;
            const strokeColor = seg.color ?? "#000000";
            const strokeW = FIB_STROKE_WIDTH_VALUES[(seg.verticalLineStrokeWidth as "thin" | "medium" | "thick") ?? "medium"];
            const dashStyle = seg.verticalLineStrokeStyle ?? "solid";
            const strokeDasharray = HORIZONTAL_LINE_STROKE_STYLE_DASH[dashStyle];
            const mainBottom = MARGIN_TOP + chartH;
            return (
              <line
                key={`vline-ext-${idx}`}
                x1={vx}
                y1={mainBottom}
                x2={vx}
                y2={extendedBottomY}
                stroke={strokeColor}
                strokeWidth={strokeW}
                strokeDasharray={strokeDasharray}
                pointerEvents="none"
              />
            );
          });
        })()}
        {drawingsVisible && drawSegments.map((seg, idx) => {
          if (seg.type !== "verticalLine" || seg.verticalLineShowDateTimeOnXAxis !== true) return null;
          const vx = segmentToPixel(seg.index1, seg.price1).x;
          const openTimeMs = seg.index1 >= 0 && seg.index1 < fullReversed.length ? Number(fullReversed[seg.index1]?.[0]) : null;
          if (openTimeMs == null || !Number.isFinite(openTimeMs)) return null;
          const boxPad = 6;
          const lineH = 10;
          const boxW = 72;
          const boxH = lineH * 2 + boxPad * 2;
          const boxY = MARGIN_TOP + chartH + 2;
          const boxX = Math.max(MARGIN_LEFT, Math.min(MARGIN_LEFT + chartW - boxW, vx - boxW / 2));
          return (
            <g key={`vline-dt-${idx}`} pointerEvents="none">
              <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={2} fill="#000000" fillOpacity={0.8} />
              <text x={boxX + boxW / 2} y={boxY + boxPad + lineH - 1} textAnchor="middle" className="font-mono" style={{ fontSize }} fill="#ffffff">
                {formatDateYyyyMmDd(openTimeMs)}
              </text>
              <text x={boxX + boxW / 2} y={boxY + boxPad + lineH * 2 - 1} textAnchor="middle" className="font-mono" style={{ fontSize }} fill="#ffffff">
                {formatTimeLabel(openTimeMs)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
