"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/app/constants";
import { useAppBarSafe } from "@/app/AppBarSafeContext";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { useChartSymbol } from "./ChartSymbolContext";
import { useKlinesIndicators } from "./KlinesIndicatorsContext";
import { useStrategies } from "./strategies/StrategiesContext";
import { KLINE_LAST_LAYOUT_KEY } from "./KlinesChartConstants";
import {
  strategiesForContext,
  validateStrategyReferences,
  type Strategy,
} from "./strategies/strategiesTypes";
import { CRYPTO_SISTEMA_BACKTEST_OPEN_PANEL_EVENT } from "./backtestStorage";
import RobotLiveReportModal from "./RobotLiveReportModal";
import {
  ROBOT_BUY_ACCUM_MAX_CANDLES_DEFAULT,
  ROBOT_BUY_ACCUM_MAX_CANDLES_MAX,
  ROBOT_BUY_ACCUM_MAX_CANDLES_MIN,
  ROBOT_BUY_ACCUM_START_SIGNAL_MAX,
  ROBOT_BUY_ACCUM_START_SIGNAL_MIN,
  ROBOT_MAX_SPOT_MAX,
  ROBOT_MAX_SPOT_MIN,
  ROBOT_STOP_LOSS_PCT_MAX,
  ROBOT_STOP_LOSS_PCT_MIN,
  loadSavedRobots,
  persistSavedRobots,
  type RobotBuyOperationMode,
  type RobotSide,
  type RobotStopLossMode,
  type SavedRobot,
} from "./robotsStorage";

const ROBOT_ALIAS_MAX_LEN = 80;

export {
  ROBOT_MAX_SPOT_MAX,
  ROBOT_MAX_SPOT_MIN,
  ROBOT_STOP_LOSS_PCT_MAX,
  ROBOT_STOP_LOSS_PCT_MIN,
  type RobotBuyOperationMode,
  type RobotSide,
  type RobotStopLossMode,
  type SavedRobot,
};

