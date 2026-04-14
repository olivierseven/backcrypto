export const APP_CRYPTO_ROUTE_PREFIX = "/crypto";
export const APP_CRYPTO_SISTEMA_PATH = `${APP_CRYPTO_ROUTE_PREFIX}/sistema`;

/** Caminho interno para sistema (sem basePath). Usar só em Link e router.push; o Next adiciona basePath. */
export const SISTEMA_PATH = "/sistema";

/** Prefixo para assets em public/ (basePath); usar em src de img e em URLs de mapa. */
export const ASSET_PREFIX = APP_CRYPTO_ROUTE_PREFIX;

/** Base das rotas de API (basePath + /api); usar em fetch(). */
export const API_BASE = `${APP_CRYPTO_ROUTE_PREFIX}/api`;

/**
 * WebSocket do VPS (avisos `flush` após gravar na BD). Ex.: `ws://127.0.0.1:3044` em dev com VPS local.
 * Definir em `.env.local`: `NEXT_PUBLIC_VPS_FLUSH_WS=ws://127.0.0.1:3044` — vazio = desligado.
 */
export const VPS_FLUSH_WS_URL: string =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_VPS_FLUSH_WS
    ? String(process.env.NEXT_PUBLIC_VPS_FLUSH_WS).trim()
    : "";

/** Lista do app na Google Play (avaliação / comentário). */
export const APP_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.sevencoins.cryptostrategy";
