// GET: lista layouts do usuário (slots 1–7; ChartLayout). defaultLayout vem de ChartModels (slot 0). canSaveDefault só para admin.
// POST: salva layout em um slot (1–7). Body: { slot, config } (legado) ou { slot, layout?, indicators?, strategies?, name? }.
// PATCH: atualiza só colunas enviadas ou só o nome. Body: { slot, name? } ou { slot, appliedStrategyIds? | layout? | ... }.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Prisma, Role } from "@/lib/prisma-bio-client";
import { mergeColumnsToConfig, splitConfigToColumns } from "@/lib/chart-layout-columns";
import { claimOrRejectSession, getTabIdFromRequest } from "@/lib/session-tab-claim";
import { syncUserTierAndIsFree } from "@/lib/user-tier";
import { Tier } from "@/lib/prisma-bio-client";

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
// Limite por coluna JSON do layout.
// 32KB ficou curto para estratégias/regressões mais complexas e causava 400 frequente.
const CONFIG_MAX_BYTES = 256 * 1024; // 256KB por JSON

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tabId = getTabIdFromRequest(request);
  const sessionReject = await claimOrRejectSession(request, userId, tabId);
  if (sessionReject) return sessionReject;

  const { tier, isFreeUser } = await syncUserTierAndIsFree(userId);

  const [user, rows, defaultModel] = await Promise.all([
    cryptoPrisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    cryptoPrisma.chartLayout.findMany({
      where: { userId, slot: { in: [...USER_SLOTS] } },
      select: {
        slot: true,
        name: true,
        layout: true,
        indicators: true,
        strategies: true,
        regressions: true,
        others: true,
        robots: true,
      },
    }),
    cryptoPrisma.chartModel.findUnique({
      where: { userId_slot: { userId: ADMIN_USER_ID, slot: 0 } },
      select: { name: true, layout: true, indicators: true, strategies: true, regressions: true, others: true },
    }),
  ]);

  const layouts = isFreeUser
    ? []
    : rows.map((r) => {
        const config = mergeColumnsToConfig(
          r.layout,
          r.indicators,
          r.strategies,
          r.others ?? undefined,
          r.regressions ?? undefined,
          r.robots
        );
        return {
          slot: r.slot,
          config,
          name: r.name ?? undefined,
        };
      });

  const defaultLayout = defaultModel != null
    ? {
        config: mergeColumnsToConfig(
          defaultModel.layout,
          defaultModel.indicators,
          defaultModel.strategies,
          defaultModel.others ?? undefined,
          defaultModel.regressions ?? undefined
        ),
        name: defaultModel.name ?? undefined,
      }
    : null;

  return NextResponse.json({
    layouts,
    defaultLayout,
    canSaveDefault: user?.role === Role.admin,
    tier,
    isFreeUser,
  });
}

