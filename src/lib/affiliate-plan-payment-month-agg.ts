import { randomUUID } from "node:crypto";
import { cryptoPrisma } from "@/lib/crypto-db";
import type { AffiliateCommissionRates } from "@/lib/affiliate-commission-cents";
import { commissionAffiliateCentsForPaymentRow } from "@/lib/affiliate-payment-currency";
import {
  computeMonthAggStatus,
  getMonthAggExpiresAtUtc,
  MONTH_AGG_STATUS_EM_ABERTO,
  MONTH_AGG_STATUS_EXPIRADO,
  MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE,
  MONTH_AGG_STATUS_PAGO,
  MONTH_AGG_STATUS_REJEITADO_NF_INVALIDA,
  MONTH_AGG_STATUS_REJEITADO_VALOR_INCORRETO,
  shouldTransitionToExpirado,
} from "@/lib/affiliate-plan-payment-month-agg-status";
import { SITUACAO_APROVADO, SITUACAO_EXPIRADO } from "@/lib/affiliate-plan-payment-situacao-time";
import { SITUACAO_REEMBOLSO } from "@/lib/sync-affiliate-plan-payment-refund-status";

const DEFAULT_ANNUAL_USD_CENTS = 800;
const DEFAULT_MONTHLY_USD_CENTS = 120;

function utcMonthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

type MonthBucket = { commTotal: number; commReemb: number; commAprov: number; commExpir: number };

/**
 * Recalcula linhas em `AffiliatePlanPaymentMonthAgg` para o afiliado (atualiza totais por mês UTC).
 * Preserva `status = nota_fiscal_em_analise` e linhas com NF já anexada (não apaga `AffiliateMonthAggInvoice`).
 *
 * Agregação usa apenas **comissão** (`commission_affiliate_cents` ou recálculo via `AffiliateApplication` + conversão).
 * Colunas `totalAffiliateCents` (volume de venda) são gravadas como 0.
 * Colunas `totalAmountCents` legadas são gravadas como 0.
 *
 * `idAfiliado` = público (`AffiliateApplication.id_afiliado`), igual a `StripePlanPayment.id_afiliado`.
 *
 * Quando o mês passa a `expirado`, atualiza `StripePlanPayment.situacao` de `aprovado` → `expirado` nesse mês (UTC).
 */
