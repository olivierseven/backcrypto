/**
 * Sincroniza, para cada símbolo (BTCUSDT, ETHUSDT):
 * - BinanceKlineFast: klines 1m, no máximo 90 dias (expurgo por idade).
 * - BinanceKline: klines 1h, no máximo 5 anos (expurgo por idade).
 *
 * Uso: node scripts/binance-klines-fast-sync.js
 * Requer: DATABASE_URL no .env e prisma generate já rodado.
 */

const path = require("path");
const fs = require("fs");
const util = require("util");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const LOGS_DIR = path.resolve(__dirname, "..", "logs");
const CONSOLE_LOG_FILE = path.join(LOGS_DIR, "binance-klines-fast-sync.log");

let logStream = null;

function initConsoleLogToFile() {
  try {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
    logStream = fs.createWriteStream(CONSOLE_LOG_FILE, { flags: "w" });
    const origLog = console.log;
    const origErr = console.error;
    console.log = (...args) => {
      origLog.apply(console, args);
      logStream.write(util.format.apply(util, args) + "\n");
    };
    console.error = (...args) => {
      origErr.apply(console, args);
      logStream.write(util.format.apply(util, args) + "\n");
    };
  } catch (e) {
    process.stderr.write("[binance-klines-fast-sync] Falha ao gravar log: " + e.message + "\n");
  }
}

