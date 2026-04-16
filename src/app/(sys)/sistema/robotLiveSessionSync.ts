/**
 * Sincroniza estado live do robô + relatório de ações com Postgres (sessão por user+robot+symbol).
 * Ao desativar o robô, o servidor apaga as linhas — o relatório reinicia na próxima ativação.
 */

import { API_BASE } from "@/app/constants";
import type { MutableRefObject } from "react";
import type { RobotBuyExecMap } from "./robotsStorage";
import { persistRobotBuyExecMap, robotBuyExecMapKey } from "./robotsStorage";
import type { RobotLiveBuyAccumRefBag } from "./robotLiveBuyAccumStorage";

export const ROBOT_LIVE_SESSION_ACTIVITY_EVENT = "robot-live-session-activity";

/** Após desativar/apagar robô: limpar refs do motor neste separador para o par atual. */
export const ROBOT_LIVE_SESSION_CLEAR_REFS_EVENT = "crypto-robot-live-clear-refs";

export const ROBOT_LIVE_SESSION_PAYLOAD_V = 2 as const;

export type RobotLiveActivityEvent = {
  ts: string;
  kind: string;
  detail?: Record<string, unknown>;
};

export type RobotLiveSessionPayloadV2 = {
  v: typeof ROBOT_LIVE_SESSION_PAYLOAD_V;
  engine: {
    flattenArmed?: true;
    buyEdgesSinceFlat: number;
    accumulationActive?: true;
    accumLastOt?: string;
    accumCandleIndex?: number;
    sequentialSliceUsdt?: number;
    accumFrozenMaxSpendUsdt?: number;
    buySignalCountedOpenTimes: string[];
    hadPositionEnd?: true;
  };
  /** openTime → 1 (escopo = par robot+symbol da linha) */
  buyExecOpenTimes: Record<string, 1>;
  events: RobotLiveActivityEvent[];
};

const MAX_EVENTS_PER_SESSION = 400;
const DB_DEBOUNCE_MS = 900;

/** Relatório em memória por chave `robotId::SYMBOL` (alinhado aos refs). */
const eventsByKey: Record<string, RobotLiveActivityEvent[]> = {};

let dbPersistTimer: ReturnType<typeof setTimeout> | null = null;
let lastDbPayloadJson: string | null = null;

export function sessionKeyArm(robotId: string, symbol: string): string {
  return `${robotId}::${symbol.trim().toUpperCase()}`;
}

function defaultPayload(): RobotLiveSessionPayloadV2 {
  return {
    v: ROBOT_LIVE_SESSION_PAYLOAD_V,
    engine: {
      buyEdgesSinceFlat: 0,
      buySignalCountedOpenTimes: [],
    },
    buyExecOpenTimes: {},
    events: [],
  };
}

function clampEvents(events: RobotLiveActivityEvent[]): RobotLiveActivityEvent[] {
  if (events.length <= MAX_EVENTS_PER_SESSION) return events;
  return events.slice(events.length - MAX_EVENTS_PER_SESSION);
}

export function appendRobotLiveActivityEvent(
  robotId: string,
  symbol: string,
  kind: string,
  detail?: Record<string, unknown>
): void {
  const k = sessionKeyArm(robotId, symbol);
  const list = eventsByKey[k] ?? [];
  list.push({
    ts: new Date().toISOString(),
    kind,
    ...(detail && Object.keys(detail).length > 0 ? { detail } : {}),
  });
  eventsByKey[k] = clampEvents(list);
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(ROBOT_LIVE_SESSION_ACTIVITY_EVENT));
    } catch {
      /* ignore */
    }
  }
}

/** Remove relatório local e cache de eventos para um robô (após DELETE no servidor ou desativação). */
export function clearRobotLiveSessionLocalCache(robotId: string): void {
  const prefix = `${robotId}::`;
  for (const k of Object.keys(eventsByKey)) {
    if (k.startsWith(prefix)) delete eventsByKey[k];
  }
  lastDbPayloadJson = null;
}

export function clearRobotLiveRefsForRobotSymbol(
  refs: RobotLiveBuyAccumRefBag,
  robotId: string,
  symbol: string
): void {
  const kArm = sessionKeyArm(robotId, symbol);
  delete refs.robotFlattenArmedRef.current[kArm];
  delete refs.robotBuyEdgesSinceFlatRef.current[kArm];
  delete refs.robotBuyAccumulationActiveRef.current[kArm];
  delete refs.robotBuyAccumLastOtRef.current[kArm];
  delete refs.robotBuyAccumCandleIndexRef.current[kArm];
  delete refs.robotBuySequentialSliceUsdtRef.current[kArm];
  delete refs.robotBuyAccumFrozenMaxSpendUsdtRef.current[kArm];
  delete refs.robotBuySignalCountedOpenTimesRef.current[kArm];
  delete refs.robotBuyHadPositionEndRef.current[kArm];
}

