"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/app/constants";
import { defaultTickFromDailyClose } from "@/app/lib/binanceDefaultTick";
import type { AggFastLivePriceTickDiagnostics } from "./aggFastLiveDebug";
import {
  addTrade,
  emptyKagiRef,
  emptyRangeRef,
  emptyRenkoClassic2xRef,
  emptyRenkoRef,
  emptyTradeCountCandleRef,
  parseAggTradeForSymbol,
  stepKagiTable,
  stepRangeTable,
  stepRenkoClassic2xTable,
  stepRenkoTable,
  stepTradeCountCandle,
  streamMinTradeMsUtc,
  syncKagiRefFromLatestDbClose,
  syncRangeRefFromLatestDbClose,
  syncRenkoClassic2xRefFromLatestDbClose,
  syncRenkoRefFromLatestDbClose,
  syncTradeCountRefFromLatestDbClose,
  type AggFastBarRowPayload,
  type KagiRef,
  type RangeRef,
  type RenkoClassic2xRef,
  type RenkoRef,
  type TradeCountCandleRef,
} from "@/app/lib/binanceAggRenkoCore";

/** Fallback raro: barras fechadas são enviadas já no mesmo evento aggTrade (evita atraso de vários segundos). */
const FLUSH_MS = 8000;
const BINANCE_AGG_WS_BASE = "wss://stream.binance.com:9443/ws";

export type AggFastWsKind = "renko" | "range" | "kagi" | "renko2x" | "trades500";

type KlineLike = (string | number | null)[];

/**
 * Fecho a usar para sincronizar refs agg (Renko/Range/Kagi/…): o merge pode pôr no topo uma linha ao vivo
 * com openTime **anterior** ao da última barra do cache (ex.: bug de tempo); nesse caso a âncora deve ser
 * o fecho da barra mais recente do GET, não o [0] fundido.
 */
function syncCloseFromMergedAndServer(
  klinesOk: boolean,
  merged0: KlineLike | undefined,
  serverNewest: KlineLike | null
): number | null {
  if (!klinesOk || merged0 == null || merged0[4] == null) return null;
  const mc = Number(merged0[4]);
  if (!Number.isFinite(mc)) return null;
  if (serverNewest == null || serverNewest.length === 0 || serverNewest[0] == null || serverNewest[4] == null) {
    return mc;
  }
  const mot = Number(merged0[0]);
  const sc = Number(serverNewest[4]);
  const sot = Number(serverNewest[0]);
  if (!Number.isFinite(sc) || !Number.isFinite(sot)) return mc;
  if (!Number.isFinite(mot)) return mc;
  if (mot >= sot) return mc;
  return sc;
}

function inferRenkoDirectionFromKlines(klines: KlineLike[]): boolean | null {
  if (klines.length < 2) return null;
  const latest = Number(klines[0]?.[4]);
  if (!Number.isFinite(latest)) return null;
  for (let i = 1; i < klines.length; i++) {
    const prev = Number(klines[i]?.[4]);
    if (!Number.isFinite(prev)) continue;
    if (latest > prev) return true;
    if (latest < prev) return false;
  }
  return null;
}

/**
 * aggTrade → Renko / Range / Kagi / Renko2× (5ticks) / velas por contagem de trades no cliente.
 * Barras fechadas em `onLiveFlush` fundem com o GET; em /sistema o KlinesTable também enfileira POST
 * para `/api/binance/agg-fast-bars` (tier base) e grava *Fast* + BinanceKlineCache2 como dev/ticks.
 */
