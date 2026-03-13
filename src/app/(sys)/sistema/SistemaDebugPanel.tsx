"use client";

import { useEffect, useState } from "react";
import { useCryptoLang, useCryptoLangContext } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { API_BASE } from "@/app/constants";
import { useSistemaDebug } from "./SistemaDebugContext";
import { useKlinesIndicators } from "./KlinesIndicatorsContext";

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
  const lang = useCryptoLang();
  const { lang: currentLang, setLang } = useCryptoLangContext();
  const t = getCryptoT(lang).sistema.debug;
  const { showKlinesTable, setShowKlinesTable, layoutLoadLog, layoutLoadDebugEnabled, setLayoutLoadDebugEnabled, layoutSaveLoadDebugEnabled, setLayoutSaveLoadDebugEnabled, clearLayoutLoadLog } = useSistemaDebug();
  const { userIndicators } = useKlinesIndicators();
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [binanceSpotPrice, setBinanceSpotPrice] = useState<string | null>(null);
  const [binanceSpotLastEventAtUtc, setBinanceSpotLastEventAtUtc] = useState<number | null>(null);
  const [binanceSpotStatus, setBinanceSpotStatus] = useState<"connecting" | "open" | "closed" | "error">("closed");
  const [binanceSpotError, setBinanceSpotError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidateResult>(null);
  const [backfillLoading, setBackfillLoading] = useState<string | null>(null);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const [registerGapsLoading, setRegisterGapsLoading] = useState<string | null>(null);
  const [pastBackfillLoading, setPastBackfillLoading] = useState<"1m" | "1h" | null>(null);
  const [pastBackfillMessage, setPastBackfillMessage] = useState<string | null>(null);
  const [chartModels, setChartModels] = useState<{ slot: number; name?: string }[]>([]);
  const [chartModelsLoading, setChartModelsLoading] = useState(false);
  const [selectedChartModelSlot, setSelectedChartModelSlot] = useState<number | null>(null);
  const [saveChartModelLoading, setSaveChartModelLoading] = useState(false);
  const [saveChartModelMessage, setSaveChartModelMessage] = useState<string | null>(null);
  const [debugTab, setDebugTab] = useState<"main" | "inspect">("main");
  const [layoutLogCopied, setLayoutLogCopied] = useState(false);

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

  function formatPrice2(v: string | null): string | null {
    if (v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    return n.toFixed(2);
  }

  /** WebSocket Binance spot no debug — desativado após testes. Alterar para true para reativar. */
  const DEBUG_BINANCE_SPOT_WS_ENABLED = false;

  useEffect(() => {
    if (!open) return;
    setChartModelsLoading(true);
    fetch(`${API_BASE}/chart-models`, { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("forbidden"))))
      .then((data: { models?: { slot: number; name?: string }[] }) => {
        const list = Array.isArray(data.models) ? data.models : [];
        setChartModels(list);
        if (list.length > 0 && selectedChartModelSlot === null) setSelectedChartModelSlot(list[0].slot);
      })
      .catch(() => setChartModels([]))
      .finally(() => setChartModelsLoading(false));
  }, [open]);

  async function saveCurrentLayoutToChartModel() {
    const slot = selectedChartModelSlot;
    if (slot == null) {
      setSaveChartModelMessage("Selecione um modelo.");
      return;
    }
    setSaveChartModelMessage(null);
    setSaveChartModelLoading(true);
    try {
      const config = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timeout")), 5000);
        const handler = (e: Event) => {
          clearTimeout(timeout);
          window.removeEventListener("chart-layout-config", handler);
          resolve((e as CustomEvent).detail ?? {});
        };
        window.addEventListener("chart-layout-config", handler);
        window.dispatchEvent(new Event("chart-layout-get-config"));
      });
      const res = await fetch(`${API_BASE}/chart-models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slot, config }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveChartModelMessage((data && typeof data.error === "string" ? data.error : data.message) ?? "Erro ao salvar.");
        return;
      }
      setSaveChartModelMessage("Modelo atualizado.");
      const list = await fetch(`${API_BASE}/chart-models`, { credentials: "include", cache: "no-store" }).then((r) => r.json()).then((d: { models?: { slot: number; name?: string }[] }) => Array.isArray(d.models) ? d.models : []);
      setChartModels(list);
    } catch (e) {
      setSaveChartModelMessage(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaveChartModelLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const sym = symbol.trim();
    if (!sym) return;
    if (!DEBUG_BINANCE_SPOT_WS_ENABLED) return;

    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const lastEmitAtRef = { current: 0 };
    const latestPriceRef = { current: null as string | null };
    const wsRef = { current: null as WebSocket | null };
    const reconnectDelayRef = { current: 1000 };

    const connect = () => {
      if (!alive) return;
      const streamSym = sym.toLowerCase();
      // miniTicker: atualizações frequentes com last price em `c`
      const url = `wss://stream.binance.com:9443/ws/${streamSym}@miniTicker`;
      setBinanceSpotStatus("connecting");
      setBinanceSpotError(null);

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!alive) return;
          reconnectDelayRef.current = 1000;
          setBinanceSpotStatus("open");
          setBinanceSpotError(null);
        };

        ws.onmessage = (ev) => {
          if (!alive) return;
          try {
            const msg = JSON.parse(String(ev.data)) as { c?: string; E?: number };
            const raw = msg?.c ?? null;
            latestPriceRef.current = raw;
            const now = Date.now();
            setBinanceSpotLastEventAtUtc(now);

            // Throttle: no máximo 4 updates/segundo no React
            if (now - lastEmitAtRef.current >= 250) {
              lastEmitAtRef.current = now;
              setBinanceSpotPrice(formatPrice2(latestPriceRef.current));
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onerror = () => {
          if (!alive) return;
          setBinanceSpotStatus("error");
          setBinanceSpotError("WebSocket error");
        };

        ws.onclose = () => {
          if (!alive) return;
          setBinanceSpotStatus("closed");
          const delay = reconnectDelayRef.current;
          reconnectDelayRef.current = Math.min(30000, Math.round(reconnectDelayRef.current * 1.5));
          if (timer) clearTimeout(timer as unknown as number);
          timer = setTimeout(connect, delay);
        };
      } catch (e) {
        setBinanceSpotStatus("error");
        setBinanceSpotError(e instanceof Error ? e.message : "WebSocket error");
      }
    };

    connect();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer as unknown as number);
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    };
  }, [open, symbol]);

  function clearPanel() {
    setResult(null);
    setError(null);
    setBackfillMessage(null);
    setBackfillLoading(null);
    setRegisterGapsLoading(null);
    setPastBackfillMessage(null);
    setPastBackfillLoading(null);
    setBinanceSpotPrice(null);
    setBinanceSpotLastEventAtUtc(null);
    setBinanceSpotStatus("closed");
    setBinanceSpotError(null);
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

  const ONE_MINUTE_MS = 60 * 1000;
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const FAST_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const KLINE_1H_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

  function floorToHourMs(ms: number) {
    return Math.floor(ms / ONE_HOUR_MS) * ONE_HOUR_MS;
  }

  async function runPastBackfill(interval: "1m" | "1h") {
    const sym = symbol.trim();
    if (!sym) {
      setPastBackfillMessage((t as { error?: string }).error ?? "Informe o símbolo.");
      return;
    }
    setPastBackfillMessage(null);
    setPastBackfillLoading(interval);
    await new Promise((r) => setTimeout(r, 0));
    try {
      const now = Date.now();
      let from: number;
      let to: number;
      if (interval === "1m") {
        from = now - FAST_DAYS_MS - ONE_MINUTE_MS;
        to = now + ONE_MINUTE_MS;
      } else {
        from = floorToHourMs(now - KLINE_1H_YEARS_MS) - ONE_HOUR_MS;
        to = floorToHourMs(now) + ONE_HOUR_MS;
      }
      const res = await fetch(`${API_BASE}/debug/klines-backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          symbol: sym,
          gaps: [{ interval, from, to }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPastBackfillMessage((data && typeof data.error === "string" ? data.error : null) || t.error);
        return;
      }
      const inserted = interval === "1m" ? data.inserted1m : data.inserted1h;
      const msg = (t as { backfillPastSuccess?: string }).backfillPastSuccess?.replace("{n}", String(inserted ?? 0)) ?? `Concluído. Inseridas: ${inserted ?? 0}`;
      setPastBackfillMessage(msg);
      runValidate();
    } catch (e) {
      setPastBackfillMessage(e instanceof Error ? e.message : t.error);
    } finally {
      setPastBackfillLoading(null);
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
          className="fixed top-1/2 right-0 z-50 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-l-lg bg-amber-100 hover:bg-amber-200 text-amber-800 border border-r-0 border-amber-300 shadow-sm"
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
          <div className="flex border-b border-zinc-200 bg-zinc-50/80">
            <button
              type="button"
              onClick={() => setDebugTab("main")}
              className={`flex-1 py-2 text-xs font-medium ${debugTab === "main" ? "text-zinc-800 border-b-2 border-zinc-600 bg-white" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              {(t as Record<string, string>).tabMain ?? "Geral"}
            </button>
            <button
              type="button"
              onClick={() => setDebugTab("inspect")}
              className={`flex-1 py-2 text-xs font-medium ${debugTab === "inspect" ? "text-zinc-800 border-b-2 border-zinc-600 bg-white" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              {(t as Record<string, string>).tabInspect ?? "Inspecionar"}
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {debugTab === "main" && (
              <>
            <section>
              <p className="text-sm text-zinc-700">
                {t.activeIndicators}: <strong>{userIndicators.length}</strong>
              </p>
            </section>
            <section>
              <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                {t.language}
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLang("pt")}
                  title="Português"
                  className={`flex items-center justify-center w-10 h-10 rounded-md border-2 text-lg transition-colors ${currentLang === "pt" ? "border-zinc-800 bg-zinc-100 ring-1 ring-zinc-400" : "border-zinc-200 hover:border-zinc-400"}`}
                  aria-label="Português"
                  aria-pressed={currentLang === "pt"}
                >
                  🇧🇷
                </button>
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  title="English"
                  className={`flex items-center justify-center w-10 h-10 rounded-md border-2 text-lg transition-colors ${currentLang === "en" ? "border-zinc-800 bg-zinc-100 ring-1 ring-zinc-400" : "border-zinc-200 hover:border-zinc-400"}`}
                  aria-label="English"
                  aria-pressed={currentLang === "en"}
                >
                  🇺🇸
                </button>
              </div>
            </section>
            <section>
              <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                Chart Models (ChartModels)
              </h4>
              <p className="text-xs text-zinc-500 mb-2">
                Atualiza um modelo com o estado atual do gráfico na página Sistema. O modelo Default (slot 0) é o que todos carregam.
              </p>
              {chartModelsLoading ? (
                <p className="text-sm text-zinc-500">Carregando…</p>
              ) : (
                <>
                  <label className="block text-[10px] text-zinc-500 mb-1">Modelo</label>
                  <select
                    value={selectedChartModelSlot ?? ""}
                    onChange={(e) => setSelectedChartModelSlot(e.target.value === "" ? null : Number(e.target.value))}
                    className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white mb-2"
                  >
                    {chartModels.length === 0 && <option value="">Nenhum modelo</option>}
                    {chartModels.map((m) => (
                      <option key={m.slot} value={m.slot}>
                        {m.slot === 0 ? "Default" : `Slot ${m.slot}`} — {m.name?.trim() || "(sem nome)"}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={saveChartModelLoading || chartModels.length === 0}
                    onClick={saveCurrentLayoutToChartModel}
                    className="text-xs font-medium px-2.5 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {saveChartModelLoading ? "Salvando…" : "Salvar no modelo"}
                  </button>
                  {saveChartModelMessage && (
                    <p className="text-xs mt-2 text-zinc-600">{saveChartModelMessage}</p>
                  )}
                </>
              )}
            </section>
            <section>
              <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                {(t as Record<string, string>).binanceSpotTitle ?? "Binance spot (direct)"}
              </h4>
              <p className="text-xs text-zinc-500 mb-2">
                {(t as Record<string, string>).binanceSpotHint ?? "WebSocket miniTicker direto da Binance (tempo real)."}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <div>
                  <div className="text-[10px] text-zinc-500">
                    {(t as Record<string, string>).binanceSpotPriceLabel ?? "Spot price"}
                  </div>
                  <div className="text-sm font-mono text-zinc-800">
                    {binanceSpotPrice ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">
                    {(t as Record<string, string>).binanceSpotStatusLabel ?? "Status"}
                  </div>
                  <div className="text-sm font-mono text-zinc-800">
                    {binanceSpotStatus}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">
                    {(t as Record<string, string>).binanceSpotLastEventAtLabel ?? "Last event"}
                  </div>
                  <div className="text-sm font-mono text-zinc-800">
                    {binanceSpotLastEventAtUtc != null ? formatTime(binanceSpotLastEventAtUtc) : "—"}
                  </div>
                </div>
              </div>
              {binanceSpotError && (
                <p className="mt-1 text-xs text-red-600">{binanceSpotError}</p>
              )}
            </section>
            <section>
              <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                {t.validateKlines}
              </h4>
              <div className="flex gap-2">
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="flex-1 min-w-0 text-sm border border-zinc-300 rounded-md px-2.5 py-1.5 text-zinc-800 bg-white"
                  aria-label={t.symbol}
                >
                  <option value="BTCUSDT">BTCUSDT</option>
                  <option value="ETHUSDT">ETHUSDT</option>
                </select>
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
            <section>
              <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                {(t as { backfillPast?: string }).backfillPast ?? "Backfill do passado"}
              </h4>
              <p className="text-xs text-zinc-500 mb-2">
                {(t as Record<string, string>).backfillPastHint ?? "Usa o símbolo do campo acima."}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pastBackfillLoading !== null || loading}
                  onClick={() => runPastBackfill("1m")}
                  className="text-xs font-medium px-2.5 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {pastBackfillLoading === "1m" ? (t as { backfillPastLoading?: string }).backfillPastLoading ?? "Executando…" : (t as { backfillPast1m?: string }).backfillPast1m ?? "Backfill 1m (90 dias)"}
                </button>
                <button
                  type="button"
                  disabled={pastBackfillLoading !== null || loading}
                  onClick={() => runPastBackfill("1h")}
                  className="text-xs font-medium px-2.5 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {pastBackfillLoading === "1h" ? (t as { backfillPastLoading?: string }).backfillPastLoading ?? "Executando…" : (t as { backfillPast1h?: string }).backfillPast1h ?? "Backfill 1h (5 anos)"}
                </button>
              </div>
              {pastBackfillMessage && (
                <p className="mt-2 text-sm text-emerald-700">{pastBackfillMessage}</p>
              )}
            </section>
              </>
            )}
            {debugTab === "inspect" && (
              <>
            <section>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={showKlinesTable}
                  onChange={(e) => setShowKlinesTable(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                <span>{t.showKlinesTable}</span>
              </label>
            </section>
            <section>
              <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                Layout load (ao entrar na página)
              </h4>
              <button
                type="button"
                role="checkbox"
                aria-checked={layoutLoadDebugEnabled}
                onClick={() => setLayoutLoadDebugEnabled(!layoutLoadDebugEnabled)}
                className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700 mb-2 text-left w-full py-1 rounded hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-1"
              >
                <span
                  className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${layoutLoadDebugEnabled ? "bg-violet-600 border-violet-600 text-white" : "border-zinc-300 bg-white"}`}
                  aria-hidden
                >
                  {layoutLoadDebugEnabled ? "✓" : ""}
                </span>
                <span>Registrar log (estado salvo no localStorage)</span>
              </button>
              <button
                type="button"
                role="checkbox"
                aria-checked={layoutSaveLoadDebugEnabled}
                onClick={() => setLayoutSaveLoadDebugEnabled(!layoutSaveLoadDebugEnabled)}
                className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700 mb-2 text-left w-full py-1 rounded hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-1"
              >
                <span
                  className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${layoutSaveLoadDebugEnabled ? "bg-violet-600 border-violet-600 text-white" : "border-zinc-300 bg-white"}`}
                  aria-hidden
                >
                  {layoutSaveLoadDebugEnabled ? "✓" : ""}
                </span>
                <span>Debug save/load (cor eixo Y)</span>
              </button>
              <div className="flex justify-end gap-2 mb-1">
                <button
                  type="button"
                  onClick={clearLayoutLoadLog}
                  className="text-xs text-zinc-500 hover:text-zinc-700"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const text = layoutLoadLog.length === 0 ? "" : layoutLoadLog.join("\n");
                    try {
                      await navigator.clipboard.writeText(text);
                      setLayoutLogCopied(true);
                      setTimeout(() => setLayoutLogCopied(false), 2000);
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-700"
                >
                  {(t as Record<string, string>).copyLog ?? "Copiar"}
                  {layoutLogCopied ? ` — ${(t as Record<string, string>).copyLogDone ?? "Copiado!"}` : ""}
                </button>
              </div>
              <pre className="text-[10px] font-mono text-zinc-700 bg-zinc-100 rounded p-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                {layoutLoadLog.length === 0 ? "(vazio — ative o log e entre na página do gráfico)" : layoutLoadLog.join("\n")}
              </pre>
            </section>
              </>
            )}
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
