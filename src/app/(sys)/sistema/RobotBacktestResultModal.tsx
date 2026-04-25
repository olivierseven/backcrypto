"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatFeeDecimalAsPercentLabel } from "./backtestStorage";
import {
  buildRobotBacktestTradeCycles,
  type RobotBacktestExitReason,
  type RobotBacktestResult,
  type RobotBacktestRow,
  type RobotBacktestTradeCycle,
} from "./robotBacktest";
import type { SavedRobot } from "./robotsStorage";
import BacktestPnlAreaChart from "./BacktestPnlAreaChart";

function fmt2(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function fmtDateTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "—";
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString();
}

function fmtHours(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtSlippageSettingPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0%";
  const s = n.toFixed(2).replace(/\.?0+$/, "");
  return `${s}%`;
}

/** Tabela admin: só velas com posição no fecho, compra nesta vela ou saída (venda/stop). */
function rowHasOpenPositionOrExitActivity(row: RobotBacktestRow): boolean {
  const open =
    row.avgBuyPrice != null && Number.isFinite(row.avgBuyPrice) && row.avgBuyPrice > 0;
  const buyBar = Number.isFinite(row.buyUsdtThisBar) && row.buyUsdtThisBar > 1e-9;
  const exitBar =
    (Number.isFinite(row.sellProceedsThisBar) && row.sellProceedsThisBar > 1e-9) ||
    (Number.isFinite(row.stopProceedsThisBar) && row.stopProceedsThisBar > 1e-9);
  return open || buyBar || exitBar;
}

function labelBacktestExitReason(reason: RobotBacktestExitReason | null, tk: Record<string, string>): string {
  if (reason === "stop") return tk.backtestExitReasonStop ?? "Stop (loss/gain)";
  if (reason === "flatten") return tk.backtestExitReasonFlatten ?? "Flatten (breakeven)";
  if (reason === "signal_sell") return tk.backtestExitReasonSignalSell ?? "Sell signal";
  if (reason === "post_arm_sell")
    return tk.backtestExitReasonPostArmSell ?? "Sell after flatten signal (strategy)";
  return "—";
}

/** Linhas curtas para o mini-relatório (velas só com posição aberta agrupadas). */
function buildCompactCycleTimeline(cycle: RobotBacktestTradeCycle, tk: Record<string, string>): string[] {
  const rs = cycle.rows;
  const lines: string[] = [];
  let i = 0;
  while (i < rs.length) {
    const r = rs[i];
    const hasFlow =
      r.buyUsdtThisBar > 1e-9 ||
      r.sellProceedsThisBar > 1e-9 ||
      r.stopProceedsThisBar > 1e-9;
    if (hasFlow) {
      const bits: string[] = [`Bar ${r.barNum}`];
      if (r.buyUsdtThisBar > 1e-9) bits.push(`+${fmt2(r.buyUsdtThisBar)} USDT`);
      if (r.sellProceedsThisBar > 1e-9) bits.push(`sell ${fmt2(r.sellProceedsThisBar)} USDT`);
      if (r.stopProceedsThisBar > 1e-9) bits.push(`stop ${fmt2(r.stopProceedsThisBar)} USDT`);
      if (r.avgBuyPrice != null && Number.isFinite(r.avgBuyPrice) && r.avgBuyPrice > 0) bits.push(`avg ${fmt2(r.avgBuyPrice)}`);
      if (
        r.exitReason != null &&
        (r.sellProceedsThisBar > 1e-9 || r.stopProceedsThisBar > 1e-9)
      ) {
        bits.push(`→ ${labelBacktestExitReason(r.exitReason, tk)}`);
      }
      lines.push(bits.join(" · "));
      i++;
      continue;
    }
    let j = i + 1;
    while (j < rs.length) {
      const rj = rs[j];
      if (
        rj.buyUsdtThisBar > 1e-9 ||
        rj.sellProceedsThisBar > 1e-9 ||
        rj.stopProceedsThisBar > 1e-9
      )
        break;
      j++;
    }
    const lastHold = rs[j - 1];
    const spanLine = (tk.backtestAdminTradeHoldSpan ?? "Bars {from}–{to}: hold (no buy/sell on these closes)")
      .replace("{from}", String(rs[i].barNum))
      .replace("{to}", String(lastHold.barNum));
    const avgS =
      lastHold.avgBuyPrice != null && Number.isFinite(lastHold.avgBuyPrice) && lastHold.avgBuyPrice > 0
        ? fmt2(lastHold.avgBuyPrice)
        : "—";
    const foot = (tk.backtestAdminTradeHoldFoot ?? "Avg at last bar of span: {avg}; unreal. gain {g}; unreal. loss {l}")
      .replace("{avg}", avgS)
      .replace("{g}", fmtPct(lastHold.gainPctUnrealized))
      .replace("{l}", fmtPct(lastHold.lossPctUnrealized));
    lines.push(`${spanLine}. ${foot}`);
    i = j;
  }
  return lines;
}