export function useAggFastTradeLive(opts: {
  enabled: boolean;
  aggKind: AggFastWsKind;
  symbol: string;
  klinesSourceSymbol: string | null;
  timezoneOffsetHours: number;
  klines: KlineLike[];
  /** Primeira linha do último GET kline-cache2 (só servidor); usada como âncora de fecho quando o merge [0] está desalinhado. */
  serverNewestKlineFromCache: KlineLike | null;
  onLiveFlush: (rows: AggFastBarRowPayload[]) => void;
  /** Chamado quando chega aggTrade válido (atemporal vivo); throttle interno — p.ex. “Última atualização” / bolinha. */
  onLiveAggActivity?: () => void;
  /**
   * Cada negócio individual depois do filtro de tempo (mesmo fluxo que alimenta Renko/trades).
   * Para debug: buffer WS ≠ tijolos fechados.
   */
  onRawAggTrade?: (trade: { p: number; q: number; t: number; m?: boolean }) => void;
  /** Tick de preço (GET daily-close-tick = 0,01% do último fecho diário completo). Para debug/UI. */
  onPriceTickResolved?: (tick: number | null) => void;
  /** Origem do tick + erros da API (painel Agg live). */
  onPriceTickDiagnostics?: (d: AggFastLivePriceTickDiagnostics | null) => void;
}) {
  const {
    enabled,
    aggKind,
    symbol,
    klinesSourceSymbol,
    timezoneOffsetHours,
    klines,
    serverNewestKlineFromCache,
    onLiveFlush,
    onLiveAggActivity,
    onRawAggTrade,
    onPriceTickResolved,
    onPriceTickDiagnostics,
  } = opts;
  const sym = symbol.trim().toUpperCase();
  const renkoRef = useRef<RenkoRef>(emptyRenkoRef());
  const rangeRef = useRef<RangeRef>(emptyRangeRef());
  const kagiRef = useRef<KagiRef>(emptyKagiRef());
  const renko2xRef = useRef<RenkoClassic2xRef>(emptyRenkoClassic2xRef());
  const tradeCountRef = useRef<TradeCountCandleRef>(emptyTradeCountCandleRef());
  const pendingRef = useRef<AggFastBarRowPayload[]>([]);
  const streamMinTradeMsRef = useRef(0);
  const klinesRef = useRef(klines);
  const symRef = useRef(sym);
  const klinesSourceRef = useRef(klinesSourceSymbol);
  const tzRef = useRef(timezoneOffsetHours);
  const aggKindRef = useRef(aggKind);
  const onLiveFlushRef = useRef(onLiveFlush);
  const onLiveAggActivityRef = useRef(onLiveAggActivity);
  const onRawAggTradeRef = useRef(onRawAggTrade);
  const onPriceTickResolvedRef = useRef(onPriceTickResolved);
  const onPriceTickDiagnosticsRef = useRef(onPriceTickDiagnostics);
  onLiveFlushRef.current = onLiveFlush;
  onLiveAggActivityRef.current = onLiveAggActivity;
  onRawAggTradeRef.current = onRawAggTrade;
  onPriceTickResolvedRef.current = onPriceTickResolved;
  onPriceTickDiagnosticsRef.current = onPriceTickDiagnostics;
  klinesRef.current = klines;
  symRef.current = sym;
  klinesSourceRef.current = klinesSourceSymbol;
  tzRef.current = timezoneOffsetHours;
  aggKindRef.current = aggKind;
  const serverNewestFromCacheRef = useRef(serverNewestKlineFromCache);
  serverNewestFromCacheRef.current = serverNewestKlineFromCache;

  /** True apenas se GET daily-close-tick devolveu tick válido (canónico). */
  const apiTickOkRef = useRef(false);
  /** Último erro textual do GET daily-close-tick (para fallback / debug). */
  const lastDailyCloseTickErrorRef = useRef<string | null>(null);

  const [tickSize, setTickSize] = useState<number | null>(null);
  /** Evita aplicar fallback às klines antes do fetch terminar (corrida com API lenta). */
  const [tickFetchSettled, setTickFetchSettled] = useState(false);

  const applyFallbackTickFromRefs = useCallback(() => {
    const s = symRef.current;
    const klinesOk = klinesSourceRef.current != null && klinesSourceRef.current.trim().toUpperCase() === s;
    const k = klinesRef.current;
    const merged0 = k.length > 0 ? k[0] : undefined;
    const srv = serverNewestFromCacheRef.current;
    const close = syncCloseFromMergedAndServer(klinesOk, merged0, srv);
    const c = close != null && Number.isFinite(close) && close > 0 ? close : null;
    const apiErr = lastDailyCloseTickErrorRef.current;
    if (c == null) {
      setTickSize(null);
      onPriceTickResolvedRef.current?.(null);
      onPriceTickDiagnosticsRef.current?.({
        tick: null,
        source: null,
        apiError: apiErr,
        hintKey: "no_valid_close",
      });
      return;
    }
    const t = defaultTickFromDailyClose(c);
    if (t > 0) {
      setTickSize(t);
      onPriceTickResolvedRef.current?.(t);
      onPriceTickDiagnosticsRef.current?.({
        tick: t,
        source: "fallback",
        apiError: apiErr,
        hintKey: null,
      });
    } else {
      setTickSize(null);
      onPriceTickResolvedRef.current?.(null);
      onPriceTickDiagnosticsRef.current?.({
        tick: null,
        source: null,
        apiError: apiErr,
        hintKey: "tick_zero",
      });
    }
  }, []);

  useEffect(() => {
    pendingRef.current = [];
    renkoRef.current = emptyRenkoRef();
    rangeRef.current = emptyRangeRef();
    kagiRef.current = emptyKagiRef();
    renko2xRef.current = emptyRenkoClassic2xRef();
    tradeCountRef.current = emptyTradeCountCandleRef();
  }, [sym, aggKind]);

  useEffect(() => {
    if (!enabled || !sym) {
      apiTickOkRef.current = false;
      lastDailyCloseTickErrorRef.current = null;
      setTickFetchSettled(false);
      setTickSize(null);
      onPriceTickResolvedRef.current?.(null);
      onPriceTickDiagnosticsRef.current?.(null);
      return;
    }
    apiTickOkRef.current = false;
    lastDailyCloseTickErrorRef.current = null;
    onPriceTickResolvedRef.current?.(null);
    onPriceTickDiagnosticsRef.current?.({
      tick: null,
      source: null,
      apiError: null,
      hintKey: "loading",
    });
    let cancelled = false;
    setTickFetchSettled(false);
    fetch(`${API_BASE}/binance/daily-close-tick?symbol=${encodeURIComponent(sym)}`)
      .then(async (r) => {
        let j: { tick?: number; error?: string } = {};
        try {
          j = (await r.json()) as { tick?: number; error?: string };
        } catch {
          j = { error: "Invalid JSON from daily-close-tick" };
        }
        if (cancelled) return;
        if (r.ok) {
          const t = Number(j.tick);
          if (Number.isFinite(t) && t > 0) {
            apiTickOkRef.current = true;
            lastDailyCloseTickErrorRef.current = null;
            setTickSize(t);
            onPriceTickResolvedRef.current?.(t);
            onPriceTickDiagnosticsRef.current?.({
              tick: t,
              source: "api",
              apiError: null,
              hintKey: null,
            });
            return;
          }
          lastDailyCloseTickErrorRef.current = j.error || `HTTP ${r.status} (no tick in body)`;
        } else {
          lastDailyCloseTickErrorRef.current = j.error || `HTTP ${r.status}`;
        }
        apiTickOkRef.current = false;
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          apiTickOkRef.current = false;
          lastDailyCloseTickErrorRef.current = e instanceof Error ? e.message : "fetch failed";
        }
      })
      .finally(() => {
        if (!cancelled) setTickFetchSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, sym]);

  /**
   * Se o GET daily-close-tick falhar no servidor (ex.: Binance 451 desde IP da Vercel), o WS agg não abria
   * (tickSize obrigatório). Mesma fórmula do tick: fecho de referência × 0,01% — aqui o fecho vem das klines já carregadas.
   */
  useEffect(() => {
    if (!enabled || !sym || !tickFetchSettled) return;
    if (apiTickOkRef.current) return;
    applyFallbackTickFromRefs();
  }, [
    enabled,
    sym,
    tickFetchSettled,
    klines,
    klinesSourceSymbol,
    serverNewestKlineFromCache,
    applyFallbackTickFromRefs,
  ]);

  useEffect(() => {
    if (!enabled || !sym) return;
    const klinesOk = klinesSourceSymbol != null && klinesSourceSymbol.trim().toUpperCase() === sym;
    const merged0 = klines.length > 0 ? klines[0] : undefined;
    const close = syncCloseFromMergedAndServer(klinesOk, merged0, serverNewestKlineFromCache);
    const c = close != null && Number.isFinite(close) ? close : null;
    if (aggKind === "renko") {
      syncRenkoRefFromLatestDbClose(renkoRef.current, c);
    } else if (aggKind === "range") {
      syncRangeRefFromLatestDbClose(rangeRef.current, c);
    } else if (aggKind === "kagi") {
      syncKagiRefFromLatestDbClose(kagiRef.current, c);
    } else if (aggKind === "renko2x") {
      syncRenkoClassic2xRefFromLatestDbClose(renko2xRef.current, c);
      const inferred = inferRenkoDirectionFromKlines(klines);
      if (inferred != null) renko2xRef.current.lastUp = inferred;
    } else {
      syncTradeCountRefFromLatestDbClose(tradeCountRef.current, c);
    }
  }, [enabled, sym, klines, klinesSourceSymbol, aggKind, serverNewestKlineFromCache]);

  useEffect(() => {
    if (!enabled || !sym || tickSize == null || !(tickSize > 0)) return;

    const refreshStreamFloor = () => {
      const s = symRef.current;
      const k = klinesRef.current;
      const sourceOk = klinesSourceRef.current != null && klinesSourceRef.current.trim().toUpperCase() === s;
      const mergedOt = sourceOk && k.length > 0 && k[0][0] != null ? Number(k[0][0]) : null;
      const srv = serverNewestFromCacheRef.current;
      const srvOt = srv != null && srv.length > 0 && srv[0] != null ? Number(srv[0]) : null;
      let dispOpen: number | null = null;
      if (mergedOt != null && Number.isFinite(mergedOt) && srvOt != null && Number.isFinite(srvOt)) {
        dispOpen = Math.max(mergedOt, srvOt);
      } else if (mergedOt != null && Number.isFinite(mergedOt)) {
        dispOpen = mergedOt;
      } else if (srvOt != null && Number.isFinite(srvOt)) {
        dispOpen = srvOt;
      }
      streamMinTradeMsRef.current = streamMinTradeMsUtc({
        nowMs: Date.now(),
        timezoneOffsetHours: tzRef.current,
        klinesNewestOpenDisplayMs: dispOpen != null && Number.isFinite(dispOpen) ? dispOpen : null,
      });
    };
    refreshStreamFloor();

    let alive = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    const lastActivityThrottleRef = { current: 0 };

    const connect = () => {
      if (!alive) return;
      reconnectTimer = null;
      refreshStreamFloor();
      const streamSym = sym.toLowerCase();
      const url = `${BINANCE_AGG_WS_BASE}/${streamSym}@aggTrade`;
      try {
        ws = new WebSocket(url);
      } catch {
        reconnectTimer = window.setTimeout(connect, 2500);
        return;
      }
      ws.onmessage = (ev) => {
        if (!alive) return;
        refreshStreamFloor();
        const raw = typeof ev.data === "string" ? ev.data : "";
        const trade = parseAggTradeForSymbol(raw, sym);
        if (!trade) return;
        if (trade.t < streamMinTradeMsRef.current) return;
        onRawAggTradeRef.current?.(trade);
        const now = Date.now();
        if (now - lastActivityThrottleRef.current >= 250) {
          lastActivityThrottleRef.current = now;
          onLiveAggActivityRef.current?.();
        }
        const kind = aggKindRef.current;
        const ts = tickSize;
        if (kind === "renko") {
          addTrade(renkoRef.current.acc, trade.p, trade.q, trade.t, trade.m);
          for (const row of stepRenkoTable(renkoRef.current, trade.p, trade.t, ts)) {
            pendingRef.current.push({ symbol: sym, ...row.persist });
          }
        } else if (kind === "range") {
          addTrade(rangeRef.current.acc, trade.p, trade.q, trade.t, trade.m);
          for (const row of stepRangeTable(rangeRef.current, trade.p, trade.t, ts)) {
            pendingRef.current.push({ symbol: sym, ...row.persist });
          }
        } else if (kind === "kagi") {
          addTrade(kagiRef.current.acc, trade.p, trade.q, trade.t, trade.m);
          for (const row of stepKagiTable(kagiRef.current, trade.p, trade.t, ts)) {
            pendingRef.current.push({ symbol: sym, ...row.persist });
          }
        } else if (kind === "renko2x") {
          addTrade(renko2xRef.current.acc, trade.p, trade.q, trade.t, trade.m);
          for (const row of stepRenkoClassic2xTable(renko2xRef.current, trade.p, trade.t, ts)) {
            pendingRef.current.push({ symbol: sym, ...row.persist });
          }
        } else {
          for (const row of stepTradeCountCandle(tradeCountRef.current, trade.p, trade.q, trade.t, trade.m, trade.t)) {
            pendingRef.current.push({ symbol: sym, ...row.persist });
          }
        }
        if (pendingRef.current.length > 0) {
          const rows = pendingRef.current.splice(0, pendingRef.current.length);
          onLiveFlushRef.current(rows);
        }
      };
      ws.onclose = () => {
        if (!alive) return;
        ws = null;
        reconnectTimer = window.setTimeout(connect, 2500);
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
      };
    };

    connect();
    const minuteId = window.setInterval(() => {
      refreshStreamFloor();
    }, 60_000);

    return () => {
      alive = false;
      window.clearInterval(minuteId);
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [enabled, sym, tickSize, aggKind]);

  useEffect(() => {
    if (!enabled || !sym) return;

    const flush = () => {
      const rows = pendingRef.current.splice(0, pendingRef.current.length);
      if (rows.length === 0) return;
      onLiveFlushRef.current(rows);
    };

    const id = window.setInterval(flush, FLUSH_MS);
    return () => {
      window.clearInterval(id);
      flush();
    };
  }, [enabled, sym, aggKind]);
}
