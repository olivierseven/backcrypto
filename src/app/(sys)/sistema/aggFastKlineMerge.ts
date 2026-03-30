import type { AggFastBarRowPayload } from "@/app/lib/binanceAggRenkoCore";

/**
 * Chave única por tijolo fechado (inclui tempos). Útil quando openTime/closeTime fazem parte da identidade.
 */
export function aggFastLiveRowKey(r: AggFastBarRowPayload): string {
  return [
    r.openTime,
    r.closeTime,
    r.open,
    r.high,
    r.low,
    r.close,
    r.volume,
    r.numberOfTrades,
  ].join("|");
}

/** Estabiliza IEEE 754: mesmos preços na UI com bits diferentes geravam chaves distintas e linhas repetidas. */
function normBrickKeyNum(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  return String(Math.round(n * 1e8) / 1e8);
}

/**
 * Identidade visual do tijolo: **só OHLC** (arredondados). Volume/trades mudam entre emissões
 * duplicadas do mesmo tijolo → não entram na chave (evita linhas repetidas na tabela).
 */
export function aggFastLiveBrickLogicalKey(r: AggFastBarRowPayload): string {
  return [
    normBrickKeyNum(r.open),
    normBrickKeyNum(r.high),
    normBrickKeyNum(r.low),
    normBrickKeyNum(r.close),
  ].join("|");
}
import { Prisma } from "@/lib/prisma-bio-client";
import {
  aggregateFastBarsFrom5TickBricksToTier,
  aggregateFastBarsFromTradeCountRows,
  RENKO_CACHE_TICK_INTERVALS,
  TRADE_CACHE_TRADE_INTERVALS,
  type FastBarSourceRow,
  type RenkoCacheTickInterval,
  type TradeCacheTradeInterval,
} from "@/app/lib/renkoKlineCache2Build";
import type { AggChartKind } from "./KlinesChartConstants";

/**
 * Mesmo formato que GET /api/binance/agg-fast-bars (rowToKline + applyTimezoneOffset).
 */
export function aggPayloadToDisplayKline(p: AggFastBarRowPayload, timezoneOffsetHours: number): (string | number)[] {
  const row: (string | number)[] = [
    Number(p.openTime),
    String(p.open),
    String(p.high),
    String(p.low),
    String(p.close),
    String(p.volume),
    Number(p.closeTime),
    String(p.quoteAssetVolume),
    p.numberOfTrades,
    String(p.takerBuyBaseAssetVolume),
    String(p.takerBuyQuoteAssetVolume),
    0,
  ];
  if (timezoneOffsetHours === 0) return row;
  const offsetMs = timezoneOffsetHours * 60 * 60 * 1000;
  return [
    Number(row[0]) + offsetMs,
    row[1],
    row[2],
    row[3],
    row[4],
    row[5],
    Number(row[6]) + offsetMs,
    row[7],
    row[8],
    row[9],
    row[10],
    row[11],
  ];
}

/**
 * Junta cache do servidor (GET) com barras calculadas em cliente a partir de aggTrade (sem persistir).
 * Chave = openTime em exibição (após fuso); barras ao vivo sobrescrevem a mesma chave.
 */
