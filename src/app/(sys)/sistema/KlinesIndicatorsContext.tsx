"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { KLINE_USER_INDICATORS_KEY, KLINE_PREFS_KEY } from "./KlinesChartConstants";

function loadShowIndicatorLastValueOnYAxis(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(KLINE_PREFS_KEY);
    if (!raw) return true;
    const data = JSON.parse(raw) as { showIndicatorLastValueOnYAxis?: boolean };
    return typeof data.showIndicatorLastValueOnYAxis === "boolean" ? data.showIndicatorLastValueOnYAxis : true;
  } catch {
    return true;
  }
}

function saveShowIndicatorLastValueOnYAxis(value: boolean) {
  try {
    const raw = localStorage.getItem(KLINE_PREFS_KEY);
    const data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    data.showIndicatorLastValueOnYAxis = value;
    localStorage.setItem(KLINE_PREFS_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export type UserIndicatorType = "SMA" | "EMA" | "WMA" | "RSI";

/** Onde o indicador é renderizado: Main = área principal; Panel 2/3/4 = indicadores secundários (ex.: RSI). */
export type IndicatorPanel = "main" | "panel2" | "panel3" | "panel4";

export type IndicatorLineWidth = "thin" | "normal";
export type IndicatorLineStyle = "solid" | "dotted" | "dashed";

/** Campo base ou coluna calculada (usuário) para o indicador. */
export type IndicatorFieldKey =
  | "open"
  | "high"
  | "low"
  | "close"
  | "volume"
  | `user_${string}`; // id de indicador usuário

export interface UserIndicatorConfig {
  id: string;
  type: UserIndicatorType;
  period: number;
  fieldKey: IndicatorFieldKey;
  color: string;
  /** groupMinutes em que o indicador aparece; vazio = todos. */
  intervals: number[];
  /** Onde renderizar: main (SMA/EMA/WMA) ou panel2/panel3/panel4 (RSI e outros secundários). */
  panel?: IndicatorPanel;
  lineWidth?: IndicatorLineWidth;
  lineStyle?: IndicatorLineStyle;
  /** Só para RSI: escala fixa 0–100 no eixo Y (default true). Se false, usa escala automática do painel. */
  rsiFixedScale?: boolean;
  /** Só para RSI: exibir linha central em 50%. */
  rsiCenterLine?: boolean;
  /** Só para RSI: cor da linha central 50%. */
  rsiCenterLineColor?: string;
  /** Só para RSI: espessura da linha central (thin | normal). */
  rsiCenterLineWidth?: IndicatorLineWidth;
  /** Só para RSI: estilo da linha central (solid | dotted | dashed). */
  rsiCenterLineStyle?: IndicatorLineStyle;
  /** Só para RSI: exibir limites superior e inferior. */
  rsiLimits?: boolean;
  /** Só para RSI: limite superior % (default 90). */
  rsiLimitUpper?: number;
  /** Só para RSI: limite inferior % (default 10). */
  rsiLimitLower?: number;
  /** Só para RSI: cor das linhas de limite (default vermelho). */
  rsiLimitColor?: string;
  rsiLimitLineWidth?: IndicatorLineWidth;
  rsiLimitLineStyle?: IndicatorLineStyle;
}

const FIELD_KEY_TO_INDEX: Record<string, number> = {
  open: 1,
  high: 2,
  low: 3,
  close: 4,
  volume: 5,
};

/**
 * Retorna o índice da coluna no array kline para um fieldKey.
 * Para user_<id>, usa a lista de userIndicators para obter o índice (12 + posição).
 */
export function getFieldIndex(
  fieldKey: IndicatorFieldKey,
  userIndicators: UserIndicatorConfig[]
): number {
  if (fieldKey in FIELD_KEY_TO_INDEX) return FIELD_KEY_TO_INDEX[fieldKey];
  if (fieldKey.startsWith("user_")) {
    const id = fieldKey.slice(5);
    const idx = userIndicators.findIndex((u) => u.id === id);
    if (idx >= 0) return 12 + idx;
  }
  return 4; // fallback close
}

function loadFromStorage(): UserIndicatorConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KLINE_USER_INDICATORS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is UserIndicatorConfig => {
        if (p == null || typeof p !== "object") return false;
        const u = p as UserIndicatorConfig;
        return (
          typeof u.id === "string" &&
          (u.type === "SMA" || u.type === "EMA" || u.type === "WMA" || u.type === "RSI") &&
          typeof u.period === "number" &&
          typeof u.fieldKey === "string" &&
          typeof u.color === "string" &&
          Array.isArray(u.intervals)
        );
      }
    ).map((u) => ({
      ...u,
      panel: u.panel === "main" || u.panel === "panel2" || u.panel === "panel3" || u.panel === "panel4"
        ? u.panel
        : (u.type === "RSI" ? "panel2" : "main"),
      lineWidth: u.lineWidth === "thin" || u.lineWidth === "normal" ? u.lineWidth : "normal",
      lineStyle: u.lineStyle === "solid" || u.lineStyle === "dotted" || u.lineStyle === "dashed" ? u.lineStyle : "solid",
      rsiFixedScale: u.type === "RSI" ? (u.rsiFixedScale === false ? false : true) : undefined,
      rsiCenterLine: u.type === "RSI" ? (u.rsiCenterLine === true) : undefined,
      rsiCenterLineColor: u.type === "RSI" && u.rsiCenterLine ? (u.rsiCenterLineColor ?? "#71717a") : undefined,
      rsiCenterLineWidth: u.type === "RSI" && u.rsiCenterLine ? (u.rsiCenterLineWidth === "thin" || u.rsiCenterLineWidth === "normal" ? u.rsiCenterLineWidth : "normal") : undefined,
      rsiCenterLineStyle: u.type === "RSI" && u.rsiCenterLine ? (u.rsiCenterLineStyle === "solid" || u.rsiCenterLineStyle === "dotted" || u.rsiCenterLineStyle === "dashed" ? u.rsiCenterLineStyle : "dotted") : undefined,
      rsiLimits: u.type === "RSI" ? (u.rsiLimits === true) : undefined,
      rsiLimitUpper: u.type === "RSI" && u.rsiLimits ? (typeof u.rsiLimitUpper === "number" ? Math.max(0, Math.min(100, Math.round(u.rsiLimitUpper))) : 90) : undefined,
      rsiLimitLower: u.type === "RSI" && u.rsiLimits ? (typeof u.rsiLimitLower === "number" ? Math.max(0, Math.min(100, Math.round(u.rsiLimitLower))) : 10) : undefined,
      rsiLimitColor: u.type === "RSI" && u.rsiLimits ? (u.rsiLimitColor ?? "#dc2626") : undefined,
      rsiLimitLineWidth: u.type === "RSI" && u.rsiLimits ? (u.rsiLimitLineWidth === "thin" || u.rsiLimitLineWidth === "normal" ? u.rsiLimitLineWidth : "normal") : undefined,
      rsiLimitLineStyle: u.type === "RSI" && u.rsiLimits ? (u.rsiLimitLineStyle === "solid" || u.rsiLimitLineStyle === "dotted" || u.rsiLimitLineStyle === "dashed" ? u.rsiLimitLineStyle : "dotted") : undefined,
    }));
  } catch {
    return [];
  }
}

