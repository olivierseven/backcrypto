/**
 * Sincroniza payout/status em StripePlanPayment (Stripe + Pagar.me).
 * Usado pelo script CLI e pelo painel de afiliado (filtrado por idAfiliado).
 */
import { Prisma, PrismaClient } from "@/lib/prisma-bio-client";
import Stripe from "stripe";
import { cryptoPrisma } from "@/lib/crypto-db";

type StripeInvoiceExpanded = {
  charge?: string | { id: string } | null;
  payment_intent?: string | { id: string; latest_charge?: string | { id: string } | null } | null;
  payments?: { data: unknown[] };
};

export type SyncPlanPaymentPayoutOptions = {
  prisma?: PrismaClient;
  dryRun?: boolean;
  limit?: number;
  /** Filtra por provider */
  only?: "stripe" | "pagarme" | null;
  sinceDays?: number | null;
  /** Uma linha StripePlanPayment por id */
  rowId?: string | null;
  /** Id da AffiliateAccount — só linhas com este idAfiliado */
  idAfiliado?: string | null;
  /** Ignora janela de 2 meses em createdAt */
  allCreated?: boolean;
};

function createdAtGteTwoMonthsAgo(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d;
}

async function chargeIdFromPaymentShell(
  stripe: InstanceType<typeof Stripe>,
  p: unknown,
): Promise<string | null> {
  if (!p || typeof p !== "object") return null;
  const shell = p as { charge?: unknown; payment_intent?: unknown };
  if (shell.charge) {
    return typeof shell.charge === "string" ? shell.charge : (shell.charge as { id: string }).id;
  }
  if (shell.payment_intent) {
    const piId =
      typeof shell.payment_intent === "string"
        ? shell.payment_intent
        : (shell.payment_intent as { id: string }).id;
    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
    const lc = pi.latest_charge;
    if (typeof lc === "string") return lc;
    if (lc && typeof lc === "object" && "id" in lc) return (lc as { id: string }).id;
  }
  return null;
}

async function resolveChargeIdFromInvoicePaymentsList(
  stripe: InstanceType<typeof Stripe>,
  invoiceId: string,
): Promise<string | null> {
  const list = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 15 });
  for (const ip of list.data) {
    const shell = ip.payment;
    const id = await chargeIdFromPaymentShell(stripe, shell);
    if (id) return id;
  }
  return null;
}

type PlanPayRow = Prisma.StripePlanPaymentGetPayload<Record<string, never>>;

/** Exportado para o sync leve de reembolso (painel afiliado). */
export async function resolveChargeIdForPlanPayment(
  stripe: InstanceType<typeof Stripe>,
  row: PlanPayRow,
): Promise<string | null> {
  if (row.chargeId) return row.chargeId;
  if (row.paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(row.paymentIntentId, { expand: ["latest_charge"] });
    const lc = pi.latest_charge;
    if (typeof lc === "string") return lc;
    if (lc && typeof lc === "object" && "id" in lc) return (lc as { id: string }).id;
    return null;
  }
  if (row.invoiceId) {
    let inv: StripeInvoiceExpanded;
    try {
      inv = (await stripe.invoices.retrieve(row.invoiceId, {
        expand: ["charge", "payment_intent", "payment_intent.latest_charge", "payments"],
      })) as unknown as StripeInvoiceExpanded;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("cannot be expanded") && msg.includes("payments")) {
        inv = (await stripe.invoices.retrieve(row.invoiceId, {
          expand: ["charge", "payment_intent", "payment_intent.latest_charge"],
        })) as unknown as StripeInvoiceExpanded;
      } else {
        throw e;
      }
    }
    if (inv.charge) {
      return typeof inv.charge === "string" ? inv.charge : inv.charge.id;
    }
    const piRef = inv.payment_intent;
    if (typeof piRef === "string") {
      const pi = await stripe.paymentIntents.retrieve(piRef, { expand: ["latest_charge"] });
      const lc = pi.latest_charge;
      if (typeof lc === "string") return lc;
      if (lc && typeof lc === "object" && "id" in lc) return (lc as { id: string }).id;
    } else if (piRef && typeof piRef === "object") {
      const lc = piRef.latest_charge;
      if (typeof lc === "string") return lc;
      if (lc && typeof lc === "object" && "id" in lc) return (lc as { id: string }).id;
    }
    const payList = inv.payments && Array.isArray(inv.payments.data) ? inv.payments.data : [];
    for (const ip of payList) {
      const row = ip as { payment?: unknown };
      const shell = row && row.payment ? row.payment : ip;
      const id = await chargeIdFromPaymentShell(stripe, shell);
      if (id) return id;
    }
    const fromList = await resolveChargeIdFromInvoicePaymentsList(stripe, row.invoiceId);
    if (fromList) return fromList;
  }
  return null;
}

