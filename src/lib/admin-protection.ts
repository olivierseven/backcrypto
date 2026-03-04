import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { bioPrisma } from "@/lib/bio-db";
import { decryptEmail } from "@/lib/crypto";

const BASE_PATH = "/backcrypto";
const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

export interface AdminUser {
  id: string;
  name: string;
  tier: string;
  role: string;
  email: string | null;
}

export async function requireAdmin(): Promise<AdminUser> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE)?.value;

    if (!token) {
      redirect(`${BASE_PATH}/login`);
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = typeof payload?.sub === "string" ? payload.sub : "";

    if (!userId) {
      redirect(`${BASE_PATH}/login`);
    }

    const user = await bioPrisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, tier: true, role: true, emailEnc: true, emailIv: true, emailTag: true },
    });

    if (!user || user.role !== "admin") {
      redirect(`${BASE_PATH}/sistema`);
    }

    let email: string | null = null;
    try {
      email = decryptEmail(user.emailEnc, user.emailIv, user.emailTag);
    } catch {
      email = user.name;
    }

    return {
      id: user.id,
      name: user.name || email || "Admin",
      tier: user.tier,
      role: user.role,
      email,
    };
  } catch {
    redirect(`${BASE_PATH}/login`);
  }
}
