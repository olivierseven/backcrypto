import { bioPrisma } from "@/lib/bio-db";
import { TxSource, TxType } from "@/lib/prisma-bio-client";
import { log as vLog, dbg, warn, error } from "@/lib/logger";

/** Bônus de primeiro login no Bio: 3.000 coins */
export const BIO_WELCOME_COINS = 3000;
export const BIO_WELCOME_DURATION_DAYS = 7;

/**
 * Verifica se é o primeiro login do usuário no Bio
 * (não possui nenhum CoinLedgerEntry com source BONUS ou STRIPE no banco Bio)
 */
export async function isFirstLoginBio(userId: string): Promise<boolean> {
  const hasAny = await bioPrisma.coinLedgerEntry.findFirst({
    where: {
      userId,
      source: { in: [TxSource.BONUS, TxSource.STRIPE] },
      type: TxType.CREDIT,
    },
    select: { id: true },
  });
  return !hasAny;
}

/**
 * Cria o pacote de boas-vindas do Bio (3.000 coins) e notificação.
 */
export async function createBioWelcomePackage(userId: string): Promise<{
  success: boolean;
  coins?: number;
  error?: string;
}> {
  try {
    dbg(`[bio-bonus] creating welcome package userId=${userId.slice(0, 8)}... coins=${BIO_WELCOME_COINS}`);

    const result = await bioPrisma.$transaction(async (tx) => {
      const wallet = await tx.userCoinWallet.upsert({
        where: { userId },
        create: { userId, balance: 0 },
        update: {},
        select: { id: true },
      });

      const refId = `welcome_bio_${userId}_${Date.now()}`;
      const entry = await tx.coinLedgerEntry.create({
        data: {
          userId,
          walletId: wallet.id,
          type: TxType.CREDIT,
          source: TxSource.BONUS,
          amount: BIO_WELCOME_COINS,
          refId,
          meta: { reason: "welcome_package_bio", durationDays: BIO_WELCOME_DURATION_DAYS, coins: BIO_WELCOME_COINS },
        },
        select: { id: true },
      });

      await tx.userCoinWallet.update({
        where: { userId },
        data: { balance: { increment: BIO_WELCOME_COINS } },
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + BIO_WELCOME_DURATION_DAYS);
      expiresAt.setHours(23, 59, 59, 999);

      await tx.walletCredit.create({
        data: {
          userId,
          entryId: entry.id,
          amount: BIO_WELCOME_COINS,
          consumed: 0,
          expiresAt,
        },
      });

      return { entryId: entry.id };
    });

    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() + BIO_WELCOME_DURATION_DAYS);
    const user = await bioPrisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    const lang = user?.language ?? "pt";
    const message =
      lang === "pt"
        ? `🎉 Bem-vindo(a) ao Bio! Você recebeu ${BIO_WELCOME_COINS.toLocaleString("pt-BR")} coins de bônus, válidos por ${BIO_WELCOME_DURATION_DAYS} dias.`
        : `🎉 Welcome to Bio! You received ${BIO_WELCOME_COINS.toLocaleString("en-US")} bonus coins, valid for ${BIO_WELCOME_DURATION_DAYS} days.`;
    await bioPrisma.userNotification.create({
      data: {
        senderType: "system",
        userId,
        notification: message,
        keySystem: "welcome_package_bio",
        expiredDate,
      },
    });

    vLog(`[bio-bonus] welcome package created userId=${userId.slice(0, 8)}... coins=${BIO_WELCOME_COINS} entryId=${result.entryId}`);
    return { success: true, coins: BIO_WELCOME_COINS };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`[bio-bonus] failed userId=${userId.slice(0, 8)}... error=${msg}`);
    return { success: false, error: msg };
  }
}
