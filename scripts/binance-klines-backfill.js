/**
 * Backfill de klines BTCUSDT 1m no banco (backcrypto.BinanceKlineFast).
 * Período: últimos 90 dias (base de expurgo) até agora. Se rodar de novo, reescreve o range.
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
const FAST_DAYS = 90; // mesmo expurgo do sync: mantém no máx. 90 dias

/** Início do passado = 90 dias atrás (UTC). */
function getStartMs() {
  return Date.now() - FAST_DAYS * 24 * 60 * 60 * 1000;
}
/** Fim = agora (próximo minuto para incluir o atual). */
function getEndMs() {
  return Date.now() + ONE_MINUTE_MS;
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
  const START_MS = getStartMs();
  const END_MS = getEndMs();
  console.log("[binance-klines-backfill] Iniciando…");
  console.log("[binance-klines-backfill] Tabela: BinanceKlineFast | 1m | passado = " + FAST_DAYS + " dias até agora.");
  console.log("[binance-klines-backfill] Período: " + new Date(START_MS).toISOString() + " → " + new Date(END_MS).toISOString());

  // Reescrever se rodar novamente: remove o range que vamos preencher.
  const deleted = await prisma.binanceKlineFast.deleteMany({
    where: {
      symbol: SYMBOL,
      interval: INTERVAL,
      openTime: { gte: BigInt(START_MS), lt: BigInt(END_MS) },
    },
  });
  if (deleted.count > 0) console.log("[binance-klines-backfill] Removidas " + deleted.count + " linhas antigas do range (reescrevendo).");

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
    const created = await prisma.binanceKlineFast.createMany({
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
