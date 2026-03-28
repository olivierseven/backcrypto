"use client";

import { useEffect, useRef, useState } from "react";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import type { ChartIntervalPickerRegistration } from "./ChartHeaderContext";

type Props = {
  picker: ChartIntervalPickerRegistration;
};

export default function HeaderIntervalDropdown({ picker }: Props) {
  const { groupMinutes, intervalLabel, onIntervalChange, intervalOptions, aggIntervalPicker } = picker;
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines;
  const tk = t as Record<string, string>;
  const [open, setOpen] = useState(false);
  const [pageLeftOffset, setPageLeftOffset] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const updateOffset = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      setPageLeftOffset(rect ? Math.round(rect.left) : 0);
    };
    updateOffset();
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("resize", updateOffset);
    window.addEventListener("scroll", updateOffset, { passive: true });
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      window.removeEventListener("resize", updateOffset);
      window.removeEventListener("scroll", updateOffset);
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const select = (value: number) => {
    onIntervalChange(value);
    setOpen(false);
  };

  const a = aggIntervalPicker;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-0.5 max-w-[4.5rem] sm:max-w-none rounded px-1 py-1 text-[11px] sm:text-xs font-medium tabular-nums ${open ? "bg-zinc-200 text-zinc-900" : "text-zinc-700 hover:bg-zinc-100"}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={tk.headerIntervalAria ?? "Chart timeframe"}
        title={tk.headerIntervalTitle ?? "Timeframe"}
      >
        <span className="truncate">{intervalLabel || "—"}</span>
        <svg className="w-3 h-3 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute top-full z-[1300] mt-0.5 w-[min(calc(100vw-2rem),280px)] max-h-[min(70vh,420px)] overflow-y-auto rounded-lg border border-zinc-200 bg-white py-2 px-2 shadow-lg"
          style={{ left: `${-pageLeftOffset}px` }}
          role="listbox"
          aria-label={tk.intervalsPanelTitle ?? t.interval}
        >
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide px-2 pb-2 border-b border-zinc-100 mb-2">
            {tk.intervalsPanelTitle ?? t.interval}
          </p>
          <div className="grid grid-cols-3 gap-1 mb-3">
            {intervalOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === groupMinutes}
                onClick={() => select(opt.value)}
                className={`text-xs font-medium py-1.5 px-2 rounded border ${opt.value === groupMinutes ? "bg-zinc-200 border-zinc-300" : "bg-white border-zinc-200 hover:bg-zinc-50"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="space-y-2 mb-2">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide px-2 pb-2 border-b border-zinc-100 mb-2">
                {tk.intervalSectionRenko ?? "Renko 1×"}
              </p>
              <div className="grid grid-cols-3 gap-1">
                {a.renko.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={groupMinutes === opt.value}
                    onClick={() => select(opt.value)}
                    className={`text-xs font-medium py-1.5 px-2 rounded border ${groupMinutes === opt.value ? "bg-zinc-200 border-zinc-300" : "bg-white border-zinc-200 hover:bg-zinc-50"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide px-2 pb-2 border-b border-zinc-100 mb-2">
                {tk.intervalSectionRange ?? "Range"}
              </p>
              <div className="grid grid-cols-3 gap-1">
                {a.range.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={groupMinutes === opt.value}
                    onClick={() => select(opt.value)}
                    className={`text-xs font-medium py-1.5 px-2 rounded border ${groupMinutes === opt.value ? "bg-zinc-200 border-zinc-300" : "bg-white border-zinc-200 hover:bg-zinc-50"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide px-2 pb-2 border-b border-zinc-100 mb-2">
                {tk.intervalSectionKagi ?? "Kagi"}
              </p>
              <div className="grid grid-cols-3 gap-1">
                {a.kagi.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={groupMinutes === opt.value}
                    onClick={() => select(opt.value)}
                    className={`text-xs font-medium py-1.5 px-2 rounded border ${groupMinutes === opt.value ? "bg-zinc-200 border-zinc-300" : "bg-white border-zinc-200 hover:bg-zinc-50"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide px-2 pb-2 border-b border-zinc-100 mb-2">
                {tk.intervalSectionRenko2x ?? "Renko Clássico"}
              </p>
              <div className="grid grid-cols-3 gap-1">
                {a.renko2x.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={groupMinutes === opt.value}
                    onClick={() => select(opt.value)}
                    className={`text-xs font-medium py-1.5 px-2 rounded border ${groupMinutes === opt.value ? "bg-zinc-200 border-zinc-300" : "bg-white border-zinc-200 hover:bg-zinc-50"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide px-2 pb-2 border-b border-zinc-100 mb-2">
                {tk.intervalSectionTrades ?? "Trades"}
              </p>
              <div className="grid grid-cols-3 gap-1">
                {a.trades500.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={groupMinutes === opt.value}
                    onClick={() => select(opt.value)}
                    className={`text-xs font-medium py-1.5 px-2 rounded border ${groupMinutes === opt.value ? "bg-zinc-200 border-zinc-300" : "bg-white border-zinc-200 hover:bg-zinc-50"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
