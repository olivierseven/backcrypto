/** Persistência de robôs (Meus robôs) — partilhado entre RobotsPanel e KlinesTable. */

import { API_BASE } from "@/app/constants";
import { KLINE_LAST_LAYOUT_KEY } from "./KlinesChartConstants";
import { getSessionTabId } from "./sessionTabId";

export const ROBOTS_STORAGE_KEY = "crypto_sistema_robots_v1";

/** Marca execução de compra por robô e openTime do candle (evita mais de uma compra no mesmo candle). */
export const ROBOT_BUY_EXEC_STORAGE_KEY = "crypto_sistema_robot_buy_exec_v1";

export const ROBOTS_CHANGED_EVENT = "crypto-sistema-robots-changed";

/** Mesmo separador que `storage` para o mapa B· quando o layout aplica robôs vindos da API. */
export const ROBOT_BUY_EXEC_CHANGED_EVENT = "crypto-sistema-robot-buy-exec-changed";

/** Corpo da coluna `robots` em `ChartLayout` (slots 1–7). */
export type ChartLayoutRobotsColumn = {
  savedRobots: SavedRobot[];
  buyExecMap: RobotBuyExecMap;
};

/** Percentual máximo do spot (1–100, passo 1%). */
export const ROBOT_MAX_SPOT_MIN = 1;
export const ROBOT_MAX_SPOT_MAX = 100;

/** Stop loss em % vs preço médio de compra: 0,1% a 5%, passo 0,1%. */
export const ROBOT_STOP_LOSS_PCT_MIN = 0.1;
export const ROBOT_STOP_LOSS_PCT_MAX = 5;

/** Quantos ‘sinais’ antes de ligar a acumulação: uma vez por vela sem posição em que o sinal de compra é verdadeiro (1–5). */
export const ROBOT_BUY_ACCUM_START_SIGNAL_MIN = 1;
export const ROBOT_BUY_ACCUM_START_SIGNAL_MAX = 5;

/** Janela de acumulação: mínimo, máximo e valor por omissão (configurável por robô). */
export const ROBOT_BUY_ACCUM_MAX_CANDLES_MIN = 1;
export const ROBOT_BUY_ACCUM_MAX_CANDLES_MAX = 20;
export const ROBOT_BUY_ACCUM_MAX_CANDLES_DEFAULT = 7;

/** Breakeven (zerar): desvio % vs médio de compra — mínimo, máximo e passo (UI). */
export const ROBOT_FLATTEN_BREAKEVEN_BUFFER_PCT_MIN = -1;
export const ROBOT_FLATTEN_BREAKEVEN_BUFFER_PCT_MAX = 1;

export type RobotSide = "buyer" | "seller";

export type RobotBuyOperationMode = "percent" | "fixed";

/** Stop loss: venda a mercado quando a perda não realizada atinge o limite (só se `stopLossEnabled`). */
export type RobotStopLossMode = "percent" | "fixed";

