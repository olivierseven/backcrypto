/**
 * Bypass de manutenção por senha (MAINTENANCE_BYPASS_PASSWORD no .env).
 * Quem informar a senha correta recebe um cookie e continua acessando login/registro/reset.
 */
import crypto from "crypto";

const COOKIE_NAME = "maint_bypass";
const SALT = "maint-bypass-v1";

function getSecret(): string {
  return process.env.JWT_SECRET || "dev-secret";
}

export function createBypassToken(): string {
  const password = process.env.MAINTENANCE_BYPASS_PASSWORD;
  if (!password?.trim()) return "";
  const secret = getSecret();
  return crypto.createHmac("sha256", secret).update(SALT + password.trim()).digest("base64url");
}

export function verifyBypassCookie(cookieValue: string | undefined): boolean {
  if (!cookieValue?.trim()) return false;
  const expected = createBypassToken();
  if (!expected) return false;
  const a = Buffer.from(cookieValue.trim(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function isBypassConfigured(): boolean {
  return !!process.env.MAINTENANCE_BYPASS_PASSWORD?.trim();
}

export function getBypassCookieName(): string {
  return COOKIE_NAME;
}

export const MAINTENANCE_BYPASS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 24 * 60 * 60, // 24h
};
