/**
 * Trunca e recria a tabela backcrypto.BinanceKlineCache com dados agregados.
 * Intervalos até 45m (3m, 5m, 15m, 30m, 45m): agregados a partir de BinanceKlineFast (1m).
 * Intervalos 1h até 1D: agregados a partir de BinanceKline (1h).
 * Inclui apenas openTime < início do dia atual (UTC).
 *
 * Uso: node scripts/binance-kline-cache-refresh.js
 * Requer: DATABASE_URL no .env, migração da BinanceKlineCache aplicada, prisma generate.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const { PrismaClient, Prisma } = require("../src/lib/prisma-bio-client");

const SYMBOL = "BTCUSDT";

// Até 45m: BinanceKlineFast (1m); >= 1h: BinanceKline (1h)
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

/** Início do dia atual em UTC (ms). Cache só inclui openTime < este valor. */
function getStartOfTodayUtcMs() {
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

const prisma = new PrismaClient();

async function main() {
  const cutoffMs = BigInt(getStartOfTodayUtcMs());
  console.log(
    "[binance-kline-cache-refresh] Cutoff (openTime <):",
    cutoffMs.toString(),
    "UTC"
  );

  console.log("[binance-kline-cache-refresh] Truncating BinanceKlineCache...");
  await prisma.$executeRaw(Prisma.sql`TRUNCATE TABLE backcrypto."BinanceKlineCache"`);

  async function runInterval({ param, minutes }, fromFast) {
    const bucketMs = BigInt(minutes * 60 * 1000);
    const intervalLabel = param;
    if (fromFast) {
      return prisma.$executeRaw(Prisma.sql`
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
          WHERE symbol = ${SYMBOL} AND "interval" = '1m' AND "openTime" < ${cutoffMs}
        )
        SELECT
          ${SYMBOL},
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
    }
    return prisma.$executeRaw(Prisma.sql`
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
        WHERE symbol = ${SYMBOL} AND "interval" = '1h' AND "openTime" < ${cutoffMs}
      )
      SELECT
        ${SYMBOL},
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
  }

  for (const interval of CACHE_INTERVALS_FAST) {
    const result = await runInterval(interval, true);
    console.log(
      `[binance-kline-cache-refresh] ${interval.param} (Fast): inserted ${typeof result === "number" ? result : "?"} rows`
    );
  }
  for (const interval of CACHE_INTERVALS_NORMAL) {
    const result = await runInterval(interval, false);
    console.log(
      `[binance-kline-cache-refresh] ${interval.param}: inserted ${typeof result === "number" ? result : "?"} rows`
    );
  }

  console.log("[binance-kline-cache-refresh] Done.");
}

main()
  .catch((e) => {
    console.error("[binance-kline-cache-refresh]", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
