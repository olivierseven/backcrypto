/**
 * Validação de klines para todas as moedas (lista do banco).
 * Retorna tabela: por símbolo, contagem e ok/problema para 1m, 5m, 1h.
 * Apenas admin. Só em dev. GET /api/debug/klines-validate-all?target=dev|prod
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { PrismaClient } from "@/lib/prisma-bio-client";
import { cryptoPrisma, getCryptoPrismaDev, getCryptoPrismaProd } from "@/lib/crypto-db";
import { getKlineSymbolsWithPeriods } from "@/app/lib/kline-symbols";
import { validate1m, validate5m, validate1h } from "@/app/lib/klines-validate";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export type ValidateAllRow = {
  symbol: string;
  count1m: number;
  count5m: number;
  count1h: number;
  ok1m: boolean;
  ok5m: boolean;
  ok1h: boolean;
  gapCount1m: number;
  gapCount5m: number;
  gapCount1h: number;
};

export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Validação só disponível em desenvolvimento" }, { status: 404 });
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

    const target = request.nextUrl.searchParams.get("target") === "prod" ? "prod" : "dev";
    const db: PrismaClient = target === "prod" ? (() => {
      try {
        return getCryptoPrismaProd();
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : "URL_PROD not set");
      }
    })() : getCryptoPrismaDev();

    const symbolsWithPeriods = await getKlineSymbolsWithPeriods(db);
    const rows: ValidateAllRow[] = [];
    const incomplete: string[] = [];
    const withGaps: string[] = [];

    for (const { symbol, requiredDays1m, requiredDays5m, requiredDays1h } of symbolsWithPeriods) {
      const [r1m, r5m, r1h] = await Promise.all([
        validate1m(db, symbol, requiredDays1m),
        validate5m(db, symbol, requiredDays5m),
        validate1h(db, symbol, requiredDays1h),
      ]);
      const ok1m = r1m.ok;
      const ok5m = r5m.ok;
      const ok1h = r1h.ok;
      const gapCount1m = r1m.gaps?.length ?? 0;
      const gapCount5m = r5m.gaps?.length ?? 0;
      const gapCount1h = r1h.gaps?.length ?? 0;
      const hasGaps = gapCount1m > 0 || gapCount5m > 0 || gapCount1h > 0;
      if (hasGaps) withGaps.push(symbol);
      rows.push({
        symbol,
        count1m: r1m.count,
        count5m: r5m.count,
        count1h: r1h.count,
        ok1m,
        ok5m,
        ok1h,
        gapCount1m,
        gapCount5m,
        gapCount1h,
      });
      if (!ok1m || !ok5m || !ok1h) {
        incomplete.push(symbol);
      }
    }

    return NextResponse.json({
      ok: true,
      target,
      rows,
      incomplete,
      withGaps,
    });
  } catch (e) {
    console.error("[api/debug/klines-validate-all]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao validar klines" },
      { status: 500 }
    );
  }
}