function saveToStorage(list: UserIndicatorConfig[]) {
  try {
    localStorage.setItem(KLINE_USER_INDICATORS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Campos editáveis de um indicador (sem id). */
export type UserIndicatorEditable = Pick<
  UserIndicatorConfig,
  "period" | "fieldKey" | "color" | "panel" | "lineWidth" | "lineStyle" | "rsiFixedScale" | "rsiCenterLine" | "rsiCenterLineColor" | "rsiCenterLineWidth" | "rsiCenterLineStyle" | "rsiLimits" | "rsiLimitUpper" | "rsiLimitLower" | "rsiLimitColor" | "rsiLimitLineWidth" | "rsiLimitLineStyle"
>;

interface ContextValue {
  userIndicators: UserIndicatorConfig[];
  currentGroupMinutes: number | null;
  setCurrentGroupMinutes: (v: number | null) => void;
  showIndicatorLastValueOnYAxis: boolean;
  setShowIndicatorLastValueOnYAxis: (v: boolean) => void;
  addIndicator: (config: Omit<UserIndicatorConfig, "id">) => void;
  removeIndicator: (id: string) => void;
  updateIndicator: (id: string, updates: Partial<UserIndicatorEditable>) => void;
  updateIndicatorIntervals: (id: string, intervals: number[]) => void;
}

const KlinesIndicatorsContext = createContext<ContextValue | null>(null);

export function KlinesIndicatorsProvider({ children }: { children: ReactNode }) {
  const [userIndicators, setUserIndicators] = useState<UserIndicatorConfig[]>(loadFromStorage);
  const [currentGroupMinutes, setCurrentGroupMinutes] = useState<number | null>(null);
  const [showIndicatorLastValueOnYAxis, setShowIndicatorLastValueOnYAxisState] = useState(loadShowIndicatorLastValueOnYAxis);

  const setShowIndicatorLastValueOnYAxis = useCallback((v: boolean) => {
    setShowIndicatorLastValueOnYAxisState(v);
    saveShowIndicatorLastValueOnYAxis(v);
  }, []);

  const addIndicator = useCallback((config: Omit<UserIndicatorConfig, "id">) => {
    const id = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setUserIndicators((prev) => {
      const next = [...prev, { ...config, id }];
      saveToStorage(next);
      return next;
    });
  }, []);

  const removeIndicator = useCallback((id: string) => {
    setUserIndicators((prev) => {
      const next = prev.filter((u) => u.id !== id);
      saveToStorage(next);
      return next;
    });
  }, []);

  const updateIndicator = useCallback((id: string, updates: Partial<UserIndicatorEditable>) => {
    setUserIndicators((prev) => {
      const next = prev.map((u) =>
        u.id === id ? { ...u, ...updates } : u
      );
      saveToStorage(next);
      return next;
    });
  }, []);

  const updateIndicatorIntervals = useCallback((id: string, intervals: number[]) => {
    setUserIndicators((prev) => {
      const next = prev.map((u) => (u.id === id ? { ...u, intervals } : u));
      saveToStorage(next);
      return next;
    });
  }, []);

  const value = useMemo<ContextValue>(
    () => ({
      userIndicators,
      currentGroupMinutes,
      setCurrentGroupMinutes,
      showIndicatorLastValueOnYAxis,
      setShowIndicatorLastValueOnYAxis,
      addIndicator,
      removeIndicator,
      updateIndicator,
      updateIndicatorIntervals,
    }),
    [userIndicators, currentGroupMinutes, showIndicatorLastValueOnYAxis, setShowIndicatorLastValueOnYAxis, addIndicator, removeIndicator, updateIndicator, updateIndicatorIntervals]
  );

  return (
    <KlinesIndicatorsContext.Provider value={value}>
      {children}
    </KlinesIndicatorsContext.Provider>
  );
}

export function useKlinesIndicators(): ContextValue {
  const ctx = useContext(KlinesIndicatorsContext);
  if (!ctx) throw new Error("useKlinesIndicators must be used within KlinesIndicatorsProvider");
  return ctx;
}
