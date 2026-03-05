"use client";

import { useState } from "react";
import { useBioLang } from "@/app/contexts/BioLangContext";
import { getBioT } from "@/app/lib/translations";
import { API_BASE } from "@/app/constants";

type ValidateSingleResult = {
  symbol: string;
  interval: string;
  table: string;
  oldest: string | null;
  newest: string | null;
  count: number;
  days: number;
  ok: boolean;
  gaps: { from: number; to: number }[];
};

type ValidateResult =
  | { "1m": ValidateSingleResult; "1h": ValidateSingleResult }
  | ValidateSingleResult
  | null;

export default function SistemaDebugPanel() {
  const lang = useBioLang();
  const t = getBioT(lang).sistema.debug;
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidateResult>(null);
  const [backfillLoading, setBackfillLoading] = useState<string | null>(null);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const [registerGapsLoading, setRegisterGapsLoading] = useState<string | null>(null);

  function clearPanel() {
    setResult(null);
    setError(null);
    setBackfillMessage(null);
    setBackfillLoading(null);
    setRegisterGapsLoading(null);
    setLoading(false);
    setSymbol("BTCUSDT");
  }

  async function runValidate() {
    setError(null);
    setResult(null);
    setBackfillMessage(null);
    setRegisterGapsLoading(null);
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/debug/klines-validate?symbol=${encodeURIComponent(symbol.trim())}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.error);
        return;
      }
      setResult(data);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }

  function isBothResults(r: ValidateResult): r is { "1m": ValidateSingleResult; "1h": ValidateSingleResult } {
    return r != null && typeof r === "object" && "1m" in r && "1h" in r;
  }

  async function runRegisterGaps(interval: "1m" | "1h", gaps: { from: number; to: number }[]) {
    if (gaps.length === 0) return;
    setBackfillMessage(null);
    setRegisterGapsLoading(interval);
    await new Promise((r) => setTimeout(r, 0));
    try {
      const res = await fetch(`${API_BASE}/debug/klines-gaps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          symbol: symbol.trim(),
          gaps: gaps.map((g) => ({ interval, from: g.from, to: g.to })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBackfillMessage((data && typeof data.error === "string" ? data.error : null) || t.error);
        return;
      }
      const n = data.registered ?? 0;
      setBackfillMessage((t as { registerGapsSuccess?: string }).registerGapsSuccess?.replace("{n}", String(n)) ?? `Registrados: ${n}`);
      runValidate();
    } catch (e) {
      setBackfillMessage(e instanceof Error ? e.message : t.error);
    } finally {
      setRegisterGapsLoading(null);
    }
  }

  async function runBackfill(interval: "1m" | "1h", gaps: { from: number; to: number }[]) {
    if (gaps.length === 0) return;
    setBackfillMessage(null);
    setBackfillLoading(interval);
    await new Promise((r) => setTimeout(r, 0));
    try {
      const res = await fetch(`${API_BASE}/debug/klines-backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          symbol: symbol.trim(),
          gaps: gaps.map((g) => ({ interval, from: g.from, to: g.to })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBackfillMessage((data && typeof data.error === "string" ? data.error : null) || t.error);
        return;
      }
      const inserted = interval === "1m" ? data.inserted1m : data.inserted1h;
      const detail = Array.isArray(data.details) ? data.details.find((d: { interval: string }) => d.interval === interval) : null;
      const msg = (t as { backfillSuccess?: string }).backfillSuccess?.replace("{n}", String(inserted ?? 0)) ?? `Inseridas: ${inserted ?? 0}`;
      setBackfillMessage(detail && (detail.fetched === 0 || (detail.inserted === 0 && detail.fetched > 0)) ? `${msg} (Binance: ${detail.fetched}, inseridas: ${detail.inserted})` : msg);
      runValidate();
    } catch (e) {
      setBackfillMessage(e instanceof Error ? e.message : t.error);
    } finally {
      setBackfillLoading(null);
    }
  }

  function ResultBlock({ label, res }: { label: string; res: ValidateSingleResult }) {
    const interval = res.interval as "1m" | "1h";
    const canBackfill = !res.ok && res.gaps.length > 0 && (interval === "1m" || interval === "1h");
    return (
      <div className="p-3 bg-zinc-50 rounded-md text-sm font-mono space-y-1">
        <p className="text-xs font-semibold text-zinc-600 mb-1.5">{label}</p>
        <p><span className="text-zinc-500">{t.oldest}:</span> {res.oldest ?? "—"}</p>
        <p><span className="text-zinc-500">{t.newest}:</span> {res.newest ?? "—"}</p>
        <p><span className="text-zinc-500">{t.count}:</span> {res.count.toLocaleString()}</p>
        <p><span className="text-zinc-500">{t.days}:</span> {res.days.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        {res.ok ? (
          <p className="text-emerald-600 font-medium mt-2">{t.ok}</p>
        ) : (
          <>
            <p className="text-amber-700 font-medium mt-2">{t.gaps} ({res.gaps.length})</p>
            <ul className="mt-1 max-h-32 overflow-auto text-xs">
              {res.gaps.slice(0, 50).map((g, i) => (
                <li key={i}>
                  {new Date(g.from).toISOString()} → {new Date(g.to).toISOString()}
                </li>
              ))}
              {res.gaps.length > 50 && (
                <li className="text-zinc-500">… {(t as { andMore?: string }).andMore?.replace("{n}", String(res.gaps.length - 50)) ?? `… +${res.gaps.length - 50} more`}</li>
              )}
            </ul>
            {canBackfill && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={backfillLoading !== null || registerGapsLoading !== null}
                  onClick={() => runBackfill(interval, res.gaps)}
                  className="text-xs font-medium px-2.5 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {backfillLoading === interval ? (t as { backfillLoading?: string }).backfillLoading ?? "Preenchendo…" : (t as { backfill?: string }).backfill ?? "Preencher gaps"}
                </button>
                <button
                  type="button"
                  disabled={backfillLoading !== null || registerGapsLoading !== null}
                  onClick={() => runRegisterGaps(interval, res.gaps)}
                  className="text-xs font-medium px-2.5 py-1.5 rounded bg-zinc-600 text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  {registerGapsLoading === interval ? (t as { registerGapsLoading?: string }).registerGapsLoading ?? "Registrando…" : (t as { registerGaps?: string }).registerGaps ?? "Registrar gaps"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed top-20 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 shadow-sm"
          title={t.title}
          aria-label={t.title}
        >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m8 2 1.88 1.88" />
          <path d="M14.12 3.88 16 2" />
          <path d="M12 8v4" />
          <path d="M18 12a6 6 0 0 1-6 6 6 6 0 0 1-6-6c0-2 .5-3.5 1.5-4.5" />
          <path d="M6 12a6 6 0 0 0 6 6 6 6 0 0 0 6-6c0-2-.5-3.5-1.5-4.5" />
          <path d="M2 12h4" />
          <path d="M18 12h4" />
          <path d="M4.93 4.93 7.05 7.05" />
          <path d="M16.95 16.95 19.07 19.07" />
          <path d="M4.93 19.07l2.12-2.12" />
          <path d="M16.95 7.05l2.12-2.12" />
        </svg>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-y-0 right-0 z-40 bg-white border-l border-zinc-200 shadow-xl flex flex-col min-w-[280px]"
          style={{ width: "min(400px, 33.333vw)" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-800">{t.title}</h3>
              <button
                type="button"
                onClick={clearPanel}
                className="p-1 rounded text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200"
                title={t.refresh}
                aria-label={t.refresh}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-zinc-500 hover:text-zinc-800 text-lg leading-none"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <section>
              <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                {t.validateKlines}
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder={t.symbol}
                  className="flex-1 min-w-0 text-sm border border-zinc-300 rounded-md px-2.5 py-1.5 text-zinc-800"
                  aria-label={t.symbol}
                />
                <button
                  type="button"
                  onClick={runValidate}
                  disabled={loading}
                  className="text-sm font-medium px-3 py-1.5 rounded-md bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  {loading ? t.loading : t.run}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
              {backfillMessage && (
                <p className="mt-2 text-sm text-emerald-700">{backfillMessage}</p>
              )}
              {result && (
                <div className="mt-3 space-y-3">
                  {isBothResults(result) ? (
                    <>
                      <ResultBlock label={t.validateKlines1m} res={result["1m"]} />
                      <ResultBlock label={t.validateKlines1h} res={result["1h"]} />
                    </>
                  ) : (
                    <ResultBlock
                      label={(result as ValidateSingleResult).interval === "1m" ? t.validateKlines1m : t.validateKlines1h}
                      res={result as ValidateSingleResult}
                    />
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {open && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/20"
          aria-label="Fechar overlay"
        />
      )}
    </>
  );
}
