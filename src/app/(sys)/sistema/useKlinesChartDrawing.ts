"use client";

/**
 * Hook com estado e lógica de desenho no gráfico (segmentos de reta, seleção, arraste).
 * O chart preenche drawConversionRef e drawSnapPointsRef a cada render.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { DrawSegment, DrawConversionParams } from "./KlinesChartDrawing";
import { KLINE_DRAW_MAGNETIC_KEY } from "./KlinesChartConstants";

export type DrawTool = "line" | "fibonacci" | "channel" | "rectangle" | "horizontalLine" | "verticalLine" | "select";

function getInitialDrawMagnetic(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(KLINE_DRAW_MAGNETIC_KEY);
    if (v === "false") return false;
    if (v === "true") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function useKlinesChartDrawing(chartSvgRef: React.RefObject<SVGSVGElement | null>) {
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawMagnetic, setDrawMagneticState] = useState(getInitialDrawMagnetic);
  const [drawSegments, setDrawSegments] = useState<DrawSegment[]>([]);
  const [drawPending, setDrawPending] = useState<{ index1: number; price1: number } | null>(null);
  const [drawPendingRectSecond, setDrawPendingRectSecond] = useState<{ index: number; price: number } | null>(null);
  const [drawPendingFibSecond, setDrawPendingFibSecond] = useState<{ index: number; price: number } | null>(null);
  const [drawPendingLineSecond, setDrawPendingLineSecond] = useState<{ index: number; price: number } | null>(null);
  const [drawPendingChannelSecond, setDrawPendingChannelSecond] = useState<{ index: number; price: number } | null>(null);
  const [drawPendingHorizontalSecond, setDrawPendingHorizontalSecond] = useState<{ index: number; price: number } | null>(null);
  const [drawTool, setDrawTool] = useState<DrawTool>("line");
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [drawDragging, setDrawDragging] = useState<{ segmentIndex: number; point: 0 | 1 | "extension" | "fibLevel1" | "channelMid" | "channelExtension" | "horizontalLineMove" | "verticalLineMove" } | null>(null);

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
          if (s.type !== "fibonacci") return prev;
          const ext = Math.max(0, idx - s.index2);
          s.fibExtensionIndices = ext;
        } else if (drawDragging.point === "fibLevel1") {
          if (s.type !== "fibonacci") return prev;
          const range = s.price1 - s.price2;
          if (Math.abs(range) < 1e-12) return prev;
          const pct = ((price - s.price2) / range) * 100;
          const rounded = Math.round(Math.max(0, Math.min(50, pct)) * 10000) / 10000;
          s.fibLevelPct1 = rounded;
        } else if (drawDragging.point === "channelMid") {
          if (s.type !== "channel") return prev;
          const midPrice = (s.price1 + s.price2) / 2;
          s.channelOffset = Math.round((price - midPrice) * 10000) / 10000;
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
        } else if (drawDragging.point === 0) {
          s.index1 = idx;
          if (s.type !== "horizontalLine" && s.type !== "verticalLine") s.price1 = price;
          if (s.type === "verticalLine") s.index2 = idx;
        } else {
          s.index2 = idx;
          if (s.type !== "horizontalLine") s.price2 = price;
          if (s.type === "verticalLine") s.index1 = idx;
        }
        next[segIdx] = s;
        return next;
      });
    };
    const onUp = () => setDrawDragging(null);
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
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingHorizontalSecond(null);
  }, []);

  const selectFibonacciTool = useCallback(() => {
    setDrawTool("fibonacci");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingHorizontalSecond(null);
  }, []);

  const selectChannelTool = useCallback(() => {
    setDrawTool("channel");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingHorizontalSecond(null);
  }, []);

  const selectHorizontalLineTool = useCallback(() => {
    setDrawTool("horizontalLine");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingHorizontalSecond(null);
  }, []);

  const selectVerticalLineTool = useCallback(() => {
    setDrawTool("verticalLine");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingHorizontalSecond(null);
  }, []);

  const selectSelectTool = useCallback(() => {
    setDrawTool("select");
    setDrawMode(true);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingHorizontalSecond(null);
  }, []);

  const selectRectangleTool = useCallback(() => {
    setDrawTool("rectangle");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingHorizontalSecond(null);
  }, []);

  const clearAllDrawing = useCallback(() => {
    setDrawSegments([]);
    setDrawPending(null);
    setDrawPendingRectSecond(null);
    setDrawPendingFibSecond(null);
    setDrawPendingLineSecond(null);
    setDrawPendingChannelSecond(null);
    setDrawPendingHorizontalSecond(null);
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
    drawPendingLineSecond,
    setDrawPendingLineSecond,
    drawPendingChannelSecond,
    setDrawPendingChannelSecond,
    drawPendingHorizontalSecond,
    setDrawPendingHorizontalSecond,
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
    selectChannelTool,
    selectHorizontalLineTool,
    selectVerticalLineTool,
    selectRectangleTool,
    selectSelectTool,
    clearAllDrawing,
  };
}