function closeConsoleLogToFile() {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

const { PrismaClient } = require("../src/lib/prisma-bio-client");

const BINANCE_KLINES = "https://api.binance.com/api/v3/klines";
const SYMBOLS = ["BTCUSDT", "ETHUSDT"];
const INTERVAL_1M = "1m";
const INTERVAL_1H = "1h";
const LIMIT = 1000;
const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const DELAY_MS = 1100; // ~1 req/s para evitar rate limit
const FAST_DAYS = 90;
const KLINE_1H_YEARS = 5;

/** Limite 1m: openTime < isso é expurgado (mantém no máx. 90 dias). */
function getCutoff90DaysMs() {
  return Date.now() - FAST_DAYS * 24 * 60 * 60 * 1000;
}

/** Limite 1h: openTime < isso é expurgado (mantém no máx. 5 anos). */
function getCutoff5YearsMs() {
  return Date.now() - KLINE_1H_YEARS * 365.25 * 24 * 60 * 60 * 1000;
}

const prisma = new PrismaClient();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchKlines(symbol, startTime, endTime, interval) {
  const url = new URL(BINANCE_KLINES);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(LIMIT));
  if (startTime != null) url.searchParams.set("startTime", String(startTime));
  if (endTime != null) url.searchParams.set("endTime", String(endTime));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Binance ${res.status}: ${await res.text()}`);
  return res.json();
}

function klineToRow(k, interval, symbol) {
  return {
    symbol,
    interval,
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

async function expurgeFast(symbol) {
  const cutoff = BigInt(getCutoff90DaysMs());
  const result = await prisma.binanceKlineFast.deleteMany({
    where: { symbol, interval: INTERVAL_1M, openTime: { lt: cutoff } },
  });
  return result.count;
}

async function expurgeKline1h(symbol) {
  const cutoff = BigInt(getCutoff5YearsMs());
  const result = await prisma.binanceKline.deleteMany({
    where: { symbol, interval: INTERVAL_1H, openTime: { lt: cutoff } },
  });
  return result.count;
}

async function refetchLastAndInsert1h(symbol, lastOpenTimeMs, rows) {
  if (!rows || rows.length === 0) return 0;
  await prisma.binanceKline.deleteMany({
    where: { symbol, interval: INTERVAL_1H, openTime: BigInt(lastOpenTimeMs) },
  });
  const created = await prisma.binanceKline.createMany({ data: rows, skipDuplicates: true });
  return created.count;
}

async function insertBinanceKline1h(rows) {
  if (!rows || rows.length === 0) return 0;
  const created = await prisma.binanceKline.createMany({ data: rows, skipDuplicates: true });
  return created.count;
}

async function syncSymbol(SYMBOL) {
  const now = Date.now();
  const startWindow = getCutoff90DaysMs();

  const count = await prisma.binanceKlineFast.count({
    where: { symbol: SYMBOL, interval: INTERVAL_1M },
  });

  if (count === 0) {
    console.log("[binance-klines-fast-sync] " + SYMBOL + " BinanceKlineFast vazia: carregando até " + FAST_DAYS + " dias…");
    let startTime = startWindow;
    let totalInserted = 0;

    while (startTime < now) {
      const klines = await fetchKlines(SYMBOL, startTime, now, INTERVAL_1M);
      if (klines.length === 0) break;

      const rows = klines.map((k) => klineToRow(k, INTERVAL_1M, SYMBOL));
      const created = await prisma.binanceKlineFast.createMany({
        data: rows,
        skipDuplicates: true,
      });
      totalInserted += created.count;
      const last = klines[klines.length - 1][0];
      startTime = last + ONE_MINUTE_MS;
      console.log("  " + SYMBOL + " + " + klines.length + " velas (total inseridas: " + totalInserted + ")");
      if (klines.length < LIMIT) break;
      await sleep(DELAY_MS);
    }
    console.log("[binance-klines-fast-sync] " + SYMBOL + " Carga inicial 1m: " + totalInserted + " linhas.");
  } else {
    const lastRow = await prisma.binanceKlineFast.findFirst({
      where: { symbol: SYMBOL, interval: INTERVAL_1M },
      orderBy: { openTime: "desc" },
      select: { openTime: true },
    });
    let startTime = lastRow ? Number(lastRow.openTime) : startWindow;
    if (startTime >= now) {
      console.log("[binance-klines-fast-sync] " + SYMBOL + " 1m: nenhum dado novo (já em dia).");
    } else {
      let totalInserted = 0;
      while (startTime < now) {
        const klines = await fetchKlines(SYMBOL, startTime, now, INTERVAL_1M);
        if (klines.length === 0) break;
        const rows = klines.map((k) => klineToRow(k, INTERVAL_1M, SYMBOL));
        if (lastRow) {
          await prisma.binanceKlineFast.deleteMany({
            where: { symbol: SYMBOL, interval: INTERVAL_1M, openTime: lastRow.openTime },
          });
        }
        const created = await prisma.binanceKlineFast.createMany({
          data: rows,
          skipDuplicates: true,
        });
        totalInserted += created.count;
        const last = klines[klines.length - 1][0];
        startTime = last + ONE_MINUTE_MS;
        console.log("  " + SYMBOL + " + " + klines.length + " velas 1m (total incremental: " + totalInserted + ")");
        if (klines.length < LIMIT) break;
        await sleep(DELAY_MS);
      }
      console.log("[binance-klines-fast-sync] " + SYMBOL + " 1m incremental: " + totalInserted + " novas velas.");
    }
  }

  const purgedFast = await expurgeFast(SYMBOL);
  if (purgedFast > 0) console.log("[binance-klines-fast-sync] " + SYMBOL + " Expurgo BinanceKlineFast: " + purgedFast + " linhas (mantém " + FAST_DAYS + " dias).");

  const finalFast = await prisma.binanceKlineFast.count({
    where: { symbol: SYMBOL, interval: INTERVAL_1M },
  });
  console.log("[binance-klines-fast-sync] " + SYMBOL + " Total BinanceKlineFast: " + finalFast);

  // --- BinanceKline 1h (máx. 5 anos) ---
  const startWindow1h = getCutoff5YearsMs();
  const count1h = await prisma.binanceKline.count({
    where: { symbol: SYMBOL, interval: INTERVAL_1H },
  });

  if (count1h === 0) {
    console.log("[binance-klines-fast-sync] " + SYMBOL + " BinanceKline 1h: tabela vazia, carregando " + KLINE_1H_YEARS + " anos…");
    let startTime1h = startWindow1h;
    let totalInserted1h = 0;
    while (startTime1h < now) {
      const klines1h = await fetchKlines(SYMBOL, startTime1h, now, INTERVAL_1H);
      if (klines1h.length === 0) break;
      const rows1h = klines1h.map((k) => klineToRow(k, INTERVAL_1H, SYMBOL));
      totalInserted1h += await insertBinanceKline1h(rows1h);
      const last1h = klines1h[klines1h.length - 1][0];
      startTime1h = last1h + ONE_HOUR_MS;
      console.log("  " + SYMBOL + " 1h + " + klines1h.length + " velas (total: " + totalInserted1h + ")");
      if (klines1h.length < LIMIT) break;
      await sleep(DELAY_MS);
    }
    console.log("[binance-klines-fast-sync] " + SYMBOL + " BinanceKline 1h carga inicial: " + totalInserted1h + " linhas.");
  } else {
    const lastRow1h = await prisma.binanceKline.findFirst({
      where: { symbol: SYMBOL, interval: INTERVAL_1H },
      orderBy: { openTime: "desc" },
      select: { openTime: true },
    });
    const lastOpen = lastRow1h ? Number(lastRow1h.openTime) : null;
    const startTime1h = lastOpen != null ? Math.max(startWindow1h, lastOpen) : startWindow1h;
    if (startTime1h >= now) {
      console.log("[binance-klines-fast-sync] " + SYMBOL + " BinanceKline 1h: já em dia.");
    } else {
      let totalInserted1h = 0;
      let t = startTime1h;
      let lastOpenToRefetch = lastOpen;
      while (t < now) {
        const klines1h = await fetchKlines(SYMBOL, t, now, INTERVAL_1H);
        if (klines1h.length === 0) break;
        const rows1h = klines1h.map((k) => klineToRow(k, INTERVAL_1H, SYMBOL));
        if (lastOpenToRefetch != null) {
          totalInserted1h += await refetchLastAndInsert1h(SYMBOL, lastOpenToRefetch, rows1h);
          lastOpenToRefetch = null;
        } else {
          const created1h = await prisma.binanceKline.createMany({ data: rows1h, skipDuplicates: true });
          totalInserted1h += created1h.count;
        }
        const last1h = klines1h[klines1h.length - 1][0];
        t = last1h + ONE_HOUR_MS;
        console.log("  " + SYMBOL + " 1h + " + klines1h.length + " velas (incremental: " + totalInserted1h + ")");
        if (klines1h.length < LIMIT) break;
        await sleep(DELAY_MS);
      }
      console.log("[binance-klines-fast-sync] " + SYMBOL + " BinanceKline 1h incremental: " + totalInserted1h + " novas velas.");
    }
  }

  const purged1h = await expurgeKline1h(SYMBOL);
  if (purged1h > 0) console.log("[binance-klines-fast-sync] " + SYMBOL + " Expurgo BinanceKline 1h: " + purged1h + " linhas (mantém " + KLINE_1H_YEARS + " anos).");

  const final1h = await prisma.binanceKline.count({
    where: { symbol: SYMBOL, interval: INTERVAL_1H },
  });
  console.log("[binance-klines-fast-sync] " + SYMBOL + " Total BinanceKline 1h: " + final1h);
}

async function main() {
  initConsoleLogToFile();
  console.log("[binance-klines-fast-sync] Iniciando… (símbolos: " + SYMBOLS.join(", ") + ")");

  for (const symbol of SYMBOLS) {
    await syncSymbol(symbol);
  }

  console.log("[binance-klines-fast-sync] Concluído.");
}

main()
  .catch((e) => {
    console.error("[binance-klines-fast-sync] Erro:", e);
    process.exit(1);
  })
  .finally(() => {
    closeConsoleLogToFile();
    prisma.$disconnect();
  });
