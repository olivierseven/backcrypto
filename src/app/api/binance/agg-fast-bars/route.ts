/**
 * Barras agregadas Renko / Range / Kagi / Renko2× / trade-count (Binance*Fast).
 * Intervalos típicos: 5ticks (Renko, Range, Kagi, Renko2×); 500trades (velas por contagem de trades).
 * GET — leitura (cache no banco). POST — ingestão (worker VPS, ferramentas); o browser em /sistema não envia POST.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { getKlineSymbolsFromDb, isAllowedSymbol, resolveSymbol } from "@/app/lib/kline-symbols";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const CORRETORA = "binance";

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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbolList = await getKlineSymbolsFromDb(cryptoPrisma);
  const symbol = resolveSymbol(searchParams.get("symbol"), symbolList);
  const kindRaw = (searchParams.get("kind") ?? "").toLowerCase();
  const kind =
    kindRaw === "renko" || kindRaw === "range" || kindRaw === "kagi" || kindRaw === "renko2x" || kindRaw === "trades500"
      ? kindRaw
      : null;
  if (!kind) {
    return NextResponse.json({ error: "kind inválido (renko | range | kagi | renko2x | trades500)" }, { status: 400 });
  }
  const intervalParam = (searchParams.get("interval") ?? "").trim();
  const interval =
    kind === "trades500" ? intervalParam || "500trades" : intervalParam || "5ticks";
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 1000, 1), 5000);

  let timezoneOffset = 0;
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    if (token) {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      const userId = typeof payload?.sub === "string" ? payload.sub : null;
      if (userId) {
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

  const where = { corretora: CORRETORA, symbol, interval };

  try {
    const rows: Record<string, unknown>[] = await (async () => {
      switch (kind) {
        case "renko":
          return (await cryptoPrisma.binanceRenkoFast.findMany({
            where,
            orderBy: { openTime: "desc" },
            take: limit,
          })) as unknown as Record<string, unknown>[];
        case "range":
          return (await cryptoPrisma.binanceRangeFast.findMany({
            where,
            orderBy: { openTime: "desc" },
            take: limit,
          })) as unknown as Record<string, unknown>[];
        case "kagi":
          return (await cryptoPrisma.binanceKagiFast.findMany({
            where,
            orderBy: { openTime: "desc" },
            take: limit,
          })) as unknown as Record<string, unknown>[];
        case "renko2x":
          return (await cryptoPrisma.binanceRenko2xFast.findMany({
            where,
            orderBy: { openTime: "desc" },
            take: limit,
          })) as unknown as Record<string, unknown>[];
        case "trades500":
          return (await cryptoPrisma.binanceTradeCountFast.findMany({
            where,
            orderBy: { openTime: "desc" },
            take: limit,
          })) as unknown as Record<string, unknown>[];
        default: {
          const _exhaustive: never = kind;
          return _exhaustive;
        }
      }
    })();

    let data = rows.map(rowToKline);
    data = applyTimezoneOffset(data, timezoneOffset);
    return NextResponse.json({ klines: data, timezoneOffset, kind });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const MAX_INGEST_ROWS = 2000;

function toDec8(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(8);
}

type IngestRowIn = {
  symbol: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteAssetVolume: number;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: number;
  takerBuyQuoteAssetVolume: number;
};

function parseIngestRow(x: unknown): IngestRowIn | null {
  if (x == null || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const symbol = typeof o.symbol === "string" ? o.symbol.trim().toUpperCase() : "";
  if (!symbol || !/^[A-Z0-9]+$/.test(symbol)) return null;
  const openTime = Number(o.openTime);
  const closeTime = Number(o.closeTime);
  if (!Number.isFinite(openTime) || !Number.isFinite(closeTime)) return null;
  const open = Number(o.open);
  const high = Number(o.high);
  const low = Number(o.low);
  const close = Number(o.close);
  const volume = Number(o.volume);
  const quoteAssetVolume = Number(o.quoteAssetVolume);
  const numberOfTrades = Number(o.numberOfTrades);
  const takerBuyBaseAssetVolume = Number(o.takerBuyBaseAssetVolume);
  const takerBuyQuoteAssetVolume = Number(o.takerBuyQuoteAssetVolume);
  if (![open, high, low, close, volume, quoteAssetVolume, takerBuyBaseAssetVolume, takerBuyQuoteAssetVolume].every(Number.isFinite)) {
    return null;
  }
  if (!Number.isFinite(numberOfTrades)) return null;
  return {
    symbol,
    openTime,
    closeTime,
    open,
    high,
    low,
    close,
    volume,
    quoteAssetVolume,
    numberOfTrades,
    takerBuyBaseAssetVolume,
    takerBuyQuoteAssetVolume,
  };
}

export async function POST(request: NextRequest) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  let userId: string;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    userId = typeof payload?.sub === "string" ? payload.sub : "";
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const userRow = await cryptoPrisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!userRow) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const kindRaw = b.kind;
  const kind =
    kindRaw === "renko" || kindRaw === "range" || kindRaw === "kagi" || kindRaw === "renko2x" || kindRaw === "trades500"
      ? kindRaw
      : null;
  if (!kind) {
    return NextResponse.json({ error: "kind inválido (renko | range | kagi | renko2x | trades500)" }, { status: 400 });
  }
  const corretora = typeof b.corretora === "string" && b.corretora.trim() ? b.corretora.trim() : "binance";
  const intervalRaw = typeof b.interval === "string" && b.interval.trim() ? b.interval.trim() : "";
  const interval = kind === "trades500" ? intervalRaw || "500trades" : intervalRaw || "5ticks";
  if (!Array.isArray(b.rows)) {
    return NextResponse.json({ error: "rows deve ser array" }, { status: 400 });
  }
  if (b.rows.length === 0) {
    return NextResponse.json({ inserted: 0, kind });
  }
  if (b.rows.length > MAX_INGEST_ROWS) {
    return NextResponse.json({ error: `máx. ${MAX_INGEST_ROWS} linhas por request` }, { status: 400 });
  }

  const symbolList = await getKlineSymbolsFromDb(cryptoPrisma);
  const parsed: IngestRowIn[] = [];
  for (const item of b.rows) {
    const r = parseIngestRow(item);
    if (!r) return NextResponse.json({ error: "linha inválida em rows" }, { status: 400 });
    if (!isAllowedSymbol(r.symbol, symbolList)) {
      return NextResponse.json({ error: `símbolo não permitido: ${r.symbol}` }, { status: 400 });
    }
    parsed.push(r);
  }

  const data = parsed.map((r) => ({
    corretora,
    symbol: r.symbol,
    interval,
    openTime: BigInt(Math.trunc(r.openTime)),
    closeTime: BigInt(Math.trunc(r.closeTime)),
    open: toDec8(r.open),
    high: toDec8(r.high),
    low: toDec8(r.low),
    close: toDec8(r.close),
    volume: toDec8(r.volume),
    quoteAssetVolume: toDec8(r.quoteAssetVolume),
    numberOfTrades: Math.max(0, Math.trunc(r.numberOfTrades)),
    takerBuyBaseAssetVolume: toDec8(r.takerBuyBaseAssetVolume),
    takerBuyQuoteAssetVolume: toDec8(r.takerBuyQuoteAssetVolume),
  }));

  try {
    let count = 0;
    if (kind === "renko") {
      count = (await cryptoPrisma.binanceRenkoFast.createMany({ data, skipDuplicates: true })).count;
    } else if (kind === "range") {
      count = (await cryptoPrisma.binanceRangeFast.createMany({ data, skipDuplicates: true })).count;
    } else if (kind === "kagi") {
      count = (await cryptoPrisma.binanceKagiFast.createMany({ data, skipDuplicates: true })).count;
    } else if (kind === "renko2x") {
      count = (await cryptoPrisma.binanceRenko2xFast.createMany({ data, skipDuplicates: true })).count;
    } else {
      count = (await cryptoPrisma.binanceTradeCountFast.createMany({ data, skipDuplicates: true })).count;
    }
    return NextResponse.json({ inserted: count, kind });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