export function extractSessionPayloadForKey(
  kArm: string,
  refs: RobotLiveBuyAccumRefBag,
  buyExecMap: RobotBuyExecMap,
  robotId: string,
  symbol: string
): RobotLiveSessionPayloadV2 {
  const symU = symbol.trim().toUpperCase();
  const fa = refs.robotFlattenArmedRef.current[kArm];
  const edges = refs.robotBuyEdgesSinceFlatRef.current[kArm];
  const acc = refs.robotBuyAccumulationActiveRef.current[kArm];
  const lastOt = refs.robotBuyAccumLastOtRef.current[kArm];
  const cIdx = refs.robotBuyAccumCandleIndexRef.current[kArm];
  const slice = refs.robotBuySequentialSliceUsdtRef.current[kArm];
  const frozenMax = refs.robotBuyAccumFrozenMaxSpendUsdtRef.current[kArm];
  const countedArr = [...(refs.robotBuySignalCountedOpenTimesRef.current[kArm] ?? new Set<string>())].sort();
  const hadEnd = refs.robotBuyHadPositionEndRef.current[kArm] === true;

  const perRobot = buyExecMap[robotId] ?? {};
  const buyExecOpenTimes: Record<string, 1> = {};
  for (const [innerKey, v] of Object.entries(perRobot)) {
    if (innerKey.includes("::")) {
      if (innerKey.startsWith(`${symU}::`)) {
        const ot = innerKey.slice(symU.length + 2);
        buyExecOpenTimes[ot] = v;
      }
    } else {
      buyExecOpenTimes[innerKey] = v;
    }
  }

  const base = defaultPayload();
  const engine: RobotLiveSessionPayloadV2["engine"] = {
    buyEdgesSinceFlat: typeof edges === "number" && Number.isFinite(edges) ? edges : 0,
    buySignalCountedOpenTimes: countedArr,
  };
  if (fa === true) engine.flattenArmed = true;
  if (acc === true) engine.accumulationActive = true;
  if (typeof lastOt === "string") engine.accumLastOt = lastOt;
  if (typeof cIdx === "number" && Number.isFinite(cIdx)) engine.accumCandleIndex = cIdx;
  if (typeof slice === "number" && Number.isFinite(slice) && slice > 0) engine.sequentialSliceUsdt = slice;
  if (typeof frozenMax === "number" && Number.isFinite(frozenMax) && frozenMax > 0) {
    engine.accumFrozenMaxSpendUsdt = frozenMax;
  }
  if (hadEnd) engine.hadPositionEnd = true;

  return {
    v: ROBOT_LIVE_SESSION_PAYLOAD_V,
    engine,
    buyExecOpenTimes,
    events: clampEvents([...(eventsByKey[kArm] ?? [])]),
  };
}

export function mergePayloadIntoRefs(
  kArm: string,
  payload: RobotLiveSessionPayloadV2,
  refs: RobotLiveBuyAccumRefBag
): void {
  const e = payload.engine;
  if (e.flattenArmed === true) refs.robotFlattenArmedRef.current[kArm] = true;
  else delete refs.robotFlattenArmedRef.current[kArm];

  refs.robotBuyEdgesSinceFlatRef.current[kArm] =
    typeof e.buyEdgesSinceFlat === "number" && Number.isFinite(e.buyEdgesSinceFlat) ? e.buyEdgesSinceFlat : 0;

  if (e.accumulationActive === true) refs.robotBuyAccumulationActiveRef.current[kArm] = true;
  else delete refs.robotBuyAccumulationActiveRef.current[kArm];

  if (typeof e.accumLastOt === "string") refs.robotBuyAccumLastOtRef.current[kArm] = e.accumLastOt;
  else delete refs.robotBuyAccumLastOtRef.current[kArm];

  if (typeof e.accumCandleIndex === "number" && Number.isFinite(e.accumCandleIndex)) {
    refs.robotBuyAccumCandleIndexRef.current[kArm] = e.accumCandleIndex;
  } else delete refs.robotBuyAccumCandleIndexRef.current[kArm];

  if (typeof e.sequentialSliceUsdt === "number" && Number.isFinite(e.sequentialSliceUsdt) && e.sequentialSliceUsdt > 0) {
    refs.robotBuySequentialSliceUsdtRef.current[kArm] = e.sequentialSliceUsdt;
  } else delete refs.robotBuySequentialSliceUsdtRef.current[kArm];

  if (
    typeof e.accumFrozenMaxSpendUsdt === "number" &&
    Number.isFinite(e.accumFrozenMaxSpendUsdt) &&
    e.accumFrozenMaxSpendUsdt > 0
  ) {
    refs.robotBuyAccumFrozenMaxSpendUsdtRef.current[kArm] = e.accumFrozenMaxSpendUsdt;
  } else delete refs.robotBuyAccumFrozenMaxSpendUsdtRef.current[kArm];

  const set = new Set<string>(Array.isArray(e.buySignalCountedOpenTimes) ? e.buySignalCountedOpenTimes : []);
  refs.robotBuySignalCountedOpenTimesRef.current[kArm] = set;

  if (e.hadPositionEnd === true) refs.robotBuyHadPositionEndRef.current[kArm] = true;
  else delete refs.robotBuyHadPositionEndRef.current[kArm];

  eventsByKey[kArm] = clampEvents(Array.isArray(payload.events) ? [...payload.events] : []);
}

