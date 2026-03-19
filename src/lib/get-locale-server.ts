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