export interface SavedRobot {
  id: string;
  /** Nome amigável opcional (lista e backtest). */
  alias: string;
  side: RobotSide;
  buyCombinedStrategyIds: string[];
  sellCombinedStrategyIds: string[];
  /**
   * Opcional: “zerar” — comprador: o primeiro sinal com posição arma alerta até fechar (velas com sinal falso não desarmam);
   * a primeira vela com fecho ≤ limiar de breakeven (médio com buffer %) dispara venda a mercado. A venda por sinal normal continua independente do alerta.
   * Robô vendedor: reservado (live).
   */
  flattenCombinedStrategyIds: string[];
  /**
   * Comprador: enquanto o alerta de zerar estiver armado (mesmo sinal que o breakeven), venda a mercado quando
   * alguma destas estratégias combinadas for verdadeira na vela (em alternativa à venda automática por preço).
   */
  postFlattenSignalSellCombinedStrategyIds: string[];
  /**
   * Vendedor: enquanto o alerta de “zerar” estiver armado, compra a mercado quando alguma destas estratégias for
   * verdadeira (espelho da venda pós-sinal do comprador; live do vendedor ainda não ligado).
   */
  postFlattenSignalBuyCombinedStrategyIds: string[];
  /**
   * Comprador, venda “zerar” (breakeven): desvio % vs preço médio de compra (-1 … +1).
   * 0 = fecho ≤ médio; +0,2 ⇒ permite saída com fecho até ~0,2% acima do médio; −0,2 exige fecho mais abaixo.
   */
  flattenBreakevenBufferPercent: number;
  createdAt: number;
  /** Se as estratégias deste robô estão aplicadas na tabela (só muda em Meus robôs). */
  isActive: boolean;
  /** Percentual máximo do spot (1–100). */
  maxSpotPercent: number;
  /** Modo da quantidade por operação: % do teto ou USDT fixo (≤ teto). Na acumulação, a 1.ª compra define a fatia em USDT; as seguintes repetem até ao máximo do robô. */
  buyOperationMode: RobotBuyOperationMode;
  /** Se mode === "percent": % do teto (0..maxSpotPercent); na sequência usa-se sempre essa fatia em USDT calculada na 1.ª operação. */
  buyOperationPercent: number;
  /** Se mode === "fixed": USDT por operação (≥ 0, ≤ teto); na sequência repete-se o mesmo montante até ao máximo. */
  buyOperationFixedUsdt: number;
  /**
   * Comprador: após a N-ésima vela sem posição em que o sinal de compra é verdadeiro, o robô compra até ao teto,
   * no máximo uma compra por vela; se numa vela o preço não permitir compra (≤ última compra), para a sequência.
   */
  buyAccumulationStartOnSignalNumber: number;
  /**
   * Comprador: após ligar a acumulação, no máximo este número de velas consecutivas com até uma tentativa
   * de compra por vela (o sinal pode ficar falso). Entre ROBOT_BUY_ACCUM_MAX_CANDLES_MIN e MAX.
   */
  buyAccumMaxCandles: number;
  /** Ativa venda a mercado quando a perda ≥ limite (robô comprador). */
  stopLossEnabled: boolean;
  /** `percent`: perda vs preço médio de compra (%). `fixed`: perda em USDT (valor absoluto). */
  stopLossMode: RobotStopLossMode;
  /** Limite em % vs média de compra (0,1 a 5, passo 0,1). */
  stopLossPercent: number;
  /** Limite em USDT de perda não realizada (custo − valor atual). */
  stopLossFixedUsdt: number;
  /** Ativa venda a mercado quando o ganho não realizado ≥ limite (robô comprador). */
  stopGainEnabled: boolean;
  /** `percent`: ganho vs preço médio de compra (%). `fixed`: ganho em USDT (valor absoluto). */
  stopGainMode: RobotStopLossMode;
  /** Limite em % vs média de compra (0,1 a 5, passo 0,1). */
  stopGainPercent: number;
  /** Limite em USDT de ganho não realizado (valor atual − custo). */
  stopGainFixedUsdt: number;
  /**
   * Legado: já não usado para o teto (teto = % do USDT livre em tempo real). Mantido para compat. JSON; pode ser null.
   */
  referenceSpotUsdtFree: number | null;
}

/** robotId → openTime (string) → 1 */
export type RobotBuyExecMap = Record<string, Record<string, 1>>;

/** Ids de estratégias combinadas referenciadas pelo robô (compra, venda, flatten, pós-flatten). */
export function collectRobotReferencedCombinedIds(robot: SavedRobot): string[] {
  return [
    ...robot.buyCombinedStrategyIds,
    ...robot.sellCombinedStrategyIds,
    ...robot.flattenCombinedStrategyIds,
    ...robot.postFlattenSignalSellCombinedStrategyIds,
    ...robot.postFlattenSignalBuyCombinedStrategyIds,
  ];
}

/** true se todas as estratégias referenciadas existem em `applied` (robô pode receber sinais). */
export function activeRobotHasAllReferencedStrategiesApplied(
  robot: SavedRobot,
  applied: ReadonlySet<string>
): boolean {
  for (const id of collectRobotReferencedCombinedIds(robot)) {
    if (!applied.has(id)) return false;
  }
  return true;
}

