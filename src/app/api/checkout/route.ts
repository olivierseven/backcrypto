// POST …/api/checkout — Stripe Checkout (Crypto; basePath /crypto)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { CheckoutStatus } from "@/lib/prisma-bio-client";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate";
import { dbg, warn, error } from "@/lib/logger";
import { getBalance } from "@/lib/spend-coins";
import { hasActivePaidCredits } from "@/lib/user-tier";
import { decryptEmail } from "@/lib/crypto";
import { resolveAffiliateCouponForPlanCheckout } from "@/lib/affiliate-coupon-plan";

const MAX_COINS_BEFORE_PURCHASE = 700_000_000; // 700 milhões — não permitir compra acima disso

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const APP_URL = process.env.APP_URL || "http://localhost:3004";
const BASE_PATH = process.env.APP_BASE_PATH || "/crypto";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const PRICE_7 = process.env.PRICE_COINS_7;
const PRICE_49 = process.env.PRICE_COINS_49;
const PRICE_7_20OFF = process.env.PRICE_COINS_7_20OFF;
const PRICE_49_20OFF = process.env.PRICE_COINS_49_20OFF;

type PlanKey = "7" | "49";

type ResolvedStripePlan = {
  priceId: string;
  coins: number;
  amountCents: number;
  pricingLabel: string;
};

function resolveStripePlan(planKey: PlanKey, usePromo: boolean): ResolvedStripePlan | { error: "promo_prices_missing" } {
  if (usePromo) {
    if (!PRICE_7_20OFF || !PRICE_49_20OFF) {
      return { error: "promo_prices_missing" };
    }
    const row =
      planKey === "49"
        ? { priceId: PRICE_49_20OFF, amountCents: 6200, pricingLabel: "$62/ano" }
        : { priceId: PRICE_7_20OFF, amountCents: 900, pricingLabel: "$9/mês" };
    return { ...row, coins: row.amountCents / 100 };
  }
  const row =
    planKey === "49"
      ? { priceId: PRICE_49!, amountCents: 7700, pricingLabel: "$77/ano" }
      : { priceId: PRICE_7!, amountCents: 1100, pricingLabel: "$11/mês" };
  return { ...row, coins: row.amountCents / 100 };
}

