"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { normalizeHmaCustomPeriods } from "@/app/api/binance/klines/indicators";
import { defaultMa2TimeValueForUnit, isTimeWindowMa2Type, normalizeMa2TimeValueForUnit } from "./indicatorsPanel/wma2Period";
import { getIndicatorColumnStart } from "./regression/indicatorsColumnStart";

export type UserIndicatorType = "SMA" | "SMA2" | "EMA" | "EMA2" | "WMA" | "WMA2" | "HMA" | "HMA_CUSTOM" | "VWMA" | "LINEAR_FIT" | "QUADRATIC_FIT" | "RSI" | "MFI" | "MACD" | "DIFF" | "Stochastic" | "WilliamsR" | "OBV" | "AD" | "SAR" | "ATR" | "VWAP" | "Bollinger" | "Keltner" | "Donchian" | "Volume" | "ADX" | "CCI" | "CMF" | "Ichimoku";

/** Unidade da janela temporal para SMA2 / EMA2 / WMA2 (campos `wma2TimeUnit` / `wma2TimeValue`). */
export type Wma2TimeUnit = "days" | "hours" | "minutes";

/** Onde o indicador é renderizado: Main = área principal; Panel 2/3/4 = indicadores secundários (ex.: RSI). */
export type IndicatorPanel = "main" | "panel2" | "panel3" | "panel4" | "panel5" | "panel6" | "panel7";

export type IndicatorLineWidth = "thin" | "normal" | "thick";
export type IndicatorLineStyle = "solid" | "dotted" | "dashed";

/** Campo base, preço derivado (HL2/HLC3/OHLC4) ou coluna calculada (usuário) para o indicador. */
export type IndicatorFieldKey =
  | "open"
  | "high"
  | "low"
  | "close"
  | "volume"
  /** Volume em ativo de cotação (coluna 7), ex.: USDT — alinha ao painel Volume em USDT. */
  | "volumeUsdt"
  | "HL2"    // (high+low)/2
  | "HLC3"   // (high+low+close)/3
  | "OHLC4"  // (open+high+low+close)/4
  | "HLCC4"  // (high+low+close+close)/4 = (high+low+2*close)/4
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
  /** SMA2 / EMA2 / WMA2: unidade da janela (dias / horas / minutos). */
  wma2TimeUnit?: Wma2TimeUnit;
  /** SMA2 / EMA2 / WMA2: valor da janela (ex.: 168 h, 7 d ou 60 min consoante `wma2TimeUnit`). */
  wma2TimeValue?: number;
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
  /** Só para RSI: limite superior % (default 70). */
  rsiLimitUpper?: number;
  /** Só para RSI: limite inferior % (default 30). */
  rsiLimitLower?: number;
  /** Só para RSI: cor das linhas de limite (default vermelho). */
  rsiLimitColor?: string;
  rsiLimitLineWidth?: IndicatorLineWidth;
  rsiLimitLineStyle?: IndicatorLineStyle;
  /** Só para MFI: escala fixa 0–100 no eixo Y (default true). */
  mfiFixedScale?: boolean;
  /** Só para MFI: exibir linha central em 50. */
  mfiCenterLine?: boolean;
  mfiCenterLineColor?: string;
  mfiCenterLineWidth?: IndicatorLineWidth;
  mfiCenterLineStyle?: IndicatorLineStyle;
  /** Só para MFI: exibir limites superior/inferior. */
  mfiLimits?: boolean;
  mfiLimitUpper?: number;
  mfiLimitLower?: number;
  mfiLimitColor?: string;
  mfiLimitLineWidth?: IndicatorLineWidth;
  mfiLimitLineStyle?: IndicatorLineStyle;
  /** Só para MACD: tipo da média rápida (incl. Ajuste linear / quadrático). */
  macdFastMaType?: "SMA" | "EMA" | "WMA" | "LINEAR_FIT" | "QUADRATIC_FIT";
  /** Só para MACD: período da média rápida. */
  macdFastPeriod?: number;
  /** Só para MACD: tipo da média lenta. */
  macdSlowMaType?: "SMA" | "EMA" | "WMA" | "LINEAR_FIT" | "QUADRATIC_FIT";
  /** Só para MACD: período da média lenta. */
  macdSlowPeriod?: number;
  /** Só para MACD: exibir linha de sinal (MA aplicada à linha MACD). */
  macdSignalLine?: boolean;
  /** Só para MACD: tipo da média da linha de sinal. */
  macdSignalMaType?: "SMA" | "EMA" | "WMA" | "LINEAR_FIT" | "QUADRATIC_FIT";
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
  /** Só para DIFF: série A (subtraída da série B). */
  diffFirstFieldKey?: IndicatorFieldKey;
  /** Só para DIFF: série B (base da subtração). Resultado = B - A. */
  diffSecondFieldKey?: IndicatorFieldKey;
  /** Só para DIFF: exibir linha de sinal (MA aplicada à linha de diferença). */
  diffSignalLine?: boolean;
  /** Só para DIFF: tipo da média da linha de sinal. */
  diffSignalMaType?: "SMA" | "EMA" | "WMA" | "LINEAR_FIT" | "QUADRATIC_FIT";
  /** Só para DIFF: período da linha de sinal. */
  diffSignalPeriod?: number;
  /** Só para DIFF: cor da linha de sinal. */
  diffSignalColor?: string;
  diffSignalLineWidth?: IndicatorLineWidth;
  diffSignalLineStyle?: IndicatorLineStyle;
  /** Só para DIFF: exibir histograma (diferença − linha de sinal). */
  diffHistogram?: boolean;
  diffHistogramColorAbove?: string;
  diffHistogramColorBelow?: string;
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
  /** Só para Keltner: tipo da média móvel (SMA | EMA | WMA). */
  keltnerMaType?: "SMA" | "EMA" | "WMA";
  /** Só para Keltner: multiplicador (0–10, default 2). */
  keltnerMultiplier?: number;
  /** Só para Keltner: exibir banda superior (default true). */
  keltnerShowUpper?: boolean;
  /** Só para Keltner: exibir banda inferior (default true). */
  keltnerShowLower?: boolean;
  /** Só para Keltner: exibir linha da média móvel (default false). */
  keltnerShowMiddle?: boolean;
  /** Só para Keltner: opacidade da faixa (0–0.3, default 0.2). */
  keltnerBandOpacity?: number;
  /** Só para Keltner: cor das bandas superior/inferior. */
  keltnerLimitsColor?: string;
  keltnerLimitsLineStyle?: IndicatorLineStyle;
  keltnerLimitsLineWidth?: IndicatorLineWidth;
  /** Só para Keltner: cor da média móvel. */
  keltnerMiddleColor?: string;
  keltnerMiddleLineStyle?: IndicatorLineStyle;
  keltnerMiddleLineWidth?: IndicatorLineWidth;
  /** Só para Donchian Channels: exibir canal superior (default true). */
  donchianShowUpper?: boolean;
  /** Só para Donchian Channels: exibir canal inferior (default true). */
  donchianShowLower?: boolean;
  /** Só para Donchian Channels: exibir linha do meio (default false). */
  donchianShowMiddle?: boolean;
  /** Só para Donchian: opacidade da faixa entre canais e meio (0–0.3, default 0.2). */
  donchianBandOpacity?: number;
  /** Só para Donchian: cor dos canais superior/inferior. */
  donchianLimitsColor?: string;
  donchianLimitsLineStyle?: IndicatorLineStyle;
  donchianLimitsLineWidth?: IndicatorLineWidth;
  /** Só para Donchian: cor da linha do meio. */
  donchianMiddleColor?: string;
  donchianMiddleLineStyle?: IndicatorLineStyle;
  donchianMiddleLineWidth?: IndicatorLineWidth;
  /** Só para OBV e A/D: fonte do volume (base = coluna 5, usdt = coluna 7). Default base. */
  obvVolumeSource?: "base" | "usdt";
  /** Só para A/D: fonte do volume (base = coluna 5, usdt = coluna 7). Default base. */
  adVolumeSource?: "base" | "usdt";
  /** Só para Ichimoku: período Tenkan (default 9). */
  ichimokuTenkanPeriod?: number;
  /** Só para Ichimoku: período Kijun (default 26). */
  ichimokuKijunPeriod?: number;
  /** Só para Ichimoku: período Span B (default 52). */
  ichimokuSpanBPeriod?: number;
  /** Só para Ichimoku: deslocamento (default 26). */
  ichimokuDisplacement?: number;
  /** Só para Ichimoku: cor/espessura/estilo das 5 linhas. */
  ichimokuTenkanColor?: string;
  ichimokuTenkanLineWidth?: IndicatorLineWidth;
  ichimokuTenkanLineStyle?: IndicatorLineStyle;
  ichimokuKijunColor?: string;
  ichimokuKijunLineWidth?: IndicatorLineWidth;
  ichimokuKijunLineStyle?: IndicatorLineStyle;
  ichimokuSpanAColor?: string;
  ichimokuSpanALineWidth?: IndicatorLineWidth;
  ichimokuSpanALineStyle?: IndicatorLineStyle;
  ichimokuSpanBColor?: string;
  ichimokuSpanBLineWidth?: IndicatorLineWidth;
  ichimokuSpanBLineStyle?: IndicatorLineStyle;
  ichimokuChikouColor?: string;
  ichimokuChikouLineWidth?: IndicatorLineWidth;
  ichimokuChikouLineStyle?: IndicatorLineStyle;
  /** Só para Ichimoku: opacidade da nuvem 0–70% (0–0.7). Verde/vermelho fixos. */
  ichimokuCloudOpacity?: number;
  /** Só para Ichimoku: exibir linha Tenkan (default true). */
  ichimokuShowTenkan?: boolean;
  /** Só para Ichimoku: exibir linha Kijun (default true). */
  ichimokuShowKijun?: boolean;
  /** Só para Ichimoku: exibir linha Span A (default true). */
  ichimokuShowSpanA?: boolean;
  /** Só para Ichimoku: exibir linha Span B (default true). */
  ichimokuShowSpanB?: boolean;
  /** Só para Ichimoku: exibir linha Chikou (default false). */
  ichimokuShowChikou?: boolean;
  /** Só para Volume: exibir volume em USDT (quote); default false = volume em base. */
  volumeInUsdt?: boolean;
  /** Só para Volume: cor das barras quando o candle fecha positivo (close >= open). */
  volumeColorAbove?: string;
  /** Só para Volume: cor das barras quando o candle fecha negativo (close < open). */
  volumeColorBelow?: string;
  /** Só para ADX: cor da linha +DI (default verde). */
  adxPlusDiColor?: string;
  adxPlusDiLineWidth?: IndicatorLineWidth;
  adxPlusDiLineStyle?: IndicatorLineStyle;
  /** Só para ADX: cor da linha -DI (default vermelho). */
  adxMinusDiColor?: string;
  adxMinusDiLineWidth?: IndicatorLineWidth;
  adxMinusDiLineStyle?: IndicatorLineStyle;
  /** Só para ADX: cor da linha ADX (default branco/amarelo). */
  adxAdxColor?: string;
  adxAdxLineWidth?: IndicatorLineWidth;
  adxAdxLineStyle?: IndicatorLineStyle;
  /** Só para ADX: escala fixa 0–100 no eixo Y (true) ou ajustar aos dados (false). */
  adxFixedScale?: boolean;
  /** Só para ADX: exibir limites (linhas horizontais). */
  adxLimits?: boolean;
  adxLimitUpper?: number;
  adxLimitLower?: number;
  adxLimitColor?: string;
  adxLimitLineWidth?: IndicatorLineWidth;
  adxLimitLineStyle?: IndicatorLineStyle;
  /** Só para CCI: escala fixa no eixo Y (ex.: -100 a 100). */
  cciFixedScale?: boolean;
  /** Só para CCI: exibir limites superior e inferior (default -100 e 100). */
  cciLimits?: boolean;
  /** Só para CCI: limite superior (default 100). */
  cciLimitUpper?: number;
  /** Só para CCI: limite inferior (default -100). */
  cciLimitLower?: number;
  cciLimitColor?: string;
  cciLimitLineWidth?: IndicatorLineWidth;
  cciLimitLineStyle?: IndicatorLineStyle;
  /** Só para CCI: exibir como histograma (barras acima/abaixo de zero). */
  cciAsHistogram?: boolean;
  /** Só para CCI histograma: cor das barras acima de zero. */
  cciHistogramColorAbove?: string;
  /** Só para CCI histograma: cor das barras abaixo de zero. */
  cciHistogramColorBelow?: string;
  /** Só para CMF (Chaikin Money Flow): escala fixa no eixo Y (ex.: -1 a 1). */
  cmfFixedScale?: boolean;
  /** Só para CMF: exibir limites superior/inferior (ex. 0.25 / -0.25). */
  cmfLimits?: boolean;
  cmfLimitUpper?: number;
  cmfLimitLower?: number;
  cmfLimitColor?: string;
  cmfLimitLineWidth?: IndicatorLineWidth;
  cmfLimitLineStyle?: IndicatorLineStyle;
  /** Só para CMF: exibir como histograma (barras acima/abaixo de zero). */
  cmfAsHistogram?: boolean;
  cmfHistogramColorAbove?: string;
  cmfHistogramColorBelow?: string;
  /** Só para HMA_CUSTOM: período da MA longa (maior); `period` espelha este valor. */
  hmaCustomLongPeriod?: number;
  /** Só para HMA_CUSTOM: período da MA rápida (menor que longa). */
  hmaCustomFastPeriod?: number;
  /** Só para HMA_CUSTOM: período da MA de suavização (menor que a rápida). */
  hmaCustomSmoothPeriod?: number;
  /** Só para HMA_CUSTOM: tipo da MA na etapa rápida (incl. ajuste linear/quadrático). */
  hmaCustomFastMaType?: "SMA" | "EMA" | "WMA" | "LINEAR_FIT" | "QUADRATIC_FIT";
  /** Só para HMA_CUSTOM: tipo da MA na etapa longa. */
  hmaCustomLongMaType?: "SMA" | "EMA" | "WMA" | "LINEAR_FIT" | "QUADRATIC_FIT";
  /** Só para HMA_CUSTOM: tipo da MA na suavização final. */
  hmaCustomSmoothMaType?: "SMA" | "EMA" | "WMA";
}

