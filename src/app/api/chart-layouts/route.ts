// GET: lista layouts do usuário (slots 1–7; ChartLayout). defaultLayout vem de ChartModels (slot 0). canSaveDefault só para admin.
// POST: salva layout em um slot (1–7). Body: { slot, config } (legado) ou { slot, layout?, indicators?, strategies?, name? }.
// PATCH: atualiza só colunas enviadas. Body: { slot, appliedStrategyIds? | layout? | indicators? | strategies? }.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Role } from "@/lib/prisma-bio-client";
import { mergeColumnsToConfig, splitConfigToColumns } from "@/lib/chart-layout-columns";
import { claimOrRejectSession, getTabIdFromRequest } from "@/lib/session-tab-claim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

/** ChartLayout = slots 1–7. Slot 0 (default) existe só em ChartModels (admin). */
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
const CONFIG_MAX_BYTES = 32 * 1024; // 32KB por JSON

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tabId = getTabIdFromRequest(request);
  const sessionReject = await claimOrRejectSession(request, userId, tabId);
  if (sessionReject) return sessionReject;

  const [user, rows, defaultModel] = await Promise.all([
    cryptoPrisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    cryptoPrisma.chartLayout.findMany({
      where: { userId, slot: { in: [...USER_SLOTS] } },
      select: { slot: true, name: true, layout: true, indicators: true, strategies: true },
    }),
    cryptoPrisma.chartModel.findUnique({
      where: { userId_slot: { userId: ADMIN_USER_ID, slot: 0 } },
      select: { name: true, layout: true, indicators: true, strategies: true },
    }),
  ]);

  const layouts = rows.map((r) => {
    const config = mergeColumnsToConfig(r.layout, r.indicators, r.strategies);
    return {
      slot: r.slot,
      config,
      name: r.name ?? undefined,
    };
  });

  const defaultLayout = defaultModel != null
    ? { config: mergeColumnsToConfig(defaultModel.layout, defaultModel.indicators, defaultModel.strategies), name: defaultModel.name ?? undefined }
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

  const tabId = getTabIdFromRequest(req);
  const sessionReject = await claimOrRejectSession(req, userId, tabId);
  if (sessionReject) return sessionReject;

  const NAME_MAX_LEN = 24;
  let body: {
    slot?: number;
    config?: unknown;
    name?: string;
    layout?: unknown;
    indicators?: unknown;
    strategies?: unknown;
  } = {};
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
    return NextResponse.json({ error: "invalid_slot", message: "Use Chart Models (debug) to update the default model" }, { status: 400 });
  }
  if (!USER_SLOTS.includes(slot as (typeof USER_SLOTS)[number])) {
    return NextResponse.json({ error: "invalid_slot", message: "Slot must be 1–7" }, { status: 400 });
  }

  const targetUserId = userId;

  if (body.config != null && typeof body.config === "object" && !Array.isArray(body.config)) {
    const config = body.config as Record<string, unknown>;
    const configStr = JSON.stringify(config);
    if (configStr.length > CONFIG_MAX_BYTES) {
      return NextResponse.json({ error: "config_too_large", message: "Config exceeds max size" }, { status: 400 });
    }
    const { layout: layoutCol, indicators: indicatorsCol, strategies: strategiesCol } = splitConfigToColumns(config);
    const layoutStr = JSON.stringify(layoutCol);
    const indicatorsStr = JSON.stringify(indicatorsCol);
    const strategiesStr = JSON.stringify(strategiesCol);
    if ([layoutStr.length, indicatorsStr.length, strategiesStr.length].some((n) => n > CONFIG_MAX_BYTES)) {
      return NextResponse.json({ error: "config_too_large", message: "Config exceeds max size" }, { status: 400 });
    }
    await cryptoPrisma.chartLayout.upsert({
      where: { userId_slot: { userId: targetUserId, slot } },
      create: {
        userId: targetUserId,
        slot,
        layout: layoutCol,
        indicators: indicatorsCol,
        strategies: strategiesCol,
        name: name ?? null,
      },
      update: {
        layout: layoutCol,
        indicators: indicatorsCol,
        strategies: strategiesCol,
        ...(name !== undefined && { name }),
      },
    });
    return NextResponse.json({ ok: true, slot });
  }

  if (body.layout !== undefined || body.indicators !== undefined || body.strategies !== undefined) {
    const existing = await cryptoPrisma.chartLayout.findUnique({
      where: { userId_slot: { userId: targetUserId, slot } },
      select: { layout: true, indicators: true, strategies: true },
    });
    const layout = body.layout !== undefined ? body.layout : (existing?.layout ?? null);
    const indicators = body.indicators !== undefined ? body.indicators : (existing?.indicators ?? null);
    const strategies = body.strategies !== undefined ? body.strategies : (existing?.strategies ?? null);
    for (const [label, val] of [
      ["layout", layout],
      ["indicators", indicators],
      ["strategies", strategies],
    ] as const) {
      const str = JSON.stringify(val);
      if (str.length > CONFIG_MAX_BYTES) {
        return NextResponse.json({ error: "config_too_large", message: `${label} exceeds max size` }, { status: 400 });
      }
    }
    await cryptoPrisma.chartLayout.upsert({
      where: { userId_slot: { userId: targetUserId, slot } },
      create: {
        userId: targetUserId,
        slot,
        layout: layout ?? undefined,
        indicators: indicators ?? undefined,
        strategies: strategies ?? undefined,
        name: name ?? null,
      },
      update: {
        ...(body.layout !== undefined && { layout }),
        ...(body.indicators !== undefined && { indicators }),
        ...(body.strategies !== undefined && { strategies }),
        ...(name !== undefined && { name }),
      },
    });
    return NextResponse.json({ ok: true, slot });
  }

  return NextResponse.json({ error: "invalid_body", message: "Either config or at least one of layout, indicators, strategies is required" }, { status: 400 });
}

