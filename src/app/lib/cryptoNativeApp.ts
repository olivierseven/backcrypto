/**
 * Identidade do app nativo (Android / Capacitor) — Crypto Strategy.
 * Manter alinhado com android/app/build.gradle (applicationId) e AndroidManifest (scheme).
 */
export const CRYPTO_ANDROID_APP_ID = "com.sevencoins.cryptostrategy";
/** Custom URL scheme para OAuth (Chrome → app). */
export const CRYPTO_OAUTH_CUSTOM_SCHEME = "cryptostrategy";

export function androidGoogleOAuthIntentUrl(completeUrl: string): string {
  return `intent://oauth#Intent;scheme=${CRYPTO_OAUTH_CUSTOM_SCHEME};package=${CRYPTO_ANDROID_APP_ID};S.url=${encodeURIComponent(completeUrl)};S.browser_fallback_url=${encodeURIComponent(completeUrl)};end`;
}

export function androidGoogleOAuthDeepLink(completeUrl: string, nextPath?: string): string {
  const u = `${CRYPTO_OAUTH_CUSTOM_SCHEME}://oauth?url=${encodeURIComponent(completeUrl)}`;
  return nextPath ? `${u}&next=${encodeURIComponent(nextPath)}` : u;
}

/** Play Store — após publicar o novo pacote, o id na URL deve coincidir. */
export const CRYPTO_PLAY_STORE_APP_URL =
  "https://play.google.com/store/apps/details?id=com.sevencoins.cryptostrategy";
