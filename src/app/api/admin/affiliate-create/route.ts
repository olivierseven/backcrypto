// POST /api/admin/affiliate-create — cria AffiliateAccount só com e-mail e senha (admin).
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cryptoPrisma } from "@/lib/crypto-db";
import { emailSearchHash, encryptEmail, normalizeEmail } from "@/lib/crypto";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { warn } from "@/lib/logger";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE)?.value;
    if (!token) {
      warn("[admin/affiliate-create] unauthorized: no token");
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
      warn(`[admin/affiliate-create] forbidden adminId=${adminId.slice(0, 8)}...`);
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json();
    const emailRaw = typeof body?.email === "string" ? body.email : "";
    const passwordRaw = typeof body?.password === "string" ? body.password : "";

    const emailParsed = emailSchema.safeParse(emailRaw);
    if (!emailParsed.success) {
      return NextResponse.json({ error: emailParsed.error.flatten().formErrors[0] || "E-mail inválido" }, { status: 400 });
    }
    const passParsed = passwordSchema.safeParse(passwordRaw);
    if (!passParsed.success) {
      return NextResponse.json({ error: passParsed.error.flatten().formErrors[0] || "Senha inválida" }, { status: 400 });
    }

    const emailNorm = normalizeEmail(emailParsed.data);
    const searchHash = emailSearchHash(emailNorm);

    const dup = await cryptoPrisma.affiliateAccount.findUnique({
      where: { emailSearchHash: searchHash },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json({ error: "Este e-mail já tem conta de afiliado" }, { status: 409 });
    }

    const { enc, iv, tag } = encryptEmail(emailNorm);
    const passwordHash = await bcrypt.hash(passParsed.data, 10);

    await cryptoPrisma.affiliateAccount.create({
      data: {
        emailEnc: enc,
        emailIv: iv,
        emailTag: tag,
        emailSearchHash: searchHash,
        passwordHash,
        ativo: true,
      },
    });

    return NextResponse.json({ ok: true, action: "created" });
  } catch (err) {
    warn("[admin/affiliate-create] error", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Erro ao criar conta de afiliado" }, { status: 500 });
  }
}
