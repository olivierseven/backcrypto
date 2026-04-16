/**
 * Estado em memória do robô live (contagem de sinais, janela de acumulação, flatten armado, etc.)
 * persiste aqui para sobreviver a refresh da página — os useRef em KlinesTable reiniciam sem isto.
 */

import type { MutableRefObject } from "react";
import { loadSavedRobots } from "./robotsStorage";

export const ROBOT_LIVE_BUY_ACCUM_STORAGE_KEY = "crypto_sistema_robot_live_buy_accum_v1";

export type RobotLiveBuyAccumRefBag = {
  robotFlattenArmedRef: MutableRefObject<Record<string, true>>;
  robotBuyEdgesSinceFlatRef: MutableRefObject<Record<string, number>>;
  robotBuyAccumulationActiveRef: MutableRefObject<Record<string, true>>;
  robotBuyAccumLastOtRef: MutableRefObject<Record<string, string>>;
  robotBuyAccumCandleIndexRef: MutableRefObject<Record<string, number>>;
  robotBuySequentialSliceUsdtRef: MutableRefObject<Record<string, number>>;
  robotBuyAccumFrozenMaxSpendUsdtRef: MutableRefObject<Record<string, number>>;
  robotBuySignalCountedOpenTimesRef: MutableRefObject<Record<string, Set<string>>>;
  robotBuyHadPositionEndRef: MutableRefObject<Record<string, boolean>>;
};

type PersistedV1 = {
  v: 1;
  flattenArmed: Record<string, true>;
  buyEdgesSinceFlat: Record<string, number>;
  accumulationActive: Record<string, true>;
  accumLastOt: Record<string, string>;
  accumCandleIndex: Record<string, number>;
  sequentialSliceUsdt: Record<string, number>;
  accumFrozenMaxSpendUsdt?: Record<string, number>;
  buySignalCountedOpenTimes: Record<string, string[]>;
  hadPositionEnd: Record<string, true>;
};

function validRobotIdSet(): Set<string> {
  try {
    return new Set(loadSavedRobots().map((r) => r.id));
  } catch {
    return new Set();
  }
}

/** Mantém só chaves `robotId::SYMBOL` cujo robotId ainda existe em Meus robôs. */
function pruneByRobotKeys<T extends Record<string, unknown>>(obj: T, validIds: Set<string>): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    const robotId = k.split("::")[0];
    if (robotId && !validIds.has(robotId)) {
      delete (out as Record<string, unknown>)[k];
    }
  }
  return out;
}

function serializeCounted(counted: Record<string, Set<string>>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, set] of Object.entries(counted)) {
    out[k] = [...set].sort();
  }
  return out;
}

export function buildRobotLiveBuyAccumSnapshot(refs: RobotLiveBuyAccumRefBag): PersistedV1 {
  return {
    v: 1,
    flattenArmed: { ...refs.robotFlattenArmedRef.current },
    buyEdgesSinceFlat: { ...refs.robotBuyEdgesSinceFlatRef.current },
    accumulationActive: { ...refs.robotBuyAccumulationActiveRef.current },
    accumLastOt: { ...refs.robotBuyAccumLastOtRef.current },
    accumCandleIndex: { ...refs.robotBuyAccumCandleIndexRef.current },
    sequentialSliceUsdt: { ...refs.robotBuySequentialSliceUsdtRef.current },
    accumFrozenMaxSpendUsdt: { ...refs.robotBuyAccumFrozenMaxSpendUsdtRef.current },
    buySignalCountedOpenTimes: serializeCounted(refs.robotBuySignalCountedOpenTimesRef.current),
    hadPositionEnd: Object.fromEntries(
      Object.entries(refs.robotBuyHadPositionEndRef.current).filter(([, v]) => v === true)
    ) as Record<string, true>,
  };
}

let lastPersistedJson: string | null = null;

export function persistRobotLiveBuyAccum(refs: RobotLiveBuyAccumRefBag, onAfterLocalPersist?: () => void): void {
  if (typeof window === "undefined") return;
  const validIds = validRobotIdSet();
  const full = buildRobotLiveBuyAccumSnapshot(refs);
  const pruned: PersistedV1 = {
    v: 1,
    flattenArmed: pruneByRobotKeys(full.flattenArmed, validIds),
    buyEdgesSinceFlat: pruneByRobotKeys(full.buyEdgesSinceFlat, validIds),
    accumulationActive: pruneByRobotKeys(full.accumulationActive, validIds),
    accumLastOt: pruneByRobotKeys(full.accumLastOt, validIds),
    accumCandleIndex: pruneByRobotKeys(full.accumCandleIndex, validIds),
    sequentialSliceUsdt: pruneByRobotKeys(full.sequentialSliceUsdt, validIds),
    accumFrozenMaxSpendUsdt: pruneByRobotKeys(full.accumFrozenMaxSpendUsdt ?? {}, validIds),
    buySignalCountedOpenTimes: pruneByRobotKeys(full.buySignalCountedOpenTimes, validIds),
    hadPositionEnd: pruneByRobotKeys(full.hadPositionEnd, validIds),
  };
  let json: string;
  try {
    json = JSON.stringify(pruned);
  } catch {
    return;
  }
  if (json === lastPersistedJson) return;
  lastPersistedJson = json;
  try {
    window.localStorage.setItem(ROBOT_LIVE_BUY_ACCUM_STORAGE_KEY, json);
  } catch {
    lastPersistedJson = null;
  }
  onAfterLocalPersist?.();
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

export function loadRobotLiveBuyAccumSnapshot(): PersistedV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ROBOT_LIVE_BUY_ACCUM_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!isRecord(p) || p.v !== 1) return null;
    return p as PersistedV1;
  } catch {
    return null;
  }
}

export function applyRobotLiveBuyAccumSnapshot(refs: RobotLiveBuyAccumRefBag, snap: PersistedV1 | null): void {
  if (!snap || snap.v !== 1) return;
  refs.robotFlattenArmedRef.current = { ...(snap.flattenArmed ?? {}) };
  refs.robotBuyEdgesSinceFlatRef.current = { ...(snap.buyEdgesSinceFlat ?? {}) };
  refs.robotBuyAccumulationActiveRef.current = { ...(snap.accumulationActive ?? {}) };
  refs.robotBuyAccumLastOtRef.current = { ...(snap.accumLastOt ?? {}) };
  refs.robotBuyAccumCandleIndexRef.current = { ...(snap.accumCandleIndex ?? {}) };
  refs.robotBuySequentialSliceUsdtRef.current = { ...(snap.sequentialSliceUsdt ?? {}) };
  refs.robotBuyAccumFrozenMaxSpendUsdtRef.current = { ...(snap.accumFrozenMaxSpendUsdt ?? {}) };
  const counted: Record<string, Set<string>> = {};
  const rawCounted = snap.buySignalCountedOpenTimes ?? {};
  for (const [k, arr] of Object.entries(rawCounted)) {
    if (!Array.isArray(arr)) continue;
    counted[k] = new Set(arr.filter((x): x is string => typeof x === "string"));
  }
  refs.robotBuySignalCountedOpenTimesRef.current = counted;
  refs.robotBuyHadPositionEndRef.current = { ...(snap.hadPositionEnd ?? {}) };
  try {
    lastPersistedJson = JSON.stringify(buildRobotLiveBuyAccumSnapshot(refs));
  } catch {
    lastPersistedJson = null;
  }
}
