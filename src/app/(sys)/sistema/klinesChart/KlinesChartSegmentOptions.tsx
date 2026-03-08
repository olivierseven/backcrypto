"use client";

/**
 * Painel flutuante de opções do segmento selecionado (cor, tipo de traço, espessura, excluir).
 * Extraído de KlinesChart para reduzir tamanho do arquivo principal.
 */
import { useState, useEffect, type RefObject } from "react";
import type { DrawSegment, FibStrokeWidth, SegmentCap } from "../KlinesChartDrawing";
import { FIB_STROKE_WIDTH_OPTIONS } from "../KlinesChartDrawing";
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
  persistDrawDefault: (type: "segment" | "fibonacci" | "channel" | "rectangle" | "horizontalLine", partial: Partial<DrawSegment>) => void;
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
  t,
  segmentToolboxCollapsed = false,
}: KlinesChartSegmentOptionsProps) {
  const [segmentColorListboxOpen, setSegmentColorListboxOpen] = useState(false);
  const [fibLevel618ColorListboxOpen, setFibLevel618ColorListboxOpen] = useState(false);
  const [channelExtremityColorListboxOpen, setChannelExtremityColorListboxOpen] = useState(false);

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
      : drawSegments[selectedSegmentIndex]?.type === "channel"
        ? tAs.channelMiddleColor ?? "Linha do meio"
        : drawSegments[selectedSegmentIndex]?.type === "rectangle"
          ? tAs.rectangleColor ?? t.segmentColor
          : drawSegments[selectedSegmentIndex]?.type === "horizontalLine"
            ? tAs.horizontalLineColor ?? t.segmentColor
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
          onClick={(e) => { e.stopPropagation(); setSelectedSegmentIndex(null); }}
          className="p-0.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 text-base leading-none font-semibold shrink-0"
          title={t.drawExitMode}
          aria-label={t.drawExitMode}
        >
          <span aria-hidden>×</span>
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
      </div>
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
                        const segType = (drawSegments[selectedSegmentIndex]?.type ?? "segment") as "segment" | "fibonacci" | "channel" | "rectangle" | "horizontalLine";
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
          </>
        )}
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
          </>
        )}
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
          </>
        )}
        {drawSegments[selectedSegmentIndex]?.type !== "channel" && drawSegments[selectedSegmentIndex]?.type !== "rectangle" && drawSegments[selectedSegmentIndex]?.type !== "horizontalLine" && (
          <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-700">
            <input
              type="checkbox"
              checked={drawSegments[selectedSegmentIndex]?.showPercent !== false}
              onChange={(e) => {
                const checked = e.target.checked;
                const segType = drawSegments[selectedSegmentIndex]?.type ?? "segment";
                setDrawSegments((prev) => {
                  const next = [...prev];
                  const seg = next[selectedSegmentIndex];
                  if (seg) next[selectedSegmentIndex] = { ...seg, showPercent: checked };
                  return next;
                });
                persistDrawDefault(segType, { showPercent: checked });
              }}
              className="rounded border-zinc-300"
            />
            <span>{t.segmentShowPercent}</span>
          </label>
        )}
        {drawSegments[selectedSegmentIndex]?.type !== "rectangle" && drawSegments[selectedSegmentIndex]?.type !== "horizontalLine" && (
          <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-700">
            <input
              type="checkbox"
              checked={drawSegments[selectedSegmentIndex]?.showValues === true}
              onChange={(e) => {
                const checked = e.target.checked;
                const segType = (drawSegments[selectedSegmentIndex]?.type ?? "segment") as "segment" | "fibonacci" | "channel" | "rectangle" | "horizontalLine";
                setDrawSegments((prev) => {
                  const next = [...prev];
                  const seg = next[selectedSegmentIndex];
                  if (seg) next[selectedSegmentIndex] = { ...seg, showValues: checked };
                  return next;
                });
                persistDrawDefault(segType, { showValues: checked });
              }}
              className="rounded border-zinc-300"
            />
            <span>{t.segmentShowValues}</span>
          </label>
        )}
        <button
          type="button"
          onClick={() => {
            if (selectedSegmentIndex === null) return;
            setDrawSegments((prev) => prev.filter((_, i) => i !== selectedSegmentIndex));
            setSelectedSegmentIndex(null);
          }}
          className="w-full flex items-center justify-center py-1 rounded border border-zinc-300 bg-zinc-50 hover:bg-red-50 hover:border-red-300 text-base"
          title={t.segmentDelete}
          aria-label={t.segmentDelete}
        >
          <span aria-hidden>🗑️</span>
        </button>
      </div>
    </div>
  );
}
