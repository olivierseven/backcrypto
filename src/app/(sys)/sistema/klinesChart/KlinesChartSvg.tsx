"use client";

/**
 * SVG do gráfico de candles: faixa de indicadores, grade, candles, crosshair, tooltip OHLC, segmentos e overlay de desenho.
 */
import { useId, useRef, useState, useEffect, type RefObject } from "react";
import { MARGIN_LEFT, MARGIN_TOP, INDICATOR_STRIP_HEIGHT } from "../KlinesChartConstants";
import { parseNum } from "../klinesFormatters";
import { formatTimeLabel, formatDateLabel, formatDateYyyyMmDd, formatMonthOnly, formatAbbreviated } from "../klinesFormatters";
import { distanceToSegment, DEFAULT_SEGMENT_COLOR } from "../KlinesChartDrawing";
import { FIB_STROKE_WIDTH_VALUES, type DrawSegment, type DrawDefaults, type FibStrokeWidth } from "../KlinesChartDrawing";
import { SEGMENT_COLOR_PALETTE } from "./palettes";
import type { ChartIndicatorLine, StrategyCandleOverlay } from "./types";

const FIB_DEFAULT_COLOR = SEGMENT_COLOR_PALETTE[8];
const FIB_DEFAULT_618_COLOR = SEGMENT_COLOR_PALETTE[4];
import { MS_PER_DAY } from "../KlinesChartConstants";

