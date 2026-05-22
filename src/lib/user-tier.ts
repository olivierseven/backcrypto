/**
 * Tier do usuário (free vs lite) com base em WalletCredit ativos.
 * - Ao pagar: webhook seta user.tier = lite.
 * - Ao fazer login (ou auth check): sincronizamos tier a partir dos créditos (se todos expirados → free).
 * - Créditos expirados: ao sincronizar, aplicamos a expiração (reduzimos o saldo da carteira pelo que restava).
 */
import { cryptoPrisma } from "@/lib/crypto-db";
import { Tier, TxSource, TxType } from "@/lib/prisma-bio-client";
import { dbg } from "@/lib/logger";

const now = () => new Date();

/**
 * Aplica expiração aos créditos já vencidos: reduz o saldo da carteira pelo valor restante (amount - consumed)
 * e marca o crédito como totalmente consumido. Assim os coins expirados são "zerados" do saldo.
 * Chamado automaticamente em syncUserTierFromCredits (ex.: no login).
 */
export async function applyExpiredCredits(userId: string): Promise<void> {
  const nowDate = now();
  const expired = await cryptoPrisma.walletCredit.findMany({
    where: { userId, expiresAt: { lte: nowDate } },
    select: { id: true, entryId: true, amount: true, consumed: true },
  });
  const toApply = expired.filter((c) => (c.amount - c.consumed) > 0);
  if (toApply.length === 0) return;

  await cryptoPrisma.$transaction(async (tx) => {
    const wallet = await tx.userCoinWallet.findUnique({
      where: { userId },
      select: { id: true, balance: true },
    });
    if (!wallet) return;

    let totalToDeduct = 0;
    for (const c of toApply) {
      const remaining = c.amount - c.consumed;
      totalToDeduct += remaining;
      await tx.walletCredit.update({
        where: { id: c.id },
        data: { consumed: c.amount },
      });
    }

    if (totalToDeduct > 0) {
      const newBalance = Math.max(0, wallet.balance - totalToDeduct);
      await tx.userCoinWallet.update({
        where: { userId },
        data: { balance: newBalance },
      });
      for (const c of toApply) {
        const remaining = c.amount - c.consumed;
        if (remaining <= 0) continue;
        const entry = await tx.coinLedgerEntry.create({
          data: {
            userId,
            walletId: wallet.id,
            type: TxType.DEBIT,
            source: TxSource.EXPIRATION,
            amount: remaining,
            refId: c.id,
            meta: { walletCreditId: c.id, reason: "expired" },
          },
          select: { id: true },
        });
        void entry;
      }
      dbg(`[user-tier] expired credits applied userId=${userId.slice(0, 8)}... deducted=${totalToDeduct} credits=${toApply.length}`);
    }
  });
}

/** Verifica se o usuário tem pelo menos um crédito ativo (não expirado e com saldo). */
export async function hasActiveCredits(userId: string): Promise<boolean> {
  const list = await cryptoPrisma.walletCredit.findMany({
    where: { userId, expiresAt: { gt: now() } },
    select: { amount: true, consumed: true },
  });
  return list.some((c) => (c.amount - c.consumed) > 0);
}

/**
 * Verifica se o usuário tem créditos ativos de compra (pagos), excluindo trial lite (Pagar.me: trial, bônus admin, acesso admin).
 * Usado no checkout: trial pode comprar; só bloqueia se tiver créditos de Stripe/PIX pagos ativos.
 */
export async function hasActivePaidCredits(userId: string): Promise<boolean> {
  const nowDate = now();
  const credits = await cryptoPrisma.walletCredit.findMany({
    where: { userId, expiresAt: { gt: nowDate } },
    select: { amount: true, consumed: true, entry: { select: { source: true, meta: true } } },
  });
  for (const c of credits) {
    if ((c.amount - c.consumed) <= 0) continue;
    const meta = c.entry?.meta as { reason?: string } | null;
    const reason = meta?.reason;
    const source = c.entry?.source;
    const isTrialOrAdmin =
      (source === TxSource.PAGARME &&
        (reason === "lite_trial_first_login" ||
          reason === "welcome_package_crypto" ||
          reason === "admin_access")) ||
      (source === TxSource.BONUS && reason === "admin_access");
    if (!isTrialOrAdmin) return true;
  }
  return false;
}

/**
 * Calcula o tier efetivo a partir dos créditos e atualiza user.tier se estiver desatualizado.
 * Antes, aplica a expiração dos créditos vencidos (reduz saldo da carteira).
 * Chamar no login ou em /api/auth/check para que, quando todos os créditos expirarem, o usuário volte a free.
 */
export async function syncUserTierFromCredits(userId: string): Promise<Tier> {
  await applyExpiredCredits(userId);
  const active = await hasActiveCredits(userId);
  const newTier: Tier = active ? Tier.lite : Tier.free;

  const updated = await cryptoPrisma.user.updateMany({
    where: { id: userId },
    data: { tier: newTier },
  });

  if (updated.count > 0) {
    dbg(`[user-tier] sync userId=${userId.slice(0, 8)}... tier=${newTier}`);
  }

  return newTier;
}

/** Retorna o tier atual do usuário no banco (sem recalcular a partir dos créditos). */
export async function getCurrentTier(userId: string): Promise<Tier> {
  const user = await cryptoPrisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  return (user?.tier as Tier) ?? Tier.free;
}

/** Sincroniza tier a partir dos créditos (expira vencidos) e indica se o utilizador está em free. */
export async function syncUserTierAndIsFree(userId: string): Promise<{ tier: Tier; isFreeUser: boolean }> {
  const tier = await syncUserTierFromCredits(userId);
  return { tier, isFreeUser: tier === Tier.free };
}
