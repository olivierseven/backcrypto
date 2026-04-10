import type { Kline } from "./klinesChart/types";
import { clampBacktestExecutionMode, clampSlippagePercent, type BacktestExecutionMode } from "./backtestStorage";
import { buyerRefAllowsNextBuy, longFlattenCloseAtOrBelowAvg } from "./robotPriceLegRules";
import type { SavedRobot } from "./robotsStorage";

/** Saída total simulada na vela (tabela admin do backtest). */
export type RobotBacktestExitReason = "stop" | "flatten" | "signal_sell" | "post_arm_sell";

export type RobotBacktestRow = {
  barNum: number;
  openTime: number;
  close: number;
  /** Património no fim da vela: USDT livre + valor da posição ao fecho. */
  equityUsdt: number;
  /** USDT gastos em compras da posição atual; zera após venda ou stop que fecham a posição. */
  cumulativeBuyUsdt: number;
  /** USDT gastos em compra nesta vela (0 se nenhuma). */
  buyUsdtThisBar: number;
  /** Preço médio da posição no fim da vela; null se sem posição. */
  avgBuyPrice: number | null;
  /**
   * Se esta vela fechou posição, preço médio de entrada da quantidade vendida (igual ao médio antes da saída).
   * Válido para stop, zerar (flatten) e venda por sinal — ver {@link RobotBacktestRow.exitReason}.
   */
  avgBuyPriceAtExit: number | null;
  /** USDT líquidos da venda nesta vela (zerar ou venda por sinal; não acumula). Stop usa {@link RobotBacktestRow.stopProceedsThisBar}. */
  sellProceedsThisBar: number;
  /** Preço médio efetivo da venda nesta vela (USDT recebido / base vendido); null se não houve. */
  avgSellPriceThisBar: number | null;
  /** % P&L realizado na venda por sinal nesta vela (vs custo em USDT da posição). */
  sellRealizedPnlPct: number | null;
  /** USDT líquidos do stop nesta vela (não acumula). */
  stopProceedsThisBar: number;
  avgStopPriceThisBar: number | null;
  stopRealizedPnlPct: number | null;
  /** % ganho não realizado no fecho (se ainda em posição e close > médio). */
  gainPctUnrealized: number | null;
  /** % perda não realizada no fecho (se ainda em posição e close < médio). */
  lossPctUnrealized: number | null;
  /** Motivo da saída total nesta vela; null se não houve fecho (só compra ou posição aberta). Inclui venda só com alerta de zerar armado (`post_arm_sell`). */
  exitReason: RobotBacktestExitReason | null;
};

