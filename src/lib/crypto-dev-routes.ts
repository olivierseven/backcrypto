import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";

/**
 * Rotas só para desenvolvimento: páginas em `src/app/(dev)/dev/...` → `/crypto/dev/...`
 * e APIs em `src/app/api/dev/...` → `/crypto/api/dev/...`.
 * Em produção na Vercel o middleware devolve 404 (código versionado, URL não acessível).
 *
 * Em produção na Vercel (`VERCEL_ENV === "production"`) respondem 404 (middleware).
 * Override: `CRYPTO_DEV_ROUTES=1` (ativar) ou `=0` (desativar) em qualquer ambiente.
 */
export function isCryptoDevRoutesEnabled(): boolean {
  if (process.env.CRYPTO_DEV_ROUTES === "1") return true;
  if (process.env.CRYPTO_DEV_ROUTES === "0") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return true;
  return false;
}

/** Pathname completo da request (inclui basePath), ex.: `/crypto/dev` ou `/crypto/api/dev/foo`. */
export function isCryptoDevPath(pathname: string): boolean {
  const base = APP_CRYPTO_ROUTE_PREFIX;
  if (pathname.startsWith(`${base}/api/dev`)) return true;
  if (pathname === `${base}/dev`) return true;
  if (pathname.startsWith(`${base}/dev/`)) return true;
  return false;
}
