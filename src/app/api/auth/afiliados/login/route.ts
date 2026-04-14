// POST /api/auth/afiliados/login — AffiliateAccount (DATABASE_URL, schema backcrypto).
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { normalizeEmail, emailSearchHash, decryptEmail } from "@/lib/crypto";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate";
import { getRedirectOrigin } from "@/lib/redirect-origin";
import { dbg, warn, error, log as vLog } from "@/lib/logger";
import {
  CRYPTO_BASE_PATH,
  safeAffiliateNext,
  withAffiliatePostLoginQuery,
  CRYPTO_AFFILIATE_LOGIN_PAGE,
  AFFILIATE_JWT_COOKIE_NAME,
} from "@/lib/crypto-auth-next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = AFFILIATE_JWT_COOKIE_NAME;

const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 60_000;

const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW) {
  console.warn("[auth/afiliados/login] Faltou JWT_SECRET no .env (usando dev-secret)");
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW || "dev-secret");

function resolveLoginPage(raw: string): string {
  const s = raw.trim();
  if (s.startsWith(`${CRYPTO_BASE_PATH}/`) && s.endsWith("/afiliados/login")) return s;
  return CRYPTO_AFFILIATE_LOGIN_PAGE;
}

function resolveAffiliateLang(form: FormData, loginPage: string): "en" | "pt" {
  const fromForm = String(form.get("lang") || "").trim();
  if (fromForm === "en" || fromForm === "pt") return fromForm;
  if (loginPage.includes("/en/afiliados/")) return "en";
  return "pt";
}

/** Preserva `lang` na URL após erro de login (tradução do formulário). */
function affiliateLoginErr(loginPage: string, lang: "en" | "pt", reason: string): string {
  return `${loginPage}?lang=${lang}&login=${reason}`;
}

function redirect(pathOrUrl: string, req: Request) {
  let origin = getRedirectOrigin(req);
  if (req) {
    const ua = req.headers.get("user-agent") || "";
    const isAppRequest =
      ua.includes("wv") ||
      ua.includes("WebView") ||
      (ua.includes("Android") && ua.includes("Version"));
    if (isAppRequest && origin.includes("localhost")) {
      origin = origin.replace("localhost", "10.0.2.2");
    } else if (isAppRequest && origin.includes("127.0.0.1")) {
      origin = origin.replace("127.0.0.1", "10.0.2.2");
    }
  }
  const target = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${origin}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
  return NextResponse.redirect(target, { status: 303 });
}

export async function POST(req: Request) {
  const { ok, retryAfter } = rateLimit(
    clientKeyFromRequest(req, "afiliados-login"),
    MAX_LOGIN_ATTEMPTS,
    LOGIN_WINDOW_MS
  );
  if (!ok) {
    warn(`[auth/afiliados/login] ip rate limited retry=${Math.ceil(retryAfter / 1000)}s`);
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(retryAfter / 1000)) },
    });
  }

  try {
    const form = await req.formData();
    const emailRaw = String(form.get("email") || "");
    const pass = String(form.get("password") || "");
    const rawNext = String(form.get("next") || "").trim();
    const loginPage = resolveLoginPage(String(form.get("loginPage") || ""));
    const lang = resolveAffiliateLang(form, loginPage);

    const emailNorm = normalizeEmail(emailRaw);
    if (!emailNorm || !pass) {
      warn("[auth/afiliados/login] missing email or password");
      return redirect(affiliateLoginErr(loginPage, lang, "missing"), req);
    }

    dbg(`[auth/afiliados/login] processing email=${emailNorm.slice(0, 3)}...@${emailNorm.split("@")[1]}`);

    const row = await cryptoPrisma.affiliateAccount.findUnique({
      where: { emailSearchHash: emailSearchHash(emailNorm) },
      select: {
        id: true,
        passwordHash: true,
        emailEnc: true,
        emailIv: true,
        emailTag: true,
        ativo: true,
      },
    });

    if (!row) {
      warn(`[auth/afiliados/login] not found email=${emailNorm.slice(0, 3)}...@${emailNorm.split("@")[1]}`);
      return redirect(affiliateLoginErr(loginPage, lang, "fail"), req);
    }

    if (!row.ativo) {
      warn(`[auth/afiliados/login] inactive id=${row.id.slice(0, 8)}...`);
      return redirect(affiliateLoginErr(loginPage, lang, "inactive"), req);
    }

    const okPass = await bcrypt.compare(pass, row.passwordHash);
    if (!okPass) {
      warn(`[auth/afiliados/login] invalid password id=${row.id.slice(0, 8)}...`);
      return redirect(affiliateLoginErr(loginPage, lang, "fail"), req);
    }

    const emailPlain = decryptEmail(row.emailEnc, row.emailIv, row.emailTag);

    await cryptoPrisma.affiliateAccount.update({
      where: { id: row.id },
      data: { lastLoginAt: new Date() },
    });

    const jwt = await new SignJWT({
      sub: row.id,
      email: emailPlain,
      affiliate: true,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    const safeNext = safeAffiliateNext(rawNext || undefined, lang);
    const redirectTarget = withAffiliatePostLoginQuery(safeNext);

    vLog(`[auth/afiliados/login] success redirect=${redirectTarget}`);

    const res = redirect(redirectTarget, req);
    const maxAge = 24 * 60 * 60;
    res.cookies.set(COOKIE, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    return res;
  } catch (e) {
    error("[auth/afiliados/login] internal error", e instanceof Error ? e.message : e);
    return redirect(`${CRYPTO_AFFILIATE_LOGIN_PAGE}?lang=pt&login=server`, req);
  }
}