export async function refreshAffiliatePlanPaymentMonthAgg(idAfiliado: string): Promise<number> {
  const idTrim = idAfiliado.trim();
  if (!idTrim) return 0;

  const app = await cryptoPrisma.affiliateApplication.findUnique({
    where: { idAfiliado: idTrim },
    select: {
      locale: true,
      commissionAnnualUsdCents: true,
      commissionMonthlyUsdCents: true,
    },
  });
  const currencyAffiliate: "brl" | "usd" = (app?.locale ?? "").toLowerCase().startsWith("pt")
    ? "brl"
    : "usd";

  const rates: AffiliateCommissionRates = {
    annualUsdCents: app?.commissionAnnualUsdCents ?? DEFAULT_ANNUAL_USD_CENTS,
    monthlyUsdCents: app?.commissionMonthlyUsdCents ?? DEFAULT_MONTHLY_USD_CENTS,
  };

  const payments = await cryptoPrisma.stripePlanPayment.findMany({
    where: { idAfiliado: idTrim },
    select: {
      situacao: true,
      amountAffiliateCents: true,
      commissionAffiliateCents: true,
      planKey: true,
      amountTotalCents: true,
      currency: true,
      currencyAffiliate: true,
      createdAt: true,
    },
  });

  const enriched = await Promise.all(
    payments.map(async (p) => {
      const comm = await commissionAffiliateCentsForPaymentRow(
        {
          amountTotalCents: p.amountTotalCents,
          currency: p.currency,
          amountAffiliateCents: p.amountAffiliateCents,
          currencyAffiliate: p.currencyAffiliate,
          commissionAffiliateCents: p.commissionAffiliateCents,
          planKey: p.planKey,
        },
        rates,
        currencyAffiliate,
      );
      return { p, comm };
    }),
  );

  const byMonth = new Map<number, MonthBucket>();
  for (const { p, comm } of enriched) {
    const t = utcMonthStart(p.createdAt).getTime();
    let b = byMonth.get(t);
    if (!b) {
      b = { commTotal: 0, commReemb: 0, commAprov: 0, commExpir: 0 };
      byMonth.set(t, b);
    }
    b.commTotal += comm;
    if (p.situacao === SITUACAO_REEMBOLSO) b.commReemb += comm;
    if (p.situacao === SITUACAO_APROVADO) b.commAprov += comm;
    if (p.situacao === SITUACAO_EXPIRADO) b.commExpir += comm;
  }

  const sorted = [...byMonth.entries()].sort((a, b) => a[0] - b[0]);
  const sortedTimes = new Set(sorted.map(([t]) => t));
  const now = new Date();

  const existingAll = await cryptoPrisma.affiliatePlanPaymentMonthAgg.findMany({
    where: { idAfiliado: idTrim },
    select: {
      id: true,
      monthStart: true,
      status: true,
      invoice: { select: { id: true } },
    },
  });

  const existingByMonth = new Map<number, { id: string; status: string; hasInvoice: boolean }>();
  for (const e of existingAll) {
    const t = utcMonthStart(e.monthStart).getTime();
    existingByMonth.set(t, {
      id: e.id,
      status: e.status,
      hasInvoice: !!e.invoice,
    });
  }

  for (const [timeMs, b] of sorted) {
    const monthStart = new Date(timeMs);
    const prev = existingByMonth.get(timeMs);
    const prevStatus = prev?.status ?? MONTH_AGG_STATUS_EM_ABERTO;
    const expiresAt = getMonthAggExpiresAtUtc(monthStart);

    const computed = computeMonthAggStatus(monthStart, now);
    const status =
      prev?.status === MONTH_AGG_STATUS_EXPIRADO
        ? MONTH_AGG_STATUS_EXPIRADO
        : prev?.hasInvoice ||
            prev?.status === MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE ||
            prev?.status === MONTH_AGG_STATUS_PAGO ||
            prev?.status === MONTH_AGG_STATUS_REJEITADO_VALOR_INCORRETO ||
            prev?.status === MONTH_AGG_STATUS_REJEITADO_NF_INVALIDA
          ? MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE
          : computed;

    let statusFinal =
      prev?.status === MONTH_AGG_STATUS_EXPIRADO
        ? MONTH_AGG_STATUS_EXPIRADO
        : prev?.status === MONTH_AGG_STATUS_PAGO ||
            prev?.status === MONTH_AGG_STATUS_REJEITADO_VALOR_INCORRETO ||
            prev?.status === MONTH_AGG_STATUS_REJEITADO_NF_INVALIDA
          ? prev.status
          : status;

    if (
      shouldTransitionToExpirado(monthStart, now, prevStatus) &&
      statusFinal !== MONTH_AGG_STATUS_PAGO
    ) {
      statusFinal = MONTH_AGG_STATUS_EXPIRADO;
    }

    /** Em `expirado`: comissão aprovada deixa de contar em `total_aprovado_*` e passa para `total_expirado_*` (Avaliado/Estornado inalterados). Nunca com `pago`. */
    const expirado = statusFinal === MONTH_AGG_STATUS_EXPIRADO;
    const aggData = {
      totalAmountCents: 0,
      totalReembolsadoCents: 0,
      totalAprovadoCents: 0,
      totalAffiliateCents: 0,
      totalReembolsadoAffiliateCents: 0,
      totalAprovadoAffiliateCents: 0,
      totalCommissionAffiliateCents: b.commTotal,
      totalReembolsadoCommissionAffiliateCents: b.commReemb,
      totalAprovadoCommissionAffiliateCents: expirado ? 0 : b.commAprov,
      totalExpiradoCommissionAffiliateCents: expirado ? b.commAprov + b.commExpir : 0,
      currencyAffiliate,
    };

    if (prev) {
      await cryptoPrisma.affiliatePlanPaymentMonthAgg.update({
        where: { id: prev.id },
        data: { ...aggData, status: statusFinal, expiresAt },
      });
    } else {
      await cryptoPrisma.affiliatePlanPaymentMonthAgg.create({
        data: {
          id: randomUUID(),
          idAfiliado: idTrim,
          monthStart,
          ...aggData,
          status: statusFinal,
          expiresAt,
        },
      });
    }

    if (statusFinal === MONTH_AGG_STATUS_EXPIRADO) {
      const monthEndExcl = new Date(monthStart);
      monthEndExcl.setUTCMonth(monthEndExcl.getUTCMonth() + 1);
      await cryptoPrisma.stripePlanPayment.updateMany({
        where: {
          idAfiliado: idTrim,
          createdAt: { gte: monthStart, lt: monthEndExcl },
          situacao: SITUACAO_APROVADO,
        },
        data: { situacao: SITUACAO_EXPIRADO },
      });
    }
  }

  for (const e of existingAll) {
    const t = utcMonthStart(e.monthStart).getTime();
    if (sortedTimes.has(t)) continue;
    const expAt = getMonthAggExpiresAtUtc(utcMonthStart(e.monthStart));
    if (e.status === MONTH_AGG_STATUS_EXPIRADO) {
      await cryptoPrisma.affiliatePlanPaymentMonthAgg.update({
        where: { id: e.id },
        data: {
          expiresAt: expAt,
          currencyAffiliate,
        },
      });
    } else if (e.invoice || e.status === MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE) {
      await cryptoPrisma.affiliatePlanPaymentMonthAgg.update({
        where: { id: e.id },
        data: {
          totalAmountCents: 0,
          totalReembolsadoCents: 0,
          totalAprovadoCents: 0,
          totalAffiliateCents: 0,
          totalReembolsadoAffiliateCents: 0,
          totalAprovadoAffiliateCents: 0,
          totalCommissionAffiliateCents: 0,
          totalReembolsadoCommissionAffiliateCents: 0,
          totalAprovadoCommissionAffiliateCents: 0,
          totalExpiradoCommissionAffiliateCents: 0,
          currencyAffiliate,
          status: MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE,
          expiresAt: expAt,
        },
      });
    } else {
      await cryptoPrisma.affiliatePlanPaymentMonthAgg.delete({ where: { id: e.id } });
    }
  }

  return sorted.length;
}
