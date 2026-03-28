"use client";

import { useEffect, useState } from "react";
import { useCryptoLang, useCryptoLangContext } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { API_BASE } from "@/app/constants";
import { DEFAULT_SYMBOLS_LIST } from "@/app/lib/kline-symbols";
import { useSistemaDebug } from "./SistemaDebugContext";
import { useKlinesIndicators } from "./KlinesIndicatorsContext";
import { getSessionDebugEnabled, setSessionDebugEnabled, type SessionDebugInfo } from "./sessionTabId";
import { runDrawingsQaTests } from "./debug/drawingsQaTests";
import { runIndicatorsQaTests } from "./debug/indicatorsQaTests";

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
  | { "1m": ValidateSingleResult; "5m": ValidateSingleResult; "1h": ValidateSingleResult }
  | ValidateSingleResult
  | null;

export default function SistemaDebugPanel() {
  const lang = useCryptoLang();
  const { lang: currentLang, setLang } = useCryptoLangContext();
  const t = getCryptoT(lang).sistema.debug;
  const { showKlinesTable, setShowKlinesTable, layoutLoadLog, layoutLoadDebugEnabled, setLayoutLoadDebugEnabled, layoutSaveLoadDebugEnabled, setLayoutSaveLoadDebugEnabled, clearLayoutLoadLog } = useSistemaDebug();
  const { userIndicators } = useKlinesIndicators();
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState(() => DEFAULT_SYMBOLS_LIST[0] ?? "BTCUSDT");
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
  const [pastBackfillLoading, setPastBackfillLoading] = useState<"1m" | "5m" | "1h" | null>(null);
  const [pastBackfillMessage, setPastBackfillMessage] = useState<string | null>(null);
  const [lastBackfillLog, setLastBackfillLog] = useState<string | null>(null);
  const [backfillAllSymbols, setBackfillAllSymbols] = useState(false);
  const [backfillOnlyMissing, setBackfillOnlyMissing] = useState(false);
  const [backfillTarget, setBackfillTarget] = useState<"dev" | "prod">("dev");
  const [chartModels, setChartModels] = useState<{ slot: number; name?: string }[]>([]);
  const [chartModelsLoading, setChartModelsLoading] = useState(false);
  const [selectedChartModelSlot, setSelectedChartModelSlot] = useState<number | null>(null);
  const [saveChartModelLoading, setSaveChartModelLoading] = useState(false);
  const [saveChartModelMessage, setSaveChartModelMessage] = useState<string | null>(null);
  const [debugTab, setDebugTab] = useState<"main" | "inspect" | "qa" | "historico-dev" | "historico-prod" | "validador-dev" | "validador-prod" | "acesso">("main");
  const [qaResults, setQaResults] = useState<{ name: string; pass: boolean; message?: string; evidence?: string }[]>([]);
  const [qaIndicatorResults, setQaIndicatorResults] = useState<{ name: string; pass: boolean; message?: string; evidence?: string }[]>([]);
  const [layoutLogCopied, setLayoutLogCopied] = useState(false);
  const [sessionDebugEnabled, setSessionDebugEnabledState] = useState(false);
  const [sessionDebugInfo, setSessionDebugInfoState] = useState<SessionDebugInfo | null>(null);
  const [syncKlinesLoading, setSyncKlinesLoading] = useState(false);
  const [syncKlinesMessage, setSyncKlinesMessage] = useState<string | null>(null);
  const [cacheRefreshLoading, setCacheRefreshLoading] = useState(false);
  const [cacheRefreshMessage, setCacheRefreshMessage] = useState<string | null>(null);
  const [isDevHost, setIsDevHost] = useState(false);
  const [historicoSymbolsList, setHistoricoSymbolsList] = useState<string[]>(() => [...DEFAULT_SYMBOLS_LIST]);
  const [validadorLoading, setValidadorLoading] = useState(false);
  const [validadorRows, setValidadorRows] = useState<{
    symbol: string;
    count1m: number;
    count5m: number;
    count1h: number;
    ok1m: boolean;
    ok5m: boolean;
    ok1h: boolean;
    gapCount1m: number;
    gapCount5m: number;
    gapCount1h: number;
  }[]>([]);
  const [validadorIncomplete, setValidadorIncomplete] = useState<string[]>([]);
  const [validadorWithGaps, setValidadorWithGaps] = useState<string[]>([]);
  const [accessUserId, setAccessUserId] = useState("");
  const [accessDays, setAccessDays] = useState(1);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [truncateAtemporalLoading, setTruncateAtemporalLoading] = useState(false);
  const [truncateAtemporalMessage, setTruncateAtemporalMessage] = useState<string | null>(null);
  const [truncateAtemporalErr, setTruncateAtemporalErr] = useState(false);
  const [urlDevConfigured, setUrlDevConfigured] = useState<boolean | null>(null);
  const [urlProdConfigured, setUrlProdConfigured] = useState<boolean | null>(null);
  const [truncateAtemporalProdLoading, setTruncateAtemporalProdLoading] = useState(false);
  const [truncateAtemporalProdMessage, setTruncateAtemporalProdMessage] = useState<string | null>(null);
  const [truncateAtemporalProdErr, setTruncateAtemporalProdErr] = useState(false);

  type ProdConfirmState =
    | { kind: "pastBackfill"; target: "dev" | "prod"; interval: "1m" | "5m" | "1h" }
    | { kind: "syncKlines"; target: "dev" | "prod" }
    | { kind: "cacheRefresh"; target: "dev" | "prod" }
    | { kind: "validateKlines"; target: "dev" | "prod" }
    | { kind: "backfill"; target: "dev" | "prod"; interval: "1m" | "5m" | "1h"; gaps: { from: number; to: number }[] }
    | { kind: "registerGaps"; target: "dev" | "prod"; interval: "1m" | "5m" | "1h"; gaps: { from: number; to: number }[] }
    | { kind: "validateAll"; target: "dev" | "prod" }
    | { kind: "truncateAtemporalDev" }
    | { kind: "truncateAtemporalProd" };

  const [prodConfirm, setProdConfirm] = useState<ProdConfirmState | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setIsDevHost(window.location.hostname === "localhost");
  }, []);

  useEffect(() => {
    if (!open || !isDevHost || (debugTab !== "historico-dev" && debugTab !== "historico-prod")) return;
    const target = debugTab === "historico-prod" ? "prod" : "dev";
    fetch(`${API_BASE}/debug/kline-symbols?target=${target}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { symbols?: string[] }) => {
        if (Array.isArray(data?.symbols) && data.symbols.length > 0) {
          setHistoricoSymbolsList(data.symbols);
          setSymbol((prev) => (data.symbols!.includes(prev) ? prev : data.symbols![0] ?? prev));
        }
      })
      .catch(() => {});
  }, [open, isDevHost, debugTab]);

  useEffect(() => {
    if (!open || !isDevHost || debugTab !== "historico-dev") return;
    setUrlDevConfigured(null);
    fetch(`${API_BASE}/debug/truncate-atemporal-dev`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { urlDevConfigured?: boolean }) => {
        setUrlDevConfigured(data?.urlDevConfigured === true);
      })
      .catch(() => setUrlDevConfigured(false));
  }, [open, isDevHost, debugTab]);

  useEffect(() => {
    if (!open || !isDevHost || debugTab !== "historico-prod") return;
    setUrlProdConfigured(null);
    fetch(`${API_BASE}/debug/truncate-atemporal-prod`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { urlProdConfigured?: boolean }) => {
        setUrlProdConfigured(data?.urlProdConfigured === true);
      })
      .catch(() => setUrlProdConfigured(false));
  }, [open, isDevHost, debugTab]);

  const historicoSymbols = historicoSymbolsList;
  const displaySymbol = historicoSymbols.includes(symbol) ? symbol : (historicoSymbols[0] ?? "BTCUSDT");
  const isHistoricoTab = debugTab === "historico-dev" || debugTab === "historico-prod";
  const historicoTarget: "dev" | "prod" = debugTab === "historico-prod" ? "prod" : "dev";
  const isValidadorTab = debugTab === "validador-dev" || debugTab === "validador-prod";
  const validadorTarget: "dev" | "prod" = debugTab === "validador-prod" ? "prod" : "dev";

  const confirmProdSymbol = symbol.trim();
  const confirmProdCoinsCountLabel =
    historicoSymbols.length > 0
      ? `${historicoSymbols.length} ${historicoSymbols.length === 1 ? (t as Record<string, string>).backfillAllSymbolsOne ?? "moeda" : (t as Record<string, string>).backfillAllSymbolsCount ?? "moedas"}`
      : (t as Record<string, string>).backfillAllSymbols ?? "Para todas as moedas";
  const confirmProdCoinsLabel =
    backfillAllSymbols && backfillOnlyMissing
      ? `${confirmProdCoinsCountLabel} — ${(t as Record<string, string>).backfillOnlyMissing ?? "Apenas moedas sem histórico (novas)"}`
      : confirmProdCoinsCountLabel;

  const prodConfirmBusy =
    loading ||
    backfillLoading !== null ||
    registerGapsLoading !== null ||
    pastBackfillLoading !== null ||
    syncKlinesLoading ||
    cacheRefreshLoading ||
    validadorLoading ||
    truncateAtemporalLoading ||
    truncateAtemporalProdLoading;

  useEffect(() => {
    setSessionDebugEnabledState(getSessionDebugEnabled());
  }, [open]);

  useEffect(() => {
    if (!sessionDebugEnabled || typeof window === "undefined") return;
    const read = () => setSessionDebugInfoState(window.__backcryptoSessionDebugInfo ?? null);
    read();
    window.addEventListener("backcrypto-session-debug-update", read);
    const id = setInterval(read, 2000);
    return () => {
      window.removeEventListener("backcrypto-session-debug-update", read);
      clearInterval(id);
    };
  }, [sessionDebugEnabled]);


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

  async function runValidate(target: "dev" | "prod") {
    setError(null);
    setResult(null);
    setBackfillMessage(null);
    setRegisterGapsLoading(null);
    setLoading(true);
    try {
      const targetParam = isDevHost && target === "prod" ? "&target=prod" : "";
      const res = await fetch(
        `${API_BASE}/debug/klines-validate?symbol=${encodeURIComponent(symbol.trim())}${targetParam}`,
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

  function isHistoricResults(r: ValidateResult): r is { "1m": ValidateSingleResult; "5m": ValidateSingleResult; "1h": ValidateSingleResult } {
    return r != null && typeof r === "object" && "1m" in r && "5m" in r && "1h" in r;
  }

  async function runRegisterGaps(interval: "1m" | "5m" | "1h", gaps: { from: number; to: number }[], target: "dev" | "prod") {
    if (gaps.length === 0) return;
    setBackfillMessage(null);
    setRegisterGapsLoading(interval);
    await new Promise((r) => setTimeout(r, 0));
    try {
      const gapPayload = {
        symbol: symbol.trim(),
        gaps: gaps.map((g) => ({ interval, from: g.from, to: g.to })),
        ...(isDevHost && target === "prod" ? { target: "prod" as const } : {}),
      };
      const res = await fetch(`${API_BASE}/debug/klines-gaps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(gapPayload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBackfillMessage((data && typeof data.error === "string" ? data.error : null) || t.error);
        return;
      }
      const n = data.registered ?? 0;
      setBackfillMessage((t as { registerGapsSuccess?: string }).registerGapsSuccess?.replace("{n}", String(n)) ?? `Registrados: ${n}`);
      runValidate(target);
    } catch (e) {
      setBackfillMessage(e instanceof Error ? e.message : t.error);
    } finally {
      setRegisterGapsLoading(null);
    }
  }

  function formatBackfillLog(data: {
    target?: string;
    symbol?: string;
    symbolsRun?: string[];
    inserted1m?: number;
    inserted5m?: number;
    inserted1h?: number;
    details?: { symbol: string; interval: string; from: number; to: number; fetched: number; inserted: number }[];
  }): string {
    const targetLabel = data.target === "prod" ? "Prod" : "Dev";
    const lines: string[] = [
      `Alvo: ${targetLabel}`,
      `Símbolo: ${data.symbol ?? "—"}`,
      data.symbolsRun?.length ? `Moedas: ${data.symbolsRun.length} (${data.symbolsRun.slice(0, 5).join(", ")}${data.symbolsRun.length > 5 ? "…" : ""})` : "",
      "",
      "1m — BinanceKlineFast",
      `  Inseridas: ${data.inserted1m ?? 0}`,
      "",
      "5m — BinanceKlineMonth",
      `  Inseridas: ${data.inserted5m ?? 0}`,
      "",
      "1h — BinanceKline",
      `  Inseridas: ${data.inserted1h ?? 0}`,
    ].filter(Boolean);
    if (Array.isArray(data.details) && data.details.length > 0) {
      lines.push("", "Detalhes por símbolo/intervalo:");
      for (const d of data.details.slice(0, 30)) {
        lines.push(`  ${d.symbol} ${d.interval}: Binance ${d.fetched} → inseridas ${d.inserted}`);
      }
      if (data.details.length > 30) {
        lines.push(`  … +${data.details.length - 30} mais`);
      }
    }
    return lines.join("\n");
  }

  async function runBackfill(interval: "1m" | "5m" | "1h", gaps: { from: number; to: number }[], target: "dev" | "prod") {
    if (gaps.length === 0) return;
    setBackfillMessage(null);
    setBackfillLoading(interval);
    await new Promise((r) => setTimeout(r, 0));
    const payload = {
      symbol: symbol.trim(),
      gaps: gaps.map((g) => ({ interval, from: g.from, to: g.to })),
      target,
    };
    try {
      const res = await fetch(`${API_BASE}/debug/klines-backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBackfillMessage((data && typeof data.error === "string" ? data.error : null) || t.error);
        return;
      }
      const inserted = interval === "1m" ? data.inserted1m : interval === "5m" ? data.inserted5m : data.inserted1h;
      const detail = Array.isArray(data.details) ? data.details.find((d: { interval: string }) => d.interval === interval) : null;
      const targetLabel = data.target === "prod" ? (t as Record<string, string>).backfillTargetProd ?? "Prod" : (t as Record<string, string>).backfillTargetDev ?? "Dev";
      const msg = (t as { backfillSuccess?: string }).backfillSuccess?.replace("{n}", String(inserted ?? 0)) ?? `Inseridas: ${inserted ?? 0}`;
      const withTarget = `${msg} (${targetLabel})`;
      setBackfillMessage(detail && (detail.fetched === 0 || (detail.inserted === 0 && detail.fetched > 0)) ? `${withTarget} — Binance: ${detail.fetched}, inseridas: ${detail.inserted}` : withTarget);
      setLastBackfillLog(formatBackfillLog(data));
    } catch (e) {
      setBackfillMessage(e instanceof Error ? e.message : t.error);
    } finally {
      setBackfillLoading(null);
    }
  }

  const ONE_MINUTE_MS = 60 * 1000;
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const KLINE_1M_DAYS_MS = 9 * 24 * 60 * 60 * 1000;
  const KLINE_5M_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const KLINE_1H_DAYS_MS = 730 * 24 * 60 * 60 * 1000;

  function floorToHourMs(ms: number) {
    return Math.floor(ms / ONE_HOUR_MS) * ONE_HOUR_MS;
  }
  function floorTo5mMs(ms: number) {
    return Math.floor(ms / FIVE_MINUTES_MS) * FIVE_MINUTES_MS;
  }

  async function runPastBackfill(interval: "1m" | "5m" | "1h", target: "dev" | "prod") {
    const sym = symbol.trim();
    if (!backfillAllSymbols && !sym) {
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
        from = now - KLINE_1M_DAYS_MS - ONE_MINUTE_MS;
        to = now + ONE_MINUTE_MS;
      } else if (interval === "5m") {
        from = floorTo5mMs(now - KLINE_5M_DAYS_MS) - FIVE_MINUTES_MS;
        to = floorTo5mMs(now) + FIVE_MINUTES_MS;
      } else {
        from = floorToHourMs(now - KLINE_1H_DAYS_MS) - ONE_HOUR_MS;
        to = floorToHourMs(now) + ONE_HOUR_MS;
      }
      const payload = {
        symbol: backfillAllSymbols ? "all" : sym,
        useSymbolPeriods: true,
        interval,
        onlyMissing: backfillAllSymbols && backfillOnlyMissing,
        target,
      };
      const res = await fetch(`${API_BASE}/debug/klines-backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPastBackfillMessage((data && typeof data.error === "string" ? data.error : null) || t.error);
        return;
      }
      const inserted =
        interval === "1m" ? data.inserted1m : interval === "5m" ? data.inserted5m : data.inserted1h;
      const targetLabel = data.target === "prod" ? (t as Record<string, string>).backfillTargetProd ?? "Prod" : (t as Record<string, string>).backfillTargetDev ?? "Dev";
      const msg = (t as { backfillPastSuccess?: string }).backfillPastSuccess?.replace("{n}", String(inserted ?? 0)) ?? `Concluído. Inseridas: ${inserted ?? 0}`;
      setPastBackfillMessage(`${msg} (${targetLabel})`);
      setLastBackfillLog(formatBackfillLog(data));
    } catch (e) {
      setPastBackfillMessage(e instanceof Error ? e.message : t.error);
    } finally {
      setPastBackfillLoading(null);
    }
  }

  async function runSyncKlines(target: "dev" | "prod") {
    setSyncKlinesMessage(null);
    setSyncKlinesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/debug/sync-klines?target=${target}`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncKlinesMessage((data?.error ?? `HTTP ${res.status}`) + (data?.details ? ` — ${JSON.stringify(data.details)}` : ""));
        return;
      }
      const lines = data?.result?.map((r: { symbol: string; inserted: number; inserted5m?: number; inserted1h: number }) =>
        `${r.symbol}: 1m +${r.inserted} | 5m +${(r as { inserted5m?: number }).inserted5m ?? 0} | 1h +${r.inserted1h}`
      ) ?? [];
      setSyncKlinesMessage(lines.length ? lines.join("\n") : (t as { ok?: string }).ok ?? "OK");
      runValidate(target);
    } catch (e) {
      setSyncKlinesMessage(e instanceof Error ? e.message : t.error);
    } finally {
      setSyncKlinesLoading(false);
    }
  }

  async function runCacheRefresh(target: "dev" | "prod") {
    setCacheRefreshMessage(null);
    setCacheRefreshLoading(true);
    try {
      const res = await fetch(`${API_BASE}/debug/cache-refresh?target=${target}`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCacheRefreshMessage((data?.error ?? `HTTP ${res.status}`) + (data?.details ? ` — ${JSON.stringify(data.details)}` : ""));
        return;
      }
      const total = data?.totalRows ?? 0;
      const lines = data?.details?.map((d: { symbol: string; interval: string; rows: number }) =>
        `${d.symbol} ${d.interval}: ${d.rows} rows`
      ) ?? [];
      setCacheRefreshMessage(total ? `Total: ${total} rows\n${lines.join("\n")}` : (t as { ok?: string }).ok ?? "OK");
      runValidate(target);
    } catch (e) {
      setCacheRefreshMessage(e instanceof Error ? e.message : t.error);
    } finally {
      setCacheRefreshLoading(false);
    }
  }

  async function runTruncateAtemporalProd() {
    setTruncateAtemporalProdMessage(null);
    setTruncateAtemporalProdErr(false);
    setTruncateAtemporalProdLoading(true);
    try {
      const res = await fetch(`${API_BASE}/debug/truncate-atemporal-prod`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTruncateAtemporalProdErr(true);
        setTruncateAtemporalProdMessage(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
        return;
      }
      const tables = Array.isArray(data?.tables) ? (data.tables as string[]).join(", ") : "";
      const msg =
        ((t as Record<string, string>).truncateAtemporalProdSuccess ?? "Truncado (prod): {tables}").replace("{tables}", tables);
      setTruncateAtemporalProdMessage(msg);
      fetch(`${API_BASE}/debug/truncate-atemporal-prod`, { credentials: "include" })
        .then((r) => r.json())
        .then((d: { urlProdConfigured?: boolean }) => setUrlProdConfigured(d?.urlProdConfigured === true))
        .catch(() => {});
    } catch (e) {
      setTruncateAtemporalProdErr(true);
      setTruncateAtemporalProdMessage(e instanceof Error ? e.message : t.error);
    } finally {
      setTruncateAtemporalProdLoading(false);
    }
  }

  async function runTruncateAtemporalDev() {
    setTruncateAtemporalMessage(null);
    setTruncateAtemporalErr(false);
    setTruncateAtemporalLoading(true);
    try {
      const res = await fetch(`${API_BASE}/debug/truncate-atemporal-dev`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTruncateAtemporalErr(true);
        setTruncateAtemporalMessage(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
        return;
      }
      const tables = Array.isArray(data?.tables) ? (data.tables as string[]).join(", ") : "";
      const msg =
        ((t as Record<string, string>).truncateAtemporalDevSuccess ?? "Truncado: {tables}").replace("{tables}", tables);
      setTruncateAtemporalMessage(msg);
      fetch(`${API_BASE}/debug/truncate-atemporal-dev`, { credentials: "include" })
        .then((r) => r.json())
        .then((d: { urlDevConfigured?: boolean }) => setUrlDevConfigured(d?.urlDevConfigured === true))
        .catch(() => {});
    } catch (e) {
      setTruncateAtemporalErr(true);
      setTruncateAtemporalMessage(e instanceof Error ? e.message : t.error);
    } finally {
      setTruncateAtemporalLoading(false);
    }
  }

  async function runValidador(target: "dev" | "prod") {
    setValidadorRows([]);
    setValidadorIncomplete([]);
    setValidadorWithGaps([]);
    setValidadorLoading(true);
    try {
      const res = await fetch(`${API_BASE}/debug/klines-validate-all?target=${target}`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setValidadorIncomplete([(data?.error ?? `HTTP ${res.status}`) as string]);
        return;
      }
      if (Array.isArray(data.rows)) setValidadorRows(data.rows);
      if (Array.isArray(data.incomplete)) setValidadorIncomplete(data.incomplete);
      if (Array.isArray(data.withGaps)) setValidadorWithGaps(data.withGaps);
    } catch (e) {
      setValidadorIncomplete([e instanceof Error ? e.message : t.error]);
    } finally {
      setValidadorLoading(false);
    }
  }

  async function performProdAction(action: ProdConfirmState) {
    switch (action.kind) {
      case "pastBackfill":
        return runPastBackfill(action.interval, action.target);
      case "syncKlines":
        return runSyncKlines(action.target);
      case "cacheRefresh":
        return runCacheRefresh(action.target);
      case "validateKlines":
        return runValidate(action.target);
      case "backfill":
        return runBackfill(action.interval, action.gaps, action.target);
      case "registerGaps":
        return runRegisterGaps(action.interval, action.gaps, action.target);
      case "validateAll":
        return runValidador(action.target);
      case "truncateAtemporalDev":
        return runTruncateAtemporalDev();
      case "truncateAtemporalProd":
        return runTruncateAtemporalProd();
    }
  }

  function requestProdConfirm(action: ProdConfirmState) {
    if (action.kind === "truncateAtemporalDev" || action.kind === "truncateAtemporalProd") {
      setProdConfirm(action);
      return;
    }
    if (action.target !== "prod") {
      void performProdAction(action);
      return;
    }
    setProdConfirm(action);
  }

  function confirmProdNow() {
    if (!prodConfirm) return;
    const action = prodConfirm;
    setProdConfirm(null);
    void performProdAction(action);
  }

  function ResultBlock({ label, res, target }: { label: string; res: ValidateSingleResult; target: "dev" | "prod" }) {
    const interval = res.interval as "1m" | "5m" | "1h";
    const canBackfill = isDevHost && !res.ok && res.gaps.length > 0 && (interval === "1m" || interval === "5m" || interval === "1h");
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
                  onClick={() =>
                    requestProdConfirm({
                      kind: "backfill",
                      interval,
                      gaps: res.gaps,
                      target,
                    })
                  }
                  className="text-xs font-medium px-2.5 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {backfillLoading === interval ? (t as { backfillLoading?: string }).backfillLoading ?? "Preenchendo…" : (t as { backfill?: string }).backfill ?? "Preencher gaps"}
                </button>
                <button
                  type="button"
                  disabled={backfillLoading !== null || registerGapsLoading !== null}
                  onClick={() =>
                    requestProdConfirm({
                      kind: "registerGaps",
                      interval,
                      gaps: res.gaps,
                      target,
                    })
                  }
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
          style={{ width: "50vw" }}
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
            <button
              type="button"
              onClick={() => setDebugTab("qa")}
              className={`flex-1 py-2 text-xs font-medium ${debugTab === "qa" ? "text-zinc-800 border-b-2 border-zinc-600 bg-white" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              {(t as Record<string, string>).tabQa ?? "QA"}
            </button>
            <button
              type="button"
              onClick={() => setDebugTab("historico-dev")}
              className={`flex-1 py-2 text-xs font-medium ${debugTab === "historico-dev" ? "text-zinc-800 border-b-2 border-zinc-600 bg-white" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              {(t as Record<string, string>).tabHistoricoDev ?? "Hist (dev)"}
            </button>
            <button
              type="button"
              onClick={() => setDebugTab("historico-prod")}
              className={`flex-1 py-2 text-xs font-medium ${debugTab === "historico-prod" ? "text-zinc-800 border-b-2 border-zinc-600 bg-white" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              {(t as Record<string, string>).tabHistoricoProd ?? "Hist (prod)"}
            </button>
            <button
              type="button"
              onClick={() => setDebugTab("validador-dev")}
              className={`flex-1 py-2 text-xs font-medium ${debugTab === "validador-dev" ? "text-zinc-800 border-b-2 border-zinc-600 bg-white" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              {(t as Record<string, string>).tabValidadorDev ?? "Val (dev)"}
            </button>
            <button
              type="button"
              onClick={() => setDebugTab("validador-prod")}
              className={`flex-1 py-2 text-xs font-medium ${debugTab === "validador-prod" ? "text-zinc-800 border-b-2 border-zinc-600 bg-white" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              {(t as Record<string, string>).tabValidadorProd ?? "Val (prod)"}
            </button>
            <button
              type="button"
              onClick={() => setDebugTab("acesso")}
              className={`flex-1 py-2 text-xs font-medium ${debugTab === "acesso" ? "text-zinc-800 border-b-2 border-zinc-600 bg-white" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              {(t as Record<string, string>).tabAcesso ?? "Acesso"}
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
              </>
            )}
            {isHistoricoTab && (
              <>
            <p className="text-xs text-zinc-500 mb-3">
              {historicoTarget === "prod"
                ? ((t as Record<string, string>).historicoProdHint ?? "Banco de produção (URL_PROD). Validação, backfill, sync e cache usam este banco.")
                : ((t as Record<string, string>).historicoDevHint ?? "Banco de desenvolvimento (URL_DEV). Validação, backfill, sync e cache usam este banco.")}
            </p>
            {isDevHost && (
            <section>
              <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                {t.validateKlines}
              </h4>
              <div className="flex gap-2">
                <select
                  value={displaySymbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="flex-1 min-w-0 text-sm border border-zinc-300 rounded-md px-2.5 py-1.5 text-zinc-800 bg-white"
                  aria-label={t.symbol}
                >
                  {historicoSymbols.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => requestProdConfirm({ kind: "validateKlines", target: historicoTarget })}
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
                  {isHistoricResults(result) ? (
                    <>
                      <ResultBlock label={t.validateKlines1m} res={result["1m"]} target={historicoTarget} />
                      <ResultBlock label={t.validateKlines5m} res={result["5m"]} target={historicoTarget} />
                      <ResultBlock label={t.validateKlines1h} res={result["1h"]} target={historicoTarget} />
                    </>
                  ) : (
                    <ResultBlock
                      label={(result as ValidateSingleResult).interval === "1m" ? t.validateKlines1m : (result as ValidateSingleResult).interval === "5m" ? t.validateKlines5m : t.validateKlines1h}
                      res={result as ValidateSingleResult}
                      target={historicoTarget}
                    />
                  )}
                </div>
              )}
            </section>
            )}
            {isDevHost && (
            <section>
              <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                {(t as { backfillPast?: string }).backfillPast ?? "Backfill do passado"}
              </h4>
              <p className="text-xs text-zinc-500 mb-2">
                {(t as Record<string, string>).backfillPastHint ?? "Usa o símbolo do campo acima. Mesmas tabelas, símbolos do banco desta aba."}
              </p>
              <label className="flex items-center gap-2 mb-2 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  checked={backfillAllSymbols}
                  onChange={(e) => setBackfillAllSymbols(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                {(t as Record<string, string>).backfillAllSymbols ?? "Para todas as moedas"}
                {historicoSymbols.length > 0 && ` (${historicoSymbols.length} ${historicoSymbols.length === 1 ? ((t as Record<string, string>).backfillAllSymbolsOne ?? "moeda") : ((t as Record<string, string>).backfillAllSymbolsCount ?? "moedas")})`}
              </label>
              {backfillAllSymbols && (
                <label className="flex items-center gap-2 mb-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={backfillOnlyMissing}
                    onChange={(e) => setBackfillOnlyMissing(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  {(t as Record<string, string>).backfillOnlyMissing ?? "Apenas moedas sem histórico (novas)"}
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pastBackfillLoading !== null || loading}
                  onClick={() => requestProdConfirm({ kind: "pastBackfill", interval: "1m", target: historicoTarget })}
                  className="text-xs font-medium px-2.5 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {pastBackfillLoading === "1m" ? (t as { backfillPastLoading?: string }).backfillPastLoading ?? "Executando…" : (t as { backfillPast1m?: string }).backfillPast1m ?? "Backfill 1m (9 dias)"}
                </button>
                <button
                  type="button"
                  disabled={pastBackfillLoading !== null || loading}
                  onClick={() => requestProdConfirm({ kind: "pastBackfill", interval: "5m", target: historicoTarget })}
                  className="text-xs font-medium px-2.5 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {pastBackfillLoading === "5m" ? (t as { backfillPastLoading?: string }).backfillPastLoading ?? "Executando…" : (t as { backfillPast5m?: string }).backfillPast5m ?? "Backfill 5m (90 dias)"}
                </button>
                <button
                  type="button"
                  disabled={pastBackfillLoading !== null || loading}
                  onClick={() => requestProdConfirm({ kind: "pastBackfill", interval: "1h", target: historicoTarget })}
                  className="text-xs font-medium px-2.5 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {pastBackfillLoading === "1h" ? (t as { backfillPastLoading?: string }).backfillPastLoading ?? "Executando…" : (t as { backfillPast1h?: string }).backfillPast1h ?? "Backfill 1h (730 dias)"}
                </button>
              </div>
              {pastBackfillMessage && (
                <p className="mt-2 text-sm text-emerald-700">{pastBackfillMessage}</p>
              )}
              {lastBackfillLog && (
                <pre className="mt-3 text-xs font-mono text-zinc-700 whitespace-pre-wrap bg-zinc-100 p-3 rounded border border-zinc-200 max-h-64 overflow-auto">
                  {lastBackfillLog}
                </pre>
              )}
            </section>
            )}
            {isDevHost && (
            <div className="space-y-4">
            <section className="mt-4">
              <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                {(t as Record<string, string>).syncKlinesTitle ?? "Sync klines"}
              </h4>
              <p className="text-xs text-zinc-500 mb-2">
                {(t as Record<string, string>).syncKlinesHint ?? "Atualiza BinanceKlineFast 1m, BinanceKlineMonth 5m e BinanceKline 1h no banco do ambiente atual."}
              </p>
              <button
                type="button"
                disabled={syncKlinesLoading}
                onClick={() => requestProdConfirm({ kind: "syncKlines", target: historicoTarget })}
                className="text-xs font-medium px-2.5 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {syncKlinesLoading ? ((t as { loading?: string }).loading ?? "Executando…") : ((t as Record<string, string>).syncKlinesRun ?? "Executar sync agora")}
              </button>
              {syncKlinesMessage && (
                <pre className="mt-2 text-xs font-mono text-zinc-700 whitespace-pre-wrap bg-zinc-100 p-2 rounded border border-zinc-200">
                  {syncKlinesMessage}
                </pre>
              )}
            </section>
            <section className="mt-4">
              <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                {(t as Record<string, string>).cacheRefreshTitle ?? "Refresh cache"}
              </h4>
              <p className="text-xs text-zinc-500 mb-2">
                {(t as Record<string, string>).cacheRefreshHint ?? "Recria BinanceKlineCache (1m–1d) a partir de 1m, 5m e 1h. Ambiente atual."}
              </p>
              <button
                type="button"
                disabled={cacheRefreshLoading}
                onClick={() => requestProdConfirm({ kind: "cacheRefresh", target: historicoTarget })}
                className="text-xs font-medium px-2.5 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {cacheRefreshLoading ? ((t as { loading?: string }).loading ?? "Executando…") : ((t as Record<string, string>).cacheRefreshRun ?? "Executar refresh agora")}
              </button>
              {cacheRefreshMessage && (
                <pre className="mt-2 text-xs font-mono text-zinc-700 whitespace-pre-wrap bg-zinc-100 p-2 rounded border border-zinc-200">
                  {cacheRefreshMessage}
                </pre>
              )}
            </section>
            {historicoTarget === "dev" && (
              <section className="mt-4">
                <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                  {(t as Record<string, string>).truncateAtemporalDevTitle ?? "Truncar tabelas atemporais (URL_DEV)"}
                </h4>
                <p className="text-xs text-zinc-500 mb-2">
                  {(t as Record<string, string>).truncateAtemporalDevHint ?? "Renko, Range, Kagi no banco URL_DEV."}
                </p>
                {urlDevConfigured === false && (
                  <p className="text-xs text-amber-700 mb-2">
                    {(t as Record<string, string>).truncateAtemporalDevUrlDevMissing ?? "URL_DEV não definido."}
                  </p>
                )}
                <button
                  type="button"
                  disabled={truncateAtemporalLoading || urlDevConfigured === false}
                  onClick={() => requestProdConfirm({ kind: "truncateAtemporalDev" })}
                  className="text-xs font-medium px-2.5 py-1.5 rounded bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {truncateAtemporalLoading
                    ? ((t as Record<string, string>).truncateAtemporalDevLoading ?? "Truncando…")
                    : ((t as Record<string, string>).truncateAtemporalDevRun ?? "Truncar tabelas")}
                </button>
                {truncateAtemporalMessage && (
                  <p className={`mt-2 text-xs ${truncateAtemporalErr ? "text-red-600" : "text-emerald-700"}`}>
                    {truncateAtemporalMessage}
                  </p>
                )}
              </section>
            )}
            {historicoTarget === "prod" && (
              <section className="mt-4">
                <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                  {(t as Record<string, string>).truncateAtemporalProdTitle ?? "Truncar tabelas atemporais (URL_PROD)"}
                </h4>
                <p className="text-xs text-zinc-500 mb-2">
                  {(t as Record<string, string>).truncateAtemporalProdHint ?? "Renko, Range, Kagi no banco de produção."}
                </p>
                {urlProdConfigured === false && (
                  <p className="text-xs text-amber-700 mb-2">
                    {(t as Record<string, string>).truncateAtemporalProdUrlProdMissing ?? "URL_PROD não definido."}
                  </p>
                )}
                <button
                  type="button"
                  disabled={truncateAtemporalProdLoading || urlProdConfigured === false}
                  onClick={() => requestProdConfirm({ kind: "truncateAtemporalProd" })}
                  className="text-xs font-medium px-2.5 py-1.5 rounded bg-red-800 text-white hover:bg-red-900 disabled:opacity-50"
                >
                  {truncateAtemporalProdLoading
                    ? ((t as Record<string, string>).truncateAtemporalProdLoadingLabel ?? "Truncando…")
                    : ((t as Record<string, string>).truncateAtemporalProdRun ?? "Truncar tabelas (produção)")}
                </button>
                {truncateAtemporalProdMessage && (
                  <p className={`mt-2 text-xs ${truncateAtemporalProdErr ? "text-red-600" : "text-emerald-700"}`}>
                    {truncateAtemporalProdMessage}
                  </p>
                )}
              </section>
            )}
            </div>
            )}
            </>
            )}
            {debugTab === "qa" && (
              <>
              <section>
                <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                  {(t as Record<string, string>).qaDrawingsTitle ?? "Testes QA — Desenhos"}
                </h4>
                <p className="text-xs text-zinc-500 mb-2">
                  {(t as Record<string, string>).qaDrawingsHint ?? "Mesma lógica dos testes Vitest (npm test), rodando no browser."}
                </p>
                <button
                  type="button"
                  onClick={() => setQaResults(runDrawingsQaTests())}
                  className="mb-3 text-sm font-medium px-3 py-2 rounded-md bg-zinc-800 text-white hover:bg-zinc-700"
                >
                  {(t as Record<string, string>).qaDrawingsRun ?? "Executar testes"}
                </button>
                {qaResults.length === 0 ? (
                  <p className="text-sm text-zinc-500">Clique em &quot;Executar testes&quot; para rodar.</p>
                ) : (
                  <>
                    <ul className="space-y-3">
                      {qaResults.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="shrink-0" aria-hidden>{r.pass ? "✅" : "❌"}</span>
                          <div className="min-w-0 flex-1">
                            <span className={r.pass ? "text-zinc-700" : "text-red-700"}>{r.name}</span>
                            {r.message != null && <span className="block text-xs text-zinc-500 mt-0.5">{r.message}</span>}
                            {r.evidence != null && (
                              <pre className="mt-1.5 p-2 text-[10px] font-mono text-zinc-600 bg-zinc-100 rounded border border-zinc-200 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                                {r.evidence}
                              </pre>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-zinc-500">
                      {(t as Record<string, string>).qaDrawingsSummary ?? "Total"}: {qaResults.filter((r) => r.pass).length}/{qaResults.length} passaram
                    </p>
                  </>
                )}
              </section>
              <section className="mt-6">
                <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                  {(t as Record<string, string>).qaIndicatorsTitle ?? "Testes QA — Indicadores"}
                </h4>
                <p className="text-xs text-zinc-500 mb-2">
                  {(t as Record<string, string>).qaIndicatorsHint ?? "SMA: adicionar em 1h e 4h, verificar que não aparece em 2h; editar para todos os tempos; cor/espessura; séries em criar estratégia e meus indicadores; excluir."}
                </p>
                <button
                  type="button"
                  onClick={() => setQaIndicatorResults(runIndicatorsQaTests())}
                  className="mb-3 text-sm font-medium px-3 py-2 rounded-md bg-zinc-800 text-white hover:bg-zinc-700"
                >
                  {(t as Record<string, string>).qaIndicatorsRun ?? "Executar testes — Indicadores"}
                </button>
                {qaIndicatorResults.length === 0 ? (
                  <p className="text-sm text-zinc-500">Clique em &quot;Executar testes — Indicadores&quot; para rodar.</p>
                ) : (
                  <>
                    <ul className="space-y-3">
                      {qaIndicatorResults.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="shrink-0" aria-hidden>{r.pass ? "✅" : "❌"}</span>
                          <div className="min-w-0 flex-1">
                            <span className={r.pass ? "text-zinc-700" : "text-red-700"}>{r.name}</span>
                            {r.message != null && <span className="block text-xs text-zinc-500 mt-0.5">{r.message}</span>}
                            {r.evidence != null && (
                              <pre className="mt-1.5 p-2 text-[10px] font-mono text-zinc-600 bg-zinc-100 rounded border border-zinc-200 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                                {r.evidence}
                              </pre>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-zinc-500">
                      {(t as Record<string, string>).qaIndicatorsSummary ?? "Total"}: {qaIndicatorResults.filter((r) => r.pass).length}/{qaIndicatorResults.length} passaram
                    </p>
                  </>
                )}
              </section>
              </>
            )}
            {isValidadorTab && isDevHost && (
              <div className="space-y-4">
              <p className="text-xs text-zinc-500 mb-3">
                {validadorTarget === "prod"
                  ? ((t as Record<string, string>).historicoProdHint ?? "Banco de produção (URL_PROD).")
                  : ((t as Record<string, string>).historicoDevHint ?? "Banco de desenvolvimento (URL_DEV).")}
              </p>
              <section>
                <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                  {(t as Record<string, string>).validadorTitle ?? "Validador de tempo por cryptomoeda"}
                </h4>
                <p className="text-xs text-zinc-500 mb-2">
                  {(t as Record<string, string>).validadorHint ?? "Percorre todas as moedas do banco. Tabela: quantidade de registros (1m, 5m, 1h) e OK / problema. Ao final: moedas incompletas."}
                </p>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={validadorLoading}
                  onClick={() => requestProdConfirm({ kind: "validateAll", target: validadorTarget })}
                    className="text-xs font-medium px-2.5 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {validadorLoading ? ((t as { loading?: string }).loading ?? "Executando…") : ((t as Record<string, string>).validadorRun ?? "Executar validação")}
                  </button>
                </div>
                {validadorRows.length > 0 && (
                  <>
                    <div className="overflow-x-auto border border-zinc-200 rounded-md">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-100">
                            <th className="text-left p-2 border-b border-zinc-200">{(t as Record<string, string>).symbol ?? "Criptomoeda"}</th>
                            <th className="text-right p-2 border-b border-zinc-200">1m</th>
                            <th className="text-right p-2 border-b border-zinc-200">5m</th>
                            <th className="text-right p-2 border-b border-zinc-200">1h</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validadorRows.map((row) => (
                            <tr key={row.symbol} className="border-b border-zinc-100 hover:bg-zinc-50">
                              <td className="p-2 font-medium">{row.symbol}</td>
                              <td className="p-2 text-right">
                                {row.count1m.toLocaleString()}
                                <span className="ml-1" aria-hidden>{row.ok1m ? "✓" : "✗"}</span>
                              </td>
                              <td className="p-2 text-right">
                                {row.count5m.toLocaleString()}
                                <span className="ml-1" aria-hidden>{row.ok5m ? "✓" : "✗"}</span>
                              </td>
                              <td className="p-2 text-right">
                                {row.count1h.toLocaleString()}
                                <span className="ml-1" aria-hidden>{row.ok1h ? "✓" : "✗"}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {validadorIncomplete.length > 0 && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                        <p className="text-xs font-medium text-amber-800 mb-1">
                          {(t as Record<string, string>).validadorIncompleteTitle ?? "Criptomoedas incompletas (com problema em 1m, 5m ou 1h):"}
                        </p>
                        <p className="text-xs text-amber-800 font-mono">{validadorIncomplete.join(", ")}</p>
                      </div>
                    )}
                    {validadorIncomplete.length === 0 && validadorRows.length > 0 && (
                      <p className="mt-3 text-sm text-emerald-700">{(t as Record<string, string>).validadorAllOk ?? "Todas as moedas OK."}</p>
                    )}
                  </>
                )}
                {validadorRows.length > 0 && (
                  <>
                    <h4 className="text-xs font-medium text-zinc-600 uppercase tracking-wide mt-6 mb-2">
                      {(t as Record<string, string>).validadorGapTitle ?? "Validador de gap (no período de dados)"}
                    </h4>
                    <p className="text-xs text-zinc-500 mb-2">
                      {(t as Record<string, string>).validadorGapHint ?? "Analisa se existe algum gap (intervalo pulado) em 1m, 5m e 1h no período configurado por moeda."}
                    </p>
                    <div className="overflow-x-auto border border-zinc-200 rounded-md">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-100">
                            <th className="text-left p-2 border-b border-zinc-200">{(t as Record<string, string>).symbol ?? "Criptomoeda"}</th>
                            <th className="text-right p-2 border-b border-zinc-200">1m</th>
                            <th className="text-right p-2 border-b border-zinc-200">5m</th>
                            <th className="text-right p-2 border-b border-zinc-200">1h</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validadorRows.map((row) => {
                            const gc1m = row.gapCount1m ?? 0;
                            const gc5m = row.gapCount5m ?? 0;
                            const gc1h = row.gapCount1h ?? 0;
                            const ok1m = gc1m === 0;
                            const ok5m = gc5m === 0;
                            const ok1h = gc1h === 0;
                            return (
                              <tr key={row.symbol} className="border-b border-zinc-100 hover:bg-zinc-50">
                                <td className="p-2 font-medium">{row.symbol}</td>
                                <td className="p-2 text-right">
                                  {ok1m ? "0" : gc1m.toLocaleString()}
                                  <span className="ml-1" aria-hidden>{ok1m ? "✓" : "✗"}</span>
                                </td>
                                <td className="p-2 text-right">
                                  {ok5m ? "0" : gc5m.toLocaleString()}
                                  <span className="ml-1" aria-hidden>{ok5m ? "✓" : "✗"}</span>
                                </td>
                                <td className="p-2 text-right">
                                  {ok1h ? "0" : gc1h.toLocaleString()}
                                  <span className="ml-1" aria-hidden>{ok1h ? "✓" : "✗"}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {validadorWithGaps.length > 0 && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                        <p className="text-xs font-medium text-amber-800 mb-1">
                          {(t as Record<string, string>).validadorWithGapsTitle ?? "Criptomoedas com gap (1m, 5m ou 1h):"}
                        </p>
                        <p className="text-xs text-amber-800 font-mono">{validadorWithGaps.join(", ")}</p>
                      </div>
                    )}
                    {validadorWithGaps.length === 0 && validadorRows.length > 0 && (
                      <p className="mt-3 text-sm text-emerald-700">{(t as Record<string, string>).validadorGapAllOk ?? "Nenhum gap no período."}</p>
                    )}
                  </>
                )}
                {validadorRows.length === 0 && !validadorLoading && (
                  <p className="text-sm text-zinc-500">{(t as Record<string, string>).validadorRunFirst ?? "Clique em Executar validação para preencher a tabela."}</p>
                )}
              </section>
              </div>
            )}
            {debugTab === "acesso" && (
              <div className="space-y-4">
                <section>
                  <h4 className="text-sm font-medium text-zinc-800 mb-2">
                    {(t as Record<string, string>).accessTitle ?? "Conceder acesso (lite)"}
                  </h4>
                  <p className="text-xs text-zinc-600 mb-3">
                    {(t as Record<string, string>).accessDaysMax ?? "1–365, padrão 1"}
                  </p>
                  <div className="flex flex-col gap-3 max-w-sm">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-zinc-600">{(t as Record<string, string>).accessUserIdLabel ?? "User ID"}</span>
                      <input
                        type="text"
                        value={accessUserId}
                        onChange={(e) => {
                          setAccessUserId(e.target.value);
                          setAccessMessage(null);
                        }}
                        placeholder={(t as Record<string, string>).accessUserIdPlaceholder ?? "Cole ou digite o ID do usuário"}
                        className="border border-zinc-300 rounded px-2 py-1.5 text-sm font-mono"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-zinc-600">{(t as Record<string, string>).accessDaysLabel ?? "Tempo máximo de acesso (dias)"}</span>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={accessDays}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          if (!Number.isNaN(n)) setAccessDays(Math.max(1, Math.min(365, n)));
                          setAccessMessage(null);
                        }}
                        className="border border-zinc-300 rounded px-2 py-1.5 text-sm w-24"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={accessLoading || !accessUserId.trim()}
                      onClick={async () => {
                        setAccessMessage(null);
                        setAccessLoading(true);
                        try {
                          const res = await fetch(`${API_BASE}/debug/access`, {
                            method: "POST",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: accessUserId.trim(), days: accessDays }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok && data.ok) {
                            setAccessMessage(((t as Record<string, string>).accessSuccess ?? "Acesso concedido: 1 coin, {days} dia(s).").replace("{days}", String(data.days ?? accessDays)));
                            setAccessUserId("");
                            setAccessDays(1);
                          } else {
                            setAccessMessage(`${(t as Record<string, string>).accessError ?? "Erro"}: ${data.error ?? res.statusText}`);
                          }
                        } catch (err) {
                          setAccessMessage(`${(t as Record<string, string>).accessError ?? "Erro"}: ${err instanceof Error ? err.message : String(err)}`);
                        } finally {
                          setAccessLoading(false);
                        }
                      }}
                      className="px-3 py-2 bg-zinc-800 text-white text-sm rounded hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {accessLoading ? ((t as { loading?: string }).loading ?? "Executando…") : ((t as Record<string, string>).accessGrant ?? "Conceder acesso")}
                    </button>
                  </div>
                  {accessMessage && (
                    <p className={`mt-3 text-sm ${accessMessage.startsWith((t as Record<string, string>).accessError ?? "Erro") ? "text-red-700" : "text-emerald-700"}`}>
                      {accessMessage}
                    </p>
                  )}
                </section>
              </div>
            )}
            {debugTab === "inspect" && (
              <div className="space-y-4">
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
              <button
                type="button"
                role="checkbox"
                aria-checked={sessionDebugEnabled}
                onClick={() => {
                  const next = !sessionDebugEnabled;
                  setSessionDebugEnabled(next);
                  setSessionDebugEnabledState(next);
                }}
                className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700 mb-2 text-left w-full py-1 rounded hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-1"
              >
                <span
                  className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${sessionDebugEnabled ? "bg-violet-600 border-violet-600 text-white" : "border-zinc-300 bg-white"}`}
                  aria-hidden
                >
                  {sessionDebugEnabled ? "✓" : ""}
                </span>
                <span>Debug sessão (uma aba)</span>
              </button>
              {sessionDebugEnabled && (
                <div className="mb-3 p-2 rounded bg-zinc-100 text-xs font-mono text-zinc-800 space-y-1">
                  <div className="font-semibold text-zinc-600 mb-1">Sessão / aba (esta página)</div>
                  {sessionDebugInfo ? (
                    <>
                      <div><span className="text-zinc-500">tabId (short):</span> {sessionDebugInfo.tabIdShort}</div>
                      <div><span className="text-zinc-500">status:</span> {sessionDebugInfo.status}</div>
                      <div><span className="text-zinc-500">resultado:</span> {sessionDebugInfo.resultado}</div>
                      <div><span className="text-zinc-500">última atualização:</span> {new Date(sessionDebugInfo.lastAt).toLocaleTimeString()}</div>
                      {sessionDebugInfo.erro && <div className="text-red-600"><span className="text-zinc-500">erro:</span> {sessionDebugInfo.erro}</div>}
                    </>
                  ) : (
                    <div className="text-zinc-500">Aguardando requisição session/claim…</div>
                  )}
                </div>
              )}
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
              </div>
            )}
          </div>
        </div>
      )}

      {prodConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/20" onClick={() => setProdConfirm(null)} />
          <div
            className="relative w-full max-w-md bg-white border border-zinc-200 rounded-lg shadow-lg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-zinc-900">
              {prodConfirm.kind === "truncateAtemporalDev"
                ? ((t as Record<string, string>).confirmTruncateAtemporalTitle ?? "Truncar tabelas atemporais (dev)")
                : prodConfirm.kind === "truncateAtemporalProd"
                  ? ((t as Record<string, string>).confirmTruncateAtemporalProdTitle ?? "Truncar tabelas atemporais (produção)")
                  : ((t as Record<string, string>).confirmProdTitle ?? "Confirmar ação em produção")}
            </h3>
            <p className="text-xs text-zinc-600 mt-1">
              {prodConfirm.kind === "truncateAtemporalDev"
                ? ((t as Record<string, string>).confirmTruncateAtemporalDesc ??
                    "Apaga todas as linhas das tabelas Renko/Range/Kagi no URL_DEV.")
                : prodConfirm.kind === "truncateAtemporalProd"
                  ? ((t as Record<string, string>).confirmTruncateAtemporalProdDesc ??
                      "Apaga todas as linhas das tabelas fast e cache2 no banco URL_PROD. Irreversível.")
                  : ((t as Record<string, string>).confirmProdDesc ?? "Esta ação será executada no banco de produção. Deseja continuar?")}
            </p>

            <div className="mt-3 rounded-md bg-zinc-50 border border-zinc-200 p-3">
              <p className="text-xs font-medium text-zinc-800">
                {(() => {
                  switch (prodConfirm.kind) {
                    case "pastBackfill":
                      return ((t as Record<string, string>).confirmProdPastBackfill ?? "Backfill do passado ({interval})").replace("{interval}", prodConfirm.interval);
                    case "validateKlines":
                      return (t as Record<string, string>).confirmProdValidateKlines ?? "Validar klines (histórico)";
                    case "syncKlines":
                      return (t as Record<string, string>).confirmProdSyncKlines ?? "Sync klines";
                    case "cacheRefresh":
                      return (t as Record<string, string>).confirmProdCacheRefresh ?? "Refresh cache";
                    case "backfill":
                      return ((t as Record<string, string>).confirmProdBackfill ?? "Preencher gaps ({interval})").replace("{interval}", prodConfirm.interval);
                    case "registerGaps":
                      return ((t as Record<string, string>).confirmProdRegisterGaps ?? "Registrar gaps ({interval})").replace("{interval}", prodConfirm.interval);
                    case "validateAll":
                      return (t as Record<string, string>).confirmProdValidateAll ?? "Validador de tempo (todas as moedas)";
                    case "truncateAtemporalDev":
                      return (t as Record<string, string>).confirmTruncateAtemporalAction ?? "TRUNCATE Renko / Range / Kagi (URL_DEV)";
                    case "truncateAtemporalProd":
                      return (t as Record<string, string>).confirmTruncateAtemporalProdAction ?? "TRUNCATE (URL_PROD)";
                    default:
                      return "";
                  }
                })()}
              </p>

              {(prodConfirm.kind === "pastBackfill" || prodConfirm.kind === "validateKlines" || prodConfirm.kind === "backfill" || prodConfirm.kind === "registerGaps") && (
                <div className="mt-2 space-y-1">
                  {prodConfirm.kind === "pastBackfill" ? (
                    backfillAllSymbols ? (
                      <p className="text-xs text-zinc-600">
                        {(t as Record<string, string>).confirmProdCoinsLabel?.replace("{coins}", confirmProdCoinsLabel) ?? `Moedas: ${confirmProdCoinsLabel}`}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-600">
                        {(t as Record<string, string>).confirmProdSymbolLabel?.replace("{symbol}", confirmProdSymbol) ?? `Símbolo: ${confirmProdSymbol}`}
                      </p>
                    )
                  ) : (
                    <p className="text-xs text-zinc-600">
                      {(t as Record<string, string>).confirmProdSymbolLabel?.replace("{symbol}", confirmProdSymbol) ?? `Símbolo: ${confirmProdSymbol}`}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setProdConfirm(null)}
                className="text-xs px-3 py-2 rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
              >
                {(t as Record<string, string>).confirmProdCancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={confirmProdNow}
                disabled={prodConfirmBusy}
                className="text-xs px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {(t as Record<string, string>).confirmProdConfirm ?? "Confirmar"}
              </button>
            </div>
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
