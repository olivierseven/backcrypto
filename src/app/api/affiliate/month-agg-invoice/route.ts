import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAffiliateAccountIdFromCookie } from "@/lib/affiliate-jwt-server";
import { resolveAffiliateApplicationIdAfiliadoByAccountId } from "@/lib/affiliate-coupon-plan";
import {
  MONTH_AGG_STATUS_AGUARDANDO_NOTA_FISCAL,
  MONTH_AGG_STATUS_EXPIRADO,
  MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE,
  MONTH_AGG_STATUS_REJEITADO_NF_INVALIDA,
  MONTH_AGG_STATUS_REJEITADO_VALOR_INCORRETO,
} from "@/lib/affiliate-plan-payment-month-agg-status";
import { isAffiliatePayoutProfilePaymentComplete } from "@/lib/affiliate-payout-profile-complete";
import { cryptoPrisma } from "@/lib/crypto-db";
import { logErro } from "@/lib/log-erro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

function isPdfBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return buf.subarray(0, 4).toString("ascii") === "%PDF";
}

/**
 * POST multipart: `monthAggId` (text), `file` (PDF). Grava NF e define status `nota_fiscal_em_analise`.
 */
export async function POST(req: Request) {
  const accountId = await getAffiliateAccountIdFromCookie();
  if (!accountId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const idAfiliadoPublic = (await resolveAffiliateApplicationIdAfiliadoByAccountId(accountId)) ?? "";
  if (!idAfiliadoPublic) {
    return NextResponse.json({ ok: false, error: "no_affiliate_application" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const monthAggId = typeof form.get("monthAggId") === "string" ? (form.get("monthAggId") as string).trim() : "";
  const file = form.get("file");
  if (!monthAggId || !file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (!isPdfBuffer(buf)) {
    return NextResponse.json({ ok: false, error: "not_pdf" }, { status: 400 });
  }

  try {
    const monthAgg = await cryptoPrisma.affiliatePlanPaymentMonthAgg.findFirst({
      where: { id: monthAggId, idAfiliado: idAfiliadoPublic },
      select: { id: true, status: true, totalAprovadoCommissionAffiliateCents: true },
    });
    if (!monthAgg) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    if (monthAgg.totalAprovadoCommissionAffiliateCents <= 0) {
      return NextResponse.json({ ok: false, error: "commission_zero" }, { status: 400 });
    }

    const allowedStatuses = new Set<string>([
      MONTH_AGG_STATUS_AGUARDANDO_NOTA_FISCAL,
      MONTH_AGG_STATUS_REJEITADO_VALOR_INCORRETO,
      MONTH_AGG_STATUS_REJEITADO_NF_INVALIDA,
    ]);
    if (monthAgg.status === MONTH_AGG_STATUS_EXPIRADO) {
      return NextResponse.json({ ok: false, error: "month_expired" }, { status: 400 });
    }

    if (!allowedStatuses.has(monthAgg.status)) {
      return NextResponse.json({ ok: false, error: "month_not_ready_for_invoice" }, { status: 400 });
    }

    const appRow = await cryptoPrisma.affiliateApplication.findFirst({
      where: { idAfiliado: idAfiliadoPublic },
      select: { payoutProfile: true },
    });
    if (!isAffiliatePayoutProfilePaymentComplete(appRow?.payoutProfile ?? null)) {
      return NextResponse.json({ ok: false, error: "payout_profile_incomplete" }, { status: 400 });
    }

    const name = typeof file.name === "string" ? file.name.slice(0, 512) : null;

    await cryptoPrisma.$transaction(async (tx) => {
      await tx.affiliateMonthAggInvoice.upsert({
        where: { monthAggId: monthAgg.id },
        create: {
          id: randomUUID(),
          monthAggId: monthAgg.id,
          pdfBytes: buf,
          fileName: name,
          contentType: "application/pdf",
          sizeBytes: buf.length,
        },
        update: {
          pdfBytes: buf,
          fileName: name,
          contentType: "application/pdf",
          sizeBytes: buf.length,
        },
      });
      await tx.affiliatePlanPaymentMonthAgg.update({
        where: { id: monthAgg.id },
        data: { status: MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[affiliate/month-agg-invoice]", e);
    void logErro("POST /api/affiliate/month-agg-invoice", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
