import type { CryptoLang } from "@/app/lib/translations";

export type StripePlanPaymentAffiliateAmountFields = {
  amountTotalCents: number;
  currency?: string | null;
  amountAffiliateCents: number | null;
  currencyAffiliate?: string | null;
};

/** Valor e moeda para o afiliado: prioriza `amount_affiliate_cents` / `currency_affiliate`. */
export function affiliatePaymentDisplayCents(row: StripePlanPaymentAffiliateAmountFields): number {
  if (row.amountAffiliateCents != null && row.currencyAffiliate) {
    return row.amountAffiliateCents;
  }
  return row.amountTotalCents;
}

export function affiliatePaymentDisplayCurrency(row: StripePlanPaymentAffiliateAmountFields): "usd" | "brl" {
  const a = row.currencyAffiliate?.trim().toLowerCase();
  if (a === "brl" || a === "usd") return a;
  const c = row.currency?.trim().toLowerCase();
  if (c === "brl") return "brl";
  return "usd";
}

/** Centavos em USD para heurística de plano (6200/900) — prioriza valor USD da linha / conversão afiliado em USD. */
export function usdCentsForPlanTierHeuristic(row: StripePlanPaymentAffiliateAmountFields): number {
  const cur = row.currency?.trim().toLowerCase();
  if (cur === "usd") return row.amountTotalCents;
  if (row.currencyAffiliate?.trim().toLowerCase() === "usd" && row.amountAffiliateCents != null) {
    return row.amountAffiliateCents;
  }
  return row.amountTotalCents;
}

export function formatAffiliateMoneyCents(
  cents: number,
  currency: "usd" | "brl",
  lang: CryptoLang,
): string {
  return new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: currency === "brl" ? "BRL" : "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
