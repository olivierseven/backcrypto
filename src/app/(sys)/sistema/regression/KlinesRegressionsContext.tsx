"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { RegressionSourceToken } from "./regressionSource";

export type RegressionModel = "linear" | "quadratic" | "cubic" | "quartic";
export type RegressionLineStyle = "dotted" | "dashed";

export interface UserRegressionConfig {
  id: string;
  /** Intervalo (minutos) em que a regressão é exibida. */
  groupMinutes: number;
  model: RegressionModel;
  /** Últimos N pontos válidos (REGRESSION_LOOKBACK_MIN–REGRESSION_LOOKBACK_MAX, default 14). */
  lookback: number;
  sourceIndicatorId: string;
  sourceToken: RegressionSourceToken;
  /** Barras à frente do último ponto (1–REGRESSION_FORECAST_BARS_MAX). */
  forecastBars: number;
  /** Desloca o fim da amostra para o passado (0 = barra mais recente da janela; até REGRESSION_PAST_OFFSET_MAX). */
  pastEndOffsetBars: number;
  lineStyle: RegressionLineStyle;
  lineWidth: "thin" | "normal" | "thick";
  color: string;
}

function isRegressionSourceToken(x: unknown): x is RegressionSourceToken {
  return (
    x === "line" ||
    x === "ohlc_open" ||
    x === "ohlc_high" ||
    x === "ohlc_low" ||
    x === "ohlc_close" ||
    x === "ohlc_hl2" ||
    x === "ohlc_oc2" ||
    x === "ohlc_hlc3" ||
    x === "ohlc_ohlc4" ||
    x === "bollinger_upper" ||
    x === "bollinger_middle" ||
    x === "bollinger_lower" ||
    x === "keltner_upper" ||
    x === "keltner_middle" ||
    x === "keltner_lower" ||
    x === "donchian_upper" ||
    x === "donchian_middle" ||
    x === "donchian_lower" ||
    x === "ichimoku_tenkan" ||
    x === "ichimoku_kijun" ||
    x === "ichimoku_spanA" ||
    x === "ichimoku_spanB" ||
    x === "ichimoku_chikou"
  );
}

/** Máximo de barras de previsão (todos os modelos). */
export const REGRESSION_FORECAST_BARS_MAX = 7;

export function maxForecastBarsForModel(_model: RegressionModel): number {
  return REGRESSION_FORECAST_BARS_MAX;
}

export const REGRESSION_LOOKBACK_MIN = 2;
export const REGRESSION_LOOKBACK_MAX = 50;
/** Quantas barras o fim da amostra pode recuar no tempo (dados mais antigos). */
export const REGRESSION_PAST_OFFSET_MAX = 50;

function clampPastEndOffset(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(REGRESSION_PAST_OFFSET_MAX, Math.round(n)));
}

function clampLookback(n: number): number {
  if (!Number.isFinite(n)) return 14;
  return Math.max(REGRESSION_LOOKBACK_MIN, Math.min(REGRESSION_LOOKBACK_MAX, Math.round(n)));
}

function clampForecast(n: number, model: RegressionModel): number {
  if (!Number.isFinite(n)) return 3;
  const cap = maxForecastBarsForModel(model);
  return Math.max(1, Math.min(cap, Math.round(n)));
}

/** Normaliza lista vinda do layout. */
export function normalizeUserRegressionsFromLayout(parsed: unknown): UserRegressionConfig[] {
  if (!Array.isArray(parsed)) return [];
  const out: UserRegressionConfig[] = [];
  for (const raw of parsed) {
    if (raw == null || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id) continue;
    if (typeof o.groupMinutes !== "number" || !Number.isFinite(o.groupMinutes)) continue;
    const model =
      o.model === "quartic"
        ? "quartic"
        : o.model === "cubic"
          ? "cubic"
          : o.model === "quadratic"
            ? "quadratic"
            : o.model === "linear"
              ? "linear"
              : null;
    if (!model) continue;
    if (typeof o.sourceIndicatorId !== "string" || !o.sourceIndicatorId) continue;
    if (!isRegressionSourceToken(o.sourceToken)) continue;
    const lineStyle: RegressionLineStyle = o.lineStyle === "dashed" ? "dashed" : "dotted";
    const lineWidth =
      o.lineWidth === "thin" || o.lineWidth === "thick" ? o.lineWidth : o.lineWidth === "normal" ? "normal" : "normal";
    const color = typeof o.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(o.color) ? o.color : "#6366f1";
    out.push({
      id: o.id,
      groupMinutes: o.groupMinutes,
      model,
      lookback: clampLookback(Number(o.lookback)),
      sourceIndicatorId: o.sourceIndicatorId,
      sourceToken: o.sourceToken,
      forecastBars: clampForecast(Number(o.forecastBars), model),
      pastEndOffsetBars: clampPastEndOffset(Number(o.pastEndOffsetBars)),
      lineStyle,
      lineWidth,
      color,
    });
  }
  return out;
}

export type UserRegressionUpdates = Partial<Omit<UserRegressionConfig, "id" | "groupMinutes">>;

type ContextValue = {
  userRegressions: UserRegressionConfig[];
  addRegression: (config: Omit<UserRegressionConfig, "id">) => UserRegressionConfig;
  updateRegression: (id: string, updates: UserRegressionUpdates) => void;
  removeRegression: (id: string) => void;
  replaceUserRegressionsFromLayout: (raw: unknown) => void;
};

const KlinesRegressionsContext = createContext<ContextValue | null>(null);

export function KlinesRegressionsProvider({ children }: { children: ReactNode }) {
  const [userRegressions, setUserRegressions] = useState<UserRegressionConfig[]>([]);

  const addRegression = useCallback((config: Omit<UserRegressionConfig, "id">) => {
    const id = `ur_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const next: UserRegressionConfig = {
      ...config,
      id,
      lookback: clampLookback(config.lookback),
      forecastBars: clampForecast(config.forecastBars, config.model),
      pastEndOffsetBars: clampPastEndOffset(config.pastEndOffsetBars),
    };
    setUserRegressions((prev) => [...prev, next]);
    return next;
  }, []);

  const removeRegression = useCallback((id: string) => {
    setUserRegressions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateRegression = useCallback((id: string, updates: UserRegressionUpdates) => {
    setUserRegressions((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...updates };
        return {
          ...next,
          lookback: clampLookback(next.lookback),
          forecastBars: clampForecast(next.forecastBars, next.model),
          pastEndOffsetBars: clampPastEndOffset(next.pastEndOffsetBars),
        };
      })
    );
  }, []);

  const replaceUserRegressionsFromLayout = useCallback((raw: unknown) => {
    setUserRegressions(normalizeUserRegressionsFromLayout(raw));
  }, []);

  const value = useMemo<ContextValue>(
    () => ({
      userRegressions,
      addRegression,
      updateRegression,
      removeRegression,
      replaceUserRegressionsFromLayout,
    }),
    [userRegressions, addRegression, updateRegression, removeRegression, replaceUserRegressionsFromLayout]
  );

  return <KlinesRegressionsContext.Provider value={value}>{children}</KlinesRegressionsContext.Provider>;
}

export function useKlinesRegressions(): ContextValue {
  const ctx = useContext(KlinesRegressionsContext);
  if (!ctx) throw new Error("useKlinesRegressions must be used within KlinesRegressionsProvider");
  return ctx;
}
