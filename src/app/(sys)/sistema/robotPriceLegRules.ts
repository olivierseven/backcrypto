/**
 * Regras fixas de perna (não configuráveis): comprador só adiciona compra se o preço de referência
 * for ≤ à última compra; vendedor só adiciona venda se o preço for ≥ à última venda (quando aplicável).
 */

/** Tolerância relativa em comparações de preço (evita ruído de vírgula flutuante). */
export const ROBOT_PRICE_LEG_REL_EPS = 1e-9;

export function buyerRefAllowsNextBuy(refPrice: number, lastBuyFillPrice: number | null | undefined): boolean {
  if (lastBuyFillPrice == null || !Number.isFinite(lastBuyFillPrice) || lastBuyFillPrice <= 0) return true;
  if (!Number.isFinite(refPrice) || refPrice <= 0) return false;
  return refPrice <= lastBuyFillPrice * (1 + ROBOT_PRICE_LEG_REL_EPS);
}

/** Para robô vendedor (execução futura): nova venda só se o preço de referência ≥ última venda. */
export function sellerRefAllowsNextSell(refPrice: number, lastSellFillPrice: number | null | undefined): boolean {
  if (lastSellFillPrice == null || !Number.isFinite(lastSellFillPrice) || lastSellFillPrice <= 0) return true;
  if (!Number.isFinite(refPrice) || refPrice <= 0) return false;
  return refPrice >= lastSellFillPrice * (1 - ROBOT_PRICE_LEG_REL_EPS);
}

/**
 * Zerar (alerta armado): fecho ≤ preço médio de compra — primeira vela que cumpre dispara a venda a mercado.
 */
export function longFlattenCloseAtOrBelowAvg(closePrice: number, avgBuyPrice: number): boolean {
  if (!Number.isFinite(closePrice) || closePrice <= 0) return false;
  if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) return false;
  return closePrice <= avgBuyPrice * (1 + ROBOT_PRICE_LEG_REL_EPS);
}
