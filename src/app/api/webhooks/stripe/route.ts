// POST /api/webhooks/stripe — webhook Stripe para Crypto (STRIPE_WEBHOOK_SECRET)
// Eventos: checkout.session.completed (pagamento avulso), checkout.session.expired, invoice.payment_succeeded (assinatura: 7$/mês ou 49$/ano).
// No Dashboard Stripe → Webhooks → adicione invoice.payment_succeeded ao endpoint.
// URL produção (com basePath): https://<seu-dominio>/crypto/api/webhooks/stripe
// Se a entrega falhar com 308 "Redirecting...": a URL está sendo redirecionada pela hospedagem (ex.: Vercel Deployment Protection).
//   Solução: em Vercel → Project Settings → Deployment Protection → desative para o projeto ou adicione exceção para /crypto/api/webhooks/stripe se existir.
// Em localhost (porta 3004): "stripe listen --forward-to localhost:3004/crypto/api/webhooks/stripe" e use o signing secret do CLI.
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cryptoPrisma } from "@/lib/crypto-db";
import { CheckoutStatus, TxSource, TxType, Tier } from "@/lib/prisma-bio-client";
import { sendEmail } from "@/lib/mailer";
import { decryptEmail } from "@/lib/crypto";
import { getCryptoT, type CryptoLang } from "@/app/lib/translations";
import { dbg, warn, error } from "@/lib/logger";

const APP_URL = process.env.APP_URL || "http://localhost:3004";
const BASE_PATH = process.env.APP_BASE_PATH || "/crypto";
/** URL usada em links de e-mail; deve ser o domínio de envio (ex: https://sevencoins.com.br) para evitar spam. */
const EMAIL_LINK_BASE =
  process.env.EMAIL_APP_URL ||
  (APP_URL.startsWith("http://localhost") || APP_URL.startsWith("https://localhost")
    ? "https://sevencoins.com.br"
    : APP_URL);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const PRICE_ID_7 = process.env.PRICE_COINS_7;
const PRICE_ID_49 = process.env.PRICE_COINS_49;

function pricingLabel(coins: number): string {
  if (coins >= 49) return "$49";
  if (coins >= 7) return "$7";
  return "custom";
}

function computeExpiryMonths(coins: number): number {
  if (coins >= 49) return 12;
  if (coins >= 7) return 1;
  return 1;
}

function computeExpiresAt(coins: number, base: Date): Date {
  const months = computeExpiryMonths(coins);
  const d = new Date(base);
  const dayBefore = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // Se o mês não tem esse dia (ex.: 31/01 + 1 mês → 31 não existe em fev), o JS vira 2/3 de março.
  // Ajustar para o último dia do mês alvo (ex.: 28 ou 29 de fevereiro).
  if (d.getUTCDate() !== dayBefore) {
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0);
  }
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

