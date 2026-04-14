import crypto from "crypto";
import { cryptoPrisma } from "@/lib/crypto-db";

export function randomToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Cria um token de verificação de e-mail com TTL (minutos).
 * Remove tokens expirados antes (limpeza preguiçosa).
 */
export async function createEmailVerificationToken(userId: string, ttlMinutes = 30) {
  const now = new Date();
  await cryptoPrisma.emailVerificationToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  const token = randomToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
  await cryptoPrisma.emailVerificationToken.create({
    data: { userId, tokenHash, expiresAt },
  });
  return { token, expiresAt };
}

/**
 * Consome o token (uso único). Retorna { ok, userId } ou { ok: false, reason }.
 */
export async function consumeEmailVerificationToken(token: string) {
  const tokenHash = hashToken(token);
  const record = await cryptoPrisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!record) return { ok: false as const, reason: "not_found" };
  if (record.expiresAt <= new Date()) return { ok: false as const, reason: "expired" };
  await cryptoPrisma.emailVerificationToken.delete({ where: { tokenHash } });
  return { ok: true as const, userId: record.userId };
}
