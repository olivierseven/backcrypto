// Lógica de order.paid do webhook Pagar.me (Crypto) — extraída para poder ser importada por outras rotas
import { cryptoPrisma } from "@/lib/crypto-db";
import { CheckoutStatus, TxSource, TxType, Tier } from "@/lib/prisma-bio-client";
import { sendEmail } from "@/lib/mailer";
import { decryptEmail } from "@/lib/crypto";
import { getCryptoT, type CryptoLang } from "@/app/lib/translations";
import { dbg, warn } from "@/lib/logger";
import { computeExpiresAtUtcFromMonthDelta } from "@/lib/wallet-credit-expiry";

const APP_URL = process.env.APP_URL || "http://localhost:3004";
const BASE_PATH = process.env.APP_BASE_PATH || "/crypto";
const EMAIL_LINK_BASE =
  process.env.EMAIL_APP_URL ||
  (APP_URL.startsWith("http://localhost") || APP_URL.startsWith("https://localhost")
    ? "https://sevencoins.com.br"
    : APP_URL);

function getDurationMonthsCryptoFromPlan(planKey: string): number {
  if (planKey === "49") return 12;
  return 1;
}

function computeExpiryCryptoFromPlan(planKey: string, base: Date): Date {
  const months = getDurationMonthsCryptoFromPlan(planKey);
  return computeExpiresAtUtcFromMonthDelta(base, months);
}

export async function handleOrderPaid(data: any) {
  const orderId = data?.id;
  if (!orderId) {
    warn(`[pagarme-crypto] order.paid missing data.id`);
    return;
  }

  const bioOrder = await cryptoPrisma.pagarMeOrder.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, coinsToCredit: true, amountTotalCents: true },
  });
  if (!bioOrder) {
    dbg(`[pagarme-crypto] order.paid orderId=${orderId} not in DB, skip`);
    return;
  }

  const userId = bioOrder.userId;
  const planKey = String(data?.metadata?.plan ?? "");
  // Coins: prefer DB (set at order creation). Fallback a metadata.coins; não usar data.amount (é BRL).
  let coinsToCredit = (bioOrder.coinsToCredit ?? Number(data?.metadata?.coins)) || 0;
  if (coinsToCredit <= 0) {
    warn(`[pagarme-crypto] order.paid orderId=${orderId} missing coinsToCredit and metadata.coins, defaulting to 11`);
    coinsToCredit = 11;
  }
  const amountCents = data?.amount ?? bioOrder.amountTotalCents ?? 0;
  const completedAt = data?.updated_at ? new Date(data.updated_at) : new Date();

  dbg(`[pagarme-crypto] order.paid orderId=${orderId} userId=${userId.slice(0, 8)}... coins=${coinsToCredit}`);

  await cryptoPrisma.$transaction(async (tx) => {
    await tx.pagarMeOrder.updateMany({
      where: { id: orderId, userId },
      data: { status: CheckoutStatus.COMPLETED, amountTotalCents: amountCents, coinsToCredit: coinsToCredit, completedAt },
    });

    const wallet = await tx.userCoinWallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
      select: { id: true },
    });

    let entry = await tx.coinLedgerEntry.findFirst({
      where: { source: TxSource.PAGARME, refId: orderId },
      select: { id: true, walletId: true },
    });

    if (!entry) {
      entry = await tx.coinLedgerEntry.create({
        data: {
          userId,
          walletId: wallet.id,
          type: TxType.CREDIT,
          source: TxSource.PAGARME,
          amount: coinsToCredit,
          refId: orderId,
          meta: { orderId, amount_total: amountCents, event: "order.paid", crypto: true },
          createdAt: completedAt,
        },
        select: { id: true, walletId: true },
      });
      await tx.userCoinWallet.update({
        where: { userId },
        data: { balance: { increment: coinsToCredit } },
      });
      dbg(`[pagarme-crypto] credited +${coinsToCredit} userId=${userId.slice(0, 8)}...`);
    }

    const expiresAt = computeExpiryCryptoFromPlan(planKey, completedAt);
    await tx.walletCredit.upsert({
      where: { entryId: entry.id },
      update: {},
      create: {
        userId,
        entryId: entry.id,
        amount: coinsToCredit,
        consumed: 0,
        expiresAt,
        createdAt: completedAt,
      },
      select: { id: true },
    });
    await tx.user.updateMany({
      where: { id: userId },
      data: { tier: Tier.lite },
    });
  });

  // Recibo por e-mail (PIX)
  const [user, localOrder] = await Promise.all([
    cryptoPrisma.user.findUnique({
      where: { id: userId },
      select: { emailEnc: true, emailIv: true, emailTag: true, language: true },
    }),
    cryptoPrisma.pagarMeOrder.findUnique({
      where: { id: orderId },
      select: { status: true, coinsToCredit: true, amountTotalCents: true },
    }),
  ]);
  let receiptTo = "";
  try {
    if (user) receiptTo = decryptEmail(user.emailEnc, user.emailIv, user.emailTag);
  } catch {
    /* ignore */
  }
  if (receiptTo && localOrder?.status === CheckoutStatus.COMPLETED) {
    const coins = localOrder.coinsToCredit ?? 0;
    const cents = localOrder.amountTotalCents ?? amountCents;
    const valor = (cents / 100).toFixed(2).replace(".", ",");
    const publicRef = `BG-${orderId.slice(-8).toUpperCase()}`;
    const dashboardUrl = `${EMAIL_LINK_BASE}${BASE_PATH}/sistema`;
    const lang: CryptoLang = user?.language === "pt" ? "pt" : "en";
    const t = getCryptoT(lang).receiptEmail;
    const countStr = coins.toLocaleString(lang === "pt" ? "pt-BR" : "en-US");
    const subject = t.subject;
    const receivedPayment = t.receivedPaymentPix.replace("{valor}", valor);
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
                  role="button">${t.viewCoins}</a>
              </p>
              <p style="margin:14px 0 0;font-size:13px;color:#555">${codeOp}</p>
              <p style="margin:18px 0 4px;font-size:13px;color:#555">
                ${t.automaticMessage}<br>${t.doNotReply}
              </p>
              <p style="margin:0">
                <a href="${t.website}" style="color:#0073e6;text-decoration:none">${t.website}</a>
              </p>
            </div>
          `,
      });
      dbg(`[pagarme-crypto] receipt email OK to=${receiptTo} orderId=${orderId} lang=${lang}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`[pagarme-crypto] receipt email ERROR to=${receiptTo} orderId=${orderId} msg=${msg}`);
    }
  }
}