async function handleCheckoutCompleted(event: Stripe.Event, session: Stripe.Checkout.Session) {
  if (session.metadata?.crypto !== "1" && session.metadata?.bio !== "1") {
    dbg(`[crypto/stripe] skip: not Crypto session session=${session.id}`);
    return;
  }

  // Assinatura: o crédito é feito em invoice.payment_succeeded (a cada cobrança mensal/anual)
  if (session.mode === "subscription") {
    dbg(`[crypto/stripe] skip subscription session, credit on invoice.payment_succeeded session=${session.id}`);
    return;
  }

  if (session.mode !== "payment" || session.payment_status !== "paid") {
    warn(`[crypto/stripe] invalid mode/status session=${session.id}`);
    return;
  }

  const userId = (session.metadata?.userId ?? session.client_reference_id ?? "").trim();
  if (!userId) {
    warn(`[crypto/stripe] missing userId session=${session.id}`);
    return;
  }

  const coinsRaw = (session.metadata?.coins ?? "").trim();
  const coins = Math.floor(Number(coinsRaw)) || 0;
  if (coins <= 0) {
    warn(`[crypto/stripe] invalid coins session=${session.id}`);
    return;
  }

  const amountCents = session.amount_total ?? 0;
  const completedAt = new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000);

  await cryptoPrisma.$transaction(async (tx) => {
    await tx.stripeCheckoutSession.upsert({
      where: { id: session.id },
      update: {
        userId,
        status: CheckoutStatus.COMPLETED,
        amountTotalCents: amountCents,
        coinsToCredit: coins,
        currency: (session.currency ?? "usd").toUpperCase(),
        pricingLabel: pricingLabel(coins),
        completedAt,
      },
      create: {
        id: session.id,
        userId,
        status: CheckoutStatus.COMPLETED,
        amountTotalCents: amountCents,
        coinsToCredit: coins,
        currency: (session.currency ?? "usd").toUpperCase(),
        pricingLabel: pricingLabel(coins),
        completedAt,
        createdAt: completedAt,
      },
    });

    const wallet = await tx.userCoinWallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
      select: { id: true },
    });

    let entry = await tx.coinLedgerEntry.findFirst({
      where: { source: TxSource.STRIPE, refId: session.id },
      select: { id: true },
    });

    if (!entry) {
      entry = await tx.coinLedgerEntry.create({
        data: {
          userId,
          walletId: wallet.id,
          type: TxType.CREDIT,
          source: TxSource.STRIPE,
          amount: coins,
          refId: session.id,
          meta: { eventId: event.id, amount_total: session.amount_total, currency: session.currency, crypto: true },
          createdAt: completedAt,
        },
        select: { id: true },
      });
      await tx.userCoinWallet.update({
        where: { userId },
        data: { balance: { increment: coins } },
      });
    }

    const expiresAt = computeExpiresAt(coins, completedAt);
    await tx.walletCredit.upsert({
      where: { entryId: entry.id },
      update: {},
      create: {
        userId,
        entryId: entry.id,
        amount: coins,
        consumed: 0,
        expiresAt,
      },
      select: { id: true },
    });
    await tx.user.updateMany({
      where: { id: userId },
      data: { tier: Tier.lite },
    });
  });

  dbg(`[crypto/stripe] credited coins=${coins} userId=${userId.slice(0, 8)}... session=${session.id}`);

  // Recibo por e-mail — priorizar email do usuário no banco (quem recebeu as coins)
  // para evitar envio ao email errado por autofill/Stripe Link no checkout
  const [local, user] = await Promise.all([
    cryptoPrisma.stripeCheckoutSession.findUnique({
      where: { id: session.id },
      select: { status: true, coinsToCredit: true, amountTotalCents: true },
    }),
    cryptoPrisma.user.findUnique({
      where: { id: userId },
      select: { language: true, emailEnc: true, emailIv: true, emailTag: true },
    }),
  ]);
  let receiptTo = "";
  if (user?.emailEnc && user?.emailIv && user?.emailTag) {
    try {
      receiptTo = decryptEmail(user.emailEnc, user.emailIv, user.emailTag);
    } catch {
      receiptTo = session.customer_details?.email || session.customer_email || "";
    }
  } else {
    receiptTo = session.customer_details?.email || session.customer_email || "";
  }
  if (receiptTo) {

    if (local?.status === CheckoutStatus.COMPLETED) {
      const coins = local.coinsToCredit ?? 0;
      const cents = local.amountTotalCents ?? 0;
      const valor = (cents / 100).toFixed(2).replace(".", ",");
      const publicRef = `BG-${session.id.slice(-8).toUpperCase()}`;
      const dashboardUrl = `${EMAIL_LINK_BASE}${BASE_PATH}/sistema`;
      const lang: CryptoLang = user?.language === "pt" ? "pt" : "en";
      const t = getCryptoT(lang).receiptEmail;
      const countStr = coins.toLocaleString(lang === "pt" ? "pt-BR" : "en-US");

      const subject = t.subject;
      const receivedPayment = t.receivedPayment.replace("{valor}", valor);
      const creditedCoins = t.creditedCoins.replace("{count}", countStr);
      const codeOp = t.codeOp.replace("{ref}", publicRef);

      try {
        await sendEmail({
          to: receiptTo,
          subject,
          html: `
            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.55;color:#111;padding:8px">
              <h2 style="margin:0 0 12px;font-size:20px;font-weight:600">${t.title}</h2>
              
              <p style="margin:0 0 8px">${receivedPayment}</p>
              <p style="margin:0 0 12px">${creditedCoins}</p>
              
              <p style="margin:18px 0">
                <a href="${dashboardUrl}"
                  style="display:inline-block;padding:10px 16px;border-radius:10px;
                          background:#111;color:#fff;text-decoration:none;font-size:14px;
                          font-weight:600;text-align:center"
                  role="button">
                  ${t.viewCoins}
                </a>
              </p>
              
              <p style="margin:14px 0 0;font-size:13px;color:#555">${codeOp}</p>

              <p style="margin:18px 0 4px;font-size:13px;color:#555">
                ${t.automaticMessage}<br>
                ${t.doNotReply}
              </p>

              <p style="margin:0">
                <a href="${t.website}" style="color:#0073e6;text-decoration:none">
                  ${t.website}
                </a>
              </p>
            </div>
          `,
        });
        dbg(`[crypto/stripe] receipt email OK to=${receiptTo} session=${session.id} lang=${lang}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        warn(`[crypto/stripe] receipt email ERROR to=${receiptTo} session=${session.id} msg=${msg}`);
      }
    }
  }
}

/**
 * Cobrança recorrente da assinatura: a cada mês ($7) ou ano ($49) que o Stripe cobra e paga,
 * creditamos 7 ou 49 coins. Se o usuário cancelar o cartão ou parar de pagar, não há evento → não creditamos.
 */
async function handleInvoicePaymentSucceeded(stripe: Stripe, invoice: Stripe.Invoice): Promise<void> {
  let subscriptionId: string | null = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id ?? null;
  // API 2025+: subscription pode vir em parent.subscription_details.subscription
  if (!subscriptionId && invoice.parent && typeof invoice.parent === "object") {
    const parent = invoice.parent as { subscription_details?: { subscription?: string } };
    const subFromParent = parent.subscription_details?.subscription;
    if (typeof subFromParent === "string") subscriptionId = subFromParent;
  }
  if (!subscriptionId) {
    try {
      const fullInvoice = await stripe.invoices.retrieve(invoice.id, { expand: ["subscription"] });
      subscriptionId = typeof fullInvoice.subscription === "string" ? fullInvoice.subscription : fullInvoice.subscription?.id ?? null;
      if (!subscriptionId && (fullInvoice as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription) {
        subscriptionId = (fullInvoice as { parent: { subscription_details: { subscription: string } } }).parent.subscription_details.subscription;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      dbg(`[crypto/stripe] invoice ${invoice.id} retrieve failed: ${msg}`);
    }
  }
  if (!subscriptionId) {
    dbg(`[crypto/stripe] invoice ${invoice.id} has no subscription, skip`);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = (subscription.metadata?.userId ?? "").trim();
  if (!userId || (subscription.metadata?.crypto !== "1" && subscription.metadata?.bio !== "1")) {
    dbg(`[crypto/stripe] invoice ${invoice.id} subscription not Crypto, skip`);
    return;
  }

  const firstLine = invoice.lines?.data?.[0];
  const priceId =
    firstLine?.price?.id ??
    (firstLine as { pricing?: { price_details?: { price?: string } } } | undefined)?.pricing?.price_details?.price;
  let coins = 0;
  if (priceId === PRICE_ID_7) coins = 7;
  else if (priceId === PRICE_ID_49) coins = 49;
  if (coins <= 0) {
    warn(`[crypto/stripe] invoice ${invoice.id} unknown price ${priceId ?? "null"}, skip`);
    return;
  }

  const existing = await cryptoPrisma.coinLedgerEntry.findFirst({
    where: { source: TxSource.STRIPE, refId: invoice.id },
    select: { id: true },
  });
  if (existing) {
    dbg(`[crypto/stripe] invoice ${invoice.id} already credited, skip`);
    return;
  }

  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : new Date();
  const amountCents = invoice.amount_paid ?? 0;

  await cryptoPrisma.$transaction(async (tx) => {
    const wallet = await tx.userCoinWallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
      select: { id: true },
    });

    const entry = await tx.coinLedgerEntry.create({
      data: {
        userId,
        walletId: wallet.id,
        type: TxType.CREDIT,
        source: TxSource.STRIPE,
        amount: coins,
        refId: invoice.id,
        meta: { invoiceId: invoice.id, subscriptionId, amount_paid: amountCents, crypto: true, recurring: true },
        createdAt: paidAt,
      },
      select: { id: true },
    });
    await tx.userCoinWallet.update({
      where: { userId },
      data: { balance: { increment: coins } },
    });

    const expiresAt = computeExpiresAt(coins, paidAt);
    await tx.walletCredit.create({
      data: {
        userId,
        entryId: entry.id,
        amount: coins,
        consumed: 0,
        expiresAt,
        createdAt: paidAt,
      },
      select: { id: true },
    });
    await tx.user.updateMany({
      where: { id: userId },
      data: { tier: Tier.lite },
    });
  });

  dbg(`[crypto/stripe] invoice credited coins=${coins} userId=${userId.slice(0, 8)}... invoice=${invoice.id}`);

  const user = await cryptoPrisma.user.findUnique({
    where: { id: userId },
    select: { language: true, emailEnc: true, emailIv: true, emailTag: true },
  });
  let receiptTo = "";
  if (user?.emailEnc && user?.emailIv && user?.emailTag) {
    try {
      receiptTo = decryptEmail(user.emailEnc, user.emailIv, user.emailTag);
    } catch {
      /* ignore */
    }
  }
  if (receiptTo) {
    const valor = (amountCents / 100).toFixed(2).replace(".", ",");
    const publicRef = `BG-${invoice.id.slice(-8).toUpperCase()}`;
    const dashboardUrl = `${EMAIL_LINK_BASE}${BASE_PATH}/sistema`;
    const lang: CryptoLang = user?.language === "pt" ? "pt" : "en";
    const t = getCryptoT(lang).receiptEmail;
    const countStr = coins.toLocaleString(lang === "pt" ? "pt-BR" : "en-US");
    const subject = t.subject;
    const receivedPayment = t.receivedPayment.replace("{valor}", valor);
    const creditedCoins = t.creditedCoins.replace("{count}", countStr);
    const codeOp = t.codeOp.replace("{ref}", publicRef);
    try {
      await sendEmail({
        to: receiptTo,
        subject,
        html: `
            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.55;color:#111;padding:8px">
              <h2 style="margin:0 0 12px;font-size:20px;font-weight:600">${t.title}</h2>
              <p style="margin:0 0 8px">${receivedPayment}</p>
              <p style="margin:0 0 12px">${creditedCoins}</p>
              <p style="margin:18px 0">
                <a href="${dashboardUrl}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#111;color:#fff;text-decoration:none;font-size:14px;font-weight:600;text-align:center" role="button">${t.viewCoins}</a>
              </p>
              <p style="margin:14px 0 0;font-size:13px;color:#555">${codeOp}</p>
              <p style="margin:18px 0 4px;font-size:13px;color:#555">${t.automaticMessage}<br>${t.doNotReply}</p>
              <p style="margin:0"><a href="${t.website}" style="color:#0073e6;text-decoration:none">${t.website}</a></p>
            </div>
          `,
      });
      dbg(`[crypto/stripe] receipt email OK to=${receiptTo} invoice=${invoice.id} lang=${lang}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`[crypto/stripe] receipt email ERROR to=${receiptTo} invoice=${invoice.id} msg=${msg}`);
    }
  }
}

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET || !STRIPE_SECRET) {
    error("[crypto/stripe] missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const stripe = new Stripe(STRIPE_SECRET);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`[crypto/stripe] webhook signature failed: ${msg}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await cryptoPrisma.stripeEvent.create({
      data: { id: event.id, type: event.type, payload: event as unknown as object },
    });
    dbg(`[crypto/stripe] event persisted ${event.id} type=${event.type}`);
  } catch {
    dbg(`[crypto/stripe] duplicate event ${event.id}`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(event, session);
    } else if (event.type === "checkout.session.expired") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.metadata?.crypto === "1" || s.metadata?.bio === "1") {
        await cryptoPrisma.stripeCheckoutSession.updateMany({
          where: { id: s.id, status: CheckoutStatus.CREATED },
          data: { status: CheckoutStatus.CANCELED },
        });
      }
    } else if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaymentSucceeded(stripe, invoice);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    error(`[crypto/stripe] handler error: ${msg}`);
    throw e;
  }

  return NextResponse.json({ received: true });
}
