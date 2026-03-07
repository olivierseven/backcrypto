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

export type UserIndicatorType = "SMA" | "EMA" | "WMA" | "RSI" | "MACD" | "Stochastic" | "WilliamsR" | "OBV" | "SAR" | "ATR" | "VWAP" | "Bollinger" | "Volume";

/** Onde o indicador é renderizado: Main = área principal; Panel 2/3/4 = indicadores secundários (ex.: RSI). */
export type IndicatorPanel = "main" | "panel2" | "panel3" | "panel4" | "panel5";

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
  /** Exibir valor do indicador no eixo Y (default true). Quando false, não mostra no gráfico apenas deste indicador. */
  showLastValueOnYAxis?: boolean;
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
  /** Só para MACD: tipo da média rápida (SMA | EMA | WMA). */
  macdFastMaType?: "SMA" | "EMA" | "WMA";
  /** Só para MACD: período da média rápida. */
  macdFastPeriod?: number;
  /** Só para MACD: tipo da média lenta. */
  macdSlowMaType?: "SMA" | "EMA" | "WMA";
  /** Só para MACD: período da média lenta. */
  macdSlowPeriod?: number;
  /** Só para MACD: exibir linha de sinal (MA aplicada à linha MACD). */
  macdSignalLine?: boolean;
  /** Só para MACD: tipo da média da linha de sinal (SMA | EMA | WMA). */
  macdSignalMaType?: "SMA" | "EMA" | "WMA";
  /** Só para MACD: período da linha de sinal. */
  macdSignalPeriod?: number;
  /** Só para MACD: cor da linha de sinal. */
  macdSignalColor?: string;
  macdSignalLineWidth?: IndicatorLineWidth;
  macdSignalLineStyle?: IndicatorLineStyle;
  /** Só para MACD: exibir histograma (MACD − linha de sinal). Só disponível com linha de sinal. */
  macdHistogram?: boolean;
  /** Só para MACD: cor das barras do histograma acima de zero. */
  macdHistogramColorAbove?: string;
  /** Só para MACD: cor das barras do histograma abaixo de zero. */
  macdHistogramColorBelow?: string;
  /** Só para Stochastic: exibir limites superior e inferior (0–100). */
  stochLimits?: boolean;
  /** Só para Stochastic: limite superior % (default 80). */
  stochLimitUpper?: number;
  /** Só para Stochastic: limite inferior % (default 20). */
  stochLimitLower?: number;
  /** Só para Stochastic: cor das linhas de limite. */
  stochLimitColor?: string;
  stochLimitLineWidth?: IndicatorLineWidth;
  stochLimitLineStyle?: IndicatorLineStyle;
  /** Só para Stochastic: exibir linha %D (MA da %K). */
  stochDLine?: boolean;
  /** Só para Stochastic: tipo da média da %D (SMA | EMA | WMA). */
  stochDMaType?: "SMA" | "EMA" | "WMA";
  /** Só para Stochastic: período da %D (default 3). */
  stochDPeriod?: number;
  /** Só para Stochastic: cor da linha %D. */
  stochDColor?: string;
  stochDLineWidth?: IndicatorLineWidth;
  stochDLineStyle?: IndicatorLineStyle;
  /** Só para Williams %R: exibir limites (escala -100 a 0; default -80 e -20). */
  williamsRLimits?: boolean;
  /** Só para Williams %R: limite superior (default -20, overbought). */
  williamsRLimitUpper?: number;
  /** Só para Williams %R: limite inferior (default -80, oversold). */
  williamsRLimitLower?: number;
  williamsRLimitColor?: string;
  williamsRLimitLineWidth?: IndicatorLineWidth;
  williamsRLimitLineStyle?: IndicatorLineStyle;
  /** Só para SAR (Parabolic SAR): valor inicial do Acceleration Factor (default 0.02). */
  sarStart?: number;
  /** Só para SAR: incremento do AF (default 0.02). */
  sarIncrement?: number;
  /** Só para SAR: valor máximo do AF (default 0.2). */
  sarMax?: number;
  /** Só para SAR: tamanho do ponto no gráfico (thin = mais fino, normal = mais grosso). */
  sarPointSize?: "thin" | "normal";
  /** Só para Bollinger: tipo da média móvel (SMA | EMA | WMA). */
  bollingerMaType?: "SMA" | "EMA" | "WMA";
  /** Só para Bollinger: multiplicador Z (0–3, default 2). */
  bollingerZ?: number;
  /** Só para Bollinger: exibir banda superior (default true). */
  bollingerShowUpper?: boolean;
  /** Só para Bollinger: exibir banda inferior (default true). */
  bollingerShowLower?: boolean;
  /** Só para Bollinger: exibir linha da média móvel (default false). */
  bollingerShowMiddle?: boolean;
  /** Só para Bollinger: opacidade da faixa entre limite e média (0–0.3, default 0.2). */
  bollingerBandOpacity?: number;
  /** Só para Bollinger: cor das bandas superior/inferior. */
  bollingerLimitsColor?: string;
  /** Só para Bollinger: estilo de traço das bandas. */
  bollingerLimitsLineStyle?: IndicatorLineStyle;
  bollingerLimitsLineWidth?: IndicatorLineWidth;
  /** Só para Bollinger: cor da média móvel. */
  bollingerMiddleColor?: string;
  /** Só para Bollinger: estilo de traço da média. */
  bollingerMiddleLineStyle?: IndicatorLineStyle;
  bollingerMiddleLineWidth?: IndicatorLineWidth;
  /** Só para Volume: exibir volume em USDT (quote); default false = volume em base. */
  volumeInUsdt?: boolean;
  /** Só para Volume: cor das barras quando o candle fecha positivo (close >= open). */
  volumeColorAbove?: string;
  /** Só para Volume: cor das barras quando o candle fecha negativo (close < open). */
  volumeColorBelow?: string;
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
          (u.type === "SMA" || u.type === "EMA" || u.type === "WMA" || u.type === "RSI" || u.type === "MACD" || u.type === "Stochastic" || u.type === "WilliamsR" || u.type === "OBV" || u.type === "SAR" || u.type === "ATR" || u.type === "VWAP" || u.type === "Bollinger" || u.type === "Volume") &&
          typeof u.period === "number" &&
          typeof u.fieldKey === "string" &&
          typeof u.color === "string" &&
          Array.isArray(u.intervals)
        );
      }
    ).map((u) => ({
      ...u,
      fieldKey: u.type === "WilliamsR" ? "close" : (u.type === "OBV" ? "volume" : u.type === "ATR" || u.type === "VWAP" ? "close" : u.type === "Volume" ? "volume" : u.fieldKey),
      panel: u.type === "SAR" || u.type === "VWAP" ? "main" : (u.panel === "main" || u.panel === "panel2" || u.panel === "panel3" || u.panel === "panel4" || u.panel === "panel5"
        ? u.panel
        : (u.type === "RSI" || u.type === "MACD" || u.type === "Stochastic" || u.type === "WilliamsR" || u.type === "OBV" || u.type === "ATR" || u.type === "Volume" ? "panel2" : "main")),
      sarStart: u.type === "SAR" ? (typeof u.sarStart === "number" ? Math.max(0.001, Math.min(1, u.sarStart)) : 0.02) : undefined,
      sarIncrement: u.type === "SAR" ? (typeof u.sarIncrement === "number" ? Math.max(0.001, Math.min(1, u.sarIncrement)) : 0.02) : undefined,
      sarMax: u.type === "SAR" ? (typeof u.sarMax === "number" ? Math.max(0.02, Math.min(1, u.sarMax)) : 0.2) : undefined,
      sarPointSize: u.type === "SAR" ? (u.sarPointSize === "thin" || u.sarPointSize === "normal" ? u.sarPointSize : "normal") : undefined,
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
      macdFastMaType: u.type === "MACD" ? (u.macdFastMaType === "SMA" || u.macdFastMaType === "EMA" || u.macdFastMaType === "WMA" ? u.macdFastMaType : "EMA") : undefined,
      macdFastPeriod: u.type === "MACD" ? (typeof u.macdFastPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.macdFastPeriod))) : 12) : undefined,
      macdSlowMaType: u.type === "MACD" ? (u.macdSlowMaType === "SMA" || u.macdSlowMaType === "EMA" || u.macdSlowMaType === "WMA" ? u.macdSlowMaType : "EMA") : undefined,
      macdSlowPeriod: u.type === "MACD" ? (typeof u.macdSlowPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.macdSlowPeriod))) : 26) : undefined,
      macdSignalLine: u.type === "MACD" ? (u.macdSignalLine === true) : undefined,
      macdSignalMaType: u.type === "MACD" && u.macdSignalLine ? (u.macdSignalMaType === "SMA" || u.macdSignalMaType === "EMA" || u.macdSignalMaType === "WMA" ? u.macdSignalMaType : "EMA") : undefined,
      macdSignalPeriod: u.type === "MACD" && u.macdSignalLine ? (typeof u.macdSignalPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.macdSignalPeriod))) : 9) : undefined,
      macdSignalColor: u.type === "MACD" && u.macdSignalLine ? (u.macdSignalColor ?? "#ea580c") : undefined,
      macdSignalLineWidth: u.type === "MACD" && u.macdSignalLine ? (u.macdSignalLineWidth === "thin" || u.macdSignalLineWidth === "normal" ? u.macdSignalLineWidth : "normal") : undefined,
      macdSignalLineStyle: u.type === "MACD" && u.macdSignalLine ? (u.macdSignalLineStyle === "solid" || u.macdSignalLineStyle === "dotted" || u.macdSignalLineStyle === "dashed" ? u.macdSignalLineStyle : "dashed") : undefined,
      macdHistogram: u.type === "MACD" && u.macdSignalLine ? (u.macdHistogram === true) : undefined,
      macdHistogramColorAbove: u.type === "MACD" && u.macdSignalLine && u.macdHistogram ? (u.macdHistogramColorAbove ?? "#059669") : undefined,
      macdHistogramColorBelow: u.type === "MACD" && u.macdSignalLine && u.macdHistogram ? (u.macdHistogramColorBelow ?? "#dc2626") : undefined,
      stochLimits: u.type === "Stochastic" ? (u.stochLimits === true) : undefined,
      stochLimitUpper: u.type === "Stochastic" && u.stochLimits ? (typeof u.stochLimitUpper === "number" ? Math.max(0, Math.min(100, Math.round(u.stochLimitUpper))) : 80) : undefined,
      stochLimitLower: u.type === "Stochastic" && u.stochLimits ? (typeof u.stochLimitLower === "number" ? Math.max(0, Math.min(100, Math.round(u.stochLimitLower))) : 20) : undefined,
      stochLimitColor: u.type === "Stochastic" && u.stochLimits ? (u.stochLimitColor ?? "#dc2626") : undefined,
      stochLimitLineWidth: u.type === "Stochastic" && u.stochLimits ? (u.stochLimitLineWidth === "thin" || u.stochLimitLineWidth === "normal" ? u.stochLimitLineWidth : "normal") : undefined,
      stochLimitLineStyle: u.type === "Stochastic" && u.stochLimits ? (u.stochLimitLineStyle === "solid" || u.stochLimitLineStyle === "dotted" || u.stochLimitLineStyle === "dashed" ? u.stochLimitLineStyle : "dotted") : undefined,
      stochDLine: u.type === "Stochastic" ? (u.stochDLine === true) : undefined,
      stochDMaType: u.type === "Stochastic" && u.stochDLine ? (u.stochDMaType === "SMA" || u.stochDMaType === "EMA" || u.stochDMaType === "WMA" ? u.stochDMaType : "SMA") : undefined,
      stochDPeriod: u.type === "Stochastic" && u.stochDLine ? (typeof u.stochDPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.stochDPeriod))) : 3) : undefined,
      stochDColor: u.type === "Stochastic" && u.stochDLine ? (u.stochDColor ?? "#ea580c") : undefined,
      stochDLineWidth: u.type === "Stochastic" && u.stochDLine ? (u.stochDLineWidth === "thin" || u.stochDLineWidth === "normal" ? u.stochDLineWidth : "normal") : undefined,
      stochDLineStyle: u.type === "Stochastic" && u.stochDLine ? (u.stochDLineStyle === "solid" || u.stochDLineStyle === "dotted" || u.stochDLineStyle === "dashed" ? u.stochDLineStyle : "dashed") : undefined,
      williamsRLimits: u.type === "WilliamsR" ? (u.williamsRLimits === true) : undefined,
      williamsRLimitUpper: u.type === "WilliamsR" && u.williamsRLimits ? (typeof u.williamsRLimitUpper === "number" ? Math.max(-100, Math.min(0, Math.round(u.williamsRLimitUpper))) : -20) : undefined,
      williamsRLimitLower: u.type === "WilliamsR" && u.williamsRLimits ? (typeof u.williamsRLimitLower === "number" ? Math.max(-100, Math.min(0, Math.round(u.williamsRLimitLower))) : -80) : undefined,
      williamsRLimitColor: u.type === "WilliamsR" && u.williamsRLimits ? (u.williamsRLimitColor ?? "#dc2626") : undefined,
      williamsRLimitLineWidth: u.type === "WilliamsR" && u.williamsRLimits ? (u.williamsRLimitLineWidth === "thin" || u.williamsRLimitLineWidth === "normal" ? u.williamsRLimitLineWidth : "normal") : undefined,
      williamsRLimitLineStyle: u.type === "WilliamsR" && u.williamsRLimits ? (u.williamsRLimitLineStyle === "solid" || u.williamsRLimitLineStyle === "dotted" || u.williamsRLimitLineStyle === "dashed" ? u.williamsRLimitLineStyle : "dotted") : undefined,
      bollingerMaType: u.type === "Bollinger" ? (u.bollingerMaType === "SMA" || u.bollingerMaType === "EMA" || u.bollingerMaType === "WMA" ? u.bollingerMaType : "SMA") : undefined,
      bollingerZ: u.type === "Bollinger" ? (typeof u.bollingerZ === "number" ? Math.max(0, Math.min(3, u.bollingerZ)) : 2) : undefined,
      bollingerShowUpper: u.type === "Bollinger" ? (u.bollingerShowUpper !== false) : undefined,
      bollingerShowLower: u.type === "Bollinger" ? (u.bollingerShowLower !== false) : undefined,
      bollingerShowMiddle: u.type === "Bollinger" ? (u.bollingerShowMiddle === true) : undefined,
      bollingerBandOpacity: u.type === "Bollinger" ? (typeof u.bollingerBandOpacity === "number" ? Math.max(0, Math.min(0.3, u.bollingerBandOpacity)) : 0.2) : undefined,
      bollingerLimitsColor: u.type === "Bollinger" ? (u.bollingerLimitsColor ?? "#6366f1") : undefined,
      bollingerLimitsLineStyle: u.type === "Bollinger" ? (u.bollingerLimitsLineStyle === "solid" || u.bollingerLimitsLineStyle === "dotted" || u.bollingerLimitsLineStyle === "dashed" ? u.bollingerLimitsLineStyle : "solid") : undefined,
      bollingerLimitsLineWidth: u.type === "Bollinger" ? (u.bollingerLimitsLineWidth === "thin" || u.bollingerLimitsLineWidth === "normal" ? u.bollingerLimitsLineWidth : "normal") : undefined,
      bollingerMiddleColor: u.type === "Bollinger" ? (u.bollingerMiddleColor ?? "#a855f7") : undefined,
      bollingerMiddleLineStyle: u.type === "Bollinger" ? (u.bollingerMiddleLineStyle === "solid" || u.bollingerMiddleLineStyle === "dotted" || u.bollingerMiddleLineStyle === "dashed" ? u.bollingerMiddleLineStyle : "dashed") : undefined,
      bollingerMiddleLineWidth: u.type === "Bollinger" ? (u.bollingerMiddleLineWidth === "thin" || u.bollingerMiddleLineWidth === "normal" ? u.bollingerMiddleLineWidth : "normal") : undefined,
      volumeInUsdt: u.type === "Volume" ? (u.volumeInUsdt === true) : undefined,
      volumeColorAbove: u.type === "Volume" ? (u.volumeColorAbove ?? "#10b981") : undefined,
      volumeColorBelow: u.type === "Volume" ? (u.volumeColorBelow ?? "#ef4444") : undefined,
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

