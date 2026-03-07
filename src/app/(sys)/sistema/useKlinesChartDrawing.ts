"use client";

/**
 * Hook com estado e lógica de desenho no gráfico (segmentos de reta, seleção, arraste).
 * O chart preenche drawConversionRef e drawSnapPointsRef a cada render.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { DrawSegment, DrawConversionParams } from "./KlinesChartDrawing";

export type DrawTool = "line" | "fibonacci" | "select";

export function useKlinesChartDrawing(chartSvgRef: React.RefObject<SVGSVGElement | null>) {
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawMagnetic, setDrawMagnetic] = useState(true);
  const [drawSegments, setDrawSegments] = useState<DrawSegment[]>([]);
  const [drawPending, setDrawPending] = useState<{ index1: number; price1: number } | null>(null);
  const [drawTool, setDrawTool] = useState<DrawTool>("line");
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [drawDragging, setDrawDragging] = useState<{ segmentIndex: number; point: 0 | 1 } | null>(null);

  const drawRef = useRef<HTMLDivElement>(null);
  const drawConversionRef = useRef<DrawConversionParams | null>(null);
  const drawSnapPointsRef = useRef<{ index: number; price: number }[]>([]);
  const lastDragPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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
        if (drawDragging.point === 0) {
          s.index1 = idx;
          s.price1 = price;
        } else {
          s.index2 = idx;
          s.price2 = price;
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
  }, []);

  const selectFibonacciTool = useCallback(() => {
    setDrawTool("fibonacci");
    setDrawMode(true);
    setSelectedSegmentIndex(null);
  }, []);

  const selectSelectTool = useCallback(() => {
    setDrawTool("select");
    setDrawMode(true);
    setDrawPending(null);
  }, []);

  const clearAllDrawing = useCallback(() => {
    setDrawSegments([]);
    setDrawPending(null);
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
    setDrawMagnetic,
    drawSegments,
    setDrawSegments,
    drawPending,
    setDrawPending,
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
    selectSelectTool,
    clearAllDrawing,
  };
}
