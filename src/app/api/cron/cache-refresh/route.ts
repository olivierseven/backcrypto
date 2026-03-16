/**
 * Cron diário: recria BinanceKlineCache (agregados 3m–1D a partir de 1m e 1h).
 * Path: /crypto/api/cron/cache-refresh
 * Schedule sugerido: 0 6 * * * (6h UTC).
 * Protegido por CRON_SECRET.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Prisma } from "@/lib/prisma-bio-client";

const SYMBOLS = ["BTCUSDT", "ETHUSDT"];
const CACHE_INTERVALS_FAST = [
  { param: "3m", minutes: 3 },
  { param: "5m", minutes: 5 },
  { param: "15m", minutes: 15 },
  { param: "30m", minutes: 30 },
  { param: "45m", minutes: 45 },
];
const CACHE_INTERVALS_NORMAL = [
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

    const details: { symbol: string; interval: string; rows: number }[] = [];

    for (const symbol of SYMBOLS) {
      for (const interval of CACHE_INTERVALS_FAST) {
        const bucketMs = BigInt(interval.minutes * 60 * 1000);
        const intervalLabel = interval.param;
        const rows = await cryptoPrisma.$executeRaw(Prisma.sql`
          INSERT INTO backcrypto."BinanceKlineCache" (
            "symbol", "interval", "openTime", "open", "high", "low", "close",
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
            WHERE symbol = ${symbol} AND "interval" = '1m' AND "openTime" < ${cutoffMs}
          )
          SELECT
            ${symbol},
            ${intervalLabel},
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
      for (const interval of CACHE_INTERVALS_NORMAL) {
        const bucketMs = BigInt(interval.minutes * 60 * 1000);
        const intervalLabel = interval.param;
        const rows = await cryptoPrisma.$executeRaw(Prisma.sql`
          INSERT INTO backcrypto."BinanceKlineCache" (
            "symbol", "interval", "openTime", "open", "high", "low", "close",
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
            WHERE symbol = ${symbol} AND "interval" = '1h' AND "openTime" < ${cutoffMs}
          )
          SELECT
            ${symbol},
            ${intervalLabel},
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
    return NextResponse.json({ ok: true, totalRows, details });
  } catch (e) {
    console.error("[api/cron/cache-refresh]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cache refresh failed" },
      { status: 500 }
    );
  }
}
