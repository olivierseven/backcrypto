"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AggFastLiveDebugSnapshot } from "./aggFastLiveDebug";

const LAYOUT_DEBUG_MAX = 40;
const LAYOUT_DEBUG_STORAGE_KEY = "backcrypto-layout-debug";
const LAYOUT_SAVE_LOAD_DEBUG_STORAGE_KEY = "backcrypto-layout-save-load-debug";
const AGG_FAST_LIVE_DEBUG_STORAGE_KEY = "backcrypto-agg-fast-live-debug";
const SPOT_ORDER_CHART_DEBUG_STORAGE_KEY = "backcrypto-spot-order-chart-debug";

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

function loadAggFastLiveDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AGG_FAST_LIVE_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function loadSpotOrderChartDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SPOT_ORDER_CHART_DEBUG_STORAGE_KEY) === "1";
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
  /** Debug agregação atemporal: buffer 5t/500tr vs tier (P15, P25, …). */
  aggFastLiveDebugEnabled: boolean;
  setAggFastLiveDebugEnabled: (v: boolean) => void;
  aggFastLiveDebugSnapshot: AggFastLiveDebugSnapshot | null;
  setAggFastLiveDebugSnapshot: (s: AggFastLiveDebugSnapshot | null) => void;
  /** Admin › Debug › Inspecionar: JSON de ordens spot no gráfico (KlinesTable preenche quando ativo). */
  spotOrderChartDebugEnabled: boolean;
  setSpotOrderChartDebugEnabled: (v: boolean) => void;
  spotOrderChartDebugPayload: unknown | null;
  setSpotOrderChartDebugPayload: (p: unknown | null) => void;
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
  aggFastLiveDebugEnabled: false,
  setAggFastLiveDebugEnabled: () => {},
  aggFastLiveDebugSnapshot: null,
  setAggFastLiveDebugSnapshot: () => {},
  spotOrderChartDebugEnabled: false,
  setSpotOrderChartDebugEnabled: () => {},
  spotOrderChartDebugPayload: null,
  setSpotOrderChartDebugPayload: () => {},
};

export function SistemaDebugProvider({ children }: { children: ReactNode }) {
  const [showKlinesTable, setShowKlinesTable] = useState(false);
  const [layoutLoadLog, setLayoutLoadLog] = useState<string[]>([]);
  const [layoutLoadDebugEnabled, setLayoutLoadDebugEnabledState] = useState(false);
  const [layoutSaveLoadDebugEnabled, setLayoutSaveLoadDebugEnabledState] = useState(false);
  const [aggFastLiveDebugEnabled, setAggFastLiveDebugEnabledState] = useState(false);
  const [aggFastLiveDebugSnapshot, setAggFastLiveDebugSnapshotState] = useState<AggFastLiveDebugSnapshot | null>(null);
  const [spotOrderChartDebugEnabled, setSpotOrderChartDebugEnabledState] = useState(false);
  const [spotOrderChartDebugPayload, setSpotOrderChartDebugPayloadState] = useState<unknown | null>(null);

  useLayoutEffect(() => {
    setLayoutLoadDebugEnabledState(loadLayoutDebugEnabled());
    setLayoutSaveLoadDebugEnabledState(loadLayoutSaveLoadDebugEnabled());
    setAggFastLiveDebugEnabledState(loadAggFastLiveDebugEnabled());
    setSpotOrderChartDebugEnabledState(loadSpotOrderChartDebugEnabled());
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

  const setAggFastLiveDebugEnabled = useCallback((v: boolean) => {
    setAggFastLiveDebugEnabledState(v);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(AGG_FAST_LIVE_DEBUG_STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!v) setAggFastLiveDebugSnapshotState(null);
  }, []);

  const setSpotOrderChartDebugEnabled = useCallback((v: boolean) => {
    setSpotOrderChartDebugEnabledState(v);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(SPOT_ORDER_CHART_DEBUG_STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!v) setSpotOrderChartDebugPayloadState(null);
  }, []);

  const setSpotOrderChartDebugPayload = useCallback((p: unknown | null) => {
    setSpotOrderChartDebugPayloadState(p);
  }, []);

  const setAggFastLiveDebugSnapshot = useCallback((s: AggFastLiveDebugSnapshot | null) => {
    setAggFastLiveDebugSnapshotState(s);
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
      aggFastLiveDebugEnabled,
      setAggFastLiveDebugEnabled,
      aggFastLiveDebugSnapshot,
      setAggFastLiveDebugSnapshot,
      spotOrderChartDebugEnabled,
      setSpotOrderChartDebugEnabled,
      spotOrderChartDebugPayload,
      setSpotOrderChartDebugPayload,
    }),
    [
      showKlinesTable,
      layoutLoadLog,
      layoutLoadDebugEnabled,
      setLayoutLoadDebugEnabled,
      layoutSaveLoadDebugEnabled,
      setLayoutSaveLoadDebugEnabled,
      addLayoutLoadLog,
      clearLayoutLoadLog,
      aggFastLiveDebugEnabled,
      setAggFastLiveDebugEnabled,
      aggFastLiveDebugSnapshot,
      setAggFastLiveDebugSnapshot,
      spotOrderChartDebugEnabled,
      setSpotOrderChartDebugEnabled,
      spotOrderChartDebugPayload,
      setSpotOrderChartDebugPayload,
    ]
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
