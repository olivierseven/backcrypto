import type { PrismaClient } from "@/lib/prisma-bio-client";
import type { Prisma } from "@/lib/prisma-bio-client";
import {
  aggregateFastBarsFrom5TickBricksToTier,
  aggregateFastBarsFromFixedGroupSize,
  createManyKlineCache2Chunks,
  groupSizeForTickInterval,
  purgeBinanceKlineCache2SeriesToMax,
  RENKO_CACHE2_MAX_ROWS,
  RENKO_CACHE_TICK_INTERVALS,
  type FastBarSourceRow,
  type RenkoCacheTickInterval,
} from "@/app/lib/renkoKlineCache2Build";
import type { FastChartKind } from "@/app/lib/fastChartKind";

const SOURCE_INTERVAL = "5ticks";

/** Colunas em tabelas *Fast* a 5ticks (Renko 1×, Renko2×, Range, Kagi). */
export const RENKO_K2_FLAG_BY_TICKS: Record<RenkoCacheTickInterval, string> = {
  5: "k2Incl5ticks",
  15: "k2Incl15ticks",
  25: "k2Incl25ticks",
  50: "k2Incl50ticks",
  100: "k2Incl100ticks",
  150: "k2Incl150ticks",
  200: "k2Incl200ticks",
};

const RESET_ALL_K2_FLAGS = {
  k2Incl5ticks: false,
  k2Incl15ticks: false,
  k2Incl25ticks: false,
  k2Incl50ticks: false,
  k2Incl100ticks: false,
  k2Incl150ticks: false,
  k2Incl200ticks: false,
} as Prisma.BinanceRenkoFastUpdateManyMutationInput;

function getTickFastDelegate(
  db: PrismaClient,
  chartKind: FastChartKind
):
  | typeof db.binanceRenkoFast
  | typeof db.binanceRenko2xFast
  | typeof db.binanceRangeFast
  | typeof db.binanceKagiFast {
  switch (chartKind) {
    case "renko":
      return db.binanceRenkoFast;
    case "renko2x":
      return db.binanceRenko2xFast;
    case "range":
      return db.binanceRangeFast;
    case "kagi":
      return db.binanceKagiFast;
    default: {
      const _e: never = chartKind;
      return _e;
    }
  }
}

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

const RENKO_CACHE_INTERVAL_LABELS = RENKO_CACHE_TICK_INTERVALS.map(
  (t) => `${t}ticks`
);

/**
 * Renko 1× / Renko2× / Range / Kagi: progresso por linha na origem (`k2Incl*ticks`).
 */