async function syncStripeRow(
  stripe: InstanceType<typeof Stripe>,
  row: PlanPayRow,
  dryRun: boolean,
): Promise<Record<string, unknown> | null> {
  const chargeId = await resolveChargeIdForPlanPayment(stripe, row);
  if (!chargeId) {
    console.warn(
      `  [stripe] ${row.id}: sem charge resolvível (invoiceId=${row.invoiceId ?? "null"} pi=${row.paymentIntentId ?? "null"}), skip`,
    );
    return null;
  }

  const ch = await stripe.charges.retrieve(chargeId, { expand: ["balance_transaction"] });
  let bt = ch.balance_transaction;
  if (typeof bt === "string") {
    bt = await stripe.balanceTransactions.retrieve(bt);
  }
  if (!bt || typeof bt !== "object") {
    console.warn(`  [stripe] ${row.id}: balance_transaction ausente`);
    return null;
  }

  const data: Record<string, unknown> = {
    payoutUpdatedAt: new Date(),
  };

  if (ch.id && !row.chargeId) data.chargeId = ch.id;
  if (typeof ch.payment_intent === "string" && !row.paymentIntentId) data.paymentIntentId = ch.payment_intent;

  const payoutRef = (bt as { payout?: string | { id: string } | null }).payout;
  if (payoutRef) {
    const payoutId = typeof payoutRef === "string" ? payoutRef : payoutRef.id;
    const po = await stripe.payouts.retrieve(payoutId);
    data.stripePayoutId = po.id;
    data.payoutStatus = po.status;
    if (po.arrival_date) {
      data.payoutArrivalDate = new Date(po.arrival_date * 1000);
    }
  } else {
    data.payoutStatus =
      bt.status === "pending"
        ? `balance_pending_available_on_${bt.available_on ?? "unknown"}`
        : `balance_${bt.status}`;
  }

  if (dryRun) {
    console.log(`  [dry-run] stripe ${row.id} →`, JSON.stringify(data));
    return null;
  }

  return data;
}

async function syncPagarmeRow(
  orderId: string,
  pagarmeSecret: string,
  dryRun: boolean,
): Promise<Record<string, unknown> | null> {
  const auth = Buffer.from(`${pagarmeSecret}:`).toString("base64");
  const res = await fetch(`https://api.pagar.me/core/v5/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`  [pagarme] GET order ${orderId} HTTP ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }
  const order = (await res.json()) as { status?: string; charges?: { gateway_id?: string }[] };
  const status = order.status ?? "unknown";

  const data: Record<string, unknown> = {
    payoutStatus: String(status),
    payoutUpdatedAt: new Date(),
  };

  const charges = Array.isArray(order.charges) ? order.charges : [];
  const first = charges[0];
  if (first && typeof first.gateway_id === "string" && first.gateway_id.length > 0) {
    data.pagarmePayoutId = first.gateway_id;
  }

  if (dryRun) {
    console.log(`  [dry-run] pagarme ${orderId} →`, JSON.stringify(data));
    return null;
  }

  return data;
}