export interface KlinesChartSvgProps {
  chartSvgRef: RefObject<SVGSVGElement | null>;
  crosshairOverlayRef: RefObject<SVGRectElement | null>;
  width: number;
  chartHeight: number;
  chartW: number;
  chartH: number;
  gap: number;
  candleW: number;
  y: (price: number) => number;
  cx: (i: number) => number;
  segmentToPixel: (index: number, price: number) => { x: number; y: number };
  snapToCandlePoint: (px: number, py: number) => { index: number; price: number };
  windowSlice: (number | string | null)[][];
  fullReversed: (number | string | null)[][];
  startIndex: number;
  windowN: number;
  n: number;
  candleColors: { bull: string; bear: string };
  yTickValues: number[];
  verticalIndicesFiltered: number[];
  dateBreaksFiltered: { index: number; dateStr: string }[];
  dayBreaksFiltered: { index: number; label: string }[];
  showMainAxis: boolean;
  showSecondaryAxis: boolean;
  showLastCloseLine: boolean;
  showLastClose: boolean;
  lastCloseY: number;
  volumeOnPrice: boolean;
  volumeOnPriceOpacity: number;
  lineTableHex: string;
  secondaryGridHex: string;
  lastCloseLineHex: string;
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
  selectedSegmentIndex: number | null;
  setSelectedSegmentIndex: (i: number | null) => void;
  drawMode: boolean;
  drawTool: "line" | "fibonacci" | "select";
  setDrawDragging: React.Dispatch<React.SetStateAction<{ segmentIndex: number; point: 0 | 1 | "extension" } | null>>;
  /** Com mão ativa: arrastar no retângulo (fora de segmento) navega candles. Delta: + = futuro, - = passado. Velocidade limitada no SVG. */
  onSelectToolPan?: (deltaCandles: number) => void;
  /** Chamado quando o usuário clica no gráfico para desenhar (segmento ou Fibonacci), para fechar a caixa de opções. */
  onChartDrawClick?: () => void;
  t: Record<string, string>;
  /** Escala dos textos (indicadores, etc.): 0.6–1 quando o plot está reduzido. */
  textScale?: number;
  /** Quando aplicado, pinta o candle com a cor da estratégia se a condição for verdadeira. */
  strategyCandleOverlays?: StrategyCandleOverlay[];
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
  y,
  cx,
  segmentToPixel,
  snapToCandlePoint,
  windowSlice,
  fullReversed,
  startIndex,
  windowN,
  n,
  candleColors,
  yTickValues,
  verticalIndicesFiltered,
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
  secondaryGridHex,
  lastCloseLineHex,
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
  selectedSegmentIndex,
  setSelectedSegmentIndex,
  drawMode,
  drawTool,
  setDrawDragging,
  onSelectToolPan,
  onChartDrawClick,
  t,
  textScale = 1,
  strategyCandleOverlays = [],
}: KlinesChartSvgProps) {
  const selectPanLastClientX = useRef(0);
  const justPannedRef = useRef(false);
  const [selectPanActive, setSelectPanActive] = useState(false);

  useEffect(() => {
    if (!selectPanActive || !onSelectToolPan) return;
    const PIXELS_PER_CANDLE = 12;
    const MAX_DELTA_PER_MOVE = 4;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      const deltaX = e.clientX - selectPanLastClientX.current;
      selectPanLastClientX.current = e.clientX;
      let deltaCandles = -Math.round(deltaX / PIXELS_PER_CANDLE);
      deltaCandles = Math.max(-MAX_DELTA_PER_MOVE, Math.min(MAX_DELTA_PER_MOVE, deltaCandles));
      if (deltaCandles !== 0) onSelectToolPan(deltaCandles);
    };
    const onUp = () => {
      setSelectPanActive(false);
      justPannedRef.current = true;
    };
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [selectPanActive, onSelectToolPan]);

  const fontSize = Math.round(10 * textScale);
  const fontSizeSmall = Math.round(9 * textScale);
  const fontSizeAxis = Math.round(12 * textScale);
  const volumeOnPriceClipId = useId();
  const showCrosshairValues =
    crosshairPoint !== null &&
    (crosshairPoint.index >= startIndex && crosshairPoint.index < startIndex + windowN || crosshairDragging) &&
    crosshairPoint.index >= 0 &&
    crosshairPoint.index < fullReversed.length;

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
      {panelKey !== "main" && (
        <span
          className="font-medium text-zinc-500 px-1 py-0 rounded shrink-0 leading-tight"
          style={{
            fontSize: `${fontSize}px`,
            backgroundColor: isDarkBg ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)",
            boxShadow: "0 0 3px rgba(0,0,0,0.12)",
          }}
          aria-label={panelKey === "panel2" ? "Panel 2" : panelKey === "panel3" ? "Panel 3" : panelKey === "panel4" ? "Panel 4" : "Panel 5"}
        >
          ({panelKey.replace("panel", "")})
        </span>
      )}
      {lines.map((ind, idx) => {
        const crosshairVal =
          showCrosshairValues && crosshairPoint
            ? (() => {
                const raw = fullReversed[crosshairPoint.index]?.[ind.columnIndex];
                if (raw == null) return null;
                const v = Number(raw);
                if (!Number.isFinite(v)) return null;
                return (ind.type === "RSI" || ind.type === "Stochastic" || ind.type === "WilliamsR") ? v.toFixed(1) : formatYAxis(v);
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
        {showSecondaryAxis && (
          <>
            {verticalIndicesFiltered.map((idx) => (
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
            strokeWidth={1}
            strokeDasharray="2 4"
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
              strokeWidth={1}
              strokeDasharray="4 2"
            />
          ))}
        {(() => {
          const tableTop = MARGIN_TOP + chartH;
          const rowH = 12;
          const labelOffsetDown = 4;
          const yRow1 = tableTop + rowH - 2 + labelOffsetDown;
          const yRow2 = tableTop + rowH + rowH - 2 + labelOffsetDown;
          return (
            <>
              <g className="text-[12px] font-mono" fill={backgroundTextHex}>
                {dayBreaksFiltered.map((b) => {
                  const isDay01 = b.label === "01";
                  const openTimeMs = windowSlice[b.index][0] as number;
                  const x = cx(b.index);
                  if (isDay01) {
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
              {showSecondaryAxis && (
                <g className="font-mono" style={{ fontSize: fontSizeSmall }} fill={secondaryGridHex}>
                  {verticalIndicesFiltered.map((idx) => (
                    <text key={`sec-${idx}`} x={cx(idx)} y={yRow2} textAnchor="middle">
                      {formatTimeLabel(windowSlice[idx][0] as number)}
                    </text>
                  ))}
                </g>
              )}
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
                  {verticalIndicesFiltered.map((idx) => (
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
                  const limitsStrokeWidth = ind.bollingerLimitsLineWidth === "thin" ? 1 : 2;
                  const limitsDash = ind.bollingerLimitsLineStyle === "dotted" ? "2 2" : ind.bollingerLimitsLineStyle === "dashed" ? "6 4" : undefined;
                  const middleColor = ind.color ?? "#6366f1";
                  const middleStrokeWidth = ind.lineWidth === "thin" ? 1 : 2;
                  const middleDash = ind.lineStyle === "dotted" ? "2 2" : ind.lineStyle === "dashed" ? "6 4" : undefined;
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
                const strokeWidth = ind.lineWidth === "thin" ? 1 : 2;
                const strokeDasharray = ind.lineStyle === "dotted" ? "2 2" : ind.lineStyle === "dashed" ? "6 4" : undefined;
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
              {panelLines.filter((ind) => ind.type === "RSI" && ind.rsiCenterLine).map((ind, idx) => {
                const y50 = yPanel(50);
                const cStrokeWidth = ind.rsiCenterLineWidth === "thin" ? 1 : 2;
                const cStrokeDasharray = ind.rsiCenterLineStyle === "dotted" ? "2 2" : ind.rsiCenterLineStyle === "dashed" ? "6 4" : undefined;
                return (
                  <line
                    key={`center-${idx}`}
                    x1={MARGIN_LEFT}
                    y1={y50}
                    x2={MARGIN_LEFT + chartW}
                    y2={y50}
                    stroke={ind.rsiCenterLineColor ?? "#71717a"}
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
                const lStrokeWidth = ind.rsiLimitLineWidth === "thin" ? 1 : 2;
                const lStrokeDasharray = ind.rsiLimitLineStyle === "dotted" ? "2 2" : ind.rsiLimitLineStyle === "dashed" ? "6 4" : undefined;
                const stroke = ind.rsiLimitColor ?? "#dc2626";
                return (
                  <g key={`limits-${idx}`}>
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
                const lStrokeWidth = ind.stochLimitLineWidth === "thin" ? 1 : 2;
                const lStrokeDasharray = ind.stochLimitLineStyle === "dotted" ? "2 2" : ind.stochLimitLineStyle === "dashed" ? "6 4" : undefined;
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
                const lStrokeWidth = ind.williamsRLimitLineWidth === "thin" ? 1 : 2;
                const lStrokeDasharray = ind.williamsRLimitLineStyle === "dotted" ? "2 2" : ind.williamsRLimitLineStyle === "dashed" ? "6 4" : undefined;
                const stroke = ind.williamsRLimitColor ?? "#dc2626";
                return (
                  <g key={`williams-r-limits-${idx}`}>
                    <line x1={MARGIN_LEFT} y1={yUpper} x2={MARGIN_LEFT + chartW} y2={yUpper} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                    <line x1={MARGIN_LEFT} y1={yLower} x2={MARGIN_LEFT + chartW} y2={yLower} stroke={stroke} strokeWidth={lStrokeWidth} strokeDasharray={lStrokeDasharray} />
                  </g>
                );
              })}
            </g>
          );
        })}
        {windowSlice.map((k, i) => {
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
          const strategyColor = strategyCandleOverlays.find((o) => o.results[klinesIndex])?.color;
          const color = strategyColor ?? (bull ? candleColors.bull : candleColors.bear);
          const strokeColor = color === "#f5f5f5" ? "#171717" : color;
          const slotLeft = MARGIN_LEFT + i * gap;
          return (
            <g key={i}>
              <rect x={slotLeft} y={MARGIN_TOP} width={gap} height={chartH} fill="transparent" />
              <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={strokeColor} strokeWidth={1} />
              <rect
                x={x - candleW / 2}
                y={bodyTop}
                width={candleW}
                height={bodyH}
                fill={color}
                stroke={strokeColor}
                strokeWidth={1}
              />
            </g>
          );
        })}
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
            const limitsStrokeWidth = ind.bollingerLimitsLineWidth === "thin" ? 1 : 2;
            const limitsDash = ind.bollingerLimitsLineStyle === "dotted" ? "2 2" : ind.bollingerLimitsLineStyle === "dashed" ? "6 4" : undefined;
            const middleColor = ind.color ?? "#6366f1";
            const middleStrokeWidth = ind.lineWidth === "thin" ? 1 : 2;
            const middleDash = ind.lineStyle === "dotted" ? "2 2" : ind.lineStyle === "dashed" ? "6 4" : undefined;
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
          const strokeWidth = ind.lineWidth === "thin" ? 1 : 2;
          const strokeDasharray = ind.lineStyle === "dotted" ? "2 2" : ind.lineStyle === "dashed" ? "6 4" : undefined;
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
        {volumeOnPrice && (() => {
          const volTop = MARGIN_TOP + (chartH * 2) / 3;
          const volH = chartH / 3;
          const volBottom = volTop + volH;
          const VOL_COL = 5;
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
          const isOverCandle = crosshairPoint.index >= startIndex && crosshairPoint.index < startIndex + windowN;
          const showCrosshair = isOverCandle || crosshairDragging;
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
          const x = cx(localIndex);
          const wickTop = y(highP);
          const bodyBottom = y(Math.min(openP, closeP));
          const tw = 130;
          const lineH = 11;
          const pad = 6;
          const numLines = 11;
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
        {drawingsVisible && drawSegments.map((seg, idx) => {
          const p1 = segmentToPixel(seg.index1, seg.price1);
          const p2 = segmentToPixel(seg.index2, seg.price2);
          const strokeColor = seg.color ?? DEFAULT_SEGMENT_COLOR;
          const isSelected = selectedSegmentIndex === idx;
          const lineW = isSelected ? 2 : 1;

          if (seg.type === "fibonacci") {
            const range = seg.price1 - seg.price2;
            const priceTop = Math.max(seg.price1, seg.price2);
            const priceBottom = Math.min(seg.price1, seg.price2);
            const fibLevels = [
              { k: 1 / 3, label: "33.3%" },
              { k: 0.5, label: "50%" },
              { k: 0.618, label: "61.8%" },
            ] as const;
            const mainW = FIB_STROKE_WIDTH_VALUES[(seg.fibStrokeWidth as FibStrokeWidth) ?? "medium"];
            const w618 = FIB_STROKE_WIDTH_VALUES[(seg.fibLevel618StrokeWidth as FibStrokeWidth) ?? "thin"];
            const yTop = segmentToPixel(seg.index1, priceTop).y;
            const yBottom = segmentToPixel(seg.index1, priceBottom).y;
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const arrowLen = 8;
            const arrowW = 4;
            const tip = p2;
            const backX = tip.x - arrowLen * ux;
            const backY = tip.y - arrowLen * uy;
            const leftX = backX - uy * arrowW;
            const leftY = backY + ux * arrowW;
            const rightX = backX + uy * arrowW;
            const rightY = backY - ux * arrowW;
            const fmt = (v: number) => formatYAxis(v);
            const valueLevels: { price: number; y: number; color: string }[] = [
              { price: priceTop, y: yTop, color: strokeColor },
              ...fibLevels.map(({ k }) => {
                const priceLevel = seg.price2 + range * k;
                const py = segmentToPixel(seg.index1, priceLevel).y;
                const levelColor = k === 0.618 ? (seg.fibLevel618Color ?? strokeColor) : strokeColor;
                return { price: priceLevel, y: py, color: levelColor };
              }),
              { price: priceBottom, y: yBottom, color: strokeColor },
            ];
            const valueLabelOffset = 6;
            const valuePadW = 42;
            const valuePadH = 10;
            const extendIndices = Math.max(0, seg.fibExtensionIndices ?? 0);
            const extendIndex = seg.index2 + extendIndices;
            const extendPx = segmentToPixel(extendIndex, seg.price2).x;
            const midY = (yTop + yBottom) / 2;
            const dashArray = "2 2";
            return (
              <g key={idx}>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={strokeColor} strokeWidth={mainW} strokeDasharray="4 2" />
                <path d={`M ${tip.x} ${tip.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`} fill={strokeColor} stroke={strokeColor} strokeWidth={Math.max(1, mainW - 1)} />
                <line x1={p1.x} y1={yTop} x2={p2.x} y2={yTop} stroke={strokeColor} strokeWidth={mainW} />
                <line x1={p1.x} y1={yBottom} x2={p2.x} y2={yBottom} stroke={strokeColor} strokeWidth={mainW} />
                {extendIndices > 0 && (
                  <>
                    <line x1={p2.x} y1={yTop} x2={extendPx} y2={yTop} stroke={strokeColor} strokeWidth={mainW} strokeDasharray={dashArray} />
                    <line x1={p2.x} y1={yBottom} x2={extendPx} y2={yBottom} stroke={strokeColor} strokeWidth={mainW} strokeDasharray={dashArray} />
                    {fibLevels.map(({ k }) => {
                      const priceLevel = seg.price2 + range * k;
                      const py = segmentToPixel(seg.index1, priceLevel).y;
                      const levelColor = k === 0.618 ? (seg.fibLevel618Color ?? strokeColor) : strokeColor;
                      const levelW = k === 0.618 ? w618 : mainW;
                      return <line key={k} x1={p2.x} y1={py} x2={extendPx} y2={py} stroke={levelColor} strokeWidth={levelW} strokeDasharray={dashArray} />;
                    })}
                  </>
                )}
                {seg.showValues === true && valueLevels.map(({ price, y, color }, i) => (
                  <g key={i}>
                    <rect x={p1.x - valuePadW - valueLabelOffset} y={y - valuePadH / 2} width={valuePadW} height={valuePadH} rx={2} fill="#fff" fillOpacity={0.9} stroke={color} strokeWidth={1} />
                    <text x={p1.x - valueLabelOffset} y={y} textAnchor="end" dominantBaseline="middle" fill={color} className="font-mono select-none" style={{ fontSize: 9 }}>{fmt(price)}</text>
                  </g>
                ))}
                {fibLevels.map(({ k, label }) => {
                  const priceLevel = seg.price2 + range * k;
                  const py = segmentToPixel(seg.index1, priceLevel).y;
                  const levelColor = k === 0.618 ? (seg.fibLevel618Color ?? strokeColor) : strokeColor;
                  const levelW = k === 0.618 ? w618 : mainW;
                  const midX = (p1.x + p2.x) / 2;
                  const labelW = 36;
                  const labelH = 12;
                  return (
                    <g key={k}>
                      <line x1={p1.x} y1={py} x2={p2.x} y2={py} stroke={levelColor} strokeWidth={levelW} />
                      {seg.showPercent !== false && (
                        <>
                          <rect x={midX - labelW / 2} y={py - labelH - 4} width={labelW} height={labelH} rx={2} fill="#fff" fillOpacity={0.9} stroke={levelColor} strokeWidth={1} />
                          <text x={midX} y={py - labelH / 2 - 4} textAnchor="middle" dominantBaseline="middle" fill={levelColor} className="font-mono select-none" style={{ fontSize: 9 }}>{label}</text>
                        </>
                      )}
                    </g>
                  );
                })}
                <g
                  pointerEvents="all"
                  style={{ cursor: "grab" }}
                  onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: idx, point: "extension" }); }}
                  onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: idx, point: "extension" }); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <path d={`M ${extendPx + 5} ${midY} L ${extendPx - 2} ${midY - 4} L ${extendPx - 2} ${midY + 4} Z`} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />
                </g>
              </g>
            );
          }

          const startCap = seg.startCap ?? "none";
          const endCap = seg.endCap ?? "none";
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const arrowLen = 8;
          const arrowW = 4;
          return (
            <g key={idx}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={strokeColor} strokeWidth={lineW} />
              {startCap === "point" && <circle cx={p1.x} cy={p1.y} r={3} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />}
              {endCap === "point" && <circle cx={p2.x} cy={p2.y} r={3} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />}
              {startCap === "arrow" && (() => {
                const tip = p1;
                const u1 = (p1.x - p2.x) / len;
                const u2 = (p1.y - p2.y) / len;
                const backX = tip.x - arrowLen * u1;
                const backY = tip.y - arrowLen * u2;
                const leftX = backX - u2 * arrowW;
                const leftY = backY + u1 * arrowW;
                const rightX = backX + u2 * arrowW;
                const rightY = backY - u1 * arrowW;
                return <path d={`M ${tip.x} ${tip.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />;
              })()}
              {endCap === "arrow" && (() => {
                const tip = p2;
                const backX = tip.x - arrowLen * ux;
                const backY = tip.y - arrowLen * uy;
                const leftX = backX - uy * arrowW;
                const leftY = backY + ux * arrowW;
                const rightX = backX + uy * arrowW;
                const rightY = backY - ux * arrowW;
                return <path d={`M ${tip.x} ${tip.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />;
              })()}
              {seg.showPercent !== false && (() => {
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                const offset = 14;
                const labelX = midX;
                const labelY = midY - offset;
                const percent = seg.price1 !== 0 ? ((seg.price2 - seg.price1) / seg.price1) * 100 : 0;
                const percentStr = percent >= 0 ? `+${percent.toFixed(4)}%` : `${percent.toFixed(4)}%`;
                const i1 = Math.max(0, Math.min(seg.index1, n - 1));
                const i2 = Math.max(0, Math.min(seg.index2, n - 1));
                const openTime1 = fullReversed[i1]?.[0] ?? 0;
                const openTime2 = fullReversed[i2]?.[0] ?? 0;
                const days = Math.round((Number(openTime2) - Number(openTime1)) / MS_PER_DAY);
                const daysStr = `${days}d`;
                const textColor = percent >= 0 ? "#059669" : "#dc2626";
                const padW = 44;
                const padH = 14;
                return (
                  <g>
                    <rect x={labelX - padW} y={labelY - 12} width={padW * 2} height={padH * 2} rx={4} ry={4} fill="#ffffff" fillOpacity={0.8} stroke={textColor} strokeWidth={1} />
                    <text x={labelX} y={labelY} textAnchor="middle" fill={textColor} className="font-medium select-none" style={{ fontSize }}>
                      <tspan x={labelX} dy={0}>{percentStr}</tspan>
                      <tspan x={labelX} dy={11}>{daysStr}</tspan>
                    </text>
                  </g>
                );
              })()}
              {seg.showValues === true && (() => {
                const fmt = (v: number) => formatYAxis(v);
                const v1 = fmt(seg.price1);
                const v2 = fmt(seg.price2);
                const vPadW = 34;
                const vHeight = 16;
                const textBaselineY = -6;
                const textCenterY = textBaselineY - 5;
                const rectY1 = p1.y + textCenterY - vHeight / 2;
                const rectY2 = p2.y + textCenterY - vHeight / 2;
                return (
                  <>
                    <rect x={p1.x - vPadW} y={rectY1} width={vPadW * 2} height={vHeight} rx={3} ry={3} fill="#ffffff" fillOpacity={0.8} stroke={strokeColor} strokeWidth={1} />
                    <text x={p1.x} y={p1.y - 6} textAnchor="middle" fill={strokeColor} className="font-medium select-none" style={{ fontSize }}>{v1}</text>
                    <rect x={p2.x - vPadW} y={rectY2} width={vPadW * 2} height={vHeight} rx={3} ry={3} fill="#ffffff" fillOpacity={0.8} stroke={strokeColor} strokeWidth={1} />
                    <text x={p2.x} y={p2.y - 6} textAnchor="middle" fill={strokeColor} className="font-medium select-none" style={{ fontSize }}>{v2}</text>
                  </>
                );
              })()}
            </g>
          );
        })}
        {drawPending && (() => {
          const p = segmentToPixel(drawPending.index1, drawPending.price1);
          return <circle cx={p.x} cy={p.y} r={4} fill="none" stroke="#000000" strokeWidth={1} />;
        })()}
        {drawMode && (
          <rect
            x={MARGIN_LEFT}
            y={MARGIN_TOP}
            width={chartW}
            height={chartH}
            fill="transparent"
            style={{ cursor: drawTool === "select" ? "pointer" : "crosshair", touchAction: "none" }}
            onPointerDown={(e) => {
              if (drawTool !== "select" || !drawingsVisible || !onSelectToolPan || !chartSvgRef.current) return;
              const svg = chartSvgRef.current;
              const rect = svg.getBoundingClientRect();
              const svgW = svg.width.baseVal.value;
              const svgH = svg.height.baseVal.value;
              const px = (e.clientX - rect.left) * (svgW / rect.width);
              const py = (e.clientY - rect.top) * (svgH / rect.height);
              const HIT_THRESHOLD = 12;
              let bestIdx = -1;
              let bestD = HIT_THRESHOLD;
              drawSegments.forEach((seg, index) => {
                const segP1 = segmentToPixel(seg.index1, seg.price1);
                const segP2 = segmentToPixel(seg.index2, seg.price2);
                const d = distanceToSegment(px, py, segP1.x, segP1.y, segP2.x, segP2.y);
                if (d < bestD) {
                  bestD = d;
                  bestIdx = index;
                }
              });
              if (bestIdx < 0) {
                selectPanLastClientX.current = e.clientX;
                setSelectPanActive(true);
              }
            }}
            onClick={(e) => {
              if (justPannedRef.current) {
                justPannedRef.current = false;
                return;
              }
              if (!chartSvgRef.current) return;
              const svg = chartSvgRef.current;
              const rect = svg.getBoundingClientRect();
              const svgW = svg.width.baseVal.value;
              const svgH = svg.height.baseVal.value;
              const px = (e.nativeEvent.clientX - rect.left) * (svgW / rect.width);
              const py = (e.nativeEvent.clientY - rect.top) * (svgH / rect.height);
              if (drawTool === "select" && drawingsVisible) {
                const HIT_THRESHOLD = 12;
                let bestIdx = -1;
                let bestD = HIT_THRESHOLD;
                drawSegments.forEach((seg, index) => {
                  const segP1 = segmentToPixel(seg.index1, seg.price1);
                  const segP2 = segmentToPixel(seg.index2, seg.price2);
                  const d = distanceToSegment(px, py, segP1.x, segP1.y, segP2.x, segP2.y);
                  if (d < bestD) {
                    bestD = d;
                    bestIdx = index;
                  }
                });
                setSelectedSegmentIndex(bestIdx >= 0 ? bestIdx : null);
                return;
              }
              if (drawTool === "line" || drawTool === "fibonacci") onChartDrawClick?.();
              const d = snapToCandlePoint(px, py);
              if (drawPending === null) {
                setDrawPending({ index1: d.index, price1: d.price });
              } else {
                setDrawSegments((seg) => {
                  const df = drawTool === "fibonacci" ? drawDefaults.fibonacci : drawDefaults.segment;
                  const newSeg = drawTool === "fibonacci"
                    ? ({ index1: drawPending.index1, price1: drawPending.price1, index2: d.index, price2: d.price, type: "fibonacci" as const, color: df.color ?? FIB_DEFAULT_COLOR, fibLevel618Color: df.fibLevel618Color ?? FIB_DEFAULT_618_COLOR, showPercent: df.showPercent ?? false, showValues: df.showValues ?? false, fibStrokeWidth: df.fibStrokeWidth ?? "medium", fibLevel618StrokeWidth: df.fibLevel618StrokeWidth ?? "thin" })
                    : ({ index1: drawPending.index1, price1: drawPending.price1, index2: d.index, price2: d.price, startCap: df.startCap ?? "point", endCap: df.endCap ?? "arrow", showPercent: df.showPercent ?? true, showValues: df.showValues ?? false, color: df.color ?? DEFAULT_SEGMENT_COLOR });
                  return [...seg, newSeg];
                });
                setDrawPending(null);
              }
            }}
          />
        )}
        {drawingsVisible && drawMode && selectedSegmentIndex !== null && drawSegments[selectedSegmentIndex] && (() => {
          const seg = drawSegments[selectedSegmentIndex];
          const h1 = segmentToPixel(seg.index1, seg.price1);
          const h2 = segmentToPixel(seg.index2, seg.price2);
          const handleColor = seg.color ?? DEFAULT_SEGMENT_COLOR;
          const isFib = seg.type === "fibonacci";
          const fibExtendPx = isFib ? segmentToPixel(seg.index2 + Math.max(0, seg.fibExtensionIndices ?? 0), seg.price2).x : 0;
          const fibMidY = isFib ? (segmentToPixel(seg.index1, Math.max(seg.price1, seg.price2)).y + segmentToPixel(seg.index1, Math.min(seg.price1, seg.price2)).y) / 2 : 0;
          return (
            <g pointerEvents="all">
              <circle
                cx={h1.x}
                cy={h1.y}
                r={5}
                fill="transparent"
                stroke="none"
                style={{ cursor: "grab" }}
                onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 0 }); }}
                onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 0 }); }}
                onClick={(e) => e.stopPropagation()}
              />
              <circle cx={h1.x} cy={h1.y} r={3} fill={handleColor} stroke={handleColor} strokeWidth={1} pointerEvents="none" />
              <circle
                cx={h2.x}
                cy={h2.y}
                r={5}
                fill="transparent"
                stroke="none"
                style={{ cursor: "grab" }}
                onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 1 }); }}
                onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 1 }); }}
                onClick={(e) => e.stopPropagation()}
              />
              <circle cx={h2.x} cy={h2.y} r={3} fill={handleColor} stroke={handleColor} strokeWidth={1} pointerEvents="none" />
              {isFib && (
                <g
                  style={{ cursor: "grab" }}
                  title={t.fibExtensionDrag ?? "Arrastar para estender"}
                  aria-label={t.fibExtensionDrag ?? "Arrastar para estender"}
                  onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "extension" }); }}
                  onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "extension" }); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <rect x={fibExtendPx - 12} y={fibMidY - 10} width={26} height={20} fill="transparent" stroke="none" />
                  <path d={`M ${fibExtendPx + 5} ${fibMidY} L ${fibExtendPx - 2} ${fibMidY - 4} L ${fibExtendPx - 2} ${fibMidY + 4} Z`} fill={handleColor} stroke={handleColor} strokeWidth={1} pointerEvents="none" />
                </g>
              )}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
