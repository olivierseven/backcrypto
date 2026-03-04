/**
 * Klines a partir de backcrypto.BinanceKlineFast (1m), backcrypto.BinanceKline (1h) e backcrypto.BinanceKlineCache.
 * Cache < 1h: de BinanceKlineFast; cache >= 1h: de BinanceKline.
 * Agregação do dia atual (UTC) em todos os intervalos: sempre a partir de BinanceKlineFast (1m).
 * GET /api/binance/klines?symbol=BTCUSDT&interval=5m&limit=1000
 * Resposta: array no formato Binance [openTime, open, high, low, close, volume, closeTime, ...]
 */
import { NextRequest, NextResponse } from "next/server";
import { bioPrisma } from "@/lib/bio-db";
import { Prisma } from "@/lib/prisma-bio-client";

const INTERVAL_TO_MINUTES: Record<string, number> = {
  "1m": 1,
  "3m": 3,
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "45m": 45,
  "1h": 60,
  "2h": 120,
  "3h": 180,
  "4h": 240,
  "6h": 360,
  "8h": 480,
  "12h": 720,
  "1d": 1440,
  "3d": 4320,
  "1w": 10080,
  "1M": 43200, // 30 days
};

/** Intervalos que existem na BinanceKlineCache (até 1D). Sem 1m. */
const CACHE_INTERVALS = new Set<string>([
  "3m", "5m", "15m", "30m", "45m", "1h", "2h", "3h", "4h", "6h", "8h", "12h", "1d",
]);

function parseIntervalMinutes(interval: string | null, groupMinutes: number | null): number {
  if (interval != null) {
    // 1M (month) antes do toLowerCase para não virar 1m (minute)
    if (interval === "1M" || interval === "1mo") return INTERVAL_TO_MINUTES["1M"];
    const fromInterval = INTERVAL_TO_MINUTES[interval.toLowerCase()];
    if (fromInterval != null) return fromInterval;
  }
  const fromGroup = groupMinutes != null && Number.isFinite(groupMinutes) ? groupMinutes : 1;
  return INTERVAL_TO_MINUTES[String(fromGroup) + "m"] ?? (fromGroup <= 0 ? 1 : Math.min(43200, fromGroup));
}