const FIELD_KEY_TO_INDEX: Record<string, number> = {
  open: 1,
  high: 2,
  low: 3,
  close: 4,
  volume: 5,
  volumeUsdt: 7,
};

function parseUserFieldRef(fieldKey: IndicatorFieldKey): { id: string; part: string | null } | null {
  if (!fieldKey.startsWith("user_")) return null;
  const raw = fieldKey.slice(5);
  const sep = raw.indexOf(":");
  if (sep < 0) return { id: raw, part: null };
  return { id: raw.slice(0, sep), part: raw.slice(sep + 1) || null };
}

function userFieldPartOffset(ind: UserIndicatorConfig, part: string | null): number {
  if (!part) return 0;
  if (ind.type === "MACD") {
    if (part === "signal" || part === "sig") return ind.macdSignalLine ? 1 : 0;
    if (part === "hist" || part === "histogram") return ind.macdHistogram ? 2 : 0;
    return 0;
  }
  if (ind.type === "DIFF") {
    if (part === "signal" || part === "sig") return ind.diffSignalLine ? 1 : 0;
    if (part === "hist" || part === "histogram") return ind.diffHistogram ? 2 : 0;
    return 0;
  }
  if (ind.type === "Stochastic") {
    if (part === "d" || part === "sig" || part === "signal") return ind.stochDLine ? 1 : 0;
    return 0;
  }
  if (ind.type === "Bollinger" || ind.type === "Keltner" || ind.type === "Donchian") {
    if (part === "upper") return 0;
    if (part === "middle") return 1;
    if (part === "lower") return 2;
    return 0;
  }
  if (ind.type === "ADX") {
    if (part === "plusDi") return 0;
    if (part === "minusDi") return 1;
    if (part === "adx") return 2;
    return 0;
  }
  if (ind.type === "Ichimoku") {
    if (part === "tenkan") return 0;
    if (part === "kijun") return 1;
    if (part === "spanA") return 2;
    if (part === "spanB") return 3;
    if (part === "chikou") return 4;
    return 0;
  }
  return 0;
}

/**
 * Retorna o índice da coluna no array kline para um fieldKey.
 * Para user_<id>, usa a primeira coluna de saída desse indicador (mesma regra que KlinesTable / indicatorsColumnStart — MACD, Volume, etc. alteram o deslocamento).
 * HL2, HLC3, OHLC4 não têm coluna na tabela; use getDataAndValueIndexForIndicator para o cálculo.
 */
export function getFieldIndex(
  fieldKey: IndicatorFieldKey,
  userIndicators: UserIndicatorConfig[]
): number {
  if (fieldKey in FIELD_KEY_TO_INDEX) return FIELD_KEY_TO_INDEX[fieldKey];
  const ref = parseUserFieldRef(fieldKey);
  if (ref != null) {
    const idx = userIndicators.findIndex((u) => u.id === ref.id);
    if (idx >= 0) {
      const ind = userIndicators[idx]!;
      return getIndicatorColumnStart(userIndicators, idx) + userFieldPartOffset(ind, ref.part);
    }
  }
  return 4; // fallback close
}

const DERIVED_FIELD_KEYS = ["HL2", "HLC3", "OHLC4", "HLCC4"] as const;
function getDerivedValue(row: (string | number)[], key: (typeof DERIVED_FIELD_KEYS)[number]): number {
  const o = Number(row[1]);
  const h = Number(row[2]);
  const l = Number(row[3]);
  const c = Number(row[4]);
  if (key === "HL2") return (h + l) / 2;
  if (key === "HLC3") return (h + l + c) / 3;
  if (key === "OHLC4") return (o + h + l + c) / 4;
  return (h + l + c + c) / 4; // HLCC4 = (high+low+2*close)/4
}

