/**
 * Em DEV: dispara o refresh do BinanceKlineCache (agregados 3m–1D).
 * Chama /api/cron/cache-refresh usando o CRON_SECRET do servidor.
 * Em produção retorna 404 — não afeta o banco de produção.
 * GET /api/debug/cache-refresh
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 404 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not set in .env" },
      { status: 500 }
    );
  }

  try {
    const baseUrl = process.env.SYNC_URL?.replace(/\/$/, "") ?? (() => {
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
