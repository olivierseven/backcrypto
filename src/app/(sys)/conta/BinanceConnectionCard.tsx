"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "@/app/constants";
import { getCryptoT, type CryptoLang } from "@/app/lib/translations";

const API = `${API_BASE}/user/binance-connection`;

/** IP público do proxy VPS; pedidos assinados saem por este IP quando o relay está ativo. */
const BINANCE_WHITELIST_IP = "187.45.254.5";

function parseDecimalInput(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  const normalized = s.includes(",") && !s.includes(".") ? s.replace(",", ".") : s.replace(/,/g, "");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

type Status =
  | { state: "loading" }
  | { state: "disconnected" }
  | {
      state: "connected";
      apiKeyLast4: string;
      lastVerifiedAt: string | null;
      connectedAt: string;
      defaultQuoteUsdtPerOrder: string | null;
    };

type BalanceRow = { asset: string; free: string; locked: string; total: string };

export default function BinanceConnectionCard({ language }: { language: CryptoLang }) {
  const t = getCryptoT(language).conta as unknown as Record<string, string>;
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [consent, setConsent] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [balances, setBalances] = useState<BalanceRow[] | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [defaultUsdtDraft, setDefaultUsdtDraft] = useState("");
  const [savingDefaultUsdt, setSavingDefaultUsdt] = useState(false);

  const loadStatus = useCallback(async () => {
    setStatus({ state: "loading" });
    try {
      const res = await fetch(`${API}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ state: "disconnected" });
        return;
      }
      if (data.connected) {
        const def =
          data.defaultQuoteUsdtPerOrder != null && String(data.defaultQuoteUsdtPerOrder).trim() !== ""
            ? String(data.defaultQuoteUsdtPerOrder).trim()
            : null;
        setStatus({
          state: "connected",
          apiKeyLast4: data.apiKeyLast4,
          lastVerifiedAt: data.lastVerifiedAt ?? null,
          connectedAt: data.connectedAt,
          defaultQuoteUsdtPerOrder: def,
        });
        setDefaultUsdtDraft(def ?? "");
      } else {
        setStatus({ state: "disconnected" });
        setDefaultUsdtDraft("");
      }
    } catch {
      setStatus({ state: "disconnected" });
      setDefaultUsdtDraft("");
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  function mapError(code: string | undefined, msg?: string): string {
    switch (code) {
      case "unauthorized":
        return t.binanceErrorUnauthorized;
      case "binance_rejected":
        return msg ? `${t.binanceErrorRejected} (${msg})` : t.binanceErrorRejected;
      case "binance_network":
        return t.binanceErrorNetwork;
      case "encryption_unavailable":
        return t.binanceErrorEncryption;
      default:
        return t.binanceErrorGeneric;
    }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
          consentAccepted: true as const,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(mapError(data.error, data.msg));
      }
      setApiKey("");
      setApiSecret("");
      setConsent(false);
      setMessage({ type: "success", text: t.binanceConnectSuccess });
      await loadStatus();
      if (data.balancesSample?.nonZeroCount != null) {
        void refreshBalances();
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : t.binanceErrorGeneric });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDefaultUsdt() {
    if (savingDefaultUsdt || submitting) return;
    const n = parseDecimalInput(defaultUsdtDraft);
    if (n == null || n <= 0) {
      setMessage({ type: "error", text: t.binanceDefaultUsdtInvalid });
      return;
    }
    setSavingDefaultUsdt(true);
    setMessage(null);
    try {
      const res = await fetch(API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ defaultQuoteUsdtPerOrder: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error === "not_connected" ? t.binanceErrorGeneric : t.binanceErrorGeneric);
      }
      setMessage({ type: "success", text: t.binanceDefaultUsdtSaved });
      await loadStatus();
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : t.binanceErrorGeneric });
    } finally {
      setSavingDefaultUsdt(false);
    }
  }

  async function handleClearDefaultUsdt() {
    if (savingDefaultUsdt || submitting) return;
    setSavingDefaultUsdt(true);
    setMessage(null);
    try {
      const res = await fetch(API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ defaultQuoteUsdtPerOrder: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "clear_failed");
      }
      setDefaultUsdtDraft("");
      setMessage({ type: "success", text: t.binanceDefaultUsdtCleared });
      await loadStatus();
    } catch {
      setMessage({ type: "error", text: t.binanceErrorGeneric });
    } finally {
      setSavingDefaultUsdt(false);
    }
  }

  async function handleDisconnect() {
    if (submitting) return;
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch(API, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(mapError(data.error));
      }
      setBalances(null);
      setStatus({ state: "disconnected" });
      setMessage({ type: "success", text: t.binanceDisconnectedSuccess });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : t.binanceErrorGeneric });
    } finally {
      setSubmitting(false);
    }
  }

  function renderWhitelistHint(className: string) {
    return (
      <p className={className}>
        {t.binanceWhitelistHint.split("{ip}").map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 ? (
              <span className="font-mono font-medium text-zinc-800 select-all">{BINANCE_WHITELIST_IP}</span>
            ) : null}
          </span>
        ))}
      </p>
    );
  }

  async function refreshBalances() {
    setBalancesLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/balances`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(mapError(data.error, data.msg));
      }
      setBalances(Array.isArray(data.balances) ? data.balances : []);
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : t.binanceErrorGeneric });
      setBalances(null);
    } finally {
      setBalancesLoading(false);
    }
  }

  if (status.state === "loading") {
    return (
      <div className="card-crypto-generator crypto-card">
        <h2 className="text-base font-semibold text-zinc-900 mb-2">{t.binanceCardTitle}</h2>
        <p className="text-sm text-zinc-500 mb-3">…</p>
        {renderWhitelistHint("text-xs text-zinc-600 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 leading-snug")}
      </div>
    );
  }

  return (
    <div className="card-crypto-generator crypto-card">
      <h2 className="text-base font-semibold text-zinc-900 mb-2">{t.binanceCardTitle}</h2>
      <p className="text-sm text-zinc-600 mb-3">{t.binanceCardDesc}</p>
      {renderWhitelistHint("text-xs text-zinc-600 mb-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 leading-snug")}

      {message && (
        <div
          className={`mb-3 p-3 rounded-lg text-sm ${
            message.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {status.state === "connected" ? (
        <div className="space-y-4">
          <div className="text-sm text-zinc-800">
            <p>
              <span className="font-medium text-emerald-700">{t.binanceConnected}</span>
              {" — "}
              {t.binanceKeyEndsWith} <span className="font-mono">…{status.apiKeyLast4}</span>
            </p>
            {status.lastVerifiedAt && (
              <p className="text-zinc-600 mt-1">
                {t.binanceLastVerified}: {new Date(status.lastVerifiedAt).toLocaleString(language === "en" ? "en-US" : "pt-BR")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshBalances()}
              disabled={balancesLoading || submitting}
              className="crypto-btn rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 font-medium px-3 py-2 text-sm disabled:opacity-50"
            >
              {balancesLoading ? "…" : t.binanceRefreshBalances}
            </button>
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={submitting}
              className="crypto-btn rounded-lg bg-zinc-200 hover:bg-zinc-300 text-zinc-900 font-medium px-3 py-2 text-sm disabled:opacity-50"
            >
              {submitting ? "…" : t.binanceDisconnect}
            </button>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-3 space-y-2">
            <label className="block text-xs font-medium text-zinc-800">{t.binanceDefaultUsdtLabel}</label>
            <p className="text-xs text-zinc-600 leading-snug">{t.binanceDefaultUsdtHint}</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={defaultUsdtDraft}
                onChange={(e) => setDefaultUsdtDraft(e.target.value)}
                placeholder={t.binanceDefaultUsdtPlaceholder}
                className="min-w-[8rem] flex-1 px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => void handleSaveDefaultUsdt()}
                disabled={savingDefaultUsdt || submitting}
                className="crypto-btn rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium px-3 py-2 text-sm disabled:opacity-50"
              >
                {savingDefaultUsdt ? "…" : t.binanceDefaultUsdtSave}
              </button>
              <button
                type="button"
                onClick={() => void handleClearDefaultUsdt()}
                disabled={savingDefaultUsdt || submitting || !status.defaultQuoteUsdtPerOrder}
                className="crypto-btn rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-medium px-3 py-2 text-sm disabled:opacity-50"
              >
                {t.binanceDefaultUsdtClear}
              </button>
            </div>
          </div>
          {balances && balances.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-800 mb-2">{t.binanceBalancesTitle}</h3>
              <p className="text-xs text-zinc-600 mb-2">
                {t.binanceAssetsWithBalance.replace("{n}", String(balances.length))}
              </p>
              <ul className="max-h-48 overflow-y-auto text-sm font-mono border border-zinc-200 rounded-lg divide-y divide-zinc-100">
                {balances.map((b) => (
                  <li key={b.asset} className="flex justify-between gap-2 px-2 py-1.5">
                    <span className="font-semibold">{b.asset}</span>
                    <span className="text-zinc-700">{b.total}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 rounded border-zinc-300"
            />
            <span className="text-xs text-zinc-700 leading-snug">{t.binanceConsentLabel}</span>
          </label>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">{t.binanceApiKey}</label>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">{t.binanceApiSecret}</label>
            <input
              type="password"
              autoComplete="off"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder={t.binancePlaceholderSecret}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !consent || apiKey.trim().length < 10 || apiSecret.trim().length < 10}
            className="crypto-btn rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? t.binanceConnecting : t.binanceConnect}
          </button>
        </form>
      )}
    </div>
  );
}
