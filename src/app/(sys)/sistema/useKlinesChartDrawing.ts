"use client";

/**
 * Hook com estado e lógica de desenho no gráfico (segmentos de reta, seleção, arraste).
 * O chart preenche drawConversionRef e drawSnapPointsRef a cada render.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { isDrawSegmentSharedAcrossIntervals, type DrawSegment, type DrawConversionParams } from "./KlinesChartDrawing";
import { KLINE_DRAW_MAGNETIC_KEY } from "./KlinesChartConstants";
import type { DrawDraggingPoint } from "./klinesChart/DrawSegmentHandles";

export type DrawTool = "line" | "fibonacci" | "freeRetracement" | "channel" | "stopGain" | "rectangle" | "horizontalLine" | "verticalLine" | "arrow" | "text" | "ruler" | "select" | "pencil";

function getInitialDrawMagnetic(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(KLINE_DRAW_MAGNETIC_KEY);
    if (v === "false") return false;
    if (v === "true") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function useKlinesChartDrawing(chartSvgRef: React.RefObject<SVGSVGElement | null>) {
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawMagnetic, setDrawMagneticState] = useState(getInitialDrawMagnetic);
  const [drawSegments, setDrawSegments] = useState<DrawSegment[]>([]);
  const [drawPending, setDrawPending] = useState<{ index1: number; price1: number } | null>(null);
  const [drawPendingRectSecond, setDrawPendingRectSecond] = useState<{ index: number; price: number } | null>(null);
  const [drawPendingFibSecond, setDrawPendingFibSecond] = useState<{ index: number; price: number } | null>(null);
  const [drawPendingFreeRetraceSecond, setDrawPendingFreeRetraceSecond] = useState<{ index: number; price: number } | null>(null);
  const [drawPendingLineSecond, setDrawPendingLineSecond] = useState<{ index: number; price: number } | null>(null);
  const [drawPendingChannelSecond, setDrawPendingChannelSecond] = useState<{ index: number; price: number } | null>(null);
  const [drawPendingStopGainSecond, setDrawPendingStopGainSecond] = useState<{ index: number; price: number } | null>(null);
  const [drawPendingHorizontalSecond, setDrawPendingHorizontalSecond] = useState<{ index: number; price: number } | null>(null);
  const [drawPendingArrow, setDrawPendingArrow] = useState<{ index1: number; price1: number; angleRad: number } | null>(null);
  const [drawPendingText, setDrawPendingText] = useState<{ index1: number; price1: number } | null>(null);
  const [drawPendingPencil, setDrawPendingPencil] = useState<{ index: number; price: number }[] | null>(null);
  const [drawTool, setDrawTool] = useState<DrawTool>("line");
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [drawDragging, setDrawDragging] = useState<{ segmentIndex: number; point: DrawDraggingPoint } | null>(null);
  const pencilDragStartRef = useRef<{ index: number; price: number } | null>(null);

  const drawRef = useRef<HTMLDivElement>(null);
  const drawConversionRef = useRef<DrawConversionParams | null>(null);
  const drawSnapPointsRef = useRef<{ index: number; price: number }[]>([]);
  const lastDragPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(KLINE_DRAW_MAGNETIC_KEY, String(drawMagnetic));
    } catch {
      /* ignore */
    }
  }, [drawMagnetic]);

  const dataToPixel = useCallback((c: DrawConversionParams, index: number, price: number) => {
    const x = c.MARGIN_LEFT + (index - c.startIndex + 0.5) * c.gap;
    const y = c.logScale
      ? c.MARGIN_TOP + c.chartH - ((Math.log(Math.max(price, 0.001)) - c.yLogMin) / c.yLogRange) * c.chartH
      : c.MARGIN_TOP + c.chartH - ((price - c.yMin) / c.yRange) * c.chartH;
    return { x, y };
  }, []);

  useEffect(() => {
    if (drawDragging === null || !chartSvgRef.current) return;
    const svg = chartSvgRef.current;
    const toSvg = (clientX: number, clientY: number) => {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svg.getScreenCTM()?.inverse();
      return ctm ? pt.matrixTransform(ctm) : { x: 0, y: 0 };
    };
    const getCoords = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ("touches" in e && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if ("clientX" in e) return { x: e.clientX, y: e.clientY };
      return null;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      const coords = getCoords(e);
      if (!coords) return;
      if (e.cancelable && "touches" in e) e.preventDefault();
      const p = toSvg(coords.x, coords.y);
      lastDragPosRef.current = { x: p.x, y: p.y };
      setDrawSegments((prev) => {
        const c = drawConversionRef.current;
        if (!c) return prev;
        let idx: number;
        let price: number;
        if (c.drawMagnetic && drawSnapPointsRef.current.length > 0) {
          const snap = drawSnapPointsRef.current;
          let best = snap[0];
          let bestD = Infinity;
          for (const pt of snap) {
            const screen = dataToPixel(c, pt.index, pt.price);
            const d = (p.x - screen.x) ** 2 + (p.y - screen.y) ** 2;
            if (d < bestD) {
              bestD = d;
              best = pt;
            }
          }
          idx = best.index;
          price = best.price;
        } else {
          idx = Math.max(0, Math.min(c.maxDrawIndex, Math.round((p.x - c.MARGIN_LEFT) / c.gap - 0.5) + c.startIndex));
          price = c.logScale
            ? Math.exp(c.yLogMin + (1 - (p.y - c.MARGIN_TOP) / c.chartH) * c.yLogRange)
            : c.yMin + (1 - (p.y - c.MARGIN_TOP) / c.chartH) * c.yRange;
        }
        const next = [...prev];
        const segIdx = drawDragging.segmentIndex;
        if (segIdx < 0 || segIdx >= next.length) return prev;
        const s = { ...next[segIdx] };
        if (drawDragging.point === "extension") {
          if (s.type === "fibonacci") {
            const ext = Math.max(0, idx - s.index2);
            s.fibExtensionIndices = ext;
          } else if (s.type === "freeRetracement") {
            const ext = Math.max(0, idx - s.index2);
            s.freeRetracementExtensionIndices = ext;
          } else return prev;
        } else if (drawDragging.point === "fibLevel1") {
          if (s.type !== "fibonacci") return prev;
          const range = s.price1 - s.price2;
          if (Math.abs(range) < 1e-12) return prev;
          const pct = ((price - s.price2) / range) * 100;
          const rounded = Math.round(Math.max(0, Math.min(50, pct)) * 10000) / 10000;
          s.fibLevelPct1 = rounded;
        } else if (drawDragging.point === "freeRetracementLevel1") {
          if (s.type !== "freeRetracement") return prev;
          const range = s.price1 - s.price2;
          if (Math.abs(range) < 1e-12) return prev;
          const pct = ((price - s.price2) / range) * 100;
          const rounded = Math.round(Math.max(0, Math.min(50, pct)) * 10000) / 10000;
          s.freeRetracementLevelPct1 = rounded;
        } else if (drawDragging.point === "freeRetracementLevel") {
          if (s.type !== "freeRetracement") return prev;
          const range = s.price1 - s.price2;
          if (Math.abs(range) < 1e-12) return prev;
          const pct = ((price - s.price2) / range) * 100;
          const rounded = Math.round(Math.max(50, Math.min(100, pct)) * 10000) / 10000;
          s.freeRetracementLevelPct = rounded;
        } else if (drawDragging.point === "freeRetracementLevelExt") {
          if (s.type !== "freeRetracement") return prev;
          const range = s.price1 - s.price2;
          if (Math.abs(range) < 1e-12) return prev;
          const pct = ((price - s.price2) / range) * 100;
          const rounded = Math.round(Math.max(100, Math.min(200, pct)) * 10000) / 10000;
          s.freeRetracementLevelPctExt = rounded;
        } else if (drawDragging.point === "channelMid") {
          if (s.type !== "channel") return prev;
          const midPrice = (s.price1 + s.price2) / 2;
          s.channelOffset = Math.round((price - midPrice) * 10000) / 10000;
        } else if (drawDragging.point === "stopGainMid") {
          if (s.type !== "stopGain") return prev;
          const midPrice = s.price1;
          s.stopGainOpenAmount = Math.round(Math.max(0, 2 * Math.abs(price - midPrice)) * 10000) / 10000;
        } else if (drawDragging.point === "stopGainMove") {
          if (s.type !== "stopGain") return prev;
          const span = s.index2 - s.index1;
          const halfSpan = span / 2;
          const newIndex1 = Math.max(0, Math.min(c.maxDrawIndex - span, Math.round(idx - halfSpan)));
          s.index1 = newIndex1;
          s.index2 = newIndex1 + span;
          s.price1 = price;
          s.price2 = price;
        } else if (drawDragging.point === "stopGainGainLine") {
          if (s.type !== "stopGain") return prev;
          const midPrice = s.price1;
          const ru = Math.max(1, Math.min(10, Math.round((s.stopGainRatioUp ?? 1) * 100) / 100));
          const rd = Math.max(1, Math.min(10, Math.round((s.stopGainRatioDown ?? 1) * 100) / 100));
          const openAmount = Math.max(0, s.stopGainOpenAmount ?? 0);
          const stopOffset = openAmount * (rd / (ru + rd));
          let gainOffsetNew = Math.max(0, price - midPrice);
          if (stopOffset > 0) {
            const maxGainForRatio10 = (10 * stopOffset) / rd;
            if (gainOffsetNew > maxGainForRatio10) gainOffsetNew = maxGainForRatio10;
          }
          if (stopOffset <= 0) {
            s.stopGainOpenAmount = Math.round(gainOffsetNew * 10000) / 10000;
            s.stopGainRatioUp = 10;
            s.stopGainRatioDown = 1;
          } else {
            const openAmountNew = gainOffsetNew + stopOffset;
            const ruNew = Math.max(1, Math.min(10, Math.round((rd * gainOffsetNew) / stopOffset * 100) / 100));
            s.stopGainOpenAmount = Math.round(openAmountNew * 10000) / 10000;
            s.stopGainRatioUp = ruNew;
          }
        } else if (drawDragging.point === "stopGainStopLine") {
          if (s.type !== "stopGain") return prev;
          const midPrice = s.price1;
          const ru = Math.max(1, Math.min(10, Math.round((s.stopGainRatioUp ?? 1) * 100) / 100));
          const rd = Math.max(1, Math.min(10, Math.round((s.stopGainRatioDown ?? 1) * 100) / 100));
          const openAmount = Math.max(0, s.stopGainOpenAmount ?? 0);
          const gainOffset = openAmount * (ru / (ru + rd));
          let stopOffsetNew = Math.max(0, midPrice - price);
          if (gainOffset > 0) {
            const maxStopForRatio10 = (10 * gainOffset) / ru;
            if (stopOffsetNew > maxStopForRatio10) stopOffsetNew = maxStopForRatio10;
          }
          if (gainOffset <= 0) {
            s.stopGainOpenAmount = Math.round(stopOffsetNew * 10000) / 10000;
            s.stopGainRatioUp = 1;
            s.stopGainRatioDown = 10;
          } else {
            const openAmountNew = gainOffset + stopOffsetNew;
            const rdNew = Math.max(1, Math.min(10, Math.round((ru * stopOffsetNew) / gainOffset * 100) / 100));
            s.stopGainOpenAmount = Math.round(openAmountNew * 10000) / 10000;
            s.stopGainRatioDown = rdNew;
          }
        } else if (drawDragging.point === "channelExtension") {
          if (s.type !== "channel") return prev;
          const ext = Math.max(0, idx - s.index2);
          s.channelExtensionIndices = ext;
        } else if (drawDragging.point === "horizontalLineMove") {
          if (s.type !== "horizontalLine") return prev;
          const span = s.index2 - s.index1;
          const halfSpan = span / 2;
          const newIndex1 = Math.max(0, Math.min(c.maxDrawIndex - span, Math.round(idx - halfSpan)));
          s.index1 = newIndex1;
          s.index2 = newIndex1 + span;
          s.price1 = price;
          s.price2 = price;
        } else if (drawDragging.point === "verticalLineMove") {
          if (s.type !== "verticalLine") return prev;
          const newIndex = Math.max(0, Math.min(c.maxDrawIndex, idx));
          s.index1 = newIndex;
          s.index2 = newIndex;
        } else if (drawDragging.point === "arrowMove" || drawDragging.point === "rectangleMove") {
          if (drawDragging.point === "arrowMove" && s.type !== "arrow") return prev;
          if (drawDragging.point === "rectangleMove" && s.type !== "rectangle") return prev;
          const centerIdx = (s.index1 + s.index2) / 2;
          const centerPrice = (s.price1 + s.price2) / 2;
          const deltaIdx = idx - centerIdx;
          const deltaPrice = price - centerPrice;
          s.index1 = Math.max(0, Math.min(c.maxDrawIndex, Math.round(s.index1 + deltaIdx)));
          s.index2 = Math.max(0, Math.min(c.maxDrawIndex, Math.round(s.index2 + deltaIdx)));
          s.price1 += deltaPrice;
          s.price2 += deltaPrice;
        } else if (drawDragging.point === "textMove") {
          if (s.type !== "text") return prev;
          s.index1 = Math.max(0, Math.min(c.maxDrawIndex, idx));
          s.price1 = price;
          s.index2 = s.index1;
          s.price2 = price;
        } else if (drawDragging.point === "pencilMove") {
          if (s.type !== "pencil" || !s.pencilPoints || s.pencilPoints.length === 0) return prev;
          const start = pencilDragStartRef.current;
          if (start === null) {
            pencilDragStartRef.current = { index: idx, price };
            return prev;
          }
          const deltaIdx = idx - start.index;
          const deltaPrice = price - start.price;
          pencilDragStartRef.current = { index: idx, price };
          s.pencilPoints = s.pencilPoints.map((pt) => ({
            index: Math.max(0, Math.min(c.maxDrawIndex, Math.round(pt.index + deltaIdx))),
            price: pt.price + deltaPrice,
          }));
          const pts = s.pencilPoints;
          s.index1 = pts[0]!.index;
          s.price1 = pts[0]!.price;
          s.index2 = pts[pts.length - 1]!.index;
          s.price2 = pts[pts.length - 1]!.price;
        } else if (drawDragging.point === "pencilStart") {
          if (s.type !== "pencil" || !s.pencilPoints || s.pencilPoints.length === 0) return prev;
          s.index1 = Math.max(0, Math.min(c.maxDrawIndex, idx));
          s.price1 = price;
          s.pencilPoints = [...s.pencilPoints];
          s.pencilPoints[0] = { index: s.index1, price: s.price1 };
        } else if (drawDragging.point === "pencilEnd") {
          if (s.type !== "pencil" || !s.pencilPoints || s.pencilPoints.length === 0) return prev;
          s.index2 = Math.max(0, Math.min(c.maxDrawIndex, idx));
          s.price2 = price;
          s.pencilPoints = [...s.pencilPoints];
          s.pencilPoints[s.pencilPoints.length - 1] = { index: s.index2, price: s.price2 };
        } else if (drawDragging.point === 0) {
          s.index1 = idx;
          if (s.type === "pencil" && s.pencilPoints && s.pencilPoints.length > 0) {
            s.price1 = price;
            s.pencilPoints = [...s.pencilPoints];
            s.pencilPoints[0] = { index: idx, price };
          } else if (s.type !== "horizontalLine" && s.type !== "verticalLine" && s.type !== "stopGain") s.price1 = price;
          if (s.type === "verticalLine") s.index2 = idx;
          if (s.type === "stopGain") {
            s.price1 = price;
            s.price2 = price;
          }
        } else {
          s.index2 = idx;
          if (s.type === "pencil" && s.pencilPoints && s.pencilPoints.length > 0) {
            s.price2 = price;
            s.pencilPoints = [...s.pencilPoints];
            s.pencilPoints[s.pencilPoints.length - 1] = { index: idx, price };
          } else if (s.type !== "horizontalLine" && s.type !== "stopGain") s.price2 = price;
          if (s.type === "verticalLine") s.index1 = idx;
          if (s.type === "stopGain") s.price2 = s.price1;
        }
        next[segIdx] = s;
        return next;
      });
    };
    const onUp = () => {
      pencilDragStartRef.current = null;
      setDrawDragging(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
    document.addEventListener("touchcancel", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
      document.removeEventListener("touchcancel", onUp);
    };
  }, [drawDragging, chartSvgRef, dataToPixel]);

  const openDrawPanel = useCallback(() => {
    setDrawOpen((o) => {
      const next = !o;
      if (!next) setDrawMode(false);
      return next;
    });
  }, []);

  const selectLineTool = useCallback(() => {
    setDrawTool("line");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
    setDrawPendingPencil(null);
  }, []);

  const selectFibonacciTool = useCallback(() => {
    setDrawTool("fibonacci");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
    setDrawPendingPencil(null);
  }, []);

  const selectFreeRetracementTool = useCallback(() => {
    setDrawTool("freeRetracement");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
    setDrawPendingPencil(null);
  }, []);

  const selectChannelTool = useCallback(() => {
    setDrawTool("channel");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
    setDrawPendingPencil(null);
  }, []);

  const selectStopGainTool = useCallback(() => {
    setDrawTool("stopGain");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
    setDrawPendingPencil(null);
  }, []);

  const selectHorizontalLineTool = useCallback(() => {
    setDrawTool("horizontalLine");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
    setDrawPendingPencil(null);
  }, []);

  const selectVerticalLineTool = useCallback(() => {
    setDrawTool("verticalLine");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
    setDrawPendingPencil(null);
  }, []);

  const selectTextTool = useCallback(() => {
    setDrawTool("text");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
  }, []);

  const selectArrowTool = useCallback(() => {
    setDrawTool("arrow");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
    setDrawPendingPencil(null);
  }, []);

  const selectRulerTool = useCallback(() => {
    setDrawTool("ruler");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
    setDrawPendingPencil(null);
  }, []);

  const selectSelectTool = useCallback(() => {
    setDrawTool("select");
    setDrawMode(true);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
    setDrawPendingPencil(null);
  }, []);

  const selectRectangleTool = useCallback(() => {
    setDrawTool("rectangle");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
    setDrawPendingPencil(null);
  }, []);

  const selectPencilTool = useCallback(() => {
    setDrawTool("pencil");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
    setDrawPendingPencil(null);
  }, []);

  const clearAllDrawing = useCallback(() => {
    setDrawSegments([]);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
    setDrawPendingPencil(null);
    setSelectedSegmentIndex(null);
    setDrawDragging(null);
  }, []);

  /** Remove só desenhos do intervalo atual; mantém retas H/V marcadas para todos os períodos. */
  const clearDrawingsForCurrentInterval = useCallback(() => {
    setDrawSegments((prev) => prev.filter(isDrawSegmentSharedAcrossIntervals));
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingFreeRetraceSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingStopGainSecond(null);
    setDrawPendingHorizontalSecond(null);
    setDrawPendingArrow(null);
    setDrawPendingText(null);
    setDrawPendingPencil(null);
    setSelectedSegmentIndex(null);
    setDrawDragging(null);
  }, []);

  const closeDrawMode = useCallback(() => setDrawMode(false), []);

  return {
    drawOpen,
    setDrawOpen,
    drawMode,
    setDrawMode,
    closeDrawMode,
    drawTool,
    drawMagnetic,
    setDrawMagnetic: setDrawMagneticState,
    drawSegments,
    setDrawSegments,
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
    selectedSegmentIndex,
    setSelectedSegmentIndex,
    drawDragging,
    setDrawDragging,
    drawRef,
    drawConversionRef,
    drawSnapPointsRef,
    lastDragPosRef,
    openDrawPanel,
    selectLineTool,
    selectFibonacciTool,
    selectFreeRetracementTool,
    selectChannelTool,
    selectStopGainTool,
    selectHorizontalLineTool,
    selectVerticalLineTool,
    selectArrowTool,
    selectTextTool,
    selectRulerTool,
    selectRectangleTool,
    selectPencilTool,
    selectSelectTool,
    clearAllDrawing,
    clearDrawingsForCurrentInterval,
  };
}
