"use client";

import { createContext, useContext, useRef, useCallback, useMemo, type ReactNode } from "react";

export type LayoutSavePart = "layout" | "indicators" | "strategies";

export type ChartLayoutSaveContextValue = {
  /** Persiste o layout atual no servidor (slot 1–7). part = só essa coluna; sem part = full (as 3 colunas). */
  saveLayoutNow: (part?: LayoutSavePart) => void;
  /** Ref para o gráfico registrar a função de save. Uso interno (KlinesChart). */
  registerSaveLayout: (fn: ((part?: LayoutSavePart) => void) | null) => void;
};

const ChartLayoutSaveContext = createContext<ChartLayoutSaveContextValue | null>(null);

export function ChartLayoutSaveProvider({ children }: { children: ReactNode }) {
  const saveLayoutImplRef = useRef<((part?: LayoutSavePart) => void) | null>(null);

  const saveLayoutNow = useCallback((part?: LayoutSavePart) => {
    saveLayoutImplRef.current?.(part);
  }, []);

  const registerSaveLayout = useCallback((fn: ((part?: LayoutSavePart) => void) | null) => {
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
