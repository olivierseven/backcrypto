"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { API_BASE } from "@/app/constants";
import { getCryptoT } from "@/app/lib/translations";
import { formatAbbreviated } from "@/app/(sys)/sistema/klinesFormatters";

export type MercadosSnapshotRow = {
  symbol: string;
  close1m: number | null;
  openTime1m: number | null;
  /** Soma quoteAssetVolume das últimas 24 velas 1h (BinanceKline). */
  volumeUsdt24h: number | null;
  closeDaily: number | null;
  openTimeDaily: number | null;
  pctVsDaily: number | null;
};

export type MercadosGeralRow = {
  symbol: string;
  coingeckoId: string | null;
  volumeUsd24h: number | null;
  lastPriceUsd: number | null;
  pct24h: number | null;
};

function fmtPrice(n: number): string {
  const a = Math.abs(n);
  if (a >= 1000) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (a >= 1) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

/** `yyyy-MM-dd HH:mm:ss` (relógio local do browser). */
function formatYmdHms(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${mo}-${day} ${h}:${min}:${s}`;
}

type MercadosSortKey = "symbol" | "vol" | "price" | "var";

function cmpNullableNum(a: number | null, b: number | null, asc: boolean): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const d = a - b;
  return asc ? d : -d;
}

function parseVolumeUsdt24h(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function parseNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}

type MercadosTab = "geral" | "binance";

export default function MercadosPageClient() {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines as Record<string, string>;
  const [tab, setTab] = useState<MercadosTab>("geral");

  const [rows, setRows] = useState<MercadosSnapshotRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [geralRows, setGeralRows] = useState<MercadosGeralRow[]>([]);
  const [geralFetchedAt, setGeralFetchedAt] = useState<number | null>(null);
  const [loadingGeral, setLoadingGeral] = useState(true);
  const [errorGeral, setErrorGeral] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<MercadosSortKey>("vol");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sortKeyGeral, setSortKeyGeral] = useState<MercadosSortKey>("vol");
  const [sortDirGeral, setSortDirGeral] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    const tk = getCryptoT(lang).sistema.klines as Record<string, string>;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/mercados/snapshot`, { credentials: "include", cache: "no-store" });
      if (res.status === 401) {
        setError(tk.mercadosErrorUnauthorized ?? "Session required.");
        setRows([]);
        setFetchedAt(null);
        return;
      }
      if (!res.ok) {
        setError(tk.mercadosErrorLoad ?? "Could not load data.");
        return;
      }
      const data = (await res.json()) as { rows: MercadosSnapshotRow[]; fetchedAt: number };
      const rawRows = Array.isArray(data.rows) ? data.rows : [];
      setRows(
        rawRows.map((row) => ({
          ...row,
          volumeUsdt24h: parseVolumeUsdt24h((row as MercadosSnapshotRow).volumeUsdt24h),
        })),
      );
      setFetchedAt(typeof data.fetchedAt === "number" ? data.fetchedAt : Date.now());
    } catch {
      setError(tk.mercadosErrorLoad ?? "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, [lang]);

  const loadGeral = useCallback(async () => {
    const tk = getCryptoT(lang).sistema.klines as Record<string, string>;
    setErrorGeral(null);
    try {
      const res = await fetch(`${API_BASE}/mercados/coingecko/markets`, { credentials: "include", cache: "no-store" });
      if (res.status === 401) {
        setErrorGeral(tk.mercadosErrorUnauthorized ?? "Session required.");
        setGeralRows([]);
        setGeralFetchedAt(null);
        return;
      }
      if (res.status === 503) {
        setErrorGeral(tk.mercadosErrorLoad ?? "Could not load data.");
        setGeralRows([]);
        return;
      }
      if (!res.ok) {
        setErrorGeral(tk.mercadosErrorLoad ?? "Could not load data.");
        return;
      }
      const data = (await res.json()) as { rows: MercadosGeralRow[]; fetchedAt: number };
      const raw = Array.isArray(data.rows) ? data.rows : [];
      setGeralRows(
        raw.map((r) => ({
          ...r,
          volumeUsd24h: parseNum(r.volumeUsd24h),
          lastPriceUsd: parseNum(r.lastPriceUsd),
          pct24h: parseNum(r.pct24h),
        })),
      );
      setGeralFetchedAt(typeof data.fetchedAt === "number" ? data.fetchedAt : Date.now());
    } catch {
      setErrorGeral(tk.mercadosErrorLoad ?? "Could not load data.");
    } finally {
      setLoadingGeral(false);
    }
  }, [lang]);

  useEffect(() => {
    void load();
    void loadGeral();
    const id = window.setInterval(() => {
      void load();
      void loadGeral();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [load, loadGeral]);

  const sk = tab === "geral" ? sortKeyGeral : sortKey;
  const sd = tab === "geral" ? sortDirGeral : sortDir;

  const onSortHeader = useCallback(
    (key: MercadosSortKey) => {
      if (tab === "geral") {
        if (sortKeyGeral === key) {
          setSortDirGeral((d) => (d === "asc" ? "desc" : "asc"));
        } else {
          setSortKeyGeral(key);
          setSortDirGeral("asc");
        }
      } else {
        if (sortKey === key) {
          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
          setSortKey(key);
          setSortDir("asc");
        }
      }
    },
    [tab, sortKey, sortKeyGeral],
  );

  const rankByVol = useMemo(() => {
    const m = new Map<string, number>();
    const ranked = [...rows]
      .filter((r): r is MercadosSnapshotRow & { volumeUsdt24h: number } => r.volumeUsdt24h != null)
      .sort((a, b) => b.volumeUsdt24h - a.volumeUsdt24h);
    ranked.forEach((r, i) => m.set(r.symbol, i + 1));
    return m;
  }, [rows]);

  const rankByVolGeral = useMemo(() => {
    const m = new Map<string, number>();
    const ranked = [...geralRows]
      .filter((r): r is MercadosGeralRow & { volumeUsd24h: number } => r.volumeUsd24h != null)
      .sort((a, b) => b.volumeUsd24h - a.volumeUsd24h);
    ranked.forEach((r, i) => m.set(r.symbol, i + 1));
    return m;
  }, [geralRows]);

  const sortedRows = useMemo(() => {
    const out = [...rows];
    const asc = sortDir === "asc";
    out.sort((r1, r2) => {
      if (sortKey === "symbol") {
        const c = r1.symbol.localeCompare(r2.symbol, undefined, { numeric: true, sensitivity: "base" });
        return asc ? c : -c;
      }
      if (sortKey === "vol") {
        return cmpNullableNum(r1.volumeUsdt24h, r2.volumeUsdt24h, asc);
      }
      if (sortKey === "price") {
        return cmpNullableNum(r1.close1m, r2.close1m, asc);
      }
      return cmpNullableNum(r1.pctVsDaily, r2.pctVsDaily, asc);
    });
    return out;
  }, [rows, sortKey, sortDir]);

  const sortedGeralRows = useMemo(() => {
    const out = [...geralRows];
    const asc = sortDirGeral === "asc";
    out.sort((r1, r2) => {
      if (sortKeyGeral === "symbol") {
        const c = r1.symbol.localeCompare(r2.symbol, undefined, { numeric: true, sensitivity: "base" });
        return asc ? c : -c;
      }
      if (sortKeyGeral === "vol") {
        return cmpNullableNum(r1.volumeUsd24h, r2.volumeUsd24h, asc);
      }
      if (sortKeyGeral === "price") {
        return cmpNullableNum(r1.lastPriceUsd, r2.lastPriceUsd, asc);
      }
      return cmpNullableNum(r1.pct24h, r2.pct24h, asc);
    });
    return out;
  }, [geralRows, sortKeyGeral, sortDirGeral]);

  const updatedLabel =
    tab === "geral"
      ? geralFetchedAt != null
        ? formatYmdHms(geralFetchedAt)
        : "—"
      : fetchedAt != null
        ? formatYmdHms(fetchedAt)
        : "—";

  const sortArrow = (key: MercadosSortKey) =>
    sk !== key ? <span className="text-zinc-800/90 font-normal">↕</span> : sd === "asc" ? "▲" : "▼";

  const showLoading =
    (tab === "binance" && loading && rows.length === 0) || (tab === "geral" && loadingGeral && geralRows.length === 0);
  const showError = tab === "binance" ? error : errorGeral;
  const rankMap = tab === "geral" ? rankByVolGeral : rankByVol;
  const tableEmpty = tab === "geral" ? geralRows.length === 0 : rows.length === 0;

  return (
    <main className="flex-1 min-h-0 w-full flex flex-col items-start px-2 sm:px-3 py-3 overflow-auto">
      <div className="w-full max-w-[720px] flex flex-col gap-2">
        {showLoading && <p className="text-sm text-zinc-700">{t.mercadosLoading ?? "Loading…"}</p>}
        {showError != null && <p className="text-sm text-red-600">{showError}</p>}

        <div className="rounded-lg border border-zinc-200/90 bg-white overflow-hidden shadow-sm ring-1 ring-zinc-400/20">
          <div className="flex gap-0.5 border-b border-zinc-300 bg-zinc-200/90 px-1.5 pt-1.5">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "geral"}
              className={`rounded-t-md px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors ${
                tab === "geral"
                  ? "bg-zinc-300 text-zinc-950 shadow-sm"
                  : "text-zinc-700 hover:bg-zinc-300/60 hover:text-zinc-900"
              }`}
              onClick={() => setTab("geral")}
              aria-label={t.mercadosTabGeralAria ?? "General"}
            >
              {t.mercadosTabGeral ?? "Geral"}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "binance"}
              className={`rounded-t-md px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors ${
                tab === "binance"
                  ? "bg-zinc-300 text-zinc-950 shadow-sm"
                  : "text-zinc-700 hover:bg-zinc-300/60 hover:text-zinc-900"
              }`}
              onClick={() => setTab("binance")}
              aria-label={t.mercadosTabBinanceAria ?? "Binance"}
            >
              {t.mercadosTabBinance ?? "Binance"}
            </button>
          </div>

          <div
            className="grid gap-x-2 px-1 py-1 text-[10px] sm:text-xs font-semibold text-zinc-900 border-b border-zinc-400/70 bg-zinc-300"
            style={{
              gridTemplateColumns:
                "minmax(2.25rem,0.45fr) minmax(0,1.05fr) minmax(0,1fr) minmax(0,0.95fr) minmax(0,0.85fr)",
            }}
          >
            <div
              className="min-w-0 flex w-full items-center justify-center font-mono px-1 py-1 text-zinc-900 break-words text-center"
              title={t.mercadosColRankByVolAria ?? ""}
              aria-label={t.mercadosColRankByVolAria ?? "Rank by volume"}
            >
              {t.mercadosColRankByVol ?? "#"}
            </div>
            <button
              type="button"
              onClick={() => onSortHeader("symbol")}
              className="min-w-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-1 items-start text-left font-mono font-semibold px-1 py-1 rounded hover:bg-zinc-400/80 text-zinc-900 transition-colors"
              aria-label={t.mercadosSortSymbolAria ?? "Sort by symbol"}
            >
              <span className="min-w-0 break-words">{t.mercadosColSymbol ?? "Symbol"}</span>
              <span className="shrink-0 whitespace-nowrap text-[9px] w-3 text-center leading-none" aria-hidden>
                {sortArrow("symbol")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onSortHeader("vol")}
              className="min-w-0 w-full grid grid-cols-[minmax(0,1fr)_auto] gap-x-1 items-start font-mono font-semibold px-1 py-1 rounded hover:bg-zinc-400/80 text-zinc-900 transition-colors"
              aria-label={
                tab === "geral"
                  ? t.mercadosSortVolUsdAria ?? "Sort by volume USD"
                  : t.mercadosSortVolAria ?? "Sort by 24h volume"
              }
            >
              <span className="min-w-0 break-words text-right">
                {tab === "geral" ? t.mercadosColVolUsd24h ?? "Vol 24h (USD)" : t.mercadosColVolUsdt24h ?? "Vol 24h (USDT)"}
              </span>
              <span className="shrink-0 whitespace-nowrap text-[9px] w-3 text-center leading-none" aria-hidden>
                {sortArrow("vol")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onSortHeader("price")}
              className="min-w-0 w-full grid grid-cols-[minmax(0,1fr)_auto] gap-x-1 items-start font-mono font-semibold px-1 py-1 rounded hover:bg-zinc-400/80 text-zinc-900 transition-colors"
              aria-label={t.mercadosSortPriceAria ?? "Sort by last price"}
            >
              <span className="min-w-0 break-words text-right">{t.mercadosColLastPrice ?? "Last price"}</span>
              <span className="shrink-0 whitespace-nowrap text-[9px] w-3 text-center leading-none" aria-hidden>
                {sortArrow("price")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onSortHeader("var")}
              className="min-w-0 w-full grid grid-cols-[minmax(0,1fr)_auto] gap-x-1 items-start font-mono font-semibold px-1 py-1 rounded hover:bg-zinc-400/80 text-zinc-900 transition-colors"
              aria-label={t.mercadosSortVarAria ?? "Sort by variation"}
            >
              <span className="min-w-0 break-words text-right">{t.mercadosColVar ?? "%Var"}</span>
              <span className="shrink-0 whitespace-nowrap text-[9px] w-3 text-center leading-none" aria-hidden>
                {sortArrow("var")}
              </span>
            </button>
          </div>
          <ul className="bg-white">
            {tab === "geral"
              ? sortedGeralRows.map((r) => (
                  <li
                    key={r.symbol}
                    className="grid gap-x-2 px-2 py-2 text-[11px] sm:text-sm items-center border-b border-zinc-100/80 odd:bg-white even:bg-zinc-50/90 hover:bg-zinc-100/85 transition-colors last:border-b-0"
                    style={{
                      gridTemplateColumns:
                        "minmax(2.25rem,0.45fr) minmax(0,1.05fr) minmax(0,1fr) minmax(0,0.95fr) minmax(0,0.85fr)",
                    }}
                  >
                    <span className="flex w-full min-w-0 items-center justify-center font-mono tabular-nums text-zinc-900 font-medium text-[10px] sm:text-[11px] text-center">
                      {rankMap.get(r.symbol) ?? "—"}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Link
                        href={`/mercados/info/${r.symbol.toLowerCase()}`}
                        className="shrink-0 rounded p-0.5 text-zinc-700 hover:bg-zinc-200/90 hover:text-zinc-950 transition-colors"
                        aria-label={t.mercadosCoinInfoAria ?? "Coin info"}
                        title={t.mercadosCoinInfoAria ?? "Coin info"}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.744 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </Link>
                      <span className="min-w-0 truncate font-semibold text-zinc-900">{r.symbol}</span>
                    </span>
                    <span className="text-right font-mono text-zinc-700 tabular-nums text-[10px] sm:text-[11px]">
                      {r.volumeUsd24h != null ? formatAbbreviated(r.volumeUsd24h, 2) : "—"}
                    </span>
                    <span className="text-right font-mono text-zinc-900 tabular-nums">
                      {r.lastPriceUsd != null ? fmtPrice(r.lastPriceUsd) : "—"}
                    </span>
                    <span
                      className={`text-right font-mono font-medium tabular-nums ${
                        r.pct24h == null
                          ? "text-zinc-600"
                          : r.pct24h >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                      }`}
                    >
                      {r.pct24h != null ? fmtPct(r.pct24h) : "—"}
                    </span>
                  </li>
                ))
              : sortedRows.map((r) => (
                  <li
                    key={r.symbol}
                    className="grid gap-x-2 px-2 py-2 text-[11px] sm:text-sm items-center border-b border-zinc-100/80 odd:bg-white even:bg-zinc-50/90 hover:bg-zinc-100/85 transition-colors last:border-b-0"
                    style={{
                      gridTemplateColumns:
                        "minmax(2.25rem,0.45fr) minmax(0,1.05fr) minmax(0,1fr) minmax(0,0.95fr) minmax(0,0.85fr)",
                    }}
                  >
                    <span className="flex w-full min-w-0 items-center justify-center font-mono tabular-nums text-zinc-900 font-medium text-[10px] sm:text-[11px] text-center">
                      {rankMap.get(r.symbol) ?? "—"}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Link
                        href={`/mercados/info/${r.symbol.toLowerCase()}`}
                        className="shrink-0 rounded p-0.5 text-zinc-700 hover:bg-zinc-200/90 hover:text-zinc-950 transition-colors"
                        aria-label={t.mercadosCoinInfoAria ?? "Coin info"}
                        title={t.mercadosCoinInfoAria ?? "Coin info"}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.744 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </Link>
                      <span className="min-w-0 truncate font-semibold text-zinc-900">{r.symbol}</span>
                    </span>
                    <span className="text-right font-mono text-zinc-900 tabular-nums text-[10px] sm:text-[11px]">
                      {r.volumeUsdt24h != null ? formatAbbreviated(r.volumeUsdt24h, 2) : "—"}
                    </span>
                    <span className="text-right font-mono text-zinc-900 tabular-nums">
                      {r.close1m != null ? fmtPrice(r.close1m) : "—"}
                    </span>
                    <span
                      className={`text-right font-mono font-medium tabular-nums ${
                        r.pctVsDaily == null
                          ? "text-zinc-600"
                          : r.pctVsDaily >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                      }`}
                    >
                      {r.pctVsDaily != null ? fmtPct(r.pctVsDaily) : "—"}
                    </span>
                  </li>
                ))}
          </ul>
          {!loading && !loadingGeral && tableEmpty && showError == null && (
            <p className="px-2 py-4 text-sm text-zinc-700 text-center">{t.mercadosEmpty ?? "No symbols."}</p>
          )}
        </div>
        <div className="text-xs text-zinc-800 pt-1 text-right w-full">
          {t.mercadosUpdatedAt ?? "Updated"}: {updatedLabel}
        </div>
      </div>
    </main>
  );
}