/** Início do dia atual UTC em ms. Cache contém apenas openTime < este valor. */
function startOfTodayUtcMs(): number {
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

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Intervalos acima de 1d: usam cache 1d + dia atual agregado em 1d, depois reagrupam (3d, 1w, 1M). */
const ABOVE_1D_MINUTES = new Set<number>([4320, 10080, 43200]); // 3d, 1w, 1M

/** Para 3d/1w/1M: expressão SQL que calcula o bucket (openTime do candle agrupado). 1M = primeiro dia do mês UTC; 1w = segunda 00:00 UTC; 3d = múltiplo de 3 dias desde epoch. */
function above1dBucketExpr(groupMinutes: number, bucketMs: number) {
  if (groupMinutes === 43200) {
    return Prisma.sql`(EXTRACT(EPOCH FROM date_trunc('month', to_timestamp("openTime"/1000.0) AT TIME ZONE 'UTC'))::bigint * 1000)`;
  }
  if (groupMinutes === 10080) {
    return Prisma.sql`(EXTRACT(EPOCH FROM date_trunc('week', to_timestamp("openTime"/1000.0) AT TIME ZONE 'UTC'))::bigint * 1000)`;
  }
  return Prisma.sql`(("openTime"::bigint / ${bucketMs}) * ${bucketMs})`;
}

function toStr(v: unknown): string {
  if (v == null) return "0";
  if (typeof v === "object" && "toString" in v) return (v as { toString: () => string }).toString();
  return String(v);
}

function rowToKline(r: Record<string, unknown>) {
  return [
    Number(r.openTime),
    toStr(r.open),
    toStr(r.high),
    toStr(r.low),
    toStr(r.close),
    toStr(r.volume),
    Number(r.closeTime),
    toStr(r.quoteAssetVolume),
    Number(r.numberOfTrades ?? 0),
    toStr(r.takerBuyBaseAssetVolume),
    toStr(r.takerBuyQuoteAssetVolume),
    0,
  ];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol") ?? "BTCUSDT";
  const limit = Math.min(Number(searchParams.get("limit")) || 1000, 5000);
  const groupMinutes = parseIntervalMinutes(
    searchParams.get("interval"),
    searchParams.get("groupMinutes") ? Number(searchParams.get("groupMinutes")) : null
  );
  const bucketMs = groupMinutes * 60 * 1000;

  const intervalParam = (searchParams.get("interval") ?? "").toLowerCase();
  const useCache =
    groupMinutes !== 1 &&
    CACHE_INTERVALS.has(intervalParam);

  try {
    if (groupMinutes === 1) {
      const rows = await bioPrisma.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`
          SELECT "openTime", "open", "high", "low", "close", "volume",
                 "closeTime", "quoteAssetVolume", "numberOfTrades",
                 "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
          FROM backcrypto."BinanceKlineFast"
          WHERE symbol = ${symbol} AND "interval" = '1m'
          ORDER BY "openTime" DESC
          LIMIT ${limit}
        `
      );
      const list = Array.isArray(rows) ? rows : [];
      const data = list.map(rowToKline);
      return NextResponse.json(data);
    }

    if (useCache) {
      const startOfToday = startOfTodayUtcMs();

      // Agregação só do dia atual (UTC) a partir de BinanceKlineFast (1m)
      const todayRows = await bioPrisma.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`
          WITH k AS (
            SELECT
              (("openTime" / ${bucketMs}) * ${bucketMs}) AS bucket,
              "openTime",
              "open", "high", "low", "close", "volume", "closeTime",
              "quoteAssetVolume", "numberOfTrades",
              "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
            FROM backcrypto."BinanceKlineFast"
            WHERE symbol = ${symbol} AND "interval" = '1m' AND "openTime" >= ${startOfToday}
          )
          SELECT
            k.bucket::bigint AS "openTime",
            (array_agg(k."open" ORDER BY k."openTime"))[1] AS "open",
            max(k."high") AS "high",
            min(k."low") AS "low",
            (array_agg(k."close" ORDER BY k."openTime" DESC))[1] AS "close",
            sum(k."volume") AS "volume",
            max(k."closeTime") AS "closeTime",
            sum(k."quoteAssetVolume") AS "quoteAssetVolume",
            sum(k."numberOfTrades")::int AS "numberOfTrades",
            sum(k."takerBuyBaseAssetVolume") AS "takerBuyBaseAssetVolume",
            sum(k."takerBuyQuoteAssetVolume") AS "takerBuyQuoteAssetVolume"
          FROM k
          GROUP BY k.bucket
          ORDER BY k.bucket DESC
        `
      );
      const todayList = Array.isArray(todayRows) ? todayRows : [];
      const cacheLimit = Math.max(0, limit - todayList.length);

      let cacheList: Record<string, unknown>[] = [];
      if (cacheLimit > 0) {
        const isGe1h = groupMinutes >= 60;
        const hasCacheForInterval = await bioPrisma
          .$queryRaw<[{ exists: boolean }]>(
            Prisma.sql`
              SELECT EXISTS (
                SELECT 1 FROM backcrypto."BinanceKlineCache"
                WHERE symbol = ${symbol} AND "interval" = ${intervalParam} LIMIT 1
              ) AS "exists"
            `
          )
          .then((r) => Array.isArray(r) && r[0]?.exists === true);

        if (hasCacheForInterval) {
          const cacheRows = await bioPrisma.$queryRaw<Record<string, unknown>[]>(
            Prisma.sql`
              SELECT "openTime", "open", "high", "low", "close", "volume",
                     "closeTime", "quoteAssetVolume", "numberOfTrades",
                     "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
              FROM backcrypto."BinanceKlineCache"
              WHERE symbol = ${symbol} AND "interval" = ${intervalParam}
              ORDER BY "openTime" DESC
              LIMIT ${cacheLimit}
            `
          );
          cacheList = Array.isArray(cacheRows) ? cacheRows : [];
        } else if (isGe1h) {
          // Sem cache para >= 1h: histórico a partir de BinanceKline (1h) agregado ao bucket
          const historyRows = await bioPrisma.$queryRaw<Record<string, unknown>[]>(
            Prisma.sql`
              WITH k AS (
                SELECT
                  (("openTime" / ${bucketMs}) * ${bucketMs}) AS bucket,
                  "openTime",
                  "open", "high", "low", "close", "volume", "closeTime",
                  "quoteAssetVolume", "numberOfTrades",
                  "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
                FROM backcrypto."BinanceKline"
                WHERE symbol = ${symbol} AND "interval" = '1h' AND "openTime" < ${startOfToday}
              )
              SELECT
                k.bucket::bigint AS "openTime",
                (array_agg(k."open" ORDER BY k."openTime"))[1] AS "open",
                max(k."high") AS "high",
                min(k."low") AS "low",
                (array_agg(k."close" ORDER BY k."openTime" DESC))[1] AS "close",
                sum(k."volume") AS "volume",
                max(k."closeTime") AS "closeTime",
                sum(k."quoteAssetVolume") AS "quoteAssetVolume",
                sum(k."numberOfTrades")::int AS "numberOfTrades",
                sum(k."takerBuyBaseAssetVolume") AS "takerBuyBaseAssetVolume",
                sum(k."takerBuyQuoteAssetVolume") AS "takerBuyQuoteAssetVolume"
              FROM k
              GROUP BY k.bucket
              ORDER BY k.bucket DESC
              LIMIT ${cacheLimit}
            `
          );
          cacheList = Array.isArray(historyRows) ? historyRows : [];
        } else {
          // Sem cache para < 1h: histórico a partir de BinanceKlineFast (1m) agregado ao bucket
          const historyRows = await bioPrisma.$queryRaw<Record<string, unknown>[]>(
            Prisma.sql`
              WITH k AS (
                SELECT
                  (("openTime" / ${bucketMs}) * ${bucketMs}) AS bucket,
                  "openTime",
                  "open", "high", "low", "close", "volume", "closeTime",
                  "quoteAssetVolume", "numberOfTrades",
                  "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
                FROM backcrypto."BinanceKlineFast"
                WHERE symbol = ${symbol} AND "interval" = '1m' AND "openTime" < ${startOfToday}
              )
              SELECT
                k.bucket::bigint AS "openTime",
                (array_agg(k."open" ORDER BY k."openTime"))[1] AS "open",
                max(k."high") AS "high",
                min(k."low") AS "low",
                (array_agg(k."close" ORDER BY k."openTime" DESC))[1] AS "close",
                sum(k."volume") AS "volume",
                max(k."closeTime") AS "closeTime",
                sum(k."quoteAssetVolume") AS "quoteAssetVolume",
                sum(k."numberOfTrades")::int AS "numberOfTrades",
                sum(k."takerBuyBaseAssetVolume") AS "takerBuyBaseAssetVolume",
                sum(k."takerBuyQuoteAssetVolume") AS "takerBuyQuoteAssetVolume"
              FROM k
              GROUP BY k.bucket
              ORDER BY k.bucket DESC
              LIMIT ${cacheLimit}
            `
          );
          cacheList = Array.isArray(historyRows) ? historyRows : [];
        }
      }

      const combined = [...todayList, ...cacheList].slice(0, limit);
      const data = combined.map(rowToKline);
      return NextResponse.json(data);
    }

    // Intervalos acima de 1d (3d, 1w, 1M): cache 1d + dia atual em 1d, depois reagrupa. Sem cache: 1d a partir de BinanceKline (1h).
    if (ABOVE_1D_MINUTES.has(groupMinutes)) {
      const bucketExpr = above1dBucketExpr(groupMinutes, bucketMs);
      const startOfToday = startOfTodayUtcMs();
      const hasCache1d = await bioPrisma
        .$queryRaw<[{ exists: boolean }]>(
          Prisma.sql`
            SELECT EXISTS (
              SELECT 1 FROM backcrypto."BinanceKlineCache"
              WHERE symbol = ${symbol} AND "interval" = '1d' LIMIT 1
            ) AS "exists"
          `
        )
        .then((r) => Array.isArray(r) && r[0]?.exists === true);

      const rows = await bioPrisma.$queryRaw<Record<string, unknown>[]>(
        hasCache1d
          ? Prisma.sql`
          WITH k_today AS (
            SELECT
              (("openTime" / ${ONE_DAY_MS}) * ${ONE_DAY_MS}) AS bucket,
              "openTime",
              "open", "high", "low", "close", "volume", "closeTime",
              "quoteAssetVolume", "numberOfTrades",
              "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
            FROM backcrypto."BinanceKlineFast"
            WHERE symbol = ${symbol} AND "interval" = '1m' AND "openTime" >= ${startOfToday}
          ),
          today_1d AS (
            SELECT
              k.bucket::bigint AS "openTime",
              (array_agg(k."open" ORDER BY k."openTime"))[1] AS "open",
              max(k."high") AS "high",
              min(k."low") AS "low",
              (array_agg(k."close" ORDER BY k."openTime" DESC))[1] AS "close",
              sum(k."volume") AS "volume",
              max(k."closeTime") AS "closeTime",
              sum(k."quoteAssetVolume") AS "quoteAssetVolume",
              sum(k."numberOfTrades")::int AS "numberOfTrades",
              sum(k."takerBuyBaseAssetVolume") AS "takerBuyBaseAssetVolume",
              sum(k."takerBuyQuoteAssetVolume") AS "takerBuyQuoteAssetVolume"
            FROM k_today k
            GROUP BY k.bucket
          ),
          cache_1d AS (
            SELECT "openTime", "open", "high", "low", "close", "volume",
                   "closeTime", "quoteAssetVolume", "numberOfTrades",
                   "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
            FROM backcrypto."BinanceKlineCache"
            WHERE symbol = ${symbol} AND "interval" = '1d'
            ORDER BY "openTime" DESC
            LIMIT 5000
          ),
          daily AS (
            (SELECT "openTime", "open", "high", "low", "close", "volume", "closeTime",
                    "quoteAssetVolume", "numberOfTrades", "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume" FROM today_1d)
            UNION ALL
            (SELECT "openTime", "open", "high", "low", "close", "volume", "closeTime",
                    "quoteAssetVolume", "numberOfTrades", "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume" FROM cache_1d)
          ),
          daily_with_bucket AS (
            SELECT
              ${bucketExpr} AS bucket,
              "openTime",
              "open", "high", "low", "close", "volume", "closeTime",
              "quoteAssetVolume", "numberOfTrades", "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
            FROM daily
          ),
          grouped AS (
            SELECT
              d.bucket AS "openTime",
              (array_agg(d."open" ORDER BY d."openTime"))[1] AS "open",
              max(d."high") AS "high",
              min(d."low") AS "low",
              (array_agg(d."close" ORDER BY d."openTime" DESC))[1] AS "close",
              sum(d."volume") AS "volume",
              max(d."closeTime") AS "closeTime",
              sum(d."quoteAssetVolume") AS "quoteAssetVolume",
              sum(d."numberOfTrades")::int AS "numberOfTrades",
              sum(d."takerBuyBaseAssetVolume") AS "takerBuyBaseAssetVolume",
              sum(d."takerBuyQuoteAssetVolume") AS "takerBuyQuoteAssetVolume"
            FROM daily_with_bucket d
            GROUP BY d.bucket
            ORDER BY d.bucket DESC
            LIMIT ${limit}
          )
          SELECT * FROM grouped
        `
          : Prisma.sql`
          WITH k_today AS (
            SELECT
              (("openTime" / ${ONE_DAY_MS}) * ${ONE_DAY_MS}) AS bucket,
              "openTime",
              "open", "high", "low", "close", "volume", "closeTime",
              "quoteAssetVolume", "numberOfTrades",
              "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
            FROM backcrypto."BinanceKlineFast"
            WHERE symbol = ${symbol} AND "interval" = '1m' AND "openTime" >= ${startOfToday}
          ),
          today_1d AS (
            SELECT
              k.bucket::bigint AS "openTime",
              (array_agg(k."open" ORDER BY k."openTime"))[1] AS "open",
              max(k."high") AS "high",
              min(k."low") AS "low",
              (array_agg(k."close" ORDER BY k."openTime" DESC))[1] AS "close",
              sum(k."volume") AS "volume",
              max(k."closeTime") AS "closeTime",
              sum(k."quoteAssetVolume") AS "quoteAssetVolume",
              sum(k."numberOfTrades")::int AS "numberOfTrades",
              sum(k."takerBuyBaseAssetVolume") AS "takerBuyBaseAssetVolume",
              sum(k."takerBuyQuoteAssetVolume") AS "takerBuyQuoteAssetVolume"
            FROM k_today k
            GROUP BY k.bucket
          ),
          history_1h AS (
            SELECT
              (("openTime" / ${ONE_DAY_MS}) * ${ONE_DAY_MS}) AS bucket,
              "openTime",
              "open", "high", "low", "close", "volume", "closeTime",
              "quoteAssetVolume", "numberOfTrades",
              "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
            FROM backcrypto."BinanceKline"
            WHERE symbol = ${symbol} AND "interval" = '1h' AND "openTime" < ${startOfToday}
          ),
          history_1d AS (
            SELECT
              h.bucket::bigint AS "openTime",
              (array_agg(h."open" ORDER BY h."openTime"))[1] AS "open",
              max(h."high") AS "high",
              min(h."low") AS "low",
              (array_agg(h."close" ORDER BY h."openTime" DESC))[1] AS "close",
              sum(h."volume") AS "volume",
              max(h."closeTime") AS "closeTime",
              sum(h."quoteAssetVolume") AS "quoteAssetVolume",
              sum(h."numberOfTrades")::int AS "numberOfTrades",
              sum(h."takerBuyBaseAssetVolume") AS "takerBuyBaseAssetVolume",
              sum(h."takerBuyQuoteAssetVolume") AS "takerBuyQuoteAssetVolume"
            FROM history_1h h
            GROUP BY h.bucket
            ORDER BY h.bucket DESC
            LIMIT 5000
          ),
          daily AS (
            (SELECT "openTime", "open", "high", "low", "close", "volume", "closeTime",
                    "quoteAssetVolume", "numberOfTrades", "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume" FROM today_1d)
            UNION ALL
            (SELECT "openTime", "open", "high", "low", "close", "volume", "closeTime",
                    "quoteAssetVolume", "numberOfTrades", "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume" FROM history_1d)
          ),
          daily_with_bucket AS (
            SELECT
              ${bucketExpr} AS bucket,
              "openTime",
              "open", "high", "low", "close", "volume", "closeTime",
              "quoteAssetVolume", "numberOfTrades", "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
            FROM daily
          ),
          grouped AS (
            SELECT
              d.bucket AS "openTime",
              (array_agg(d."open" ORDER BY d."openTime"))[1] AS "open",
              max(d."high") AS "high",
              min(d."low") AS "low",
              (array_agg(d."close" ORDER BY d."openTime" DESC))[1] AS "close",
              sum(d."volume") AS "volume",
              max(d."closeTime") AS "closeTime",
              sum(d."quoteAssetVolume") AS "quoteAssetVolume",
              sum(d."numberOfTrades")::int AS "numberOfTrades",
              sum(d."takerBuyBaseAssetVolume") AS "takerBuyBaseAssetVolume",
              sum(d."takerBuyQuoteAssetVolume") AS "takerBuyQuoteAssetVolume"
            FROM daily_with_bucket d
            GROUP BY d.bucket
            ORDER BY d.bucket DESC
            LIMIT ${limit}
          )
          SELECT * FROM grouped
        `
      );
      const list = Array.isArray(rows) ? rows : [];
      const data = list.map(rowToKline);
      return NextResponse.json(data);
    }

    // Fallback: agregação direta da BinanceKlineFast (1m)
    const rows = await bioPrisma.$queryRaw<Record<string, unknown>[]>(
      Prisma.sql`
        WITH k AS (
          SELECT
            (("openTime" / ${bucketMs}) * ${bucketMs}) AS bucket,
            "openTime",
            "open", "high", "low", "close", "volume", "closeTime",
            "quoteAssetVolume", "numberOfTrades",
            "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
          FROM backcrypto."BinanceKlineFast"
          WHERE symbol = ${symbol} AND "interval" = '1m'
        )
        SELECT
          k.bucket::bigint AS "openTime",
          (array_agg(k."open" ORDER BY k."openTime"))[1] AS "open",
          max(k."high") AS "high",
          min(k."low") AS "low",
          (array_agg(k."close" ORDER BY k."openTime" DESC))[1] AS "close",
          sum(k."volume") AS "volume",
          max(k."closeTime") AS "closeTime",
          sum(k."quoteAssetVolume") AS "quoteAssetVolume",
          sum(k."numberOfTrades")::int AS "numberOfTrades",
          sum(k."takerBuyBaseAssetVolume") AS "takerBuyBaseAssetVolume",
          sum(k."takerBuyQuoteAssetVolume") AS "takerBuyQuoteAssetVolume"
        FROM k
        GROUP BY k.bucket
        ORDER BY k.bucket DESC
        LIMIT ${limit}
      `
    );

    const list = Array.isArray(rows) ? rows : [];
    const data = list.map(rowToKline);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[api/binance/klines]", e);
    return NextResponse.json(
      { error: "Failed to fetch klines from database" },
      { status: 500 }
    );
  }
}
