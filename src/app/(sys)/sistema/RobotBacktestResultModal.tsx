"use client";

import { useEffect, useState } from "react";
import { formatFeeDecimalAsPercentLabel } from "./backtestStorage";
import type { RobotBacktestExitReason, RobotBacktestResult } from "./robotBacktest";
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

function labelBacktestExitReason(reason: RobotBacktestExitReason | null, tk: Record<string, string>): string {
  if (reason === "stop") return tk.backtestExitReasonStop ?? "Stop (loss/gain)";
  if (reason === "flatten") return tk.backtestExitReasonFlatten ?? "Flatten (breakeven)";
  if (reason === "signal_sell") return tk.backtestExitReasonSignalSell ?? "Sell signal";
  if (reason === "post_arm_sell")
    return tk.backtestExitReasonPostArmSell ?? "Sell after flatten signal (strategy)";
  return "—";
}

type T = Record<string, string>;

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setBarTableOpen(false);
  }, [open]);

  if (!open || !result || !robot) return null;

  const { rows, summary } = result;
  const tk = t;

  const aliasShow = typeof robot.alias === "string" ? robot.alias.trim() : "";

  const th = "px-1.5 py-1 text-right font-medium border-b border-zinc-200 whitespace-nowrap text-[10px] leading-tight";
  const td = "px-1.5 py-0.5 text-right font-mono tabular-nums text-[10px] leading-tight";

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center p-3 bg-black/50"
      role="dialog"
      aria-modal
      aria-labelledby="robot-backtest-modal-title"
      onClick={onClose}
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
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100"
            aria-label={tk.close ?? "Close"}
          >
            ×
          </button>
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
                      {rows.map((row, idx) => (
                        <tr key={`${row.barNum}_${row.openTime}_${idx}`} className="border-b border-zinc-100 hover:bg-zinc-50/80">
                          <td className="sticky left-0 bg-white px-1.5 py-0.5 text-right font-mono tabular-nums text-zinc-600 text-[10px] border-r border-zinc-100">
                            {row.barNum}
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
                      ))}
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
