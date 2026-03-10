// POST /api/auth/login — login (banco DATABASE_URL, schema backcrypto).
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { normalizeEmail, emailSearchHash, decryptEmail } from "@/lib/crypto";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate";
import { getRedirectOrigin } from "@/lib/redirect-origin";
import { dbg, warn, error, log as vLog } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const COOKIE_LAST = `${COOKIE}_last`;
const COOKIE_IAT = `${COOKIE}_iat`;

const LOGIN_PAGE = "/crypto/login";
const DEFAULT_NEXT = "/crypto/sistema";

const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 60_000;

const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW) {
  console.warn("[auth/login] Faltou JWT_SECRET no .env (usando dev-secret)");
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW || "dev-secret");

/** Redirect preservando host original (usa X-Forwarded-Host quando acessado via proxy). WebView Android: localhost → 10.0.2.2. */
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
  const target = pathOrUrl.startsWith("http") ? pathOrUrl : `${origin}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
  return NextResponse.redirect(target, { status: 303 });
}

export async function POST(req: Request) {
  const { ok, retryAfter } = rateLimit(
    clientKeyFromRequest(req, "login"),
    MAX_LOGIN_ATTEMPTS,
    LOGIN_WINDOW_MS
  );
  if (!ok) {
    warn(`[auth/login] ip rate limited retry=${Math.ceil(retryAfter / 1000)}s`);
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

    const emailNorm = normalizeEmail(emailRaw);
    if (!emailNorm || !pass) {
      warn("[auth/login] missing email or password");
      return redirect(`${LOGIN_PAGE}?login=missing`, req);
    }

    dbg(`[auth/login] processing email=${emailNorm.slice(0, 3)}...@${emailNorm.split("@")[1]}`);

    const user = await cryptoPrisma.user.findUnique({
      where: { emailSearchHash: emailSearchHash(emailNorm) },
      select: {
        id: true,
        passwordHash: true,
        emailVerifiedAt: true,
        emailEnc: true,
        emailIv: true,
        emailTag: true,
        isDeleted: true,
        dataExpiracao: true,
        role: true,
      },
    });

    if (!user) {
      warn(`[auth/login] user not found email=${emailNorm.slice(0, 3)}...@${emailNorm.split("@")[1]}`);
      return redirect(`${LOGIN_PAGE}?login=fail`, req);
    }

    const okPass = await bcrypt.compare(pass, user.passwordHash);
    if (!okPass) {
      warn(`[auth/login] invalid password userId=${user.id.slice(0, 8)}...`);
      return redirect(`${LOGIN_PAGE}?login=fail`, req);
    }

    if (!user.emailVerifiedAt) {
      warn(`[auth/login] email not verified userId=${user.id.slice(0, 8)}...`);
      return redirect(`${LOGIN_PAGE}?login=verify_pending`, req);
    }

    if (user.isDeleted) {
      if (user.dataExpiracao && new Date(user.dataExpiracao) < new Date()) {
        warn("[auth/login] account expired");
        return redirect(`${LOGIN_PAGE}?login=expired`, req);
      }
      warn("[auth/login] account deactivated → redirect to reativar");
      const emailPlain = decryptEmail(user.emailEnc, user.emailIv, user.emailTag);
      const tempJWT = await new SignJWT({
        sub: user.id,
        email: emailPlain,
        role: user.role || "user",
        isDeleted: user.isDeleted,
        dataExpiracao: user.dataExpiracao?.toISOString() || null,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(JWT_SECRET);
      const res = redirect("/crypto/reativar", req);
      res.cookies.set(COOKIE, tempJWT, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60,
      });
      return res;
    }

    const emailPlain = decryptEmail(user.emailEnc, user.emailIv, user.emailTag);
    const role = user.role || "user";

    const jwt = await new SignJWT({
      sub: user.id,
      email: emailPlain,
      role,
      isDeleted: user.isDeleted,
      dataExpiracao: user.dataExpiracao?.toISOString() || null,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    const safeNext =
      rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : DEFAULT_NEXT;

    vLog(`[auth/login] success redirect=${safeNext}`);

    const res = redirect(safeNext, req);
    const maxAge = 24 * 60 * 60;
    res.cookies.set(COOKIE, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    const now = Date.now().toString();
    res.cookies.set(COOKIE_IAT, now, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    res.cookies.set(COOKIE_LAST, now, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return res;
  } catch (e) {
    error("[auth/login] internal error", e instanceof Error ? e.message : e);
    return redirect(`${LOGIN_PAGE}?login=server`, req);
  }
}
