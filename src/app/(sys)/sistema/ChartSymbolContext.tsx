"use client";

import { createContext, useContext, useState, useCallback, useMemo, useLayoutEffect, useEffect, type ReactNode } from "react";
import { DEFAULT_SYMBOLS_LIST } from "@/app/lib/kline-symbols";
import { API_BASE } from "@/app/constants";
import { KLINE_SYMBOL_KEY } from "./KlinesChartConstants";

const DEFAULT_SYMBOL = "BTCUSDT";
const FALLBACK_OPTIONS = [...DEFAULT_SYMBOLS_LIST] as readonly string[];

export function getSymbolOptionsExport(): string[] {
  return [...FALLBACK_OPTIONS];
}

export const SYMBOL_OPTIONS = FALLBACK_OPTIONS;
export type SymbolOption = (typeof SYMBOL_OPTIONS)[number];

function getStoredSymbol(options: readonly string[]): string {
  if (typeof window === "undefined") return options[0] ?? DEFAULT_SYMBOL;
  const stored = window.localStorage.getItem(KLINE_SYMBOL_KEY);
  return stored && options.includes(stored) ? stored : (options[0] ?? DEFAULT_SYMBOL);
}

interface ChartSymbolContextValue {
  symbol: string;
  setSymbol: (s: string) => void;
  symbolOptions: readonly string[];
  symbolPanelOpen: boolean;
  openSymbolPanel: () => void;
  closeSymbolPanel: () => void;
}

const ChartSymbolContext = createContext<ChartSymbolContextValue | null>(null);

export function ChartSymbolProvider({ children }: { children: ReactNode }) {
  const [symbolOptions, setSymbolOptions] = useState<readonly string[]>(FALLBACK_OPTIONS);
  const [symbol, setSymbolState] = useState<string>(DEFAULT_SYMBOL);
  const [symbolPanelOpen, setSymbolPanelOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/klines/symbols`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { symbols?: string[] }) => {
        const list = Array.isArray(data?.symbols) && data.symbols.length > 0 ? data.symbols : [...FALLBACK_OPTIONS];
        setSymbolOptions(list);
        setSymbolState((prev) => (list.includes(prev) ? prev : list[0] ?? DEFAULT_SYMBOL));
      })
      .catch(() => {});
  }, []);

  useLayoutEffect(() => {
    setSymbolState((prev) => getStoredSymbol(symbolOptions).trim() || prev);
  }, [symbolOptions]);

  const setSymbol = useCallback((s: string) => {
    setSymbolOptions((opts) => {
      if (!opts.includes(s)) return opts;
      setSymbolState(s);
      try {
        if (typeof window !== "undefined") window.localStorage.setItem(KLINE_SYMBOL_KEY, s);
      } catch {
        /* ignore */
      }
      // Faz o símbolo clicado aparecer no topo da lista do header.
      return [s, ...opts.filter((o) => o !== s)];
    });
  }, []);

  const openSymbolPanel = useCallback(() => setSymbolPanelOpen(true), []);
  const closeSymbolPanel = useCallback(() => setSymbolPanelOpen(false), []);

  const value = useMemo(
    () => ({
      symbol,
      setSymbol,
      symbolOptions,
      symbolPanelOpen,
      openSymbolPanel,
      closeSymbolPanel,
    }),
    [symbol, setSymbol, symbolOptions, symbolPanelOpen, openSymbolPanel, closeSymbolPanel]
  );

  return (
    <ChartSymbolContext.Provider value={value}>
      {children}
    </ChartSymbolContext.Provider>
  );
}

export function useChartSymbol(): ChartSymbolContextValue {
  const ctx = useContext(ChartSymbolContext);
  if (!ctx) {
    return {
      symbol: DEFAULT_SYMBOL,
      setSymbol: () => {},
      symbolOptions: FALLBACK_OPTIONS,
      symbolPanelOpen: false,
      openSymbolPanel: () => {},
      closeSymbolPanel: () => {},
    };
  }
  return ctx;
}
