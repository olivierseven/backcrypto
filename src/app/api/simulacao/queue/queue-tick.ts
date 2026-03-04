// Lógica compartilhada do tick da fila: usa FOR UPDATE SKIP LOCKED. Limites lidos do banco (BioAppConfig).
// Ao concluir, grava result e status COMPLETED e deduz coins.
import { bioPrisma } from "@/lib/bio-db";
import { getBioQueueConfigMap, getMaxConcurrentFromMap } from "@/lib/bio-app-config";
import { executeSimulationOne, executeSimulationN, type Body } from "@/app/api/simulacao/run/route";
import { getBalance, spendCoins, COINS_PER_RUN } from "@/lib/spend-coins";
import { dbg, warn, error } from "@/lib/logger";

const QUEUE_NAMES = ["fila_1x", "fila_20x", "fila_100x", "fila_1000x"] as const;

type ClaimedRow = { id: string; userId: string; queueName: string; payload: unknown };

/**
 * Atômico: pega um PENDING só se RUNNING < maxConcurrent, usando FOR UPDATE SKIP LOCKED.
 * Retorna 0 ou 1 row; sem race condition.
 */
async function claimOnePending(
  queueName: string,
  maxConcurrent: number
): Promise<ClaimedRow | null> {
  const rows = await bioPrisma.$queryRawUnsafe<ClaimedRow[]>(
    `UPDATE "BioSimulationQueue"
     SET status = 'RUNNING'
     WHERE id = (
       SELECT id FROM "BioSimulationQueue"
       WHERE "queueName" = $1 AND status = 'PENDING'
       AND (SELECT COUNT(*)::int FROM "BioSimulationQueue" b2 WHERE b2."queueName" = $1 AND b2.status = 'RUNNING') < $2
       ORDER BY "createdAt" ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING id, "userId", "queueName", payload`,
    queueName,
    maxConcurrent
  );
  const row = rows?.[0] ?? null;
  return row;
}

/** Um tick: para cada fila, claim atômico de 1 job, executa e grava result + COMPLETED. Cliente obtém resultado no GET status. */
export async function doOneTick(): Promise<{ queueName: string; id: string }[]> {
  const processed: { queueName: string; id: string }[] = [];
  const configMap = await getBioQueueConfigMap();

  for (const queueName of QUEUE_NAMES) {
    const maxConcurrent = getMaxConcurrentFromMap(configMap, queueName);
    const row = await claimOnePending(queueName, maxConcurrent);
    if (!row) continue;

    const coinsCost = COINS_PER_RUN[queueName] ?? 1;
    const balance = await getBalance(row.userId);
    if (balance < coinsCost) {
      warn(`[bio/queue] insufficient coins id=${row.id} userId=${row.userId.slice(0, 8)}... balance=${balance} need=${coinsCost}`);
      await bioPrisma.bioSimulationQueue.update({
        where: { id: row.id },
        data: { status: "COMPLETED", result: { error: "insufficient_coins", message: "Saldo insuficiente de coins" } as unknown as object },
      });
      processed.push({ queueName, id: row.id });
      continue;
    }

    try {
      const payload = row.payload as Body;
      if (payload?.mode === "one") {
        const result = executeSimulationOne(payload, null);
        const startIter = payload.currentIteration ?? 0;
        const actualSteps = Math.max(0, result.iteracao - startIter);
        if (actualSteps > 0) await spendCoins(row.userId, actualSteps, row.id, { queueName });
        await bioPrisma.bioSimulationQueue.update({
          where: { id: row.id },
          data: { status: "COMPLETED", result: result as unknown as object },
        });
        dbg(`[bio/queue] executed id=${row.id} queue=${queueName} mode=one coins=${actualSteps}`);
      } else if (payload?.mode === "n" && payload?.N != null && payload.N >= 1) {
        const result = executeSimulationN(payload, null);
        const startIter = payload.currentIteration ?? 0;
        const actualIterations = Math.max(0, result.iteracao - startIter);
        if (actualIterations > 0) await spendCoins(row.userId, actualIterations, row.id, { queueName, N: actualIterations });
        await bioPrisma.bioSimulationQueue.update({
          where: { id: row.id },
          data: { status: "COMPLETED", result: result as unknown as object },
        });
        dbg(`[bio/queue] executed id=${row.id} queue=${queueName} N=${payload.N} actualIterations=${actualIterations} coins=${actualIterations}`);
      } else {
        warn(`[bio/queue] invalid payload mode/N id=${row.id}`);
        await bioPrisma.bioSimulationQueue.deleteMany({ where: { id: row.id } });
      }
    } catch (e) {
      error(`[bio/queue] run error id=${row.id}: ${e instanceof Error ? e.message : e}`);
      await bioPrisma.bioSimulationQueue.deleteMany({ where: { id: row.id } });
    }
    processed.push({ queueName, id: row.id });
  }

  return processed;
}
