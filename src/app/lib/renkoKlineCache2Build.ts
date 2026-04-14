import type { PrismaClient } from "@/lib/prisma-bio-client";
import { Prisma } from "@/lib/prisma-bio-client";
import { TRADES_PER_CANDLE } from "@/app/lib/binanceAggRenkoCore";

/** Base Renko 1× na tabela *Fast* = 5 ticks por tijolo. */
export const RENKO_BASE_TICKS = 5;

/**
 * Camadas de cache em ticks (origem: linhas de `BinanceRenkoFast` a 5ticks).
 * 15ticks = 3 linhas, 25 = 5, 50 = 10, 100 = 20, 150 = 30, 200 = 40.
 */
export const RENKO_CACHE_TICK_INTERVALS = [5, 15, 25, 50, 100, 150, 200] as const;

/** Após agrupamento: no máximo esta quantidade de linhas por combinação (symbol, chartKind, interval). */
export const RENKO_CACHE2_MAX_ROWS = 5000;

export type RenkoCacheTickInterval = (typeof RENKO_CACHE_TICK_INTERVALS)[number];

export function groupSizeForTickInterval(ticks: RenkoCacheTickInterval): number {
  return ticks / RENKO_BASE_TICKS;
}

/** Linha mínima lida de tabelas *Fast* a 5ticks (campos usados no merge). */
export type FastBarSourceRow = {
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
};

/** @deprecated use FastBarSourceRow */
export type RenkoFastSourceRow = FastBarSourceRow;

function mergeOhlcChunk(
  chunk: FastBarSourceRow[],
  symbol: string,
  intervalLabel: string,
  chartKind: string
): {
  symbol: string;
  chartKind: string;
  interval: string;
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
} {
  const first = chunk[0]!;
  const last = chunk[chunk.length - 1]!;
  let high = first.high;
  let low = first.low;
  let vol = new Prisma.Decimal(0);
  let qVol = new Prisma.Decimal(0);
  let trades = 0;
  let tb = new Prisma.Decimal(0);
  let tq = new Prisma.Decimal(0);
  for (const c of chunk) {
    if (c.high.gt(high)) high = c.high;
    if (c.low.lt(low)) low = c.low;
    vol = vol.add(c.volume);
    qVol = qVol.add(c.quoteAssetVolume);
    trades += c.numberOfTrades;
    tb = tb.add(c.takerBuyBaseAssetVolume);
    tq = tq.add(c.takerBuyQuoteAssetVolume);
  }
  return {
    symbol,
    chartKind,
    interval: intervalLabel,
    openTime: first.openTime,
    closeTime: last.closeTime,
    open: first.open,
    high,
    low,
    close: last.close,
    volume: vol,
    quoteAssetVolume: qVol,
    numberOfTrades: trades,
    takerBuyBaseAssetVolume: tb,
    takerBuyQuoteAssetVolume: tq,
  };
}

/**
 * Agrega blocos consecutivos de `groupSize` linhas (mesma ordem temporal).
 * Descarta o resto incompleto no fim.
 */
export function aggregateFastBarsFromFixedGroupSize(
  rowsAsc: FastBarSourceRow[],
  groupSize: number,
  intervalLabel: string,
  chartKind: string
): ReturnType<typeof mergeOhlcChunk>[] {
  if (rowsAsc.length === 0 || groupSize < 1) return [];
  const symbol = rowsAsc[0]!.symbol;
  if (groupSize === 1) {
    return rowsAsc.map((r) =>
      mergeOhlcChunk([r], symbol, intervalLabel, chartKind)
    );
  }
  const out: ReturnType<typeof mergeOhlcChunk>[] = [];
  for (let i = 0; i + groupSize <= rowsAsc.length; i += groupSize) {
    out.push(
      mergeOhlcChunk(rowsAsc.slice(i, i + groupSize), symbol, intervalLabel, chartKind)
    );
  }
  return out;
}

