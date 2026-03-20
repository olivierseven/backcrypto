/**
 * Destino pós-auth (login e-mail, OAuth) — alinhado à estratégia BioGenerator, com base /crypto.
 */
export const CRYPTO_BASE_PATH = "/crypto";
export const CRYPTO_LOGIN_PAGE = `${CRYPTO_BASE_PATH}/login`;
export const CRYPTO_DEFAULT_NEXT = `${CRYPTO_BASE_PATH}/sistema`;

/**
 * Só aceita path relativo seguro sob /crypto (evita open redirect).
 */
export function safeCryptoNext(raw: string | undefined | null): string {
  const fallback = CRYPTO_DEFAULT_NEXT;
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || !s.startsWith("/") || s.startsWith("//")) return fallback;
  if (!s.startsWith(CRYPTO_BASE_PATH)) return fallback;
  return s;
}

const PRIVATE_FIRST_SEGMENTS = new Set([
  "sistema",
  "conta",
  "plans",
  "historico",
  "admin",
]);

/**
 * Rotas autenticadas sob /crypto (middleware).
 */
export function isPrivateCryptoPath(pathname: string): boolean {
  if (!pathname.startsWith(CRYPTO_BASE_PATH)) return false;
  const rest =
    pathname.length > CRYPTO_BASE_PATH.length
      ? pathname.slice(CRYPTO_BASE_PATH.length)
      : "";
  const normalized = rest === "" || rest === "/" ? "/" : rest.startsWith("/") ? rest : `/${rest}`;
  const segments = normalized.split("/").filter(Boolean);
  const first = segments[0];
  if (!first) return false;
  if (first === "pt" || first === "en") return false;
  if (
    first === "login" ||
    first === "register" ||
    first === "reset-password" ||
    first === "oauth-return" ||
    first === "reativar"
  ) {
    return false;
  }
  return PRIVATE_FIRST_SEGMENTS.has(first);
}
