/**
 * Compra/venda manual do robô live (teste): executa ordens à mercado sem gates de sinal/preço.
 */

import { API_BASE } from "@/app/constants";
import type { SavedRobot } from "./robotsStorage";
import {
  loadRobotBuyExecMap,
  persistRobotBuyExecMap,
  setRobotBuyExecForCandle,
} from "./robotsStorage";
import { getRobotLiveFormingOpenTime } from "./robotLiveFormingCandle";
import { mergeManualBuySignalIntoAccumStorage } from "./robotLiveBuyAccumStorage";
import { ROBOT_BUY_ACCUM_START_SIGNAL_MAX } from "./robotsStorage";
import { appendRobotLiveActivityEvent } from "./robotLiveSessionSync";
import {
  computeRobotMarketBuyQuoteUsdt,
  dispatchRobotPositionBuy,
  dispatchRobotPositionSellClear,
  dispatchSpotOrderPlaced,
  parseMarketOrderFill,
  submitRobotMarketBuyOrder,
  submitRobotMarketSellOrder,
} from "./robotLiveOrders";
import { getRobotPosition } from "./robotPositionStorage";

export const ROBOT_LIVE_MANUAL_ENGINE_EVENT = "robot-live-manual-engine";

/** Força o motor live no KlinesTable a reavaliar compras (refs sozinhos não re-disparam o useEffect). */
export const ROBOT_LIVE_MANUAL_TICK_EVENT = "robot-live-manual-tick";

export function dispatchRobotLiveManualTick(): void {
  try {
    window.dispatchEvent(new CustomEvent(ROBOT_LIVE_MANUAL_TICK_EVENT));
  } catch {
    /* ignore */
  }
}

export type RobotLiveManualEngineDetail =
  | { kind: "buy_signal"; robotId: string; symbol: string }
  | { kind: "position_closed"; robotId: string; symbol: string };

function dispatchManualEngine(detail: RobotLiveManualEngineDetail): void {
  try {
    window.dispatchEvent(new CustomEvent(ROBOT_LIVE_MANUAL_ENGINE_EVENT, { detail }));
  } catch {
    /* ignore */
  }
}

async function fetchSpotUsdtFree(): Promise<number | null> {
  const balRes = await fetch(`${API_BASE}/user/binance-connection/balances`, { credentials: "include" });
  const balJson = (await balRes.json().catch(() => ({}))) as {
    balances?: { asset: string; free: string }[];
  };
  if (!balRes.ok) return null;
  const list = Array.isArray(balJson.balances) ? balJson.balances : [];
  const usdtRow = list.find((b) => b.asset === "USDT");
  if (!usdtRow) return null;
  const n = parseFloat(usdtRow.free);
  return Number.isFinite(n) ? n : null;
}

async function isBinanceConnected(): Promise<boolean> {
  const connRes = await fetch(`${API_BASE}/user/binance-connection`, { credentials: "include" });
  const connJson = (await connRes.json().catch(() => ({}))) as { connected?: boolean };
  return connRes.ok && connJson.connected === true;
}

export type RobotManualActionResult =
  | { ok: true }
  | { ok: false; reason: "not_connected" | "no_usdt" | "no_quote" | "no_position" | "order_failed" };

/** Compra a mercado (como OPEN_BUY), ignorando gates de sinal e preço. */
export async function executeRobotManualMarketBuy(
  robot: SavedRobot,
  symbol: string
): Promise<RobotManualActionResult> {
  const sym = symbol.trim().toUpperCase();
  if (!sym.endsWith("USDT")) return { ok: false, reason: "order_failed" };

  if (!(await isBinanceConnected())) return { ok: false, reason: "not_connected" };

  const spotUsdtFree = await fetchSpotUsdtFree();
  if (spotUsdtFree == null || spotUsdtFree <= 0) return { ok: false, reason: "no_usdt" };

  const pos = getRobotPosition(robot.id, sym);
  const quoteUsdt = computeRobotMarketBuyQuoteUsdt(robot, spotUsdtFree, pos);
  if (quoteUsdt == null) return { ok: false, reason: "no_quote" };

  const out = await submitRobotMarketBuyOrder(sym, quoteUsdt, {
    robotId: robot.id,
    robotAlias: robot.alias ?? "",
    executionRole: "OPEN_BUY",
  });
  if (!out.ok) return { ok: false, reason: "order_failed" };

  const fill = parseMarketOrderFill(out.order);
  if (fill) {
    dispatchRobotPositionBuy(robot.id, sym, fill.quoteUsdt, fill.baseQty);
  }

  const ot = getRobotLiveFormingOpenTime(sym) ?? `manual-${Date.now()}`;
  const map = loadRobotBuyExecMap();
  persistRobotBuyExecMap(setRobotBuyExecForCandle(map, robot.id, sym, ot));

  appendRobotLiveActivityEvent(robot.id, sym, "manual_market_buy", {
    quoteUsdt,
    openTime: ot,
    manual: true,
    ...(fill ? { baseQty: fill.baseQty } : {}),
  });
  dispatchManualEngine({ kind: "buy_signal", robotId: robot.id, symbol: sym });
  dispatchRobotLiveManualTick();
  dispatchSpotOrderPlaced();
  return { ok: true };
}

/** Vende posição inteira (como SIGNAL_SELL), ignorando min edge e sinal. */
export async function executeRobotManualMarketSell(
  robot: SavedRobot,
  symbol: string
): Promise<RobotManualActionResult> {
  const sym = symbol.trim().toUpperCase();
  if (!sym.endsWith("USDT")) return { ok: false, reason: "order_failed" };

  const pos = getRobotPosition(robot.id, sym);
  if (!pos || pos.totalBaseQty <= 1e-12) return { ok: false, reason: "no_position" };

  if (!(await isBinanceConnected())) return { ok: false, reason: "not_connected" };

  const out = await submitRobotMarketSellOrder(sym, pos.totalBaseQty, {
    robotId: robot.id,
    robotAlias: robot.alias ?? "",
    executionRole: "SIGNAL_SELL",
  });
  if (!out.ok) return { ok: false, reason: "order_failed" };

  dispatchRobotPositionSellClear(robot.id, sym);
  dispatchManualEngine({ kind: "position_closed", robotId: robot.id, symbol: sym });
  appendRobotLiveActivityEvent(robot.id, sym, "manual_signal_sell", {
    baseQty: pos.totalBaseQty,
    manual: true,
  });
  dispatchSpotOrderPlaced();
  return { ok: true };
}

/** Liga janela de acumulação sem enviar ordem (simula N sinais satisfeitos). */
export function armRobotManualBuySignal(robot: SavedRobot, symbol: string): void {
  const sym = symbol.trim().toUpperCase();
  const nStart = Math.min(
    ROBOT_BUY_ACCUM_START_SIGNAL_MAX,
    Math.max(1, Math.floor(robot.buyAccumulationStartOnSignalNumber ?? 1))
  );
  const openTime = getRobotLiveFormingOpenTime(sym);
  mergeManualBuySignalIntoAccumStorage(robot.id, sym, { nStart, openTime });
  dispatchManualEngine({ kind: "buy_signal", robotId: robot.id, symbol: sym });
  dispatchRobotLiveManualTick();
  appendRobotLiveActivityEvent(robot.id, sym, "manual_buy_signal", {
    manual: true,
    signalsCounted: nStart,
    openTime,
  });
}