/**
 * Para uso no cálculo do indicador: retorna data e valueIndex.
 * Se fieldKey for HL2, HLC3 ou OHLC4, acrescenta uma coluna virtual (não na tabela) com o preço derivado.
 */
export function getDataAndValueIndexForIndicator(
  data: (string | number)[][],
  fieldKey: IndicatorFieldKey,
  userIndicators: UserIndicatorConfig[]
): { data: (string | number)[][]; valueIndex: number } {
  if (fieldKey === "HL2" || fieldKey === "HLC3" || fieldKey === "OHLC4" || fieldKey === "HLCC4") {
    const dataWithDerived = data.map((row) => [...row, getDerivedValue(row, fieldKey)]);
    return { data: dataWithDerived, valueIndex: dataWithDerived[0].length - 1 };
  }
  return { data, valueIndex: getFieldIndex(fieldKey, userIndicators) };
}

/** Indicadores vêm só do layout (banco). Não usar localStorage. */
function loadFromStorage(): UserIndicatorConfig[] {
  return [];
}

function saveToStorage(_list: UserIndicatorConfig[]) {
  /* Indicadores persistem só no layout (banco). Não usar localStorage. */
}

const VALID_INDICATOR_TYPES = ["SMA", "SMA2", "EMA", "EMA2", "WMA", "WMA2", "HMA", "HMA_CUSTOM", "VWMA", "LINEAR_FIT", "QUADRATIC_FIT", "RSI", "MFI", "MACD", "DIFF", "Stochastic", "WilliamsR", "OBV", "AD", "SAR", "ATR", "VWAP", "Bollinger", "Keltner", "Donchian", "Volume", "ADX", "CCI", "CMF", "Ichimoku"] as const;

function safePeriod(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(1, Math.round(v));
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(1, Math.round(n));
  }
  return null;
}

/** Sentinel: intervals = [0] significa "nenhum período" (desmarcar todos). [] = "Todos os tempos". */
export const INTERVALS_NONE = 0;

/** Returns valid intervals array. [] = "Todos os tempos"; [0] = nenhum período; [1, 120, ...] = só esses. */
function safeIntervals(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  if (v.length === 1 && (v[0] === 0 || v[0] === "0")) return [INTERVALS_NONE];
  const out: number[] = [];
  for (const x of v) {
    const n = typeof x === "number" ? (Number.isFinite(x) ? Math.round(x) : null) : (typeof x === "string" ? (Number.isFinite(Number(x)) ? Math.round(Number(x)) : null) : null);
    if (n != null && n >= 1) out.push(n);
  }
  return out;
}

