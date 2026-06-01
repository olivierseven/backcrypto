/**
 * POST /api/debug/access — admin only. Concede acesso lite ao usuário por N dias (1–365).
 * Body: { userId: string, days: number, target?: "prod" | "dev" }
 * target=prod → URL_PROD (produção). Omitido ou dev → DATABASE_URL / URL_DEV.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma, getCryptoPrismaProd } from "@/lib/crypto-db";
import { createAdminAccessPackage, MIN_ACCESS_DAYS, MAX_ACCESS_DAYS } from "@/lib/crypto-bonus";
import type { PrismaClient } from "@/lib/prisma-bio-client";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Rota só disponível em desenvolvimento local" }, { status: 404 });
    }

    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const adminId = typeof payload?.sub === "string" ? payload.sub : "";
    if (!adminId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const user = await cryptoPrisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    let body: { userId?: string; days?: number; target?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
    }

    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!userId) return NextResponse.json({ error: "userId obrigatório" }, { status: 400 });

    const days = typeof body.days === "number" ? body.days : Number(body.days);
    if (!Number.isFinite(days) || days < MIN_ACCESS_DAYS || days > MAX_ACCESS_DAYS) {
      return NextResponse.json(
        { error: `days deve ser entre ${MIN_ACCESS_DAYS} e ${MAX_ACCESS_DAYS}` },
        { status: 400 }
      );
    }

    const target = body.target === "prod" ? "prod" : "dev";
    let db: PrismaClient;
    try {
      db = target === "prod" ? getCryptoPrismaProd() : cryptoPrisma;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "URL_PROD não configurado" },
        { status: 500 }
      );
    }

    const result = await createAdminAccessPackage(userId, days, db);
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Erro ao conceder acesso" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      target,
      coins: result.coins,
      days: result.durationDays ?? days,
    });
  } catch (e) {
    console.error("[api/debug/access]", e);
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
