// GET /api/auth/afiliados/logout — limpa cookie de afiliado e redireciona para login.
import { NextResponse } from "next/server";
import { getRedirectOrigin } from "@/lib/redirect-origin";
import { AFFILIATE_JWT_COOKIE_NAME, CRYPTO_AFFILIATE_LOGIN_PAGE } from "@/lib/crypto-auth-next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = AFFILIATE_JWT_COOKIE_NAME;

const baseCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 0,
};

export async function GET(req: Request) {
  const origin = getRedirectOrigin(req);
  const url = new URL(req.url);
  const loginParam = url.searchParams.get("login");
  const langParam = url.searchParams.get("lang");
  const loginPage = new URL(CRYPTO_AFFILIATE_LOGIN_PAGE, origin);
  if (langParam === "en" || langParam === "pt") {
    loginPage.searchParams.set("lang", langParam);
  }
  if (loginParam) {
    loginPage.searchParams.set("login", loginParam);
  }
  const res = NextResponse.redirect(loginPage.toString(), { status: 303 });
  res.cookies.set(COOKIE, "", baseCookie);
  return res;
}
