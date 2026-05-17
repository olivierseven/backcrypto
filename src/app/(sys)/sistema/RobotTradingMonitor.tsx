"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "@/app/constants";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { useChartHeader } from "./ChartHeaderContext";
import { useChartSymbol } from "./ChartSymbolContext";
import {
  ROBOTS_CHANGED_EVENT,
  loadSavedRobots,
  type SavedRobot,
} from "./robotsStorage";
import { appendRobotLiveActivityEvent } from "./robotLiveSessionSync";
import { dispatchRobotPositionSellClear } from "./robotLiveOrders";
import {
  armRobotManualBuySignal,
  executeRobotManualMarketBuy,
  executeRobotManualMarketSell,
} from "./robotLiveManualActions";
import {
  getRobotPosition,
  loadRobotPositionMap,
  ROBOT_POSITION_BUY_EVENT,
  ROBOT_POSITION_SELL_CLEAR_EVENT,
  type RobotOpenPosition,
} from "./robotPositionStorage";

function formatQtyForMarketOrder(n: number): string {
  if (!Number.isFinite(n) || n <= 0) throw new Error("invalid_quantity");
  const s = n.toFixed(8).replace(/\.?0+$/, "").replace(/\.$/, "");
  return s.length > 0 ? s : "0";
}

function isUsdtSpotPair(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  return s.endsWith("USDT") && s.length > 4;
}

type RobotHudRow = {
  robot: SavedRobot;
  position: RobotOpenPosition | null;
  pnlPct: number | null;
  pnlUsdt: number | null;
};

function robotLabel(robot: SavedRobot): string {
  const alias = robot.alias?.trim();
  if (alias) return alias;
  return `#${robot.id.slice(-6)}`;
}

/**
 * Atualiza PnL vs pre├ºo m├®dio de compras (posi├º├úo persistida) e opcionalmente dispara stop loss/stop gain a mercado.
 * Compras devem ser registadas com o evento `backcrypto-robot-position-buy` (ver robotPositionStorage).
 */
