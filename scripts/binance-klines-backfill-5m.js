/**
 * Backfill de klines BTCUSDT 5m na tabela BinanceKlineMonth.
 * Período: últimos KLINE_5M_DAYS dias (.env, default 90) até agora.
 * Reescreve (delete + insert) o range de cada lote baixado.
 *
 * Uso: node scripts/binance-klines-backfill-5m.js
 * Requer: DATABASE_URL no .env e prisma generate já rodado.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const { PrismaClient } = require("../src/lib/prisma-bio-client");

const BINANCE_BASE = (process.env.BINANCE_API_BASE_URL || "https://api.binance.com").replace(/\/$/, "");
const SYMBOL = "BTCUSDT";
const INTERVAL = "5m";
const LIMIT = 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const DELAY_MS = 1100; // ~1 req/s para evitar rate limit
const CORRETORA = "binance";
const KLINE_5M_DAYS = Math.max(1, parseInt(process.env.KLINE_5M_DAYS ?? "90", 10) || 90);

function floorTo5mMs(ms) {
  return Math.floor(ms / FIVE_MINUTES_MS) * FIVE_MINUTES_MS;
}

function getStartMs(nowMs) {
  const start = nowMs - KLINE_5M_DAYS * 24 * 60 * 60 * 1000;
  return floorTo5mMs(start);
}

function getEndMs(nowMs) {
  return floorTo5mMs(nowMs) + FIVE_MINUTES_MS;
}

const prisma = new PrismaClient();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchKlines(startTime, endTime) {
  const url = new URL(`${BINANCE_BASE}/api/v3/klines`);
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
    corretora: CORRETORA,
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
  const now = Date.now();
  const START_MS = getStartMs(now);
  const END_MS = getEndMs(now);
  console.log("[binance-klines-backfill-5m] Iniciando…");
  console.log("[binance-klines-backfill-5m] Tabela: BinanceKlineMonth | 5m");
  console.log(
    "[binance-klines-backfill-5m] Período: " +
      new Date(START_MS).toISOString() +
      " → " +
      new Date(END_MS).toISOString() +
      " (últimos " +
      KLINE_5M_DAYS +
      " dias)"
  );

  let startTime = START_MS;
  let totalInserted = 0;
  let totalFetched = 0;
  let batches = 0;

  while (startTime < END_MS) {
    const klines = await fetchKlines(startTime, END_MS);
    totalFetched += klines.length;

    if (klines.length === 0) {
      console.log("[binance-klines-backfill-5m] Sem mais dados da API.");
      break;
    }

    const rows = klines.map(klineToRow);
    const minOpen = rows.reduce((m, r) => (r.openTime < m ? r.openTime : m), rows[0].openTime);
    const maxOpen = rows.reduce((m, r) => (r.openTime > m ? r.openTime : m), rows[0].openTime);
    await prisma.binanceKlineMonth.deleteMany({
      where: { corretora: CORRETORA, symbol: SYMBOL, interval: INTERVAL, openTime: { gte: minOpen, lte: maxOpen } },
    });
    const created = await prisma.binanceKlineMonth.createMany({ data: rows });
    totalInserted += created.count;
    batches += 1;

    const lastOpenTime = klines[klines.length - 1][0];
    const nextStart = lastOpenTime + FIVE_MINUTES_MS;
    const percent = (((nextStart - START_MS) / (END_MS - START_MS)) * 100).toFixed(1);
    console.log(
      `  [${batches}] + ${klines.length} velas (inseridas: ${created.count}) | total: ${totalInserted} | ~${percent}%`
    );

    startTime = nextStart;
    if (klines.length < LIMIT) break;

    await sleep(DELAY_MS);
  }

  console.log("[binance-klines-backfill-5m] Concluído.");
  console.log("[binance-klines-backfill-5m] Total buscado: " + totalFetched + " | Total inserido: " + totalInserted);
}

main()
  .catch((e) => {
    console.error("[binance-klines-backfill-5m] Erro:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
