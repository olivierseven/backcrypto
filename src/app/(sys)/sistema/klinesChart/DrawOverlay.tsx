"use client";

/**
 * Overlay de desenho: preview do segmento em construção (draw-pending) e rect transparente
 * com pointer down/move/up + hit-test para seleção e criação de segmentos.
 * Extraído de KlinesChartSvg para reduzir tamanho e isolar responsabilidade.
 */
import { type RefObject } from "react";
import { flushSync } from "react-dom";
import { MARGIN_LEFT, MARGIN_TOP } from "../KlinesChartConstants";
import { distanceToSegment, DEFAULT_SEGMENT_COLOR, type DrawSegment, type DrawDefaults } from "../KlinesChartDrawing";
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
  drawTool: "line" | "fibonacci" | "channel" | "rectangle" | "horizontalLine" | "verticalLine" | "select";
  drawPending: { index1: number; price1: number } | null;
  setDrawPending: (p: { index1: number; price1: number } | null) => void;
  drawPendingRectSecond: { index: number; price: number } | null;
  setDrawPendingRectSecond: (p: { index: number; price: number } | null) => void;
  drawPendingFibSecond: { index: number; price: number } | null;
  setDrawPendingFibSecond: (p: { index: number; price: number } | null) => void;
  drawPendingLineSecond: { index: number; price: number } | null;
  setDrawPendingLineSecond: (p: { index: number; price: number } | null) => void;
  drawPendingChannelSecond: { index: number; price: number } | null;
  setDrawPendingChannelSecond: (p: { index: number; price: number } | null) => void;
  drawPendingHorizontalSecond: { index: number; price: number } | null;
  setDrawPendingHorizontalSecond: (p: { index: number; price: number } | null) => void;
  segmentToPixel: (index: number, price: number) => { x: number; y: number };
  snapToCandlePoint: (px: number, py: number) => { index: number; price: number };
  drawSegments: DrawSegment[];
  setDrawSegments: React.Dispatch<React.SetStateAction<DrawSegment[]>>;
  drawDefaults: DrawDefaults;
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
  drawPendingLineSecond,
  setDrawPendingLineSecond,
  drawPendingChannelSecond,
  setDrawPendingChannelSecond,
  drawPendingHorizontalSecond,
  setDrawPendingHorizontalSecond,
  segmentToPixel,
  snapToCandlePoint,
  drawSegments,
  setDrawSegments,
  drawDefaults,
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
  return (
    <>
      {/* Preview: primeiro ponto */}
      {drawPending && (() => {
        const p = segmentToPixel(drawPending.index1, drawPending.price1);
        return <circle cx={p.x} cy={p.y} r={4} fill="none" stroke="#000000" strokeWidth={1} />;
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
      {drawPending && drawTool === "line" && drawPendingLineSecond && (() => {
        const p1 = segmentToPixel(drawPending.index1, drawPending.price1);
        const p2 = segmentToPixel(drawPendingLineSecond.index, drawPendingLineSecond.price);
        return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#000000" strokeWidth={1} strokeDasharray="4 2" />;
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
      {drawPending && drawTool === "horizontalLine" && drawPendingHorizontalSecond && (() => {
        const p1 = segmentToPixel(drawPending.index1, drawPending.price1);
        const p2 = segmentToPixel(drawPendingHorizontalSecond.index, drawPending.price1);
        return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#000000" strokeWidth={1} strokeDasharray="4 2" />;
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
            if ((drawTool === "rectangle" || drawTool === "fibonacci" || drawTool === "line" || drawTool === "channel" || drawTool === "horizontalLine" || drawTool === "verticalLine") && drawPending === null) {
              if (e.cancelable) e.preventDefault();
              const d = snapToCandlePoint(px, py);
              setDrawPending({ index1: d.index, price1: d.price });
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
              if (d < bestD) {
                bestD = d;
                bestIdx = index;
              }
            });
            if (bestIdx < 0) {
              selectPanLastClientXRef.current = e.clientX;
              setSelectPanActive(true);
            }
          }}
          onPointerMove={(e) => {
            if ((drawTool !== "rectangle" && drawTool !== "fibonacci" && drawTool !== "line" && drawTool !== "channel" && drawTool !== "horizontalLine" && drawTool !== "verticalLine") || drawPending === null) return;
            if (e.cancelable) e.preventDefault();
            const point = getSvgPoint(chartSvgRef, e.clientX, e.clientY);
            if (!point) return;
            const d = snapToCandlePoint(point.px, point.py);
            if (drawTool === "rectangle") setDrawPendingRectSecond({ index: d.index, price: d.price });
            else if (drawTool === "fibonacci") setDrawPendingFibSecond({ index: d.index, price: d.price });
            else if (drawTool === "line") setDrawPendingLineSecond({ index: d.index, price: d.price });
            else if (drawTool === "channel") setDrawPendingChannelSecond({ index: d.index, price: d.price });
            else if (drawTool === "horizontalLine") setDrawPendingHorizontalSecond({ index: d.index, price: drawPending.price1 });
            else if (drawTool === "verticalLine") setDrawPending({ index1: d.index, price1: drawPending.price1 });
          }}
          onPointerUp={(e) => {
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
          }}
          onClick={(e) => {
            if (justPannedRef.current) {
              justPannedRef.current = false;
              return;
            }
            if (drawTool === "rectangle" || drawTool === "fibonacci" || drawTool === "line" || drawTool === "horizontalLine" || drawTool === "verticalLine") return;
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
              if (drawTool === "channel") onChartDrawClick?.();
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
            }
          }}
        />
      )}
    </>
  );
}