export default function RobotTradingMonitor() {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines as Record<string, string>;
  const { symbol } = useChartSymbol();
  const { data: headerData } = useChartHeader();
  const lastPrice = headerData.lastPriceUsdt;

  const [robotsTick, setRobotsTick] = useState(0);
  const [posTick, setPosTick] = useState(0);
  const [pendingClearRobotId, setPendingClearRobotId] = useState<string | null>(null);
  const [busyRobotId, setBusyRobotId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<string | null>(null);
  const stopInFlightRef = useRef<Set<string>>(new Set());
  const lastStopAtRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const onRobots = () => setRobotsTick((x) => x + 1);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "crypto_sistema_robot_position_v1" || e.key === null) setPosTick((x) => x + 1);
    };
    const onPosEvent = () => setPosTick((x) => x + 1);
    window.addEventListener(ROBOTS_CHANGED_EVENT, onRobots);
    window.addEventListener("storage", onStorage);
    window.addEventListener(ROBOT_POSITION_BUY_EVENT, onPosEvent);
    window.addEventListener(ROBOT_POSITION_SELL_CLEAR_EVENT, onPosEvent);
    return () => {
      window.removeEventListener(ROBOTS_CHANGED_EVENT, onRobots);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ROBOT_POSITION_BUY_EVENT, onPosEvent);
      window.removeEventListener(ROBOT_POSITION_SELL_CLEAR_EVENT, onPosEvent);
    };
  }, []);

  const activeBuyerRobots = useMemo(() => {
    return loadSavedRobots().filter(
      (r) => r.isActive && r.side === "buyer" && r.buyCombinedStrategyIds.length > 0
    );
  }, [robotsTick]);

  const sym = symbol?.trim().toUpperCase() ?? "";
  const symOk = sym.length > 0 && isUsdtSpotPair(sym);

  const hudRows = useMemo((): RobotHudRow[] => {
    if (!symOk) return [];
    void loadRobotPositionMap();
    return activeBuyerRobots.map((robot) => {
      const position = getRobotPosition(robot.id, sym);
      const hasPos = position != null && position.totalBaseQty > 1e-12;
      if (!hasPos || lastPrice == null || !Number.isFinite(lastPrice) || lastPrice <= 0) {
        return { robot, position: hasPos ? position : null, pnlPct: null, pnlUsdt: null };
      }
      const pnlPct = ((lastPrice - position!.avgBuyPrice) / position!.avgBuyPrice) * 100;
      const pnlUsdt = position!.totalBaseQty * lastPrice - position!.totalQuoteSpent;
      return { robot, position, pnlPct, pnlUsdt };
    });
  }, [activeBuyerRobots, sym, symOk, lastPrice, posTick]);

  const manualErrorMessage = useCallback(
    (reason: string) => {
      switch (reason) {
        case "not_connected":
          return t.robotsHudErrNotConnected ?? "Binance not connected.";
        case "no_usdt":
          return t.robotsHudErrNoUsdt ?? "No USDT balance.";
        case "no_quote":
          return t.robotsHudErrNoQuote ?? "Could not compute buy size.";
        case "no_position":
          return t.robotsHudErrNoPosition ?? "No tracked position.";
        default:
          return t.robotsHudErrOrder ?? "Order failed.";
      }
    },
    [t]
  );

  const tryStops = useCallback(
    async (robot: SavedRobot, pos: RobotOpenPosition) => {
      if ((!robot.stopLossEnabled && !robot.stopGainEnabled) || !lastPrice || lastPrice <= 0) return;
      const currentVal = pos.totalBaseQty * lastPrice;
      const lossPct = ((pos.avgBuyPrice - lastPrice) / pos.avgBuyPrice) * 100;
      const gainPct = ((lastPrice - pos.avgBuyPrice) / pos.avgBuyPrice) * 100;
      const lossUsdt = Math.max(0, pos.totalQuoteSpent - currentVal);
      const gainUsdt = Math.max(0, currentVal - pos.totalQuoteSpent);
      const stopLossTrigger =
        robot.stopLossEnabled &&
        (robot.stopLossMode === "percent"
          ? lastPrice < pos.avgBuyPrice && lossPct >= robot.stopLossPercent - 1e-9
          : lossUsdt >= robot.stopLossFixedUsdt - 1e-9);
      const stopGainTrigger =
        robot.stopGainEnabled &&
        (robot.stopGainMode === "percent"
          ? lastPrice > pos.avgBuyPrice && gainPct >= robot.stopGainPercent - 1e-9
          : gainUsdt >= robot.stopGainFixedUsdt - 1e-9);
      const trigger = stopLossTrigger || stopGainTrigger;
      if (!trigger) return;

      const id = robot.id;
      if (stopInFlightRef.current.has(id)) return;
      const now = Date.now();
      const last = lastStopAtRef.current.get(id) ?? 0;
      if (now - last < 15_000) return;

      stopInFlightRef.current.add(id);
      try {
        let qtyStr: string;
        try {
          qtyStr = formatQtyForMarketOrder(pos.totalBaseQty);
        } catch {
          stopInFlightRef.current.delete(id);
          return;
        }
        const executionRole = stopLossTrigger ? "STOP_LOSS" : "STOP_GAIN";
        const res = await fetch(`${API_BASE}/user/binance-connection/order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            symbol: sym,
            side: "SELL",
            type: "MARKET",
            quantity: qtyStr,
            robotId: robot.id,
            robotAlias: robot.alias ?? "",
            executionRole,
          }),
        });
        if (res.ok) {
          appendRobotLiveActivityEvent(id, sym, stopLossTrigger ? "stop_loss" : "stop_gain", {
            baseQty: pos.totalBaseQty,
            avgBuyPrice: pos.avgBuyPrice,
          });
          dispatchRobotPositionSellClear(id, sym);
          setPosTick((x) => x + 1);
          lastStopAtRef.current.set(id, now);
          try {
            window.dispatchEvent(new CustomEvent("backcrypto-spot-order-placed"));
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      } finally {
        stopInFlightRef.current.delete(id);
      }
    },
    [lastPrice, sym]
  );

  useEffect(() => {
    if (!symOk || lastPrice == null || !Number.isFinite(lastPrice) || lastPrice <= 0) return;
    for (const row of hudRows) {
      if (row.position && row.position.totalBaseQty > 1e-12) {
        void tryStops(row.robot, row.position);
      }
    }
  }, [hudRows, symOk, lastPrice, tryStops]);

  useEffect(() => {
    if (pendingClearRobotId != null && !hudRows.some((r) => r.robot.id === pendingClearRobotId && r.position)) {
      setPendingClearRobotId(null);
    }
  }, [hudRows, pendingClearRobotId]);

  const runManualBuy = async (robot: SavedRobot) => {
    setBusyRobotId(robot.id);
    setLastError(null);
    setLastOk(null);
    const res = await executeRobotManualMarketBuy(robot, sym);
    setBusyRobotId(null);
    if (!res.ok) setLastError(manualErrorMessage(res.reason));
    else {
      setLastOk(t.robotsHudOkBuy ?? "Buy order sent.");
      setPosTick((x) => x + 1);
    }
  };

  const runManualSell = async (robot: SavedRobot) => {
    setBusyRobotId(robot.id);
    setLastError(null);
    setLastOk(null);
    const res = await executeRobotManualMarketSell(robot, sym);
    setBusyRobotId(null);
    if (!res.ok) setLastError(manualErrorMessage(res.reason));
    else {
      setLastOk(t.robotsHudOkSell ?? "Sell order sent.");
      setPosTick((x) => x + 1);
    }
  };

  const runManualBuySignal = (robot: SavedRobot) => {
    setLastError(null);
    setLastOk(null);
    armRobotManualBuySignal(robot, sym);
    setLastOk(
      t.robotsHudOkSignal ??
        "Accumulation window on — robot will try to buy when price rules allow (red forming candle, etc.)."
    );
  };

  if (!symOk || hudRows.length === 0) return null;

  const handleConfirmForgetPosition = () => {
    if (!pendingClearRobotId || !sym) return;
    dispatchRobotPositionSellClear(pendingClearRobotId, sym);
    setPendingClearRobotId(null);
    setPosTick((x) => x + 1);
  };

  return (
    <div
      className="pointer-events-auto fixed left-2 z-[1250] max-w-[min(100vw-1rem,24rem)] rounded-lg border border-violet-200 bg-white/95 px-2 py-1.5 text-[10px] shadow-md sm:text-[11px]"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.5rem)" }}
      aria-live="polite"
    >
      <p className="font-semibold text-violet-900 mb-1">{t.robotsHudActiveTitle ?? "Active robots"}</p>
      <p className="text-[9px] text-zinc-500 mb-1.5 font-sans">{sym}</p>
      {lastError ? (
        <p className="mb-1.5 rounded border border-red-200 bg-red-50 px-1.5 py-1 text-[9px] text-red-800 font-sans">
          {lastError}
        </p>
      ) : null}
      {lastOk && !lastError ? (
        <p className="mb-1.5 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[9px] text-emerald-900 font-sans">
          {lastOk}
        </p>
      ) : null}
      <ul className="space-y-2">
        {hudRows.map((row) => {
          const busy = busyRobotId === row.robot.id;
          const hasPos = row.position != null && row.position.totalBaseQty > 1e-12;
          return (
            <li key={row.robot.id} className="rounded border border-zinc-200 bg-zinc-50/80 p-1.5 space-y-1">
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1 font-sans">
                  <p className="font-semibold text-zinc-800 truncate">{robotLabel(row.robot)}</p>
                  {!hasPos ? (
                    <p className="text-[9px] text-zinc-500">{t.robotsHudFlat ?? "No position"}</p>
                  ) : (
                    <p className="font-mono tabular-nums text-zinc-800 leading-snug">
                      <span className="text-zinc-600">{t.robotsPnlAvg ?? "avg"}</span>{" "}
                      {row.position!.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                      <span className={row.pnlPct != null && row.pnlPct >= 0 ? "text-emerald-700" : "text-red-700"}>
                        {row.pnlPct != null ? `${row.pnlPct >= 0 ? "+" : ""}${row.pnlPct.toFixed(2)}%` : "-"}
                      </span>
                      {" · "}
                      <span className={row.pnlUsdt != null && row.pnlUsdt >= 0 ? "text-emerald-700" : "text-red-700"}>
                        {row.pnlUsdt != null
                          ? `${row.pnlUsdt >= 0 ? "+" : ""}${row.pnlUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
                          : "-"}
                      </span>
                    </p>
                  )}
                </div>
                {hasPos ? (
                  <button
                    type="button"
                    className="pointer-events-auto shrink-0 rounded border border-zinc-300 bg-white px-1 py-0 text-[11px] font-sans font-medium leading-none text-zinc-600 hover:bg-zinc-100"
                    aria-label={t.robotsPnlHudForgetAria ?? "Forget tracked position"}
                    title={t.robotsPnlHudForgetTitle ?? "Forget position"}
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingClearRobotId(row.robot.id);
                    }}
                  >
                    x
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1 font-sans">
                <button
                  type="button"
                  disabled={busy}
                  title={t.robotsHudManualBuyTitle ?? "Market buy (test)"}
                  className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    void runManualBuy(row.robot);
                  }}
                >
                  {busy ? (t.robotsHudBusy ?? "...") : (t.robotsHudManualBuy ?? "Buy")}
                </button>
                <button
                  type="button"
                  disabled={busy || !hasPos}
                  title={t.robotsHudManualSellTitle ?? "Market sell (test)"}
                  className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[9px] font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    void runManualSell(row.robot);
                  }}
                >
                  {t.robotsHudManualSell ?? "Sell"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  title={t.robotsHudManualBuySignalTitle ?? "Buy signal only"}
                  className="rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[9px] font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    runManualBuySignal(row.robot);
                  }}
                >
                  {t.robotsHudManualBuySignal ?? "Signal"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {pendingClearRobotId != null && (
        <div className="mt-2 border-t border-zinc-200 pt-2 space-y-2" role="dialog" aria-labelledby="robot-pnl-forget-heading">
          <p id="robot-pnl-forget-heading" className="text-[10px] text-zinc-700 leading-snug font-sans">
            {(t.robotsPnlHudForgetConfirmMessage ?? "")
              .replace("{symbol}", sym)
              .replace("{id}", pendingClearRobotId.slice(-6))}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2 font-sans">
            <button
              type="button"
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 hover:bg-zinc-50"
              onClick={(e) => {
                e.stopPropagation();
                setPendingClearRobotId(null);
              }}
            >
              {t.robotsPnlHudForgetCancel ?? "Cancel"}
            </button>
            <button
              type="button"
              className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-900 hover:bg-red-100"
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmForgetPosition();
              }}
            >
              {t.robotsPnlHudForgetConfirm ?? "Clear tracker"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
