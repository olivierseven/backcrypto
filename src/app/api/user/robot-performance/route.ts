// GET /api/user/robot-performance — eventos de execução por robô (período + métricas brutas para relatório).
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const MAX_LIMIT = 1000;
const DEFAULT_DAYS = 30;

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

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const robotId = searchParams.get("robotId")?.trim() ?? undefined;
  const symbol = searchParams.get("symbol")?.trim().toUpperCase() ?? undefined;
  const limitRaw = searchParams.get("limit");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(Number(limitRaw)) ? Math.floor(Number(limitRaw)) : 500)
  );

  const now = Date.now();
  let fromMs = now - DEFAULT_DAYS * 24 * 60 * 60 * 1000;
  let toMs = now;
  const fromStr = searchParams.get("from")?.trim();
  const toStr = searchParams.get("to")?.trim();
  if (fromStr) {
    const t = Date.parse(fromStr);
    if (!Number.isFinite(t)) return NextResponse.json({ error: "invalid_from" }, { status: 400 });
    fromMs = t;
  }
  if (toStr) {
    const t = Date.parse(toStr);
    if (!Number.isFinite(t)) return NextResponse.json({ error: "invalid_to" }, { status: 400 });
    toMs = t;
  }
  if (fromMs > toMs) return NextResponse.json({ error: "from_after_to" }, { status: 400 });

  const events = await cryptoPrisma.robotSpotPerformanceEvent.findMany({
    where: {
      userId,
      ...(robotId ? { robotId } : {}),
      ...(symbol ? { symbol } : {}),
      createdAt: { gte: new Date(fromMs), lte: new Date(toMs) },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      robotId: true,
      robotAliasSnapshot: true,
      symbol: true,
      side: true,
      executionRole: true,
      binanceOrderId: true,
      executedQtyBase: true,
      quoteQtyUsdt: true,
      avgPrice: true,
      feeUsdt: true,
      realizedPnlUsdt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    count: events.length,
    events,
  });
}
