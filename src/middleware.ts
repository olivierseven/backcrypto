import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BASE = "/crypto";

/**
 * 1) Redireciona URLs antigas com ?lang= para path /pt ou /en (público).
 * 2) Injeta x-lang para getLocaleFromRequest() (path pt|en ou ?lang=).
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const pathname = url.pathname;

  if (!pathname.startsWith(BASE)) {
    return NextResponse.next();
  }

  const rest = pathname.slice(BASE.length);
  const normalized = rest === "" ? "/" : rest;
  const segments = normalized.split("/").filter(Boolean);
  const first = segments[0];
  const langParam = url.searchParams.get("lang");

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
    const res = NextResponse.next();
    res.headers.set("x-lang", first);
    return res;
  }

  if (langParam === "en" || langParam === "pt") {
    const res = NextResponse.next();
    res.headers.set("x-lang", langParam);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|assets|favicon|icon|manifest|robots).*)"],
};