function formatUsdt2(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseUsdtInput(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return 0;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

async function fetchSpotUsdtFreeFromApi(): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE}/user/binance-connection/balances`, { credentials: "include" });
    const data = (await res.json().catch(() => ({}))) as {
      balances?: { asset: string; free: string }[];
      usdtSpotFree?: string;
    };
    if (!res.ok) return null;
    const list = Array.isArray(data.balances) ? data.balances : [];
    const usdtFromList = list.find((b) => b.asset === "USDT");
    const usdtStr =
      typeof data.usdtSpotFree === "string" && data.usdtSpotFree.length > 0
        ? data.usdtSpotFree
        : (usdtFromList?.free ?? "0");
    const n = parseFloat(String(usdtStr).trim().replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

interface RobotsPanelProps {
  initialView?: "list" | "add";
  onClose?: () => void;
}

export default function RobotsPanel({ initialView = "list", onClose }: RobotsPanelProps) {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines as Record<string, string>;
  const { hideStatusBar } = useAppBarSafe();
  const { symbol } = useChartSymbol();
  const { currentGroupMinutes, userIndicators } = useKlinesIndicators();
  const {
    strategies,
    appliedStrategyIds,
    replaceAppliedStrategyIds,
  } = useStrategies();

  const chartIntervalMinutes = currentGroupMinutes ?? 5;

  const [view, setView] = useState<"list" | "add">(initialView);
  const [editingRobotId, setEditingRobotId] = useState<string | null>(null);
  const [side, setSide] = useState<RobotSide>("buyer");
  const [buyChosenIds, setBuyChosenIds] = useState<string[]>([]);
  const [sellChosenIds, setSellChosenIds] = useState<string[]>([]);
  const [buyPickId, setBuyPickId] = useState<string>("");
  const [sellPickId, setSellPickId] = useState<string>("");
  const [flattenChosenIds, setFlattenChosenIds] = useState<string[]>([]);
  const [flattenPickId, setFlattenPickId] = useState<string>("");
  const [postFlattenSellChosenIds, setPostFlattenSellChosenIds] = useState<string[]>([]);
  const [postFlattenSellPickId, setPostFlattenSellPickId] = useState<string>("");
  const [postFlattenBuyChosenIds, setPostFlattenBuyChosenIds] = useState<string[]>([]);
  const [postFlattenBuyPickId, setPostFlattenBuyPickId] = useState<string>("");
  const [maxSpotPercent, setMaxSpotPercent] = useState(ROBOT_MAX_SPOT_MAX);
  const [buyOperationMode, setBuyOperationMode] = useState<RobotBuyOperationMode>("percent");
  const [buyOperationPercent, setBuyOperationPercent] = useState(0);
  const [buyFixedInput, setBuyFixedInput] = useState("0");
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLossMode, setStopLossMode] = useState<RobotStopLossMode>("percent");
  const [stopLossPercent, setStopLossPercent] = useState(2);
  const [stopLossFixedInput, setStopLossFixedInput] = useState("25");
  const [stopGainEnabled, setStopGainEnabled] = useState(false);
  const [stopGainMode, setStopGainMode] = useState<RobotStopLossMode>("percent");
  const [stopGainPercent, setStopGainPercent] = useState(2);
  const [stopGainFixedInput, setStopGainFixedInput] = useState("25");
  const [spotUsdtFree, setSpotUsdtFree] = useState<number | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedRobots, setSavedRobots] = useState<SavedRobot[]>([]);
  const [reportRobot, setReportRobot] = useState<SavedRobot | null>(null);
  const [robotAlias, setRobotAlias] = useState("");
  const [buyAccumulationStartOnSignalNumber, setBuyAccumulationStartOnSignalNumber] = useState(
    ROBOT_BUY_ACCUM_START_SIGNAL_MIN
  );
  const [buyAccumMaxCandles, setBuyAccumMaxCandles] = useState(ROBOT_BUY_ACCUM_MAX_CANDLES_DEFAULT);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    setSavedRobots(loadSavedRobots());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBalancesLoading(true);
    setBalancesError(false);
    fetch(`${API_BASE}/user/binance-connection/balances`, { credentials: "include" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          balances?: { asset: string; free: string }[];
          usdtSpotFree?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setSpotUsdtFree(null);
          setBalancesError(true);
          return;
        }
        const list = Array.isArray(data.balances) ? data.balances : [];
        const usdtFromList = list.find((b) => b.asset === "USDT");
        const usdtStr =
          typeof data.usdtSpotFree === "string" && data.usdtSpotFree.length > 0
            ? data.usdtSpotFree
            : (usdtFromList?.free ?? "0");
        const n = parseFloat(String(usdtStr).trim().replace(/\s/g, "").replace(",", "."));
        setSpotUsdtFree(Number.isFinite(n) && n >= 0 ? n : 0);
        setBalancesError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setSpotUsdtFree(null);
          setBalancesError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setBalancesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const editingRobot = useMemo(() => {
    if (!editingRobotId) return null;
    return savedRobots.find((r) => r.id === editingRobotId) ?? null;
  }, [editingRobotId, savedRobots]);

  /** USDT livre spot (atualizado ao carregar saldos) — teto do robô é sempre % deste valor. */
  const spotForRobotBudget = spotUsdtFree;

  const maxSpendUsdt = useMemo(() => {
    if (spotForRobotBudget == null || !Number.isFinite(spotForRobotBudget) || spotForRobotBudget < 0) {
      return null;
    }
    return (spotForRobotBudget * maxSpotPercent) / 100;
  }, [spotForRobotBudget, maxSpotPercent]);

  const onMaxSpotSlider = useCallback(
    (v: number) => {
      const n = Math.min(ROBOT_MAX_SPOT_MAX, Math.max(ROBOT_MAX_SPOT_MIN, Math.round(v)));
      setMaxSpotPercent(n);
      setBuyOperationPercent((b) => Math.min(b, n));
      const spend =
        spotForRobotBudget != null && Number.isFinite(spotForRobotBudget) && spotForRobotBudget >= 0
          ? (spotForRobotBudget * n) / 100
          : null;
      if (spend != null && buyOperationMode === "fixed") {
        const p = parseUsdtInput(buyFixedInput);
        if (p !== null && p > spend + 1e-9) setBuyFixedInput(formatUsdt2(spend));
      }
    },
    [spotForRobotBudget, buyOperationMode, buyFixedInput]
  );

  /** USDT por operação no modo percentual: % do teto do robô (maxSpendUsdt). */
  const buyPercentAsUsdt = useMemo(() => {
    if (maxSpendUsdt == null || !Number.isFinite(maxSpendUsdt)) return null;
    const pct = Math.min(Math.max(0, buyOperationPercent), maxSpotPercent);
    return (maxSpendUsdt * pct) / 100;
  }, [maxSpendUsdt, buyOperationPercent, maxSpotPercent]);

  const indicatorIdsSet = useMemo(() => new Set(userIndicators.map((i) => i.id)), [userIndicators]);
  const allStrategyIdsSet = useMemo(() => new Set(strategies.map((x) => x.id)), [strategies]);

  const combinedForContext = useMemo(() => {
    return strategiesForContext(strategies, chartIntervalMinutes, symbol).filter((s) => s.isCombined);
  }, [strategies, chartIntervalMinutes, symbol]);

  const buyAvailableToPick = useMemo(() => {
    const chosen = new Set(buyChosenIds);
    return combinedForContext.filter((s) => !chosen.has(s.id));
  }, [combinedForContext, buyChosenIds]);

  const sellAvailableToPick = useMemo(() => {
    const chosen = new Set(sellChosenIds);
    return combinedForContext.filter((s) => !chosen.has(s.id));
  }, [combinedForContext, sellChosenIds]);

  const flattenAvailableToPick = useMemo(() => {
    const chosen = new Set(flattenChosenIds);
    return combinedForContext.filter((s) => !chosen.has(s.id));
  }, [combinedForContext, flattenChosenIds]);

  const postFlattenSellAvailableToPick = useMemo(() => {
    const chosen = new Set(postFlattenSellChosenIds);
    return combinedForContext.filter((s) => !chosen.has(s.id));
  }, [combinedForContext, postFlattenSellChosenIds]);

  const postFlattenBuyAvailableToPick = useMemo(() => {
    const chosen = new Set(postFlattenBuyChosenIds);
    return combinedForContext.filter((s) => !chosen.has(s.id));
  }, [combinedForContext, postFlattenBuyChosenIds]);

  const saveActivationToServer = useCallback(async (nextAppliedIds: string[]) => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY) : null;
    if (!raw || raw === "default") return;
    const slot = Number(raw);
    if (!Number.isInteger(slot) || slot < 1 || slot > 7) return;
    try {
      await fetch(`${API_BASE}/chart-layouts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slot, appliedStrategyIds: nextAppliedIds }),
      });
    } catch {
      /* ignore */
    }
  }, []);

  const strategyLabel = useCallback(
    (id: string) => {
      const s = strategies.find((x) => x.id === id);
      return s?.name ?? id;
    },
    [strategies]
  );

  const collectValidationErrors = useCallback(
    (ids: string[]): string[] => {
      const lines: string[] = [];
      for (const id of ids) {
        const st = strategies.find((x) => x.id === id);
        if (!st?.isCombined) {
          lines.push(`${id}`);
          continue;
        }
        const r = validateStrategyReferences(st, indicatorIdsSet, allStrategyIdsSet, { userIndicators });
        if (!r.ok) {
          for (const mid of r.missingIds) {
            lines.push((t.strategyApplyErrorMissingIndicator ?? "Missing (id: {id}).").replace("{id}", mid));
          }
        }
      }
      return lines;
    },
    [strategies, indicatorIdsSet, allStrategyIdsSet, userIndicators, t.strategyApplyErrorMissingIndicator]
  );

  const deactivateCombinedIds = useCallback(
    (ids: string[]) => {
      setErrorMsg(null);
      if (ids.length === 0) return;
      const remove = new Set(ids);
      const next = appliedStrategyIds.filter((id) => !remove.has(id));
      replaceAppliedStrategyIds(next);
      void saveActivationToServer(next);
    },
    [appliedStrategyIds, replaceAppliedStrategyIds, saveActivationToServer]
  );

  const activateCombinedIds = useCallback(
    (ids: string[]): boolean => {
      setErrorMsg(null);
      if (ids.length === 0) {
        setErrorMsg(t.robotsErrNoneSelected ?? "Select at least one combined strategy.");
        return false;
      }
      const lines = collectValidationErrors(ids);
      if (lines.length > 0) {
        setErrorMsg(lines.slice(0, 5).join("\n") || (t.robotsErrValidation ?? "Validation failed."));
        return false;
      }
      const next = [...appliedStrategyIds];
      for (const id of ids) {
        if (!next.includes(id)) next.push(id);
      }
      replaceAppliedStrategyIds(next);
      void saveActivationToServer(next);
      return true;
    },
    [
      collectValidationErrors,
      appliedStrategyIds,
      replaceAppliedStrategyIds,
      saveActivationToServer,
      t.robotsErrNoneSelected,
      t.robotsErrValidation,
    ]
  );

  const resetAddForm = useCallback(() => {
    setEditingRobotId(null);
    setSide("buyer");
    setBuyChosenIds([]);
    setSellChosenIds([]);
    setFlattenChosenIds([]);
    setPostFlattenSellChosenIds([]);
    setPostFlattenSellPickId("");
    setPostFlattenBuyChosenIds([]);
    setPostFlattenBuyPickId("");
    setBuyPickId("");
    setSellPickId("");
    setFlattenPickId("");
    setMaxSpotPercent(ROBOT_MAX_SPOT_MAX);
    setBuyOperationMode("percent");
    setBuyOperationPercent(0);
    setBuyFixedInput("0");
    setStopLossEnabled(false);
    setStopLossMode("percent");
    setStopLossPercent(2);
    setStopLossFixedInput("25");
    setStopGainEnabled(false);
    setStopGainMode("percent");
    setStopGainPercent(2);
    setStopGainFixedInput("25");
    setRobotAlias("");
    setBuyAccumulationStartOnSignalNumber(ROBOT_BUY_ACCUM_START_SIGNAL_MIN);
    setBuyAccumMaxCandles(ROBOT_BUY_ACCUM_MAX_CANDLES_DEFAULT);
    setErrorMsg(null);
  }, []);

  const openAddTabNew = () => {
    resetAddForm();
    setView("add");
  };

  const openEditRobot = (robot: SavedRobot) => {
    setEditingRobotId(robot.id);
    setSide(robot.side);
    setBuyChosenIds([...robot.buyCombinedStrategyIds]);
    setSellChosenIds([...robot.sellCombinedStrategyIds]);
    setFlattenChosenIds([...(robot.flattenCombinedStrategyIds ?? [])]);
    setPostFlattenSellChosenIds([...(robot.postFlattenSignalSellCombinedStrategyIds ?? [])]);
    setPostFlattenBuyChosenIds([...(robot.postFlattenSignalBuyCombinedStrategyIds ?? [])]);
    setPostFlattenSellPickId("");
    setPostFlattenBuyPickId("");
    setBuyPickId("");
    setSellPickId("");
    setFlattenPickId("");
    const maxP = robot.maxSpotPercent ?? ROBOT_MAX_SPOT_MAX;
    setMaxSpotPercent(maxP);
    const mode = robot.buyOperationMode ?? "percent";
    setBuyOperationMode(mode);
    const buyP = robot.buyOperationPercent ?? 0;
    setBuyOperationPercent(Math.min(Math.max(0, buyP), maxP));
    setBuyFixedInput(formatUsdt2(Math.max(0, robot.buyOperationFixedUsdt ?? 0)));
    setStopLossEnabled(robot.stopLossEnabled ?? false);
    setStopLossMode(robot.stopLossMode === "fixed" ? "fixed" : "percent");
    setStopLossPercent(
      typeof robot.stopLossPercent === "number" && Number.isFinite(robot.stopLossPercent)
        ? Math.min(ROBOT_STOP_LOSS_PCT_MAX, Math.max(ROBOT_STOP_LOSS_PCT_MIN, robot.stopLossPercent))
        : 2
    );
    setStopLossFixedInput(formatUsdt2(Math.max(0, robot.stopLossFixedUsdt ?? 25)));
    setStopGainEnabled(robot.stopGainEnabled ?? false);
    setStopGainMode(robot.stopGainMode === "fixed" ? "fixed" : "percent");
    setStopGainPercent(
      typeof robot.stopGainPercent === "number" && Number.isFinite(robot.stopGainPercent)
        ? Math.min(ROBOT_STOP_LOSS_PCT_MAX, Math.max(ROBOT_STOP_LOSS_PCT_MIN, robot.stopGainPercent))
        : 2
    );
    setStopGainFixedInput(formatUsdt2(Math.max(0, robot.stopGainFixedUsdt ?? 25)));
    setRobotAlias(typeof robot.alias === "string" ? robot.alias : "");
    const accumN =
      typeof robot.buyAccumulationStartOnSignalNumber === "number" &&
      Number.isFinite(robot.buyAccumulationStartOnSignalNumber)
        ? Math.floor(robot.buyAccumulationStartOnSignalNumber)
        : ROBOT_BUY_ACCUM_START_SIGNAL_MIN;
    setBuyAccumulationStartOnSignalNumber(
      Math.min(ROBOT_BUY_ACCUM_START_SIGNAL_MAX, Math.max(ROBOT_BUY_ACCUM_START_SIGNAL_MIN, accumN))
    );
    const maxCandlesN =
      typeof robot.buyAccumMaxCandles === "number" && Number.isFinite(robot.buyAccumMaxCandles)
        ? Math.floor(robot.buyAccumMaxCandles)
        : ROBOT_BUY_ACCUM_MAX_CANDLES_DEFAULT;
    setBuyAccumMaxCandles(
      Math.min(ROBOT_BUY_ACCUM_MAX_CANDLES_MAX, Math.max(ROBOT_BUY_ACCUM_MAX_CANDLES_MIN, maxCandlesN))
    );
    setErrorMsg(null);
    setView("add");
  };

  const handleAddBuyOne = () => {
    setErrorMsg(null);
    if (!buyPickId) return;
    if (buyChosenIds.includes(buyPickId)) return;
    setBuyChosenIds((prev) => [...prev, buyPickId]);
    setBuyPickId("");
  };

  const handleAddSellOne = () => {
    setErrorMsg(null);
    if (!sellPickId) return;
    if (sellChosenIds.includes(sellPickId)) return;
    setSellChosenIds((prev) => [...prev, sellPickId]);
    setSellPickId("");
  };

  const handleRemoveBuyChosen = (id: string) => {
    setBuyChosenIds((prev) => prev.filter((x) => x !== id));
  };

  const handleRemoveSellChosen = (id: string) => {
    setSellChosenIds((prev) => prev.filter((x) => x !== id));
  };

  const handleAddFlattenOne = () => {
    setErrorMsg(null);
    if (!flattenPickId) return;
    if (flattenChosenIds.includes(flattenPickId)) return;
    setFlattenChosenIds((prev) => [...prev, flattenPickId]);
    setFlattenPickId("");
  };

  const handleRemoveFlattenChosen = (id: string) => {
    setFlattenChosenIds((prev) => prev.filter((x) => x !== id));
  };

  const handleAddPostFlattenSellOne = () => {
    setErrorMsg(null);
    if (!postFlattenSellPickId) return;
    if (postFlattenSellChosenIds.includes(postFlattenSellPickId)) return;
    setPostFlattenSellChosenIds((prev) => [...prev, postFlattenSellPickId]);
    setPostFlattenSellPickId("");
  };

  const handleRemovePostFlattenSellChosen = (id: string) => {
    setPostFlattenSellChosenIds((prev) => prev.filter((x) => x !== id));
  };

  const handleAddPostFlattenBuyOne = () => {
    setErrorMsg(null);
    if (!postFlattenBuyPickId) return;
    if (postFlattenBuyChosenIds.includes(postFlattenBuyPickId)) return;
    setPostFlattenBuyChosenIds((prev) => [...prev, postFlattenBuyPickId]);
    setPostFlattenBuyPickId("");
  };

  const handleRemovePostFlattenBuyChosen = (id: string) => {
    setPostFlattenBuyChosenIds((prev) => prev.filter((x) => x !== id));
  };

  /** Guardar novo ou alterações — não aplica estratégias (novo fica inativo). */
  const handleSaveRobotForm = () => {
    setErrorMsg(null);
    if (buyChosenIds.length === 0) {
      setErrorMsg(t.robotsErrNoneBuySelected ?? "Select at least one combined strategy for buy.");
      return;
    }
    if (sellChosenIds.length === 0) {
      setErrorMsg(t.robotsErrNoneSellSelected ?? "Select at least one combined strategy for sell.");
      return;
    }

    const fixedParsed = parseUsdtInput(buyFixedInput);
    if (fixedParsed === null) {
      setErrorMsg(t.robotsErrInvalidFixed ?? "Invalid USDT amount.");
      return;
    }
    let buyOperationFixedUsdt = Math.max(0, fixedParsed);
    if (buyOperationMode === "fixed" && maxSpendUsdt != null && buyOperationFixedUsdt > maxSpendUsdt + 1e-6) {
      setErrorMsg(
        (t.robotsErrFixedExceedsMax ?? "Amount cannot exceed the robot max spend ({max} USDT).").replace(
          "{max}",
          formatUsdt2(maxSpendUsdt)
        )
      );
      return;
    }
    const pct = Math.min(Math.max(0, buyOperationPercent), maxSpotPercent);

    const stopLossPctClamped = Math.min(
      ROBOT_STOP_LOSS_PCT_MAX,
      Math.max(ROBOT_STOP_LOSS_PCT_MIN, Math.round(stopLossPercent * 10) / 10)
    );
    const slFixedParsed = parseUsdtInput(stopLossFixedInput);
    if (stopLossEnabled && side === "buyer") {
      if (stopLossMode === "percent" && stopLossPctClamped < ROBOT_STOP_LOSS_PCT_MIN - 1e-9) {
        setErrorMsg(t.robotsErrStopLossInvalid ?? "Enter a valid stop loss %.");
        return;
      }
      if (stopLossMode === "fixed") {
        if (slFixedParsed === null || slFixedParsed <= 0) {
          setErrorMsg(t.robotsErrStopLossFixedInvalid ?? "Enter a valid stop loss in USDT.");
          return;
        }
      }
    }
    const stopLossFixedUsdt = Math.max(0, slFixedParsed ?? 0);
    const stopGainPctClamped = Math.min(
      ROBOT_STOP_LOSS_PCT_MAX,
      Math.max(ROBOT_STOP_LOSS_PCT_MIN, Math.round(stopGainPercent * 10) / 10)
    );
    const sgFixedParsed = parseUsdtInput(stopGainFixedInput);
    if (stopGainEnabled && side === "buyer") {
      if (stopGainMode === "percent" && stopGainPctClamped < ROBOT_STOP_LOSS_PCT_MIN - 1e-9) {
        setErrorMsg(t.robotsErrStopGainInvalid ?? "Enter a valid stop gain %.");
        return;
      }
      if (stopGainMode === "fixed") {
        if (sgFixedParsed === null || sgFixedParsed <= 0) {
          setErrorMsg(t.robotsErrStopGainFixedInvalid ?? "Enter a valid stop gain in USDT.");
          return;
        }
      }
    }
    const stopGainFixedUsdt = Math.max(0, sgFixedParsed ?? 0);
    const aliasTrimmed = robotAlias.trim().slice(0, ROBOT_ALIAS_MAX_LEN);
    const buyAccumStartClamped =
      side === "buyer"
        ? Math.min(
            ROBOT_BUY_ACCUM_START_SIGNAL_MAX,
            Math.max(ROBOT_BUY_ACCUM_START_SIGNAL_MIN, Math.floor(buyAccumulationStartOnSignalNumber))
          )
        : ROBOT_BUY_ACCUM_START_SIGNAL_MIN;
    const buyAccumMaxCandlesClamped =
      side === "buyer"
        ? Math.min(
            ROBOT_BUY_ACCUM_MAX_CANDLES_MAX,
            Math.max(ROBOT_BUY_ACCUM_MAX_CANDLES_MIN, Math.floor(buyAccumMaxCandles))
          )
        : ROBOT_BUY_ACCUM_MAX_CANDLES_DEFAULT;

    if (editingRobotId) {
      const prev = savedRobots.find((r) => r.id === editingRobotId);
      if (!prev) return;
      const oldIds = [
        ...new Set([
          ...prev.buyCombinedStrategyIds,
          ...prev.sellCombinedStrategyIds,
          ...(prev.flattenCombinedStrategyIds ?? []),
          ...(prev.postFlattenSignalSellCombinedStrategyIds ?? []),
          ...(prev.postFlattenSignalBuyCombinedStrategyIds ?? []),
        ]),
      ];
      const newBuyIds = [...buyChosenIds];
      const newSellIds = [...sellChosenIds];
      const newFlattenIds = [...flattenChosenIds];
      const newPostSellIds = [...postFlattenSellChosenIds];
      const newPostBuyIds = [...postFlattenBuyChosenIds];
      const newIds = [
        ...new Set([...newBuyIds, ...newSellIds, ...newFlattenIds, ...newPostSellIds, ...newPostBuyIds]),
      ];

      if (prev.isActive) {
        const lines = collectValidationErrors(newIds);
        if (lines.length > 0) {
          setErrorMsg(lines.slice(0, 5).join("\n") || (t.robotsErrValidation ?? "Validation failed."));
          return;
        }
        let nextApplied = appliedStrategyIds.filter((id) => !oldIds.includes(id));
        for (const id of newIds) {
          if (!nextApplied.includes(id)) nextApplied.push(id);
        }
        replaceAppliedStrategyIds(nextApplied);
        void saveActivationToServer(nextApplied);
      }

      const updated: SavedRobot = {
        ...prev,
        alias: aliasTrimmed,
        side,
        buyCombinedStrategyIds: newBuyIds,
        sellCombinedStrategyIds: newSellIds,
        flattenCombinedStrategyIds: newFlattenIds,
        postFlattenSignalSellCombinedStrategyIds: newPostSellIds,
        postFlattenSignalBuyCombinedStrategyIds: newPostBuyIds,
        isActive: prev.isActive,
        referenceSpotUsdtFree: null,
        maxSpotPercent,
        buyOperationMode,
        buyOperationPercent: buyOperationMode === "percent" ? pct : 0,
        buyOperationFixedUsdt: buyOperationMode === "fixed" ? buyOperationFixedUsdt : 0,
        stopLossEnabled: side === "buyer" ? stopLossEnabled : false,
        stopLossMode: side === "buyer" && stopLossEnabled ? stopLossMode : "percent",
        stopLossPercent: side === "buyer" && stopLossEnabled && stopLossMode === "percent" ? stopLossPctClamped : 2,
        stopLossFixedUsdt:
          side === "buyer" && stopLossEnabled && stopLossMode === "fixed" ? stopLossFixedUsdt : 25,
        stopGainEnabled: side === "buyer" ? stopGainEnabled : false,
        stopGainMode: side === "buyer" && stopGainEnabled ? stopGainMode : "percent",
        stopGainPercent: side === "buyer" && stopGainEnabled && stopGainMode === "percent" ? stopGainPctClamped : 2,
        stopGainFixedUsdt:
          side === "buyer" && stopGainEnabled && stopGainMode === "fixed" ? stopGainFixedUsdt : 25,
        buyAccumulationStartOnSignalNumber: buyAccumStartClamped,
        buyAccumMaxCandles: buyAccumMaxCandlesClamped,
      };
      const nextList = savedRobots.map((r) => (r.id === editingRobotId ? updated : r));
      setSavedRobots(nextList);
      persistSavedRobots(nextList);
      resetAddForm();
      setView("list");
      return;
    }

    const entry: SavedRobot = {
      id: `robot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      alias: aliasTrimmed,
      side,
      buyCombinedStrategyIds: [...buyChosenIds],
      sellCombinedStrategyIds: [...sellChosenIds],
      flattenCombinedStrategyIds: [...flattenChosenIds],
      postFlattenSignalSellCombinedStrategyIds: [...postFlattenSellChosenIds],
      postFlattenSignalBuyCombinedStrategyIds: [...postFlattenBuyChosenIds],
      createdAt: Date.now(),
      isActive: false,
      referenceSpotUsdtFree: null,
      maxSpotPercent,
      buyOperationMode,
      buyOperationPercent: buyOperationMode === "percent" ? pct : 0,
      buyOperationFixedUsdt: buyOperationMode === "fixed" ? buyOperationFixedUsdt : 0,
      stopLossEnabled: side === "buyer" ? stopLossEnabled : false,
      stopLossMode: side === "buyer" && stopLossEnabled ? stopLossMode : "percent",
      stopLossPercent: side === "buyer" && stopLossEnabled && stopLossMode === "percent" ? stopLossPctClamped : 2,
      stopLossFixedUsdt:
        side === "buyer" && stopLossEnabled && stopLossMode === "fixed" ? stopLossFixedUsdt : 25,
      stopGainEnabled: side === "buyer" ? stopGainEnabled : false,
      stopGainMode: side === "buyer" && stopGainEnabled ? stopGainMode : "percent",
      stopGainPercent: side === "buyer" && stopGainEnabled && stopGainMode === "percent" ? stopGainPctClamped : 2,
      stopGainFixedUsdt:
        side === "buyer" && stopGainEnabled && stopGainMode === "fixed" ? stopGainFixedUsdt : 25,
      buyAccumulationStartOnSignalNumber: buyAccumStartClamped,
      buyAccumMaxCandles: buyAccumMaxCandlesClamped,
    };
    const nextList = [entry, ...savedRobots];
    setSavedRobots(nextList);
    persistSavedRobots(nextList);
    resetAddForm();
    setView("list");
  };

  const handleActivateSaved = async (robot: SavedRobot) => {
    if (robot.isActive) return;
    setErrorMsg(null);
    let ref = spotUsdtFree;
    if (ref == null || !Number.isFinite(ref)) {
      ref = await fetchSpotUsdtFreeFromApi();
    }
    if (ref == null || !Number.isFinite(ref)) {
      setErrorMsg(t.robotsErrSpotRef ?? "Could not read spot USDT to set the reference.");
      return;
    }
    const ids = [
      ...new Set([
        ...robot.buyCombinedStrategyIds,
        ...robot.sellCombinedStrategyIds,
        ...(robot.flattenCombinedStrategyIds ?? []),
        ...(robot.postFlattenSignalSellCombinedStrategyIds ?? []),
        ...(robot.postFlattenSignalBuyCombinedStrategyIds ?? []),
      ]),
    ];
    if (!activateCombinedIds(ids)) return;
    const next = savedRobots.map((r) =>
      r.id === robot.id ? { ...r, isActive: true, referenceSpotUsdtFree: null } : r
    );
    setSavedRobots(next);
    persistSavedRobots(next);
  };

  const handleDeactivateSaved = (robot: SavedRobot) => {
    if (!robot.isActive) return;
    deactivateCombinedIds([
      ...new Set([
        ...robot.buyCombinedStrategyIds,
        ...robot.sellCombinedStrategyIds,
        ...(robot.flattenCombinedStrategyIds ?? []),
        ...(robot.postFlattenSignalSellCombinedStrategyIds ?? []),
        ...(robot.postFlattenSignalBuyCombinedStrategyIds ?? []),
      ]),
    ]);
    const next = savedRobots.map((r) =>
      r.id === robot.id ? { ...r, isActive: false, referenceSpotUsdtFree: null } : r
    );
    setSavedRobots(next);
    persistSavedRobots(next);
  };

  const handleDeleteSaved = (robot: SavedRobot) => {
    if (robot.isActive) {
      deactivateCombinedIds([
        ...new Set([
          ...robot.buyCombinedStrategyIds,
          ...robot.sellCombinedStrategyIds,
          ...(robot.flattenCombinedStrategyIds ?? []),
          ...(robot.postFlattenSignalSellCombinedStrategyIds ?? []),
          ...(robot.postFlattenSignalBuyCombinedStrategyIds ?? []),
        ]),
      ]);
    }
    const next = savedRobots.filter((r) => r.id !== robot.id);
    setSavedRobots(next);
    persistSavedRobots(next);
    if (editingRobotId === robot.id) resetAddForm();
    if (reportRobot?.id === robot.id) setReportRobot(null);
  };

  const title = t.robotsPanelTitle ?? "Robots";

  return (
    <>
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

      <div className="flex-1 min-h-0 overflow-auto p-3 flex flex-col gap-3" id="robots-panel-body">
        {view === "list" && (
          <>
            {errorMsg && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5 whitespace-pre-wrap">
                {errorMsg}
              </div>
            )}
            <button
              type="button"
              onClick={openAddTabNew}
              className="text-sm font-medium px-3 py-2.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 w-full"
            >
              {t.menuAddRobot ?? "Add robot"}
            </button>
            {savedRobots.length === 0 ? (
              <p className="text-sm text-zinc-500">{t.robotsListEmpty ?? "No robots yet. Use Add robot to create one."}</p>
            ) : (
              <ul className="space-y-2">
                {savedRobots.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-2 flex flex-col gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span
                          className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                            r.isActive ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-600"
                          }`}
                        >
                          {r.isActive ? (t.robotsStatusActive ?? "Active") : (t.robotsStatusInactive ?? "Inactive")}
                        </span>
                        {(r.alias ?? "").trim().length > 0 && (
                          <span className="text-sm font-semibold text-zinc-900 block mt-0.5 truncate">
                            {(r.alias ?? "").trim()}
                          </span>
                        )}
                        <span className="text-xs font-medium text-zinc-800 block mt-1">
                          {r.side === "buyer" ? (t.robotsSideBuyer ?? "Buyer") : (t.robotsSideSeller ?? "Seller")}
                          {" — "}
                          {(t.robotsCombinedCountBuySell ?? "{buy} buy · {sell} sell").replace(
                            "{buy}",
                            String(r.buyCombinedStrategyIds.length)
                          ).replace("{sell}", String(r.sellCombinedStrategyIds.length))}
                          {(r.flattenCombinedStrategyIds?.length ?? 0) > 0
                            ? (t.robotsFlattenCountSuffix ?? " · {n} flatten").replace(
                                "{n}",
                                String(r.flattenCombinedStrategyIds?.length ?? 0)
                              )
                            : ""}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSaved(r)}
                        className="text-xs text-red-600 hover:underline shrink-0"
                        aria-label={t.robotsDeleteSaved ?? "Remove"}
                      >
                        ×
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-600">
                      {(r.buyOperationMode ?? "percent") === "fixed"
                        ? (t.robotsParamsSummaryFixed ?? "Max spot {max}% · {usdt} USDT/op")
                            .replace("{max}", String(r.maxSpotPercent ?? ROBOT_MAX_SPOT_MAX))
                            .replace("{usdt}", formatUsdt2(r.buyOperationFixedUsdt ?? 0))
                        : (t.robotsParamsSummary ?? "Max spot {max}% · Per operation {buy}% of max")
                            .replace("{max}", String(r.maxSpotPercent ?? ROBOT_MAX_SPOT_MAX))
                            .replace("{buy}", String(r.buyOperationPercent ?? 0))}
                    </p>
                    {r.side === "buyer" && (r.stopLossEnabled ?? false) && (
                      <p className="text-[10px] text-orange-800">
                        {(r.stopLossMode ?? "percent") === "fixed"
                          ? (t.robotsListStopLossFixed ?? "Stop loss: {usdt} USDT").replace(
                              "{usdt}",
                              formatUsdt2(r.stopLossFixedUsdt ?? 0)
                            )
                          : (t.robotsListStopLossPct ?? "Stop loss: {pct}%").replace(
                              "{pct}",
                              String(r.stopLossPercent ?? 2)
                            )}
                      </p>
                    )}
                    {r.side === "buyer" && (r.stopGainEnabled ?? false) && (
                      <p className="text-[10px] text-emerald-800">
                        {(r.stopGainMode ?? "percent") === "fixed"
                          ? (t.robotsListStopGainFixed ?? "Stop gain: {usdt} USDT").replace(
                              "{usdt}",
                              formatUsdt2(r.stopGainFixedUsdt ?? 0)
                            )
                          : (t.robotsListStopGainPct ?? "Stop gain: {pct}%").replace(
                              "{pct}",
                              String(r.stopGainPercent ?? 2)
                            )}
                      </p>
                    )}
                    {r.side === "buyer" && (
                      <p className="text-[10px] text-violet-800">
                        {(t.robotsListBuyAccumStart ?? "Buys start after buy signal #{n}.").replace(
                          "{n}",
                          String(
                            Math.min(
                              ROBOT_BUY_ACCUM_START_SIGNAL_MAX,
                              Math.max(
                                ROBOT_BUY_ACCUM_START_SIGNAL_MIN,
                                Math.floor(r.buyAccumulationStartOnSignalNumber ?? 1)
                              )
                            )
                          )
                        )}
                      </p>
                    )}
                    {r.side === "buyer" && (
                      <p className="text-[10px] text-violet-800">
                        {(t.robotsListBuyAccumMaxCandles ?? "Sequential buy window: up to {n} candles.").replace(
                          "{n}",
                          String(
                            Math.min(
                              ROBOT_BUY_ACCUM_MAX_CANDLES_MAX,
                              Math.max(
                                ROBOT_BUY_ACCUM_MAX_CANDLES_MIN,
                                Math.floor(r.buyAccumMaxCandles ?? ROBOT_BUY_ACCUM_MAX_CANDLES_DEFAULT)
                              )
                            )
                          )
                        )}
                      </p>
                    )}
                    {r.side === "buyer" && (r.postFlattenSignalSellCombinedStrategyIds?.length ?? 0) > 0 && (
                      <p className="text-[10px] text-zinc-600">
                        {(t.robotsListPostFlattenSellLine ?? "Sell after arm: {n} strategies").replace(
                          "{n}",
                          String(r.postFlattenSignalSellCombinedStrategyIds?.length ?? 0)
                        )}
                      </p>
                    )}
                    {r.side === "seller" && (r.postFlattenSignalBuyCombinedStrategyIds?.length ?? 0) > 0 && (
                      <p className="text-[10px] text-zinc-600">
                        {(t.robotsListPostFlattenBuyLine ?? "Buy after arm: {n} strategies").replace(
                          "{n}",
                          String(r.postFlattenSignalBuyCombinedStrategyIds?.length ?? 0)
                        )}
                      </p>
                    )}
                    <div className="text-xs text-zinc-600 space-y-1">
                      <p className="font-medium text-zinc-700">{t.robotsBuyColumnsLabel ?? "Buy columns"}</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {r.buyCombinedStrategyIds.map((id) => (
                          <li key={`buy_${id}`} className="truncate">
                            {strategyLabel(id)}
                          </li>
                        ))}
                      </ul>
                      <p className="font-medium text-zinc-700">{t.robotsSellColumnsLabel ?? "Sell columns"}</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {r.sellCombinedStrategyIds.map((id) => (
                          <li key={`sell_${id}`} className="truncate">
                            {strategyLabel(id)}
                          </li>
                        ))}
                      </ul>
                      {(r.flattenCombinedStrategyIds?.length ?? 0) > 0 && (
                        <>
                          <p className="font-medium text-zinc-700">{t.robotsFlattenColumnsLabel ?? "Flatten (breakeven)"}</p>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {(r.flattenCombinedStrategyIds ?? []).map((id) => (
                              <li key={`flat_${id}`} className="truncate">
                                {strategyLabel(id)}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditRobot(r)}
                      className="text-xs px-2 py-1.5 rounded border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 w-full"
                    >
                      {t.robotsEdit ?? "Edit"}
                    </button>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setReportRobot(r)}
                        className="text-xs px-2 py-1.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 w-full"
                      >
                        {t.robotsLiveReportButton ?? "Report"}
                      </button>
                      {r.side === "buyer" && r.buyCombinedStrategyIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            window.dispatchEvent(
                              new CustomEvent(CRYPTO_SISTEMA_BACKTEST_OPEN_PANEL_EVENT, {
                                detail: { robotId: r.id },
                              })
                            );
                          }}
                          className="text-xs px-2 py-1.5 rounded border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 w-full"
                        >
                          {t.robotsBacktestRun ?? "Backtest"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleActivateSaved(r)}
                        disabled={r.isActive}
                        className="text-xs px-2 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t.robotsApplySaved ?? "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeactivateSaved(r)}
                        disabled={!r.isActive}
                        className="text-xs px-2 py-1.5 rounded border border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100 w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t.robotsDeactivateSaved ?? "Deactivate"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {view === "add" && (
          <>
            {editingRobotId && (
              <p className="text-xs font-medium text-violet-800 bg-violet-50 border border-violet-200 rounded px-2 py-1.5">
                {t.robotsEditTitle ?? "Editing robot"}
              </p>
            )}
            <label className="block">
              <span className="text-xs font-medium text-zinc-700 mb-1 block">{t.robotsAliasLabel ?? "Alias (optional)"}</span>
              <input
                type="text"
                value={robotAlias}
                onChange={(e) => setRobotAlias(e.target.value.slice(0, ROBOT_ALIAS_MAX_LEN))}
                placeholder={t.robotsAliasPlaceholder ?? "e.g. BTC scalp"}
                className="w-full text-xs border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900"
                maxLength={ROBOT_ALIAS_MAX_LEN}
                autoComplete="off"
              />
            </label>

            <div>
              <p className="text-xs font-medium text-zinc-700 mb-1.5">{t.robotsSideLabel ?? "Side"}</p>
              <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSide("buyer")}
                  className={`flex-1 px-3 py-2 text-xs font-medium ${
                    side === "buyer" ? "bg-violet-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {t.robotsSideBuyer ?? "Buyer"}
                </button>
                <button
                  type="button"
                  onClick={() => setSide("seller")}
                  className={`flex-1 px-3 py-2 text-xs font-medium border-l border-zinc-200 ${
                    side === "seller" ? "bg-violet-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {t.robotsSideSeller ?? "Seller"}
                </button>
              </div>
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/90 px-2 py-1.5 text-[10px] text-amber-950 leading-snug">
                <p className="font-semibold mb-0.5">{t.robotsMandatoryLegRuleTitle ?? "Fixed price rule (always on)"}</p>
                <p>{t.robotsMandatoryLegRuleBuyer ?? ""}</p>
                <p className="mt-1">{t.robotsMandatoryLegRuleSeller ?? ""}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-zinc-700 mb-1">{t.robotsPickBuyCombinedLabel ?? "Buy columns (add one at a time)"}</p>
                {combinedForContext.length === 0 ? (
                  <p className="text-xs text-zinc-500">{t.robotsNoCombined ?? "No combined strategies available for this symbol and interval."}</p>
                ) : buyAvailableToPick.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    {buyChosenIds.length > 0
                      ? (t.robotsAllStrategiesInList ?? "All available strategies are already in the list.")
                      : (t.robotsNoCombined ?? "No combined strategies available for this symbol and interval.")}
                  </p>
                ) : (
                  <div className="flex gap-1.5">
                    <select
                      value={buyPickId}
                      onChange={(e) => setBuyPickId(e.target.value)}
                      className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-800"
                    >
                      <option value="">{t.robotsSelectPlaceholder ?? "Choose…"}</option>
                      {buyAvailableToPick.map((s: Strategy) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddBuyOne}
                      disabled={!buyPickId}
                      className="shrink-0 text-xs px-2 py-1.5 rounded border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {t.robotsAddStrategyToRobot ?? "Add"}
                    </button>
                  </div>
                )}
                <p className="text-xs font-medium text-zinc-700 mt-2 mb-1">{t.robotsChosenBuyStrategies ?? "Selected buy columns"}</p>
                {buyChosenIds.length === 0 ? (
                  <p className="text-xs text-zinc-500">{t.robotsChosenEmpty ?? "None yet."}</p>
                ) : (
                  <ul className="space-y-1">
                    {buyChosenIds.map((id) => (
                      <li
                        key={`buy_${id}`}
                        className="flex items-center justify-between gap-2 text-xs bg-zinc-100 rounded px-2 py-1.5"
                      >
                        <span className="truncate text-zinc-800">{strategyLabel(id)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveBuyChosen(id)}
                          className="text-zinc-500 hover:text-red-600 shrink-0"
                          aria-label={t.robotsRemoveChosen ?? "Remove"}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-700 mb-1">{t.robotsPickSellCombinedLabel ?? "Sell columns (add one at a time)"}</p>
                <p className="text-[10px] text-zinc-500 mb-1">
                  {t.robotsSellAfterBuyHint ?? "For buyer robots, sell only executes after a previous buy."}
                </p>
                {combinedForContext.length === 0 ? (
                  <p className="text-xs text-zinc-500">{t.robotsNoCombined ?? "No combined strategies available for this symbol and interval."}</p>
                ) : sellAvailableToPick.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    {sellChosenIds.length > 0
                      ? (t.robotsAllStrategiesInList ?? "All available strategies are already in the list.")
                      : (t.robotsNoCombined ?? "No combined strategies available for this symbol and interval.")}
                  </p>
                ) : (
                  <div className="flex gap-1.5">
                    <select
                      value={sellPickId}
                      onChange={(e) => setSellPickId(e.target.value)}
                      className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-800"
                    >
                      <option value="">{t.robotsSelectPlaceholder ?? "Choose…"}</option>
                      {sellAvailableToPick.map((s: Strategy) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddSellOne}
                      disabled={!sellPickId}
                      className="shrink-0 text-xs px-2 py-1.5 rounded border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {t.robotsAddStrategyToRobot ?? "Add"}
                    </button>
                  </div>
                )}
                <p className="text-xs font-medium text-zinc-700 mt-2 mb-1">{t.robotsChosenSellStrategies ?? "Selected sell columns"}</p>
                {sellChosenIds.length === 0 ? (
                  <p className="text-xs text-zinc-500">{t.robotsChosenEmpty ?? "None yet."}</p>
                ) : (
                  <ul className="space-y-1">
                    {sellChosenIds.map((id) => (
                      <li
                        key={`sell_${id}`}
                        className="flex items-center justify-between gap-2 text-xs bg-zinc-100 rounded px-2 py-1.5"
                      >
                        <span className="truncate text-zinc-800">{strategyLabel(id)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSellChosen(id)}
                          className="text-zinc-500 hover:text-red-600 shrink-0"
                          aria-label={t.robotsRemoveChosen ?? "Remove"}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-700 mb-1">{t.robotsPickFlattenCombinedLabel ?? "Flatten strategies (optional)"}</p>
                <p className="text-[10px] text-zinc-500 mb-1">
                  {side === "buyer"
                    ? (t.robotsFlattenHintBuyer ??
                      "Flatten arms alert; first candle with close ≤ your average buy triggers a MARKET sell.")
                    : (t.robotsFlattenHintSeller ??
                      "Saved for future use; live trading does not run seller flatten yet.")}
                </p>
                {combinedForContext.length === 0 ? (
                  <p className="text-xs text-zinc-500">{t.robotsNoCombined ?? "No combined strategies available for this symbol and interval."}</p>
                ) : flattenAvailableToPick.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    {flattenChosenIds.length > 0
                      ? (t.robotsAllStrategiesInList ?? "All available strategies are already in the list.")
                      : (t.robotsNoCombined ?? "No combined strategies available for this symbol and interval.")}
                  </p>
                ) : (
                  <div className="flex gap-1.5">
                    <select
                      value={flattenPickId}
                      onChange={(e) => setFlattenPickId(e.target.value)}
                      className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-800"
                    >
                      <option value="">{t.robotsSelectPlaceholder ?? "Choose…"}</option>
                      {flattenAvailableToPick.map((s: Strategy) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddFlattenOne}
                      disabled={!flattenPickId}
                      className="shrink-0 text-xs px-2 py-1.5 rounded border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {t.robotsAddStrategyToRobot ?? "Add"}
                    </button>
                  </div>
                )}
                <p className="text-xs font-medium text-zinc-700 mt-2 mb-1">{t.robotsChosenFlattenStrategies ?? "Selected flatten strategies"}</p>
                {flattenChosenIds.length === 0 ? (
                  <p className="text-xs text-zinc-500">{t.robotsFlattenOptionalEmpty ?? "None — flatten is optional."}</p>
                ) : (
                  <ul className="space-y-1">
                    {flattenChosenIds.map((id) => (
                      <li
                        key={`flat_${id}`}
                        className="flex items-center justify-between gap-2 text-xs bg-zinc-100 rounded px-2 py-1.5"
                      >
                        <span className="truncate text-zinc-800">{strategyLabel(id)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFlattenChosen(id)}
                          className="text-zinc-500 hover:text-red-600 shrink-0"
                          aria-label={t.robotsRemoveChosen ?? "Remove"}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {side === "buyer" && (
                <div>
                  <p className="text-xs font-medium text-zinc-700 mb-1">
                    {t.robotsPickPostFlattenSellLabel ?? "Sell strategies after flatten signal (optional)"}
                  </p>
                  <p className="text-[10px] text-zinc-500 mb-1">
                    {t.robotsPostFlattenSellHint ?? ""}
                  </p>
                  {combinedForContext.length === 0 ? (
                    <p className="text-xs text-zinc-500">{t.robotsNoCombined ?? "No combined strategies."}</p>
                  ) : postFlattenSellAvailableToPick.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      {postFlattenSellChosenIds.length > 0
                        ? (t.robotsAllStrategiesInList ?? "All available strategies are already in the list.")
                        : (t.robotsNoCombined ?? "No combined strategies.")}
                    </p>
                  ) : (
                    <div className="flex gap-1.5">
                      <select
                        value={postFlattenSellPickId}
                        onChange={(e) => setPostFlattenSellPickId(e.target.value)}
                        className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-800"
                      >
                        <option value="">{t.robotsSelectPlaceholder ?? "Choose…"}</option>
                        {postFlattenSellAvailableToPick.map((s: Strategy) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddPostFlattenSellOne}
                        disabled={!postFlattenSellPickId}
                        className="shrink-0 text-xs px-2 py-1.5 rounded border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {t.robotsAddStrategyToRobot ?? "Add"}
                      </button>
                    </div>
                  )}
                  <p className="text-xs font-medium text-zinc-700 mt-2 mb-1">
                    {t.robotsChosenPostFlattenSellStrategies ?? "Selected sell-after-arm strategies"}
                  </p>
                  {postFlattenSellChosenIds.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      {t.robotsPostFlattenSellOptionalEmpty ?? "None."}
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {postFlattenSellChosenIds.map((id) => (
                        <li
                          key={`pfs_${id}`}
                          className="flex items-center justify-between gap-2 text-xs bg-zinc-100 rounded px-2 py-1.5"
                        >
                          <span className="truncate text-zinc-800">{strategyLabel(id)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePostFlattenSellChosen(id)}
                            className="text-zinc-500 hover:text-red-600 shrink-0"
                            aria-label={t.robotsRemoveChosen ?? "Remove"}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {side === "seller" && (
                <div>
                  <p className="text-xs font-medium text-zinc-700 mb-1">
                    {t.robotsPickPostFlattenBuyLabel ?? "Buy strategies after flatten signal (optional)"}
                  </p>
                  <p className="text-[10px] text-zinc-500 mb-1">
                    {t.robotsPostFlattenBuyHint ?? ""}
                  </p>
                  {combinedForContext.length === 0 ? (
                    <p className="text-xs text-zinc-500">{t.robotsNoCombined ?? "No combined strategies."}</p>
                  ) : postFlattenBuyAvailableToPick.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      {postFlattenBuyChosenIds.length > 0
                        ? (t.robotsAllStrategiesInList ?? "All available strategies are already in the list.")
                        : (t.robotsNoCombined ?? "No combined strategies.")}
                    </p>
                  ) : (
                    <div className="flex gap-1.5">
                      <select
                        value={postFlattenBuyPickId}
                        onChange={(e) => setPostFlattenBuyPickId(e.target.value)}
                        className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-800"
                      >
                        <option value="">{t.robotsSelectPlaceholder ?? "Choose…"}</option>
                        {postFlattenBuyAvailableToPick.map((s: Strategy) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddPostFlattenBuyOne}
                        disabled={!postFlattenBuyPickId}
                        className="shrink-0 text-xs px-2 py-1.5 rounded border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {t.robotsAddStrategyToRobot ?? "Add"}
                      </button>
                    </div>
                  )}
                  <p className="text-xs font-medium text-zinc-700 mt-2 mb-1">
                    {t.robotsChosenPostFlattenBuyStrategies ?? "Selected buy-after-arm strategies"}
                  </p>
                  {postFlattenBuyChosenIds.length === 0 ? (
                    <p className="text-xs text-zinc-500">{t.robotsPostFlattenBuyOptionalEmpty ?? "None."}</p>
                  ) : (
                    <ul className="space-y-1">
                      {postFlattenBuyChosenIds.map((id) => (
                        <li
                          key={`pfb_${id}`}
                          className="flex items-center justify-between gap-2 text-xs bg-zinc-100 rounded px-2 py-1.5"
                        >
                          <span className="truncate text-zinc-800">{strategyLabel(id)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePostFlattenBuyChosen(id)}
                            className="text-zinc-500 hover:text-red-600 shrink-0"
                            aria-label={t.robotsRemoveChosen ?? "Remove"}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-2 space-y-3">
              <div className="space-y-1.5 text-xs">
                {balancesLoading &&
                (spotForRobotBudget == null || !Number.isFinite(spotForRobotBudget)) ? (
                  <p className="text-zinc-500">{t.robotsBalancesLoading ?? "Loading balances…"}</p>
                ) : balancesError &&
                  (spotForRobotBudget == null || !Number.isFinite(spotForRobotBudget)) ? (
                  <p className="text-amber-800">
                    {t.robotsBalancesUnavailable ?? "Could not load spot balance. Connect Binance in Account."}
                  </p>
                ) : spotForRobotBudget != null && Number.isFinite(spotForRobotBudget) ? (
                  <>
                    <div className="flex justify-between gap-2 items-baseline">
                      <span className="text-zinc-600">{t.robotsSpotBalanceLabel ?? "Spot USDT (free)"}</span>
                      <span className="font-mono text-zinc-900 tabular-nums shrink-0">
                        {formatUsdt2(spotForRobotBudget)} USDT
                      </span>
                    </div>
                    {editingRobot?.isActive && (
                      <p className="text-[10px] text-zinc-500 leading-snug">
                        {t.robotsSpotBalanceDynamicHint ?? "Robot budget uses your current free USDT (updates when balances load)."}
                      </p>
                    )}
                    <div className="flex justify-between gap-2 items-baseline">
                      <span className="text-zinc-600">{t.robotsRobotBudgetLabel ?? "Robot max spend (USDT)"}</span>
                      <span className="font-mono text-violet-800 tabular-nums shrink-0">
                        {maxSpendUsdt != null ? `${formatUsdt2(maxSpendUsdt)} USDT` : "—"}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-zinc-500">{t.robotsBalancesUnavailable ?? "Could not load spot balance."}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-medium text-zinc-800">{t.robotsMaxSpotPercentLabel ?? "Maximum spot (%)"}</p>
                  <span className="text-xs font-mono text-violet-800 tabular-nums">{maxSpotPercent}%</span>
                </div>
                <input
                  type="range"
                  min={ROBOT_MAX_SPOT_MIN}
                  max={ROBOT_MAX_SPOT_MAX}
                  step={1}
                  value={maxSpotPercent}
                  onChange={(e) => onMaxSpotSlider(Number(e.target.value))}
                  className="w-full h-2 accent-violet-600"
                  aria-valuemin={ROBOT_MAX_SPOT_MIN}
                  aria-valuemax={ROBOT_MAX_SPOT_MAX}
                  aria-valuenow={maxSpotPercent}
                />
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-800 mb-1">{t.robotsBuyModeLabel ?? "Amount per operation"}</p>
                <div className="flex rounded-lg border border-zinc-200 overflow-hidden mb-2">
                  <button
                    type="button"
                    onClick={() => setBuyOperationMode("percent")}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium ${
                      buyOperationMode === "percent" ? "bg-violet-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {t.robotsBuyModePercent ?? "Percent of max"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBuyOperationMode("fixed");
                      if (maxSpendUsdt != null) {
                        const p = parseUsdtInput(buyFixedInput);
                        if (p !== null && p > maxSpendUsdt + 1e-9) setBuyFixedInput(formatUsdt2(maxSpendUsdt));
                      }
                    }}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium border-l border-zinc-200 ${
                      buyOperationMode === "fixed" ? "bg-violet-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {t.robotsBuyModeFixed ?? "Fixed USDT"}
                  </button>
                </div>

                {buyOperationMode === "percent" ? (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-[11px] text-zinc-600">{t.robotsBuyPerOperationLabel ?? "% of maximum"}</p>
                      <span className="text-xs font-mono text-violet-800 tabular-nums shrink-0">
                        {Math.min(buyOperationPercent, maxSpotPercent)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[11px] text-zinc-600">
                        {t.robotsBuyPercentUsdtLabel ?? "≈ USDT per operation"}
                      </p>
                      <span className="text-xs font-mono text-zinc-900 tabular-nums shrink-0">
                        {buyPercentAsUsdt != null ? `${formatUsdt2(buyPercentAsUsdt)} USDT` : "—"}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mb-1">{t.robotsBuyPerOperationHint ?? "Cannot exceed the maximum above. Default 0% of max."}</p>
                    <input
                      type="range"
                      min={0}
                      max={maxSpotPercent}
                      step={1}
                      value={Math.min(buyOperationPercent, maxSpotPercent)}
                      onChange={(e) =>
                        setBuyOperationPercent(
                          Math.min(maxSpotPercent, Math.max(0, Math.round(Number(e.target.value))))
                        )
                      }
                      className="w-full h-2 accent-violet-600"
                    />
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-zinc-600 mb-1">{t.robotsBuyFixedLabel ?? "USDT per operation"}</p>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={buyFixedInput}
                      onChange={(e) => setBuyFixedInput(e.target.value)}
                      onBlur={() => {
                        const p = parseUsdtInput(buyFixedInput);
                        if (p === null) {
                          setBuyFixedInput("0");
                          return;
                        }
                        if (maxSpendUsdt != null && p > maxSpendUsdt + 1e-9) setBuyFixedInput(formatUsdt2(maxSpendUsdt));
                        else setBuyFixedInput(p === 0 ? "0" : formatUsdt2(p));
                      }}
                      className="w-full text-xs border border-zinc-300 rounded px-2 py-1.5 font-mono bg-white text-zinc-900"
                      aria-label={t.robotsBuyFixedLabel ?? "USDT per operation"}
                    />
                    {maxSpendUsdt != null && (
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {(t.robotsBuyFixedMaxHint ?? "Max {usdt} USDT (robot budget).").replace(
                          "{usdt}",
                          formatUsdt2(maxSpendUsdt)
                        )}
                      </p>
                    )}
                  </>
                )}
              </div>

              {side === "buyer" && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-800" htmlFor="robot-buy-accum-start">
                    {t.robotsBuyAccumStartSignalLabel ?? "Start sequential buys from buy signal #"}
                  </label>
                  <select
                    id="robot-buy-accum-start"
                    value={buyAccumulationStartOnSignalNumber}
                    onChange={(e) =>
                      setBuyAccumulationStartOnSignalNumber(
                        Math.min(
                          ROBOT_BUY_ACCUM_START_SIGNAL_MAX,
                          Math.max(ROBOT_BUY_ACCUM_START_SIGNAL_MIN, Number(e.target.value))
                        )
                      )
                    }
                    className="w-full text-xs border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900"
                  >
                    {Array.from(
                      { length: ROBOT_BUY_ACCUM_START_SIGNAL_MAX - ROBOT_BUY_ACCUM_START_SIGNAL_MIN + 1 },
                      (_, i) => ROBOT_BUY_ACCUM_START_SIGNAL_MIN + i
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-zinc-600 leading-snug">
                    {t.robotsBuyAccumStartSignalHint ?? ""}
                  </p>
                </div>
              )}

              {side === "buyer" && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-800" htmlFor="robot-buy-accum-max-candles">
                    {t.robotsBuyAccumMaxCandlesLabel ?? "Max consecutive candles to try buys"}
                  </label>
                  <select
                    id="robot-buy-accum-max-candles"
                    value={buyAccumMaxCandles}
                    onChange={(e) =>
                      setBuyAccumMaxCandles(
                        Math.min(
                          ROBOT_BUY_ACCUM_MAX_CANDLES_MAX,
                          Math.max(ROBOT_BUY_ACCUM_MAX_CANDLES_MIN, Number(e.target.value))
                        )
                      )
                    }
                    className="w-full text-xs border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900"
                  >
                    {Array.from(
                      { length: ROBOT_BUY_ACCUM_MAX_CANDLES_MAX - ROBOT_BUY_ACCUM_MAX_CANDLES_MIN + 1 },
                      (_, i) => ROBOT_BUY_ACCUM_MAX_CANDLES_MIN + i
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-zinc-600 leading-snug">
                    {t.robotsBuyAccumMaxCandlesHint ?? ""}
                  </p>
                </div>
              )}

              {side === "buyer" && (
                <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-2 space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stopLossEnabled}
                      onChange={(e) => setStopLossEnabled(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 text-violet-600"
                    />
                    <span className="text-xs font-medium text-zinc-800">{t.robotsStopLossEnable ?? "Stop loss (market sell)"}</span>
                  </label>
                  <p className="text-[10px] text-zinc-600 leading-snug pl-6 -mt-1">
                    {t.robotsStopLossIntro ?? "While holding a position from buys, sell at market if unrealized loss reaches the limit below. Requires recorded buys (robot execution)."}
                  </p>
                  {stopLossEnabled && (
                    <>
                      <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setStopLossMode("percent")}
                          className={`flex-1 px-2 py-1.5 text-[11px] font-medium ${
                            stopLossMode === "percent" ? "bg-orange-500 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {t.robotsStopLossModePercent ?? "Loss %"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStopLossMode("fixed")}
                          className={`flex-1 px-2 py-1.5 text-[11px] font-medium border-l border-zinc-200 ${
                            stopLossMode === "fixed" ? "bg-orange-500 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {t.robotsStopLossModeFixed ?? "Loss USDT"}
                        </button>
                      </div>
                      {stopLossMode === "percent" ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-zinc-700">{t.robotsStopLossPercentLabel ?? "Max loss vs avg buy (%)"}</span>
                            <span className="text-xs font-mono text-orange-800 tabular-nums">{stopLossPercent.toFixed(1)}%</span>
                          </div>
                          <input
                            type="range"
                            min={ROBOT_STOP_LOSS_PCT_MIN}
                            max={ROBOT_STOP_LOSS_PCT_MAX}
                            step={0.1}
                            value={Math.min(ROBOT_STOP_LOSS_PCT_MAX, Math.max(ROBOT_STOP_LOSS_PCT_MIN, stopLossPercent))}
                            onChange={(e) => setStopLossPercent(Number(e.target.value))}
                            className="w-full h-2 accent-orange-500"
                          />
                        </>
                      ) : (
                        <>
                          <p className="text-[11px] text-zinc-700">{t.robotsStopLossFixedLabel ?? "Max unrealized loss (USDT)"}</p>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={stopLossFixedInput}
                            onChange={(e) => setStopLossFixedInput(e.target.value)}
                            onBlur={() => {
                              const p = parseUsdtInput(stopLossFixedInput);
                              if (p === null) setStopLossFixedInput("0");
                              else setStopLossFixedInput(p === 0 ? "0" : formatUsdt2(p));
                            }}
                            className="w-full text-xs border border-zinc-300 rounded px-2 py-1.5 font-mono bg-white text-zinc-900"
                          />
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
              {side === "buyer" && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2 space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stopGainEnabled}
                      onChange={(e) => setStopGainEnabled(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 text-violet-600"
                    />
                    <span className="text-xs font-medium text-zinc-800">{t.robotsStopGainEnable ?? "Stop gain (market sell)"}</span>
                  </label>
                  <p className="text-[10px] text-zinc-600 leading-snug pl-6 -mt-1">
                    {t.robotsStopGainIntro ??
                      "While holding a position from robot buys, unrealized PnL updates every second. If gain reaches the limit below, send market sell. Buys must be recorded by robot execution event."}
                  </p>
                  {stopGainEnabled && (
                    <>
                      <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setStopGainMode("percent")}
                          className={`flex-1 px-2 py-1.5 text-[11px] font-medium ${
                            stopGainMode === "percent" ? "bg-emerald-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {t.robotsStopGainModePercent ?? "Gain vs avg (%)"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStopGainMode("fixed")}
                          className={`flex-1 px-2 py-1.5 text-[11px] font-medium border-l border-zinc-200 ${
                            stopGainMode === "fixed" ? "bg-emerald-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {t.robotsStopGainModeFixed ?? "Gain (USDT)"}
                        </button>
                      </div>
                      {stopGainMode === "percent" ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-zinc-700">{t.robotsStopGainPercentLabel ?? "Max gain vs avg buy (%)"}</span>
                            <span className="text-xs font-mono text-emerald-800 tabular-nums">{stopGainPercent.toFixed(1)}%</span>
                          </div>
                          <input
                            type="range"
                            min={ROBOT_STOP_LOSS_PCT_MIN}
                            max={ROBOT_STOP_LOSS_PCT_MAX}
                            step={0.1}
                            value={Math.min(ROBOT_STOP_LOSS_PCT_MAX, Math.max(ROBOT_STOP_LOSS_PCT_MIN, stopGainPercent))}
                            onChange={(e) => setStopGainPercent(Number(e.target.value))}
                            className="w-full h-2 accent-emerald-600"
                          />
                        </>
                      ) : (
                        <>
                          <p className="text-[11px] text-zinc-700">{t.robotsStopGainFixedLabel ?? "Max unrealized gain (USDT)"}</p>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={stopGainFixedInput}
                            onChange={(e) => setStopGainFixedInput(e.target.value)}
                            onBlur={() => {
                              const p = parseUsdtInput(stopGainFixedInput);
                              if (p === null) setStopGainFixedInput("0");
                              else setStopGainFixedInput(p === 0 ? "0" : formatUsdt2(p));
                            }}
                            className="w-full text-xs border border-zinc-300 rounded px-2 py-1.5 font-mono bg-white text-zinc-900"
                          />
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5 whitespace-pre-wrap">
                {errorMsg}
              </div>
            )}

            <div className="mt-auto flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSaveRobotForm}
                disabled={buyChosenIds.length === 0 || sellChosenIds.length === 0}
                className="text-sm font-medium px-3 py-2.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingRobotId ? (t.robotsSaveEdit ?? "Save changes") : (t.robotsSaveNew ?? "Save robot (inactive)")}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetAddForm();
                  setView("list");
                }}
                className="text-sm font-medium px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              >
                {editingRobotId ? (t.robotsCancelEdit ?? "Cancel") : (t.robotsBackToList ?? "Back to list")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    {reportRobot ? (
      <RobotLiveReportModal
        key={reportRobot.id}
        open
        onClose={() => setReportRobot(null)}
        robot={reportRobot}
        symbolFilter={symbol?.trim() ? symbol.trim().toUpperCase() : null}
        t={t}
      />
    ) : null}
    </>
  );
}
