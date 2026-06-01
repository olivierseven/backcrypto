/**
 * Dispara o refresh do BinanceKlineCache (1m–1d).
 * - target=dev: banco URL_DEV (ou DATABASE_URL se URL_DEV não definido).
 * - target=prod: banco URL_PROD. Só em dev.
 * GET /api/debug/cache-refresh?target=dev|prod
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma, getCryptoPrismaDev, getCryptoPrismaProd } from "@/lib/crypto-db";
import { runBinanceKlineCacheRefresh } from "@/lib/binance-kline-cache-refresh";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
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
  const user = await cryptoPrisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const target = request.nextUrl.searchParams.get("target") === "prod" ? "prod" : "dev";

  if (target === "prod" && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "target=prod only in development" }, { status: 400 });
  }
  try {
    const db = target === "prod" ? getCryptoPrismaProd() : getCryptoPrismaDev();
    const data = await runBinanceKlineCacheRefresh(db);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[api/debug/cache-refresh]", target, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cache refresh failed" },
      { status: 500 }
    );
  }
}
