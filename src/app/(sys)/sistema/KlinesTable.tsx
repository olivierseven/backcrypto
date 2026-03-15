"use client";

import { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback } from "react";
import { flushSync } from "react-dom";
import { API_BASE } from "@/app/constants";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { computeSmaColumn, computeEmaColumn, computeWmaColumn, computeRsiColumn, computeMfiColumn, computeMacdColumn, computeStochasticKColumn, computeWilliamsRColumn, computeObvColumn, computeAdColumn, computeParabolicSarColumn, computeAtrColumn, computeVwapColumn, computeBollingerBands, computeKeltnerChannels, computeDonchianChannels, computeAdxColumns, computeCciColumn, computeCmfColumn, computeHmaColumn, computeVwmaColumn, computeIchimokuColumns } from "@/app/api/binance/klines/indicators";
import { useKlinesIndicators, getDataAndValueIndexForIndicator } from "./KlinesIndicatorsContext";
import { useSistemaDebug } from "./SistemaDebugContext";
import { useChartHeader } from "./ChartHeaderContext";
import { useChartSymbol } from "./ChartSymbolContext";
import { useStrategies } from "./strategies/StrategiesContext";
import { legacyToRoot, strategiesForContext, validateStrategyReferences, collectSeriesKeys, type Strategy } from "./strategies/strategiesTypes";
import { evaluateNode } from "./strategies/strategyEvaluator";
import { Y_AXIS_WIDTH, KLINE_GROUP_MINUTES_KEY, KLINE_HEIKIN_ASHI_KEY, KLINE_VOLUME_AT_PRICE_KEY } from "./KlinesChartConstants";

/** Largura reservada à direita para a barra de rolagem vertical ficar fora do gráfico (não cobrir o eixo Y). */
const SCROLLBAR_GUTTER = 17;
/** Teto do plot em 100% (igual a KlinesChart MAX_PLOT_WIDTH_BASE). Largura máxima total = 660px (600 plot + 60 eixo). */
const MAX_PLOT_WIDTH = 600;
import { formatAbbreviated } from "./klinesFormatters";
import { getIndicatorLabel, getIndicatorLabelShort, getIndicatorLabelSignal, getIndicatorLabelShortSignal, getIndicatorLabelStochD, getIndicatorLabelShortStochD } from "./IndicatorsPanel";
import { INDICATOR_COLOR_PALETTE } from "./indicatorsPanel/index";
import KlinesChart from "./KlinesChart";

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

const REFRESH_MS = 1 * 60 * 1000; // 1 min

const INTERVAL_OPTIONS_BASE: { value: number; label: string; param: string }[] = [
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
  { value: 10080, label: "1S", param: "1w" },
  { value: 43200, label: "1M", param: "1M" },
];

/** Timeframe padrão quando não definido no localStorage: 1 dia. */
const DEFAULT_GROUP_MINUTES_FIRST_LOAD = 1440; // 1D (1 dia)

/** Opções de intervalo: admin vê também 1m. */
function getIntervalOptions(isAdmin: boolean): { value: number; label: string; param: string }[] {
  if (!isAdmin) return INTERVAL_OPTIONS_BASE;
  return [{ value: 1, label: "1m", param: "1m" }, ...INTERVAL_OPTIONS_BASE];
}

