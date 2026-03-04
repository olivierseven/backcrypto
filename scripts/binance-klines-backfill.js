/**
 * Backfill de klines BTCUSDT 1m no banco (backcrypto.BinanceKline).
 * Popula dados retroativamente de 2024-01-01T00:00:00.000Z até 2025-09-01T00:00:00.000Z.
 * Usa a mesma API Binance e createMany com skipDuplicates (não sobrescreve dados já existentes).
 *
 * Uso: node scripts/binance-klines-backfill.js
 * Requer: DATABASE_URL no .env e prisma generate já rodado.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const { PrismaClient } = require("../src/lib/prisma-bio-client");

const BINANCE_KLINES = "https://api.binance.com/api/v3/klines";
const SYMBOL = "BTCUSDT";
const INTERVAL = "1m";
const LIMIT = 1000;
const ONE_MINUTE_MS = 60 * 1000;
const DELAY_MS = 1100; // ~1 req/s para evitar rate limit

/** 2024-01-01 00:00:00 UTC */
const START_MS = new Date("2024-01-01T00:00:00.000Z").getTime();
/** 2025-09-01 00:00:00 UTC (último minuto incluído: 2025-08-31 23:59:00) */
const END_MS = new Date("2025-09-01T00:00:00.000Z").getTime();

const prisma = new PrismaClient();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchKlines(startTime, endTime) {
  const url = new URL(BINANCE_KLINES);
  url.searchParams.set("symbol", SYMBOL);
  url.searchParams.set("interval", INTERVAL);
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("startTime", String(startTime));
  url.searchParams.set("endTime", String(endTime));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Binance ${res.status}: ${await res.text()}`);
  return res.json();
}

function klineToRow(k) {
  return {
    symbol: SYMBOL,
    interval: INTERVAL,
    openTime: BigInt(k[0]),
    open: k[1],
    high: k[2],
    low: k[3],
    close: k[4],
    volume: k[5],
    closeTime: BigInt(k[6]),
    quoteAssetVolume: k[7],
    numberOfTrades: k[8],
    takerBuyBaseAssetVolume: k[9],
    takerBuyQuoteAssetVolume: k[10],
  };
}

async function main() {
  console.log("[binance-klines-backfill] Iniciando…");
  console.log("[binance-klines-backfill] Período: 2024-01-01 00:00:00 UTC → 2025-09-01 00:00:00 UTC");

  let startTime = START_MS;
  let totalInserted = 0;
  let totalFetched = 0;
  let batches = 0;

  while (startTime < END_MS) {
    const klines = await fetchKlines(startTime, END_MS);
    totalFetched += klines.length;

    if (klines.length === 0) {
      console.log("[binance-klines-backfill] Sem mais dados da API.");
      break;
    }

    const rows = klines.map(klineToRow);
    const created = await prisma.binanceKline.createMany({
      data: rows,
      skipDuplicates: true,
    });
    totalInserted += created.count;
    batches += 1;

    const lastOpenTime = klines[klines.length - 1][0];
    const nextStart = lastOpenTime + ONE_MINUTE_MS;
    const percent = (((nextStart - START_MS) / (END_MS - START_MS)) * 100).toFixed(1);
    console.log(
      `  [${batches}] + ${klines.length} velas (inseridas: ${created.count}) | total: ${totalInserted} | ~${percent}%`
    );

    startTime = nextStart;
    if (klines.length < LIMIT) break;

    await sleep(DELAY_MS);
  }

  console.log("[binance-klines-backfill] Concluído.");
  console.log("[binance-klines-backfill] Total buscado: " + totalFetched + " | Total inserido: " + totalInserted);
}

main()
  .catch((e) => {
    console.error("[binance-klines-backfill] Erro:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
