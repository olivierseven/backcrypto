"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "@/app/constants";
import {
  BRICK_TICK_UNITS,
  TRADES_PER_CANDLE,
  emptyRenkoClassic2xRef,
  emptyTradeCountCandleRef,
  stepRenkoClassic2xTable as stepRenkoClassic2xTableCore,
  stepRenkoTable as stepRenkoTableCore,
  stepTradeCountCandle,
  type RenkoClassic2xRef,
  type TradeCountCandleRef,
} from "@/app/lib/binanceAggRenkoCore";

const BINANCE_WS = "wss://stream.binance.com:9443/stream";

/** Par stream Binance: rest maiúsculo (BTCUSDT), ws minúsculo (btcusdt). */
type SymbolEntry = { ws: string; rest: string };

function restToSymbolEntry(rest: string): SymbolEntry {
  const r = rest.trim().toUpperCase();
  return { ws: r.toLowerCase(), rest: r };
}

/** Se a API falhar ou dev estiver desligado, mantém comportamento antigo. */
const FALLBACK_SYMBOLS: SymbolEntry[] = [
  { ws: "btcusdt", rest: "BTCUSDT" },
  { ws: "ethusdt", rest: "ETHUSDT" },
];

/** Teto de linhas brutas do WS guardadas em memória por símbolo (não no total). */
const MAX_RAW_WS_LINES_PER_SYMBOL = 1000;
const MAX_CHART_ROWS = 500;
/** Barras fechadas → Postgres (mesmo intervalo das tabelas *Fast). Renko 5ticks: B = 5×tick; tijolo quando price ≥ lastClose+B (alta) ou price ≤ lastClose−B (baixa) — `binanceAggRenkoCore.stepRenkoTable`. */
const AGG_FAST_INTERVAL = "5ticks";
/** Alinhado a `TRADES_PER_CANDLE` e à coluna `interval` em BinanceTradeCountFast. */
const AGG_FAST_INTERVAL_TRADE = `${TRADES_PER_CANDLE}trades`;
const AGG_FAST_CORRETORA = "binance";
const PERSIST_FLUSH_MS = 10_000;

/** Mesmos chartKinds que POST /api/dev/fast-kline-cache2 — preenche BinanceKlineCache2 a partir das *Fast* já gravadas. */
const CACHE2_TICK_CHART_KINDS = ["renko", "renko2x", "range", "kagi"] as const;

type WsLine = { atMs: number; raw: string };
type ChartMode = "renko" | "range" | "kagi" | "renko2x" | "trades500";

/** Payload para POST /api/dev/agg-fast-bars (alinhado ao route). */
type AggFastBarRowPayload = {
  symbol: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteAssetVolume: number;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: number;
  takerBuyQuoteAssetVolume: number;
};

type TradeAcc = {
  firstT: number | null;
  lastT: number | null;
  volBase: number;
  volQuote: number;
  trades: number;
  takerBuyBase: number;
  takerBuyQuote: number;
};

type RenkoTableRow = {
  atMs: number;
  bar: number;
  openTimeUtc: string | null;
  open: string;
  high: string;
  low: string;
  close: string;
  volBtc: string | null;
  closeTimeUtc: string | null;
  quoteVolUsdt: string | null;
  trades: string | null;
  takerBuyBase: string | null;
  takerBuyQuote: string | null;
  /** Metadados para gravar em Binance*Fast (não exibir na tabela). */
  persist?: Omit<AggFastBarRowPayload, "symbol">;
};

type RenkoRef = {
  lastClose: number | null;
  serial: number;
  acc: TradeAcc;
  segMin: number | null;
  segMax: number | null;
};

type RangeRef = {
  serial: number;
  acc: TradeAcc;
  barOpen: number | null;
  barHigh: number;
  barLow: number;
};

type KagiRef = {
  serial: number;
  acc: TradeAcc;
  anchor: number | null;
  dir: -1 | 0 | 1;
  extreme: number;
};

type DailyTickInfo = {
  lastCompletedDailyClose: string;
  lastCompletedDailyCloseNum: number;
  tick: number;
  formula: string;
  incomplete?: boolean;
};

function emptyAcc(): TradeAcc {
  return { firstT: null, lastT: null, volBase: 0, volQuote: 0, trades: 0, takerBuyBase: 0, takerBuyQuote: 0 };
}

function emptyRenkoRef(): RenkoRef {
  return { lastClose: null, serial: 0, acc: emptyAcc(), segMin: null, segMax: null };
}

function emptyRangeRef(): RangeRef {
  return { serial: 0, acc: emptyAcc(), barOpen: null, barHigh: 0, barLow: 0 };
}

function emptyKagiRef(): KagiRef {
  return { serial: 0, acc: emptyAcc(), anchor: null, dir: 0, extreme: 0 };
}

function initMap<T>(symbols: SymbolEntry[], factory: () => T): Record<string, T> {
  return Object.fromEntries(symbols.map((s) => [s.rest, factory()])) as Record<string, T>;
}

function addTrade(acc: TradeAcc, p: number, q: number, t: number, isBuyerMaker: boolean | undefined) {
  if (acc.firstT === null) acc.firstT = t;
  acc.lastT = t;
  acc.volBase += q;
  acc.volQuote += p * q;
  acc.trades += 1;
  if (isBuyerMaker === false) {
    acc.takerBuyBase += q;
    acc.takerBuyQuote += p * q;
  }
}

function parseAggTradeEventMs(raw: string): number | null {
  try {
    const root = JSON.parse(raw) as { T?: number; E?: number; data?: { T?: number; E?: number } };
    const j = root.data ?? root;
    if (typeof j.T === "number" && Number.isFinite(j.T)) return j.T;
    if (typeof j.E === "number" && Number.isFinite(j.E)) return j.E;
  } catch {
    // ignore
  }
  return null;
}

function parseAggTradeFull(
  raw: string,
  allowedRest: Set<string>
): { symbol: string; p: number; q: number; t: number; m?: boolean } | null {
  try {
    const root = JSON.parse(raw) as { stream?: string; data?: { s?: string; p?: string; q?: string; T?: number; E?: number; m?: boolean } };
    const j = root.data ?? (root as { s?: string; p?: string; q?: string; T?: number; E?: number; m?: boolean });
    const symbol = String(j.s ?? "").toUpperCase();
    if (!allowedRest.has(symbol)) return null;
    const p = Number.parseFloat(String(j.p ?? ""));
    const q = Number.parseFloat(String(j.q ?? ""));
    const t = typeof j.T === "number" && Number.isFinite(j.T) ? j.T : typeof j.E === "number" && Number.isFinite(j.E) ? j.E : Date.now();
    if (!Number.isFinite(p) || !Number.isFinite(q)) return null;
    const m = typeof j.m === "boolean" ? j.m : undefined;
    return { symbol, p, q, t, m };
  } catch {
    return null;
  }
}