/** Maior `openTime` da base no último bloco completo (para watermark), ou null se não há tijolo completo. */
export function lastClosedBaseOpenTimeFromCompleteBlocks(
  rowsAsc: FastBarSourceRow[],
  groupSize: number
): bigint | null {
  if (rowsAsc.length < groupSize || groupSize < 1) return null;
  const n = Math.floor(rowsAsc.length / groupSize) * groupSize;
  return rowsAsc[n - 1]!.openTime;
}

/**
 * Converte uma linha emitida por `mergeOhlcChunk` para `FastBarSourceRow` (próxima fase da cadeia).
 */
export function mergeOhlcChunkRowToFastSourceRow(row: {
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
}): FastBarSourceRow {
  return {
    symbol: row.symbol,
    openTime: row.openTime,
    closeTime: row.closeTime,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    quoteAssetVolume: row.quoteAssetVolume,
    numberOfTrades: row.numberOfTrades,
    takerBuyBaseAssetVolume: row.takerBuyBaseAssetVolume,
    takerBuyQuoteAssetVolume: row.takerBuyQuoteAssetVolume,
  };
}

/**
 * A partir de linhas-fonte 5ticks (um tijolo por linha): normaliza o tier base 5ticks,
 * depois P15/P25 diretos da base, ou cadeia 5×5t → 25t → tier final para P50+ (múltiplos de 25).
 * Alinha o modelo “agregação da agregação” (25t como degrau antes de 50, 100, …).
 */
export function aggregateFastBarsFrom5TickBricksToTier(
  rowsAsc: FastBarSourceRow[],
  targetTicks: RenkoCacheTickInterval,
  chartKind: string
): ReturnType<typeof mergeOhlcChunk>[] {
  if (rowsAsc.length === 0) return [];

  const baseTier = aggregateFastBarsFromFixedGroupSize(rowsAsc, 1, "5ticks", chartKind);
  const base = baseTier.map(mergeOhlcChunkRowToFastSourceRow);

  if (targetTicks <= 5) {
    return baseTier;
  }
  if (targetTicks === 15) {
    return aggregateFastBarsFromFixedGroupSize(base, 3, "15ticks", chartKind);
  }
  if (targetTicks === 25) {
    return aggregateFastBarsFromFixedGroupSize(base, 5, "25ticks", chartKind);
  }
  if (targetTicks > 25 && targetTicks % 25 === 0) {
    const tier25 = aggregateFastBarsFromFixedGroupSize(base, 5, "25ticks", chartKind);
    const src25 = tier25.map(mergeOhlcChunkRowToFastSourceRow);
    const factor = targetTicks / 25;
    return aggregateFastBarsFromFixedGroupSize(
      src25,
      factor,
      `${targetTicks}ticks`,
      chartKind
    );
  }

  const gs = groupSizeForTickInterval(targetTicks);
  const intervalLabel = `${targetTicks}ticks`;
  return aggregateFastBarsFromFixedGroupSize(base, gs, intervalLabel, chartKind);
}

/**
 * Agrega linhas consecutivas de 5ticks (mesma ordem temporal) em tijolos maiores.
 * Descarta o resto incompleto no fim (ex.: 10 linhas com groupSize 3 → 3 barras, 1 linha descartada).
 */
export function aggregateFastBarsFrom5TickRows(
  rowsAsc: FastBarSourceRow[],
  ticks: RenkoCacheTickInterval,
  chartKind: string
): ReturnType<typeof mergeOhlcChunk>[] {
  return aggregateFastBarsFrom5TickBricksToTier(rowsAsc, ticks, chartKind);
}

/** Renko 1× em cache (`chartKind` = renko). */
export function aggregateRenkoFrom5TickRows(
  rowsAsc: FastBarSourceRow[],
  ticks: RenkoCacheTickInterval
): ReturnType<typeof mergeOhlcChunk>[] {
  return aggregateFastBarsFrom5TickBricksToTier(rowsAsc, ticks, "renko");
}

