"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { API_BASE } from "@/app/constants";
import { useBioLang } from "@/app/contexts/BioLangContext";
import { getBioT } from "@/app/lib/translations";
import { computeSmaColumn, computeEmaColumn, computeWmaColumn } from "@/app/api/binance/klines/indicators";
import { useKlinesIndicators, getFieldIndex } from "./KlinesIndicatorsContext";
import { SIDEBAR_WIDTH, Y_AXIS_WIDTH } from "./KlinesChartConstants";
import { formatAbbreviated } from "./klinesFormatters";
import { getIndicatorLabel } from "./IndicatorsPanel";
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
  const { userIndicators, setCurrentGroupMinutes } = useKlinesIndicators();
  const intervalOptions = getIntervalOptions(isAdmin);
  const [groupMinutes, setGroupMinutes] = useState(5); // default 5m
  const [klines, setKlines] = useState<Kline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [spot, setSpot] = useState<{ currentClose: string | null; prevDayClose: string | null }>({ currentClose: null, prevDayClose: null });
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(600);

  const visibleUserIndicators = useMemo(
    () =>
      userIndicators.filter(
        (ind) => ind.intervals.length === 0 || ind.intervals.includes(groupMinutes)
      ),
    [userIndicators, groupMinutes]
  );

  const extendedKlines = useMemo(() => {
    const base = klines as (string | number)[][];
    if (base.length === 0 || userIndicators.length === 0) return base;
    const out = base.map((row) => [...row] as (string | number | null)[]);
    for (let u = 0; u < userIndicators.length; u++) {
      const ind = userIndicators[u];
      const valueIndex = getFieldIndex(ind.fieldKey, userIndicators);
      const period = Math.max(1, Math.min(500, ind.period));
      const col =
        ind.type === "EMA"
          ? computeEmaColumn(out, valueIndex, period)
          : ind.type === "WMA"
            ? computeWmaColumn(out, valueIndex, period)
            : computeSmaColumn(out, valueIndex, period);
      for (let i = 0; i < out.length; i++) out[i].push(col[i] ?? null);
    }
    return out as Kline[];
  }, [klines, userIndicators]);

  useEffect(() => {
    setCurrentGroupMinutes(groupMinutes);
  }, [groupMinutes, setCurrentGroupMinutes]);

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number" && w > 0) setChartWidth(w);
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
    const cutoff = extendedKlines[0][0] - 24 * 60 * 60 * 1000;
    const in24h = extendedKlines.filter((k) => k[0] >= cutoff);
    if (in24h.length === 0) return null;
    let max = parseFloat(in24h[0][2]);
    let min = parseFloat(in24h[0][3]);
    let volBtc = 0;
    let volUsd = 0;
    for (const k of in24h) {
      const high = parseFloat(k[2]);
      const low = parseFloat(k[3]);
      if (high > max) max = high;
      if (low < min) min = low;
      volBtc += parseFloat(k[5]);
      volUsd += parseFloat(k[7]);
    }
    return { max, min, volBtc, volUsd };
  })();

  const headerWidth = chartWidth + SIDEBAR_WIDTH + Y_AXIS_WIDTH;

  return (
    <div className="flex flex-col min-h-0 p-4">
      <div
        className="grid grid-cols-[1fr_auto] gap-2 sm:gap-4 mb-3 flex-shrink-0 items-start w-full min-w-0"
        style={{ maxWidth: headerWidth }}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="text-sm sm:text-lg font-semibold text-zinc-900">
            {t.title}
          </h2>
          {(() => {
            const current = spot.currentClose ?? (extendedKlines.length > 0 ? extendedKlines[0][4] : null);
            const prevDayCloseNum = spot.prevDayClose != null ? parseFloat(spot.prevDayClose) : null;
            const currentNum = current != null ? parseFloat(current) : null;
            const pct = currentNum != null && prevDayCloseNum != null && prevDayCloseNum > 0
              ? ((currentNum - prevDayCloseNum) / prevDayCloseNum) * 100
              : null;
            if (current == null) return null;
            return (
              <p className="text-xs sm:text-sm font-medium text-zinc-600 font-mono flex items-baseline gap-1.5 flex-wrap">
                <span>{formatNum(current)}</span>
                {pct != null && (
                  <span className={pct >= 0 ? "text-emerald-600" : "text-red-600"}>
                    ({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%)
                  </span>
                )}
              </p>
            );
          })()}
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <select
              id="interval-listbox"
              value={groupMinutes}
              onChange={(e) => setGroupMinutes(Number(e.target.value))}
              aria-label={t.interval}
              className="text-xs sm:text-sm font-medium text-zinc-700 bg-zinc-100 border border-zinc-200 rounded-md px-2 py-1 sm:px-2.5 sm:py-1.5 cursor-pointer"
            >
              {intervalOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-xs sm:text-sm text-zinc-500">{t.tableNote}</span>
          </div>
        </div>
        {last24h && (
          <div className="w-max max-w-full shrink-0">
            <table className="border-collapse font-mono text-xs sm:text-sm text-zinc-600 whitespace-nowrap" role="presentation">
              <tbody>
                <tr>
                  <td className="py-0.5 align-baseline"><span className="text-zinc-500">{t.max24h}</span> {formatNum(String(last24h.max))}</td>
                </tr>
                <tr>
                  <td className="py-0.5 align-baseline"><span className="text-zinc-500">{t.min24h}</span> {formatNum(String(last24h.min))}</td>
                </tr>
                <tr>
                  <td className="py-0.5 align-baseline"><span className="text-zinc-500">{t.vol24hBtc}</span> {formatAbbreviated(last24h.volBtc)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 align-baseline"><span className="text-zinc-500">{t.vol24hUsd}</span> {formatAbbreviated(last24h.volUsd)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div
        className="flex-shrink-0 mb-3 w-full min-w-0"
        style={{ maxWidth: headerWidth }}
      >
        <div
          ref={chartWrapRef}
          className="w-full min-h-0 max-h-[80vh] overflow-auto rounded-lg border border-zinc-200 bg-white sm:max-h-none sm:overflow-visible"
          style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x pan-y",
            overscrollBehavior: "contain",
          }}
        >
          <KlinesChart
            klines={extendedKlines}
            groupMinutes={groupMinutes}
            intervalLabel={intervalLabel}
            width={chartWidth}
            indicatorLines={visibleUserIndicators.map((ind) => ({
              columnIndex: 12 + userIndicators.indexOf(ind),
              color: ind.color,
              lineWidth: ind.lineWidth ?? "normal",
              lineStyle: ind.lineStyle ?? "solid",
              label: getIndicatorLabel(ind, t, userIndicators),
            }))}
            onLayoutConfigLoaded={(config) => {
              const v = config.groupMinutes;
              if (typeof v === "number" && intervalOptions.some((o) => o.value === v)) setGroupMinutes(v);
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
              {visibleUserIndicators.map((ind) => (
                  <th
                    key={ind.id}
                    className="px-3 py-2 font-medium text-right text-xs"
                    style={{ borderLeftColor: ind.color, borderLeftWidth: 2, borderLeftStyle: "solid" }}
                  >
                    {ind.type}({ind.period})
                  </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {extendedKlines.map((k, i) => {
              const baseCols = (
                <>
                  <td className="px-3 py-1.5 text-zinc-600 whitespace-nowrap">{formatTime(k[0])}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatNum(k[1])}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-600">{formatNum(k[2])}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-red-600">{formatNum(k[3])}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatNum(k[4])}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-500">{formatNum(k[5])}</td>
                  <td className="px-3 py-1.5 text-zinc-600 whitespace-nowrap">{formatTime(k[6])}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-500">{formatNum(k[7])}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatInt(k[8])}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-500">{formatNum(k[9])}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-500">{formatNum(k[10])}</td>
                </>
              );
              const userCols = visibleUserIndicators.map((ind) => {
                const colIndex = 12 + userIndicators.indexOf(ind);
                const val = k[colIndex];
                return (
                  <td
                    key={ind.id}
                    className="px-3 py-1.5 text-right font-mono text-zinc-500"
                    style={{ borderLeftColor: ind.color, borderLeftWidth: 1, borderLeftStyle: "solid" }}
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
