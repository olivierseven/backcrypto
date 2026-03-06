"use client";

/**
 * Eixo Y (USDT) à direita do gráfico: ticks, último fechamento, valores dos indicadores, marcador do crosshair.
 */
import { Y_AXIS_WIDTH } from "../KlinesChartConstants";
import type { ChartIndicatorLine } from "./types";

export interface KlinesChartYAxisProps {
  chartHeight: number;
  yTickValues: number[];
  y: (price: number) => number;
  formatYAxis: (v: number) => string;
  /** Formatação para valores grandes em painéis (ex.: MACD). */
  formatPanelValue?: (v: number) => string;
  /** Formatação só para OBV no eixo Y: /1000, vírgula, "k" (ex.: -176,33k). */
  formatObvValue?: (v: number) => string;
  footerYAxisTextHex: string;
  isDarkFooterYAxis: boolean;
  footerYAxisHex: string;
  lineTableHex: string;
  yAxisAbbreviated: boolean;
  hasPanel2: boolean;
  hasPanel3: boolean;
  hasPanel4: boolean;
  hasPanel5: boolean;
  panelExtents: Record<"panel2" | "panel3" | "panel4" | "panel5", { min: number; max: number }>;
  yRsiPanel2: (v: number) => number;
  yRsiPanel3: (v: number) => number;
  yRsiPanel4: (v: number) => number;
  yRsiPanel5: (v: number) => number;
  yRsiByPanel: (val: number, panel: "panel2" | "panel3" | "panel4" | "panel5") => number;
  showLastClose: boolean;
  lastCloseY: number;
  lastClose: number;
  lastCloseTextHex: string;
  showIndicatorLastValueOnYAxis: boolean;
  indicatorLines: ChartIndicatorLine[];
  klines: unknown[][];
  n: number;
  getPanel: (ind: ChartIndicatorLine) => "main" | "panel2" | "panel3" | "panel4" | "panel5";
  yMin: number;
  yMax: number;
  crosshairPoint: { index: number; price: number; panelClickY?: number; panelValue?: number } | null;
  startIndex: number;
  windowN: number;
  crosshairDragging: boolean;
  /** Volume no preço: etiqueta no eixo Y com valor atual (Y em px, valor formatado, cor da última vela). */
  volumeOnPrice?: boolean;
  volumeLabelY?: number;
  volumeLabelValue?: string;
  volumeLabelColor?: string;
  /** Escala dos textos do eixo Y: 0.6–1 quando o plot está reduzido. */
  textScale?: number;
}