/** Normaliza uma lista vinda do layout (ou localStorage) para UserIndicatorConfig[]. */
export function normalizeIndicatorListFromLayout(parsed: unknown): UserIndicatorConfig[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (p): p is Record<string, unknown> & { id: string; type: string; fieldKey: string; color: string } => {
      if (p == null || typeof p !== "object") return false;
      const u = p as Record<string, unknown>;
      const type = u.type;
      const period = safePeriod(u.period);
      const intervals = safeIntervals(u.intervals);
      return (
        typeof u.id === "string" &&
        VALID_INDICATOR_TYPES.includes(type as (typeof VALID_INDICATOR_TYPES)[number]) &&
        period != null &&
        typeof u.fieldKey === "string" &&
        typeof u.color === "string" &&
        (Array.isArray(intervals) || intervals === null)
      );
    }
  ).map((u) => {
    const isMa2Tw = isTimeWindowMa2Type(u.type);
    const ru = u as Record<string, unknown>;
    const hmaCustomNorm =
      u.type === "HMA_CUSTOM"
        ? normalizeHmaCustomPeriods(
            typeof ru.hmaCustomSmoothPeriod === "number" && Number.isFinite(ru.hmaCustomSmoothPeriod)
              ? Math.round(ru.hmaCustomSmoothPeriod as number)
              : 4,
            typeof ru.hmaCustomFastPeriod === "number" && Number.isFinite(ru.hmaCustomFastPeriod)
              ? Math.round(ru.hmaCustomFastPeriod as number)
              : 10,
            typeof ru.hmaCustomLongPeriod === "number" && Number.isFinite(ru.hmaCustomLongPeriod)
              ? Math.round(ru.hmaCustomLongPeriod as number)
              : (safePeriod(u.period) ?? 20)
          )
        : null;
    const period =
      u.type === "Ichimoku"
        ? (safePeriod((u as Record<string, unknown>).ichimokuKijunPeriod) ?? 26)
        : hmaCustomNorm
          ? hmaCustomNorm.hmaCustomLongPeriod
          : isMa2Tw
            ? (safePeriod(u.period) ?? 1)
            : (safePeriod(u.period) ?? 14);
    const intervalsRaw = safeIntervals(u.intervals) ?? []; // [] = "Todos os tempos" (layout antigo sem intervals)
    /** SMA2/EMA2/WMA2: mesmo modelo que WMA — intervalos persistidos; [] = todos os timeframes (default típico ao adicionar). */
    const intervals = intervalsRaw;
    const ma2ResolvedUnit: Wma2TimeUnit = isMa2Tw
      ? (u.wma2TimeUnit === "days" || u.wma2TimeUnit === "hours" || u.wma2TimeUnit === "minutes" ? u.wma2TimeUnit : "hours")
      : "hours";
    return {
    ...u,
    type: u.type as UserIndicatorType,
    period,
    intervals,
    fieldKey: (u.type === "WilliamsR" ? "close" : (u.type === "OBV" || u.type === "AD" ? "volume" : u.type === "ATR" || u.type === "VWAP" || u.type === "ADX" || u.type === "MFI" || u.type === "CMF" || u.type === "Ichimoku" ? "close" : u.type === "Volume" ? "volume" : u.type === "CCI" ? (u.fieldKey ?? "HLC3") : u.type === "DIFF" ? ((u.diffSecondFieldKey ?? u.fieldKey ?? "close") as IndicatorFieldKey) : u.fieldKey)) as IndicatorFieldKey,
    panel: u.type === "SAR" || u.type === "VWAP" || u.type === "Ichimoku" ? "main" : (u.panel === "main" || u.panel === "panel2" || u.panel === "panel3" || u.panel === "panel4" || u.panel === "panel5" || u.panel === "panel6" || u.panel === "panel7"
      ? u.panel
      : (u.type === "RSI" || u.type === "MFI" || u.type === "MACD" || u.type === "DIFF" || u.type === "Stochastic" || u.type === "WilliamsR" || u.type === "OBV" || u.type === "AD" || u.type === "ATR" || u.type === "Volume" || u.type === "ADX" || u.type === "CCI" || u.type === "CMF" ? "panel2" : "main")),
    sarStart: u.type === "SAR" ? (typeof u.sarStart === "number" ? Math.max(0.001, Math.min(1, u.sarStart)) : 0.02) : undefined,
    sarIncrement: u.type === "SAR" ? (typeof u.sarIncrement === "number" ? Math.max(0.001, Math.min(1, u.sarIncrement)) : 0.02) : undefined,
    sarMax: u.type === "SAR" ? (typeof u.sarMax === "number" ? Math.max(0.02, Math.min(1, u.sarMax)) : 0.2) : undefined,
    sarPointSize: u.type === "SAR" ? (u.sarPointSize === "thin" || u.sarPointSize === "normal" ? u.sarPointSize : "normal") : undefined,
    lineWidth: u.lineWidth === "thin" || u.lineWidth === "normal" || u.lineWidth === "thick" ? u.lineWidth : "normal",
    lineStyle: u.lineStyle === "solid" || u.lineStyle === "dotted" || u.lineStyle === "dashed" ? u.lineStyle : "solid",
    rsiFixedScale: u.type === "RSI" ? (u.rsiFixedScale === false ? false : true) : undefined,
    rsiCenterLine: u.type === "RSI" ? (u.rsiCenterLine === true) : undefined,
    rsiCenterLineColor: u.type === "RSI" && u.rsiCenterLine ? (u.rsiCenterLineColor ?? "#71717a") : undefined,
    rsiCenterLineWidth: u.type === "RSI" && u.rsiCenterLine ? (u.rsiCenterLineWidth === "thin" || u.rsiCenterLineWidth === "normal" || u.rsiCenterLineWidth === "thick" ? u.rsiCenterLineWidth : "normal") : undefined,
    rsiCenterLineStyle: u.type === "RSI" && u.rsiCenterLine ? (u.rsiCenterLineStyle === "solid" || u.rsiCenterLineStyle === "dotted" || u.rsiCenterLineStyle === "dashed" ? u.rsiCenterLineStyle : "dotted") : undefined,
    rsiLimits: u.type === "RSI" ? (u.rsiLimits === true) : undefined,
    rsiLimitUpper: u.type === "RSI" && u.rsiLimits ? (typeof u.rsiLimitUpper === "number" ? Math.max(0, Math.min(100, Math.round(u.rsiLimitUpper))) : 70) : undefined,
    rsiLimitLower: u.type === "RSI" && u.rsiLimits ? (typeof u.rsiLimitLower === "number" ? Math.max(0, Math.min(100, Math.round(u.rsiLimitLower))) : 30) : undefined,
    rsiLimitColor: u.type === "RSI" && u.rsiLimits ? (u.rsiLimitColor ?? "#dc2626") : undefined,
    rsiLimitLineWidth: u.type === "RSI" && u.rsiLimits ? (u.rsiLimitLineWidth === "thin" || u.rsiLimitLineWidth === "normal" || u.rsiLimitLineWidth === "thick" ? u.rsiLimitLineWidth : "normal") : undefined,
    rsiLimitLineStyle: u.type === "RSI" && u.rsiLimits ? (u.rsiLimitLineStyle === "solid" || u.rsiLimitLineStyle === "dotted" || u.rsiLimitLineStyle === "dashed" ? u.rsiLimitLineStyle : "dotted") : undefined,
    mfiFixedScale: u.type === "MFI" ? (u.mfiFixedScale === false ? false : true) : undefined,
    mfiCenterLine: u.type === "MFI" ? (u.mfiCenterLine === true) : undefined,
    mfiCenterLineColor: u.type === "MFI" && u.mfiCenterLine ? (u.mfiCenterLineColor ?? "#71717a") : undefined,
    mfiCenterLineWidth: u.type === "MFI" && u.mfiCenterLine ? (u.mfiCenterLineWidth === "thin" || u.mfiCenterLineWidth === "normal" || u.mfiCenterLineWidth === "thick" ? u.mfiCenterLineWidth : "normal") : undefined,
    mfiCenterLineStyle: u.type === "MFI" && u.mfiCenterLine ? (u.mfiCenterLineStyle === "solid" || u.mfiCenterLineStyle === "dotted" || u.mfiCenterLineStyle === "dashed" ? u.mfiCenterLineStyle : "dotted") : undefined,
    mfiLimits: u.type === "MFI" ? (u.mfiLimits === true) : undefined,
    mfiLimitUpper: u.type === "MFI" && u.mfiLimits ? (typeof u.mfiLimitUpper === "number" ? Math.max(0, Math.min(100, Math.round(u.mfiLimitUpper))) : 80) : undefined,
    mfiLimitLower: u.type === "MFI" && u.mfiLimits ? (typeof u.mfiLimitLower === "number" ? Math.max(0, Math.min(100, Math.round(u.mfiLimitLower))) : 20) : undefined,
    mfiLimitColor: u.type === "MFI" && u.mfiLimits ? (u.mfiLimitColor ?? "#dc2626") : undefined,
    mfiLimitLineWidth: u.type === "MFI" && u.mfiLimits ? (u.mfiLimitLineWidth === "thin" || u.mfiLimitLineWidth === "normal" || u.mfiLimitLineWidth === "thick" ? u.mfiLimitLineWidth : "normal") : undefined,
    mfiLimitLineStyle: u.type === "MFI" && u.mfiLimits ? (u.mfiLimitLineStyle === "solid" || u.mfiLimitLineStyle === "dotted" || u.mfiLimitLineStyle === "dashed" ? u.mfiLimitLineStyle : "dotted") : undefined,
    macdFastMaType: u.type === "MACD" ? (u.macdFastMaType === "SMA" || u.macdFastMaType === "EMA" || u.macdFastMaType === "WMA" || u.macdFastMaType === "LINEAR_FIT" || u.macdFastMaType === "QUADRATIC_FIT" ? u.macdFastMaType : "EMA") : undefined,
    macdFastPeriod: u.type === "MACD" ? (typeof u.macdFastPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.macdFastPeriod))) : 12) : undefined,
    macdSlowMaType: u.type === "MACD" ? (u.macdSlowMaType === "SMA" || u.macdSlowMaType === "EMA" || u.macdSlowMaType === "WMA" || u.macdSlowMaType === "LINEAR_FIT" || u.macdSlowMaType === "QUADRATIC_FIT" ? u.macdSlowMaType : "EMA") : undefined,
    macdSlowPeriod: u.type === "MACD" ? (typeof u.macdSlowPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.macdSlowPeriod))) : 26) : undefined,
    macdSignalLine: u.type === "MACD" ? (u.macdSignalLine === true) : undefined,
    macdSignalMaType: u.type === "MACD" && u.macdSignalLine ? (u.macdSignalMaType === "SMA" || u.macdSignalMaType === "EMA" || u.macdSignalMaType === "WMA" || u.macdSignalMaType === "LINEAR_FIT" || u.macdSignalMaType === "QUADRATIC_FIT" ? u.macdSignalMaType : "EMA") : undefined,
    macdSignalPeriod: u.type === "MACD" && u.macdSignalLine ? (typeof u.macdSignalPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.macdSignalPeriod))) : 9) : undefined,
    macdSignalColor: u.type === "MACD" && u.macdSignalLine ? (u.macdSignalColor ?? "#ea580c") : undefined,
    macdSignalLineWidth: u.type === "MACD" && u.macdSignalLine ? (u.macdSignalLineWidth === "thin" || u.macdSignalLineWidth === "normal" || u.macdSignalLineWidth === "thick" ? u.macdSignalLineWidth : "normal") : undefined,
    macdSignalLineStyle: u.type === "MACD" && u.macdSignalLine ? (u.macdSignalLineStyle === "solid" || u.macdSignalLineStyle === "dotted" || u.macdSignalLineStyle === "dashed" ? u.macdSignalLineStyle : "dashed") : undefined,
    macdHistogram: u.type === "MACD" && u.macdSignalLine ? (u.macdHistogram === true) : undefined,
    macdHistogramColorAbove: u.type === "MACD" && u.macdSignalLine && u.macdHistogram ? (u.macdHistogramColorAbove ?? "#059669") : undefined,
    macdHistogramColorBelow: u.type === "MACD" && u.macdSignalLine && u.macdHistogram ? (u.macdHistogramColorBelow ?? "#dc2626") : undefined,
    diffFirstFieldKey: u.type === "DIFF" ? ((u.diffFirstFieldKey ?? "close") as IndicatorFieldKey) : undefined,
    diffSecondFieldKey: u.type === "DIFF" ? ((u.diffSecondFieldKey ?? u.fieldKey ?? "close") as IndicatorFieldKey) : undefined,
    diffSignalLine: u.type === "DIFF" ? (u.diffSignalLine === true) : undefined,
    diffSignalMaType: u.type === "DIFF" && u.diffSignalLine ? (u.diffSignalMaType === "SMA" || u.diffSignalMaType === "EMA" || u.diffSignalMaType === "WMA" || u.diffSignalMaType === "LINEAR_FIT" || u.diffSignalMaType === "QUADRATIC_FIT" ? u.diffSignalMaType : "EMA") : undefined,
    diffSignalPeriod: u.type === "DIFF" && u.diffSignalLine ? (typeof u.diffSignalPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.diffSignalPeriod))) : 9) : undefined,
    diffSignalColor: u.type === "DIFF" && u.diffSignalLine ? (u.diffSignalColor ?? "#ea580c") : undefined,
    diffSignalLineWidth: u.type === "DIFF" && u.diffSignalLine ? (u.diffSignalLineWidth === "thin" || u.diffSignalLineWidth === "normal" || u.diffSignalLineWidth === "thick" ? u.diffSignalLineWidth : "normal") : undefined,
    diffSignalLineStyle: u.type === "DIFF" && u.diffSignalLine ? (u.diffSignalLineStyle === "solid" || u.diffSignalLineStyle === "dotted" || u.diffSignalLineStyle === "dashed" ? u.diffSignalLineStyle : "dashed") : undefined,
    diffHistogram: u.type === "DIFF" && u.diffSignalLine ? (u.diffHistogram === true) : undefined,
    diffHistogramColorAbove: u.type === "DIFF" && u.diffSignalLine && u.diffHistogram ? (u.diffHistogramColorAbove ?? "#059669") : undefined,
    diffHistogramColorBelow: u.type === "DIFF" && u.diffSignalLine && u.diffHistogram ? (u.diffHistogramColorBelow ?? "#dc2626") : undefined,
    stochLimits: u.type === "Stochastic" ? (u.stochLimits === true) : undefined,
    stochLimitUpper: u.type === "Stochastic" && u.stochLimits ? (typeof u.stochLimitUpper === "number" ? Math.max(0, Math.min(100, Math.round(u.stochLimitUpper))) : 80) : undefined,
    stochLimitLower: u.type === "Stochastic" && u.stochLimits ? (typeof u.stochLimitLower === "number" ? Math.max(0, Math.min(100, Math.round(u.stochLimitLower))) : 20) : undefined,
    stochLimitColor: u.type === "Stochastic" && u.stochLimits ? (u.stochLimitColor ?? "#dc2626") : undefined,
    stochLimitLineWidth: u.type === "Stochastic" && u.stochLimits ? (u.stochLimitLineWidth === "thin" || u.stochLimitLineWidth === "normal" || u.stochLimitLineWidth === "thick" ? u.stochLimitLineWidth : "normal") : undefined,
    stochLimitLineStyle: u.type === "Stochastic" && u.stochLimits ? (u.stochLimitLineStyle === "solid" || u.stochLimitLineStyle === "dotted" || u.stochLimitLineStyle === "dashed" ? u.stochLimitLineStyle : "dotted") : undefined,
    stochDLine: u.type === "Stochastic" ? (u.stochDLine === true) : undefined,
    stochDMaType: u.type === "Stochastic" && u.stochDLine ? (u.stochDMaType === "SMA" || u.stochDMaType === "EMA" || u.stochDMaType === "WMA" ? u.stochDMaType : "SMA") : undefined,
    stochDPeriod: u.type === "Stochastic" && u.stochDLine ? (typeof u.stochDPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.stochDPeriod))) : 3) : undefined,
    stochDColor: u.type === "Stochastic" && u.stochDLine ? (u.stochDColor ?? "#ea580c") : undefined,
    stochDLineWidth: u.type === "Stochastic" && u.stochDLine ? (u.stochDLineWidth === "thin" || u.stochDLineWidth === "normal" || u.stochDLineWidth === "thick" ? u.stochDLineWidth : "normal") : undefined,
    stochDLineStyle: u.type === "Stochastic" && u.stochDLine ? (u.stochDLineStyle === "solid" || u.stochDLineStyle === "dotted" || u.stochDLineStyle === "dashed" ? u.stochDLineStyle : "dashed") : undefined,
    williamsRLimits: u.type === "WilliamsR" ? (u.williamsRLimits === true) : undefined,
    williamsRLimitUpper: u.type === "WilliamsR" && u.williamsRLimits ? (typeof u.williamsRLimitUpper === "number" ? Math.max(-100, Math.min(0, Math.round(u.williamsRLimitUpper))) : -20) : undefined,
    williamsRLimitLower: u.type === "WilliamsR" && u.williamsRLimits ? (typeof u.williamsRLimitLower === "number" ? Math.max(-100, Math.min(0, Math.round(u.williamsRLimitLower))) : -80) : undefined,
    williamsRLimitColor: u.type === "WilliamsR" && u.williamsRLimits ? (u.williamsRLimitColor ?? "#dc2626") : undefined,
    williamsRLimitLineWidth: u.type === "WilliamsR" && u.williamsRLimits ? (u.williamsRLimitLineWidth === "thin" || u.williamsRLimitLineWidth === "normal" || u.williamsRLimitLineWidth === "thick" ? u.williamsRLimitLineWidth : "normal") : undefined,
    williamsRLimitLineStyle: u.type === "WilliamsR" && u.williamsRLimits ? (u.williamsRLimitLineStyle === "solid" || u.williamsRLimitLineStyle === "dotted" || u.williamsRLimitLineStyle === "dashed" ? u.williamsRLimitLineStyle : "dotted") : undefined,
    bollingerMaType: u.type === "Bollinger" ? (u.bollingerMaType === "SMA" || u.bollingerMaType === "EMA" || u.bollingerMaType === "WMA" ? u.bollingerMaType : "SMA") : undefined,
    bollingerZ: u.type === "Bollinger" ? (typeof u.bollingerZ === "number" ? Math.max(0, Math.min(3, u.bollingerZ)) : 2) : undefined,
    bollingerShowUpper: u.type === "Bollinger" ? (u.bollingerShowUpper !== false) : undefined,
    bollingerShowLower: u.type === "Bollinger" ? (u.bollingerShowLower !== false) : undefined,
    bollingerShowMiddle: u.type === "Bollinger" ? (u.bollingerShowMiddle === true) : undefined,
    bollingerBandOpacity: u.type === "Bollinger" ? (typeof u.bollingerBandOpacity === "number" ? Math.max(0, Math.min(0.3, u.bollingerBandOpacity)) : 0.2) : undefined,
    bollingerLimitsColor: u.type === "Bollinger" ? (u.bollingerLimitsColor ?? "#6366f1") : undefined,
    bollingerLimitsLineStyle: u.type === "Bollinger" ? (u.bollingerLimitsLineStyle === "solid" || u.bollingerLimitsLineStyle === "dotted" || u.bollingerLimitsLineStyle === "dashed" ? u.bollingerLimitsLineStyle : "solid") : undefined,
    bollingerLimitsLineWidth: u.type === "Bollinger" ? (u.bollingerLimitsLineWidth === "thin" || u.bollingerLimitsLineWidth === "normal" || u.bollingerLimitsLineWidth === "thick" ? u.bollingerLimitsLineWidth : "normal") : undefined,
    bollingerMiddleColor: u.type === "Bollinger" ? (u.bollingerMiddleColor ?? "#a855f7") : undefined,
    bollingerMiddleLineStyle: u.type === "Bollinger" ? (u.bollingerMiddleLineStyle === "solid" || u.bollingerMiddleLineStyle === "dotted" || u.bollingerMiddleLineStyle === "dashed" ? u.bollingerMiddleLineStyle : "dashed") : undefined,
    bollingerMiddleLineWidth: u.type === "Bollinger" ? (u.bollingerMiddleLineWidth === "thin" || u.bollingerMiddleLineWidth === "normal" || u.bollingerMiddleLineWidth === "thick" ? u.bollingerMiddleLineWidth : "normal") : undefined,
    donchianShowUpper: u.type === "Donchian" ? (u.donchianShowUpper !== false) : undefined,
    donchianShowLower: u.type === "Donchian" ? (u.donchianShowLower !== false) : undefined,
    donchianShowMiddle: u.type === "Donchian" ? (u.donchianShowMiddle === true) : undefined,
    donchianBandOpacity: u.type === "Donchian" ? (typeof u.donchianBandOpacity === "number" ? Math.max(0, Math.min(0.3, u.donchianBandOpacity)) : 0.2) : undefined,
    donchianLimitsColor: u.type === "Donchian" ? (u.donchianLimitsColor ?? "#6366f1") : undefined,
    donchianLimitsLineStyle: u.type === "Donchian" ? (u.donchianLimitsLineStyle === "solid" || u.donchianLimitsLineStyle === "dotted" || u.donchianLimitsLineStyle === "dashed" ? u.donchianLimitsLineStyle : "solid") : undefined,
    donchianLimitsLineWidth: u.type === "Donchian" ? (u.donchianLimitsLineWidth === "thin" || u.donchianLimitsLineWidth === "normal" || u.donchianLimitsLineWidth === "thick" ? u.donchianLimitsLineWidth : "normal") : undefined,
    donchianMiddleColor: u.type === "Donchian" ? (u.donchianMiddleColor ?? "#a855f7") : undefined,
    donchianMiddleLineStyle: u.type === "Donchian" ? (u.donchianMiddleLineStyle === "solid" || u.donchianMiddleLineStyle === "dotted" || u.donchianMiddleLineStyle === "dashed" ? u.donchianMiddleLineStyle : "dashed") : undefined,
    donchianMiddleLineWidth:
      u.type === "Donchian"
        ? u.donchianMiddleLineWidth === "thin" || u.donchianMiddleLineWidth === "normal" || u.donchianMiddleLineWidth === "thick"
          ? u.donchianMiddleLineWidth
          : "normal"
        : undefined,
    keltnerMaType: u.type === "Keltner" ? (u.keltnerMaType === "SMA" || u.keltnerMaType === "EMA" || u.keltnerMaType === "WMA" ? u.keltnerMaType : "EMA") : undefined,
    keltnerMultiplier: u.type === "Keltner" ? (typeof u.keltnerMultiplier === "number" ? Math.max(0, Math.min(10, u.keltnerMultiplier)) : 2) : undefined,
    keltnerShowUpper: u.type === "Keltner" ? (u.keltnerShowUpper !== false) : undefined,
    keltnerShowLower: u.type === "Keltner" ? (u.keltnerShowLower !== false) : undefined,
    keltnerShowMiddle: u.type === "Keltner" ? (u.keltnerShowMiddle === true) : undefined,
    keltnerBandOpacity: u.type === "Keltner" ? (typeof u.keltnerBandOpacity === "number" ? Math.max(0, Math.min(0.3, u.keltnerBandOpacity)) : 0.2) : undefined,
    keltnerLimitsColor: u.type === "Keltner" ? (u.keltnerLimitsColor ?? "#6366f1") : undefined,
    keltnerLimitsLineStyle: u.type === "Keltner" ? (u.keltnerLimitsLineStyle === "solid" || u.keltnerLimitsLineStyle === "dotted" || u.keltnerLimitsLineStyle === "dashed" ? u.keltnerLimitsLineStyle : "solid") : undefined,
    keltnerLimitsLineWidth: u.type === "Keltner" ? (u.keltnerLimitsLineWidth === "thin" || u.keltnerLimitsLineWidth === "normal" || u.keltnerLimitsLineWidth === "thick" ? u.keltnerLimitsLineWidth : "normal") : undefined,
    keltnerMiddleColor: u.type === "Keltner" ? (u.keltnerMiddleColor ?? "#a855f7") : undefined,
    keltnerMiddleLineStyle: u.type === "Keltner" ? (u.keltnerMiddleLineStyle === "solid" || u.keltnerMiddleLineStyle === "dotted" || u.keltnerMiddleLineStyle === "dashed" ? u.keltnerMiddleLineStyle : "dashed") : undefined,
    keltnerMiddleLineWidth: u.type === "Keltner" ? (u.keltnerMiddleLineWidth === "thin" || u.keltnerMiddleLineWidth === "normal" || u.keltnerMiddleLineWidth === "thick" ? u.keltnerMiddleLineWidth : "normal") : undefined,
    volumeInUsdt: u.type === "Volume" ? (u.volumeInUsdt === true) : undefined,
    volumeColorAbove: u.type === "Volume" ? (u.volumeColorAbove ?? "#10b981") : undefined,
    volumeColorBelow: u.type === "Volume" ? (u.volumeColorBelow ?? "#ef4444") : undefined,
    adxPlusDiColor: u.type === "ADX" ? (u.adxPlusDiColor ?? "#22c55e") : undefined,
    adxPlusDiLineWidth: u.type === "ADX" ? (u.adxPlusDiLineWidth === "thin" || u.adxPlusDiLineWidth === "normal" || u.adxPlusDiLineWidth === "thick" ? u.adxPlusDiLineWidth : "normal") : undefined,
    adxPlusDiLineStyle: u.type === "ADX" ? (u.adxPlusDiLineStyle === "solid" || u.adxPlusDiLineStyle === "dotted" || u.adxPlusDiLineStyle === "dashed" ? u.adxPlusDiLineStyle : "solid") : undefined,
    adxMinusDiColor: u.type === "ADX" ? (u.adxMinusDiColor ?? "#ef4444") : undefined,
    adxMinusDiLineWidth: u.type === "ADX" ? (u.adxMinusDiLineWidth === "thin" || u.adxMinusDiLineWidth === "normal" || u.adxMinusDiLineWidth === "thick" ? u.adxMinusDiLineWidth : "normal") : undefined,
    adxMinusDiLineStyle: u.type === "ADX" ? (u.adxMinusDiLineStyle === "solid" || u.adxMinusDiLineStyle === "dotted" || u.adxMinusDiLineStyle === "dashed" ? u.adxMinusDiLineStyle : "solid") : undefined,
    adxAdxColor: u.type === "ADX" ? (u.adxAdxColor ?? "#eab308") : undefined,
    adxAdxLineWidth: u.type === "ADX" ? (u.adxAdxLineWidth === "thin" || u.adxAdxLineWidth === "normal" || u.adxAdxLineWidth === "thick" ? u.adxAdxLineWidth : "normal") : undefined,
    adxAdxLineStyle: u.type === "ADX" ? (u.adxAdxLineStyle === "solid" || u.adxAdxLineStyle === "dotted" || u.adxAdxLineStyle === "dashed" ? u.adxAdxLineStyle : "solid") : undefined,
    adxFixedScale: u.type === "ADX" ? (u.adxFixedScale !== false) : undefined,
    adxLimits: u.type === "ADX" ? (u.adxLimits === true) : undefined,
    adxLimitUpper: u.type === "ADX" && u.adxLimits ? (typeof u.adxLimitUpper === "number" ? Math.max(0, Math.min(100, Math.round(u.adxLimitUpper))) : 25) : undefined,
    adxLimitLower: u.type === "ADX" && u.adxLimits ? (typeof u.adxLimitLower === "number" ? Math.max(0, Math.min(100, Math.round(u.adxLimitLower))) : 20) : undefined,
    adxLimitColor: u.type === "ADX" && u.adxLimits ? (u.adxLimitColor ?? "#71717a") : undefined,
    adxLimitLineWidth: u.type === "ADX" && u.adxLimits ? (u.adxLimitLineWidth === "thin" || u.adxLimitLineWidth === "normal" || u.adxLimitLineWidth === "thick" ? u.adxLimitLineWidth : "normal") : undefined,
    adxLimitLineStyle: u.type === "ADX" && u.adxLimits ? (u.adxLimitLineStyle === "solid" || u.adxLimitLineStyle === "dotted" || u.adxLimitLineStyle === "dashed" ? u.adxLimitLineStyle : "dotted") : undefined,
    cciFixedScale: u.type === "CCI" ? (u.cciFixedScale === true) : undefined,
    cciLimits: u.type === "CCI" ? (u.cciLimits === true) : undefined,
    cciLimitUpper: u.type === "CCI" && u.cciLimits ? (typeof u.cciLimitUpper === "number" ? Math.max(-500, Math.min(500, Math.round(u.cciLimitUpper))) : 100) : undefined,
    cciLimitLower: u.type === "CCI" && u.cciLimits ? (typeof u.cciLimitLower === "number" ? Math.max(-500, Math.min(500, Math.round(u.cciLimitLower))) : -100) : undefined,
    cciLimitColor: u.type === "CCI" && u.cciLimits ? (u.cciLimitColor ?? "#dc2626") : undefined,
    cciLimitLineWidth: u.type === "CCI" && u.cciLimits ? (u.cciLimitLineWidth === "thin" || u.cciLimitLineWidth === "normal" || u.cciLimitLineWidth === "thick" ? u.cciLimitLineWidth : "normal") : undefined,
    cciLimitLineStyle: u.type === "CCI" && u.cciLimits ? (u.cciLimitLineStyle === "solid" || u.cciLimitLineStyle === "dotted" || u.cciLimitLineStyle === "dashed" ? u.cciLimitLineStyle : "dotted") : undefined,
    cciAsHistogram: u.type === "CCI" ? (u.cciAsHistogram === true) : undefined,
    cciHistogramColorAbove: u.type === "CCI" && u.cciAsHistogram ? (u.cciHistogramColorAbove ?? "#059669") : undefined,
    cciHistogramColorBelow: u.type === "CCI" && u.cciAsHistogram ? (u.cciHistogramColorBelow ?? "#dc2626") : undefined,
    cmfFixedScale: u.type === "CMF" ? (u.cmfFixedScale === true) : undefined,
    cmfLimits: u.type === "CMF" ? (u.cmfLimits === true) : undefined,
    cmfLimitUpper: u.type === "CMF" && u.cmfLimits ? (typeof u.cmfLimitUpper === "number" ? Math.max(-1, Math.min(1, u.cmfLimitUpper)) : 0.25) : undefined,
    cmfLimitLower: u.type === "CMF" && u.cmfLimits ? (typeof u.cmfLimitLower === "number" ? Math.max(-1, Math.min(1, u.cmfLimitLower)) : -0.25) : undefined,
    cmfLimitColor: u.type === "CMF" && u.cmfLimits ? (u.cmfLimitColor ?? "#dc2626") : undefined,
    cmfLimitLineWidth: u.type === "CMF" && u.cmfLimits ? (u.cmfLimitLineWidth === "thin" || u.cmfLimitLineWidth === "normal" || u.cmfLimitLineWidth === "thick" ? u.cmfLimitLineWidth : "normal") : undefined,
    cmfLimitLineStyle: u.type === "CMF" && u.cmfLimits ? (u.cmfLimitLineStyle === "solid" || u.cmfLimitLineStyle === "dotted" || u.cmfLimitLineStyle === "dashed" ? u.cmfLimitLineStyle : "dotted") : undefined,
    cmfAsHistogram: u.type === "CMF" ? (u.cmfAsHistogram === true) : undefined,
    cmfHistogramColorAbove: u.type === "CMF" && u.cmfAsHistogram ? (u.cmfHistogramColorAbove ?? "#059669") : undefined,
    cmfHistogramColorBelow: u.type === "CMF" && u.cmfAsHistogram ? (u.cmfHistogramColorBelow ?? "#dc2626") : undefined,
    ichimokuTenkanPeriod: u.type === "Ichimoku" ? (typeof u.ichimokuTenkanPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.ichimokuTenkanPeriod))) : 9) : undefined,
    ichimokuKijunPeriod: u.type === "Ichimoku" ? (typeof u.ichimokuKijunPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.ichimokuKijunPeriod))) : 26) : undefined,
    ichimokuSpanBPeriod: u.type === "Ichimoku" ? (typeof u.ichimokuSpanBPeriod === "number" ? Math.max(1, Math.min(500, Math.round(u.ichimokuSpanBPeriod))) : 52) : undefined,
    ichimokuDisplacement: u.type === "Ichimoku" ? (typeof u.ichimokuDisplacement === "number" ? Math.max(0, Math.min(500, Math.round(u.ichimokuDisplacement))) : 26) : undefined,
    ichimokuTenkanColor: u.type === "Ichimoku" ? (u.ichimokuTenkanColor ?? "#6366f1") : undefined,
    ichimokuTenkanLineWidth: u.type === "Ichimoku" ? (u.ichimokuTenkanLineWidth === "thin" || u.ichimokuTenkanLineWidth === "normal" || u.ichimokuTenkanLineWidth === "thick" ? u.ichimokuTenkanLineWidth : "normal") : undefined,
    ichimokuTenkanLineStyle: u.type === "Ichimoku" ? (u.ichimokuTenkanLineStyle === "solid" || u.ichimokuTenkanLineStyle === "dotted" || u.ichimokuTenkanLineStyle === "dashed" ? u.ichimokuTenkanLineStyle : "solid") : undefined,
    ichimokuKijunColor: u.type === "Ichimoku" ? (u.ichimokuKijunColor ?? "#ea580c") : undefined,
    ichimokuKijunLineWidth: u.type === "Ichimoku" ? (u.ichimokuKijunLineWidth === "thin" || u.ichimokuKijunLineWidth === "normal" || u.ichimokuKijunLineWidth === "thick" ? u.ichimokuKijunLineWidth : "normal") : undefined,
    ichimokuKijunLineStyle: u.type === "Ichimoku" ? (u.ichimokuKijunLineStyle === "solid" || u.ichimokuKijunLineStyle === "dotted" || u.ichimokuKijunLineStyle === "dashed" ? u.ichimokuKijunLineStyle : "solid") : undefined,
    ichimokuSpanAColor: u.type === "Ichimoku" ? (u.ichimokuSpanAColor ?? "#22c55e") : undefined,
    ichimokuSpanALineWidth: u.type === "Ichimoku" ? (u.ichimokuSpanALineWidth === "thin" || u.ichimokuSpanALineWidth === "normal" || u.ichimokuSpanALineWidth === "thick" ? u.ichimokuSpanALineWidth : "normal") : undefined,
    ichimokuSpanALineStyle: u.type === "Ichimoku" ? (u.ichimokuSpanALineStyle === "solid" || u.ichimokuSpanALineStyle === "dotted" || u.ichimokuSpanALineStyle === "dashed" ? u.ichimokuSpanALineStyle : "solid") : undefined,
    ichimokuSpanBColor: u.type === "Ichimoku" ? (u.ichimokuSpanBColor ?? "#ef4444") : undefined,
    ichimokuSpanBLineWidth: u.type === "Ichimoku" ? (u.ichimokuSpanBLineWidth === "thin" || u.ichimokuSpanBLineWidth === "normal" || u.ichimokuSpanBLineWidth === "thick" ? u.ichimokuSpanBLineWidth : "normal") : undefined,
    ichimokuSpanBLineStyle: u.type === "Ichimoku" ? (u.ichimokuSpanBLineStyle === "solid" || u.ichimokuSpanBLineStyle === "dotted" || u.ichimokuSpanBLineStyle === "dashed" ? u.ichimokuSpanBLineStyle : "solid") : undefined,
    ichimokuChikouColor: u.type === "Ichimoku" ? (u.ichimokuChikouColor ?? "#a855f7") : undefined,
    ichimokuChikouLineWidth: u.type === "Ichimoku" ? (u.ichimokuChikouLineWidth === "thin" || u.ichimokuChikouLineWidth === "normal" || u.ichimokuChikouLineWidth === "thick" ? u.ichimokuChikouLineWidth : "normal") : undefined,
    ichimokuChikouLineStyle: u.type === "Ichimoku" ? (u.ichimokuChikouLineStyle === "solid" || u.ichimokuChikouLineStyle === "dotted" || u.ichimokuChikouLineStyle === "dashed" ? u.ichimokuChikouLineStyle : "solid") : undefined,
    ichimokuCloudOpacity: u.type === "Ichimoku" ? (typeof u.ichimokuCloudOpacity === "number" ? Math.max(0, Math.min(0.7, u.ichimokuCloudOpacity)) : 0.3) : undefined,
    ichimokuShowTenkan: u.type === "Ichimoku" ? (u.ichimokuShowTenkan !== false) : undefined,
    ichimokuShowKijun: u.type === "Ichimoku" ? (u.ichimokuShowKijun !== false) : undefined,
    ichimokuShowSpanA: u.type === "Ichimoku" ? (u.ichimokuShowSpanA !== false) : undefined,
    ichimokuShowSpanB: u.type === "Ichimoku" ? (u.ichimokuShowSpanB !== false) : undefined,
    ichimokuShowChikou: u.type === "Ichimoku" ? (u.ichimokuShowChikou === true) : undefined,
    hmaCustomLongPeriod: hmaCustomNorm ? hmaCustomNorm.hmaCustomLongPeriod : undefined,
    hmaCustomFastPeriod: hmaCustomNorm ? hmaCustomNorm.hmaCustomFastPeriod : undefined,
    hmaCustomSmoothPeriod: hmaCustomNorm ? hmaCustomNorm.hmaCustomSmoothPeriod : undefined,
    hmaCustomFastMaType:
      u.type === "HMA_CUSTOM"
        ? ru.hmaCustomFastMaType === "SMA" || ru.hmaCustomFastMaType === "EMA" || ru.hmaCustomFastMaType === "WMA" || ru.hmaCustomFastMaType === "LINEAR_FIT" || ru.hmaCustomFastMaType === "QUADRATIC_FIT"
          ? ru.hmaCustomFastMaType
          : "WMA"
        : undefined,
    hmaCustomLongMaType:
      u.type === "HMA_CUSTOM"
        ? ru.hmaCustomLongMaType === "SMA" || ru.hmaCustomLongMaType === "EMA" || ru.hmaCustomLongMaType === "WMA" || ru.hmaCustomLongMaType === "LINEAR_FIT" || ru.hmaCustomLongMaType === "QUADRATIC_FIT"
          ? ru.hmaCustomLongMaType
          : "WMA"
        : undefined,
    hmaCustomSmoothMaType:
      u.type === "HMA_CUSTOM"
        ? ru.hmaCustomSmoothMaType === "SMA" || ru.hmaCustomSmoothMaType === "EMA" || ru.hmaCustomSmoothMaType === "WMA"
          ? ru.hmaCustomSmoothMaType
          : "WMA"
        : undefined,
    wma2TimeUnit: isMa2Tw ? ma2ResolvedUnit : undefined,
    wma2TimeValue:
      isMa2Tw
        ? normalizeMa2TimeValueForUnit(
            ma2ResolvedUnit,
            typeof u.wma2TimeValue === "number" && Number.isFinite(u.wma2TimeValue)
              ? u.wma2TimeValue
              : defaultMa2TimeValueForUnit(ma2ResolvedUnit)
          )
        : undefined,
    showLastValueOnYAxis: u.showLastValueOnYAxis !== false,
  } as UserIndicatorConfig;
  });
}

