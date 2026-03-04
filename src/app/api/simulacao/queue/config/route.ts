// GET /api/biogenerator/simulacao/queue/config — variáveis da fila (poll, max wait, use_queue por fila) para o cliente. Lido do banco.
import { NextResponse } from "next/server";
import { getBioQueueConfigMap, getBioQueueConfigNumber, getUseQueueFromMap } from "@/lib/bio-app-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const map = await getBioQueueConfigMap();
  return NextResponse.json({
    queuePollIntervalMs: getBioQueueConfigNumber(map, "bio_queue_poll_interval_ms", 1500),
    queueMaxWaitMs: getBioQueueConfigNumber(map, "bio_queue_max_wait_ms", 180000),
    useQueueForFila1x: getUseQueueFromMap(map, "fila_1x"),
    useQueueForFila20x: getUseQueueFromMap(map, "fila_20x"),
    useQueueForFila100x: getUseQueueFromMap(map, "fila_100x"),
    useQueueForFila1000x: getUseQueueFromMap(map, "fila_1000x"),
  });
}
