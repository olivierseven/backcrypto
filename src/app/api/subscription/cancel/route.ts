// POST /api/subscription/cancel — cancela assinatura Stripe (cancel_at_period_end)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { TxSource, TxType } from "@/lib/prisma-bio-client";
import { warn, error } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

export async function POST(req: Request) {
  if (!STRIPE_SECRET) {
    error("[crypto/subscription/cancel] missing STRIPE_SECRET_KEY");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let payload: { sub?: string };
  try {
    const result = await jwtVerify(token, JWT_SECRET);
    payload = result.payload as { sub?: string };
  } catch {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  const userId = typeof payload?.sub === "string" ? payload.sub : null;
  if (!userId) return NextResponse.json({ error: "invalid_user" }, { status: 401 });

  let body: { subscriptionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const subscriptionId = typeof body?.subscriptionId === "string" ? body.subscriptionId.trim() : null;
  if (!subscriptionId || !subscriptionId.startsWith("sub_")) {
    return NextResponse.json({ error: "invalid_subscription_id" }, { status: 400 });
  }

  const stripe = new Stripe(STRIPE_SECRET);
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const metaUserId = (sub.metadata?.userId ?? "").trim();
    if (metaUserId !== userId) {
      warn(`[crypto/subscription/cancel] subscription ${subscriptionId} does not belong to user ${userId.slice(0, 8)}...`);
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (sub.cancel_at_period_end) {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    const cancelledAt = new Date();
    try {
      const wallet = await cryptoPrisma.userCoinWallet.upsert({
        where: { userId },
        create: { userId, balance: 0 },
        update: {},
        select: { id: true },
      });
      await cryptoPrisma.coinLedgerEntry.create({
        data: {
          userId,
          walletId: wallet.id,
          type: TxType.ADJUSTMENT,
          source: TxSource.ADMIN,
          amount: 0,
          refId: `cancel_${subscriptionId}`,
          meta: { reason: "subscription_cancelled", subscriptionId, cancelledAt: cancelledAt.toISOString() },
        },
      });
    } catch (err) {
      warn(`[crypto/subscription/cancel] failed to write ledger entry: ${err instanceof Error ? err.message : String(err)}`);
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    error(`[crypto/subscription/cancel] ${msg}`);
    return NextResponse.json({ error: "stripe_error" }, { status: 500 });
  }
}
