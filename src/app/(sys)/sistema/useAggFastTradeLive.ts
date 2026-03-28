"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/app/constants";
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

const FLUSH_MS = 5000;
const BINANCE_AGG_WS_BASE = "wss://stream.binance.com:9443/ws";

export type AggFastWsKind = "renko" | "range" | "kagi" | "renko2x" | "trades500";

type KlineLike = (string | number | null)[];

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
  onLiveFlush: (rows: AggFastBarRowPayload[]) => void;
  /** Chamado quando chega aggTrade válido (atemporal vivo); throttle interno — p.ex. “Última atualização” / bolinha. */
  onLiveAggActivity?: () => void;
}) {
  const { enabled, aggKind, symbol, klinesSourceSymbol, timezoneOffsetHours, klines, onLiveFlush, onLiveAggActivity } = opts;
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
  onLiveFlushRef.current = onLiveFlush;
  onLiveAggActivityRef.current = onLiveAggActivity;
  klinesRef.current = klines;
  symRef.current = sym;
  klinesSourceRef.current = klinesSourceSymbol;
  tzRef.current = timezoneOffsetHours;
  aggKindRef.current = aggKind;

  const [tickSize, setTickSize] = useState<number | null>(null);

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
      setTickSize(null);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/binance/daily-close-tick?symbol=${encodeURIComponent(sym)}`)
      .then(async (r) => {
        const j = (await r.json()) as { tick?: number; error?: string };
        if (!r.ok) throw new Error(j.error || r.statusText);
        if (cancelled) return;
        const t = Number(j.tick);
        setTickSize(Number.isFinite(t) && t > 0 ? t : null);
      })
      .catch(() => {
        if (!cancelled) setTickSize(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, sym]);

  useEffect(() => {
    if (!enabled || !sym) return;
    const klinesOk = klinesSourceSymbol != null && klinesSourceSymbol.trim().toUpperCase() === sym;
    const close = klinesOk && klines.length > 0 && klines[0][4] != null ? Number(klines[0][4]) : null;
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
  }, [enabled, sym, klines, klinesSourceSymbol, aggKind]);

  useEffect(() => {
    if (!enabled || !sym || tickSize == null || !(tickSize > 0)) return;

    const refreshStreamFloor = () => {
      const s = symRef.current;
      const k = klinesRef.current;
      const sourceOk = klinesSourceRef.current != null && klinesSourceRef.current.trim().toUpperCase() === s;
      const dispOpen =
        sourceOk && k.length > 0 && k[0][0] != null ? Number(k[0][0]) : null;
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
        const raw = typeof ev.data === "string" ? ev.data : "";
        const trade = parseAggTradeForSymbol(raw, sym);
        if (!trade) return;
        if (trade.t < streamMinTradeMsRef.current) return;
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
