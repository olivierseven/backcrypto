/**
 * Agrega eventos de `RobotSpotPerformanceEvent` (API) num resumo comparável ao backtest.
 */

export type RobotPerformanceApiEvent = {
  side: string;
  executionRole: string;
  quoteQtyUsdt: string | null;
  executedQtyBase: string | null;
  feeUsdt: string | null;
  createdAt: string;
  symbol?: string | null;
};

function parseNum(s: string | null | undefined): number {
  if (s == null || typeof s !== "string") return 0;
  const n = parseFloat(s.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export type RobotLiveReportSummary = {
  eventCount: number;
  periodFromMs: number;
  periodToMs: number;
  buyOps: number;
  sellSignalOps: number;
  sellFlattenOps: number;
  stopLossOps: number;
  stopGainOps: number;
  totalBuyQuoteUsdt: number;
  totalSellQuoteUsdt: number;
  totalFeesUsdt: number;
  /** P&L realizado (custo médio na posição; vendas e stops). */
  netRealizedPnlUsdt: number;
  /** Base ainda em posição (após processar eventos em ordem). */
  openPositionBaseQty: number;
  /** Custo USDT ainda na posição (custo médio × base aberta). */
  openPositionCostUsdt: number;
  /** Drawdown máx. % sobre série de “nav” (fluxo USDT líquido por evento; aproximação). */
  maxDrawdownNavPct: number | null;
  /** Run-up máx. % sobre o mesmo. */
  maxRunUpNavPct: number | null;
};

/**
 * Processa eventos em ordem cronológica (mais antigo → mais recente).
 */
export function computeRobotLiveReportSummary(
  events: RobotPerformanceApiEvent[],
  periodFromMs: number,
  periodToMs: number
): RobotLiveReportSummary {
  const sorted = [...events].sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
  });

  let buyOps = 0;
  let sellSignalOps = 0;
  let sellFlattenOps = 0;
  let stopLossOps = 0;
  let stopGainOps = 0;
  let totalBuyQuoteUsdt = 0;
  let totalSellQuoteUsdt = 0;
  let totalFeesUsdt = 0;

  let positionBase = 0;
  let positionCostUsdt = 0;
  let netRealizedPnlUsdt = 0;

  const navSeries: number[] = [];
  let nav = 0;

  for (const e of sorted) {
    const side = (e.side ?? "").toUpperCase();
    const role = (e.executionRole ?? "").toUpperCase();
    const qb = parseNum(e.executedQtyBase);
    const qq = parseNum(e.quoteQtyUsdt);
    const fee = parseNum(e.feeUsdt);
    totalFeesUsdt += fee;

    if (side === "BUY" && role === "OPEN_BUY") {
      buyOps += 1;
      totalBuyQuoteUsdt += qq;
      positionBase += qb;
      positionCostUsdt += qq + fee;
      nav -= qq + fee;
    } else if (side === "SELL") {
      if (role === "SIGNAL_SELL") sellSignalOps += 1;
      else if (role === "FLATTEN") sellFlattenOps += 1;
      else if (role === "STOP_LOSS") stopLossOps += 1;
      else if (role === "STOP_GAIN") stopGainOps += 1;

      totalSellQuoteUsdt += qq;
      nav += qq - fee;
      if (positionBase > 1e-12 && qb > 1e-12) {
        const sellBase = Math.min(qb, positionBase);
        const avgUnitCost = positionCostUsdt / positionBase;
        const costPortion = avgUnitCost * sellBase;
        const proceedsPortion = (qq * sellBase) / qb;
        netRealizedPnlUsdt += proceedsPortion - costPortion - fee;
        positionCostUsdt -= costPortion;
        positionBase -= sellBase;
      }
    }
    navSeries.push(nav);
  }

  let maxDrawdownNavPct: number | null = null;
  let maxRunUpNavPct: number | null = null;
  if (navSeries.length > 0) {
    let peakNav = navSeries[0];
    let maxDdAbs = 0;
    let troughNav = navSeries[0];
    let maxRuAbs = 0;
    for (const v of navSeries) {
      if (v > peakNav) peakNav = v;
      maxDdAbs = Math.max(maxDdAbs, peakNav - v);
      if (v < troughNav) troughNav = v;
      maxRuAbs = Math.max(maxRuAbs, v - troughNav);
    }
    const denomDd = Math.max(Math.abs(peakNav), 1e-9);
    const denomRu = Math.max(Math.abs(troughNav), 1e-9);
    maxDrawdownNavPct = denomDd > 1e-12 ? (maxDdAbs / denomDd) * 100 : null;
    maxRunUpNavPct = denomRu > 1e-12 ? (maxRuAbs / denomRu) * 100 : null;
  }

  return {
    eventCount: sorted.length,
    periodFromMs,
    periodToMs,
    buyOps,
    sellSignalOps,
    sellFlattenOps,
    stopLossOps,
    stopGainOps,
    totalBuyQuoteUsdt,
    totalSellQuoteUsdt,
    totalFeesUsdt,
    netRealizedPnlUsdt,
    openPositionBaseQty: positionBase,
    openPositionCostUsdt: positionCostUsdt,
    maxDrawdownNavPct,
    maxRunUpNavPct,
  };
}
