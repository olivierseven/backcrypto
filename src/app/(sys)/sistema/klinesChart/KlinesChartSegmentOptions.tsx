"use client";

/**
 * Painel flutuante de opções do segmento selecionado (cor, tipo de traço, espessura, excluir).
 * Extraído de KlinesChart para reduzir tamanho do arquivo principal.
 */
import { useState, useEffect, useCallback, type RefObject } from "react";
import { KLINE_SEGMENT_OPTIONS_COLLAPSED_KEY } from "../KlinesChartConstants";
import type { DrawSegment, FibStrokeWidth, SegmentCap, ArrowSize } from "../KlinesChartDrawing";
import { FIB_STROKE_WIDTH_OPTIONS, ARROW_SIZE_OPTIONS, ARROW_LENGTH_PX, TEXT_SIZE_OPTIONS, type TextSize } from "../KlinesChartDrawing";
import { DEFAULT_SEGMENT_COLOR } from "../KlinesChartDrawing";
import { SEGMENT_COLOR_PALETTE, SEGMENT_CAP_OPTIONS } from "./palettes";

export interface KlinesChartSegmentOptionsProps {
  segmentOptionsRef: RefObject<HTMLDivElement | null>;
  segmentOptionsPosition: { x: number; y: number } | null;
  setSegmentOptionsPosition: (v: { x: number; y: number } | null | ((prev: { x: number; y: number } | null) => { x: number; y: number } | null)) => void;
  chartRowRef: RefObject<HTMLDivElement | null>;
  drawSegments: DrawSegment[];
  selectedSegmentIndex: number | null;
  setDrawSegments: React.Dispatch<React.SetStateAction<DrawSegment[]>>;
  setSelectedSegmentIndex: (i: number | null) => void;
  persistDrawDefault: (type: "segment" | "fibonacci" | "freeRetracement" | "channel" | "stopGain" | "rectangle" | "horizontalLine" | "verticalLine" | "arrow" | "text" | "pencil", partial: Partial<DrawSegment>) => void;
  segmentToPixel: (index: number, price: number) => { x: number; y: number };
  pixelToData: (x: number, y: number) => { index: number; price: number };
  t: Record<string, string>;
  /** Quando true, fecha os listboxes (ex.: ao recolher a toolbox no sidebar). */
  segmentToolboxCollapsed?: boolean;
}

