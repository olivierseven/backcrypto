"use client";

import { useState, useEffect } from "react";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { useKlinesIndicators } from "./KlinesIndicatorsContext";
import { KLINE_DRAW_SEGMENTS_KEY } from "./KlinesChartConstants";
import { DEFAULT_SEGMENT_COLOR, type DrawSegment } from "./KlinesChartDrawing";

interface DrawingsPanelProps {
  onClose?: () => void;
}

function formatIntervalLabel(m: number) {
  if (m < 60) return `${m}m`;
  if (m === 60) return "1h";
  if (m < 1440) return `${m / 60}h`;
  if (m === 1440) return "1d";
  if (m === 10080) return "1w";
  return `${m}m`;
}

export default function DrawingsPanel({ onClose }: DrawingsPanelProps) {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines as Record<string, string>;
  const { currentGroupMinutes } = useKlinesIndicators();
  const [savedDrawingsList, setSavedDrawingsList] = useState<DrawSegment[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || currentGroupMinutes == null) {
      setSavedDrawingsList([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(KLINE_DRAW_SEGMENTS_KEY);
      if (!raw) {
        setSavedDrawingsList([]);
        return;
      }
      const data = JSON.parse(raw) as Record<string, DrawSegment[]>;
      const key = String(currentGroupMinutes);
      const list = Array.isArray(data[key]) ? data[key] : [];
      setSavedDrawingsList(list);
    } catch {
      setSavedDrawingsList([]);
    }
  }, [currentGroupMinutes]);

  const drawingTypeLabel = (seg: DrawSegment) => {
    const type = seg.type ?? "segment";
    const key =
      type === "segment"
        ? "lineSegment"
        : type === "fibonacci"
          ? "fibonacciRetracement"
          : type === "channel"
            ? "channelTool"
            : type === "rectangle"
              ? "rectangleTool"
              : type === "horizontalLine"
                ? "horizontalLine"
                  : type === "verticalLine"
                  ? "verticalLine"
                  : type === "arrow"
                    ? "arrowTool"
                    : type === "text"
                      ? "drawTextTool"
                      : "lineSegment";
    return t[key] ?? type;
  };

  const deleteDrawingAtIndex = (index: number) => {
    if (currentGroupMinutes == null || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(KLINE_DRAW_SEGMENTS_KEY);
      const data: Record<string, DrawSegment[]> = raw ? (JSON.parse(raw) as Record<string, DrawSegment[]>) : {};
      const key = String(currentGroupMinutes);
      const list = Array.isArray(data[key]) ? data[key] : [];
      const next = list.filter((_, i) => i !== index);
      data[key] = next;
      window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, JSON.stringify(data));
      setSavedDrawingsList(next);
      window.dispatchEvent(new CustomEvent("backcrypto-drawings-updated"));
    } catch {
      /* ignore */
    }
  };

  const clearAllDrawingsCache = () => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(KLINE_DRAW_SEGMENTS_KEY);
        window.dispatchEvent(new CustomEvent("backcrypto-drawings-cleared"));
      }
      setSavedDrawingsList([]);
      onClose?.();
    } catch {
      /* ignore */
    }
  };

  const segmentDisplayColor = (seg: DrawSegment) => seg.color ?? DEFAULT_SEGMENT_COLOR;

  return (
    <div
      className="fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-zinc-200 shadow-xl overflow-hidden w-[66.666vw] sm:w-[33.333vw] max-w-[400px]"
      role="dialog"
      aria-label={t.menuDrawings ?? "Drawings"}
    >
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-zinc-50">
        <h2 className="text-sm font-semibold text-zinc-800">
          {t.menuDrawings ?? "Drawings"}
        </h2>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-zinc-200 text-zinc-600" aria-label="Close">
            <span className="text-lg leading-none">×</span>
          </button>
        )}
      </div>
      <div className="panel-scroll flex-1 min-h-0 overflow-auto p-3 space-y-4">
        {currentGroupMinutes == null ? (
          <p className="text-sm text-zinc-500 py-2">{t.noDrawings ?? "No drawings"}</p>
        ) : (
          <>
            <p className="text-xs font-medium text-zinc-500">
              {formatIntervalLabel(currentGroupMinutes)} · {savedDrawingsList.length} {t.drawingsWord ?? "drawings"}
            </p>
            {savedDrawingsList.length === 0 ? (
              <p className="text-sm text-zinc-500 py-2">{t.noDrawings ?? "No drawings"}</p>
            ) : (
              <ul className="list-none space-y-1">
                {savedDrawingsList.map((seg, i) => (
                  <li key={i} className="flex items-center gap-2 py-2 border-b border-zinc-100 last:border-0">
                    <span
                      className="shrink-0 w-5 h-5 rounded border border-zinc-300"
                      style={{ backgroundColor: segmentDisplayColor(seg) }}
                      title={segmentDisplayColor(seg)}
                      aria-hidden
                    />
                    <span className="flex-1 min-w-0 text-sm text-zinc-700">
                      {i + 1}. {drawingTypeLabel(seg)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("backcrypto-drawings-edit", { detail: { index: i } }));
                        onClose?.();
                      }}
                      className="shrink-0 p-1.5 rounded hover:bg-zinc-100 text-zinc-600 hover:text-zinc-800"
                      title={t.segmentEdit ?? "Edit"}
                      aria-label={t.segmentEdit ?? "Edit"}
                    >
                      <span aria-hidden>✏️</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDrawingAtIndex(i)}
                      className="shrink-0 p-1.5 rounded hover:bg-red-50 text-zinc-500 hover:text-red-600"
                      title={t.segmentDelete ?? "Delete segment"}
                      aria-label={t.segmentDelete ?? "Delete segment"}
                    >
                      <span aria-hidden>🗑️</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="pt-4 border-t border-zinc-200 space-y-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="w-full px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg border border-red-200"
              >
                {t.clearAllDrawingsCache ?? "Clear all drawing cache"}
              </button>
              {showClearConfirm && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
                  <p className="text-sm text-amber-900">
                    {t.clearDrawingsConfirmMessage ?? "You will lose all saved drawings and this action cannot be undone. Continue?"}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        clearAllDrawingsCache();
                        setShowClearConfirm(false);
                      }}
                      className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                    >
                      {t.clearDrawingsConfirmYes ?? "Yes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="flex-1 px-3 py-2 text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-100 rounded-lg border border-zinc-300"
                    >
                      {t.clearDrawingsConfirmNo ?? "No"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
