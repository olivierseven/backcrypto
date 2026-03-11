// GET: lista layouts salvos do usuário (slots 0–7). Inclui defaultLayout (slot 0 do admin) para todos carregarem. canSaveDefault só para admin.
// POST: salva layout em um slot (1–7; slot 0 só para admin). Body: { slot, config }.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Role } from "@/lib/prisma-bio-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

/** Admin: dono do slot 0 (layout default) — todo usuário carrega; só admin salva. */
const ADMIN_USER_ID = "cmh2wwqx5002ktnngv7upschz";

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

const USER_SLOTS = [1, 2, 3, 4, 5, 6, 7] as const;
const CONFIG_MAX_BYTES = 32 * 1024; // 32KB para o JSON

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [user, rows, defaultRow] = await Promise.all([
    cryptoPrisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    cryptoPrisma.chartLayout.findMany({
      where: { userId, slot: { in: [...USER_SLOTS] } },
      select: { slot: true, config: true, name: true },
    }),
    cryptoPrisma.chartLayout.findUnique({
      where: { userId_slot: { userId: ADMIN_USER_ID, slot: 0 } },
      select: { config: true, name: true },
    }),
  ]);

  const layouts = rows.map((r) => ({
    slot: r.slot,
    config: r.config as Record<string, unknown>,
    name: r.name ?? undefined,
  }));

  const defaultLayout = defaultRow?.config != null && typeof defaultRow.config === "object" && !Array.isArray(defaultRow.config)
    ? { config: defaultRow.config as Record<string, unknown>, name: defaultRow.name ?? undefined }
    : null;

  return NextResponse.json({
    layouts,
    defaultLayout,
    canSaveDefault: user?.role === Role.admin,
  });
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await cryptoPrisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const isAdmin = user?.role === Role.admin;

  const NAME_MAX_LEN = 24;
  let body: { slot?: number; config?: unknown; name?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name =
    body.name !== undefined
      ? (typeof body.name === "string" ? body.name.trim().slice(0, NAME_MAX_LEN) || null : null)
      : undefined;

  const slot = typeof body.slot === "number" && Number.isInteger(body.slot) ? body.slot : undefined;
  if (slot == null) {
    return NextResponse.json({ error: "invalid_slot", message: "Slot is required" }, { status: 400 });
  }
  if (slot === 0) {
    if (!isAdmin) return NextResponse.json({ error: "forbidden", message: "Only admin can save to default slot" }, { status: 403 });
    // Admin salva no slot 0 do próprio userId (não no ADMIN_USER_ID) — na verdade o default é do admin, então admin deve salvar em userId = ADMIN_USER_ID, slot 0.
    // Ou seja: quando o usuário logado é o admin, o POST slot 0 deve upsert (ADMIN_USER_ID, 0). Assim o “doninho” do slot 0 é sempre o admin.
    // Decisão: quando admin faz POST slot 0, fazemos upsert em (ADMIN_USER_ID, 0).
  } else if (!USER_SLOTS.includes(slot as (typeof USER_SLOTS)[number])) {
    return NextResponse.json({ error: "invalid_slot", message: "Slot must be 0 (admin only) or 1–7" }, { status: 400 });
  }

  const targetUserId = slot === 0 && isAdmin ? ADMIN_USER_ID : userId;

  const config = body.config != null && typeof body.config === "object" && !Array.isArray(body.config)
    ? body.config
    : {};
  const configStr = JSON.stringify(config);
  if (configStr.length > CONFIG_MAX_BYTES) {
    return NextResponse.json({ error: "config_too_large", message: "Config exceeds max size" }, { status: 400 });
  }

  await cryptoPrisma.chartLayout.upsert({
    where: { userId_slot: { userId: targetUserId, slot } },
    create: { userId: targetUserId, slot, config, name: name ?? null },
    update: name !== undefined ? { config, name } : { config },
  });

  return NextResponse.json({ ok: true, slot });
}
