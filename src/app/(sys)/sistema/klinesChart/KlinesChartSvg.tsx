"use client";

/**
 * SVG do gráfico de candles: faixa de indicadores, grade, candles, crosshair, tooltip OHLC, segmentos e overlay de desenho.
 */
import type { RefObject } from "react";
import { MARGIN_LEFT, MARGIN_TOP, Y_AXIS_WIDTH, INDICATOR_STRIP_HEIGHT, INDICATOR_STRIP_OFFSET_UP } from "../KlinesChartConstants";
import { parseNum } from "../klinesFormatters";
import { formatTimeLabel, formatDateLabel, formatDateYyyyMmDd, formatMonthOnly, formatAbbreviated } from "../klinesFormatters";
import { distanceToSegment, DEFAULT_SEGMENT_COLOR } from "../KlinesChartDrawing";
import type { DrawSegment } from "../KlinesChartDrawing";
import type { ChartIndicatorLine } from "./types";
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
  lineTableHex: string;
  secondaryGridHex: string;
  lastCloseLineHex: string;
  chartBgHex: string;
  backgroundTextHex: string;
  formatYAxis: (v: number) => string;
  hasPanel2: boolean;
  hasPanel3: boolean;
  hasPanel4: boolean;
  panel2Top: number;
  panel3Top: number;
  panel4Top: number;
  panelTop: (p: "panel2" | "panel3" | "panel4") => number;
  panelHeight: (p: "panel2" | "panel3" | "panel4") => number;
  panelExtents: Record<"panel2" | "panel3" | "panel4", { min: number; max: number }>;
  indicatorLines: ChartIndicatorLine[];
  getPanel: (ind: ChartIndicatorLine) => "main" | "panel2" | "panel3" | "panel4";
  yValInPanel: (val: number, top: number, h: number, pMin: number, pMax: number) => number;
  hasIndicatorStrip: boolean;
  isDarkBg: boolean;
  crosshairPoint: { index: number; price: number } | null;
  crosshairDragging: boolean;
  setCrosshairPoint: (p: { index: number; price: number } | null) => void;
  setCrosshairDragging: (v: boolean) => void;
  onCrosshairMouseDown: (px: number, py: number) => void;
  drawSegments: DrawSegment[];
  setDrawSegments: React.Dispatch<React.SetStateAction<DrawSegment[]>>;
  drawPending: { index1: number; price1: number } | null;
  setDrawPending: (p: { index1: number; price1: number } | null) => void;
  selectedSegmentIndex: number | null;
  setSelectedSegmentIndex: (i: number | null) => void;
  drawMode: boolean;
  drawTool: "line" | "select";
  setDrawDragging: React.Dispatch<React.SetStateAction<{ segmentIndex: number; point: 0 | 1 } | null>>;
  t: Record<string, string>;
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
  lineTableHex,
  secondaryGridHex,
  lastCloseLineHex,
  chartBgHex,
  backgroundTextHex,
  formatYAxis,
  hasPanel2,
  hasPanel3,
  hasPanel4,
  panel2Top,
  panel3Top,
  panel4Top,
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
  onCrosshairMouseDown,
  drawSegments,
  setDrawSegments,
  drawPending,
  setDrawPending,
  selectedSegmentIndex,
  setSelectedSegmentIndex,
  drawMode,
  drawTool,
  setDrawDragging,
  t,
}: KlinesChartSvgProps) {
  const handleCrosshairRectMouseDown = (e: React.MouseEvent<SVGRectElement>) => {
    const overlay = crosshairOverlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const px = MARGIN_LEFT + (e.clientX - rect.left) * (chartW / (rect.width || 1));
    const py = MARGIN_TOP + (e.clientY - rect.top) * (chartH / (rect.height || 1));
    onCrosshairMouseDown(px, py);
  };

  const showCrosshairValues =
    crosshairPoint !== null &&
    (crosshairPoint.index >= startIndex && crosshairPoint.index < startIndex + windowN || crosshairDragging) &&
    crosshairPoint.index >= 0 &&
    crosshairPoint.index < fullReversed.length;

  const strip = (panelKey: "main" | "panel2" | "panel3" | "panel4", topY: number, lines: ChartIndicatorLine[]) => (
    <div
      key={panelKey}
      className="absolute left-0 z-10 flex items-center gap-2 flex-wrap pointer-events-none"
      style={{
        top: topY === 0 ? 0 : topY - INDICATOR_STRIP_OFFSET_UP,
        height: INDICATOR_STRIP_HEIGHT,
        width,
        paddingLeft: MARGIN_LEFT,
        paddingTop: 2,
      }}
      role="list"
      aria-label={t.indicatorsOnChart ?? "Indicadores no gráfico"}
    >
      {lines.map((ind, idx) => {
        const crosshairVal =
          showCrosshairValues && crosshairPoint
            ? (() => {
                const raw = fullReversed[crosshairPoint.index]?.[ind.columnIndex];
                if (raw == null) return null;
                const v = Number(raw);
                if (!Number.isFinite(v)) return null;
                return ind.type === "RSI" ? v.toFixed(1) : formatYAxis(v);
              })()
            : null;
        return (
          <span
            key={idx}
            className="flex items-center gap-1.5 text-[10px] font-light px-1.5 py-0.5 rounded"
            style={{
              color: ind.color,
              backgroundColor: isDarkBg ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)",
              boxShadow: "0 0 4px rgba(0,0,0,0.15)",
            }}
            role="listitem"
          >
            <span className="w-2 h-0.5 rounded-full shrink-0" style={{ backgroundColor: ind.color }} aria-hidden />
            <span>{ind.shortLabel ?? ind.label ?? `Ind ${idx + 1}`}</span>
            {crosshairVal != null && <span className="font-mono opacity-90">{crosshairVal}</span>}
          </span>
        );
      })}
    </div>
  );

  const mainLines = indicatorLines.filter((ind) => getPanel(ind) === "main");

  return (
    <div className="flex flex-shrink-0 relative" style={{ width: width + Y_AXIS_WIDTH }}>
      {hasIndicatorStrip && (
        <>
          {mainLines.length > 0 && strip("main", 0, mainLines)}
          {hasPanel2 && strip("panel2", panel2Top, indicatorLines.filter((ind) => getPanel(ind) === "panel2"))}
          {hasPanel3 && strip("panel3", panel3Top, indicatorLines.filter((ind) => getPanel(ind) === "panel3"))}
          {hasPanel4 && strip("panel4", panel4Top, indicatorLines.filter((ind) => getPanel(ind) === "panel4"))}
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
                        className="text-[12px] font-mono"
                        fill={backgroundTextHex}
                        transform={`rotate(-45, ${x}, ${yRow1})`}
                      >
                        {formatMonthOnly(openTimeMs)}
                      </text>
                    );
                  }
                  return (
                    <text key={b.index} x={x} y={yRow1} textAnchor="middle">
                      {b.label}
                    </text>
                  );
                })}
              </g>
              {showSecondaryAxis && (
                <g className="text-[9px] font-mono" fill={secondaryGridHex}>
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
        {(["panel2", "panel3", "panel4"] as const).map((panelId) => {
          const hasPanel = panelId === "panel2" ? hasPanel2 : panelId === "panel3" ? hasPanel3 : hasPanel4;
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
                  const v = windowSlice[i][col];
                  if (v != null && typeof v === "number" && Number.isFinite(v)) points.push({ i, val: v });
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
          const color = bull ? candleColors.bull : candleColors.bear;
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
          const points: { i: number; val: number }[] = [];
          for (let i = 0; i < windowSlice.length; i++) {
            const v = windowSlice[i][col];
            if (v != null && typeof v === "number" && Number.isFinite(v)) points.push({ i, val: v });
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
        {crosshairPoint && (() => {
          const isOverCandle = crosshairPoint.index >= startIndex && crosshairPoint.index < startIndex + windowN;
          const showCrosshair = isOverCandle || crosshairDragging;
          if (!showCrosshair) return null;
          let crossX = segmentToPixel(crosshairPoint.index, crosshairPoint.price).x;
          let crossY = y(crosshairPoint.price);
          if (crosshairDragging) {
            crossX = Math.max(MARGIN_LEFT, Math.min(MARGIN_LEFT + chartW, crossX));
            crossY = Math.max(MARGIN_TOP, Math.min(MARGIN_TOP + chartH, crossY));
          }
          const tableTop = MARGIN_TOP + chartH;
          const openTimeMs = crosshairPoint.index >= 0 && crosshairPoint.index < n ? Number(fullReversed[crosshairPoint.index][0]) : null;
          const boxPad = 6;
          const lineH = 10;
          const boxW = 72;
          const boxH = lineH * 2 + boxPad * 2;
          const boxX = Math.max(MARGIN_LEFT, Math.min(MARGIN_LEFT + chartW - boxW, crossX - boxW / 2));
          const boxY = tableTop + 2;
          return (
            <g pointerEvents="none">
              <line x1={crossX} y1={MARGIN_TOP} x2={crossX} y2={tableTop} stroke={lineTableHex} strokeWidth={1} strokeDasharray="4 2" />
              <line x1={MARGIN_LEFT} y1={crossY} x2={MARGIN_LEFT + chartW} y2={crossY} stroke={lineTableHex} strokeWidth={1} strokeDasharray="4 2" />
              <circle cx={crossX} cy={crossY} r={3} fill={lineTableHex} stroke="none" />
              {openTimeMs != null && (
                <g>
                  <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={2} fill="#000000" fillOpacity={0.8} />
                  <text x={boxX + boxW / 2} y={boxY + boxPad + lineH - 1} textAnchor="middle" className="text-[10px] font-mono" fill="#ffffff">
                    {formatDateYyyyMmDd(openTimeMs)}
                  </text>
                  <text x={boxX + boxW / 2} y={boxY + boxPad + lineH * 2 - 1} textAnchor="middle" className="text-[10px] font-mono" fill="#ffffff">
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
              <text x={tx + pad} y={y1} className="text-[10px] font-mono" fill="#171717">{t.date}: {formatDateLabel(openTimeMs)}</text>
              <text x={tx + pad} y={y1 + lineH} className="text-[10px] font-mono" fill="#171717">{t.time}: {formatTimeLabel(openTimeMs)}</text>
              <text x={tx + pad} y={y1 + lineH * 2} className="text-[10px] font-mono font-medium" fill="#171717">{t.open}: {fmt(openP)}</text>
              <text x={tx + pad} y={y1 + lineH * 3} className="text-[10px] font-mono" fill="#171717">{t.high}: {fmt(highP)}</text>
              <text x={tx + pad} y={y1 + lineH * 4} className="text-[10px] font-mono" fill="#171717">{t.low}: {fmt(lowP)}</text>
              <text x={tx + pad} y={y1 + lineH * 5} className="text-[10px] font-mono" fill="#171717">{t.close}: {fmt(closeP)}</text>
              <text x={tx + pad} y={y1 + lineH * 6} className="text-[10px] font-mono" fill={blue}>{t.amplitude}: {fmt(amplitude)}</text>
              <text x={tx + pad} y={y1 + lineH * 7} className="text-[10px] font-mono" fill={blue}>{t.amplitudeVar}: {amplitudePct.toFixed(2)}%</text>
              <text x={tx + pad} y={y1 + lineH * 8} className="text-[10px] font-mono" fill={pctVsPrev >= 0 ? green : red}>{t.vsPrevClose} {pctVsPrevStr}</text>
              <text x={tx + pad} y={y1 + lineH * 9} className="text-[10px] font-mono" fill="#171717">{t.volumeBtc}: {formatAbbreviated(volume)}</text>
              <text x={tx + pad} y={y1 + lineH * 10} className="text-[10px] font-mono" fill="#171717">{t.volUsdt}: {formatAbbreviated(volumeUsdt)}</text>
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
            style={{ cursor: crosshairDragging ? "grabbing" : crosshairPoint !== null ? "grab" : "crosshair" }}
            onMouseDown={handleCrosshairRectMouseDown}
          />
        )}
        {drawSegments.map((seg, idx) => {
          const p1 = segmentToPixel(seg.index1, seg.price1);
          const p2 = segmentToPixel(seg.index2, seg.price2);
          const strokeColor = seg.color ?? DEFAULT_SEGMENT_COLOR;
          const startCap = seg.startCap ?? "none";
          const endCap = seg.endCap ?? "none";
          const isSelected = selectedSegmentIndex === idx;
          const lineW = isSelected ? 2 : 1;
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
                const offset = 12;
                const labelX = midX + uy * offset;
                const labelY = midY - ux * offset;
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
                    <text x={labelX} y={labelY} textAnchor="middle" fill={textColor} className="text-[10px] font-medium select-none" style={{ fontSize: 10 }}>
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
                    <text x={p1.x} y={p1.y - 6} textAnchor="middle" fill={strokeColor} className="text-[10px] font-medium select-none" style={{ fontSize: 10 }}>{v1}</text>
                    <rect x={p2.x - vPadW} y={rectY2} width={vPadW * 2} height={vHeight} rx={3} ry={3} fill="#ffffff" fillOpacity={0.8} stroke={strokeColor} strokeWidth={1} />
                    <text x={p2.x} y={p2.y - 6} textAnchor="middle" fill={strokeColor} className="text-[10px] font-medium select-none" style={{ fontSize: 10 }}>{v2}</text>
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
            style={{ cursor: drawTool === "select" ? "pointer" : "crosshair" }}
            onClick={(e) => {
              if (!chartSvgRef.current) return;
              const svg = chartSvgRef.current;
              const rect = svg.getBoundingClientRect();
              const svgW = svg.width.baseVal.value;
              const svgH = svg.height.baseVal.value;
              const px = (e.nativeEvent.clientX - rect.left) * (svgW / rect.width);
              const py = (e.nativeEvent.clientY - rect.top) * (svgH / rect.height);
              if (drawTool === "select") {
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
              const d = snapToCandlePoint(px, py);
              if (drawPending === null) {
                setDrawPending({ index1: d.index, price1: d.price });
              } else {
                setDrawSegments((seg) => [...seg, { index1: drawPending.index1, price1: drawPending.price1, index2: d.index, price2: d.price, startCap: "point", endCap: "arrow", showPercent: true }]);
                setDrawPending(null);
              }
            }}
          />
        )}
        {drawMode && selectedSegmentIndex !== null && drawSegments[selectedSegmentIndex] && (() => {
          const seg = drawSegments[selectedSegmentIndex];
          const h1 = segmentToPixel(seg.index1, seg.price1);
          const h2 = segmentToPixel(seg.index2, seg.price2);
          const handleColor = seg.color ?? DEFAULT_SEGMENT_COLOR;
          return (
            <g pointerEvents="all">
              <circle
                cx={h1.x}
                cy={h1.y}
                r={2.5}
                fill={handleColor}
                stroke={handleColor}
                strokeWidth={1}
                style={{ cursor: "grab" }}
                onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 0 }); }}
                onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 0 }); }}
                onClick={(e) => e.stopPropagation()}
              />
              <circle
                cx={h2.x}
                cy={h2.y}
                r={2.5}
                fill={handleColor}
                stroke={handleColor}
                strokeWidth={1}
                style={{ cursor: "grab" }}
                onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 1 }); }}
                onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 1 }); }}
                onClick={(e) => e.stopPropagation()}
              />
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
