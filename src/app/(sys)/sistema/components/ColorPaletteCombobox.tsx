"use client";

import { useState, useRef, useEffect } from "react";

/** Combobox de paleta: trigger com cor atual; dropdown 3 colunas. */
export interface ColorPaletteComboboxProps {
  value: string;
  onChange: (hex: string) => void;
  palette: readonly string[];
  "aria-label"?: string;
  className?: string;
}

export function ColorPaletteCombobox({
  value,
  onChange,
  palette,
  "aria-label": ariaLabel,
  className = "",
}: ColorPaletteComboboxProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-1.5 min-w-[4.5rem] h-8 rounded border border-zinc-300 bg-white px-2 py-1.5"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="w-5 h-5 rounded border border-zinc-300 shrink-0" style={{ backgroundColor: value }} />
        <span className="text-zinc-500 text-xs shrink-0">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" aria-hidden onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full z-40 mt-1.5 w-[140px] rounded-lg border border-zinc-200 bg-white shadow-lg p-2.5"
            role="listbox"
            aria-label={ariaLabel}
          >
            <div className="grid grid-cols-3 gap-3 [&_button]:w-7 [&_button]:h-7 [&_button]:shrink-0 [&_button]:rounded [&_button]:border-2 [&_button]:box-border">
              {palette.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  role="option"
                  aria-selected={value === hex}
                  onClick={() => {
                    onChange(hex);
                    setOpen(false);
                  }}
                  className={value === hex ? "border-zinc-900 ring-2 ring-zinc-400 ring-offset-1" : "border-zinc-300 hover:border-zinc-500"}
                  style={{ backgroundColor: hex }}
                  aria-label={hex}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
