/**
 * Barras agregadas a partir de BinanceKlineCache2 (chartKind + interval).
 * GET — leitura; alimentado pelos processadores *Cache2FromFastFlags (VPS/cron).
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma, prismaForAtemporalCacheRead } from "@/lib/crypto-db";
import { getKlineSymbolsFromDb, resolveSymbol } from "@/app/lib/kline-symbols";
import { RENKO_CACHE_TICK_INTERVALS, TRADE_CACHE_TRADE_INTERVALS } from "@/app/lib/renkoKlineCache2Build";
import { resolveAggAtemporalKlineCacheLimit } from "@/lib/crypto-app-config";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const CHART_KINDS = new Set(["renko", "range", "kagi", "renko2x", "trades500"]);

const TICK_INTERVALS = new Set(RENKO_CACHE_TICK_INTERVALS.map((t) => `${t}ticks`));
const TRADE_INTERVALS = new Set(TRADE_CACHE_TRADE_INTERVALS.map((t) => `${t}trades`));

function toStr(v: unknown): string {
  if (v == null) return "0";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && v != null && "toString" in v) return String(v);
  return String(v);
}

function rowToKline(r: Record<string, unknown>) {
  return [
    Number(r.openTime),
    toStr(r.open),
    toStr(r.high),
    toStr(r.low),
    toStr(r.close),
    toStr(r.volume),
    Number(r.closeTime),
    toStr(r.quoteAssetVolume),
    Number(r.numberOfTrades ?? 0),
    toStr(r.takerBuyBaseAssetVolume),
    toStr(r.takerBuyQuoteAssetVolume),
    0,
  ];
}

function applyTimezoneOffset(data: (string | number)[][], offsetHours: number): (string | number)[][] {
  if (offsetHours === 0) return data;
  const offsetMs = offsetHours * 60 * 60 * 1000;
  return data.map((row) => {
    const out = [...row];
    out[0] = Number(row[0]) + offsetMs;
    out[6] = Number(row[6]) + offsetMs;
    return out;
  });
}

function isValidInterval(chartKind: string, interval: string): boolean {
  if (chartKind === "trades500") return TRADE_INTERVALS.has(interval);
  return TICK_INTERVALS.has(interval);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dbCache = prismaForAtemporalCacheRead();
  const symbolList = await getKlineSymbolsFromDb(dbCache);
  const symbol = resolveSymbol(searchParams.get("symbol"), symbolList);
  const chartKindRaw = (searchParams.get("chartKind") ?? "").trim().toLowerCase();
  const chartKind = CHART_KINDS.has(chartKindRaw) ? chartKindRaw : null;
  if (!chartKind) {
    return NextResponse.json(
      { error: "chartKind inválido (renko | range | kagi | renko2x | trades500)" },
      { status: 400 }
    );
  }
  const interval = (searchParams.get("interval") ?? "").trim();
  if (!interval || !isValidInterval(chartKind, interval)) {
    return NextResponse.json({ error: "interval inválido para este chartKind" }, { status: 400 });
  }
  const maxLimit = await resolveAggAtemporalKlineCacheLimit();
  const requestedRaw = Number(searchParams.get("limit"));
  const requested = Number.isFinite(requestedRaw) && requestedRaw > 0 ? Math.floor(requestedRaw) : maxLimit;
  const limit = Math.min(Math.max(requested, 1), maxLimit);

  let timezoneOffset = 0;
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    if (token) {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      const userId = typeof payload?.sub === "string" ? payload.sub : null;
      if (userId) {
        /* Fuso horário: utilizador na sessão local (DATABASE_URL), não em URL_PROD. */
        const user = await cryptoPrisma.user.findUnique({
          where: { id: userId },
          select: { timezoneOffset: true },
        });
        const tz = user?.timezoneOffset ?? 0;
        timezoneOffset = Math.max(-12, Math.min(12, Number(tz) || 0));
      }
    }
  } catch {
    /* sem sessão */
  }

  try {
    const rows = (await dbCache.binanceKlineCache2.findMany({
      where: { symbol, chartKind, interval },
      orderBy: { openTime: "desc" },
      take: limit,
    })) as unknown as Record<string, unknown>[];

    let data = rows.map(rowToKline);
    data = applyTimezoneOffset(data, timezoneOffset);
    return NextResponse.json({
      klines: data,
      timezoneOffset,
      chartKind,
      interval,
      /** Teto configurado (AppConfig / env); o cliente alinha merge e pedidos seguintes a este valor. */
      maxBars: maxLimit,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
