/** Ordens à mercado para robô ativo — POST direto à API (sem boleta/modal). */

import { API_BASE } from "@/app/constants";
import type { SavedRobot } from "./robotsStorage";
import type { RobotOpenPosition } from "./robotPositionStorage";
import { ROBOT_POSITION_BUY_EVENT, ROBOT_POSITION_SELL_CLEAR_EVENT } from "./robotPositionStorage";

export function computeRobotMarketBuyQuoteUsdt(
  robot: SavedRobot,
  spotUsdtFree: number,
  position: RobotOpenPosition | null
): number | null {
  const spotRef = robot.referenceSpotUsdtFree;
  if (spotRef == null || !Number.isFinite(spotRef) || spotRef < 0) return null;
  const maxSpendUsdt = (spotRef * robot.maxSpotPercent) / 100;
  const quoteInPosition = position?.totalQuoteSpent ?? 0;
  const roomBelowRobotMax = Math.max(0, maxSpendUsdt - quoteInPosition);
  let opUsdt =
    robot.buyOperationMode === "fixed"
      ? Math.min(robot.buyOperationFixedUsdt, maxSpendUsdt)
      : (maxSpendUsdt * Math.min(robot.buyOperationPercent, robot.maxSpotPercent)) / 100;
  opUsdt = Math.min(opUsdt, spotUsdtFree, roomBelowRobotMax);
  if (opUsdt <= 1e-8) return null;
  return opUsdt;
}

function formatQuoteOrderQty(usdt: number): string {
  const s = usdt.toFixed(8).replace(/\.?0+$/, "").replace(/\.$/, "");
  if (s.length === 0) throw new Error("invalid_quote");
  return s;
}

function formatQtyForMarketOrder(n: number): string {
  if (!Number.isFinite(n) || n <= 0) throw new Error("invalid_quantity");
  const s = n.toFixed(8).replace(/\.?0+$/, "").replace(/\.$/, "");
  return s.length > 0 ? s : "0";
}

export function parseMarketOrderFill(order: unknown): { quoteUsdt: number; baseQty: number } | null {
  if (order == null || typeof order !== "object") return null;
  const o = order as Record<string, unknown>;
  const exec = o.executedQty;
  const cum = o.cummulativeQuoteQty;
  const baseQty = typeof exec === "string" ? parseFloat(exec) : typeof exec === "number" ? exec : NaN;
  const quoteUsdt = typeof cum === "string" ? parseFloat(cum) : typeof cum === "number" ? cum : NaN;
  if (!Number.isFinite(baseQty) || !Number.isFinite(quoteUsdt) || baseQty <= 0 || quoteUsdt <= 0) return null;
  return { quoteUsdt, baseQty };
}

export async function submitRobotMarketBuyOrder(
  symbol: string,
  quoteUsdt: number
): Promise<{ ok: true; order: unknown } | { ok: false }> {
  let qStr: string;
  try {
    qStr = formatQuoteOrderQty(quoteUsdt);
  } catch {
    return { ok: false };
  }
  const res = await fetch(`${API_BASE}/user/binance-connection/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      symbol: symbol.trim().toUpperCase(),
      side: "BUY",
      type: "MARKET",
      quoteOrderQty: qStr,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; order?: unknown };
  if (!res.ok || data.success !== true || data.order == null) return { ok: false };
  return { ok: true, order: data.order };
}

export async function submitRobotMarketSellOrder(
  symbol: string,
  baseQty: number
): Promise<{ ok: true; order: unknown } | { ok: false }> {
  let qtyStr: string;
  try {
    qtyStr = formatQtyForMarketOrder(baseQty);
  } catch {
    return { ok: false };
  }
  const res = await fetch(`${API_BASE}/user/binance-connection/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      symbol: symbol.trim().toUpperCase(),
      side: "SELL",
      type: "MARKET",
      quantity: qtyStr,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; order?: unknown };
  if (!res.ok || data.success !== true || data.order == null) return { ok: false };
  return { ok: true, order: data.order };
}

export function dispatchRobotPositionBuy(robotId: string, symbol: string, quoteUsdt: number, baseQty: number): void {
  try {
    window.dispatchEvent(
      new CustomEvent(ROBOT_POSITION_BUY_EVENT, {
        detail: { robotId, symbol: symbol.trim().toUpperCase(), quoteUsdt, baseQty },
      })
    );
  } catch {
    /* ignore */
  }
}

export function dispatchRobotPositionSellClear(robotId: string, symbol: string): void {
  try {
    window.dispatchEvent(
      new CustomEvent(ROBOT_POSITION_SELL_CLEAR_EVENT, {
        detail: { robotId, symbol: symbol.trim().toUpperCase() },
      })
    );
  } catch {
    /* ignore */
  }
}

export function dispatchSpotOrderPlaced(): void {
  try {
    window.dispatchEvent(new CustomEvent("backcrypto-spot-order-placed"));
  } catch {
    /* ignore */
  }
}
