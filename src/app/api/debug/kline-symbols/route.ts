/**
 * Lista de símbolos do servidor (tabela KlineSymbol, ativo = true).
 * GET /api/debug/kline-symbols?target=dev|prod — apenas admin, só em dev.
 * target=prod usa banco URL_PROD; target=dev usa DATABASE_URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma, getCryptoPrismaProd } from "@/lib/crypto-db";
import { getKlineSymbolsFromDb } from "@/app/lib/kline-symbols";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const DEFAULT_SYMBOLS = "BTCUSDT,ETHUSDT";

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
    const target = request.nextUrl.searchParams.get("target");
    const db =
      target === "prod"
        ? (() => {
            try {
              return getCryptoPrismaProd();
            } catch {
              return cryptoPrisma;
            }
          })()
        : cryptoPrisma;
    const symbols = await getKlineSymbolsFromDb(db);
    return NextResponse.json({ symbols: symbols.length > 0 ? symbols : DEFAULT_SYMBOLS.split(",") });
  } catch (e) {
    console.error("[api/debug/kline-symbols]", e);
    return NextResponse.json({ error: "Erro ao obter símbolos" }, { status: 500 });
  }
}
