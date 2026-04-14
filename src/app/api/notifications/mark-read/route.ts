import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function PUT(request: NextRequest) {
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "Token não encontrado" }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = typeof payload?.sub === "string" ? payload.sub : null;
    if (!userId) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const { notificationId } = await request.json();
    if (!notificationId) return NextResponse.json({ error: "ID da notificação é obrigatório" }, { status: 400 });

    await cryptoPrisma.userNotification.updateMany({
      where: { idNotification: notificationId, userId },
      data: { ativo: false },
    });

    return NextResponse.json({ success: true, message: "Notificação marcada como lida" });
  } catch (error) {
    console.error("[backcrypto/notifications/mark-read]", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
