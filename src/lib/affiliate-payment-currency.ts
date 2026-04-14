import { cryptoPrisma } from "@/lib/crypto-db";
import { getUsdToBrlRate } from "@/lib/usd-brl-rate";
import {
  affiliateCommissionCentsPerSale,
  type AffiliateCommissionRates,
} from "@/lib/affiliate-commission-cents";
import {
  usdCentsForPlanTierHeuristic,
  type StripePlanPaymentAffiliateAmountFields,
} from "@/lib/affiliate-stripe-plan-payment-amount";

type PaymentCurrency = "usd" | "brl";

const DEFAULT_COMMISSION_ANNUAL_USD_CENTS = 800;
const DEFAULT_COMMISSION_MONTHLY_USD_CENTS = 120;

export async function resolveAffiliatePaymentCurrency(idAfiliado: string): Promise<PaymentCurrency> {
  const id = (idAfiliado || "").trim();
  if (!id) return "usd";
  const app = await cryptoPrisma.affiliateApplication.findUnique({
    where: { idAfiliado: id },
    select: { locale: true },
  });
  const locale = (app?.locale || "").trim().toLowerCase();
  return locale === "pt" || locale === "pt-br" ? "brl" : "usd";
}

export async function convertAmountByCurrency(
  amountCents: number,
  from: PaymentCurrency,
  to: PaymentCurrency,
): Promise<number> {
  if (from === to) return amountCents;
  const { rate } = await getUsdToBrlRate();
  if (from === "usd" && to === "brl") return Math.round((amountCents / 100) * rate * 100);
  // brl -> usd
  return Math.round((amountCents / 100 / rate) * 100);
}

/**
 * Comissão em centavos na moeda do afiliado (`currency_affiliate`):
 * lê `commission_*_usd_cents` em `AffiliateApplication`, aplica `affiliateCommissionCentsPerSale` (USD)
 * e converte USD → BRL quando o afiliado é BR (mesma taxa que `convertAmountByCurrency`).
 */
export async function resolveCommissionAffiliateCentsForPlanPayment(params: {
  idAfiliado: string;
  planKey: string | null | undefined;
  /** Centavos USD usados na heurística anual/mensal (ex.: `amount_total_cents` da linha em USD ou `coins * 100`). */
  usdCentsForTier: number;
  affiliateCurrency: PaymentCurrency;
}): Promise<number> {
  const id = params.idAfiliado.trim();
  if (!id) return 0;
  const app = await cryptoPrisma.affiliateApplication.findUnique({
    where: { idAfiliado: id },
    select: { commissionAnnualUsdCents: true, commissionMonthlyUsdCents: true },
  });
  const rates: AffiliateCommissionRates = {
    annualUsdCents: app?.commissionAnnualUsdCents ?? DEFAULT_COMMISSION_ANNUAL_USD_CENTS,
    monthlyUsdCents: app?.commissionMonthlyUsdCents ?? DEFAULT_COMMISSION_MONTHLY_USD_CENTS,
  };
  const commissionUsdCents = affiliateCommissionCentsPerSale(
    rates,
    params.planKey,
    params.usdCentsForTier,
  );
  return convertAmountByCurrency(commissionUsdCents, "usd", params.affiliateCurrency);
}

/** Linha mínima de `StripePlanPayment` para derivar comissão quando `commission_affiliate_cents` é nulo. */
export type CommissionPaymentRow = StripePlanPaymentAffiliateAmountFields & {
  commissionAffiliateCents: number | null;
  planKey: string | null;
};

/**
 * Comissão na moeda do afiliado: usa a coluna persistida ou recalcula (USD da candidatura + conversão).
 */
export async function commissionAffiliateCentsForPaymentRow(
  p: CommissionPaymentRow,
  rates: AffiliateCommissionRates,
  affiliateCurrency: PaymentCurrency,
): Promise<number> {
  if (p.commissionAffiliateCents != null) return p.commissionAffiliateCents;
  const usdTier = usdCentsForPlanTierHeuristic(p);
  const usdComm = affiliateCommissionCentsPerSale(rates, p.planKey, usdTier);
  return convertAmountByCurrency(usdComm, "usd", affiliateCurrency);
}