function tradeCycleChipButtonClass(c: RobotBacktestTradeCycle, selected: boolean): string {
  const base = "text-[10px] font-medium rounded-md border px-2 py-0.5 tabular-nums transition-colors";
  if (!c.closed) {
    return `${base} ${
      selected
        ? "border-amber-600 bg-amber-200 text-amber-950"
        : "border-amber-300/80 bg-white text-amber-950 hover:bg-amber-100/80"
    }`;
  }
  const p = c.realizedPnlPct;
  if (p == null || !Number.isFinite(p)) {
    return `${base} ${
      selected
        ? "border-amber-600 bg-amber-200 text-amber-950"
        : "border-amber-300/80 bg-white text-amber-950 hover:bg-amber-100/80"
    }`;
  }
  if (p >= 0) {
    return `${base} ${
      selected
        ? "border-emerald-600 bg-emerald-200 text-emerald-950"
        : "border-emerald-400/90 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
    }`;
  }
  return `${base} ${
    selected
      ? "border-red-600 bg-red-200 text-red-950"
      : "border-red-400/90 bg-red-50 text-red-900 hover:bg-red-100"
  }`;
}

function tradeCycleBarLinkClass(c: RobotBacktestTradeCycle): string {
  const base = "shrink-0 underline font-semibold transition-colors";
  if (!c.closed) {
    return `${base} text-violet-700 hover:text-violet-900 decoration-violet-300`;
  }
  const p = c.realizedPnlPct;
  if (p == null || !Number.isFinite(p)) {
    return `${base} text-violet-700 hover:text-violet-900 decoration-violet-300`;
  }
  if (p >= 0) {
    return `${base} text-emerald-700 hover:text-emerald-900 decoration-emerald-300`;
  }
  return `${base} text-red-700 hover:text-red-900 decoration-red-300`;
}

type T = Record<string, string>;

const EMPTY_BACKTEST_ROWS: readonly RobotBacktestRow[] = [];

