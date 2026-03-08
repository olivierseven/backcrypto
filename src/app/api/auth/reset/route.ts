// POST /api/auth/reset — define nova senha com token do e-mail (Bio).
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cryptoPrisma } from "@/lib/crypto-db";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate";
import { getRedirectOrigin } from "@/lib/redirect-origin";
import { consumePasswordResetToken } from "@/lib/reset";
import { passwordSchema } from "@/lib/validation";
import { warn } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_PATH = "/backcrypto";
const RESET_PAGE = `${BASE_PATH}/reset-password`;
const LOGIN_PAGE = `${BASE_PATH}/login`;

const MAX_ATTEMPTS_PER_IP = 10;
const WINDOW_MS = 15 * 60 * 1000;

function redirect(path: string, req: NextRequest) {
  const origin = getRedirectOrigin(req);
  const target = path.startsWith("http") ? path : `${origin}${path}`;
  return NextResponse.redirect(target, { status: 303 });
}

export async function POST(req: NextRequest) {
  const ipKey = clientKeyFromRequest(req, "reset");
  const { ok } = rateLimit(ipKey, MAX_ATTEMPTS_PER_IP, WINDOW_MS);
  if (!ok) {
    warn("[auth/reset] rate limit IP");
    return redirect(`${RESET_PAGE}?err=server`, req);
  }

  try {
    const form = await req.formData();
    const token = String(form.get("token") || "").trim();
    const passwordRaw = String(form.get("password") || "");

    if (!token) {
      return redirect(`${RESET_PAGE}?err=invalid`, req);
    }

    const passParsed = passwordSchema.safeParse(passwordRaw);
    if (!passParsed.success) {
      return redirect(`${RESET_PAGE}?token=${encodeURIComponent(token)}&err=weak`, req);
    }
    const password = passParsed.data;

    const userId = await consumePasswordResetToken(token);
    if (!userId) {
      return redirect(`${RESET_PAGE}?err=expired`, req);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await cryptoPrisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return redirect(`${LOGIN_PAGE}?password_reset=ok`, req);
  } catch (e) {
    warn(`[auth/reset] error: ${e instanceof Error ? e.message : String(e)}`);
    return redirect(`${RESET_PAGE}?err=server`, req);
  }
}
