import { NextResponse } from "next/server";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate";
import { resolveAffiliateCouponForPlanCheckout } from "@/lib/affiliate-coupon-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Valida cupom de afiliado antes do checkout (mesma regra que /api/checkout). */
export async function POST(req: Request) {
  const { ok } = rateLimit(clientKeyFromRequest(req, "plan-coupon-validate"), 40, 60_000);
  if (!ok) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  let body: { code?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const raw = typeof body.code === "string" ? body.code.trim() : "";
  const result = await resolveAffiliateCouponForPlanCheckout(raw || undefined);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (!result.affiliate) {
    return NextResponse.json({ ok: true, applied: false });
  }

  return NextResponse.json({ ok: true, applied: true, code: result.affiliate.code });
}
