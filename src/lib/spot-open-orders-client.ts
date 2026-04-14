/** Resposta de GET /user/binance-connection/spot-open-orders */

export type SpotOpenLimitOrderRow = { orderId: string; price: number };

function parsePriceList(raw: unknown): number[] {
  return Array.isArray(raw)
    ? raw
        .map((p) => (typeof p === "number" ? p : typeof p === "string" ? parseFloat(p) : NaN))
        .filter((p): p is number => Number.isFinite(p) && p > 0)
    : [];
}

function parseOrderRows(raw: unknown): SpotOpenLimitOrderRow[] {
  const orders: SpotOpenLimitOrderRow[] = [];
  if (!Array.isArray(raw)) return orders;
  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as { orderId?: unknown; price?: unknown };
    const oid = r.orderId != null ? String(r.orderId) : "";
    const px = typeof r.price === "number" ? r.price : parseFloat(String(r.price ?? ""));
    if (oid && Number.isFinite(px) && px > 0) orders.push({ orderId: oid, price: px });
  }
  return orders;
}

/** `prices`/`orders` = limite compra; `sellPrices`/`sellOrders` = limite venda. */
export function parseSpotOpenOrdersJson(data: unknown): {
  prices: number[];
  orders: SpotOpenLimitOrderRow[];
  sellPrices: number[];
  sellOrders: SpotOpenLimitOrderRow[];
} {
  const o = data as { prices?: unknown; orders?: unknown; sellPrices?: unknown; sellOrders?: unknown };
  return {
    prices: parsePriceList(o.prices),
    orders: parseOrderRows(o.orders),
    sellPrices: parsePriceList(o.sellPrices),
    sellOrders: parseOrderRows(o.sellOrders),
  };
}
