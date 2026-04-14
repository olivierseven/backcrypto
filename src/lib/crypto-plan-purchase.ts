import { cryptoPrisma } from "@/lib/crypto-db";
import { TxSource, TxType } from "@/lib/prisma-bio-client";

/**
 * True se o usuário já teve crédito por compra paga (cartão Stripe ou PIX Pagar.me).
 * Exclui trial lite e concessões admin no Pagar.me (refId lite_trial*, welcome_crypto*, admin_access*).
 */
export async function hasPurchasedCryptoPlan(userId: string): Promise<boolean> {
  const stripe = await cryptoPrisma.coinLedgerEntry.findFirst({
    where: { userId, type: TxType.CREDIT, source: TxSource.STRIPE },
    select: { id: true },
  });
  if (stripe) return true;

  const pix = await cryptoPrisma.coinLedgerEntry.findFirst({
    where: {
      userId,
      type: TxType.CREDIT,
      source: TxSource.PAGARME,
      refId: { not: null },
      AND: [
        { NOT: { refId: { startsWith: "lite_trial" } } },
        { NOT: { refId: { startsWith: "welcome_crypto" } } },
        { NOT: { refId: { startsWith: "admin_access" } } },
      ],
    },
    select: { id: true },
  });
  return !!pix;
}
