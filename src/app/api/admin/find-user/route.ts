import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { decryptEmail, emailSearchHash, normalizeEmail } from "@/lib/crypto";
import { warn } from "@/lib/logger";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE)?.value;

    if (!token) {
      warn("[bio/admin/find-user] unauthorized: no token");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const adminId = typeof payload?.sub === "string" ? payload.sub : "";

    if (!adminId) {
      warn("[bio/admin/find-user] unauthorized: invalid payload");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const adminUser = await cryptoPrisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!adminUser || adminUser.role !== "admin") {
      warn(`[bio/admin/find-user] forbidden: userId=${adminId.slice(0, 8)}... role=${adminUser?.role || "none"}`);
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, email } = body;

    if (!userId && !email) {
      return NextResponse.json({ error: "Informe userId ou email" }, { status: 400 });
    }

    let user = null;

    if (userId) {
      user = await cryptoPrisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          nickname: true,
          emailEnc: true,
          emailIv: true,
          emailTag: true,
          tier: true,
          role: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      });
    } else if (email) {
      const searchHash = emailSearchHash(normalizeEmail(String(email).trim()));
      user = await cryptoPrisma.user.findUnique({
        where: { emailSearchHash: searchHash },
        select: {
          id: true,
          name: true,
          nickname: true,
          emailEnc: true,
          emailIv: true,
          emailTag: true,
          tier: true,
          role: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      });
    }

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    let emailDecrypted: string;
    try {
      emailDecrypted = decryptEmail(user.emailEnc, user.emailIv, user.emailTag);
    } catch {
      emailDecrypted = "[erro ao descriptografar]";
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        email: emailDecrypted,
        tier: user.tier,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Erro ao buscar usuário" }, { status: 500 });
  }
}
