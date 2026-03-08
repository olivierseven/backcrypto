// POST /api/biogenerator/checkout — cria sessão Stripe Checkout (Bio, variáveis BG_*)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { CheckoutStatus } from "@/lib/prisma-bio-client";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate";
import { dbg, warn, error } from "@/lib/logger";
import { getBalance } from "@/lib/spend-coins";
import { decryptEmail } from "@/lib/crypto";

const MAX_COINS_BEFORE_PURCHASE = 700_000_000; // 700 milhões — não permitir compra acima disso

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const APP_URL = process.env.APP_URL || "http://localhost:3004";
const BASE_PATH = process.env.APP_BASE_PATH || "/backcrypto";

const BG_STRIPE_SECRET = process.env.BG_STRIPE_SECRET_KEY;
const BG_PRICE_7 = process.env.BG_PRICE_COINS_7;
const BG_PRICE_49 = process.env.BG_PRICE_COINS_49;

// $7 → 49.000 coins | $49 → 490.000 coins (30% desconto)
const PLANS = {
  "7": { priceId: BG_PRICE_7!, coins: 49_000, amountCents: 700 },
  "49": { priceId: BG_PRICE_49!, coins: 490_000, amountCents: 4900 },
} as const;

type PlanKey = keyof typeof PLANS;

export async function POST(req: Request) {
  if (!BG_STRIPE_SECRET || !BG_PRICE_7 || !BG_PRICE_49) {
    error("[bio/checkout] missing BG_STRIPE_SECRET_KEY or BG_PRICE_COINS_7/49");
    return NextResponse.json({ error: "checkout_not_configured" }, { status: 503 });
  }

  const { ok } = rateLimit(clientKeyFromRequest(req, "bio-checkout"), 10, 60_000);
  if (!ok) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { sub?: string };
  try {
    const result = await jwtVerify(token, JWT_SECRET);
    payload = result.payload as { sub?: string };
  } catch {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  const userId = typeof payload?.sub === "string" ? payload.sub : null;
  if (!userId) {
    return NextResponse.json({ error: "invalid_user" }, { status: 401 });
  }

  const user = await cryptoPrisma.user.findUnique({
    where: { id: userId },
    select: { id: true, emailEnc: true, emailIv: true, emailTag: true },
  });
  if (!user) {
    warn(`[bio/checkout] user not in Bio DB userId=${userId.slice(0, 8)}...`);
    return NextResponse.json({ error: "user_not_found" }, { status: 403 });
  }

  let customerEmail: string | null = null;
  try {
    customerEmail = decryptEmail(user.emailEnc, user.emailIv, user.emailTag);
  } catch {
    // ignora se não conseguir descriptografar
  }

  let body: { plan?: string; returnTo?: string; taxId?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const planKey: PlanKey = body?.plan === "49" ? "49" : "7";
  const taxIdRaw = typeof body?.taxId === "string" ? body.taxId.trim().slice(0, 30) : "";
  const taxId = taxIdRaw.length >= 3 ? taxIdRaw : null;
  const plan = PLANS[planKey];

  const balance = await getBalance(userId);
  if (balance >= MAX_COINS_BEFORE_PURCHASE) {
    return NextResponse.json(
      { error: "balance_limit_reached", message: "Você já possui o limite máximo de coins. Não é possível comprar mais." },
      { status: 400 }
    );
  }

  if (!plan?.priceId) {
    error(`[bio/checkout] missing priceId for plan ${planKey}`);
    return NextResponse.json({ error: "missing_price" }, { status: 500 });
  }

  let returnTo = typeof body?.returnTo === "string" && body.returnTo.startsWith("/") ? body.returnTo : `${BASE_PATH}/sistema`;
  const fullReturnTo = returnTo.startsWith(BASE_PATH) ? returnTo : `${BASE_PATH}${returnTo}`;

  const stripe = new Stripe(BG_STRIPE_SECRET);

  try {
    const metadata: Record<string, string> = {
      userId,
      coins: String(plan.coins),
      plan: planKey,
      returnTo: fullReturnTo,
      bio: "1",
      taxId: taxId ?? "",
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${APP_URL}${fullReturnTo}?status=success`,
      cancel_url: `${APP_URL}/backcrypto/plans?status=cancel`,
      client_reference_id: userId,
      metadata,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
    });

    await cryptoPrisma.stripeCheckoutSession.upsert({
      where: { id: session.id },
      update: {
        userId,
        amountTotalCents: plan.amountCents,
        coinsToCredit: plan.coins,
        pricingLabel: planKey === "7" ? "$7→49k" : "$49→490k",
        currency: "USD",
      },
      create: {
        id: session.id,
        userId,
        status: CheckoutStatus.CREATED,
        amountTotalCents: plan.amountCents,
        coinsToCredit: plan.coins,
        currency: "USD",
        pricingLabel: planKey === "7" ? "$7→49k" : "$49→490k",
      },
    });

    dbg(`[bio/checkout] session created session=${session.id.slice(0, 12)}... plan=${planKey} coins=${plan.coins}`);
    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    error(`[bio/checkout] stripe error: ${msg}`);
    return NextResponse.json({ error: msg || "internal_error" }, { status: 500 });
  }
}