export type RobotBacktestSummary = {
  startBar: number;
  endBar: number;
  /** Open time (ms) da vela inicial do intervalo. */
  startOpenTimeMs: number | null;
  /** Open time (ms) da vela final do intervalo. */
  endOpenTimeMs: number | null;
  /** Duração do intervalo em horas (end - start). */
  totalHours: number | null;
  initialUsdt: number;
  finalEquityUsdt: number;
  netPnlUsdt: number;
  netPnlPct: number;
  buyFills: number;
  /** USDT gastos em todas as compras no intervalo (não zera entre ciclos venda→compra). */
  totalBuyUsdtInPeriod: number;
  sellFills: number;
  stopFills: number;
  maxDrawdownPct: number;
  /** Queda máxima vs pico de património, em USDT (mesmo instante que `maxDrawdownPct`). */
  maxDrawdownUsdt: number;
  /**
   * Maior perda bruta numa saída (USDT): `costBefore − grossProceeds` com `grossProceeds = qty×fecho`
   * (antes da taxa de venda). `costBefore` = `quoteInPosition` (valor líquido USDT na posição; não usa o total
   * debitado em compras, para não misturar taxa de compra neste “bruto”).
   */
  maxRealizedGrossLossUsdt: number;
  /** % bruto da maior perda vs custo da posição (`quoteInPosition`) na saída que originou `maxRealizedGrossLossUsdt`; null se não houve perda bruta. */
  maxRealizedGrossLossPct: number | null;
  /** Soma das perdas brutas realizadas (mesma definição). */
  totalRealizedGrossLossUsdt: number;
  /** Maior run-up % do património vs vale corrente (simétrico ao drawdown). */
  maxRunUpPct: number;
  /** Maior run-up em USDT do património vs vale corrente. */
  maxRunUpUsdt: number;
  /**
   * Maior ganho bruto numa saída: `grossProceeds − costBefore` quando positivo (`grossProceeds` antes da taxa de venda;
   * `costBefore` = custo da posição em USDT, sem tratar a taxa de compra como linha extra neste valor).
   */
  maxRealizedGrossGainUsdt: number;
  /** % bruto do maior ganho vs custo da posição na saída que originou `maxRealizedGrossGainUsdt`; null se não houve ganho bruto. */
  maxRealizedGrossGainPct: number | null;
  /** Soma dos ganhos brutos realizados (mesma definição). */
  totalRealizedGrossGainUsdt: number;
  /** Média do P&L % realizado só das saídas vencedoras (net, após taxa de venda). */
  avgWinRealizedPnlPct: number | null;
  /** Média do P&L % realizado por operação de saída (venda + stop, net). */
  avgRealizedPnlPctPerOperation: number | null;
  /** Taxa decimal por operação (ex. 0,001 = 0,1%). */
  feeRatePerSide: number;
  /** Soma estimada das comissões (compra + vendas) em USDT. */
  totalFeesUsdt: number;
  /** Soma das taxas só em compras. */
  totalFeesBuyUsdt: number;
  /** Soma das taxas só em vendas/stops. */
  totalFeesSellUsdt: number;
  /**
   * Buy & hold: investir o teto do robô em USDT (`initialUsdt × maxSpot% / 100`, igual ao máximo gastável vs o inicial virtual)
   * ao fecho da vela inicial (bar startBar), manter até a vela final (bar endBar). Mesma taxa e slippage que no resumo.
   */
  buyHoldFinalEquityUsdt: number | null;
  buyHoldNetPnlUsdt: number | null;
  buyHoldNetPnlPct: number | null;
  /** Montante USDT usado no buy & hold (= teto do robô vs inicial virtual). */
  buyHoldNotionalUsdt: number | null;
  /** Slippage % usado (0–0,5). */
  slippagePercent: number;
  /** Modo de execução usado no backtest. */
  executionMode: BacktestExecutionMode;
};

export type RobotBacktestResult =
  | { ok: true; rows: RobotBacktestRow[]; summary: RobotBacktestSummary }
  | { ok: false; error: string };

function robotBuyOrTrue(robot: SavedRobot, i: number, results: Map<string, boolean[]>): boolean {
  for (const id of robot.buyCombinedStrategyIds) {
    if (results.get(id)?.[i]) return true;
  }
  return false;
}

function robotSellOrTrue(robot: SavedRobot, i: number, results: Map<string, boolean[]>): boolean {
  for (const id of robot.sellCombinedStrategyIds) {
    if (results.get(id)?.[i]) return true;
  }
  return false;
}

function robotFlattenOrTrue(robot: SavedRobot, i: number, results: Map<string, boolean[]>): boolean {
  const ids = robot.flattenCombinedStrategyIds ?? [];
  for (const id of ids) {
    if (results.get(id)?.[i]) return true;
  }
  return false;
}

/** Venda só após o mesmo “arm” do zerar: precisa `flattenArmed` na vela (avaliado antes no loop). */
function robotPostFlattenSellOrTrue(robot: SavedRobot, i: number, results: Map<string, boolean[]>): boolean {
  const ids = robot.postFlattenSignalSellCombinedStrategyIds ?? [];
  for (const id of ids) {
    if (results.get(id)?.[i]) return true;
  }
  return false;
}

function parseClose(k: Kline): number | null {
  const c = Number(k[4]);
  return Number.isFinite(c) && c > 0 ? c : null;
}

function parseOpen(k: Kline): number | null {
  const o = Number(k[1]);
  return Number.isFinite(o) && o > 0 ? o : null;
}

/** Comissão spot típica por lado quando não há outro valor (0,1%). */
export const ROBOT_BACKTEST_DEFAULT_FEE_RATE_PER_SIDE = 0.001;

/**
 * Simula o robô comprador no fechamento de cada vela, do candle mais antigo ao mais recente do intervalo.
 * Regra fixa: nova compra só se o preço de execução da compra (buyPx) for ≤ ao da compra anterior no ciclo; reinicia ao zerar posição.
 * `barNum` na tabela: 1 = vela mais antiga carregada, `length` = mais recente.
 * Stop, zerar (primeiro sinal arma alerta; venda na 1.ª vela com fecho ≤ médio; min(sellPx, médio) no bruto),
 * venda por estratégias só com alerta armado, venda por sinal normal e compra.
 * Comissão: `feeRatePerSide` sobre o nocional de cada compra e sobre o bruto de cada venda.
 * Slippage: compra ao preço `close×(1+s)`, venda/stop ao `close×(1−s)` com `s` = slippage % / 100.
 */
