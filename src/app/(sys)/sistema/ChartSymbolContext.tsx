"use client";

import { createContext, useContext, useState, useCallback, useMemo, useLayoutEffect, type ReactNode } from "react";
import { getKlineSymbols } from "@/app/lib/kline-symbols";
import { KLINE_SYMBOL_KEY } from "./KlinesChartConstants";

const DEFAULT_SYMBOL = "BTCUSDT";

function getSymbolOptions(): string[] {
  const list = getKlineSymbols();
  return list.length > 0 ? list : [DEFAULT_SYMBOL, "ETHUSDT"];
}

export function getSymbolOptionsExport(): string[] {
  return getSymbolOptions();
}

export const SYMBOL_OPTIONS = getSymbolOptions() as readonly string[];
export type SymbolOption = (typeof SYMBOL_OPTIONS)[number];

function getStoredSymbol(): string {
  if (typeof window === "undefined") return getSymbolOptions()[0] ?? DEFAULT_SYMBOL;
  const options = getSymbolOptions();
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
  const [symbol, setSymbolState] = useState<string>(() => getSymbolOptions()[0] ?? DEFAULT_SYMBOL);
  const [symbolPanelOpen, setSymbolPanelOpen] = useState(false);

  useLayoutEffect(() => {
    const stored = getStoredSymbol();
    setSymbolState(stored);
  }, []);

  const setSymbol = useCallback((s: string) => {
    const options = getSymbolOptions();
    if (!options.includes(s)) return;
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
      symbolOptions: getSymbolOptions(),
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
      symbol: getSymbolOptions()[0] ?? DEFAULT_SYMBOL,
      setSymbol: () => {},
      symbolOptions: getSymbolOptions(),
      symbolPanelOpen: false,
      openSymbolPanel: () => {},
      closeSymbolPanel: () => {},
    };
  }
  return ctx;
}
