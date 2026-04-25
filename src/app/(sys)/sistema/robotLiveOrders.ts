/** Ordens à mercado para robô ativo — POST direto à API (sem boleta/modal). */

import { API_BASE } from "@/app/constants";
import type { SavedRobot } from "./robotsStorage";
import type { RobotOpenPosition } from "./robotPositionStorage";
import { ROBOT_POSITION_BUY_EVENT, ROBOT_POSITION_SELL_CLEAR_EVENT } from "./robotPositionStorage";

/** Papel da execução — gravado em `RobotSpotPerformanceEvent` (relatório vs backtest). */
export type RobotOrderExecutionRole = "OPEN_BUY" | "FLATTEN" | "SIGNAL_SELL" | "STOP_LOSS" | "STOP_GAIN";

export type RobotOrderContext = {
  robotId: string;
  /** Snapshot para histórico (pode ser vazio). */
  robotAlias: string;
  executionRole: RobotOrderExecutionRole;
};

type OrderSyncResponse = {
  success?: boolean;
  order?: unknown;
};

/**
 * Valor nominal de uma operação (USDT) em função do teto atual do robô: % do teto ou USDT fixo (até ao teto).
 * Na sequência de acumulação, este valor é calculado uma vez por ciclo e reutilizado em cada vela.
 */
export function computeNominalBuyOperationUsdt(robot: SavedRobot, maxSpendUsdt: number): number {
  if (!Number.isFinite(maxSpendUsdt) || maxSpendUsdt <= 0) return 0;
  if (robot.buyOperationMode === "fixed") {
    return Math.min(Math.max(0, robot.buyOperationFixedUsdt), maxSpendUsdt);
  }
  return (maxSpendUsdt * Math.min(robot.buyOperationPercent, robot.maxSpotPercent)) / 100;
}

/**
 * @param sequentialSliceUsdt — quando definido (compras em sequência), cada vela usa `min(fatia, livre, espaço até ao teto)` em vez de recalcular % sobre o saldo livre atual.
 */
export function computeRobotMarketBuyQuoteUsdt(
  robot: SavedRobot,
  spotUsdtFree: number,
  position: RobotOpenPosition | null,
  sequentialSliceUsdt?: number | null,
  frozenMaxSpendUsdt?: number | null
): number | null {
  /** Teto padrão = % do USDT livre atual (Binance). Na acumulação sequencial podemos congelar no início da janela. */
  if (!Number.isFinite(spotUsdtFree) || spotUsdtFree < 0) return null;
  const dynamicMaxSpendUsdt = (spotUsdtFree * robot.maxSpotPercent) / 100;
  const maxSpendUsdt =
    frozenMaxSpendUsdt != null && Number.isFinite(frozenMaxSpendUsdt) && frozenMaxSpendUsdt > 0
      ? frozenMaxSpendUsdt
      : dynamicMaxSpendUsdt;
  const quoteInPosition = position?.totalQuoteSpent ?? 0;
  const roomBelowRobotMax = Math.max(0, maxSpendUsdt - quoteInPosition);
  let opUsdt: number;
  if (
    sequentialSliceUsdt != null &&
    Number.isFinite(sequentialSliceUsdt) &&
    sequentialSliceUsdt > 0
  ) {
    opUsdt = Math.min(sequentialSliceUsdt, spotUsdtFree, roomBelowRobotMax);
  } else {
    opUsdt = computeNominalBuyOperationUsdt(robot, maxSpendUsdt);
    opUsdt = Math.min(opUsdt, spotUsdtFree, roomBelowRobotMax);
  }
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

function formatLimitPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) throw new Error("invalid_price");
  const s = n.toFixed(8).replace(/\.?0+$/, "").replace(/\.$/, "");
  if (s.length === 0) throw new Error("invalid_price");
  return s;
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

export type RobotLimitOrderState = "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED" | "EXPIRED" | "UNKNOWN";

export function parseSpotOrderState(order: unknown): RobotLimitOrderState {
  if (order == null || typeof order !== "object") return "UNKNOWN";
  const o = order as Record<string, unknown>;
  const raw = String(o.status ?? "").toUpperCase();
  if (raw === "NEW" || raw === "PARTIALLY_FILLED" || raw === "FILLED" || raw === "CANCELED" || raw === "REJECTED" || raw === "EXPIRED") {
    return raw;
  }
  return "UNKNOWN";
}

function parseOrderId(order: unknown): string | null {
  if (order == null || typeof order !== "object") return null;
  const o = order as Record<string, unknown>;
  const id = o.orderId;
  if (typeof id === "string" && id.trim().length > 0) return id.trim();
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}

export async function submitRobotMarketBuyOrder(
  symbol: string,
  quoteUsdt: number,
  ctx?: RobotOrderContext
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
      ...(ctx
        ? {
            robotId: ctx.robotId,
            robotAlias: ctx.robotAlias,
            executionRole: ctx.executionRole,
          }
        : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; order?: unknown };
  if (!res.ok || data.success !== true || data.order == null) return { ok: false };
  return { ok: true, order: data.order };
}

export async function submitRobotLimitBuyOrder(
  symbol: string,
  quoteUsdt: number,
  limitPrice: number,
  ctx?: RobotOrderContext
): Promise<{ ok: true; order: unknown; orderId: string } | { ok: false }> {
  let pxStr: string;
  let qtyStr: string;
  try {
    pxStr = formatLimitPrice(limitPrice);
    qtyStr = formatQtyForMarketOrder(quoteUsdt / limitPrice);
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
      type: "LIMIT",
      timeInForce: "GTC",
      quantity: qtyStr,
      price: pxStr,
      ...(ctx
        ? {
            robotId: ctx.robotId,
            robotAlias: ctx.robotAlias,
            executionRole: ctx.executionRole,
          }
        : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; order?: unknown };
  if (!res.ok || data.success !== true || data.order == null) return { ok: false };
  const orderId = parseOrderId(data.order);
  if (!orderId) return { ok: false };
  return { ok: true, order: data.order, orderId };
}

export async function submitRobotMarketSellOrder(
  symbol: string,
  baseQty: number,
  ctx?: RobotOrderContext
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
      ...(ctx
        ? {
            robotId: ctx.robotId,
            robotAlias: ctx.robotAlias,
            executionRole: ctx.executionRole,
          }
        : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; order?: unknown };
  if (!res.ok || data.success !== true || data.order == null) return { ok: false };
  return { ok: true, order: data.order };
}

export async function syncRobotSpotOrder(
  symbol: string,
  orderId: string
): Promise<{ ok: true; order: unknown; state: RobotLimitOrderState } | { ok: false }> {
  const res = await fetch(`${API_BASE}/user/binance-connection/order/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      symbol: symbol.trim().toUpperCase(),
      orderId: orderId.trim(),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as OrderSyncResponse;
  if (!res.ok || data.success !== true || data.order == null) return { ok: false };
  return { ok: true, order: data.order, state: parseSpotOrderState(data.order) };
}

export async function cancelRobotSpotOrder(
  symbol: string,
  orderId: string
): Promise<{ ok: true; order: unknown } | { ok: false }> {
  const res = await fetch(`${API_BASE}/user/binance-connection/order/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      symbol: symbol.trim().toUpperCase(),
      orderId: orderId.trim(),
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
