import { NextResponse } from "next/server";
import { getAffiliateSessionFromCookie } from "@/lib/affiliate-jwt-server";
import { isAffiliateAccountingAdminEmail } from "@/lib/affiliate-accounting-admin";
import { cryptoPrisma } from "@/lib/crypto-db";
import {
  MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE,
  MONTH_AGG_STATUS_PAGO,
  MONTH_AGG_STATUS_REJEITADO_NF_INVALIDA,
  MONTH_AGG_STATUS_REJEITADO_VALOR_INCORRETO,
} from "@/lib/affiliate-plan-payment-month-agg-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdateAction = "pago" | "rejeitado_valor_incorreto" | "rejeitado_nf_invalida";

function isValidAction(v: string): v is UpdateAction {
  return v === MONTH_AGG_STATUS_PAGO ||
    v === MONTH_AGG_STATUS_REJEITADO_VALOR_INCORRETO ||
    v === MONTH_AGG_STATUS_REJEITADO_NF_INVALIDA;
}

/** POST: admin contabilidade atualiza status da NF mensal (pago/rejeitado). */
export async function POST(req: Request) {
  const session = await getAffiliateSessionFromCookie();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!(await isAffiliateAccountingAdminEmail(session.email))) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const monthAggId = typeof (body as { monthAggId?: unknown })?.monthAggId === "string"
    ? (body as { monthAggId: string }).monthAggId.trim()
    : "";
  const action = typeof (body as { action?: unknown })?.action === "string"
    ? (body as { action: string }).action.trim()
    : "";
  if (!monthAggId || !isValidAction(action)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const row = await cryptoPrisma.affiliatePlanPaymentMonthAgg.findUnique({
    where: { id: monthAggId },
    select: { id: true, status: true, invoice: { select: { id: true } } },
  });
  if (!row) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (!row.invoice) {
    return NextResponse.json({ ok: false, error: "no_invoice" }, { status: 409 });
  }
  if (row.status !== MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE) {
    return NextResponse.json({ ok: false, error: "invalid_current_status" }, { status: 409 });
  }

  await cryptoPrisma.affiliatePlanPaymentMonthAgg.update({
    where: { id: monthAggId },
    data: { status: action },
  });

  return NextResponse.json({ ok: true });
}
