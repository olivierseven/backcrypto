// GET: lista layouts salvos do usuário (slots 1–7 que existem). Cada item tem { slot, config }.
// POST: salva layout em um slot (1–7). Body: { slot, config } — config é um objeto JSON com todas as preferências.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

async function getUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

const VALID_SLOTS = [1, 2, 3, 4, 5, 6, 7] as const;
const CONFIG_MAX_BYTES = 32 * 1024; // 32KB para o JSON

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await cryptoPrisma.chartLayout.findMany({
    where: { userId },
    select: { slot: true, config: true },
  });

  const layouts = rows.map((r) => ({
    slot: r.slot,
    config: r.config as Record<string, unknown>,
  }));

  return NextResponse.json({ layouts });
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { slot?: number; config?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const slot = typeof body.slot === "number" && Number.isInteger(body.slot) ? body.slot : undefined;
  if (slot == null || !VALID_SLOTS.includes(slot as (typeof VALID_SLOTS)[number])) {
    return NextResponse.json({ error: "invalid_slot", message: "Slot must be 1–7" }, { status: 400 });
  }

  const config = body.config != null && typeof body.config === "object" && !Array.isArray(body.config)
    ? body.config
    : {};
  const configStr = JSON.stringify(config);
  if (configStr.length > CONFIG_MAX_BYTES) {
    return NextResponse.json({ error: "config_too_large", message: "Config exceeds max size" }, { status: 400 });
  }

  await cryptoPrisma.chartLayout.upsert({
    where: { userId_slot: { userId, slot } },
    create: { userId, slot, config },
    update: { config },
  });

  return NextResponse.json({ ok: true, slot });
}