export function mergeAggFastServerAndLive(
  serverKlines: readonly (readonly (string | number | null)[])[],
  liveRows: Iterable<AggFastBarRowPayload>,
  timezoneOffsetHours: number,
  maxBars = 1000
): (string | number | null)[][] {
  const m = new Map<number, (string | number | null)[]>();
  for (const row of serverKlines) {
    const ot = Number(row[0]);
    if (Number.isFinite(ot)) m.set(ot, [...row]);
  }
  for (const p of liveRows) {
    const k = aggPayloadToDisplayKline(p, timezoneOffsetHours);
    m.set(Number(k[0]), k);
  }
  const sorted = [...m.values()].sort((a, b) => Number(b[0]) - Number(a[0]));
  const out: (string | number | null)[][] = [];
  const eps = 1e-12;

  const num = (v: string | number | null | undefined): number => Number(v);
  const eq = (a: string | number | null | undefined, b: string | number | null | undefined): boolean => {
    const na = num(a);
    const nb = num(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
    return Math.abs(na - nb) <= eps;
  };

  for (const row of sorted) {
    const prev = out[out.length - 1];
    if (prev != null && eq(prev[1], row[1]) && eq(prev[4], row[4])) {
      // Duplicata estrutural (mesmo open/close em timestamps diferentes):
      // mantém o candle mais novo e incorpora extremos de pavio/volume.
      const prevHigh = num(prev[2]);
      const prevLow = num(prev[3]);
      const rowHigh = num(row[2]);
      const rowLow = num(row[3]);
      if (Number.isFinite(prevHigh) && Number.isFinite(rowHigh)) prev[2] = String(Math.max(prevHigh, rowHigh));
      if (Number.isFinite(prevLow) && Number.isFinite(rowLow)) prev[3] = String(Math.min(prevLow, rowLow));

      const prevVol = num(prev[5]);
      const rowVol = num(row[5]);
      if (Number.isFinite(prevVol) && Number.isFinite(rowVol)) prev[5] = String(Math.max(prevVol, rowVol));

      const prevQVol = num(prev[7]);
      const rowQVol = num(row[7]);
      if (Number.isFinite(prevQVol) && Number.isFinite(rowQVol)) prev[7] = String(Math.max(prevQVol, rowQVol));

      const prevTrades = num(prev[8]);
      const rowTrades = num(row[8]);
      if (Number.isFinite(prevTrades) && Number.isFinite(rowTrades)) prev[8] = Math.max(prevTrades, rowTrades);
      continue;
    }
    out.push([...row]);
    if (out.length >= maxBars) break;
  }

  return out;
}

export function aggPayloadToFastSourceRow(p: AggFastBarRowPayload): FastBarSourceRow {
  return {
    symbol: p.symbol,
    openTime: BigInt(Math.trunc(p.openTime)),
    closeTime: BigInt(Math.trunc(p.closeTime)),
    open: new Prisma.Decimal(p.open),
    high: new Prisma.Decimal(p.high),
    low: new Prisma.Decimal(p.low),
    close: new Prisma.Decimal(p.close),
    volume: new Prisma.Decimal(p.volume),
    quoteAssetVolume: new Prisma.Decimal(p.quoteAssetVolume),
    numberOfTrades: p.numberOfTrades,
    takerBuyBaseAssetVolume: new Prisma.Decimal(p.takerBuyBaseAssetVolume),
    takerBuyQuoteAssetVolume: new Prisma.Decimal(p.takerBuyQuoteAssetVolume),
  };
}

export function ohlcChunkToAggPayload(r: {
  symbol: string;
  openTime: bigint;
  closeTime: bigint;
  open: Prisma.Decimal;
  high: Prisma.Decimal;
  low: Prisma.Decimal;
  close: Prisma.Decimal;
  volume: Prisma.Decimal;
  quoteAssetVolume: Prisma.Decimal;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: Prisma.Decimal;
  takerBuyQuoteAssetVolume: Prisma.Decimal;
}): AggFastBarRowPayload {
  return {
    symbol: r.symbol,
    openTime: Number(r.openTime),
    closeTime: Number(r.closeTime),
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume),
    quoteAssetVolume: Number(r.quoteAssetVolume),
    numberOfTrades: r.numberOfTrades,
    takerBuyBaseAssetVolume: Number(r.takerBuyBaseAssetVolume),
    takerBuyQuoteAssetVolume: Number(r.takerBuyQuoteAssetVolume),
  };
}

/**
 * O WS aggTrade + step* produz sempre barras-fonte (5ticks / 500trades).
 * Para o gráfico no tier selecionado (P15, 1kT, …), agrega como no servidor antes do merge com GET.
 */
export function liveSourcePayloadsToTierPayloadsForMerge(
  liveSource: Iterable<AggFastBarRowPayload>,
  cache2: { chartKind: AggChartKind; interval: string } | null
): AggFastBarRowPayload[] {
  const rows = [...liveSource];
  if (rows.length === 0 || cache2 == null) return rows;

  const asc = [...rows].sort(
    (a, b) => a.openTime - b.openTime || a.closeTime - b.closeTime || a.open - b.open
  );
  const src = asc.map(aggPayloadToFastSourceRow);

  if (cache2.chartKind === "trades500") {
    const m = /^(\d+)trades$/.exec(cache2.interval.trim());
    const tr = m ? Number(m[1]) : TRADE_CACHE_TRADE_INTERVALS[0];
    if (!Number.isFinite(tr) || !(TRADE_CACHE_TRADE_INTERVALS as readonly number[]).includes(tr)) {
      return rows;
    }
    if (tr === TRADE_CACHE_TRADE_INTERVALS[0]) return rows;
    const agg = aggregateFastBarsFromTradeCountRows(
      src,
      tr as TradeCacheTradeInterval,
      "trades500"
    );
    return agg.map(ohlcChunkToAggPayload);
  }

  const tm = /^(\d+)ticks$/.exec(cache2.interval.trim());
  const ticks = tm ? Number(tm[1]) : 5;
  if (!Number.isFinite(ticks) || !(RENKO_CACHE_TICK_INTERVALS as readonly number[]).includes(ticks)) {
    return rows;
  }
  if (ticks === 5) return rows;
  const agg = aggregateFastBarsFrom5TickBricksToTier(
    src,
    ticks as RenkoCacheTickInterval,
    cache2.chartKind
  );
  return agg.map(ohlcChunkToAggPayload);
}
