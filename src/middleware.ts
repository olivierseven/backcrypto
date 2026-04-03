import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isPrivateCryptoPath,
  isAffiliateProtectedPath,
  affiliateLangFromPainelPath,
  CRYPTO_AFFILIATE_LOGIN_PAGE,
  AFFILIATE_JWT_COOKIE_NAME,
} from "@/lib/crypto-auth-next";
import { isCryptoDevPath, isCryptoDevRoutesEnabled } from "@/lib/crypto-dev-routes";

const BASE = "/crypto";
const SESSION_COOKIE = process.env.JWT_COOKIE_NAME || "session";
const AFFILIATE_SESSION_COOKIE = AFFILIATE_JWT_COOKIE_NAME;

/** Para o layout `(sys)` distinguir rotas que não usam sessão User (ex.: painel de afiliado). */
function nextWithCryptoPathname(request: NextRequest, pathname: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-crypto-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * 1) Redireciona URLs antigas com ?lang= para path /pt ou /en (público).
 * 2) Injeta x-lang para getLocaleFromRequest() (path pt|en ou ?lang=).
 * 3) Rotas privadas (/sistema, /conta, …) sem cookie de sessão → /login?next=…
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const rawPathname = url.pathname;
  const pathname = rawPathname.startsWith(BASE) ? rawPathname : `${BASE}${rawPathname}`;
  const appPathname = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;

  if (isCryptoDevPath(pathname) && !isCryptoDevRoutesEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  const normalized = appPathname === "" ? "/" : appPathname;
  const segments = normalized.split("/").filter(Boolean);
  const first = segments[0];
  const langParam = url.searchParams.get("lang");

  if (isAffiliateProtectedPath(pathname)) {
    const token = request.cookies.get(AFFILIATE_SESSION_COOKIE)?.value;
    if (!token) {
      const loginUrl = new URL(CRYPTO_AFFILIATE_LOGIN_PAGE, url.origin);
      const langPainel = affiliateLangFromPainelPath(pathname);
      if (langPainel) loginUrl.searchParams.set("lang", langPainel);
      loginUrl.searchParams.set("next", `${pathname}${url.search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isPrivateCryptoPath(pathname)) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) {
      const loginUrl = new URL(`${BASE}/login`, url.origin);
      loginUrl.searchParams.set("next", `${pathname}${url.search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (langParam === "en" || langParam === "pt") {
    if (normalized === "/" || normalized === "") {
      const u = url.clone();
      u.pathname = `${BASE}/${langParam}`;
      u.searchParams.delete("lang");
      return NextResponse.redirect(u);
    }
    if (first === "funcionalidade" && segments.length === 1) {
      const u = url.clone();
      u.pathname = `${BASE}/${langParam}/funcionalidade`;
      u.searchParams.delete("lang");
      return NextResponse.redirect(u);
    }
  }

  if (first === "pt" || first === "en") {
    const res = nextWithCryptoPathname(request, pathname);
    res.headers.set("x-lang", first);
    return res;
  }

  if (langParam === "en" || langParam === "pt") {
    const res = nextWithCryptoPathname(request, pathname);
    res.headers.set("x-lang", langParam);
    return res;
  }

  return nextWithCryptoPathname(request, pathname);
}

/**
 * Matchers têm de ser strings literais (sem template) — exigência do Next em build.
 * Com basePath `/crypto`, não repetir o prefixo nos matchers (ver next.config basePath).
 */
export const config = {
  matcher: [
    "/((?!_next|api|assets|favicon|icon|manifest|robots).*)",
    "/api/dev",
    "/api/dev/:path*",
  ],
};
