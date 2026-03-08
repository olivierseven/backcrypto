// GET /api/biogenerator/simulacao/queue/config — variáveis da fila (poll, max wait, use_queue por fila) para o cliente. Lido do banco.
import { NextResponse } from "next/server";
import { getCryptoQueueConfigMap, getCryptoQueueConfigNumber, getUseQueueFromMap } from "@/lib/crypto-app-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const map = await getCryptoQueueConfigMap();
  return NextResponse.json({
    queuePollIntervalMs: getCryptoQueueConfigNumber(map, "bio_queue_poll_interval_ms", 1500),
    queueMaxWaitMs: getCryptoQueueConfigNumber(map, "bio_queue_max_wait_ms", 180000),
    useQueueForFila1x: getUseQueueFromMap(map, "fila_1x"),
    useQueueForFila20x: getUseQueueFromMap(map, "fila_20x"),
    useQueueForFila100x: getUseQueueFromMap(map, "fila_100x"),
    useQueueForFila1000x: getUseQueueFromMap(map, "fila_1000x"),
  });
}
