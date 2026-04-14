// GET: sessões live do robô (estado + relatório JSON) — só enquanto o robô está ativo no cliente.
// PUT: upsert em lote por (robotId, symbol).
// DELETE: ?robotId= — remove todas as sessões desse robô (ao desativar ou apagar o robô).
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const MAX_BODY_BYTES = 512 * 1024;
const MAX_ITEMS = 32;

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

function normSymbol(s: string): string {
  return s.trim().toUpperCase();
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await cryptoPrisma.robotLiveSession.findMany({
    where: { userId },
    select: {
      id: true,
      robotId: true,
      symbol: true,
      openedAt: true,
      payload: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ sessions: rows });
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: {
    items?: Array<{ robotId?: string; symbol?: string; payload?: unknown }>;
  };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ ok: true, upserted: 0 });
  if (items.length > MAX_ITEMS) {
    return NextResponse.json({ error: "too_many_items" }, { status: 400 });
  }

  for (const it of items) {
    if (typeof it.robotId !== "string" || it.robotId.length < 1 || it.robotId.length > 64) {
      return NextResponse.json({ error: "invalid_robot_id" }, { status: 400 });
    }
    if (typeof it.symbol !== "string" || it.symbol.length < 3 || it.symbol.length > 32) {
      return NextResponse.json({ error: "invalid_symbol" }, { status: 400 });
    }
    if (it.payload == null || typeof it.payload !== "object" || Array.isArray(it.payload)) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }
  }

  await cryptoPrisma.$transaction(async (tx) => {
    for (const it of items) {
      const rid = it.robotId!;
      const sym = normSymbol(it.symbol!);
      await tx.robotLiveSession.upsert({
        where: {
          userId_robotId_symbol: {
            userId,
            robotId: rid,
            symbol: sym,
          },
        },
        create: {
          userId,
          robotId: rid,
          symbol: sym,
          payload: it.payload as object,
        },
        update: {
          payload: it.payload as object,
        },
      });
    }
  });
  const upserted = items.length;

  return NextResponse.json({ ok: true, upserted });
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const robotId = new URL(request.url).searchParams.get("robotId")?.trim();
  if (!robotId || robotId.length > 64) {
    return NextResponse.json({ error: "invalid_robot_id" }, { status: 400 });
  }

  const res = await cryptoPrisma.robotLiveSession.deleteMany({
    where: { userId, robotId },
  });

  return NextResponse.json({ ok: true, deleted: res.count });
}