/** Funde buyExecOpenTimes da sessão no mapa global (chaves `SYMBOL::openTime`). */
export function mergeSessionBuyExecIntoMap(
  map: RobotBuyExecMap,
  robotId: string,
  symbol: string,
  buyExecOpenTimes: Record<string, 1>
): RobotBuyExecMap {
  let next = map;
  const symU = symbol.trim().toUpperCase();
  for (const ot of Object.keys(buyExecOpenTimes)) {
    const k = robotBuyExecMapKey(symU, ot);
    const prev = next[robotId] ?? {};
    if (prev[k] === 1 && next === map) continue;
    if (next === map) next = { ...map };
    next[robotId] = { ...(next[robotId] ?? {}), [k]: 1 as const };
  }
  return next;
}

type PersistCtx = {
  refs: RobotLiveBuyAccumRefBag;
  getBuyExecMap: () => RobotBuyExecMap;
  activeRobotIds: Set<string>;
  symbol: string;
};

export function schedulePersistRobotLiveSessionsToDb(ctx: PersistCtx): void {
  if (typeof window === "undefined") return;
  if (dbPersistTimer != null) clearTimeout(dbPersistTimer);
  dbPersistTimer = setTimeout(() => {
    dbPersistTimer = null;
    void flushPersistRobotLiveSessionsToDb(ctx);
  }, DB_DEBOUNCE_MS);
}

async function flushPersistRobotLiveSessionsToDb(ctx: PersistCtx): Promise<void> {
  const sym = ctx.symbol?.trim().toUpperCase();
  if (!sym || !sym.endsWith("USDT")) return;

  const buyMap = ctx.getBuyExecMap();
  const items: Array<{ robotId: string; symbol: string; payload: RobotLiveSessionPayloadV2 }> = [];

  for (const robotId of ctx.activeRobotIds) {
    const kArm = sessionKeyArm(robotId, sym);
    const payload = extractSessionPayloadForKey(kArm, ctx.refs, buyMap, robotId, sym);
    items.push({ robotId, symbol: sym, payload });
  }

  if (items.length === 0) return;

  let json: string;
  try {
    json = JSON.stringify({ items });
  } catch {
    return;
  }
  if (json === lastDbPayloadJson) return;

  try {
    const res = await fetch(`${API_BASE}/user/robot-live-sessions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: json,
    });
    if (res.ok) {
      lastDbPayloadJson = json;
    }
  } catch {
    /* rede: próximo debounce tenta de novo */
  }
}

export async function fetchRobotLiveSessionsAndMerge(args: {
  refs: RobotLiveBuyAccumRefBag;
  setBuyExecMap: (fn: (prev: RobotBuyExecMap) => RobotBuyExecMap) => void;
  symbol: string | undefined;
  activeRobotIds: Set<string>;
}): Promise<void> {
  const sym = args.symbol?.trim().toUpperCase();
  if (!sym || !sym.endsWith("USDT")) return;

  try {
    const res = await fetch(`${API_BASE}/user/robot-live-sessions`, { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      sessions?: Array<{ robotId: string; symbol: string; payload: unknown }>;
    };
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];

    args.setBuyExecMap((prev) => {
      let next = prev;
      for (const row of sessions) {
        if (typeof row.robotId !== "string" || !args.activeRobotIds.has(row.robotId)) continue;
        if (typeof row.symbol !== "string" || row.symbol.toUpperCase() !== sym) continue;
        const p = row.payload;
        if (p == null || typeof p !== "object" || Array.isArray(p)) continue;
        const pl = p as RobotLiveSessionPayloadV2;
        if (pl.v !== ROBOT_LIVE_SESSION_PAYLOAD_V) continue;
        const kArm = sessionKeyArm(row.robotId, sym);
        mergePayloadIntoRefs(kArm, pl, args.refs);
        next = mergeSessionBuyExecIntoMap(next, row.robotId, sym, pl.buyExecOpenTimes ?? {});
      }
      if (next !== prev) persistRobotBuyExecMap(next);
      return next;
    });
  } catch {
    /* offline */
  }
}

export async function deleteRobotLiveSessionsOnServerForRobot(robotId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/user/robot-live-sessions?robotId=${encodeURIComponent(robotId)}`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    /* ignore */
  }
  clearRobotLiveSessionLocalCache(robotId);
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(ROBOT_LIVE_SESSION_CLEAR_REFS_EVENT, { detail: { robotId } }));
    } catch {
      /* ignore */
    }
  }
}
