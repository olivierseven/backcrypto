// POST /api/auth/register — cadastro Bio (banco BG, envia e-mail de verificação)
import { NextResponse } from "next/server";
import { cryptoPrisma } from "@/lib/crypto-db";
import bcrypt from "bcryptjs";
import { emailSearchHash, encryptEmail, normalizeEmail, decryptEmail } from "@/lib/crypto";
import { createEmailVerificationToken } from "@/lib/token";
import { sendVerificationEmail } from "@/lib/mailer";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate";
import { nameSchema, passwordSchema, emailSchema } from "@/lib/validation";
import { log as vLog, dbg, warn, error } from "@/lib/logger";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";
import { getRedirectOrigin } from "@/lib/redirect-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNVERIFIED_TTL_HOURS = process.env.UNVERIFIED_TTL_HOURS ? Number(process.env.UNVERIFIED_TTL_HOURS) : 24;
const REGISTER_PER_IP_LIMIT = 5;
const REGISTER_PER_IP_WINDOW = 60 * 60_000;
const MAIL_PER_EMAIL_LIMIT = 1;
const MAIL_PER_EMAIL_WINDOW = 5 * 60_000;

function getBaseUrl(req: Request): string {
  return getRedirectOrigin(req) + APP_CRYPTO_ROUTE_PREFIX;
}

function loginUrl(req: Request, query = "") {
  return getBaseUrl(req) + "/login" + (query ? `?${query}` : "");
}

function registerPageUrl(req: Request, query = "") {
  return getBaseUrl(req) + "/register" + (query ? `?${query}` : "");
}

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  const u = user.length <= 2 ? user[0] + "*" : user[0] + "*".repeat(user.length - 2) + user[user.length - 1];
  return `${u}@${domain}`;
}

export async function POST(req: Request) {
  const start = Date.now();
  const baseUrl = getBaseUrl(req);

  const { ok: ipOk, retryAfter: ipRetry } = rateLimit(
    clientKeyFromRequest(req, "register"),
    REGISTER_PER_IP_LIMIT,
    REGISTER_PER_IP_WINDOW
  );
  if (!ipOk) {
    warn(`[auth/register] ip rate limited retry=${Math.ceil(ipRetry / 1000)}s`);
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(ipRetry / 1000)) },
    });
  }

  try {
    const f = await req.formData();
    const emailRaw = String(f.get("email") || "");
    const nameRaw = String(f.get("name") || "");
    const passRaw = String(f.get("password") || "");

    const emailParsed = emailSchema.safeParse(emailRaw);
    if (!emailParsed.success) {
      return NextResponse.redirect(registerPageUrl(req, "registered=fail&reason=email"), { status: 303 });
    }
    const emailNorm = normalizeEmail(emailParsed.data);
    if (!emailNorm) {
      return NextResponse.redirect(registerPageUrl(req, "registered=fail&reason=email"), { status: 303 });
    }

    const nameParsed = nameSchema.safeParse(nameRaw);
    if (!nameParsed.success) {
      return NextResponse.redirect(registerPageUrl(req, "registered=fail&reason=name"), { status: 303 });
    }
    const name = nameParsed.data;

    const passParsed = passwordSchema.safeParse(passRaw);
    if (!passParsed.success) {
      return NextResponse.redirect(registerPageUrl(req, "registered=fail&reason=password"), { status: 303 });
    }
    const password = passParsed.data;

    const searchHash = emailSearchHash(emailNorm);

    const { ok: mailOk, retryAfter: mailRetry } = rateLimit(
      `register:mail:${searchHash}`,
      MAIL_PER_EMAIL_LIMIT,
      MAIL_PER_EMAIL_WINDOW
    );
    if (!mailOk) {
      warn(`[auth/register] email rate limited retry=${Math.ceil(mailRetry / 1000)}s`);
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(mailRetry / 1000)) },
      });
    }

    const cutoff = new Date(Date.now() - UNVERIFIED_TTL_HOURS * 60 * 60 * 1000);
    await cryptoPrisma.user.deleteMany({
      where: {
        emailVerifiedAt: null,
        createdAt: { lt: cutoff },
      },
    });

    const exists = await cryptoPrisma.user.findUnique({ where: { emailSearchHash: searchHash } });

    if (exists) {
      if (!exists.emailVerifiedAt) {
        const { token } = await createEmailVerificationToken(exists.id, 30);
        const verifyLink = `${baseUrl.replace(/\/+$/, "")}/api/auth/verify?token=${encodeURIComponent(token)}`;
        const decrypted = decryptEmail(exists.emailEnc, exists.emailIv, exists.emailTag);
        dbg(`[auth/register] re-send verification to ${maskEmail(decrypted)}`);
        if (process.env.NODE_ENV !== "production") console.log("[auth/register] DEV — link de verificação:", verifyLink);
        await sendVerificationEmail({
          to: decrypted,
          token,
          baseUrl,
          verifyPath: `/api/auth/verify?token=${encodeURIComponent(token)}`,
          expiresMinutes: 30,
        });
        vLog(`[auth/register] verification email re-sent to ${maskEmail(decrypted)}`);
        return NextResponse.redirect(loginUrl(req, "registered=ok"), { status: 303 });
      }
      return NextResponse.redirect(registerPageUrl(req, "registered=fail&reason=email"), { status: 303 });
    }

    const { enc, iv, tag } = encryptEmail(emailNorm);
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await cryptoPrisma.user.create({
      data: {
        emailEnc: enc,
        emailIv: iv,
        emailTag: tag,
        emailSearchHash: searchHash,
        emailVerifiedAt: null,
        name,
        nickname: name || `user_${Date.now()}`,
        passwordHash,
      },
      select: { id: true, emailEnc: true, emailIv: true, emailTag: true },
    });

    const { token } = await createEmailVerificationToken(user.id, 30);
    const verifyPath = `/api/auth/verify?token=${encodeURIComponent(token)}`;
    const verifyLink = `${baseUrl.replace(/\/+$/, "")}/${verifyPath.replace(/^\/+/, "")}`;
    const emailPlain = decryptEmail(user.emailEnc, user.emailIv, user.emailTag);

    dbg(`[auth/register] user created: ${maskEmail(emailPlain)}`);
    dbg(`[auth/register] verify URL: ${verifyLink}`);
    if (process.env.NODE_ENV !== "production") console.log("[auth/register] DEV — link de verificação:", verifyLink);
    dbg(`[auth/register] calling sendVerificationEmail...`);
    await sendVerificationEmail({
      to: emailPlain,
      token,
      baseUrl,
      verifyPath,
      expiresMinutes: 30,
    });
    vLog(`[auth/register] verification email sent to ${maskEmail(emailPlain)} took=${Date.now() - start}ms`);

    return NextResponse.redirect(loginUrl(req, "registered=ok"), { status: 303 });
  } catch (err) {
    error(`[auth/register] internal error msg=${err instanceof Error ? err.message : err}`);
    return NextResponse.redirect(loginUrl(req, "error=register_failed"), { status: 303 });
  }
}
