"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AggFastLiveDebugSnapshot } from "./aggFastLiveDebug";

const LAYOUT_DEBUG_MAX = 40;
const LAYOUT_DEBUG_STORAGE_KEY = "backcrypto-layout-debug";
const LAYOUT_SAVE_LOAD_DEBUG_STORAGE_KEY = "backcrypto-layout-save-load-debug";
const AGG_FAST_LIVE_DEBUG_STORAGE_KEY = "backcrypto-agg-fast-live-debug";
const SPOT_ORDER_CHART_DEBUG_STORAGE_KEY = "backcrypto-spot-order-chart-debug";
const NAV_PERF_DEBUG_STORAGE_KEY = "backcrypto-nav-perf-debug";
const NAV_PERF_LOG_MAX = 40;

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

function loadNavPerfDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(NAV_PERF_DEBUG_STORAGE_KEY) === "1";
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
  /** Tempos de rota / long tasks — preenchido em `navPerfLog` quando o modo está ligado. */
  navPerfDebugEnabled: boolean;
  setNavPerfDebugEnabled: (v: boolean) => void;
  navPerfLog: string[];
  addNavPerfLog: (msg: string) => void;
  clearNavPerfLog: () => void;
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
  navPerfDebugEnabled: false,
  setNavPerfDebugEnabled: () => {},
  navPerfLog: [],
  addNavPerfLog: () => {},
  clearNavPerfLog: () => {},
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
  const [navPerfDebugEnabled, setNavPerfDebugEnabledState] = useState(false);
  const [navPerfLog, setNavPerfLog] = useState<string[]>([]);

  useLayoutEffect(() => {
    setLayoutLoadDebugEnabledState(loadLayoutDebugEnabled());
    setLayoutSaveLoadDebugEnabledState(loadLayoutSaveLoadDebugEnabled());
    setAggFastLiveDebugEnabledState(loadAggFastLiveDebugEnabled());
    setSpotOrderChartDebugEnabledState(loadSpotOrderChartDebugEnabled());
    setNavPerfDebugEnabledState(loadNavPerfDebugEnabled());
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

  const setNavPerfDebugEnabled = useCallback((v: boolean) => {
    setNavPerfDebugEnabledState(v);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(NAV_PERF_DEBUG_STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const navPerfDebugEnabledRef = useRef(navPerfDebugEnabled);
  navPerfDebugEnabledRef.current = navPerfDebugEnabled;
  const navPerfQueueRef = useRef<string[]>([]);
  const navPerfFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navPerfLastMsgRef = useRef<string>("");
  const navPerfLastMsgAtRef = useRef<number>(0);

  const flushNavPerfQueue = useCallback(() => {
    const queued = navPerfQueueRef.current;
    navPerfQueueRef.current = [];
    if (queued.length === 0) return;
    setNavPerfLog((prev) => [...prev, ...queued].slice(-NAV_PERF_LOG_MAX));
  }, []);

  useLayoutEffect(() => {
    return () => {
      if (navPerfFlushTimerRef.current) {
        clearTimeout(navPerfFlushTimerRef.current);
        navPerfFlushTimerRef.current = null;
      }
      navPerfQueueRef.current = [];
    };
  }, []);

  const addNavPerfLog = useCallback((msg: string) => {
    if (!navPerfDebugEnabledRef.current) return;
    const now = Date.now();
    // Evita tempestade de logs idênticos em cascata no mesmo instante.
    if (msg === navPerfLastMsgRef.current && now - navPerfLastMsgAtRef.current < 250) return;
    navPerfLastMsgRef.current = msg;
    navPerfLastMsgAtRef.current = now;
    const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
    navPerfQueueRef.current.push(line);
    if (navPerfFlushTimerRef.current != null) return;
    navPerfFlushTimerRef.current = setTimeout(() => {
      navPerfFlushTimerRef.current = null;
      flushNavPerfQueue();
    }, 100);
  }, [flushNavPerfQueue]);

  const clearNavPerfLog = useCallback(() => {
    navPerfQueueRef.current = [];
    if (navPerfFlushTimerRef.current) {
      clearTimeout(navPerfFlushTimerRef.current);
      navPerfFlushTimerRef.current = null;
    }
    setNavPerfLog([]);
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
      navPerfDebugEnabled,
      setNavPerfDebugEnabled,
      navPerfLog,
      addNavPerfLog,
      clearNavPerfLog,
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
      navPerfDebugEnabled,
      setNavPerfDebugEnabled,
      navPerfLog,
      addNavPerfLog,
      clearNavPerfLog,
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