/** Normaliza uma lista vinda do layout (ou localStorage) para UserIndicatorConfig[]. */
export function normalizeIndicatorListFromLayout(parsed: unknown): UserIndicatorConfig[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (p): p is UserIndicatorConfig => {
      if (p == null || typeof p !== "object") return false;
      const u = p as UserIndicatorConfig;
      return (
        typeof u.id === "string" &&
        (u.type === "SMA" || u.type === "EMA" || u.type === "WMA" || u.type === "RSI" || u.type === "MACD" || u.type === "Stochastic" || u.type === "WilliamsR" || u.type === "OBV" || u.type === "SAR" || u.type === "ATR" || u.type === "VWAP" || u.type === "Bollinger" || u.type === "Volume") &&
        typeof u.period === "number" &&
        typeof u.fieldKey === "string" &&
        typeof u.color === "string" &&
        Array.isArray(u.intervals)
      );
    }
  ).map((u) => ({
    ...u,
    fieldKey: u.type === "WilliamsR" ? "close" : (u.type === "OBV" ? "volume" : u.type === "ATR" || u.type === "VWAP" ? "close" : u.type === "Volume" ? "volume" : u.fieldKey),
    panel: u.type === "SAR" || u.type === "VWAP" ? "main" : (u.panel === "main" || u.panel === "panel2" || u.panel === "panel3" || u.panel === "panel4" || u.panel === "panel5"
      ? u.panel
      : (u.type === "RSI" || u.type === "MACD" || u.type === "Stochastic" || u.type === "WilliamsR" || u.type === "OBV" || u.type === "ATR" || u.type === "Volume" ? "panel2" : "main")),
    sarStart: u.type === "SAR" ? (typeof u.sarStart === "number" ? Math.max(0.001, Math.min(1, u.sarStart)) : 0.02) : undefined,
    sarIncrement: u.type === "SAR" ? (typeof u.sarIncrement === "number" ? Math.max(0.001, Math.min(1, u.sarIncrement)) : 0.02) : undefined,
    sarMax: u.type === "SAR" ? (typeof u.sarMax === "number" ? Math.max(0.02, Math.min(1, u.sarMax)) : 0.2) : undefined,
    sarPointSize: u.type === "SAR" ? (u.sarPointSize === "thin" || u.sarPointSize === "normal" ? u.sarPointSize : "normal") : undefined,
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
    macdFastMaType: u.type === "MACD" ? (u.macdFastMaType === "SMA" || u.macdFastMaType === "EMA" || u.macdFastMaType === "WMA" ? u.macdFastMaType : "EMA") : undefined,
    macdFastPeriod: u.type === "MACD" ? (typeof u.macdFastPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.macdFastPeriod))) : 12) : undefined,
    macdSlowMaType: u.type === "MACD" ? (u.macdSlowMaType === "SMA" || u.macdSlowMaType === "EMA" || u.macdSlowMaType === "WMA" ? u.macdSlowMaType : "EMA") : undefined,
    macdSlowPeriod: u.type === "MACD" ? (typeof u.macdSlowPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.macdSlowPeriod))) : 26) : undefined,
    macdSignalLine: u.type === "MACD" ? (u.macdSignalLine === true) : undefined,
    macdSignalMaType: u.type === "MACD" && u.macdSignalLine ? (u.macdSignalMaType === "SMA" || u.macdSignalMaType === "EMA" || u.macdSignalMaType === "WMA" ? u.macdSignalMaType : "EMA") : undefined,
    macdSignalPeriod: u.type === "MACD" && u.macdSignalLine ? (typeof u.macdSignalPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.macdSignalPeriod))) : 9) : undefined,
    macdSignalColor: u.type === "MACD" && u.macdSignalLine ? (u.macdSignalColor ?? "#ea580c") : undefined,
    macdSignalLineWidth: u.type === "MACD" && u.macdSignalLine ? (u.macdSignalLineWidth === "thin" || u.macdSignalLineWidth === "normal" ? u.macdSignalLineWidth : "normal") : undefined,
    macdSignalLineStyle: u.type === "MACD" && u.macdSignalLine ? (u.macdSignalLineStyle === "solid" || u.macdSignalLineStyle === "dotted" || u.macdSignalLineStyle === "dashed" ? u.macdSignalLineStyle : "dashed") : undefined,
    macdHistogram: u.type === "MACD" && u.macdSignalLine ? (u.macdHistogram === true) : undefined,
    macdHistogramColorAbove: u.type === "MACD" && u.macdSignalLine && u.macdHistogram ? (u.macdHistogramColorAbove ?? "#059669") : undefined,
    macdHistogramColorBelow: u.type === "MACD" && u.macdSignalLine && u.macdHistogram ? (u.macdHistogramColorBelow ?? "#dc2626") : undefined,
    stochLimits: u.type === "Stochastic" ? (u.stochLimits === true) : undefined,
    stochLimitUpper: u.type === "Stochastic" && u.stochLimits ? (typeof u.stochLimitUpper === "number" ? Math.max(0, Math.min(100, Math.round(u.stochLimitUpper))) : 80) : undefined,
    stochLimitLower: u.type === "Stochastic" && u.stochLimits ? (typeof u.stochLimitLower === "number" ? Math.max(0, Math.min(100, Math.round(u.stochLimitLower))) : 20) : undefined,
    stochLimitColor: u.type === "Stochastic" && u.stochLimits ? (u.stochLimitColor ?? "#dc2626") : undefined,
    stochLimitLineWidth: u.type === "Stochastic" && u.stochLimits ? (u.stochLimitLineWidth === "thin" || u.stochLimitLineWidth === "normal" ? u.stochLimitLineWidth : "normal") : undefined,
    stochLimitLineStyle: u.type === "Stochastic" && u.stochLimits ? (u.stochLimitLineStyle === "solid" || u.stochLimitLineStyle === "dotted" || u.stochLimitLineStyle === "dashed" ? u.stochLimitLineStyle : "dotted") : undefined,
    stochDLine: u.type === "Stochastic" ? (u.stochDLine === true) : undefined,
    stochDMaType: u.type === "Stochastic" && u.stochDLine ? (u.stochDMaType === "SMA" || u.stochDMaType === "EMA" || u.stochDMaType === "WMA" ? u.stochDMaType : "SMA") : undefined,
    stochDPeriod: u.type === "Stochastic" && u.stochDLine ? (typeof u.stochDPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.stochDPeriod))) : 3) : undefined,
    stochDColor: u.type === "Stochastic" && u.stochDLine ? (u.stochDColor ?? "#ea580c") : undefined,
    stochDLineWidth: u.type === "Stochastic" && u.stochDLine ? (u.stochDLineWidth === "thin" || u.stochDLineWidth === "normal" ? u.stochDLineWidth : "normal") : undefined,
    stochDLineStyle: u.type === "Stochastic" && u.stochDLine ? (u.stochDLineStyle === "solid" || u.stochDLineStyle === "dotted" || u.stochDLineStyle === "dashed" ? u.stochDLineStyle : "dashed") : undefined,
    williamsRLimits: u.type === "WilliamsR" ? (u.williamsRLimits === true) : undefined,
    williamsRLimitUpper: u.type === "WilliamsR" && u.williamsRLimits ? (typeof u.williamsRLimitUpper === "number" ? Math.max(-100, Math.min(0, Math.round(u.williamsRLimitUpper))) : -20) : undefined,
    williamsRLimitLower: u.type === "WilliamsR" && u.williamsRLimits ? (typeof u.williamsRLimitLower === "number" ? Math.max(-100, Math.min(0, Math.round(u.williamsRLimitLower))) : -80) : undefined,
    williamsRLimitColor: u.type === "WilliamsR" && u.williamsRLimits ? (u.williamsRLimitColor ?? "#dc2626") : undefined,
    williamsRLimitLineWidth: u.type === "WilliamsR" && u.williamsRLimits ? (u.williamsRLimitLineWidth === "thin" || u.williamsRLimitLineWidth === "normal" ? u.williamsRLimitLineWidth : "normal") : undefined,
    williamsRLimitLineStyle: u.type === "WilliamsR" && u.williamsRLimits ? (u.williamsRLimitLineStyle === "solid" || u.williamsRLimitLineStyle === "dotted" || u.williamsRLimitLineStyle === "dashed" ? u.williamsRLimitLineStyle : "dotted") : undefined,
    bollingerMaType: u.type === "Bollinger" ? (u.bollingerMaType === "SMA" || u.bollingerMaType === "EMA" || u.bollingerMaType === "WMA" ? u.bollingerMaType : "SMA") : undefined,
    bollingerZ: u.type === "Bollinger" ? (typeof u.bollingerZ === "number" ? Math.max(0, Math.min(3, u.bollingerZ)) : 2) : undefined,
    bollingerShowUpper: u.type === "Bollinger" ? (u.bollingerShowUpper !== false) : undefined,
    bollingerShowLower: u.type === "Bollinger" ? (u.bollingerShowLower !== false) : undefined,
    bollingerShowMiddle: u.type === "Bollinger" ? (u.bollingerShowMiddle === true) : undefined,
    bollingerBandOpacity: u.type === "Bollinger" ? (typeof u.bollingerBandOpacity === "number" ? Math.max(0, Math.min(0.3, u.bollingerBandOpacity)) : 0.2) : undefined,
    bollingerLimitsColor: u.type === "Bollinger" ? (u.bollingerLimitsColor ?? "#6366f1") : undefined,
    bollingerLimitsLineStyle: u.type === "Bollinger" ? (u.bollingerLimitsLineStyle === "solid" || u.bollingerLimitsLineStyle === "dotted" || u.bollingerLimitsLineStyle === "dashed" ? u.bollingerLimitsLineStyle : "solid") : undefined,
    bollingerLimitsLineWidth: u.type === "Bollinger" ? (u.bollingerLimitsLineWidth === "thin" || u.bollingerLimitsLineWidth === "normal" ? u.bollingerLimitsLineWidth : "normal") : undefined,
    bollingerMiddleColor: u.type === "Bollinger" ? (u.bollingerMiddleColor ?? "#a855f7") : undefined,
    bollingerMiddleLineStyle: u.type === "Bollinger" ? (u.bollingerMiddleLineStyle === "solid" || u.bollingerMiddleLineStyle === "dotted" || u.bollingerMiddleLineStyle === "dashed" ? u.bollingerMiddleLineStyle : "dashed") : undefined,
    bollingerMiddleLineWidth: u.type === "Bollinger" ? (u.bollingerMiddleLineWidth === "thin" || u.bollingerMiddleLineWidth === "normal" ? u.bollingerMiddleLineWidth : "normal") : undefined,
    volumeInUsdt: u.type === "Volume" ? (u.volumeInUsdt === true) : undefined,
    volumeColorAbove: u.type === "Volume" ? (u.volumeColorAbove ?? "#10b981") : undefined,
    volumeColorBelow: u.type === "Volume" ? (u.volumeColorBelow ?? "#ef4444") : undefined,
  }));
}

