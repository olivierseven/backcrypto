/**
 * Tokens de redefinição de senha (create + consume).
 * Token válido por 30 min; armazenamos o hash do token no banco.
 */
import crypto from "crypto";
import { bioPrisma } from "@/lib/bio-db";

const TOKEN_BYTES = 32;
const EXPIRES_MINUTES = 30;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Gera um token de reset, persiste o hash no banco e retorna o token em texto (para o link do e-mail).
 * Expira em 30 min.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + EXPIRES_MINUTES * 60 * 1000);
  await bioPrisma.passwordResetToken.upsert({
    where: { tokenHash },
    create: { tokenHash, userId, expiresAt },
    update: { userId, expiresAt },
  });
  return token;
}

/**
 * Valida o token, invalida (deleta) e retorna o userId. Se expirado ou inválido, retorna null.
 */
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  const row = await bioPrisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { userId: true, expiresAt: true },
  });
  if (!row) return null;
  if (new Date() > row.expiresAt) {
    await bioPrisma.passwordResetToken.delete({ where: { tokenHash } }).catch(() => {});
    return null;
  }
  await bioPrisma.passwordResetToken.delete({ where: { tokenHash } });
  return row.userId;
}