export function runRobotBacktest(params: {
  robot: SavedRobot;
  klines: Kline[];
  strategyResults: Map<string, boolean[]>;
  startBar: number;
  endBar: number;
  spotUsdtForSimulation: number;
  /** Ex.: 0,001 = 0,1% por compra e por venda. Default {@link ROBOT_BACKTEST_DEFAULT_FEE_RATE_PER_SIDE}. */
  feeRatePerSide?: number;
  /** Slippage em % (0–0,5). Default 0. */
  slippagePercent?: number;
  /** Conservador: usa fecho para compra/venda. Otimista: compra no min(open,close), venda no max(open,close). */
  executionMode?: BacktestExecutionMode;
}): RobotBacktestResult {
  const { robot, klines, strategyResults, startBar: sb, endBar: eb, spotUsdtForSimulation } = params;
  const feeRateRaw = params.feeRatePerSide;
  const f =
    feeRateRaw != null && Number.isFinite(feeRateRaw) && feeRateRaw >= 0 && feeRateRaw < 1
      ? feeRateRaw
      : ROBOT_BACKTEST_DEFAULT_FEE_RATE_PER_SIDE;

  const slipPct = clampSlippagePercent(params.slippagePercent ?? 0);
  const slipDec = slipPct / 100;
  const executionMode = clampBacktestExecutionMode(params.executionMode);

  if (robot.side !== "buyer") {
    return { ok: false, error: "backtestBuyerOnly" };
  }

  const n = klines.length;
  if (n === 0) {
    return { ok: false, error: "backtestNoKlines" };
  }

  const allIds = [
    ...new Set([
      ...robot.buyCombinedStrategyIds,
      ...robot.sellCombinedStrategyIds,
      ...(robot.flattenCombinedStrategyIds ?? []),
      ...(robot.postFlattenSignalSellCombinedStrategyIds ?? []),
    ]),
  ];
  const missing = allIds.filter((id) => !strategyResults.has(id));
  if (missing.length > 0) {
    return { ok: false, error: "backtestMissingStrategies" };
  }

  let startBar = Math.max(1, Math.min(n, Math.floor(sb)));
  let endBar = Math.max(1, Math.min(n, Math.floor(eb)));
  if (startBar > endBar) {
    const t = startBar;
    startBar = endBar;
    endBar = t;
  }

  const spotRef =
    Number.isFinite(spotUsdtForSimulation) && spotUsdtForSimulation >= 0 ? spotUsdtForSimulation : 50_000;
  const maxSpendUsdt = (spotRef * robot.maxSpotPercent) / 100;
  const startOpenTimeMs = Number(klines[Math.max(0, n - startBar)]?.[0]) || null;
  const endOpenTimeMs = Number(klines[Math.max(0, n - endBar)]?.[0]) || null;
  const totalHours =
    startOpenTimeMs != null && endOpenTimeMs != null
      ? Math.max(0, (endOpenTimeMs - startOpenTimeMs) / 3_600_000)
      : null;

  let virtualFree = spotRef;
  let baseQty = 0;
  let quoteInPosition = 0;

  /** USDT comprados na “perna” atual (reinicia quando a posição fica flat por venda ou stop). */
  let cumulativeBuyUsdt = 0;
  /** Soma de todas as compras no backtest (estatística final; não reinicia). */
  let totalBuyUsdtInPeriod = 0;
  let buyFills = 0;
  let sellFills = 0;
  let stopFills = 0;
  let totalFeesUsdt = 0;
  let totalFeesBuyUsdt = 0;
  let totalFeesSellUsdt = 0;

  const boughtThisOpenTime = new Set<string>();
  const rows: RobotBacktestRow[] = [];
  let peakEquity = spotRef;
  let troughEquity = spotRef;
  let maxDrawdownPct = 0;
  let maxDrawdownUsdt = 0;
  let maxRunUpPct = 0;
  let maxRunUpUsdt = 0;
  let maxRealizedGrossLossUsdt = 0;
  let maxRealizedGrossLossPct: number | null = null;
  let totalRealizedGrossLossUsdt = 0;
  let maxRealizedGrossGainUsdt = 0;
  let maxRealizedGrossGainPct: number | null = null;
  let totalRealizedGrossGainUsdt = 0;
  let realizedPctSumAll = 0;
  let realizedPctCountAll = 0;
  let realizedPctSumWin = 0;
  let realizedPctCountWin = 0;
  let lastCloseInRange = 0;
  let lastSellPxInRange = 0;
  /** Preço da última compra executada no ciclo atual; zera com a posição (regra: próxima compra só se buyPx ≤ este). */
  let lastBuyFillPrice: number | null = null;
  /** Zerar: o primeiro sinal (e seguintes com posição) mantém alerta; venda na primeira vela com fecho ≤ médio. */
  let flattenArmed = false;
  /** Acumulação de compras: bordas do sinal sem posição; compras em velas seguidas até ao teto ou falha da regra de perna. */
  let buyEdgesSinceFlat = 0;
  let buyAccumulationActive = false;
  let prevBuySignalBar = false;

  /** Património: caixa + valor da posição ao preço de venda efetivo (fecho com slippage a favor do mercado). */
  const equityUsdtNow = (sellMark: number) =>
    virtualFree + (baseQty > 1e-12 ? baseQty * sellMark : 0);

  for (let b = startBar; b <= endBar; b++) {
    const i = n - b;
    const k = klines[i];
    const close = parseClose(k);

    const pushInvalidCloseRow = () => {
      const eq = virtualFree;
      rows.push({
        barNum: b,
        openTime: Number(k[0]) || 0,
        close: NaN,
        equityUsdt: eq,
        cumulativeBuyUsdt,
        buyUsdtThisBar: 0,
        avgBuyPrice: baseQty > 1e-12 ? quoteInPosition / baseQty : null,
        avgBuyPriceAtExit: null,
        sellProceedsThisBar: 0,
        avgSellPriceThisBar: null,
        sellRealizedPnlPct: null,
        stopProceedsThisBar: 0,
        avgStopPriceThisBar: null,
        stopRealizedPnlPct: null,
        gainPctUnrealized: null,
        lossPctUnrealized: null,
        exitReason: null,
      });
    };

    if (close == null) {
      pushInvalidCloseRow();
      continue;
    }

    lastCloseInRange = close;
    const ot = String(k[0]);
    const open = parseOpen(k) ?? close;
    const buyRefPx = executionMode === "optimistic" ? Math.min(open, close) : close;
    const sellRefPx = executionMode === "optimistic" ? Math.max(open, close) : close;
    const buyPx = buyRefPx * (1 + slipDec);
    const sellPx = sellRefPx * (1 - slipDec);
    lastSellPxInRange = sellPx;

    let buyUsdtThisBar = 0;
    let sellProceedsThisBar = 0;
    let avgSellPriceThisBar: number | null = null;
    let sellRealizedPnlPct: number | null = null;
    let stopProceedsThisBar = 0;
    let avgStopPriceThisBar: number | null = null;
    let stopRealizedPnlPct: number | null = null;
    let avgBuyPriceAtExit: number | null = null;
    let exitReason: RobotBacktestExitReason | null = null;

    const avgBuyBeforeExits = baseQty > 1e-12 ? quoteInPosition / baseQty : null;
    const hadPosAtBarStart = baseQty > 1e-12;

    const flatAtStart = baseQty <= 1e-12;
    const buySig = robotBuyOrTrue(robot, i, strategyResults);
    const nAccumStart =
      typeof robot.buyAccumulationStartOnSignalNumber === "number" &&
      Number.isFinite(robot.buyAccumulationStartOnSignalNumber)
        ? Math.min(5, Math.max(1, Math.floor(robot.buyAccumulationStartOnSignalNumber)))
        : 1;
    if (flatAtStart && buySig && !prevBuySignalBar) {
      buyEdgesSinceFlat += 1;
      if (buyEdgesSinceFlat >= nAccumStart) {
        buyAccumulationActive = true;
      }
    }
    prevBuySignalBar = buySig;

    if (baseQty <= 1e-12) {
      flattenArmed = false;
    } else if (robotFlattenOrTrue(robot, i, strategyResults)) {
      flattenArmed = true;
    }

    // 1) Stops (loss/gain) — fecha posição completa
    if (baseQty > 1e-12 && avgBuyBeforeExits != null && (robot.stopLossEnabled || robot.stopGainEnabled)) {
      const lossPctVsAvg = ((avgBuyBeforeExits - sellPx) / avgBuyBeforeExits) * 100;
      const gainPctVsAvg = ((sellPx - avgBuyBeforeExits) / avgBuyBeforeExits) * 100;
      const currentVal = baseQty * sellPx;
      const lossUsdt = Math.max(0, quoteInPosition - currentVal);
      const gainUsdt = Math.max(0, currentVal - quoteInPosition);
      const stopLossTrigger =
        robot.stopLossEnabled &&
        (robot.stopLossMode === "percent"
          ? sellPx < avgBuyBeforeExits && lossPctVsAvg >= robot.stopLossPercent - 1e-9
          : lossUsdt >= robot.stopLossFixedUsdt - 1e-9);
      const stopGainTrigger =
        robot.stopGainEnabled &&
        (robot.stopGainMode === "percent"
          ? sellPx > avgBuyBeforeExits && gainPctVsAvg >= robot.stopGainPercent - 1e-9
          : gainUsdt >= robot.stopGainFixedUsdt - 1e-9);
      const trigger = stopLossTrigger || stopGainTrigger;
      if (trigger) {
        const baseBefore = baseQty;
        const costBefore = quoteInPosition;
        const grossProceeds = baseQty * sellPx;
        const feeSell = grossProceeds * f;
        const netProceeds = grossProceeds - feeSell;
        totalFeesUsdt += feeSell;
        totalFeesSellUsdt += feeSell;
        avgBuyPriceAtExit = avgBuyBeforeExits;
        stopProceedsThisBar = netProceeds;
        avgStopPriceThisBar = netProceeds / baseBefore;
        stopRealizedPnlPct =
          costBefore > 1e-12 ? ((netProceeds - costBefore) / costBefore) * 100 : null;
        if (stopRealizedPnlPct != null && Number.isFinite(stopRealizedPnlPct)) {
          realizedPctSumAll += stopRealizedPnlPct;
          realizedPctCountAll++;
          if (stopRealizedPnlPct > 1e-12) {
            realizedPctSumWin += stopRealizedPnlPct;
            realizedPctCountWin++;
          }
        }
        {
          if (grossProceeds < costBefore - 1e-9) {
            const lossGross = costBefore - grossProceeds;
            totalRealizedGrossLossUsdt += lossGross;
            if (lossGross > maxRealizedGrossLossUsdt) {
              maxRealizedGrossLossUsdt = lossGross;
              maxRealizedGrossLossPct =
                costBefore > 1e-12 ? (lossGross / costBefore) * 100 : null;
            }
          } else if (grossProceeds > costBefore + 1e-9) {
            const gainGross = grossProceeds - costBefore;
            totalRealizedGrossGainUsdt += gainGross;
            if (gainGross > maxRealizedGrossGainUsdt) {
              maxRealizedGrossGainUsdt = gainGross;
              maxRealizedGrossGainPct =
                costBefore > 1e-12 ? (gainGross / costBefore) * 100 : null;
            }
          }
        }
        virtualFree += netProceeds;
        stopFills++;
        exitReason = "stop";
        baseQty = 0;
        quoteInPosition = 0;
        cumulativeBuyUsdt = 0;
        lastBuyFillPrice = null;
        flattenArmed = false;
      }
    }

    // 2) Zerar: alerta armado; primeira vela com fecho ≤ médio de compra.
    if (baseQty > 1e-12 && flattenArmed) {
      const avgExit = quoteInPosition / baseQty;
      if (longFlattenCloseAtOrBelowAvg(close, avgExit)) {
        const baseBefore = baseQty;
        const costBefore = quoteInPosition;
        if (avgBuyPriceAtExit == null) avgBuyPriceAtExit = avgExit;
        /** Breakeven: não realizar lucro bruto vs custo — teto do preço efetivo = médio (ainda pode perder pela taxa de venda). */
        const effFlatPx = Math.min(sellPx, avgExit);
        const grossProceeds = baseQty * effFlatPx;
        const feeSell = grossProceeds * f;
        const netProceeds = grossProceeds - feeSell;
        totalFeesUsdt += feeSell;
        totalFeesSellUsdt += feeSell;
        sellProceedsThisBar = netProceeds;
        avgSellPriceThisBar = netProceeds / baseBefore;
        sellRealizedPnlPct =
          costBefore > 1e-12 ? ((netProceeds - costBefore) / costBefore) * 100 : null;
        if (sellRealizedPnlPct != null && Number.isFinite(sellRealizedPnlPct)) {
          realizedPctSumAll += sellRealizedPnlPct;
          realizedPctCountAll++;
          if (sellRealizedPnlPct > 1e-12) {
            realizedPctSumWin += sellRealizedPnlPct;
            realizedPctCountWin++;
          }
        }
        {
          if (grossProceeds < costBefore - 1e-9) {
            const lossGross = costBefore - grossProceeds;
            totalRealizedGrossLossUsdt += lossGross;
            if (lossGross > maxRealizedGrossLossUsdt) {
              maxRealizedGrossLossUsdt = lossGross;
              maxRealizedGrossLossPct =
                costBefore > 1e-12 ? (lossGross / costBefore) * 100 : null;
            }
          } else if (grossProceeds > costBefore + 1e-9) {
            const gainGross = grossProceeds - costBefore;
            totalRealizedGrossGainUsdt += gainGross;
            if (gainGross > maxRealizedGrossGainUsdt) {
              maxRealizedGrossGainUsdt = gainGross;
              maxRealizedGrossGainPct =
                costBefore > 1e-12 ? (gainGross / costBefore) * 100 : null;
            }
          }
        }
        virtualFree += netProceeds;
        sellFills++;
        exitReason = "flatten";
        baseQty = 0;
        quoteInPosition = 0;
        cumulativeBuyUsdt = 0;
        lastBuyFillPrice = null;
        flattenArmed = false;
      }
    }

    // 3) Venda por estratégias após o mesmo sinal do zerar (alerta armado; OR das estratégias configuradas)
    if (baseQty > 1e-12 && flattenArmed && robotPostFlattenSellOrTrue(robot, i, strategyResults)) {
      const baseBefore = baseQty;
      const costBefore = quoteInPosition;
      const exitAvg = quoteInPosition / baseQty;
      if (avgBuyPriceAtExit == null) avgBuyPriceAtExit = exitAvg;
      const grossProceeds = baseQty * sellPx;
      const feeSell = grossProceeds * f;
      const netProceeds = grossProceeds - feeSell;
      totalFeesUsdt += feeSell;
      totalFeesSellUsdt += feeSell;
      sellProceedsThisBar = netProceeds;
      avgSellPriceThisBar = netProceeds / baseBefore;
      sellRealizedPnlPct =
        costBefore > 1e-12 ? ((netProceeds - costBefore) / costBefore) * 100 : null;
      if (sellRealizedPnlPct != null && Number.isFinite(sellRealizedPnlPct)) {
        realizedPctSumAll += sellRealizedPnlPct;
        realizedPctCountAll++;
        if (sellRealizedPnlPct > 1e-12) {
          realizedPctSumWin += sellRealizedPnlPct;
          realizedPctCountWin++;
        }
      }
      {
        if (grossProceeds < costBefore - 1e-9) {
          const lossGross = costBefore - grossProceeds;
          totalRealizedGrossLossUsdt += lossGross;
          if (lossGross > maxRealizedGrossLossUsdt) {
            maxRealizedGrossLossUsdt = lossGross;
            maxRealizedGrossLossPct =
              costBefore > 1e-12 ? (lossGross / costBefore) * 100 : null;
          }
        } else if (grossProceeds > costBefore + 1e-9) {
          const gainGross = grossProceeds - costBefore;
          totalRealizedGrossGainUsdt += gainGross;
          if (gainGross > maxRealizedGrossGainUsdt) {
            maxRealizedGrossGainUsdt = gainGross;
            maxRealizedGrossGainPct =
              costBefore > 1e-12 ? (gainGross / costBefore) * 100 : null;
          }
        }
      }
      virtualFree += netProceeds;
      sellFills++;
      exitReason = "post_arm_sell";
      baseQty = 0;
      quoteInPosition = 0;
      cumulativeBuyUsdt = 0;
      lastBuyFillPrice = null;
      flattenArmed = false;
    }

    // 4) Venda por sinal (fecha posição completa, a mercado no simulador)
    if (baseQty > 1e-12 && robotSellOrTrue(robot, i, strategyResults)) {
      const baseBefore = baseQty;
      const costBefore = quoteInPosition;
      const exitAvg = quoteInPosition / baseQty;
      if (avgBuyPriceAtExit == null) avgBuyPriceAtExit = exitAvg;
      const grossProceeds = baseQty * sellPx;
      const feeSell = grossProceeds * f;
      const netProceeds = grossProceeds - feeSell;
      totalFeesUsdt += feeSell;
      totalFeesSellUsdt += feeSell;
      sellProceedsThisBar = netProceeds;
      avgSellPriceThisBar = netProceeds / baseBefore;
      sellRealizedPnlPct =
        costBefore > 1e-12 ? ((netProceeds - costBefore) / costBefore) * 100 : null;
      if (sellRealizedPnlPct != null && Number.isFinite(sellRealizedPnlPct)) {
        realizedPctSumAll += sellRealizedPnlPct;
        realizedPctCountAll++;
        if (sellRealizedPnlPct > 1e-12) {
          realizedPctSumWin += sellRealizedPnlPct;
          realizedPctCountWin++;
        }
      }
      {
        if (grossProceeds < costBefore - 1e-9) {
          const lossGross = costBefore - grossProceeds;
          totalRealizedGrossLossUsdt += lossGross;
          if (lossGross > maxRealizedGrossLossUsdt) {
            maxRealizedGrossLossUsdt = lossGross;
            maxRealizedGrossLossPct =
              costBefore > 1e-12 ? (lossGross / costBefore) * 100 : null;
          }
        } else if (grossProceeds > costBefore + 1e-9) {
          const gainGross = grossProceeds - costBefore;
          totalRealizedGrossGainUsdt += gainGross;
          if (gainGross > maxRealizedGrossGainUsdt) {
            maxRealizedGrossGainUsdt = gainGross;
            maxRealizedGrossGainPct =
              costBefore > 1e-12 ? (gainGross / costBefore) * 100 : null;
          }
        }
      }
      virtualFree += netProceeds;
      sellFills++;
      exitReason = "signal_sell";
      baseQty = 0;
      quoteInPosition = 0;
      cumulativeBuyUsdt = 0;
      lastBuyFillPrice = null;
      flattenArmed = false;
    }

    // 5) Compra: acumulação ativa → até uma compra por vela até ao teto; regra de perna falha → para a sequência.
    if (buyAccumulationActive && !boughtThisOpenTime.has(ot)) {
      if (!buyerRefAllowsNextBuy(buyPx, lastBuyFillPrice)) {
        buyAccumulationActive = false;
      } else {
        const roomBelowRobotMax = Math.max(0, maxSpendUsdt - quoteInPosition);
        let opUsdt =
          robot.buyOperationMode === "fixed"
            ? Math.min(robot.buyOperationFixedUsdt, maxSpendUsdt)
            : (maxSpendUsdt * Math.min(robot.buyOperationPercent, robot.maxSpotPercent)) / 100;
        opUsdt = Math.min(opUsdt, virtualFree, roomBelowRobotMax);
        if (opUsdt > 1e-8) {
          const feeBuy = opUsdt * f;
          const netQuote = opUsdt - feeBuy;
          const baseAdd = netQuote / buyPx;
          if (baseAdd > 1e-12) {
            totalFeesUsdt += feeBuy;
            totalFeesBuyUsdt += feeBuy;
            virtualFree -= opUsdt;
            quoteInPosition += netQuote;
            baseQty += baseAdd;
            cumulativeBuyUsdt += opUsdt;
            totalBuyUsdtInPeriod += opUsdt;
            buyUsdtThisBar = opUsdt;
            buyFills++;
            boughtThisOpenTime.add(ot);
            lastBuyFillPrice = buyPx;
          } else {
            buyAccumulationActive = false;
          }
        } else {
          buyAccumulationActive = false;
        }
      }
    }

    if (hadPosAtBarStart && baseQty <= 1e-12) {
      buyEdgesSinceFlat = 0;
      buyAccumulationActive = false;
      prevBuySignalBar = false;
    }

    const avgAfter = baseQty > 1e-12 ? quoteInPosition / baseQty : null;
    let gainPctUnrealized: number | null = null;
    let lossPctUnrealized: number | null = null;
    if (avgAfter != null) {
      const u = ((sellPx - avgAfter) / avgAfter) * 100;
      if (u > 0) gainPctUnrealized = u;
      else if (u < 0) lossPctUnrealized = -u;
    }

    const eq = equityUsdtNow(sellPx);
    if (eq > peakEquity) peakEquity = eq;
    if (eq < troughEquity) troughEquity = eq;
    if (peakEquity > 1e-9) {
      const dd = ((peakEquity - eq) / peakEquity) * 100;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
      const ddUsdt = peakEquity - eq;
      if (ddUsdt > maxDrawdownUsdt) maxDrawdownUsdt = ddUsdt;
    }
    if (troughEquity > 1e-9) {
      const ruUsdt = eq - troughEquity;
      if (ruUsdt > maxRunUpUsdt) maxRunUpUsdt = ruUsdt;
      const ruPct = (ruUsdt / troughEquity) * 100;
      if (ruPct > maxRunUpPct) maxRunUpPct = ruPct;
    }

    rows.push({
      barNum: b,
      openTime: Number(k[0]) || 0,
      close,
      equityUsdt: eq,
      cumulativeBuyUsdt,
      buyUsdtThisBar,
      avgBuyPrice: avgAfter,
      avgBuyPriceAtExit,
      sellProceedsThisBar,
      avgSellPriceThisBar,
      sellRealizedPnlPct,
      stopProceedsThisBar,
      avgStopPriceThisBar,
      stopRealizedPnlPct,
      gainPctUnrealized,
      lossPctUnrealized,
      exitReason,
    });
  }

  const fallbackClose = parseClose(klines[Math.max(0, n - endBar)]);
  const finalSellMark =
    lastSellPxInRange > 0
      ? lastSellPxInRange
      : fallbackClose != null
        ? fallbackClose * (1 - slipDec)
        : 1;
  const finalEquity = equityUsdtNow(finalSellMark);
  const netPnlUsdt = finalEquity - spotRef;
  const netPnlPct = spotRef > 1e-9 ? (netPnlUsdt / spotRef) * 100 : 0;

  /** Referência buy & hold: mesmo teto do robô (máx. USDT gastável vs inicial virtual), não a soma das compras simuladas. */
  const buyHoldNotional = maxSpendUsdt;
  let buyHoldFinalEquityUsdt: number | null = null;
  let buyHoldNetPnlUsdt: number | null = null;
  let buyHoldNetPnlPct: number | null = null;
  let buyHoldNotionalUsdt: number | null = null;
  if (buyHoldNotional > 1e-12 && n > 0) {
    const cStart = parseClose(klines[Math.max(0, n - startBar)]);
    const cEnd = parseClose(klines[Math.max(0, n - endBar)]);
    if (cStart != null && cEnd != null && cStart > 0) {
      const oneMinus = 1 - f;
      const effStart = cStart * (1 + slipDec);
      const effEnd = cEnd * (1 - slipDec);
      const eqBh = buyHoldNotional * (effEnd / effStart) * oneMinus * oneMinus;
      buyHoldFinalEquityUsdt = eqBh;
      buyHoldNetPnlUsdt = eqBh - buyHoldNotional;
      buyHoldNetPnlPct = ((eqBh - buyHoldNotional) / buyHoldNotional) * 100;
      buyHoldNotionalUsdt = buyHoldNotional;
    }
  }
  const avgWinRealizedPnlPct =
    realizedPctCountWin > 0 ? realizedPctSumWin / realizedPctCountWin : null;
  const avgRealizedPnlPctPerOperation =
    realizedPctCountAll > 0 ? realizedPctSumAll / realizedPctCountAll : null;

  const summary: RobotBacktestSummary = {
    startBar,
    endBar,
    startOpenTimeMs,
    endOpenTimeMs,
    totalHours,
    initialUsdt: spotRef,
    finalEquityUsdt: finalEquity,
    netPnlUsdt,
    netPnlPct,
    buyFills,
    totalBuyUsdtInPeriod,
    sellFills,
    stopFills,
    maxDrawdownPct,
    maxDrawdownUsdt,
    maxRealizedGrossLossUsdt,
    maxRealizedGrossLossPct,
    totalRealizedGrossLossUsdt,
    maxRunUpPct,
    maxRunUpUsdt,
    maxRealizedGrossGainUsdt,
    maxRealizedGrossGainPct,
    totalRealizedGrossGainUsdt,
    avgWinRealizedPnlPct,
    avgRealizedPnlPctPerOperation,
    feeRatePerSide: f,
    totalFeesUsdt,
    totalFeesBuyUsdt,
    totalFeesSellUsdt,
    buyHoldFinalEquityUsdt,
    buyHoldNetPnlUsdt,
    buyHoldNetPnlPct,
    buyHoldNotionalUsdt,
    slippagePercent: slipPct,
    executionMode,
  };

  return { ok: true, rows, summary };
}