/** Campos editáveis de um indicador (sem id). */
export type UserIndicatorEditable = Pick<
  UserIndicatorConfig,
  "period" | "fieldKey" | "color" | "panel" | "lineWidth" | "lineStyle" | "rsiFixedScale" | "rsiCenterLine" | "rsiCenterLineColor" | "rsiCenterLineWidth" | "rsiCenterLineStyle" | "rsiLimits" | "rsiLimitUpper" | "rsiLimitLower" | "rsiLimitColor" | "rsiLimitLineWidth" | "rsiLimitLineStyle" | "macdFastMaType" | "macdFastPeriod" | "macdSlowMaType" | "macdSlowPeriod" | "macdSignalLine" | "macdSignalMaType" | "macdSignalPeriod" | "macdSignalColor" | "macdSignalLineWidth" | "macdSignalLineStyle" | "macdHistogram" | "macdHistogramColorAbove" | "macdHistogramColorBelow" | "stochLimits" | "stochLimitUpper" | "stochLimitLower" | "stochLimitColor" | "stochLimitLineWidth" | "stochLimitLineStyle" | "stochDLine" | "stochDMaType" | "stochDPeriod" | "stochDColor" | "stochDLineWidth" | "stochDLineStyle" | "williamsRLimits" | "williamsRLimitUpper" | "williamsRLimitLower" | "williamsRLimitColor" | "williamsRLimitLineWidth" | "williamsRLimitLineStyle" | "sarStart" | "sarIncrement" | "sarMax" | "sarPointSize" | "bollingerMaType" | "bollingerZ" | "bollingerShowUpper" | "bollingerShowLower" | "bollingerShowMiddle" | "bollingerBandOpacity" | "bollingerLimitsColor" | "bollingerLimitsLineStyle" | "bollingerLimitsLineWidth" | "bollingerMiddleColor" | "bollingerMiddleLineStyle" | "bollingerMiddleLineWidth" | "volumeInUsdt" | "volumeColorAbove" | "volumeColorBelow" | "showLastValueOnYAxis"
