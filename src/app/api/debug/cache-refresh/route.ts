/**
 * Dispara o refresh do BinanceKlineCache (1m–1d).
 * - target=dev: banco URL_DEV (ou DATABASE_URL se URL_DEV não definido).
 * - target=prod: banco URL_PROD. Só em dev.
 * GET /api/debug/cache-refresh?target=dev|prod
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma, getCryptoPrismaDev, getCryptoPrismaProd } from "@/lib/crypto-db";
import { Prisma } from "@/lib/prisma-bio-client";
import type { PrismaClient } from "@/lib/prisma-bio-client";
import { getKlineSymbolsFromDb, getKlineSymbolsWithPeriods } from "@/app/lib/kline-symbols";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const CORRETORA = "binance";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const CACHE_INTERVALS_FROM_1M = [
  { param: "1m", minutes: 1 },
  { param: "2m", minutes: 2 },
  { param: "3m", minutes: 3 },
  { param: "4m", minutes: 4 },
];
const CACHE_INTERVALS_FROM_5M = [
  { param: "5m", minutes: 5 },
  { param: "15m", minutes: 15 },
  { param: "30m", minutes: 30 },
  { param: "45m", minutes: 45 },
];
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
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
}

/** Mesma lógica do cron/cache-refresh. Usado só para target=prod. */
async function runCacheRefreshOnDb(db: PrismaClient) {
  const cutoffMs = BigInt(getStartOfTodayUtcMs());
  await db.$executeRaw(Prisma.sql`TRUNCATE TABLE backcrypto."BinanceKlineCache"`);
  const SYMBOLS = await getKlineSymbolsFromDb(db);
  const details: { symbol: string; interval: string; rows: number }[] = [];

  for (const symbol of SYMBOLS) {
    for (const interval of CACHE_INTERVALS_FROM_1M) {
      const bucketMs = BigInt(interval.minutes * 60 * 1000);
      const intervalLabel = interval.param;
      const rows = await db.$executeRaw(Prisma.sql`
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
          WHERE corretora = ${CORRETORA} AND symbol = ${symbol} AND "interval" = '1m' AND "openTime" < ${cutoffMs}
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
    for (const interval of CACHE_INTERVALS_FROM_5M) {
      const bucketMs = BigInt(interval.minutes * 60 * 1000);
      const intervalLabel = interval.param;
      const rows = await db.$executeRaw(Prisma.sql`
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
          FROM backcrypto."BinanceKlineMonth"
          WHERE corretora = ${CORRETORA} AND symbol = ${symbol} AND "interval" = '5m' AND "openTime" < ${cutoffMs}
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
    for (const interval of CACHE_INTERVALS_FROM_1H) {
      const bucketMs = BigInt(interval.minutes * 60 * 1000);
      const intervalLabel = interval.param;
      const rows = await db.$executeRaw(Prisma.sql`
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
          WHERE corretora = ${CORRETORA} AND symbol = ${symbol} AND "interval" = '1h' AND "openTime" < ${cutoffMs}
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
  const symbolsWithPeriods = await getKlineSymbolsWithPeriods(db);
  const now = Date.now();
  let purgedFast = 0;
  let purged5m = 0;
  let purged1h = 0;
  for (const s of symbolsWithPeriods) {
    const cutoffFast = BigInt(now - s.requiredDays1m * ONE_DAY_MS);
    const cutoff5m = BigInt(now - s.requiredDays5m * ONE_DAY_MS);
    const cutoff1h = BigInt(now - s.requiredDays1h * ONE_DAY_MS);
    purgedFast += (
      await db.binanceKlineFast.deleteMany({
        where: { corretora: CORRETORA, symbol: s.symbol, interval: "1m", openTime: { lt: cutoffFast } },
      })
    ).count;
    purged5m += (
      await db.binanceKlineMonth.deleteMany({
        where: { corretora: CORRETORA, symbol: s.symbol, interval: "5m", openTime: { lt: cutoff5m } },
      })
    ).count;
    purged1h += (
      await db.binanceKline.deleteMany({
        where: { corretora: CORRETORA, symbol: s.symbol, interval: "1h", openTime: { lt: cutoff1h } },
      })
    ).count;
  }
  return { ok: true, totalRows, details, purgedFast, purged5m, purged1h };
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  let userId: string;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    userId = typeof payload?.sub === "string" ? payload.sub : "";
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const user = await cryptoPrisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const target = request.nextUrl.searchParams.get("target") === "prod" ? "prod" : "dev";

  if (target === "prod" && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "target=prod only in development" }, { status: 400 });
  }
  try {
    const db = target === "prod" ? getCryptoPrismaProd() : getCryptoPrismaDev();
    const data = await runCacheRefreshOnDb(db);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[api/debug/cache-refresh]", target, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cache refresh failed" },
      { status: 500 }
    );
  }
}
