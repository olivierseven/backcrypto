// GET /api/auth/logout — limpa sessão (cookies) e redireciona para login
import { NextResponse } from "next/server";
import { getRedirectOrigin } from "@/lib/redirect-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const COOKIE_LAST = `${COOKIE}_last`;
const COOKIE_IAT = `${COOKIE}_iat`;
const LOGIN_PAGE = "/crypto/login";

const baseCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 0,
};

export async function GET(req: Request) {
  const origin = getRedirectOrigin(req);
  const loginUrl = `${origin}${LOGIN_PAGE}`;
  const res = NextResponse.redirect(loginUrl, { status: 303 });
  res.cookies.set(COOKIE, "", baseCookie);
  res.cookies.set(COOKIE_LAST, "", baseCookie);
  res.cookies.set(COOKIE_IAT, "", baseCookie);
  return res;
}