export async function processTickChartKlineCacheWithSourceFlags(
  db: PrismaClient,
  opts: {
    chartKind: FastChartKind;
    corretora: string;
    symbol: string;
    incremental5ticks: boolean;
    incrementalAggregates: boolean;
  }
): Promise<{
  symbol: string;
  intervals: Record<string, number>;
  purgeDeleted: Record<string, number>;
  purgeMaxRows: number;
}> {
  const {
    chartKind,
    corretora,
    symbol,
    incremental5ticks,
    incrementalAggregates,
  } = opts;

  const delegate = getTickFastDelegate(db, chartKind);
  /** Mesmas colunas k2 nas quatro tabelas *Fast* a 5ticks. */
  const tickDel = delegate as typeof db.binanceRenkoFast;
  const mustFullRebuild = !incremental5ticks || !incrementalAggregates;

  if (mustFullRebuild) {
    await db.binanceKlineCache2.deleteMany({
      where: {
        symbol,
        chartKind,
        interval: { in: RENKO_CACHE_INTERVAL_LABELS },
      },
    });
    await tickDel.updateMany({
      where: { corretora, symbol, interval: SOURCE_INTERVAL },
      data: RESET_ALL_K2_FLAGS,
    });
  }

  const intervals: Record<string, number> = {};

  const allRows = await tickDel.findMany({
    where: { corretora, symbol, interval: SOURCE_INTERVAL },
    orderBy: { openTime: "asc" },
  });
  const allSrc = allRows.map((r) => toSourceRow(r));

  if (mustFullRebuild) {
    for (const ticks of RENKO_CACHE_TICK_INTERVALS) {
      const intervalLabel = `${ticks}ticks`;
      const gs = groupSizeForTickInterval(ticks);
      const agg = aggregateFastBarsFrom5TickBricksToTier(
        allSrc,
        ticks as RenkoCacheTickInterval,
        chartKind
      );
      const data = aggToCache2Rows(agg);
      const n = await createManyKlineCache2Chunks(db, data);
      intervals[intervalLabel] = n;
      const nMark = Math.floor(allRows.length / gs) * gs;
      if (nMark > 0) {
        const ots = allRows.slice(0, nMark).map((r) => r.openTime);
        const flag = RENKO_K2_FLAG_BY_TICKS[ticks];
        await tickDel.updateMany({
          where: {
            corretora,
            symbol,
            interval: SOURCE_INTERVAL,
            openTime: { in: ots },
          },
          data: { [flag]: true } as Prisma.BinanceRenkoFastUpdateManyMutationInput,
        });
      }
    }
  } else {
    for (const ticks of RENKO_CACHE_TICK_INTERVALS) {
      const intervalLabel = `${ticks}ticks`;
      const gs = groupSizeForTickInterval(ticks);
      const flag = RENKO_K2_FLAG_BY_TICKS[ticks];
      let tierIns = 0;

      if (gs === 1) {
        while (true) {
          const batch = await tickDel.findMany({
            where: {
              corretora,
              symbol,
              interval: SOURCE_INTERVAL,
              [flag]: false,
            } as Prisma.BinanceRenkoFastWhereInput,
            orderBy: { openTime: "asc" },
            take: 500,
          });
          if (batch.length === 0) break;
          const src = batch.map((r) => toSourceRow(r));
          const agg = aggregateFastBarsFromFixedGroupSize(
            src,
            1,
            intervalLabel,
            chartKind
          );
          const data = aggToCache2Rows(agg);
          const n = await createManyKlineCache2Chunks(db, data, {
            skipDuplicates: true,
          });
          tierIns += n;
          await tickDel.updateMany({
            where: {
              corretora,
              symbol,
              interval: SOURCE_INTERVAL,
              openTime: { in: batch.map((b) => b.openTime) },
            },
            data: { [flag]: true } as Prisma.BinanceRenkoFastUpdateManyMutationInput,
          });
        }
      } else {
        while (true) {
          const batch = await tickDel.findMany({
            where: {
              corretora,
              symbol,
              interval: SOURCE_INTERVAL,
              [flag]: false,
            } as Prisma.BinanceRenkoFastWhereInput,
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
            const agg = aggregateFastBarsFrom5TickBricksToTier(
              chunk,
              ticks as RenkoCacheTickInterval,
              chartKind
            );
            dataRows.push(...aggToCache2Rows(agg));
          }
          const n = await createManyKlineCache2Chunks(db, dataRows, {
            skipDuplicates: true,
          });
          tierIns += n;
          await tickDel.updateMany({
            where: {
              corretora,
              symbol,
              interval: SOURCE_INTERVAL,
              openTime: { in: slice.map((b) => b.openTime) },
            },
            data: { [flag]: true } as Prisma.BinanceRenkoFastUpdateManyMutationInput,
          });
        }
      }
      intervals[intervalLabel] = tierIns;
    }
  }

  const purgeDeleted: Record<string, number> = {};
  for (const ticks of RENKO_CACHE_TICK_INTERVALS) {
    const intervalLabel = `${ticks}ticks`;
    const deleted = await purgeBinanceKlineCache2SeriesToMax(db, {
      symbol,
      chartKind,
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
