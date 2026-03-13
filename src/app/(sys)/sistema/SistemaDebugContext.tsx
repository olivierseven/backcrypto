"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

const LAYOUT_DEBUG_MAX = 40;
const LAYOUT_DEBUG_STORAGE_KEY = "backcrypto-layout-debug";
const LAYOUT_SAVE_LOAD_DEBUG_STORAGE_KEY = "backcrypto-layout-save-load-debug";

function loadLayoutDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LAYOUT_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function loadLayoutSaveLoadDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LAYOUT_SAVE_LOAD_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface SistemaDebugContextValue {
  showKlinesTable: boolean;
  setShowKlinesTable: (v: boolean) => void;
  layoutLoadLog: string[];
  layoutLoadDebugEnabled: boolean;
  setLayoutLoadDebugEnabled: (v: boolean) => void;
  /** Quando true, KlinesChart loga save/load (eixo Y) no layoutLoadLog. Checkbox só no painel de debug. */
  layoutSaveLoadDebugEnabled: boolean;
  setLayoutSaveLoadDebugEnabled: (v: boolean) => void;
  addLayoutLoadLog: (msg: string) => void;
  clearLayoutLoadLog: () => void;
}

const SistemaDebugContext = createContext<SistemaDebugContextValue | null>(null);

const defaultValue: SistemaDebugContextValue = {
  showKlinesTable: false,
  setShowKlinesTable: () => {},
  layoutLoadLog: [],
  layoutLoadDebugEnabled: false,
  setLayoutLoadDebugEnabled: () => {},
  layoutSaveLoadDebugEnabled: false,
  setLayoutSaveLoadDebugEnabled: () => {},
  addLayoutLoadLog: () => {},
  clearLayoutLoadLog: () => {},
};

export function SistemaDebugProvider({ children }: { children: ReactNode }) {
  const [showKlinesTable, setShowKlinesTable] = useState(false);
  const [layoutLoadLog, setLayoutLoadLog] = useState<string[]>([]);
  const [layoutLoadDebugEnabled, setLayoutLoadDebugEnabledState] = useState(false);
  const [layoutSaveLoadDebugEnabled, setLayoutSaveLoadDebugEnabledState] = useState(false);

  useLayoutEffect(() => {
    setLayoutLoadDebugEnabledState(loadLayoutDebugEnabled());
    setLayoutSaveLoadDebugEnabledState(loadLayoutSaveLoadDebugEnabled());
  }, []);

  const setLayoutLoadDebugEnabled = useCallback((v: boolean) => {
    setLayoutLoadDebugEnabledState(v);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(LAYOUT_DEBUG_STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const setLayoutSaveLoadDebugEnabled = useCallback((v: boolean) => {
    setLayoutSaveLoadDebugEnabledState(v);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(LAYOUT_SAVE_LOAD_DEBUG_STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const layoutLoadDebugEnabledRef = useRef(layoutLoadDebugEnabled);
  layoutLoadDebugEnabledRef.current = layoutLoadDebugEnabled;
  const layoutSaveLoadDebugEnabledRef = useRef(layoutSaveLoadDebugEnabled);
  layoutSaveLoadDebugEnabledRef.current = layoutSaveLoadDebugEnabled;

  const addLayoutLoadLog = useCallback((msg: string) => {
    if (!layoutLoadDebugEnabledRef.current && !layoutSaveLoadDebugEnabledRef.current) return;
    const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
    setLayoutLoadLog((prev) => [...prev, line].slice(-LAYOUT_DEBUG_MAX));
  }, []);

  const clearLayoutLoadLog = useCallback(() => setLayoutLoadLog([]), []);
  const value = useMemo(
    () => ({
      showKlinesTable,
      setShowKlinesTable,
      layoutLoadLog,
      layoutLoadDebugEnabled,
      setLayoutLoadDebugEnabled,
      layoutSaveLoadDebugEnabled,
      setLayoutSaveLoadDebugEnabled,
      addLayoutLoadLog,
      clearLayoutLoadLog,
    }),
    [showKlinesTable, layoutLoadLog, layoutLoadDebugEnabled, setLayoutLoadDebugEnabled, layoutSaveLoadDebugEnabled, setLayoutSaveLoadDebugEnabled, addLayoutLoadLog, clearLayoutLoadLog]
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
