"use client";

import { useState, useRef, useEffect } from "react";

export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  id?: string;
  className?: string;
  buttonClassName?: string;
  "aria-label"?: string;
  /** sm = compacto, md = padrão (text-xs), lg = maior (text-sm) */
  size?: "sm" | "md" | "lg";
}

export function Combobox({
  value,
  onChange,
  options,
  id,
  className = "",
  buttonClassName = "",
  "aria-label": ariaLabel,
  size = "md",
}: ComboboxProps) {
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

  const currentLabel = options.find((o) => o.value === value)?.label ?? value;
  const textSize = size === "sm" ? "text-[10px]" : size === "lg" ? "text-sm" : "text-xs";
  const pad = size === "sm" ? "px-1 py-0.5" : size === "lg" ? "px-2 py-1.5" : "px-2 py-1";

  return (
    <div className={`relative ${className}`} ref={ref} id={id}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full text-left border border-zinc-300 rounded bg-white flex items-center justify-between gap-1 ${pad} ${textSize} ${buttonClassName}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate min-w-0">{currentLabel}</span>
        <span className="text-zinc-500 shrink-0">▾</span>
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-1 combobox-dropdown-max rounded border border-zinc-200 bg-white shadow-lg py-0.5 min-w-full"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={value === opt.value}
              disabled={opt.disabled}
              onClick={() => {
                if (!opt.disabled) {
                  onChange(opt.value);
                  setOpen(false);
                }
              }}
              className={`w-full text-left px-2 py-1 rounded flex items-center ${textSize} ${value === opt.value ? "bg-zinc-200 font-medium" : "hover:bg-zinc-100"} ${opt.disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