const SECONDARY_PANEL_ORDER = ["panel2", "panel3", "panel4", "panel5", "panel6", "panel7"] as const;

/** Painéis secundários do gráfico (faixas 2–5). */
export type SecondaryPanelSlot = (typeof SECONDARY_PANEL_ORDER)[number];

const TYPES_DEFAULT_SECONDARY: ReadonlySet<UserIndicatorType> = new Set([
  "RSI", "MFI", "MACD", "DIFF", "Stochastic", "WilliamsR", "OBV", "AD", "ATR", "ADX", "CCI", "CMF", "Volume",
]);

/** Painel efetivo para permutar (alinha a IndicatorsPanel / layout). */
function effectivePanelForSwap(u: UserIndicatorConfig): IndicatorPanel {
  if (u.type === "SAR" || u.type === "VWAP" || u.type === "Ichimoku") return "main";
  const p = u.panel;
  if (p === "main" || p === "panel2" || p === "panel3" || p === "panel4" || p === "panel5" || p === "panel6" || p === "panel7") return p;
  return TYPES_DEFAULT_SECONDARY.has(u.type) ? "panel2" : "main";
}

function adjacentSecondaryPair(clicked: SecondaryPanelSlot): [IndicatorPanel, IndicatorPanel] | null {
  const idx = SECONDARY_PANEL_ORDER.indexOf(clicked);
  if (idx < 0) return null;
  if (clicked === "panel7") return ["panel7", "panel6"];
  return [SECONDARY_PANEL_ORDER[idx], SECONDARY_PANEL_ORDER[idx + 1]];
}

