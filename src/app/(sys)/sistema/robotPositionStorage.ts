/** Posição agregada por robô + par (preço médio de compras até venda). */

export const ROBOT_POSITION_STORAGE_KEY = "crypto_sistema_robot_position_v1";

export const ROBOT_POSITION_BUY_EVENT = "backcrypto-robot-position-buy";
export const ROBOT_POSITION_SELL_CLEAR_EVENT = "backcrypto-robot-position-sell-clear";

export type RobotPositionBuyDetail = {
  robotId: string;
  symbol: string;
  /** USDT gastos na compra */
  quoteUsdt: number;
  /** Quantidade em base recebida */
  baseQty: number;
};

export type RobotPositionSellClearDetail = {
  robotId: string;
  symbol: string;
};

export interface RobotOpenPosition {
  totalQuoteSpent: number;
  totalBaseQty: number;
  avgBuyPrice: number;
  /** Preço efetivo da compra mais recente (USDT/base). Próxima compra só se o preço ref. for ≤ a este (regra fixa). */
  lastBuyFillPrice?: number;
}

function positionKey(robotId: string, symbol: string): string {
  return `${robotId}::${symbol.trim().toUpperCase()}`;
}

export type RobotPositionMap = Record<string, RobotOpenPosition>;

export function loadRobotPositionMap(): RobotPositionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ROBOT_POSITION_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (p == null || typeof p !== "object") return {};
    return p as RobotPositionMap;
  } catch {
    return {};
  }
}

function persistRobotPositionMap(map: RobotPositionMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROBOT_POSITION_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Acumula compra a mercado (preço médio ponderado). */
export function applyRobotMarketBuy(robotId: string, symbol: string, quoteUsdt: number, baseQty: number): void {
  if (!Number.isFinite(quoteUsdt) || !Number.isFinite(baseQty) || quoteUsdt <= 0 || baseQty <= 0) return;
  const key = positionKey(robotId, symbol);
  const map = loadRobotPositionMap();
  const prev = map[key];
  const totalQuote = (prev?.totalQuoteSpent ?? 0) + quoteUsdt;
  const totalBase = (prev?.totalBaseQty ?? 0) + baseQty;
  if (totalBase <= 0) return;
  const avgBuyPrice = totalQuote / totalBase;
  const fillPx = quoteUsdt / baseQty;
  map[key] = {
    totalQuoteSpent: totalQuote,
    totalBaseQty: totalBase,
    avgBuyPrice,
    lastBuyFillPrice: Number.isFinite(fillPx) && fillPx > 0 ? fillPx : undefined,
  };
  persistRobotPositionMap(map);
}

export function clearRobotPosition(robotId: string, symbol: string): void {
  const key = positionKey(robotId, symbol);
  const map = loadRobotPositionMap();
  if (!map[key]) return;
  delete map[key];
  persistRobotPositionMap(map);
}

export function getRobotPosition(robotId: string, symbol: string): RobotOpenPosition | null {
  const key = positionKey(robotId, symbol);
  return loadRobotPositionMap()[key] ?? null;
}

function onBuyEvent(e: Event) {
  const d = (e as CustomEvent<RobotPositionBuyDetail>).detail;
  if (!d?.robotId || !d.symbol) return;
  applyRobotMarketBuy(d.robotId, d.symbol, d.quoteUsdt, d.baseQty);
}

function onSellClearEvent(e: Event) {
  const d = (e as CustomEvent<RobotPositionSellClearDetail>).detail;
  if (!d?.robotId || !d.symbol) return;
  clearRobotPosition(d.robotId, d.symbol);
}

if (typeof window !== "undefined") {
  window.addEventListener(ROBOT_POSITION_BUY_EVENT, onBuyEvent);
  window.addEventListener(ROBOT_POSITION_SELL_CLEAR_EVENT, onSellClearEvent);
}