function fmtPx(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

function msToUtcIso(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

function accToNullableStats(acc: TradeAcc): Pick<RenkoTableRow, "volBtc" | "quoteVolUsdt" | "trades" | "takerBuyBase" | "takerBuyQuote"> {
  if (acc.trades === 0) return { volBtc: null, quoteVolUsdt: null, trades: null, takerBuyBase: null, takerBuyQuote: null };
  return {
    volBtc: acc.volBase.toFixed(8),
    quoteVolUsdt: acc.volQuote.toFixed(8),
    trades: String(acc.trades),
    takerBuyBase: acc.takerBuyBase.toFixed(8),
    takerBuyQuote: acc.takerBuyQuote.toFixed(8),
  };
}

function buildRenkoRow(bar: number, o: number, c: number, atMs: number, withStats: boolean, acc: TradeAcc, high: number, low: number): RenkoTableRow {
  const stats = withStats ? accToNullableStats(acc) : { volBtc: null, quoteVolUsdt: null, trades: null, takerBuyBase: null, takerBuyQuote: null };
  const times = withStats ? { ot: msToUtcIso(acc.firstT), ct: msToUtcIso(acc.lastT) } : { ot: null, ct: null };
  const openTime = withStats && acc.firstT != null ? acc.firstT : atMs;
  const closeTime = withStats && acc.lastT != null ? acc.lastT : atMs;
  const persist: Omit<AggFastBarRowPayload, "symbol"> = {
    openTime,
    closeTime,
    open: o,
    high,
    low,
    close: c,
    volume: withStats ? acc.volBase : 0,
    quoteAssetVolume: withStats ? acc.volQuote : 0,
    numberOfTrades: withStats ? acc.trades : 0,
    takerBuyBaseAssetVolume: withStats ? acc.takerBuyBase : 0,
    takerBuyQuoteAssetVolume: withStats ? acc.takerBuyQuote : 0,
  };
  return {
    atMs,
    bar,
    openTimeUtc: times.ot,
    open: fmtPx(o),
    high: fmtPx(high),
    low: fmtPx(low),
    close: fmtPx(c),
    volBtc: stats.volBtc,
    closeTimeUtc: times.ct,
    quoteVolUsdt: stats.quoteVolUsdt,
    trades: stats.trades,
    takerBuyBase: stats.takerBuyBase,
    takerBuyQuote: stats.takerBuyQuote,
    persist,
  };
}

function enqueueAggFastRows(symbol: string, tableRows: RenkoTableRow[], queueRef: { current: AggFastBarRowPayload[] }) {
  for (const r of tableRows) {
    if (!r.persist) continue;
    queueRef.current.push({ symbol, ...r.persist });
  }
}

function capChartRows(rows: RenkoTableRow[]): RenkoTableRow[] {
  return rows.length <= MAX_CHART_ROWS ? rows : rows.slice(-MAX_CHART_ROWS);
}

function oldestBarCloseMsAll(
  symbols: SymbolEntry[],
  renkoBy: Record<string, RenkoTableRow[]>,
  rangeBy: Record<string, RenkoTableRow[]>,
  kagiBy: Record<string, RenkoTableRow[]>,
  renko2xBy: Record<string, RenkoTableRow[]>,
  tradeBy: Record<string, RenkoTableRow[]>
): number | null {
  const all = symbols.map((s) =>
    Math.min(
      renkoBy[s.rest]?.[0]?.atMs ?? Number.POSITIVE_INFINITY,
      rangeBy[s.rest]?.[0]?.atMs ?? Number.POSITIVE_INFINITY,
      kagiBy[s.rest]?.[0]?.atMs ?? Number.POSITIVE_INFINITY,
      renko2xBy[s.rest]?.[0]?.atMs ?? Number.POSITIVE_INFINITY,
      tradeBy[s.rest]?.[0]?.atMs ?? Number.POSITIVE_INFINITY
    )
  ).filter((v) => Number.isFinite(v));
  if (all.length === 0) return null;
  return Math.min(...all);
}

function trimRawWsLines(entries: WsLine[], oldestCloseMs: number | null): WsLine[] {
  let w = entries;
  if (oldestCloseMs != null) w = w.filter((l) => l.atMs >= oldestCloseMs);
  if (w.length > MAX_RAW_WS_LINES_PER_SYMBOL) w = w.slice(-MAX_RAW_WS_LINES_PER_SYMBOL);
  return w;
}

/** Extrai `s` do payload Binance (útil quando `parseAggTradeFull` falha mas o JSON é aggTrade). */
function parseSymbolFromAggTradeRaw(raw: string): string | null {
  try {
    const root = JSON.parse(raw) as { data?: { s?: string }; s?: string };
    const j = root.data ?? root;
    const sym = String(j.s ?? "").toUpperCase();
    return /^[A-Z0-9]+$/.test(sym) ? sym : null;
  } catch {
    return null;
  }
}

function renkoHighLowForBrick(o: number, c: number, tickSize: number, segMin: number, segMax: number): { high: number; low: number } {
  const thresh = BRICK_TICK_UNITS * tickSize - 1e-12;
  if (c > o) return { high: c, low: o - segMin > 0 && o - segMin < thresh ? segMin : o };
  if (c < o) return { high: segMax - o > 0 && segMax - o < thresh ? segMax : o, low: c };
  return { high: Math.max(o, c), low: Math.min(o, c) };
}

/** Converte saída do core (`persist`) para linhas da tabela dev (incl. `atMs` alinhado a `closeEventMs` + i em multi-brick). */
function renkoTableRowFromPersist(bar: number, pr: Omit<AggFastBarRowPayload, "symbol">, atMs: number): RenkoTableRow {
  const withStats = pr.numberOfTrades > 0;
  const stats = withStats
    ? {
        volBtc: pr.volume.toFixed(8),
        quoteVolUsdt: pr.quoteAssetVolume.toFixed(8),
        trades: String(pr.numberOfTrades),
        takerBuyBase: pr.takerBuyBaseAssetVolume.toFixed(8),
        takerBuyQuote: pr.takerBuyQuoteAssetVolume.toFixed(8),
      }
    : { volBtc: null, quoteVolUsdt: null, trades: null, takerBuyBase: null, takerBuyQuote: null };
  return {
    atMs,
    bar,
    openTimeUtc: withStats ? msToUtcIso(pr.openTime) : null,
    open: fmtPx(pr.open),
    high: fmtPx(pr.high),
    low: fmtPx(pr.low),
    close: fmtPx(pr.close),
    volBtc: stats.volBtc,
    closeTimeUtc: withStats ? msToUtcIso(pr.closeTime) : null,
    quoteVolUsdt: stats.quoteVolUsdt,
    trades: stats.trades,
    takerBuyBase: stats.takerBuyBase,
    takerBuyQuote: stats.takerBuyQuote,
    persist: { ...pr },
  };
}

/** UI dev: delega ao `stepRenkoTable` do core (mesma regra matemática) e só monta texto `forming`. */
function stepRenkoTable(ref: RenkoRef, p: number, closeEventMs: number, tickSize: number): { rows: RenkoTableRow[]; forming: string } {
  const B = BRICK_TICK_UNITS * tickSize;
  if (!(B > 0)) return { rows: [], forming: "tick inválido (altura brick = 0)" };
  const wasAnchor = ref.lastClose === null;
  const coreRows = stepRenkoTableCore(ref, p, closeEventMs, tickSize);
  if (wasAnchor) {
    return { rows: [], forming: `Âncora ${fmtPx(p)} | altura brick = ${fmtPx(B)} (${BRICK_TICK_UNITS} × tick ${tickSize})` };
  }
  const serialAfter = ref.serial;
  const n = coreRows.length;
  const multi = n > 1;
  const rows = coreRows.map((row, i) => {
    const atMsForRow = multi ? closeEventMs + i : closeEventMs;
    return renkoTableRowFromPersist(serialAfter - n + i + 1, row.persist, atMsForRow);
  });
  const lc = ref.lastClose!;
  const eps = 1e-9;
  let forming: string;
  if (p > lc + eps && p < lc + B - eps) {
    const moved = p - lc;
    const u = moved / tickSize;
    forming = `forming ↑ | base ${fmtPx(lc)} | último ${fmtPx(p)} | +${fmtPx(moved)} / ${fmtPx(B)} (${u.toFixed(2)} / ${BRICK_TICK_UNITS}, falta ≥ ${fmtPx(lc + B)})`;
  } else if (p < lc - eps && p > lc - B + eps) {
    const moved = lc - p;
    const u = moved / tickSize;
    forming = `forming ↓ | base ${fmtPx(lc)} | último ${fmtPx(p)} | −${fmtPx(moved)} / ${fmtPx(B)} (${u.toFixed(2)} / ${BRICK_TICK_UNITS}, falta ≤ ${fmtPx(lc - B)})`;
  } else {
    forming = `em ${fmtPx(lc)} | último ${fmtPx(p)} | próximo ↑ ≥ ${fmtPx(lc + B)} ou ↓ ≤ ${fmtPx(lc - B)}`;
  }
  return { rows, forming };
}

/** Renko clássico 2×: tijolo sempre B; continuação ±B (como 1×); reversão após preço atingir lc ± 2B. */
function stepRenkoClassic2xTableDev(
  ref: RenkoClassic2xRef,
  p: number,
  closeEventMs: number,
  tickSize: number
): { rows: RenkoTableRow[]; forming: string } {
  const B = BRICK_TICK_UNITS * tickSize;
  const R2 = 2 * B;
  if (!(B > 0)) return { rows: [], forming: "tick inválido (altura brick = 0)" };
  const wasAnchor = ref.lastClose === null;
  const coreRows = stepRenkoClassic2xTableCore(ref, p, closeEventMs, tickSize);
  if (wasAnchor) {
    return {
      rows: [],
      forming: `Âncora 2× | B = ${fmtPx(B)} (5×tick) · continuação ±B (como 1×) · reversão após movimento adverso ${fmtPx(R2)} (2×B)`,
    };
  }
  const serialAfter = ref.serial;
  const n = coreRows.length;
  const multi = n > 1;
  const rows = coreRows.map((row, i) => {
    const atMsForRow = multi ? closeEventMs + i : closeEventMs;
    return renkoTableRowFromPersist(serialAfter - n + i + 1, row.persist, atMsForRow);
  });
  const lc = ref.lastClose!;
  const eps = 1e-9;
  let forming: string;
  if (ref.lastUp === null) {
    forming = `aguardando 1º tijolo (±B) | base ${fmtPx(lc)} | último ${fmtPx(p)} | ↑ ≥ ${fmtPx(lc + B)} ou ↓ ≤ ${fmtPx(lc - B)}`;
  } else if (ref.lastUp === true) {
    if (p > lc + eps && p < lc + B - eps) {
      const moved = p - lc;
      forming = `forming ↑ (B) | lc ${fmtPx(lc)} | último ${fmtPx(p)} | +${fmtPx(moved)} / ${fmtPx(B)} · rev. ↓ quando ≤ ${fmtPx(lc - R2)}`;
    } else if (p < lc - eps && p > lc - R2 + eps) {
      const moved = lc - p;
      forming = `forming rev. ↓ (2×B) | lc ${fmtPx(lc)} | último ${fmtPx(p)} | −${fmtPx(moved)} / ${fmtPx(R2)} até fechar 1º tijolo ↓`;
    } else {
      forming = `2× ↑ | lc ${fmtPx(lc)} | último ${fmtPx(p)} | continua ↑ ≥ ${fmtPx(lc + B)} · rev. ↓ ≤ ${fmtPx(lc - R2)}`;
    }
  } else {
    if (p < lc - eps && p > lc - B + eps) {
      const moved = lc - p;
      forming = `forming ↓ (B) | lc ${fmtPx(lc)} | último ${fmtPx(p)} | −${fmtPx(moved)} / ${fmtPx(B)} · rev. ↑ quando ≥ ${fmtPx(lc + R2)}`;
    } else if (p > lc + eps && p < lc + R2 - eps) {
      const moved = p - lc;
      forming = `forming rev. ↑ (2×B) | lc ${fmtPx(lc)} | último ${fmtPx(p)} | +${fmtPx(moved)} / ${fmtPx(R2)} até fechar 1º tijolo ↑`;
    } else {
      forming = `2× ↓ | lc ${fmtPx(lc)} | último ${fmtPx(p)} | continua ↓ ≤ ${fmtPx(lc - B)} · rev. ↑ ≥ ${fmtPx(lc + R2)}`;
    }
  }
  return { rows, forming };
}

/** 1 evento aggTrade = 1 na contagem; fecha candle a cada TRADES_PER_CANDLE eventos. */
function stepTradeCountTableDev(
  ref: TradeCountCandleRef,
  p: number,
  q: number,
  t: number,
  m: boolean | undefined,
  closeEventMs: number
): { rows: RenkoTableRow[]; forming: string } {
  const coreRows = stepTradeCountCandle(ref, p, q, t, m, closeEventMs);
  const forming = `Trades: bucket ${ref.tradesInBucket}/${TRADES_PER_CANDLE} (1 evento WS = 1 trade)`;
  if (coreRows.length === 0) return { rows: [], forming };
  const serialAfter = ref.serial;
  const row = renkoTableRowFromPersist(serialAfter, coreRows[0].persist, closeEventMs);
  return { rows: [row], forming };
}

function stepRangeTable(ref: RangeRef, p: number, closeEventMs: number, tickSize: number): { rows: RenkoTableRow[]; forming: string } {
  const R = BRICK_TICK_UNITS * tickSize;
  if (!(R > 0)) return { rows: [], forming: "tick inválido (range = 0)" };
  if (ref.barOpen === null) {
    ref.barOpen = p;
    ref.barHigh = p;
    ref.barLow = p;
    return { rows: [], forming: `Range âncora ${fmtPx(p)} | alvo amplitude ≥ ${fmtPx(R)} (${BRICK_TICK_UNITS} × tick ${tickSize})` };
  }
  ref.barHigh = Math.max(ref.barHigh, p);
  ref.barLow = Math.min(ref.barLow, p);
  const amp = ref.barHigh - ref.barLow;
  if (amp >= R - 1e-9) {
    ref.serial += 1;
    const row = buildRenkoRow(ref.serial, ref.barOpen, p, closeEventMs, true, ref.acc, ref.barHigh, ref.barLow);
    ref.acc = emptyAcc();
    ref.barOpen = p;
    ref.barHigh = p;
    ref.barLow = p;
    return { rows: [row], forming: `nova barra @ ${fmtPx(p)} | amplitude 0 / ${fmtPx(R)}` };
  }
  return {
    rows: [],
    forming: `forming range | O ${fmtPx(ref.barOpen)} | H ${fmtPx(ref.barHigh)} | L ${fmtPx(ref.barLow)} | último ${fmtPx(p)} | amplitude ${fmtPx(amp)} / ${fmtPx(R)}`,
  };
}

/**
 * Kagi simplificado: confirma direção inicial quando afasta >= R da âncora.
 * Depois só fecha nova linha quando há reversão >= R desde o extremo atual.
 */
function stepKagiTable(ref: KagiRef, p: number, closeEventMs: number, tickSize: number): { rows: RenkoTableRow[]; forming: string } {
  const R = BRICK_TICK_UNITS * tickSize;
  if (!(R > 0)) return { rows: [], forming: "tick inválido (kagi = 0)" };

  if (ref.anchor === null) {
    ref.anchor = p;
    ref.extreme = p;
    return { rows: [], forming: `Kagi âncora ${fmtPx(p)} | reversão = ${fmtPx(R)} (${BRICK_TICK_UNITS} × tick ${tickSize})` };
  }

  const rows: RenkoTableRow[] = [];

  if (ref.dir === 0) {
    const moved = p - ref.anchor;
    if (moved >= R || moved <= -R) {
      ref.serial += 1;
      rows.push(buildRenkoRow(ref.serial, ref.anchor, p, closeEventMs, true, ref.acc, Math.max(ref.anchor, p), Math.min(ref.anchor, p)));
      ref.dir = moved > 0 ? 1 : -1;
      ref.extreme = p;
      ref.acc = emptyAcc();
      return { rows, forming: `kagi ${ref.dir > 0 ? "↑" : "↓"} confirmado @ ${fmtPx(p)} | reversão ${fmtPx(R)}` };
    }
    return { rows: [], forming: `forming kagi | âncora ${fmtPx(ref.anchor)} | último ${fmtPx(p)} | falta ${fmtPx(R - Math.abs(moved))}` };
  }

  if (ref.dir > 0) {
    if (p > ref.extreme) ref.extreme = p;
    if (p <= ref.extreme - R) {
      ref.serial += 1;
      rows.push(buildRenkoRow(ref.serial, ref.extreme, p, closeEventMs, true, ref.acc, ref.extreme, p));
      ref.dir = -1;
      ref.extreme = p;
      ref.acc = emptyAcc();
      return { rows, forming: `kagi ↓ reversão @ ${fmtPx(p)} | gatilho ${fmtPx(R)}` };
    }
    return { rows: [], forming: `kagi ↑ | extremo ${fmtPx(ref.extreme)} | último ${fmtPx(p)} | reversão ≤ ${fmtPx(ref.extreme - R)}` };
  }

  if (p < ref.extreme) ref.extreme = p;
  if (p >= ref.extreme + R) {
    ref.serial += 1;
    rows.push(buildRenkoRow(ref.serial, ref.extreme, p, closeEventMs, true, ref.acc, p, ref.extreme));
    ref.dir = 1;
    ref.extreme = p;
    ref.acc = emptyAcc();
    return { rows, forming: `kagi ↑ reversão @ ${fmtPx(p)} | gatilho ${fmtPx(R)}` };
  }
  return { rows: [], forming: `kagi ↓ | extremo ${fmtPx(ref.extreme)} | último ${fmtPx(p)} | reversão ≥ ${fmtPx(ref.extreme + R)}` };
}

function FormingTableRow({ acc }: { acc: TradeAcc }) {
  const s = accToNullableStats(acc);
  return (
    <tr className="bg-amber-50/80 text-zinc-600">
      <td className="border border-zinc-200 px-1.5 py-1">—</td>
      <td className="border border-zinc-200 px-1.5 py-1">{msToUtcIso(acc.firstT) ?? "null"}</td>
      <td className="border border-zinc-200 px-1.5 py-1">null</td>
      <td className="border border-zinc-200 px-1.5 py-1">null</td>
      <td className="border border-zinc-200 px-1.5 py-1">null</td>
      <td className="border border-zinc-200 px-1.5 py-1">null</td>
      <td className="border border-zinc-200 px-1.5 py-1">{s.volBtc ?? "null"}</td>
      <td className="border border-zinc-200 px-1.5 py-1">{msToUtcIso(acc.lastT) ?? "null"}</td>
      <td className="border border-zinc-200 px-1.5 py-1">{s.quoteVolUsdt ?? "null"}</td>
      <td className="border border-zinc-200 px-1.5 py-1">{s.trades ?? "null"}</td>
      <td className="border border-zinc-200 px-1.5 py-1">{s.takerBuyBase ?? "null"}</td>
      <td className="border border-zinc-200 px-1.5 py-1">{s.takerBuyQuote ?? "null"}</td>
    </tr>
  );
}

export default function DevBinanceTicksPage() {
  const [chartMode, setChartMode] = useState<ChartMode>("renko");
  const [persistDb, setPersistDb] = useState(true);
  const [persistLog, setPersistLog] = useState<string>("");
  const [rawWsLinesBySymbol, setRawWsLinesBySymbol] = useState<Record<string, WsLine[]>>({});
  const [status, setStatus] = useState<"connecting" | "open" | "closed" | "error">("connecting");
  const [symbolsList, setSymbolsList] = useState<SymbolEntry[]>([]);
  const [symbolsLoadState, setSymbolsLoadState] = useState<"loading" | "ready">("loading");
  const [dailyBySymbol, setDailyBySymbol] = useState<Record<string, DailyTickInfo | null>>({});
  const [dailyErrBySymbol, setDailyErrBySymbol] = useState<Record<string, string | null>>({});
  const [renkoRowsBySymbol, setRenkoRowsBySymbol] = useState<Record<string, RenkoTableRow[]>>({});
  const [rangeRowsBySymbol, setRangeRowsBySymbol] = useState<Record<string, RenkoTableRow[]>>({});
  const [kagiRowsBySymbol, setKagiRowsBySymbol] = useState<Record<string, RenkoTableRow[]>>({});
  const [renko2xRowsBySymbol, setRenko2xRowsBySymbol] = useState<Record<string, RenkoTableRow[]>>({});
  const [tradeRowsBySymbol, setTradeRowsBySymbol] = useState<Record<string, RenkoTableRow[]>>({});
  const [formingAccBySymbol, setFormingAccBySymbol] = useState<Record<string, TradeAcc | null>>({});
  const [formingBySymbol, setFormingBySymbol] = useState<Record<string, string>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const tickSizeBySymbolRef = useRef<Record<string, number | null>>({});
  const renkoRefBySymbol = useRef<Record<string, RenkoRef>>({});
  const rangeRefBySymbol = useRef<Record<string, RangeRef>>({});
  const kagiRefBySymbol = useRef<Record<string, KagiRef>>({});
  const renko2xRefBySymbol = useRef<Record<string, RenkoClassic2xRef>>({});
  const tradeCountRefBySymbol = useRef<Record<string, TradeCountCandleRef>>({});
  const renkoRowsRefBySymbol = useRef<Record<string, RenkoTableRow[]>>({});
  const rangeRowsRefBySymbol = useRef<Record<string, RenkoTableRow[]>>({});
  const kagiRowsRefBySymbol = useRef<Record<string, RenkoTableRow[]>>({});
  const renko2xRowsRefBySymbol = useRef<Record<string, RenkoTableRow[]>>({});
  const tradeRowsRefBySymbol = useRef<Record<string, RenkoTableRow[]>>({});
  const lastRenkoFormingRefBySymbol = useRef<Record<string, string>>({});
  const lastRangeFormingRefBySymbol = useRef<Record<string, string>>({});
  const lastKagiFormingRefBySymbol = useRef<Record<string, string>>({});
  const symbolsKey = useMemo(() => symbolsList.map((s) => s.rest).join(","), [symbolsList]);
  const dailyTickSignature = useMemo(
    () => symbolsList.map((s) => String(dailyBySymbol[s.rest]?.tick ?? "")).join("|"),
    [symbolsList, dailyBySymbol]
  );
  const streamLabel = useMemo(() => symbolsList.map((s) => s.ws).join(" + "), [symbolsList]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/dev/kline-symbols`, { cache: "no-store" });
        const j = (await res.json()) as { symbols?: string[] };
        const rests =
          res.ok && Array.isArray(j.symbols) && j.symbols.length > 0 ? j.symbols : FALLBACK_SYMBOLS.map((s) => s.rest);
        const list = rests.map(restToSymbolEntry);
        if (!cancelled) setSymbolsList(list);
      } catch {
        if (!cancelled) setSymbolsList(FALLBACK_SYMBOLS);
      } finally {
        if (!cancelled) setSymbolsLoadState("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const persistEnabledRef = useRef(false);
  const pendingRenkoRef = useRef<AggFastBarRowPayload[]>([]);
  const pendingRangeRef = useRef<AggFastBarRowPayload[]>([]);
  const pendingKagiRef = useRef<AggFastBarRowPayload[]>([]);
  const pendingRenko2xRef = useRef<AggFastBarRowPayload[]>([]);
  const pendingTradeRef = useRef<AggFastBarRowPayload[]>([]);
  const urlDevHintShownRef = useRef(false);

  /** Uma vez ao montar: se já existem linhas nas tabelas *Fast*, o cache2 ainda pode estar vazio — o flush só corre após novas barras. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const parts: string[] = [];
      for (const chartKind of CACHE2_TICK_CHART_KINDS) {
        try {
          const res = await fetch(`${API_BASE}/dev/fast-kline-cache2`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chartKind,
              corretora: AGG_FAST_CORRETORA,
              incremental5ticks: true,
              incrementalAggregates: true,
            }),
          });
          const j = (await res.json()) as { ok?: boolean; error?: string; symbolsProcessed?: number };
          if (!res.ok) throw new Error(j.error || res.statusText);
          parts.push(
            `${chartKind}${j.symbolsProcessed != null ? `(${j.symbolsProcessed} símb.)` : ""}`
          );
        } catch (e: unknown) {
          parts.push(`${chartKind}:ERR:${e instanceof Error ? e.message : String(e)}`);
        }
      }
      try {
        const res = await fetch(`${API_BASE}/dev/trade-kline-cache2`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            corretora: AGG_FAST_CORRETORA,
            incremental500trades: true,
            incrementalAggregates: true,
          }),
        });
        const j = (await res.json()) as { ok?: boolean; error?: string; symbolsProcessed?: number };
        if (!res.ok) throw new Error(j.error || res.statusText);
        parts.push(
          `trades500${j.symbolsProcessed != null ? `(${j.symbolsProcessed} símb.)` : ""}`
        );
      } catch (e: unknown) {
        parts.push(`trades500:ERR:${e instanceof Error ? e.message : String(e)}`);
      }
      if (cancelled) return;
      const ts = new Date().toISOString();
      setPersistLog((prev) =>
        `${ts} — Bootstrap cache2 (Fast→BinanceKlineCache2): ${parts.join(" · ")}${prev ? `\n${prev}` : ""}`
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    persistEnabledRef.current = persistDb;
  }, [persistDb]);

  useEffect(() => {
    for (const s of symbolsList) tickSizeBySymbolRef.current[s.rest] = dailyBySymbol[s.rest]?.tick ?? null;
  }, [dailyBySymbol, symbolsList]);

  useEffect(() => {
    if (!persistDb) return;
    const flush = async () => {
      const batches: Array<{
        kind: "renko" | "range" | "kagi" | "renko2x" | "trades500";
        interval: string;
        rows: AggFastBarRowPayload[];
      }> = [
        { kind: "renko", interval: AGG_FAST_INTERVAL, rows: pendingRenkoRef.current.splice(0, pendingRenkoRef.current.length) },
        { kind: "range", interval: AGG_FAST_INTERVAL, rows: pendingRangeRef.current.splice(0, pendingRangeRef.current.length) },
        { kind: "kagi", interval: AGG_FAST_INTERVAL, rows: pendingKagiRef.current.splice(0, pendingKagiRef.current.length) },
        { kind: "renko2x", interval: AGG_FAST_INTERVAL, rows: pendingRenko2xRef.current.splice(0, pendingRenko2xRef.current.length) },
        { kind: "trades500", interval: AGG_FAST_INTERVAL_TRADE, rows: pendingTradeRef.current.splice(0, pendingTradeRef.current.length) },
      ];
      const parts: string[] = [];
      for (const { kind, interval, rows } of batches) {
        if (rows.length === 0) continue;
        try {
          const res = await fetch(`${API_BASE}/dev/agg-fast-bars`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind,
              corretora: AGG_FAST_CORRETORA,
              interval,
              rows,
            }),
          });
          const j = (await res.json()) as {
            inserted?: number;
            error?: string;
            readVersusWriteHint?: string;
          };
          if (!res.ok) throw new Error(j.error || res.statusText);
          const ins = j.inserted ?? 0;
          parts.push(
            `${kind}+${ins}${ins === 0 && rows.length > 0 ? ` (${rows.length} enviadas, 0 novas — PK duplicada ou já existente)` : ""}`
          );
          if (j.readVersusWriteHint && !urlDevHintShownRef.current) {
            urlDevHintShownRef.current = true;
            parts.push(`URL_DEV: ${j.readVersusWriteHint}`);
          }
        } catch (e: unknown) {
          parts.push(`${kind}:ERR:${e instanceof Error ? e.message : String(e)}`);
        }
      }
      const ts = new Date().toISOString();
      if (parts.length > 0) {
        setPersistLog(`${ts} — ${parts.join(" | ")}`);
      } else {
        setPersistLog(
          `${ts} — fila vazia (nenhuma barra fechada desde o último flush; confirma tick diário carregado e linhas nas tabelas *Fast)`
        );
      }
    };
    const id = window.setInterval(flush, PERSIST_FLUSH_MS);
    return () => {
      window.clearInterval(id);
      void flush();
    };
  }, [persistDb]);

  useEffect(() => {
    if (symbolsList.length === 0) return;
    renkoRefBySymbol.current = initMap(symbolsList, emptyRenkoRef);
    rangeRefBySymbol.current = initMap(symbolsList, emptyRangeRef);
    kagiRefBySymbol.current = initMap(symbolsList, emptyKagiRef);
    renko2xRefBySymbol.current = initMap(symbolsList, emptyRenkoClassic2xRef);
    tradeCountRefBySymbol.current = initMap(symbolsList, emptyTradeCountCandleRef);
    renkoRowsRefBySymbol.current = initMap(symbolsList, () => []);
    rangeRowsRefBySymbol.current = initMap(symbolsList, () => []);
    kagiRowsRefBySymbol.current = initMap(symbolsList, () => []);
    renko2xRowsRefBySymbol.current = initMap(symbolsList, () => []);
    tradeRowsRefBySymbol.current = initMap(symbolsList, () => []);
    lastRenkoFormingRefBySymbol.current = initMap(symbolsList, () => "");
    lastRangeFormingRefBySymbol.current = initMap(symbolsList, () => "");
    lastKagiFormingRefBySymbol.current = initMap(symbolsList, () => "");
    setRenkoRowsBySymbol(initMap(symbolsList, () => []));
    setRangeRowsBySymbol(initMap(symbolsList, () => []));
    setKagiRowsBySymbol(initMap(symbolsList, () => []));
    setRenko2xRowsBySymbol(initMap(symbolsList, () => []));
    setTradeRowsBySymbol(initMap(symbolsList, () => []));
    setFormingAccBySymbol(initMap(symbolsList, () => null));
    setFormingBySymbol(initMap(symbolsList, () => ""));
    pendingRenkoRef.current = [];
    pendingRangeRef.current = [];
    pendingKagiRef.current = [];
    pendingRenko2xRef.current = [];
    pendingTradeRef.current = [];
  }, [dailyTickSignature, symbolsKey]);

  useEffect(() => {
    if (symbolsList.length === 0) return;
    let cancelled = false;
    for (const s of symbolsList) {
      fetch(`${API_BASE}/binance/daily-close-tick?symbol=${encodeURIComponent(s.rest)}`)
        .then(async (r) => {
          const j = (await r.json()) as DailyTickInfo & { error?: string };
          if (!r.ok) throw new Error(j.error || r.statusText);
          if (cancelled) return;
          setDailyBySymbol((prev) => ({ ...prev, [s.rest]: j }));
          setDailyErrBySymbol((prev) => ({ ...prev, [s.rest]: null }));
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setDailyErrBySymbol((prev) => ({ ...prev, [s.rest]: e instanceof Error ? e.message : String(e) }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [symbolsList]);

  useEffect(() => {
    if (symbolsList.length === 0) {
      setStatus("connecting");
      return;
    }
    const streams = symbolsList.map((s) => `${s.ws}@aggTrade`).join("/");
    const allowedRest = new Set(symbolsList.map((s) => s.rest));
    const ws = new WebSocket(`${BINANCE_WS}?streams=${streams}`);
    wsRef.current = ws;
    ws.onopen = () => setStatus("open");
    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("error");

    ws.onmessage = (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : "";
      const atMs = parseAggTradeEventMs(raw) ?? Date.now();
      const trade = parseAggTradeFull(raw, allowedRest);
      if (!trade) {
        const om = oldestBarCloseMsAll(
          symbolsList,
          renkoRowsRefBySymbol.current,
          rangeRowsRefBySymbol.current,
          kagiRowsRefBySymbol.current,
          renko2xRowsRefBySymbol.current,
          tradeRowsRefBySymbol.current
        );
        const symParsed = parseSymbolFromAggTradeRaw(raw);
        if (symParsed && allowedRest.has(symParsed)) {
          setRawWsLinesBySymbol((prev) => ({
            ...prev,
            [symParsed]: trimRawWsLines([...(prev[symParsed] ?? []), { atMs, raw }], om),
          }));
        }
        return;
      }

      const symbol = trade.symbol;
      const tickSize = tickSizeBySymbolRef.current[symbol];
      if (tickSize == null || tickSize <= 0) return;

      addTrade(renkoRefBySymbol.current[symbol].acc, trade.p, trade.q, trade.t, trade.m);
      addTrade(rangeRefBySymbol.current[symbol].acc, trade.p, trade.q, trade.t, trade.m);
      addTrade(kagiRefBySymbol.current[symbol].acc, trade.p, trade.q, trade.t, trade.m);
      addTrade(renko2xRefBySymbol.current[symbol].acc, trade.p, trade.q, trade.t, trade.m);

      const renkoOut = stepRenkoTable(renkoRefBySymbol.current[symbol], trade.p, trade.t, tickSize);
      const rangeOut = stepRangeTable(rangeRefBySymbol.current[symbol], trade.p, trade.t, tickSize);
      const kagiOut = stepKagiTable(kagiRefBySymbol.current[symbol], trade.p, trade.t, tickSize);
      const renko2xOut = stepRenkoClassic2xTableDev(renko2xRefBySymbol.current[symbol], trade.p, trade.t, tickSize);
      const tradeOut = stepTradeCountTableDev(tradeCountRefBySymbol.current[symbol], trade.p, trade.q, trade.t, trade.m, trade.t);
      lastRenkoFormingRefBySymbol.current[symbol] = renkoOut.forming;
      lastRangeFormingRefBySymbol.current[symbol] = rangeOut.forming;
      lastKagiFormingRefBySymbol.current[symbol] = kagiOut.forming;

      if (renkoOut.rows.length > 0) {
        const next = capChartRows([...(renkoRowsRefBySymbol.current[symbol] ?? []), ...renkoOut.rows]);
        renkoRowsRefBySymbol.current[symbol] = next;
        setRenkoRowsBySymbol((prev) => ({ ...prev, [symbol]: next }));
      }
      if (rangeOut.rows.length > 0) {
        const next = capChartRows([...(rangeRowsRefBySymbol.current[symbol] ?? []), ...rangeOut.rows]);
        rangeRowsRefBySymbol.current[symbol] = next;
        setRangeRowsBySymbol((prev) => ({ ...prev, [symbol]: next }));
      }
      if (kagiOut.rows.length > 0) {
        const next = capChartRows([...(kagiRowsRefBySymbol.current[symbol] ?? []), ...kagiOut.rows]);
        kagiRowsRefBySymbol.current[symbol] = next;
        setKagiRowsBySymbol((prev) => ({ ...prev, [symbol]: next }));
      }
      if (renko2xOut.rows.length > 0) {
        const next = capChartRows([...(renko2xRowsRefBySymbol.current[symbol] ?? []), ...renko2xOut.rows]);
        renko2xRowsRefBySymbol.current[symbol] = next;
        setRenko2xRowsBySymbol((prev) => ({ ...prev, [symbol]: next }));
      }
      if (tradeOut.rows.length > 0) {
        const next = capChartRows([...(tradeRowsRefBySymbol.current[symbol] ?? []), ...tradeOut.rows]);
        tradeRowsRefBySymbol.current[symbol] = next;
        setTradeRowsBySymbol((prev) => ({ ...prev, [symbol]: next }));
      }

      if (persistEnabledRef.current) {
        if (renkoOut.rows.length > 0) enqueueAggFastRows(symbol, renkoOut.rows, pendingRenkoRef);
        if (rangeOut.rows.length > 0) enqueueAggFastRows(symbol, rangeOut.rows, pendingRangeRef);
        if (kagiOut.rows.length > 0) enqueueAggFastRows(symbol, kagiOut.rows, pendingKagiRef);
        if (renko2xOut.rows.length > 0) enqueueAggFastRows(symbol, renko2xOut.rows, pendingRenko2xRef);
        if (tradeOut.rows.length > 0) enqueueAggFastRows(symbol, tradeOut.rows, pendingTradeRef);
      }

      const modeForming =
        chartMode === "renko"
          ? renkoOut.forming
          : chartMode === "range"
            ? rangeOut.forming
            : chartMode === "kagi"
              ? kagiOut.forming
              : chartMode === "renko2x"
                ? renko2xOut.forming
                : tradeOut.forming;
      setFormingBySymbol((prev) => ({ ...prev, [symbol]: modeForming }));

      const modeAcc =
        chartMode === "renko"
          ? renkoRefBySymbol.current[symbol].acc
          : chartMode === "range"
            ? rangeRefBySymbol.current[symbol].acc
            : chartMode === "kagi"
              ? kagiRefBySymbol.current[symbol].acc
              : chartMode === "renko2x"
                ? renko2xRefBySymbol.current[symbol].acc
                : tradeCountRefBySymbol.current[symbol].acc;
      const ready =
        chartMode === "renko"
          ? renkoRefBySymbol.current[symbol].lastClose != null
          : chartMode === "range"
            ? rangeRefBySymbol.current[symbol].barOpen != null
            : chartMode === "kagi"
              ? kagiRefBySymbol.current[symbol].anchor != null
              : chartMode === "renko2x"
                ? renko2xRefBySymbol.current[symbol].lastClose != null
                : tradeCountRefBySymbol.current[symbol].tradesInBucket > 0;
      setFormingAccBySymbol((prev) => ({ ...prev, [symbol]: ready && modeAcc.trades > 0 ? { ...modeAcc } : null }));

      const om = oldestBarCloseMsAll(
        symbolsList,
        renkoRowsRefBySymbol.current,
        rangeRowsRefBySymbol.current,
        kagiRowsRefBySymbol.current,
        renko2xRowsRefBySymbol.current,
        tradeRowsRefBySymbol.current
      );
      setRawWsLinesBySymbol((prev) => ({
        ...prev,
        [symbol]: trimRawWsLines([...(prev[symbol] ?? []), { atMs, raw }], om),
      }));
    };

    const pruneTimer = window.setInterval(() => {
      for (const s of symbolsList) {
        renkoRowsRefBySymbol.current[s.rest] = capChartRows(renkoRowsRefBySymbol.current[s.rest] ?? []);
        rangeRowsRefBySymbol.current[s.rest] = capChartRows(rangeRowsRefBySymbol.current[s.rest] ?? []);
        kagiRowsRefBySymbol.current[s.rest] = capChartRows(kagiRowsRefBySymbol.current[s.rest] ?? []);
        renko2xRowsRefBySymbol.current[s.rest] = capChartRows(renko2xRowsRefBySymbol.current[s.rest] ?? []);
        tradeRowsRefBySymbol.current[s.rest] = capChartRows(tradeRowsRefBySymbol.current[s.rest] ?? []);
      }
      setRenkoRowsBySymbol({ ...renkoRowsRefBySymbol.current });
      setRangeRowsBySymbol({ ...rangeRowsRefBySymbol.current });
      setKagiRowsBySymbol({ ...kagiRowsRefBySymbol.current });
      setRenko2xRowsBySymbol({ ...renko2xRowsRefBySymbol.current });
      setTradeRowsBySymbol({ ...tradeRowsRefBySymbol.current });
      const om = oldestBarCloseMsAll(
        symbolsList,
        renkoRowsRefBySymbol.current,
        rangeRowsRefBySymbol.current,
        kagiRowsRefBySymbol.current,
        renko2xRowsRefBySymbol.current,
        tradeRowsRefBySymbol.current
      );
      setRawWsLinesBySymbol((prev) => {
        const next: Record<string, WsLine[]> = { ...prev };
        for (const s of symbolsList) {
          next[s.rest] = trimRawWsLines(prev[s.rest] ?? [], om);
        }
        return next;
      });
    }, 3000);

    return () => {
      window.clearInterval(pruneTimer);
      ws.close();
      wsRef.current = null;
    };
  }, [chartMode, symbolsList]);

  if (symbolsLoadState === "loading" || symbolsList.length === 0) {
    return (
      <div className="min-h-screen bg-white p-4 pb-8 text-zinc-900">
        <p className="font-mono text-[11px] text-zinc-600">
          {symbolsLoadState === "loading"
            ? "A carregar símbolos (KlineSymbol ativos → GET /api/dev/kline-symbols)…"
            : "Nenhum símbolo — verifica KlineSymbol no DB ou o fallback."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-8 text-zinc-900">
      <div className="border-b border-zinc-200 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-700">
        <div className="text-zinc-500">Streams ativos ({symbolsList.length}): {streamLabel}</div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-100 py-2 mt-1">
          <label className="flex cursor-pointer items-center gap-1.5 text-zinc-800">
            <input type="checkbox" className="accent-zinc-700" checked={persistDb} onChange={(e) => setPersistDb(e.target.checked)} />
            Gravar barras fechadas no DB
          </label>
          <span className="text-zinc-500">
            (Renko/Range/Kagi/Renko2×: {AGG_FAST_INTERVAL} · trades: {AGG_FAST_INTERVAL_TRADE} · flush a cada {PERSIST_FLUSH_MS / 1000}s)
          </span>
        </div>
        {persistLog ? <div className="text-zinc-600 text-[10px]">{persistLog}</div> : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-100 py-2 mt-1">
          <span className="text-zinc-500">Modo tabela:</span>
          <label className="flex cursor-pointer items-center gap-1.5 text-zinc-800">
            <input type="radio" name="chartMode" className="accent-zinc-700" checked={chartMode === "renko"} onChange={() => setChartMode("renko")} />
            Renko 1×
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-zinc-800">
            <input type="radio" name="chartMode" className="accent-zinc-700" checked={chartMode === "range"} onChange={() => setChartMode("range")} />
            Range
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-zinc-800">
            <input type="radio" name="chartMode" className="accent-zinc-700" checked={chartMode === "kagi"} onChange={() => setChartMode("kagi")} />
            Kagi
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-zinc-800">
            <input type="radio" name="chartMode" className="accent-zinc-700" checked={chartMode === "renko2x"} onChange={() => setChartMode("renko2x")} />
            Renko Clássico
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-zinc-800">
            <input type="radio" name="chartMode" className="accent-zinc-700" checked={chartMode === "trades500"} onChange={() => setChartMode("trades500")} />
            {TRADES_PER_CANDLE} trades/candle
          </label>
        </div>
      </div>

      <p className="border-b border-zinc-100 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        WebSocket bruto (máx. {MAX_RAW_WS_LINES_PER_SYMBOL} linhas por símbolo)
      </p>
      <div className="border-b border-zinc-200">
        {symbolsList.map((s) => (
          <div key={`raw-ws-${s.rest}`} className="border-b border-zinc-100 last:border-b-0">
            <p className="bg-zinc-50 px-3 py-1 font-mono text-[10px] text-zinc-600">{s.rest}</p>
            <pre className="m-0 max-h-[18vh] overflow-y-auto p-3 font-mono text-[11px] leading-snug whitespace-pre-wrap break-all">
              {(rawWsLinesBySymbol[s.rest] ?? []).map((l) => l.raw).join("\n")}
            </pre>
          </div>
        ))}
      </div>

      {symbolsList.map((s) => {
        const daily = dailyBySymbol[s.rest];
        const err = dailyErrBySymbol[s.rest];
        const rows =
          (chartMode === "renko"
            ? renkoRowsBySymbol[s.rest]
            : chartMode === "range"
              ? rangeRowsBySymbol[s.rest]
              : chartMode === "kagi"
                ? kagiRowsBySymbol[s.rest]
                : chartMode === "renko2x"
                  ? renko2xRowsBySymbol[s.rest]
                  : tradeRowsBySymbol[s.rest]) ?? [];
        const brickHeight = daily != null && daily.tick > 0 ? (BRICK_TICK_UNITS * daily.tick).toLocaleString("en-US", { maximumFractionDigits: 8 }) : "—";
        const reversal2xHeight =
          daily != null && daily.tick > 0 ? (BRICK_TICK_UNITS * daily.tick * 2).toLocaleString("en-US", { maximumFractionDigits: 8 }) : "—";
        return (
          <section key={s.rest} className="border-b border-zinc-200">
            <div className="px-3 py-2 font-mono text-[11px] text-zinc-700">
              <div className="font-semibold text-zinc-900">{s.rest}</div>
              <div>
                <span className="text-zinc-500">Último fecho diário:</span>{" "}
                {daily ? `${daily.lastCompletedDailyClose} USDT${daily.incomplete ? " (incompleto)" : ""}` : err ? <span className="text-red-600">{err}</span> : "…"}
              </div>
              <div>
                <span className="text-zinc-500">Tick:</span> {daily ? <strong>{daily.tick}</strong> : "…"} USDT ·
                <span className="text-zinc-500"> tamanho B (5×tick):</span> <strong>{brickHeight}</strong> USDT
                {chartMode === "renko2x" ? (
                  <>
                    {" "}
                    · <span className="text-zinc-500">reversão (2×B):</span> <strong>{reversal2xHeight}</strong> USDT
                  </>
                ) : null}
              </div>
              <div className="text-zinc-500">{formingBySymbol[s.rest]}</div>
            </div>
            <p className="border-y border-zinc-100 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {chartMode === "renko"
                ? "Renko 1×"
                : chartMode === "range"
                  ? "Range"
                  : chartMode === "kagi"
                    ? "Kagi"
                    : chartMode === "renko2x"
                      ? "Renko Clássico"
                      : `${TRADES_PER_CANDLE} trades/candle`}{" "}
              — {s.rest} (últimos {MAX_CHART_ROWS})
            </p>
            <div className="overflow-x-auto px-2 py-2">
              <table className="w-full min-w-[980px] border-collapse font-mono text-[10px]">
                <thead>
                  <tr className="bg-zinc-100 text-left text-zinc-700">
                    <th className="border border-zinc-300 px-1.5 py-1">Bar</th>
                    <th className="border border-zinc-300 px-1.5 py-1">Open Time (UTC)</th>
                    <th className="border border-zinc-300 px-1.5 py-1">Open</th>
                    <th className="border border-zinc-300 px-1.5 py-1">High</th>
                    <th className="border border-zinc-300 px-1.5 py-1">Low</th>
                    <th className="border border-zinc-300 px-1.5 py-1">Close</th>
                    <th className="border border-zinc-300 px-1.5 py-1">Vol Base</th>
                    <th className="border border-zinc-300 px-1.5 py-1">Close Time (UTC)</th>
                    <th className="border border-zinc-300 px-1.5 py-1">Quote Vol (USDT)</th>
                    <th className="border border-zinc-300 px-1.5 py-1">Trades</th>
                    <th className="border border-zinc-300 px-1.5 py-1">Taker Buy Base</th>
                    <th className="border border-zinc-300 px-1.5 py-1">Taker Buy Quote</th>
                  </tr>
                </thead>
                <tbody>
                  {formingAccBySymbol[s.rest] != null && formingAccBySymbol[s.rest]!.trades > 0 ? <FormingTableRow acc={formingAccBySymbol[s.rest]!} /> : null}
                  {[...rows].reverse().map((r) => (
                    <tr key={`${s.rest}-${chartMode}-${r.bar}-${r.atMs}-${r.open}-${r.close}`} className="hover:bg-zinc-50">
                      <td className="border border-zinc-200 px-1.5 py-1">{r.bar}</td>
                      <td className="border border-zinc-200 px-1.5 py-1">{r.openTimeUtc ?? "null"}</td>
                      <td className="border border-zinc-200 px-1.5 py-1">{r.open}</td>
                      <td className="border border-zinc-200 px-1.5 py-1">{r.high}</td>
                      <td className="border border-zinc-200 px-1.5 py-1">{r.low}</td>
                      <td className="border border-zinc-200 px-1.5 py-1">{r.close}</td>
                      <td className="border border-zinc-200 px-1.5 py-1">{r.volBtc ?? "null"}</td>
                      <td className="border border-zinc-200 px-1.5 py-1">{r.closeTimeUtc ?? "null"}</td>
                      <td className="border border-zinc-200 px-1.5 py-1">{r.quoteVolUsdt ?? "null"}</td>
                      <td className="border border-zinc-200 px-1.5 py-1">{r.trades ?? "null"}</td>
                      <td className="border border-zinc-200 px-1.5 py-1">{r.takerBuyBase ?? "null"}</td>
                      <td className="border border-zinc-200 px-1.5 py-1">{r.takerBuyQuote ?? "null"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <p className="fixed bottom-2 left-2 text-[10px] text-zinc-400" aria-hidden>
        {streamLabel} · {status}
      </p>
    </div>
  );
}
