// POST /api/biogenerator/simulacao/queue/process — executa um tick (opcional, para disparo manual). A fila avança quando o cliente faz GET /queue/status.
import { NextResponse } from "next/server";
import { doOneTick } from "../queue-tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const processed = await doOneTick();
  return NextResponse.json({ ok: true, processed });
}
