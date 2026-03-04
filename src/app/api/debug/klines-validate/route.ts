/**
 * Validação de klines 1m: verifica se não há minutos pulados na tabela.
 * Apenas admin. GET /api/debug/klines-validate?symbol=BTCUSDT
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { bioPrisma } from "@/lib/bio-db";
import { Prisma } from "@/lib/prisma-bio-client";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const ONE_MINUTE_MS = 60 * 1000;

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

    const user = await bioPrisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const symbol = request.nextUrl.searchParams.get("symbol")?.trim() || "BTCUSDT";

    const [statsRow] = await bioPrisma.$queryRaw<[{ count: bigint; oldest: bigint | null; newest: bigint | null }]>(
      Prisma.sql`
        SELECT
          count(*)::bigint AS count,
          min("openTime") AS oldest,
          max("openTime") AS newest
        FROM backcrypto."BinanceKline"
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

    const gaps = await bioPrisma.$queryRaw<{ openTime: bigint; next_open: bigint }[]>(
      Prisma.sql`
        WITH ordered AS (
          SELECT
            "openTime",
            lead("openTime") OVER (ORDER BY "openTime") AS next_open
          FROM backcrypto."BinanceKline"
          WHERE symbol = ${symbol} AND "interval" = '1m'
        )
        SELECT "openTime", next_open
        FROM ordered
        WHERE next_open IS NOT NULL AND (next_open - "openTime") <> ${ONE_MINUTE_MS}
        ORDER BY "openTime"
        LIMIT 500
      `
    );

    const gapList = (Array.isArray(gaps) ? gaps : []).map((g) => ({
      from: Number(g.openTime),
      to: Number(g.next_open),
    }));

    return NextResponse.json({
      symbol,
      oldest: oldest != null ? new Date(oldest).toISOString() : null,
      newest: newest != null ? new Date(newest).toISOString() : null,
      count,
      days: Math.round(days * 100) / 100,
      ok: gapList.length === 0,
      gaps: gapList,
    });
  } catch (e) {
    console.error("[api/debug/klines-validate]", e);
    return NextResponse.json(
      { error: "Erro ao validar klines" },
      { status: 500 }
    );
  }
}
