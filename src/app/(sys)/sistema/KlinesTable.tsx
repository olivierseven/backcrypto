"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { API_BASE } from "@/app/constants";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { computeSmaColumn, computeEmaColumn, computeWmaColumn, computeRsiColumn, computeMacdColumn, computeStochasticKColumn, computeWilliamsRColumn, computeObvColumn, computeParabolicSarColumn, computeAtrColumn, computeVwapColumn, computeBollingerBands } from "@/app/api/binance/klines/indicators";
import { useKlinesIndicators, getFieldIndex } from "./KlinesIndicatorsContext";
import { useSistemaDebug } from "./SistemaDebugContext";
import { useChartHeader } from "./ChartHeaderContext";
import { useChartSymbol } from "./ChartSymbolContext";
import { useStrategies } from "./strategies/StrategiesContext";
import { strategiesForContext } from "./strategies/strategiesTypes";
import { evaluateNode } from "./strategies/strategyEvaluator";
import { Y_AXIS_WIDTH } from "./KlinesChartConstants";

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

/** Opções de intervalo: admin vê também 1m. */
function getIntervalOptions(isAdmin: boolean): { value: number; label: string; param: string }[] {
  if (!isAdmin) return INTERVAL_OPTIONS_BASE;
  return [{ value: 1, label: "1m", param: "1m" }, ...INTERVAL_OPTIONS_BASE];
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

export default function KlinesTable({ isAdmin = false }: { isAdmin?: boolean }) {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines;
  const { showKlinesTable } = useSistemaDebug();
  const { setHeaderData } = useChartHeader();
  const { symbol, openSymbolPanel } = useChartSymbol();
  const { userIndicators, setCurrentGroupMinutes, replaceUserIndicatorsFromLayout } = useKlinesIndicators();
  const { strategies, appliedStrategyIds, replaceStrategiesFromLayout, replaceAppliedStrategyIdsFromLayout } = useStrategies();
  const intervalOptions = getIntervalOptions(isAdmin);
  const [groupMinutes, setGroupMinutes] = useState(5); // default 5m
  const [klines, setKlines] = useState<Kline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [spot, setSpot] = useState<{ currentClose: string | null; prevDayClose: string | null }>({ currentClose: null, prevDayClose: null });
  const [spotWsPrice, setSpotWsPrice] = useState<string | null>(null);
  const [spotWsHigh, setSpotWsHigh] = useState<number | null>(null);
  const [spotWsLow, setSpotWsLow] = useState<number | null>(null);
  const lastSpotPersistAtRef = useRef(0);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(600);
  const [chartContainerHeight, setChartContainerHeight] = useState(0);
  const [chartRequestedWidth, setChartRequestedWidth] = useState<number | null>(null);
  const [chartReportedSizePercent, setChartReportedSizePercent] = useState(100);

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
      const parsed = JSON.parse(raw) as { high?: number; low?: number } | null;
      const high = parsed && typeof parsed.high === "number" && Number.isFinite(parsed.high) ? parsed.high : null;
      const low = parsed && typeof parsed.low === "number" && Number.isFinite(parsed.low) ? parsed.low : null;
      setSpotWsHigh(high);
      setSpotWsLow(low);
    } catch {
      setSpotWsHigh(null);
      setSpotWsLow(null);
    }
  }, [spotExtremesStorageKey]);

  // Atualiza extremos com base no spot (enquanto o socket estiver mandando preços)
  useEffect(() => {
    if (spotWsPrice == null) return;
    const p = Number(spotWsPrice);
    if (!Number.isFinite(p)) return;
    setSpotWsHigh((prev) => (prev == null ? p : Math.max(prev, p)));
    setSpotWsLow((prev) => (prev == null ? p : Math.min(prev, p)));
  }, [spotWsPrice]);

  // Persiste extremos no localStorage (throttle simples para não gravar demais)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
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
  }, [spotWsHigh, spotWsLow, spotExtremesStorageKey]);

  const klinesWithSpot = useMemo((): Kline[] => {
    if (spotWsPrice == null || klines.length === 0) return klines;
    const p = Number(spotWsPrice);
    if (!Number.isFinite(p)) return klines;
    const first = klines[0] as (string | number)[];
    const out = [...klines] as unknown as (string | number)[][];
    const next0 = [...first] as (string | number)[];
    // OHLC: [1]=open [2]=high [3]=low [4]=close
    const baseHigh = Number(next0[2]);
    const baseLow = Number(next0[3]);
    next0[4] = spotWsPrice;
    const hi = spotWsHigh != null ? spotWsHigh : (Number.isFinite(baseHigh) ? Math.max(baseHigh, p) : p);
    const lo = spotWsLow != null ? spotWsLow : (Number.isFinite(baseLow) ? Math.min(baseLow, p) : p);
    next0[2] = String(hi);
    next0[3] = String(lo);
    out[0] = next0;
    return out as unknown as Kline[];
  }, [klines, spotWsPrice, spotWsHigh, spotWsLow]);

  const visibleUserIndicators = useMemo(
    () =>
      userIndicators.filter(
        (ind) => ind.intervals.length === 0 || ind.intervals.includes(groupMinutes)
      ),
    [userIndicators, groupMinutes]
  );

  const extendedKlines = useMemo((): Kline[] => {
    const base = klinesWithSpot as (string | number)[][];
    if (base.length === 0 || userIndicators.length === 0) return klinesWithSpot;
    const out = base.map((row) => [...row] as (string | number | null)[]);
    /** Indicadores só leem colunas 0–11 (OHLC etc.); fazer cast para satisfazer a API. */
    const data = out as (string | number)[][];
    for (let u = 0; u < userIndicators.length; u++) {
      const ind = userIndicators[u];
      if (ind.type === "Volume") continue;
      const valueIndex = getFieldIndex(ind.fieldKey, userIndicators);
      const period = Math.max(1, Math.min(500, ind.period));
      if (ind.type === "MACD") {
        const col = computeMacdColumn(
          data,
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
              ? computeEmaColumn(data, macdColIndex, signalPeriod)
              : (ind.macdSignalMaType ?? "EMA") === "WMA"
                ? computeWmaColumn(data, macdColIndex, signalPeriod)
                : computeSmaColumn(data, macdColIndex, signalPeriod);
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
        const kCol = computeStochasticKColumn(data, period, valueIndex);
        for (let i = 0; i < out.length; i++) out[i].push(kCol[i] ?? null);
        if (ind.stochDLine) {
          const kColIndex = out[0].length - 1;
          const dPeriod = Math.max(1, Math.min(500, ind.stochDPeriod ?? 3));
          const dCol =
            (ind.stochDMaType ?? "SMA") === "EMA"
              ? computeEmaColumn(data, kColIndex, dPeriod)
              : (ind.stochDMaType ?? "SMA") === "WMA"
                ? computeWmaColumn(data, kColIndex, dPeriod)
                : computeSmaColumn(data, kColIndex, dPeriod);
          for (let i = 0; i < out.length; i++) out[i].push(dCol[i] ?? null);
        }
      } else if (ind.type === "WilliamsR") {
        const wrValueIndex = (valueIndex === 1 || valueIndex === 4) ? valueIndex : 4;
        const wrCol = computeWilliamsRColumn(data, period, wrValueIndex);
        for (let i = 0; i < out.length; i++) out[i].push(wrCol[i] ?? null);
      } else if (ind.type === "OBV") {
        const col = computeObvColumn(data);
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
        const { upper, middle, lower } = computeBollingerBands(data, valueIndex, period, ind.bollingerMaType ?? "SMA", z);
        for (let i = 0; i < out.length; i++) {
          out[i].push(upper[i] ?? null);
          out[i].push(middle[i] ?? null);
          out[i].push(lower[i] ?? null);
        }
      } else {
        const col =
          ind.type === "EMA"
            ? computeEmaColumn(data, valueIndex, period)
            : ind.type === "WMA"
              ? computeWmaColumn(data, valueIndex, period)
              : ind.type === "RSI"
                ? computeRsiColumn(data, valueIndex, period)
                : computeSmaColumn(data, valueIndex, period);
        for (let i = 0; i < out.length; i++) out[i].push(col[i] ?? null);
      }
    }
    return out as Kline[];
  }, [klinesWithSpot, userIndicators]);

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
      } else if (ind.type === "Bollinger") {
        col += 3;
      } else if (ind.type === "Volume") {
        // Volume usa coluna 5 ou 7, não consome slot
      } else if (ind.type === "OBV" || ind.type === "SAR" || ind.type === "ATR" || ind.type === "VWAP") {
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

  /** Por estratégia: array de boolean por índice de linha (linha 0 = mais recente). */
  const strategyResults = useMemo(() => {
    const map = new Map<string, boolean[]>();
    if (extendedKlines.length === 0) return map;
    for (const strategy of visibleStrategies) {
      const arr: boolean[] = [];
      for (let i = 0; i < extendedKlines.length; i++) {
        arr.push(evaluateNode(strategy.root, extendedKlines, i, userIndicators, getIndicatorColumnStart));
      }
      map.set(strategy.id, arr);
    }
    return map;
  }, [visibleStrategies, extendedKlines, userIndicators, getIndicatorColumnStart]);

  /** Overlays para pintar candle com cor da estratégia quando condição verdadeira. Paleta igual à das médias móveis. */
  const strategyCandleOverlays = useMemo(() => {
    const palette = INDICATOR_COLOR_PALETTE;
    return visibleStrategies.map((s, idx) => ({
      id: s.id,
      name: s.name,
      color: s.color ?? palette[Math.min(2 + (idx % Math.max(1, palette.length - 2)), palette.length - 1)] ?? "#6366f1",
      results: strategyResults.get(s.id) ?? [],
    }));
  }, [visibleStrategies, strategyResults]);

  /** Lista de colunas de indicadores visíveis (cada item = uma coluna no gráfico/tabela). */
  const visibleIndicatorColumns = useMemo(() => {
    const list: { ind: (typeof userIndicators)[0]; columnIndex: number; isSignal: boolean; isHistogram: boolean }[] = [];
    for (let u = 0; u < userIndicators.length; u++) {
      const ind = userIndicators[u];
      if (ind.intervals.length > 0 && !ind.intervals.includes(groupMinutes)) continue;
      if (ind.type === "Volume") {
        list.push({ ind, columnIndex: ind.volumeInUsdt ? 7 : 5, isSignal: false, isHistogram: false });
        continue;
      }
      const start = getIndicatorColumnStart(u);
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
    try {
      setError(null);
      setNeedsRefresh(false);
      const intervalParam = intervalOptions.find((o) => o.value === groupMinutes)?.param ?? "5m";
      const res = await fetch(
        `${API_BASE}/binance/klines?symbol=${encodeURIComponent(symbol)}&interval=${intervalParam}&limit=1000`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      const list = Array.isArray(body) ? body : (body.klines ?? []);
      const refreshFlag = !Array.isArray(body) && body.needsRefresh === true;
      setKlines(list);
      setNeedsRefresh(refreshFlag);
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
    setLoading(true);
    fetchKlines();
    const interval = setInterval(fetchKlines, REFRESH_MS);
    return () => clearInterval(interval);
  }, [groupMinutes, symbol]);

  useEffect(() => {
    fetchSpot();
    const interval = setInterval(fetchSpot, REFRESH_MS);
    return () => clearInterval(interval);
  }, [symbol]);

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

    // ao trocar símbolo, limpa o preço anterior para evitar mostrar BTC quando mudou para ETH (até chegar 1.º evento)
    setSpotWsPrice(null);
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

  const intervalLabel = intervalOptions.find((o) => o.value === groupMinutes)?.label ?? "5m";

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
    });
  }, [spotWsPrice, spot.currentClose, spot.prevDayClose, extendedKlines.length, extendedKlines[0]?.[4], last24h, chartContainerWidth, setHeaderData]);

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
    <div className="flex flex-col min-h-0 w-full pt-1 px-0 pb-4">
      <div
        ref={chartWrapRef}
        className="flex-shrink-0 mb-2 min-w-0 rounded-lg border border-zinc-200 bg-white/90 shadow-sm"
        style={{
          width: "100%",
          maxWidth: chartReportedSizePercent >= 125 ? chartContainerMaxWidth : "min(663px, 100%)",
          boxSizing: "border-box",
          overflow: "visible",
          touchAction: "auto",
          overscrollBehavior: "auto",
          ...(chartReportedSizePercent >= 125 ? { minWidth: chartContainerMaxWidth } : {}),
        }}
      >
          <KlinesChart
            klines={extendedKlines}
            groupMinutes={groupMinutes}
            intervalLabel={intervalLabel}
            intervalOptions={intervalOptions}
            onIntervalChange={setGroupMinutes}
            width={chartWidthToUse}
            onChartDimensionsChange={onChartDimensionsChange}
            maxChartHeight={undefined}
            symbol={symbol}
            onOpenSymbolPanel={openSymbolPanel}
            indicatorLines={visibleIndicatorColumns.map(({ ind, columnIndex, isSignal, isHistogram }) => ({
              columnIndex,
              showLastValueOnYAxis: ind.showLastValueOnYAxis !== false,
              color: ind.type === "Volume" ? (ind.volumeColorAbove ?? "#10b981") : isHistogram ? (ind.macdHistogramColorAbove ?? "#059669") : isSignal ? (ind.type === "Stochastic" ? (ind.stochDColor ?? "#ea580c") : (ind.macdSignalColor ?? "#ea580c")) : ind.color,
              lineWidth: ind.type === "Volume" || isHistogram ? undefined : isSignal ? (ind.type === "Stochastic" ? (ind.stochDLineWidth ?? "normal") : (ind.macdSignalLineWidth ?? "normal")) : (ind.lineWidth ?? "normal"),
              lineStyle: ind.type === "Volume" || isHistogram ? undefined : isSignal ? (ind.type === "Stochastic" ? (ind.stochDLineStyle ?? "dashed") : (ind.macdSignalLineStyle ?? "dashed")) : (ind.lineStyle ?? "solid"),
              label: ind.type === "Volume" ? getIndicatorLabel(ind, t, userIndicators) : isHistogram ? ((t as Record<string, string>).macdHistogramLabel ?? "MACD (histograma)") : isSignal ? (ind.type === "Stochastic" ? getIndicatorLabelStochD(ind, t) : getIndicatorLabelSignal(ind, t)) : getIndicatorLabel(ind, t, userIndicators),
              shortLabel: ind.type === "Volume" ? getIndicatorLabelShort(ind, userIndicators) : isHistogram ? "MACD Hist" : isSignal ? (ind.type === "Stochastic" ? getIndicatorLabelShortStochD(ind) : getIndicatorLabelShortSignal(ind)) : getIndicatorLabelShort(ind, userIndicators),
              type: ind.type,
              display: ind.type === "Volume" ? "histogram" as const : isHistogram ? "histogram" as const : ind.type === "SAR" ? "points" as const : undefined,
              volumeInUsdt: ind.type === "Volume" ? (ind.volumeInUsdt === true) : undefined,
              pointSize: ind.type === "SAR" ? (ind.sarPointSize === "thin" || ind.sarPointSize === "normal" ? ind.sarPointSize : "normal") : undefined,
              histogramColorAbove: ind.type === "Volume" ? (ind.volumeColorAbove ?? "#10b981") : isHistogram ? (ind.macdHistogramColorAbove ?? "#059669") : undefined,
              histogramColorBelow: ind.type === "Volume" ? (ind.volumeColorBelow ?? "#ef4444") : isHistogram ? (ind.macdHistogramColorBelow ?? "#dc2626") : undefined,
              panel: ind.panel ?? (ind.type === "RSI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "ATR" || ind.type === "Volume" ? "panel2" : "main"),
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
            }))}
            strategyCandleOverlays={strategyCandleOverlays}
            getLayoutExtraConfig={() => ({ userIndicators, strategies, appliedStrategyIds })}
            onLayoutConfigLoaded={(config) => {
              const v = config.groupMinutes;
              if (typeof v === "number" && intervalOptions.some((o) => o.value === v)) setGroupMinutes(v);
              if (config.userIndicators !== undefined && Array.isArray(config.userIndicators)) replaceUserIndicatorsFromLayout(config.userIndicators);
              if (config.strategies !== undefined) replaceStrategiesFromLayout(config.strategies);
              if (config.appliedStrategyIds !== undefined) replaceAppliedStrategyIdsFromLayout(config.appliedStrategyIds);
            }}
          />
          {lastUpdate && (
            <div className="w-full text-center mt-1 pb-0.5">
              <span className="text-[10px] text-zinc-500">
                {t.lastUpdate}: {formatTime(lastUpdate.getTime())}
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
              {visibleIndicatorColumns.map(({ ind, columnIndex, isSignal, isHistogram }, idx) => (
                <th
                  key={`${ind.id}-${isSignal ? "sig" : isHistogram ? "hist" : "main"}-${idx}`}
                  className="px-3 py-2 font-medium text-right text-xs"
                  style={{ borderLeftColor: ind.type === "Volume" ? (ind.volumeColorAbove ?? "#10b981") : isHistogram ? (ind.macdHistogramColorAbove ?? "#059669") : isSignal ? (ind.macdSignalColor ?? "#ea580c") : ind.type === "Bollinger" ? (ind.bollingerLimitsColor ?? "#6366f1") : ind.color, borderLeftWidth: 2, borderLeftStyle: "solid" }}
                >
                  {ind.type === "Volume" ? (ind.volumeInUsdt ? ((t as Record<string, string>).volumeUsdtLabel ?? "Volume (USDT)") : ((t as Record<string, string>).volumeLabel ?? "Volume")) : isHistogram ? ((t as Record<string, string>).macdHistogramLabel ?? "MACD Hist") : isSignal ? (ind.type === "Stochastic" ? `%D(${ind.stochDPeriod ?? 3})` : `MACD Sig(${ind.macdSignalPeriod ?? 9})`) : ind.type === "MACD" ? `MACD(${ind.macdFastPeriod ?? 12},${ind.macdSlowPeriod ?? 26})` : ind.type === "Stochastic" ? `%K(${ind.period})` : ind.type === "WilliamsR" ? `%R(${ind.period})` : ind.type === "OBV" ? "OBV(1)" : ind.type === "Bollinger" ? `BB(${ind.period}) Z=${ind.bollingerZ ?? 2}` : `${ind.type}(${ind.period})`}
                </th>
              ))}
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
              const userCols = visibleIndicatorColumns.map(({ ind, columnIndex, isSignal, isHistogram }, idx) => {
                const val = k[columnIndex];
                const borderColor = isHistogram ? (ind.macdHistogramColorAbove ?? "#059669") : isSignal ? (ind.macdSignalColor ?? "#ea580c") : ind.color;
                return (
                  <td
                    key={`${ind.id}-${isSignal ? "sig" : isHistogram ? "hist" : "main"}-${idx}`}
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
