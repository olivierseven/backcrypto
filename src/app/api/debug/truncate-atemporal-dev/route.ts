/**
 * TRUNCATE das tabelas atemporais (Renko / Range / Kagi / Renko2× / trade-count fast) apenas no banco URL_DEV.
 * Exige URL_DEV definido no .env (não usa fallback para DATABASE_URL).
 * POST — admin, só fora de produção.
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

/** Indica se URL_DEV está definido (painel debug). GET — admin, só fora de produção. */
export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Só em desenvolvimento" }, { status: 404 });
    }
    const denied = await requireAdmin(request);
    if (denied) return denied;
    return NextResponse.json({ urlDevConfigured: Boolean(process.env.URL_DEV?.trim()) });
  } catch (e) {
    console.error("[api/debug/truncate-atemporal-dev GET]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Só em desenvolvimento" }, { status: 404 });
    }
    const urlDev = process.env.URL_DEV?.trim();
    if (!urlDev) {
      return NextResponse.json(
        { error: "Defina URL_DEV no .env. Esta ação não usa DATABASE_URL para evitar truncar o banco errado." },
        { status: 400 }
      );
    }

    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = new PrismaClient({ datasources: { db: { url: urlDev } } });
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
        database: "URL_DEV",
      });
    } finally {
      await db.$disconnect();
    }
  } catch (e) {
    console.error("[api/debug/truncate-atemporal-dev]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Truncate failed" },
      { status: 500 }
    );
  }
}
