// POST /api/biogenerator/webhooks/stripe — webhook Stripe para Bio (BG_STRIPE_WEBHOOK_SECRET)
// Crédito de coins e e-mail de recibo só ocorrem quando este webhook é chamado. Em localhost o Stripe
// não consegue acessar sua máquina: use "stripe listen --forward-to localhost:PORT/biogenerator/api/webhooks/stripe"
// e BG_STRIPE_WEBHOOK_SECRET do CLI, ou teste em ambiente com URL pública.
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { bioPrisma } from "@/lib/bio-db";
import { CheckoutStatus, TxSource, TxType } from "@/lib/prisma-bio-client";
import { sendEmail } from "@/lib/mailer";
import { decryptEmail } from "@/lib/crypto";
import { getBioT, type BioLang } from "@/app/lib/translations";
import { dbg, warn, error } from "@/lib/logger";

const APP_URL = process.env.APP_URL || "http://localhost:3004";
const BASE_PATH = process.env.APP_BASE_PATH || "/backcrypto";
/** URL usada em links de e-mail; deve ser o domínio de envio (ex: https://sevencoins.com.br) para evitar spam. */
const EMAIL_LINK_BASE =
  process.env.EMAIL_APP_URL ||
  (APP_URL.startsWith("http://localhost") || APP_URL.startsWith("https://localhost")
    ? "https://sevencoins.com.br"
    : APP_URL);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BG_WEBHOOK_SECRET = process.env.BG_STRIPE_WEBHOOK_SECRET;
const BG_STRIPE_SECRET = process.env.BG_STRIPE_SECRET_KEY;

function pricingLabel(coins: number): string {
  if (coins >= 490_000) return "$49→490k";
  if (coins >= 49_000) return "$7→49k";
  return "custom";
}

function computeExpiryMonths(coins: number): number {
  if (coins >= 490_000) return 12;
  if (coins >= 49_000) return 1;
  return 1;
}

function computeExpiresAt(coins: number, base: Date): Date {
  const months = computeExpiryMonths(coins);
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + months);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

async function handleCheckoutCompleted(event: Stripe.Event, session: Stripe.Checkout.Session) {
  if (session.metadata?.bio !== "1") {
    dbg(`[bio/stripe] skip: not Bio session session=${session.id}`);
    return;
  }

  if (session.mode !== "payment" || session.payment_status !== "paid") {
    warn(`[bio/stripe] invalid mode/status session=${session.id}`);
    return;
  }

  const userId = (session.metadata?.userId ?? session.client_reference_id ?? "").trim();
  if (!userId) {
    warn(`[bio/stripe] missing userId session=${session.id}`);
    return;
  }

  const coinsRaw = (session.metadata?.coins ?? "").trim();
  const coins = Math.floor(Number(coinsRaw)) || 0;
  if (coins <= 0) {
    warn(`[bio/stripe] invalid coins session=${session.id}`);
    return;
  }

  const amountCents = session.amount_total ?? 0;
  const completedAt = new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000);

  await bioPrisma.$transaction(async (tx) => {
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
          meta: { eventId: event.id, amount_total: session.amount_total, currency: session.currency, bio: true },
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
  });

  dbg(`[bio/stripe] credited coins=${coins} userId=${userId.slice(0, 8)}... session=${session.id}`);

  // Recibo por e-mail — priorizar email do usuário no banco (quem recebeu as coins)
  // para evitar envio ao email errado por autofill/Stripe Link no checkout
  const [local, user] = await Promise.all([
    bioPrisma.stripeCheckoutSession.findUnique({
      where: { id: session.id },
      select: { status: true, coinsToCredit: true, amountTotalCents: true },
    }),
    bioPrisma.user.findUnique({
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
      const lang: BioLang = user?.language === "pt" ? "pt" : "en";
      const t = getBioT(lang).receiptEmail;
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
        dbg(`[bio/stripe] receipt email OK to=${receiptTo} session=${session.id} lang=${lang}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        warn(`[bio/stripe] receipt email ERROR to=${receiptTo} session=${session.id} msg=${msg}`);
      }
    }
  }
}

export async function POST(req: Request) {
  if (!BG_WEBHOOK_SECRET || !BG_STRIPE_SECRET) {
    error("[bio/stripe] missing BG_STRIPE_WEBHOOK_SECRET or BG_STRIPE_SECRET_KEY");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const stripe = new Stripe(BG_STRIPE_SECRET);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, BG_WEBHOOK_SECRET);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`[bio/stripe] webhook signature failed: ${msg}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await bioPrisma.stripeEvent.create({
      data: { id: event.id, type: event.type, payload: event as unknown as object },
    });
    dbg(`[bio/stripe] event persisted ${event.id} type=${event.type}`);
  } catch {
    dbg(`[bio/stripe] duplicate event ${event.id}`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(event, session);
    } else if (event.type === "checkout.session.expired") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.metadata?.bio === "1") {
        await bioPrisma.stripeCheckoutSession.updateMany({
          where: { id: s.id, status: CheckoutStatus.CREATED },
          data: { status: CheckoutStatus.CANCELED },
        });
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    error(`[bio/stripe] handler error: ${msg}`);
    throw e;
  }

  return NextResponse.json({ received: true });
}