/**
 * Robôs com `isActive` deixam de estar ativos se falta alguma estratégia combinada aplicada.
 * Persiste e dispara `ROBOTS_CHANGED_EVENT` quando altera.
 */
export function deactivateRobotsIfMissingAppliedStrategies(appliedIds: readonly string[]): void {
  if (typeof window === "undefined") return;
  const applied = new Set(appliedIds);
  const list = loadSavedRobots();
  let changed = false;
  const next = list.map((r) => {
    if (!r.isActive) return r;
    if (activeRobotHasAllReferencedStrategiesApplied(r, applied)) return r;
    changed = true;
    return { ...r, isActive: false, referenceSpotUsdtFree: null };
  });
  if (changed) persistSavedRobots(next);
}

export function normalizeRobot(raw: unknown): SavedRobot | null {
  if (raw == null || typeof raw !== "object") return null;
  const x = raw as Record<string, unknown>;
  if (typeof x.id !== "string") return null;
  if (x.side !== "buyer" && x.side !== "seller") return null;
  const legacyCombinedRaw = x.combinedStrategyIds;
  const buyCombinedRaw = x.buyCombinedStrategyIds;
  const sellCombinedRaw = x.sellCombinedStrategyIds;
  if (!Array.isArray(legacyCombinedRaw) && !Array.isArray(buyCombinedRaw)) return null;
  if (typeof x.createdAt !== "number") return null;
  const buyIdsSource = Array.isArray(buyCombinedRaw) ? buyCombinedRaw : (legacyCombinedRaw as unknown[]);
  const buyIds = buyIdsSource.filter((id): id is string => typeof id === "string");
  const sellIds = Array.isArray(sellCombinedRaw)
    ? sellCombinedRaw.filter((id): id is string => typeof id === "string")
    : [];
  const flattenCombinedRaw = x.flattenCombinedStrategyIds;
  const flattenIds = Array.isArray(flattenCombinedRaw)
    ? flattenCombinedRaw.filter((id): id is string => typeof id === "string")
    : [];
  const postSellRaw = x.postFlattenSignalSellCombinedStrategyIds;
  const postSellIds = Array.isArray(postSellRaw)
    ? postSellRaw.filter((id): id is string => typeof id === "string")
    : [];
  const postBuyRaw = x.postFlattenSignalBuyCombinedStrategyIds;
  const postBuyIds = Array.isArray(postBuyRaw)
    ? postBuyRaw.filter((id): id is string => typeof id === "string")
    : [];
  const isActive = typeof x.isActive === "boolean" ? x.isActive : false;
  const maxSpotPercent =
    typeof x.maxSpotPercent === "number" && Number.isFinite(x.maxSpotPercent)
      ? Math.min(ROBOT_MAX_SPOT_MAX, Math.max(ROBOT_MAX_SPOT_MIN, Math.round(x.maxSpotPercent)))
      : ROBOT_MAX_SPOT_MAX;
  const buyRaw =
    typeof x.buyOperationPercent === "number" && Number.isFinite(x.buyOperationPercent)
      ? Math.round(x.buyOperationPercent)
      : 0;
  const buyOperationPercent = Math.min(Math.max(0, buyRaw), maxSpotPercent);
  const buyOperationMode: RobotBuyOperationMode = x.buyOperationMode === "fixed" ? "fixed" : "percent";
  const fixedRaw =
    typeof x.buyOperationFixedUsdt === "number" && Number.isFinite(x.buyOperationFixedUsdt)
      ? x.buyOperationFixedUsdt
      : 0;
  const buyOperationFixedUsdt = Math.max(0, fixedRaw);
  const startSigRaw =
    typeof x.buyAccumulationStartOnSignalNumber === "number" && Number.isFinite(x.buyAccumulationStartOnSignalNumber)
      ? Math.floor(x.buyAccumulationStartOnSignalNumber)
      : 1;
  const buyAccumulationStartOnSignalNumber = Math.min(
    ROBOT_BUY_ACCUM_START_SIGNAL_MAX,
    Math.max(ROBOT_BUY_ACCUM_START_SIGNAL_MIN, startSigRaw)
  );
  const maxCandlesRaw =
    typeof x.buyAccumMaxCandles === "number" && Number.isFinite(x.buyAccumMaxCandles)
      ? Math.floor(x.buyAccumMaxCandles)
      : ROBOT_BUY_ACCUM_MAX_CANDLES_DEFAULT;
  const buyAccumMaxCandles = Math.min(
    ROBOT_BUY_ACCUM_MAX_CANDLES_MAX,
    Math.max(ROBOT_BUY_ACCUM_MAX_CANDLES_MIN, maxCandlesRaw)
  );
  const stopLossEnabled = typeof x.stopLossEnabled === "boolean" ? x.stopLossEnabled : false;
  const stopLossMode: RobotStopLossMode = x.stopLossMode === "fixed" ? "fixed" : "percent";
  const slPctRaw =
    typeof x.stopLossPercent === "number" && Number.isFinite(x.stopLossPercent) ? x.stopLossPercent : 2;
  const stopLossPercent = Math.min(
    ROBOT_STOP_LOSS_PCT_MAX,
    Math.max(ROBOT_STOP_LOSS_PCT_MIN, Math.round(slPctRaw * 10) / 10)
  );
  const slFixRaw =
    typeof x.stopLossFixedUsdt === "number" && Number.isFinite(x.stopLossFixedUsdt) ? x.stopLossFixedUsdt : 25;
  const stopLossFixedUsdt = Math.max(0, slFixRaw);
  const stopGainEnabled = typeof x.stopGainEnabled === "boolean" ? x.stopGainEnabled : false;
  const stopGainMode: RobotStopLossMode = x.stopGainMode === "fixed" ? "fixed" : "percent";
  const sgPctRaw =
    typeof x.stopGainPercent === "number" && Number.isFinite(x.stopGainPercent) ? x.stopGainPercent : 2;
  const stopGainPercent = Math.min(
    ROBOT_STOP_LOSS_PCT_MAX,
    Math.max(ROBOT_STOP_LOSS_PCT_MIN, Math.round(sgPctRaw * 10) / 10)
  );
  const sgFixRaw =
    typeof x.stopGainFixedUsdt === "number" && Number.isFinite(x.stopGainFixedUsdt) ? x.stopGainFixedUsdt : 25;
  const stopGainFixedUsdt = Math.max(0, sgFixRaw);
  const refRaw = x.referenceSpotUsdtFree;
  const referenceSpotUsdtFree =
    typeof refRaw === "number" && Number.isFinite(refRaw) && refRaw >= 0 ? refRaw : null;
  const bufRaw =
    typeof x.flattenBreakevenBufferPercent === "number" && Number.isFinite(x.flattenBreakevenBufferPercent)
      ? x.flattenBreakevenBufferPercent
      : 0;
  const flattenBreakevenBufferPercent = Math.min(
    ROBOT_FLATTEN_BREAKEVEN_BUFFER_PCT_MAX,
    Math.max(
      ROBOT_FLATTEN_BREAKEVEN_BUFFER_PCT_MIN,
      Math.round(bufRaw * 10) / 10
    )
  );
  const aliasRaw = x.alias;
  const alias =
    typeof aliasRaw === "string" ? aliasRaw.trim().slice(0, 80) : "";
  return {
    id: x.id,
    alias,
    side: x.side,
    buyCombinedStrategyIds: [...new Set(buyIds)],
    sellCombinedStrategyIds: [...new Set(sellIds)],
    flattenCombinedStrategyIds: [...new Set(flattenIds)],
    postFlattenSignalSellCombinedStrategyIds: [...new Set(postSellIds)],
    postFlattenSignalBuyCombinedStrategyIds: [...new Set(postBuyIds)],
    flattenBreakevenBufferPercent,
    createdAt: x.createdAt,
    isActive,
    maxSpotPercent,
    buyOperationMode,
    buyOperationPercent,
    buyOperationFixedUsdt,
    buyAccumulationStartOnSignalNumber,
    buyAccumMaxCandles,
    stopLossEnabled,
    stopLossMode,
    stopLossPercent,
    stopLossFixedUsdt,
    stopGainEnabled,
    stopGainMode,
    stopGainPercent,
    stopGainFixedUsdt,
    referenceSpotUsdtFree: isActive ? referenceSpotUsdtFree : null,
  };
}

