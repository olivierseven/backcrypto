/**
 * Token one-time para /api/auth/google/complete.
 * Permite passar o JWT de sessão de forma segura via URL (Chrome → app via deep link).
 * Token = base64url(jwt).base64url(hmac)
 */
import crypto from "crypto";

const SECRET = process.env.JWT_SECRET || "dev-secret";
const TTL_MS = 2 * 60 * 1000; // 2 minutos

function hmac(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function createCompleteToken(jwt: string): string {
  const payload = `${Date.now()}:${jwt}`;
  const sig = hmac(payload);
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

export function verifyCompleteToken(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expectedSig = hmac(payload);
  if (sig.length !== expectedSig.length) return null;
  let ok = true;
  for (let i = 0; i < sig.length; i++) {
    ok = ok && sig[i] === expectedSig[i];
  }
  if (!ok) return null;
  const [tsStr, jwt] = payload.split(":");
  if (!tsStr || !jwt) return null;
  const ts = parseInt(tsStr, 10);
  if (isNaN(ts) || Date.now() - ts > TTL_MS) return null;
  return jwt;
}
