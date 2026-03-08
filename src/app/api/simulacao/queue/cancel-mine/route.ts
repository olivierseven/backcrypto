// POST /api/biogenerator/simulacao/queue/cancel-mine — remove da fila todos os jobs do usuário (ex.: ao sair da página)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { dbg } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST() {
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

  const deleted = await cryptoPrisma.bioSimulationQueue.deleteMany({
    where: { userId },
  });
  dbg(`[bio/queue/cancel-mine] userId=${userId.slice(0, 8)}... deleted=${deleted.count}`);
  return NextResponse.json({ ok: true, deleted: deleted.count });
}