>;

interface ContextValue {
  userIndicators: UserIndicatorConfig[];
  currentGroupMinutes: number | null;
  setCurrentGroupMinutes: (v: number | null) => void;
  addIndicator: (config: Omit<UserIndicatorConfig, "id">) => void;
  removeIndicator: (id: string) => void;
  updateIndicator: (id: string, updates: Partial<UserIndicatorEditable>) => void;
  updateIndicatorIntervals: (id: string, intervals: number[]) => void;
  /** Restaura a lista de indicadores a partir de um layout (ex.: ao carregar layout salvo). */
  replaceUserIndicatorsFromLayout: (raw: unknown) => void;
}

const KlinesIndicatorsContext = createContext<ContextValue | null>(null);

export function KlinesIndicatorsProvider({ children }: { children: ReactNode }) {
  const [userIndicators, setUserIndicators] = useState<UserIndicatorConfig[]>(loadFromStorage);
  const [currentGroupMinutes, setCurrentGroupMinutes] = useState<number | null>(null);

  const addIndicator = useCallback((config: Omit<UserIndicatorConfig, "id">) => {
    const id = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setUserIndicators((prev) => {
      const next = [...prev, { ...config, id, showLastValueOnYAxis: config.showLastValueOnYAxis !== false }];
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

  const replaceUserIndicatorsFromLayout = useCallback((raw: unknown) => {
    const list = normalizeIndicatorListFromLayout(raw);
    setUserIndicators(list);
    saveToStorage(list);
  }, []);

  const value = useMemo<ContextValue>(
    () => ({
      userIndicators,
      currentGroupMinutes,
      setCurrentGroupMinutes,
      addIndicator,
      removeIndicator,
      updateIndicator,
      updateIndicatorIntervals,
      replaceUserIndicatorsFromLayout,
    }),
    [userIndicators, currentGroupMinutes, addIndicator, removeIndicator, updateIndicator, updateIndicatorIntervals, replaceUserIndicatorsFromLayout]
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
