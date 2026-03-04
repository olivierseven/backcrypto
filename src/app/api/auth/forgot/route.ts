// POST /api/auth/forgot — solicita link de redefinição de senha (Bio). Sempre mesma resposta para não revelar se e-mail existe.
import { NextRequest, NextResponse } from "next/server";
import { bioPrisma } from "@/lib/bio-db";
import { normalizeEmail, emailSearchHash, decryptEmail } from "@/lib/crypto";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate";
import { getRedirectOrigin } from "@/lib/redirect-origin";
import { createPasswordResetToken } from "@/lib/reset";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { warn } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_PATH = "/backcrypto";
const RESET_PAGE = `${BASE_PATH}/reset-password`;

const MAX_ATTEMPTS_PER_IP = 5;
const WINDOW_IP_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_EMAIL = 1;
const WINDOW_EMAIL_MS = 5 * 60 * 1000;

const RESET_EXPIRES_MINUTES = 30;

function redirect(path: string, req: NextRequest) {
  const origin = getRedirectOrigin(req);
  const target = path.startsWith("http") ? path : `${origin}${path}`;
  return NextResponse.redirect(target, { status: 303 });
}

export async function POST(req: NextRequest) {
  const ipKey = clientKeyFromRequest(req, "forgot");
  const { ok: okIp, retryAfter } = rateLimit(ipKey, MAX_ATTEMPTS_PER_IP, WINDOW_IP_MS);
  if (!okIp) {
    warn(`[auth/forgot] rate limit IP retry=${Math.ceil(retryAfter / 1000)}s`);
    return redirect(`${RESET_PAGE}?err=server`, req);
  }

  try {
    const form = await req.formData();
    const emailRaw = String(form.get("email") || "").trim();
    const emailNorm = normalizeEmail(emailRaw);
    if (!emailNorm) {
      return redirect(`${RESET_PAGE}?err=missing`, req);
    }

    const emailKey = `forgot:email:${emailSearchHash(emailNorm)}`;
    const { ok: okEmail } = rateLimit(emailKey, MAX_ATTEMPTS_PER_EMAIL, WINDOW_EMAIL_MS);
    if (!okEmail) {
      return redirect(`${RESET_PAGE}?sent=ok`, req);
    }

    const user = await bioPrisma.user.findUnique({
      where: { emailSearchHash: emailSearchHash(emailNorm) },
      select: { id: true, emailEnc: true, emailIv: true, emailTag: true },
    });

    if (user) {
      const token = await createPasswordResetToken(user.id);
      let toEmail: string;
      try {
        toEmail = decryptEmail(user.emailEnc, user.emailIv, user.emailTag);
      } catch {
        toEmail = emailNorm;
      }
      const origin = getRedirectOrigin(req);
      await sendPasswordResetEmail({
        to: toEmail,
        token,
        baseUrl: origin,
        resetPath: `${BASE_PATH}/reset-password?token=${encodeURIComponent(token)}`,
        expiresMinutes: RESET_EXPIRES_MINUTES,
      });
    }

    return redirect(`${RESET_PAGE}?sent=ok`, req);
  } catch (e) {
    warn(`[auth/forgot] error: ${e instanceof Error ? e.message : String(e)}`);
    return redirect(`${RESET_PAGE}?err=server`, req);
  }
}