/** PATCH: atualiza só as colunas enviadas. Body: { slot, appliedStrategyIds? } (legado) ou { slot, layout? | indicators? | strategies? }. */
export async function PATCH(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tabId = getTabIdFromRequest(req);
  const sessionReject = await claimOrRejectSession(req, userId, tabId);
  if (sessionReject) return sessionReject;

  let body: {
    slot?: number;
    appliedStrategyIds?: unknown;
    layout?: unknown;
    indicators?: unknown;
    strategies?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const slot = typeof body.slot === "number" && Number.isInteger(body.slot) ? body.slot : undefined;
  if (slot == null || !USER_SLOTS.includes(slot as (typeof USER_SLOTS)[number])) {
    return NextResponse.json({ error: "invalid_slot", message: "Slot must be 1–7" }, { status: 400 });
  }

  const existing = await cryptoPrisma.chartLayout.findUnique({
    where: { userId_slot: { userId, slot } },
    select: { layout: true, indicators: true, strategies: true },
  });

  const update: { layout?: unknown; indicators?: unknown; strategies?: unknown } = {};

  if (body.appliedStrategyIds !== undefined) {
    const appliedStrategyIds = Array.isArray(body.appliedStrategyIds)
      ? body.appliedStrategyIds.filter((id): id is string => typeof id === "string")
      : [];
    const hasColumns = existing != null && (existing.layout != null || existing.indicators != null || existing.strategies != null);
    let strategies: { strategies: unknown[]; appliedStrategyIds: string[] };
    if (hasColumns && existing?.strategies != null && typeof existing.strategies === "object" && !Array.isArray(existing.strategies)) {
      const strategiesCol = existing.strategies as Record<string, unknown>;
      strategies = {
        strategies: Array.isArray(strategiesCol.strategies) ? strategiesCol.strategies : [],
        appliedStrategyIds,
      };
    } else {
      strategies = { strategies: [], appliedStrategyIds };
    }
    update.strategies = strategies;
    const str = JSON.stringify(strategies);
    if (str.length > CONFIG_MAX_BYTES) {
      return NextResponse.json({ error: "config_too_large", message: "Payload exceeds max size" }, { status: 400 });
    }
  }

  if (body.layout !== undefined) {
    update.layout = body.layout;
    if (JSON.stringify(body.layout).length > CONFIG_MAX_BYTES) {
      return NextResponse.json({ error: "config_too_large", message: "layout exceeds max size" }, { status: 400 });
    }
  }
  if (body.indicators !== undefined) {
    update.indicators = body.indicators;
    if (JSON.stringify(body.indicators).length > CONFIG_MAX_BYTES) {
      return NextResponse.json({ error: "config_too_large", message: "indicators exceeds max size" }, { status: 400 });
    }
  }
  if (body.strategies !== undefined && body.appliedStrategyIds === undefined) {
    update.strategies = body.strategies;
    if (JSON.stringify(body.strategies).length > CONFIG_MAX_BYTES) {
      return NextResponse.json({ error: "config_too_large", message: "strategies exceeds max size" }, { status: 400 });
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "invalid_body", message: "Send appliedStrategyIds, layout, indicators or strategies" }, { status: 400 });
  }

  await cryptoPrisma.chartLayout.upsert({
    where: { userId_slot: { userId, slot } },
    create: {
      userId,
      slot,
      layout: update.layout ?? undefined,
      indicators: update.indicators ?? undefined,
      strategies: update.strategies ?? undefined,
      name: null,
    },
    update,
  });

  return NextResponse.json({ ok: true, slot });
}
