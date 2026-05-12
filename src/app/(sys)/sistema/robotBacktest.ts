import type { Kline } from "./klinesChart/types";
import { clampBacktestExecutionMode, clampSlippagePercent, type BacktestExecutionMode } from "./backtestStorage";
import {
  buyerAllowsAccumulationBuy,
  buyerMarketBuyRefStrictlyBelowCandleOpen,
  flattenBreakevenThresholdPrice,
  longFlattenCloseBreakeven,
} from "./robotPriceLegRules";
import {
  ROBOT_BUY_ACCUM_MAX_CANDLES_DEFAULT,
  ROBOT_BUY_ACCUM_MAX_CANDLES_MAX,
  ROBOT_BUY_ACCUM_MAX_CANDLES_MIN,
  type SavedRobot,
} from "./robotsStorage";
import { computeNominalBuyOperationUsdt } from "./robotLiveOrders";

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
  /** % ganho não realizado (posição aberta): vs **máximo** da vela com slippage à venda. */
  gainPctUnrealized: number | null;
  /** % perda não realizada (posição aberta): vs **mínimo** da vela com slippage à venda. */
  lossPctUnrealized: number | null;
  /** Motivo da saída total nesta vela; null se não houve fecho (só compra ou posição aberta). Inclui venda só com alerta de zerar armado (`post_arm_sell`). */
  exitReason: RobotBacktestExitReason | null;
};

/**
 * Um ciclo completo de posição: primeira compra no intervalo até à saída (ou até ao fim dos dados se a posição ficar aberta).
 * Útil para mini-relatórios de debug no modal de backtest (admin).
 */
export type RobotBacktestTradeCycle = {
  /** Índice 1-based para mostrar ao utilizador. */
  index: number;
  readonly rows: readonly RobotBacktestRow[];
  /** Foi fechada dentro do intervalo simulado (venda ou stop na última vela do ciclo). */
  closed: boolean;
  startBar: number;
  endBar: number;
  startOpenTimeMs: number;
  endOpenTimeMs: number;
  totalBuyUsdt: number;
  buyFillCount: number;
  exitReason: RobotBacktestExitReason | null;
  /** USDT líquidos na vela de saída (soma venda + stop; só um costuma ser > 0). */
  exitNetProceedsUsdt: number;
  realizedPnlPct: number | null;
  maxGainPctUnrealized: number | null;
  maxLossPctUnrealized: number | null;
  firstBarEquityUsdt: number;
  lastBarEquityUsdt: number;
};

function finalizeRobotBacktestTradeCycleDraft(
  rows: RobotBacktestRow[],
  closed: boolean
): Omit<RobotBacktestTradeCycle, "index"> {
  const first = rows[0];
  const last = rows[rows.length - 1];
  let totalBuyUsdt = 0;
  let buyFillCount = 0;
  let maxGainPctUnrealized: number | null = null;
  let maxLossPctUnrealized: number | null = null;
  for (const r of rows) {
    if (r.buyUsdtThisBar > 1e-9) {
      totalBuyUsdt += r.buyUsdtThisBar;
      buyFillCount++;
    }
    if (r.gainPctUnrealized != null && Number.isFinite(r.gainPctUnrealized)) {
      maxGainPctUnrealized =
        maxGainPctUnrealized == null
          ? r.gainPctUnrealized
          : Math.max(maxGainPctUnrealized, r.gainPctUnrealized);
    }
    if (r.lossPctUnrealized != null && Number.isFinite(r.lossPctUnrealized)) {
      maxLossPctUnrealized =
        maxLossPctUnrealized == null
          ? r.lossPctUnrealized
          : Math.max(maxLossPctUnrealized, r.lossPctUnrealized);
    }
  }
  const exitNetProceedsUsdt = closed ? last.sellProceedsThisBar + last.stopProceedsThisBar : 0;
  const realizedPnlPct = closed
    ? last.stopProceedsThisBar > 1e-9
      ? last.stopRealizedPnlPct
      : last.sellRealizedPnlPct
    : null;
  return {
    rows: [...rows],
    closed,
    startBar: first.barNum,
    endBar: last.barNum,
    startOpenTimeMs: first.openTime,
    endOpenTimeMs: last.openTime,
    totalBuyUsdt,
    buyFillCount,
    exitReason: closed ? last.exitReason : null,
    exitNetProceedsUsdt,
    realizedPnlPct,
    maxGainPctUnrealized,
    maxLossPctUnrealized,
    firstBarEquityUsdt: first.equityUsdt,
    lastBarEquityUsdt: last.equityUsdt,
  };
}

