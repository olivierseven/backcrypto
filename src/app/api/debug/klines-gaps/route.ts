/**
 * Registrar gaps conhecidos (sem dado na Binance). Validação passa a ignorá-los.
 * Apenas admin. Só em dev. POST /api/debug/klines-gaps
 * Body: { symbol?: string, target?: "dev"|"prod", gaps: [...] }. target=prod usa URL_PROD.
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma, getCryptoPrismaDev, getCryptoPrismaProd } from "@/lib/crypto-db";
import { getKlineSymbolsFromDb, resolveSymbol } from "@/app/lib/kline-symbols";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Registro de gaps só disponível em desenvolvimento" }, { status: 404 });
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
    const db =
      target === "prod"
        ? (() => {
            try {
              return getCryptoPrismaProd();
            } catch (e) {
              throw new Error(e instanceof Error ? e.message : "URL_PROD not set");
            }
          })()
        : getCryptoPrismaDev();

    const symbolList = await getKlineSymbolsFromDb(db);
    const symbol = resolveSymbol((body.symbol as string)?.trim(), symbolList);
    const gaps = Array.isArray(body.gaps) ? body.gaps : [];
    const valid = gaps.filter(
      (g: unknown): g is { interval: "1m" | "5m" | "1h"; from: number; to: number } =>
        g != null &&
        typeof g === "object" &&
        ((g as { interval?: string }).interval === "1m" ||
          (g as { interval?: string }).interval === "5m" ||
          (g as { interval?: string }).interval === "1h") &&
        typeof (g as { from?: number }).from === "number" &&
        typeof (g as { to?: number }).to === "number"
    );

    if (valid.length === 0) {
      return NextResponse.json({ error: "Body: { gaps: [{ interval: '1m'|'5m'|'1h', from, to }] }" }, { status: 400 });
    }

    type GapItem = { interval: "1m" | "5m" | "1h"; from: number; to: number };
    const created = await db.binanceKlineGap.createMany({
      data: valid.map((g: GapItem) => ({
        symbol,
        interval: g.interval,
        gapFrom: BigInt(g.from),
        gapTo: BigInt(g.to),
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      ok: true,
      symbol,
      registered: created.count,
    });
  } catch (e) {
    console.error("[api/debug/klines-gaps]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao registrar gaps" },
      { status: 500 }
    );
  }
}
