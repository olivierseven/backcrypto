/**
 * Backfill de comissão na moeda do afiliado e reagregação mensal.
 *
 * 1. Preenche `StripePlanPayment.commission_affiliate_cents` onde está NULL (linhas com `id_afiliado`).
 * 2. Chama `refreshAffiliatePlanPaymentMonthAgg` para cada afiliado (preenche totais de comissão no agregado).
 *
 * Uso:
 *   npx tsx scripts/backfill-affiliate-commission-month-agg.ts --dry-run
 *   npx tsx scripts/backfill-affiliate-commission-month-agg.ts --limit=300
 *   npx tsx scripts/backfill-affiliate-commission-month-agg.ts --skip-payments
 *   npx tsx scripts/backfill-affiliate-commission-month-agg.ts --skip-month-agg
 *   npx tsx scripts/backfill-affiliate-commission-month-agg.ts --id-afiliado=AFI_...
 */
import { cryptoPrisma } from "../src/lib/crypto-db";
import {
  resolveAffiliatePaymentCurrency,
  resolveCommissionAffiliateCentsForPlanPayment,
} from "../src/lib/affiliate-payment-currency";
import { usdCentsForPlanTierHeuristic } from "../src/lib/affiliate-stripe-plan-payment-amount";
import { refreshAffiliatePlanPaymentMonthAgg } from "../src/lib/affiliate-plan-payment-month-agg";

function parseArgs() {
  const argv = process.argv.slice(2);
  const out: {
    dryRun: boolean;
    limit: number;
    idAfiliado: string | null;
    skipPayments: boolean;
    skipMonthAgg: boolean;
  } = {
    dryRun: false,
    limit: 500,
    idAfiliado: null,
    skipPayments: false,
    skipMonthAgg: false,
  };
  for (const a of argv) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--skip-payments") out.skipPayments = true;
    else if (a === "--skip-month-agg") out.skipMonthAgg = true;
    else if (a.startsWith("--limit=")) out.limit = Math.max(1, parseInt(a.slice(8), 10) || 500);
    else if (a.startsWith("--id-afiliado=")) out.idAfiliado = a.slice("--id-afiliado=".length).trim() || null;
  }
  return out;
}

async function backfillPayments(opts: ReturnType<typeof parseArgs>): Promise<number> {
  const where = {
    commissionAffiliateCents: null,
    ...(opts.idAfiliado ? { idAfiliado: opts.idAfiliado } : { idAfiliado: { not: "" } }),
  };

  const rows = await cryptoPrisma.stripePlanPayment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: opts.limit,
    select: {
      id: true,
      idAfiliado: true,
      planKey: true,
      amountTotalCents: true,
      currency: true,
      amountAffiliateCents: true,
      currencyAffiliate: true,
    },
  });

  let updated = 0;
  console.log(`[payments] batch size=${rows.length} dry-run=${opts.dryRun}`);

  for (const r of rows) {
    const idAfiliado = r.idAfiliado.trim();
    if (!idAfiliado) continue;
    const affiliateCurrency = await resolveAffiliatePaymentCurrency(idAfiliado);
    const usdCentsForTier = usdCentsForPlanTierHeuristic(r);
    const commissionAffiliateCents = await resolveCommissionAffiliateCentsForPlanPayment({
      idAfiliado,
      planKey: r.planKey,
      usdCentsForTier,
      affiliateCurrency,
    });
    if (!opts.dryRun) {
      await cryptoPrisma.stripePlanPayment.update({
        where: { id: r.id },
        data: { commissionAffiliateCents },
      });
    }
    updated++;
  }

  console.log(`[payments] atualizadas=${updated}`);
  return rows.length;
}

async function backfillMonthAgg(opts: ReturnType<typeof parseArgs>): Promise<void> {
  const apps = await cryptoPrisma.affiliateApplication.findMany({
    where: opts.idAfiliado ? { idAfiliado: opts.idAfiliado } : undefined,
    select: { idAfiliado: true },
    orderBy: { idAfiliado: "asc" },
  });

  console.log(`[month-agg] afiliados=${apps.length} dry-run=${opts.dryRun}`);

  for (const a of apps) {
    if (opts.dryRun) {
      console.log(`[month-agg] would refresh idAfiliado=${a.idAfiliado}`);
      continue;
    }
    const n = await refreshAffiliatePlanPaymentMonthAgg(a.idAfiliado);
    console.log(`[month-agg] idAfiliado=${a.idAfiliado} meses_com_pagamento=${n}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não definido");
    process.exit(1);
  }

  const opts = parseArgs();

  if (!opts.skipPayments) {
    if (opts.dryRun) {
      await backfillPayments(opts);
    } else {
      let total = 0;
      let batch: number;
      do {
        batch = await backfillPayments(opts);
        total += batch;
      } while (batch === opts.limit);
      console.log(`[payments] total atualizadas=${total}`);
    }
  }

  if (!opts.skipMonthAgg) {
    await backfillMonthAgg(opts);
  }

  console.log("Concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await cryptoPrisma.$disconnect();
  });
