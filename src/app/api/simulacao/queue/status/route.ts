// GET /api/biogenerator/simulacao/queue/status — roda um tick (avança a fila) e lista jobs do usuário. Cliente faz polling; sem cron.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { doOneTick } from "../queue-tick";
import { dbg } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function GET() {
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

  await doOneTick();

  const jobs = await cryptoPrisma.bioSimulationQueue.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, queueName: true, status: true, createdAt: true, result: true },
  });
  const completedIds = jobs.filter((j) => j.status === "COMPLETED").map((j) => j.id);
  if (completedIds.length > 0) {
    await cryptoPrisma.bioSimulationQueue.deleteMany({ where: { id: { in: completedIds } } });
  }
  dbg(`[bio/queue/status] userId=${userId.slice(0, 8)}... count=${jobs.length} completed=${completedIds.length}`);
  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      queueName: j.queueName,
      status: j.status,
      createdAt: j.createdAt,
      ...(j.status === "COMPLETED" && j.result != null && { result: j.result }),
    })),
  });
}
