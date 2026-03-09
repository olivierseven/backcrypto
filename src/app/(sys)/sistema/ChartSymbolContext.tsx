"use client";

import { createContext, useContext, useState, useCallback, useMemo, useLayoutEffect, type ReactNode } from "react";
import { KLINE_SYMBOL_KEY } from "./KlinesChartConstants";

export const SYMBOL_OPTIONS = ["BTCUSDT", "ETHUSDT"] as const;
export type SymbolOption = (typeof SYMBOL_OPTIONS)[number];

function getStoredSymbol(): string {
  if (typeof window === "undefined") return "BTCUSDT";
  const stored = window.localStorage.getItem(KLINE_SYMBOL_KEY);
  return stored && SYMBOL_OPTIONS.includes(stored as SymbolOption) ? stored : "BTCUSDT";
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
  const [symbol, setSymbolState] = useState<string>("BTCUSDT");
  const [symbolPanelOpen, setSymbolPanelOpen] = useState(false);

  useLayoutEffect(() => {
    const stored = getStoredSymbol();
    setSymbolState(stored);
  }, []);

  const setSymbol = useCallback((s: string) => {
    if (!SYMBOL_OPTIONS.includes(s as SymbolOption)) return;
    setSymbolState(s);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(KLINE_SYMBOL_KEY, s);
    } catch {
      /* ignore */
    }
  }, []);

  const openSymbolPanel = useCallback(() => setSymbolPanelOpen(true), []);
  const closeSymbolPanel = useCallback(() => setSymbolPanelOpen(false), []);

  const value = useMemo(
    () => ({
      symbol,
      setSymbol,
      symbolOptions: SYMBOL_OPTIONS,
      symbolPanelOpen,
      openSymbolPanel,
      closeSymbolPanel,
    }),
    [symbol, setSymbol, symbolPanelOpen, openSymbolPanel, closeSymbolPanel]
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
      symbol: "BTCUSDT",
      setSymbol: () => {},
      symbolOptions: SYMBOL_OPTIONS,
      symbolPanelOpen: false,
      openSymbolPanel: () => {},
      closeSymbolPanel: () => {},
    };
  }
  return ctx;
}
