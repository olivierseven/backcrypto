import type { PrismaClient } from "@/lib/prisma-bio-client";
import type { Prisma } from "@/lib/prisma-bio-client";
import {
  aggregateFastBarsFromFixedGroupSize,
  createManyKlineCache2Chunks,
  groupSizeForTradeCacheInterval,
  purgeBinanceKlineCache2SeriesToMax,
  RENKO_CACHE2_MAX_ROWS,
  TRADE_CACHE_TRADE_INTERVALS,
  TRADE_CACHE_BASE_TRADES,
  type FastBarSourceRow,
  type TradeCacheTradeInterval,
} from "@/app/lib/renkoKlineCache2Build";
export const TRADE_CACHE_CHART_KIND = "trades500" as const;

const SOURCE_INTERVAL = `${TRADE_CACHE_BASE_TRADES}trades`;

/** Colunas em `BinanceTradeCountFast` alinhadas aos 6 intervalos do cache trades500. */
export const TRADE_K2_FLAG_BY_TRADES: Record<TradeCacheTradeInterval, string> = {
  500: "k2Incl500trades",
  1000: "k2Incl1000trades",
  2500: "k2Incl2500trades",
  5000: "k2Incl5000trades",
  7500: "k2Incl7500trades",
  10000: "k2Incl10000trades",
};

const RESET_ALL_K2_FLAGS = {
  k2Incl500trades: false,
  k2Incl1000trades: false,
  k2Incl2500trades: false,
  k2Incl5000trades: false,
  k2Incl7500trades: false,
  k2Incl10000trades: false,
} as Prisma.BinanceTradeCountFastUpdateManyMutationInput;

function toSourceRow(r: {
  symbol: string;
  openTime: bigint;
  closeTime: bigint;
  open: FastBarSourceRow["open"];
  high: FastBarSourceRow["high"];
  low: FastBarSourceRow["low"];
  close: FastBarSourceRow["close"];
  volume: FastBarSourceRow["volume"];
  quoteAssetVolume: FastBarSourceRow["quoteAssetVolume"];
  numberOfTrades: number;
  takerBuyBaseAssetVolume: FastBarSourceRow["takerBuyBaseAssetVolume"];
  takerBuyQuoteAssetVolume: FastBarSourceRow["takerBuyQuoteAssetVolume"];
}): FastBarSourceRow {
  return {
    symbol: r.symbol,
    openTime: r.openTime,
    closeTime: r.closeTime,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
    quoteAssetVolume: r.quoteAssetVolume,
    numberOfTrades: r.numberOfTrades,
    takerBuyBaseAssetVolume: r.takerBuyBaseAssetVolume,
    takerBuyQuoteAssetVolume: r.takerBuyQuoteAssetVolume,
  };
}

function aggToCache2Rows(
  agg: ReturnType<typeof aggregateFastBarsFromFixedGroupSize>
): Prisma.BinanceKlineCache2CreateManyInput[] {
  return agg.map((r) => ({
    symbol: r.symbol,
    chartKind: r.chartKind,
    interval: r.interval,
    openTime: r.openTime,
    closeTime: r.closeTime,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
    quoteAssetVolume: r.quoteAssetVolume,
    numberOfTrades: r.numberOfTrades,
    takerBuyBaseAssetVolume: r.takerBuyBaseAssetVolume,
    takerBuyQuoteAssetVolume: r.takerBuyQuoteAssetVolume,
  }));
}

const TRADE_CACHE_INTERVAL_LABELS = TRADE_CACHE_TRADE_INTERVALS.map(
  (t) => `${t}trades`
);

/**
 * trades500: progresso por linha na origem 500trades (`k2Incl*trades` em `BinanceTradeCountFast`).
 */
