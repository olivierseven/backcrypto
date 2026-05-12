"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { API_BASE } from "@/app/constants";
import { useAppBarSafe } from "@/app/AppBarSafeContext";
import {
  CRYPTO_SISTEMA_BACKTEST_ERROR_EVENT,
  CRYPTO_SISTEMA_BACKTEST_RUN_EVENT,
  BACKTEST_FEE_PCT_PER_SIDE_DEFAULT,
  BACKTEST_SLIPPAGE_PCT_MAX,
  BACKTEST_SLIPPAGE_PCT_STEP,
  clampFeePercentPerSide,
  clampBacktestExecutionMode,
  clampSlippagePercent,
  formatFeeDecimalAsPercentLabel,
  loadBacktestRange,
  persistBacktestRange,
  type BacktestRangeSettings,
} from "./backtestStorage";
import { ROBOTS_CHANGED_EVENT, loadSavedRobots, type SavedRobot } from "./robotsStorage";

function formatUsdt2(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseUsdtInput(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

function parseFeePctInput(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

/** Vela ≥ 1; vazio ou inválido → null (não persistir no blur). */
function parseBarIndexInput(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const v = Math.floor(Number(t));
  if (!Number.isFinite(v)) return null;
  return Math.max(1, v);
}

/** Mesma regra que `onBlur` nos campos de barra: combina rascunhos com o intervalo atual (para «Executar» sem blur). */
function mergeBacktestBarDraftsIntoRange(
  prev: BacktestRangeSettings,
  startDraft: string,
  endDraft: string
): BacktestRangeSettings {
  const sp = parseBarIndexInput(startDraft);
  const ep = parseBarIndexInput(endDraft);
  let startBar = prev.startBar;
  let endBar = prev.endBar;
  if (sp != null) {
    startBar = Math.max(1, Math.floor(sp));
    endBar = Math.max(prev.endBar, startBar);
  }
  if (ep != null) {
    endBar = Math.max(Math.max(1, Math.floor(ep)), startBar);
  }
  return { ...prev, startBar, endBar };
}

function robotDisplayLabel(r: SavedRobot): string {
  const a = typeof r.alias === "string" ? r.alias.trim() : "";
  return a.length > 0 ? a : `#${r.id.slice(-8)}`;
}

interface BacktestPanelProps {
  onClose?: () => void;
  /** Ao abrir a partir de «Meus robôs → Backtest», pré-seleciona este robô. */
  initialRobotId?: string | null;
}

export default function BacktestPanel({ onClose, initialRobotId = null }: BacktestPanelProps) {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines as Record<string, string>;
  const { hideStatusBar } = useAppBarSafe();
  const [range, setRange] = useState(() => loadBacktestRange());
  const [spotDraft, setSpotDraft] = useState(() => formatUsdt2(loadBacktestRange().spotUsdtFree));
  const [feeDraft, setFeeDraft] = useState(() => String(loadBacktestRange().feePercentPerSide));
  const [startBarDraft, setStartBarDraft] = useState(() => String(loadBacktestRange().startBar));
  const [endBarDraft, setEndBarDraft] = useState(() => String(loadBacktestRange().endBar));
  const [savedRobots, setSavedRobots] = useState<SavedRobot[]>(() => loadSavedRobots());
  const [selRobotId, setSelRobotId] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const didApplyInitialRobotRef = useRef(false);

  useEffect(() => {
    const refresh = () => setSavedRobots(loadSavedRobots());
    window.addEventListener(ROBOTS_CHANGED_EVENT, refresh);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "crypto_sistema_robots_v1" || e.key === null) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ROBOTS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const onErr = (e: Event) => {
      const msg = (e as CustomEvent<{ message?: string }>).detail?.message;
      if (typeof msg === "string") setLocalError(msg);
    };
    window.addEventListener(CRYPTO_SISTEMA_BACKTEST_ERROR_EVENT, onErr);
    return () => window.removeEventListener(CRYPTO_SISTEMA_BACKTEST_ERROR_EVENT, onErr);
  }, []);

  /** Ao abrir o painel: se em Conta › Binance existir taxa taker (fallback), usa como predefinição e grava no intervalo do backtest. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/user/binance-connection`, { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { connected?: boolean; feeEstimateTakerFallback?: string | null };
        if (!data.connected || cancelled) return;
        const fb = data.feeEstimateTakerFallback;
        if (fb == null || String(fb).trim() === "") return;
        const r = parseFloat(String(fb));
        if (!Number.isFinite(r) || r < 0 || r > 0.05) return;
        const pct = clampFeePercentPerSide(r * 100);
        if (cancelled) return;
        setFeeDraft(formatFeeDecimalAsPercentLabel(r));
        setRange((prev) => {
          const next = { ...prev, feePercentPerSide: pct };
          persistBacktestRange(next);
          return next;
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const buyerRobots = useMemo(
    () => savedRobots.filter((r) => r.side === "buyer" && r.buyCombinedStrategyIds.length > 0),
    [savedRobots]
  );

  useEffect(() => {
    if (!buyerRobots.length) {
      setSelRobotId("");
      didApplyInitialRobotRef.current = false;
      return;
    }
    if (!didApplyInitialRobotRef.current) {
      didApplyInitialRobotRef.current = true;
      if (
        initialRobotId &&
        buyerRobots.some((r) => r.id === initialRobotId)
      ) {
        setSelRobotId(initialRobotId);
      } else {
        setSelRobotId((prev) =>
          buyerRobots.some((r) => r.id === prev) ? prev : buyerRobots[0].id
        );
      }
      return;
    }
    setSelRobotId((prev) =>
      buyerRobots.some((r) => r.id === prev) ? prev : buyerRobots[0].id
    );
  }, [buyerRobots, initialRobotId]);

  const persistRange = useCallback((startBar: number, endBar: number) => {
    setRange((prev) => {
      const s = Math.max(1, Math.floor(startBar));
      const e = Math.max(s, Math.floor(endBar));
      const next = { ...prev, startBar: s, endBar: e };
      persistBacktestRange(next);
      return next;
    });
  }, []);

  const commitStartBarDraft = useCallback(() => {
    const p = parseBarIndexInput(startBarDraft);
    if (p == null) {
      setStartBarDraft(String(range.startBar));
      return;
    }
    const end = Math.max(range.endBar, p);
    persistRange(p, end);
    setStartBarDraft(String(p));
    setEndBarDraft(String(end));
  }, [startBarDraft, range.startBar, range.endBar, persistRange]);

  /** Alterar só a vela final: a inicial não mexe; se final < inicial, sobe a final até coincidir com a inicial. */
  const commitEndBarDraft = useCallback(() => {
    const p = parseBarIndexInput(endBarDraft);
    if (p == null) {
      setEndBarDraft(String(range.endBar));
      return;
    }
    const end = Math.max(p, range.startBar);
    persistRange(range.startBar, end);
    setEndBarDraft(String(end));
  }, [endBarDraft, range.startBar, range.endBar, persistRange]);

  const persistSpotUsdt = useCallback((usdt: number) => {
    setRange((prev) => {
      const next = { ...prev, spotUsdtFree: usdt };
      persistBacktestRange(next);
      return next;
    });
  }, []);

  const persistFeePct = useCallback((pct: number) => {
    const c = clampFeePercentPerSide(pct);
    setRange((prev) => {
      const next = { ...prev, feePercentPerSide: c };
      persistBacktestRange(next);
      return next;
    });
  }, []);

  const slippageOptions = useMemo(() => {
    const n = Math.round(BACKTEST_SLIPPAGE_PCT_MAX / BACKTEST_SLIPPAGE_PCT_STEP);
    return Array.from({ length: n + 1 }, (_, i) =>
      Number((i * BACKTEST_SLIPPAGE_PCT_STEP).toFixed(4))
    );
  }, []);

  const persistSlippagePct = useCallback((pct: number) => {
    const c = clampSlippagePercent(pct);
    setRange((prev) => {
      const next = { ...prev, slippagePercent: c };
      persistBacktestRange(next);
      return next;
    });
  }, []);

  const persistExecutionMode = useCallback((mode: string) => {
    const m = clampBacktestExecutionMode(mode);
    setRange((prev) => {
      const next = { ...prev, executionMode: m };
      persistBacktestRange(next);
      return next;
    });
  }, []);

  const selectedRobot = useMemo(
    () => savedRobots.find((r) => r.id === selRobotId) ?? null,
    [savedRobots, selRobotId]
  );

  /** Só «Meus robôs → Backtest» abre o painel; robô fixo, sem trocar no menu. */
  const robotLocked = Boolean(initialRobotId);

  const robotDisplayLabel = useCallback((r: SavedRobot) => {
    const a = typeof r.alias === "string" ? r.alias.trim() : "";
    return a.length > 0 ? a : `#${r.id.slice(-8)}`;
  }, []);

  const robotMaxSpendHint = useMemo(() => {
    if (!selectedRobot) return null;
    const spot = range.spotUsdtFree;
    if (!Number.isFinite(spot) || spot < 0) return null;
    const pct = selectedRobot.maxSpotPercent ?? 100;
    return (spot * pct) / 100;
  }, [selectedRobot, range.spotUsdtFree]);

  const runBacktest = useCallback(() => {
    setLocalError(null);
    if (!selRobotId) {
      setLocalError(t.backtestErrPickRobot ?? "Select a robot.");
      return;
    }
    const merged = mergeBacktestBarDraftsIntoRange(range, startBarDraft, endBarDraft);
    if (merged.startBar !== range.startBar || merged.endBar !== range.endBar) {
      persistBacktestRange(merged);
      setRange(merged);
    }
    setStartBarDraft(String(merged.startBar));
    setEndBarDraft(String(merged.endBar));
    window.dispatchEvent(
      new CustomEvent(CRYPTO_SISTEMA_BACKTEST_RUN_EVENT, { detail: { robotId: selRobotId } })
    );
  }, [selRobotId, range, startBarDraft, endBarDraft, t.backtestErrPickRobot]);

  const title = t.menuBacktest ?? "Backtest";

  return (
    <div
      className={`fixed inset-y-0 left-0 z-[1301] flex flex-col bg-white border-r border-zinc-200 shadow-xl overflow-hidden w-[66.666vw] sm:w-[33.333vw] max-w-[400px] ${hideStatusBar === false ? "crypto-status-bar-reserve" : ""}`}
      role="dialog"
      aria-label={title}
    >
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-200 bg-zinc-50">
        <h2 className="text-sm font-semibold text-zinc-900 truncate">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-200"
          aria-label={t.close ?? "Close"}
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-3 flex flex-col gap-3">
        <p className="text-xs text-zinc-600">{t.backtestPanelIntro ?? "Simulate the buyer robot on historical closes for the visible candles."}</p>
        <p className="text-[10px] text-zinc-500 leading-snug">{t.backtestBarHint ?? ""}</p>

        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-zinc-700">{t.backtestStartBar ?? "Start bar"}</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            className="border border-zinc-300 rounded px-2 py-1.5 font-mono text-zinc-900 w-full"
            value={startBarDraft}
            onChange={(e) => setStartBarDraft(e.target.value)}
            onBlur={commitStartBarDraft}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-zinc-700">{t.backtestEndBar ?? "End bar"}</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            className="border border-zinc-300 rounded px-2 py-1.5 font-mono text-zinc-900 w-full"
            value={endBarDraft}
            onChange={(e) => setEndBarDraft(e.target.value)}
            onBlur={commitEndBarDraft}
          />
        </label>

        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-zinc-700">{t.backtestSpotUsdtLabel ?? "Simulated spot USDT (free)"}</span>
          <input
            type="text"
            inputMode="decimal"
            value={spotDraft}
            onChange={(e) => setSpotDraft(e.target.value)}
            onBlur={() => {
              const p = parseUsdtInput(spotDraft);
              if (p === null) {
                setSpotDraft(formatUsdt2(range.spotUsdtFree));
                return;
              }
              persistSpotUsdt(p);
              setSpotDraft(p === 0 ? "0" : formatUsdt2(p));
            }}
            className="border border-zinc-300 rounded px-2 py-1.5 font-mono text-zinc-900 w-full"
            aria-label={t.backtestSpotUsdtLabel ?? "Simulated spot USDT (free)"}
          />
        </label>
        {robotMaxSpendHint != null && Number.isFinite(robotMaxSpendHint) && (
          <p className="text-[10px] text-zinc-500 leading-snug -mt-1">
            {(t.backtestRobotMaxSpendHint ?? "Robot max spend at current %: {usdt} USDT").replace(
              "{usdt}",
              formatUsdt2(robotMaxSpendHint)
            )}
          </p>
        )}

        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-zinc-700">{t.backtestFeePctLabel ?? "Fee per side (%)"}</span>
          <input
            type="text"
            inputMode="decimal"
            value={feeDraft}
            onChange={(e) => setFeeDraft(e.target.value)}
            onBlur={() => {
              const p = parseFeePctInput(feeDraft);
              if (p === null) {
                setFeeDraft(String(range.feePercentPerSide));
                return;
              }
              persistFeePct(p);
              setFeeDraft(String(clampFeePercentPerSide(p)));
            }}
            className="border border-zinc-300 rounded px-2 py-1.5 font-mono text-zinc-900 w-full"
            aria-label={t.backtestFeePctLabel ?? "Fee per side (%)"}
          />
        </label>
        <p className="text-[10px] text-zinc-500 leading-snug -mt-1">
          {t.backtestFeePctHint ?? `Default ${BACKTEST_FEE_PCT_PER_SIDE_DEFAULT}% each buy and sell.`}
        </p>

        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-zinc-700">{t.backtestSlippageLabel ?? "Slippage (%)"}</span>
          <select
            className="border border-zinc-300 rounded px-2 py-1.5 font-mono text-zinc-900 w-full"
            value={String(range.slippagePercent)}
            onChange={(e) => persistSlippagePct(Number(e.target.value))}
            aria-label={t.backtestSlippageLabel ?? "Slippage (%)"}
          >
            {slippageOptions.map((pct) => (
              <option key={pct} value={String(pct)}>
                {pct}%
              </option>
            ))}
          </select>
        </label>
        <p className="text-[10px] text-zinc-500 leading-snug -mt-1">
          {t.backtestSlippageHint ??
            `Buy at close×(1+s), sell/stop at close×(1−s). Max ${BACKTEST_SLIPPAGE_PCT_MAX}%, step ${BACKTEST_SLIPPAGE_PCT_STEP}%.`}
        </p>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-zinc-700">{t.backtestExecutionModeLabel ?? "Execution mode"}</span>
          <select
            className="border border-zinc-300 rounded px-2 py-1.5 text-zinc-900 w-full"
            value={range.executionMode}
            onChange={(e) => persistExecutionMode(e.target.value)}
            aria-label={t.backtestExecutionModeLabel ?? "Execution mode"}
          >
            <option value="conservative">{t.backtestExecutionModeConservative ?? "Conservative"}</option>
            <option value="optimistic">{t.backtestExecutionModeOptimistic ?? "Optimistic"}</option>
          </select>
        </label>
        <p className="text-[10px] text-zinc-500 leading-snug -mt-1">
          {t.backtestExecutionModeHint ??
            "Conservative: buy/sell at close. Optimistic: buy at min(open,close), sell at max(open,close)."}
        </p>

        {robotLocked ? (
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="text-zinc-700">{t.backtestSelectRobot ?? "Robot"}</span>
            <div className="border border-zinc-200 rounded px-2 py-1.5 bg-zinc-50 text-zinc-900 font-medium">
              {selectedRobot ? robotDisplayLabel(selectedRobot) : "—"}
            </div>
          </div>
        ) : (
          <label className="flex flex-col gap-0.5 text-xs">
            <span className="text-zinc-700">{t.backtestSelectRobot ?? "Robot"}</span>
            <select
              className="border border-zinc-300 rounded px-2 py-1.5 text-zinc-900 w-full"
              value={selRobotId}
              onChange={(e) => setSelRobotId(e.target.value)}
              disabled={!buyerRobots.length}
            >
              {buyerRobots.length === 0 ? (
                <option value="">{t.backtestNoBuyerRobots ?? "No buyer robots"}</option>
              ) : (
                buyerRobots.map((r) => (
                  <option key={r.id} value={r.id}>
                    {robotDisplayLabel(r)}
                  </option>
                ))
              )}
            </select>
          </label>
        )}

        {localError ? (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5 whitespace-pre-wrap">{localError}</p>
        ) : null}

        <button
          type="button"
          onClick={runBacktest}
          disabled={!selRobotId}
          className="mt-auto text-sm font-medium px-3 py-2.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.backtestRun ?? "Run backtest"}
        </button>
      </div>
    </div>
  );
}