async function rejectIfFreeUser(userId: string): Promise<NextResponse | null> {
  const { isFreeUser } = await syncUserTierAndIsFree(userId);
  if (!isFreeUser) return null;
  return NextResponse.json(
    { error: "plan_required", message: "Saved layouts require an active plan" },
    { status: 403 }
  );
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tabId = getTabIdFromRequest(req);
  const sessionReject = await claimOrRejectSession(req, userId, tabId);
  if (sessionReject) return sessionReject;

  const freeReject = await rejectIfFreeUser(userId);
  if (freeReject) return freeReject;

  const NAME_MAX_LEN = 24;
  let body: {
    slot?: number;
    config?: unknown;
    name?: string;
    layout?: unknown;
    indicators?: unknown;
    strategies?: unknown;
    regressions?: unknown;
    others?: unknown;
    robots?: unknown;
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
    const {
      layout: layoutCol,
      indicators: indicatorsCol,
      strategies: strategiesCol,
      regressions: regressionsCol,
      others: othersCol,
      robots: robotsCol,
    } = splitConfigToColumns(config);
    const layoutStr = JSON.stringify(layoutCol);
    const indicatorsStr = JSON.stringify(indicatorsCol);
    const strategiesStr = JSON.stringify(strategiesCol);
    const regressionsStr = JSON.stringify(regressionsCol);
    const othersStr = JSON.stringify(othersCol);
    const robotsStr = robotsCol != null ? JSON.stringify(robotsCol) : "null";
    if (
      [layoutStr.length, indicatorsStr.length, strategiesStr.length, regressionsStr.length, othersStr.length, robotsStr.length].some(
        (n) => n > CONFIG_MAX_BYTES
      )
    ) {
      return NextResponse.json({ error: "config_too_large", message: "Config exceeds max size" }, { status: 400 });
    }
    await cryptoPrisma.chartLayout.upsert({
      where: { userId_slot: { userId: targetUserId, slot } },
      create: {
        userId: targetUserId,
        slot,
        layout: layoutCol as Prisma.InputJsonValue,
        indicators: indicatorsCol as Prisma.InputJsonValue,
        strategies: strategiesCol as Prisma.InputJsonValue,
        regressions: regressionsCol as Prisma.InputJsonValue,
        others: Object.keys(othersCol).length > 0 ? (othersCol as Prisma.InputJsonValue) : Prisma.DbNull,
        robots: robotsCol != null ? (robotsCol as Prisma.InputJsonValue) : undefined,
        name: name ?? null,
      },
      update: {
        layout: layoutCol as Prisma.InputJsonValue,
        indicators: indicatorsCol as Prisma.InputJsonValue,
        strategies: strategiesCol as Prisma.InputJsonValue,
        regressions: regressionsCol as Prisma.InputJsonValue,
        others: othersCol as Prisma.InputJsonValue,
        ...(robotsCol != null && { robots: robotsCol as Prisma.InputJsonValue }),
        ...(name !== undefined && { name }),
      },
    });
    return NextResponse.json({ ok: true, slot });
  }

  if (
    body.layout !== undefined ||
    body.indicators !== undefined ||
    body.strategies !== undefined ||
    body.regressions !== undefined ||
    body.others !== undefined ||
    body.robots !== undefined
  ) {
    const existing = await cryptoPrisma.chartLayout.findUnique({
      where: { userId_slot: { userId: targetUserId, slot } },
      select: { layout: true, indicators: true, strategies: true, regressions: true, others: true, robots: true },
    });
    const layout = body.layout !== undefined ? body.layout : (existing?.layout ?? null);
    const indicators = body.indicators !== undefined ? body.indicators : (existing?.indicators ?? null);
    const strategies = body.strategies !== undefined ? body.strategies : (existing?.strategies ?? null);
    const regressions = body.regressions !== undefined ? body.regressions : (existing?.regressions ?? null);
    const others = body.others !== undefined ? body.others : (existing?.others ?? null);
    const robots = body.robots !== undefined ? body.robots : (existing?.robots ?? null);
    for (const [label, val] of [
      ["layout", layout],
      ["indicators", indicators],
      ["strategies", strategies],
      ["regressions", regressions],
      ["others", others],
      ["robots", robots],
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
        regressions: regressions ?? undefined,
        others: others != null && typeof others === "object" && Object.keys(others as object).length > 0 ? (others as Prisma.InputJsonValue) : Prisma.DbNull,
        robots: robots != null ? (robots as Prisma.InputJsonValue) : undefined,
        name: name ?? null,
      },
      update: {
        ...(body.layout !== undefined && { layout: layout == null ? Prisma.DbNull : (layout as Prisma.InputJsonValue) }),
        ...(body.indicators !== undefined && { indicators: indicators == null ? Prisma.DbNull : (indicators as Prisma.InputJsonValue) }),
        ...(body.strategies !== undefined && { strategies: strategies == null ? Prisma.DbNull : (strategies as Prisma.InputJsonValue) }),
        ...(body.regressions !== undefined && { regressions: regressions == null ? Prisma.DbNull : (regressions as Prisma.InputJsonValue) }),
        ...(body.others !== undefined && { others: others == null || typeof others !== "object" ? Prisma.DbNull : (others as Prisma.InputJsonValue) }),
        ...(body.robots !== undefined && { robots: robots == null ? Prisma.DbNull : (robots as Prisma.InputJsonValue) }),
        ...(name !== undefined && { name }),
      },
    });
    return NextResponse.json({ ok: true, slot });
  }

  return NextResponse.json({
    error: "invalid_body",
    message: "Either config or at least one of layout, indicators, strategies, regressions, others, robots is required",
  }, { status: 400 });
}

