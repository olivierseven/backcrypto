import { emailSearchHash, normalizeEmail } from "@/lib/crypto";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Role } from "@/lib/prisma-bio-client";

/**
 * Acesso à área "Contabilidade" (todas as linhas agregadas).
 *
 * 1. `CRYPTO_ACCOUNTING_ADMIN_EMAIL` no `.env` (opcional) — e-mail extra autorizado.
 * 2. Ou o e-mail do JWT de afiliado corresponde a um `User` com `role = admin` (mesmo e-mail que o login principal).
 */
export async function isAffiliateAccountingAdminEmail(email: string): Promise<boolean> {
  const norm = normalizeEmail(email);
  if (!norm) return false;

  const configured = process.env.CRYPTO_ACCOUNTING_ADMIN_EMAIL?.trim();
  if (configured && normalizeEmail(configured) === norm) {
    return true;
  }

  const user = await cryptoPrisma.user.findUnique({
    where: { emailSearchHash: emailSearchHash(norm) },
    select: { role: true },
  });
  return user?.role === Role.admin;
}
