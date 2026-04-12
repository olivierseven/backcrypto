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
import { dispatchRobotPositionSellClear } from "./robotLiveOrders";
import {
  getRobotPosition,
  loadRobotPositionMap,
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

type LineState = {
  robotId: string;
  avgBuyPrice: number;
  baseQty: number;
  pnlPct: number;
  pnlUsdt: number;
};

/**
 * Atualiza PnL vs preço médio de compras (posição persistida) e opcionalmente dispara stop loss/stop gain a mercado.
 * Compras devem ser registadas com o evento `backcrypto-robot-position-buy` (ver robotPositionStorage).
 */
export default function RobotTradingMonitor() {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines as Record<string, string>;
  const { symbol } = useChartSymbol();
  const { data: headerData } = useChartHeader();
  const lastPrice = headerData.lastPriceUsdt;

  const [lines, setLines] = useState<LineState[]>([]);
  const [robotsTick, setRobotsTick] = useState(0);
  const [posTick, setPosTick] = useState(0);
  /** Utilizador pediu esquecer posição (ex.: venda manual na Binance); aguarda confirmação. */
  const [pendingClearRobotId, setPendingClearRobotId] = useState<string | null>(null);
  const stopInFlightRef = useRef<Set<string>>(new Set());
  const lastStopAtRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const onRobots = () => setRobotsTick((x) => x + 1);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "crypto_sistema_robot_position_v1" || e.key === null) setPosTick((x) => x + 1);
    };
    window.addEventListener(ROBOTS_CHANGED_EVENT, onRobots);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ROBOTS_CHANGED_EVENT, onRobots);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const activeBuyerRobots = useMemo(() => {
    return loadSavedRobots().filter((r) => r.isActive && r.side === "buyer");
  }, [robotsTick]);

  const tryStops = useCallback(
    async (robot: SavedRobot, sym: string, pos: RobotOpenPosition) => {
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
            symbol: sym.trim().toUpperCase(),
            side: "SELL",
            type: "MARKET",
            quantity: qtyStr,
            robotId: robot.id,
            robotAlias: robot.alias ?? "",
            executionRole,
          }),
        });
        if (res.ok) {
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
    [lastPrice]
  );

  useEffect(() => {
    const sym = symbol?.trim();
    if (!sym || !isUsdtSpotPair(sym)) {
      setLines([]);
      return;
    }
    if (lastPrice == null || !Number.isFinite(lastPrice) || lastPrice <= 0) {
      setLines([]);
      return;
    }

    const tick = () => {
      void loadRobotPositionMap();
      const next: LineState[] = [];
      for (const robot of activeBuyerRobots) {
        const pos = getRobotPosition(robot.id, sym);
        if (!pos || pos.totalBaseQty <= 0) continue;
        const pnlPct = ((lastPrice - pos.avgBuyPrice) / pos.avgBuyPrice) * 100;
        const pnlUsdt = pos.totalBaseQty * lastPrice - pos.totalQuoteSpent;
        next.push({
          robotId: robot.id,
          avgBuyPrice: pos.avgBuyPrice,
          baseQty: pos.totalBaseQty,
          pnlPct,
          pnlUsdt,
        });
        void tryStops(robot, sym, pos);
      }
      setLines(next);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [symbol, lastPrice, activeBuyerRobots, tryStops, posTick]);

  useEffect(() => {
    if (
      pendingClearRobotId != null &&
      !lines.some((l) => l.robotId === pendingClearRobotId)
    ) {
      setPendingClearRobotId(null);
    }
  }, [lines, pendingClearRobotId]);

  if (lines.length === 0) return null;

  const symLabel = symbol?.trim().toUpperCase() ?? "";

  const handleConfirmForgetPosition = () => {
    if (!pendingClearRobotId || !symLabel) return;
    dispatchRobotPositionSellClear(pendingClearRobotId, symLabel);
    setPendingClearRobotId(null);
    setPosTick((x) => x + 1);
  };

  return (
    <div
      className="pointer-events-auto fixed left-2 z-[1250] max-w-[min(100vw-1rem,22rem)] rounded-lg border border-zinc-200 bg-white/95 px-2 py-1.5 text-[10px] shadow-md sm:text-[11px]"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.5rem)" }}
      aria-live="polite"
    >
      <p className="font-semibold text-zinc-700 mb-1">{t.robotsPnlHudTitle ?? "Robot position (avg buy)"}</p>
      <ul className="space-y-1 font-mono tabular-nums text-zinc-800">
        {lines.map((ln) => (
          <li key={ln.robotId} className="leading-snug flex items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <span className="text-zinc-500">#{ln.robotId.slice(-6)}</span>{" "}
              <span className="text-zinc-600">{t.robotsPnlAvg ?? "avg"}</span> {ln.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
              <span className={ln.pnlPct >= 0 ? "text-emerald-700" : "text-red-700"}>
                {ln.pnlPct >= 0 ? "+" : ""}
                {ln.pnlPct.toFixed(2)}%
              </span>
              {" · "}
              <span className={ln.pnlUsdt >= 0 ? "text-emerald-700" : "text-red-700"}>
                {ln.pnlUsdt >= 0 ? "+" : ""}
                {ln.pnlUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
              </span>
            </div>
            <button
              type="button"
              className="pointer-events-auto shrink-0 rounded border border-zinc-300 bg-white px-1 py-0 text-[11px] font-sans font-medium leading-none text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              aria-label={t.robotsPnlHudForgetAria ?? "Forget tracked position"}
              title={t.robotsPnlHudForgetTitle ?? "Forget position"}
              onClick={(e) => {
                e.stopPropagation();
                setPendingClearRobotId(ln.robotId);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {pendingClearRobotId != null && (
        <div className="mt-2 border-t border-zinc-200 pt-2 space-y-2" role="dialog" aria-labelledby="robot-pnl-forget-heading">
          <p id="robot-pnl-forget-heading" className="text-[10px] text-zinc-700 leading-snug font-sans">
            {(t.robotsPnlHudForgetConfirmMessage ?? "")
              .replace("{symbol}", symLabel)
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
