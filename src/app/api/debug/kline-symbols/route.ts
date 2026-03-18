/**
 * Lista de símbolos do servidor (KLINE_SYMBOLS). Para o painel em dev usar a mesma lista que o backfill/cron.
 * GET /api/debug/kline-symbols — apenas admin, só em dev.
 * Lê KLINE_SYMBOLS diretamente do env (sem cache) para refletir o .env atual.
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const DEFAULT_SYMBOLS = "BTCUSDT,ETHUSDT";

function readSymbolsFromEnv(): string[] {
  const raw =
    process.env.KLINE_SYMBOLS ?? process.env.NEXT_PUBLIC_KLINE_SYMBOLS ?? DEFAULT_SYMBOLS;
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Só em desenvolvimento" }, { status: 404 });
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
    const symbols = readSymbolsFromEnv();
    return NextResponse.json({ symbols: symbols.length > 0 ? symbols : DEFAULT_SYMBOLS.split(",") });
  } catch (e) {
    console.error("[api/debug/kline-symbols]", e);
    return NextResponse.json({ error: "Erro ao obter símbolos" }, { status: 500 });
  }
}
