/**
 * TRUNCATE das tabelas atemporais (Renko / Range / Kagi / Renko2× / trade-count fast / cache2)
 * no banco **URL_PROD** (produção). Mesmas tabelas que truncate-atemporal-dev.
 * GET/POST — admin, só em desenvolvimento local (igual ao resto do debug Hist prod).
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { PrismaClient } from "@/lib/prisma-bio-client";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const TRUNCATE_SQL = `
  TRUNCATE TABLE backcrypto."BinanceRenkoFast", backcrypto."BinanceRangeFast", backcrypto."BinanceKagiFast",
    backcrypto."BinanceRenko2xFast", backcrypto."BinanceTradeCountFast", backcrypto."BinanceKlineCache2"
`;

async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
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
  return null;
}

/** Indica se URL_PROD está definido (painel debug Hist prod). GET — admin, só fora de produção deploy. */
export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Só em desenvolvimento" }, { status: 404 });
    }
    const denied = await requireAdmin(request);
    if (denied) return denied;
    return NextResponse.json({ urlProdConfigured: Boolean(process.env.URL_PROD?.trim()) });
  } catch (e) {
    console.error("[api/debug/truncate-atemporal-prod GET]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Só em desenvolvimento" }, { status: 404 });
    }
    if (!process.env.URL_PROD?.trim()) {
      return NextResponse.json(
        { error: "Defina URL_PROD no .env. Esta ação usa o banco de produção (não DATABASE_URL local)." },
        { status: 400 }
      );
    }

    const denied = await requireAdmin(request);
    if (denied) return denied;

    const urlProd = process.env.URL_PROD!.trim();
    const db = new PrismaClient({ datasources: { db: { url: urlProd } } });
    try {
      await db.$executeRawUnsafe(TRUNCATE_SQL.trim());
      return NextResponse.json({
        ok: true,
        tables: [
          "BinanceRenkoFast",
          "BinanceRangeFast",
          "BinanceKagiFast",
          "BinanceRenko2xFast",
          "BinanceTradeCountFast",
          "BinanceKlineCache2",
        ],
        database: "URL_PROD",
      });
    } finally {
      await db.$disconnect();
    }
  } catch (e) {
    console.error("[api/debug/truncate-atemporal-prod]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Truncate failed" },
      { status: 500 }
    );
  }
}
