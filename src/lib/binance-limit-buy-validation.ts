/** Mesma regra que a boleta de compra limite: abaixo do último preço e pelo menos 0,1% abaixo. */
export const LIMIT_MIN_DISTANCE_FROM_MARKET = 0.001;

export function isValidLimitBuyPriceVsLast(limitPrice: number, lastPrice: number): boolean {
  if (!Number.isFinite(limitPrice) || !Number.isFinite(lastPrice) || lastPrice <= 0) return false;
  if (limitPrice >= lastPrice) return false;
  if (limitPrice > lastPrice * (1 - LIMIT_MIN_DISTANCE_FROM_MARKET)) return false;
  return true;
}

/** Mesma regra que a boleta de venda limite: acima do último preço e pelo menos 0,1% acima. */
export function isValidLimitSellPriceVsLast(limitPrice: number, lastPrice: number): boolean {
  if (!Number.isFinite(limitPrice) || !Number.isFinite(lastPrice) || lastPrice <= 0) return false;
  if (limitPrice <= lastPrice) return false;
  if (limitPrice < lastPrice * (1 + LIMIT_MIN_DISTANCE_FROM_MARKET)) return false;
  return true;
}
