import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function GET() {
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "Token não encontrado" }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = typeof payload?.sub === "string" ? payload.sub : null;
    if (!userId) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const notifications = await cryptoPrisma.userNotification.findMany({
      where: {
        userId,
        ativo: true,
        expiredDate: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    console.error("[backcrypto/notifications]", error);
    return NextResponse.json({ success: true, notifications: [] });
  }
}
