import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { AFFILIATE_JWT_COOKIE_NAME } from "@/lib/crypto-auth-next";
import { isAffiliateAccountAtivo } from "@/lib/affiliate-account-ativo";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

/** Retorna o id da `AffiliateAccount` se o cookie JWT de afiliado for válido; senão `null`. */
export async function getAffiliateAccountIdFromCookie(): Promise<string | null> {
  const session = await getAffiliateSessionFromCookie();
  return session?.accountId ?? null;
}

/** Sessão de afiliado (conta + e-mail no JWT) para autorização em rotas que precisam de admin. */
export async function getAffiliateSessionFromCookie(): Promise<{ accountId: string; email: string } | null> {
  const token = (await cookies()).get(AFFILIATE_JWT_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.affiliate !== true) return null;
    const sub = payload.sub;
    const email = payload.email;
    if (typeof sub !== "string" || typeof email !== "string") return null;
    if (!(await isAffiliateAccountAtivo(sub))) return null;
    return { accountId: sub, email };
  } catch {
    return null;
  }
}
