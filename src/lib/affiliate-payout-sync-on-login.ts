import { cryptoPrisma } from "@/lib/crypto-db";
import { resolveAffiliateRefundSyncRowLimit } from "@/lib/crypto-app-config";
import { resolveAffiliateApplicationIdAfiliadoByAccountId } from "@/lib/affiliate-coupon-plan";
import { applyAffiliatePlanPaymentSituacaoByAge } from "@/lib/affiliate-plan-payment-situacao-time";
import { refreshAffiliatePlanPaymentMonthAgg } from "@/lib/affiliate-plan-payment-month-agg";
import { syncRefundStatusForAffiliate } from "@/lib/sync-affiliate-plan-payment-refund-status";

const TZ = "America/Sao_Paulo";

export function calendarDayInSaoPaulo(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Após login: atualiza agregação mensal (após situação por idade, antes do sync de reembolso);
 * se ainda não correu hoje, consulta reembolso (Stripe/Pagar.me) e atualiza `situacao`; recalcula agregação de novo após esse sync.
 */
export async function runAffiliatePayoutSyncIfNotYetToday(affiliateId: string): Promise<{
  skipped: boolean;
  alreadySyncedToday: boolean;
  updated: number;
  errors: number;
  rowCount: number;
  situacaoToAprovado: number;
  situacaoToEmAnalise: number;
  monthAggMonths: number;
}> {
  /** Mesmo valor que `StripePlanPayment.id_afiliado` (não é o cuid da conta). */
  const idAfiliadoPublic = (await resolveAffiliateApplicationIdAfiliadoByAccountId(affiliateId)) ?? "";

  const situacaoAge = await applyAffiliatePlanPaymentSituacaoByAge(idAfiliadoPublic);

  const row = await cryptoPrisma.affiliateAccount.findUnique({
    where: { id: affiliateId },
    select: { lastPlanPaymentPayoutSyncAt: true },
  });
  if (!row) {
    return {
      skipped: true,
      alreadySyncedToday: false,
      updated: 0,
      errors: 0,
      rowCount: 0,
      situacaoToAprovado: situacaoAge.toAprovado,
      situacaoToEmAnalise: situacaoAge.toEmAnalise,
      monthAggMonths: 0,
    };
  }

  /** Agregação mensal após `situacao` por idade e antes do sync de reembolso (e antes do gate diário). */
  const monthAggMonthsPreSync = await refreshAffiliatePlanPaymentMonthAgg(idAfiliadoPublic);

  const today = calendarDayInSaoPaulo(new Date());
  if (row.lastPlanPaymentPayoutSyncAt) {
    const lastDay = calendarDayInSaoPaulo(row.lastPlanPaymentPayoutSyncAt);
    if (lastDay === today) {
      return {
        skipped: true,
        alreadySyncedToday: true,
        updated: 0,
        errors: 0,
        rowCount: 0,
        situacaoToAprovado: situacaoAge.toAprovado,
        situacaoToEmAnalise: situacaoAge.toEmAnalise,
        monthAggMonths: monthAggMonthsPreSync,
      };
    }
  }

  const limit = await resolveAffiliateRefundSyncRowLimit();
  const result = await syncRefundStatusForAffiliate(idAfiliadoPublic, { limit });
  await cryptoPrisma.affiliateAccount.update({
    where: { id: affiliateId },
    data: { lastPlanPaymentPayoutSyncAt: new Date() },
  });

  const monthAggMonths = await refreshAffiliatePlanPaymentMonthAgg(idAfiliadoPublic);

  return {
    skipped: false,
    alreadySyncedToday: false,
    updated: result.updated,
    errors: result.errors,
    rowCount: result.rowCount,
    situacaoToAprovado: situacaoAge.toAprovado,
    situacaoToEmAnalise: situacaoAge.toEmAnalise,
    monthAggMonths,
  };
}
