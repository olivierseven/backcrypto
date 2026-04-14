// POST /api/admin/affiliate-from-user — cria/atualiza AffiliateAccount com o mesmo e-mail e senha do User (admin).
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { emailSearchHash, normalizeEmail } from "@/lib/crypto";
import { warn } from "@/lib/logger";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE)?.value;
    if (!token) {
      warn("[admin/affiliate-from-user] unauthorized: no token");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const adminId = typeof payload?.sub === "string" ? payload.sub : "";
    if (!adminId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const adminUser = await cryptoPrisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });
    if (!adminUser || adminUser.role !== "admin") {
      warn(`[admin/affiliate-from-user] forbidden adminId=${adminId.slice(0, 8)}...`);
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json();
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    const emailRaw = typeof body?.email === "string" ? body.email.trim() : "";

    if (!userId && !emailRaw) {
      return NextResponse.json({ error: "Informe userId ou email" }, { status: 400 });
    }

    const user = userId
      ? await cryptoPrisma.user.findUnique({
          where: { id: userId },
          select: {
            emailEnc: true,
            emailIv: true,
            emailTag: true,
            emailSearchHash: true,
            passwordHash: true,
          },
        })
      : await cryptoPrisma.user.findUnique({
          where: { emailSearchHash: emailSearchHash(normalizeEmail(emailRaw)) },
          select: {
            emailEnc: true,
            emailIv: true,
            emailTag: true,
            emailSearchHash: true,
            passwordHash: true,
          },
        });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const existing = await cryptoPrisma.affiliateAccount.findUnique({
      where: { emailSearchHash: user.emailSearchHash },
      select: { id: true },
    });

    await cryptoPrisma.affiliateAccount.upsert({
      where: { emailSearchHash: user.emailSearchHash },
      create: {
        emailEnc: user.emailEnc,
        emailIv: user.emailIv,
        emailTag: user.emailTag,
        emailSearchHash: user.emailSearchHash,
        passwordHash: user.passwordHash,
        ativo: true,
      },
      update: {
        emailEnc: user.emailEnc,
        emailIv: user.emailIv,
        emailTag: user.emailTag,
        passwordHash: user.passwordHash,
        ativo: true,
      },
    });

    return NextResponse.json({
      ok: true,
      action: existing ? "updated" : "created",
    });
  } catch (err) {
    warn("[admin/affiliate-from-user] error", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Erro ao conceder acesso de afiliado" }, { status: 500 });
  }
}
