"use client";

import { createContext, useContext, useRef, useCallback, useMemo, type ReactNode } from "react";

export type LayoutSavePart = "layout" | "indicators" | "strategies" | "regressions";

export type ChartLayoutSaveContextValue = {
  /** Persiste no servidor (slot 1–7). part = só essa coluna; sem part = full. Para "indicators" / "regressions", payload = array a gravar nessa coluna. */
  saveLayoutNow: (part?: LayoutSavePart, payload?: unknown) => void;
  /** Ref para o gráfico registrar a função de save. Uso interno (KlinesChart). */
  registerSaveLayout: (fn: ((part?: LayoutSavePart, payload?: unknown) => void) | null) => void;
};

const ChartLayoutSaveContext = createContext<ChartLayoutSaveContextValue | null>(null);

export function ChartLayoutSaveProvider({ children }: { children: ReactNode }) {
  const saveLayoutImplRef = useRef<((part?: LayoutSavePart, payload?: unknown) => void) | null>(null);

  const saveLayoutNow = useCallback((part?: LayoutSavePart, payload?: unknown) => {
    saveLayoutImplRef.current?.(part, payload);
  }, []);

  const registerSaveLayout = useCallback((fn: ((part?: LayoutSavePart, payload?: unknown) => void) | null) => {
    saveLayoutImplRef.current = fn;
  }, []);

  const value = useMemo<ChartLayoutSaveContextValue>(
    () => ({ saveLayoutNow, registerSaveLayout }),
    [saveLayoutNow, registerSaveLayout]
  );

  return (
    <ChartLayoutSaveContext.Provider value={value}>
      {children}
    </ChartLayoutSaveContext.Provider>
  );
}

export function useChartLayoutSave(): ChartLayoutSaveContextValue | null {
  return useContext(ChartLayoutSaveContext);
}
