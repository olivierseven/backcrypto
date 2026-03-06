"use client";

import { createContext, useContext, useState, useMemo, type ReactNode } from "react";

interface SistemaDebugContextValue {
  showKlinesTable: boolean;
  setShowKlinesTable: (v: boolean) => void;
}

const SistemaDebugContext = createContext<SistemaDebugContextValue | null>(null);

const defaultValue: SistemaDebugContextValue = {
  showKlinesTable: false,
  setShowKlinesTable: () => {},
};

export function SistemaDebugProvider({ children }: { children: ReactNode }) {
  const [showKlinesTable, setShowKlinesTable] = useState(false);
  const value = useMemo(
    () => ({ showKlinesTable, setShowKlinesTable }),
    [showKlinesTable]
  );
  return (
    <SistemaDebugContext.Provider value={value}>
      {children}
    </SistemaDebugContext.Provider>
  );
}

export function useSistemaDebug(): SistemaDebugContextValue {
  const ctx = useContext(SistemaDebugContext);
  return ctx ?? defaultValue;
}
