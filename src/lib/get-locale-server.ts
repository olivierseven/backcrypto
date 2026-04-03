import { cookies, headers } from "next/headers";

export type Locale = "en" | "pt";

const LANG_COOKIE_NAME = "sevencoins-lang";

/**
 * Lê o idioma preferido no servidor:
 * 1) header x-lang — path /crypto/pt|en (middleware) ou ?lang=pt|en
 * 2) cookie sevencoins-lang
 * 3) fallback "pt"
 */
export async function getLocaleFromRequest(): Promise<Locale> {
  const headersList = await headers();
  const xLang = headersList.get("x-lang");
  if (xLang === "pt" || xLang === "en") return xLang;

  const cookieStore = await cookies();
  const cookie = cookieStore.get(LANG_COOKIE_NAME);
  if (cookie?.value === "pt" || cookie?.value === "en") return cookie.value as Locale;

  return "pt";
}

/**
 * Login de afiliados (`/crypto/afiliados/login`): prioriza `?lang=` da origem (link com `?lang=pt|en`),
 * depois o mesmo fluxo de {@link getLocaleFromRequest} (x-lang, cookie).
 */
export async function getLocaleForAffiliateLoginPage(
  searchParams: { lang?: string } | null | undefined
): Promise<Locale> {
  const q = searchParams?.lang;
  if (q === "pt" || q === "en") return q;
  return getLocaleFromRequest();
}