function getStoredGroupMinutes(isAdmin: boolean): number {
  if (typeof window === "undefined") return DEFAULT_GROUP_MINUTES_FIRST_LOAD;
  try {
    const raw = window.localStorage.getItem(KLINE_GROUP_MINUTES_KEY);
    const n = Number(raw);
    const opts = getIntervalOptions(isAdmin);
    if (Number.isFinite(n) && opts.some((o) => o.value === n)) return n;
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
    43200: { param: "1w", maxCandles: 600, paramLabel: "1S", paramMinutes: 10080 },
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
  const { showKlinesTable, addLayoutLoadLog } = useSistemaDebug();
  const { setHeaderData } = useChartHeader();
  const { symbol, openSymbolPanel } = useChartSymbol();
  const { userIndicators, setCurrentGroupMinutes, replaceUserIndicatorsFromLayout } = useKlinesIndicators();
  const { strategies, appliedStrategyIds, replaceStrategiesFromLayout, replaceAppliedStrategyIdsFromLayout } = useStrategies();
  const intervalOptions = getIntervalOptions(isAdmin);
  const [groupMinutes, setGroupMinutes] = useState(DEFAULT_GROUP_MINUTES_FIRST_LOAD);
  /** Incrementa ao aplicar layout (carregar da API) para forçar gráfico a receber strategyCandleOverlays. */
  const [layoutAppliedTick, setLayoutAppliedTick] = useState(0);
  /** Só true após restaurar do localStorage no cliente; evita fetch com 1M antes de aplicar o timeframe salvo. */
  const [timeframeRestored, setTimeframeRestored] = useState(false);
  useLayoutEffect(() => {
    const stored = getStoredGroupMinutes(isAdmin);
    setGroupMinutes(stored);
    setTimeframeRestored(true);
  }, [isAdmin]);
  const [klines, setKlines] = useState<Kline[]>([]);
  const [vapCacheKlines, setVapCacheKlines] = useState<Kline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  /** Timestamp da última mensagem recebida do WebSocket (miniTicker); usado na bolinha de status. */
  const [lastWsActivityAt, setLastWsActivityAt] = useState<number | null>(null);
  /** Tick para re-render da bolinha de status (atualiza a cada 15s). */
  const [, setStatusTick] = useState(0);
  /** Fuso do utilizador (API aplica a openTime/closeTime); usado para contar fechamento do candle em UTC. */
  const [timezoneOffset, setTimezoneOffset] = useState(0);
  const [spot, setSpot] = useState<{ currentClose: string | null; prevDayClose: string | null }>({ currentClose: null, prevDayClose: null });
  const [spotWsPrice, setSpotWsPrice] = useState<string | null>(null);
  const [spotWsHigh, setSpotWsHigh] = useState<number | null>(null);
  const [spotWsLow, setSpotWsLow] = useState<number | null>(null);
  const lastSpotPersistAtRef = useRef(0);
  const symbolRef = useRef(symbol);
  const lastKlinesFetchSymbolRef = useRef<string | null>(null);
  symbolRef.current = symbol;
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(600);
  const [chartContainerHeight, setChartContainerHeight] = useState(0);
  const [chartRequestedWidth, setChartRequestedWidth] = useState<number | null>(null);
  const [chartReportedSizePercent, setChartReportedSizePercent] = useState(100);
  const [currentLayoutLabel, setCurrentLayoutLabel] = useState<string | null>(null);
  const [heikinAshiEnabled, setHeikinAshiEnabled] = useState(false);
  useLayoutEffect(() => {
    setHeikinAshiEnabled(getStoredHeikinAshi());
  }, []);

  const [volumeAtPriceEnabled, setVolumeAtPriceEnabled] = useState(false);
  const [volumeAtPriceBuckets, setVolumeAtPriceBuckets] = useState(20);
  const [volumeAtPricePercent, setVolumeAtPricePercent] = useState(VOLUME_AT_PRICE_PERCENT_DEFAULT);
  const [volumeAtPriceOpacity, setVolumeAtPriceOpacity] = useState(40);
  const [volumeAtPriceSide, setVolumeAtPriceSide] = useState<"left" | "right">("left");
  const [volumeAtPriceColorAbove, setVolumeAtPriceColorAbove] = useState("#059669");
  const [volumeAtPriceColorBelow, setVolumeAtPriceColorBelow] = useState("#dc2626");
  const [volumeAtPriceWidthPercent, setVolumeAtPriceWidthPercent] = useState(100);
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
    if (spotWsPrice == null || klines.length === 0) return klines;
    const p = Number(spotWsPrice);
    if (!Number.isFinite(p)) return klines;
    const first = klines[0] as (string | number)[];
    const out = [...klines] as unknown as (string | number)[][];
    const next0 = [...first] as (string | number)[];
    // OHLC: [1]=open [2]=high [3]=low [4]=close. Só usa spotWsHigh/spotWsLow se os klines forem do símbolo atual (evita mínima do ETH no candle de BTC).
    const baseHigh = Number(next0[2]);
    const baseLow = Number(next0[3]);
    next0[4] = spotWsPrice;
    const useWsExtremes = lastKlinesFetchSymbolRef.current === symbol;
    const hi = useWsExtremes && spotWsHigh != null ? spotWsHigh : (Number.isFinite(baseHigh) ? Math.max(baseHigh, p) : p);
    const lo = useWsExtremes && spotWsLow != null ? spotWsLow : (Number.isFinite(baseLow) ? Math.min(baseLow, p) : p);
    next0[2] = String(hi);
    next0[3] = String(lo);
    out[0] = next0;
    return out as unknown as Kline[];
  }, [klines, spotWsPrice, spotWsHigh, spotWsLow, symbol]);

  const heikinAshiKlines = useMemo(() => computeHeikinAshi(klinesWithSpot), [klinesWithSpot]);
  const baseForIndicators = heikinAshiEnabled ? heikinAshiKlines : klinesWithSpot;

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
    const out = base.map((row) => [...row] as (string | number | null)[]);
    /** Indicadores só leem colunas 0–11 (OHLC etc.); fazer cast para satisfazer a API. */
    const data = out as (string | number)[][];
    for (let u = 0; u < userIndicators.length; u++) {
      const ind = userIndicators[u];
      if (ind.type === "Volume") continue;
      const { data: dataForInd, valueIndex } = getDataAndValueIndexForIndicator(data, ind.fieldKey, userIndicators);
      const period = Math.max(1, Math.min(500, ind.period));
      if (ind.type === "MACD") {
        const col = computeMacdColumn(
          dataForInd,
          valueIndex,
          ind.macdFastMaType ?? "EMA",
          ind.macdFastPeriod ?? 12,
          ind.macdSlowMaType ?? "EMA",
          ind.macdSlowPeriod ?? 26
        );
        for (let i = 0; i < out.length; i++) out[i].push(col[i] ?? null);
        if (ind.macdSignalLine) {
          const macdColIndex = out[0].length - 1;
          const signalPeriod = Math.max(1, Math.min(500, ind.macdSignalPeriod ?? 9));
          const signalCol =
            (ind.macdSignalMaType ?? "EMA") === "EMA"
              ? computeEmaColumn(out, macdColIndex, signalPeriod)
              : (ind.macdSignalMaType ?? "EMA") === "WMA"
                ? computeWmaColumn(out, macdColIndex, signalPeriod)
                : computeSmaColumn(out, macdColIndex, signalPeriod);
          for (let i = 0; i < out.length; i++) out[i].push(signalCol[i] ?? null);
          if (ind.macdHistogram) {
            const signalColIndex = out[0].length - 1;
            for (let i = 0; i < out.length; i++) {
              const macdVal = out[i][macdColIndex];
              const sigVal = out[i][signalColIndex];
              const hist = macdVal != null && sigVal != null && Number.isFinite(Number(macdVal)) && Number.isFinite(Number(sigVal))
                ? (Number(macdVal) - Number(sigVal))
                : null;
              out[i].push(hist);
            }
          }
        }
      } else if (ind.type === "Stochastic") {
        const kCol = computeStochasticKColumn(dataForInd, period, valueIndex);
        for (let i = 0; i < out.length; i++) out[i].push(kCol[i] ?? null);
        if (ind.stochDLine) {
          const kColIndex = out[0].length - 1;
          const dPeriod = Math.max(1, Math.min(500, ind.stochDPeriod ?? 3));
          const dCol =
            (ind.stochDMaType ?? "SMA") === "EMA"
              ? computeEmaColumn(out, kColIndex, dPeriod)
              : (ind.stochDMaType ?? "SMA") === "WMA"
                ? computeWmaColumn(out, kColIndex, dPeriod)
                : computeSmaColumn(out, kColIndex, dPeriod);
          for (let i = 0; i < out.length; i++) out[i].push(dCol[i] ?? null);
        }
      } else if (ind.type === "WilliamsR") {
        const wrValueIndex = (valueIndex === 1 || valueIndex === 4) ? valueIndex : 4;
        const wrCol = computeWilliamsRColumn(dataForInd, period, wrValueIndex);
        for (let i = 0; i < out.length; i++) out[i].push(wrCol[i] ?? null);
      } else if (ind.type === "OBV") {
        const volIdx = ind.obvVolumeSource === "usdt" ? 7 : 5;
        const col = computeObvColumn(data, volIdx);
        for (let i = 0; i < out.length; i++) out[i].push(col[i] ?? null);
      } else if (ind.type === "AD") {
        const volIdx = ind.adVolumeSource === "usdt" ? 7 : 5;
        const col = computeAdColumn(data, volIdx);
        for (let i = 0; i < out.length; i++) out[i].push(col[i] ?? null);
      } else if (ind.type === "SAR") {
        const start = typeof ind.sarStart === "number" ? Math.max(0.001, Math.min(1, ind.sarStart)) : 0.02;
        const inc = typeof ind.sarIncrement === "number" ? Math.max(0.001, Math.min(1, ind.sarIncrement)) : 0.02;
        const max = typeof ind.sarMax === "number" ? Math.max(0.02, Math.min(1, ind.sarMax)) : 0.2;
        const col = computeParabolicSarColumn(data, start, inc, max);
        for (let i = 0; i < out.length; i++) out[i].push(col[i] ?? null);
      } else if (ind.type === "ATR") {
        const col = computeAtrColumn(data, period);
        for (let i = 0; i < out.length; i++) out[i].push(col[i] ?? null);
      } else if (ind.type === "VWAP") {
        const col = computeVwapColumn(data);
        for (let i = 0; i < out.length; i++) out[i].push(col[i] ?? null);
      } else if (ind.type === "Bollinger") {
        const z = typeof ind.bollingerZ === "number" ? Math.max(0, Math.min(3, ind.bollingerZ)) : 2;
        const { upper, middle, lower } = computeBollingerBands(dataForInd, valueIndex, period, ind.bollingerMaType ?? "SMA", z);
        for (let i = 0; i < out.length; i++) {
          out[i].push(upper[i] ?? null);
          out[i].push(middle[i] ?? null);
          out[i].push(lower[i] ?? null);
        }
      } else if (ind.type === "Keltner") {
        const mult = typeof ind.keltnerMultiplier === "number" ? Math.max(0, Math.min(10, ind.keltnerMultiplier)) : 2;
        const { upper, middle, lower } = computeKeltnerChannels(data, valueIndex, period, ind.keltnerMaType ?? "EMA", mult);
        for (let i = 0; i < out.length; i++) {
          out[i].push(upper[i] ?? null);
          out[i].push(middle[i] ?? null);
          out[i].push(lower[i] ?? null);
        }
      } else if (ind.type === "Donchian") {
        const { upper, middle, lower } = computeDonchianChannels(dataForInd, period);
        for (let i = 0; i < out.length; i++) {
          out[i].push(upper[i] ?? null);
          out[i].push(middle[i] ?? null);
          out[i].push(lower[i] ?? null);
        }
      } else if (ind.type === "Ichimoku") {
        const tenkanP = typeof ind.ichimokuTenkanPeriod === "number" ? Math.max(1, Math.min(500, ind.ichimokuTenkanPeriod)) : 9;
        const kijunP = typeof ind.ichimokuKijunPeriod === "number" ? Math.max(1, Math.min(500, ind.ichimokuKijunPeriod)) : 26;
        const spanBP = typeof ind.ichimokuSpanBPeriod === "number" ? Math.max(1, Math.min(500, ind.ichimokuSpanBPeriod)) : 52;
        const disp = typeof ind.ichimokuDisplacement === "number" ? Math.max(0, Math.min(500, ind.ichimokuDisplacement)) : 26;
        const { tenkan, kijun, spanBRaw, chikou } = computeIchimokuColumns(data, tenkanP, kijunP, spanBP, disp);
        for (let i = 0; i < out.length; i++) {
          const t = tenkan[i];
          const k = kijun[i];
          const spanA = t != null && k != null ? (t + k) / 2 : null;
          out[i].push(t ?? null);
          out[i].push(k ?? null);
          out[i].push(spanA);
          out[i].push(spanBRaw[i] ?? null);
          out[i].push(chikou[i] ?? null);
        }
      } else if (ind.type === "ADX") {
        const { plusDi, minusDi, adx } = computeAdxColumns(data, period);
        for (let i = 0; i < out.length; i++) {
          out[i].push(plusDi[i] ?? null);
          out[i].push(minusDi[i] ?? null);
          out[i].push(adx[i] ?? null);
        }
      } else if (ind.type === "CCI") {
        const col = computeCciColumn(dataForInd, valueIndex, period);
        for (let i = 0; i < out.length; i++) out[i].push(col[i] ?? null);
      } else if (ind.type === "CMF") {
        const col = computeCmfColumn(data, period);
        for (let i = 0; i < out.length; i++) out[i].push(col[i] ?? null);
      } else if (ind.type === "MFI") {
        const col = computeMfiColumn(data, period);
        for (let i = 0; i < out.length; i++) out[i].push(col[i] ?? null);
      } else {
        const col =
          ind.type === "EMA"
            ? computeEmaColumn(dataForInd, valueIndex, period)
            : ind.type === "WMA"
              ? computeWmaColumn(dataForInd, valueIndex, period)
              : ind.type === "HMA"
                ? computeHmaColumn(dataForInd, valueIndex, period)
                : ind.type === "VWMA"
                  ? computeVwmaColumn(dataForInd, valueIndex, period)
                  : ind.type === "RSI"
                    ? computeRsiColumn(dataForInd, valueIndex, period)
                    : computeSmaColumn(dataForInd, valueIndex, period);
        for (let i = 0; i < out.length; i++) out[i].push(col[i] ?? null);
      }
    }
    return out as Kline[];
  }, [baseForIndicators, userIndicators]);

  /** Índice da primeira coluna de cada indicador. MACD: 1 col; MACD+sinal: 2 col; MACD+sinal+histograma: 3 col. Stochastic: 1 col; Stoch+%D: 2 col. */
  const getIndicatorColumnStart = useCallback((indicatorIndex: number) => {
    let col = 12;
    for (let i = 0; i < indicatorIndex; i++) {
      const ind = userIndicators[i];
      if (ind.type === "MACD") {
        col += 1 + (ind.macdSignalLine ? 1 : 0) + (ind.macdHistogram ? 1 : 0);
      } else if (ind.type === "Stochastic") {
        col += 1 + (ind.stochDLine ? 1 : 0);
      } else if (ind.type === "WilliamsR") {
        col += 1;
      } else if (ind.type === "Bollinger" || ind.type === "Keltner" || ind.type === "Donchian") {
        col += 3;
      } else if (ind.type === "Ichimoku") {
        col += 5;
      } else if (ind.type === "ADX") {
        col += 3;
      } else if (ind.type === "Volume") {
        // Volume usa coluna 5 ou 7, não consome slot
      } else if (ind.type === "OBV" || ind.type === "SAR" || ind.type === "ATR" || ind.type === "VWAP" || ind.type === "CCI" || ind.type === "CMF" || ind.type === "MFI") {
        col += 1;
      } else {
        col += 1;
      }
    }
    return col;
  }, [userIndicators]);

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
    }));
  }, [visibleStrategies, strategyResults, layoutAppliedTick]);

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
      if (ind.type === "Stochastic" && ind.stochDLine) list.push({ ind, columnIndex: start + 1, isSignal: true, isHistogram: false });
      /* Bollinger: single entry with columnIndex = first of 3 cols (upper, middle, lower) */
    }
    return list;
  }, [userIndicators, groupMinutes, getIndicatorColumnStart]);

  useEffect(() => {
    setCurrentGroupMinutes(groupMinutes);
  }, [groupMinutes, setCurrentGroupMinutes]);

  const handleIntervalChange = useCallback((value: number) => {
    setGroupMinutes(value);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(KLINE_GROUP_MINUTES_KEY, String(value));
    } catch {
      /* ignore */
    }
  }, []);

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

  const fetchKlines = async () => {
    const requestedSymbol = symbolRef.current;
    try {
      setError(null);
      setNeedsRefresh(false);
      const intervalParam = intervalOptions.find((o) => o.value === groupMinutes)?.param ?? "1M";
      const res = await fetch(
        `${API_BASE}/binance/klines?symbol=${encodeURIComponent(requestedSymbol)}&interval=${intervalParam}&limit=1000`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      const list = Array.isArray(body) ? body : (body.klines ?? []);
      if (symbolRef.current !== requestedSymbol) return;
      lastKlinesFetchSymbolRef.current = requestedSymbol;
      setKlines(list);
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
      // Última atualização sempre da BinanceKlineFast (1m), vinda da API (lastUpdateUtc)
      const lastUtc = !Array.isArray(body) && body.lastUpdateUtc != null ? Number(body.lastUpdateUtc) : null;
      setLastUpdate(lastUtc != null ? new Date(lastUtc) : (list.length > 0 && list[0][0] != null ? new Date(Number(list[0][0])) : new Date()));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorLoad);
      setKlines([]);
      setNeedsRefresh(false);
    } finally {
      setLoading(false);
    }
  };

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
    setSpot({ currentClose: null, prevDayClose: null });
    setSpotWsPrice(null);
    setSpotWsHigh(null);
    setSpotWsLow(null);
    fetchKlines();
    const interval = setInterval(fetchKlines, REFRESH_MS);
    return () => clearInterval(interval);
  }, [groupMinutes, symbol, timeframeRestored]);

  const fetchVapCacheKlines = async () => {
    if (!volumeAtPriceEnabled) {
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
    fetchVapCacheKlines();
    if (!volumeAtPriceEnabled) return;
    const interval = setInterval(fetchVapCacheKlines, REFRESH_MS);
    return () => clearInterval(interval);
  }, [volumeAtPriceEnabled, groupMinutes, symbol, volumeAtPricePercent]);

  useEffect(() => {
    fetchSpot();
    const interval = setInterval(fetchSpot, REFRESH_MS);
    return () => clearInterval(interval);
  }, [symbol]);

  // Atualizar bolinha de status a cada 15s (idade da última atualização)
  useEffect(() => {
    const t = setInterval(() => setStatusTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  // Preço spot em tempo real (miniTicker) direto da Binance via WebSocket — usado no header
  useEffect(() => {
    const sym = symbol.trim();
    if (!sym) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const lastEmitAtRef = { current: 0 };
    const reconnectDelayRef = { current: 1000 };
    let ws: WebSocket | null = null;

    const connect = () => {
      if (!alive) return;
      const streamSym = sym.toLowerCase();
      const url = `wss://stream.binance.com:9443/ws/${streamSym}@miniTicker`;
      try {
        ws = new WebSocket(url);
        ws.onmessage = (ev) => {
          if (!alive) return;
          setLastWsActivityAt(Date.now());
          try {
            const msg = JSON.parse(String(ev.data)) as { c?: string };
            const price = typeof msg?.c === "string" ? msg.c : null;
            const now = Date.now();
            // Throttle: no máximo 4 updates/segundo
            if (price != null && now - lastEmitAtRef.current >= 250) {
              lastEmitAtRef.current = now;
              setSpotWsPrice(price);
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

    // ao trocar símbolo, limpa o preço anterior e o status WS até chegar 1.º evento
    setSpotWsPrice(null);
    setLastWsActivityAt(null);
    connect();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        // ignore
      }
      ws = null;
    };
  }, [symbol]);

  // Ao voltar para a aba, atualiza na hora (evita depender do timer com aba em segundo plano)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchKlines();
        fetchSpot();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [groupMinutes, symbol]);

  const intervalLabel = intervalOptions.find((o) => o.value === groupMinutes)?.label ?? "1M";

  const last24h = (() => {
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
  })();

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

  useEffect(() => {
    const current = spotWsPrice ?? spot.currentClose ?? (extendedKlines.length > 0 ? String(extendedKlines[0][4]) : null);
    const prevDayCloseNum = spot.prevDayClose != null ? parseFloat(spot.prevDayClose) : null;
    const currentNum = current != null ? parseFloat(current) : null;
    const pct = currentNum != null && prevDayCloseNum != null && prevDayCloseNum > 0
      ? ((currentNum - prevDayCloseNum) / prevDayCloseNum) * 100
      : null;
    setHeaderData({
      chartContainerWidth,
      priceText: current != null ? formatNum(String(current)) : null,
      pctText: pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : null,
      max24h: last24h != null ? formatNum(String(last24h.max)) : null,
      min24h: last24h != null ? formatNum(String(last24h.min)) : null,
      vol24hBtc: last24h != null ? formatAbbreviated(last24h.volBtc) : null,
      vol24hUsd: last24h != null ? formatAbbreviated(last24h.volUsd) : null,
      intervalLabel: intervalLabel ?? null,
    });
  }, [symbol, spotWsPrice, spot.currentClose, spot.prevDayClose, extendedKlines.length, extendedKlines[0]?.[4], last24h, chartContainerWidth, intervalLabel, setHeaderData]);

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
            fetchKlines();
          }}
          className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2"
        >
          {(t as Record<string, string>).refresh ?? "Refresh"}
        </button>
      </div>
    );
  }

  return (
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
            onCurrentLayoutLabelChange={setCurrentLayoutLabel}
            groupMinutes={groupMinutes}
            timezoneOffset={timezoneOffset}
            layoutAppliedTick={layoutAppliedTick}
            intervalLabel={intervalLabel}
            intervalOptions={intervalOptions}
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
            volumeAtPriceEnabled={volumeAtPriceEnabled}
            volumeAtPriceKlines={volumeAtPriceEnabled ? vapCacheKlines : []}
            volumeAtPriceBuckets={volumeAtPriceBuckets}
            volumeAtPricePercent={volumeAtPricePercent}
            onVolumeAtPricePercentChange={(v) => setVolumeAtPricePercent(Math.max(VOLUME_AT_PRICE_PERCENT_MIN, Math.min(VOLUME_AT_PRICE_PERCENT_MAX, Math.round(v))))}
            vapTimeSpanLabel={volumeAtPriceEnabled ? (() => {
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
              color: ind.type === "Ichimoku" && ichimokuPart ? (ichimokuPart === "tenkan" ? (ind.ichimokuTenkanColor ?? "#6366f1") : ichimokuPart === "kijun" ? (ind.ichimokuKijunColor ?? "#ea580c") : ichimokuPart === "spanA" ? (ind.ichimokuSpanAColor ?? "#22c55e") : ichimokuPart === "spanB" ? (ind.ichimokuSpanBColor ?? "#ef4444") : (ind.ichimokuChikouColor ?? "#a855f7")) : ind.type === "ADX" && adxPart ? (adxPart === "plusDi" ? (ind.adxPlusDiColor ?? "#22c55e") : adxPart === "minusDi" ? (ind.adxMinusDiColor ?? "#ef4444") : (ind.adxAdxColor ?? "#eab308")) : ind.type === "Volume" ? (ind.volumeColorAbove ?? "#10b981") : isHistogram ? (ind.macdHistogramColorAbove ?? "#059669") : ind.type === "CCI" && ind.cciAsHistogram ? (ind.cciHistogramColorAbove ?? "#059669") : ind.type === "CMF" && ind.cmfAsHistogram ? (ind.cmfHistogramColorAbove ?? "#059669") : isSignal ? (ind.type === "Stochastic" ? (ind.stochDColor ?? "#ea580c") : (ind.macdSignalColor ?? "#ea580c")) : ind.color,
              lineWidth: ind.type === "Ichimoku" && ichimokuPart ? (ichimokuPart === "tenkan" ? (ind.ichimokuTenkanLineWidth ?? "normal") : ichimokuPart === "kijun" ? (ind.ichimokuKijunLineWidth ?? "normal") : ichimokuPart === "spanA" ? (ind.ichimokuSpanALineWidth ?? "normal") : ichimokuPart === "spanB" ? (ind.ichimokuSpanBLineWidth ?? "normal") : (ind.ichimokuChikouLineWidth ?? "normal")) : ind.type === "ADX" && adxPart ? (adxPart === "plusDi" ? (ind.adxPlusDiLineWidth ?? "normal") : adxPart === "minusDi" ? (ind.adxMinusDiLineWidth ?? "normal") : (ind.adxAdxLineWidth ?? "normal")) : ind.type === "Volume" || isHistogram || (ind.type === "CCI" && ind.cciAsHistogram) || (ind.type === "CMF" && ind.cmfAsHistogram) ? undefined : isSignal ? (ind.type === "Stochastic" ? (ind.stochDLineWidth ?? "normal") : (ind.macdSignalLineWidth ?? "normal")) : (ind.lineWidth ?? "normal"),
              lineStyle: ind.type === "Ichimoku" && ichimokuPart ? (ichimokuPart === "tenkan" ? (ind.ichimokuTenkanLineStyle ?? "solid") : ichimokuPart === "kijun" ? (ind.ichimokuKijunLineStyle ?? "solid") : ichimokuPart === "spanA" ? (ind.ichimokuSpanALineStyle ?? "solid") : ichimokuPart === "spanB" ? (ind.ichimokuSpanBLineStyle ?? "solid") : (ind.ichimokuChikouLineStyle ?? "solid")) : ind.type === "ADX" && adxPart ? (adxPart === "plusDi" ? (ind.adxPlusDiLineStyle ?? "solid") : adxPart === "minusDi" ? (ind.adxMinusDiLineStyle ?? "solid") : (ind.adxAdxLineStyle ?? "solid")) : ind.type === "Volume" || isHistogram || (ind.type === "CCI" && ind.cciAsHistogram) || (ind.type === "CMF" && ind.cmfAsHistogram) ? undefined : isSignal ? (ind.type === "Stochastic" ? (ind.stochDLineStyle ?? "dashed") : (ind.macdSignalLineStyle ?? "dashed")) : (ind.lineStyle ?? "solid"),
              label: ind.type === "Ichimoku" && ichimokuPart ? `${baseIchimokuLabel} ${ichimokuPartLabel[ichimokuPart]}` : ind.type === "Volume" ? getIndicatorLabel(ind, t, userIndicators) : isHistogram ? ((t as Record<string, string>).macdHistogramLabel ?? "MACD (histograma)") : isSignal ? (ind.type === "Stochastic" ? getIndicatorLabelStochD(ind, t) : getIndicatorLabelSignal(ind, t)) : getIndicatorLabel(ind, t, userIndicators),
              shortLabel: ind.type === "Ichimoku" && ichimokuPart ? ichimokuPartLabel[ichimokuPart] : ind.type === "Volume" ? getIndicatorLabelShort(ind, userIndicators) : isHistogram ? "MACD Hist" : isSignal ? (ind.type === "Stochastic" ? getIndicatorLabelShortStochD(ind) : getIndicatorLabelShortSignal(ind)) : getIndicatorLabelShort(ind, userIndicators),
              type: ind.type,
              display: ind.type === "Volume" ? "histogram" as const : isHistogram ? "histogram" as const : ind.type === "CCI" && ind.cciAsHistogram ? "histogram" as const : ind.type === "CMF" && ind.cmfAsHistogram ? "histogram" as const : ind.type === "SAR" ? "points" as const : undefined,
              volumeInUsdt: ind.type === "Volume" ? (ind.volumeInUsdt === true) : undefined,
              pointSize: ind.type === "SAR" ? (ind.sarPointSize === "thin" || ind.sarPointSize === "normal" ? ind.sarPointSize : "normal") : undefined,
              histogramColorAbove: ind.type === "Volume" ? (ind.volumeColorAbove ?? "#10b981") : isHistogram ? (ind.macdHistogramColorAbove ?? "#059669") : ind.type === "CCI" && ind.cciAsHistogram ? (ind.cciHistogramColorAbove ?? "#059669") : ind.type === "CMF" && ind.cmfAsHistogram ? (ind.cmfHistogramColorAbove ?? "#059669") : undefined,
              histogramColorBelow: ind.type === "Volume" ? (ind.volumeColorBelow ?? "#ef4444") : isHistogram ? (ind.macdHistogramColorBelow ?? "#dc2626") : ind.type === "CCI" && ind.cciAsHistogram ? (ind.cciHistogramColorBelow ?? "#dc2626") : ind.type === "CMF" && ind.cmfAsHistogram ? (ind.cmfHistogramColorBelow ?? "#dc2626") : undefined,
              panel: ind.panel ?? (ind.type === "RSI" || ind.type === "MFI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "AD" || ind.type === "ATR" || ind.type === "ADX" || ind.type === "Volume" || ind.type === "CCI" || ind.type === "CMF" ? "panel2" : ind.type === "Ichimoku" ? "main" : "main"),
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
            getLayoutExtraConfig={() => ({
              userIndicators,
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
              setVolumeAtPriceEnabled(config.volumeAtPriceEnabled === true);
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

              // Estratégias do layout (precisamos da lista para validar e aplicar os IDs)
              const strategiesFromLayoutRaw = (config.strategies !== undefined && Array.isArray(config.strategies)) ? config.strategies : null;
              const appliedIds =
                slot !== 0 && config.appliedStrategyIds !== undefined && Array.isArray(config.appliedStrategyIds)
                  ? config.appliedStrategyIds.filter((x): x is string => typeof x === "string")
                  : null;
              const indicatorIds = new Set<string>(
                (indicatorsFromLayout ?? userIndicators).map((i: unknown) => (i && typeof i === "object" && typeof (i as { id?: unknown }).id === "string") ? String((i as { id: string }).id) : "").filter(Boolean)
              );
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
                      return validateStrategyReferences(st, indicatorIds, strategyIdsForValidation).ok;
                    })
                  : null;

              const layoutGroupMinutes = typeof config.groupMinutes === "number" ? config.groupMinutes : groupMinutes;
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
          {lastUpdate && (
            <div className="w-full flex items-center mt-1 pb-0.5 px-0.5 pr-3">
              <span className="flex-1 text-[10px] text-zinc-500 truncate text-left min-w-0" title={currentLayoutLabel ?? undefined}>
                {currentLayoutLabel ?? ""}
              </span>
              <span className="text-[10px] text-zinc-500 text-center shrink-0">
                {t.lastUpdate}: {formatTime(lastUpdate.getTime())}
              </span>
              <span className="flex-1 flex justify-end shrink-0 pr-1">
                <span
                  className="w-2 h-2 rounded-full"
                  title={
                    (() => {
                      const statusAt = lastWsActivityAt ?? lastUpdate.getTime();
                      const ageMs = Date.now() - statusAt;
                      if (ageMs < 60000) return t.statusOnline ?? "Atualizado há menos de 1 min";
                      if (ageMs < 300000) return t.statusDelayed ?? "Atraso entre 1 e 5 min";
                      return t.statusStale ?? "Atraso acima de 5 min";
                    })()
                  }
                  aria-hidden
                  style={{
                    backgroundColor: (() => {
                      const statusAt = lastWsActivityAt ?? lastUpdate.getTime();
                      const ageMs = Date.now() - statusAt;
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
                const headerBorderColor = ind.type === "Ichimoku" && ichimokuPart ? (ichimokuPart === "tenkan" ? (ind.ichimokuTenkanColor ?? "#6366f1") : ichimokuPart === "kijun" ? (ind.ichimokuKijunColor ?? "#ea580c") : ichimokuPart === "spanA" ? (ind.ichimokuSpanAColor ?? "#22c55e") : ichimokuPart === "spanB" ? (ind.ichimokuSpanBColor ?? "#ef4444") : (ind.ichimokuChikouColor ?? "#a855f7")) : ind.type === "Volume" ? (ind.volumeColorAbove ?? "#10b981") : adxPart === "plusDi" ? (ind.adxPlusDiColor ?? "#22c55e") : adxPart === "minusDi" ? (ind.adxMinusDiColor ?? "#ef4444") : adxPart === "adx" ? (ind.adxAdxColor ?? "#eab308") : isHistogram ? (ind.macdHistogramColorAbove ?? "#059669") : isSignal ? (ind.macdSignalColor ?? "#ea580c") : ind.type === "Bollinger" ? (ind.bollingerLimitsColor ?? "#6366f1") : ind.type === "Donchian" ? (ind.donchianLimitsColor ?? "#6366f1") : ind.color;
                const headerLabel = ind.type === "Ichimoku" && ichimokuPart ? ichimokuPartLabels[ichimokuPart] : ind.type === "Volume" ? (ind.volumeInUsdt ? ((t as Record<string, string>).volumeUsdtLabel ?? "Volume (USDT)") : ((t as Record<string, string>).volumeLabel ?? "Volume")) : adxPart === "plusDi" ? `+DI(${ind.period})` : adxPart === "minusDi" ? `-DI(${ind.period})` : adxPart === "adx" ? `ADX(${ind.period})` : isHistogram ? ((t as Record<string, string>).macdHistogramLabel ?? "MACD Hist") : isSignal ? (ind.type === "Stochastic" ? `%D(${ind.stochDPeriod ?? 3})` : `MACD Sig(${ind.macdSignalPeriod ?? 9})`) : ind.type === "MACD" ? `MACD(${ind.macdFastPeriod ?? 12},${ind.macdSlowPeriod ?? 26})` : ind.type === "Stochastic" ? `%K(${ind.period})` : ind.type === "WilliamsR" ? `%R(${ind.period})` : ind.type === "OBV" ? "OBV(1)" : ind.type === "AD" ? "A/D" : ind.type === "Bollinger" ? `BB(${ind.period}) Z=${ind.bollingerZ ?? 2}` : ind.type === "Donchian" ? `DC(${ind.period})` : ind.type === "Ichimoku" ? `Ichimoku(${ind.ichimokuTenkanPeriod ?? 9}/${ind.ichimokuKijunPeriod ?? 26}/${ind.ichimokuSpanBPeriod ?? 52})` : ind.type === "CCI" ? `CCI(${ind.period})` : ind.type === "CMF" ? `CMF(${ind.period})` : `${ind.type}(${ind.period})`;
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
            </tr>
          </thead>
          <tbody>
            {extendedKlines.map((k, i) => {
              const baseCols = (
                <>
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
              return (
                <tr key={i} className="border-t border-zinc-100 hover:bg-zinc-50">
                  {baseCols}
                  {userCols}
                  {strategyCols}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