/**
 * Segmenta as linhas do backtest em ciclos posição→saída.
 * Regra: início = primeira vela com compra após estar flat; fim = primeira vela com venda ou stop que zera a posição.
 * Na mesma vela pode haver saída e nova compra — contam como fim de um ciclo e início do seguinte.
 */
export function buildRobotBacktestTradeCycles(rows: readonly RobotBacktestRow[]): RobotBacktestTradeCycle[] {
  const out: RobotBacktestTradeCycle[] = [];
  let active: RobotBacktestRow[] | null = null;

  for (const row of rows) {
    const hadBuy = row.buyUsdtThisBar > 1e-9;
    const hadExit =
      (Number.isFinite(row.sellProceedsThisBar) && row.sellProceedsThisBar > 1e-9) ||
      (Number.isFinite(row.stopProceedsThisBar) && row.stopProceedsThisBar > 1e-9);

    if (active === null) {
      if (!hadBuy) continue;
      active = [row];
    } else {
      active.push(row);
    }

    if (hadExit) {
      out.push({ index: 0, ...finalizeRobotBacktestTradeCycleDraft(active, true) });
      active = hadBuy ? [row] : null;
    }
  }

  if (active !== null && active.length > 0) {
    out.push({ index: 0, ...finalizeRobotBacktestTradeCycleDraft(active, false) });
  }

  return out.map((c, i) => ({ ...c, index: i + 1 }));
}

/** `openTime` (ms) da primeira vela do ciclo em que houve compra; coincide com `startOpenTimeMs` nos ciclos normais. */
export function robotBacktestCycleFirstBuyOpenTimeMs(cycle: RobotBacktestTradeCycle): number {
  const r = cycle.rows.find((x) => x.buyUsdtThisBar > 1e-9);
  return r != null ? r.openTime : cycle.startOpenTimeMs;
}

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

function buyerSignalExitMeetsMinEdge(robot: SavedRobot, signalPx: number, avgBuyPrice: number): boolean {
  if (!Number.isFinite(signalPx) || signalPx <= 0) return false;
  if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) return false;
  const minEdgePctRaw = robot.signalExitMinEdgePercent ?? 0;
  const minEdgePct = Number.isFinite(minEdgePctRaw) ? Math.max(0, minEdgePctRaw) : 0;
  if (minEdgePct <= 1e-12) return true;
  return signalPx >= avgBuyPrice * (1 + minEdgePct / 100) - 1e-9;
}

function buyerSignalExitMinEdgeThresholdPrice(robot: SavedRobot, avgBuyPrice: number): number {
  if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) return NaN;
  const minEdgePctRaw = robot.signalExitMinEdgePercent ?? 0;
  const minEdgePct = Number.isFinite(minEdgePctRaw) ? Math.max(0, minEdgePctRaw) : 0;
  return avgBuyPrice * (1 + minEdgePct / 100);
}

function buyerAlertArmMeetsMinEdge(robot: SavedRobot, signalPx: number, avgBuyPrice: number): boolean {
  if (!Number.isFinite(signalPx) || signalPx <= 0) return false;
  if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) return false;
  const minEdgePctRaw = robot.alertArmMinEdgePercent ?? 0;
  const minEdgePct = Number.isFinite(minEdgePctRaw) ? Math.max(0, minEdgePctRaw) : 0;
  if (minEdgePct <= 1e-12) return true;
  return signalPx >= avgBuyPrice * (1 + minEdgePct / 100) - 1e-9;
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

function parseHigh(k: Kline): number | null {
  const h = Number(k[2]);
  return Number.isFinite(h) && h > 0 ? h : null;
}

function parseLow(k: Kline): number | null {
  const lo = Number(k[3]);
  return Number.isFinite(lo) && lo > 0 ? lo : null;
}

/** Comissão spot típica por lado quando não há outro valor (0,1%). */
export const ROBOT_BACKTEST_DEFAULT_FEE_RATE_PER_SIDE = 0.001;