/** Uma linha de `BinanceTradeCountFast` = `TRADES_PER_CANDLE` eventos (ex.: 500). */
export const TRADE_CACHE_BASE_TRADES = TRADES_PER_CANDLE;

/**
 * Camadas de cache por contagem de trades (origem: linhas `*trades` com 500 trades/linha).
 * 1000 = 2 linhas, 2500 = 5, 5000 = 10, 7500 = 15, 10000 = 20.
 */
export const TRADE_CACHE_TRADE_INTERVALS = [
  500, 1000, 2500, 5000, 7500, 10000,
] as const;

export type TradeCacheTradeInterval = (typeof TRADE_CACHE_TRADE_INTERVALS)[number];

export function groupSizeForTradeCacheInterval(
  trades: TradeCacheTradeInterval
): number {
  return trades / TRADE_CACHE_BASE_TRADES;
}

/**
 * Agrega linhas consecutivas de velas 500-trades em barras maiores (OHLC).
 * Descarta resto incompleto no fim.
 */
export function aggregateFastBarsFromTradeCountRows(
  rowsAsc: FastBarSourceRow[],
  tradeTotal: TradeCacheTradeInterval,
  chartKind: string
): ReturnType<typeof mergeOhlcChunk>[] {
  const gs = groupSizeForTradeCacheInterval(tradeTotal);
  const intervalLabel = `${tradeTotal}trades`;
  return aggregateFastBarsFromFixedGroupSize(rowsAsc, gs, intervalLabel, chartKind);
}

const CREATE_MANY_CHUNK = 500;

/** Grava em lotes (limite prático do Prisma / Postgres). */
export async function createManyKlineCache2Chunks(
  db: Pick<PrismaClient, "binanceKlineCache2">,
  rows: Prisma.BinanceKlineCache2CreateManyInput[],
  options?: { skipDuplicates?: boolean }
): Promise<number> {
  const skipDuplicates = options?.skipDuplicates ?? false;
  let total = 0;
  for (let i = 0; i < rows.length; i += CREATE_MANY_CHUNK) {
    const chunk = rows.slice(i, i + CREATE_MANY_CHUNK);
    const { count } = await db.binanceKlineCache2.createMany({
      data: chunk,
      skipDuplicates,
    });
    total += count;
  }
  return total;
}

/**
 * Expurgo por série em `BinanceKlineCache2`: no máximo `maxRows` linhas por
 * **(symbol, chartKind, interval)** — `chartKind` é o tipo de gráfico (ex.: renko).
 * Mantém os `maxRows` openTime mais recentes dessa série.
 */
export async function purgeBinanceKlineCache2SeriesToMax(
  db: Pick<PrismaClient, "binanceKlineCache2">,
  params: {
    symbol: string;
    chartKind: string;
    interval: string;
    maxRows: number;
  }
): Promise<number> {
  const { symbol, chartKind, interval, maxRows } = params;
  if (maxRows < 1) return 0;
  const total = await db.binanceKlineCache2.count({
    where: { symbol, chartKind, interval },
  });
  if (total <= maxRows) return 0;
  const boundary = await db.binanceKlineCache2.findMany({
    where: { symbol, chartKind, interval },
    orderBy: { openTime: "desc" },
    select: { openTime: true },
    skip: maxRows - 1,
    take: 1,
  });
  const cut = boundary[0]?.openTime;
  if (cut === undefined) return 0;
  const { count } = await db.binanceKlineCache2.deleteMany({
    where: {
      symbol,
      chartKind,
      interval,
      openTime: { lt: cut },
    },
  });
  return count;
}

/** Atalho Renko 1× (`chartKind` = renko). */
export async function purgeBinanceKlineCache2RenkoToMax(
  db: Pick<PrismaClient, "binanceKlineCache2">,
  symbol: string,
  intervalLabel: string,
  maxRows: number
): Promise<number> {
  return purgeBinanceKlineCache2SeriesToMax(db, {
    symbol,
    chartKind: "renko",
    interval: intervalLabel,
    maxRows,
  });
}
