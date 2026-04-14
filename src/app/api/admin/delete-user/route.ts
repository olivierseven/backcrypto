import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { log as vLog, warn, error } from "@/lib/logger";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE)?.value;

    if (!token) {
      warn("[crypto/admin/delete-user] unauthorized: no token");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const adminId = typeof payload?.sub === "string" ? payload.sub : "";

    if (!adminId) {
      warn("[crypto/admin/delete-user] unauthorized: invalid payload");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const adminUser = await cryptoPrisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!adminUser || adminUser.role !== "admin") {
      warn(`[crypto/admin/delete-user] forbidden: userId=${adminId.slice(0, 8)}... role=${adminUser?.role || "none"}`);
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    if (userId === adminId) {
      return NextResponse.json({ error: "Você não pode deletar sua própria conta" }, { status: 400 });
    }

    const userToDelete = await cryptoPrisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    });

    if (!userToDelete) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    if (userToDelete.role === "admin") {
      return NextResponse.json({ error: "Não é possível deletar outro administrador" }, { status: 403 });
    }

    await cryptoPrisma.user.delete({
      where: { id: userId },
    });

    vLog(`[crypto/admin/delete-user] user deleted: userId=${userId.slice(0, 8)}... by admin=${adminId.slice(0, 8)}...`);

    return NextResponse.json({
      success: true,
      message: "Usuário deletado com sucesso",
    });
  } catch (err) {
    error(`[crypto/admin/delete-user] error: ${err instanceof Error ? err.message : err}`);
    return NextResponse.json({ error: "Erro ao deletar usuário" }, { status: 500 });
  }
}