export async function processTradeKlineCacheWithSourceFlags(
  db: PrismaClient,
  opts: {
    corretora: string;
    symbol: string;
    incremental500trades: boolean;
    incrementalAggregates: boolean;
  }
): Promise<{
  symbol: string;
  intervals: Record<string, number>;
  purgeDeleted: Record<string, number>;
  purgeMaxRows: number;
}> {
  const { corretora, symbol, incremental500trades, incrementalAggregates } =
    opts;

  const mustFullRebuild = !incremental500trades || !incrementalAggregates;

  if (mustFullRebuild) {
    await db.binanceKlineCache2.deleteMany({
      where: {
        symbol,
        chartKind: TRADE_CACHE_CHART_KIND,
        interval: { in: TRADE_CACHE_INTERVAL_LABELS },
      },
    });
    await db.binanceTradeCountFast.updateMany({
      where: { corretora, symbol, interval: SOURCE_INTERVAL },
      data: RESET_ALL_K2_FLAGS,
    });
  }

  const intervals: Record<string, number> = {};

  const allRows = await db.binanceTradeCountFast.findMany({
    where: { corretora, symbol, interval: SOURCE_INTERVAL },
    orderBy: { openTime: "asc" },
  });
  const allSrc = allRows.map((r) => toSourceRow(r));

  if (mustFullRebuild) {
    for (const tradeTotal of TRADE_CACHE_TRADE_INTERVALS) {
      const intervalLabel = `${tradeTotal}trades`;
      const gs = groupSizeForTradeCacheInterval(tradeTotal);
      const agg = aggregateFastBarsFromFixedGroupSize(
        allSrc,
        gs,
        intervalLabel,
        TRADE_CACHE_CHART_KIND
      );
      const data = aggToCache2Rows(agg);
      const n = await createManyKlineCache2Chunks(db, data);
      intervals[intervalLabel] = n;
      const nMark = Math.floor(allRows.length / gs) * gs;
      if (nMark > 0) {
        const ots = allRows.slice(0, nMark).map((r) => r.openTime);
        const flag = TRADE_K2_FLAG_BY_TRADES[tradeTotal];
        await db.binanceTradeCountFast.updateMany({
          where: {
            corretora,
            symbol,
            interval: SOURCE_INTERVAL,
            openTime: { in: ots },
          },
          data: { [flag]: true } as Prisma.BinanceTradeCountFastUpdateManyMutationInput,
        });
      }
    }
  } else {
    for (const tradeTotal of TRADE_CACHE_TRADE_INTERVALS) {
      const intervalLabel = `${tradeTotal}trades`;
      const gs = groupSizeForTradeCacheInterval(tradeTotal);
      const flag = TRADE_K2_FLAG_BY_TRADES[tradeTotal];
      let tierIns = 0;

      if (gs === 1) {
        while (true) {
          const batch = await db.binanceTradeCountFast.findMany({
            where: {
              corretora,
              symbol,
              interval: SOURCE_INTERVAL,
              [flag]: false,
            } as Prisma.BinanceTradeCountFastWhereInput,
            orderBy: { openTime: "asc" },
            take: 500,
          });
          if (batch.length === 0) break;
          const src = batch.map((r) => toSourceRow(r));
          const agg = aggregateFastBarsFromFixedGroupSize(
            src,
            1,
            intervalLabel,
            TRADE_CACHE_CHART_KIND
          );
          const data = aggToCache2Rows(agg);
          const n = await createManyKlineCache2Chunks(db, data, {
            skipDuplicates: true,
          });
          tierIns += n;
          await db.binanceTradeCountFast.updateMany({
            where: {
              corretora,
              symbol,
              interval: SOURCE_INTERVAL,
              openTime: { in: batch.map((b) => b.openTime) },
            },
            data: { [flag]: true } as Prisma.BinanceTradeCountFastUpdateManyMutationInput,
          });
        }
      } else {
        while (true) {
          const batch = await db.binanceTradeCountFast.findMany({
            where: {
              corretora,
              symbol,
              interval: SOURCE_INTERVAL,
              [flag]: false,
            } as Prisma.BinanceTradeCountFastWhereInput,
            orderBy: { openTime: "asc" },
            take: 300,
          });
          if (batch.length < gs) break;
          const nComplete = Math.floor(batch.length / gs) * gs;
          const slice = batch.slice(0, nComplete);
          const src = slice.map((r) => toSourceRow(r));
          const dataRows: Prisma.BinanceKlineCache2CreateManyInput[] = [];
          for (let i = 0; i < nComplete; i += gs) {
            const chunk = src.slice(i, i + gs);
            const agg = aggregateFastBarsFromFixedGroupSize(
              chunk,
              gs,
              intervalLabel,
              TRADE_CACHE_CHART_KIND
            );
            dataRows.push(...aggToCache2Rows(agg));
          }
          const n = await createManyKlineCache2Chunks(db, dataRows, {
            skipDuplicates: true,
          });
          tierIns += n;
          await db.binanceTradeCountFast.updateMany({
            where: {
              corretora,
              symbol,
              interval: SOURCE_INTERVAL,
              openTime: { in: slice.map((b) => b.openTime) },
            },
            data: { [flag]: true } as Prisma.BinanceTradeCountFastUpdateManyMutationInput,
          });
        }
      }
      intervals[intervalLabel] = tierIns;
    }
  }

  const purgeDeleted: Record<string, number> = {};
  for (const tradeTotal of TRADE_CACHE_TRADE_INTERVALS) {
    const intervalLabel = `${tradeTotal}trades`;
    const deleted = await purgeBinanceKlineCache2SeriesToMax(db, {
      symbol,
      chartKind: TRADE_CACHE_CHART_KIND,
      interval: intervalLabel,
      maxRows: RENKO_CACHE2_MAX_ROWS,
    });
    if (deleted > 0) purgeDeleted[intervalLabel] = deleted;
  }

  return {
    symbol,
    intervals,
    purgeDeleted,
    purgeMaxRows: RENKO_CACHE2_MAX_ROWS,
  };
}
