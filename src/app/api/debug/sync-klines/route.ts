/**
 * Em DEV: sync de klines (1m, 5m, 1h) no banco.
 * - target=dev: banco URL_DEV (ou DATABASE_URL se URL_DEV não definido).
 * - target=prod: banco URL_PROD.
 * GET /api/debug/sync-klines?target=dev|prod
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCryptoPrismaDev, getCryptoPrismaProd } from "@/lib/crypto-db";
import type { PrismaClient } from "@/lib/prisma-bio-client";
import { getKlineSymbolsFromDb, isBinanceInvalidSymbolError } from "@/app/lib/kline-symbols";

const BINANCE_BASE = process.env.BINANCE_API_BASE_URL || "https://api.binance.com";
const INTERVAL_1M = "1m";
const INTERVAL_5M = "5m";
const INTERVAL_1H = "1h";
const KLINE_1H_YEARS = 5;
const CORRETORA = "binance";
const ONE_MINUTE_MS = 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const SYNC_KLINES_LIMIT = 1000;

type BinanceKline = [number, string, string, string, string, string, number, string, number, string, string, number];

function intervalStepMs(interval: string): number {
  if (interval === INTERVAL_1M) return ONE_MINUTE_MS;
  if (interval === INTERVAL_5M) return FIVE_MINUTES_MS;
  return ONE_HOUR_MS;
}

function getCutoff5YearsMs(): number {
  return Date.now() - KLINE_1H_YEARS * 365.25 * 24 * 60 * 60 * 1000;
}

function klineToRow(k: BinanceKline, corretora: string, symbol: string, interval: string) {
  return {
    corretora,
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

async function fetchKlinesChunk(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<BinanceKline[]> {
  const base = BINANCE_BASE.replace(/\/$/, "");
  const url = new URL(`${base}/api/v3/klines`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(SYNC_KLINES_LIMIT));
  url.searchParams.set("startTime", String(startTime));
  url.searchParams.set("endTime", String(endTime));
  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 451) {
      throw new Error(
        "Binance 451: API bloqueada na região do servidor (Vercel). Use um proxy: defina BINANCE_API_BASE_URL com a URL de um proxy que encaminhe para https://api.binance.com"
      );
    }
    throw new Error(`Binance ${res.status}: ${text}`);
  }
  const data = JSON.parse(text) as unknown;
  if (!Array.isArray(data)) return [];
  return data as BinanceKline[];
}

async function fetchKlinesUpToNow(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<BinanceKline[]> {
  const all: BinanceKline[] = [];
  let currentStart = startTime;
  while (currentStart < endTime) {
    const chunk = await fetchKlinesChunk(symbol, interval, currentStart, endTime);
    if (chunk.length === 0) break;
    all.push(...chunk);
    const lastOpen = chunk[chunk.length - 1]![0];
    currentStart = lastOpen + intervalStepMs(interval);
    if (chunk.length < SYNC_KLINES_LIMIT) break;
  }
  return all;
}

/** Mesma lógica do cron: última atualização até agora. Usado só para target=prod. */
async function runSyncKlinesOnDb(db: PrismaClient) {
  const now = Date.now();
  const startWindow1h = getCutoff5YearsMs();
  const result: { symbol: string; inserted: number; inserted5m: number; inserted1h: number }[] = [];
  const SYMBOLS = await getKlineSymbolsFromDb(db);
  for (const symbol of SYMBOLS) {
    let inserted = 0;
    let inserted5m = 0;
    let inserted1h = 0;
    try {
      const lastRow = await db.binanceKlineFast.findFirst({
        where: { corretora: CORRETORA, symbol, interval: INTERVAL_1M },
        orderBy: { openTime: "desc" },
        select: { openTime: true },
      });
      const startTime = lastRow ? Number(lastRow.openTime) : now - 5 * ONE_MINUTE_MS;
      if (startTime < now) {
        const klines = await fetchKlinesUpToNow(symbol, INTERVAL_1M, startTime, now);
        if (klines.length > 0) {
          if (lastRow) {
            await db.binanceKlineFast.deleteMany({
              where: { corretora: CORRETORA, symbol, interval: INTERVAL_1M, openTime: lastRow.openTime },
            });
          }
          const rows = klines.map((k) => klineToRow(k, CORRETORA, symbol, INTERVAL_1M));
          const { count } = await db.binanceKlineFast.createMany({ data: rows, skipDuplicates: true });
          inserted = count;
        }
      }
      const lastRow5m = await db.binanceKlineMonth.findFirst({
        where: { corretora: CORRETORA, symbol, interval: INTERVAL_5M },
        orderBy: { openTime: "desc" },
        select: { openTime: true },
      });
      const startTime5m = lastRow5m ? Number(lastRow5m.openTime) : now - 2 * ONE_HOUR_MS;
      if (startTime5m < now) {
        const klines5m = await fetchKlinesUpToNow(symbol, INTERVAL_5M, startTime5m, now);
        if (klines5m.length > 0) {
          if (lastRow5m) {
            await db.binanceKlineMonth.deleteMany({
              where: { corretora: CORRETORA, symbol, interval: INTERVAL_5M, openTime: lastRow5m.openTime },
            });
          }
          const rows5m = klines5m.map((k) => klineToRow(k, CORRETORA, symbol, INTERVAL_5M));
          const created5m = await db.binanceKlineMonth.createMany({ data: rows5m, skipDuplicates: true });
          inserted5m = created5m.count;
        }
      }
      const lastRow1h = await db.binanceKline.findFirst({
        where: { corretora: CORRETORA, symbol, interval: INTERVAL_1H },
        orderBy: { openTime: "desc" },
        select: { openTime: true },
      });
      const startTime1h = lastRow1h ? Math.max(startWindow1h, Number(lastRow1h.openTime)) : startWindow1h;
      if (startTime1h < now) {
        const klines1h = await fetchKlinesUpToNow(symbol, INTERVAL_1H, startTime1h, now);
        if (klines1h.length > 0) {
          if (lastRow1h) {
            await db.binanceKline.deleteMany({
              where: { corretora: CORRETORA, symbol, interval: INTERVAL_1H, openTime: lastRow1h.openTime },
            });
          }
          const rows1h = klines1h.map((k) => klineToRow(k, CORRETORA, symbol, INTERVAL_1H));
          const created1h = await db.binanceKline.createMany({ data: rows1h, skipDuplicates: true });
          inserted1h = created1h.count;
        }
      }
      result.push({ symbol, inserted, inserted5m, inserted1h });
    } catch (e) {
      if (isBinanceInvalidSymbolError(e)) {
        console.warn("[api/debug/sync-klines] Symbol not in API, skipping:", symbol);
        result.push({ symbol, inserted: 0, inserted5m: 0, inserted1h: 0 });
        continue;
      }
      throw e;
    }
  }
  return { ok: true as const, result };
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 404 });
  }

  const target = request.nextUrl.searchParams.get("target") === "prod" ? "prod" : "dev";

  try {
    const db = target === "prod" ? getCryptoPrismaProd() : getCryptoPrismaDev();
    const data = await runSyncKlinesOnDb(db);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[api/debug/sync-klines]", target, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
