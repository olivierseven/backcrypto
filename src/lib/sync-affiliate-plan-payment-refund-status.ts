/**
 * Painel afiliado: só grava em `situacao` quando detecta reembolsado.
 * Sem reembolso → não altera o registro (mantém pendente ou valor anterior).
 */
import type { Prisma, PrismaClient } from "@/lib/prisma-bio-client";
import Stripe from "stripe";
import { cryptoPrisma } from "@/lib/crypto-db";
import { resolveChargeIdForPlanPayment } from "@/lib/sync-stripe-plan-payment-payout";

export const SITUACAO_PENDENTE = "pendente";
export const SITUACAO_REEMBOLSO = "reembolsado";

function createdAtGteTwoMonthsAgo(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d;
}

function stripeChargeIsRefunded(ch: { refunded?: boolean; amount_refunded?: number }): boolean {
  if (ch.refunded === true) return true;
  return (ch.amount_refunded ?? 0) > 0;
}

/** Pagar.me Core v5: status/ charges com estorno explícito (evita marcar `canceled` genérico como reembolso). */
function pagarmeOrderIndicatesRefund(order: Record<string, unknown>): boolean {
  const st = String(order.status ?? "").toLowerCase();
  if (st === "refunded" || st.includes("refund")) return true;

  const charges = order.charges;
  if (!Array.isArray(charges)) return false;
  for (const c of charges) {
    if (!c || typeof c !== "object") continue;
    const charge = c as Record<string, unknown>;
    const cst = String(charge.status ?? "").toLowerCase();
    if (cst.includes("refund")) return true;
    const lt = charge.last_transaction;
    if (lt && typeof lt === "object") {
      const t = lt as Record<string, unknown>;
      const tst = String(t.status ?? "").toLowerCase();
      if (tst.includes("refund") || tst === "voided") return true;
    }
  }
  return false;
}

async function fetchPagarmeOrderJson(orderId: string, pagarmeSecret: string): Promise<Record<string, unknown> | null> {
  const auth = Buffer.from(`${pagarmeSecret}:`).toString("base64");
  const res = await fetch(`https://api.pagar.me/core/v5/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

/** Fallback se `overrides.limit` omitido (ex.: testes). Produção: use `resolveAffiliateRefundSyncRowLimit()` no caller. */
const FALLBACK_REFUND_SYNC_ROW_LIMIT = 500;

/**
 * Mesma janela que o sync antigo: idAfiliado, últimos 2 meses (createdAt), até `limit` linhas.
 * `idAfiliado` = `StripePlanPayment.id_afiliado` (público), não o cuid de `AffiliateAccount`.
 */
export async function syncRefundStatusForAffiliate(
  idAfiliado: string,
  overrides?: { prisma?: PrismaClient; limit?: number; allCreated?: boolean },
): Promise<{ updated: number; errors: number; rowCount: number }> {
  const prisma = overrides?.prisma ?? cryptoPrisma;
  const limit = Math.max(1, overrides?.limit ?? FALLBACK_REFUND_SYNC_ROW_LIMIT);
  const idTrim = idAfiliado.trim();
  if (!idTrim) {
    return { updated: 0, errors: 0, rowCount: 0 };
  }

  const createdAtCutoff = createdAtGteTwoMonthsAgo();
  const where: Prisma.StripePlanPaymentWhereInput = {
    idAfiliado: idTrim,
    situacao: { not: SITUACAO_REEMBOLSO },
    OR: [{ provider: "stripe" }, { provider: "pagarme" }],
  };
  if (!overrides?.allCreated) {
    where.createdAt = { gte: createdAtCutoff };
  }

  const rows = await prisma.stripePlanPayment.findMany({
    where,
    orderBy: { paidAt: "desc" },
    take: limit,
  });

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const pagarmeSecret = process.env.PAGARME_SECRET_KEY;
  const StripeSdk = (await import("stripe")).default;
  const stripe = stripeSecret ? new StripeSdk(stripeSecret) : null;

  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      if (row.provider === "stripe") {
        if (!stripe) {
          errors++;
          continue;
        }
        const chargeId = await resolveChargeIdForPlanPayment(stripe, row);
        if (!chargeId) {
          continue;
        }
        const ch = await stripe.charges.retrieve(chargeId);
        if (!stripeChargeIsRefunded(ch)) {
          continue;
        }
        await prisma.stripePlanPayment.update({
          where: { id: row.id },
          data: { situacao: SITUACAO_REEMBOLSO },
        });
        updated++;
      } else if (row.provider === "pagarme") {
        if (!row.pagarmeOrderId || !pagarmeSecret) {
          if (!pagarmeSecret) errors++;
          continue;
        }
        const order = await fetchPagarmeOrderJson(row.pagarmeOrderId, pagarmeSecret);
        if (!order) {
          errors++;
          continue;
        }
        if (!pagarmeOrderIndicatesRefund(order)) {
          continue;
        }
        await prisma.stripePlanPayment.update({
          where: { id: row.id },
          data: { situacao: SITUACAO_REEMBOLSO },
        });
        updated++;
      }
    } catch (e: unknown) {
      errors++;
      console.error(`[syncRefundStatus] ${row.id} (${row.provider}):`, e instanceof Error ? e.message : e);
    }
  }

  return { updated, errors, rowCount: rows.length };
}
