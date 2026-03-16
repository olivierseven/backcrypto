/**
 * Cron job chamado pela Vercel a cada minuto (* * * * *).
 * Path na Vercel: /crypto/api/cron (basePath do app é /crypto).
 */
export const dynamic = "force-dynamic";

/**
 * Replica a lógica 1m do binance-klines-fast-sync:
 * - BinanceKlineFast 1m incremental para BTCUSDT e ETHUSDT
 * - Atualiza o último candle (delete + insert) e insere novos
 * - Expurgo: remove 1m com mais de 90 dias
 * Protegido por CRON_SECRET (Vercel envia em Authorization: Bearer <CRON_SECRET>).
 */
import { NextResponse } from "next/server";
import { cryptoPrisma } from "@/lib/crypto-db";

const BINANCE_BASE = process.env.BINANCE_API_BASE_URL || "https://api.binance.com";
const SYMBOLS = ["BTCUSDT", "ETHUSDT"];
const INTERVAL_1M = "1m";
const FAST_DAYS = 90;
const ONE_MINUTE_MS = 60 * 1000;

function getCutoff90DaysMs(): number {
  return Date.now() - FAST_DAYS * 24 * 60 * 60 * 1000;
}

type BinanceKline = [number, string, string, string, string, string, number, string, number, string, string, number];

function klineToRow(k: BinanceKline, symbol: string) {
  return {
    symbol,
    interval: INTERVAL_1M,
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
  startTime: number,
  endTime: number
): Promise<BinanceKline[]> {
  const base = BINANCE_BASE.replace(/\/$/, "");
  const url = new URL(`${base}/api/v3/klines`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", INTERVAL_1M);
  url.searchParams.set("limit", "10");
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
    const result: { symbol: string; inserted: number; purged: number }[] = [];

    for (const symbol of SYMBOLS) {
      let inserted = 0;
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
        result.push({ symbol, inserted: 0, purged });
        continue;
      }

      const klines = await fetchKlines(symbol, startTime, now);
      if (klines.length === 0) {
        const purged = (
          await cryptoPrisma.binanceKlineFast.deleteMany({
            where: { symbol, interval: INTERVAL_1M, openTime: { lt: cutoff } },
          })
        ).count;
        result.push({ symbol, inserted: 0, purged });
        continue;
      }

      if (lastRow) {
        await cryptoPrisma.binanceKlineFast.deleteMany({
          where: { symbol, interval: INTERVAL_1M, openTime: lastRow.openTime },
        });
      }
      const rows = klines.map((k) => klineToRow(k, symbol));
      const { count } = await cryptoPrisma.binanceKlineFast.createMany({
        data: rows,
        skipDuplicates: true,
      });
      inserted = count;

      const purged = (
        await cryptoPrisma.binanceKlineFast.deleteMany({
          where: { symbol, interval: INTERVAL_1M, openTime: { lt: cutoff } },
        })
      ).count;

      result.push({ symbol, inserted, purged });
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
