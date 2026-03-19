import { cryptoPrisma } from "@/lib/crypto-db";
import { Tier, TxSource, TxType } from "@/lib/prisma-bio-client";
import { log as vLog, dbg, warn, error } from "@/lib/logger";

/** Bônus de primeiro login: 3.000 coins */
export const CRYPTO_WELCOME_COINS = 3000;
export const CRYPTO_WELCOME_DURATION_DAYS = 7;

/**
 * Trial lite de primeiro login (simula como PIX pago):
 * - credit: 1 coin
 * - expiração: 1 dia
 * - tier: lite
 */
export const CRYPTO_LITE_TRIAL_COINS = 1;
export const CRYPTO_LITE_TRIAL_DURATION_DAYS = 1;

/**
 * Verifica se é o primeiro login do usuário
 * (não possui nenhum CoinLedgerEntry com source BONUS ou STRIPE no banco)
 */
export async function isFirstLoginCrypto(userId: string): Promise<boolean> {
  const hasAny = await cryptoPrisma.coinLedgerEntry.findFirst({
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
 * Verifica se é o "primeiro crédito" do usuário.
 * Usado para evitar criar trial lite mesmo se o usuário já tiver pago (Pagar.me/Stripe)
 * ou recebido algum bônus.
 */
export async function isFirstLoginCryptoLiteTrial(userId: string): Promise<boolean> {
  const hasAnyCredit = await cryptoPrisma.coinLedgerEntry.findFirst({
    where: { userId, type: TxType.CREDIT },
    select: { id: true },
  });
  return !hasAnyCredit;
}

/**
 * Cria o pacote de boas-vindas (3.000 coins) e notificação.
 */
export async function createCryptoWelcomePackage(userId: string): Promise<{
  success: boolean;
  coins?: number;
  error?: string;
}> {
  try {
    dbg(`[crypto-bonus] creating welcome package userId=${userId.slice(0, 8)}... coins=${CRYPTO_WELCOME_COINS}`);

    const result = await cryptoPrisma.$transaction(async (tx) => {
      const wallet = await tx.userCoinWallet.upsert({
        where: { userId },
        create: { userId, balance: 0 },
        update: {},
        select: { id: true },
      });

      const refId = `welcome_crypto_${userId}_${Date.now()}`;
      const entry = await tx.coinLedgerEntry.create({
        data: {
          userId,
          walletId: wallet.id,
          type: TxType.CREDIT,
          source: TxSource.BONUS,
          amount: CRYPTO_WELCOME_COINS,
          refId,
          meta: { reason: "welcome_package_crypto", durationDays: CRYPTO_WELCOME_DURATION_DAYS, coins: CRYPTO_WELCOME_COINS },
        },
        select: { id: true },
      });

      await tx.userCoinWallet.update({
        where: { userId },
        data: { balance: { increment: CRYPTO_WELCOME_COINS } },
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + CRYPTO_WELCOME_DURATION_DAYS);
      expiresAt.setHours(23, 59, 59, 999);

      await tx.walletCredit.create({
        data: {
          userId,
          entryId: entry.id,
          amount: CRYPTO_WELCOME_COINS,
          consumed: 0,
          expiresAt,
        },
      });

      return { entryId: entry.id };
    });

    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() + CRYPTO_WELCOME_DURATION_DAYS);
    const user = await cryptoPrisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    const lang = user?.language ?? "pt";
    const message =
      lang === "pt"
        ? `🎉 Bem-vindo(a)! Você recebeu ${CRYPTO_WELCOME_COINS.toLocaleString("pt-BR")} coins de bônus, válidos por ${CRYPTO_WELCOME_DURATION_DAYS} dias.`
        : `🎉 Welcome! You received ${CRYPTO_WELCOME_COINS.toLocaleString("en-US")} bonus coins, valid for ${CRYPTO_WELCOME_DURATION_DAYS} days.`;
    await cryptoPrisma.userNotification.create({
      data: {
        senderType: "system",
        userId,
        notification: message,
        keySystem: "welcome_package_crypto",
        expiredDate,
      },
    });

    vLog(`[crypto-bonus] welcome package created userId=${userId.slice(0, 8)}... coins=${CRYPTO_WELCOME_COINS} entryId=${result.entryId}`);
    return { success: true, coins: CRYPTO_WELCOME_COINS };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`[crypto-bonus] failed userId=${userId.slice(0, 8)}... error=${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Cria o pacote trial lite de primeiro login (1 coin / 1 dia) e notificação.
 * "Ref" é estável para permitir prevenção de duplicidade via unique (source + refId).
 */
export async function createCryptoLiteTrialPackage(userId: string): Promise<{
  success: boolean;
  coins?: number;
  error?: string;
}> {
  try {
    const refId = `lite_trial_1d_${userId}`;
    dbg(`[crypto-bonus] creating lite trial package userId=${userId.slice(0, 8)}... coins=${CRYPTO_LITE_TRIAL_COINS}`);

    const result = await cryptoPrisma.$transaction(async (tx) => {
      // Se por algum motivo já existir, não duplicar.
      const existingEntry = await tx.coinLedgerEntry.findFirst({
        where: { source: TxSource.PAGARME, refId },
        select: { id: true },
      });
      if (existingEntry) return { entryId: existingEntry.id };

      const wallet = await tx.userCoinWallet.upsert({
        where: { userId },
        create: { userId, balance: 0 },
        update: {},
        select: { id: true },
      });

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + CRYPTO_LITE_TRIAL_DURATION_DAYS);
      expiresAt.setHours(23, 59, 59, 999);

      const entry = await tx.coinLedgerEntry.create({
        data: {
          userId,
          walletId: wallet.id,
          type: TxType.CREDIT,
          source: TxSource.PAGARME,
          amount: CRYPTO_LITE_TRIAL_COINS,
          refId,
          meta: { reason: "lite_trial_first_login", durationDays: CRYPTO_LITE_TRIAL_DURATION_DAYS, coins: CRYPTO_LITE_TRIAL_COINS, pixLike: true },
          createdAt: now,
        },
        select: { id: true },
      });

      await tx.userCoinWallet.update({
        where: { userId },
        data: { balance: { increment: CRYPTO_LITE_TRIAL_COINS } },
      });

      await tx.walletCredit.create({
        data: {
          userId,
          entryId: entry.id,
          amount: CRYPTO_LITE_TRIAL_COINS,
          consumed: 0,
          expiresAt,
        },
      });

      await tx.user.updateMany({
        where: { id: userId },
        data: { tier: Tier.lite },
      });

      return { entryId: entry.id };
    });

    const user = await cryptoPrisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    const lang = user?.language ?? "pt";

    const message =
      lang === "pt"
        ? `🎉 Bem-vindo(a)! Você recebeu 1 coin de teste (válido por 1 dia).`
        : `🎉 Welcome! You received 1 test coin (valid for 1 day).`;

    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() + CRYPTO_LITE_TRIAL_DURATION_DAYS);

    await cryptoPrisma.userNotification.create({
      data: {
        senderType: "system",
        userId,
        notification: message,
        keySystem: "lite_trial_first_login",
        expiredDate,
      },
    });

    vLog(`[crypto-bonus] lite trial created userId=${userId.slice(0, 8)}... entryId=${result.entryId}`);
    return { success: true, coins: CRYPTO_LITE_TRIAL_COINS };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`[crypto-bonus] lite trial failed userId=${userId.slice(0, 8)}... error=${msg}`);
    return { success: false, error: msg };
  }
}