/**
 * Simula o robô comprador no fechamento de cada vela, do candle mais antigo ao mais recente do intervalo.
 * Regra fixa: nova compra só se o preço de execução da compra (buyPx) for ≤ ao da compra anterior no ciclo; reinicia ao zerar posição.
 * `barNum` na tabela: 1 = vela mais antiga carregada, `length` = mais recente.
 *
 * **High/low (OHLC):** armar alerta de preço / min edge usa o melhor preço de venda intrabar (`high×(1−slippage)`).
 * Stop-loss avalia o pior preço (`low×(1−slippage)`); stop-gain o melhor (`high×(1−slippage)`); na mesma vela com os dois
 * disparados, modo **optimistic** assume stop-gain primeiro, **conservative** assume stop-loss primeiro.
 * Zerar (flatten): dispara se o **mínimo** ou o **fecho** da vela tocarem o limiar; fill com `min(preço efetivo, limiar)` usando
 * o preço da trajetória relevante (mínimo quando o low tocou o limiar).
 * Vendas por sinal / pós-alertas: preço de execução simulado `max(ref fecho/open, high com slippage)` quando mais favorável.
 * Comissão: `feeRatePerSide` sobre o nocional de cada compra e sobre o bruto de cada venda.
 * Slippage: compra na ref. configurada; venda/stop nas refs acima com `s` = slippage % / 100.
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
  const buyAccumMaxCandlesForRobot = Math.min(
    ROBOT_BUY_ACCUM_MAX_CANDLES_MAX,
    Math.max(
      ROBOT_BUY_ACCUM_MAX_CANDLES_MIN,
      Math.floor(robot.buyAccumMaxCandles ?? ROBOT_BUY_ACCUM_MAX_CANDLES_DEFAULT)
    )
  );
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
  /** Zerar: após o primeiro sinal com posição o alerta fica armado até fechar; velas seguintes com sinal falso não desarmam. Saída: fecho ≤ limiar breakeven (e vendas opcionais pós-alertas); venda por sinal normal continua avaliada no mesmo ciclo. */
  let flattenArmed = false;
  /** Acumulação de compras: cada vela sem posição com sinal de compra verdadeiro conta um sinal; depois até N velas seguidas tenta comprar (1/vela), com ou sem sinal, até ao teto ou fim da janela. */
  let buyEdgesSinceFlat = 0;
  let buyAccumulationActive = false;
  let buyAccumLastOpenTime: string | null = null;
  let buyAccumCandlesInWindow = 0;
  /** Fatia USDT por operação na janela de acumulação (1.ª compra define; próximas repetem até ao teto). */
  let buySequentialSliceUsdt: number | null = null;

  const hasPostSellStrats = (robot.postFlattenSignalSellCombinedStrategyIds ?? []).length > 0;

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
    let high = parseHigh(k) ?? close;
    let low = parseLow(k) ?? close;
    if (low > high) {
      const t = low;
      low = high;
      high = t;
    }

    if (buyAccumulationActive && buyAccumLastOpenTime !== null && buyAccumLastOpenTime !== ot) {
      buyAccumCandlesInWindow += 1;
      buyAccumLastOpenTime = ot;
      if (buyAccumCandlesInWindow > buyAccumMaxCandlesForRobot) {
        buyAccumulationActive = false;
        buyAccumLastOpenTime = null;
        buyAccumCandlesInWindow = 0;
        buySequentialSliceUsdt = null;
        buyEdgesSinceFlat = 0;
      }
    }

    const buyRefPx = executionMode === "optimistic" ? Math.min(open, close) : close;
    const sellRefPx = executionMode === "optimistic" ? Math.max(open, close) : close;
    const buyPx = buyRefPx * (1 + slipDec);
    /** Preço de venda de referência no fecho (open/close conforme modo); património no fim da vela. */
    const sellPx = sellRefPx * (1 - slipDec);
    /** Pior preço de venda intrabar (long): mínimo da vela com slippage — stops de perda, flatten quando o low toca o limiar. */
    const sellPxLow = low * (1 - slipDec);
    /** Melhor preço de venda intrabar: máximo da vela com slippage — stops de ganho, armar alerta, min edge em vendas. */
    const sellPxHigh = high * (1 - slipDec);
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
    // Só contamos velas **com** sinal de compra (documentação: N-ésima vela flat em que o sinal é verdadeiro).
    // Não incrementar em velas sem sinal — isso atrasava a janela como se N fosse “velas após o 1.º sinal”.
    if (flatAtStart && buySig && !buyAccumulationActive) {
      buyEdgesSinceFlat += 1;
      if (buyEdgesSinceFlat >= nAccumStart) {
        buyAccumulationActive = true;
        buyAccumLastOpenTime = ot;
        buyAccumCandlesInWindow = 1;
      }
    }

    if (baseQty <= 1e-12) {
      flattenArmed = false;
    } else {
      const autoArmByPrice =
        robot.autoArmByPriceEnabled === true &&
        avgBuyBeforeExits != null &&
        buyerAlertArmMeetsMinEdge(robot, sellPxHigh, avgBuyBeforeExits);
      const armByFlattenSignal =
        (robot.flattenCombinedStrategyIds ?? []).length > 0 &&
        avgBuyBeforeExits != null &&
        robotFlattenOrTrue(robot, i, strategyResults) &&
        buyerAlertArmMeetsMinEdge(robot, sellPxHigh, avgBuyBeforeExits);
      flattenArmed = flattenArmed || autoArmByPrice || armByFlattenSignal;
    }

    // 1) Stops (loss/gain) — fecha posição completa; executa no preço-limite configurado quando cruzado intrabar.
    if (baseQty > 1e-12 && avgBuyBeforeExits != null && (robot.stopLossEnabled || robot.stopGainEnabled)) {
      let stopLossThresholdPx: number | null = null;
      if (robot.stopLossEnabled) {
        if (robot.stopLossMode === "percent") {
          const lossPct = Math.max(0, robot.stopLossPercent ?? 0);
          const th = avgBuyBeforeExits * (1 - lossPct / 100);
          if (Number.isFinite(th) && th > 0) stopLossThresholdPx = th;
        } else {
          const lossFixed = Math.max(0, robot.stopLossFixedUsdt ?? 0);
          const th = (quoteInPosition - lossFixed) / baseQty;
          if (Number.isFinite(th) && th > 0) stopLossThresholdPx = th;
        }
      }
      let stopGainThresholdPx: number | null = null;
      if (robot.stopGainEnabled) {
        if (robot.stopGainMode === "percent") {
          const gainPct = Math.max(0, robot.stopGainPercent ?? 0);
          const th = avgBuyBeforeExits * (1 + gainPct / 100);
          if (Number.isFinite(th) && th > 0) stopGainThresholdPx = th;
        } else {
          const gainFixed = Math.max(0, robot.stopGainFixedUsdt ?? 0);
          const th = (quoteInPosition + gainFixed) / baseQty;
          if (Number.isFinite(th) && th > 0) stopGainThresholdPx = th;
        }
      }
      const stopLossTrigger =
        stopLossThresholdPx != null && sellPxLow <= stopLossThresholdPx * (1 + 1e-9);
      const stopGainTrigger =
        stopGainThresholdPx != null && sellPxHigh >= stopGainThresholdPx * (1 - 1e-9);
      let stopExitPx: number | null = null;
      if (stopLossTrigger && stopGainTrigger) {
        stopExitPx =
          executionMode === "optimistic"
            ? (stopGainThresholdPx ?? sellPxHigh)
            : (stopLossThresholdPx ?? sellPxLow);
      } else if (stopLossTrigger) {
        stopExitPx = stopLossThresholdPx ?? sellPxLow;
      } else if (stopGainTrigger) {
        stopExitPx = stopGainThresholdPx ?? sellPxHigh;
      }
      if (stopExitPx != null) {
        const baseBefore = baseQty;
        const costBefore = quoteInPosition;
        const grossProceeds = baseQty * stopExitPx;
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

    // 2) Zerar: alerta armado; dispara se o fecho **ou** o mínimo da vela tocarem o limiar; fill no mínimo quando aplicável.
    if (baseQty > 1e-12 && flattenArmed) {
      const avgExit = quoteInPosition / baseQty;
      const flatBuf = robot.flattenBreakevenBufferPercent ?? 0;
      const flatHitClose = longFlattenCloseBreakeven(close, avgExit, flatBuf);
      const flatHitLow = longFlattenCloseBreakeven(low, avgExit, flatBuf);
      if (flatHitClose || flatHitLow) {
        const baseBefore = baseQty;
        const costBefore = quoteInPosition;
        if (avgBuyPriceAtExit == null) avgBuyPriceAtExit = avgExit;
        /** Breakeven: teto do preço efetivo = limite (médio com buffer); modo otimista não acrescenta lucro acima disso. */
        const flatRefPx = flatHitLow ? sellPxLow : sellPx;
        const effFlatPx = Math.min(flatRefPx, flattenBreakevenThresholdPrice(avgExit, flatBuf));
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

    // 3) Venda pós-alertas: com estratégias de zerar, só após o alerta armado; só com venda pós-alertas (sem zerar), basta posição aberta.
    const postSellGate = flattenArmed;
    if (baseQty > 1e-12 && hasPostSellStrats && postSellGate && robotPostFlattenSellOrTrue(robot, i, strategyResults)) {
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
    if (
      baseQty > 1e-12 &&
      avgBuyBeforeExits != null &&
      robotSellOrTrue(robot, i, strategyResults) &&
      buyerSignalExitMeetsMinEdge(robot, sellPxHigh, avgBuyBeforeExits)
    ) {
      const baseBefore = baseQty;
      const costBefore = quoteInPosition;
      const exitAvg = quoteInPosition / baseQty;
      if (avgBuyPriceAtExit == null) avgBuyPriceAtExit = exitAvg;
      const minEdgePx = buyerSignalExitMinEdgeThresholdPrice(robot, avgBuyBeforeExits);
      const signalExitPx =
        Number.isFinite(minEdgePx) && minEdgePx > 0 ? Math.max(sellPx, minEdgePx) : sellPx;
      const grossProceeds = baseQty * signalExitPx;
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

    // 5) Compra: acumulação ativa → …; a mercado só se buyRef estritamente abaixo do open (como no live sem LIMIT opcional); seguintes só vs última compra.
    const buyOncePerCandleBt = robot.buyOncePerCandle !== false;
    if (buyAccumulationActive) {
      while (true) {
        if (buyOncePerCandleBt && boughtThisOpenTime.has(ot)) break;
        if (
          !buyerAllowsAccumulationBuy(close, open, lastBuyFillPrice) ||
          !buyerMarketBuyRefStrictlyBelowCandleOpen(buyRefPx, open)
        ) {
          break;
        }
        const roomBelowRobotMax = Math.max(0, maxSpendUsdt - quoteInPosition);
        if (buySequentialSliceUsdt == null || !Number.isFinite(buySequentialSliceUsdt) || buySequentialSliceUsdt <= 0) {
          buySequentialSliceUsdt = computeNominalBuyOperationUsdt(robot, maxSpendUsdt);
        }
        let opUsdt = Math.min(buySequentialSliceUsdt, virtualFree, roomBelowRobotMax);
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
            buyUsdtThisBar += opUsdt;
            buyFills++;
            if (buyOncePerCandleBt) boughtThisOpenTime.add(ot);
            lastBuyFillPrice = buyPx;
            if (buyOncePerCandleBt) break;
            continue;
          }
          buyAccumulationActive = false;
          buyAccumLastOpenTime = null;
          buyAccumCandlesInWindow = 0;
          buySequentialSliceUsdt = null;
          buyEdgesSinceFlat = 0;
          break;
        }
        buyAccumulationActive = false;
        buyAccumLastOpenTime = null;
        buyAccumCandlesInWindow = 0;
        buySequentialSliceUsdt = null;
        buyEdgesSinceFlat = 0;
        break;
      }
    }

    if (hadPosAtBarStart && baseQty <= 1e-12) {
      buyEdgesSinceFlat = 0;
      buyAccumulationActive = false;
      buyAccumLastOpenTime = null;
      buyAccumCandlesInWindow = 0;
      buySequentialSliceUsdt = null;
    }

    const avgAfter = baseQty > 1e-12 ? quoteInPosition / baseQty : null;
    let gainPctUnrealized: number | null = null;
    let lossPctUnrealized: number | null = null;
    if (avgAfter != null) {
      const uHigh = ((sellPxHigh - avgAfter) / avgAfter) * 100;
      const uLow = ((sellPxLow - avgAfter) / avgAfter) * 100;
      if (uHigh > 0) gainPctUnrealized = uHigh;
      if (uLow < 0) lossPctUnrealized = -uLow;
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
