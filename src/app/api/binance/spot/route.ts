/**
 * Preço atual e fechamento da última hora do dia anterior (UTC).
 * Variação = (fechamento atual) vs (fechamento do candle 1h que termina à 00:00 UTC).
 * GET /api/binance/spot?symbol=BTCUSDT
 */
import { NextRequest, NextResponse } from "next/server";
import { cryptoPrisma } from "@/lib/crypto-db";

const ONE_HOUR_MS = 60 * 60 * 1000;

function startOfTodayUtcMs(): number {
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

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "BTCUSDT";
  try {
    const startOfToday = startOfTodayUtcMs();
    const lastHourPrevDayOpen = startOfToday - ONE_HOUR_MS; // 23:00 UTC do dia anterior

    const [latest, prevDayLastHour, prevDayLast1m] = await Promise.all([
      cryptoPrisma.binanceKlineFast.findFirst({
        where: { symbol, interval: "1m" },
        orderBy: { openTime: "desc" },
        select: { close: true },
      }),
      cryptoPrisma.binanceKline.findFirst({
        where: {
          symbol,
          interval: "1h",
          openTime: BigInt(lastHourPrevDayOpen),
        },
        select: { close: true },
      }),
      cryptoPrisma.binanceKlineFast.findFirst({
        where: { symbol, interval: "1m", openTime: { lt: BigInt(startOfToday) } },
        orderBy: { openTime: "desc" },
        select: { close: true },
      }),
    ]);

    const currentClose = latest?.close != null ? String(latest.close) : null;
    const prevDayClose =
      (prevDayLastHour?.close != null ? String(prevDayLastHour.close) : null) ??
      (prevDayLast1m?.close != null ? String(prevDayLast1m.close) : null);

    return NextResponse.json({
      currentClose,
      prevDayClose,
    });
  } catch (e) {
    console.error("[api/binance/spot]", e);
    return NextResponse.json(
      { error: "Failed to fetch spot from database" },
      { status: 500 }
    );
  }
}
