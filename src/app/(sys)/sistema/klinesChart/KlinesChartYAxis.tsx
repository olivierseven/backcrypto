"use client";

/**
 * Eixo Y (USDT) à direita do gráfico: ticks, último fechamento, valores dos indicadores, marcador do crosshair.
 */
import { useState, useEffect } from "react";
import { Y_AXIS_WIDTH } from "../KlinesChartConstants";
import type { ChartIndicatorLine } from "./types";

const MS_24H = 24 * 60 * 60 * 1000;

function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

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
  /** Momento de fechamento do candle atual (openTime + interval), em ms. Se &lt; 24h para fechar, mostra contagem regressiva abaixo do fechamento. */
  currentCandleCloseTimeMs: number | null;
  /** Exibir contagem regressiva do candle no eixo Y (default true). Só aplica quando groupMinutes ≤ 1440 (≤1D). */
  showCandleCountdown?: boolean;
  /** Intervalo do gráfico em minutos; contagem regressiva só para ≤ 1440 (1D). */
  groupMinutes?: number;
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
  /** Retas horizontais que pedem para marcar o valor no eixo Y (preço + cor). Apenas no painel principal. */
  horizontalLineAxisLabels?: { price: number; color: string }[];
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
  currentCandleCloseTimeMs,
  showCandleCountdown = true,
  groupMinutes,
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
  horizontalLineAxisLabels,
}: KlinesChartYAxisProps) {
  // Compacto para caber em 60px: valor máximo -999.999,99 (ou -999999.99) sem abreviação
  const fontSize = Math.round(8 * textScale);
  const boxWidth = yAxisAbbreviated ? 44 : 56;
  const boxX = Y_AXIS_WIDTH - boxWidth - 2; // 60 - 44 - 2 = 14 (abbrev) ou 60 - 56 - 2 = 2 (long)
  const textX = 4;

  const [countdown, setCountdown] = useState<string | null>(null);
  useEffect(() => {
    if (currentCandleCloseTimeMs == null || (groupMinutes != null && groupMinutes > 1440)) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const remaining = currentCandleCloseTimeMs - Date.now();
      if (remaining <= 0) {
        setCountdown(null);
        return;
      }
      if (remaining < MS_24H) {
        setCountdown(formatCountdown(remaining));
      } else {
        setCountdown(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [currentCandleCloseTimeMs, groupMinutes]);

  return (
    <div className="flex-shrink-0 border-l border-zinc-200" style={{ backgroundColor: footerYAxisHex }}>
      <svg width={Y_AXIS_WIDTH} height={chartHeight} className="font-mono tabular-nums" style={{ fontSize }}>
        {yTickValues.map((v, i) => (
          <text key={i} x={textX} y={y(v) + 4} textAnchor="start" fill={footerYAxisTextHex}>
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
              <text key={`p2-${v}`} x={textX} y={yRsiPanel2(v) + 4} textAnchor="start" className="font-mono" style={{ fontSize }} fill={footerYAxisTextHex}>
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
              <text key={`p3-${v}`} x={textX} y={yRsiPanel3(v) + 4} textAnchor="start" className="font-mono" style={{ fontSize }} fill={footerYAxisTextHex}>
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
              <text key={`p4-${v}`} x={textX} y={yRsiPanel4(v) + 4} textAnchor="start" className="font-mono" style={{ fontSize }} fill={footerYAxisTextHex}>
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
              <text key={`p5-${v}`} x={textX} y={yRsiPanel5(v) + 4} textAnchor="start" className="font-mono" style={{ fontSize }} fill={footerYAxisTextHex}>
                {fmt(v)}
              </text>
            ));
          })()}
        {volumeOnPrice && volumeLabelValue != null && volumeLabelY != null && volumeLabelColor != null && (
          <g>
            <rect
              x={boxX}
              y={volumeLabelY - 7}
              width={boxWidth}
              height={14}
              fill="white"
              fillOpacity={0.8}
              stroke={isDarkFooterYAxis ? "#52525b" : "#e4e4e7"}
              strokeWidth={1}
              rx={2}
            />
            <text x={textX} y={volumeLabelY + 4} textAnchor="start" className="font-mono font-medium" style={{ fontSize }} fill={volumeLabelColor}>
              {volumeLabelValue}
            </text>
          </g>
        )}
        {horizontalLineAxisLabels?.map(({ price, color }, i) => {
          if (price < yMin || price > yMax) return null;
          const labelY = y(price);
          return (
            <g key={i}>
              <rect
                x={boxX}
                y={labelY - 7}
                width={boxWidth}
                height={14}
                fill="white"
                fillOpacity={0.9}
                stroke={color}
                strokeWidth={1}
                rx={2}
              />
              <text x={textX} y={labelY + 4} textAnchor="start" className="font-mono font-medium" style={{ fontSize }} fill={color}>
                {formatYAxis(price)}
              </text>
            </g>
          );
        })}
        {indicatorLines
          .filter((ind) => ind.showLastValueOnYAxis !== false)
          .map((ind, indIdx) => {
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
                  x={boxX}
                  y={lastValY - 7}
                  width={boxWidth}
                  height={14}
                  fill="white"
                  fillOpacity={isVolumeStyle ? 0.8 : 0.9}
                  stroke="#e4e4e7"
                  strokeWidth={1}
                  rx={2}
                />
                <text
                  x={textX}
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
                        : (ind.type === "RSI" || ind.type === "MFI") && lastVal >= 0 && lastVal <= 100
                          ? lastVal.toFixed(1)
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
                  x={boxX}
                  y={boxY}
                  width={boxWidth}
                  height={boxH}
                  fill={isDarkFooterYAxis ? "#3f3f46" : "white"}
                  stroke={lineTableHex}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  rx={2}
                />
                <text x={textX} y={crossY + 4} textAnchor="start" className="font-mono font-medium" style={{ fontSize }} fill={footerYAxisTextHex}>
                  {valueStr}
                </text>
                {pctStr != null && (
                  <text x={textX} y={crossY + 15} textAnchor="start" className="font-mono" style={{ fontSize }} fill={pctColor}>
                    {pctStr}
                  </text>
                )}
              </g>
            );
          })()}
        {showLastClose && (
          <g>
            <rect
              x={boxX}
              y={lastCloseY - 7}
              width={boxWidth}
              height={showCandleCountdown && countdown != null ? 28 : 14}
              fill={isDarkFooterYAxis ? "#3f3f46" : "white"}
              stroke={isDarkFooterYAxis ? "#52525b" : "#e4e4e7"}
              strokeWidth={1}
              rx={2}
            />
            <text x={textX} y={lastCloseY + 4} textAnchor="start" className="font-semibold" style={{ fontSize }} fill={lastCloseTextHex}>
              {formatYAxis(lastClose)}
            </text>
            {showCandleCountdown && countdown != null && (
              <text x={textX} y={lastCloseY + 15} textAnchor="start" className="font-mono" style={{ fontSize }} fill={lastCloseTextHex}>
                {countdown}
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
