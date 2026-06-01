import { cryptoPrisma } from "@/lib/crypto-db";
import { Tier, TxSource, TxType, type PrismaClient } from "@/lib/prisma-bio-client";
import { log as vLog, dbg, warn, error } from "@/lib/logger";

/** Valor inicial sugerido no painel admin (dias = coins, como o trial lite). */
export const DEFAULT_ADMIN_WELCOME_DURATION_DAYS = 7;

const MIN_ACCESS_DAYS = 1;
const MAX_ACCESS_DAYS = 365;

/**
 * Trial lite de primeiro login (simula como PIX pago):
 * - credit: 1 coin
 * - expiração: 1 dia
 * - tier: lite
 */
export const CRYPTO_LITE_TRIAL_COINS = 1;
export const CRYPTO_LITE_TRIAL_DURATION_DAYS = 1;

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
 * Pacote trial lite concedido pelo admin (uma vez por usuário): mesma lógica do primeiro login,
 * com dias definidos pelo admin; coins = dias. Não chamar no login automático.
 */
export async function createCryptoWelcomePackage(
  userId: string,
  durationDays: number,
): Promise<{
  success: boolean;
  coins?: number;
  durationDays?: number;
  error?: string;
}> {
  const days = Math.max(MIN_ACCESS_DAYS, Math.min(MAX_ACCESS_DAYS, Math.floor(Number(durationDays))));
  const coins = days;
  const refId = `welcome_crypto_${userId}`;

  try {
    const existingEntry = await cryptoPrisma.coinLedgerEntry.findFirst({
      where: { userId, refId },
      select: { id: true },
    });
    if (existingEntry) {
      dbg(`[crypto-bonus] welcome package already exists userId=${userId.slice(0, 8)}... skip`);
      return { success: true, coins, durationDays: days };
    }

    dbg(`[crypto-bonus] creating welcome package userId=${userId.slice(0, 8)}... coins=${coins} days=${days}`);

    const result = await cryptoPrisma.$transaction(async (tx) => {
      const wallet = await tx.userCoinWallet.upsert({
        where: { userId },
        create: { userId, balance: 0 },
        update: {},
        select: { id: true },
      });

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + days);
      expiresAt.setHours(23, 59, 59, 999);

      const entry = await tx.coinLedgerEntry.create({
        data: {
          userId,
          walletId: wallet.id,
          type: TxType.CREDIT,
          source: TxSource.PAGARME,
          amount: coins,
          refId,
          meta: {
            reason: "welcome_package_crypto",
            durationDays: days,
            coins,
            pixLike: true,
          },
          createdAt: now,
        },
        select: { id: true },
      });

      await tx.userCoinWallet.update({
        where: { userId },
        data: { balance: { increment: coins } },
      });

      await tx.walletCredit.create({
        data: {
          userId,
          entryId: entry.id,
          amount: coins,
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

    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() + days);
    const user = await cryptoPrisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    const lang = user?.language ?? "pt";
    const c: number = coins;
    const d: number = days;
    const message =
      lang === "pt"
        ? `🎉 Trial lite (bônus admin): você recebeu ${c.toLocaleString("pt-BR")} coin${c === 1 ? "" : "s"}, válido${c === 1 ? "" : "s"} por ${d === 1 ? "1 dia" : `${d} dias`}.`
        : `🎉 Lite trial (admin bonus): you received ${c.toLocaleString("en-US")} coin${c === 1 ? "" : "s"}, valid for ${d === 1 ? "1 day" : `${d} days`}.`;
    await cryptoPrisma.userNotification.create({
      data: {
        senderType: "system",
        userId,
        notification: message,
        keySystem: "welcome_package_crypto",
        expiredDate,
      },
    });

    vLog(`[crypto-bonus] welcome package created userId=${userId.slice(0, 8)}... coins=${coins} entryId=${result.entryId}`);
    return { success: true, coins, durationDays: days };
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
        ? `🎉 Trial lite: você recebeu 1 coin válido por 1 dia.`
        : `🎉 Lite trial: you received 1 coin valid for 1 day.`;

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

/**
 * Concede trial lite por N dias (admin/debug, pode repetir). Mesma regra do pacote de boas-vindas: coins = dias.
 */
export async function createAdminAccessPackage(
  userId: string,
  durationDays: number,
  db: PrismaClient = cryptoPrisma
): Promise<{ success: boolean; coins?: number; durationDays?: number; error?: string }> {
  const days = Math.max(MIN_ACCESS_DAYS, Math.min(MAX_ACCESS_DAYS, Math.floor(durationDays)));
  const coins = days;
  try {
    const exists = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) {
      return {
        success: false,
        error: "Usuário não encontrado neste banco (verifique o User ID e se escolheu Prod vs Dev).",
      };
    }

    const refId = `admin_access_${userId}_${Date.now()}`;
    dbg(`[crypto-bonus] creating admin access package userId=${userId.slice(0, 8)}... days=${days} coins=${coins}`);

    const result = await db.$transaction(async (tx) => {
      const wallet = await tx.userCoinWallet.upsert({
        where: { userId },
        create: { userId, balance: 0 },
        update: {},
        select: { id: true },
      });

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + days);
      expiresAt.setHours(23, 59, 59, 999);

      const entry = await tx.coinLedgerEntry.create({
        data: {
          userId,
          walletId: wallet.id,
          type: TxType.CREDIT,
          source: TxSource.PAGARME,
          amount: coins,
          refId,
          meta: { reason: "admin_access", durationDays: days, coins, pixLike: true },
          createdAt: now,
        },
        select: { id: true },
      });

      await tx.userCoinWallet.update({
        where: { userId },
        data: { balance: { increment: coins } },
      });

      await tx.walletCredit.create({
        data: {
          userId,
          entryId: entry.id,
          amount: coins,
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

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    const lang = user?.language ?? "pt";
    const message =
      lang === "pt"
        ? `🎉 Trial lite (acesso admin): ${coins.toLocaleString("pt-BR")} coin${coins === 1 ? "" : "s"}, válido${coins === 1 ? "" : "s"} por ${days === 1 ? "1 dia" : `${days} dias`}.`
        : `🎉 Lite trial (admin access): ${coins.toLocaleString("en-US")} coin${coins === 1 ? "" : "s"}, valid for ${days === 1 ? "1 day" : `${days} days`}.`;
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() + days);

    await db.userNotification.create({
      data: {
        senderType: "system",
        userId,
        notification: message,
        keySystem: "admin_access",
        expiredDate,
      },
    });

    vLog(`[crypto-bonus] admin access created userId=${userId.slice(0, 8)}... days=${days} entryId=${result.entryId}`);
    return { success: true, coins, durationDays: days };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`[crypto-bonus] admin access failed userId=${userId.slice(0, 8)}... error=${msg}`);
    return { success: false, error: msg };
  }
}

export { MIN_ACCESS_DAYS, MAX_ACCESS_DAYS };
