"use client";

import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import { API_BASE, VPS_FLUSH_WS_URL } from "@/app/constants";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { computeSmaColumn, computeEmaColumn, computeWmaColumn, computeRsiColumn, computeMfiColumn, computeMacdColumn, computeMaColumn, normalizeMacdMaType, normalizeHmaCustomLegMaType, computeStochasticKColumn, computeWilliamsRColumn, computeObvColumn, computeAdColumn, computeParabolicSarColumn, computeAtrColumn, computeVwapColumn, computeBollingerBands, computeKeltnerChannels, computeDonchianChannels, computeAdxColumns, computeCciColumn, computeCmfColumn, computeHmaColumn, computeHmaCustomColumn, computeVwmaColumn, computeLinearFitColumn, computeQuadraticFitColumn, computeIchimokuColumns, computeMaAngleColumn, normalizeMaAngleMaType } from "@/app/api/binance/klines/indicators";
import { useKlinesIndicators, getDataAndValueIndexForIndicator, type UserIndicatorConfig } from "./KlinesIndicatorsContext";
import { useKlinesRegressions } from "./regression/KlinesRegressionsContext";
import { useSistemaDebug } from "./SistemaDebugContext";
import { useChartHeader } from "./ChartHeaderContext";
import { parseSpotOpenOrdersJson } from "@/lib/spot-open-orders-client";
import { useChartSymbol } from "./ChartSymbolContext";
import { useStrategies } from "./strategies/StrategiesContext";
import { legacyToRoot, strategiesForContext, validateStrategyReferences, collectSeriesKeys, type Strategy } from "./strategies/strategiesTypes";
import {
  ROBOTS_CHANGED_EVENT,
  ROBOT_BUY_EXEC_CHANGED_EVENT,
  ROBOT_BUY_ACCUM_MAX_CANDLES_DEFAULT,
  ROBOT_BUY_ACCUM_MAX_CANDLES_MAX,
  ROBOT_BUY_ACCUM_MAX_CANDLES_MIN,
  ROBOT_BUY_EXEC_STORAGE_KEY,
  ROBOTS_STORAGE_KEY,
  loadRobotBuyExecMap,
  loadSavedRobots,
  persistRobotBuyExecMap,
  hasRobotBuyExecForCandle,
  setRobotBuyExecForCandle,
  ROBOT_BUY_ACCUM_START_SIGNAL_MAX,
  type RobotBuyExecMap,
  type SavedRobot,
} from "./robotsStorage";
import {
  CRYPTO_SISTEMA_BACKTEST_ERROR_EVENT,
  CRYPTO_SISTEMA_BACKTEST_RUN_EVENT,
  loadBacktestRange,
  resolveBacktestFeeRatePerSide,
} from "./backtestStorage";
import { runRobotBacktest } from "./robotBacktest";
import RobotBacktestResultModal from "./RobotBacktestResultModal";
import { getRobotPosition } from "./robotPositionStorage";
import {
  applyRobotLiveBuyAccumSnapshot,
  loadRobotLiveBuyAccumSnapshot,
  persistRobotLiveBuyAccum,
  ROBOT_LIVE_BUY_ACCUM_STORAGE_KEY,
} from "./robotLiveBuyAccumStorage";
import {
  appendRobotLiveActivityEvent,
  clearRobotLiveRefsForRobotSymbol,
  fetchRobotLiveSessionsAndMerge,
  ROBOT_LIVE_SESSION_ACTIVITY_EVENT,
  ROBOT_LIVE_SESSION_CLEAR_REFS_EVENT,
  schedulePersistRobotLiveSessionsToDb,
} from "./robotLiveSessionSync";
import {
  buyerAllowsAccumulationBuy,
  buyerLimitBuyMaxPriceBelowCandleOpen,
  buyerMarketBuyRefStrictlyBelowCandleOpen,
  buyerRefAllowsNextBuy,
  flattenBreakevenThresholdPrice,
  longFlattenCloseBreakeven,
} from "./robotPriceLegRules";
import {
  computeNominalBuyOperationUsdt,
  cancelRobotSpotOrder,
  computeRobotMarketBuyQuoteUsdt,
  dispatchRobotPositionBuy,
  dispatchRobotPositionSellClear,
  dispatchSpotOrderPlaced,
  parseMarketOrderFill,
  parseSpotOrderState,
  submitRobotLimitBuyOrder,
  submitRobotMarketBuyOrder,
  submitRobotMarketSellOrder,
  syncRobotSpotOrder,
} from "./robotLiveOrders";
import { evaluateNode } from "./strategies/strategyEvaluator";
import {
  indicatorColumnSpan,
  indicatorColumnStart,
  topologicalUserIndicatorOrder,
} from "./indicatorsPanel/indicatorsPanelUtils";
import {
  Y_AXIS_WIDTH,
  KLINE_GROUP_MINUTES_KEY,
  KLINE_HEIKIN_ASHI_KEY,
  KLINE_VOLUME_AT_PRICE_KEY,
  KLINE_AGG_SERIES_KEY,
  getKlineLastLayoutStorage,
  KLINES_LAYOUT_SLOT_CHANGED_EVENT,
  CACHE2_TICK_KIND_STRIDE,
  GROUP_MINUTES_CACHE2_BASE,
  GROUP_MINUTES_CACHE2_TRADES_BASE,
  chartMinutesForTimeWindowMa2,
  formatCache2IntervalShortLabel,
  groupMinutesToAggKind,
  groupMinutesToCache2Params,
  isAggFastGroupMinutes,
  isIntervalForbiddenOnDefaultLayout,
  isGroupMinutesNoSpotOrderMarkers,
  isKlinesDefaultLayoutStorageRaw,
  normalizeAggGroupMinutes,
  getSpotOrderLabelsVisibleFromStorage,
  subscribeSpotOrderLabelsVisible,
  BINANCE_CONNECTION_CHANGED_EVENT,
} from "./KlinesChartConstants";
import { RENKO_CACHE_TICK_INTERVALS, TRADE_CACHE_TRADE_INTERVALS } from "@/app/lib/renkoKlineCache2Build";
import { type AggFastBarRowPayload, TRADES_PER_CANDLE } from "@/app/lib/binanceAggRenkoCore";
import {
  buildAggFastLiveDebugSnapshot,
  type AggFastLivePriceTickDiagnostics,
  type AggFastLiveWsTradeRow,
} from "./aggFastLiveDebug";
import {
  aggFastLiveBrickLogicalKey,
  liveSourcePayloadsToTierPayloadsForMerge,
  aggDisplayTierBaseLineCount,
  mergeAggFastServerAndLive,
} from "./aggFastKlineMerge";
import { useAggFastTradeLive, type AggFastWsKind } from "./useAggFastTradeLive";
import { useVpsFlushNotify } from "./useVpsFlushNotify";

/** Fila → POST `/api/binance/agg-fast-bars` (grava *Fast* + BinanceKlineCache2), alinhado a dev/ticks. */
const AGG_PERSIST_FLUSH_MS = 10_000;

function subscribeKlinesLayoutDefault(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  /** Layout ativo é por aba (sessionStorage); não escutar `storage` do localStorage para não sincronizar entre separadores. */
  window.addEventListener(KLINES_LAYOUT_SLOT_CHANGED_EVENT, callback);
  return () => {
    window.removeEventListener(KLINES_LAYOUT_SLOT_CHANGED_EVENT, callback);
  };
}

function snapshotKlinesLayoutIsDefault(): boolean {
  if (typeof window === "undefined") return true;
  return isKlinesDefaultLayoutStorageRaw(getKlineLastLayoutStorage());
}

function buyerSignalExitMeetsMinEdge(robot: SavedRobot, refPrice: number, avgBuyPrice: number): boolean {
  if (!Number.isFinite(refPrice) || refPrice <= 0) return false;
  if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) return false;
  const minEdgePctRaw = robot.signalExitMinEdgePercent ?? 0;
  const minEdgePct = Number.isFinite(minEdgePctRaw) ? Math.max(0, minEdgePctRaw) : 0;
  if (minEdgePct <= 1e-12) return true;
  return refPrice >= avgBuyPrice * (1 + minEdgePct / 100) - 1e-9;
}

function buyerAlertArmMeetsMinEdge(robot: SavedRobot, refPrice: number, avgBuyPrice: number): boolean {
  if (!Number.isFinite(refPrice) || refPrice <= 0) return false;
  if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) return false;
  const minEdgePctRaw = robot.alertArmMinEdgePercent ?? 0;
  const minEdgePct = Number.isFinite(minEdgePctRaw) ? Math.max(0, minEdgePctRaw) : 0;
  if (minEdgePct <= 1e-12) return true;
  return refPrice >= avgBuyPrice * (1 + minEdgePct / 100) - 1e-9;
}

/** Largura reservada à direita para a barra de rolagem vertical ficar fora do gráfico (não cobrir o eixo Y). */
const SCROLLBAR_GUTTER = 17;
/** Teto do plot em 100% (igual a KlinesChart MAX_PLOT_WIDTH_BASE). Largura máxima total = 660px (600 plot + 60 eixo). */
const MAX_PLOT_WIDTH = 600;
import { formatAbbreviated, formatUsdt, formatUsdtWithDecimals } from "./klinesFormatters";
import { getIndicatorLabel, getIndicatorLabelShort, getIndicatorLabelSignal, getIndicatorLabelShortSignal, getIndicatorLabelStochD, getIndicatorLabelShortStochD } from "./IndicatorsPanel";
import { INDICATOR_COLOR_PALETTE } from "./indicatorsPanel/index";
import {
  wma2RequestedPeriodCandles,
  wma2ShouldOmitSeriesOnChart,
  isTimeWindowMa2Type,
  ma2NullIndicesBeyondFullWindow,
  defaultMa2TimeValueForUnit,
} from "./indicatorsPanel/wma2Period";
import KlinesChart from "./KlinesChart";
import type { SpotOrderMarker } from "./klinesChart/types";
import {
  buildSpotOrderMarkerTitle,
  debugSpotOrderPlacement,
  resolveKlineIndexForSpotOrder,
  type ChartSpotOrderApiRow,
} from "@/lib/user-spot-order-chart";

/**
 * Candle Binance: [0] openTime, [1] open, [2] high, [3] low, [4] close, [5] volume (base),
 * [6] closeTime, [7] quoteAssetVolume, [8] numberOfTrades, [9] takerBuyBaseAssetVolume,
 * [10] takerBuyQuoteAssetVolume, [11] ignore.
 * Colunas calculadas (usuário): [12], [13], ... (indicadores adicionados pelo painel).
 */
type Kline = [
  number,   // 0 openTime
  string,   // 1 open
  string,   // 2 high
  string,   // 3 low
  string,   // 4 close
  string,   // 5 volume (BTC)
  number,   // 6 closeTime
  string,   // 7 quoteAssetVolume (USDT)
  number,   // 8 numberOfTrades
  string,   // 9 takerBuyBaseAssetVolume
  string,   // 10 takerBuyQuoteAssetVolume
  number,   // 11 ignore
  ...(number | null)[], // 12+ indicadores (ex.: IND_SMA_1)
];

/**
 * Live: linha 0 = vela em formação (close ao vivo); linha 1 = última fechada. Muitos sinais só batem no fecho —
 * nesse momento passam a aparecer na linha 1. Ordem [1,0] ao escolher openTime: prioriza o candle fechado.
 */
function robotLiveStrategyRowIndices(klineLen: number): number[] {
  return klineLen >= 2 ? [1, 0] : [0];
}

function robotStrategyTrueOnAnyLiveRow(
  robot: SavedRobot,
  klines: Kline[],
  strategyResults: Map<string, boolean[]>,
  test: (robot: SavedRobot, rowIndex: number, results: Map<string, boolean[]>) => boolean
): boolean {
  for (const i of robotLiveStrategyRowIndices(klines.length)) {
    if (test(robot, i, strategyResults)) return true;
  }
  return false;
}

function robotLivePickOpenTimeWhere(
  robot: SavedRobot,
  klines: Kline[],
  strategyResults: Map<string, boolean[]>,
  test: (robot: SavedRobot, rowIndex: number, results: Map<string, boolean[]>) => boolean
): string | null {
  for (const i of robotLiveStrategyRowIndices(klines.length)) {
    if (test(robot, i, strategyResults)) return String(klines[i][0]);
  }
  return null;
}

const REFRESH_MS = 1 * 60 * 1000; // 1 min

/** Gráficos atemporais (Renko/Range/Kagi/…): GET kline-cache2 + reconexão aggTrade para alinhar ao servidor. */
const AGG_ATEMPORAL_CACHE_REFRESH_MS = 2 * 60 * 1000;
const AGG_CACHE_REFRESH_WINDOW_MS = 60 * 60 * 1000; // 1h

/** Fallback até o primeiro GET kline-cache2 devolver `maxBars` (AppConfig AGG_ATEMPORAL_KLINE_CACHE_LIMIT). */
const FALLBACK_AGG_KLINE_CACHE_LIMIT = 5000;

function mergeRecentCacheWindow(
  prev: readonly Kline[],
  next: readonly Kline[],
  windowMs: number,
  maxBars: number
): Kline[] {
  const cap = Number.isFinite(maxBars) && maxBars > 0 ? Math.floor(maxBars) : FALLBACK_AGG_KLINE_CACHE_LIMIT;
  if (prev.length === 0) return [...next];
  if (next.length === 0) return [...prev];
  const newestOpenTime = Number(next[0]?.[0]);
  if (!Number.isFinite(newestOpenTime)) return [...next];
  const cutoff = newestOpenTime - windowMs;
  const recent = next.filter((row) => Number(row[0]) >= cutoff);
  const olderPrev = prev.filter((row) => Number(row[0]) < cutoff);
  return [...recent, ...olderPrev]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .slice(0, cap);
}

const INTERVAL_OPTIONS_BASE: { value: number; label: string; param: string }[] = [
  { value: 1, label: "1m", param: "1m" },
  { value: 3, label: "3m", param: "3m" },
  { value: 5, label: "5m", param: "5m" },
  { value: 15, label: "15m", param: "15m" },
  { value: 30, label: "30m", param: "30m" },
  { value: 45, label: "45m", param: "45m" },
  { value: 60, label: "1h", param: "1h" },
  { value: 120, label: "2h", param: "2h" },
  { value: 180, label: "3h", param: "3h" },
  { value: 240, label: "4h", param: "4h" },
  { value: 360, label: "6h", param: "6h" },
  { value: 480, label: "8h", param: "8h" },
  { value: 720, label: "12h", param: "12h" },
  { value: 1440, label: "1D", param: "1d" },
  { value: 4320, label: "3D", param: "3d" },
  { value: 10080, label: "1w", param: "1w" },
  { value: 43200, label: "1month", param: "1M" },
];

/** Timeframe padrão quando não definido no localStorage: 1 dia. */
const DEFAULT_GROUP_MINUTES_FIRST_LOAD = 1440; // 1D (1 dia)

function getIntervalOptions(): { value: number; label: string; param: string }[] {
  return INTERVAL_OPTIONS_BASE;
}

function isValidStoredGroupMinutes(n: number): boolean {
  if (!Number.isFinite(n)) return false;
  if (isAggFastGroupMinutes(n)) return true;
  return getIntervalOptions().some((o) => o.value === n);
}

function getStoredGroupMinutes(): number {
  if (typeof window === "undefined") return DEFAULT_GROUP_MINUTES_FIRST_LOAD;
  try {
    const aggRaw = window.localStorage.getItem(KLINE_AGG_SERIES_KEY);
    if (aggRaw === "renko") {
      const v = GROUP_MINUTES_CACHE2_BASE + 0 * CACHE2_TICK_KIND_STRIDE;
      window.localStorage.setItem(KLINE_GROUP_MINUTES_KEY, String(v));
      window.localStorage.removeItem(KLINE_AGG_SERIES_KEY);
      return v;
    }
    if (aggRaw === "range") {
      const v = GROUP_MINUTES_CACHE2_BASE + 1 * CACHE2_TICK_KIND_STRIDE;
      window.localStorage.setItem(KLINE_GROUP_MINUTES_KEY, String(v));
      window.localStorage.removeItem(KLINE_AGG_SERIES_KEY);
      return v;
    }
    if (aggRaw === "kagi") {
      const v = GROUP_MINUTES_CACHE2_BASE + 2 * CACHE2_TICK_KIND_STRIDE;
      window.localStorage.setItem(KLINE_GROUP_MINUTES_KEY, String(v));
      window.localStorage.removeItem(KLINE_AGG_SERIES_KEY);
      return v;
    }
    const raw = window.localStorage.getItem(KLINE_GROUP_MINUTES_KEY);
    const n = Number(raw);
    const normalized = normalizeAggGroupMinutes(n);
    if (Number.isFinite(n) && normalized !== n) {
      try {
        window.localStorage.setItem(KLINE_GROUP_MINUTES_KEY, String(normalized));
      } catch {
        /* ignore */
      }
    }
    if (isValidStoredGroupMinutes(normalized)) return normalized;
  } catch {
    /* ignore */
  }
  return DEFAULT_GROUP_MINUTES_FIRST_LOAD;
}

function getStoredHeikinAshi(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(KLINE_HEIKIN_ASHI_KEY);
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

const VOLUME_AT_PRICE_BUCKETS_MIN = 20;
const VOLUME_AT_PRICE_BUCKETS_MAX = 60;
/** Apenas valores pares (6, 8, 10, …, 60). */
function clampEvenBuckets(v: number): number {
  const n = Math.max(VOLUME_AT_PRICE_BUCKETS_MIN, Math.min(VOLUME_AT_PRICE_BUCKETS_MAX, Math.round(v)));
  return n % 2 === 0 ? n : n - 1;
}
const VOLUME_AT_PRICE_OPACITY_MIN = 10;
const VOLUME_AT_PRICE_OPACITY_MAX = 70;
const VOLUME_AT_PRICE_WIDTH_PERCENT_MIN = 30;
const VOLUME_AT_PRICE_WIDTH_PERCENT_MAX = 100;
const VOLUME_AT_PRICE_PERCENT_MIN = 20;
const VOLUME_AT_PRICE_PERCENT_MAX = 100;
const VOLUME_AT_PRICE_PERCENT_DEFAULT = 100;

/** Config do cache VAP por intervalo do gráfico: param (API), maxCandles, label para exibição, minutos do candle do cache. */
export function getVapCacheConfig(groupMinutes: number): { param: string; maxCandles: number; paramLabel: string; paramMinutes: number } {
  const map: Record<number, { param: string; maxCandles: number; paramLabel: string; paramMinutes: number }> = {
    1: { param: "1m", maxCandles: 1440, paramLabel: "1m", paramMinutes: 1 },
    3: { param: "1m", maxCandles: 450, paramLabel: "1m", paramMinutes: 1 },
    5: { param: "1m", maxCandles: 750, paramLabel: "1m", paramMinutes: 1 },
    15: { param: "5m", maxCandles: 450, paramLabel: "5m", paramMinutes: 5 },
    30: { param: "5m", maxCandles: 900, paramLabel: "5m", paramMinutes: 5 },
    45: { param: "15m", maxCandles: 450, paramLabel: "15m", paramMinutes: 15 },
    60: { param: "15m", maxCandles: 600, paramLabel: "15m", paramMinutes: 15 },
    120: { param: "30m", maxCandles: 600, paramLabel: "30m", paramMinutes: 30 },
    180: { param: "1h", maxCandles: 450, paramLabel: "1h", paramMinutes: 60 },
    240: { param: "1h", maxCandles: 600, paramLabel: "1h", paramMinutes: 60 },
    360: { param: "2h", maxCandles: 450, paramLabel: "2h", paramMinutes: 120 },
    480: { param: "2h", maxCandles: 600, paramLabel: "2h", paramMinutes: 120 },
    720: { param: "3h", maxCandles: 600, paramLabel: "3h", paramMinutes: 180 },
    1440: { param: "6h", maxCandles: 600, paramLabel: "6h", paramMinutes: 360 },
    4320: { param: "1d", maxCandles: 450, paramLabel: "1D", paramMinutes: 1440 },
    10080: { param: "3d", maxCandles: 350, paramLabel: "3D", paramMinutes: 4320 },
    43200: { param: "1w", maxCandles: 600, paramLabel: "1month", paramMinutes: 10080 },
  };
  return map[groupMinutes] ?? { param: "1m", maxCandles: 1440, paramLabel: "1m", paramMinutes: 1 };
}

/** Formata o equivalente em tempo: apenas "Y dias/horas/minutos" (ex.: "12.5 dias"). lang opcional para en. */
export function formatVapTimeSpan(candles: number, paramLabel: string, paramMinutes: number, lang?: "pt" | "en"): string {
  const totalMinutes = candles * paramMinutes;
  const isEn = lang === "en";
  if (totalMinutes >= 43200) {
    const n = Math.round((totalMinutes / 43200) * 10) / 10;
    const unit = isEn ? (n === 1 ? "month" : "months") : (n === 1 ? "mês" : "meses");
    return `${n} ${unit}`;
  }
  if (totalMinutes >= 1440) {
    const n = Math.round((totalMinutes / 1440) * 10) / 10;
    const unit = isEn ? (n === 1 ? "day" : "days") : (n === 1 ? "dia" : "dias");
    return `${n} ${unit}`;
  }
  if (totalMinutes >= 60) {
    const n = Math.round((totalMinutes / 60) * 10) / 10;
    const unit = isEn ? (n === 1 ? "hour" : "hours") : (n === 1 ? "hora" : "horas");
    return `${n} ${unit}`;
  }
  const n = Math.round(totalMinutes);
  const unit = isEn ? (n === 1 ? "minute" : "minutes") : (n === 1 ? "minuto" : "minutos");
  return `${n} ${unit}`;
}

function getStoredVolumeAtPrice(): { enabled: boolean; buckets: number; percent: number; opacity: number; widthPercent: number; side: "left" | "right"; colorAbove: string; colorBelow: string } {
  if (typeof window === "undefined") return { enabled: false, buckets: VOLUME_AT_PRICE_BUCKETS_MIN, percent: VOLUME_AT_PRICE_PERCENT_DEFAULT, opacity: 40, widthPercent: 100, side: "left", colorAbove: "#059669", colorBelow: "#dc2626" };
  try {
    const raw = window.localStorage.getItem(KLINE_VOLUME_AT_PRICE_KEY);
    if (!raw) return { enabled: false, buckets: VOLUME_AT_PRICE_BUCKETS_MIN, percent: VOLUME_AT_PRICE_PERCENT_DEFAULT, opacity: 40, widthPercent: 100, side: "left", colorAbove: "#059669", colorBelow: "#dc2626" };
    const p = JSON.parse(raw) as { enabled?: boolean; buckets?: number; candles?: number; percent?: number; opacity?: number; widthPercent?: number; side?: "left" | "right"; colorAbove?: string; colorBelow?: string };
    const buckets = clampEvenBuckets(typeof p.buckets === "number" ? p.buckets : VOLUME_AT_PRICE_BUCKETS_MIN);
    const percent = typeof p.percent === "number" && p.percent >= VOLUME_AT_PRICE_PERCENT_MIN && p.percent <= VOLUME_AT_PRICE_PERCENT_MAX ? Math.round(p.percent) : VOLUME_AT_PRICE_PERCENT_DEFAULT;
    const opacity = typeof p.opacity === "number" && p.opacity >= VOLUME_AT_PRICE_OPACITY_MIN && p.opacity <= VOLUME_AT_PRICE_OPACITY_MAX ? p.opacity : 40;
    const widthPercent = typeof p.widthPercent === "number" && p.widthPercent >= VOLUME_AT_PRICE_WIDTH_PERCENT_MIN && p.widthPercent <= VOLUME_AT_PRICE_WIDTH_PERCENT_MAX ? p.widthPercent : 100;
    const side = p.side === "left" || p.side === "right" ? p.side : "left";
    const colorAbove = typeof p.colorAbove === "string" && /^#[0-9A-Fa-f]{6}$/.test(p.colorAbove) ? p.colorAbove : "#059669";
    const colorBelow = typeof p.colorBelow === "string" && /^#[0-9A-Fa-f]{6}$/.test(p.colorBelow) ? p.colorBelow : "#dc2626";
    return { enabled: p.enabled === true, buckets, percent, opacity, widthPercent, side, colorAbove, colorBelow };
  } catch {
    return { enabled: false, buckets: VOLUME_AT_PRICE_BUCKETS_MIN, percent: VOLUME_AT_PRICE_PERCENT_DEFAULT, opacity: 40, widthPercent: 100, side: "left", colorAbove: "#059669", colorBelow: "#dc2626" };
  }
}

/**
 * Converte OHLC para Heikin Ashi. klines[0] = mais recente.
 * Retorna novas linhas com [1]=HA_Open, [2]=HA_High, [3]=HA_Low, [4]=HA_Close (resto igual).
 */
function computeHeikinAshi(klines: Kline[]): Kline[] {
  if (klines.length === 0) return [];
  const chrono = [...klines].reverse() as (string | number)[][];
  const out: (string | number)[][] = [];
  let prevHaOpen = 0;
  let prevHaClose = 0;
  for (let i = 0; i < chrono.length; i++) {
    const row = [...chrono[i]] as (string | number)[];
    const o = Number(row[1]);
    const h = Number(row[2]);
    const l = Number(row[3]);
    const c = Number(row[4]);
    const haClose = (o + h + l + c) / 4;
    const haOpen = i === 0 ? (o + c) / 2 : (prevHaOpen + prevHaClose) / 2;
    const haHigh = Math.max(h, haOpen, haClose);
    const haLow = Math.min(l, haOpen, haClose);
    row[1] = String(haOpen);
    row[2] = String(haHigh);
    row[3] = String(haLow);
    row[4] = String(haClose);
    out.push(row);
    prevHaOpen = haOpen;
    prevHaClose = haClose;
  }
  return (out.reverse() as unknown) as Kline[];
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).replace(",", " ");
}

