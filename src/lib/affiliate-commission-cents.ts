/**
 * Comissão fixa por venda (USD, centavos) a partir dos valores em `AffiliateApplication`.
 * `planKey` "49" = anual, "7" = mensal (metadata checkout / Stripe).
 */
export type AffiliateCommissionRates = {
  annualUsdCents: number;
  monthlyUsdCents: number;
};

export function affiliateCommissionCentsPerSale(
  rates: AffiliateCommissionRates,
  planKey: string | null | undefined,
  amountTotalCents: number,
): number {
  const pk = (planKey ?? "").trim();
  if (pk === "49") return rates.annualUsdCents;
  if (pk === "7") return rates.monthlyUsdCents;
  if (amountTotalCents === 6200) return rates.annualUsdCents;
  if (amountTotalCents === 900) return rates.monthlyUsdCents;
  return 0;
}
