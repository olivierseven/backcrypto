import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import Stripe from "stripe";
import { cryptoPrisma } from "@/lib/crypto-db";
import { TxSource } from "@/lib/prisma-bio-client";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

async function hasActiveSubscription(userId: string): Promise<boolean> {
  if (!STRIPE_SECRET) return false;
  const entries = await cryptoPrisma.coinLedgerEntry.findMany({
    where: { userId, source: TxSource.STRIPE },
    select: { meta: true },
  });
  const subscriptionIds = new Set<string>();
  for (const e of entries) {
    const meta = e.meta as { subscriptionId?: string; recurring?: boolean } | null;
    if (meta?.subscriptionId && meta?.recurring) subscriptionIds.add(meta.subscriptionId);
  }
  const stripe = new Stripe(STRIPE_SECRET);
  const now = Math.floor(Date.now() / 1000);
  for (const subId of subscriptionIds) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      const active = sub.status === "active" || sub.status === "past_due";
      const cancelAtPeriodEnd = sub.cancel_at_period_end && (sub.current_period_end ?? 0) > now;
      if (active || cancelAtPeriodEnd) return true;
    } catch {
      // assinatura não existe ou key inválida
    }
  }
  return false;
}

/** GET: verifica se o usuário pode desativar a conta (sem assinatura ativa). */
export async function GET() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { payload } = await jwtVerify(token, JWT_SECRET).catch(() => ({ payload: null as any }));
  const userId = typeof payload?.sub === "string" ? payload.sub : null;
  if (!userId) return NextResponse.json({ error: "invalid_user" }, { status: 401 });

  const user = await cryptoPrisma.user.findUnique({
    where: { id: userId },
    select: { isDeleted: true },
  });

  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  if (user.isDeleted) return NextResponse.json({ canDeactivate: false, reason: "already_deleted" });

  const activeSub = await hasActiveSubscription(userId);
  return NextResponse.json({ canDeactivate: !activeSub, reason: activeSub ? "active_subscription" : null });
}

export async function POST() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { payload } = await jwtVerify(token, JWT_SECRET).catch(() => ({ payload: null as any }));
  const userId = typeof payload?.sub === "string" ? payload.sub : null;
  if (!userId) return NextResponse.json({ error: "invalid_user" }, { status: 401 });

  const user = await cryptoPrisma.user.findUnique({
    where: { id: userId },
    select: { isDeleted: true },
  });

  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  if (user.isDeleted) return NextResponse.json({ error: "already_deleted" }, { status: 400 });

  if (await hasActiveSubscription(userId)) {
    return NextResponse.json(
      { error: "active_subscription", message: "active_subscription" },
      { status: 409 }
    );
  }

  const dataExpiracao = new Date();
  dataExpiracao.setDate(dataExpiracao.getDate() + 30);

  await cryptoPrisma.user.update({
    where: { id: userId },
    data: { isDeleted: true, dataExclusao: null, dataExpiracao },
  });

  return NextResponse.json({
    success: true,
    message: "Conta desativada com sucesso. Você terá 30 dias para reativar sua conta.",
    dataExpiracao: dataExpiracao.toISOString(),
  });
}
