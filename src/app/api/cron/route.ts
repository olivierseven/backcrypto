/**
 * Cron job chamado pela Vercel a cada minuto (* * * * *).
 * Atualiza o último candle 1m em BinanceKlineFast (BTCUSDT).
 * Protegido por CRON_SECRET: definir na Vercel em Environment Variables.
 */
import { NextResponse } from "next/server";
import { cryptoPrisma } from "@/lib/crypto-db";

const BINANCE_KLINES = "https://api.binance.com/api/v3/klines";
const SYMBOL = "BTCUSDT";
const INTERVAL = "1m";

type BinanceKline = [number, string, string, string, string, string, number, string, number, string, string, number];

function klineToRow(
  k: BinanceKline,
  symbol: string,
  interval: string
) {
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

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const auth = request.headers.get("authorization");
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Últimos 3 minutos para pegar o candle que acabou de fechar
    const now = Date.now();
    const startTime = now - 4 * 60 * 1000;
    const url = new URL(BINANCE_KLINES);
    url.searchParams.set("symbol", SYMBOL);
    url.searchParams.set("interval", INTERVAL);
    url.searchParams.set("limit", "5");
    url.searchParams.set("startTime", String(startTime));

    const res = await fetch(url.toString());
    const text = await res.text();
    if (!res.ok) {
      console.error("[cron] Binance error", res.status, text.slice(0, 200));
      return NextResponse.json({ error: "Binance request failed" }, { status: 502 });
    }

    const data = JSON.parse(text) as unknown;
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }

    const rows = (data as BinanceKline[]).map((k) => klineToRow(k, SYMBOL, INTERVAL));
    const { count } = await cryptoPrisma.binanceKlineFast.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return NextResponse.json({ ok: true, inserted: count });
  } catch (e) {
    console.error("[api/cron]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cron failed" },
      { status: 500 }
    );
  }
}
