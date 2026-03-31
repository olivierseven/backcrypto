import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import {
  createCryptoWelcomePackage,
  DEFAULT_ADMIN_WELCOME_DURATION_DAYS,
  MAX_ACCESS_DAYS,
  MIN_ACCESS_DAYS,
} from "@/lib/crypto-bonus";
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

  const adminUser = await cryptoPrisma.user.findUnique({
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
    dbg(`[crypto/admin/welcome-package] admin=${adminId.slice(0, 8)}... creating welcome package`);

    const body = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
    }

    const rawDays = body.durationDays ?? body.days ?? DEFAULT_ADMIN_WELCOME_DURATION_DAYS;
    const durationDays = typeof rawDays === "number" ? rawDays : Number(rawDays);
    if (!Number.isFinite(durationDays) || durationDays < MIN_ACCESS_DAYS || durationDays > MAX_ACCESS_DAYS) {
      return NextResponse.json(
        { error: `durationDays deve ser entre ${MIN_ACCESS_DAYS} e ${MAX_ACCESS_DAYS}` },
        { status: 400 },
      );
    }

    const user = await cryptoPrisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const result = await createCryptoWelcomePackage(userId, durationDays);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Erro ao criar pacote de boas-vindas" },
        { status: 500 }
      );
    }

    vLog(`[crypto/admin/welcome-package] welcome package created: admin=${adminId.slice(0, 8)}... user=${userId.slice(0, 8)}... coins=${result.coins}`);

    return NextResponse.json({
      success: true,
      message: "Pacote de boas-vindas criado com sucesso",
      data: {
        userId,
        coins: result.coins ?? durationDays,
        durationDays: result.durationDays ?? durationDays,
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
    error(`[crypto/admin/welcome-package] error: ${msg}`);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
