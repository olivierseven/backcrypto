// GET /api/biogenerator/simulacao/state — retorna o último estado salvo do usuário (uma linha por user, sem histórico).
// POST /api/biogenerator/simulacao/state — salva/atualiza o estado (upsert: sempre a última atualização).
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const result = await jwtVerify(token, JWT_SECRET);
    const sub = (result.payload as { sub?: string }).sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

/** GET — carrega a última atualização do usuário. */
export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const row = await cryptoPrisma.bioSimulationState.findUnique({
    where: { userId },
    select: { state: true, mapDisplayByYear: true, updatedAt: true },
  });

  if (!row) {
    return NextResponse.json({ state: null });
  }

  return NextResponse.json({ state: row.state, mapDisplayByYear: row.mapDisplayByYear ?? undefined, updatedAt: row.updatedAt });
}

/** POST — salva/atualiza o estado (uma linha por user; não acumula histórico). */
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (body == null || typeof body !== "object") {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }

  const obj = body as Record<string, unknown>;
  const mapDisplayByYear = obj.mapDisplayByYear;
  const state = { ...obj };
  delete state.mapDisplayByYear;

  const mapDisplayData =
    mapDisplayByYear != null && typeof mapDisplayByYear === "object" && !Array.isArray(mapDisplayByYear)
      ? (mapDisplayByYear as object)
      : null;

  await cryptoPrisma.bioSimulationState.upsert({
    where: { userId },
    create: {
      userId,
      state: state as object,
      ...(mapDisplayData !== null && { mapDisplayByYear: mapDisplayData }),
    },
    update: {
      state: state as object,
      ...(mapDisplayData !== null && { mapDisplayByYear: mapDisplayData }),
    },
  });

  return NextResponse.json({ ok: true });
}
