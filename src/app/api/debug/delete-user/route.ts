/**
 * POST /api/debug/delete-user — apenas admin.
 * Remove usuário com tier free que nunca comprou plano (Stripe/PIX pago).
 * Body: { userId: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Tier, Role } from "@/lib/prisma-bio-client";
import { hasPurchasedCryptoPlan } from "@/lib/crypto-plan-purchase";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const adminId = typeof payload?.sub === "string" ? payload.sub : "";
    if (!adminId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await cryptoPrisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });
    if (!admin || admin.role !== Role.admin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    let body: { userId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
    }

    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!userId) return NextResponse.json({ error: "userId obrigatório" }, { status: 400 });

    if (userId === adminId) {
      return NextResponse.json({ error: "Não é possível excluir a própria conta" }, { status: 400 });
    }

    const target = await cryptoPrisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, tier: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    if (target.role === Role.admin) {
      return NextResponse.json({ error: "Não é possível excluir outro administrador" }, { status: 403 });
    }
    if (target.tier !== Tier.free) {
      return NextResponse.json(
        { error: "Só é permitido excluir usuários com tier free" },
        { status: 400 }
      );
    }

    if (await hasPurchasedCryptoPlan(userId)) {
      return NextResponse.json(
        { error: "Usuário já realizou compra de plano (cartão ou PIX); exclusão bloqueada" },
        { status: 400 }
      );
    }

    await cryptoPrisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/debug/delete-user]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