export function KlinesChartYAxis({
  chartHeight,
  yTickValues,
  y,
  formatYAxis,
  formatPanelValue,
  formatObvValue,
  footerYAxisTextHex,
  isDarkFooterYAxis,
  footerYAxisHex,
  lineTableHex,
  yAxisAbbreviated,
  hasPanel2,
  hasPanel3,
  hasPanel4,
  hasPanel5,
  panelExtents,
  yRsiPanel2,
  yRsiPanel3,
  yRsiPanel4,
  yRsiPanel5,
  yRsiByPanel,
  showLastClose,
  lastCloseY,
  lastClose,
  lastCloseTextHex,
  showIndicatorLastValueOnYAxis,
  indicatorLines,
  klines,
  n,
  getPanel,
  yMin,
  yMax,
  crosshairPoint,
  startIndex,
  windowN,
  crosshairDragging,
  volumeOnPrice,
  volumeLabelY,
  volumeLabelValue,
  volumeLabelColor,
  textScale = 1,
}: KlinesChartYAxisProps) {
  const fontSize = Math.round(10 * textScale);
  const boxWidth = yAxisAbbreviated ? 46 : 56;
  const boxX = Y_AXIS_WIDTH - 52;
  const boxXLong = Y_AXIS_WIDTH - 62;

  return (
    <div className="flex-shrink-0 border-l border-zinc-200" style={{ backgroundColor: footerYAxisHex }}>
      <svg width={Y_AXIS_WIDTH} height={chartHeight} className="font-mono" style={{ fontSize }}>
        {yTickValues.map((v, i) => (
          <text key={i} x={6} y={y(v) + 4} textAnchor="start" fill={footerYAxisTextHex}>
            {formatYAxis(v)}
          </text>
        ))}
        {hasPanel2 &&
          (() => {
            const { min, max } = panelExtents.panel2;
            const r = max - min || 1;
            const ticks = [min, min + r * 0.25, min + r * 0.5, min + r * 0.75, max];
            const isObvPanel = indicatorLines.some((ind) => getPanel(ind) === "panel2" && ind.type === "OBV");
            const fmt = (val: number) =>
              val >= 0 && val <= 100 && val === Math.round(val)
                ? String(val)
                : isObvPanel && formatObvValue
                  ? formatObvValue(val)
                  : (formatPanelValue ? formatPanelValue(val) : formatYAxis(val));
            return ticks.map((v) => (
              <text key={`p2-${v}`} x={6} y={yRsiPanel2(v) + 4} textAnchor="start" className="font-mono" style={{ fontSize }} fill={footerYAxisTextHex}>
                {fmt(v)}
              </text>
            ));
          })()}
        {hasPanel3 &&
          (() => {
            const { min, max } = panelExtents.panel3;
            const r = max - min || 1;
            const ticks = [min, min + r * 0.25, min + r * 0.5, min + r * 0.75, max];
            const isObvPanel = indicatorLines.some((ind) => getPanel(ind) === "panel3" && ind.type === "OBV");
            const fmt = (val: number) =>
              val >= 0 && val <= 100 && val === Math.round(val)
                ? String(val)
                : isObvPanel && formatObvValue
                  ? formatObvValue(val)
                  : (formatPanelValue ? formatPanelValue(val) : formatYAxis(val));
            return ticks.map((v) => (
              <text key={`p3-${v}`} x={6} y={yRsiPanel3(v) + 4} textAnchor="start" className="font-mono" style={{ fontSize }} fill={footerYAxisTextHex}>
                {fmt(v)}
              </text>
            ));
          })()}
        {hasPanel4 &&
          (() => {
            const { min, max } = panelExtents.panel4;
            const r = max - min || 1;
            const ticks = [min, min + r * 0.25, min + r * 0.5, min + r * 0.75, max];
            const isObvPanel = indicatorLines.some((ind) => getPanel(ind) === "panel4" && ind.type === "OBV");
            const fmt = (val: number) =>
              val >= 0 && val <= 100 && val === Math.round(val)
                ? String(val)
                : isObvPanel && formatObvValue
                  ? formatObvValue(val)
                  : (formatPanelValue ? formatPanelValue(val) : formatYAxis(val));
            return ticks.map((v) => (
              <text key={`p4-${v}`} x={6} y={yRsiPanel4(v) + 4} textAnchor="start" className="font-mono" style={{ fontSize }} fill={footerYAxisTextHex}>
                {fmt(v)}
              </text>
            ));
          })()}
        {hasPanel5 &&
          (() => {
            const { min, max } = panelExtents.panel5;
            const r = max - min || 1;
            const ticks = [min, min + r * 0.25, min + r * 0.5, min + r * 0.75, max];
            const isObvPanel = indicatorLines.some((ind) => getPanel(ind) === "panel5" && ind.type === "OBV");
            const fmt = (val: number) =>
              val >= 0 && val <= 100 && val === Math.round(val)
                ? String(val)
                : isObvPanel && formatObvValue
                  ? formatObvValue(val)
                  : (formatPanelValue ? formatPanelValue(val) : formatYAxis(val));
            return ticks.map((v) => (
              <text key={`p5-${v}`} x={6} y={yRsiPanel5(v) + 4} textAnchor="start" className="font-mono" style={{ fontSize }} fill={footerYAxisTextHex}>
                {fmt(v)}
              </text>
            ));
          })()}
        {volumeOnPrice && volumeLabelValue != null && volumeLabelY != null && volumeLabelColor != null && (
          <g>
            <rect
              x={yAxisAbbreviated ? boxX : boxXLong}
              y={volumeLabelY - 7}
              width={yAxisAbbreviated ? 46 : 56}
              height={14}
              fill="white"
              fillOpacity={0.8}
              stroke={isDarkFooterYAxis ? "#52525b" : "#e4e4e7"}
              strokeWidth={1}
              rx={2}
            />
            <text x={6} y={volumeLabelY + 4} textAnchor="start" className="font-mono font-medium" style={{ fontSize }} fill={volumeLabelColor}>
              {volumeLabelValue}
            </text>
          </g>
        )}
        {showLastClose && (
          <g>
            <rect
              x={yAxisAbbreviated ? boxX : boxXLong}
              y={lastCloseY - 7}
              width={yAxisAbbreviated ? 46 : 56}
              height={14}
              fill={isDarkFooterYAxis ? "#3f3f46" : "white"}
              stroke={isDarkFooterYAxis ? "#52525b" : "#e4e4e7"}
              strokeWidth={1}
              rx={2}
            />
            <text x={6} y={lastCloseY + 4} textAnchor="start" className="font-semibold" style={{ fontSize }} fill={lastCloseTextHex}>
              {formatYAxis(lastClose)}
            </text>
          </g>
        )}
        {showIndicatorLastValueOnYAxis &&
          indicatorLines.map((ind, indIdx) => {
            const lastVal =
              n > 0
                ? (() => {
                    const v = klines[0][ind.columnIndex];
                    if (v == null) return null;
                    const num = typeof v === "number" ? v : Number(v);
                    return Number.isFinite(num) ? num : null;
                  })()
                : null;
            if (lastVal == null) return null;
            const panelKey = getPanel(ind);
            const lastValY =
              panelKey === "main" ? y(lastVal) : yRsiByPanel(lastVal, panelKey === "panel2" || panelKey === "panel3" || panelKey === "panel4" || panelKey === "panel5" ? panelKey : "panel2");
            const ext = panelKey === "main" ? null : panelExtents[panelKey];
            const inRange =
              panelKey === "main" ? lastVal >= yMin && lastVal <= yMax : ext != null && lastVal >= ext.min && lastVal <= ext.max;
            if (!inRange) return null;
            const isVolumeStyle = ind.type === "Volume";
            const textColor = isVolumeStyle
              ? (() => {
                  const openRaw = n > 0 ? klines[0][1] : null;
                  const closeRaw = n > 0 ? klines[0][4] : null;
                  const open = openRaw != null ? (typeof openRaw === "string" ? parseFloat(openRaw) : Number(openRaw)) : NaN;
                  const close = closeRaw != null ? (typeof closeRaw === "string" ? parseFloat(closeRaw) : Number(closeRaw)) : NaN;
                  const lastCandleUp = Number.isFinite(open) && Number.isFinite(close) && close >= open;
                  return lastCandleUp ? (ind.histogramColorAbove ?? "#10b981") : (ind.histogramColorBelow ?? "#ef4444");
                })()
              : ind.display === "histogram"
                ? lastVal >= 0
                  ? (ind.histogramColorAbove ?? "#059669")
                  : (ind.histogramColorBelow ?? "#dc2626")
                : ind.color;
            return (
              <g key={indIdx}>
                <rect
                  x={yAxisAbbreviated ? boxX : boxXLong}
                  y={lastValY - 7}
                  width={yAxisAbbreviated ? 46 : 56}
                  height={14}
                  fill="white"
                  fillOpacity={isVolumeStyle ? 0.8 : 0.9}
                  stroke="#e4e4e7"
                  strokeWidth={1}
                  rx={2}
                />
                <text
                  x={6}
                  y={lastValY + 4}
                  textAnchor="start"
                  className="font-semibold font-mono"
                  style={{ fontSize }}
                  fill={textColor}
                >
                  {panelKey === "main"
                    ? formatYAxis(lastVal)
                    : ind.type === "Volume"
                      ? (formatPanelValue ? formatPanelValue(lastVal) : formatYAxis(lastVal))
                      : ind.type === "OBV" && formatObvValue
                        ? formatObvValue(lastVal)
                        : lastVal >= 0 && lastVal <= 100 && lastVal === Math.round(lastVal)
                          ? lastVal.toFixed(1)
                          : (formatPanelValue ? formatPanelValue(lastVal) : formatYAxis(lastVal))}
                </text>
              </g>
            );
          })}
        {crosshairPoint !== null &&
          (crosshairPoint.index >= startIndex && crosshairPoint.index < startIndex + windowN || crosshairDragging) &&
          (() => {
            const crossY = crosshairPoint.panelClickY != null ? crosshairPoint.panelClickY : y(crosshairPoint.price);
            const isPanelValue = crosshairPoint.panelValue != null;
            const displayValue = isPanelValue ? crosshairPoint.panelValue! : crosshairPoint.price;
            const valueStr = isPanelValue && displayValue >= 0 && displayValue <= 100 ? displayValue.toFixed(1) : formatYAxis(displayValue);
            const pctVsLast = !isPanelValue && lastClose > 0 ? ((crosshairPoint.price - lastClose) / lastClose) * 100 : null;
            const pctStr = pctVsLast != null ? (pctVsLast >= 0 ? `+${pctVsLast.toFixed(2)}%` : pctVsLast.toFixed(2) + "%") : null;
            const pctColor = pctVsLast != null && pctVsLast >= 0 ? "#059669" : "#dc2626";
            const boxH = pctStr != null ? 28 : 16;
            const boxY = crossY - 8;
            return (
              <g>
                <rect
                  x={yAxisAbbreviated ? boxX : boxXLong}
                  y={boxY}
                  width={yAxisAbbreviated ? 46 : 56}
                  height={boxH}
                  fill={isDarkFooterYAxis ? "#3f3f46" : "white"}
                  stroke={lineTableHex}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  rx={2}
                />
                <text x={6} y={crossY + 4} textAnchor="start" className="font-mono font-medium" style={{ fontSize }} fill={footerYAxisTextHex}>
                  {valueStr}
                </text>
                {pctStr != null && (
                  <text x={6} y={crossY + 15} textAnchor="start" className="font-mono" style={{ fontSize }} fill={pctColor}>
                    {pctStr}
                  </text>
                )}
              </g>
            );
          })()}
      </svg>
    </div>
  );
}
