/**
 * Em DEV: dispara o sync de klines (1m + 1h) no banco configurado em .env.
 * Chama a mesma lógica do /api/cron usando o CRON_SECRET do servidor.
 * Em produção retorna 404 — não afeta o banco de produção.
 * GET /api/debug/sync-klines
 */
export const dynamic = "force-dynamic";

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
    const cronUrl = `${baseUrl}/api/cron`;
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
    console.error("[api/debug/sync-klines]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
