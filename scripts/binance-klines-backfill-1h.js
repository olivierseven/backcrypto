/**
 * Backfill de klines BTCUSDT 1h na tabela BinanceKline.
 * Período: últimos 5 anos até agora (UTC, dinâmico).
 * Reescreve (delete + insert) o range de cada lote baixado.
 *
 * Uso: node scripts/binance-klines-backfill-1h.js
 * Requer: DATABASE_URL no .env e prisma generate já rodado.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const { PrismaClient } = require("../src/lib/prisma-bio-client");

const BINANCE_KLINES = "https://api.binance.com/api/v3/klines";
const SYMBOL = "BTCUSDT";
const INTERVAL = "1h";
const LIMIT = 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const DELAY_MS = 1100; // ~1 req/s para evitar rate limit
const KLINE_1H_YEARS = 5;

function floorToHourMs(ms) {
  return Math.floor(ms / ONE_HOUR_MS) * ONE_HOUR_MS;
}

function getStartMs(nowMs) {
  // Aproximação consistente com o sync (365.25 dias/ano) e alinhado à hora.
  const start = nowMs - KLINE_1H_YEARS * 365.25 * 24 * 60 * 60 * 1000;
  return floorToHourMs(start);
}

function getEndMs(nowMs) {
  // Inclui a hora corrente (end exclusivo, alinhado à próxima hora).
  return floorToHourMs(nowMs) + ONE_HOUR_MS;
}

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
  const now = Date.now();
  const START_MS = getStartMs(now);
  const END_MS = getEndMs(now);
  console.log("[binance-klines-backfill-1h] Iniciando…");
  console.log("[binance-klines-backfill-1h] Tabela: BinanceKline | Intervalo: 1h");
  console.log(
    "[binance-klines-backfill-1h] Período: " +
      new Date(START_MS).toISOString() +
      " → " +
      new Date(END_MS).toISOString() +
      " (últimos " +
      KLINE_1H_YEARS +
      " anos)"
  );

  let startTime = START_MS;
  let totalInserted = 0;
  let totalFetched = 0;
  let batches = 0;

  while (startTime < END_MS) {
    const klines = await fetchKlines(startTime, END_MS);
    totalFetched += klines.length;

    if (klines.length === 0) {
      console.log("[binance-klines-backfill-1h] Sem mais dados da API.");
      break;
    }

    const rows = klines.map(klineToRow);
    const minOpen = rows.reduce((m, r) => (r.openTime < m ? r.openTime : m), rows[0].openTime);
    const maxOpen = rows.reduce((m, r) => (r.openTime > m ? r.openTime : m), rows[0].openTime);
    await prisma.binanceKline.deleteMany({
      where: { symbol: SYMBOL, interval: INTERVAL, openTime: { gte: minOpen, lte: maxOpen } },
    });
    const created = await prisma.binanceKline.createMany({ data: rows });
    totalInserted += created.count;
    batches += 1;

    const lastOpenTime = klines[klines.length - 1][0];
    const nextStart = lastOpenTime + ONE_HOUR_MS;
    const percent = (((nextStart - START_MS) / (END_MS - START_MS)) * 100).toFixed(1);
    console.log(
      `  [${batches}] + ${klines.length} velas (inseridas: ${created.count}) | total: ${totalInserted} | ~${percent}%`
    );

    startTime = nextStart;
    if (klines.length < LIMIT) break;

    await sleep(DELAY_MS);
  }

  console.log("[binance-klines-backfill-1h] Concluído.");
  console.log("[binance-klines-backfill-1h] Total buscado: " + totalFetched + " | Total inserido: " + totalInserted);
}

main()
  .catch((e) => {
    console.error("[binance-klines-backfill-1h] Erro:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
