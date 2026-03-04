/**
 * Origem para redirects: preservar host do domínio de entrada quando o app
 * é acessado via proxy (ex.: sevencoins.com.br/backcrypto → rewrite para o app).
 * Usa X-Forwarded-Host e X-Forwarded-Proto para não expor a URL do app externo.
 */

/**
 * Origem pública configurada (ex.: https://sevencoins.com.br) para quando o app
 * está atrás de proxy que não envia X-Forwarded-Host. Usar em produção para OAuth.
 */
function getConfiguredPublicOrigin(): string {
  const raw =
    process.env.AUTH_PUBLIC_ORIGIN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";
  return raw.replace(/\/$/, "");
}

/**
 * Retorna a origem (ex.: https://sevencoins.com.br) a usar em redirects.
 * 1) X-Forwarded-Host (proxy); 2) AUTH_PUBLIC_ORIGIN ou NEXT_PUBLIC_APP_URL (produção); 3) req.url.origin.
 */
export function getRedirectOrigin(req: Request): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = req.headers.get("x-forwarded-proto")?.toLowerCase() || "https";
    return `${proto}://${forwardedHost}`;
  }
  const configured = getConfiguredPublicOrigin();
  if (configured && process.env.NODE_ENV === "production") {
    return configured;
  }
  return new URL(req.url).origin;
}

/**
 * Retorna a origem para redirect a partir dos headers (ex.: em Server Components com headers()).
 * Se X-Forwarded-Host estiver presente, usa; senão retorna "" para o caller usar path relativo.
 */
export function getRedirectOriginFromHeaders(headers: Headers): string {
  const forwardedHost = headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = headers.get("x-forwarded-proto")?.toLowerCase() || "https";
    return `${proto}://${forwardedHost}`;
  }
  return "";
}
