// GET /api/auth/google/complete — finaliza OAuth no app (WebView recebe cookie e redireciona)
// Chamado pelo app via biogenerator://oauth?url=... quando o usuário retorna do Chrome
import { NextResponse } from "next/server";
import { getRedirectOrigin } from "@/lib/redirect-origin";
import { verifyCompleteToken } from "@/lib/oauth-complete-token";
import { log as vLog, warn, error, dbg } from "@/lib/logger";

const BASE_PATH = "/backcrypto";
const LOGIN_PAGE = `${BASE_PATH}/login`;
const DEFAULT_NEXT = `${BASE_PATH}/sistema`;

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const COOKIE_LAST = `${COOKIE}_last`;
const COOKIE_IAT = `${COOKIE}_iat`;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const next = url.searchParams.get("next") || DEFAULT_NEXT;

  const origin = getRedirectOrigin(req);

  function redirectTo(path: string, status = 303) {
    const target = path.startsWith("http") ? path : `${origin}${path.startsWith("/") ? path : `/${path}`}`;
    return NextResponse.redirect(target, { status });
  }

  if (!token) {
    warn("[bio/auth/google/complete] missing token");
    return redirectTo(`${LOGIN_PAGE}?login=server`);
  }

  const jwt = verifyCompleteToken(token);
  if (!jwt) {
    warn("[bio/auth/google/complete] invalid or expired token");
    return redirectTo(`${LOGIN_PAGE}?login=server`);
  }

  const redirectPath = next.startsWith("/") ? next : DEFAULT_NEXT;
  const ua = req.headers.get("user-agent") || "";
  vLog(`[bio/auth/google/complete] success redirect=${redirectPath} ua=${ua.slice(0, 60)}...`);
  dbg(`[bio/auth/google/complete] referer=${req.headers.get("referer") || "(none)"}`);

  const r = redirectTo(redirectPath);

  const baseCookie = {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  r.cookies.set(COOKIE, jwt, { ...baseCookie, maxAge: 24 * 60 * 60 });
  const now = Date.now().toString();
  r.cookies.set(COOKIE_IAT, now, baseCookie);
  r.cookies.set(COOKIE_LAST, now, baseCookie);

  return r;
}
