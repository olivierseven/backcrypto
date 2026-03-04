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
  footerYAxisTextHex: string;
  isDarkFooterYAxis: boolean;
  footerYAxisHex: string;
  lineTableHex: string;
  yAxisAbbreviated: boolean;
  hasPanel2: boolean;
  hasPanel3: boolean;
  hasPanel4: boolean;
  panelExtents: Record<"panel2" | "panel3" | "panel4", { min: number; max: number }>;
  yRsiPanel2: (v: number) => number;
  yRsiPanel3: (v: number) => number;
  yRsiPanel4: (v: number) => number;
  yRsiByPanel: (val: number, panel: "panel2" | "panel3" | "panel4") => number;
  showLastClose: boolean;
  lastCloseY: number;
  lastClose: number;
  lastCloseTextHex: string;
  showIndicatorLastValueOnYAxis: boolean;
  indicatorLines: ChartIndicatorLine[];
  klines: unknown[][];
  n: number;
  getPanel: (ind: ChartIndicatorLine) => "main" | "panel2" | "panel3" | "panel4";
  yMin: number;
  yMax: number;
  crosshairPoint: { index: number; price: number } | null;
  startIndex: number;
  windowN: number;
  crosshairDragging: boolean;
}

export function KlinesChartYAxis({
  chartHeight,
  yTickValues,
  y,
  formatYAxis,
  footerYAxisTextHex,
  isDarkFooterYAxis,
  footerYAxisHex,
  lineTableHex,
  yAxisAbbreviated,
  hasPanel2,
  hasPanel3,
  hasPanel4,
  panelExtents,
  yRsiPanel2,
  yRsiPanel3,
  yRsiPanel4,
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
}: KlinesChartYAxisProps) {
  const boxWidth = yAxisAbbreviated ? 46 : 56;
  const boxX = Y_AXIS_WIDTH - 52;
  const boxXLong = Y_AXIS_WIDTH - 62;

  return (
    <div className="flex-shrink-0 border-l border-zinc-200" style={{ backgroundColor: footerYAxisHex }}>
      <svg width={Y_AXIS_WIDTH} height={chartHeight} className="text-[10px] font-mono">
        {yTickValues.map((v, i) => (
          <text key={i} x={Y_AXIS_WIDTH - 6} y={y(v) + 4} textAnchor="end" fill={footerYAxisTextHex}>
            {formatYAxis(v)}
          </text>
        ))}
        {hasPanel2 &&
          (() => {
            const { min, max } = panelExtents.panel2;
            const r = max - min || 1;
            const ticks = [min, min + r * 0.25, min + r * 0.5, min + r * 0.75, max];
            return ticks.map((v) => (
              <text key={`p2-${v}`} x={Y_AXIS_WIDTH - 6} y={yRsiPanel2(v) + 4} textAnchor="end" className="text-[10px] font-mono" fill={footerYAxisTextHex}>
                {v >= 0 && v <= 100 && v === Math.round(v) ? v : formatYAxis(v)}
              </text>
            ));
          })()}
        {hasPanel3 &&
          (() => {
            const { min, max } = panelExtents.panel3;
            const r = max - min || 1;
            const ticks = [min, min + r * 0.25, min + r * 0.5, min + r * 0.75, max];
            return ticks.map((v) => (
              <text key={`p3-${v}`} x={Y_AXIS_WIDTH - 6} y={yRsiPanel3(v) + 4} textAnchor="end" className="text-[10px] font-mono" fill={footerYAxisTextHex}>
                {v >= 0 && v <= 100 && v === Math.round(v) ? v : formatYAxis(v)}
              </text>
            ));
          })()}
        {hasPanel4 &&
          (() => {
            const { min, max } = panelExtents.panel4;
            const r = max - min || 1;
            const ticks = [min, min + r * 0.25, min + r * 0.5, min + r * 0.75, max];
            return ticks.map((v) => (
              <text key={`p4-${v}`} x={Y_AXIS_WIDTH - 6} y={yRsiPanel4(v) + 4} textAnchor="end" className="text-[10px] font-mono" fill={footerYAxisTextHex}>
                {v >= 0 && v <= 100 && v === Math.round(v) ? v : formatYAxis(v)}
              </text>
            ));
          })()}
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
            <text x={Y_AXIS_WIDTH - 6} y={lastCloseY + 4} textAnchor="end" className="font-semibold" fill={lastCloseTextHex}>
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
                    return v != null && typeof v === "number" && Number.isFinite(v) ? v : null;
                  })()
                : null;
            if (lastVal == null) return null;
            const panelKey = getPanel(ind);
            const lastValY =
              panelKey === "main" ? y(lastVal) : yRsiByPanel(lastVal, panelKey === "panel3" || panelKey === "panel4" ? panelKey : "panel2");
            const ext = panelExtents[panelKey as "panel2" | "panel3" | "panel4"];
            const inRange =
              panelKey === "main" ? lastVal >= yMin && lastVal <= yMax : lastVal >= ext.min && lastVal <= ext.max;
            if (!inRange) return null;
            const textColor =
              ind.display === "histogram"
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
                  fillOpacity={0.9}
                  stroke="#e4e4e7"
                  strokeWidth={1}
                  rx={2}
                />
                <text
                  x={Y_AXIS_WIDTH - 6}
                  y={lastValY + 4}
                  textAnchor="end"
                  className="font-semibold font-mono text-[10px]"
                  fill={textColor}
                >
                  {panelKey === "main" ? formatYAxis(lastVal) : lastVal >= 0 && lastVal <= 100 ? lastVal.toFixed(1) : formatYAxis(lastVal)}
                </text>
              </g>
            );
          })}
        {crosshairPoint !== null &&
          (crosshairPoint.index >= startIndex && crosshairPoint.index < startIndex + windowN || crosshairDragging) &&
          (() => {
            const crossY = y(crosshairPoint.price);
            const pctVsLast = lastClose > 0 ? ((crosshairPoint.price - lastClose) / lastClose) * 100 : 0;
            const pctStr = pctVsLast >= 0 ? `+${pctVsLast.toFixed(2)}%` : pctVsLast.toFixed(2) + "%";
            const pctColor = pctVsLast >= 0 ? "#059669" : "#dc2626";
            const boxH = 28;
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
                <text x={Y_AXIS_WIDTH - 6} y={crossY + 4} textAnchor="end" className="font-mono font-medium" fill={footerYAxisTextHex}>
                  {formatYAxis(crosshairPoint.price)}
                </text>
                <text x={Y_AXIS_WIDTH - 6} y={crossY + 15} textAnchor="end" className="text-[10px] font-mono" fill={pctColor}>
                  {pctStr}
                </text>
              </g>
            );
          })()}
      </svg>
    </div>
  );
}
