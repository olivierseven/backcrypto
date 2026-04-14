/**
 * Deduz coins do usuário para execução de simulação.
 * Usado pela fila (queue-tick) e pela rota direta (simulacao/run).
 */
import { cryptoPrisma } from "@/lib/crypto-db";
import { dbg } from "@/lib/logger";

/** Custo em coins por fila/iterações: 1x=1, 20x=20, 100x=100, 1000x=1000 */
export const COINS_PER_RUN: Record<string, number> = {
  fila_1x: 1,
  fila_20x: 20,
  fila_100x: 100,
  fila_1000x: 1000,
};

export function getCoinsForN(N: number): number {
  if (N <= 1) return 1;
  if (N <= 20) return 20;
  if (N <= 100) return 100;
  return 1000;
}

/** Retorna o saldo atual do usuário. */
export async function getBalance(userId: string): Promise<number> {
  const wallet = await cryptoPrisma.userCoinWallet.findUnique({
    where: { userId },
    select: { balance: true },
  });
  return wallet?.balance ?? 0;
}

/**
 * Deduz coins do usuário. Usa transação.
 * refId deve ser único por operação (ex: jobId para fila).
 * O gasto não é registrado na tabela de transações (CoinLedgerEntry); apenas o saldo é atualizado.
 * @throws Error se saldo insuficiente
 */
export async function spendCoins(
  userId: string,
  amount: number,
  refId: string,
  meta?: { queueName?: string; N?: number }
): Promise<void> {
  if (amount <= 0) return;

  await cryptoPrisma.$transaction(async (tx) => {
    const wallet = await tx.userCoinWallet.findUnique({
      where: { userId },
      select: { id: true, balance: true },
    });
    if (!wallet) throw new Error("wallet_not_found");
    if (wallet.balance < amount) throw new Error("insufficient_coins");

    await tx.userCoinWallet.update({
      where: { userId },
      data: { balance: { decrement: amount } },
    });
  });

  dbg(`[spend-coins] userId=${userId.slice(0, 8)}... amount=${amount} refId=${refId}`);
}
