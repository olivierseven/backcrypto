/**
 * Extrai métricas a partir da resposta POST /api/v3/order (Binance) para `RobotSpotPerformanceEvent`.
 */
export type ParsedSpotOrderMetrics = {
  executedQtyBase: string | null;
  quoteQtyUsdt: string | null;
  avgPrice: string | null;
  /** Soma de comissões quando `commissionAsset` é USDT; senão null (ver rawJson). */
  feeUsdt: string | null;
};

function trimNumString(s: string): string {
  return s.replace(/\.?0+$/, "").replace(/\.$/, "") || "0";
}

export function parseBinanceOrderResponseForPerformance(orderJson: unknown): ParsedSpotOrderMetrics {
  if (orderJson == null || typeof orderJson !== "object") {
    return { executedQtyBase: null, quoteQtyUsdt: null, avgPrice: null, feeUsdt: null };
  }
  const o = orderJson as Record<string, unknown>;
  const execRaw = o.executedQty ?? o.origQty;
  const execStr = typeof execRaw === "string" ? execRaw : typeof execRaw === "number" ? String(execRaw) : "";
  const cumRaw = o.cummulativeQuoteQty ?? o.cumulativeQuoteQty;
  const cumStr = typeof cumRaw === "string" ? cumRaw : typeof cumRaw === "number" ? String(cumRaw) : "";

  const base = parseFloat(execStr);
  const quote = parseFloat(cumStr);
  let avgPrice: string | null = null;
  if (Number.isFinite(base) && Number.isFinite(quote) && base > 0 && quote > 0) {
    avgPrice = trimNumString((quote / base).toFixed(8));
  }

  let feeUsdt: string | null = null;
  const fills = o.fills;
  if (Array.isArray(fills) && fills.length > 0) {
    let sum = 0;
    for (const f of fills) {
      if (f == null || typeof f !== "object") continue;
      const fr = f as Record<string, unknown>;
      const asset = typeof fr.commissionAsset === "string" ? fr.commissionAsset.toUpperCase() : "";
      const comm = fr.commission;
      const n = typeof comm === "string" ? parseFloat(comm) : typeof comm === "number" ? comm : NaN;
      if (asset === "USDT" && Number.isFinite(n) && n >= 0) sum += n;
    }
    if (sum > 0) feeUsdt = trimNumString(sum.toFixed(8));
  }

  return {
    executedQtyBase: execStr.trim() !== "" ? execStr : null,
    quoteQtyUsdt: cumStr.trim() !== "" ? cumStr : null,
    avgPrice,
    feeUsdt,
  };
}
