"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { API_BASE } from "@/app/constants";
import { useBioLang } from "@/app/contexts/BioLangContext";
import { getBioT } from "@/app/lib/translations";
import { computeSmaColumn, computeEmaColumn, computeWmaColumn, computeRsiColumn, computeMacdColumn, computeStochasticKColumn, computeObvColumn, computeParabolicSarColumn, computeAtrColumn, computeVwapColumn, computeBollingerBands } from "@/app/api/binance/klines/indicators";
import { useKlinesIndicators, getFieldIndex } from "./KlinesIndicatorsContext";
import { SIDEBAR_WIDTH, Y_AXIS_WIDTH } from "./KlinesChartConstants";

/** Largura reservada à direita para a barra de rolagem vertical ficar fora do gráfico (não cobrir o eixo Y). */
const SCROLLBAR_GUTTER = 17;
import { formatAbbreviated } from "./klinesFormatters";
import { getIndicatorLabel, getIndicatorLabelShort, getIndicatorLabelSignal, getIndicatorLabelShortSignal, getIndicatorLabelStochD, getIndicatorLabelShortStochD } from "./IndicatorsPanel";
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
  const lang = useBioLang();
  const t = getBioT(lang).sistema.klines;
  const { userIndicators, setCurrentGroupMinutes, replaceUserIndicatorsFromLayout } = useKlinesIndicators();
  const intervalOptions = getIntervalOptions(isAdmin);
  const [groupMinutes, setGroupMinutes] = useState(5); // default 5m
  const [klines, setKlines] = useState<Kline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [spot, setSpot] = useState<{ currentClose: string | null; prevDayClose: string | null }>({ currentClose: null, prevDayClose: null });
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(600);
  const [chartContainerHeight, setChartContainerHeight] = useState(0);

  const visibleUserIndicators = useMemo(
    () =>
      userIndicators.filter(
        (ind) => ind.intervals.length === 0 || ind.intervals.includes(groupMinutes)
      ),
    [userIndicators, groupMinutes]
  );

  const extendedKlines = useMemo((): Kline[] => {
    const base = klines as (string | number)[][];
    if (base.length === 0 || userIndicators.length === 0) return klines;
    const out = base.map((row) => [...row] as (string | number | null)[]);
    /** Indicadores só leem colunas 0–11 (OHLC etc.); fazer cast para satisfazer a API. */
    const data = out as (string | number)[][];
    for (let u = 0; u < userIndicators.length; u++) {
      const ind = userIndicators[u];
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
        const stochValueIndex = (valueIndex === 1 || valueIndex === 4) ? valueIndex : 4;
        const kCol = computeStochasticKColumn(data, period, stochValueIndex);
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
  }, [klines, userIndicators]);

  /** Índice da primeira coluna de cada indicador. MACD: 1 col; MACD+sinal: 2 col; MACD+sinal+histograma: 3 col. Stochastic: 1 col; Stoch+%D: 2 col. */
  const getIndicatorColumnStart = useCallback((indicatorIndex: number) => {
    let col = 12;
    for (let i = 0; i < indicatorIndex; i++) {
      const ind = userIndicators[i];
      if (ind.type === "MACD") {
        col += 1 + (ind.macdSignalLine ? 1 : 0) + (ind.macdHistogram ? 1 : 0);
      } else if (ind.type === "Stochastic") {
        col += 1 + (ind.stochDLine ? 1 : 0);
      } else if (ind.type === "Bollinger") {
        col += 3;
      } else if (ind.type === "OBV" || ind.type === "SAR" || ind.type === "ATR" || ind.type === "VWAP") {
        col += 1;
      } else {
        col += 1;
      }
    }
    return col;
  }, [userIndicators]);

  /** Lista de colunas de indicadores visíveis (cada item = uma coluna no gráfico/tabela). */
  const visibleIndicatorColumns = useMemo(() => {
    const list: { ind: (typeof userIndicators)[0]; columnIndex: number; isSignal: boolean; isHistogram: boolean }[] = [];
    for (let u = 0; u < userIndicators.length; u++) {
      const ind = userIndicators[u];
      if (ind.intervals.length > 0 && !ind.intervals.includes(groupMinutes)) continue;
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
        // Largura do plot = container - sidebar - eixo Y - gutter da scrollbar (barra fica fora do gráfico)
        if (typeof rect.width === "number" && rect.width > 0) {
          const plotWidth = Math.max(100, rect.width - SIDEBAR_WIDTH - Y_AXIS_WIDTH - SCROLLBAR_GUTTER);
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
      const intervalParam = intervalOptions.find((o) => o.value === groupMinutes)?.param ?? "5m";
      const res = await fetch(
        `${API_BASE}/binance/klines?symbol=BTCUSDT&interval=${intervalParam}&limit=1000`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || `HTTP ${res.status}`);
      }
      const data: Kline[] = await res.json();
      const list = Array.isArray(data) ? data : [];
      setKlines(list);
      // Last update = closeTime (UTC) do candle mais recente, para bater com a coluna Close Time
      const latestCloseTime = list.length > 0 && list[0][6] != null ? Number(list[0][6]) : null;
      setLastUpdate(latestCloseTime != null ? new Date(latestCloseTime) : new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorLoad);
      setKlines([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpot = async () => {
    try {
      const res = await fetch(`${API_BASE}/binance/spot?symbol=BTCUSDT`);
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
  }, [groupMinutes]);

  useEffect(() => {
    fetchSpot();
    const interval = setInterval(fetchSpot, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

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
  }, [groupMinutes]);

  const intervalLabel = intervalOptions.find((o) => o.value === groupMinutes)?.label ?? "5m";

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

  const headerWidth = chartWidth + SIDEBAR_WIDTH + Y_AXIS_WIDTH + SCROLLBAR_GUTTER;

  return (
    <div className="flex flex-col min-h-0 p-4">
      <div
        className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 mb-2 flex-shrink-0 items-baseline w-full min-w-0"
        style={{ maxWidth: headerWidth }}
      >
        <div className="flex flex-col gap-0 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-zinc-900 shrink-0">{t.title}</h2>
            {(() => {
              const current = spot.currentClose ?? (extendedKlines.length > 0 ? String(extendedKlines[0][4]) : null);
              const prevDayCloseNum = spot.prevDayClose != null ? parseFloat(spot.prevDayClose) : null;
              const currentNum = current != null ? parseFloat(current) : null;
              const pct = currentNum != null && prevDayCloseNum != null && prevDayCloseNum > 0
                ? ((currentNum - prevDayCloseNum) / prevDayCloseNum) * 100
                : null;
              if (current == null) return null;
              return (
                <p className="text-xs font-medium text-zinc-600 font-mono flex items-baseline gap-1.5">
                  <span>{formatNum(String(current))}</span>
                  {pct != null && (
                    <span className={pct >= 0 ? "text-emerald-600" : "text-red-600"}>
                      ({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%)
                    </span>
                  )}
                </p>
              );
            })()}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <select
              id="interval-listbox"
              value={groupMinutes}
              onChange={(e) => setGroupMinutes(Number(e.target.value))}
              aria-label={t.interval}
              className="text-[11px] font-medium text-zinc-700 bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5 cursor-pointer"
            >
              {intervalOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-zinc-500">{t.tableNote}</span>
          </div>
        </div>
        {last24h && (
          <div className="w-max max-w-full shrink-0">
            <table className="border-collapse font-mono text-[11px] text-zinc-600 whitespace-nowrap leading-tight" role="presentation">
              <tbody>
                <tr>
                  <td className="py-0 align-baseline"><span className="text-zinc-500">{t.max24h}</span> {formatNum(String(last24h.max))}</td>
                </tr>
                <tr>
                  <td className="py-0 align-baseline"><span className="text-zinc-500">{t.min24h}</span> {formatNum(String(last24h.min))}</td>
                </tr>
                <tr>
                  <td className="py-0 align-baseline"><span className="text-zinc-500">{t.vol24hBtc}</span> {formatAbbreviated(last24h.volBtc)}</td>
                </tr>
                <tr>
                  <td className="py-0 align-baseline"><span className="text-zinc-500">{t.vol24hUsd}</span> {formatAbbreviated(last24h.volUsd)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div
        className="flex-shrink-0 mb-2 w-full min-w-0"
        style={{ maxWidth: headerWidth }}
      >
        <div
          ref={chartWrapRef}
          className="w-full min-h-0 max-h-[85vh] overflow-x-auto overflow-y-auto rounded-lg border border-zinc-200 bg-white"
          style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x pan-y",
            overscrollBehavior: "contain",
            scrollbarGutter: "stable",
          }}
        >
          <KlinesChart
            klines={extendedKlines}
            groupMinutes={groupMinutes}
            intervalLabel={intervalLabel}
            width={chartWidth}
            maxChartHeight={
              visibleUserIndicators.some((i) => i.type === "RSI" || i.type === "MACD" || i.type === "Stochastic" || i.type === "OBV" || i.type === "ATR") && chartContainerHeight > 100
                ? chartContainerHeight - 80
                : undefined
            }
            indicatorLines={visibleIndicatorColumns.map(({ ind, columnIndex, isSignal, isHistogram }) => ({
              columnIndex,
              color: isHistogram ? (ind.macdHistogramColorAbove ?? "#059669") : isSignal ? (ind.type === "Stochastic" ? (ind.stochDColor ?? "#ea580c") : (ind.macdSignalColor ?? "#ea580c")) : ind.color,
              lineWidth: isHistogram ? undefined : isSignal ? (ind.type === "Stochastic" ? (ind.stochDLineWidth ?? "normal") : (ind.macdSignalLineWidth ?? "normal")) : (ind.lineWidth ?? "normal"),
              lineStyle: isHistogram ? undefined : isSignal ? (ind.type === "Stochastic" ? (ind.stochDLineStyle ?? "dashed") : (ind.macdSignalLineStyle ?? "dashed")) : (ind.lineStyle ?? "solid"),
              label: isHistogram ? ((t as Record<string, string>).macdHistogramLabel ?? "MACD (histograma)") : isSignal ? (ind.type === "Stochastic" ? getIndicatorLabelStochD(ind, t) : getIndicatorLabelSignal(ind, t)) : getIndicatorLabel(ind, t, userIndicators),
              shortLabel: isHistogram ? "MACD Hist" : isSignal ? (ind.type === "Stochastic" ? getIndicatorLabelShortStochD(ind) : getIndicatorLabelShortSignal(ind)) : getIndicatorLabelShort(ind, userIndicators),
              type: ind.type,
              display: isHistogram ? "histogram" as const : ind.type === "SAR" ? "points" as const : undefined,
              pointSize: ind.type === "SAR" ? (ind.sarPointSize === "thin" || ind.sarPointSize === "normal" ? ind.sarPointSize : "normal") : undefined,
              histogramColorAbove: isHistogram ? (ind.macdHistogramColorAbove ?? "#059669") : undefined,
              histogramColorBelow: isHistogram ? (ind.macdHistogramColorBelow ?? "#dc2626") : undefined,
              panel: ind.panel ?? (ind.type === "RSI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "OBV" || ind.type === "ATR" ? "panel2" : "main"),
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
            getLayoutExtraConfig={() => ({ userIndicators })}
            onLayoutConfigLoaded={(config) => {
              const v = config.groupMinutes;
              if (typeof v === "number" && intervalOptions.some((o) => o.value === v)) setGroupMinutes(v);
              if (config.userIndicators !== undefined && Array.isArray(config.userIndicators)) replaceUserIndicatorsFromLayout(config.userIndicators);
            }}
          />
        </div>
        {lastUpdate && (
          <div className="text-right mt-1">
            <span className="text-[10px] text-zinc-500">
              {t.lastUpdate}: {formatTime(lastUpdate.getTime())}
            </span>
          </div>
        )}
      </div>
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
                  style={{ borderLeftColor: isHistogram ? (ind.macdHistogramColorAbove ?? "#059669") : isSignal ? (ind.macdSignalColor ?? "#ea580c") : ind.type === "Bollinger" ? (ind.bollingerLimitsColor ?? "#6366f1") : ind.color, borderLeftWidth: 2, borderLeftStyle: "solid" }}
                >
                  {isHistogram ? ((t as Record<string, string>).macdHistogramLabel ?? "MACD Hist") : isSignal ? (ind.type === "Stochastic" ? `%D(${ind.stochDPeriod ?? 3})` : `MACD Sig(${ind.macdSignalPeriod ?? 9})`) : ind.type === "MACD" ? `MACD(${ind.macdFastPeriod ?? 12},${ind.macdSlowPeriod ?? 26})` : ind.type === "Stochastic" ? `%K(${ind.period})` : ind.type === "OBV" ? "OBV(1)" : ind.type === "Bollinger" ? `BB(${ind.period}) Z=${ind.bollingerZ ?? 2}` : `${ind.type}(${ind.period})`}
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
              return (
                <tr key={i} className="border-t border-zinc-100 hover:bg-zinc-50">
                  {baseCols}
                  {userCols}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
