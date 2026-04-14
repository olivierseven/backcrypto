/**
 * Cupom ~20% OFF (Stripe: PRICE_COINS_*_20OFF) — desligado por enquanto; nenhum código é aceito.
 * Para reativar: fazer isValidPromoCoupon20Off comparar com CRYPTO_PROMO_COUPON_20OFF ou default `sevencoins77`.
 */
export function normalizePromoCoupon20Off(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidPromoCoupon20Off(_code: string | undefined): boolean {
  return false;
}
