/**
 * Validação de klines: verifica ausência de intervalos pulados.
 * - 1m: tabela BinanceKlineFast (nenhum minuto pulado).
 * - 1h: tabela BinanceKline com interval '1h' (nenhuma hora pulada).
 * Apenas admin. GET /api/debug/klines-validate?symbol=BTCUSDT
 * Opcional: interval=1m | 1h — se omitido, valida as duas tabelas.
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Prisma } from "@/lib/prisma-bio-client";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

type IntervalKey = "1m" | "1h";

type ValidateSingleResult = {
  symbol: string;
  interval: IntervalKey;
  table: string;
  oldest: string | null;
  newest: string | null;
  count: number;
  days: number;
  ok: boolean;
  gaps: { from: number; to: number }[];
};

async function validate1m(symbol: string): Promise<ValidateSingleResult> {
  const [statsRow] = await cryptoPrisma.$queryRaw<
    [{ count: bigint; oldest: bigint | null; newest: bigint | null }]
  >(
    Prisma.sql`
      SELECT count(*)::bigint AS count, min("openTime") AS oldest, max("openTime") AS newest
      FROM backcrypto."BinanceKlineFast"
      WHERE symbol = ${symbol} AND "interval" = '1m'
    `
  );
  const count = Number(statsRow?.count ?? 0);
  const oldest = statsRow?.oldest != null ? Number(statsRow.oldest) : null;
  const newest = statsRow?.newest != null ? Number(statsRow.newest) : null;
  let days = 0;
  if (oldest != null && newest != null && newest > oldest) {
    days = (newest - oldest) / (24 * 60 * 60 * 1000);
  }
  const gaps = await cryptoPrisma.$queryRaw<{ openTime: bigint; next_open: bigint }[]>(
    Prisma.sql`
      WITH ordered AS (
        SELECT "openTime", lead("openTime") OVER (ORDER BY "openTime") AS next_open
        FROM backcrypto."BinanceKlineFast"
        WHERE symbol = ${symbol} AND "interval" = '1m'
      )
      SELECT "openTime", next_open FROM ordered
      WHERE next_open IS NOT NULL AND (next_open - "openTime") <> ${ONE_MINUTE_MS}
      ORDER BY "openTime" LIMIT 500
    `
  );
  let gapList = (Array.isArray(gaps) ? gaps : []).map((g) => ({
    from: Number(g.openTime),
    to: Number(g.next_open),
  }));
  const registered1m = await cryptoPrisma.binanceKlineGap.findMany({
    where: { symbol, interval: "1m" },
    select: { gapFrom: true, gapTo: true },
  });
  const registeredSet1m = new Set(registered1m.map((r) => `${Number(r.gapFrom)}_${Number(r.gapTo)}`));
  gapList = gapList.filter((g) => !registeredSet1m.has(`${g.from}_${g.to}`));
  return {
    symbol,
    interval: "1m",
    table: "BinanceKlineFast",
    oldest: oldest != null ? new Date(oldest).toISOString() : null,
    newest: newest != null ? new Date(newest).toISOString() : null,
    count,
    days: Math.round(days * 100) / 100,
    ok: gapList.length === 0,
    gaps: gapList,
  };
}

async function validate1h(symbol: string): Promise<ValidateSingleResult> {
  const [statsRow] = await cryptoPrisma.$queryRaw<
    [{ count: bigint; oldest: bigint | null; newest: bigint | null }]
  >(
    Prisma.sql`
      SELECT count(*)::bigint AS count, min("openTime") AS oldest, max("openTime") AS newest
      FROM backcrypto."BinanceKline"
      WHERE symbol = ${symbol} AND "interval" = '1h'
    `
  );
  const count = Number(statsRow?.count ?? 0);
  const oldest = statsRow?.oldest != null ? Number(statsRow.oldest) : null;
  const newest = statsRow?.newest != null ? Number(statsRow.newest) : null;
  let days = 0;
  if (oldest != null && newest != null && newest > oldest) {
    days = (newest - oldest) / (24 * 60 * 60 * 1000);
  }
  const gaps = await cryptoPrisma.$queryRaw<{ openTime: bigint; next_open: bigint }[]>(
    Prisma.sql`
      WITH ordered AS (
        SELECT "openTime", lead("openTime") OVER (ORDER BY "openTime") AS next_open
        FROM backcrypto."BinanceKline"
        WHERE symbol = ${symbol} AND "interval" = '1h'
      )
      SELECT "openTime", next_open FROM ordered
      WHERE next_open IS NOT NULL AND (next_open - "openTime") <> ${ONE_HOUR_MS}
      ORDER BY "openTime" LIMIT 500
    `
  );
  let gapList = (Array.isArray(gaps) ? gaps : []).map((g) => ({
    from: Number(g.openTime),
    to: Number(g.next_open),
  }));
  const registered1h = await cryptoPrisma.binanceKlineGap.findMany({
    where: { symbol, interval: "1h" },
    select: { gapFrom: true, gapTo: true },
  });
  const registeredSet1h = new Set(registered1h.map((r) => `${Number(r.gapFrom)}_${Number(r.gapTo)}`));
  gapList = gapList.filter((g) => !registeredSet1h.has(`${g.from}_${g.to}`));
  return {
    symbol,
    interval: "1h",
    table: "BinanceKline",
    oldest: oldest != null ? new Date(oldest).toISOString() : null,
    newest: newest != null ? new Date(newest).toISOString() : null,
    count,
    days: Math.round(days * 100) / 100,
    ok: gapList.length === 0,
    gaps: gapList,
  };
}

export async function GET(request: NextRequest) {
  try {
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

    const symbol = request.nextUrl.searchParams.get("symbol")?.trim() || "BTCUSDT";
    const intervalParam = request.nextUrl.searchParams.get("interval")?.trim().toLowerCase();

    if (intervalParam === "1h") {
      const result = await validate1h(symbol);
      return NextResponse.json(result);
    }
    if (intervalParam === "1m") {
      const result = await validate1m(symbol);
      return NextResponse.json(result);
    }
    const [result1m, result1h] = await Promise.all([validate1m(symbol), validate1h(symbol)]);
    return NextResponse.json({ "1m": result1m, "1h": result1h });
  } catch (e) {
    console.error("[api/debug/klines-validate]", e);
    return NextResponse.json(
      { error: "Erro ao validar klines" },
      { status: 500 }
    );
  }
}