function applySwapAdjacentSecondaryPanels(prev: UserIndicatorConfig[], clicked: SecondaryPanelSlot): UserIndicatorConfig[] {
  const pair = adjacentSecondaryPair(clicked);
  if (!pair) return prev;
  const [a, b] = pair;
  return prev.map((u) => {
    const ep = effectivePanelForSwap(u);
    if (ep === a) return { ...u, panel: b };
    if (ep === b) return { ...u, panel: a };
    return u;
  });
}

/** Campos editáveis de um indicador (sem id). */
export type UserIndicatorEditable = Pick<
  UserIndicatorConfig,
  "period" | "fieldKey" | "color" | "panel" | "intervals" | "lineWidth" | "lineStyle" | "rsiFixedScale" | "rsiCenterLine" | "rsiCenterLineColor" | "rsiCenterLineWidth" | "rsiCenterLineStyle" | "rsiLimits" | "rsiLimitUpper" | "rsiLimitLower" | "rsiLimitColor" | "rsiLimitLineWidth" | "rsiLimitLineStyle" | "macdFastMaType" | "macdFastPeriod" | "macdSlowMaType" | "macdSlowPeriod" | "macdSignalLine" | "macdSignalMaType" | "macdSignalPeriod" | "macdSignalColor" | "macdSignalLineWidth" | "macdSignalLineStyle" | "macdHistogram" | "macdHistogramColorAbove" | "macdHistogramColorBelow" | "diffFirstFieldKey" | "diffSecondFieldKey" | "diffSignalLine" | "diffSignalMaType" | "diffSignalPeriod" | "diffSignalColor" | "diffSignalLineWidth" | "diffSignalLineStyle" | "diffHistogram" | "diffHistogramColorAbove" | "diffHistogramColorBelow" | "stochLimits" | "stochLimitUpper" | "stochLimitLower" | "stochLimitColor" | "stochLimitLineWidth" | "stochLimitLineStyle" | "stochDLine" | "stochDMaType" | "stochDPeriod" | "stochDColor" | "stochDLineWidth" | "stochDLineStyle" | "williamsRLimits" | "williamsRLimitUpper" | "williamsRLimitLower" | "williamsRLimitColor" | "williamsRLimitLineWidth" | "williamsRLimitLineStyle" | "sarStart" | "sarIncrement" | "sarMax" | "sarPointSize" | "bollingerMaType" | "bollingerZ" | "bollingerShowUpper" | "bollingerShowLower" | "bollingerShowMiddle" | "bollingerBandOpacity" | "bollingerLimitsColor" | "bollingerLimitsLineStyle" | "bollingerLimitsLineWidth" | "bollingerMiddleColor" | "bollingerMiddleLineStyle" | "bollingerMiddleLineWidth" | "donchianShowUpper" | "donchianShowLower" | "donchianShowMiddle" | "donchianBandOpacity" | "donchianLimitsColor" | "donchianLimitsLineStyle" | "donchianLimitsLineWidth" | "donchianMiddleColor" | "donchianMiddleLineStyle" | "donchianMiddleLineWidth" | "keltnerMaType" | "keltnerMultiplier" | "keltnerShowUpper" | "keltnerShowLower" | "keltnerShowMiddle" | "keltnerBandOpacity" | "keltnerLimitsColor" | "keltnerLimitsLineStyle" | "keltnerLimitsLineWidth" | "keltnerMiddleColor" | "keltnerMiddleLineStyle" | "keltnerMiddleLineWidth" | "obvVolumeSource" | "adVolumeSource" | "volumeInUsdt" | "volumeColorAbove" | "volumeColorBelow" | "showLastValueOnYAxis" | "adxPlusDiColor" | "adxPlusDiLineWidth" | "adxPlusDiLineStyle" | "adxMinusDiColor" | "adxMinusDiLineWidth" | "adxMinusDiLineStyle" | "adxAdxColor" | "adxAdxLineWidth" | "adxAdxLineStyle" | "adxFixedScale" | "adxLimits" | "adxLimitUpper" | "adxLimitLower" | "adxLimitColor" | "adxLimitLineWidth" | "adxLimitLineStyle" | "cciFixedScale" | "cciLimits" | "cciLimitUpper" | "cciLimitLower" | "cciLimitColor" | "cciLimitLineWidth" | "cciLimitLineStyle" | "cciAsHistogram" | "cciHistogramColorAbove" | "cciHistogramColorBelow" | "cmfFixedScale" | "cmfLimits" | "cmfLimitUpper" | "cmfLimitLower" | "cmfLimitColor" | "cmfLimitLineWidth" | "cmfLimitLineStyle" | "cmfAsHistogram" | "cmfHistogramColorAbove" | "cmfHistogramColorBelow" | "ichimokuTenkanPeriod" | "ichimokuKijunPeriod" | "ichimokuSpanBPeriod" | "ichimokuDisplacement" | "ichimokuTenkanColor" | "ichimokuTenkanLineWidth" | "ichimokuTenkanLineStyle" | "ichimokuKijunColor" | "ichimokuKijunLineWidth" | "ichimokuKijunLineStyle" | "ichimokuSpanAColor" | "ichimokuSpanALineWidth" | "ichimokuSpanALineStyle" | "ichimokuSpanBColor" | "ichimokuSpanBLineWidth" | "ichimokuSpanBLineStyle" | "ichimokuChikouColor" | "ichimokuChikouLineWidth" | "ichimokuChikouLineStyle" | "ichimokuCloudOpacity" |   "ichimokuShowTenkan" | "ichimokuShowKijun" | "ichimokuShowSpanA" | "ichimokuShowSpanB" | "ichimokuShowChikou" | "hmaCustomLongPeriod" | "hmaCustomFastPeriod" | "hmaCustomSmoothPeriod" | "hmaCustomFastMaType" | "hmaCustomLongMaType" | "hmaCustomSmoothMaType" | "wma2TimeUnit" | "wma2TimeValue"
