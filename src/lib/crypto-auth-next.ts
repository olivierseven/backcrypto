/**
 * Destino pós-auth (login e-mail, OAuth) — alinhado à estratégia BioGenerator, com base /crypto.
 */
export const CRYPTO_BASE_PATH = "/crypto";
export const CRYPTO_LOGIN_PAGE = `${CRYPTO_BASE_PATH}/login`;
export const CRYPTO_DEFAULT_NEXT = `${CRYPTO_BASE_PATH}/sistema`;

/** Cookie JWT só para área de afiliados (não misturar com `session` do User). */
export const AFFILIATE_JWT_COOKIE_NAME = process.env.AFFILIATE_JWT_COOKIE_NAME || "affiliate_session";

/** Login de afiliado — sem pt/en na URL: `/crypto/afiliados/login`. */
export const CRYPTO_AFFILIATE_LOGIN_PAGE = `${CRYPTO_BASE_PATH}/afiliados/login`;

/** Painel de afiliado (área `(sys)` no código; idioma via cookie / `?lang=`). */
export const CRYPTO_AFFILIATE_PAINEL_PAGE = `${CRYPTO_BASE_PATH}/afiliados/painel`;

/** Dados da inscrição (AffiliateApplication) — mesma sessão JWT de afiliado. */
export const CRYPTO_AFFILIATE_CONTA_PAGE = `${CRYPTO_BASE_PATH}/afiliados/conta`;

/** Histórico e gestão de cupons (lista completa). */
export const CRYPTO_AFFILIATE_CUPONS_PAGE = `${CRYPTO_BASE_PATH}/afiliados/cupons`;

/** Estatísticas de comissão / repasses (afiliado). */
export const CRYPTO_AFFILIATE_ESTATISTICAS_PAGE = `${CRYPTO_BASE_PATH}/afiliados/estatisticas`;

/** Visão global de fechos mensais (só e-mail em `CRYPTO_ACCOUNTING_ADMIN_EMAIL`). */
export const CRYPTO_AFFILIATE_CONTABILIDADE_PAGE = `${CRYPTO_BASE_PATH}/afiliados/contabilidade`;

export function cryptoAffiliatePainelPath(_lang: "en" | "pt"): string {
  return CRYPTO_AFFILIATE_PAINEL_PAGE;
}

/**
 * Destino pós-login afiliado: `/crypto/afiliados/painel` ou legado `/crypto/{lang}/afiliados/…`
 */
export function safeAffiliateNext(raw: string | undefined | null, lang: "en" | "pt"): string {
  const fallback = cryptoAffiliatePainelPath(lang);
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || !s.startsWith("/") || s.startsWith("//")) return fallback;
  if (!s.startsWith(CRYPTO_BASE_PATH)) return fallback;
  const pathOnly = s.split("?")[0];
  const rest = pathOnly.slice(CRYPTO_BASE_PATH.length);
  const norm = rest.startsWith("/") ? rest : `/${rest}`;
  if (
    norm === "/afiliados/painel" ||
    norm === "/afiliados/cupons" ||
    norm === "/afiliados/conta" ||
    norm === "/afiliados/estatisticas" ||
    norm === "/afiliados/contabilidade"
  )
    return s;
  if (norm.startsWith(`/${lang}/afiliados/`)) return s;
  return fallback;
}

/**
 * Anexa `login=1` a URLs sob `.../afiliados/...` para o primeiro load após login disparar o sync de payout (uma vez/dia).
 */
export function withAffiliatePostLoginQuery(nextPath: string): string {
  try {
    const u = new URL(nextPath, "https://local.invalid");
    if (!u.pathname.includes("/afiliados/")) return nextPath;
    u.searchParams.set("login", "1");
    return u.pathname + u.search + u.hash;
  } catch {
    return nextPath;
  }
}

/** `/crypto/afiliados/painel` ou legado `/crypto/pt|en/afiliados/painel` — cookie de afiliado no middleware. */
export function isAffiliateProtectedPath(pathname: string): boolean {
  if (!pathname.startsWith(CRYPTO_BASE_PATH)) return false;
  const rest = pathname.slice(CRYPTO_BASE_PATH.length);
  const norm = rest.startsWith("/") ? rest : `/${rest}`;
  if (
    norm === "/afiliados/painel" ||
    norm === "/afiliados/conta" ||
    norm === "/afiliados/cupons" ||
    norm === "/afiliados/estatisticas" ||
    norm === "/afiliados/contabilidade"
  )
    return true;
  const segments = norm.split("/").filter(Boolean);
  if (segments.length < 3) return false;
  const first = segments[0];
  if (first !== "pt" && first !== "en") return false;
  return segments[1] === "afiliados" && segments[2] === "painel";
}

/** Layout `(sys)`: esta rota não usa sessão User (só JWT de afiliado). */
export function isAffiliatePainelSysPath(pathname: string): boolean {
  return (
    pathname === CRYPTO_AFFILIATE_PAINEL_PAGE ||
    pathname === "/afiliados/painel" ||
    pathname === CRYPTO_AFFILIATE_CONTA_PAGE ||
    pathname === "/afiliados/conta" ||
    pathname === CRYPTO_AFFILIATE_CUPONS_PAGE ||
    pathname === "/afiliados/cupons" ||
    pathname === CRYPTO_AFFILIATE_ESTATISTICAS_PAGE ||
    pathname === "/afiliados/estatisticas" ||
    pathname === CRYPTO_AFFILIATE_CONTABILIDADE_PAGE ||
    pathname === "/afiliados/contabilidade"
  );
}

/** pt|en a partir do path do painel (legado com locale no segmento; `/crypto/afiliados/painel` → null). */
export function affiliateLangFromPainelPath(pathname: string): "en" | "pt" | null {
  if (!pathname.startsWith(CRYPTO_BASE_PATH)) return null;
  const rest = pathname.slice(CRYPTO_BASE_PATH.length);
  const norm = rest.startsWith("/") ? rest : `/${rest}`;
  if (norm === "/afiliados/painel") return null;
  const segments = norm.split("/").filter(Boolean);
  if (segments.length < 3) return null;
  if (segments[1] !== "afiliados" || segments[2] !== "painel") return null;
  const first = segments[0];
  if (first === "pt" || first === "en") return first;
  return null;
}

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
