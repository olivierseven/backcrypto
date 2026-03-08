// GET /api/auth/check — verifica sessão (cookie JWT) e devolve role/tier do usuário no banco Bio. Para debug admin.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET_RAW = process.env.JWT_SECRET;
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW || "dev-secret");

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE)?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = typeof payload?.sub === "string" ? payload.sub : undefined;

    if (!userId) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const user = await cryptoPrisma.user.findUnique({
      where: { id: userId },
      select: { role: true, tier: true },
    });

    return NextResponse.json({
      authenticated: true,
      userId,
      role: user?.role ?? "user",
      tier: user?.tier ?? "free",
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
