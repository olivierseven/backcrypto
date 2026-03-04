import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { bioPrisma } from "@/lib/bio-db";
import { createBioWelcomePackage, BIO_WELCOME_COINS, BIO_WELCOME_DURATION_DAYS } from "@/lib/bio-bonus";
import { log as vLog, dbg, warn, error } from "@/lib/logger";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

async function requireAdmin(request: NextRequest): Promise<string> {
  const token = request.cookies.get(COOKIE)?.value;

  if (!token) {
    throw new Error("Não autenticado");
  }

  const { payload } = await jwtVerify(token, JWT_SECRET);
  const adminId = typeof payload?.sub === "string" ? payload.sub : "";

  if (!adminId) {
    throw new Error("Não autenticado");
  }

  const adminUser = await bioPrisma.user.findUnique({
    where: { id: adminId },
    select: { role: true },
  });

  if (!adminUser || adminUser.role !== "admin") {
    throw new Error("Acesso negado");
  }

  return adminId;
}

export async function POST(request: NextRequest) {
  try {
    const adminId = await requireAdmin(request);
    dbg(`[bio/admin/welcome-package] admin=${adminId.slice(0, 8)}... creating welcome package`);

    const body = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
    }

    const user = await bioPrisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const result = await createBioWelcomePackage(userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Erro ao criar pacote de boas-vindas" },
        { status: 500 }
      );
    }

    vLog(`[bio/admin/welcome-package] welcome package created: admin=${adminId.slice(0, 8)}... user=${userId.slice(0, 8)}... coins=${BIO_WELCOME_COINS}`);

    return NextResponse.json({
      success: true,
      message: "Pacote de boas-vindas criado com sucesso",
      data: {
        userId,
        coins: BIO_WELCOME_COINS,
        durationDays: BIO_WELCOME_DURATION_DAYS,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Não autenticado") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    if (msg === "Acesso negado") {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    error(`[bio/admin/welcome-package] error: ${msg}`);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
