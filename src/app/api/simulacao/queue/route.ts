// POST /api/biogenerator/simulacao/queue — enfileira execução (fila_1x | fila_20x | fila_100x | fila_1000x)
// O payload pode ser grande (estado da simulação para 1000x). Na Vercel o body é limitado a 4.5 MB;
// o cliente pode enviar Content-Encoding: gzip para reduzir o tamanho e evitar 413.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { gunzipSync } from "node:zlib";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { BioQueueStatus } from "@/lib/prisma-bio-client";
import { getBalance, COINS_PER_RUN } from "@/lib/spend-coins";
import { dbg, error } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const ALLOWED_QUEUES = ["fila_1x", "fila_20x", "fila_100x", "fila_1000x"] as const;
type QueueName = (typeof ALLOWED_QUEUES)[number];

function isQueueName(s: unknown): s is QueueName {
  return typeof s === "string" && ALLOWED_QUEUES.includes(s as QueueName);
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { sub?: string };
  try {
    const result = await jwtVerify(token, JWT_SECRET);
    payload = result.payload as { sub?: string };
  } catch {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  const userId = typeof payload?.sub === "string" ? payload.sub : null;
  if (!userId) {
    return NextResponse.json({ error: "invalid_user" }, { status: 401 });
  }

  let body: { queueName?: unknown; payload?: unknown };
  try {
    const encoding = req.headers.get("content-encoding");
    if (encoding === "gzip") {
      const ab = await req.arrayBuffer();
      const decompressed = gunzipSync(Buffer.from(ab));
      body = JSON.parse(decompressed.toString("utf-8")) as { queueName?: unknown; payload?: unknown };
    } else {
      body = await req.json();
    }
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!isQueueName(body?.queueName)) {
    return NextResponse.json(
      { error: "queueName must be fila_1x, fila_20x, fila_100x or fila_1000x" },
      { status: 400 }
    );
  }

  const queuePayload = body?.payload;
  if (queuePayload == null || typeof queuePayload !== "object") {
    return NextResponse.json({ error: "payload required (object for simulacao/run)" }, { status: 400 });
  }

  const coinsCost = COINS_PER_RUN[body.queueName] ?? 1;
  const balance = await getBalance(userId);
  if (balance < coinsCost) {
    return NextResponse.json(
      { error: "insufficient_coins", message: "Saldo insuficiente de coins" },
      { status: 400 }
    );
  }

  try {
    const row = await cryptoPrisma.bioSimulationQueue.create({
      data: {
        queueName: body.queueName,
        userId,
        status: BioQueueStatus.PENDING,
        payload: queuePayload as object,
      },
      select: { id: true, queueName: true, createdAt: true },
    });
    dbg(`[crypto/queue] enqueued id=${row.id} queue=${row.queueName} userId=${userId.slice(0, 8)}...`);
    return NextResponse.json({ id: row.id, queueName: row.queueName, createdAt: row.createdAt });
  } catch (e) {
    error(`[crypto/queue] enqueue error: ${e instanceof Error ? e.message : e}`);
    return NextResponse.json({ error: "enqueue_failed" }, { status: 500 });
  }
}
