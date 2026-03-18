/**
 * Dispara o refresh do BinanceKlineCache (1m–1d) no ambiente atual.
 * Chama /api/cron/cache-refresh usando o CRON_SECRET do servidor.
 * Em produção exige admin (cookie). Em dev também pode exigir admin para consistência.
 * GET /api/debug/cache-refresh
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";

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

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not set in .env" },
      { status: 500 }
    );
  }

  try {
    const baseUrl =
      process.env.SYNC_URL?.replace(/\/$/, "") ??
      (() => {
        const url = new URL(request.url);
        return `${url.origin}${APP_CRYPTO_ROUTE_PREFIX}`;
      })();
    const cronUrl = `${baseUrl}/api/cron/cache-refresh`;
    const res = await fetch(cronUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error ?? `HTTP ${res.status}`, details: data },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("[api/debug/cache-refresh]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cache refresh failed" },
      { status: 500 }
    );
  }
}
