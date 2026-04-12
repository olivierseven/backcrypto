"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/app/constants";
import {
  computeRobotLiveReportSummary,
  type RobotPerformanceApiEvent,
} from "./robotLiveReportSummary";
import type { SavedRobot } from "./robotsStorage";

function fmt2(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function fmtDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString();
}

function defaultFromYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultToYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

type T = Record<string, string>;

export default function RobotLiveReportModal(props: {
  open: boolean;
  onClose: () => void;
  robot: SavedRobot | null;
  /** Se definido, filtra eventos deste par (ex.: símbolo do gráfico). */
  symbolFilter?: string | null;
  t: T;
}) {
  const { open, onClose, robot, symbolFilter, t } = props;
  const tk = t;
  const [fromYmd, setFromYmd] = useState(defaultFromYmd);
  const [toYmd, setToYmd] = useState(defaultToYmd);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<RobotPerformanceApiEvent[]>([]);
  const [rangeLabel, setRangeLabel] = useState<{ from: string; to: string } | null>(null);

  async function fetchReport(): Promise<void> {
    if (!robot) return;
    setLoading(true);
    setError(null);
    try {
      const from = new Date(fromYmd + "T00:00:00");
      const to = new Date(toYmd + "T23:59:59.999");
      if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
        setError(tk.robotsLiveReportInvalidPeriod ?? "Invalid period.");
        setLoading(false);
        return;
      }
      if (from > to) {
        setError(tk.robotsLiveReportInvalidPeriod ?? "Invalid period.");
        setLoading(false);
        return;
      }
      const params = new URLSearchParams({
        robotId: robot.id,
        from: from.toISOString(),
        to: to.toISOString(),
        limit: "1000",
      });
      const sym = symbolFilter?.trim().toUpperCase();
      if (sym) params.set("symbol", sym);
      const res = await fetch(`${API_BASE}/user/robot-performance?${params.toString()}`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        events?: RobotPerformanceApiEvent[];
        from?: string;
        to?: string;
        error?: string;
      };
      if (!res.ok || data.ok !== true || !Array.isArray(data.events)) {
        setError(data.error ?? (tk.robotsLiveReportError ?? "Could not load report."));
        setEvents([]);
        setRangeLabel(null);
        setLoading(false);
        return;
      }
      setEvents(data.events);
      setRangeLabel(
        data.from && data.to ? { from: data.from, to: data.to } : { from: from.toISOString(), to: to.toISOString() }
      );
    } catch {
      setError(tk.robotsLiveReportError ?? "Could not load report.");
      setEvents([]);
      setRangeLabel(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !robot) return;
    void fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir / mudar robô; datas via "Atualizar"
  }, [open, robot?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !robot) return null;

  const aliasShow = typeof robot.alias === "string" ? robot.alias.trim() : "";
  const periodFromMs = rangeLabel ? Date.parse(rangeLabel.from) : NaN;
  const periodToMs = rangeLabel ? Date.parse(rangeLabel.to) : NaN;
  const summary = computeRobotLiveReportSummary(
    events,
    Number.isFinite(periodFromMs) ? periodFromMs : Date.now(),
    Number.isFinite(periodToMs) ? periodToMs : Date.now()
  );

  const th = "text-zinc-600";
  const td = "font-mono tabular-nums text-xs";

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center p-3 bg-black/50"
      role="dialog"
      aria-modal
      aria-labelledby="robot-live-report-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-[min(96vw,720px)] w-full max-h-[min(90vh,800px)] flex flex-col border border-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200">
          <h2 id="robot-live-report-title" className="text-sm font-semibold text-zinc-900 truncate pr-2">
            {tk.robotsLiveReportTitle ?? "Live report"}
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

        <div className="shrink-0 px-4 py-3 border-b border-zinc-100 flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-0.5 text-xs">
            <span className="text-zinc-600">{tk.robotsLiveReportPeriodFrom ?? "From"}</span>
            <input
              type="date"
              value={fromYmd}
              onChange={(e) => setFromYmd(e.target.value)}
              className="border border-zinc-300 rounded px-2 py-1 text-xs"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs">
            <span className="text-zinc-600">{tk.robotsLiveReportPeriodTo ?? "To"}</span>
            <input
              type="date"
              value={toYmd}
              onChange={(e) => setToYmd(e.target.value)}
              className="border border-zinc-300 rounded px-2 py-1 text-xs"
            />
          </label>
          <button
            type="button"
            onClick={() => void fetchReport()}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? (tk.robotsLiveReportLoading ?? "Loading…") : (tk.robotsLiveReportRefresh ?? "Refresh")}
          </button>
          {symbolFilter?.trim() ? (
            <span className="text-[10px] text-zinc-500">
              {(tk.robotsLiveReportSymbolFilter ?? "Symbol: {s}").replace("{s}", symbolFilter.trim().toUpperCase())}
            </span>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-4 py-3 space-y-3">
          {loading ? (
            <p className="text-sm text-zinc-500">{tk.robotsLiveReportLoading ?? "Loading…"}</p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!loading && !error && events.length === 0 ? (
            <p className="text-sm text-zinc-500">{tk.robotsLiveReportNoEvents ?? "No operations in this period."}</p>
          ) : null}

          {!loading && !error && rangeLabel ? (
            <p className="text-xs text-zinc-500">
              {tk.robotsLiveReportRange ?? "Period"}: {fmtDateTime(rangeLabel.from)} → {fmtDateTime(rangeLabel.to)}
            </p>
          ) : null}

          {!loading && !error ? (
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-2 text-sm text-zinc-800">
            <p className="font-semibold text-violet-900">{tk.robotsLiveReportSummaryTitle ?? "Summary"}</p>
            <p className="text-[10px] text-zinc-600">{tk.robotsLiveReportDisclaimer ?? ""}</p>
            <ul className="grid gap-1 sm:grid-cols-2 font-mono text-xs tabular-nums">
              <li>
                <span className={th}>{tk.robotsLiveReportEventsCount ?? "Events"}:</span> {summary.eventCount}
              </li>
              <li>
                <span className={th}>{tk.robotsLiveReportSumBuyOps ?? "Buy operations"}:</span> {summary.buyOps}
              </li>
              <li>
                <span className={th}>{tk.robotsLiveReportSumSellSignal ?? "Sell (signal)"}:</span>{" "}
                {summary.sellSignalOps}
              </li>
              <li>
                <span className={th}>{tk.robotsLiveReportSumFlatten ?? "Flatten"}:</span> {summary.sellFlattenOps}
              </li>
              <li>
                <span className={th}>{tk.robotsLiveReportSumStopLoss ?? "Stop loss"}:</span> {summary.stopLossOps}
              </li>
              <li>
                <span className={th}>{tk.robotsLiveReportSumStopGain ?? "Take profit"}:</span> {summary.stopGainOps}
              </li>
              <li>
                <span className={th}>{tk.robotsLiveReportSumBuyUsdt ?? "Total bought (USDT)"}:</span>{" "}
                <span className={td}>{fmt2(summary.totalBuyQuoteUsdt)} USDT</span>
              </li>
              <li>
                <span className={th}>{tk.robotsLiveReportSumSellUsdt ?? "Total sold (USDT)"}:</span>{" "}
                <span className={td}>{fmt2(summary.totalSellQuoteUsdt)} USDT</span>
              </li>
              <li>
                <span className={th}>{tk.robotsLiveReportSumFees ?? "Fees (USDT in fills)"}:</span>{" "}
                <span className={td}>{fmt2(summary.totalFeesUsdt)} USDT</span>
              </li>
              <li>
                <span className={th}>{tk.robotsLiveReportSumNetRealized ?? "Net realized P&L (avg. cost)"}:</span>{" "}
                <span className={summary.netRealizedPnlUsdt >= 0 ? "text-emerald-700" : "text-red-700"}>
                  {fmt2(summary.netRealizedPnlUsdt)} USDT
                </span>
              </li>
              <li>
                <span className={th}>{tk.robotsLiveReportSumMaxDdNav ?? "Max drawdown (nav flow approx.)"}:</span>{" "}
                <span className="text-red-700">{fmtPct(summary.maxDrawdownNavPct)}</span>
              </li>
              <li>
                <span className={th}>{tk.robotsLiveReportSumMaxRunUpNav ?? "Max run-up (nav flow approx.)"}:</span>{" "}
                <span className="text-emerald-700">{fmtPct(summary.maxRunUpNavPct)}</span>
              </li>
              <li>
                <span className={th}>{tk.robotsLiveReportSumOpenBase ?? "Open position (base)"}:</span>{" "}
                <span className={td}>{fmt2(summary.openPositionBaseQty)}</span>
              </li>
              <li>
                <span className={th}>{tk.robotsLiveReportSumOpenCost ?? "Open position (cost USDT)"}:</span>{" "}
                <span className={td}>{fmt2(summary.openPositionCostUsdt)} USDT</span>
              </li>
            </ul>
          </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
