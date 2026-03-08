/**
 * Registrar gaps conhecidos (sem dado na Binance). Validação passa a ignorá-los.
 * Apenas admin. POST /api/debug/klines-gaps
 * Body: { symbol?: string, gaps: { interval: "1m"|"1h", from: number, to: number }[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const symbol = (body.symbol as string)?.trim() || "BTCUSDT";
    const gaps = Array.isArray(body.gaps) ? body.gaps : [];
    const valid = gaps.filter(
      (g: unknown): g is { interval: "1m" | "1h"; from: number; to: number } =>
        g != null &&
        typeof g === "object" &&
        ((g as { interval?: string }).interval === "1m" || (g as { interval?: string }).interval === "1h") &&
        typeof (g as { from?: number }).from === "number" &&
        typeof (g as { to?: number }).to === "number"
    );

    if (valid.length === 0) {
      return NextResponse.json({ error: "Body: { gaps: [{ interval: '1m'|'1h', from, to }] }" }, { status: 400 });
    }

    const created = await cryptoPrisma.binanceKlineGap.createMany({
      data: valid.map((g) => ({
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