function formatNum(s: string): string {
  const n = parseFloat(s);
  if (n >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function formatInt(n: number): string {
  return n.toLocaleString("en-US");
}

function dayKeyUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default function KlinesTable({ isAdmin = false, isFreeUser = false }: { isAdmin?: boolean; isFreeUser?: boolean }) {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines;
  const tk = t as Record<string, string>;
  const {
    showKlinesTable,
    addLayoutLoadLog,
    aggFastLiveDebugEnabled,
    setAggFastLiveDebugSnapshot,
    spotOrderChartDebugEnabled,
    setSpotOrderChartDebugPayload,
  } = useSistemaDebug();
  const {
    data: headerData,
    setHeaderData,
    setIntervalPicker,
    setOpenLimitBuyPricesUsdt,
    setOpenLimitBuyOrdersUsdt,
    setOpenLimitSellPricesUsdt,
    setOpenLimitSellOrdersUsdt,
  } = useChartHeader();
  /** Evita loop infinito no efeito que faz `setHeaderData({ ...headerData })` — não pode depender de `headerData`. */
  const headerDataRef = useRef(headerData);
  headerDataRef.current = headerData;
  const { symbol, openSymbolPanel } = useChartSymbol();
  const { userIndicators, setCurrentGroupMinutes, replaceUserIndicatorsFromLayout } = useKlinesIndicators();
  const { userRegressions, replaceUserRegressionsFromLayout } = useKlinesRegressions();
  const {
    strategies,
    appliedStrategyIds,
    replaceStrategiesFromLayout,
    replaceAppliedStrategyIdsFromLayout,
    replaceAppliedStrategyIds,
  } = useStrategies();
  const intervalOptions = useMemo(() => getIntervalOptions(), []);
  const aggIntervalPicker = useMemo(() => {
    const tickSection = (kindIdx: 0 | 1 | 2 | 3, ck: "renko" | "range" | "kagi" | "renko2x") =>
      RENKO_CACHE_TICK_INTERVALS.map((ticks, i) => ({
        value: GROUP_MINUTES_CACHE2_BASE + kindIdx * CACHE2_TICK_KIND_STRIDE + i,
        label: formatCache2IntervalShortLabel(ck, `${ticks}ticks`),
      }));
    return {
      renko: tickSection(0, "renko"),
      range: tickSection(1, "range"),
      kagi: tickSection(2, "kagi"),
      renko2x: tickSection(3, "renko2x"),
      trades500: TRADE_CACHE_TRADE_INTERVALS.map((tr, i) => ({
        value: GROUP_MINUTES_CACHE2_TRADES_BASE + i,
        label: formatCache2IntervalShortLabel("trades500", `${tr}trades`),
      })),
    };
  }, []);
  const [groupMinutes, setGroupMinutes] = useState(DEFAULT_GROUP_MINUTES_FIRST_LOAD);
  /** Incrementa ao aplicar layout (carregar da API) para forçar gráfico a receber strategyCandleOverlays. */
  const [layoutAppliedTick, setLayoutAppliedTick] = useState(0);
  /** Só true após restaurar do localStorage no cliente; evita fetch com 1M antes de aplicar o timeframe salvo. */
  const [timeframeRestored, setTimeframeRestored] = useState(false);
  const activeLayoutIsDefault = useSyncExternalStore(subscribeKlinesLayoutDefault, snapshotKlinesLayoutIsDefault, () => true);

  useLayoutEffect(() => {
    const stored = getStoredGroupMinutes();
    setGroupMinutes(stored);
    setTimeframeRestored(true);
  }, []);

  useEffect(() => {
    if (!activeLayoutIsDefault) return;
    if (!isIntervalForbiddenOnDefaultLayout(groupMinutes)) return;
    setGroupMinutes(DEFAULT_GROUP_MINUTES_FIRST_LOAD);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(KLINE_GROUP_MINUTES_KEY, String(DEFAULT_GROUP_MINUTES_FIRST_LOAD));
      }
    } catch {
      /* ignore */
    }
  }, [activeLayoutIsDefault, groupMinutes]);
  const [klines, setKlines] = useState<Kline[]>([]);
  /** Par a que `klines` correspondem (só após GET aplicar); evita Renko/WS usar velas do par anterior ao trocar moeda. */
  const [klinesDataSymbol, setKlinesDataSymbol] = useState<string | null>(null);
  const [vapCacheKlines, setVapCacheKlines] = useState<Kline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  /** Ordens spot (GET /orders) — dados da API; etiquetas no gráfico são só visualização (`showSpotOrderLabels` / séries). */
  const [chartSpotOrdersFromApi, setChartSpotOrdersFromApi] = useState<ChartSpotOrderApiRow[]>([]);
  /** Último resultado do GET /orders (para painel de debug). */
  const [chartOrdersFetchDebug, setChartOrdersFetchDebug] = useState<{
    at: string;
    httpStatus: number | null;
    ok: boolean;
    orderCount: number;
    error?: string;
    skipped?: string;
  } | null>(null);
  /** Aborta GET /orders em voo ao trocar símbolo/série — evita resposta tardia sobrescrever estado `skipped` (ex.: Renko). */
  const chartSpotOrdersFetchAbortRef = useRef<AbortController | null>(null);
  /** Fuso do utilizador (API aplica a openTime/closeTime); usado para contar fechamento do candle em UTC. */
  const [timezoneOffset, setTimezoneOffset] = useState(0);
  const timezoneOffsetRef = useRef(0);
  timezoneOffsetRef.current = timezoneOffset;
  /** Cache GET agg-fast (Renko/Range/Kagi); barras ao vivo fundem-se em memória sem POST. */
  const serverAggKlinesRef = useRef<Kline[]>([]);
  /** Para refetch ao cache só ao cruzar o limite de barras (modo atemporal). */
  const prevAggKlineCountForLimitRef = useRef<number | null>(null);
  /** Teto de barras atemporais (AppConfig `AGG_ATEMPORAL_KLINE_CACHE_LIMIT` via resposta `maxBars` do GET kline-cache2-bars). */
  const aggAtemporalKlineCacheLimitRef = useRef(FALLBACK_AGG_KLINE_CACHE_LIMIT);
  /** Topo do último GET kline-cache2 (só servidor); âncora de fecho/open para o aggTrade ao vivo. */
  const [serverNewestKlineFromCache, setServerNewestKlineFromCache] = useState<(string | number)[] | null>(null);
  /** Chave = conteúdo OHLC+vol (sem tempos) — mesmo tijolo com openTime/closeTime diferentes não duplica. */
  const liveAggRowsByOpenTimeRef = useRef<Map<string, AggFastBarRowPayload>>(new Map());
  const LIVE_AGG_ROWS_MAX = 2500;
  /** Ring de aggTrade (WS) para debug — ≠ tijolos fechados. */
  const liveWsRawTradesRef = useRef<AggFastLiveWsTradeRow[]>([]);
  const MAX_DEBUG_WS_TRADES = 120;
  /** Uma entrada por tijolo fechado emitido pelo step* (append-only); o debug não usa só Map.values — evita confundir com stream em tempo real. */
  const liveDebugClosedBricksRef = useRef<{ seq: number; row: AggFastBarRowPayload }[]>([]);
  const liveDebugBrickSeqRef = useRef(0);
  const LIVE_DEBUG_BRICKS_MAX = 2500;
  const pendingAggPersistRef = useRef<AggFastBarRowPayload[]>([]);
  /** Incrementado ao ligar/desligar Binance na Conta para voltar a pedir ordens abertas à API (não só no intervalo de 25s). */
  const [openOrdersRefreshKey, setOpenOrdersRefreshKey] = useState(0);
  /** GET daily-close-tick: 0,01% do último fecho diário completo (não do tijolo anterior). */
  const [aggPriceTick, setAggPriceTick] = useState<number | null>(null);
  const [aggPriceTickDiag, setAggPriceTickDiag] = useState<AggFastLivePriceTickDiagnostics | null>(null);
  /** Incrementado após refresh periódico do cache agg — força reconexão do WebSocket aggTrade em `useAggFastTradeLive`. */
  const [aggPeriodicWsReconnectKey, setAggPeriodicWsReconnectKey] = useState(0);
  /** Momento (Date.now) do último GET kline-cache2 do intervalo de 5 min que terminou com sucesso (debug agg live). */
  const [lastAggPeriodicCacheRefreshOkAt, setLastAggPeriodicCacheRefreshOkAt] = useState<number | null>(null);
  const [spot, setSpot] = useState<{ currentClose: string | null; prevDayClose: string | null }>({ currentClose: null, prevDayClose: null });
  const [spotWsPrice, setSpotWsPrice] = useState<string | null>(null);
  /** Refs para sync LIMIT (estado ainda aberto na BD) ↔ Binance a cada 5s — não filtrar por “preço já cruzou”: senão vendas acima do mercado nunca iniciavam o intervalo até depois do fill. */
  const limitSpotSyncOrdersRef = useRef<ChartSpotOrderApiRow[]>([]);
  limitSpotSyncOrdersRef.current = chartSpotOrdersFromApi;
  /** Último feed vivo: miniTicker e/ou aggTrade atemporal — para “Última atualização” / bolinha não depender só do openTime da última barra em cache. */
  const [spotWsUpdatedAt, setSpotWsUpdatedAt] = useState<number | null>(null);
  /** Vela em formação: volume base / quote (USDT) / nº trades atualizados pelo stream `@kline_<interval>` (Binance). */
  const [liveCandleVolumes, setLiveCandleVolumes] = useState<{
    openTime: number;
    baseVol: string;
    quoteVol: string;
    trades: number;
  } | null>(null);
  /** Renko/Range/Kagi/…: volume acumulado na barra em formação (aggTrade → TradeAcc), para volume no preço no gráfico atemporal. */
  const [aggFormingAccVolumes, setAggFormingAccVolumes] = useState<{
    baseVol: string;
    quoteVol: string;
    trades: number;
  } | null>(null);
  const [priceFormatDecimals, setPriceFormatDecimals] = useState<number | null>(null);
  const [priceFormatAbbreviated, setPriceFormatAbbreviated] = useState(false);
  const [spotWsHigh, setSpotWsHigh] = useState<number | null>(null);
  const [spotWsLow, setSpotWsLow] = useState<number | null>(null);
  const lastSpotPersistAtRef = useRef(0);
  const symbolRef = useRef(symbol);
  const groupMinutesRef = useRef(groupMinutes);
  groupMinutesRef.current = groupMinutes;
  const aggFastLiveDebugEnabledRef = useRef(aggFastLiveDebugEnabled);
  aggFastLiveDebugEnabledRef.current = aggFastLiveDebugEnabled;
  const lastKlinesFetchSymbolRef = useRef<string | null>(null);
  const fetchKlinesRef = useRef<(force?: boolean) => Promise<boolean>>(async () => false);
  /** Quando o GET periódico kline-cache2 não trouxe linha nova, não incrementar `aggPeriodicWsReconnectKey` (evita WS agg a repor refs e zerar live). */
  const skipAggPeriodicWsReconnectRef = useRef(false);
  /** `document.visibilityState === hidden` em gráfico atemporal — para refetch ao voltar (timers em segundo plano atrasam). */
  const aggAtemporalTabHiddenAtRef = useRef<number | null>(null);
  symbolRef.current = symbol;

  const pushAggFastLiveDebug = useCallback(() => {
    if (!aggFastLiveDebugEnabledRef.current) return;
    const gm = normalizeAggGroupMinutes(groupMinutesRef.current);
    if (!isAggFastGroupMinutes(gm)) {
      setAggFastLiveDebugSnapshot(null);
      return;
    }
    const c2 = groupMinutesToCache2Params(gm);
    if (c2 == null) {
      setAggFastLiveDebugSnapshot(null);
      return;
    }
    const tierShort = formatCache2IntervalShortLabel(c2.chartKind, c2.interval);
    setAggFastLiveDebugSnapshot(
      buildAggFastLiveDebugSnapshot(
        liveDebugClosedBricksRef.current.map((e) => e.row),
        liveWsRawTradesRef.current,
        c2,
        symbolRef.current,
        tierShort,
        aggPriceTick,
        aggPriceTickDiag,
        lastAggPeriodicCacheRefreshOkAt
      )
    );
  }, [setAggFastLiveDebugSnapshot, aggPriceTick, aggPriceTickDiag, lastAggPeriodicCacheRefreshOkAt]);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(600);
  const [chartContainerHeight, setChartContainerHeight] = useState(0);
  const [chartRequestedWidth, setChartRequestedWidth] = useState<number | null>(null);
  const [chartReportedSizePercent, setChartReportedSizePercent] = useState(100);
  const [currentLayoutLabel, setCurrentLayoutLabel] = useState<string | null>(null);
  const [heikinAshiEnabled, setHeikinAshiEnabled] = useState(false);
  const aggSeriesKind = useMemo(() => groupMinutesToAggKind(groupMinutes) ?? "ohlc", [groupMinutes]);
  const showSpotOrderLabels = useSyncExternalStore(
    subscribeSpotOrderLabelsVisible,
    getSpotOrderLabelsVisibleFromStorage,
    () => true
  );
  useLayoutEffect(() => {
    setHeikinAshiEnabled(getStoredHeikinAshi());
  }, []);

  useEffect(() => {
    if (isAggFastGroupMinutes(groupMinutes) && heikinAshiEnabled) {
      setHeikinAshiEnabled(false);
      try {
        if (typeof window !== "undefined") window.localStorage.setItem(KLINE_HEIKIN_ASHI_KEY, "0");
      } catch {
        /* ignore */
      }
    }
  }, [groupMinutes, heikinAshiEnabled]);

  const [volumeAtPriceEnabled, setVolumeAtPriceEnabled] = useState(false);
  const [volumeAtPriceBuckets, setVolumeAtPriceBuckets] = useState(20);
  const [volumeAtPricePercent, setVolumeAtPricePercent] = useState(VOLUME_AT_PRICE_PERCENT_DEFAULT);
  const [volumeAtPriceOpacity, setVolumeAtPriceOpacity] = useState(40);
  const [volumeAtPriceSide, setVolumeAtPriceSide] = useState<"left" | "right">("left");
  const [volumeAtPriceColorAbove, setVolumeAtPriceColorAbove] = useState("#059669");
  const [volumeAtPriceColorBelow, setVolumeAtPriceColorBelow] = useState("#dc2626");
  const [volumeAtPriceWidthPercent, setVolumeAtPriceWidthPercent] = useState(100);

  useEffect(() => {
    if (isAggFastGroupMinutes(groupMinutes) && volumeAtPriceEnabled) {
      setVolumeAtPriceEnabled(false);
    }
  }, [groupMinutes, volumeAtPriceEnabled]);
  useLayoutEffect(() => {
    const stored = getStoredVolumeAtPrice();
    setVolumeAtPriceEnabled(stored.enabled);
    setVolumeAtPriceBuckets(stored.buckets);
    setVolumeAtPricePercent(stored.percent);
    setVolumeAtPriceOpacity(stored.opacity);
    setVolumeAtPriceWidthPercent(stored.widthPercent);
    setVolumeAtPriceSide(stored.side);
    setVolumeAtPriceColorAbove(stored.colorAbove);
    setVolumeAtPriceColorBelow(stored.colorBelow);
  }, []);

  const spotExtremesStorageKey = useMemo(() => {
    const first = klines?.[0] as unknown as (string | number)[] | undefined;
    const openTime = first?.[0] != null ? String(first[0]) : "none";
    return `backcrypto:spot_extremes:${symbol}:${groupMinutes}:${openTime}`;
  }, [klines, symbol, groupMinutes]);

  const SPOT_EXTREMES_PREFIX = "backcrypto:spot_extremes:";
  const SPOT_EXTREMES_CLEANUP_DAY_KEY = "backcrypto:spot_extremes_last_cleanup";

  // Limpa chaves antigas de spot_extremes só quando muda o dia (yyyy-mm-dd), para não ser pesado a cada candle
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const currentKey = spotExtremesStorageKey;
      const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
      const lastCleanupDay = window.localStorage.getItem(SPOT_EXTREMES_CLEANUP_DAY_KEY);
      if (lastCleanupDay !== today) {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key != null && key.startsWith(SPOT_EXTREMES_PREFIX)) {
            window.localStorage.removeItem(key);
          }
        }
        window.localStorage.setItem(SPOT_EXTREMES_CLEANUP_DAY_KEY, today);
      }

      const raw = window.localStorage.getItem(currentKey);
      if (!raw) {
        setSpotWsHigh(null);
        setSpotWsLow(null);
        return;
      }
      if (lastKlinesFetchSymbolRef.current !== symbol) return;
      const parsed = JSON.parse(raw) as { high?: number; low?: number } | null;
      const high = parsed && typeof parsed.high === "number" && Number.isFinite(parsed.high) ? parsed.high : null;
      const low = parsed && typeof parsed.low === "number" && Number.isFinite(parsed.low) ? parsed.low : null;
      setSpotWsHigh(high);
      setSpotWsLow(low);
    } catch {
      setSpotWsHigh(null);
      setSpotWsLow(null);
    }
  }, [spotExtremesStorageKey, symbol]);

  // Atualiza extremos com base no spot (enquanto o socket estiver mandando preços)
  useEffect(() => {
    if (spotWsPrice == null) return;
    const p = Number(spotWsPrice);
    if (!Number.isFinite(p)) return;
    setSpotWsHigh((prev) => (prev == null ? p : Math.max(prev, p)));
    setSpotWsLow((prev) => (prev == null ? p : Math.min(prev, p)));
  }, [spotWsPrice]);

  // Persiste extremos no localStorage (throttle simples para não gravar demais). Só grava se os klines forem do símbolo atual (evita gravar ETH em chave de BTC).
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (lastKlinesFetchSymbolRef.current !== symbol) return;
      if (spotWsHigh == null && spotWsLow == null) return;
      const now = Date.now();
      if (now - lastSpotPersistAtRef.current < 1000) return; // no máx. 1x/seg
      lastSpotPersistAtRef.current = now;
      window.localStorage.setItem(
        spotExtremesStorageKey,
        JSON.stringify({ high: spotWsHigh, low: spotWsLow })
      );
    } catch {
      // ignore
    }
  }, [spotWsHigh, spotWsLow, spotExtremesStorageKey, symbol]);

  // A cada fetch (ex.: a cada 1 min), sobrescreve máx/mín no localStorage com os dados reais da API para o candle atual (klines[0]) e, no 1m, para o candle fechado (klines[1]). Recupera valores corretos e evita manter máx/mín de outro símbolo.
  useEffect(() => {
    try {
      if (typeof window === "undefined" || klines.length === 0) return;
      if (lastKlinesFetchSymbolRef.current !== symbol) return;
      const first = klines[0] as (string | number)[];
      const openTime0 = first[0];
      const high0 = Number(first[2]);
      const low0 = Number(first[3]);
      if (openTime0 != null && Number.isFinite(high0) && Number.isFinite(low0)) {
        const key0 = `backcrypto:spot_extremes:${symbol}:${groupMinutes}:${openTime0}`;
        window.localStorage.setItem(key0, JSON.stringify({ high: high0, low: low0 }));
      }
      if (groupMinutes === 1 && klines.length >= 2) {
        const closed = klines[1] as (string | number)[];
        const openTime1 = closed[0];
        const high1 = Number(closed[2]);
        const low1 = Number(closed[3]);
        if (openTime1 != null && Number.isFinite(high1) && Number.isFinite(low1)) {
          const key1 = `backcrypto:spot_extremes:${symbol}:1:${openTime1}`;
          window.localStorage.setItem(key1, JSON.stringify({ high: high1, low: low1 }));
        }
      }
    } catch {
      // ignore
    }
  }, [groupMinutes, symbol, klines]);

  const klinesWithSpot = useMemo((): Kline[] => {
    // Renko / Range / Kagi: não substituir OHLC pelo spot — evita distorcer o que veio do modelo (brick/amplitude). No mercado real podem existir gaps; aqui só preservamos a série agregada tal como calculada.
    if (aggSeriesKind !== "ohlc") return klines;
    if (klines.length === 0) return klines;
    const first = klines[0] as (string | number)[];
    const ot = Number(first[0]);
    const hasLiveVol =
      liveCandleVolumes != null && Number.isFinite(ot) && liveCandleVolumes.openTime === ot;
    if (spotWsPrice == null && !hasLiveVol) return klines;

    const out = [...klines] as unknown as (string | number)[][];
    const next0 = [...first] as (string | number)[];
    if (hasLiveVol) {
      next0[5] = liveCandleVolumes.baseVol;
      next0[7] = liveCandleVolumes.quoteVol;
      next0[8] = liveCandleVolumes.trades;
    }
    if (spotWsPrice != null) {
      const p = Number(spotWsPrice);
      if (Number.isFinite(p)) {
        // OHLC: [1]=open [2]=high [3]=low [4]=close. Só usa spotWsHigh/spotWsLow se os klines forem do símbolo atual (evita mínima do ETH no candle de BTC).
        const baseHigh = Number(next0[2]);
        const baseLow = Number(next0[3]);
        next0[4] = spotWsPrice;
        const useWsExtremes = lastKlinesFetchSymbolRef.current === symbol;
        const hi = useWsExtremes && spotWsHigh != null ? spotWsHigh : (Number.isFinite(baseHigh) ? Math.max(baseHigh, p) : p);
        const lo = useWsExtremes && spotWsLow != null ? spotWsLow : (Number.isFinite(baseLow) ? Math.min(baseLow, p) : p);
        next0[2] = String(hi);
        next0[3] = String(lo);
      }
    }
    out[0] = next0;
    return out as unknown as Kline[];
  }, [klines, spotWsPrice, spotWsHigh, spotWsLow, symbol, aggSeriesKind, liveCandleVolumes]);

  /**
   * Renko/Range/Kagi/Renko2×/trades: mesma linha “em formação” do gráfico (open = close do tijolo mais recente do modelo,
   * close = spot; high/low só entre open e preço — sem spotWsHigh/Low). Antecede `klines` para tabela, indicadores e
   * estratégias alinharem com o candle ao vivo. OHLC continua só em `klinesWithSpot`.
   */
  const klinesWithAggForming = useMemo((): Kline[] => {
    if (aggSeriesKind === "ohlc") return klinesWithSpot;
    if (spotWsPrice == null || klines.length === 0) return klines;
    if (!isAggFastGroupMinutes(groupMinutes)) return klines;
    if (lastKlinesFetchSymbolRef.current !== symbol) return klines;
    const p = Number(spotWsPrice);
    if (!Number.isFinite(p)) return klines;
    const newest = klines[0] as (string | number | null)[];
    const baseOt = Number(newest[0]);
    const anchorClose = Number(newest[4]);
    if (!Number.isFinite(baseOt) || !Number.isFinite(anchorClose)) return klines;
    const o = anchorClose;
    const hi = Math.max(o, p);
    const lo = Math.min(o, p);
    const displayOt = baseOt + 1;
    const forming = [...newest] as (string | number | null)[];
    for (let i = 12; i < forming.length; i++) forming[i] = null;
    forming[0] = displayOt;
    forming[1] = String(o);
    forming[2] = String(hi);
    forming[3] = String(lo);
    forming[4] = spotWsPrice;
    forming[5] = aggFormingAccVolumes != null ? aggFormingAccVolumes.baseVol : "0";
    forming[6] = displayOt;
    forming[7] = aggFormingAccVolumes != null ? aggFormingAccVolumes.quoteVol : "0";
    forming[8] = aggFormingAccVolumes != null ? aggFormingAccVolumes.trades : 0;
    forming[9] = "0";
    forming[10] = "0";
    forming[11] = 0;
    return [forming as Kline, ...klines];
  }, [aggSeriesKind, klinesWithSpot, klines, spotWsPrice, groupMinutes, symbol, aggFormingAccVolumes]);

  const heikinAshiKlines = useMemo(() => computeHeikinAshi(klinesWithSpot), [klinesWithSpot]);
  const baseForIndicators = heikinAshiEnabled && aggSeriesKind === "ohlc" ? heikinAshiKlines : klinesWithAggForming;

  const visibleUserIndicators = useMemo(
    () =>
      userIndicators.filter((ind) => {
        if (ind.intervals.length === 0) return true;
        if (ind.intervals.length === 1 && ind.intervals[0] === 0) return false;
        return ind.intervals.includes(groupMinutes);
      }),
    [userIndicators, groupMinutes]
  );

  const extendedKlines = useMemo((): Kline[] => {
    const base = baseForIndicators as (string | number)[][];
    if (base.length === 0 || userIndicators.length === 0) return baseForIndicators;
    let totalExtra = 0;
    for (const ind of userIndicators) totalExtra += indicatorColumnSpan(ind);
    const out = base.map((row) =>
      [...row, ...Array(totalExtra).fill(null)] as (string | number | null)[]
    );
    /** Indicadores só leem colunas 0–11 (OHLC etc.); fazer cast para satisfazer a API. */
    const data = out as (string | number)[][];
    const writeBlock = (colStart: number, cols: (number | null)[][]) => {
      const n = out.length;
      for (let k = 0; k < cols.length; k++) {
        const series = cols[k]!;
        for (let i = 0; i < n; i++) out[i]![colStart + k] = series[i] ?? null;
      }
    };
    const order = topologicalUserIndicatorOrder(userIndicators);
    for (const u of order) {
      const ind = userIndicators[u];
      if (ind.type === "Volume") continue;
      const colStart = indicatorColumnStart(userIndicators, u);
      const { data: dataForInd, valueIndex } = getDataAndValueIndexForIndicator(data, ind.fieldKey, userIndicators);
      const ma2ChartMinutes = chartMinutesForTimeWindowMa2(groupMinutes);
      const ma2Unit =
        ind.wma2TimeUnit === "days" || ind.wma2TimeUnit === "hours" || ind.wma2TimeUnit === "minutes" ? ind.wma2TimeUnit : "hours";
      const period =
        isTimeWindowMa2Type(ind.type)
          ? wma2RequestedPeriodCandles(
              ma2ChartMinutes,
              ma2Unit,
              ind.wma2TimeValue ?? defaultMa2TimeValueForUnit(ma2Unit)
            )
          : Math.max(1, Math.min(500, ind.period));
      if (ind.type === "MACD") {
        const col = computeMacdColumn(
          dataForInd,
          valueIndex,
          normalizeMacdMaType(ind.macdFastMaType),
          ind.macdFastPeriod ?? 12,
          normalizeMacdMaType(ind.macdSlowMaType),
          ind.macdSlowPeriod ?? 26
        );
        writeBlock(colStart, [col]);
        if (ind.macdSignalLine) {
          const macdColIndex = colStart;
          const signalPeriod = Math.max(1, Math.min(500, ind.macdSignalPeriod ?? 9));
          const signalCol = computeMaColumn(
            out as (string | number | null)[][],
            macdColIndex,
            normalizeMacdMaType(ind.macdSignalMaType),
            signalPeriod
          );
          writeBlock(colStart + 1, [signalCol]);
          if (ind.macdHistogram) {
            const signalColIndex = colStart + 1;
            const hist: (number | null)[] = [];
            for (let i = 0; i < out.length; i++) {
              const macdVal = out[i][macdColIndex];
              const sigVal = out[i][signalColIndex];
              hist.push(
                macdVal != null && sigVal != null && Number.isFinite(Number(macdVal)) && Number.isFinite(Number(sigVal))
                  ? Number(macdVal) - Number(sigVal)
                  : null
              );
            }
            writeBlock(colStart + 2, [hist]);
          }
        }
      } else if (ind.type === "DIFF") {
        const first = getDataAndValueIndexForIndicator(data, ind.diffFirstFieldKey ?? "close", userIndicators);
        const second = getDataAndValueIndexForIndicator(data, ind.diffSecondFieldKey ?? ind.fieldKey ?? "close", userIndicators);
        const relPct = ind.diffRelativePercent === true;
        const diffCol: (number | null)[] = [];
        for (let i = 0; i < out.length; i++) {
          const a = first.data[i]?.[first.valueIndex];
          const b = second.data[i]?.[second.valueIndex];
          const av = a != null ? Number(a) : NaN;
          const bv = b != null ? Number(b) : NaN;
          if (!Number.isFinite(av) || !Number.isFinite(bv)) {
            diffCol.push(null);
            continue;
          }
          if (relPct) {
            diffCol.push(av !== 0 ? ((bv - av) / av) * 100 : null);
          } else {
            diffCol.push(bv - av);
          }
        }
        writeBlock(colStart, [diffCol]);
        if (ind.diffSignalLine) {
          const diffColIndex = colStart;
          const signalPeriod = Math.max(1, Math.min(500, ind.diffSignalPeriod ?? 9));
          const signalCol = computeMaColumn(
            out as (string | number | null)[][],
            diffColIndex,
            normalizeMacdMaType(ind.diffSignalMaType),
            signalPeriod
          );
          writeBlock(colStart + 1, [signalCol]);
          if (ind.diffHistogram) {
            const signalColIndex = colStart + 1;
            const hist: (number | null)[] = [];
            for (let i = 0; i < out.length; i++) {
              const diffVal = out[i][diffColIndex];
              const sigVal = out[i][signalColIndex];
              hist.push(
                diffVal != null && sigVal != null && Number.isFinite(Number(diffVal)) && Number.isFinite(Number(sigVal))
                  ? Number(diffVal) - Number(sigVal)
                  : null
              );
            }
            writeBlock(colStart + 2, [hist]);
          }
        }
      } else if (ind.type === "Stochastic") {
        const kCol = computeStochasticKColumn(dataForInd, period, valueIndex);
        writeBlock(colStart, [kCol]);
        if (ind.stochDLine) {
          const kColIndex = colStart;
          const dPeriod = Math.max(1, Math.min(500, ind.stochDPeriod ?? 3));
          const dCol =
            (ind.stochDMaType ?? "SMA") === "EMA"
              ? computeEmaColumn(out, kColIndex, dPeriod)
              : (ind.stochDMaType ?? "SMA") === "WMA"
                ? computeWmaColumn(out, kColIndex, dPeriod)
                : computeSmaColumn(out, kColIndex, dPeriod);
          writeBlock(colStart + 1, [dCol]);
        }
      } else if (ind.type === "WilliamsR") {
        const wrValueIndex = (valueIndex === 1 || valueIndex === 4) ? valueIndex : 4;
        const wrCol = computeWilliamsRColumn(dataForInd, period, wrValueIndex);
        writeBlock(colStart, [wrCol]);
      } else if (ind.type === "OBV") {
        const volIdx = ind.obvVolumeSource === "usdt" ? 7 : 5;
        const col = computeObvColumn(data, volIdx);
        writeBlock(colStart, [col]);
      } else if (ind.type === "AD") {
        const volIdx = ind.adVolumeSource === "usdt" ? 7 : 5;
        const col = computeAdColumn(data, volIdx);
        writeBlock(colStart, [col]);
      } else if (ind.type === "SAR") {
        const start = typeof ind.sarStart === "number" ? Math.max(0.001, Math.min(1, ind.sarStart)) : 0.02;
        const inc = typeof ind.sarIncrement === "number" ? Math.max(0.001, Math.min(1, ind.sarIncrement)) : 0.02;
        const max = typeof ind.sarMax === "number" ? Math.max(0.02, Math.min(1, ind.sarMax)) : 0.2;
        const col = computeParabolicSarColumn(data, start, inc, max);
        writeBlock(colStart, [col]);
      } else if (ind.type === "ATR") {
        const col = computeAtrColumn(data, period);
        writeBlock(colStart, [col]);
      } else if (ind.type === "VWAP") {
        const col = computeVwapColumn(data);
        writeBlock(colStart, [col]);
      } else if (ind.type === "Bollinger") {
        const z = typeof ind.bollingerZ === "number" ? Math.max(0, Math.min(3, ind.bollingerZ)) : 2;
        const { upper, middle, lower } = computeBollingerBands(dataForInd, valueIndex, period, ind.bollingerMaType ?? "SMA", z);
        writeBlock(colStart, [upper, middle, lower]);
      } else if (ind.type === "Keltner") {
        const mult = typeof ind.keltnerMultiplier === "number" ? Math.max(0, Math.min(10, ind.keltnerMultiplier)) : 2;
        const { upper, middle, lower } = computeKeltnerChannels(data, valueIndex, period, ind.keltnerMaType ?? "EMA", mult);
        writeBlock(colStart, [upper, middle, lower]);
      } else if (ind.type === "Donchian") {
        const { upper, middle, lower } = computeDonchianChannels(dataForInd, period);
        writeBlock(colStart, [upper, middle, lower]);
      } else if (ind.type === "Ichimoku") {
        const tenkanP = typeof ind.ichimokuTenkanPeriod === "number" ? Math.max(1, Math.min(500, ind.ichimokuTenkanPeriod)) : 9;
        const kijunP = typeof ind.ichimokuKijunPeriod === "number" ? Math.max(1, Math.min(500, ind.ichimokuKijunPeriod)) : 26;
        const spanBP = typeof ind.ichimokuSpanBPeriod === "number" ? Math.max(1, Math.min(500, ind.ichimokuSpanBPeriod)) : 52;
        const disp = typeof ind.ichimokuDisplacement === "number" ? Math.max(0, Math.min(500, ind.ichimokuDisplacement)) : 26;
        const { tenkan, kijun, spanBRaw, chikou } = computeIchimokuColumns(data, tenkanP, kijunP, spanBP, disp);
        const spanA: (number | null)[] = [];
        for (let i = 0; i < out.length; i++) {
          const t = tenkan[i];
          const k = kijun[i];
          spanA.push(t != null && k != null ? (t + k) / 2 : null);
        }
        writeBlock(colStart, [tenkan, kijun, spanA, spanBRaw, chikou]);
      } else if (ind.type === "ADX") {
        const { plusDi, minusDi, adx } = computeAdxColumns(data, period);
        writeBlock(colStart, [plusDi, minusDi, adx]);
      } else if (ind.type === "MA_ANGLE") {
        const mt = normalizeMaAngleMaType(ind.maAngleMaType);
        const maCol =
          mt === "SMA"
            ? computeSmaColumn(dataForInd, valueIndex, period)
            : mt === "EMA"
              ? computeEmaColumn(dataForInd, valueIndex, period)
              : mt === "WMA"
                ? computeWmaColumn(dataForInd, valueIndex, period)
                : mt === "HMA"
                  ? computeHmaColumn(dataForInd, valueIndex, period)
                  : computeVwmaColumn(dataForInd, valueIndex, period);
        const lb = Math.max(1, Math.min(50, ind.maAngleLookback ?? 3));
        const atrCol = computeAtrColumn(dataForInd, period);
        const angleCol = computeMaAngleColumn(maCol, lb, atrCol);
        writeBlock(colStart, [angleCol]);
      } else if (ind.type === "CCI") {
        const col = computeCciColumn(dataForInd, valueIndex, period);
        writeBlock(colStart, [col]);
      } else if (ind.type === "CMF") {
        const col = computeCmfColumn(data, period);
        writeBlock(colStart, [col]);
      } else if (ind.type === "MFI") {
        const col = computeMfiColumn(data, period);
        writeBlock(colStart, [col]);
      } else {
        const twMa2 = isTimeWindowMa2Type(ind.type);
        const twSkip = twMa2 && wma2ShouldOmitSeriesOnChart(groupMinutes, data.length, period);
        const col = twSkip
          ? (new Array(out.length).fill(null) as (number | null)[])
          : ind.type === "SMA2"
            ? (() => {
                const c = computeSmaColumn(dataForInd, valueIndex, period);
                ma2NullIndicesBeyondFullWindow(c, data.length, period);
                return c;
              })()
            : ind.type === "EMA2"
              ? (() => {
                  const c = computeEmaColumn(dataForInd, valueIndex, period);
                  ma2NullIndicesBeyondFullWindow(c, data.length, period);
                  return c;
                })()
              : ind.type === "WMA2"
                ? (() => {
                    const c = computeWmaColumn(dataForInd, valueIndex, period);
                    ma2NullIndicesBeyondFullWindow(c, data.length, period);
                    return c;
                  })()
                : ind.type === "EMA"
                  ? computeEmaColumn(dataForInd, valueIndex, period)
                  : ind.type === "WMA"
                    ? computeWmaColumn(dataForInd, valueIndex, period)
                    : ind.type === "HMA"
                      ? computeHmaColumn(dataForInd, valueIndex, period)
                      : ind.type === "HMA_CUSTOM"
                        ? computeHmaCustomColumn(
                            dataForInd,
                            valueIndex,
                            ind.hmaCustomSmoothPeriod ?? 4,
                            ind.hmaCustomFastPeriod ?? 10,
                            ind.hmaCustomLongPeriod ?? period,
                            normalizeHmaCustomLegMaType(ind.hmaCustomFastMaType),
                            normalizeHmaCustomLegMaType(ind.hmaCustomLongMaType),
                            ind.hmaCustomSmoothMaType === "SMA" || ind.hmaCustomSmoothMaType === "EMA" || ind.hmaCustomSmoothMaType === "WMA"
                              ? ind.hmaCustomSmoothMaType
                              : "WMA"
                          )
                        : ind.type === "VWMA"
                        ? computeVwmaColumn(dataForInd, valueIndex, period)
                        : ind.type === "LINEAR_FIT"
                          ? computeLinearFitColumn(dataForInd, valueIndex, period)
                          : ind.type === "QUADRATIC_FIT"
                            ? computeQuadraticFitColumn(dataForInd, valueIndex, period)
                        : ind.type === "RSI"
                          ? computeRsiColumn(dataForInd, valueIndex, period)
                          : computeSmaColumn(dataForInd, valueIndex, period);
        writeBlock(colStart, [col]);
      }
    }
    return out as Kline[];
  }, [baseForIndicators, userIndicators, groupMinutes]);

  /** Índice da primeira coluna de cada indicador (alinhado ao pré-cálculo em `extendedKlines`). */
  const getIndicatorColumnStart = useCallback(
    (indicatorIndex: number) => indicatorColumnStart(userIndicators, indicatorIndex),
    [userIndicators]
  );

  /** Estratégias que se aplicam ao intervalo e símbolo atuais e que estão aplicadas (coluna na tabela). */
  const visibleStrategies = useMemo(
    () =>
      strategiesForContext(strategies, groupMinutes, symbol).filter((s) =>
        appliedStrategyIds.includes(s.id)
      ),
    [strategies, groupMinutes, symbol, appliedStrategyIds]
  );

  /** Ids de estratégias referenciadas por strat_<id> em estratégias combinadas aplicadas (precisam ser avaliadas antes). */
  const referencedByCombinedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of visibleStrategies.filter((s) => s.isCombined)) {
      for (const key of collectSeriesKeys(s.root)) {
        if (key.startsWith("strat_")) ids.add(key.slice(6));
      }
    }
    return ids;
  }, [visibleStrategies]);

  /** Ordem para avaliação: normais (aplicadas ou referenciadas por combinada) primeiro, depois combinadas, para strat_<id> ter resultado no map. */
  const visibleStrategiesEvaluationOrder = useMemo(() => {
    const context = strategiesForContext(strategies, groupMinutes, symbol);
    const appliedSet = new Set(appliedStrategyIds);
    const nonCombined = context.filter(
      (s) => !s.isCombined && (appliedSet.has(s.id) || referencedByCombinedIds.has(s.id))
    );
    const combined = context.filter((s) => s.isCombined && appliedSet.has(s.id));
    return [...nonCombined, ...combined];
  }, [strategies, groupMinutes, symbol, appliedStrategyIds, referencedByCombinedIds]);

  /** Por estratégia: array de boolean por índice de linha (linha 0 = mais recente). Ordem: normais primeiro, depois combinadas (strat_<id> usa resultados já calculados). */
  const strategyResults = useMemo(() => {
    const map = new Map<string, boolean[]>();
    if (extendedKlines.length === 0) return map;
    for (const strategy of visibleStrategiesEvaluationOrder) {
      const arr: boolean[] = [];
      for (let i = 0; i < extendedKlines.length; i++) {
        arr.push(evaluateNode(strategy.root, extendedKlines, i, userIndicators, getIndicatorColumnStart, map));
      }
      map.set(strategy.id, arr);
    }
    return map;
  }, [visibleStrategiesEvaluationOrder, extendedKlines, userIndicators, getIndicatorColumnStart, layoutAppliedTick]);

  const strategyResultsRef = useRef(strategyResults);
  strategyResultsRef.current = strategyResults;
  const appliedStrategyIdsRef = useRef(appliedStrategyIds);
  appliedStrategyIdsRef.current = appliedStrategyIds;

  /** Lista de aplicadas antes do backtest; reposta ao fechar o modal se tivermos auto-aplicado estratégias do robô. */
  const backtestRestoreAppliedRef = useRef<string[] | null>(null);
  const backtestDidAutoApplyStrategiesRef = useRef(false);
  const robotLiveBuyInFlightRef = useRef<Set<string>>(new Set());
  const robotLiveSellInFlightRef = useRef<Set<string>>(new Set());
  const robotLiveFlattenInFlightRef = useRef<Set<string>>(new Set());
  /** Zerar: após sinal, alerta até sair; chave `robotId::SYMBOL`. */
  const robotFlattenArmedRef = useRef<Record<string, true>>({});
  const robotBuyEdgesSinceFlatRef = useRef<Record<string, number>>({});
  const robotBuyAccumulationActiveRef = useRef<Record<string, true>>({});
  /** Por robô+par: último `openTime` visto durante acumulação (janela de velas). */
  const robotBuyAccumLastOtRef = useRef<Record<string, string>>({});
  /** Por robô+par: índice da vela atual dentro da janela de acumulação (1…buyAccumMaxCandles). */
  const robotBuyAccumCandleIndexRef = useRef<Record<string, number>>({});
  /** Por robô+par: USDT por operação na janela (1.ª compra define %/fixo do teto; próximas repetem até ao máximo). */
  const robotBuySequentialSliceUsdtRef = useRef<Record<string, number>>({});
  /** Por robô+par: teto USDT congelado no início da janela de acumulação (não recalcula por vela). */
  const robotBuyAccumFrozenMaxSpendUsdtRef = useRef<Record<string, number>>({});
  /** Por robô+par: `openTime` das velas já contadas como “sinal de compra” enquanto sem posição (uma contagem por vela). */
  const robotBuySignalCountedOpenTimesRef = useRef<Record<string, Set<string>>>({});
  /** Fim do último efeito: havia posição neste robô+par. */
  const robotBuyHadPositionEndRef = useRef<Record<string, boolean>>({});
  /** LIMIT de 1.ª compra pendente (sync até fill/timeout) por robô+par, quando `firstEntryLimitEnabled`. */
  const robotFirstEntryLimitPendingRef = useRef<
    Record<string, { orderId: string; openTime: string; startedCandleIndex: number }>
  >({});

  const robotLiveBuyAccumRefBag = useMemo(
    () => ({
      robotFlattenArmedRef,
      robotBuyEdgesSinceFlatRef,
      robotBuyAccumulationActiveRef,
      robotBuyAccumLastOtRef,
      robotBuyAccumCandleIndexRef,
      robotBuySequentialSliceUsdtRef,
      robotBuyAccumFrozenMaxSpendUsdtRef,
      robotBuySignalCountedOpenTimesRef,
      robotBuyHadPositionEndRef,
    }),
    []
  );

  useLayoutEffect(() => {
    applyRobotLiveBuyAccumSnapshot(robotLiveBuyAccumRefBag, loadRobotLiveBuyAccumSnapshot());
  }, [robotLiveBuyAccumRefBag]);

  const [savedRobots, setSavedRobots] = useState<SavedRobot[]>(() =>
    typeof window !== "undefined" ? loadSavedRobots() : []
  );
  const [buyExecMap, setBuyExecMap] = useState<RobotBuyExecMap>(() =>
    typeof window !== "undefined" ? loadRobotBuyExecMap() : {}
  );
  const buyExecMapRef = useRef(buyExecMap);
  buyExecMapRef.current = buyExecMap;
  useEffect(() => {
    const refreshRobots = () => setSavedRobots(loadSavedRobots());
    const refreshExec = () => setBuyExecMap(loadRobotBuyExecMap());
    const onStorage = (e: StorageEvent) => {
      if (e.key === ROBOTS_STORAGE_KEY || e.key === null) refreshRobots();
      if (e.key === ROBOT_BUY_EXEC_STORAGE_KEY || e.key === null) refreshExec();
      if (e.key === ROBOT_LIVE_BUY_ACCUM_STORAGE_KEY || e.key === null) {
        applyRobotLiveBuyAccumSnapshot(robotLiveBuyAccumRefBag, loadRobotLiveBuyAccumSnapshot());
      }
    };
    window.addEventListener(ROBOTS_CHANGED_EVENT, refreshRobots);
    window.addEventListener(ROBOT_BUY_EXEC_CHANGED_EVENT, refreshExec);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ROBOTS_CHANGED_EVENT, refreshRobots);
      window.removeEventListener(ROBOT_BUY_EXEC_CHANGED_EVENT, refreshExec);
      window.removeEventListener("storage", onStorage);
    };
  }, [robotLiveBuyAccumRefBag]);

  const [backtestModal, setBacktestModal] = useState<{
    robot: SavedRobot;
    result: Extract<ReturnType<typeof runRobotBacktest>, { ok: true }>;
  } | null>(null);

  const closeBacktestModal = useCallback(() => {
    if (backtestDidAutoApplyStrategiesRef.current && backtestRestoreAppliedRef.current != null) {
      flushSync(() => {
        replaceAppliedStrategyIds(backtestRestoreAppliedRef.current!);
      });
    }
    backtestDidAutoApplyStrategiesRef.current = false;
    backtestRestoreAppliedRef.current = null;
    setBacktestModal(null);
  }, [replaceAppliedStrategyIds]);

  const runBacktestForRobot = useCallback(
    async (robotId: string) => {
      const robot = savedRobots.find((r) => r.id === robotId);
      if (!robot) {
        window.dispatchEvent(
          new CustomEvent(CRYPTO_SISTEMA_BACKTEST_ERROR_EVENT, {
            detail: { message: tk.backtestErrNoRobot ?? "Robot not found." },
          })
        );
        return;
      }

      if (backtestDidAutoApplyStrategiesRef.current && backtestRestoreAppliedRef.current != null) {
        flushSync(() => {
          replaceAppliedStrategyIds(backtestRestoreAppliedRef.current!);
        });
        backtestDidAutoApplyStrategiesRef.current = false;
        backtestRestoreAppliedRef.current = null;
      }
      setBacktestModal(null);

      const prevApplied = [...appliedStrategyIdsRef.current];
      backtestRestoreAppliedRef.current = prevApplied;

      const robotStrategyIds = [
        ...new Set([
          ...robot.buyCombinedStrategyIds,
          ...robot.sellCombinedStrategyIds,
          ...robot.flattenCombinedStrategyIds,
          ...(robot.postFlattenSignalSellCombinedStrategyIds ?? []),
        ]),
      ];
      const missingStrategyIds = robotStrategyIds.filter((id) => !prevApplied.includes(id));

      if (missingStrategyIds.length > 0) {
        backtestDidAutoApplyStrategiesRef.current = true;
        flushSync(() => {
          replaceAppliedStrategyIds([...prevApplied, ...missingStrategyIds]);
        });
      } else {
        backtestDidAutoApplyStrategiesRef.current = false;
      }

      const range = loadBacktestRange();
      const feeRatePerSide = await resolveBacktestFeeRatePerSide(range.feePercentPerSide);
      const resultsMap = strategyResultsRef.current;
      const out = runRobotBacktest({
        robot,
        klines: extendedKlines,
        strategyResults: resultsMap,
        startBar: range.startBar,
        endBar: range.endBar,
        spotUsdtForSimulation: range.spotUsdtFree,
        feeRatePerSide,
        slippagePercent: range.slippagePercent,
        executionMode: range.executionMode,
      });
      if (!out.ok) {
        if (backtestDidAutoApplyStrategiesRef.current && backtestRestoreAppliedRef.current != null) {
          flushSync(() => {
            replaceAppliedStrategyIds(backtestRestoreAppliedRef.current!);
          });
        }
        backtestDidAutoApplyStrategiesRef.current = false;
        backtestRestoreAppliedRef.current = null;
        const key = out.error;
        const msg =
          key === "backtestBuyerOnly"
            ? (tk.backtestErrBuyerOnly ?? "Backtest is only available for buyer robots.")
            : key === "backtestNoKlines"
              ? (tk.backtestErrNoKlines ?? "No candle data loaded.")
              : key === "backtestMissingStrategies"
                ? (tk.backtestErrMissingStrategies ??
                  "Apply all strategies used by this robot to the chart so columns are evaluated.")
                : out.error;
        window.dispatchEvent(new CustomEvent(CRYPTO_SISTEMA_BACKTEST_ERROR_EVENT, { detail: { message: msg } }));
        return;
      }
      setBacktestModal({ robot, result: out });
    },
    [savedRobots, extendedKlines, tk, replaceAppliedStrategyIds]
  );

  useEffect(() => {
    const fn = (e: Event) => {
      const id = (e as CustomEvent<{ robotId?: string }>).detail?.robotId;
      if (typeof id === "string" && id.length > 0) void runBacktestForRobot(id);
    };
    window.addEventListener(CRYPTO_SISTEMA_BACKTEST_RUN_EVENT, fn);
    return () => window.removeEventListener(CRYPTO_SISTEMA_BACKTEST_RUN_EVENT, fn);
  }, [runBacktestForRobot]);

  const activeBuyerRobots = useMemo(
    () => savedRobots.filter((r) => r.isActive && r.side === "buyer" && r.buyCombinedStrategyIds.length > 0),
    [savedRobots]
  );

  const scheduleRobotLiveToDb = useCallback(() => {
    schedulePersistRobotLiveSessionsToDb({
      refs: robotLiveBuyAccumRefBag,
      getBuyExecMap: () => buyExecMapRef.current,
      activeRobotIds: new Set(activeBuyerRobots.map((r) => r.id)),
      symbol: symbol?.trim().toUpperCase() ?? "",
    });
  }, [robotLiveBuyAccumRefBag, activeBuyerRobots, symbol]);

  useEffect(() => {
    const sym = symbol?.trim().toUpperCase();
    if (!sym || !sym.endsWith("USDT")) return;
    if (activeBuyerRobots.length === 0) return;
    const activeIds = new Set(activeBuyerRobots.map((r) => r.id));
    void fetchRobotLiveSessionsAndMerge({
      refs: robotLiveBuyAccumRefBag,
      setBuyExecMap,
      symbol,
      activeRobotIds: activeIds,
    });
  }, [symbol, activeBuyerRobots, robotLiveBuyAccumRefBag]);

  useEffect(() => {
    const fn = () => scheduleRobotLiveToDb();
    window.addEventListener(ROBOT_LIVE_SESSION_ACTIVITY_EVENT, fn);
    return () => window.removeEventListener(ROBOT_LIVE_SESSION_ACTIVITY_EVENT, fn);
  }, [scheduleRobotLiveToDb]);

  useEffect(() => {
    const fn = (e: Event) => {
      const id = (e as CustomEvent<{ robotId?: string }>).detail?.robotId;
      if (typeof id !== "string") return;
      const sym = symbol?.trim().toUpperCase() ?? "";
      if (!sym) return;
      clearRobotLiveRefsForRobotSymbol(robotLiveBuyAccumRefBag, id, sym);
      delete robotFirstEntryLimitPendingRef.current[`${id}::${sym}`];
      setBuyExecMap((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        persistRobotBuyExecMap(next);
        return next;
      });
      persistRobotLiveBuyAccum(robotLiveBuyAccumRefBag, scheduleRobotLiveToDb);
    };
    window.addEventListener(ROBOT_LIVE_SESSION_CLEAR_REFS_EVENT, fn);
    return () => window.removeEventListener(ROBOT_LIVE_SESSION_CLEAR_REFS_EVENT, fn);
  }, [symbol, robotLiveBuyAccumRefBag, scheduleRobotLiveToDb]);

  const robotBuyOrTrue = useCallback((robot: SavedRobot, rowIndex: number, results: Map<string, boolean[]>) => {
    for (const id of robot.buyCombinedStrategyIds) {
      if (results.get(id)?.[rowIndex]) return true;
    }
    return false;
  }, []);

  const robotSellOrTrue = useCallback((robot: SavedRobot, rowIndex: number, results: Map<string, boolean[]>) => {
    for (const id of robot.sellCombinedStrategyIds) {
      if (results.get(id)?.[rowIndex]) return true;
    }
    return false;
  }, []);

  const robotFlattenOrTrue = useCallback((robot: SavedRobot, rowIndex: number, results: Map<string, boolean[]>) => {
    const ids = robot.flattenCombinedStrategyIds ?? [];
    for (const id of ids) {
      if (results.get(id)?.[rowIndex]) return true;
    }
    return false;
  }, []);

  const robotPostFlattenSellOrTrue = useCallback(
    (robot: SavedRobot, rowIndex: number, results: Map<string, boolean[]>) => {
      const ids = robot.postFlattenSignalSellCombinedStrategyIds ?? [];
      for (const id of ids) {
        if (results.get(id)?.[rowIndex]) return true;
      }
      return false;
    },
    []
  );

  /**
   * Robô ativo: envia ordens MARKET direto à Binance (sem boleta/confirmação).
   * Zerar: primeiro sinal com posição arma alerta (mantém-se até zerar, mesmo que velas seguintes tenham sinal falso); fecho ≤ limiar breakeven (médio × (1+buffer%)) → venda FLATTEN a mercado. Sinais de estratégia avaliam a última vela fechada e a em formação ([1] e [0]); openTime da ordem prioriza o fecho. Venda por sinal normal e pós-alertas com alerta ligado (flatten primeiro no async). Depois compra.
   * Compra: N velas com sinal (sem posição) ligam acumulação; até `buyAccumMaxCandles` velas tenta no máximo 1 compra/vela; 1.ª: só preços válidos (entrada pelos sinais); seguintes: fecho estritamente abaixo da última compra. Para ao teto USDT ou fim da janela. A 1.ª operação define a fatia USDT; as seguintes repetem até ao máximo.
   * Coluna B· só marca 1 após compra aceite na API.
   */
  useEffect(() => {
    if (extendedKlines.length === 0 || activeBuyerRobots.length === 0) return;
    const sym = symbol?.trim().toUpperCase();
    if (!sym || !sym.endsWith("USDT")) return;
    const ot = String(extendedKlines[0][0]);
    const refClose = Number(extendedKlines[0]?.[4]);
    const refOpenRaw = Number(extendedKlines[0]?.[1]);
    const refPx = Number.isFinite(refClose) && refClose > 0 ? refClose : null;
    const refOpen = Number.isFinite(refOpenRaw) && refOpenRaw > 0 ? refOpenRaw : null;

    const armRef = robotFlattenArmedRef.current;
    const edgesRef = robotBuyEdgesSinceFlatRef.current;
    const accumRef = robotBuyAccumulationActiveRef.current;
    const countedOtRef = robotBuySignalCountedOpenTimesRef.current;
    const hadPosEndRef = robotBuyHadPositionEndRef.current;

    const syncBuyAccumForRobot = (robot: SavedRobot) => {
      const kArm = `${robot.id}::${sym}`;
      const posArm = getRobotPosition(robot.id, sym);
      const flat = !posArm || posArm.totalBaseQty <= 1e-12;
      const hadPosEndPrev = hadPosEndRef[kArm] === true;
      if (flat && hadPosEndPrev) {
        delete edgesRef[kArm];
        delete accumRef[kArm];
        delete countedOtRef[kArm];
        delete robotBuyAccumLastOtRef.current[kArm];
        delete robotBuyAccumCandleIndexRef.current[kArm];
        delete robotBuySequentialSliceUsdtRef.current[kArm];
        delete robotBuyAccumFrozenMaxSpendUsdtRef.current[kArm];
        delete robotFirstEntryLimitPendingRef.current[kArm];
      }
      const buySig = robotStrategyTrueOnAnyLiveRow(robot, extendedKlines, strategyResults, robotBuyOrTrue);
      if (flat) {
        let seen = countedOtRef[kArm];
        if (!seen) {
          seen = new Set<string>();
          countedOtRef[kArm] = seen;
        }
        const hasStartedCounting = (edgesRef[kArm] ?? 0) > 0;
        const shouldCountThisCandle = buySig || hasStartedCounting;
        if (shouldCountThisCandle && !seen.has(ot)) {
          seen.add(ot);
          const nextE = (edgesRef[kArm] ?? 0) + 1;
          edgesRef[kArm] = nextE;
          const nStart = Math.min(
            ROBOT_BUY_ACCUM_START_SIGNAL_MAX,
            Math.max(1, Math.floor(robot.buyAccumulationStartOnSignalNumber ?? 1))
          );
          const wasAccumBefore = accumRef[kArm] === true;
          if (nextE >= nStart) accumRef[kArm] = true;
          if (!wasAccumBefore && accumRef[kArm] === true) {
            appendRobotLiveActivityEvent(robot.id, sym, "accumulation_window_on", {
              signalsCounted: nextE,
              openTime: ot,
            });
          }
        }
      }
    };

    for (const robot of activeBuyerRobots) {
      const posArm = getRobotPosition(robot.id, sym);
      const kArm = `${robot.id}::${sym}`;
      const flattenIds = robot.flattenCombinedStrategyIds ?? [];
      if (!posArm || posArm.totalBaseQty <= 1e-12) {
        delete armRef[kArm];
      } else {
        const autoArmByPrice =
          robot.autoArmByPriceEnabled === true &&
          refPx != null &&
          buyerAlertArmMeetsMinEdge(robot, refPx, posArm.avgBuyPrice);
        const flattenHit =
          flattenIds.length > 0 &&
          refPx != null &&
          robotStrategyTrueOnAnyLiveRow(robot, extendedKlines, strategyResults, robotFlattenOrTrue) &&
          buyerAlertArmMeetsMinEdge(robot, refPx, posArm.avgBuyPrice);
        if (armRef[kArm] === true || autoArmByPrice || flattenHit) armRef[kArm] = true;
      }
      syncBuyAccumForRobot(robot);
    }

    for (const robot of activeBuyerRobots) {
      const kArm = `${robot.id}::${sym}`;
      if (accumRef[kArm] !== true) continue;
      const maxCandles = Math.min(
        ROBOT_BUY_ACCUM_MAX_CANDLES_MAX,
        Math.max(
          ROBOT_BUY_ACCUM_MAX_CANDLES_MIN,
          Math.floor(robot.buyAccumMaxCandles ?? ROBOT_BUY_ACCUM_MAX_CANDLES_DEFAULT)
        )
      );
      const lastOt = robotBuyAccumLastOtRef.current[kArm];
      if (lastOt === undefined) {
        robotBuyAccumLastOtRef.current[kArm] = ot;
        robotBuyAccumCandleIndexRef.current[kArm] = 1;
      } else if (lastOt !== ot) {
        const nextIdx = (robotBuyAccumCandleIndexRef.current[kArm] ?? 1) + 1;
        robotBuyAccumLastOtRef.current[kArm] = ot;
        robotBuyAccumCandleIndexRef.current[kArm] = nextIdx;
        if (nextIdx > maxCandles) {
          appendRobotLiveActivityEvent(robot.id, sym, "accumulation_window_end", {
            maxCandles,
            candleIndex: nextIdx,
            openTime: ot,
          });
          delete accumRef[kArm];
          delete robotBuyAccumLastOtRef.current[kArm];
          delete robotBuyAccumCandleIndexRef.current[kArm];
          delete robotBuySequentialSliceUsdtRef.current[kArm];
          delete robotBuyAccumFrozenMaxSpendUsdtRef.current[kArm];
          delete robotFirstEntryLimitPendingRef.current[kArm];
        }
      }
    }

    let shouldRun = false;
    for (const robot of activeBuyerRobots) {
      const hasPostSellStrats = (robot.postFlattenSignalSellCombinedStrategyIds ?? []).length > 0;
      const flattenArmed = armRef[`${robot.id}::${sym}`] === true;
      if (flattenArmed && refPx != null) {
        const pos = getRobotPosition(robot.id, sym);
        if (
          pos &&
          pos.totalBaseQty > 1e-12 &&
          pos.avgBuyPrice > 0 &&
          longFlattenCloseBreakeven(refPx, pos.avgBuyPrice, robot.flattenBreakevenBufferPercent ?? 0)
        ) {
          const k = `${robot.id}::${ot}::flat`;
          if (!robotLiveFlattenInFlightRef.current.has(k)) shouldRun = true;
        }
      }
      const posForPostSell = getRobotPosition(robot.id, sym);
      const postSellArmed = flattenArmed && posForPostSell != null && posForPostSell.totalBaseQty > 1e-12;
      const sellOtNormal = robotLivePickOpenTimeWhere(robot, extendedKlines, strategyResults, robotSellOrTrue);
      const sellOtPost =
        postSellArmed && hasPostSellStrats
          ? robotLivePickOpenTimeWhere(robot, extendedKlines, strategyResults, robotPostFlattenSellOrTrue)
          : null;
      const sellSignalOt = sellOtNormal ?? sellOtPost;
      if (sellSignalOt != null) {
        const pos = getRobotPosition(robot.id, sym);
        if (pos && pos.totalBaseQty > 1e-12) {
          if (refPx == null || !buyerSignalExitMeetsMinEdge(robot, refPx, pos.avgBuyPrice)) continue;
          const k = `${robot.id}::${sellSignalOt}::sell`;
          if (!robotLiveSellInFlightRef.current.has(k)) shouldRun = true;
        }
      }
      const kBuy = `${robot.id}::${sym}`;
      const acc = accumRef[kBuy] === true;
      if (acc && !hasRobotBuyExecForCandle(buyExecMapRef.current, robot.id, sym, ot)) {
        if (robotFirstEntryLimitPendingRef.current[kBuy] != null) {
          shouldRun = true;
          continue;
        }
        const posBuy = getRobotPosition(robot.id, sym);
        const buyKeyInflight = `${robot.id}::${ot}::buy`;
        const priceOk =
          refPx != null &&
          refOpen != null &&
          buyerAllowsAccumulationBuy(refPx, refOpen, posBuy?.lastBuyFillPrice);
        if (priceOk && !robotLiveBuyInFlightRef.current.has(buyKeyInflight)) {
          shouldRun = true;
        }
      }
    }

    for (const robot of activeBuyerRobots) {
      const p = getRobotPosition(robot.id, sym);
      hadPosEndRef[`${robot.id}::${sym}`] = Boolean(p && p.totalBaseQty > 1e-12);
    }

    persistRobotLiveBuyAccum(robotLiveBuyAccumRefBag, scheduleRobotLiveToDb);

    if (!shouldRun) return;

    let cancelled = false;
    void (async () => {
      const connRes = await fetch(`${API_BASE}/user/binance-connection`, { credentials: "include" });
      const connJson = (await connRes.json().catch(() => ({}))) as { connected?: boolean };
      if (cancelled || !connRes.ok || connJson.connected !== true) return;

      const balRes = await fetch(`${API_BASE}/user/binance-connection/balances`, { credentials: "include" });
      const balJson = (await balRes.json().catch(() => ({}))) as {
        balances?: { asset: string; free: string }[];
      };
      if (cancelled) return;
      let spotUsdtFree = NaN;
      if (balRes.ok) {
        const list = Array.isArray(balJson.balances) ? balJson.balances : [];
        const usdtRow = list.find((b) => b.asset === "USDT");
        if (usdtRow) {
          const n = parseFloat(usdtRow.free);
          if (Number.isFinite(n)) spotUsdtFree = n;
        }
      }
      /** Compras a mercado precisam de USDT livre; vendas/flatten usam só a posição em base — não bloquear sell com USDT = 0. */
      const spotUsdtOkForBuy = Number.isFinite(spotUsdtFree) && spotUsdtFree > 0;

      for (const robot of activeBuyerRobots) {
        if (cancelled) return;

        const armRefLive = robotFlattenArmedRef.current;
        const kArmLive = `${robot.id}::${sym}`;
        const posArmLive = getRobotPosition(robot.id, sym);
        const flattenIdsLive = robot.flattenCombinedStrategyIds ?? [];
        if (!posArmLive || posArmLive.totalBaseQty <= 1e-12) {
          delete armRefLive[kArmLive];
        } else {
          const autoArmByPriceLive =
            robot.autoArmByPriceEnabled === true &&
            refPx != null &&
            buyerAlertArmMeetsMinEdge(robot, refPx, posArmLive.avgBuyPrice);
          const flattenHitLive =
            flattenIdsLive.length > 0 &&
            refPx != null &&
            robotStrategyTrueOnAnyLiveRow(robot, extendedKlines, strategyResults, robotFlattenOrTrue) &&
            buyerAlertArmMeetsMinEdge(robot, refPx, posArmLive.avgBuyPrice);
          if (armRefLive[kArmLive] === true || autoArmByPriceLive || flattenHitLive) armRefLive[kArmLive] = true;
        }

        const flattenArmedLive = armRefLive[kArmLive] === true;
        if (flattenArmedLive && refPx != null) {
          const posFlat = getRobotPosition(robot.id, sym);
          if (
            posFlat &&
            posFlat.totalBaseQty > 1e-12 &&
            posFlat.avgBuyPrice > 0 &&
            longFlattenCloseBreakeven(refPx, posFlat.avgBuyPrice, robot.flattenBreakevenBufferPercent ?? 0)
          ) {
            const flatKey = `${robot.id}::${ot}::flat`;
            if (!robotLiveFlattenInFlightRef.current.has(flatKey)) {
              robotLiveFlattenInFlightRef.current.add(flatKey);
              try {
                const out = await submitRobotMarketSellOrder(sym, posFlat.totalBaseQty, {
                  robotId: robot.id,
                  robotAlias: robot.alias ?? "",
                  executionRole: "FLATTEN",
                });
                if (out.ok) {
                  delete armRefLive[kArmLive];
                  const kb = `${robot.id}::${sym}`;
                  delete robotBuyEdgesSinceFlatRef.current[kb];
                  delete robotBuyAccumulationActiveRef.current[kb];
                  delete robotBuyAccumLastOtRef.current[kb];
                  delete robotBuyAccumCandleIndexRef.current[kb];
                  delete robotBuySequentialSliceUsdtRef.current[kb];
                  delete robotBuyAccumFrozenMaxSpendUsdtRef.current[kb];
                  delete robotFirstEntryLimitPendingRef.current[kb];
                  delete robotBuySignalCountedOpenTimesRef.current[kb];
                  delete robotBuyHadPositionEndRef.current[kb];
                  appendRobotLiveActivityEvent(robot.id, sym, "flatten_breakeven", {
                    executionRole: "FLATTEN",
                    baseQty: posFlat.totalBaseQty,
                    avgBuyPrice: posFlat.avgBuyPrice,
                    closePrice: refPx,
                    flattenBreakevenBufferPercent: robot.flattenBreakevenBufferPercent ?? 0,
                    breakevenThresholdPrice: flattenBreakevenThresholdPrice(
                      posFlat.avgBuyPrice,
                      robot.flattenBreakevenBufferPercent ?? 0
                    ),
                    openTime: ot,
                  });
                  dispatchRobotPositionSellClear(robot.id, sym);
                  dispatchSpotOrderPlaced();
                  persistRobotLiveBuyAccum(robotLiveBuyAccumRefBag, scheduleRobotLiveToDb);
                }
              } finally {
                robotLiveFlattenInFlightRef.current.delete(flatKey);
              }
            }
          }
        }

        if (cancelled) continue;

        const hasPostSellStratsLive = (robot.postFlattenSignalSellCombinedStrategyIds?.length ?? 0) > 0;
        const postSellArmedLive =
          flattenArmedLive && posArmLive != null && posArmLive.totalBaseQty > 1e-12;
        const sellOtNormalLive = robotLivePickOpenTimeWhere(robot, extendedKlines, strategyResults, robotSellOrTrue);
        const sellOtPostLive =
          postSellArmedLive && hasPostSellStratsLive
            ? robotLivePickOpenTimeWhere(robot, extendedKlines, strategyResults, robotPostFlattenSellOrTrue)
            : null;
        const sellSignalOtLive = sellOtNormalLive ?? sellOtPostLive;
        if (sellSignalOtLive != null) {
          const posPre = getRobotPosition(robot.id, sym);
          if (posPre && posPre.totalBaseQty > 1e-12) {
            if (refPx == null || !buyerSignalExitMeetsMinEdge(robot, refPx, posPre.avgBuyPrice)) continue;
            const sellKey = `${robot.id}::${sellSignalOtLive}::sell`;
            if (robotLiveSellInFlightRef.current.has(sellKey)) continue;
            robotLiveSellInFlightRef.current.add(sellKey);
            try {
              const out = await submitRobotMarketSellOrder(sym, posPre.totalBaseQty, {
                robotId: robot.id,
                robotAlias: robot.alias ?? "",
                executionRole: "SIGNAL_SELL",
              });
              if (out.ok) {
                const kb = `${robot.id}::${sym}`;
                delete robotFlattenArmedRef.current[kb];
                delete robotBuyEdgesSinceFlatRef.current[kb];
                delete robotBuyAccumulationActiveRef.current[kb];
                delete robotBuyAccumLastOtRef.current[kb];
                delete robotBuyAccumCandleIndexRef.current[kb];
                delete robotBuySequentialSliceUsdtRef.current[kb];
                delete robotBuyAccumFrozenMaxSpendUsdtRef.current[kb];
                delete robotFirstEntryLimitPendingRef.current[kb];
                delete robotBuySignalCountedOpenTimesRef.current[kb];
                delete robotBuyHadPositionEndRef.current[kb];
                appendRobotLiveActivityEvent(robot.id, sym, "signal_sell", {
                  baseQty: posPre.totalBaseQty,
                  sellSignalOpenTime: sellSignalOtLive,
                });
                dispatchRobotPositionSellClear(robot.id, sym);
                dispatchSpotOrderPlaced();
                persistRobotLiveBuyAccum(robotLiveBuyAccumRefBag, scheduleRobotLiveToDb);
              }
            } finally {
              robotLiveSellInFlightRef.current.delete(sellKey);
            }
          }
        }

        if (!spotUsdtOkForBuy) continue;

        const kAccum = `${robot.id}::${sym}`;
        if (robotBuyAccumulationActiveRef.current[kAccum] !== true) continue;
        if (hasRobotBuyExecForCandle(buyExecMapRef.current, robot.id, sym, ot)) continue;
        const buyKey = `${robot.id}::${ot}::buy`;

        const refCloseLive = Number(extendedKlines[0]?.[4]);
        const refOpenLiveRaw = Number(extendedKlines[0]?.[1]);
        const refPxLive = Number.isFinite(refCloseLive) && refCloseLive > 0 ? refCloseLive : null;
        const refOpenLive = Number.isFinite(refOpenLiveRaw) && refOpenLiveRaw > 0 ? refOpenLiveRaw : null;
        const pos = getRobotPosition(robot.id, sym);
        if (refPxLive == null || refOpenLive == null || !buyerAllowsAccumulationBuy(refPxLive, refOpenLive, pos?.lastBuyFillPrice)) {
          continue;
        }

        const maxSpendNow = (spotUsdtFree * robot.maxSpotPercent) / 100;
        let sliceUsdt = robotBuySequentialSliceUsdtRef.current[kAccum];
        let frozenMaxSpendUsdt = robotBuyAccumFrozenMaxSpendUsdtRef.current[kAccum];
        if (frozenMaxSpendUsdt === undefined || !Number.isFinite(frozenMaxSpendUsdt) || frozenMaxSpendUsdt <= 0) {
          frozenMaxSpendUsdt = maxSpendNow;
          if (frozenMaxSpendUsdt > 1e-8) {
            robotBuyAccumFrozenMaxSpendUsdtRef.current[kAccum] = frozenMaxSpendUsdt;
          }
        }
        if (sliceUsdt === undefined || !Number.isFinite(sliceUsdt) || sliceUsdt <= 0) {
          const sliceBase = frozenMaxSpendUsdt > 0 ? frozenMaxSpendUsdt : maxSpendNow;
          sliceUsdt = computeNominalBuyOperationUsdt(robot, sliceBase);
          if (sliceUsdt > 1e-8) robotBuySequentialSliceUsdtRef.current[kAccum] = sliceUsdt;
        }
        const quoteUsdt = computeRobotMarketBuyQuoteUsdt(
          robot,
          spotUsdtFree,
          pos,
          sliceUsdt,
          frozenMaxSpendUsdt
        );
        if (quoteUsdt == null) {
          appendRobotLiveActivityEvent(robot.id, sym, "accumulation_aborted_no_quote", { openTime: ot });
          delete robotBuyAccumulationActiveRef.current[kAccum];
          delete robotBuyAccumLastOtRef.current[kAccum];
          delete robotBuyAccumCandleIndexRef.current[kAccum];
          delete robotBuySequentialSliceUsdtRef.current[kAccum];
          delete robotBuyAccumFrozenMaxSpendUsdtRef.current[kAccum];
          delete robotFirstEntryLimitPendingRef.current[kAccum];
          persistRobotLiveBuyAccum(robotLiveBuyAccumRefBag, scheduleRobotLiveToDb);
          continue;
        }

        const pendingOpenBuy = robotFirstEntryLimitPendingRef.current[kAccum];
        if (pendingOpenBuy) {
          const sync = await syncRobotSpotOrder(sym, pendingOpenBuy.orderId);
          if (sync.ok) {
            const state = parseSpotOrderState(sync.order);
            if (state === "FILLED") {
              const fill = parseMarketOrderFill(sync.order);
              if (fill) {
                dispatchRobotPositionBuy(robot.id, sym, fill.quoteUsdt, fill.baseQty);
              }
              setBuyExecMap((prev) => {
                if (hasRobotBuyExecForCandle(prev, robot.id, sym, pendingOpenBuy.openTime)) return prev;
                const next = setRobotBuyExecForCandle(prev, robot.id, sym, pendingOpenBuy.openTime);
                persistRobotBuyExecMap(next);
                return next;
              });
              appendRobotLiveActivityEvent(robot.id, sym, "limit_buy_filled", {
                openTime: pendingOpenBuy.openTime,
                orderId: pendingOpenBuy.orderId,
                ...(fill ? { baseQty: fill.baseQty, quoteUsdt: fill.quoteUsdt } : {}),
              });
              delete robotFirstEntryLimitPendingRef.current[kAccum];
              robotLiveBuyInFlightRef.current.delete(buyKey);
              dispatchSpotOrderPlaced();
              continue;
            }
            if (state === "CANCELED" || state === "EXPIRED" || state === "REJECTED") {
              delete robotFirstEntryLimitPendingRef.current[kAccum];
              robotLiveBuyInFlightRef.current.delete(buyKey);
              appendRobotLiveActivityEvent(robot.id, sym, "limit_buy_closed_unfilled", {
                openTime: pendingOpenBuy.openTime,
                orderId: pendingOpenBuy.orderId,
                status: state,
              });
              continue;
            }
            const timeoutCandles = Math.min(
              ROBOT_BUY_ACCUM_MAX_CANDLES_MAX,
              Math.max(ROBOT_BUY_ACCUM_MAX_CANDLES_MIN, Math.floor(robot.firstEntryLimitTimeoutCandles ?? 7))
            );
            const candleIndexNow = robotBuyAccumCandleIndexRef.current[kAccum] ?? 1;
            if (candleIndexNow - pendingOpenBuy.startedCandleIndex >= timeoutCandles) {
              const canceled = await cancelRobotSpotOrder(sym, pendingOpenBuy.orderId);
              if (canceled.ok) {
                appendRobotLiveActivityEvent(robot.id, sym, "limit_buy_timeout_cancel", {
                  openTime: pendingOpenBuy.openTime,
                  orderId: pendingOpenBuy.orderId,
                  timeoutCandles,
                });
                delete robotFirstEntryLimitPendingRef.current[kAccum];
                robotLiveBuyInFlightRef.current.delete(buyKey);
              }
            }
          }
          continue;
        }

        if (robotLiveBuyInFlightRef.current.has(buyKey)) continue;

        const wantsFirstEntryLimit =
          robot.firstEntryLimitEnabled === true && (!pos || pos.totalBaseQty <= 1e-12);

        if (wantsFirstEntryLimit) {
          const offsetPct = Math.min(1, Math.max(0, robot.firstEntryLimitOffsetPercent ?? 0));
          const limitPx = buyerLimitBuyMaxPriceBelowCandleOpen(refOpenLive, offsetPct);
          if (!Number.isFinite(limitPx) || limitPx <= 0) {
            appendRobotLiveActivityEvent(robot.id, sym, "open_buy_skip_bad_limit_px", {
              openTime: ot,
              refOpenLive,
              offsetPct,
            });
            continue;
          }

          robotLiveBuyInFlightRef.current.add(buyKey);
          try {
            const outLimit = await submitRobotLimitBuyOrder(sym, quoteUsdt, limitPx, {
              robotId: robot.id,
              robotAlias: robot.alias ?? "",
              executionRole: "OPEN_BUY",
            });
            if (outLimit.ok) {
              robotFirstEntryLimitPendingRef.current[kAccum] = {
                orderId: outLimit.orderId,
                openTime: ot,
                startedCandleIndex: robotBuyAccumCandleIndexRef.current[kAccum] ?? 1,
              };
              appendRobotLiveActivityEvent(robot.id, sym, "limit_buy_placed", {
                openTime: ot,
                quoteUsdt,
                orderId: outLimit.orderId,
                price: limitPx,
                offsetPct,
                anchor: "candle_open",
              });
            }
          } finally {
            if (!robotFirstEntryLimitPendingRef.current[kAccum]) {
              robotLiveBuyInFlightRef.current.delete(buyKey);
            }
          }
          continue;
        }

        if (
          !buyerMarketBuyRefStrictlyBelowCandleOpen(refPxLive, refOpenLive) ||
          !buyerRefAllowsNextBuy(refPxLive, pos?.lastBuyFillPrice)
        ) {
          continue;
        }

        robotLiveBuyInFlightRef.current.add(buyKey);
        try {
          const out = await submitRobotMarketBuyOrder(sym, quoteUsdt, {
            robotId: robot.id,
            robotAlias: robot.alias ?? "",
            executionRole: "OPEN_BUY",
          });
          if (!out.ok) continue;
          const fill = parseMarketOrderFill(out.order);
          if (fill) {
            dispatchRobotPositionBuy(robot.id, sym, fill.quoteUsdt, fill.baseQty);
          }
          setBuyExecMap((prev) => {
            if (hasRobotBuyExecForCandle(prev, robot.id, sym, ot)) return prev;
            const next = setRobotBuyExecForCandle(prev, robot.id, sym, ot);
            persistRobotBuyExecMap(next);
            return next;
          });
          appendRobotLiveActivityEvent(robot.id, sym, "market_buy", {
            quoteUsdt,
            openTime: ot,
            ...(fill ? { baseQty: fill.baseQty } : {}),
          });
          persistRobotLiveBuyAccum(robotLiveBuyAccumRefBag, scheduleRobotLiveToDb);
          dispatchSpotOrderPlaced();
        } finally {
          robotLiveBuyInFlightRef.current.delete(buyKey);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    extendedKlines,
    strategyResults,
    activeBuyerRobots,
    symbol,
    robotBuyOrTrue,
    robotSellOrTrue,
    robotFlattenOrTrue,
    robotPostFlattenSellOrTrue,
    robotLiveBuyAccumRefBag,
    scheduleRobotLiveToDb,
  ]);

  /** Overlays para pintar candle com cor da estratégia quando condição verdadeira. Se houver alguma estratégia combinada aplicada, só as combinadas têm efeito (as normais ficam desabilitadas). */
  const strategyCandleOverlays = useMemo(() => {
    const palette = INDICATOR_COLOR_PALETTE;
    const hasAnyCombinedApplied = visibleStrategies.some((s) => s.isCombined);
    const strategiesForOverlay = hasAnyCombinedApplied ? visibleStrategies.filter((s) => s.isCombined) : visibleStrategies;
    return strategiesForOverlay.map((s, idx) => ({
      id: s.id,
      name: s.name,
      color: s.color ?? palette[Math.min(2 + (idx % Math.max(1, palette.length - 2)), palette.length - 1)] ?? "#6366f1",
      results: strategyResults.get(s.id) ?? [],
      visualizationMode: s.visualizationMode ?? "paint",
      signalShape: s.signalShape ?? "arrowUp",
      signalPosition: s.signalPosition ?? "below",
    }));
  }, [visibleStrategies, strategyResults, layoutAppliedTick]);

  const fetchChartSpotOrders = useCallback(() => {
    chartSpotOrdersFetchAbortRef.current?.abort();
    chartSpotOrdersFetchAbortRef.current = null;
    if (isGroupMinutesNoSpotOrderMarkers(groupMinutes)) {
      setChartSpotOrdersFromApi([]);
      setChartOrdersFetchDebug({
        at: new Date().toISOString(),
        httpStatus: null,
        ok: true,
        orderCount: 0,
        skipped: "groupMinutes_no_spot_order_markers",
      });
      return;
    }
    const sym = symbol?.trim();
    if (!sym) {
      setChartSpotOrdersFromApi([]);
      setChartOrdersFetchDebug({
        at: new Date().toISOString(),
        httpStatus: null,
        ok: true,
        orderCount: 0,
        skipped: "empty symbol",
      });
      return;
    }
    const ac = new AbortController();
    chartSpotOrdersFetchAbortRef.current = ac;
    fetch(`${API_BASE}/user/binance-connection/orders?symbol=${encodeURIComponent(sym.toUpperCase())}`, {
      credentials: "include",
      cache: "no-store",
      signal: ac.signal,
    })
      .then(async (r) => {
        if (ac.signal.aborted) return;
        const j = (await r.json().catch(() => ({}))) as { orders?: ChartSpotOrderApiRow[]; error?: string };
        const orders = Array.isArray(j.orders) ? j.orders : [];
        setChartOrdersFetchDebug({
          at: new Date().toISOString(),
          httpStatus: r.status,
          ok: r.ok,
          orderCount: orders.length,
          error: r.ok ? undefined : typeof j.error === "string" ? j.error : `http_${r.status}`,
        });
        if (r.ok) setChartSpotOrdersFromApi(orders);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setChartOrdersFetchDebug({
          at: new Date().toISOString(),
          httpStatus: null,
          ok: false,
          orderCount: 0,
          error: e instanceof Error ? e.message : String(e),
        });
      });
  }, [symbol, groupMinutes]);

  useEffect(() => {
    fetchChartSpotOrders();
  }, [fetchChartSpotOrders]);

  useEffect(() => {
    const onPlaced = () => fetchChartSpotOrders();
    window.addEventListener("backcrypto-spot-order-placed", onPlaced);
    return () => window.removeEventListener("backcrypto-spot-order-placed", onPlaced);
  }, [fetchChartSpotOrders]);

  useEffect(() => {
    const sym = symbol?.trim().toUpperCase();
    if (!sym) return;

    /** Ordens que ainda podem estar abertas na exchange: LIMIT com estado não terminal na BD. */
    const needsBinanceSync = (o: ChartSpotOrderApiRow): boolean => {
      if ((o.orderType ?? "").toUpperCase() !== "LIMIT") return false;
      const st = (o.status ?? "").toUpperCase();
      if (st !== "NEW" && st !== "PARTIALLY_FILLED") return false;
      const side = (o.side ?? "").toUpperCase();
      return side === "BUY" || side === "SELL";
    };

    const hasPending = limitSpotSyncOrdersRef.current.some(needsBinanceSync);
    if (!hasPending) return;

    const tick = () => {
      const toSync = limitSpotSyncOrdersRef.current.filter(needsBinanceSync);
      if (toSync.length === 0) return;
      void Promise.all(
        toSync.map((o) =>
          fetch(`${API_BASE}/user/binance-connection/order/sync`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol: sym, orderId: o.binanceOrderId }),
          })
        )
      )
        .then(() => {
          fetchChartSpotOrders();
        })
        .catch(() => {});
    };

    void tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [chartSpotOrdersFromApi, symbol, fetchChartSpotOrders]);

  const spotOrderMarkers = useMemo((): SpotOrderMarker[] => {
    if (!showSpotOrderLabels) return [];
    if (isGroupMinutesNoSpotOrderMarkers(groupMinutes)) return [];
    if (extendedKlines.length === 0) return [];
    const symU = symbol.trim().toUpperCase();
    const baseAsset = symU.endsWith("USDT") && symU.length > 4 ? symU.slice(0, -4) : "";
    const tFlat = getCryptoT(lang).sistema.klines as Record<string, string>;
    const byIndex = new Map<number, ChartSpotOrderApiRow[]>();
    for (const o of chartSpotOrdersFromApi) {
      const st = (o.status ?? "").toUpperCase();
      if (st !== "FILLED" && st !== "PARTIALLY_FILLED") continue;
      if (o.transactTimeMs == null || !Number.isFinite(o.transactTimeMs)) continue;
      if (o.side !== "BUY" && o.side !== "SELL") continue;
      const idx = resolveKlineIndexForSpotOrder(extendedKlines, o.transactTimeMs, timezoneOffset);
      if (idx == null) continue;
      const list = byIndex.get(idx) ?? [];
      list.push(o);
      byIndex.set(idx, list);
    }
    const markers: SpotOrderMarker[] = [];
    for (const [klinesIndex, list] of byIndex) {
      const sorted = [...list].sort((a, b) => (a.transactTimeMs ?? 0) - (b.transactTimeMs ?? 0));
      sorted.forEach((o, stackIndex) => {
        const avgRaw = o.avgPrice?.trim() ?? "";
        const avgN = avgRaw !== "" ? Number.parseFloat(avgRaw) : NaN;
        const limRaw = o.price?.trim() ?? "";
        const limN = limRaw !== "" ? Number.parseFloat(limRaw) : NaN;
        const avgPrice =
          Number.isFinite(avgN) && avgN > 0 ? avgN : Number.isFinite(limN) && limN > 0 ? limN : null;
        markers.push({
          binanceOrderId: o.binanceOrderId,
          klinesIndex,
          side: o.side as "BUY" | "SELL",
          stackIndex,
          title: buildSpotOrderMarkerTitle(o, baseAsset, tFlat),
          avgPrice,
        });
      });
    }
    return markers;
  }, [showSpotOrderLabels, groupMinutes, extendedKlines, chartSpotOrdersFromApi, symbol, lang, timezoneOffset]);

  const spotOrderChartDebugSnapshot = useMemo(() => {
    if (!spotOrderChartDebugEnabled) return null;
    const tLoc = getCryptoT(lang).sistema.klines as Record<string, string>;
    const k = extendedKlines;
    const fmt = (ms: number) => new Date(ms).toISOString();
    const klinesTimeRange =
      k.length === 0
        ? null
        : {
            note: tLoc.spotOrderChartDebugKlinesNote ?? "",
            index0_newest: { open: Number(k[0]?.[0]), close: Number(k[0]?.[6]), openIso: fmt(Number(k[0]?.[0])), closeIso: fmt(Number(k[0]?.[6])) },
            indexLast_oldest: {
              open: Number(k[k.length - 1]?.[0]),
              close: Number(k[k.length - 1]?.[6]),
              openIso: fmt(Number(k[k.length - 1]?.[0])),
              closeIso: fmt(Number(k[k.length - 1]?.[6])),
            },
          };
    const ordersAnalysis = chartSpotOrdersFromApi.map((o) => {
      const st = (o.status ?? "").toUpperCase();
      const eligible =
        (st === "FILLED" || st === "PARTIALLY_FILLED") &&
        o.transactTimeMs != null &&
        Number.isFinite(o.transactTimeMs) &&
        (o.side === "BUY" || o.side === "SELL");
      const tMs = o.transactTimeMs ?? NaN;
      const placement =
        Number.isFinite(tMs) && k.length > 0 ? debugSpotOrderPlacement(k, tMs, timezoneOffset) : null;
      const resolved = Number.isFinite(tMs) ? resolveKlineIndexForSpotOrder(k, tMs, timezoneOffset) : null;
      let skipReason: string | null = null;
      if (!eligible) {
        if (st !== "FILLED" && st !== "PARTIALLY_FILLED") skipReason = `status=${o.status ?? "null"}`;
        else if (o.transactTimeMs == null || !Number.isFinite(o.transactTimeMs)) skipReason = "transactTimeMs invalid";
        else if (o.side !== "BUY" && o.side !== "SELL") skipReason = `side=${o.side}`;
      }
      return {
        binanceOrderId: o.binanceOrderId,
        side: o.side,
        orderType: o.orderType,
        status: o.status,
        eligible,
        skipReason,
        transactTimeMs: o.transactTimeMs,
        transactIso: Number.isFinite(tMs) ? fmt(tMs) : null,
        createdAt: o.createdAt ?? null,
        resolvedKlinesIndex: resolved,
        placement,
        markerInState: spotOrderMarkers.some((m) => m.binanceOrderId === o.binanceOrderId),
      };
    });
    const ohlc = aggSeriesKind === "ohlc";
    return {
      hint: tLoc.spotOrderChartDebugHint ?? "",
      /** Sempre igual ao que o GET lê no servidor — não é query direta à Binance. */
      ordersSource: { prismaTable: "UserBinanceSpotOrder", apiRoute: "GET /user/binance-connection/orders" },
      symbol: symbol.trim().toUpperCase(),
      aggSeriesKind,
      groupMinutes,
      spotOrderMarkersOnChart: {
        enabledForChartKind: true,
        note: ohlc ? null : (tLoc.spotOrderChartDebugAggSeriesBarNote ?? ""),
      },
      timezoneOffsetHours: timezoneOffset,
      extendedKlinesCount: k.length,
      klinesTimeRange,
      ordersGet: chartOrdersFetchDebug,
      chartSpotOrdersCount: chartSpotOrdersFromApi.length,
      spotOrderMarkersCount: spotOrderMarkers.length,
      spotOrderMarkers,
      ordersAnalysis,
    };
  }, [
    spotOrderChartDebugEnabled,
    extendedKlines,
    chartSpotOrdersFromApi,
    timezoneOffset,
    symbol,
    aggSeriesKind,
    groupMinutes,
    spotOrderMarkers,
    chartOrdersFetchDebug,
    lang,
  ]);

  useEffect(() => {
    setSpotOrderChartDebugPayload(spotOrderChartDebugEnabled ? spotOrderChartDebugSnapshot : null);
  }, [spotOrderChartDebugEnabled, spotOrderChartDebugSnapshot, setSpotOrderChartDebugPayload]);

  useEffect(() => {
    return () => {
      setSpotOrderChartDebugPayload(null);
    };
  }, [setSpotOrderChartDebugPayload]);

  /** Lista de colunas de indicadores visíveis (cada item = uma coluna no gráfico/tabela). */
  type IchimokuPart = "tenkan" | "kijun" | "spanA" | "spanB" | "chikou";
  const visibleIndicatorColumns = useMemo(() => {
    const list: { ind: (typeof userIndicators)[0]; columnIndex: number; isSignal: boolean; isHistogram: boolean; adxPart?: "plusDi" | "minusDi" | "adx"; ichimokuPart?: IchimokuPart }[] = [];
    for (let u = 0; u < userIndicators.length; u++) {
      const ind = userIndicators[u];
      if (ind.intervals.length === 1 && ind.intervals[0] === 0) continue;
      if (ind.intervals.length > 0 && !ind.intervals.includes(groupMinutes)) continue;
      if (ind.type === "Volume") {
        list.push({ ind, columnIndex: ind.volumeInUsdt ? 7 : 5, isSignal: false, isHistogram: false });
        continue;
      }
      const start = getIndicatorColumnStart(u);
      if (ind.type === "ADX") {
        list.push({ ind, columnIndex: start, isSignal: false, isHistogram: false, adxPart: "plusDi" });
        list.push({ ind, columnIndex: start + 1, isSignal: false, isHistogram: false, adxPart: "minusDi" });
        list.push({ ind, columnIndex: start + 2, isSignal: false, isHistogram: false, adxPart: "adx" });
        continue;
      }
      if (ind.type === "Ichimoku") {
        const parts: { part: IchimokuPart; show: boolean }[] = [
          { part: "tenkan", show: ind.ichimokuShowTenkan !== false },
          { part: "kijun", show: ind.ichimokuShowKijun !== false },
          { part: "spanA", show: ind.ichimokuShowSpanA !== false },
          { part: "spanB", show: ind.ichimokuShowSpanB !== false },
          { part: "chikou", show: ind.ichimokuShowChikou === true },
        ];
        parts.forEach(({ part, show }, i) => {
          if (show) list.push({ ind, columnIndex: start + i, isSignal: false, isHistogram: false, ichimokuPart: part });
        });
        continue;
      }
      list.push({ ind, columnIndex: start, isSignal: false, isHistogram: false });
      if (ind.type === "MACD" && ind.macdSignalLine) list.push({ ind, columnIndex: start + 1, isSignal: true, isHistogram: false });
      if (ind.type === "MACD" && ind.macdHistogram) list.push({ ind, columnIndex: start + 2, isSignal: false, isHistogram: true });
      if (ind.type === "DIFF" && ind.diffSignalLine) list.push({ ind, columnIndex: start + 1, isSignal: true, isHistogram: false });
      if (ind.type === "DIFF" && ind.diffHistogram) list.push({ ind, columnIndex: start + 2, isSignal: false, isHistogram: true });
      if (ind.type === "Stochastic" && ind.stochDLine) list.push({ ind, columnIndex: start + 1, isSignal: true, isHistogram: false });
      /* Bollinger: single entry with columnIndex = first of 3 cols (upper, middle, lower) */
    }
    return list;
  }, [userIndicators, groupMinutes, getIndicatorColumnStart]);

  useEffect(() => {
    setCurrentGroupMinutes(groupMinutes);
  }, [groupMinutes, setCurrentGroupMinutes]);

  const handleIntervalChange = useCallback(
    (value: number) => {
      if (activeLayoutIsDefault && isIntervalForbiddenOnDefaultLayout(value)) return;
      setGroupMinutes(value);
      try {
        if (typeof window !== "undefined") window.localStorage.setItem(KLINE_GROUP_MINUTES_KEY, String(value));
      } catch {
        /* ignore */
      }
    },
    [activeLayoutIsDefault]
  );

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(
        KLINE_VOLUME_AT_PRICE_KEY,
        JSON.stringify({ enabled: volumeAtPriceEnabled, buckets: volumeAtPriceBuckets, percent: volumeAtPricePercent, opacity: volumeAtPriceOpacity, widthPercent: volumeAtPriceWidthPercent, side: volumeAtPriceSide, colorAbove: volumeAtPriceColorAbove, colorBelow: volumeAtPriceColorBelow })
      );
    } catch {
      /* ignore */
    }
  }, [volumeAtPriceEnabled, volumeAtPriceBuckets, volumeAtPricePercent, volumeAtPriceOpacity, volumeAtPriceWidthPercent, volumeAtPriceSide, volumeAtPriceColorAbove, volumeAtPriceColorBelow]);

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        // Largura do plot = container - eixo Y (limite max 660px total = 600 plot + 60 eixo)
        if (typeof rect.width === "number" && rect.width > 0) {
          const plotWidth = Math.max(100, rect.width - Y_AXIS_WIDTH);
          setChartWidth(plotWidth);
        }
        if (typeof rect.height === "number" && rect.height > 0) setChartContainerHeight(rect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // No modo 9:16 (scroll horizontal), iniciar com o gráfico no final (dados mais recentes)
  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el || klines.length === 0) return;
    const scrollToEnd = () => {
      if (el.scrollWidth > el.clientWidth) {
        el.scrollLeft = el.scrollWidth - el.clientWidth;
      }
    };
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToEnd);
    });
    return () => cancelAnimationFrame(id);
  }, [klines.length, chartWidth, groupMinutes]);

  const fetchKlines = async (force = false): Promise<boolean> => {
    const requestedSymbol = symbolRef.current;
    const gmNorm = normalizeAggGroupMinutes(groupMinutes);
    const cache2 = groupMinutesToCache2Params(gmNorm);
    try {
      setError(null);
      setNeedsRefresh(false);
      if (cache2 != null) {
        const { chartKind, interval } = cache2;
        const limitParam = aggAtemporalKlineCacheLimitRef.current;
        const res = await fetch(
          `${API_BASE}/binance/kline-cache2-bars?symbol=${encodeURIComponent(requestedSymbol)}&chartKind=${encodeURIComponent(chartKind)}&interval=${encodeURIComponent(interval)}&limit=${limitParam}`,
          { cache: "no-store", credentials: "include" }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
        }
        const body = (await res.json()) as {
          klines?: unknown;
          timezoneOffset?: number;
          maxBars?: number;
        };
        const maxBarsRaw = body.maxBars;
        const maxBars =
          typeof maxBarsRaw === "number" && Number.isFinite(maxBarsRaw) && maxBarsRaw > 0
            ? Math.floor(maxBarsRaw)
            : aggAtemporalKlineCacheLimitRef.current;
        aggAtemporalKlineCacheLimitRef.current = maxBars;
        const list = Array.isArray(body.klines) ? body.klines : [];
        if (symbolRef.current !== requestedSymbol) return false;
        const prevServer = serverAggKlinesRef.current as Kline[];
        const mergedServer =
          force || prevServer.length === 0
            ? (list as Kline[])
            : mergeRecentCacheWindow(prevServer, list as Kline[], AGG_CACHE_REFRESH_WINDOW_MS, maxBars);
        // Refresh periódico (5 min): considerar sempre mudança e reaplicar cache para realinhar WS.
        skipAggPeriodicWsReconnectRef.current = false;
        lastKlinesFetchSymbolRef.current = requestedSymbol;
        serverAggKlinesRef.current = mergedServer;
        setServerNewestKlineFromCache(mergedServer.length > 0 ? (mergedServer[0] as (string | number)[]) : null);
        const aggLive = isAggFastGroupMinutes(groupMinutes);
        // Ao receber snapshot novo do cache2, limpar só o merge live para realinhar com o servidor.
        // Não limpar anéis de debug WS/closed bricks aqui: em mercado calmo isso parecia “reset”
        // mesmo sem desconexão real, porque o painel passava a mostrar buffer vazio após cada refresh.
        liveAggRowsByOpenTimeRef.current.clear();
        setKlines(mergedServer);
        if (aggLive) {
          pushAggFastLiveDebug();
        }
        setKlinesDataSymbol(requestedSymbol);
        if (mergedServer.length > 0) {
          const row0 = mergedServer[0] as (string | number)[];
          const h = Number(row0[2]);
          const l = Number(row0[3]);
          if (Number.isFinite(h) && Number.isFinite(l)) {
            setSpotWsHigh(h);
            setSpotWsLow(l);
          }
        }
        setNeedsRefresh(false);
        if (typeof body.timezoneOffset === "number") {
          setTimezoneOffset(Math.max(-12, Math.min(12, body.timezoneOffset)));
        }
        const lastUtc = mergedServer.length > 0 && mergedServer[0][0] != null ? Number(mergedServer[0][0]) : null;
        setLastUpdate(lastUtc != null ? new Date(lastUtc) : new Date());
        return true;
      }
      const intervalParam = intervalOptions.find((o) => o.value === groupMinutes)?.param ?? "1M";
      const res = await fetch(
        `${API_BASE}/binance/klines?symbol=${encodeURIComponent(requestedSymbol)}&interval=${intervalParam}&limit=1000`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      const list = Array.isArray(body) ? body : (body.klines ?? []);
      if (symbolRef.current !== requestedSymbol) return false;
      lastKlinesFetchSymbolRef.current = requestedSymbol;
      serverAggKlinesRef.current = [];
      setServerNewestKlineFromCache(null);
      liveAggRowsByOpenTimeRef.current.clear();
      liveWsRawTradesRef.current = [];
      liveDebugClosedBricksRef.current = [];
      liveDebugBrickSeqRef.current = 0;
      setKlines(list);
      setKlinesDataSymbol(requestedSymbol);
      if (list.length > 0) {
        const row0 = list[0] as (string | number)[];
        const h = Number(row0[2]);
        const l = Number(row0[3]);
        if (Number.isFinite(h) && Number.isFinite(l)) {
          setSpotWsHigh(h);
          setSpotWsLow(l);
        }
      }
      const refreshFlag = !Array.isArray(body) && body.needsRefresh === true;
      setNeedsRefresh(refreshFlag);
      if (!Array.isArray(body) && typeof body.timezoneOffset === "number") {
        setTimezoneOffset(Math.max(-12, Math.min(12, body.timezoneOffset)));
      }
      const lastUtc = !Array.isArray(body) && body.lastUpdateUtc != null ? Number(body.lastUpdateUtc) : null;
      setLastUpdate(lastUtc != null ? new Date(lastUtc) : (list.length > 0 && list[0][0] != null ? new Date(Number(list[0][0])) : new Date()));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorLoad);
      setKlines([]);
      setKlinesDataSymbol(null);
      serverAggKlinesRef.current = [];
      setServerNewestKlineFromCache(null);
      liveAggRowsByOpenTimeRef.current.clear();
      liveWsRawTradesRef.current = [];
      liveDebugClosedBricksRef.current = [];
      liveDebugBrickSeqRef.current = 0;
      setNeedsRefresh(false);
      return false;
    } finally {
      setLoading(false);
    }
  };

  fetchKlinesRef.current = fetchKlines;

  useEffect(() => {
    if (!aggFastLiveDebugEnabled) return;
    const gm = normalizeAggGroupMinutes(groupMinutes);
    if (!isAggFastGroupMinutes(gm)) return;
    pushAggFastLiveDebug();
  }, [aggFastLiveDebugEnabled, groupMinutes, pushAggFastLiveDebug]);

  useEffect(() => {
    if (!aggFastLiveDebugEnabled) return;
    pushAggFastLiveDebug();
  }, [aggPriceTick, aggPriceTickDiag, aggFastLiveDebugEnabled, pushAggFastLiveDebug, lastAggPeriodicCacheRefreshOkAt]);

  const aggWsKind = groupMinutesToAggKind(groupMinutes);
  const aggCache2ParamsForLive = useMemo(
    () => groupMinutesToCache2Params(normalizeAggGroupMinutes(groupMinutes)),
    [groupMinutes]
  );
  const displayTierBaseLineCount = useMemo(
    () => (aggCache2ParamsForLive != null ? aggDisplayTierBaseLineCount(aggCache2ParamsForLive) : 1),
    [aggCache2ParamsForLive]
  );
  const serverCacheHeadOpenTimeMs = useMemo(() => {
    if (serverNewestKlineFromCache == null || serverNewestKlineFromCache[0] == null) return null;
    const t = Number(serverNewestKlineFromCache[0]);
    return Number.isFinite(t) ? t : null;
  }, [serverNewestKlineFromCache]);
  const aggCacheReadyForWs =
    klinesDataSymbol != null && klinesDataSymbol.trim().toUpperCase() === symbol.trim().toUpperCase();
  useAggFastTradeLive({
    enabled: aggWsKind != null && timeframeRestored && isAggFastGroupMinutes(groupMinutes),
    aggKind: (aggWsKind ?? "renko") as AggFastWsKind,
    symbol,
    klinesSourceSymbol: klinesDataSymbol,
    cacheReadyForAggWs: aggCacheReadyForWs,
    groupMinutes,
    periodicWsReconnectKey: aggPeriodicWsReconnectKey,
    timezoneOffsetHours: timezoneOffset,
    klines,
    serverNewestKlineFromCache,
    onLiveFlush: (rows) => {
      if (groupMinutesToAggKind(groupMinutes) == null) return;
      const gmNorm = normalizeAggGroupMinutes(groupMinutes);
      const c2 = groupMinutesToCache2Params(gmNorm);
      const m = liveAggRowsByOpenTimeRef.current;
      for (const r of rows) {
        const k = aggFastLiveBrickLogicalKey(r);
        const isNewBrick = !m.has(k);
        m.set(k, r);
        /** Mesma chave = mesmo tijolo (ex.: flush repetido com o mesmo payload). Map já deduplica; histórico/debug não pode duplicar linhas. */
        if (!isNewBrick) continue;
        pendingAggPersistRef.current.push(r);
        liveDebugBrickSeqRef.current += 1;
        const h = liveDebugClosedBricksRef.current;
        h.push({ seq: liveDebugBrickSeqRef.current, row: r });
        if (h.length > LIVE_DEBUG_BRICKS_MAX) {
          liveDebugClosedBricksRef.current = h.slice(-LIVE_DEBUG_BRICKS_MAX);
        }
      }
      if (m.size > LIVE_AGG_ROWS_MAX) {
        const sorted = [...m.entries()].sort((a, b) => a[1].openTime - b[1].openTime);
        const drop = m.size - LIVE_AGG_ROWS_MAX;
        for (let i = 0; i < drop; i++) m.delete(sorted[i]![0]);
      }
      const tierLive = liveSourcePayloadsToTierPayloadsForMerge(m.values(), c2);
      setKlines(
        mergeAggFastServerAndLive(
          serverAggKlinesRef.current,
          tierLive,
          timezoneOffsetRef.current,
          aggAtemporalKlineCacheLimitRef.current
        ) as Kline[]
      );
      pushAggFastLiveDebug();
    },
    onLiveAggActivity: () => setSpotWsUpdatedAt(Date.now()),
    onRawAggTrade: (tr) => {
      const a = liveWsRawTradesRef.current;
      a.push({ t: tr.t, p: tr.p, q: tr.q, m: tr.m });
      if (a.length > MAX_DEBUG_WS_TRADES) liveWsRawTradesRef.current = a.slice(-MAX_DEBUG_WS_TRADES);
    },
    onPriceTickResolved: setAggPriceTick,
    onPriceTickDiagnostics: setAggPriceTickDiag,
    onFormingAccVolumes: (v) => {
      setAggFormingAccVolumes({
        baseVol: String(v.volBase),
        quoteVol: String(v.volQuote),
        trades: v.trades,
      });
    },
    displayTierBaseLineCount,
    serverCacheHeadOpenTimeMs,
  });

  useLayoutEffect(() => {
    setAggFormingAccVolumes(null);
  }, [symbol, groupMinutes]);

  useVpsFlushNotify({
    enabled: aggWsKind != null && timeframeRestored && VPS_FLUSH_WS_URL.length > 0,
    wsUrl: VPS_FLUSH_WS_URL || undefined,
    symbol,
    groupMinutes,
    onFlush: () => {
      void fetchKlinesRef.current(true);
    },
  });

  /** Persiste barras fechadas (tier base 5ticks/500trades) como dev/ticks: *Fast* + cache2 via POST autenticado. */
  useEffect(() => {
    if (!timeframeRestored || aggWsKind == null || !isAggFastGroupMinutes(groupMinutes)) return;
    const flush = async () => {
      const rows = pendingAggPersistRef.current.splice(0, pendingAggPersistRef.current.length);
      if (rows.length === 0) return;
      const kind = aggWsKind;
      const interval = kind === "trades500" ? `${TRADES_PER_CANDLE}trades` : "5ticks";
      try {
        const res = await fetch(`${API_BASE}/binance/agg-fast-bars`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ kind, corretora: "binance", interval, rows }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `HTTP ${res.status}`);
        }
      } catch {
        /* 401 / rede: não re-enfileirar (evita loop); próximo flush tenta barras novas */
      }
    };
    const id = window.setInterval(flush, AGG_PERSIST_FLUSH_MS);
    return () => {
      window.clearInterval(id);
      void flush();
    };
  }, [timeframeRestored, groupMinutes, aggWsKind]);

  const fetchSpot = async () => {
    try {
      const res = await fetch(`${API_BASE}/binance/spot?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) return;
      const data = await res.json();
      setSpot({
        currentClose: data.currentClose ?? null,
        prevDayClose: data.prevDayClose ?? null,
      });
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!timeframeRestored) return;
    setLoading(true);
    setKlines([]);
    setKlinesDataSymbol(null);
    serverAggKlinesRef.current = [];
    setServerNewestKlineFromCache(null);
    prevAggKlineCountForLimitRef.current = null;
    liveAggRowsByOpenTimeRef.current.clear();
    liveWsRawTradesRef.current = [];
    liveDebugClosedBricksRef.current = [];
    liveDebugBrickSeqRef.current = 0;
    pendingAggPersistRef.current = [];
    setSpot({ currentClose: null, prevDayClose: null });
    setSpotWsPrice(null);
    setSpotWsHigh(null);
    setSpotWsLow(null);
    fetchKlines();
    /** Temporais: refresh a cada 1 min. Atemporais: GET kline-cache2 a cada 5 min e reconexão aggTrade (via `aggPeriodicWsReconnectKey`). */
    setLastAggPeriodicCacheRefreshOkAt(null);
    const aggAtemporal = isAggFastGroupMinutes(groupMinutes);
    const interval = aggAtemporal
      ? window.setInterval(() => {
          void fetchKlinesRef.current()
            .then((ok) => {
              if (ok) setLastAggPeriodicCacheRefreshOkAt(Date.now());
            })
            .finally(() => {
              if (!skipAggPeriodicWsReconnectRef.current) {
                setAggPeriodicWsReconnectKey((k) => k + 1);
              }
              skipAggPeriodicWsReconnectRef.current = false;
            });
        }, AGG_ATEMPORAL_CACHE_REFRESH_MS)
      : window.setInterval(fetchKlines, REFRESH_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [groupMinutes, symbol, timeframeRestored]);

  /** Atemporais: ao regressar à aba após ≥45s em fundo, forçar GET cache2 (complementa o intervalo de 5 min com throttling do browser). */
  useEffect(() => {
    if (!timeframeRestored) return;
    if (!isAggFastGroupMinutes(groupMinutes)) return;
    const afterFetch = () => {
      if (!skipAggPeriodicWsReconnectRef.current) {
        setAggPeriodicWsReconnectKey((k) => k + 1);
      }
      skipAggPeriodicWsReconnectRef.current = false;
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        aggAtemporalTabHiddenAtRef.current = Date.now();
        return;
      }
      const h = aggAtemporalTabHiddenAtRef.current;
      aggAtemporalTabHiddenAtRef.current = null;
      if (h == null) return;
      if (Date.now() - h < 45_000) return;
      void fetchKlinesRef.current(true)
        .then((ok) => {
          if (ok) setLastAggPeriodicCacheRefreshOkAt(Date.now());
        })
        .finally(afterFetch);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [groupMinutes, symbol, timeframeRestored]);

  /** Modo agg: quando o número de barras fundidas atinge o limite do cache, recuperar do servidor (persistência + ordenação). */
  useEffect(() => {
    if (!timeframeRestored) return;
    if (!isAggFastGroupMinutes(groupMinutes)) return;
    const n = klines.length;
    const prev = prevAggKlineCountForLimitRef.current;
    prevAggKlineCountForLimitRef.current = n;
    if (prev == null) return;
    const cap = aggAtemporalKlineCacheLimitRef.current;
    if (n >= cap && prev < cap) {
      void fetchKlinesRef.current(true);
    }
  }, [klines.length, groupMinutes, timeframeRestored]);

  const fetchVapCacheKlines = async () => {
    if (!volumeAtPriceEnabled || isAggFastGroupMinutes(groupMinutes)) {
      setVapCacheKlines([]);
      return;
    }
    try {
      const config = getVapCacheConfig(groupMinutes);
      const candlesToUse = Math.max(1, Math.round(config.maxCandles * volumeAtPricePercent / 100));
      const res = await fetch(
        `${API_BASE}/binance/klines?symbol=${encodeURIComponent(symbol)}&interval=${config.param}&limit=${candlesToUse}`
      );
      if (!res.ok) {
        setVapCacheKlines([]);
        return;
      }
      const body = await res.json();
      const list = Array.isArray(body) ? body : (body.klines ?? []);
      setVapCacheKlines(list);
    } catch {
      setVapCacheKlines([]);
    }
  };

  useEffect(() => {
    if (!volumeAtPriceEnabled || isAggFastGroupMinutes(groupMinutes)) {
      setVapCacheKlines([]);
      return;
    }
    void fetchVapCacheKlines();
    const interval = setInterval(() => void fetchVapCacheKlines(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [volumeAtPriceEnabled, groupMinutes, symbol, volumeAtPricePercent]);

  useEffect(() => {
    fetchSpot();
    const interval = setInterval(fetchSpot, REFRESH_MS);
    return () => clearInterval(interval);
  }, [symbol]);

  /**
   * lastUpdate (GET) usa openTime já com `timezoneOffset` do utilizador (como coluna Open Time).
   * WS grava instante real UTC — para o relógio: +offset na mesma lógica da API (kline-cache2 / klines).
   * Bolinha: idade em tempo real = max(barra em UTC, último WS UTC).
   */
  const effectiveLastDisplayMs = useMemo(() => {
    const tzMs = timezoneOffset * 60 * 60 * 1000;
    const barDisp = lastUpdate?.getTime() ?? 0;
    const wsDisp = (spotWsUpdatedAt ?? 0) + tzMs;
    return Math.max(barDisp, wsDisp);
  }, [lastUpdate, spotWsUpdatedAt, timezoneOffset]);

  const effectiveLastActivityRealMs = useMemo(() => {
    const tzMs = timezoneOffset * 60 * 60 * 1000;
    const barDisp = lastUpdate?.getTime() ?? 0;
    const barReal = barDisp > 0 ? barDisp - tzMs : 0;
    const wsReal = spotWsUpdatedAt ?? 0;
    return Math.max(barReal, wsReal);
  }, [lastUpdate, spotWsUpdatedAt, timezoneOffset]);

  // Preço spot em tempo real (miniTicker) direto da Binance via WebSocket — usado no header
  useEffect(() => {
    const sym = symbol.trim();
    if (!sym) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let commitTimer: ReturnType<typeof setTimeout> | null = null;
    const lastEmitAtRef = { current: 0 };
    const reconnectDelayRef = { current: 1000 };
    const pendingPriceRef = { current: null as string | null };
    const pendingUpdatedAtRef = { current: null as number | null };
    let ws: WebSocket | null = null;

    const commitPending = () => {
      if (!alive) return;
      const price = pendingPriceRef.current;
      const updatedAt = pendingUpdatedAtRef.current;
      pendingPriceRef.current = null;
      pendingUpdatedAtRef.current = null;
      if (price != null) {
        setSpotWsPrice((prev) => (prev === price ? prev : price));
      }
      if (updatedAt != null) {
        setSpotWsUpdatedAt((prev) => (prev === updatedAt ? prev : updatedAt));
      }
    };

    const connect = () => {
      if (!alive) return;
      const streamSym = sym.toLowerCase();
      const url = `wss://stream.binance.com:9443/ws/${streamSym}@miniTicker`;
      try {
        ws = new WebSocket(url);
        ws.onmessage = (ev) => {
          if (!alive) return;
          try {
            const msg = JSON.parse(String(ev.data)) as { c?: string };
            const price = typeof msg?.c === "string" ? msg.c : null;
            const now = Date.now();
            // Throttle: no máximo 4 updates/segundo
            if (price != null && now - lastEmitAtRef.current >= 250) {
              lastEmitAtRef.current = now;
              pendingPriceRef.current = price;
              pendingUpdatedAtRef.current = now;
              if (commitTimer == null) {
                commitTimer = setTimeout(() => {
                  commitTimer = null;
                  commitPending();
                }, 16);
              }
            }
          } catch {
            // ignore parse errors
          }
        };
        ws.onclose = () => {
          if (!alive) return;
          const delay = reconnectDelayRef.current;
          reconnectDelayRef.current = Math.min(30000, Math.round(reconnectDelayRef.current * 1.5));
          if (timer) clearTimeout(timer);
          timer = setTimeout(connect, delay);
        };
        ws.onerror = () => {
          // alguns browsers disparam error antes do close
        };
      } catch {
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(30000, Math.round(reconnectDelayRef.current * 1.5));
        if (timer) clearTimeout(timer);
        timer = setTimeout(connect, delay);
      }
    };

    // ao trocar símbolo, limpa o preço anterior até chegar 1.º evento
    setSpotWsPrice(null);
    setSpotWsUpdatedAt(null);
    connect();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      if (commitTimer) clearTimeout(commitTimer);
      try {
        ws?.close();
      } catch {
        // ignore
      }
      ws = null;
    };
  }, [symbol]);

  // Volume da vela em formação (base + quote USDT) em tempo real — stream kline Binance; o GET só traz acumulado no último poll.
  useEffect(() => {
    const sym = symbol.trim();
    if (!sym) return;
    if (aggSeriesKind !== "ohlc") return;
    if (isAggFastGroupMinutes(groupMinutes)) return;
    const intervalParam = intervalOptions.find((o) => o.value === groupMinutes)?.param;
    if (!intervalParam) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reconnectDelayRef = { current: 1000 };
    let ws: WebSocket | null = null;

    const connect = () => {
      if (!alive) return;
      const streamSym = sym.toLowerCase();
      const url = `wss://stream.binance.com:9443/ws/${streamSym}@kline_${intervalParam}`;
      try {
        ws = new WebSocket(url);
        ws.onmessage = (ev) => {
          if (!alive) return;
          try {
            const msg = JSON.parse(String(ev.data)) as {
              e?: string;
              k?: { t?: number; v?: string; q?: string; n?: number };
            };
            if (msg.e !== "kline" || msg.k == null) return;
            const k = msg.k;
            const openTime = k.t;
            if (typeof openTime !== "number") return;
            setLiveCandleVolumes({
              openTime,
              baseVol: String(k.v ?? "0"),
              quoteVol: String(k.q ?? "0"),
              trades: typeof k.n === "number" && Number.isFinite(k.n) ? k.n : 0,
            });
          } catch {
            /* ignore */
          }
        };
        ws.onclose = () => {
          if (!alive) return;
          const delay = reconnectDelayRef.current;
          reconnectDelayRef.current = Math.min(30000, Math.round(reconnectDelayRef.current * 1.5));
          if (timer) clearTimeout(timer);
          timer = setTimeout(connect, delay);
        };
        ws.onerror = () => {};
      } catch {
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(30000, Math.round(reconnectDelayRef.current * 1.5));
        if (timer) clearTimeout(timer);
        timer = setTimeout(connect, delay);
      }
    };

    setLiveCandleVolumes(null);
    connect();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      setLiveCandleVolumes(null);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = null;
    };
  }, [symbol, groupMinutes, aggSeriesKind, intervalOptions]);

  // Ao voltar para a aba, atualiza na hora (evita depender do timer com aba em segundo plano)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchKlines(true);
        fetchSpot();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [groupMinutes, symbol]);

  const intervalLabel = useMemo(() => {
    const p = groupMinutesToCache2Params(normalizeAggGroupMinutes(groupMinutes));
    if (p) return formatCache2IntervalShortLabel(p.chartKind, p.interval);
    return intervalOptions.find((o) => o.value === groupMinutes)?.label ?? "1month";
  }, [groupMinutes, intervalOptions]);

  const volumeAtPriceActive = volumeAtPriceEnabled && !isAggFastGroupMinutes(groupMinutes);

  useEffect(() => {
    setIntervalPicker({
      groupMinutes,
      intervalLabel,
      onIntervalChange: handleIntervalChange,
      intervalOptions,
      aggIntervalPicker,
      isIntervalOptionDisabled:
        activeLayoutIsDefault ? (value: number) => isIntervalForbiddenOnDefaultLayout(value) : undefined,
    });
    return () => setIntervalPicker(null);
  }, [
    groupMinutes,
    intervalLabel,
    handleIntervalChange,
    intervalOptions,
    aggIntervalPicker,
    setIntervalPicker,
    activeLayoutIsDefault,
  ]);

  /** Só recalcula quando `extendedKlines` muda — evita novo objeto a cada render e loop com `setHeaderData`. */
  const last24h = useMemo(() => {
    if (extendedKlines.length === 0) return null;
    const first = extendedKlines[0];
    const cutoff = Number(first[0]) - 24 * 60 * 60 * 1000;
    const in24h = extendedKlines.filter((k) => Number(k[0]) >= cutoff);
    if (in24h.length === 0) return null;
    let max = parseFloat(String(in24h[0][2]));
    let min = parseFloat(String(in24h[0][3]));
    let volBtc = 0;
    let volUsd = 0;
    for (const k of in24h) {
      const high = parseFloat(String(k[2]));
      const low = parseFloat(String(k[3]));
      if (high > max) max = high;
      if (low < min) min = low;
      volBtc += parseFloat(String(k[5]));
      volUsd += parseFloat(String(k[7]));
    }
    return { max, min, volBtc, volUsd };
  }, [extendedKlines]);

  const headerWidth = chartWidth + Y_AXIS_WIDTH;
  /** Em 100%: 663px. Em 125%: 814px. Em 150%: 964px (+4px por aumento da lupa). */
  const chartContainerMaxWidth =
    chartReportedSizePercent >= 125
      ? Math.round(MAX_PLOT_WIDTH * (chartReportedSizePercent / 100)) + Y_AXIS_WIDTH + 4
      : 663;
  const chartContainerWidth =
    chartReportedSizePercent >= 125
      ? chartContainerMaxWidth
      : headerWidth;
  /** Em 100%: largura do container (ResizeObserver). Em 125%: largura de plot do tamanho escolhido (ex.: 750px). */
  const chartWidthToUse =
    chartReportedSizePercent >= 125
      ? Math.round(MAX_PLOT_WIDTH * (chartReportedSizePercent / 100))
      : chartWidth;

  const formatPriceLikeChart = useCallback(
    (value: string | number): string => {
      const n = typeof value === "number" ? value : parseFloat(String(value));
      if (!Number.isFinite(n)) return formatNum(String(value));
      if (priceFormatDecimals != null) {
        return priceFormatAbbreviated ? formatUsdt(n) : formatUsdtWithDecimals(n, priceFormatDecimals);
      }
      return formatNum(String(value));
    },
    [priceFormatDecimals, priceFormatAbbreviated]
  );

  useEffect(() => {
    const current = spotWsPrice ?? spot.currentClose ?? (extendedKlines.length > 0 ? String(extendedKlines[0][4]) : null);
    const prevDayCloseNum = spot.prevDayClose != null ? parseFloat(spot.prevDayClose) : null;
    const currentNumRaw = current != null ? parseFloat(current) : NaN;
    const currentNum = Number.isFinite(currentNumRaw) ? currentNumRaw : null;
    const pct = currentNum != null && prevDayCloseNum != null && prevDayCloseNum > 0
      ? ((currentNum - prevDayCloseNum) / prevDayCloseNum) * 100
      : null;
    setHeaderData({
      ...headerDataRef.current,
      chartContainerWidth,
      priceText: current != null ? formatPriceLikeChart(current) : null,
      lastPriceUsdt: currentNum,
      pctText: pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : null,
      max24h: last24h != null ? formatPriceLikeChart(String(last24h.max)) : null,
      min24h: last24h != null ? formatPriceLikeChart(String(last24h.min)) : null,
      vol24hBtc: last24h != null ? formatAbbreviated(last24h.volBtc) : null,
      vol24hUsd: last24h != null ? formatAbbreviated(last24h.volUsd) : null,
      intervalLabel: intervalLabel ?? null,
    });
  }, [symbol, spotWsPrice, spot.currentClose, spot.prevDayClose, extendedKlines, chartContainerWidth, intervalLabel, setHeaderData, formatPriceLikeChart]);

  useEffect(() => {
    if (!symbol || symbol.trim().length < 5) {
      setOpenLimitBuyPricesUsdt([]);
      setOpenLimitBuyOrdersUsdt([]);
      setOpenLimitSellPricesUsdt([]);
      setOpenLimitSellOrdersUsdt([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      fetch(`${API_BASE}/user/binance-connection/spot-open-orders?symbol=${encodeURIComponent(symbol.trim().toUpperCase())}`, {
        credentials: "include",
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          const { prices, orders, sellPrices, sellOrders } = parseSpotOpenOrdersJson(data);
          setOpenLimitBuyPricesUsdt(prices);
          setOpenLimitBuyOrdersUsdt(orders);
          setOpenLimitSellPricesUsdt(sellPrices);
          setOpenLimitSellOrdersUsdt(sellOrders);
        })
        .catch(() => {
          if (!cancelled) {
            setOpenLimitBuyPricesUsdt([]);
            setOpenLimitBuyOrdersUsdt([]);
            setOpenLimitSellPricesUsdt([]);
            setOpenLimitSellOrdersUsdt([]);
          }
        });
    };
    load();
    const id = setInterval(load, 25000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, openOrdersRefreshKey, setOpenLimitBuyPricesUsdt, setOpenLimitBuyOrdersUsdt, setOpenLimitSellPricesUsdt, setOpenLimitSellOrdersUsdt]);

  useEffect(() => {
    const onConn = () => setOpenOrdersRefreshKey((k) => k + 1);
    window.addEventListener(BINANCE_CONNECTION_CHANGED_EVENT, onConn);
    return () => window.removeEventListener(BINANCE_CONNECTION_CHANGED_EVENT, onConn);
  }, []);

  const onChartDimensionsChange = useCallback((w: number, _h: number, sizePercent: number | undefined) => {
    setChartRequestedWidth((prev) => (prev === w ? prev : w));
    setChartReportedSizePercent((prev) => (sizePercent != null && prev !== sizePercent ? sizePercent : prev));
  }, []);

  if (loading && extendedKlines.length === 0) {
    return (
      <div className="p-4 text-center text-zinc-500">
        {t.loading.replace("{interval}", intervalLabel)}
      </div>
    );
  }

  if (error && extendedKlines.length === 0) {
    return (
      <div className="p-4 text-center text-red-600">
        {t.errorLoad}
      </div>
    );
  }

  if (needsRefresh && extendedKlines.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-zinc-600 text-sm">{(t as Record<string, string>).klinesNotUpdatedYet ?? "Data has not been updated yet. Please wait or refresh the page."}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void fetchKlines(true);
          }}
          className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2"
        >
          {(t as Record<string, string>).refresh ?? "Refresh"}
        </button>
      </div>
    );
  }

  return (
    <>
    <div
      className={`flex flex-col min-h-0 pt-1 px-0 pb-4 ${chartReportedSizePercent >= 125 ? "" : "w-full"}`}
      style={chartReportedSizePercent >= 125 ? { width: chartContainerMaxWidth, minWidth: chartContainerMaxWidth } : undefined}
    >
      <div
        ref={chartWrapRef}
        className="flex-shrink-0 mb-2 min-w-0 rounded-lg border border-zinc-200 bg-white/90 shadow-sm"
        style={{
          width: chartReportedSizePercent >= 125 ? chartContainerMaxWidth : "100%",
          maxWidth: chartReportedSizePercent >= 125 ? chartContainerMaxWidth : "min(663px, 100%)",
          boxSizing: "border-box",
          overflow: "visible",
          touchAction: "auto",
          overscrollBehavior: "auto",
          ...(chartReportedSizePercent >= 125 ? { minWidth: chartContainerMaxWidth } : {}),
        }}
      >
          <KlinesChart
            isAdmin={isAdmin}
            isFreeUser={isFreeUser}
            klines={extendedKlines}
            liveLastClose={spotWsPrice ?? spot.currentClose ?? (extendedKlines.length > 0 ? extendedKlines[0][4] : null)}
            onPriceFormatChange={(d, a) => {
              setPriceFormatDecimals(d);
              setPriceFormatAbbreviated(a);
            }}
            onCurrentLayoutLabelChange={setCurrentLayoutLabel}
            groupMinutes={groupMinutes}
            timezoneOffset={timezoneOffset}
            layoutAppliedTick={layoutAppliedTick}
            intervalLabel={intervalLabel}
            intervalOptions={intervalOptions}
            aggIntervalPicker={aggIntervalPicker}
            onIntervalChange={handleIntervalChange}
            width={chartWidthToUse}
            onChartDimensionsChange={onChartDimensionsChange}
            maxChartHeight={undefined}
            symbol={symbol}
            onOpenSymbolPanel={openSymbolPanel}
            heikinAshi={heikinAshiEnabled}
            onHeikinAshiChange={(v) => {
              setHeikinAshiEnabled(v);
              try {
                if (typeof window !== "undefined") window.localStorage.setItem(KLINE_HEIKIN_ASHI_KEY, v ? "1" : "0");
              } catch {
                /* ignore */
              }
            }}
            aggSeriesKind={aggSeriesKind}
            volumeAtPriceEnabled={volumeAtPriceActive}
            volumeAtPriceKlines={volumeAtPriceActive ? vapCacheKlines : []}
            volumeAtPriceBuckets={volumeAtPriceBuckets}
            volumeAtPricePercent={volumeAtPricePercent}
            onVolumeAtPricePercentChange={(v) => setVolumeAtPricePercent(Math.max(VOLUME_AT_PRICE_PERCENT_MIN, Math.min(VOLUME_AT_PRICE_PERCENT_MAX, Math.round(v))))}
            vapTimeSpanLabel={volumeAtPriceActive ? (() => {
              const config = getVapCacheConfig(groupMinutes);
              const candlesToUse = Math.max(1, Math.round(config.maxCandles * volumeAtPricePercent / 100));
              return formatVapTimeSpan(candlesToUse, config.paramLabel, config.paramMinutes, lang);
            })() : ""}
            volumeAtPriceOpacity={volumeAtPriceOpacity}
            volumeAtPriceWidthPercent={volumeAtPriceWidthPercent}
            onVolumeAtPriceWidthPercentChange={(v) => setVolumeAtPriceWidthPercent(Math.max(VOLUME_AT_PRICE_WIDTH_PERCENT_MIN, Math.min(VOLUME_AT_PRICE_WIDTH_PERCENT_MAX, v)))}
            volumeAtPriceSide={volumeAtPriceSide}
            volumeAtPriceColorAbove={volumeAtPriceColorAbove}
            volumeAtPriceColorBelow={volumeAtPriceColorBelow}
            onVolumeAtPriceEnabledChange={setVolumeAtPriceEnabled}
            onVolumeAtPriceSideChange={setVolumeAtPriceSide}
            onVolumeAtPriceColorAboveChange={setVolumeAtPriceColorAbove}
            onVolumeAtPriceColorBelowChange={setVolumeAtPriceColorBelow}
            onVolumeAtPriceBucketsChange={(v) => setVolumeAtPriceBuckets(clampEvenBuckets(v))}
            onVolumeAtPriceOpacityChange={(v) => setVolumeAtPriceOpacity(Math.max(VOLUME_AT_PRICE_OPACITY_MIN, Math.min(VOLUME_AT_PRICE_OPACITY_MAX, v)))}
            indicatorLines={visibleIndicatorColumns.map(({ ind, columnIndex, isSignal, isHistogram, adxPart, ichimokuPart }) => {
              const ichimokuPartLabel: Record<IchimokuPart, string> = { tenkan: "Tenkan", kijun: "Kijun", spanA: "Span A", spanB: "Span B", chikou: "Chikou" };
              const baseIchimokuLabel = ind.type === "Ichimoku" ? getIndicatorLabel(ind, t, userIndicators) : "";
              return {
              columnIndex,
              adxPart,
              ichimokuPart,
              showLastValueOnYAxis: ind.showLastValueOnYAxis !== false,
              color: ind.type === "Ichimoku" && ichimokuPart ? (ichimokuPart === "tenkan" ? (ind.ichimokuTenkanColor ?? "#6366f1") : ichimokuPart === "kijun" ? (ind.ichimokuKijunColor ?? "#ea580c") : ichimokuPart === "spanA" ? (ind.ichimokuSpanAColor ?? "#22c55e") : ichimokuPart === "spanB" ? (ind.ichimokuSpanBColor ?? "#ef4444") : (ind.ichimokuChikouColor ?? "#a855f7")) : ind.type === "ADX" && adxPart ? (adxPart === "plusDi" ? (ind.adxPlusDiColor ?? "#22c55e") : adxPart === "minusDi" ? (ind.adxMinusDiColor ?? "#ef4444") : (ind.adxAdxColor ?? "#eab308")) : ind.type === "Volume" ? (ind.volumeColorAbove ?? "#10b981") : isHistogram ? (ind.type === "DIFF" ? (ind.diffHistogramColorAbove ?? "#059669") : (ind.macdHistogramColorAbove ?? "#059669")) : ind.type === "CCI" && ind.cciAsHistogram ? (ind.cciHistogramColorAbove ?? "#059669") : ind.type === "CMF" && ind.cmfAsHistogram ? (ind.cmfHistogramColorAbove ?? "#059669") : isSignal ? (ind.type === "Stochastic" ? (ind.stochDColor ?? "#ea580c") : ind.type === "DIFF" ? (ind.diffSignalColor ?? "#ea580c") : (ind.macdSignalColor ?? "#ea580c")) : ind.type === "Bollinger" ? (ind.bollingerLimitsColor ?? ind.color ?? "#6366f1") : ind.type === "Keltner" ? (ind.keltnerLimitsColor ?? ind.color ?? "#6366f1") : ind.type === "Donchian" ? (ind.donchianLimitsColor ?? ind.color ?? "#6366f1") : ind.color,
              lineWidth: ind.type === "Ichimoku" && ichimokuPart ? (ichimokuPart === "tenkan" ? (ind.ichimokuTenkanLineWidth ?? "normal") : ichimokuPart === "kijun" ? (ind.ichimokuKijunLineWidth ?? "normal") : ichimokuPart === "spanA" ? (ind.ichimokuSpanALineWidth ?? "normal") : ichimokuPart === "spanB" ? (ind.ichimokuSpanBLineWidth ?? "normal") : (ind.ichimokuChikouLineWidth ?? "normal")) : ind.type === "ADX" && adxPart ? (adxPart === "plusDi" ? (ind.adxPlusDiLineWidth ?? "normal") : adxPart === "minusDi" ? (ind.adxMinusDiLineWidth ?? "normal") : (ind.adxAdxLineWidth ?? "normal")) : ind.type === "Volume" || isHistogram || (ind.type === "CCI" && ind.cciAsHistogram) || (ind.type === "CMF" && ind.cmfAsHistogram) ? undefined : isSignal ? (ind.type === "Stochastic" ? (ind.stochDLineWidth ?? "normal") : ind.type === "DIFF" ? (ind.diffSignalLineWidth ?? "normal") : (ind.macdSignalLineWidth ?? "normal")) : ind.type === "Bollinger" ? (ind.bollingerLimitsLineWidth ?? ind.lineWidth ?? "normal") : ind.type === "Keltner" ? (ind.keltnerLimitsLineWidth ?? ind.lineWidth ?? "normal") : ind.type === "Donchian" ? (ind.donchianLimitsLineWidth ?? ind.lineWidth ?? "normal") : (ind.lineWidth ?? "normal"),
              lineStyle: ind.type === "Ichimoku" && ichimokuPart ? (ichimokuPart === "tenkan" ? (ind.ichimokuTenkanLineStyle ?? "solid") : ichimokuPart === "kijun" ? (ind.ichimokuKijunLineStyle ?? "solid") : ichimokuPart === "spanA" ? (ind.ichimokuSpanALineStyle ?? "solid") : ichimokuPart === "spanB" ? (ind.ichimokuSpanBLineStyle ?? "solid") : (ind.ichimokuChikouLineStyle ?? "solid")) : ind.type === "ADX" && adxPart ? (adxPart === "plusDi" ? (ind.adxPlusDiLineStyle ?? "solid") : adxPart === "minusDi" ? (ind.adxMinusDiLineStyle ?? "solid") : (ind.adxAdxLineStyle ?? "solid")) : ind.type === "Volume" || isHistogram || (ind.type === "CCI" && ind.cciAsHistogram) || (ind.type === "CMF" && ind.cmfAsHistogram) ? undefined : isSignal ? (ind.type === "Stochastic" ? (ind.stochDLineStyle ?? "dashed") : ind.type === "DIFF" ? (ind.diffSignalLineStyle ?? "dashed") : (ind.macdSignalLineStyle ?? "dashed")) : ind.type === "Bollinger" ? (ind.bollingerLimitsLineStyle ?? ind.lineStyle ?? "solid") : ind.type === "Keltner" ? (ind.keltnerLimitsLineStyle ?? ind.lineStyle ?? "solid") : ind.type === "Donchian" ? (ind.donchianLimitsLineStyle ?? ind.lineStyle ?? "solid") : (ind.lineStyle ?? "solid"),
              label: ind.type === "Ichimoku" && ichimokuPart ? `${baseIchimokuLabel} ${ichimokuPartLabel[ichimokuPart]}` : ind.type === "Volume" ? getIndicatorLabel(ind, t, userIndicators) : isHistogram ? ((t as Record<string, string>).macdHistogramLabel ?? "MACD (histograma)") : isSignal ? (ind.type === "Stochastic" ? getIndicatorLabelStochD(ind, t) : getIndicatorLabelSignal(ind, t)) : getIndicatorLabel(ind, t, userIndicators),
              shortLabel: ind.type === "Ichimoku" && ichimokuPart ? ichimokuPartLabel[ichimokuPart] : ind.type === "Volume" ? getIndicatorLabelShort(ind, userIndicators) : isHistogram ? (ind.type === "DIFF" ? "DIFF Hist" : "MACD Hist") : isSignal ? (ind.type === "Stochastic" ? getIndicatorLabelShortStochD(ind) : getIndicatorLabelShortSignal(ind)) : getIndicatorLabelShort(ind, userIndicators),
              type: ind.type,
              display: ind.type === "Volume" ? "histogram" as const : isHistogram ? "histogram" as const : ind.type === "CCI" && ind.cciAsHistogram ? "histogram" as const : ind.type === "CMF" && ind.cmfAsHistogram ? "histogram" as const : ind.type === "SAR" ? "points" as const : undefined,
              volumeInUsdt: ind.type === "Volume" ? (ind.volumeInUsdt === true) : undefined,
              pointSize: ind.type === "SAR" ? (ind.sarPointSize === "thin" || ind.sarPointSize === "normal" ? ind.sarPointSize : "normal") : undefined,
              histogramColorAbove: ind.type === "Volume" ? (ind.volumeColorAbove ?? "#10b981") : isHistogram ? (ind.type === "DIFF" ? (ind.diffHistogramColorAbove ?? "#059669") : (ind.macdHistogramColorAbove ?? "#059669")) : ind.type === "CCI" && ind.cciAsHistogram ? (ind.cciHistogramColorAbove ?? "#059669") : ind.type === "CMF" && ind.cmfAsHistogram ? (ind.cmfHistogramColorAbove ?? "#059669") : undefined,
              histogramColorBelow: ind.type === "Volume" ? (ind.volumeColorBelow ?? "#ef4444") : isHistogram ? (ind.type === "DIFF" ? (ind.diffHistogramColorBelow ?? "#dc2626") : (ind.macdHistogramColorBelow ?? "#dc2626")) : ind.type === "CCI" && ind.cciAsHistogram ? (ind.cciHistogramColorBelow ?? "#dc2626") : ind.type === "CMF" && ind.cmfAsHistogram ? (ind.cmfHistogramColorBelow ?? "#dc2626") : undefined,
              panel: ind.panel ?? (ind.type === "RSI" || ind.type === "MFI" || ind.type === "MACD" || ind.type === "DIFF" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "AD" || ind.type === "ATR" || ind.type === "ADX" || ind.type === "Volume" || ind.type === "CCI" || ind.type === "CMF" || ind.type === "MA_ANGLE" ? "panel2" : ind.type === "Ichimoku" ? "main" : "main"),
              rsiFixedScale: ind.type === "RSI" ? (ind.rsiFixedScale !== false) : undefined,
              rsiCenterLine: ind.type === "RSI" ? (ind.rsiCenterLine === true) : undefined,
              rsiCenterLineColor: ind.type === "RSI" && ind.rsiCenterLine ? (ind.rsiCenterLineColor ?? "#71717a") : undefined,
              rsiCenterLineWidth: ind.type === "RSI" && ind.rsiCenterLine ? (ind.rsiCenterLineWidth ?? "normal") : undefined,
              rsiCenterLineStyle: ind.type === "RSI" && ind.rsiCenterLine ? (ind.rsiCenterLineStyle ?? "dotted") : undefined,
              rsiLimits: ind.type === "RSI" ? (ind.rsiLimits === true) : undefined,
              rsiLimitUpper: ind.type === "RSI" && ind.rsiLimits ? (ind.rsiLimitUpper ?? 90) : undefined,
              rsiLimitLower: ind.type === "RSI" && ind.rsiLimits ? (ind.rsiLimitLower ?? 10) : undefined,
              rsiLimitColor: ind.type === "RSI" && ind.rsiLimits ? (ind.rsiLimitColor ?? "#dc2626") : undefined,
              rsiLimitLineWidth: ind.type === "RSI" && ind.rsiLimits ? (ind.rsiLimitLineWidth ?? "normal") : undefined,
              rsiLimitLineStyle: ind.type === "RSI" && ind.rsiLimits ? (ind.rsiLimitLineStyle ?? "dotted") : undefined,
              maAngleCenterLine: ind.type === "MA_ANGLE" ? (ind.maAngleCenterLine === true) : undefined,
              maAngleCenterLineValue: ind.type === "MA_ANGLE" && ind.maAngleCenterLine ? (ind.maAngleCenterLineValue ?? 0) : undefined,
              maAngleCenterLineColor: ind.type === "MA_ANGLE" && ind.maAngleCenterLine ? (ind.maAngleCenterLineColor ?? "#71717a") : undefined,
              maAngleCenterLineWidth: ind.type === "MA_ANGLE" && ind.maAngleCenterLine ? (ind.maAngleCenterLineWidth ?? "normal") : undefined,
              maAngleCenterLineStyle: ind.type === "MA_ANGLE" && ind.maAngleCenterLine ? (ind.maAngleCenterLineStyle ?? "dotted") : undefined,
              maAngleLimits: ind.type === "MA_ANGLE" ? (ind.maAngleLimits === true) : undefined,
              maAngleLimitUpper: ind.type === "MA_ANGLE" && ind.maAngleLimits ? (ind.maAngleLimitUpper ?? 0.5) : undefined,
              maAngleLimitLower: ind.type === "MA_ANGLE" && ind.maAngleLimits ? (ind.maAngleLimitLower ?? -0.5) : undefined,
              maAngleLimitColor: ind.type === "MA_ANGLE" && ind.maAngleLimits ? (ind.maAngleLimitColor ?? "#dc2626") : undefined,
              maAngleLimitLineWidth: ind.type === "MA_ANGLE" && ind.maAngleLimits ? (ind.maAngleLimitLineWidth ?? "normal") : undefined,
              maAngleLimitLineStyle: ind.type === "MA_ANGLE" && ind.maAngleLimits ? (ind.maAngleLimitLineStyle ?? "dotted") : undefined,
              mfiFixedScale: ind.type === "MFI" ? (ind.mfiFixedScale !== false) : undefined,
              mfiCenterLine: ind.type === "MFI" ? (ind.mfiCenterLine === true) : undefined,
              mfiCenterLineColor: ind.type === "MFI" && ind.mfiCenterLine ? (ind.mfiCenterLineColor ?? "#71717a") : undefined,
              mfiCenterLineWidth: ind.type === "MFI" && ind.mfiCenterLine ? (ind.mfiCenterLineWidth ?? "normal") : undefined,
              mfiCenterLineStyle: ind.type === "MFI" && ind.mfiCenterLine ? (ind.mfiCenterLineStyle ?? "dotted") : undefined,
              mfiLimits: ind.type === "MFI" ? (ind.mfiLimits === true) : undefined,
              mfiLimitUpper: ind.type === "MFI" && ind.mfiLimits ? (ind.mfiLimitUpper ?? 80) : undefined,
              mfiLimitLower: ind.type === "MFI" && ind.mfiLimits ? (ind.mfiLimitLower ?? 20) : undefined,
              mfiLimitColor: ind.type === "MFI" && ind.mfiLimits ? (ind.mfiLimitColor ?? "#dc2626") : undefined,
              mfiLimitLineWidth: ind.type === "MFI" && ind.mfiLimits ? (ind.mfiLimitLineWidth ?? "normal") : undefined,
              mfiLimitLineStyle: ind.type === "MFI" && ind.mfiLimits ? (ind.mfiLimitLineStyle ?? "dotted") : undefined,
              stochLimits: ind.type === "Stochastic" ? (ind.stochLimits === true) : undefined,
              stochLimitUpper: ind.type === "Stochastic" && ind.stochLimits ? (ind.stochLimitUpper ?? 80) : undefined,
              stochLimitLower: ind.type === "Stochastic" && ind.stochLimits ? (ind.stochLimitLower ?? 20) : undefined,
              stochLimitColor: ind.type === "Stochastic" && ind.stochLimits ? (ind.stochLimitColor ?? "#dc2626") : undefined,
              stochLimitLineWidth: ind.type === "Stochastic" && ind.stochLimits ? (ind.stochLimitLineWidth ?? "normal") : undefined,
              stochLimitLineStyle: ind.type === "Stochastic" && ind.stochLimits ? (ind.stochLimitLineStyle ?? "dotted") : undefined,
              williamsRLimits: ind.type === "WilliamsR" ? (ind.williamsRLimits === true) : undefined,
              williamsRLimitUpper: ind.type === "WilliamsR" && ind.williamsRLimits ? (ind.williamsRLimitUpper ?? -20) : undefined,
              williamsRLimitLower: ind.type === "WilliamsR" && ind.williamsRLimits ? (ind.williamsRLimitLower ?? -80) : undefined,
              williamsRLimitColor: ind.type === "WilliamsR" && ind.williamsRLimits ? (ind.williamsRLimitColor ?? "#dc2626") : undefined,
              williamsRLimitLineWidth: ind.type === "WilliamsR" && ind.williamsRLimits ? (ind.williamsRLimitLineWidth ?? "normal") : undefined,
              williamsRLimitLineStyle: ind.type === "WilliamsR" && ind.williamsRLimits ? (ind.williamsRLimitLineStyle ?? "dotted") : undefined,
              bollingerShowUpper: ind.type === "Bollinger" ? (ind.bollingerShowUpper !== false) : undefined,
              bollingerShowLower: ind.type === "Bollinger" ? (ind.bollingerShowLower !== false) : undefined,
              bollingerShowMiddle: ind.type === "Bollinger" ? (ind.bollingerShowMiddle === true) : undefined,
              bollingerBandOpacity: ind.type === "Bollinger" ? (ind.bollingerBandOpacity ?? 0.2) : undefined,
              bollingerLimitsColor: ind.type === "Bollinger" ? (ind.bollingerLimitsColor ?? "#6366f1") : undefined,
              bollingerLimitsLineStyle: ind.type === "Bollinger" ? (ind.bollingerLimitsLineStyle ?? "solid") : undefined,
              bollingerLimitsLineWidth: ind.type === "Bollinger" ? (ind.bollingerLimitsLineWidth ?? "normal") : undefined,
              bollingerMiddleColor: ind.type === "Bollinger" ? (ind.bollingerMiddleColor ?? "#a855f7") : undefined,
              bollingerMiddleLineStyle: ind.type === "Bollinger" ? (ind.bollingerMiddleLineStyle ?? "dashed") : undefined,
              bollingerMiddleLineWidth: ind.type === "Bollinger" ? (ind.bollingerMiddleLineWidth ?? "normal") : undefined,
              keltnerShowUpper: ind.type === "Keltner" ? (ind.keltnerShowUpper !== false) : undefined,
              keltnerShowLower: ind.type === "Keltner" ? (ind.keltnerShowLower !== false) : undefined,
              keltnerShowMiddle: ind.type === "Keltner" ? (ind.keltnerShowMiddle === true) : undefined,
              keltnerBandOpacity: ind.type === "Keltner" ? (ind.keltnerBandOpacity ?? 0.2) : undefined,
              keltnerLimitsColor: ind.type === "Keltner" ? (ind.keltnerLimitsColor ?? "#6366f1") : undefined,
              keltnerLimitsLineStyle: ind.type === "Keltner" ? (ind.keltnerLimitsLineStyle ?? "solid") : undefined,
              keltnerLimitsLineWidth: ind.type === "Keltner" ? (ind.keltnerLimitsLineWidth ?? "normal") : undefined,
              keltnerMiddleColor: ind.type === "Keltner" ? (ind.keltnerMiddleColor ?? "#a855f7") : undefined,
              keltnerMiddleLineStyle: ind.type === "Keltner" ? (ind.keltnerMiddleLineStyle ?? "dashed") : undefined,
              keltnerMiddleLineWidth: ind.type === "Keltner" ? (ind.keltnerMiddleLineWidth ?? "normal") : undefined,
              donchianShowUpper: ind.type === "Donchian" ? (ind.donchianShowUpper !== false) : undefined,
              donchianShowLower: ind.type === "Donchian" ? (ind.donchianShowLower !== false) : undefined,
              donchianShowMiddle: ind.type === "Donchian" ? (ind.donchianShowMiddle === true) : undefined,
              donchianBandOpacity: ind.type === "Donchian" ? (ind.donchianBandOpacity ?? 0.2) : undefined,
              donchianLimitsColor: ind.type === "Donchian" ? (ind.donchianLimitsColor ?? "#6366f1") : undefined,
              donchianLimitsLineStyle: ind.type === "Donchian" ? (ind.donchianLimitsLineStyle ?? "solid") : undefined,
              donchianLimitsLineWidth: ind.type === "Donchian" ? (ind.donchianLimitsLineWidth ?? "normal") : undefined,
              donchianMiddleColor: ind.type === "Donchian" ? (ind.donchianMiddleColor ?? "#a855f7") : undefined,
              donchianMiddleLineStyle: ind.type === "Donchian" ? (ind.donchianMiddleLineStyle ?? "dashed") : undefined,
              donchianMiddleLineWidth: ind.type === "Donchian" ? (ind.donchianMiddleLineWidth ?? "normal") : undefined,
              ichimokuTenkanColor: ind.type === "Ichimoku" ? (ind.ichimokuTenkanColor ?? "#6366f1") : undefined,
              ichimokuTenkanLineWidth: ind.type === "Ichimoku" ? (ind.ichimokuTenkanLineWidth ?? "normal") : undefined,
              ichimokuTenkanLineStyle: ind.type === "Ichimoku" ? (ind.ichimokuTenkanLineStyle ?? "solid") : undefined,
              ichimokuKijunColor: ind.type === "Ichimoku" ? (ind.ichimokuKijunColor ?? "#ea580c") : undefined,
              ichimokuKijunLineWidth: ind.type === "Ichimoku" ? (ind.ichimokuKijunLineWidth ?? "normal") : undefined,
              ichimokuKijunLineStyle: ind.type === "Ichimoku" ? (ind.ichimokuKijunLineStyle ?? "solid") : undefined,
              ichimokuSpanAColor: ind.type === "Ichimoku" ? (ind.ichimokuSpanAColor ?? "#22c55e") : undefined,
              ichimokuSpanALineWidth: ind.type === "Ichimoku" ? (ind.ichimokuSpanALineWidth ?? "normal") : undefined,
              ichimokuSpanALineStyle: ind.type === "Ichimoku" ? (ind.ichimokuSpanALineStyle ?? "solid") : undefined,
              ichimokuSpanBColor: ind.type === "Ichimoku" ? (ind.ichimokuSpanBColor ?? "#ef4444") : undefined,
              ichimokuSpanBLineWidth: ind.type === "Ichimoku" ? (ind.ichimokuSpanBLineWidth ?? "normal") : undefined,
              ichimokuSpanBLineStyle: ind.type === "Ichimoku" ? (ind.ichimokuSpanBLineStyle ?? "solid") : undefined,
              ichimokuChikouColor: ind.type === "Ichimoku" ? (ind.ichimokuChikouColor ?? "#a855f7") : undefined,
              ichimokuChikouLineWidth: ind.type === "Ichimoku" ? (ind.ichimokuChikouLineWidth ?? "normal") : undefined,
              ichimokuChikouLineStyle: ind.type === "Ichimoku" ? (ind.ichimokuChikouLineStyle ?? "solid") : undefined,
              ichimokuCloudOpacity: ind.type === "Ichimoku" ? (typeof ind.ichimokuCloudOpacity === "number" ? Math.max(0, Math.min(0.7, ind.ichimokuCloudOpacity)) : 0.3) : undefined,
              ichimokuDisplacement: ind.type === "Ichimoku" ? (typeof ind.ichimokuDisplacement === "number" ? Math.max(0, Math.min(500, ind.ichimokuDisplacement)) : 26) : undefined,
              ichimokuShowTenkan: ind.type === "Ichimoku" ? (ind.ichimokuShowTenkan !== false) : undefined,
              ichimokuShowKijun: ind.type === "Ichimoku" ? (ind.ichimokuShowKijun !== false) : undefined,
              ichimokuShowSpanA: ind.type === "Ichimoku" ? (ind.ichimokuShowSpanA !== false) : undefined,
              ichimokuShowSpanB: ind.type === "Ichimoku" ? (ind.ichimokuShowSpanB !== false) : undefined,
              ichimokuShowChikou: ind.type === "Ichimoku" ? (ind.ichimokuShowChikou === true) : undefined,
              adxPlusDiColor: ind.type === "ADX" ? (ind.adxPlusDiColor ?? "#22c55e") : undefined,
              adxPlusDiLineWidth: ind.type === "ADX" ? (ind.adxPlusDiLineWidth ?? "normal") : undefined,
              adxPlusDiLineStyle: ind.type === "ADX" ? (ind.adxPlusDiLineStyle ?? "solid") : undefined,
              adxMinusDiColor: ind.type === "ADX" ? (ind.adxMinusDiColor ?? "#ef4444") : undefined,
              adxMinusDiLineWidth: ind.type === "ADX" ? (ind.adxMinusDiLineWidth ?? "normal") : undefined,
              adxMinusDiLineStyle: ind.type === "ADX" ? (ind.adxMinusDiLineStyle ?? "solid") : undefined,
              adxAdxColor: ind.type === "ADX" ? (ind.adxAdxColor ?? "#eab308") : undefined,
              adxAdxLineWidth: ind.type === "ADX" ? (ind.adxAdxLineWidth ?? "normal") : undefined,
              adxAdxLineStyle: ind.type === "ADX" ? (ind.adxAdxLineStyle ?? "solid") : undefined,
              adxFixedScale: ind.type === "ADX" ? (ind.adxFixedScale !== false) : undefined,
              adxLimits: ind.type === "ADX" ? (ind.adxLimits === true) : undefined,
              adxLimitUpper: ind.type === "ADX" && ind.adxLimits ? (ind.adxLimitUpper ?? 25) : undefined,
              adxLimitLower: ind.type === "ADX" && ind.adxLimits ? (ind.adxLimitLower ?? 20) : undefined,
              adxLimitColor: ind.type === "ADX" && ind.adxLimits ? (ind.adxLimitColor ?? "#71717a") : undefined,
              adxLimitLineWidth: ind.type === "ADX" && ind.adxLimits ? (ind.adxLimitLineWidth ?? "normal") : undefined,
              adxLimitLineStyle: ind.type === "ADX" && ind.adxLimits ? (ind.adxLimitLineStyle ?? "dotted") : undefined,
              cciFixedScale: ind.type === "CCI" ? (ind.cciFixedScale === true) : undefined,
              cciLimits: ind.type === "CCI" ? (ind.cciLimits === true) : undefined,
              cciLimitUpper: ind.type === "CCI" && ind.cciLimits ? (ind.cciLimitUpper ?? 100) : undefined,
              cciLimitLower: ind.type === "CCI" && ind.cciLimits ? (ind.cciLimitLower ?? -100) : undefined,
              cciLimitColor: ind.type === "CCI" && ind.cciLimits ? (ind.cciLimitColor ?? "#dc2626") : undefined,
              cciLimitLineWidth: ind.type === "CCI" && ind.cciLimits ? (ind.cciLimitLineWidth ?? "normal") : undefined,
              cciLimitLineStyle: ind.type === "CCI" && ind.cciLimits ? (ind.cciLimitLineStyle ?? "dotted") : undefined,
              cmfFixedScale: ind.type === "CMF" ? (ind.cmfFixedScale === true) : undefined,
              cmfLimits: ind.type === "CMF" ? (ind.cmfLimits === true) : undefined,
              cmfLimitUpper: ind.type === "CMF" && ind.cmfLimits ? (ind.cmfLimitUpper ?? 0.25) : undefined,
              cmfLimitLower: ind.type === "CMF" && ind.cmfLimits ? (ind.cmfLimitLower ?? -0.25) : undefined,
              cmfLimitColor: ind.type === "CMF" && ind.cmfLimits ? (ind.cmfLimitColor ?? "#dc2626") : undefined,
              cmfLimitLineWidth: ind.type === "CMF" && ind.cmfLimits ? (ind.cmfLimitLineWidth ?? "normal") : undefined,
              cmfLimitLineStyle: ind.type === "CMF" && ind.cmfLimits ? (ind.cmfLimitLineStyle ?? "dotted") : undefined,
            };
            })}
            strategyCandleOverlays={strategyCandleOverlays}
            spotOrderMarkers={spotOrderMarkers}
            getLayoutExtraConfig={() => ({
              userIndicators,
              userRegressions,
              strategies,
              appliedStrategyIds,
              volumeAtPriceEnabled,
              volumeAtPriceBuckets,
              volumeAtPricePercent,
              volumeAtPriceOpacity,
              volumeAtPriceWidthPercent,
              volumeAtPriceSide,
              volumeAtPriceColorAbove,
              volumeAtPriceColorBelow,
            })}
            onLayoutConfigLoaded={(config, slot, source) => {
              const uiRaw = config.userIndicators;
              const uiInfo = uiRaw === undefined ? "missing" : Array.isArray(uiRaw) ? `array(${uiRaw.length})` : `typeof=${typeof uiRaw}`;
              addLayoutLoadLog(`onLayoutConfigLoaded slot=${slot ?? "?"} source=${source ?? "?"} userIndicators=${uiInfo} keys=[${Object.keys(config).join(",")}]`);
              // Timeframe e símbolo ficam só no localStorage; não aplicamos do layout.
              // Volume no preço (por layout). Se o layout não tiver a chave, desliga VAP (ex.: default antigo sem essas chaves).
              setVolumeAtPriceEnabled(config.volumeAtPriceEnabled === true && !isAggFastGroupMinutes(groupMinutes));
              if (typeof config.volumeAtPriceBuckets === "number") setVolumeAtPriceBuckets(clampEvenBuckets(config.volumeAtPriceBuckets));
              if (typeof config.volumeAtPricePercent === "number" && config.volumeAtPricePercent >= VOLUME_AT_PRICE_PERCENT_MIN && config.volumeAtPricePercent <= VOLUME_AT_PRICE_PERCENT_MAX) setVolumeAtPricePercent(Math.round(config.volumeAtPricePercent));
              if (typeof config.volumeAtPriceOpacity === "number" && config.volumeAtPriceOpacity >= VOLUME_AT_PRICE_OPACITY_MIN && config.volumeAtPriceOpacity <= VOLUME_AT_PRICE_OPACITY_MAX) setVolumeAtPriceOpacity(config.volumeAtPriceOpacity);
              if (typeof config.volumeAtPriceWidthPercent === "number" && config.volumeAtPriceWidthPercent >= VOLUME_AT_PRICE_WIDTH_PERCENT_MIN && config.volumeAtPriceWidthPercent <= VOLUME_AT_PRICE_WIDTH_PERCENT_MAX) setVolumeAtPriceWidthPercent(config.volumeAtPriceWidthPercent);
              if (config.volumeAtPriceSide === "left" || config.volumeAtPriceSide === "right") setVolumeAtPriceSide(config.volumeAtPriceSide);
              if (typeof config.volumeAtPriceColorAbove === "string" && /^#[0-9A-Fa-f]{6}$/.test(config.volumeAtPriceColorAbove)) setVolumeAtPriceColorAbove(config.volumeAtPriceColorAbove);
              if (typeof config.volumeAtPriceColorBelow === "string" && /^#[0-9A-Fa-f]{6}$/.test(config.volumeAtPriceColorBelow)) setVolumeAtPriceColorBelow(config.volumeAtPriceColorBelow);
              // Indicadores do layout (precisamos deles para validar referências das estratégias)
              let indicatorsFromLayout: unknown = config.userIndicators;
              if (typeof indicatorsFromLayout === "string") {
                try {
                  indicatorsFromLayout = JSON.parse(indicatorsFromLayout) as unknown;
                } catch {
                  indicatorsFromLayout = null;
                }
              }
              if (indicatorsFromLayout !== undefined && indicatorsFromLayout !== null && Array.isArray(indicatorsFromLayout)) {
                addLayoutLoadLog(`replaceUserIndicatorsFromLayout(${indicatorsFromLayout.length} items)`);
                replaceUserIndicatorsFromLayout(indicatorsFromLayout);
                flushSync(() => {});
              } else {
                addLayoutLoadLog(`layout sem userIndicators válido (array): skip replace`);
              }

              if (Object.prototype.hasOwnProperty.call(config, "userRegressions")) {
                replaceUserRegressionsFromLayout(config.userRegressions);
                flushSync(() => {});
              }

              // Estratégias do layout (precisamos da lista para validar e aplicar os IDs)
              const strategiesFromLayoutRaw = (config.strategies !== undefined && Array.isArray(config.strategies)) ? config.strategies : null;
              const appliedIds =
                slot !== 0 && config.appliedStrategyIds !== undefined && Array.isArray(config.appliedStrategyIds)
                  ? config.appliedStrategyIds.filter((x): x is string => typeof x === "string")
                  : null;
              const indicatorsForValidation = (Array.isArray(indicatorsFromLayout) ? indicatorsFromLayout : userIndicators) as UserIndicatorConfig[];
              const indicatorIds = new Set<string>(
                indicatorsForValidation.map((i) => (i && typeof i === "object" && typeof i.id === "string" ? String(i.id) : "")).filter(Boolean)
              );
              const layoutGroupMinutes = typeof config.groupMinutes === "number" ? config.groupMinutes : groupMinutes;
              const strategiesList: Strategy[] = strategiesFromLayoutRaw
                ? strategiesFromLayoutRaw.map((s: unknown) => legacyToRoot(s as Strategy & { conditions?: unknown; combineWith?: unknown }))
                : strategies;
              const byId = new Map<string, Strategy>(strategiesList.map((s) => [s.id, s]));
              const appliedIdsSet = appliedIds != null ? new Set(appliedIds) : new Set<string>();
              const validApplied =
                appliedIds != null
                  ? appliedIds.filter((id) => {
                      const st = byId.get(id);
                      if (!st) return false;
                      // Combinada: referenciadas só precisam existir no layout (o gráfico as avalia como dependência).
                      const strategyIdsForValidation = st.isCombined
                        ? new Set(strategiesList.map((s) => s.id))
                        : appliedIdsSet;
                      const stForValidation: Strategy = { ...st, intervalMinutes: layoutGroupMinutes };
                      return validateStrategyReferences(stForValidation, indicatorIds, strategyIdsForValidation, {
                        userIndicators: indicatorsForValidation,
                      }).ok;
                    })
                  : null;
              if (config.strategies !== undefined) {
                const raw = config.strategies as { intervalMinutes?: number; applyToAllSymbols?: boolean; symbol?: string }[];
                const forContext = raw.map((s) => ({
                  ...s,
                  intervalMinutes: layoutGroupMinutes,
                  applyToAllSymbols: s.applyToAllSymbols ?? true,
                  symbol: s.symbol ?? symbol,
                }));
                replaceStrategiesFromLayout(forContext);
              }
              flushSync(() => {});

              // Aplicar appliedIds no próximo tick: React já commitou indicadores e estratégias,
              // extendedKlines tem as colunas; aí appliedIds → visibleStrategies → strategyResults → overlays.
              if (validApplied != null) {
                addLayoutLoadLog(`reaplicar appliedStrategyIds no próximo tick (setTimeout 0)`);
                setTimeout(() => {
                  replaceAppliedStrategyIdsFromLayout(validApplied);
                  setLayoutAppliedTick((t) => t + 1);
                  addLayoutLoadLog(`replaceAppliedStrategyIds slot=${slot} appliedIds=${appliedIds!.length} validApplied=${validApplied.length}`);
                }, 0);
              } else {
                addLayoutLoadLog(`não replaceApplied: slot=${slot}`);
                flushSync(() => setLayoutAppliedTick((t) => t + 1));
              }
            }}
          />
          {(lastUpdate != null || spotWsUpdatedAt != null) && (
            <div className="w-full flex items-center mt-1 pb-0.5 px-0.5 pr-3">
              <span className="flex-1 text-[10px] text-zinc-500 truncate text-left min-w-0" title={currentLayoutLabel ?? undefined}>
                {currentLayoutLabel ?? ""}
              </span>
              <span className="text-[10px] text-zinc-500 text-center shrink-0">
                {t.lastUpdate}: {formatTime(effectiveLastDisplayMs)}
              </span>
              <span className="flex-1 flex justify-end shrink-0 pr-1">
                <span
                  className="w-2 h-2 rounded-full"
                  title={
                    (() => {
                      const ageMs = Date.now() - effectiveLastActivityRealMs;
                      if (ageMs < 60000) return t.statusOnline ?? "Atualizado há menos de 1 min";
                      if (ageMs < 300000) return t.statusDelayed ?? "Atraso entre 1 e 5 min";
                      return t.statusStale ?? "Atraso acima de 5 min";
                    })()
                  }
                  aria-hidden
                  style={{
                    backgroundColor: (() => {
                      const ageMs = Date.now() - effectiveLastActivityRealMs;
                      if (ageMs < 60000) return "#22c55e";
                      if (ageMs < 300000) return "#f97316";
                      return "#ef4444";
                    })(),
                  }}
                />
              </span>
            </div>
          )}
        </div>
      {showKlinesTable && (
      <div className="min-h-0 overflow-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-100 text-zinc-700 text-left">
            <tr>
              <th
                className="px-3 py-2 font-medium text-right w-12"
                title={tk.barNumberHint}
              >
                {tk.barNumber ?? "Bar"}
              </th>
              <th className="px-3 py-2 font-medium">{t.openTime}</th>
              <th className="px-3 py-2 font-medium text-right">{t.open}</th>
              <th className="px-3 py-2 font-medium text-right">{t.high}</th>
              <th className="px-3 py-2 font-medium text-right">{t.low}</th>
              <th className="px-3 py-2 font-medium text-right">{t.close}</th>
              <th className="px-3 py-2 font-medium text-right">{t.volumeBtc}</th>
              <th className="px-3 py-2 font-medium text-right">{t.closeTime}</th>
              <th className="px-3 py-2 font-medium text-right">{t.quoteVol}</th>
              <th className="px-3 py-2 font-medium text-right">{t.trades}</th>
              <th className="px-3 py-2 font-medium text-right">{t.takerBuyBase}</th>
              <th className="px-3 py-2 font-medium text-right">{t.takerBuyQuote}</th>
              {visibleIndicatorColumns.map(({ ind, columnIndex, isSignal, isHistogram, adxPart, ichimokuPart }, idx) => {
                const ichimokuPartLabels: Record<IchimokuPart, string> = { tenkan: "Tenkan", kijun: "Kijun", spanA: "Span A", spanB: "Span B", chikou: "Chikou" };
                const headerBorderColor = ind.type === "Ichimoku" && ichimokuPart ? (ichimokuPart === "tenkan" ? (ind.ichimokuTenkanColor ?? "#6366f1") : ichimokuPart === "kijun" ? (ind.ichimokuKijunColor ?? "#ea580c") : ichimokuPart === "spanA" ? (ind.ichimokuSpanAColor ?? "#22c55e") : ichimokuPart === "spanB" ? (ind.ichimokuSpanBColor ?? "#ef4444") : (ind.ichimokuChikouColor ?? "#a855f7")) : ind.type === "Volume" ? (ind.volumeColorAbove ?? "#10b981") : adxPart === "plusDi" ? (ind.adxPlusDiColor ?? "#22c55e") : adxPart === "minusDi" ? (ind.adxMinusDiColor ?? "#ef4444") : adxPart === "adx" ? (ind.adxAdxColor ?? "#eab308") : isHistogram ? (ind.type === "DIFF" ? (ind.diffHistogramColorAbove ?? "#059669") : (ind.macdHistogramColorAbove ?? "#059669")) : isSignal ? (ind.type === "DIFF" ? (ind.diffSignalColor ?? "#ea580c") : (ind.macdSignalColor ?? "#ea580c")) : ind.type === "Bollinger" ? (ind.bollingerLimitsColor ?? "#6366f1") : ind.type === "Donchian" ? (ind.donchianLimitsColor ?? "#6366f1") : ind.color;
                const headerLabel = ind.type === "Ichimoku" && ichimokuPart ? ichimokuPartLabels[ichimokuPart] : ind.type === "Volume" ? (ind.volumeInUsdt ? ((t as Record<string, string>).volumeUsdtLabel ?? "Volume (USDT)") : ((t as Record<string, string>).volumeLabel ?? "Volume")) : adxPart === "plusDi" ? `+DI(${ind.period})` : adxPart === "minusDi" ? `-DI(${ind.period})` : adxPart === "adx" ? `ADX(${ind.period})` : isHistogram ? ((t as Record<string, string>).macdHistogramLabel ?? "MACD Hist") : isSignal ? (ind.type === "Stochastic" ? `%D(${ind.stochDPeriod ?? 3})` : ind.type === "DIFF" ? `DIFF Sig(${ind.diffSignalPeriod ?? 9})` : `MACD Sig(${ind.macdSignalPeriod ?? 9})`) : ind.type === "MACD" ? `MACD(${ind.macdFastPeriod ?? 12},${ind.macdSlowPeriod ?? 26})` : ind.type === "DIFF" ? (ind.diffRelativePercent ? ((t as Record<string, string>).diffTableHeaderRelative ?? "DIFF%((B-A)/A)") : ((t as Record<string, string>).diffTableHeaderAbsolute ?? "DIFF(B-A)")) : ind.type === "MA_ANGLE" ? `MA∠(${(ind.maAngleMaType === "SMA" || ind.maAngleMaType === "EMA" || ind.maAngleMaType === "WMA" || ind.maAngleMaType === "HMA" || ind.maAngleMaType === "VWMA") ? ind.maAngleMaType : "EMA"},${ind.period},L${ind.maAngleLookback ?? 3})` : ind.type === "Stochastic" ? `%K(${ind.period})` : ind.type === "WilliamsR" ? `%R(${ind.period})` : ind.type === "OBV" ? "OBV(1)" : ind.type === "AD" ? "A/D" : ind.type === "Bollinger" ? `BB(${ind.period}) Z=${ind.bollingerZ ?? 2}` : ind.type === "Donchian" ? `DC(${ind.period})` : ind.type === "Ichimoku" ? `Ichimoku(${ind.ichimokuTenkanPeriod ?? 9}/${ind.ichimokuKijunPeriod ?? 26}/${ind.ichimokuSpanBPeriod ?? 52})` : ind.type === "CCI" ? `CCI(${ind.period})` : ind.type === "CMF" ? `CMF(${ind.period})` : `${ind.type}(${ind.period})`;
                return (
                <th
                  key={`${ind.id}-${adxPart ?? ichimokuPart ?? (isSignal ? "sig" : isHistogram ? "hist" : "main")}-${idx}`}
                  className="px-3 py-2 font-medium text-right text-xs"
                  style={{ borderLeftColor: headerBorderColor, borderLeftWidth: 2, borderLeftStyle: "solid" }}
                >
                  {headerLabel}
                </th>
              ); })}
              {visibleStrategies.map((strategy) => (
                <th
                  key={strategy.id}
                  className="px-3 py-2 font-medium text-right text-xs border-l-2 border-l-violet-300 bg-violet-50/50"
                >
                  {strategy.name}
                </th>
              ))}
              {activeBuyerRobots.map((robot) => (
                <th
                  key={`robot_buy_exec_${robot.id}`}
                  className="px-3 py-2 font-medium text-center text-xs border-l-2 border-l-amber-300 bg-amber-50/60 tabular-nums"
                  title={
                    (tk as Record<string, string>).robotsTableBuyExecHint ??
                    "Buyer robot: 1 after buy executed on this candle (only once per candle). Older rows: 1 if buy OR was true."
                  }
                >
                  {(tk as Record<string, string>).robotsTableBuyExecCol?.replace("{id}", robot.id.slice(-6)) ??
                    `B·${robot.id.slice(-6)}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {extendedKlines.map((k, i) => {
              const barNum = extendedKlines.length - i;
              const baseCols = (
                <>
                  <td
                    className="px-3 py-1.5 text-right font-mono text-zinc-500 tabular-nums"
                    title={tk.barNumberHint}
                  >
                    {barNum}
                  </td>
                  <td className="px-3 py-1.5 text-zinc-600 whitespace-nowrap">{formatTime(Number(k[0]))}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatNum(String(k[1]))}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-600">{formatNum(String(k[2]))}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-red-600">{formatNum(String(k[3]))}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatNum(String(k[4]))}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-500">{formatNum(String(k[5]))}</td>
                  <td className="px-3 py-1.5 text-zinc-600 whitespace-nowrap">{formatTime(Number(k[6]))}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-500">{formatNum(String(k[7]))}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatInt(Number(k[8]))}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-500">{formatNum(String(k[9]))}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-500">{formatNum(String(k[10]))}</td>
                </>
              );
              const userCols = visibleIndicatorColumns.map(({ ind, columnIndex, isSignal, isHistogram, adxPart, ichimokuPart }, idx) => {
                const val = k[columnIndex];
                const borderColor = ind.type === "Ichimoku" && ichimokuPart ? (ichimokuPart === "tenkan" ? (ind.ichimokuTenkanColor ?? "#6366f1") : ichimokuPart === "kijun" ? (ind.ichimokuKijunColor ?? "#ea580c") : ichimokuPart === "spanA" ? (ind.ichimokuSpanAColor ?? "#22c55e") : ichimokuPart === "spanB" ? (ind.ichimokuSpanBColor ?? "#ef4444") : (ind.ichimokuChikouColor ?? "#a855f7")) : ind.type === "ADX" && adxPart ? (adxPart === "plusDi" ? (ind.adxPlusDiColor ?? "#22c55e") : adxPart === "minusDi" ? (ind.adxMinusDiColor ?? "#ef4444") : (ind.adxAdxColor ?? "#eab308")) : isHistogram ? (ind.macdHistogramColorAbove ?? "#059669") : isSignal ? (ind.macdSignalColor ?? "#ea580c") : ind.type === "Bollinger" ? (ind.bollingerLimitsColor ?? "#6366f1") : ind.type === "Donchian" ? (ind.donchianLimitsColor ?? "#6366f1") : ind.color;
                return (
                  <td
                    key={`${ind.id}-${adxPart ?? ichimokuPart ?? (isSignal ? "sig" : isHistogram ? "hist" : "main")}-${idx}`}
                    className="px-3 py-1.5 text-right font-mono text-zinc-500"
                    style={{ borderLeftColor: borderColor, borderLeftWidth: 1, borderLeftStyle: "solid" }}
                  >
                    {val != null && Number.isFinite(Number(val)) ? formatNum(String(val)) : "—"}
                  </td>
                );
              });
              const strategyCols = visibleStrategies.map((strategy) => {
                const rowResult = strategyResults.get(strategy.id)?.[i];
                return (
                  <td
                    key={strategy.id}
                    className={`px-3 py-1.5 text-center font-medium border-l border-l-violet-200 ${rowResult ? "text-emerald-600 bg-emerald-50/50" : "text-zinc-400"}`}
                  >
                    {rowResult ? "✓" : "—"}
                  </td>
                );
              });
              const symUpper = symbol?.trim().toUpperCase() ?? "";
              const robotBuyExecCols = activeBuyerRobots.map((robot) => {
                const ot = String(k[0]);
                const latched =
                  symUpper.length > 0 && hasRobotBuyExecForCandle(buyExecMap, robot.id, symUpper, ot);
                const cond = robotBuyOrTrue(robot, i, strategyResults);
                const v = i === 0 ? (latched ? 1 : 0) : cond ? 1 : 0;
                return (
                  <td
                    key={`robot_buy_exec_${robot.id}`}
                    className={`px-3 py-1.5 text-center font-mono text-xs border-l border-l-amber-200 tabular-nums ${
                      v === 1 ? "text-amber-900 bg-amber-50/50 font-semibold" : "text-zinc-400"
                    }`}
                  >
                    {v}
                  </td>
                );
              });
              return (
                <tr key={i} className="border-t border-zinc-100 hover:bg-zinc-50">
                  {baseCols}
                  {userCols}
                  {strategyCols}
                  {robotBuyExecCols}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
    <RobotBacktestResultModal
      open={backtestModal != null}
      onClose={closeBacktestModal}
      robot={backtestModal?.robot ?? null}
      result={backtestModal?.result ?? null}
      isAdmin={isAdmin}
      t={tk}
    />
    </>
  );
}