/**
 * Sincroniza linhas StripePlanPayment conforme filtros (mesma semântica do script CLI).
 */
export async function syncPlanPaymentPayouts(
  opts: SyncPlanPaymentPayoutOptions = {},
): Promise<{ updated: number; errors: number; rowCount: number }> {
  const prisma = opts.prisma ?? cryptoPrisma;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const pagarmeSecret = process.env.PAGARME_SECRET_KEY;
  const createdAtCutoff = createdAtGteTwoMonthsAgo();
  const limit = Math.max(1, opts.limit ?? 200);
  const dryRun = opts.dryRun ?? false;

  const where: Prisma.StripePlanPaymentWhereInput = {};

  if (opts.rowId) {
    where.id = opts.rowId;
  } else {
    const providerFilter: Prisma.StripePlanPaymentWhereInput[] = [];
    if (!opts.only || opts.only === "stripe") providerFilter.push({ provider: "stripe" });
    if (!opts.only || opts.only === "pagarme") providerFilter.push({ provider: "pagarme" });
    where.OR = providerFilter;
    if (opts.sinceDays) {
      const since = new Date();
      since.setDate(since.getDate() - opts.sinceDays);
      where.paidAt = { gte: since };
    }
    if (opts.idAfiliado) {
      where.idAfiliado = opts.idAfiliado;
    }
  }

  if (!opts.allCreated) {
    where.createdAt = { gte: createdAtCutoff };
  }

  const rows = await prisma.stripePlanPayment.findMany({
    where,
    orderBy: { paidAt: "desc" },
    take: limit,
  });

  const Stripe = (await import("stripe")).default;
  const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      if (row.provider === "stripe") {
        if (!stripe) {
          console.warn("STRIPE_SECRET_KEY ausente — ignorando linhas stripe");
          errors++;
          continue;
        }
        const patch = await syncStripeRow(stripe, row, dryRun);
        if (patch && Object.keys(patch).length > 0) {
          await prisma.stripePlanPayment.update({ where: { id: row.id }, data: patch });
          updated++;
          console.log(`  OK stripe ${row.id} payoutStatus=${patch.payoutStatus}`);
        }
      } else if (row.provider === "pagarme") {
        if (!row.pagarmeOrderId) {
          console.warn(`  [pagarme] ${row.id}: sem pagarmeOrderId`);
          continue;
        }
        if (!pagarmeSecret) {
          console.warn("PAGARME_SECRET_KEY ausente — ignorando linhas pagarme");
          errors++;
          continue;
        }
        const patch = await syncPagarmeRow(row.pagarmeOrderId, pagarmeSecret, dryRun);
        if (patch && Object.keys(patch).length > 0) {
          await prisma.stripePlanPayment.update({ where: { id: row.id }, data: patch });
          updated++;
          console.log(`  OK pagarme ${row.id} status=${patch.payoutStatus}`);
        }
      }
    } catch (e: unknown) {
      errors++;
      console.error(`  ERRO ${row.id} (${row.provider}):`, e instanceof Error ? e.message : e);
    }
  }

  return { updated, errors, rowCount: rows.length };
}

/** Painel afiliado: só pagamentos ligados a este id (AffiliateAccount.id → StripePlanPayment.idAfiliado). */
export async function syncPlanPaymentPayoutsForAffiliate(
  idAfiliado: string,
  overrides?: Pick<SyncPlanPaymentPayoutOptions, "prisma" | "dryRun" | "limit" | "allCreated">,
): Promise<{ updated: number; errors: number; rowCount: number }> {
  if (!idAfiliado.trim()) {
    return { updated: 0, errors: 0, rowCount: 0 };
  }
  return syncPlanPaymentPayouts({
    idAfiliado: idAfiliado.trim(),
    limit: overrides?.limit ?? 200,
    dryRun: overrides?.dryRun,
    prisma: overrides?.prisma,
    allCreated: overrides?.allCreated,
  });
}