export function KlinesChartSegmentOptions({
  segmentOptionsRef,
  segmentOptionsPosition,
  setSegmentOptionsPosition,
  chartRowRef,
  drawSegments,
  selectedSegmentIndex,
  setDrawSegments,
  setSelectedSegmentIndex,
  persistDrawDefault,
  segmentToPixel,
  pixelToData,
  t,
  segmentToolboxCollapsed = false,
}: KlinesChartSegmentOptionsProps) {
  const [segmentColorListboxOpen, setSegmentColorListboxOpen] = useState(false);
  const [fibLevel618ColorListboxOpen, setFibLevel618ColorListboxOpen] = useState(false);
  const [channelExtremityColorListboxOpen, setChannelExtremityColorListboxOpen] = useState(false);

  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem(KLINE_SEGMENT_OPTIONS_COLLAPSED_KEY);
      return raw === "true";
    } catch {
      return false;
    }
  });

  const setCollapsed = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      try {
        if (typeof window !== "undefined") window.localStorage.setItem(KLINE_SEGMENT_OPTIONS_COLLAPSED_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (segmentToolboxCollapsed) {
      setSegmentColorListboxOpen(false);
      setFibLevel618ColorListboxOpen(false);
      setChannelExtremityColorListboxOpen(false);
    }
  }, [segmentToolboxCollapsed]);

  if (selectedSegmentIndex === null || !drawSegments[selectedSegmentIndex]) return null;

  const tAs = t as Record<string, string>;

  const colorLabel =
    drawSegments[selectedSegmentIndex]?.type === "fibonacci"
      ? t.fibonacciColor
      : drawSegments[selectedSegmentIndex]?.type === "freeRetracement"
      ? (tAs.freeRetracementColor ?? "Retração livre")
      : drawSegments[selectedSegmentIndex]?.type === "channel"
        ? tAs.channelMiddleColor ?? "Linha do meio"
        : drawSegments[selectedSegmentIndex]?.type === "stopGain"
          ? tAs.stopGainTool ?? "Stop/Gain"
          : drawSegments[selectedSegmentIndex]?.type === "rectangle"
          ? tAs.rectangleColor ?? t.segmentColor
          : drawSegments[selectedSegmentIndex]?.type === "horizontalLine"
            ? tAs.horizontalLineColor ?? t.segmentColor
            : drawSegments[selectedSegmentIndex]?.type === "verticalLine"
              ? tAs.verticalLineColor ?? t.segmentColor
              : drawSegments[selectedSegmentIndex]?.type === "arrow"
                ? tAs.arrowColor ?? t.segmentColor
                : drawSegments[selectedSegmentIndex]?.type === "text"
                  ? tAs.textColor ?? t.segmentColor
                  : drawSegments[selectedSegmentIndex]?.type === "pencil"
                    ? tAs.pencilColor ?? t.segmentColor
                    : t.segmentColor;

  return (
    <div
      ref={segmentOptionsRef}
      className="absolute z-[100] rounded-lg border border-zinc-200 bg-white shadow-lg overflow-hidden w-fit min-w-0 max-w-[180px]"
      style={segmentOptionsPosition === null ? { left: 8, top: 8 } : { left: segmentOptionsPosition.x, top: segmentOptionsPosition.y }}
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label={t.segmentOptionsTitle}
    >
      <div className="flex items-center justify-between gap-0.5 bg-zinc-50 border-b border-zinc-200 px-1.5 py-1">
        <span className="text-[11px] font-medium text-zinc-600 truncate min-w-0 flex-1">{t.segmentOptionsTitle}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
          className="p-0.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 text-base leading-none shrink-0"
          title={collapsed ? (tAs.segmentOptionsExpand ?? "Expandir") : (tAs.segmentOptionsCollapse ?? "Recolher")}
          aria-label={collapsed ? (tAs.segmentOptionsExpand ?? "Expandir") : (tAs.segmentOptionsCollapse ?? "Recolher")}
          aria-expanded={!collapsed}
        >
          <span aria-hidden>{collapsed ? "▶" : "▼"}</span>
        </button>
        <div
          role="button"
          tabIndex={0}
          className="p-0.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 text-base leading-none cursor-grab active:cursor-grabbing select-none touch-none shrink-0"
          title={t.drawToolboxDrag}
          aria-label={t.drawToolboxDrag}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!segmentOptionsRef.current || !chartRowRef.current) return;
            const currentX = segmentOptionsPosition?.x ?? 8;
            const currentY = segmentOptionsPosition?.y ?? 8;
            if (segmentOptionsPosition === null) setSegmentOptionsPosition({ x: currentX, y: currentY });
            const startClientX = e.clientX;
            const startClientY = e.clientY;
            const startX = currentX;
            const startY = currentY;
            const onMove = (ev: PointerEvent) => {
              if (!segmentOptionsRef.current || !chartRowRef.current) return;
              if (ev.cancelable) ev.preventDefault();
              const boxRect = segmentOptionsRef.current.getBoundingClientRect();
              const rowRect = chartRowRef.current.getBoundingClientRect();
              const cw = rowRect.width;
              const ch = rowRect.height;
              let newX = startX + (ev.clientX - startClientX);
              let newY = startY + (ev.clientY - startClientY);
              newX = Math.max(0, Math.min(cw - boxRect.width, newX));
              newY = Math.max(0, Math.min(ch - boxRect.height, newY));
              setSegmentOptionsPosition({ x: newX, y: newY });
            };
            const onUp = () => {
              document.removeEventListener("pointermove", onMove);
              document.removeEventListener("pointerup", onUp);
              document.removeEventListener("pointercancel", onUp);
            };
            document.addEventListener("pointermove", onMove);
            document.addEventListener("pointerup", onUp);
            document.addEventListener("pointercancel", onUp);
          }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.preventDefault(); }}
        >
          <span aria-hidden>⠿</span>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSelectedSegmentIndex(null); }}
          className="p-0.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 text-base leading-none font-semibold shrink-0"
          title={t.drawExitMode}
          aria-label={t.drawExitMode}
        >
          <span aria-hidden>×</span>
        </button>
      </div>
      {!collapsed && (
      <div className="py-1.5 px-1.5 space-y-1.5">
        <div>
          <div className="text-[10px] font-medium text-zinc-500 pb-0.5">{colorLabel}</div>
          <div className="relative">
            <button
              type="button"
              role="combobox"
              aria-expanded={segmentColorListboxOpen}
              aria-haspopup="listbox"
              aria-label={colorLabel}
              onClick={() => setSegmentColorListboxOpen((o) => !o)}
              className="w-full flex items-center gap-1.5 rounded border border-zinc-300 px-1.5 py-1 bg-white text-left min-h-[24px]"
            >
              <span
                className="w-4 h-4 rounded border border-zinc-300 shrink-0"
                style={{ backgroundColor: drawSegments[selectedSegmentIndex]?.color ?? DEFAULT_SEGMENT_COLOR }}
              />
              <span className="text-zinc-500 text-xs shrink-0 ml-auto" aria-hidden>{segmentColorListboxOpen ? "▲" : "▼"}</span>
            </button>
            {segmentColorListboxOpen && (
              <div
                role="listbox"
                aria-label={colorLabel}
                className="absolute left-0 top-full mt-0.5 z-20 grid grid-cols-3 gap-1 p-1 rounded border border-zinc-200 bg-white shadow-lg"
              >
                {SEGMENT_COLOR_PALETTE.map((hex) => {
                  const isSelected = (drawSegments[selectedSegmentIndex]?.color ?? DEFAULT_SEGMENT_COLOR) === hex;
                  return (
                    <button
                      key={hex}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      aria-label={colorLabel}
                      onClick={() => {
                        const segType = (drawSegments[selectedSegmentIndex]?.type ?? "segment") as "segment" | "fibonacci" | "freeRetracement" | "channel" | "stopGain" | "rectangle" | "horizontalLine" | "verticalLine" | "arrow" | "text" | "pencil";
                        setDrawSegments((prev) => {
                          const next = [...prev];
                          const seg = next[selectedSegmentIndex];
                          if (seg) next[selectedSegmentIndex] = { ...seg, color: hex };
                          return next;
                        });
                        persistDrawDefault(segType, { color: hex });
                        setSegmentColorListboxOpen(false);
                      }}
                      className={`w-5 h-5 rounded border-2 shrink-0 hover:opacity-90 ${isSelected ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                      style={{ backgroundColor: hex }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {drawSegments[selectedSegmentIndex]?.type === "horizontalLine" && (
          <>
            <div>
              <div className="text-[10px] font-medium text-zinc-500 pb-0.5">{tAs.horizontalLineStrokeStyle ?? "Tipo de traço"}</div>
              <select
                id="horizontal-line-stroke-style-listbox"
                value={(drawSegments[selectedSegmentIndex] as DrawSegment & { horizontalLineStrokeStyle?: "solid" | "dashed" | "dotted" })?.horizontalLineStrokeStyle ?? "solid"}
                onChange={(e) => {
                  const v = e.target.value as "solid" | "dashed" | "dotted";
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, horizontalLineStrokeStyle: v };
                    return next;
                  });
                  persistDrawDefault("horizontalLine", { horizontalLineStrokeStyle: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={tAs.horizontalLineStrokeStyle ?? "Tipo de traço"}
              >
                <option value="solid">{tAs.strokeSolid ?? "Contínuo"}</option>
                <option value="dashed">{tAs.strokeDashed ?? "Tracejado"}</option>
                <option value="dotted">{tAs.strokeDotted ?? "Pontilhado"}</option>
              </select>
            </div>
            <div>
              <div className="text-[10px] font-medium text-zinc-500 pb-0.5">{tAs.horizontalLineStrokeWidth ?? "Espessura"}</div>
              <select
                id="horizontal-line-stroke-width-listbox"
                value={(drawSegments[selectedSegmentIndex] as DrawSegment & { horizontalLineStrokeWidth?: FibStrokeWidth })?.horizontalLineStrokeWidth ?? "medium"}
                onChange={(e) => {
                  const v = e.target.value as FibStrokeWidth;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, horizontalLineStrokeWidth: v };
                    return next;
                  });
                  persistDrawDefault("horizontalLine", { horizontalLineStrokeWidth: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={tAs.horizontalLineStrokeWidth ?? "Espessura"}
              >
                {FIB_STROKE_WIDTH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{tAs[`stroke${opt.charAt(0).toUpperCase()}${opt.slice(1)}`] ?? opt}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={(drawSegments[selectedSegmentIndex] as DrawSegment & { horizontalLineShowValue?: boolean })?.horizontalLineShowValue === true}
                onChange={(e) => {
                  const v = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, horizontalLineShowValue: v };
                    return next;
                  });
                  persistDrawDefault("horizontalLine", { horizontalLineShowValue: v });
                }}
                className="rounded border-zinc-300"
                aria-label={tAs.horizontalLineShowValue ?? "Mostrar valor"}
              />
              <span className="text-xs text-zinc-700">{tAs.horizontalLineShowValue ?? "Mostrar valor"}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={(drawSegments[selectedSegmentIndex] as DrawSegment & { horizontalLineExtendToEnd?: boolean })?.horizontalLineExtendToEnd === true}
                onChange={(e) => {
                  const v = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, horizontalLineExtendToEnd: v };
                    return next;
                  });
                  persistDrawDefault("horizontalLine", { horizontalLineExtendToEnd: v });
                }}
                className="rounded border-zinc-300"
                aria-label={tAs.horizontalLineExtendToEnd ?? "Estender até o fim"}
              />
              <span className="text-xs text-zinc-700">{tAs.horizontalLineExtendToEnd ?? "Estender até o fim"}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={(drawSegments[selectedSegmentIndex] as DrawSegment & { horizontalLineShowOnYAxis?: boolean })?.horizontalLineShowOnYAxis === true}
                onChange={(e) => {
                  const v = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, horizontalLineShowOnYAxis: v };
                    return next;
                  });
                  persistDrawDefault("horizontalLine", { horizontalLineShowOnYAxis: v });
                }}
                className="rounded border-zinc-300"
                aria-label={tAs.horizontalLineShowOnYAxis ?? "Marcar no eixo Y"}
              />
              <span className="text-xs text-zinc-700">{tAs.horizontalLineShowOnYAxis ?? "Marcar no eixo Y"}</span>
            </label>
          </>
        )}
        {drawSegments[selectedSegmentIndex]?.type === "pencil" && (
          <>
            <div>
              <div className="text-[10px] font-medium text-zinc-500 pb-0.5">{tAs.pencilStrokeWidth ?? "Espessura"}</div>
              <select
                id="pencil-stroke-width-listbox"
                value={(drawSegments[selectedSegmentIndex] as DrawSegment & { pencilStrokeWidth?: "thin" | "medium" | "thick" })?.pencilStrokeWidth ?? "medium"}
                onChange={(e) => {
                  const v = e.target.value as "thin" | "medium" | "thick";
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, pencilStrokeWidth: v };
                    return next;
                  });
                  persistDrawDefault("pencil", { pencilStrokeWidth: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={tAs.pencilStrokeWidth ?? "Espessura"}
              >
                <option value="thin">{tAs.strokeThin ?? "Fina"}</option>
                <option value="medium">{tAs.strokeMedium ?? "Média"}</option>
                <option value="thick">{tAs.strokeThick ?? "Grossa"}</option>
              </select>
            </div>
          </>
        )}
        {drawSegments[selectedSegmentIndex]?.type === "verticalLine" && (
          <>
            <div>
              <div className="text-[10px] font-medium text-zinc-500 pb-0.5">{tAs.verticalLineStrokeStyle ?? "Tipo de traço"}</div>
              <select
                id="vertical-line-stroke-style-listbox"
                value={(drawSegments[selectedSegmentIndex] as DrawSegment & { verticalLineStrokeStyle?: "solid" | "dashed" | "dotted" })?.verticalLineStrokeStyle ?? "solid"}
                onChange={(e) => {
                  const v = e.target.value as "solid" | "dashed" | "dotted";
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, verticalLineStrokeStyle: v };
                    return next;
                  });
                  persistDrawDefault("verticalLine", { verticalLineStrokeStyle: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={tAs.verticalLineStrokeStyle ?? "Tipo de traço"}
              >
                <option value="solid">{tAs.strokeSolid ?? "Contínuo"}</option>
                <option value="dashed">{tAs.strokeDashed ?? "Tracejado"}</option>
                <option value="dotted">{tAs.strokeDotted ?? "Pontilhado"}</option>
              </select>
            </div>
            <div>
              <div className="text-[10px] font-medium text-zinc-500 pb-0.5">{tAs.verticalLineStrokeWidth ?? "Espessura"}</div>
              <select
                id="vertical-line-stroke-width-listbox"
                value={(drawSegments[selectedSegmentIndex] as DrawSegment & { verticalLineStrokeWidth?: FibStrokeWidth })?.verticalLineStrokeWidth ?? "medium"}
                onChange={(e) => {
                  const v = e.target.value as FibStrokeWidth;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, verticalLineStrokeWidth: v };
                    return next;
                  });
                  persistDrawDefault("verticalLine", { verticalLineStrokeWidth: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={tAs.verticalLineStrokeWidth ?? "Espessura"}
              >
                {FIB_STROKE_WIDTH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{tAs[`stroke${opt.charAt(0).toUpperCase()}${opt.slice(1)}`] ?? opt}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={(drawSegments[selectedSegmentIndex] as DrawSegment & { verticalLineShowDateTimeOnXAxis?: boolean })?.verticalLineShowDateTimeOnXAxis === true}
                onChange={(e) => {
                  const v = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, verticalLineShowDateTimeOnXAxis: v };
                    return next;
                  });
                  persistDrawDefault("verticalLine", { verticalLineShowDateTimeOnXAxis: v });
                }}
                className="rounded border-zinc-300"
                aria-label={tAs.verticalLineShowDateTimeOnXAxis ?? "Marcar data e hora no eixo X"}
              />
              <span className="text-xs text-zinc-700">{tAs.verticalLineShowDateTimeOnXAxis ?? "Marcar data e hora no eixo X"}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={(drawSegments[selectedSegmentIndex] as DrawSegment & { verticalLineExtendToPanels?: boolean })?.verticalLineExtendToPanels === true}
                onChange={(e) => {
                  const v = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, verticalLineExtendToPanels: v };
                    return next;
                  });
                  persistDrawDefault("verticalLine", { verticalLineExtendToPanels: v });
                }}
                className="rounded border-zinc-300"
                aria-label={tAs.verticalLineExtendToPanels ?? "Estender nos painéis"}
              />
              <span className="text-xs text-zinc-700">{tAs.verticalLineExtendToPanels ?? "Estender nos painéis"}</span>
            </label>
          </>
        )}
        {drawSegments[selectedSegmentIndex]?.type === "arrow" && (() => {
          const seg = drawSegments[selectedSegmentIndex] as DrawSegment & { arrowAngle?: number };
          const currentAngle = seg?.arrowAngle ?? (() => {
            const p1 = segmentToPixel(seg.index1, seg.price1);
            const p2 = segmentToPixel(seg.index2, seg.price2);
            const rad = Math.atan2(p1.y - p2.y, p2.x - p1.x);
            return Math.round(((rad * 180) / Math.PI + 360) % 360 * 10) / 10;
          })();
          const size = (seg?.arrowSize as ArrowSize) ?? "medium";
          const lengthPx = ARROW_LENGTH_PX[size];
          const applyArrowAngle = (angleDeg: number) => {
            const seg2 = drawSegments[selectedSegmentIndex];
            if (!seg2 || seg2.type !== "arrow") return;
            const tail = segmentToPixel(seg2.index1, seg2.price1);
            const rad = (angleDeg * Math.PI) / 180;
            const tipX = tail.x + lengthPx * Math.cos(rad);
            const tipY = tail.y - lengthPx * Math.sin(rad);
            const tipData = pixelToData(tipX, tipY);
            setDrawSegments((prev) => {
              const next = [...prev];
              const s = next[selectedSegmentIndex];
              if (s && s.type === "arrow") next[selectedSegmentIndex] = { ...s, arrowAngle: angleDeg, index2: tipData.index, price2: tipData.price };
              return next;
            });
            persistDrawDefault("arrow", { arrowAngle: angleDeg });
          };
          return (
            <>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="arrow-angle-input">{tAs.arrowAngle ?? "Ângulo (°)"}</label>
                <input
                  id="arrow-angle-input"
                  type="number"
                  min={0}
                  max={360}
                  step={1}
                  value={currentAngle}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(360, Number(e.target.value) || 0));
                    applyArrowAngle(v);
                  }}
                  className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                  aria-label={tAs.arrowAngle ?? "Ângulo"}
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="arrow-size-listbox">{tAs.arrowSize ?? "Tamanho"}</label>
                <select
                  id="arrow-size-listbox"
                  value={(seg?.arrowSize as ArrowSize) ?? "medium"}
                  onChange={(e) => {
                    const v = e.target.value as ArrowSize;
                    setDrawSegments((prev) => {
                      const next = [...prev];
                      const s = next[selectedSegmentIndex];
                      if (s) next[selectedSegmentIndex] = { ...s, arrowSize: v };
                      return next;
                    });
                    persistDrawDefault("arrow", { arrowSize: v });
                    applyArrowAngle(seg?.arrowAngle ?? currentAngle);
                  }}
                  className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                  aria-label={tAs.arrowSize ?? "Tamanho"}
                >
                  {ARROW_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{tAs[`arrowSize${size.charAt(0).toUpperCase() + size.slice(1)}`] ?? size}</option>
                  ))}
                </select>
              </div>
            </>
          );
        })()}
        {drawSegments[selectedSegmentIndex]?.type === "channel" && (
          <>
            <div>
              <div className="text-[10px] font-medium text-zinc-500 pb-0.5">{tAs.channelExtremityColor ?? "Cor extremidades"}</div>
              <div className="relative">
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={channelExtremityColorListboxOpen}
                  aria-haspopup="listbox"
                  aria-label={tAs.channelExtremityColor ?? "Cor extremidades"}
                  onClick={() => setChannelExtremityColorListboxOpen((o) => !o)}
                  className="w-full flex items-center gap-1.5 rounded border border-zinc-300 px-1.5 py-1 bg-white text-left min-h-[24px]"
                >
                  <span
                    className="w-4 h-4 rounded border border-zinc-300 shrink-0"
                    style={{ backgroundColor: drawSegments[selectedSegmentIndex]?.channelExtremityColor ?? drawSegments[selectedSegmentIndex]?.color ?? DEFAULT_SEGMENT_COLOR }}
                  />
                  <span className="text-zinc-500 text-xs shrink-0 ml-auto" aria-hidden>{channelExtremityColorListboxOpen ? "▲" : "▼"}</span>
                </button>
                {channelExtremityColorListboxOpen && (
                  <div
                    role="listbox"
                    aria-label={tAs.channelExtremityColor ?? "Cor extremidades"}
                    className="absolute left-0 top-full mt-0.5 z-20 grid grid-cols-3 gap-1 p-1 rounded border border-zinc-200 bg-white shadow-lg"
                  >
                    {SEGMENT_COLOR_PALETTE.map((hex) => {
                      const seg = drawSegments[selectedSegmentIndex];
                      const currentColor = seg?.channelExtremityColor ?? seg?.color ?? DEFAULT_SEGMENT_COLOR;
                      const isSelected = currentColor === hex;
                      return (
                        <button
                          key={hex}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setDrawSegments((prev) => {
                              const next = [...prev];
                              const s = next[selectedSegmentIndex];
                              if (s) next[selectedSegmentIndex] = { ...s, channelExtremityColor: hex };
                              return next;
                            });
                            persistDrawDefault("channel", { channelExtremityColor: hex });
                            setChannelExtremityColorListboxOpen(false);
                          }}
                          className={`w-5 h-5 rounded border-2 shrink-0 hover:opacity-90 ${isSelected ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                          style={{ backgroundColor: hex }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="channel-mid-stroke-width-listbox">{tAs.channelMidStrokeWidth ?? "Largura linha do meio"}</label>
              <select
                id="channel-mid-stroke-width-listbox"
                value={(drawSegments[selectedSegmentIndex] as DrawSegment & { channelMidStrokeWidth?: FibStrokeWidth })?.channelMidStrokeWidth ?? "medium"}
                onChange={(e) => {
                  const v = e.target.value as FibStrokeWidth;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, channelMidStrokeWidth: v };
                    return next;
                  });
                  persistDrawDefault("channel", { channelMidStrokeWidth: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={tAs.channelMidStrokeWidth ?? "Largura linha do meio"}
              >
                {FIB_STROKE_WIDTH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{tAs[`stroke${opt.charAt(0).toUpperCase()}${opt.slice(1)}`] ?? opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="channel-extremity-stroke-width-listbox">{tAs.channelExtremityStrokeWidth ?? "Largura extremidades"}</label>
              <select
                id="channel-extremity-stroke-width-listbox"
                value={(drawSegments[selectedSegmentIndex] as DrawSegment & { channelExtremityStrokeWidth?: FibStrokeWidth })?.channelExtremityStrokeWidth ?? "medium"}
                onChange={(e) => {
                  const v = e.target.value as FibStrokeWidth;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, channelExtremityStrokeWidth: v };
                    return next;
                  });
                  persistDrawDefault("channel", { channelExtremityStrokeWidth: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={tAs.channelExtremityStrokeWidth ?? "Largura extremidades"}
              >
                {FIB_STROKE_WIDTH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{tAs[`stroke${opt.charAt(0).toUpperCase()}${opt.slice(1)}`] ?? opt}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-zinc-100 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={drawSegments[selectedSegmentIndex]?.showValues === true}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, showValues: checked };
                    return next;
                  });
                  persistDrawDefault("channel", { showValues: checked });
                }}
                className="rounded border-zinc-300"
              />
              <span>{t.showValues ?? "Mostrar valores"}</span>
            </label>
          </>
        )}
        {drawSegments[selectedSegmentIndex]?.type === "stopGain" && (() => {
          const seg = drawSegments[selectedSegmentIndex] as DrawSegment & { stopGainRatioUp?: number; stopGainRatioDown?: number; stopGainFillOpacity?: number; stopGainShowPercent?: boolean; stopGainShowValuesOnYAxis?: boolean; stopGainStrokeWidth?: "thin" | "medium" };
          const ru = Math.max(1, Math.min(10, Math.round((seg.stopGainRatioUp ?? 1) * 100) / 100));
          const rd = Math.max(1, Math.min(10, Math.round((seg.stopGainRatioDown ?? 1) * 100) / 100));
          const opacity = Math.max(0.1, Math.min(0.7, seg.stopGainFillOpacity ?? 0.5));
          const clampRatio = (v: number) => Math.max(1, Math.min(10, Math.round(v * 100) / 100));
          const clampOpacity = (v: number) => Math.max(0.1, Math.min(0.7, Math.round(v * 100) / 100));
          return (
            <>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="stopgain-stroke-width-listbox">{tAs.stopGainStrokeWidth ?? t.fibStrokeWidth}</label>
                <select
                  id="stopgain-stroke-width-listbox"
                  value={seg.stopGainStrokeWidth ?? "medium"}
                  onChange={(e) => {
                    const v = e.target.value as "thin" | "medium";
                    setDrawSegments((prev) => {
                      const next = [...prev];
                      const s = next[selectedSegmentIndex];
                      if (s) next[selectedSegmentIndex] = { ...s, stopGainStrokeWidth: v };
                      return next;
                    });
                    persistDrawDefault("stopGain", { stopGainStrokeWidth: v });
                  }}
                  className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                  aria-label={tAs.stopGainStrokeWidth ?? t.fibStrokeWidth}
                >
                  <option value="thin">{t.strokeThin ?? "Fino"}</option>
                  <option value="medium">{t.strokeMedium ?? "Médio"}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-zinc-100 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={seg.stopGainShowPercent === true}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDrawSegments((prev) => {
                      const next = [...prev];
                      const s = next[selectedSegmentIndex];
                      if (s) next[selectedSegmentIndex] = { ...s, stopGainShowPercent: checked };
                      return next;
                    });
                    persistDrawDefault("stopGain", { stopGainShowPercent: checked });
                  }}
                  className="rounded border-zinc-300"
                />
                <span>{t.showPercent ?? "Mostrar %"}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-zinc-100 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={seg.stopGainShowValuesOnYAxis === true}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDrawSegments((prev) => {
                      const next = [...prev];
                      const s = next[selectedSegmentIndex];
                      if (s) next[selectedSegmentIndex] = { ...s, stopGainShowValuesOnYAxis: checked };
                      return next;
                    });
                    persistDrawDefault("stopGain", { stopGainShowValuesOnYAxis: checked });
                  }}
                  className="rounded border-zinc-300"
                />
                <span>{tAs.stopGainShowValuesOnYAxis ?? "Valores no eixo Y"}</span>
              </label>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="stopgain-ratio-up">{tAs.stopGainRatioUp ?? "Proporção ganho (acima)"}</label>
                <input
                  id="stopgain-ratio-up"
                  type="number"
                  min={1}
                  max={10}
                  step={0.01}
                  value={ru}
                  onChange={(e) => {
                    const v = clampRatio(Number(e.target.value));
                    setDrawSegments((prev) => {
                      const next = [...prev];
                      const s = next[selectedSegmentIndex];
                      if (s) next[selectedSegmentIndex] = { ...s, stopGainRatioUp: v };
                      return next;
                    });
                    persistDrawDefault("stopGain", { stopGainRatioUp: v });
                  }}
                  className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="stopgain-ratio-down">{tAs.stopGainRatioDown ?? "Proporção perda (abaixo)"}</label>
                <input
                  id="stopgain-ratio-down"
                  type="number"
                  min={1}
                  max={10}
                  step={0.01}
                  value={rd}
                  onChange={(e) => {
                    const v = clampRatio(Number(e.target.value));
                    setDrawSegments((prev) => {
                      const next = [...prev];
                      const s = next[selectedSegmentIndex];
                      if (s) next[selectedSegmentIndex] = { ...s, stopGainRatioDown: v };
                      return next;
                    });
                    persistDrawDefault("stopGain", { stopGainRatioDown: v });
                  }}
                  className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="stopgain-fill-opacity">{tAs.stopGainFillOpacity ?? "Opacidade preenchimento (10–70%)"}</label>
                <input
                  id="stopgain-fill-opacity"
                  type="number"
                  min={0.1}
                  max={0.7}
                  step={0.01}
                  value={opacity}
                  onChange={(e) => {
                    const v = clampOpacity(Number(e.target.value));
                    setDrawSegments((prev) => {
                      const next = [...prev];
                      const s = next[selectedSegmentIndex];
                      if (s) next[selectedSegmentIndex] = { ...s, stopGainFillOpacity: v };
                      return next;
                    });
                    persistDrawDefault("stopGain", { stopGainFillOpacity: v });
                  }}
                  className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                />
              </div>
            </>
          );
        })()}
        {drawSegments[selectedSegmentIndex]?.type === "rectangle" && (
          <>
            <div>
              <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="rectangle-stroke-width-listbox">{tAs.rectangleStrokeWidth ?? t.fibStrokeWidth}</label>
              <select
                id="rectangle-stroke-width-listbox"
                value={(drawSegments[selectedSegmentIndex] as DrawSegment & { rectangleStrokeWidth?: FibStrokeWidth })?.rectangleStrokeWidth ?? "medium"}
                onChange={(e) => {
                  const v = e.target.value as FibStrokeWidth;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, rectangleStrokeWidth: v };
                    return next;
                  });
                  persistDrawDefault("rectangle", { rectangleStrokeWidth: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={tAs.rectangleStrokeWidth ?? t.fibStrokeWidth}
              >
                {FIB_STROKE_WIDTH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{tAs[`stroke${opt.charAt(0).toUpperCase()}${opt.slice(1)}`] ?? opt}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-700">
              <input
                type="checkbox"
                checked={drawSegments[selectedSegmentIndex]?.rectangleFilled === true}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, rectangleFilled: checked };
                    return next;
                  });
                  persistDrawDefault("rectangle", { rectangleFilled: checked });
                }}
                className="rounded border-zinc-300"
              />
              <span>{tAs.rectangleFill ?? "Preenchimento"}</span>
            </label>
          </>
        )}
        {drawSegments[selectedSegmentIndex]?.type === "fibonacci" && (
          <div>
            <div className="text-[10px] font-medium text-zinc-500 pb-0.5">{t.fibLevel618Color}</div>
            <div className="relative">
              <button
                type="button"
                role="combobox"
                aria-expanded={fibLevel618ColorListboxOpen}
                aria-haspopup="listbox"
                aria-label={t.fibLevel618Color}
                onClick={() => setFibLevel618ColorListboxOpen((o) => !o)}
                className="w-full flex items-center gap-1.5 rounded border border-zinc-300 px-1.5 py-1 bg-white text-left min-h-[24px]"
              >
                <span
                  className="w-4 h-4 rounded border border-zinc-300 shrink-0"
                  style={{ backgroundColor: drawSegments[selectedSegmentIndex]?.fibLevel618Color ?? drawSegments[selectedSegmentIndex]?.color ?? DEFAULT_SEGMENT_COLOR }}
                />
                <span className="text-zinc-500 text-xs shrink-0 ml-auto" aria-hidden>{fibLevel618ColorListboxOpen ? "▲" : "▼"}</span>
              </button>
              {fibLevel618ColorListboxOpen && (
                <div
                  role="listbox"
                  aria-label={t.fibLevel618Color}
                  className="absolute left-0 top-full mt-0.5 z-20 grid grid-cols-3 gap-1 p-1 rounded border border-zinc-200 bg-white shadow-lg"
                >
                  {SEGMENT_COLOR_PALETTE.map((hex) => {
                    const seg = drawSegments[selectedSegmentIndex];
                    const currentColor = seg?.fibLevel618Color ?? seg?.color ?? DEFAULT_SEGMENT_COLOR;
                    const isSelected = currentColor === hex;
                    return (
                      <button
                        key={hex}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        aria-label={t.fibLevel618Color}
                        onClick={() => {
                          setDrawSegments((prev) => {
                            const next = [...prev];
                            const s = next[selectedSegmentIndex];
                            if (s) next[selectedSegmentIndex] = { ...s, fibLevel618Color: hex };
                            return next;
                          });
                          persistDrawDefault("fibonacci", { fibLevel618Color: hex });
                          setFibLevel618ColorListboxOpen(false);
                        }}
                        className={`w-5 h-5 rounded border-2 shrink-0 hover:opacity-90 ${isSelected ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                        style={{ backgroundColor: hex }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {drawSegments[selectedSegmentIndex]?.type === "fibonacci" && (
          <>
            <div>
              <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="fib-stroke-width-listbox">{t.fibStrokeWidth}</label>
              <select
                id="fib-stroke-width-listbox"
                value={(drawSegments[selectedSegmentIndex] as DrawSegment & { fibStrokeWidth?: FibStrokeWidth })?.fibStrokeWidth ?? "medium"}
                onChange={(e) => {
                  const v = e.target.value as FibStrokeWidth;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, fibStrokeWidth: v };
                    return next;
                  });
                  persistDrawDefault("fibonacci", { fibStrokeWidth: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={t.fibStrokeWidth}
              >
                {FIB_STROKE_WIDTH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{tAs[`stroke${opt.charAt(0).toUpperCase()}${opt.slice(1)}`] ?? opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="fib-level618-stroke-width-listbox">{t.fibLevel618StrokeWidth}</label>
              <select
                id="fib-level618-stroke-width-listbox"
                value={(drawSegments[selectedSegmentIndex] as DrawSegment & { fibLevel618StrokeWidth?: FibStrokeWidth })?.fibLevel618StrokeWidth ?? "thin"}
                onChange={(e) => {
                  const v = e.target.value as FibStrokeWidth;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, fibLevel618StrokeWidth: v };
                    return next;
                  });
                  persistDrawDefault("fibonacci", { fibLevel618StrokeWidth: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={t.fibLevel618StrokeWidth}
              >
                {FIB_STROKE_WIDTH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{tAs[`stroke${opt.charAt(0).toUpperCase()}${opt.slice(1)}`] ?? opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="fib-level-pct1">{tAs.fibLevelPct1 ?? "Primeiro nível (%)"}</label>
              <input
                id="fib-level-pct1"
                type="number"
                min={0}
                max={50}
                step={0.1}
                value={(() => {
                  const raw = Math.max(0, Math.min(50, (drawSegments[selectedSegmentIndex] as DrawSegment & { fibLevelPct1?: number })?.fibLevelPct1 ?? 33.33));
                  return Math.round(raw * 10000) / 10000;
                })()}
                onChange={(e) => {
                  const raw = Math.max(0, Math.min(50, parseFloat(e.target.value) || 0));
                  const v = Math.round(raw * 10000) / 10000;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, fibLevelPct1: v };
                    return next;
                  });
                  persistDrawDefault("fibonacci", { fibLevelPct1: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={tAs.fibLevelPct1 ?? "Primeiro nível (%)"}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-zinc-100 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={drawSegments[selectedSegmentIndex]?.fibShow1618 === true}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, fibShow1618: checked };
                    return next;
                  });
                  persistDrawDefault("fibonacci", { fibShow1618: checked });
                }}
                className="rounded border-zinc-300"
              />
              <span>{tAs.fibShow1618 ?? "Mostrar nível 161.8%"}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-zinc-100 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={drawSegments[selectedSegmentIndex]?.showPercent === true}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, showPercent: checked };
                    return next;
                  });
                  persistDrawDefault("fibonacci", { showPercent: checked });
                }}
                className="rounded border-zinc-300"
              />
              <span>{t.showPercent ?? "Mostrar %"}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-zinc-100 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={drawSegments[selectedSegmentIndex]?.showValues === true}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, showValues: checked };
                    return next;
                  });
                  persistDrawDefault("fibonacci", { showValues: checked });
                }}
                className="rounded border-zinc-300"
              />
              <span>{t.showValues ?? "Mostrar valores"}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-zinc-100 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={drawSegments[selectedSegmentIndex]?.fibShowValuesOnYAxis === true}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, fibShowValuesOnYAxis: checked };
                    return next;
                  });
                  persistDrawDefault("fibonacci", { fibShowValuesOnYAxis: checked });
                }}
                className="rounded border-zinc-300"
              />
              <span>{tAs.fibShowValuesOnYAxis ?? "Fibo values on Y"}</span>
            </label>
          </>
        )}
        {drawSegments[selectedSegmentIndex]?.type === "freeRetracement" && (
          <>
            <div>
              <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="free-retrace-level1-pct">{tAs.freeRetracementLevelPct1 ?? "Nível 1 (0–50%)"}</label>
              <input
                id="free-retrace-level1-pct"
                type="number"
                min={0}
                max={50}
                step={0.1}
                value={(() => {
                  const raw = Math.max(0, Math.min(50, (drawSegments[selectedSegmentIndex] as DrawSegment & { freeRetracementLevelPct1?: number })?.freeRetracementLevelPct1 ?? 33.33));
                  return Math.round(raw * 10000) / 10000;
                })()}
                onChange={(e) => {
                  const raw = Math.max(0, Math.min(50, parseFloat(e.target.value) || 33.33));
                  const v = Math.round(raw * 10000) / 10000;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, freeRetracementLevelPct1: v };
                    return next;
                  });
                  persistDrawDefault("freeRetracement", { freeRetracementLevelPct1: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={tAs.freeRetracementLevelPct1 ?? "Nível 1 (0–50%)"}
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="free-retrace-level-pct">{tAs.freeRetracementLevelPct ?? "Nível 3 (50–100%)"}</label>
              <input
                id="free-retrace-level-pct"
                type="number"
                min={50}
                max={100}
                step={0.1}
                value={(() => {
                  const raw = Math.max(50, Math.min(100, (drawSegments[selectedSegmentIndex] as DrawSegment & { freeRetracementLevelPct?: number })?.freeRetracementLevelPct ?? 61.8));
                  return Math.round(raw * 10000) / 10000;
                })()}
                onChange={(e) => {
                  const raw = Math.max(50, Math.min(100, parseFloat(e.target.value) || 61.8));
                  const v = Math.round(raw * 10000) / 10000;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, freeRetracementLevelPct: v };
                    return next;
                  });
                  persistDrawDefault("freeRetracement", { freeRetracementLevelPct: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={tAs.freeRetracementLevelPct ?? "Nível 3 (50–100%)"}
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="free-retrace-levelext-pct">{tAs.freeRetracementLevelPctExt ?? "Nível extensão (100–200%)"}</label>
              <input
                id="free-retrace-levelext-pct"
                type="number"
                min={100}
                max={200}
                step={0.1}
                value={(() => {
                  const raw = Math.max(100, Math.min(200, (drawSegments[selectedSegmentIndex] as DrawSegment & { freeRetracementLevelPctExt?: number })?.freeRetracementLevelPctExt ?? 100));
                  return Math.round(raw * 10000) / 10000;
                })()}
                onChange={(e) => {
                  const raw = Math.max(100, Math.min(200, parseFloat(e.target.value) || 100));
                  const v = Math.round(raw * 10000) / 10000;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, freeRetracementLevelPctExt: v };
                    return next;
                  });
                  persistDrawDefault("freeRetracement", { freeRetracementLevelPctExt: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={tAs.freeRetracementLevelPctExt ?? "Nível extensão (100–200%)"}
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="free-retrace-stroke-width-listbox">{t.fibStrokeWidth}</label>
              <select
                id="free-retrace-stroke-width-listbox"
                value={(drawSegments[selectedSegmentIndex] as DrawSegment & { fibStrokeWidth?: FibStrokeWidth })?.fibStrokeWidth ?? "medium"}
                onChange={(e) => {
                  const v = e.target.value as FibStrokeWidth;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, fibStrokeWidth: v };
                    return next;
                  });
                  persistDrawDefault("freeRetracement", { fibStrokeWidth: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={t.fibStrokeWidth}
              >
                {FIB_STROKE_WIDTH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{tAs[`stroke${opt.charAt(0).toUpperCase()}${opt.slice(1)}`] ?? opt}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-zinc-100 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={drawSegments[selectedSegmentIndex]?.showPercent !== false}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, showPercent: checked };
                    return next;
                  });
                  persistDrawDefault("freeRetracement", { showPercent: checked });
                }}
                className="rounded border-zinc-300"
              />
              <span>{t.showPercent ?? "Mostrar %"}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-zinc-100 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={drawSegments[selectedSegmentIndex]?.showValues === true}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, showValues: checked };
                    return next;
                  });
                  persistDrawDefault("freeRetracement", { showValues: checked });
                }}
                className="rounded border-zinc-300"
              />
              <span>{t.showValues ?? "Mostrar valores"}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-zinc-100 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={(drawSegments[selectedSegmentIndex] as DrawSegment & { freeRetracementShowValuesOnYAxis?: boolean })?.freeRetracementShowValuesOnYAxis === true}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, freeRetracementShowValuesOnYAxis: checked };
                    return next;
                  });
                  persistDrawDefault("freeRetracement", { freeRetracementShowValuesOnYAxis: checked });
                }}
                className="rounded border-zinc-300"
              />
              <span>{tAs.freeRetracementShowValuesOnYAxis ?? "Values on Y"}</span>
            </label>
          </>
        )}
        {drawSegments[selectedSegmentIndex]?.type === "segment" && (
          <>
            <div>
              <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="segment-startcap-listbox">{t.segmentStartCap}</label>
              <select
                id="segment-startcap-listbox"
                value={drawSegments[selectedSegmentIndex]?.startCap ?? "none"}
                onChange={(e) => {
                  const cap = e.target.value as SegmentCap;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, startCap: cap };
                    return next;
                  });
                  persistDrawDefault("segment", { startCap: cap });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={t.segmentStartCap}
              >
                {SEGMENT_CAP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t[opt.labelKey]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="segment-endcap-listbox">{t.segmentEndCap}</label>
              <select
                id="segment-endcap-listbox"
                value={drawSegments[selectedSegmentIndex]?.endCap ?? "none"}
                onChange={(e) => {
                  const cap = e.target.value as SegmentCap;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, endCap: cap };
                    return next;
                  });
                  persistDrawDefault("segment", { endCap: cap });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={t.segmentEndCap}
              >
                {SEGMENT_CAP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t[opt.labelKey]}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-zinc-100 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={drawSegments[selectedSegmentIndex]?.showPercent !== false}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, showPercent: checked };
                    return next;
                  });
                  persistDrawDefault("segment", { showPercent: checked });
                }}
                className="rounded border-zinc-300"
              />
              <span>{t.showPercent ?? "Mostrar %"}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-zinc-100 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={drawSegments[selectedSegmentIndex]?.showValues === true}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, showValues: checked };
                    return next;
                  });
                  persistDrawDefault("segment", { showValues: checked });
                }}
                className="rounded border-zinc-300"
              />
              <span>{t.showValues ?? "Mostrar valores"}</span>
            </label>
          </>
        )}
        {drawSegments[selectedSegmentIndex]?.type === "text" && (
          <>
            <div>
              <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="text-size-listbox">{tAs.textSize ?? "Font size"}</label>
              <select
                id="text-size-listbox"
                value={(drawSegments[selectedSegmentIndex]?.textSize as TextSize) ?? "small"}
                onChange={(e) => {
                  const v = e.target.value as TextSize;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, textSize: v };
                    return next;
                  });
                  persistDrawDefault("text", { textSize: v });
                }}
                className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                aria-label={tAs.textSize ?? "Font size"}
              >
                {TEXT_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{tAs[`textSize${size.charAt(0).toUpperCase() + size.slice(1)}`] ?? size}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-700">
              <input
                type="checkbox"
                checked={drawSegments[selectedSegmentIndex]?.textBold === true}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDrawSegments((prev) => {
                    const next = [...prev];
                    const seg = next[selectedSegmentIndex];
                    if (seg) next[selectedSegmentIndex] = { ...seg, textBold: checked };
                    return next;
                  });
                  persistDrawDefault("text", { textBold: checked });
                }}
                className="rounded border-zinc-300"
              />
              <span>{tAs.textBold ?? "Bold"}</span>
            </label>
          </>
        )}
        <div className="flex items-center gap-1.5 w-full">
          <button
            type="button"
            onClick={() => {
              if (selectedSegmentIndex === null) return;
              setDrawSegments((prev) => prev.filter((_, i) => i !== selectedSegmentIndex));
              setSelectedSegmentIndex(null);
            }}
            className="flex-1 flex items-center justify-center py-1 rounded border border-zinc-300 bg-zinc-50 hover:bg-red-50 hover:border-red-300 text-base"
            title={t.segmentDelete}
            aria-label={t.segmentDelete}
          >
            <span aria-hidden>🗑️</span>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setSelectedSegmentIndex(null); }}
            className="flex-1 flex items-center justify-center py-1 rounded border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-sm font-medium text-zinc-700"
            title={t.segmentOk}
            aria-label={t.segmentOk}
          >
            {t.segmentOk}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