>;

interface ContextValue {
  userIndicators: UserIndicatorConfig[];
  currentGroupMinutes: number | null;
  setCurrentGroupMinutes: (v: number | null) => void;
  addIndicator: (config: Omit<UserIndicatorConfig, "id">) => UserIndicatorConfig;
  removeIndicator: (id: string) => void;
  updateIndicator: (id: string, updates: Partial<UserIndicatorEditable>) => void;
  updateIndicatorIntervals: (id: string, intervals: number[]) => void;
  /** Restaura a lista de indicadores a partir de um layout (ex.: ao carregar layout salvo). */
  replaceUserIndicatorsFromLayout: (raw: unknown) => void;
  /** Troca indicadores entre este painel e o adjacente (2↔3, 3↔4, 4↔5; no 5 troca com 4). */
  swapAdjacentSecondaryPanels: (clicked: SecondaryPanelSlot, onAfter?: (next: UserIndicatorConfig[]) => void) => void;
}

const KlinesIndicatorsContext = createContext<ContextValue | null>(null);

export function KlinesIndicatorsProvider({ children }: { children: ReactNode }) {
  const [userIndicators, setUserIndicators] = useState<UserIndicatorConfig[]>(loadFromStorage);
  const [currentGroupMinutes, setCurrentGroupMinutes] = useState<number | null>(null);

  const addIndicator = useCallback((config: Omit<UserIndicatorConfig, "id">) => {
    const id = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newInd: UserIndicatorConfig = { ...config, id, showLastValueOnYAxis: config.showLastValueOnYAxis !== false };
    setUserIndicators((prev) => [...prev, newInd]);
    return newInd;
  }, []);

  const removeIndicator = useCallback((id: string) => {
    setUserIndicators((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const updateIndicator = useCallback((id: string, updates: Partial<UserIndicatorEditable>) => {
    setUserIndicators((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
  }, []);

  const updateIndicatorIntervals = useCallback((id: string, intervals: number[]) => {
    setUserIndicators((prev) => prev.map((u) => (u.id === id ? { ...u, intervals } : u)));
  }, []);

  const replaceUserIndicatorsFromLayout = useCallback((raw: unknown) => {
    const normalized = normalizeIndicatorListFromLayout(raw);
    if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
      const inLen = Array.isArray(raw) ? raw.length : 0;
      console.log("[layout] replaceUserIndicatorsFromLayout: raw length=", inLen, "→ normalized length=", normalized.length, normalized.length < inLen ? "(alguns filtrados)" : "");
    }
    setUserIndicators(normalized);
  }, []);

  const swapAdjacentSecondaryPanels = useCallback(
    (clicked: SecondaryPanelSlot, onAfter?: (next: UserIndicatorConfig[]) => void) => {
      setUserIndicators((prev) => {
        const next = applySwapAdjacentSecondaryPanels(prev, clicked);
        if (onAfter) queueMicrotask(() => onAfter(next));
        return next;
      });
    },
    []
  );

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
      swapAdjacentSecondaryPanels,
    }),
    [userIndicators, currentGroupMinutes, addIndicator, removeIndicator, updateIndicator, updateIndicatorIntervals, replaceUserIndicatorsFromLayout, swapAdjacentSecondaryPanels]
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
