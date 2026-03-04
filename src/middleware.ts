import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Injeta x-lang no header quando ?lang=pt|en está na URL.
 * Usado por getLocaleFromRequest() para metadata dinâmica (SEO).
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const langParam = url.searchParams.get("lang");

  if (langParam === "pt" || langParam === "en") {
    const response = NextResponse.next();
    response.headers.set("x-lang", langParam);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon|icon|manifest|robots).*)"],
};
