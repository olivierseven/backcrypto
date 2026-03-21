"use client";

/**
 * Overlay de desenho: preview do segmento em construção (draw-pending) e rect transparente
 * com pointer down/move/up + hit-test para seleção e criação de segmentos.
 * Extraído de KlinesChartSvg para reduzir tamanho e isolar responsabilidade.
 */
import { useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { MARGIN_LEFT, MARGIN_TOP, MS_PER_DAY } from "../KlinesChartConstants";
import { distanceToSegment, distanceToPencilPath, DEFAULT_SEGMENT_COLOR, ARROW_LENGTH_PX, ARROW_OPACITY, getTextSegmentBox, type DrawSegment, type DrawDefaults, type ArrowSize, type TextSize } from "../KlinesChartDrawing";
import { SEGMENT_COLOR_PALETTE } from "./palettes";

const FIB_DEFAULT_COLOR = SEGMENT_COLOR_PALETTE[8];
const FIB_DEFAULT_618_COLOR = SEGMENT_COLOR_PALETTE[4];

function getSvgPoint(svgRef: RefObject<SVGSVGElement | null>, clientX: number, clientY: number): { px: number; py: number } | null {
  if (!svgRef.current) return null;
  const svg = svgRef.current;
  const rect = svg.getBoundingClientRect();
  const svgW = svg.width.baseVal.value;
  const svgH = svg.height.baseVal.value;
  return {
    px: (clientX - rect.left) * (svgW / rect.width),
    py: (clientY - rect.top) * (svgH / rect.height),
  };
}

export interface DrawOverlayProps {
  chartSvgRef: RefObject<SVGSVGElement | null>;
  chartW: number;
  chartH: number;
  drawMode: boolean;
  drawTool: "line" | "fibonacci" | "freeRetracement" | "channel" | "stopGain" | "rectangle" | "horizontalLine" | "verticalLine" | "arrow" | "text" | "ruler" | "select" | "pencil";
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
  segmentToPixel: (index: number, price: number) => { x: number; y: number };
  snapToCandlePoint: (px: number, py: number) => { index: number; price: number };
  pixelToData: (x: number, y: number) => { index: number; price: number };
  drawSegments: DrawSegment[];
  setDrawSegments: React.Dispatch<React.SetStateAction<DrawSegment[]>>;
  drawDefaults: DrawDefaults;
  fullReversed: (number | string | null)[][];
  n: number;
  selectedSegmentIndex: number | null;
  setSelectedSegmentIndex: (i: number | null) => void;
  drawingsVisible: boolean;
  onChartDrawClick?: () => void;
  onSegmentCreated?: (newIndex: number) => void;
  onSelectToolPan?: (deltaCandles: number) => void;
  selectPanActive: boolean;
  setSelectPanActive: (v: boolean) => void;
  selectPanLastClientXRef: React.MutableRefObject<number>;
  justPannedRef: React.MutableRefObject<boolean>;
}

export function DrawOverlay({
  chartSvgRef,
  chartW,
  chartH,
  drawMode,
  drawTool,
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
  segmentToPixel,
  snapToCandlePoint,
  pixelToData,
  drawSegments,
  setDrawSegments,
  drawDefaults,
  fullReversed,
  n,
  selectedSegmentIndex,
  setSelectedSegmentIndex,
  drawingsVisible,
  onChartDrawClick,
  onSegmentCreated,
  onSelectToolPan,
  selectPanActive,
  setSelectPanActive,
  selectPanLastClientXRef,
  justPannedRef,
}: DrawOverlayProps) {
  const [arrowPreviewTipPx, setArrowPreviewTipPx] = useState<{ x: number; y: number } | null>(null);
  const defaultArrowSize: ArrowSize = (drawDefaults.arrow?.arrowSize as ArrowSize) ?? "medium";
  const arrowLengthPx = ARROW_LENGTH_PX[defaultArrowSize];

  const ARROW_PREVIEW_EXTEND_PX = 600;
  const renderArrowPreview = (tailX: number, tailY: number, tipX: number, tipY: number) => {
    const dx = tipX - tailX;
    const dy = tipY - tailY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const headLen = 10;
    const headW = 6;
    const backX = tipX - headLen * ux;
    const backY = tipY - headLen * uy;
    const leftX = backX - uy * headW;
    const leftY = backY + ux * headW;
    const rightX = backX + uy * headW;
    const rightY = backY - ux * headW;
    const ext = ARROW_PREVIEW_EXTEND_PX;
    const tailExtX = tailX - ux * ext;
    const tailExtY = tailY - uy * ext;
    const tipExtX = tipX + ux * ext;
    const tipExtY = tipY + uy * ext;
    const stroke = drawDefaults.arrow?.color ?? DEFAULT_SEGMENT_COLOR;
    return (
      <g>
        <line x1={tailX} y1={tailY} x2={tailExtX} y2={tailExtY} stroke={stroke} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.7} />
        <line x1={tipX} y1={tipY} x2={tipExtX} y2={tipExtY} stroke={stroke} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.7} />
        <line x1={tailX} y1={tailY} x2={tipX} y2={tipY} stroke={stroke} strokeWidth={2} strokeDasharray="4 2" />
        <path d={`M ${tipX} ${tipY} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`} fill={stroke} fillOpacity={ARROW_OPACITY} stroke={stroke} strokeWidth={1} />
      </g>
    );
  };

  return (
    <>
      {/* Preview: primeiro ponto */}
      {drawPending && drawTool !== "arrow" && (() => {
        const p = segmentToPixel(drawPending.index1, drawPending.price1);
        return <circle cx={p.x} cy={p.y} r={4} fill="none" stroke="#000000" strokeWidth={1} />;
      })()}
      {/* Arrow phase 1: tail set, drag to set direction (preview) */}
      {drawPending && drawTool === "arrow" && arrowPreviewTipPx && (() => {
        const tail = segmentToPixel(drawPending.index1, drawPending.price1);
        const dx = arrowPreviewTipPx.x - tail.x;
        const dy = arrowPreviewTipPx.y - tail.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const tipX = tail.x + (arrowLengthPx * dx) / len;
        const tipY = tail.y + (arrowLengthPx * dy) / len;
        return renderArrowPreview(tail.x, tail.y, tipX, tipY);
      })()}
      {/* Arrow phase 2: angle phase (preview with fixed length) */}
      {drawPendingArrow && (() => {
        const tail = segmentToPixel(drawPendingArrow.index1, drawPendingArrow.price1);
        const tipX = tail.x + arrowLengthPx * Math.cos(drawPendingArrow.angleRad);
        const tipY = tail.y - arrowLengthPx * Math.sin(drawPendingArrow.angleRad);
        return renderArrowPreview(tail.x, tail.y, tipX, tipY);
      })()}
      {drawPending && drawTool === "rectangle" && drawPendingRectSecond && (() => {
        const minI = Math.min(drawPending.index1, drawPendingRectSecond.index);
        const maxI = Math.max(drawPending.index1, drawPendingRectSecond.index);
        const minP = Math.min(drawPending.price1, drawPendingRectSecond.price);
        const maxP = Math.max(drawPending.price1, drawPendingRectSecond.price);
        const tl = segmentToPixel(minI, maxP);
        const br = segmentToPixel(maxI, minP);
        return (
          <rect x={tl.x} y={tl.y} width={Math.max(0, br.x - tl.x)} height={Math.max(0, br.y - tl.y)} fill="none" stroke="#000000" strokeWidth={1} strokeDasharray="4 2" />
        );
      })()}
      {drawPending && (drawTool === "line" || drawTool === "ruler") && drawPendingLineSecond && (() => {
        const p1 = segmentToPixel(drawPending.index1, drawPending.price1);
        const p2 = segmentToPixel(drawPendingLineSecond.index, drawPendingLineSecond.price);
        const price1 = drawPending.price1;
        const price2 = drawPendingLineSecond.price;
        const i1 = Math.max(0, Math.min(drawPending.index1, n - 1));
        const i2 = Math.max(0, Math.min(drawPendingLineSecond.index, n - 1));
        const percent = price1 !== 0 ? ((price2 - price1) / price1) * 100 : 0;
        const percentStr = percent >= 0 ? `+${percent.toFixed(4)}%` : `${percent.toFixed(4)}%`;
        const openTime1 = fullReversed[i1]?.[0] ?? 0;
        const openTime2 = fullReversed[i2]?.[0] ?? 0;
        const days = Math.round((Number(openTime2) - Number(openTime1)) / MS_PER_DAY);
        const candles = Math.abs(i2 - i1);
        const daysAndCandlesStr = `${days}d, ${candles}c`;
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const offset = 14;
        const labelY = midY - offset;
        const textColor = percent >= 0 ? "#059669" : "#dc2626";
        const padW = 48;
        const padH = 14;
        return (
          <g>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#000000" strokeWidth={1} strokeDasharray="4 2" />
            <rect x={midX - padW} y={labelY - 12} width={padW * 2} height={padH * 2} rx={4} ry={4} fill="#ffffff" fillOpacity={0.9} stroke={textColor} strokeWidth={1} />
            <text x={midX} y={labelY} textAnchor="middle" fill={textColor} className="font-medium select-none" style={{ fontSize: 10 }}>
              <tspan x={midX} dy={0}>{percentStr}</tspan>
              <tspan x={midX} dy={11}>{daysAndCandlesStr}</tspan>
            </text>
          </g>
        );
      })()}
      {drawPending && drawTool === "channel" && drawPendingChannelSecond && (() => {
        const p1 = segmentToPixel(drawPending.index1, drawPending.price1);
        const p2 = segmentToPixel(drawPendingChannelSecond.index, drawPendingChannelSecond.price);
        const stroke = "#000000";
        const dash = "4 2";
        return (
          <g>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={1} strokeDasharray={dash} />
          </g>
        );
      })()}
      {drawPending && drawTool === "stopGain" && drawPendingStopGainSecond && (() => {
        const p1 = segmentToPixel(drawPending.index1, drawPending.price1);
        const p2 = segmentToPixel(drawPendingStopGainSecond.index, drawPending.price1);
        return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#000000" strokeWidth={1} strokeDasharray="4 2" />;
      })()}
      {drawPending && drawTool === "horizontalLine" && drawPendingHorizontalSecond && (() => {
        const p1 = segmentToPixel(drawPending.index1, drawPending.price1);
        const p2 = segmentToPixel(drawPendingHorizontalSecond.index, drawPending.price1);
        return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#000000" strokeWidth={1} strokeDasharray="4 2" />;
      })()}
      {drawPendingPencil && drawPendingPencil.length >= 2 && (() => {
        const stroke = drawDefaults.pencil?.color ?? DEFAULT_SEGMENT_COLOR;
        const strokeWidth = drawDefaults.pencil?.pencilStrokeWidth === "thick" ? 3 : drawDefaults.pencil?.pencilStrokeWidth === "thin" ? 1 : 2;
        const d = drawPendingPencil.map((pt) => segmentToPixel(pt.index, pt.price)).map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
        return <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
      })()}
      {drawPending && drawTool === "verticalLine" && (() => {
        const p = segmentToPixel(drawPending.index1, drawPending.price1);
        return <line x1={p.x} y1={MARGIN_TOP} x2={p.x} y2={MARGIN_TOP + chartH} stroke="#000000" strokeWidth={1} strokeDasharray="4 2" />;
      })()}
      {drawPending && drawTool === "fibonacci" && drawPendingFibSecond && (() => {
        const p1 = segmentToPixel(drawPending.index1, drawPending.price1);
        const p2 = segmentToPixel(drawPendingFibSecond.index, drawPendingFibSecond.price);
        const priceTop = Math.max(drawPending.price1, drawPendingFibSecond.price);
        const priceBottom = Math.min(drawPending.price1, drawPendingFibSecond.price);
        const range = priceTop - priceBottom;
        const yTop = segmentToPixel(drawPending.index1, priceTop).y;
        const yBottom = segmentToPixel(drawPending.index1, priceBottom).y;
        const fibLevels = [33.33 / 100, 0.5, 0.618];
        const stroke = "#000000";
        const dash = "4 2";
        return (
          <g>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={1.5} strokeDasharray={dash} />
            <line x1={p1.x} y1={yTop} x2={p2.x} y2={yTop} stroke={stroke} strokeWidth={1} strokeDasharray={dash} />
            <line x1={p1.x} y1={yBottom} x2={p2.x} y2={yBottom} stroke={stroke} strokeWidth={1} strokeDasharray={dash} />
            {fibLevels.map((k) => {
              const priceLevel = priceBottom + range * k;
              const py = segmentToPixel(drawPending.index1, priceLevel).y;
              return <line key={k} x1={p1.x} y1={py} x2={p2.x} y2={py} stroke={stroke} strokeWidth={1} strokeDasharray={dash} />;
            })}
          </g>
        );
      })()}
      {drawPending && drawTool === "freeRetracement" && drawPendingFreeRetraceSecond && (() => {
        const p1 = segmentToPixel(drawPending.index1, drawPending.price1);
        const p2 = segmentToPixel(drawPendingFreeRetraceSecond.index, drawPendingFreeRetraceSecond.price);
        const priceTop = Math.max(drawPending.price1, drawPendingFreeRetraceSecond.price);
        const priceBottom = Math.min(drawPending.price1, drawPendingFreeRetraceSecond.price);
        const range = priceTop - priceBottom;
        const k1 = Math.max(0, Math.min(0.5, (drawDefaults.freeRetracement?.freeRetracementLevelPct1 ?? 25) / 100));
        const k2 = 0.5;
        const k3 = Math.max(0.5, Math.min(1, (drawDefaults.freeRetracement?.freeRetracementLevelPct ?? 75) / 100));
        const py1 = segmentToPixel(drawPending.index1, priceBottom + range * k1).y;
        const py50 = segmentToPixel(drawPending.index1, priceBottom + range * k2).y;
        const py3 = segmentToPixel(drawPending.index1, priceBottom + range * k3).y;
        const stroke = "#000000";
        const dash = "4 2";
        return (
          <g>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={1.5} strokeDasharray={dash} />
            <line x1={p1.x} y1={py1} x2={p2.x} y2={py1} stroke={stroke} strokeWidth={1} strokeDasharray={dash} />
            <line x1={p1.x} y1={py50} x2={p2.x} y2={py50} stroke={stroke} strokeWidth={1} strokeDasharray={dash} />
            <line x1={p1.x} y1={py3} x2={p2.x} y2={py3} stroke={stroke} strokeWidth={1} strokeDasharray={dash} />
          </g>
        );
      })()}
      {drawMode && (
        <rect
          x={MARGIN_LEFT}
          y={MARGIN_TOP}
          width={chartW}
          height={chartH}
          fill="transparent"
          style={{ cursor: drawTool === "select" ? (selectPanActive ? "grabbing" : "grab") : "crosshair", touchAction: "none" }}
          onPointerDown={(e) => {
            if (!chartSvgRef.current) return;
            const point = getSvgPoint(chartSvgRef, e.clientX, e.clientY);
            if (!point) return;
            const { px, py } = point;
            if (drawTool === "pencil" && drawPendingPencil === null) {
              if (e.cancelable) e.preventDefault();
              const d = snapToCandlePoint(px, py);
              setDrawPendingPencil([{ index: d.index, price: d.price }]);
              e.currentTarget.setPointerCapture(e.pointerId);
              onChartDrawClick?.();
              return;
            }
            if ((drawTool === "rectangle" || drawTool === "fibonacci" || drawTool === "freeRetracement" || drawTool === "line" || drawTool === "channel" || drawTool === "stopGain" || drawTool === "horizontalLine" || drawTool === "verticalLine" || drawTool === "arrow" || drawTool === "text" || drawTool === "ruler") && drawPending === null && drawPendingArrow === null && (drawTool !== "text" || drawPendingText === null)) {
              if (e.cancelable) e.preventDefault();
              const d = snapToCandlePoint(px, py);
              if (drawTool === "text") {
                setDrawPendingText({ index1: d.index, price1: d.price });
                onChartDrawClick?.();
                return;
              }
              setDrawPending({ index1: d.index, price1: d.price });
              if (drawTool === "arrow") setArrowPreviewTipPx({ x: px, y: py });
              e.currentTarget.setPointerCapture(e.pointerId);
              onChartDrawClick?.();
              return;
            }
            if (drawTool !== "select" || !drawingsVisible || !onSelectToolPan) return;
            const HIT_THRESHOLD = 24;
            let bestIdx = -1;
            let bestD = HIT_THRESHOLD;
            drawSegments.forEach((seg, index) => {
              const p1 = segmentToPixel(seg.index1, seg.price1);
              const p2 = segmentToPixel(seg.index2, seg.price2);
              let d = distanceToSegment(px, py, p1.x, p1.y, p2.x, p2.y);
              if (seg.type === "fibonacci") {
                const range = seg.price1 - seg.price2;
                const priceTop = Math.max(seg.price1, seg.price2);
                const priceBottom = Math.min(seg.price1, seg.price2);
                const extendPx = segmentToPixel(seg.index2 + Math.max(0, seg.fibExtensionIndices ?? 0), seg.price2).x;
                const xEnd = Math.max(p2.x, extendPx);
                const yTop = segmentToPixel(seg.index1, priceTop).y;
                const yBottom = segmentToPixel(seg.index1, priceBottom).y;
                const k1 = Math.round(Math.max(0, Math.min(0.5, (seg.fibLevelPct1 ?? 33.33) / 100)) * 10000) / 10000;
                const y1 = segmentToPixel(seg.index1, seg.price2 + range * k1).y;
                const y50 = segmentToPixel(seg.index1, seg.price2 + range * 0.5).y;
                const y618 = segmentToPixel(seg.index1, seg.price2 + range * 0.618).y;
                const distToLine = (x1: number, y1: number, x2: number, y2: number) => distanceToSegment(px, py, x1, y1, x2, y2);
                let fibD = Math.min(d, distToLine(p1.x, yTop, xEnd, yTop), distToLine(p1.x, yBottom, xEnd, yBottom), distToLine(p1.x, y1, xEnd, y1), distToLine(p1.x, y50, xEnd, y50), distToLine(p1.x, y618, xEnd, y618));
                if (seg.fibShow1618 === true) {
                  const y1618 = segmentToPixel(seg.index1, seg.price2 + range * 1.618).y;
                  fibD = Math.min(fibD, distToLine(p1.x, y1618, xEnd, y1618));
                }
                d = fibD;
              }
              if (seg.type === "freeRetracement") {
                const range = seg.price1 - seg.price2;
                const priceTop = Math.max(seg.price1, seg.price2);
                const priceBottom = Math.min(seg.price1, seg.price2);
                const extendPx = segmentToPixel(seg.index2 + Math.max(0, seg.freeRetracementExtensionIndices ?? 0), seg.price2).x;
                const xEnd = Math.max(p2.x, extendPx);
                const yTop = segmentToPixel(seg.index1, priceTop).y;
                const yBottom = segmentToPixel(seg.index1, priceBottom).y;
                const k1 = Math.round(Math.max(0, Math.min(0.5, (seg.freeRetracementLevelPct1 ?? 33.33) / 100)) * 10000) / 10000;
                const k3 = Math.round(Math.max(0.5, Math.min(1, (seg.freeRetracementLevelPct ?? 61.8) / 100)) * 10000) / 10000;
                const kExt = Math.round(Math.max(1, Math.min(2, (seg.freeRetracementLevelPctExt ?? 100) / 100)) * 10000) / 10000;
                const y1 = segmentToPixel(seg.index1, seg.price2 + range * k1).y;
                const y50 = segmentToPixel(seg.index1, seg.price2 + range * 0.5).y;
                const y3 = segmentToPixel(seg.index1, seg.price2 + range * k3).y;
                const yExt = segmentToPixel(seg.index1, seg.price2 + range * kExt).y;
                const distToLine = (x1: number, y1: number, x2: number, y2: number) => distanceToSegment(px, py, x1, y1, x2, y2);
                d = Math.min(d, distToLine(p1.x, yTop, xEnd, yTop), distToLine(p1.x, yBottom, xEnd, yBottom), distToLine(p1.x, y1, xEnd, y1), distToLine(p1.x, y50, xEnd, y50), distToLine(p1.x, y3, xEnd, y3), distToLine(p1.x, yExt, xEnd, yExt));
              }
              if (seg.type === "channel") {
                const off = seg.channelOffset ?? 0;
                const p1u = segmentToPixel(seg.index1, seg.price1 + off);
                const p2u = segmentToPixel(seg.index2, seg.price2 + off);
                const p1d = segmentToPixel(seg.index1, seg.price1 - off);
                const p2d = segmentToPixel(seg.index2, seg.price2 - off);
                d = Math.min(d, distanceToSegment(px, py, p1.x, p1.y, p2.x, p2.y), distanceToSegment(px, py, p1u.x, p1u.y, p2u.x, p2u.y), distanceToSegment(px, py, p1d.x, p1d.y, p2d.x, p2d.y));
                const ext = Math.max(0, seg.channelExtensionIndices ?? 0);
                if (ext > 0) {
                  const deltaIdx = seg.index2 - seg.index1;
                  const slopeCh = deltaIdx !== 0 ? (seg.price2 - seg.price1) / deltaIdx : 0;
                  const extIdx = seg.index2 + ext;
                  const pe = segmentToPixel(extIdx, seg.price2 + slopeCh * ext);
                  const p2uExt = segmentToPixel(extIdx, seg.price2 + off + slopeCh * ext);
                  const p2dExt = segmentToPixel(extIdx, seg.price2 - off + slopeCh * ext);
                  d = Math.min(d, distanceToSegment(px, py, p2.x, p2.y, pe.x, pe.y), distanceToSegment(px, py, p2u.x, p2u.y, p2uExt.x, p2uExt.y), distanceToSegment(px, py, p2d.x, p2d.y, p2dExt.x, p2dExt.y));
                }
              }
              if (seg.type === "stopGain") {
                const ru = Math.max(1, Math.min(10, Math.round((seg.stopGainRatioUp ?? 1) * 100) / 100));
                const rd = Math.max(1, Math.min(10, Math.round((seg.stopGainRatioDown ?? 1) * 100) / 100));
                const openAmount = Math.max(0, seg.stopGainOpenAmount ?? 0);
                const gainOffset = openAmount * (ru / (ru + rd));
                const stopOffset = openAmount * (rd / (ru + rd));
                const midPrice = seg.price1;
                const priceTop = midPrice + gainOffset;
                const priceBottom = midPrice - stopOffset;
                const pa = segmentToPixel(seg.index1, midPrice);
                const pb = segmentToPixel(seg.index2, midPrice);
                const paUp = segmentToPixel(seg.index1, priceTop);
                const pbUp = segmentToPixel(seg.index2, priceTop);
                const paDn = segmentToPixel(seg.index1, priceBottom);
                const pbDn = segmentToPixel(seg.index2, priceBottom);
                const xMin = Math.min(pa.x, pb.x);
                const xMax = Math.max(pa.x, pb.x);
                const yTop = Math.min(paUp.y, pbUp.y);
                const yBottom = Math.max(paDn.y, pbDn.y);
                const inside = px >= xMin && px <= xMax && py >= yTop && py <= yBottom;
                d = inside ? 0 : Math.min(d, distanceToSegment(px, py, pa.x, pa.y, pb.x, pb.y), distanceToSegment(px, py, paUp.x, paUp.y, pbUp.x, pbUp.y), distanceToSegment(px, py, paDn.x, paDn.y, pbDn.x, pbDn.y));
              }
              if (seg.type === "rectangle") {
                const rMinI = Math.min(seg.index1, seg.index2);
                const rMaxI = Math.max(seg.index1, seg.index2);
                const rMinP = Math.min(seg.price1, seg.price2);
                const rMaxP = Math.max(seg.price1, seg.price2);
                const rTl = segmentToPixel(rMinI, rMaxP);
                const rBr = segmentToPixel(rMaxI, rMinP);
                const inside = px >= rTl.x && px <= rBr.x && py >= rTl.y && py <= rBr.y;
                d = inside ? 0 : Infinity;
              }
              if (seg.type === "verticalLine") {
                const lineX = segmentToPixel(seg.index1, seg.price1).x;
                d = Math.abs(px - lineX);
              }
              if (seg.type === "text") {
                const lines = (seg.textContent ?? "").split("\n").filter(Boolean);
                const sizeKey = (seg.textSize as TextSize) ?? "small";
                const { boxW, boxH } = getTextSegmentBox(lines, sizeKey, 10, seg.textBold === true);
                const hitPadding = 14;
                const left = p1.x - hitPadding;
                const right = p1.x + boxW + hitPadding;
                const top = p1.y - boxH - hitPadding;
                const bottom = p1.y + hitPadding;
                const inside = px >= left && px <= right && py >= top && py <= bottom;
                d = inside ? 0 : Infinity;
              }
              if (seg.type === "pencil") {
                const pts = seg.pencilPoints ?? [];
                d = pts.length >= 2 ? distanceToPencilPath(px, py, pts, segmentToPixel) : Infinity;
              }
              if (d < bestD) {
                bestD = d;
                bestIdx = index;
              }
            });
            if (bestIdx < 0) {
              if (e.cancelable) e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              selectPanLastClientXRef.current = e.clientX;
              setSelectPanActive(true);
            }
          }}
          onPointerMove={(e) => {
            const point = getSvgPoint(chartSvgRef, e.clientX, e.clientY);
            if (!point) return;
            if ((drawTool === "line" || drawTool === "ruler") && drawPending !== null && e.buttons === 0) {
              setDrawPending(null);
              setDrawPendingLineSecond(null);
              return;
            }
            if (drawPendingArrow !== null) {
              if (e.cancelable) e.preventDefault();
              const tail = segmentToPixel(drawPendingArrow.index1, drawPendingArrow.price1);
              const angleRad = Math.atan2(tail.y - point.py, point.px - tail.x);
              setDrawPendingArrow({ ...drawPendingArrow, angleRad });
              return;
            }
            if (drawTool === "pencil" && drawPendingPencil !== null) {
              if (e.cancelable) e.preventDefault();
              const d = snapToCandlePoint(point.px, point.py);
              setDrawPendingPencil(drawPendingPencil ? [...drawPendingPencil, { index: d.index, price: d.price }] : null);
              return;
            }
            if ((drawTool !== "rectangle" && drawTool !== "fibonacci" && drawTool !== "freeRetracement" && drawTool !== "line" && drawTool !== "channel" && drawTool !== "stopGain" && drawTool !== "horizontalLine" && drawTool !== "verticalLine" && drawTool !== "arrow" && drawTool !== "ruler") || drawPending === null) return;
            if (e.cancelable) e.preventDefault();
            const d = snapToCandlePoint(point.px, point.py);
            if (drawTool === "arrow") setArrowPreviewTipPx({ x: point.px, y: point.py });
            else if (drawTool === "rectangle") setDrawPendingRectSecond({ index: d.index, price: d.price });
            else if (drawTool === "fibonacci") setDrawPendingFibSecond({ index: d.index, price: d.price });
            else if (drawTool === "freeRetracement") setDrawPendingFreeRetraceSecond({ index: d.index, price: d.price });
            else if (drawTool === "line" || drawTool === "ruler") setDrawPendingLineSecond({ index: d.index, price: d.price });
            else if (drawTool === "channel") setDrawPendingChannelSecond({ index: d.index, price: d.price });
            else if (drawTool === "stopGain") setDrawPendingStopGainSecond({ index: d.index, price: drawPending.price1 });
            else if (drawTool === "horizontalLine") setDrawPendingHorizontalSecond({ index: d.index, price: drawPending.price1 });
            else if (drawTool === "verticalLine") setDrawPending({ index1: d.index, price1: drawPending.price1 });
          }}
          onPointerUp={(e) => {
            if (drawTool === "select" && typeof e.currentTarget.hasPointerCapture === "function" && e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
            if (drawTool === "pencil" && drawPendingPencil !== null && drawPendingPencil.length >= 2) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              const first = drawPendingPencil[0];
              const last = drawPendingPencil[drawPendingPencil.length - 1];
              const dfPencil = drawDefaults.pencil;
              const newSeg: DrawSegment = {
                index1: first.index,
                price1: first.price,
                index2: last.index,
                price2: last.price,
                type: "pencil",
                pencilPoints: [...drawPendingPencil],
                color: dfPencil?.color ?? DEFAULT_SEGMENT_COLOR,
                pencilStrokeWidth: dfPencil?.pencilStrokeWidth ?? "medium",
              };
              let newIndex = 0;
              flushSync(() => {
                setDrawSegments((seg) => {
                  newIndex = seg.length;
                  return [...seg, newSeg];
                });
              });
              setDrawPendingPencil(null);
              onSegmentCreated?.(newIndex);
              return;
            }
            if (drawTool === "ruler" && drawPending !== null) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              setDrawPending(null);
              setDrawPendingLineSecond(null);
              return;
            }
            if (drawTool === "line" && drawPending !== null) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              const point = getSvgPoint(chartSvgRef, e.clientX, e.clientY);
              if (!point) {
                setDrawPending(null);
                setDrawPendingLineSecond(null);
                return;
              }
              const d = snapToCandlePoint(point.px, point.py);
              const dfSeg = drawDefaults.segment;
              const newSeg: DrawSegment = { index1: drawPending.index1, price1: drawPending.price1, index2: d.index, price2: d.price, type: "segment", startCap: dfSeg?.startCap ?? "point", endCap: dfSeg?.endCap ?? "arrow", showPercent: dfSeg?.showPercent ?? true, showValues: dfSeg?.showValues ?? false, color: dfSeg?.color ?? DEFAULT_SEGMENT_COLOR };
              let newIndex = 0;
              flushSync(() => {
                setDrawSegments((seg) => {
                  newIndex = seg.length;
                  return [...seg, newSeg];
                });
              });
              setDrawPending(null);
              setDrawPendingLineSecond(null);
              onSegmentCreated?.(newIndex);
              return;
            }
            if (drawTool === "rectangle" && drawPending !== null) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              const point = getSvgPoint(chartSvgRef, e.clientX, e.clientY);
              if (!point) {
                setDrawPending(null);
                setDrawPendingRectSecond(null);
                return;
              }
              const d = snapToCandlePoint(point.px, point.py);
              const dfRect = drawDefaults.rectangle;
              const newSeg: DrawSegment = { index1: drawPending.index1, price1: drawPending.price1, index2: d.index, price2: d.price, type: "rectangle", color: dfRect?.color ?? DEFAULT_SEGMENT_COLOR, rectangleStrokeWidth: dfRect?.rectangleStrokeWidth ?? "medium", rectangleFilled: dfRect?.rectangleFilled ?? false };
              let newIndex = 0;
              flushSync(() => {
                setDrawSegments((seg) => {
                  newIndex = seg.length;
                  return [...seg, newSeg];
                });
              });
              setDrawPending(null);
              setDrawPendingRectSecond(null);
              onSegmentCreated?.(newIndex);
              return;
            }
            if (drawTool === "fibonacci" && drawPending !== null) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              const point = getSvgPoint(chartSvgRef, e.clientX, e.clientY);
              if (!point) {
                setDrawPending(null);
                setDrawPendingFibSecond(null);
                return;
              }
              const d = snapToCandlePoint(point.px, point.py);
              const dfFib = drawDefaults.fibonacci;
              const newSeg: DrawSegment = { index1: drawPending.index1, price1: drawPending.price1, index2: d.index, price2: d.price, type: "fibonacci", color: dfFib?.color ?? FIB_DEFAULT_COLOR, fibLevel618Color: dfFib?.fibLevel618Color ?? FIB_DEFAULT_618_COLOR, showPercent: dfFib?.showPercent ?? false, showValues: dfFib?.showValues ?? false, fibStrokeWidth: dfFib?.fibStrokeWidth ?? "medium", fibLevel618StrokeWidth: dfFib?.fibLevel618StrokeWidth ?? "thin", fibLevelPct1: dfFib?.fibLevelPct1 ?? 33.33 };
              let newIndex = 0;
              flushSync(() => {
                setDrawSegments((seg) => {
                  newIndex = seg.length;
                  return [...seg, newSeg];
                });
              });
              setDrawPending(null);
              setDrawPendingFibSecond(null);
              onSegmentCreated?.(newIndex);
              return;
            }
            if (drawTool === "freeRetracement" && drawPending !== null) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              const point = getSvgPoint(chartSvgRef, e.clientX, e.clientY);
              if (!point) {
                setDrawPending(null);
                setDrawPendingFreeRetraceSecond(null);
                return;
              }
              const d = snapToCandlePoint(point.px, point.py);
              const dfFr = drawDefaults.freeRetracement;
              const newSeg: DrawSegment = { index1: drawPending.index1, price1: drawPending.price1, index2: d.index, price2: d.price, type: "freeRetracement", color: dfFr?.color ?? "#000000", freeRetracementLevelPct1: dfFr?.freeRetracementLevelPct1 ?? 25, freeRetracementLevelPct: dfFr?.freeRetracementLevelPct ?? 75, freeRetracementLevelPctExt: dfFr?.freeRetracementLevelPctExt ?? 100, freeRetracementShowValuesOnYAxis: dfFr?.freeRetracementShowValuesOnYAxis ?? false, freeRetracementExtensionIndices: dfFr?.freeRetracementExtensionIndices ?? 0, fibStrokeWidth: dfFr?.fibStrokeWidth ?? "medium", showPercent: dfFr?.showPercent !== false, showValues: dfFr?.showValues ?? false };
              let newIndex = 0;
              flushSync(() => {
                setDrawSegments((seg) => {
                  newIndex = seg.length;
                  return [...seg, newSeg];
                });
              });
              setDrawPending(null);
              setDrawPendingFreeRetraceSecond(null);
              onSegmentCreated?.(newIndex);
              return;
            }
            if (drawTool === "channel" && drawPending !== null) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              const point = getSvgPoint(chartSvgRef, e.clientX, e.clientY);
              if (!point) {
                setDrawPending(null);
                setDrawPendingChannelSecond(null);
                return;
              }
              const d = snapToCandlePoint(point.px, point.py);
              const dfCh = drawDefaults.channel;
              const newSeg: DrawSegment = { index1: drawPending.index1, price1: drawPending.price1, index2: d.index, price2: d.price, type: "channel", color: dfCh?.color ?? DEFAULT_SEGMENT_COLOR, channelOffset: 0, channelExtremityColor: dfCh?.channelExtremityColor ?? dfCh?.color ?? DEFAULT_SEGMENT_COLOR, channelMidStrokeWidth: dfCh?.channelMidStrokeWidth ?? "thin", channelExtremityStrokeWidth: dfCh?.channelExtremityStrokeWidth ?? "thin", showValues: dfCh?.showValues ?? false };
              let newIndex = 0;
              flushSync(() => {
                setDrawSegments((seg) => {
                  newIndex = seg.length;
                  return [...seg, newSeg];
                });
              });
              setDrawPending(null);
              setDrawPendingChannelSecond(null);
              onSegmentCreated?.(newIndex);
              return;
            }
            if (drawTool === "stopGain" && drawPending !== null) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              const point = getSvgPoint(chartSvgRef, e.clientX, e.clientY);
              if (!point) {
                setDrawPending(null);
                setDrawPendingStopGainSecond(null);
                return;
              }
              const d = snapToCandlePoint(point.px, point.py);
              const i1 = Math.min(drawPending.index1, d.index);
              const i2 = Math.max(drawPending.index1, d.index);
              const midPrice = drawPending.price1;
              const dfSg = drawDefaults.stopGain;
              const newSeg: DrawSegment = { index1: i1, price1: midPrice, index2: i2, price2: midPrice, type: "stopGain", stopGainRatioUp: dfSg?.stopGainRatioUp ?? 1, stopGainRatioDown: dfSg?.stopGainRatioDown ?? 1, stopGainOpenAmount: 0, stopGainFillOpacity: dfSg?.stopGainFillOpacity ?? 0.5, stopGainShowPercent: dfSg?.stopGainShowPercent ?? false, stopGainShowValuesOnYAxis: dfSg?.stopGainShowValuesOnYAxis ?? false, stopGainStrokeWidth: dfSg?.stopGainStrokeWidth ?? "medium" };
              let newIndex = 0;
              flushSync(() => {
                setDrawSegments((seg) => {
                  newIndex = seg.length;
                  return [...seg, newSeg];
                });
              });
              setDrawPending(null);
              setDrawPendingStopGainSecond(null);
              onSegmentCreated?.(newIndex);
              return;
            }
            if (drawTool === "horizontalLine" && drawPending !== null) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              const point = getSvgPoint(chartSvgRef, e.clientX, e.clientY);
              if (!point) {
                setDrawPending(null);
                setDrawPendingHorizontalSecond(null);
                return;
              }
              const d = snapToCandlePoint(point.px, point.py);
              const price = drawPending.price1;
              const i1 = Math.min(drawPending.index1, d.index);
              const i2 = Math.max(drawPending.index1, d.index);
              const dfH = drawDefaults.horizontalLine;
              const newSeg: DrawSegment = { index1: i1, price1: price, index2: i2, price2: price, type: "horizontalLine", color: dfH?.color ?? DEFAULT_SEGMENT_COLOR, horizontalLineStrokeWidth: dfH?.horizontalLineStrokeWidth ?? "medium", horizontalLineStrokeStyle: dfH?.horizontalLineStrokeStyle ?? "solid" };
              let newIndex = 0;
              flushSync(() => {
                setDrawSegments((seg) => {
                  newIndex = seg.length;
                  return [...seg, newSeg];
                });
              });
              setDrawPending(null);
              setDrawPendingHorizontalSecond(null);
              onSegmentCreated?.(newIndex);
              return;
            }
            if (drawTool === "verticalLine" && drawPending !== null) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              const idx = drawPending.index1;
              const price = drawPending.price1;
              const dfV = drawDefaults.verticalLine;
              const newSeg: DrawSegment = { index1: idx, price1: price, index2: idx, price2: price, type: "verticalLine", color: dfV?.color ?? DEFAULT_SEGMENT_COLOR, verticalLineStrokeWidth: dfV?.verticalLineStrokeWidth ?? "medium", verticalLineStrokeStyle: dfV?.verticalLineStrokeStyle ?? "solid" };
              let newIndex = 0;
              flushSync(() => {
                setDrawSegments((seg) => {
                  newIndex = seg.length;
                  return [...seg, newSeg];
                });
              });
              setDrawPending(null);
              onSegmentCreated?.(newIndex);
              return;
            }
            if (drawTool === "arrow" && drawPending !== null && arrowPreviewTipPx) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              const tail = segmentToPixel(drawPending.index1, drawPending.price1);
              const dx = arrowPreviewTipPx.x - tail.x;
              const dy = arrowPreviewTipPx.y - tail.y;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const tipX = tail.x + (arrowLengthPx * dx) / len;
              const tipY = tail.y + (arrowLengthPx * dy) / len;
              const angleRad = Math.atan2(tail.y - tipY, tipX - tail.x);
              setDrawPendingArrow({ index1: drawPending.index1, price1: drawPending.price1, angleRad });
              setDrawPending(null);
              setArrowPreviewTipPx(null);
              return;
            }
          }}
          onPointerLeave={(e) => {
            if ((drawTool === "line" || drawTool === "ruler") && drawPending !== null) {
              e.currentTarget.releasePointerCapture?.(e.pointerId);
              setDrawPending(null);
              setDrawPendingLineSecond(null);
            }
          }}
          onPointerCancel={(e) => {
            if ((drawTool === "line" || drawTool === "ruler") && drawPending !== null) {
              e.currentTarget.releasePointerCapture?.(e.pointerId);
              setDrawPending(null);
              setDrawPendingLineSecond(null);
            }
          }}
          onClick={(e) => {
            if (justPannedRef.current) {
              justPannedRef.current = false;
              return;
            }
            if (drawTool === "arrow" && drawPendingArrow !== null) {
              const tail = segmentToPixel(drawPendingArrow.index1, drawPendingArrow.price1);
              const tipX = tail.x + arrowLengthPx * Math.cos(drawPendingArrow.angleRad);
              const tipY = tail.y - arrowLengthPx * Math.sin(drawPendingArrow.angleRad);
              const tipData = pixelToData(tipX, tipY);
              const dfArr = drawDefaults.arrow;
              const angleDeg = ((drawPendingArrow.angleRad * 180) / Math.PI + 360) % 360;
              const newSeg: DrawSegment = {
                index1: drawPendingArrow.index1,
                price1: drawPendingArrow.price1,
                index2: tipData.index,
                price2: tipData.price,
                type: "arrow",
                color: dfArr?.color ?? DEFAULT_SEGMENT_COLOR,
                arrowSize: (dfArr?.arrowSize as ArrowSize) ?? "medium",
                arrowAngle: Math.round(angleDeg * 10) / 10,
              };
              let newIndex = 0;
              flushSync(() => {
                setDrawSegments((seg) => {
                  newIndex = seg.length;
                  return [...seg, newSeg];
                });
              });
              setDrawPendingArrow(null);
              onSegmentCreated?.(newIndex);
              return;
            }
            if (drawTool === "rectangle" || drawTool === "fibonacci" || drawTool === "line" || drawTool === "horizontalLine" || drawTool === "verticalLine" || drawTool === "pencil" || (drawTool === "arrow" && drawPendingArrow === null)) return;
            const point = getSvgPoint(chartSvgRef, e.nativeEvent.clientX, e.nativeEvent.clientY);
            if (!point) return;
            const { px, py } = point;
            if (drawTool === "select" && drawingsVisible) {
              const HIT_THRESHOLD = 24;
              let bestIdx = -1;
              let bestD = HIT_THRESHOLD;
              drawSegments.forEach((seg, index) => {
                const p1 = segmentToPixel(seg.index1, seg.price1);
                const p2 = segmentToPixel(seg.index2, seg.price2);
                let d = distanceToSegment(px, py, p1.x, p1.y, p2.x, p2.y);
                if (seg.type === "fibonacci") {
                  const range = seg.price1 - seg.price2;
                  const priceTop = Math.max(seg.price1, seg.price2);
                  const priceBottom = Math.min(seg.price1, seg.price2);
                  const extendPx = segmentToPixel(seg.index2 + Math.max(0, seg.fibExtensionIndices ?? 0), seg.price2).x;
                  const xEnd = Math.max(p2.x, extendPx);
                  const yTop = segmentToPixel(seg.index1, priceTop).y;
                  const yBottom = segmentToPixel(seg.index1, priceBottom).y;
                  const k1 = Math.round(Math.max(0, Math.min(0.5, (seg.fibLevelPct1 ?? 33.33) / 100)) * 10000) / 10000;
                  const y1 = segmentToPixel(seg.index1, seg.price2 + range * k1).y;
                  const y50 = segmentToPixel(seg.index1, seg.price2 + range * 0.5).y;
                  const y618 = segmentToPixel(seg.index1, seg.price2 + range * 0.618).y;
                  const distToLine = (x1: number, y1: number, x2: number, y2: number) => distanceToSegment(px, py, x1, y1, x2, y2);
                  d = Math.min(d, distToLine(p1.x, yTop, xEnd, yTop), distToLine(p1.x, yBottom, xEnd, yBottom), distToLine(p1.x, y1, xEnd, y1), distToLine(p1.x, y50, xEnd, y50), distToLine(p1.x, y618, xEnd, y618));
                }
                if (seg.type === "channel") {
                  const off = seg.channelOffset ?? 0;
                  const p1u = segmentToPixel(seg.index1, seg.price1 + off);
                  const p2u = segmentToPixel(seg.index2, seg.price2 + off);
                  const p1d = segmentToPixel(seg.index1, seg.price1 - off);
                  const p2d = segmentToPixel(seg.index2, seg.price2 - off);
                  d = Math.min(d, distanceToSegment(px, py, p1.x, p1.y, p2.x, p2.y), distanceToSegment(px, py, p1u.x, p1u.y, p2u.x, p2u.y), distanceToSegment(px, py, p1d.x, p1d.y, p2d.x, p2d.y));
                  const ext = Math.max(0, seg.channelExtensionIndices ?? 0);
                  if (ext > 0) {
                    const deltaIdx = seg.index2 - seg.index1;
                    const slopeCh = deltaIdx !== 0 ? (seg.price2 - seg.price1) / deltaIdx : 0;
                    const extIdx = seg.index2 + ext;
                    const pe = segmentToPixel(extIdx, seg.price2 + slopeCh * ext);
                    const p2uExt = segmentToPixel(extIdx, seg.price2 + off + slopeCh * ext);
                    const p2dExt = segmentToPixel(extIdx, seg.price2 - off + slopeCh * ext);
                    d = Math.min(d, distanceToSegment(px, py, p2.x, p2.y, pe.x, pe.y), distanceToSegment(px, py, p2u.x, p2u.y, p2uExt.x, p2uExt.y), distanceToSegment(px, py, p2d.x, p2d.y, p2dExt.x, p2dExt.y));
                  }
                }
                if (seg.type === "stopGain") {
                  const ru = Math.max(1, Math.min(10, Math.round((seg.stopGainRatioUp ?? 1) * 100) / 100));
                  const rd = Math.max(1, Math.min(10, Math.round((seg.stopGainRatioDown ?? 1) * 100) / 100));
                  const openAmount = Math.max(0, seg.stopGainOpenAmount ?? 0);
                  const gainOffset = openAmount * (ru / (ru + rd));
                  const stopOffset = openAmount * (rd / (ru + rd));
                  const midPrice = seg.price1;
                  const priceTop = midPrice + gainOffset;
                  const priceBottom = midPrice - stopOffset;
                  const pa = segmentToPixel(seg.index1, midPrice);
                  const pb = segmentToPixel(seg.index2, midPrice);
                  const paUp = segmentToPixel(seg.index1, priceTop);
                  const pbUp = segmentToPixel(seg.index2, priceTop);
                  const paDn = segmentToPixel(seg.index1, priceBottom);
                  const pbDn = segmentToPixel(seg.index2, priceBottom);
                  const xMin = Math.min(pa.x, pb.x);
                  const xMax = Math.max(pa.x, pb.x);
                  const yTop = Math.min(paUp.y, pbUp.y);
                  const yBottom = Math.max(paDn.y, pbDn.y);
                  const inside = px >= xMin && px <= xMax && py >= yTop && py <= yBottom;
                  d = inside ? 0 : Math.min(d, distanceToSegment(px, py, pa.x, pa.y, pb.x, pb.y), distanceToSegment(px, py, paUp.x, paUp.y, pbUp.x, pbUp.y), distanceToSegment(px, py, paDn.x, paDn.y, pbDn.x, pbDn.y));
                }
                if (seg.type === "rectangle") {
                  const rMinI = Math.min(seg.index1, seg.index2);
                  const rMaxI = Math.max(seg.index1, seg.index2);
                  const rMinP = Math.min(seg.price1, seg.price2);
                  const rMaxP = Math.max(seg.price1, seg.price2);
                  const rTl = segmentToPixel(rMinI, rMaxP);
                  const rBr = segmentToPixel(rMaxI, rMinP);
                  const inside = px >= rTl.x && px <= rBr.x && py >= rTl.y && py <= rBr.y;
                  d = inside ? 0 : Infinity;
                }
                if (seg.type === "verticalLine") {
                  const lineX = segmentToPixel(seg.index1, seg.price1).x;
                  d = Math.abs(px - lineX);
                }
                if (seg.type === "pencil") {
                  const pts = seg.pencilPoints ?? [];
                  d = pts.length >= 2 ? distanceToPencilPath(px, py, pts, segmentToPixel) : Infinity;
                }
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
              if (drawTool === "channel" || drawTool === "stopGain") onChartDrawClick?.();
              setDrawPending({ index1: d.index, price1: d.price });
            } else if (drawTool === "channel") {
              const dfCh = drawDefaults.channel;
              setDrawSegments((seg) => {
                const newSeg: DrawSegment = { index1: drawPending.index1, price1: drawPending.price1, index2: d.index, price2: d.price, type: "channel", color: dfCh?.color ?? DEFAULT_SEGMENT_COLOR, channelOffset: 0, channelExtremityColor: dfCh?.channelExtremityColor ?? dfCh?.color ?? DEFAULT_SEGMENT_COLOR, channelMidStrokeWidth: dfCh?.channelMidStrokeWidth ?? "thin", channelExtremityStrokeWidth: dfCh?.channelExtremityStrokeWidth ?? "thin", showValues: dfCh?.showValues ?? false };
                const newIndex = seg.length;
                onSegmentCreated?.(newIndex);
                return [...seg, newSeg];
              });
              setDrawPending(null);
            } else if (drawTool === "stopGain") {
              const i1 = Math.min(drawPending.index1, d.index);
              const i2 = Math.max(drawPending.index1, d.index);
              const midPrice = drawPending.price1;
              const dfSg = drawDefaults.stopGain;
              setDrawSegments((seg) => {
                const newSeg: DrawSegment = { index1: i1, price1: midPrice, index2: i2, price2: midPrice, type: "stopGain", stopGainRatioUp: dfSg?.stopGainRatioUp ?? 1, stopGainRatioDown: dfSg?.stopGainRatioDown ?? 1, stopGainOpenAmount: 0, stopGainFillOpacity: dfSg?.stopGainFillOpacity ?? 0.5, stopGainShowPercent: dfSg?.stopGainShowPercent ?? false, stopGainShowValuesOnYAxis: dfSg?.stopGainShowValuesOnYAxis ?? false, stopGainStrokeWidth: dfSg?.stopGainStrokeWidth ?? "medium" };
                const newIndex = seg.length;
                onSegmentCreated?.(newIndex);
                return [...seg, newSeg];
              });
              setDrawPending(null);
              setDrawPendingStopGainSecond(null);
            }
          }}
        />
      )}
    </>
  );
}
