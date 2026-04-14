import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { log as vLog, warn } from "@/lib/logger";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) {
    warn("[reactivate] unauthorized: missing token");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { payload } = await jwtVerify(token, JWT_SECRET).catch(() => ({ payload: null as any }));
  const userId = typeof payload?.sub === "string" ? payload.sub : null;
  if (!userId) {
    warn("[reactivate] unauthorized: no userId in JWT");
    return NextResponse.json({ error: "invalid_user" }, { status: 401 });
  }

  const user = await cryptoPrisma.user.findUnique({
    where: { id: userId },
    select: { isDeleted: true, dataExpiracao: true },
  });

  if (!user) {
    warn(`[reactivate] user not found userId=${userId.slice(0, 8)}...`);
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  if (!user.isDeleted) {
    warn(`[reactivate] user not deleted userId=${userId.slice(0, 8)}...`);
    return NextResponse.json({ error: "not_deleted" }, { status: 400 });
  }

  if (user.dataExpiracao && new Date(user.dataExpiracao) < new Date()) {
    warn(`[reactivate] account expired userId=${userId.slice(0, 8)}...`);
    return NextResponse.json({
      error: "account_expired",
      message: "Sua conta expirou e não pode mais ser reativada.",
    }, { status: 400 });
  }

  try {
    await cryptoPrisma.user.update({
      where: { id: userId },
      data: { isDeleted: false, dataExclusao: null, dataExpiracao: null },
    });
    vLog(`[reactivate] success userId=${userId.slice(0, 8)}...`);
    return NextResponse.json({
      success: true,
      message: "Conta reativada com sucesso! Você será redirecionado em instantes.",
    });
  } catch (e: unknown) {
    warn(`[reactivate] error userId=${userId.slice(0, 8)}... error=${e instanceof Error ? e.message : e}`);
    return NextResponse.json({ error: "database_error" }, { status: 500 });
  }
}
