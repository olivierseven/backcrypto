export const APP_CRYPTO_ROUTE_PREFIX = "/crypto";
export const APP_CRYPTO_SISTEMA_PATH = `${APP_CRYPTO_ROUTE_PREFIX}/sistema`;

/** Caminho interno para sistema (sem basePath). Usar só em Link e router.push; o Next adiciona basePath. */
export const SISTEMA_PATH = "/sistema";

/** Prefixo para assets em public/ (basePath); usar em src de img e em URLs de mapa. */
export const ASSET_PREFIX = APP_CRYPTO_ROUTE_PREFIX;

/** Base das rotas de API (basePath + /api); usar em fetch(). */
export const API_BASE = `${APP_CRYPTO_ROUTE_PREFIX}/api`;
