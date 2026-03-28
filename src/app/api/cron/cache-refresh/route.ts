/**
 * Cron diário: recria BinanceKlineCache e faz expurgo.
 * - De 1m (BinanceKlineFast): 1m, 2m, 3m, 4m
 * - De 5m (BinanceKlineMonth): 5m, 15m, 30m, 45m
 * - De 1h (BinanceKline): 1h, 2h, 3h, 4h, 6h, 8h, 12h, 1d
 * Path: /crypto/api/cron/cache-refresh
 * Schedule: 0 0 * * * (1x ao dia). Ao final: expurgo por símbolo (KlineSymbol.requiredDays1m/5m/1h).
 * Protegido por CRON_SECRET.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Prisma } from "@/lib/prisma-bio-client";
import { getKlineSymbolsFromDb, getKlineSymbolsWithPeriods } from "@/app/lib/kline-symbols";
const CORRETORA = "binance";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
/** Cache a partir de BinanceKlineFast (1m): 1m, 2m, 3m, 4m */
const CACHE_INTERVALS_FROM_1M = [
  { param: "1m", minutes: 1 },
  { param: "2m", minutes: 2 },
  { param: "3m", minutes: 3 },
  { param: "4m", minutes: 4 },
];
/** Cache a partir de BinanceKlineMonth (5m): 5m, 15m, 30m, 45m */
const CACHE_INTERVALS_FROM_5M = [
  { param: "5m", minutes: 5 },
  { param: "15m", minutes: 15 },
  { param: "30m", minutes: 30 },
  { param: "45m", minutes: 45 },
];
/** Cache a partir de BinanceKline (1h): 1h até 1d */
const CACHE_INTERVALS_FROM_1H = [
  { param: "1h", minutes: 60 },
  { param: "2h", minutes: 120 },
  { param: "3h", minutes: 180 },
  { param: "4h", minutes: 240 },
  { param: "6h", minutes: 360 },
  { param: "8h", minutes: 480 },
  { param: "12h", minutes: 720 },
  { param: "1d", minutes: 1440 },
];

