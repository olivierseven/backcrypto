// GET: lista modelos (ChartModels). Admin vê todos; resposta usa layout/indicators/strategies (merge em config).
// POST: atualiza um modelo. Body: { slot, config } (legado) ou { slot, layout?, indicators?, strategies?, name? }. Admin only.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Prisma, Role } from "@/lib/prisma-bio-client";
import { mergeColumnsToConfig, splitConfigToColumns } from "@/lib/chart-layout-columns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const ADMIN_USER_ID = "cmh2wwqx5002ktnngv7upschz";
const CONFIG_MAX_BYTES = 32 * 1024;
const NAME_MAX_LEN = 24;

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

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await cryptoPrisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== Role.admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rows = await cryptoPrisma.chartModel.findMany({
    where: { userId: ADMIN_USER_ID },
    select: { slot: true, name: true, layout: true, indicators: true, strategies: true, others: true },
    orderBy: { slot: "asc" },
  });

  const models = rows.map((r) => ({
    slot: r.slot,
    config: mergeColumnsToConfig(r.layout, r.indicators, r.strategies, r.others ?? undefined),
    name: r.name ?? undefined,
  }));

  return NextResponse.json({ models });
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await cryptoPrisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== Role.admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: {
    slot?: number;
    config?: unknown;
    name?: string;
    layout?: unknown;
    indicators?: unknown;
    strategies?: unknown;
    others?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const slot = typeof body.slot === "number" && Number.isInteger(body.slot) ? body.slot : undefined;
  if (slot == null || slot < 0) {
    return NextResponse.json({ error: "invalid_slot", message: "Slot is required (0 = default, 1+ = custom models)" }, { status: 400 });
  }

  const name =
    body.name !== undefined
      ? (typeof body.name === "string" ? body.name.trim().slice(0, NAME_MAX_LEN) || null : null)
      : undefined;

  if (body.config != null && typeof body.config === "object" && !Array.isArray(body.config)) {
    const config = body.config as Record<string, unknown>;
    const configStr = JSON.stringify(config);
    if (configStr.length > CONFIG_MAX_BYTES) return NextResponse.json({ error: "config_too_large" }, { status: 400 });
    const { layout: layoutCol, indicators: indicatorsCol, strategies: strategiesCol, others: othersCol } = splitConfigToColumns(config);
    const othersVal = Object.keys(othersCol).length > 0 ? (othersCol as Prisma.InputJsonValue) : Prisma.DbNull;
    await cryptoPrisma.chartModel.upsert({
      where: { userId_slot: { userId: ADMIN_USER_ID, slot } },
      create: {
        userId: ADMIN_USER_ID,
        slot,
        layout: layoutCol as Prisma.InputJsonValue,
        indicators: indicatorsCol as Prisma.InputJsonValue,
        strategies: strategiesCol as Prisma.InputJsonValue,
        others: othersVal,
        name: name ?? null,
      },
      update: {
        layout: layoutCol as Prisma.InputJsonValue,
        indicators: indicatorsCol as Prisma.InputJsonValue,
        strategies: strategiesCol as Prisma.InputJsonValue,
        others: othersVal,
        ...(name !== undefined && { name }),
      },
    });
    return NextResponse.json({ ok: true, slot });
  }

  if (body.layout !== undefined || body.indicators !== undefined || body.strategies !== undefined || body.others !== undefined) {
    const existing = await cryptoPrisma.chartModel.findUnique({
      where: { userId_slot: { userId: ADMIN_USER_ID, slot } },
      select: { layout: true, indicators: true, strategies: true, others: true },
    });
    const layout = body.layout !== undefined ? body.layout : (existing?.layout ?? null);
    const indicators = body.indicators !== undefined ? body.indicators : (existing?.indicators ?? null);
    const strategies = body.strategies !== undefined ? body.strategies : (existing?.strategies ?? null);
    const others = body.others !== undefined ? body.others : (existing?.others ?? null);
    for (const [label, val] of [
      ["layout", layout],
      ["indicators", indicators],
      ["strategies", strategies],
      ["others", others],
    ] as const) {
      if (JSON.stringify(val).length > CONFIG_MAX_BYTES) {
        return NextResponse.json({ error: "config_too_large", message: `${label} exceeds max size` }, { status: 400 });
      }
    }
    const othersVal = others != null && typeof others === "object" && Object.keys(others as object).length > 0 ? (others as Prisma.InputJsonValue) : Prisma.DbNull;
    await cryptoPrisma.chartModel.upsert({
      where: { userId_slot: { userId: ADMIN_USER_ID, slot } },
      create: {
        userId: ADMIN_USER_ID,
        slot,
        layout: layout == null ? Prisma.DbNull : (layout as Prisma.InputJsonValue),
        indicators: indicators == null ? Prisma.DbNull : (indicators as Prisma.InputJsonValue),
        strategies: strategies == null ? Prisma.DbNull : (strategies as Prisma.InputJsonValue),
        others: othersVal,
        name: name ?? null,
      },
      update: {
        ...(body.layout !== undefined && { layout: layout == null ? Prisma.DbNull : (layout as Prisma.InputJsonValue) }),
        ...(body.indicators !== undefined && { indicators: indicators == null ? Prisma.DbNull : (indicators as Prisma.InputJsonValue) }),
        ...(body.strategies !== undefined && { strategies: strategies == null ? Prisma.DbNull : (strategies as Prisma.InputJsonValue) }),
        ...(body.others !== undefined && { others: othersVal }),
        ...(name !== undefined && { name }),
      },
    });
    return NextResponse.json({ ok: true, slot });
  }

  return NextResponse.json({ error: "invalid_body", message: "Send config or at least one of layout, indicators, strategies, others" }, { status: 400 });
}
