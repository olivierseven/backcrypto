/**
 * Cron job chamado pela Vercel a cada minuto (* * * * *).
 * Path na Vercel: /crypto/api/cron (basePath do app é /crypto).
 */
export const dynamic = "force-dynamic";

/**
 * Replica a lógica do binance-klines-fast-sync:
 * - BinanceKlineFast 1m incremental + expurgo 90 dias
 * - BinanceKline 1h incremental + expurgo 5 anos
 * Protegido por CRON_SECRET (Vercel envia em Authorization: Bearer <CRON_SECRET>).
 */
import { NextResponse } from "next/server";
import { cryptoPrisma } from "@/lib/crypto-db";

const BINANCE_BASE = process.env.BINANCE_API_BASE_URL || "https://api.binance.com";
const SYMBOLS = ["BTCUSDT", "ETHUSDT"];
const INTERVAL_1M = "1m";
const INTERVAL_1H = "1h";
const FAST_DAYS = 90;
const KLINE_1H_YEARS = 5;
const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

function getCutoff90DaysMs(): number {
  return Date.now() - FAST_DAYS * 24 * 60 * 60 * 1000;
}

function getCutoff5YearsMs(): number {
  return Date.now() - KLINE_1H_YEARS * 365.25 * 24 * 60 * 60 * 1000;
}

type BinanceKline = [number, string, string, string, string, string, number, string, number, string, string, number];

function klineToRow(k: BinanceKline, symbol: string, interval: string) {
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

async function fetchKlines(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
  limit = 10
): Promise<BinanceKline[]> {
  const base = BINANCE_BASE.replace(/\/$/, "");
  const url = new URL(`${base}/api/v3/klines`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(limit));
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

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const auth = request.headers.get("authorization");
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = Date.now();
    const startWindow = getCutoff90DaysMs();
    const cutoff = BigInt(startWindow);
    const cutoff1h = BigInt(getCutoff5YearsMs());
    const result: { symbol: string; inserted: number; purged: number; inserted1h: number; purged1h: number }[] = [];

    for (const symbol of SYMBOLS) {
      let inserted = 0;
      let inserted1h = 0;

      // --- 1m BinanceKlineFast ---
      const lastRow = await cryptoPrisma.binanceKlineFast.findFirst({
        where: { symbol, interval: INTERVAL_1M },
        orderBy: { openTime: "desc" },
        select: { openTime: true },
      });

      const startTime = lastRow ? Number(lastRow.openTime) : now - 5 * ONE_MINUTE_MS;
      if (startTime >= now) {
        const purged = (
          await cryptoPrisma.binanceKlineFast.deleteMany({
            where: { symbol, interval: INTERVAL_1M, openTime: { lt: cutoff } },
          })
        ).count;
        // fall through to 1h
      } else {
        const klines = await fetchKlines(symbol, INTERVAL_1M, startTime, now, 10);
        if (klines.length > 0) {
          if (lastRow) {
            await cryptoPrisma.binanceKlineFast.deleteMany({
              where: { symbol, interval: INTERVAL_1M, openTime: lastRow.openTime },
            });
          }
          const rows = klines.map((k) => klineToRow(k, symbol, INTERVAL_1M));
          const { count } = await cryptoPrisma.binanceKlineFast.createMany({
            data: rows,
            skipDuplicates: true,
          });
          inserted = count;
        }
      }

      const purged = (
        await cryptoPrisma.binanceKlineFast.deleteMany({
          where: { symbol, interval: INTERVAL_1M, openTime: { lt: cutoff } },
        })
      ).count;

      // --- 1h BinanceKline ---
      const lastRow1h = await cryptoPrisma.binanceKline.findFirst({
        where: { symbol, interval: INTERVAL_1H },
        orderBy: { openTime: "desc" },
        select: { openTime: true },
      });

      const startWindow1h = getCutoff5YearsMs();
      const startTime1h = lastRow1h ? Math.max(startWindow1h, Number(lastRow1h.openTime)) : startWindow1h;

      if (startTime1h < now) {
        const klines1h = await fetchKlines(symbol, INTERVAL_1H, startTime1h, now, 5);
        if (klines1h.length > 0) {
          if (lastRow1h) {
            await cryptoPrisma.binanceKline.deleteMany({
              where: { symbol, interval: INTERVAL_1H, openTime: lastRow1h.openTime },
            });
          }
          const rows1h = klines1h.map((k) => klineToRow(k, symbol, INTERVAL_1H));
          const created1h = await cryptoPrisma.binanceKline.createMany({
            data: rows1h,
            skipDuplicates: true,
          });
          inserted1h = created1h.count;
        }
      }

      const purged1h = (
        await cryptoPrisma.binanceKline.deleteMany({
          where: { symbol, interval: INTERVAL_1H, openTime: { lt: cutoff1h } },
        })
      ).count;

      result.push({ symbol, inserted, purged, inserted1h, purged1h });
    }

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[api/cron]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cron failed" },
      { status: 500 }
    );
  }
}