function getStartOfTodayUtcMs(): number {
  const now = new Date();
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0
  );
}

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const auth = request.headers.get("authorization");
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cutoffMs = BigInt(getStartOfTodayUtcMs());

    await cryptoPrisma.$executeRaw(Prisma.sql`TRUNCATE TABLE backcrypto."BinanceKlineCache"`);

    const SYMBOLS = await getKlineSymbolsFromDb(cryptoPrisma);
    const details: { symbol: string; interval: string; rows: number }[] = [];

    for (const symbol of SYMBOLS) {
      for (const interval of CACHE_INTERVALS_FROM_1M) {
        const bucketMs = BigInt(interval.minutes * 60 * 1000);
        const intervalLabel = interval.param;
        const rows = await cryptoPrisma.$executeRaw(Prisma.sql`
          INSERT INTO backcrypto."BinanceKlineCache" (
            "symbol", "interval", "chartKind", "openTime", "open", "high", "low", "close",
            "volume", "closeTime", "quoteAssetVolume", "numberOfTrades",
            "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
          )
          WITH k AS (
            SELECT
              (("openTime" / ${bucketMs}) * ${bucketMs}) AS bucket,
              "openTime",
              "open", "high", "low", "close", "volume", "closeTime",
              "quoteAssetVolume", "numberOfTrades",
              "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
            FROM backcrypto."BinanceKlineFast"
            WHERE corretora = ${CORRETORA} AND symbol = ${symbol} AND "interval" = '1m' AND "openTime" < ${cutoffMs}
          )
          SELECT
            ${symbol},
            ${intervalLabel},
            'interval'::text,
            k.bucket,
            (array_agg(k."open" ORDER BY k."openTime"))[1],
            max(k."high"),
            min(k."low"),
            (array_agg(k."close" ORDER BY k."openTime" DESC))[1],
            sum(k."volume"),
            max(k."closeTime"),
            sum(k."quoteAssetVolume"),
            sum(k."numberOfTrades")::int,
            sum(k."takerBuyBaseAssetVolume"),
            sum(k."takerBuyQuoteAssetVolume")
          FROM k
          GROUP BY k.bucket
        `);
        details.push({ symbol, interval: intervalLabel, rows });
      }
      for (const interval of CACHE_INTERVALS_FROM_5M) {
        const bucketMs = BigInt(interval.minutes * 60 * 1000);
        const intervalLabel = interval.param;
        const rows = await cryptoPrisma.$executeRaw(Prisma.sql`
          INSERT INTO backcrypto."BinanceKlineCache" (
            "symbol", "interval", "chartKind", "openTime", "open", "high", "low", "close",
            "volume", "closeTime", "quoteAssetVolume", "numberOfTrades",
            "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
          )
          WITH k AS (
            SELECT
              (("openTime" / ${bucketMs}) * ${bucketMs}) AS bucket,
              "openTime",
              "open", "high", "low", "close", "volume", "closeTime",
              "quoteAssetVolume", "numberOfTrades",
              "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
            FROM backcrypto."BinanceKlineMonth"
            WHERE corretora = ${CORRETORA} AND symbol = ${symbol} AND "interval" = '5m' AND "openTime" < ${cutoffMs}
          )
          SELECT
            ${symbol},
            ${intervalLabel},
            'interval'::text,
            k.bucket,
            (array_agg(k."open" ORDER BY k."openTime"))[1],
            max(k."high"),
            min(k."low"),
            (array_agg(k."close" ORDER BY k."openTime" DESC))[1],
            sum(k."volume"),
            max(k."closeTime"),
            sum(k."quoteAssetVolume"),
            sum(k."numberOfTrades")::int,
            sum(k."takerBuyBaseAssetVolume"),
            sum(k."takerBuyQuoteAssetVolume")
          FROM k
          GROUP BY k.bucket
        `);
        details.push({ symbol, interval: intervalLabel, rows });
      }
      for (const interval of CACHE_INTERVALS_FROM_1H) {
        const bucketMs = BigInt(interval.minutes * 60 * 1000);
        const intervalLabel = interval.param;
        const rows = await cryptoPrisma.$executeRaw(Prisma.sql`
          INSERT INTO backcrypto."BinanceKlineCache" (
            "symbol", "interval", "chartKind", "openTime", "open", "high", "low", "close",
            "volume", "closeTime", "quoteAssetVolume", "numberOfTrades",
            "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
          )
          WITH k AS (
            SELECT
              (("openTime" / ${bucketMs}) * ${bucketMs}) AS bucket,
              "openTime",
              "open", "high", "low", "close", "volume", "closeTime",
              "quoteAssetVolume", "numberOfTrades",
              "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
            FROM backcrypto."BinanceKline"
            WHERE corretora = ${CORRETORA} AND symbol = ${symbol} AND "interval" = '1h' AND "openTime" < ${cutoffMs}
          )
          SELECT
            ${symbol},
            ${intervalLabel},
            'interval'::text,
            k.bucket,
            (array_agg(k."open" ORDER BY k."openTime"))[1],
            max(k."high"),
            min(k."low"),
            (array_agg(k."close" ORDER BY k."openTime" DESC))[1],
            sum(k."volume"),
            max(k."closeTime"),
            sum(k."quoteAssetVolume"),
            sum(k."numberOfTrades")::int,
            sum(k."takerBuyBaseAssetVolume"),
            sum(k."takerBuyQuoteAssetVolume")
          FROM k
          GROUP BY k.bucket
        `);
        details.push({ symbol, interval: intervalLabel, rows });
      }
    }

    const totalRows = details.reduce((s, d) => s + d.rows, 0);

    // Expurgo (1x ao dia): cutoff por símbolo (KlineSymbol.requiredDays1m/5m/1h)
    const symbolsWithPeriods = await getKlineSymbolsWithPeriods(cryptoPrisma);
    const now = Date.now();
    let purgedFast = 0;
    let purged5m = 0;
    let purged1h = 0;
    for (const s of symbolsWithPeriods) {
      const cutoffFast = BigInt(now - s.requiredDays1m * ONE_DAY_MS);
      const cutoff5m = BigInt(now - s.requiredDays5m * ONE_DAY_MS);
      const cutoff1h = BigInt(now - s.requiredDays1h * ONE_DAY_MS);
      purgedFast += (
        await cryptoPrisma.binanceKlineFast.deleteMany({
          where: { corretora: CORRETORA, symbol: s.symbol, interval: "1m", openTime: { lt: cutoffFast } },
        })
      ).count;
      purged5m += (
        await cryptoPrisma.binanceKlineMonth.deleteMany({
          where: { corretora: CORRETORA, symbol: s.symbol, interval: "5m", openTime: { lt: cutoff5m } },
        })
      ).count;
      purged1h += (
        await cryptoPrisma.binanceKline.deleteMany({
          where: { corretora: CORRETORA, symbol: s.symbol, interval: "1h", openTime: { lt: cutoff1h } },
        })
      ).count;
    }

    return NextResponse.json({
      ok: true,
      totalRows,
      details,
      purgedFast,
      purged5m,
      purged1h,
    });
  } catch (e) {
    console.error("[api/cron/cache-refresh]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cache refresh failed" },
      { status: 500 }
    );
  }
}
