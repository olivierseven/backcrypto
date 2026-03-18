/**
 * Backfill de gaps: busca klines na API Binance para o intervalo indicado e insere na tabela.
 * Apenas admin. POST /api/debug/klines-backfill
 * Body: { symbol?: string, interval: "1m" | "5m" | "1h", from: number, to: number } (from/to em ms UTC)
 * Ou: { symbol?: string, gaps: { interval: "1m"|"5m"|"1h", from: number, to: number }[] }
 * Opcional: onlyMissing: true — quando symbol "all", só processa moedas que ainda não têm histórico nesse intervalo.
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { PrismaClient } from "@/lib/prisma-bio-client";
import { cryptoPrisma, getCryptoPrismaProd } from "@/lib/crypto-db";
import { getKlineSymbols, isAllowedSymbol, isBinanceInvalidSymbolError, resolveSymbol } from "@/app/lib/kline-symbols";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const CORRETORA = "binance";
const BINANCE_BASE = (process.env.BINANCE_API_BASE_URL || "https://api.binance.com").replace(/\/$/, "");
const LIMIT = 1000;
const ONE_MINUTE_MS = 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const DELAY_MS = 350;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchBinanceKlines(
  symbol: string,
  interval: "1m" | "5m" | "1h",
  startTime: number,
  endTime: number,
  options?: { omitEndTime?: boolean }
): Promise<[number, string, string, string, string, string, number, string, number, string, string, number][]> {
  const url = new URL(`${BINANCE_BASE}/api/v3/klines`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("startTime", String(startTime));
  if (!options?.omitEndTime) url.searchParams.set("endTime", String(endTime));
  const urlStr = url.toString();
  const res = await fetch(urlStr);
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 451) {
      throw new Error(
        "Binance 451: API bloqueada na região do servidor. Defina BINANCE_API_BASE_URL com a URL de um proxy (ex.: São Paulo) que encaminhe para https://api.binance.com"
      );
    }
    throw new Error(`Binance ${res.status}: ${text}`);
  }
  const data = JSON.parse(text) as unknown;
  if (!Array.isArray(data)) {
    console.warn("[klines-backfill] Binance non-array response:", text.slice(0, 300));
    return [];
  }
  return data as [number, string, string, string, string, string, number, string, number, string, string, number][];
}

function klineToRow(
  k: [number, string, string, string, string, string, number, string, number, string, string, number],
  symbol: string,
  interval: "1m" | "5m" | "1h"
) {
  return {
    corretora: CORRETORA,
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

/** Símbolos da lista env que ainda não têm nenhum dado no intervalo (para backfill "apenas novas moedas"). */
async function getSymbolsWithNoData(db: PrismaClient, interval: "1m" | "5m" | "1h"): Promise<string[]> {
  const SYMBOLS = getKlineSymbols();
  if (interval === "1m") {
    const withData = await db.binanceKlineFast.findMany({
      where: { corretora: CORRETORA, interval: "1m" },
      select: { symbol: true },
      distinct: ["symbol"],
    });
    const set = new Set(withData.map((r) => r.symbol));
    return SYMBOLS.filter((s) => !set.has(s));
  }
  if (interval === "5m") {
    const withData = await db.binanceKlineMonth.findMany({
      where: { corretora: CORRETORA, interval: "5m" },
      select: { symbol: true },
      distinct: ["symbol"],
    });
    const set = new Set(withData.map((r) => r.symbol));
    return SYMBOLS.filter((s) => !set.has(s));
  }
  const withData = await db.binanceKline.findMany({
    where: { corretora: CORRETORA, interval: "1h" },
    select: { symbol: true },
    distinct: ["symbol"],
  });
  const set = new Set(withData.map((r) => r.symbol));
  return SYMBOLS.filter((s) => !set.has(s));
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Backfill só disponível em desenvolvimento" }, { status: 404 });
    }

    const token = request.cookies.get(COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = typeof payload?.sub === "string" ? payload.sub : "";
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const user = await cryptoPrisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const target = body.target === "prod" ? "prod" : "dev";
    const db: PrismaClient =
      target === "prod"
        ? (() => {
            try {
              return getCryptoPrismaProd();
            } catch (e) {
              throw new Error(
                e instanceof Error ? e.message : "URL_PROD not set (banco de produção)"
              );
            }
          })()
        : cryptoPrisma;

    const symbolParam = (body.symbol as string)?.trim() || "BTCUSDT";
    const onlyMissing = body.onlyMissing === true;
    const SYMBOLS = getKlineSymbols();
    const symbolsToRun =
      symbolParam.toLowerCase() === "all"
        ? SYMBOLS
        : isAllowedSymbol(symbolParam)
          ? [symbolParam.trim().toUpperCase()]
          : [resolveSymbol(null)];

    type Gap = { interval: "1m" | "5m" | "1h"; from: number; to: number };
    let gaps: Gap[];
    if (Array.isArray(body.gaps) && body.gaps.length > 0) {
      gaps = body.gaps.filter((g: unknown) => {
        const x = g as Gap;
        return g != null && typeof g === "object" && (x.interval === "1m" || x.interval === "5m" || x.interval === "1h") && typeof x.from === "number" && typeof x.to === "number";
      }) as Gap[];
    } else if (
      (body.interval === "1m" || body.interval === "5m" || body.interval === "1h") &&
      typeof body.from === "number" &&
      typeof body.to === "number"
    ) {
      gaps = [{ interval: body.interval, from: body.from, to: body.to }];
    } else {
      return NextResponse.json(
        { error: "Body: { interval: '1m'|'5m'|'1h', from: number, to: number } ou { gaps: [...] }. symbol: 'all' = BTCUSDT e ETHUSDT." },
        { status: 400 }
      );
    }

    const stepMs = (interval: "1m" | "5m" | "1h") =>
      interval === "1m" ? ONE_MINUTE_MS : interval === "5m" ? FIVE_MINUTES_MS : ONE_HOUR_MS;
    let totalInserted1m = 0;
    let totalInserted5m = 0;
    let totalInserted1h = 0;
    const details: { symbol: string; interval: string; from: number; to: number; fetched: number; inserted: number }[] = [];

    for (const gap of gaps) {
      const symbolsForGap =
        onlyMissing && symbolParam.toLowerCase() === "all"
          ? await getSymbolsWithNoData(db, gap.interval)
          : symbolsToRun;
      if (symbolsForGap.length === 0 && onlyMissing) continue;

      for (const symbol of symbolsForGap) {
        try {
          const step = stepMs(gap.interval);
          const startTime = gap.from + step;
          const endTimeInclusive = gap.to - 1;
          if (startTime > endTimeInclusive) continue;

          let cursor = startTime;
          let gapFetched = 0;
          let gapInserted = 0;
          while (cursor <= endTimeInclusive) {
            let klines = await fetchBinanceKlines(symbol, gap.interval, cursor, endTimeInclusive);
            if (klines.length === 0 && cursor === startTime) {
              const fallbackEnd = gap.to + step - 1;
              klines = await fetchBinanceKlines(symbol, gap.interval, cursor, fallbackEnd);
              klines = klines.filter((k) => k[0] <= endTimeInclusive);
            }
            if (klines.length === 0 && cursor === startTime) {
              const wideStart = gap.from;
              const wideEnd = gap.to + step - 1;
              klines = await fetchBinanceKlines(symbol, gap.interval, wideStart, wideEnd);
              klines = klines.filter((k) => k[0] > gap.from && k[0] < gap.to);
            }
            if (klines.length === 0 && cursor === startTime && (gap.interval === "1h" || gap.interval === "5m")) {
              klines = await fetchBinanceKlines(symbol, gap.interval, gap.from, 0, { omitEndTime: true });
              klines = klines.filter((k) => k[0] > gap.from && k[0] < gap.to);
            }
            gapFetched += klines.length;
            if (klines.length === 0) break;

            const rows = klines.map((k) => klineToRow(k, symbol, gap.interval));
            const minOpen = rows.reduce((m, r) => (r.openTime < m ? r.openTime : m), rows[0].openTime);
            const maxOpen = rows.reduce((m, r) => (r.openTime > m ? r.openTime : m), rows[0].openTime);
            if (gap.interval === "1m") {
              const created = await db.binanceKlineFast.createMany({
                data: rows,
                skipDuplicates: true,
              });
              totalInserted1m += created.count;
              gapInserted += created.count;
            } else if (gap.interval === "5m") {
              await db.binanceKlineMonth.deleteMany({
                where: { corretora: CORRETORA, symbol, interval: "5m", openTime: { gte: minOpen, lte: maxOpen } },
              });
              const created = await db.binanceKlineMonth.createMany({ data: rows });
              totalInserted5m += created.count;
              gapInserted += created.count;
            } else {
              await db.binanceKline.deleteMany({
                where: { corretora: CORRETORA, symbol, interval: "1h", openTime: { gte: minOpen, lte: maxOpen } },
              });
              const created = await db.binanceKline.createMany({ data: rows });
              totalInserted1h += created.count;
              gapInserted += created.count;
            }
            const lastOpen = klines[klines.length - 1][0];
            cursor = lastOpen + step;
            if (klines.length < LIMIT) break;
            await sleep(DELAY_MS);
          }
          console.log(
            "[klines-backfill]",
            symbol,
            gap.interval,
            new Date(gap.from).toISOString(),
            "→",
            new Date(gap.to).toISOString(),
            "| fetched:",
            gapFetched,
            "inserted:",
            gapInserted
          );
          details.push({
            symbol,
            interval: gap.interval,
            from: gap.from,
            to: gap.to,
            fetched: gapFetched,
            inserted: gapInserted,
          });
        } catch (e) {
          if (isBinanceInvalidSymbolError(e)) {
            console.warn("[klines-backfill] Symbol not in API, skipping:", symbol);
            continue;
          }
          throw e;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      symbol: symbolParam,
      symbolsRun: symbolsToRun,
      inserted1m: totalInserted1m,
      inserted5m: totalInserted5m,
      inserted1h: totalInserted1h,
      details,
    });
  } catch (e) {
    console.error("[api/debug/klines-backfill]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao preencher gaps" },
      { status: 500 }
    );
  }
}