export function loadSavedRobots(): SavedRobot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ROBOTS_STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.map(normalizeRobot).filter((x): x is SavedRobot => x != null);
  } catch {
    return [];
  }
}

export function getRobotsColumnPayloadForChartLayout(): ChartLayoutRobotsColumn {
  return { savedRobots: loadSavedRobots(), buyExecMap: loadRobotBuyExecMap() };
}

let syncRobotsLayoutTimer: ReturnType<typeof setTimeout> | null = null;

/** Envia lista + buyExec para o layout atual (slot 1–7) na coluna `robots`. */
export function scheduleSyncRobotsColumnToChartLayoutApi(): void {
  if (typeof window === "undefined") return;
  if (syncRobotsLayoutTimer != null) clearTimeout(syncRobotsLayoutTimer);
  syncRobotsLayoutTimer = setTimeout(() => {
    syncRobotsLayoutTimer = null;
    void syncRobotsColumnToChartLayoutApi();
  }, 400);
}

export async function syncRobotsColumnToChartLayoutApi(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY);
    if (!raw || raw === "default") return;
    const slot = Number(raw);
    if (!Number.isInteger(slot) || slot < 1 || slot > 7) return;
    const robots = getRobotsColumnPayloadForChartLayout();
    const str = JSON.stringify(robots);
    if (str.length > 28 * 1024) return;
    await fetch(`${API_BASE}/chart-layouts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Tab-Id": getSessionTabId() },
      credentials: "include",
      body: JSON.stringify({ slot, robots }),
    });
  } catch {
    /* ignore */
  }
}

/** Aplica `savedRobots` / `robotBuyExecMap` vindos do config fundido do GET chart-layouts (sem PATCH). */
export function applyRobotsFromMergedLayoutConfig(config: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (!("savedRobots" in config) && !("robotBuyExecMap" in config)) return;
  try {
    const rawList = config.savedRobots;
    const list: SavedRobot[] = Array.isArray(rawList)
      ? rawList.map((x) => normalizeRobot(x)).filter((x): x is SavedRobot => x != null)
      : [];
    const rawExec = config.robotBuyExecMap;
    const buyExecMap: RobotBuyExecMap =
      rawExec != null && typeof rawExec === "object" && !Array.isArray(rawExec) ? (rawExec as RobotBuyExecMap) : {};
    window.localStorage.setItem(ROBOTS_STORAGE_KEY, JSON.stringify(list));
    window.localStorage.setItem(ROBOT_BUY_EXEC_STORAGE_KEY, JSON.stringify(buyExecMap));
    window.dispatchEvent(new CustomEvent(ROBOTS_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent(ROBOT_BUY_EXEC_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

export function persistSavedRobots(list: SavedRobot[], opts?: { skipChartLayoutSync?: boolean }) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROBOTS_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(ROBOTS_CHANGED_EVENT));
    if (!opts?.skipChartLayoutSync) scheduleSyncRobotsColumnToChartLayoutApi();
  } catch {
    /* ignore */
  }
}

export function loadRobotBuyExecMap(): RobotBuyExecMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ROBOT_BUY_EXEC_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (p == null || typeof p !== "object") return {};
    return p as RobotBuyExecMap;
  } catch {
    return {};
  }
}

export function persistRobotBuyExecMap(map: RobotBuyExecMap, opts?: { skipChartLayoutSync?: boolean }) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROBOT_BUY_EXEC_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(ROBOT_BUY_EXEC_CHANGED_EVENT));
    if (!opts?.skipChartLayoutSync) scheduleSyncRobotsColumnToChartLayoutApi();
  } catch {
    /* ignore */
  }
}