export default function RobotBacktestResultModal(props: {
  open: boolean;
  onClose: () => void;
  robot: SavedRobot | null;
  result: Extract<RobotBacktestResult, { ok: true }> | null;
  /** Só admin: vê botão e tabela por barra; utilizadores normais só resumo + buy & hold. */
  isAdmin?: boolean;
  t: T;
}) {
  const { open, onClose, robot, result, isAdmin = false, t } = props;
  const [barTableOpen, setBarTableOpen] = useState(false);
  const [selectedTradeCycleIdx, setSelectedTradeCycleIdx] = useState<number | null>(null);
  const [minimized, setMinimized] = useState(false);
  const tradeReportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (minimized) setMinimized(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, minimized]);

  useEffect(() => {
    if (open) {
      setBarTableOpen(false);
      setSelectedTradeCycleIdx(null);
    } else {
      setMinimized(false);
    }
  }, [open]);

  useEffect(() => {
    if (selectedTradeCycleIdx == null) return;
    tradeReportRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedTradeCycleIdx]);

  useEffect(() => {
    setSelectedTradeCycleIdx(null);
  }, [result]);

  const rowsForCycles = result != null ? result.rows : EMPTY_BACKTEST_ROWS;
  const tradeCycles = useMemo(() => buildRobotBacktestTradeCycles(rowsForCycles), [rowsForCycles]);
  const firstRowKeyToCycleIdx = useMemo(() => {
    const m = new Map<string, number>();
    tradeCycles.forEach((c, i) => {
      const r0 = c.rows[0];
      m.set(`${r0.barNum}_${r0.openTime}`, i);
    });
    return m;
  }, [tradeCycles]);

  if (!open || !result || !robot) return null;

  const { rows, summary } = result;
  const adminBarTableRows = rows.filter(rowHasOpenPositionOrExitActivity);
  const tk = t;

  const aliasShow = typeof robot.alias === "string" ? robot.alias.trim() : "";

  if (minimized) {
    const netCls = summary.netPnlUsdt >= 0 ? "text-emerald-700" : "text-red-700";
    return (
      <div className="fixed bottom-4 right-4 z-[1450] pointer-events-auto">
        <div className="flex items-stretch rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden max-w-[min(94vw,360px)]">
          <button
            type="button"
            onClick={() => setMinimized(false)}
            className="flex-1 min-w-0 px-3 py-2.5 text-left hover:bg-zinc-50 transition-colors"
          >
            <div className="text-xs font-semibold text-zinc-900 truncate">
              {tk.backtestModalTitle ?? "Backtest"}
              {aliasShow.length > 0 ? (
                <>
                  {" "}
                  <span className="text-zinc-700 font-medium">— {aliasShow}</span>
                </>
              ) : null}
            </div>
            <div className={`text-[11px] font-mono tabular-nums mt-0.5 ${netCls}`}>
              {(tk.backtestModalDockNetPnl ?? "Net P&L")}: {fmt2(summary.netPnlUsdt)} USDT ({fmtPct(summary.netPnlPct)})
            </div>
            <div className="text-[10px] text-violet-700 mt-1">{tk.backtestModalDockHint ?? "Click to expand"}</div>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-2.5 border-l border-zinc-200 text-lg leading-none text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
            aria-label={tk.close ?? "Close"}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  const th = "px-1.5 py-1 text-right font-medium border-b border-zinc-200 whitespace-nowrap text-[10px] leading-tight";
  const td = "px-1.5 py-0.5 text-right font-mono tabular-nums text-[10px] leading-tight";

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center p-3 bg-black/50"
      role="dialog"
      aria-modal
      aria-labelledby="robot-backtest-modal-title"
      onClick={() => setMinimized(true)}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-[min(96vw,1400px)] w-full max-h-[min(90vh,800px)] flex flex-col border border-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200">
          <h2 id="robot-backtest-modal-title" className="text-sm font-semibold text-zinc-900 truncate pr-2">
            {tk.backtestModalTitle ?? "Backtest"}
            {aliasShow.length > 0 ? (
              <>
                {" "}
                <span className="text-zinc-800 font-medium">— {aliasShow}</span>
              </>
            ) : null}
          </h2>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="shrink-0 px-2 py-1.5 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 whitespace-nowrap"
              aria-label={tk.backtestModalMinimizeAria ?? "Minimize report"}
              title={tk.backtestModalMinimizeAria ?? "Minimize"}
            >
              {tk.backtestModalMinimize ?? "Minimize"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100"
              aria-label={tk.close ?? "Close"}
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-4 py-3 space-y-4">
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-2 text-sm text-zinc-800">
            <p className="font-semibold text-violet-900">{tk.backtestSummaryTitle ?? "Summary"}</p>
            <ul className="grid gap-1 sm:grid-cols-2 font-mono text-xs tabular-nums">
              <li>
                <span className="text-zinc-600">{tk.backtestSumRange ?? "Range (bars)"}:</span>{" "}
                {summary.startBar} → {summary.endBar}
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumStartDate ?? "Start date"}:</span>{" "}
                {fmtDateTime(summary.startOpenTimeMs)}
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumEndDate ?? "End date"}:</span>{" "}
                {fmtDateTime(summary.endOpenTimeMs)}
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumTotalHours ?? "Total hours"}:</span>{" "}
                {fmtHours(summary.totalHours)}
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumInitial ?? "Initial USDT"}:</span> {fmt2(summary.initialUsdt)}
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumFinal ?? "Final equity"}:</span> {fmt2(summary.finalEquityUsdt)}
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumPnl ?? "Net P&L"}:</span>{" "}
                <span className={summary.netPnlUsdt >= 0 ? "text-emerald-700" : "text-red-700"}>
                  {fmt2(summary.netPnlUsdt)} USDT ({fmtPct(summary.netPnlPct)})
                </span>
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumBuys ?? "Buy fills"}:</span> {summary.buyFills}
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumTotalBuyUsdt ?? "Total bought (interval)"}:</span>{" "}
                {fmt2(summary.totalBuyUsdtInPeriod)} USDT
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumSells ?? "Sell fills"}:</span> {summary.sellFills}
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumStops ?? "Stop fills"}:</span> {summary.stopFills}
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumTotalOps ?? "Total operations"}:</span>{" "}
                {summary.buyFills + summary.sellFills + summary.stopFills}
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumAvgWinPct ?? "Avg win % (successful exits)"}:</span>{" "}
                <span className="text-emerald-700">{fmtPct(summary.avgWinRealizedPnlPct)}</span>
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumAvgOpPct ?? "Avg realized % per exit"}:</span>{" "}
                <span className={(summary.avgRealizedPnlPctPerOperation ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}>
                  {fmtPct(summary.avgRealizedPnlPctPerOperation)}
                </span>
              </li>
            </ul>
            <div className="border-t border-violet-200 pt-2 mt-2 space-y-1">
              <ul className="grid gap-1 sm:grid-cols-2 font-mono text-xs tabular-nums">
                <li>
                  <span className="text-zinc-600">{tk.backtestSumMaxDd ?? "Max drawdown"}:</span>{" "}
                  {fmtPct(summary.maxDrawdownPct)}
                </li>
                <li>
                  <span className="text-zinc-600">{tk.backtestSumMaxDdUsdt ?? "Max drawdown (USDT)"}:</span>{" "}
                  <span className="text-red-700">{fmt2(summary.maxDrawdownUsdt)} USDT</span>
                </li>
                <li>
                  <span className="text-zinc-600">{tk.backtestSumMaxGrossRealizedLossUsdt ?? "Max gross realized loss"}:</span>{" "}
                  <span className="text-red-700">
                    {fmt2(summary.maxRealizedGrossLossUsdt)} USDT
                    {summary.maxRealizedGrossLossPct != null && Number.isFinite(summary.maxRealizedGrossLossPct)
                      ? ` (${fmtPct(summary.maxRealizedGrossLossPct)})`
                      : ""}
                  </span>
                </li>
                <li>
                  <span className="text-zinc-600">{tk.backtestSumTotalGrossRealizedLossUsdt ?? "Total gross realized loss"}:</span>{" "}
                  <span className="text-red-700">{fmt2(summary.totalRealizedGrossLossUsdt)} USDT</span>
                </li>
              </ul>
            </div>
            <div className="border-t border-emerald-200 pt-2 mt-2 space-y-1">
              <ul className="grid gap-1 sm:grid-cols-2 font-mono text-xs tabular-nums">
                <li>
                  <span className="text-zinc-600">{tk.backtestSumMaxRunUp ?? "Max run-up"}:</span>{" "}
                  <span className="text-emerald-700">{fmtPct(summary.maxRunUpPct)}</span>
                </li>
                <li>
                  <span className="text-zinc-600">{tk.backtestSumMaxRunUpUsdt ?? "Max equity run-up (USDT)"}:</span>{" "}
                  <span className="text-emerald-700">{fmt2(summary.maxRunUpUsdt)} USDT</span>
                </li>
                <li>
                  <span className="text-zinc-600">{tk.backtestSumMaxGrossRealizedGainUsdt ?? "Max gross realized gain"}:</span>{" "}
                  <span className="text-emerald-700">
                    {fmt2(summary.maxRealizedGrossGainUsdt)} USDT
                    {summary.maxRealizedGrossGainPct != null && Number.isFinite(summary.maxRealizedGrossGainPct)
                      ? ` (${fmtPct(summary.maxRealizedGrossGainPct)})`
                      : ""}
                  </span>
                </li>
                <li>
                  <span className="text-zinc-600">{tk.backtestSumTotalGrossRealizedGainUsdt ?? "Total gross realized gain"}:</span>{" "}
                  <span className="text-emerald-700">{fmt2(summary.totalRealizedGrossGainUsdt)} USDT</span>
                </li>
              </ul>
            </div>
            <ul className="grid gap-1 sm:grid-cols-2 font-mono text-xs tabular-nums pt-2 border-t border-violet-100">
              <li>
                <span className="text-zinc-600">{tk.backtestSumFeeRate ?? "Fee per operation"}:</span>{" "}
                {formatFeeDecimalAsPercentLabel(summary.feeRatePerSide)}%
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumSlippage ?? "Slippage"}:</span>{" "}
                {fmtSlippageSettingPct(summary.slippagePercent)}
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumExecutionMode ?? "Execution mode"}:</span>{" "}
                {summary.executionMode === "optimistic"
                  ? (tk.backtestExecutionModeOptimistic ?? "Optimistic")
                  : (tk.backtestExecutionModeConservative ?? "Conservative")}
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumFeesBuy ?? "Buy fees (panel rate)"}:</span>{" "}
                {fmt2(summary.totalFeesBuyUsdt)} USDT
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumFeesSell ?? "Sell fees (panel rate)"}:</span>{" "}
                {fmt2(summary.totalFeesSellUsdt)} USDT
              </li>
              <li>
                <span className="text-zinc-600">{tk.backtestSumFeesTotal ?? "Total fees (panel rate)"}:</span>{" "}
                {fmt2(summary.totalFeesUsdt)} USDT
              </li>
            </ul>
            <p className="text-[10px] text-zinc-500 leading-snug pt-1 border-t border-violet-100">
              {tk.backtestDisclaimer ?? "Simulation on candle close; fee per side from Backtest panel. Not financial advice."}
            </p>
          </div>

          {rows.length > 0 ? (
            <BacktestPnlAreaChart
              rows={rows}
              initialUsdt={summary.initialUsdt}
              buyHoldNetPnlPct={
                summary.buyHoldNetPnlUsdt != null && summary.initialUsdt > 1e-9
                  ? (summary.buyHoldNetPnlUsdt / summary.initialUsdt) * 100
                  : summary.buyHoldNetPnlPct
              }
              title={tk.backtestPnlChartTitle ?? "% vs initial"}
              buyHoldLegend={
                summary.buyHoldNetPnlPct != null
                  ? (tk.backtestPnlChartBuyHoldLine ?? "Buy & hold")
                  : undefined
              }
            />
          ) : null}

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2 text-sm text-zinc-800">
            <p className="font-semibold text-emerald-900">
              {tk.backtestBuyHoldCardTitle ?? "Buy & hold (benchmark)"}
            </p>
            {summary.buyHoldFinalEquityUsdt != null &&
            summary.buyHoldNetPnlUsdt != null &&
            summary.buyHoldNetPnlPct != null &&
            summary.buyHoldNotionalUsdt != null ? (
              <>
                <ul className="font-mono text-xs tabular-nums space-y-1.5">
                  <li>
                    <span className="text-zinc-600">{tk.backtestBuyHoldNotional ?? "Notional (max robot budget)"}:</span>{" "}
                    {fmt2(summary.buyHoldNotionalUsdt)} USDT
                  </li>
                  <li>
                    <span className="text-zinc-600">{tk.backtestBuyHoldFinalEquity ?? "Final equity"}:</span>{" "}
                    {fmt2(summary.buyHoldFinalEquityUsdt)} USDT
                  </li>
                  <li>
                    <span className="text-zinc-600">{tk.backtestBuyHoldPnl ?? "P&L vs notional"}:</span>{" "}
                    <span
                      className={summary.buyHoldNetPnlUsdt >= 0 ? "text-emerald-800" : "text-red-700"}
                    >
                      {fmt2(summary.buyHoldNetPnlUsdt)} USDT ({fmtPct(summary.buyHoldNetPnlPct)})
                    </span>
                  </li>
                </ul>
                <p className="text-[10px] text-zinc-600 leading-snug border-t border-emerald-100 pt-2">
                  {tk.backtestSumBuyHoldHint ??
                    "Notional = total bought; buy at first bar close, hold to last bar close."}
                </p>
              </>
            ) : (
              <p className="text-xs text-zinc-500">{tk.backtestBuyHoldUnavailable ?? "—"}</p>
            )}
          </div>

          {isAdmin && tradeCycles.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-950">
                {tk.backtestAdminTradeCyclesTitle ?? "Position cycles (debug)"}
              </p>
              <p className="text-[10px] text-zinc-600 leading-snug">
                {tk.backtestAdminTradeCyclesHint ??
                  "Each chip is one round-trip from the first buy to the exit (or still open at the end)."}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tradeCycles.map((c, i) => {
                  const chip =
                    (tk.backtestAdminTradeCycleChip ?? "#{n} bars {from}→{to}")
                      .replace("{n}", String(c.index))
                      .replace("{from}", String(c.startBar))
                      .replace("{to}", String(c.endBar));
                  const sel = selectedTradeCycleIdx === i;
                  return (
                    <button
                      key={`tc_${c.index}_${c.startBar}_${c.endBar}`}
                      type="button"
                      onClick={() => setSelectedTradeCycleIdx(i)}
                      className={tradeCycleChipButtonClass(c, sel)}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
              {selectedTradeCycleIdx != null && tradeCycles[selectedTradeCycleIdx] ? (
                <div
                  ref={tradeReportRef}
                  className="rounded-md border border-amber-200/90 bg-white/90 p-3 text-[11px] text-zinc-800 space-y-2 leading-snug"
                >
                  {(() => {
                    const c = tradeCycles[selectedTradeCycleIdx];
                    const title = (tk.backtestAdminTradeReportTitle ?? "Cycle #{n}").replace("{n}", String(c.index));
                    const timeline = buildCompactCycleTimeline(c, tk);
                    return (
                      <>
                        <p className="font-semibold text-zinc-900">{title}</p>
                        <ul className="space-y-1 font-mono tabular-nums text-[10px]">
                          <li>
                            <span className="text-zinc-500">{tk.backtestAdminTradeBars ?? "Bars"}:</span>{" "}
                            {c.startBar} → {c.endBar}{" "}
                            <span className="text-zinc-400">
                              ({tk.backtestAdminTradeCalendar ?? "Time"}: {fmtDateTime(c.startOpenTimeMs)} —{" "}
                              {fmtDateTime(c.endOpenTimeMs)})
                            </span>
                          </li>
                          <li>
                            <span className="text-zinc-500">{tk.backtestAdminTradeBarCount ?? "Bars in cycle"}:</span>{" "}
                            {c.rows.length}
                          </li>
                          <li>
                            <span className="text-zinc-500">{tk.backtestAdminTradeBuyFills ?? "Buy fills"}:</span>{" "}
                            {c.buyFillCount}
                          </li>
                          <li>
                            <span className="text-zinc-500">{tk.backtestAdminTradeTotalBuy ?? "Total bought"}:</span>{" "}
                            {fmt2(c.totalBuyUsdt)} USDT
                          </li>
                          <li>
                            <span className="text-zinc-500">
                              {tk.backtestAdminTradeMaxUnrealGain ?? "Max unrealized gain %"}:
                            </span>{" "}
                            <span className="text-emerald-700">{fmtPct(c.maxGainPctUnrealized)}</span>
                          </li>
                          <li>
                            <span className="text-zinc-500">
                              {tk.backtestAdminTradeMaxUnrealLoss ?? "Max unrealized loss %"}:
                            </span>{" "}
                            <span className="text-red-700">{fmtPct(c.maxLossPctUnrealized)}</span>
                          </li>
                          <li>
                            <span className="text-zinc-500">{tk.backtestAdminTradeEquityStart ?? "Equity (first bar)"}:</span>{" "}
                            {fmt2(c.firstBarEquityUsdt)} USDT
                          </li>
                          <li>
                            <span className="text-zinc-500">{tk.backtestAdminTradeEquityEnd ?? "Equity (last bar)"}:</span>{" "}
                            {fmt2(c.lastBarEquityUsdt)} USDT
                          </li>
                          {c.closed ? (
                            <>
                              <li>
                                <span className="text-zinc-500">{tk.backtestAdminTradeExit ?? "Exit"}:</span>{" "}
                                {labelBacktestExitReason(c.exitReason, tk)}
                              </li>
                              <li>
                                <span className="text-zinc-500">
                                  {tk.backtestAdminTradeExitProceeds ?? "Net proceeds (exit bar)"}:
                                </span>{" "}
                                {fmt2(c.exitNetProceedsUsdt)} USDT
                              </li>
                              <li>
                                <span className="text-zinc-500">{tk.backtestAdminTradeRealizedPct ?? "Realized P&L %"}:</span>{" "}
                                <span className={(c.realizedPnlPct ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}>
                                  {fmtPct(c.realizedPnlPct)}
                                </span>
                              </li>
                            </>
                          ) : (
                            <li className="text-amber-900 font-medium">{tk.backtestAdminTradeStillOpen ?? "Still open."}</li>
                          )}
                        </ul>
                        <div className="border-t border-amber-100 pt-2">
                          <p className="text-[10px] font-medium text-zinc-600 mb-1">
                            {tk.backtestAdminTradeTimeline ?? "Timeline (compact)"}
                          </p>
                          <ul className="list-disc pl-4 space-y-0.5 text-[10px] font-mono text-zinc-700">
                            {timeline.map((line, li) => (
                              <li key={li}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          ) : null}

          {isAdmin && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setBarTableOpen((v) => !v)}
                className="text-[11px] font-medium rounded-md border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 px-2.5 py-1"
              >
                {barTableOpen
                  ? (tk.backtestAdminHideBarTable ?? "Hide bar table")
                  : (tk.backtestAdminViewBarTable ?? "View bar table")}
              </button>
              {barTableOpen && (
                <div className="max-h-[min(38vh,320px)] overflow-auto rounded-lg border border-zinc-200">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 text-zinc-700">
                        <th className={`sticky left-0 z-[1] bg-zinc-50 ${th} border-r border-zinc-100`}>
                          {tk.backtestColBar ?? "Bar"}
                        </th>
                        <th className={th}>{tk.backtestColClose ?? "Close"}</th>
                        <th className={th}>{tk.backtestColEquity ?? "Equity"}</th>
                        <th className={th}>{tk.backtestColCumulativeBuy ?? "Cumulative bought"}</th>
                        <th className={th}>{tk.backtestColBuyThisBar ?? "Buy (bar)"}</th>
                        <th className={th}>{tk.backtestColAvgBuy ?? "Avg buy"}</th>
                        <th className={th}>{tk.backtestColAvgAtExit ?? "Avg entry (closed)"}</th>
                        <th className={th}>{tk.backtestColExitReason ?? "Exit reason"}</th>
                        <th className={th}>{tk.backtestColSellThisBar ?? "Sell (bar)"}</th>
                        <th className={th}>{tk.backtestColAvgSell ?? "Avg sell"}</th>
                        <th className={th}>{tk.backtestColRealizedSellPct ?? "Realized % (sell)"}</th>
                        <th className={th}>{tk.backtestColStopThisBar ?? "Stop (bar)"}</th>
                        <th className={th}>{tk.backtestColAvgStop ?? "Avg stop"}</th>
                        <th className={th}>{tk.backtestColRealizedStopPct ?? "Realized % (stop)"}</th>
                        <th className={th}>{tk.backtestColGainPct ?? "Unreal. gain %"}</th>
                        <th className={th}>{tk.backtestColLossPct ?? "Unreal. loss %"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminBarTableRows.map((row, idx) => {
                        const cycleIdx = firstRowKeyToCycleIdx.get(`${row.barNum}_${row.openTime}`);
                        const cycleForLink = cycleIdx != null ? tradeCycles[cycleIdx] : null;
                        return (
                        <tr key={`${row.barNum}_${row.openTime}_${idx}`} className="border-b border-zinc-100 hover:bg-zinc-50/80">
                          <td className="sticky left-0 bg-white px-1.5 py-0.5 text-right font-mono tabular-nums text-zinc-600 text-[10px] border-r border-zinc-100">
                            <span className="inline-flex items-center justify-end gap-1 w-full">
                              {cycleForLink != null ? (
                                <button
                                  type="button"
                                  className={tradeCycleBarLinkClass(cycleForLink)}
                                  onClick={() => {
                                    if (cycleIdx !== undefined) setSelectedTradeCycleIdx(cycleIdx);
                                  }}
                                  title={tk.backtestAdminTradeCyclesTitle ?? "Cycle report"}
                                >
                                  #{cycleForLink.index}
                                </button>
                              ) : null}
                              <span>{row.barNum}</span>
                            </span>
                          </td>
                          <td className={td}>{fmt2(row.close)}</td>
                          <td className={td}>{fmt2(row.equityUsdt)}</td>
                          <td className={td}>{fmt2(row.cumulativeBuyUsdt)}</td>
                          <td className={td}>{fmt2(row.buyUsdtThisBar)}</td>
                          <td className={td}>{fmt2(row.avgBuyPrice)}</td>
                          <td className={td}>{fmt2(row.avgBuyPriceAtExit)}</td>
                          <td className={`${td} text-zinc-700 whitespace-nowrap`}>
                            {labelBacktestExitReason(row.exitReason, tk)}
                          </td>
                          <td className={td}>{fmt2(row.sellProceedsThisBar)}</td>
                          <td className={td}>{fmt2(row.avgSellPriceThisBar)}</td>
                          <td
                            className={`${td} ${
                              (row.sellRealizedPnlPct ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"
                            }`}
                          >
                            {fmtPct(row.sellRealizedPnlPct)}
                          </td>
                          <td className={td}>{fmt2(row.stopProceedsThisBar)}</td>
                          <td className={td}>{fmt2(row.avgStopPriceThisBar)}</td>
                          <td
                            className={`${td} ${
                              (row.stopRealizedPnlPct ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"
                            }`}
                          >
                            {fmtPct(row.stopRealizedPnlPct)}
                          </td>
                          <td className={`${td} text-emerald-700`}>{fmtPct(row.gainPctUnrealized)}</td>
                          <td className={`${td} text-red-700`}>{fmtPct(row.lossPctUnrealized)}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
