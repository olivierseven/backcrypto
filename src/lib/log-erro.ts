import { randomUUID } from "node:crypto";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Prisma } from "@/lib/prisma-bio-client";

const MAX_ORIGEM = 512;
const MAX_MSG = 32_000;

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    const stack = error.stack ?? "";
    return `${error.name}: ${error.message}${stack ? `\n${stack}` : ""}`.slice(0, MAX_MSG);
  }
  try {
    return JSON.stringify(error).slice(0, MAX_MSG);
  } catch {
    return String(error).slice(0, MAX_MSG);
  }
}

/**
 * Grava uma linha em `backcrypto.LogErro` (só chamar em falhas). Nunca propaga exceção.
 * `origem`: ex. `POST /api/affiliate/sync-plan-payments`, `sync-affiliate/refund`.
 */
export async function logErro(origem: string, error: unknown): Promise<void> {
  const o = origem.trim().slice(0, MAX_ORIGEM);
  if (!o) return;
  const msg = serializeError(error);
  try {
    await cryptoPrisma.$executeRaw(
      Prisma.sql`
        INSERT INTO backcrypto."LogErro" (id, data_hora, origem, msg_erro)
        VALUES (${randomUUID()}, NOW(), ${o}, ${msg})
      `,
    );
  } catch {
    /* falha de log não quebra o fluxo */
  }
}