/** Valida CPF pelos dígitos verificadores (mesmo critério do PIX/Pagar.me). */
function isValidCpf(digits: string): boolean {
  if (typeof digits !== "string" || digits.length !== 11) return false;
  const d = digits.split("").map(Number);
  if (d.some((n) => !Number.isFinite(n))) return false;
  if (new Set(d).size === 1) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += d[i]! * (10 - i);
  let first = (sum * 10) % 11;
  if (first === 10) first = 0;
  if (first !== d[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += d[i]! * (11 - i);
  let second = (sum * 10) % 11;
  if (second === 10) second = 0;
  return second === d[10];
}

export async function POST(req: Request) {
  if (!STRIPE_SECRET || !PRICE_7 || !PRICE_49) {
    error("[crypto/checkout] missing STRIPE_SECRET_KEY or PRICE_COINS_7/49");
    return NextResponse.json({ error: "checkout_not_configured" }, { status: 503 });
  }

  const { ok } = rateLimit(clientKeyFromRequest(req, "crypto-checkout"), 10, 60_000);
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
    select: { id: true, language: true, emailEnc: true, emailIv: true, emailTag: true },
  });
  if (!user) {
    warn(`[crypto/checkout] user not in DB userId=${userId.slice(0, 8)}...`);
    return NextResponse.json({ error: "user_not_found" }, { status: 403 });
  }

  let customerEmail: string | null = null;
  try {
    customerEmail = decryptEmail(user.emailEnc, user.emailIv, user.emailTag);
  } catch {
    // ignora se não conseguir descriptografar
  }

  let body: {
    plan?: string;
    returnTo?: string;
    tax_code?: string;
    cpf?: string;
    coupon?: string;
    cupom_id?: string;
    idAfiliado?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const cupomInput =
    (typeof body.cupom_id === "string" && body.cupom_id.trim()
      ? body.cupom_id
      : typeof body.coupon === "string"
        ? body.coupon
        : undefined) ?? undefined;

  const planKey: PlanKey = body?.plan === "49" ? "49" : "7";

  const cupomResolved = await resolveAffiliateCouponForPlanCheckout(cupomInput);
  if (!cupomResolved.ok) {
    return NextResponse.json({ error: cupomResolved.error }, { status: 400 });
  }
  const affiliate = cupomResolved.affiliate;
  const usePromo = affiliate !== null;
  const taxCodeRaw = typeof body?.tax_code === "string" ? body.tax_code.trim().slice(0, 30) : "";
  const taxCode = taxCodeRaw.length >= 3 ? taxCodeRaw : null;
  const cpfRaw = typeof body?.cpf === "string" ? body.cpf.replace(/\D/g, "").slice(0, 11) : "";
  let userCpf = cpfRaw.length === 11 && isValidCpf(cpfRaw) ? cpfRaw : "";
  // Em modo en: se tax_code for um CPF válido (11 dígitos), incluir em user_cpf
  if (!userCpf && taxCodeRaw) {
    const taxCodeDigits = taxCodeRaw.replace(/\D/g, "").slice(0, 11);
    if (taxCodeDigits.length === 11 && isValidCpf(taxCodeDigits)) userCpf = taxCodeDigits;
  }
  const userLang = user.language?.toLowerCase();
  const requireCpfForPt = userLang === "pt" || userLang === "pt-br";

  if (requireCpfForPt && !userCpf) {
    return NextResponse.json(
      { error: "cpf_required", message: "Para pagamento com cartão, informe o CPF." },
      { status: 400 }
    );
  }

  const resolved = resolveStripePlan(planKey, usePromo);
  if ("error" in resolved) {
    error("[crypto/checkout] valid coupon but PRICE_COINS_*_20OFF missing");
    return NextResponse.json(
      { error: "promo_unavailable", message: "Cupom válido, mas preços promocionais não estão configurados no servidor." },
      { status: 503 }
    );
  }
  const plan = resolved;

  const balance = await getBalance(userId);
  if (balance >= MAX_COINS_BEFORE_PURCHASE) {
    return NextResponse.json(
      { error: "balance_limit_reached", message: "Você já possui o limite máximo de coins. Não é possível comprar mais." },
      { status: 400 }
    );
  }

  const hasActivePaid = await hasActivePaidCredits(userId);
  if (hasActivePaid) {
    return NextResponse.json(
      { error: "already_has_active_plan", message: "Você já possui créditos ativos. Use-os ou aguarde o vencimento antes de comprar novamente." },
      { status: 409 }
    );
  }

  if (!plan?.priceId) {
    error(`[crypto/checkout] missing priceId for plan ${planKey}`);
    return NextResponse.json({ error: "missing_price" }, { status: 500 });
  }

  let returnTo = typeof body?.returnTo === "string" && body.returnTo.startsWith("/") ? body.returnTo : `${BASE_PATH}/sistema`;
  const fullReturnTo = returnTo.startsWith(BASE_PATH) ? returnTo : `${BASE_PATH}${returnTo}`;

  const stripe = new Stripe(STRIPE_SECRET);

  const productName =
    process.env.NODE_ENV === "production" ? "Crypto Strategy Coins" : "Crypto Strategy Coins Test";

  try {
    const metadata: Record<string, string> = {
      product_name: productName,
      userId,
      coins: String(plan.coins),
      plan: planKey,
      returnTo: fullReturnTo,
      crypto: "1",
      tax_code: taxCode ?? "",
      user_cpf: userCpf,
      promo_20off: usePromo ? "1" : "",
      cupom_id: affiliate?.code ?? "",
      affiliate_account_id: affiliate?.affiliateAccountId ?? "",
    };

    // Stripe: assinatura recorrente — $11/mês ou $77/ano (ou $9/$62 com cupom); crédito a cada invoice.payment_succeeded no webhook
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${APP_URL}${fullReturnTo}?status=success`,
      cancel_url: `${APP_URL}/crypto/plans?status=cancel`,
      client_reference_id: userId,
      metadata,
      subscription_data: {
        metadata: {
          userId,
          coins: String(plan.coins),
          plan: planKey,
          crypto: "1",
          promo_20off: usePromo ? "1" : "",
          cupom_id: affiliate?.code ?? "",
          affiliate_account_id: affiliate?.affiliateAccountId ?? "",
        },
      },
      ...(customerEmail ? { customer_email: customerEmail } : {}),
    });

    await cryptoPrisma.stripeCheckoutSession.upsert({
      where: { id: session.id },
      update: {
        userId,
        amountTotalCents: plan.amountCents,
        coinsToCredit: plan.coins,
        pricingLabel: plan.pricingLabel,
        currency: "USD",
      },
      create: {
        id: session.id,
        userId,
        status: CheckoutStatus.CREATED,
        amountTotalCents: plan.amountCents,
        coinsToCredit: plan.coins,
        currency: "USD",
        pricingLabel: plan.pricingLabel,
      },
    });

    dbg(`[crypto/checkout] session created session=${session.id.slice(0, 12)}... plan=${planKey} coins=${plan.coins}`);
    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    error(`[crypto/checkout] stripe error: ${msg}`);
    return NextResponse.json({ error: msg || "internal_error" }, { status: 500 });
  }
}
