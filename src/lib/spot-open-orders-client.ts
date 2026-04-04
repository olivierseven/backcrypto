/** Resposta de GET /user/binance-connection/spot-open-orders */

export type SpotOpenLimitBuyOrder = { orderId: string; price: number };

export function parseSpotOpenOrdersJson(data: unknown): { prices: number[]; orders: SpotOpenLimitBuyOrder[] } {
  const o = data as { prices?: unknown; orders?: unknown };
  const prices = Array.isArray(o.prices)
    ? o.prices
        .map((p) => (typeof p === "number" ? p : typeof p === "string" ? parseFloat(p) : NaN))
        .filter((p): p is number => Number.isFinite(p) && p > 0)
    : [];
  const orders: SpotOpenLimitBuyOrder[] = [];
  if (Array.isArray(o.orders)) {
    for (const row of o.orders) {
      if (typeof row !== "object" || row === null) continue;
      const r = row as { orderId?: unknown; price?: unknown };
      const oid = r.orderId != null ? String(r.orderId) : "";
      const px = typeof r.price === "number" ? r.price : parseFloat(String(r.price ?? ""));
      if (oid && Number.isFinite(px) && px > 0) orders.push({ orderId: oid, price: px });
    }
  }
  return { prices, orders };
}
