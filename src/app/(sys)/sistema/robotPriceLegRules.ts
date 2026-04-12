/**
 * Regras fixas (não configuráveis): comprador — envio de compra a mercado só se referência ≤ abertura da vela
 * e (em sequência) referência ≤ última compra; vendedor — nova venda só se referência ≥ última venda (quando aplicável).
 */

/** Tolerância relativa em comparações de preço (evita ruído de vírgula flutuante). */
export const ROBOT_PRICE_LEG_REL_EPS = 1e-9;

export function buyerRefAllowsNextBuy(refPrice: number, lastBuyFillPrice: number | null | undefined): boolean {
  if (lastBuyFillPrice == null || !Number.isFinite(lastBuyFillPrice) || lastBuyFillPrice <= 0) return true;
  if (!Number.isFinite(refPrice) || refPrice <= 0) return false;
  return refPrice <= lastBuyFillPrice * (1 + ROBOT_PRICE_LEG_REL_EPS);
}

/**
 * Critério para o robô comprador **enviar** ordem a mercado (só a decisão; o fill na exchange pode ser outro).
 * Exige preço de referência ≤ abertura da vela; se já houve compra na sequência, também referência ≤ última compra registada.
 */
export function buyerAllowsMarketBuyOrder(
  refPrice: number,
  candleOpen: number,
  lastBuyFillPrice: number | null | undefined
): boolean {
  if (!Number.isFinite(refPrice) || refPrice <= 0) return false;
  if (!Number.isFinite(candleOpen) || candleOpen <= 0) return false;
  if (refPrice > candleOpen * (1 + ROBOT_PRICE_LEG_REL_EPS)) return false;
  return buyerRefAllowsNextBuy(refPrice, lastBuyFillPrice);
}

/** Para robô vendedor (execução futura): nova venda só se o preço de referência ≥ última venda. */
export function sellerRefAllowsNextSell(refPrice: number, lastSellFillPrice: number | null | undefined): boolean {
  if (lastSellFillPrice == null || !Number.isFinite(lastSellFillPrice) || lastSellFillPrice <= 0) return true;
  if (!Number.isFinite(refPrice) || refPrice <= 0) return false;
  return refPrice >= lastSellFillPrice * (1 - ROBOT_PRICE_LEG_REL_EPS);
}

/**
 * Preço limite para breakeven (zerar): médio × (1 + buffer%/100). Buffer ∈ [-1, +1] tipicamente.
 */
export function flattenBreakevenThresholdPrice(avgBuyPrice: number, bufferPercentVsAvg: number): number {
  if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) return NaN;
  const b = Math.min(1, Math.max(-1, bufferPercentVsAvg));
  return avgBuyPrice * (1 + b / 100);
}

/**
 * Zerar (alerta armado): fecho ≤ limite de breakeven (médio com desvio configurável). Buffer 0 = comportamento antigo (≤ médio).
 * O alerta permanece armado com posição aberta até fechar, mesmo que estratégias de zerar voltem a falso.
 */
export function longFlattenCloseBreakeven(
  closePrice: number,
  avgBuyPrice: number,
  bufferPercentVsAvg: number
): boolean {
  if (!Number.isFinite(closePrice) || closePrice <= 0) return false;
  const th = flattenBreakevenThresholdPrice(avgBuyPrice, bufferPercentVsAvg);
  if (!Number.isFinite(th) || th <= 0) return false;
  return closePrice <= th * (1 + ROBOT_PRICE_LEG_REL_EPS);
}

export function longFlattenCloseAtOrBelowAvg(closePrice: number, avgBuyPrice: number): boolean {
  return longFlattenCloseBreakeven(closePrice, avgBuyPrice, 0);
}
