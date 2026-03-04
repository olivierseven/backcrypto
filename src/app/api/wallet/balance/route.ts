import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { bioPrisma } from "@/lib/bio-db";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function GET() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return NextResponse.json({ balance: null, authenticated: false });

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = typeof payload?.sub === "string" ? payload.sub : null;
    if (!userId) return NextResponse.json({ balance: null, authenticated: false });

    const wallet = await bioPrisma.userCoinWallet.findUnique({
      where: { userId },
      select: { balance: true },
    });

    return NextResponse.json({
      balance: wallet?.balance ?? 0,
      authenticated: true,
    });
  } catch {
    return NextResponse.json({ balance: null, authenticated: false });
  }
}