/** PATCH: atualiza só as colunas enviadas. Body: { slot, appliedStrategyIds? } (legado) ou { slot, layout? | indicators? | strategies? }. */
export async function PATCH(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tabId = getTabIdFromRequest(req);
  const sessionReject = await claimOrRejectSession(req, userId, tabId);
  if (sessionReject) return sessionReject;

  const freeReject = await rejectIfFreeUser(userId);
  if (freeReject) return freeReject;

  const NAME_MAX_LEN = 24;

  let body: {
    slot?: number;
    name?: string;
    appliedStrategyIds?: unknown;
    layout?: unknown;
    indicators?: unknown;
    strategies?: unknown;
    regressions?: unknown;
    others?: unknown;
    robots?: unknown;
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

  const nameUpdate =
    body.name !== undefined
      ? (typeof body.name === "string" ? body.name.trim().slice(0, NAME_MAX_LEN) || null : null)
      : undefined;

  const existing = await cryptoPrisma.chartLayout.findUnique({
    where: { userId_slot: { userId, slot } },
    select: { layout: true, indicators: true, strategies: true, regressions: true, others: true, robots: true },
  });

  const update: {
    layout?: unknown;
    indicators?: unknown;
    strategies?: unknown;
    regressions?: unknown;
    others?: unknown;
    robots?: unknown;
  } = {};

  function toJsonInput(v: unknown): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
    return v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue);
  }

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
  if (body.regressions !== undefined) {
    update.regressions = body.regressions;
    if (JSON.stringify(body.regressions).length > CONFIG_MAX_BYTES) {
      return NextResponse.json({ error: "config_too_large", message: "regressions exceeds max size" }, { status: 400 });
    }
    /** Fonte de verdade passa a ser a coluna `regressions`; remove legado embutido no JSON `layout`. */
    if (body.layout === undefined) {
      const layoutRaw = existing?.layout;
      if (
        layoutRaw != null &&
        typeof layoutRaw === "object" &&
        !Array.isArray(layoutRaw) &&
        Object.prototype.hasOwnProperty.call(layoutRaw as object, "userRegressions")
      ) {
        const { userRegressions: _legacy, ...layoutRest } = layoutRaw as Record<string, unknown>;
        update.layout = layoutRest;
        if (JSON.stringify(layoutRest).length > CONFIG_MAX_BYTES) {
          return NextResponse.json({ error: "config_too_large", message: "layout exceeds max size" }, { status: 400 });
        }
      }
    }
  }
  if (body.others !== undefined) {
    update.others = body.others;
    if (JSON.stringify(body.others).length > CONFIG_MAX_BYTES) {
      return NextResponse.json({ error: "config_too_large", message: "others exceeds max size" }, { status: 400 });
    }
  }
  if (body.robots !== undefined) {
    update.robots = body.robots;
    if (JSON.stringify(body.robots).length > CONFIG_MAX_BYTES) {
      return NextResponse.json({ error: "config_too_large", message: "robots exceeds max size" }, { status: 400 });
    }
  }

  if (Object.keys(update).length === 0) {
    if (nameUpdate === undefined) {
      return NextResponse.json({
        error: "invalid_body",
        message: "Send name, appliedStrategyIds, layout, indicators, strategies, regressions, others or robots",
      }, { status: 400 });
    }
    if (!existing) {
      return NextResponse.json(
        { error: "layout_not_found", message: "Save the layout at least once before renaming" },
        { status: 404 }
      );
    }
    await cryptoPrisma.chartLayout.update({
      where: { userId_slot: { userId, slot } },
      data: { name: nameUpdate },
    });
    return NextResponse.json({ ok: true, slot });
  }

  const updatePayload: {
    layout?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
    indicators?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
    strategies?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
    regressions?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
    others?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
    robots?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
    name?: string | null;
  } = {};
  if (update.layout !== undefined) updatePayload.layout = toJsonInput(update.layout);
  if (update.indicators !== undefined) updatePayload.indicators = toJsonInput(update.indicators);
  if (update.strategies !== undefined) updatePayload.strategies = toJsonInput(update.strategies);
  if (update.regressions !== undefined) updatePayload.regressions = toJsonInput(update.regressions);
  if (update.others !== undefined) updatePayload.others = toJsonInput(update.others);
  if (update.robots !== undefined) updatePayload.robots = toJsonInput(update.robots);
  if (nameUpdate !== undefined) updatePayload.name = nameUpdate;

  await cryptoPrisma.chartLayout.upsert({
    where: { userId_slot: { userId, slot } },
    create: {
      userId,
      slot,
      layout: update.layout !== undefined ? toJsonInput(update.layout) : undefined,
      indicators: update.indicators !== undefined ? toJsonInput(update.indicators) : undefined,
      strategies: update.strategies !== undefined ? toJsonInput(update.strategies) : undefined,
      regressions: update.regressions !== undefined ? toJsonInput(update.regressions) : undefined,
      others: update.others !== undefined ? toJsonInput(update.others) : undefined,
      robots: update.robots !== undefined ? toJsonInput(update.robots) : undefined,
      name: nameUpdate !== undefined ? nameUpdate : null,
    },
    update: updatePayload,
  });

  return NextResponse.json({ ok: true, slot });
}
