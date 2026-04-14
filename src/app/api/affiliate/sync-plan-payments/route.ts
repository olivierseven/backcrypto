import { NextResponse } from "next/server";
import { getAffiliateAccountIdFromCookie } from "@/lib/affiliate-jwt-server";
import { runAffiliatePayoutSyncIfNotYetToday } from "@/lib/affiliate-payout-sync-on-login";
import { logErro } from "@/lib/log-erro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { postLogin?: boolean };

/**
 * POST — após login (`postLogin: true`): sincroniza payout no máximo 1× por dia (America/Sao_Paulo).
 */
export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* corpo vazio */
  }
  if (body.postLogin !== true) {
    return NextResponse.json({ ok: false, error: "post_login_required" }, { status: 400 });
  }

  const affiliateId = await getAffiliateAccountIdFromCookie();
  if (!affiliateId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAffiliatePayoutSyncIfNotYetToday(affiliateId);
    return NextResponse.json({
      ok: true,
      skipped: result.skipped,
      alreadySyncedToday: result.alreadySyncedToday,
      updated: result.updated,
      errors: result.errors,
      rowCount: result.rowCount,
      situacaoToAprovado: result.situacaoToAprovado,
      situacaoToEmAnalise: result.situacaoToEmAnalise,
      monthAggMonths: result.monthAggMonths,
    });
  } catch (e) {
    console.error("[affiliate/sync-plan-payments]", e);
    void logErro("POST /api/affiliate/sync-plan-payments", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
