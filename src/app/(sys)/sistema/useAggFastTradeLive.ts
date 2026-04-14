"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type TradeAcc,
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
  /**
   * GET kline-cache2/klines já concluiu para o símbolo atual (`klinesDataSymbol === symbol`).
   * O WebSocket aggTrade só liga depois — primeiro cache, depois stream ao vivo.
   */
  cacheReadyForAggWs: boolean;
  /** Mudança de intervalo força fechar e recriar o WebSocket (mesmo símbolo). */
  groupMinutes: number;
  /**
   * Incrementado pelo pai após refresh periódico do cache (gráficos atemporais) para fechar e voltar a abrir o aggTrade.
   * @default 0
   */
  periodicWsReconnectKey?: number;
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
  /**
   * Volume em formação na tijolo/barra atual (acc antes de fechar) — para gráfico atemporal / volume no preço.
   * Throttle ~200 ms no stream aggTrade.
   */
  onFormingAccVolumes?: (v: { volBase: number; volQuote: number; trades: number }) => void;
  /**
   * Linhas do tier base (5 ticks / 500 trades) por barra no tier de exibição (ex.: P50 → 10). Se 1, só `acc`.
   * Com >1, o volume em formação = soma dos tijolos base já fechados na janela atual + acc (não zera a cada tijolo base).
   */
  displayTierBaseLineCount?: number;
  /** `openTime` da cabeça do GET cache — quando muda (nova linha no servidor), repõe a janela do tier. */
  serverCacheHeadOpenTimeMs?: number | null;
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
    onFormingAccVolumes,
    displayTierBaseLineCount: displayTierBaseLineCountOpt,
    serverCacheHeadOpenTimeMs = null,
    cacheReadyForAggWs,
    groupMinutes,
    periodicWsReconnectKey = 0,
  } = opts;
  const displayTierBaseLineCount = displayTierBaseLineCountOpt ?? 1;
  const displayTierBaseLineCountRef = useRef(displayTierBaseLineCount);
  displayTierBaseLineCountRef.current = displayTierBaseLineCount;
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
  const onFormingAccVolumesRef = useRef(onFormingAccVolumes);
  const lastFormingAccEmitMsRef = useRef(0);
  /** Soma volume dos tijolos base já fechados na janela atual do tier de exibição (ex.: 9×5t antes do 10.º em P50). */
  const tierPartialVolBaseRef = useRef(0);
  const tierPartialVolQuoteRef = useRef(0);
  const tierPartialTradesRef = useRef(0);
  /** Quantos tijolos base fechados na janela atual; ao atingir `displayTierBaseLineCount`, zera parciais (vela do tier fechou). */
  const tierClosedBaseLinesRef = useRef(0);
  onLiveFlushRef.current = onLiveFlush;
  onLiveAggActivityRef.current = onLiveAggActivity;
  onRawAggTradeRef.current = onRawAggTrade;
  onPriceTickResolvedRef.current = onPriceTickResolved;
  onPriceTickDiagnosticsRef.current = onPriceTickDiagnostics;
  onFormingAccVolumesRef.current = onFormingAccVolumes;
  klinesRef.current = klines;
  symRef.current = sym;
  klinesSourceRef.current = klinesSourceSymbol;
  tzRef.current = timezoneOffsetHours;
  aggKindRef.current = aggKind;
  const serverNewestFromCacheRef = useRef(serverNewestKlineFromCache);
  serverNewestFromCacheRef.current = serverNewestKlineFromCache;

  /**
   * Evita alinhar o motor ao merge em **cada** `setKlines` ao vivo — `sync*RefFromLatestDbClose` zera sempre `acc`,
   * o que apagava volume em formação. Só reaplicar quando a âncora do **GET cache** muda (nova linha no servidor)
   * ou na primeira vez que temos fecho válido sem ainda ter sincronizado.
   */
  const lastMotorAnchorFingerprintRef = useRef<string | null>(null);
  const motorAnchorSyncReadyRef = useRef(false);

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
    lastFormingAccEmitMsRef.current = 0;
    lastMotorAnchorFingerprintRef.current = null;
    motorAnchorSyncReadyRef.current = false;
    renkoRef.current = emptyRenkoRef();
    rangeRef.current = emptyRangeRef();
    kagiRef.current = emptyKagiRef();
    renko2xRef.current = emptyRenkoClassic2xRef();
    tradeCountRef.current = emptyTradeCountCandleRef();
  }, [sym, aggKind]);

  useEffect(() => {
    tierPartialVolBaseRef.current = 0;
    tierPartialVolQuoteRef.current = 0;
    tierPartialTradesRef.current = 0;
    tierClosedBaseLinesRef.current = 0;
  }, [sym, aggKind, displayTierBaseLineCount, serverCacheHeadOpenTimeMs]);

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

  const serverAnchorFingerprint = useMemo(() => {
    const s = serverNewestKlineFromCache;
    if (s == null || s.length === 0 || s[0] == null || s[4] == null) return null;
    const ot = Number(s[0]);
    const cl = Number(s[4]);
    if (!Number.isFinite(ot) || !Number.isFinite(cl)) return null;
    return `${ot}|${cl}`;
  }, [serverNewestKlineFromCache]);

  /** `0` → `1` quando aparece a primeira vela — reaplica âncora só nessa transição se ainda não houver fingerprint do servidor (merge só). */
  const hasAnyKlineRow = klines.length > 0 ? 1 : 0;

  useEffect(() => {
    if (!enabled || !sym) return;
    const klinesOk = klinesSourceSymbol != null && klinesSourceSymbol.trim().toUpperCase() === sym;
    const merged0 = klinesRef.current.length > 0 ? klinesRef.current[0] : undefined;
    const srv = serverNewestFromCacheRef.current;

    const fp =
      srv != null && srv.length > 0 && srv[0] != null && srv[4] != null
        ? `${Number(srv[0])}|${Number(srv[4])}`
        : null;

    if (fp != null && fp === lastMotorAnchorFingerprintRef.current && motorAnchorSyncReadyRef.current) {
      return;
    }
    if (
      fp == null &&
      lastMotorAnchorFingerprintRef.current === "__merged__" &&
      motorAnchorSyncReadyRef.current
    ) {
      return;
    }

    const close = syncCloseFromMergedAndServer(klinesOk, merged0, srv);
    const c = close != null && Number.isFinite(close) ? close : null;
    if (c == null) {
      return;
    }

    if (aggKind === "renko") {
      syncRenkoRefFromLatestDbClose(renkoRef.current, c);
    } else if (aggKind === "range") {
      syncRangeRefFromLatestDbClose(rangeRef.current, c);
    } else if (aggKind === "kagi") {
      syncKagiRefFromLatestDbClose(kagiRef.current, c);
    } else if (aggKind === "renko2x") {
      syncRenkoClassic2xRefFromLatestDbClose(renko2xRef.current, c);
    } else {
      syncTradeCountRefFromLatestDbClose(tradeCountRef.current, c);
    }

    if (fp != null) {
      lastMotorAnchorFingerprintRef.current = fp;
    } else {
      lastMotorAnchorFingerprintRef.current = "__merged__";
    }
    motorAnchorSyncReadyRef.current = true;
  }, [enabled, sym, klinesSourceSymbol, aggKind, serverAnchorFingerprint, hasAnyKlineRow]);

  useEffect(() => {
    if (!enabled || !sym || aggKind !== "renko2x") return;
    const inferred = inferRenkoDirectionFromKlines(klinesRef.current);
    if (inferred != null) renko2xRef.current.lastUp = inferred;
  }, [enabled, sym, aggKind, klines]);

  /** aggTrade: só após GET kline-cache2/klines concluir (`cacheReadyForAggWs`). `groupMinutes` na dependência recria o WS ao mudar intervalo. */
  useEffect(() => {
    if (!enabled || !sym || tickSize == null || !(tickSize > 0) || !cacheReadyForAggWs) return;

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
        const gsz = displayTierBaseLineCountRef.current;
        const closedBatch = pendingRef.current.slice();
        if (gsz > 1 && closedBatch.length > 0) {
          for (const row of closedBatch) {
            tierPartialVolBaseRef.current += row.volume;
            tierPartialVolQuoteRef.current += row.quoteAssetVolume;
            tierPartialTradesRef.current += row.numberOfTrades;
            tierClosedBaseLinesRef.current += 1;
            if (tierClosedBaseLinesRef.current >= gsz) {
              tierPartialVolBaseRef.current = 0;
              tierPartialVolQuoteRef.current = 0;
              tierPartialTradesRef.current = 0;
              tierClosedBaseLinesRef.current = 0;
            }
          }
        }
        const formingCb = onFormingAccVolumesRef.current;
        if (formingCb) {
          const emitMs = Date.now();
          if (emitMs - lastFormingAccEmitMsRef.current >= 200) {
            lastFormingAccEmitMsRef.current = emitMs;
            let acc: TradeAcc;
            if (kind === "renko") acc = renkoRef.current.acc;
            else if (kind === "range") acc = rangeRef.current.acc;
            else if (kind === "kagi") acc = kagiRef.current.acc;
            else if (kind === "renko2x") acc = renko2xRef.current.acc;
            else acc = tradeCountRef.current.acc;
            if (gsz <= 1) {
              formingCb({ volBase: acc.volBase, volQuote: acc.volQuote, trades: acc.trades });
            } else {
              formingCb({
                volBase: tierPartialVolBaseRef.current + acc.volBase,
                volQuote: tierPartialVolQuoteRef.current + acc.volQuote,
                trades: tierPartialTradesRef.current + acc.trades,
              });
            }
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
  }, [enabled, sym, tickSize, aggKind, groupMinutes, cacheReadyForAggWs, periodicWsReconnectKey]);

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
