"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { useAppBarSafe } from "@/app/AppBarSafeContext";
import { getCryptoT } from "@/app/lib/translations";
import {
  useKlinesIndicators,
  type UserIndicatorConfig,
  type IndicatorPanel,
  type IndicatorLineWidth,
  type IndicatorLineStyle,
} from "./KlinesIndicatorsContext";
import { useStrategies } from "./strategies/StrategiesContext";
import { useChartLayoutSave } from "./ChartLayoutSaveContext";
import {
  INDICATOR_COLOR_PALETTE,
  INTERVAL_OPTIONS,
  MAIN_MAX_INDICATORS,
  SECONDARY_MAX_INDICATORS,
  getIndicatorLabel,
  isMovingAverageType,
  useIndicatorsPanelFields,
} from "./indicatorsPanel/index";
import { KLINE_LAST_LAYOUT_KEY, DEFAULT_MODEL_MAX_INDICATORS, DEFAULT_LAYOUT_ALLOWED_INDICATOR_TYPES } from "./KlinesChartConstants";
import { IndicatorsPanelContext } from "./indicatorsPanel/IndicatorsPanelContext";
import { IndicatorsPanelAddForm } from "./indicatorsPanel/IndicatorsPanelAddForm";
import { IndicatorsPanelIndicatorCard } from "./indicatorsPanel/IndicatorsPanelIndicatorCard";
import type { AddFormState, EditFormState, IndicatorsPanelContextValue } from "./indicatorsPanel/indicatorsPanelTypes";
import {
  clampMa2TimeWindowUserValue,
  defaultMa2TimeValueForUnit,
  isTimeWindowMa2Type,
  normalizeMa2TimeValueForUnit,
} from "./indicatorsPanel/wma2Period";

/** Re-export para quem importa de IndicatorsPanel (ex.: KlinesTable). */
export { getIndicatorLabel, getIndicatorLabelShort, getIndicatorLabelSignal, getIndicatorLabelShortSignal, getIndicatorLabelStochD, getIndicatorLabelShortStochD } from "./indicatorsPanel/index";

const INITIAL_ADD_FORM: AddFormState = {
  indicatorType: "SMA",
  period: 7,
  periodText: "7",
  fieldKey: "close",
  color: INDICATOR_COLOR_PALETTE[7] ?? "#3b82f6",
  colorOpen: false,
  chartOption: "main",
  lineWidth: "normal",
  lineStyle: "solid",
  macdFastMaType: "EMA",
  macdFastPeriod: 12,
  macdFastPeriodText: "12",
  macdSlowMaType: "EMA",
  macdSlowPeriod: 26,
  macdSlowPeriodText: "26",
  macdSignalLine: false,
  macdSignalMaType: "EMA",
  macdSignalPeriod: 9,
  macdSignalPeriodText: "9",
  macdSignalColor: "#ea580c",
  macdSignalLineWidth: "normal",
  macdSignalLineStyle: "dashed",
  macdHistogram: false,
  macdHistogramColorAbove: "#059669",
  macdHistogramColorBelow: "#dc2626",
  rsiFixedScale: true,
  rsiCenterLine: false,
  rsiCenterLineColor: "#71717a",
  rsiCenterLineWidth: "normal",
  rsiCenterLineStyle: "dotted",
  rsiLimits: false,
  rsiLimitUpper: 90,
  rsiLimitLower: 10,
  rsiLimitColor: "#dc2626",
  rsiLimitLineWidth: "normal",
  rsiLimitLineStyle: "dotted",
  mfiFixedScale: true,
  mfiCenterLine: false,
  mfiCenterLineColor: "#71717a",
  mfiCenterLineWidth: "normal",
  mfiCenterLineStyle: "dotted",
  mfiLimits: false,
  mfiLimitUpper: 80,
  mfiLimitLower: 20,
  mfiLimitColor: "#dc2626",
  mfiLimitLineWidth: "normal",
  mfiLimitLineStyle: "dotted",
  stochLimits: false,
  stochLimitUpper: 80,
  stochLimitLower: 20,
  stochLimitColor: "#dc2626",
  stochLimitLineWidth: "normal",
  stochLimitLineStyle: "dotted",
  stochDLine: false,
  stochDMaType: "SMA",
  stochDPeriod: 3,
  stochDPeriodText: "3",
  stochDColor: "#ea580c",
  stochDLineWidth: "normal",
  stochDLineStyle: "dashed",
  williamsRLimits: true,
  williamsRLimitUpper: -20,
  williamsRLimitLower: -80,
  williamsRLimitColor: "#dc2626",
  williamsRLimitLineWidth: "normal",
  williamsRLimitLineStyle: "dotted",
  sarStart: 0.02,
  sarStartText: "0.02",
  sarIncrement: 0.02,
  sarIncrementText: "0.02",
  sarMax: 0.2,
  sarMaxText: "0.2",
  sarPointSize: "normal",
  bollingerMaType: "SMA",
  bollingerZ: 2,
  bollingerZText: "2",
  bollingerShowUpper: true,
  bollingerShowLower: true,
  bollingerShowMiddle: false,
  bollingerBandOpacity: 0.2,
  bollingerBandOpacityText: "20",
  bollingerLimitsColor: "#6366f1",
  bollingerLimitsColorOpen: false,
  bollingerLimitsLineStyle: "solid",
  bollingerLimitsLineWidth: "normal",
  bollingerMiddleColor: "#a855f7",
  bollingerMiddleLineStyle: "dashed",
  bollingerMiddleLineWidth: "normal",
  keltnerMaType: "EMA",
  keltnerMultiplier: 2,
  keltnerMultiplierText: "2",
  keltnerShowUpper: true,
  keltnerShowLower: true,
  keltnerShowMiddle: false,
  keltnerBandOpacity: 0.2,
  keltnerBandOpacityText: "20",
  keltnerLimitsColor: "#6366f1",
  keltnerLimitsColorOpen: false,
  keltnerLimitsLineStyle: "solid",
  keltnerLimitsLineWidth: "normal",
  keltnerMiddleColor: "#a855f7",
  keltnerMiddleLineStyle: "dashed",
  keltnerMiddleLineWidth: "normal",
  obvVolumeSource: "base",
  adVolumeSource: "base",
  volumeInUsdt: false,
  volumeColorAbove: "#10b981",
  volumeColorBelow: "#ef4444",
  volumeColorAboveOpen: false,
  volumeColorBelowOpen: false,
  adxPlusDiColor: "#22c55e",
  adxPlusDiLineWidth: "normal",
  adxPlusDiLineStyle: "solid",
  adxMinusDiColor: "#ef4444",
  adxMinusDiLineWidth: "normal",
  adxMinusDiLineStyle: "solid",
  adxAdxColor: "#eab308",
  adxAdxLineWidth: "normal",
  adxAdxLineStyle: "solid",
  adxFixedScale: true,
  adxLimits: false,
  adxLimitUpper: 25,
  adxLimitLower: 20,
  adxLimitColor: "#71717a",
  adxLimitLineWidth: "normal",
  adxLimitLineStyle: "dotted",
  cciFixedScale: false,
  cciLimits: true,
  cciLimitUpper: 100,
  cciLimitLower: -100,
  cciLimitColor: "#dc2626",
  cciLimitLineWidth: "normal",
  cciLimitLineStyle: "dotted",
  cciAsHistogram: false,
  cciHistogramColorAbove: "#059669",
  cciHistogramColorBelow: "#dc2626",
  cmfFixedScale: false,
  cmfLimits: true,
  cmfLimitUpper: 0.25,
  cmfLimitLower: -0.25,
  cmfLimitColor: "#dc2626",
  cmfLimitLineWidth: "normal",
  cmfLimitLineStyle: "dotted",
  cmfAsHistogram: false,
  cmfHistogramColorAbove: "#059669",
  cmfHistogramColorBelow: "#dc2626",
  donchianShowUpper: true,
  donchianShowLower: true,
  donchianShowMiddle: false,
  donchianBandOpacity: 0.2,
  donchianBandOpacityText: "20",
  donchianLimitsColor: "#6366f1",
  donchianLimitsLineStyle: "solid",
  donchianLimitsLineWidth: "normal",
  donchianMiddleColor: "#a855f7",
  donchianMiddleLineStyle: "dashed",
  donchianMiddleLineWidth: "normal",
  ichimokuTenkanPeriod: 9,
  ichimokuTenkanPeriodText: "9",
  ichimokuKijunPeriod: 26,
  ichimokuKijunPeriodText: "26",
  ichimokuSpanBPeriod: 52,
  ichimokuSpanBPeriodText: "52",
  ichimokuDisplacement: 26,
  ichimokuDisplacementText: "26",
  ichimokuTenkanColor: "#6366f1",
  ichimokuKijunColor: "#ea580c",
  ichimokuSpanAColor: "#22c55e",
  ichimokuSpanBColor: "#ef4444",
  ichimokuChikouColor: "#a855f7",
  ichimokuTenkanLineWidth: "normal",
  ichimokuTenkanLineStyle: "solid",
  ichimokuKijunLineWidth: "normal",
  ichimokuKijunLineStyle: "solid",
  ichimokuSpanALineWidth: "normal",
  ichimokuSpanALineStyle: "solid",
  ichimokuSpanBLineWidth: "normal",
  ichimokuSpanBLineStyle: "solid",
  ichimokuChikouLineWidth: "normal",
  ichimokuChikouLineStyle: "solid",
  ichimokuCloudOpacity: 0.3,
  ichimokuCloudOpacityText: "30",
  ichimokuShowTenkan: true,
  ichimokuShowKijun: true,
  ichimokuShowSpanA: true,
  ichimokuShowSpanB: true,
  ichimokuShowChikou: false,
  wma2TimeUnit: "hours",
  wma2TimeValue: 168,
  wma2TimeValueText: "168",
};

interface IndicatorsPanelProps {
  initialView?: "list" | "add";
  onClose?: () => void;
  /** Modo free: bloqueia seleção dos painéis 3, 4 e 5. */
  isFreeUser?: boolean;
}

export default function IndicatorsPanel({ initialView = "list", onClose, isFreeUser = false }: IndicatorsPanelProps) {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines;
  const { hideStatusBar } = useAppBarSafe();
  const { userIndicators, currentGroupMinutes, addIndicator, removeIndicator, updateIndicator, updateIndicatorIntervals } = useKlinesIndicators();
  const { appliedStrategyIds, replaceAppliedStrategyIdsFromLayout } = useStrategies();
  const chartLayoutSave = useChartLayoutSave();
  const [deleteConfirmIndicator, setDeleteConfirmIndicator] = useState<{ id: string; label: string } | null>(null);
  const requestRemoveIndicator = useCallback((id: string) => {
    const ind = userIndicators.find((i) => i.id === id);
    setDeleteConfirmIndicator({ id, label: ind ? getIndicatorLabel(ind, t, userIndicators) : id });
  }, [userIndicators, t]);
  const addFormRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (initialView === "add" && addFormRef.current) {
      addFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [initialView]);

  const [addForm, setAddForm] = useState<AddFormState>(INITIAL_ADD_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  /** true = só indicadores que aparecem no timeframe atual; false = todos do layout (incluindo outros timeframes). */
  const [showOnlyCurrentTimeframe, setShowOnlyCurrentTimeframe] = useState(true);

  const getPanel = (i: UserIndicatorConfig) => i.panel ?? (i.type === "RSI" || i.type === "MFI" || i.type === "MACD" || i.type === "Stochastic" || i.type === "WilliamsR" || i.type === "OBV" || i.type === "AD" || i.type === "ATR" || i.type === "ADX" || i.type === "CCI" ? "panel2" : "main");

  const indicatorCountByPanel = useMemo(() => {
    let main = 0;
    let panel2 = 0;
    let panel3 = 0;
    let panel4 = 0;
    let panel5 = 0;
    for (const i of userIndicators) {
      const p = getPanel(i);
      if (p === "main") main++;
      else if (p === "panel2") panel2++;
      else if (p === "panel3") panel3++;
      else if (p === "panel4") panel4++;
      else if (p === "panel5") panel5++;
    }
    return { main, panel2, panel3, panel4, panel5 };
  }, [userIndicators]);

  const panelsWithSecondary = useMemo(() => ({
    panel2: indicatorCountByPanel.panel2 > 0,
    panel3: indicatorCountByPanel.panel3 > 0,
    panel4: indicatorCountByPanel.panel4 > 0,
    panel5: indicatorCountByPanel.panel5 > 0,
  }), [indicatorCountByPanel]);

  const panelsFreeForSecondary = useMemo(() => ({
    panel2: indicatorCountByPanel.panel2 < SECONDARY_MAX_INDICATORS,
    panel3: !isFreeUser && indicatorCountByPanel.panel3 < SECONDARY_MAX_INDICATORS,
    panel4: !isFreeUser && indicatorCountByPanel.panel4 < SECONDARY_MAX_INDICATORS,
    panel5: !isFreeUser && indicatorCountByPanel.panel5 < SECONDARY_MAX_INDICATORS,
  }), [indicatorCountByPanel, isFreeUser]);

  const panelsFreeForSecondaryEdit = useMemo(() => {
    if (!editingId) return { panel2: true, panel3: !isFreeUser, panel4: !isFreeUser, panel5: !isFreeUser };
    const editing = userIndicators.find((i) => i.id === editingId);
    const editingPanel = editing ? getPanel(editing) : null;
    return {
      panel2: indicatorCountByPanel.panel2 < SECONDARY_MAX_INDICATORS || editingPanel === "panel2",
      panel3: (!isFreeUser && (indicatorCountByPanel.panel3 < SECONDARY_MAX_INDICATORS || editingPanel === "panel3")),
      panel4: (!isFreeUser && (indicatorCountByPanel.panel4 < SECONDARY_MAX_INDICATORS || editingPanel === "panel4")),
      panel5: (!isFreeUser && (indicatorCountByPanel.panel5 < SECONDARY_MAX_INDICATORS || editingPanel === "panel5")),
    };
  }, [userIndicators, editingId, indicatorCountByPanel, isFreeUser]);

  const setFieldKey = useCallback((v: import("./KlinesIndicatorsContext").IndicatorFieldKey) => {
    setAddForm((prev) => ({ ...prev, fieldKey: v }));
  }, []);

  const {
    fieldOptions,
    firstEnabledFieldValue,
    firstEnabledFieldValueForAdd,
    fieldOptionsVisibleForAdd,
    isMovingAverageType: isMA,
  } = useIndicatorsPanelFields({
    userIndicators,
    editingId,
    indicatorType: addForm.indicatorType,
    t,
    fieldKey: addForm.fieldKey,
    editForm,
    setFieldKey,
    setEditForm,
  });

  const hasFreePanelForSecondary = panelsFreeForSecondary.panel2 || panelsFreeForSecondary.panel3 || panelsFreeForSecondary.panel4 || panelsFreeForSecondary.panel5;
  const isSecondaryType = addForm.indicatorType === "RSI" || addForm.indicatorType === "MFI" || addForm.indicatorType === "MACD" || addForm.indicatorType === "Stochastic" || addForm.indicatorType === "WilliamsR" || addForm.indicatorType === "OBV" || addForm.indicatorType === "AD" || addForm.indicatorType === "ATR" || addForm.indicatorType === "ADX" || addForm.indicatorType === "CCI" || addForm.indicatorType === "CMF" || addForm.indicatorType === "Volume";
  const hasEmptyPanelForVolume = indicatorCountByPanel.panel2 === 0 || indicatorCountByPanel.panel3 === 0 || indicatorCountByPanel.panel4 === 0 || indicatorCountByPanel.panel5 === 0;
  const chosenPanelUsedForVolume =
    (addForm.chartOption === "panel2" && indicatorCountByPanel.panel2 > 0) ||
    (addForm.chartOption === "panel3" && indicatorCountByPanel.panel3 > 0) ||
    (addForm.chartOption === "panel4" && indicatorCountByPanel.panel4 > 0) ||
    (addForm.chartOption === "panel5" && indicatorCountByPanel.panel5 > 0);
  const isDefaultModel =
    typeof window !== "undefined" &&
    (() => {
      const raw = window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY);
      return raw === "default" || raw === "0";
    })();
  const defaultModelMaxIndicatorsReached = isDefaultModel && userIndicators.length >= DEFAULT_MODEL_MAX_INDICATORS;

  const mainPanelFull = indicatorCountByPanel.main >= MAIN_MAX_INDICATORS;
  const chosenPanelFull =
    (addForm.chartOption === "main" && mainPanelFull) ||
    (addForm.chartOption === "panel2" && indicatorCountByPanel.panel2 >= SECONDARY_MAX_INDICATORS) ||
    (addForm.chartOption === "panel3" && indicatorCountByPanel.panel3 >= SECONDARY_MAX_INDICATORS) ||
    (addForm.chartOption === "panel4" && indicatorCountByPanel.panel4 >= SECONDARY_MAX_INDICATORS) ||
    (addForm.chartOption === "panel5" && indicatorCountByPanel.panel5 >= SECONDARY_MAX_INDICATORS);
  const defaultLayoutTypeBlocked = isDefaultModel && !DEFAULT_LAYOUT_ALLOWED_INDICATOR_TYPES.includes(addForm.indicatorType);
  const addButtonDisabled =
    defaultModelMaxIndicatorsReached ||
    defaultLayoutTypeBlocked ||
    (addForm.indicatorType === "Volume" && (!hasEmptyPanelForVolume || chosenPanelUsedForVolume)) ||
    (isSecondaryType && addForm.indicatorType !== "Volume" && !hasFreePanelForSecondary) ||
    (!isSecondaryType && chosenPanelFull);

  const handleAdd = useCallback(() => {
    if (defaultModelMaxIndicatorsReached) return;
    const n = Number(addForm.periodText);
    const periodNum = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : Math.max(1, Math.min(500, addForm.period));
    const fastP = addForm.indicatorType === "MACD" ? (Number(addForm.macdFastPeriodText) || 12) : periodNum;
    const slowP = addForm.indicatorType === "MACD" ? (Number(addForm.macdSlowPeriodText) || 26) : periodNum;
    setAddForm((prev) => ({ ...prev, period: periodNum, periodText: String(periodNum) }));
    const effectivePanel: IndicatorPanel = addForm.indicatorType === "SAR" || addForm.indicatorType === "VWAP" || addForm.indicatorType === "Ichimoku"
      ? "main"
      : addForm.indicatorType === "Volume"
      ? isFreeUser
        ? "panel2"
        : (addForm.chartOption === "panel2" && indicatorCountByPanel.panel2 === 0) || (addForm.chartOption === "panel3" && indicatorCountByPanel.panel3 === 0) || (addForm.chartOption === "panel4" && indicatorCountByPanel.panel4 === 0) || (addForm.chartOption === "panel5" && indicatorCountByPanel.panel5 === 0)
          ? addForm.chartOption
          : (indicatorCountByPanel.panel2 === 0 ? "panel2" : indicatorCountByPanel.panel3 === 0 ? "panel3" : indicatorCountByPanel.panel4 === 0 ? "panel4" : indicatorCountByPanel.panel5 === 0 ? "panel5" : "panel2")
      : addForm.indicatorType === "RSI" || addForm.indicatorType === "MACD" || addForm.indicatorType === "Stochastic" || addForm.indicatorType === "WilliamsR" || addForm.indicatorType === "OBV" || addForm.indicatorType === "AD" || addForm.indicatorType === "ATR" || addForm.indicatorType === "ADX" || addForm.indicatorType === "CCI" || addForm.indicatorType === "CMF"
      ? (addForm.chartOption === "panel2" && panelsFreeForSecondary.panel2) || (addForm.chartOption === "panel3" && panelsFreeForSecondary.panel3) || (addForm.chartOption === "panel4" && panelsFreeForSecondary.panel4) || (addForm.chartOption === "panel5" && panelsFreeForSecondary.panel5)
        ? addForm.chartOption
        : (panelsFreeForSecondary.panel2 ? "panel2" : panelsFreeForSecondary.panel3 ? "panel3" : panelsFreeForSecondary.panel4 ? "panel4" : panelsFreeForSecondary.panel5 ? "panel5" : "panel2")
      : (addForm.chartOption === "panel2" && !panelsWithSecondary.panel2) || (addForm.chartOption === "panel3" && !panelsWithSecondary.panel3) || (addForm.chartOption === "panel4" && !panelsWithSecondary.panel4) || (addForm.chartOption === "panel5" && !panelsWithSecondary.panel5)
        ? addForm.chartOption
        : (addForm.chartOption === "panel2" || addForm.chartOption === "panel3" || addForm.chartOption === "panel4" || addForm.chartOption === "panel5" ? addForm.chartOption : "main");
    const parseSar = (s: string, def: number, min: number, max: number) => {
      const n = parseFloat(s);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
    };
    const addMa2Unit =
      addForm.wma2TimeUnit === "days" || addForm.wma2TimeUnit === "hours" || addForm.wma2TimeUnit === "minutes"
        ? addForm.wma2TimeUnit
        : "hours";
    const wma2AddVal = (() => {
      const n = Number(addForm.wma2TimeValueText);
      const raw =
        Number.isFinite(n) && n > 0
          ? clampMa2TimeWindowUserValue(n)
          : addForm.wma2TimeValue ?? defaultMa2TimeValueForUnit(addMa2Unit);
      return normalizeMa2TimeValueForUnit(addMa2Unit, raw);
    })();
    const newInd = addIndicator({
      type: addForm.indicatorType,
      period:
        addForm.indicatorType === "MACD"
          ? fastP
          : addForm.indicatorType === "Ichimoku"
            ? (parseInt(addForm.ichimokuKijunPeriodText, 10) || 26)
            : addForm.indicatorType === "OBV" || addForm.indicatorType === "AD" || addForm.indicatorType === "SAR" || addForm.indicatorType === "VWAP" || addForm.indicatorType === "Volume" || isTimeWindowMa2Type(addForm.indicatorType)
              ? 1
              : periodNum,
      fieldKey: addForm.indicatorType === "OBV" || addForm.indicatorType === "AD" || addForm.indicatorType === "Volume" ? "volume" : addForm.indicatorType === "SAR" || addForm.indicatorType === "ATR" || addForm.indicatorType === "ADX" || addForm.indicatorType === "VWAP" || addForm.indicatorType === "CMF" || addForm.indicatorType === "Ichimoku" ? "close" : addForm.indicatorType === "CCI" ? (addForm.fieldKey ?? "HLC3") : addForm.fieldKey,
      ...(addForm.indicatorType === "Bollinger" ? {
        bollingerMaType: addForm.bollingerMaType,
        bollingerZ: Math.max(0, Math.min(3, parseFloat(addForm.bollingerZText) || 2)),
        bollingerShowUpper: addForm.bollingerShowUpper,
        bollingerShowLower: addForm.bollingerShowLower,
        bollingerShowMiddle: addForm.bollingerShowMiddle,
        bollingerBandOpacity: Math.max(0, Math.min(0.3, (parseFloat(addForm.bollingerBandOpacityText) || 20) / 100)),
        bollingerLimitsColor: addForm.bollingerLimitsColor,
        bollingerLimitsLineStyle: addForm.bollingerLimitsLineStyle,
        bollingerLimitsLineWidth: addForm.bollingerLimitsLineWidth,
        bollingerMiddleColor: addForm.color,
        bollingerMiddleLineStyle: addForm.lineStyle,
        bollingerMiddleLineWidth: addForm.lineWidth,
      } : {}),
      ...(addForm.indicatorType === "Keltner" ? {
        keltnerMaType: addForm.keltnerMaType,
        keltnerMultiplier: Math.max(0, Math.min(10, parseFloat(addForm.keltnerMultiplierText) || 2)),
        keltnerShowUpper: addForm.keltnerShowUpper,
        keltnerShowLower: addForm.keltnerShowLower,
        keltnerShowMiddle: addForm.keltnerShowMiddle,
        keltnerBandOpacity: Math.max(0, Math.min(0.3, (parseFloat(addForm.keltnerBandOpacityText) || 20) / 100)),
        keltnerLimitsColor: addForm.keltnerLimitsColor,
        keltnerLimitsLineStyle: addForm.keltnerLimitsLineStyle,
        keltnerLimitsLineWidth: addForm.keltnerLimitsLineWidth,
        keltnerMiddleColor: addForm.color,
        keltnerMiddleLineStyle: addForm.lineStyle,
        keltnerMiddleLineWidth: addForm.lineWidth,
      } : {}),
      color: addForm.color,
      intervals: isTimeWindowMa2Type(addForm.indicatorType) ? [] : currentGroupMinutes != null ? [currentGroupMinutes] : [],
      panel: effectivePanel,
      lineWidth: addForm.lineWidth,
      lineStyle: addForm.lineStyle,
      ...(addForm.indicatorType === "RSI" ? { rsiFixedScale: addForm.rsiFixedScale, rsiCenterLine: addForm.rsiCenterLine, rsiCenterLineColor: addForm.rsiCenterLineColor, rsiCenterLineWidth: addForm.rsiCenterLineWidth, rsiCenterLineStyle: addForm.rsiCenterLineStyle, rsiLimits: addForm.rsiLimits, rsiLimitUpper: addForm.rsiLimitUpper, rsiLimitLower: addForm.rsiLimitLower, rsiLimitColor: addForm.rsiLimitColor, rsiLimitLineWidth: addForm.rsiLimitLineWidth, rsiLimitLineStyle: addForm.rsiLimitLineStyle } : {}),
      ...(addForm.indicatorType === "MFI" ? { mfiFixedScale: addForm.mfiFixedScale, mfiCenterLine: addForm.mfiCenterLine, mfiCenterLineColor: addForm.mfiCenterLineColor, mfiCenterLineWidth: addForm.mfiCenterLineWidth, mfiCenterLineStyle: addForm.mfiCenterLineStyle, mfiLimits: addForm.mfiLimits, mfiLimitUpper: addForm.mfiLimitUpper, mfiLimitLower: addForm.mfiLimitLower, mfiLimitColor: addForm.mfiLimitColor, mfiLimitLineWidth: addForm.mfiLimitLineWidth, mfiLimitLineStyle: addForm.mfiLimitLineStyle } : {}),
      ...(addForm.indicatorType === "MACD" ? {
        macdFastMaType: addForm.macdFastMaType,
        macdFastPeriod: Math.max(1, Math.min(500, fastP)),
        macdSlowMaType: addForm.macdSlowMaType,
        macdSlowPeriod: Math.max(1, Math.min(500, slowP)),
        macdSignalLine: addForm.macdSignalLine,
        macdSignalMaType: addForm.macdSignalMaType,
        macdSignalPeriod: addForm.macdSignalLine ? Math.max(1, Math.min(500, Number(addForm.macdSignalPeriodText) || 9)) : undefined,
        macdSignalColor: addForm.macdSignalLine ? addForm.macdSignalColor : undefined,
        macdSignalLineWidth: addForm.macdSignalLine ? addForm.macdSignalLineWidth : undefined,
        macdSignalLineStyle: addForm.macdSignalLine ? addForm.macdSignalLineStyle : undefined,
        macdHistogram: addForm.macdSignalLine && addForm.macdHistogram,
        macdHistogramColorAbove: addForm.macdSignalLine && addForm.macdHistogram ? addForm.macdHistogramColorAbove : undefined,
        macdHistogramColorBelow: addForm.macdSignalLine && addForm.macdHistogram ? addForm.macdHistogramColorBelow : undefined,
      } : {}),
      ...(addForm.indicatorType === "Stochastic" ? {
        stochLimits: addForm.stochLimits,
        stochLimitUpper: addForm.stochLimitUpper,
        stochLimitLower: addForm.stochLimitLower,
        stochLimitColor: addForm.stochLimitColor,
        stochLimitLineWidth: addForm.stochLimitLineWidth,
        stochLimitLineStyle: addForm.stochLimitLineStyle,
        stochDLine: addForm.stochDLine,
        stochDMaType: addForm.stochDMaType,
        stochDPeriod: addForm.stochDLine ? Math.max(1, Math.min(500, Number(addForm.stochDPeriodText) || 3)) : undefined,
        stochDColor: addForm.stochDLine ? addForm.stochDColor : undefined,
        stochDLineWidth: addForm.stochDLine ? addForm.stochDLineWidth : undefined,
        stochDLineStyle: addForm.stochDLine ? addForm.stochDLineStyle : undefined,
      } : {}),
      ...(addForm.indicatorType === "WilliamsR" ? {
        williamsRLimits: addForm.williamsRLimits,
        williamsRLimitUpper: addForm.williamsRLimitUpper,
        williamsRLimitLower: addForm.williamsRLimitLower,
        williamsRLimitColor: addForm.williamsRLimitColor,
        williamsRLimitLineWidth: addForm.williamsRLimitLineWidth,
        williamsRLimitLineStyle: addForm.williamsRLimitLineStyle,
      } : {}),
      ...(addForm.indicatorType === "ADX" ? {
        adxPlusDiColor: addForm.adxPlusDiColor,
        adxPlusDiLineWidth: addForm.adxPlusDiLineWidth,
        adxPlusDiLineStyle: addForm.adxPlusDiLineStyle,
        adxMinusDiColor: addForm.adxMinusDiColor,
        adxMinusDiLineWidth: addForm.adxMinusDiLineWidth,
        adxMinusDiLineStyle: addForm.adxMinusDiLineStyle,
        adxAdxColor: addForm.adxAdxColor,
        adxAdxLineWidth: addForm.adxAdxLineWidth,
        adxAdxLineStyle: addForm.adxAdxLineStyle,
        adxFixedScale: addForm.adxFixedScale,
        adxLimits: addForm.adxLimits,
        adxLimitUpper: addForm.adxLimitUpper,
        adxLimitLower: addForm.adxLimitLower,
        adxLimitColor: addForm.adxLimitColor,
        adxLimitLineWidth: addForm.adxLimitLineWidth,
        adxLimitLineStyle: addForm.adxLimitLineStyle,
      } : {}),
      ...(addForm.indicatorType === "CCI" ? {
        cciFixedScale: addForm.cciFixedScale,
        cciLimits: addForm.cciLimits,
        cciLimitUpper: addForm.cciLimitUpper,
        cciLimitLower: addForm.cciLimitLower,
        cciLimitColor: addForm.cciLimitColor,
        cciLimitLineWidth: addForm.cciLimitLineWidth,
        cciLimitLineStyle: addForm.cciLimitLineStyle,
        cciAsHistogram: addForm.cciAsHistogram,
        cciHistogramColorAbove: addForm.cciHistogramColorAbove,
        cciHistogramColorBelow: addForm.cciHistogramColorBelow,
      } : {}),
      ...(addForm.indicatorType === "CMF" ? {
        cmfFixedScale: addForm.cmfFixedScale,
        cmfLimits: addForm.cmfLimits,
        cmfLimitUpper: addForm.cmfLimitUpper,
        cmfLimitLower: addForm.cmfLimitLower,
        cmfLimitColor: addForm.cmfLimitColor,
        cmfLimitLineWidth: addForm.cmfLimitLineWidth,
        cmfLimitLineStyle: addForm.cmfLimitLineStyle,
        cmfAsHistogram: addForm.cmfAsHistogram,
        cmfHistogramColorAbove: addForm.cmfHistogramColorAbove,
        cmfHistogramColorBelow: addForm.cmfHistogramColorBelow,
      } : {}),
      ...(addForm.indicatorType === "Donchian" ? {
        donchianShowUpper: addForm.donchianShowUpper,
        donchianShowLower: addForm.donchianShowLower,
        donchianShowMiddle: addForm.donchianShowMiddle,
        donchianBandOpacity: Math.max(0, Math.min(0.3, (parseFloat(addForm.donchianBandOpacityText) || 20) / 100)),
        donchianLimitsColor: addForm.donchianLimitsColor,
        donchianLimitsLineStyle: addForm.donchianLimitsLineStyle,
        donchianLimitsLineWidth: addForm.donchianLimitsLineWidth,
        donchianMiddleColor: addForm.donchianMiddleColor,
        donchianMiddleLineStyle: addForm.donchianMiddleLineStyle,
        donchianMiddleLineWidth: addForm.donchianMiddleLineWidth,
      } : {}),
      ...(addForm.indicatorType === "Ichimoku" ? {
        ichimokuTenkanPeriod: Math.max(1, Math.min(500, parseInt(addForm.ichimokuTenkanPeriodText, 10) || 9)),
        ichimokuKijunPeriod: Math.max(1, Math.min(500, parseInt(addForm.ichimokuKijunPeriodText, 10) || 26)),
        ichimokuSpanBPeriod: Math.max(1, Math.min(500, parseInt(addForm.ichimokuSpanBPeriodText, 10) || 52)),
        ichimokuDisplacement: Math.max(0, Math.min(500, parseInt(addForm.ichimokuDisplacementText, 10) || 26)),
        ichimokuTenkanColor: addForm.ichimokuTenkanColor,
        ichimokuTenkanLineWidth: addForm.ichimokuTenkanLineWidth,
        ichimokuTenkanLineStyle: addForm.ichimokuTenkanLineStyle,
        ichimokuKijunColor: addForm.ichimokuKijunColor,
        ichimokuKijunLineWidth: addForm.ichimokuKijunLineWidth,
        ichimokuKijunLineStyle: addForm.ichimokuKijunLineStyle,
        ichimokuSpanAColor: addForm.ichimokuSpanAColor,
        ichimokuSpanALineWidth: addForm.ichimokuSpanALineWidth,
        ichimokuSpanALineStyle: addForm.ichimokuSpanALineStyle,
        ichimokuSpanBColor: addForm.ichimokuSpanBColor,
        ichimokuSpanBLineWidth: addForm.ichimokuSpanBLineWidth,
        ichimokuSpanBLineStyle: addForm.ichimokuSpanBLineStyle,
        ichimokuChikouColor: addForm.ichimokuChikouColor,
        ichimokuChikouLineWidth: addForm.ichimokuChikouLineWidth,
        ichimokuChikouLineStyle: addForm.ichimokuChikouLineStyle,
        ichimokuCloudOpacity: Math.max(0, Math.min(0.7, (parseFloat(addForm.ichimokuCloudOpacityText) || 30) / 100)),
        ichimokuShowTenkan: addForm.ichimokuShowTenkan,
        ichimokuShowKijun: addForm.ichimokuShowKijun,
        ichimokuShowSpanA: addForm.ichimokuShowSpanA,
        ichimokuShowSpanB: addForm.ichimokuShowSpanB,
        ichimokuShowChikou: addForm.ichimokuShowChikou,
      } : {}),
      ...(addForm.indicatorType === "SAR" ? {
        sarStart: parseSar(addForm.sarStartText, 0.02, 0.001, 1),
        sarIncrement: parseSar(addForm.sarIncrementText, 0.02, 0.001, 1),
        sarMax: parseSar(addForm.sarMaxText, 0.2, 0.02, 1),
        sarPointSize: addForm.sarPointSize ?? "normal",
      } : {}),
      ...(addForm.indicatorType === "OBV" ? { obvVolumeSource: addForm.obvVolumeSource ?? "base" } : {}),
      ...(addForm.indicatorType === "AD" ? { adVolumeSource: addForm.adVolumeSource ?? "base" } : {}),
      ...(addForm.indicatorType === "Volume" ? {
        volumeInUsdt: addForm.volumeInUsdt === true,
        volumeColorAbove: addForm.volumeColorAbove ?? "#10b981",
        volumeColorBelow: addForm.volumeColorBelow ?? "#ef4444",
      } : {}),
      ...(isTimeWindowMa2Type(addForm.indicatorType) ? {
        wma2TimeUnit:
          addForm.wma2TimeUnit === "days" || addForm.wma2TimeUnit === "hours" || addForm.wma2TimeUnit === "minutes"
            ? addForm.wma2TimeUnit
            : "hours",
        wma2TimeValue: wma2AddVal,
      } : {}),
      ...(addForm.indicatorType === "Bollinger" ? {} : {}),
    });
    if (newInd) chartLayoutSave?.saveLayoutNow("indicators", [...userIndicators, newInd]);
  }, [addForm, panelsWithSecondary, panelsFreeForSecondary, indicatorCountByPanel, isFreeUser, currentGroupMinutes, addIndicator, defaultModelMaxIndicatorsReached, chartLayoutSave, userIndicators]);

  const deactivateAllStrategies = useCallback(() => {
    if (appliedStrategyIds.length === 0) return;
    replaceAppliedStrategyIdsFromLayout([]);
  }, [appliedStrategyIds.length, replaceAppliedStrategyIdsFromLayout]);

  const removeIndicatorWithStrategyReset = useCallback((id: string) => {
    deactivateAllStrategies();
    removeIndicator(id);
  }, [deactivateAllStrategies, removeIndicator]);

  const updateIndicatorWithStrategyReset = useCallback((id: string, updates: Parameters<typeof updateIndicator>[1]) => {
    deactivateAllStrategies();
    updateIndicator(id, updates);
  }, [deactivateAllStrategies, updateIndicator]);

  const updateIndicatorIntervalsWithStrategyReset = useCallback((id: string, intervals: number[]) => {
    deactivateAllStrategies();
    updateIndicatorIntervals(id, intervals);
  }, [deactivateAllStrategies, updateIndicatorIntervals]);

  const toggleInterval = useCallback((id: string, groupMinutes: number) => {
    const ind = userIndicators.find((u) => u.id === id);
    if (!ind || isTimeWindowMa2Type(ind.type)) return;
    const isNone = ind.intervals.length === 1 && ind.intervals[0] === 0;
    const current = ind.intervals.length === 0 ? INTERVAL_OPTIONS.map((o) => o.value) : isNone ? [] : [...ind.intervals];
    const idx = current.indexOf(groupMinutes);
    let next = idx >= 0 ? current.filter((v) => v !== groupMinutes) : [...current, groupMinutes].sort((a, b) => a - b);
    if (next.length === 0) next = [0];
    updateIndicatorIntervalsWithStrategyReset(id, next);
  }, [userIndicators, updateIndicatorIntervalsWithStrategyReset]);

  const setAllIntervals = useCallback(
    (id: string) => {
      const ind = userIndicators.find((u) => u.id === id);
      if (ind != null && isTimeWindowMa2Type(ind.type)) return;
      updateIndicatorIntervalsWithStrategyReset(id, []);
    },
    [userIndicators, updateIndicatorIntervalsWithStrategyReset]
  );

  const isIntervalChecked = useCallback((ind: UserIndicatorConfig, value: number) => {
    if (ind.intervals.length === 1 && ind.intervals[0] === 0) return false;
    if (ind.intervals.length === 0) return true;
    return ind.intervals.includes(value);
  }, []);

  const startEdit = useCallback((ind: UserIndicatorConfig) => {
    setEditingId(ind.id);
    const panel = ind.panel === "main" || ind.panel === "panel2" || ind.panel === "panel3" || ind.panel === "panel4" || ind.panel === "panel5" ? ind.panel : (ind.type === "RSI" || ind.type === "MFI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "AD" || ind.type === "ATR" || ind.type === "ADX" || ind.type === "CCI" || ind.type === "Volume" ? "panel2" : "main");
    const fieldKey = ind.type === "WilliamsR" ? "close" : ind.fieldKey;
    const fastP = ind.type === "MACD" ? (ind.macdFastPeriod ?? 12) : ind.period;
    const slowP = ind.type === "MACD" ? (ind.macdSlowPeriod ?? 26) : ind.period;
    setEditForm({
      period: ind.type === "VWAP" || isTimeWindowMa2Type(ind.type) ? 1 : ind.period,
      periodText: ind.type === "VWAP" || isTimeWindowMa2Type(ind.type) ? "1" : String(ind.period),
      fieldKey: ind.type === "VWAP" ? "close" : fieldKey,
      color: ind.color,
      panel,
      lineWidth: (ind.lineWidth === "thin" || ind.lineWidth === "normal" || ind.lineWidth === "thick" ? ind.lineWidth : "normal") as IndicatorLineWidth,
      lineStyle: (ind.lineStyle === "solid" || ind.lineStyle === "dotted" || ind.lineStyle === "dashed" ? ind.lineStyle : "solid") as IndicatorLineStyle,
      macdFastMaType: ind.type === "MACD" ? (ind.macdFastMaType === "SMA" || ind.macdFastMaType === "EMA" || ind.macdFastMaType === "WMA" ? ind.macdFastMaType : "EMA") : "EMA",
      macdFastPeriod: fastP,
      macdFastPeriodText: String(fastP),
      macdSlowMaType: ind.type === "MACD" ? (ind.macdSlowMaType === "SMA" || ind.macdSlowMaType === "EMA" || ind.macdSlowMaType === "WMA" ? ind.macdSlowMaType : "EMA") : "EMA",
      macdSlowPeriod: slowP,
      macdSlowPeriodText: String(slowP),
      macdSignalLine: ind.type === "MACD" ? (ind.macdSignalLine === true) : false,
      macdSignalMaType: ind.type === "MACD" && ind.macdSignalLine ? (ind.macdSignalMaType === "SMA" || ind.macdSignalMaType === "EMA" || ind.macdSignalMaType === "WMA" ? ind.macdSignalMaType : "EMA") : "EMA",
      macdSignalPeriod: ind.type === "MACD" && ind.macdSignalLine ? (ind.macdSignalPeriod ?? 9) : 9,
      macdSignalPeriodText: String(ind.type === "MACD" && ind.macdSignalLine ? (ind.macdSignalPeriod ?? 9) : 9),
      macdSignalColor: ind.type === "MACD" && ind.macdSignalLine ? (ind.macdSignalColor ?? "#ea580c") : "#ea580c",
      macdSignalLineWidth: ind.type === "MACD" && ind.macdSignalLine ? (ind.macdSignalLineWidth === "thin" || ind.macdSignalLineWidth === "normal" || ind.macdSignalLineWidth === "thick" ? ind.macdSignalLineWidth : "normal") : "normal",
      macdSignalLineStyle: ind.type === "MACD" && ind.macdSignalLine ? (ind.macdSignalLineStyle === "solid" || ind.macdSignalLineStyle === "dotted" || ind.macdSignalLineStyle === "dashed" ? ind.macdSignalLineStyle : "dashed") : "dashed",
      macdHistogram: ind.type === "MACD" && ind.macdSignalLine ? (ind.macdHistogram === true) : false,
      macdHistogramColorAbove: ind.type === "MACD" && ind.macdHistogram ? (ind.macdHistogramColorAbove ?? "#059669") : "#059669",
      macdHistogramColorBelow: ind.type === "MACD" && ind.macdHistogram ? (ind.macdHistogramColorBelow ?? "#dc2626") : "#dc2626",
      rsiFixedScale: ind.type === "RSI" ? (ind.rsiFixedScale !== false) : true,
      rsiCenterLine: ind.type === "RSI" ? (ind.rsiCenterLine === true) : false,
      rsiCenterLineColor: ind.type === "RSI" && ind.rsiCenterLine ? (ind.rsiCenterLineColor ?? "#71717a") : "#71717a",
      rsiCenterLineWidth: (ind.type === "RSI" && ind.rsiCenterLine && (ind.rsiCenterLineWidth === "thin" || ind.rsiCenterLineWidth === "normal") ? ind.rsiCenterLineWidth : "normal") as IndicatorLineWidth,
      rsiCenterLineStyle: (ind.type === "RSI" && ind.rsiCenterLine && (ind.rsiCenterLineStyle === "solid" || ind.rsiCenterLineStyle === "dotted" || ind.rsiCenterLineStyle === "dashed") ? ind.rsiCenterLineStyle : "dotted") as IndicatorLineStyle,
      rsiLimits: ind.type === "RSI" ? (ind.rsiLimits === true) : false,
      rsiLimitUpper: ind.type === "RSI" && ind.rsiLimits ? (typeof ind.rsiLimitUpper === "number" ? Math.max(0, Math.min(100, Math.round(ind.rsiLimitUpper))) : 90) : 90,
      rsiLimitLower: ind.type === "RSI" && ind.rsiLimits ? (typeof ind.rsiLimitLower === "number" ? Math.max(0, Math.min(100, Math.round(ind.rsiLimitLower))) : 10) : 10,
      rsiLimitColor: ind.type === "RSI" && ind.rsiLimits ? (ind.rsiLimitColor ?? "#dc2626") : "#dc2626",
      rsiLimitLineWidth: (ind.type === "RSI" && ind.rsiLimits && (ind.rsiLimitLineWidth === "thin" || ind.rsiLimitLineWidth === "normal") ? ind.rsiLimitLineWidth : "normal") as IndicatorLineWidth,
      rsiLimitLineStyle: (ind.type === "RSI" && ind.rsiLimits && (ind.rsiLimitLineStyle === "solid" || ind.rsiLimitLineStyle === "dotted" || ind.rsiLimitLineStyle === "dashed") ? ind.rsiLimitLineStyle : "dotted") as IndicatorLineStyle,
      mfiFixedScale: ind.type === "MFI" ? (ind.mfiFixedScale !== false) : true,
      mfiCenterLine: ind.type === "MFI" ? (ind.mfiCenterLine === true) : false,
      mfiCenterLineColor: ind.type === "MFI" && ind.mfiCenterLine ? (ind.mfiCenterLineColor ?? "#71717a") : "#71717a",
      mfiCenterLineWidth: (ind.type === "MFI" && ind.mfiCenterLine && (ind.mfiCenterLineWidth === "thin" || ind.mfiCenterLineWidth === "normal") ? ind.mfiCenterLineWidth : "normal") as IndicatorLineWidth,
      mfiCenterLineStyle: (ind.type === "MFI" && ind.mfiCenterLine && (ind.mfiCenterLineStyle === "solid" || ind.mfiCenterLineStyle === "dotted" || ind.mfiCenterLineStyle === "dashed") ? ind.mfiCenterLineStyle : "dotted") as IndicatorLineStyle,
      mfiLimits: ind.type === "MFI" ? (ind.mfiLimits === true) : false,
      mfiLimitUpper: ind.type === "MFI" && ind.mfiLimits ? (typeof ind.mfiLimitUpper === "number" ? Math.max(0, Math.min(100, Math.round(ind.mfiLimitUpper))) : 80) : 80,
      mfiLimitLower: ind.type === "MFI" && ind.mfiLimits ? (typeof ind.mfiLimitLower === "number" ? Math.max(0, Math.min(100, Math.round(ind.mfiLimitLower))) : 20) : 20,
      mfiLimitColor: ind.type === "MFI" && ind.mfiLimits ? (ind.mfiLimitColor ?? "#dc2626") : "#dc2626",
      mfiLimitLineWidth: (ind.type === "MFI" && ind.mfiLimits && (ind.mfiLimitLineWidth === "thin" || ind.mfiLimitLineWidth === "normal") ? ind.mfiLimitLineWidth : "normal") as IndicatorLineWidth,
      mfiLimitLineStyle: (ind.type === "MFI" && ind.mfiLimits && (ind.mfiLimitLineStyle === "solid" || ind.mfiLimitLineStyle === "dotted" || ind.mfiLimitLineStyle === "dashed") ? ind.mfiLimitLineStyle : "dotted") as IndicatorLineStyle,
      stochLimits: ind.type === "Stochastic" ? (ind.stochLimits === true) : false,
      stochLimitUpper: ind.type === "Stochastic" && ind.stochLimits ? (typeof ind.stochLimitUpper === "number" ? Math.max(0, Math.min(100, Math.round(ind.stochLimitUpper))) : 80) : 80,
      stochLimitLower: ind.type === "Stochastic" && ind.stochLimits ? (typeof ind.stochLimitLower === "number" ? Math.max(0, Math.min(100, Math.round(ind.stochLimitLower))) : 20) : 20,
      stochLimitColor: ind.type === "Stochastic" && ind.stochLimits ? (ind.stochLimitColor ?? "#dc2626") : "#dc2626",
      stochLimitLineWidth: (ind.type === "Stochastic" && ind.stochLimits && (ind.stochLimitLineWidth === "thin" || ind.stochLimitLineWidth === "normal") ? ind.stochLimitLineWidth : "normal") as IndicatorLineWidth,
      stochLimitLineStyle: (ind.type === "Stochastic" && ind.stochLimits && (ind.stochLimitLineStyle === "solid" || ind.stochLimitLineStyle === "dotted" || ind.stochLimitLineStyle === "dashed") ? ind.stochLimitLineStyle : "dotted") as IndicatorLineStyle,
      stochDLine: ind.type === "Stochastic" ? (ind.stochDLine === true) : false,
      stochDMaType: ind.type === "Stochastic" && ind.stochDLine ? (ind.stochDMaType === "SMA" || ind.stochDMaType === "EMA" || ind.stochDMaType === "WMA" ? ind.stochDMaType : "SMA") : "SMA",
      stochDPeriod: ind.type === "Stochastic" && ind.stochDLine ? (ind.stochDPeriod ?? 3) : 3,
      stochDPeriodText: String(ind.type === "Stochastic" && ind.stochDLine ? (ind.stochDPeriod ?? 3) : 3),
      stochDColor: ind.type === "Stochastic" && ind.stochDLine ? (ind.stochDColor ?? "#ea580c") : "#ea580c",
      stochDLineWidth: (ind.type === "Stochastic" && ind.stochDLine && (ind.stochDLineWidth === "thin" || ind.stochDLineWidth === "normal" || ind.stochDLineWidth === "thick") ? ind.stochDLineWidth : "normal") as IndicatorLineWidth,
      stochDLineStyle: (ind.type === "Stochastic" && ind.stochDLine && (ind.stochDLineStyle === "solid" || ind.stochDLineStyle === "dotted" || ind.stochDLineStyle === "dashed") ? ind.stochDLineStyle : "dashed") as IndicatorLineStyle,
      williamsRLimits: ind.type === "WilliamsR" ? (ind.williamsRLimits === true) : false,
      williamsRLimitUpper: ind.type === "WilliamsR" && ind.williamsRLimits ? (typeof ind.williamsRLimitUpper === "number" ? Math.max(-100, Math.min(0, Math.round(ind.williamsRLimitUpper))) : -20) : -20,
      williamsRLimitLower: ind.type === "WilliamsR" && ind.williamsRLimits ? (typeof ind.williamsRLimitLower === "number" ? Math.max(-100, Math.min(0, Math.round(ind.williamsRLimitLower))) : -80) : -80,
      williamsRLimitColor: ind.type === "WilliamsR" && ind.williamsRLimits ? (ind.williamsRLimitColor ?? "#dc2626") : "#dc2626",
      williamsRLimitLineWidth: (ind.type === "WilliamsR" && ind.williamsRLimits && (ind.williamsRLimitLineWidth === "thin" || ind.williamsRLimitLineWidth === "normal") ? ind.williamsRLimitLineWidth : "normal") as IndicatorLineWidth,
      williamsRLimitLineStyle: (ind.type === "WilliamsR" && ind.williamsRLimits && (ind.williamsRLimitLineStyle === "solid" || ind.williamsRLimitLineStyle === "dotted" || ind.williamsRLimitLineStyle === "dashed") ? ind.williamsRLimitLineStyle : "dotted") as IndicatorLineStyle,
      adxPlusDiColor: ind.type === "ADX" ? (ind.adxPlusDiColor ?? "#22c55e") : "#22c55e",
      adxPlusDiLineWidth: (ind.type === "ADX" && (ind.adxPlusDiLineWidth === "thin" || ind.adxPlusDiLineWidth === "normal") ? ind.adxPlusDiLineWidth : "normal") as IndicatorLineWidth,
      adxPlusDiLineStyle: (ind.type === "ADX" && (ind.adxPlusDiLineStyle === "solid" || ind.adxPlusDiLineStyle === "dotted" || ind.adxPlusDiLineStyle === "dashed") ? ind.adxPlusDiLineStyle : "solid") as IndicatorLineStyle,
      adxMinusDiColor: ind.type === "ADX" ? (ind.adxMinusDiColor ?? "#ef4444") : "#ef4444",
      adxMinusDiLineWidth: (ind.type === "ADX" && (ind.adxMinusDiLineWidth === "thin" || ind.adxMinusDiLineWidth === "normal") ? ind.adxMinusDiLineWidth : "normal") as IndicatorLineWidth,
      adxMinusDiLineStyle: (ind.type === "ADX" && (ind.adxMinusDiLineStyle === "solid" || ind.adxMinusDiLineStyle === "dotted" || ind.adxMinusDiLineStyle === "dashed") ? ind.adxMinusDiLineStyle : "solid") as IndicatorLineStyle,
      adxAdxColor: ind.type === "ADX" ? (ind.adxAdxColor ?? "#eab308") : "#eab308",
      adxAdxLineWidth: (ind.type === "ADX" && (ind.adxAdxLineWidth === "thin" || ind.adxAdxLineWidth === "normal") ? ind.adxAdxLineWidth : "normal") as IndicatorLineWidth,
      adxAdxLineStyle: (ind.type === "ADX" && (ind.adxAdxLineStyle === "solid" || ind.adxAdxLineStyle === "dotted" || ind.adxAdxLineStyle === "dashed") ? ind.adxAdxLineStyle : "solid") as IndicatorLineStyle,
      adxFixedScale: ind.type === "ADX" ? (ind.adxFixedScale !== false) : true,
      adxLimits: ind.type === "ADX" ? (ind.adxLimits === true) : false,
      adxLimitUpper: ind.type === "ADX" && ind.adxLimits ? (typeof ind.adxLimitUpper === "number" ? Math.max(0, Math.min(100, Math.round(ind.adxLimitUpper))) : 25) : 25,
      adxLimitLower: ind.type === "ADX" && ind.adxLimits ? (typeof ind.adxLimitLower === "number" ? Math.max(0, Math.min(100, Math.round(ind.adxLimitLower))) : 20) : 20,
      adxLimitColor: ind.type === "ADX" && ind.adxLimits ? (ind.adxLimitColor ?? "#71717a") : "#71717a",
      adxLimitLineWidth: (ind.type === "ADX" && ind.adxLimits && (ind.adxLimitLineWidth === "thin" || ind.adxLimitLineWidth === "normal") ? ind.adxLimitLineWidth : "normal") as IndicatorLineWidth,
      adxLimitLineStyle: (ind.type === "ADX" && ind.adxLimits && (ind.adxLimitLineStyle === "solid" || ind.adxLimitLineStyle === "dotted" || ind.adxLimitLineStyle === "dashed") ? ind.adxLimitLineStyle : "dotted") as IndicatorLineStyle,
      cciFixedScale: ind.type === "CCI" ? (ind.cciFixedScale === true) : true,
      cciLimits: ind.type === "CCI" ? (ind.cciLimits === true) : false,
      cciLimitUpper: ind.type === "CCI" && ind.cciLimits ? (typeof ind.cciLimitUpper === "number" ? Math.max(-500, Math.min(500, Math.round(ind.cciLimitUpper))) : 100) : 100,
      cciLimitLower: ind.type === "CCI" && ind.cciLimits ? (typeof ind.cciLimitLower === "number" ? Math.max(-500, Math.min(500, Math.round(ind.cciLimitLower))) : -100) : -100,
      cciLimitColor: ind.type === "CCI" && ind.cciLimits ? (ind.cciLimitColor ?? "#dc2626") : "#dc2626",
      cciLimitLineWidth: (ind.type === "CCI" && ind.cciLimits && (ind.cciLimitLineWidth === "thin" || ind.cciLimitLineWidth === "normal") ? ind.cciLimitLineWidth : "normal") as IndicatorLineWidth,
      cciLimitLineStyle: (ind.type === "CCI" && ind.cciLimits && (ind.cciLimitLineStyle === "solid" || ind.cciLimitLineStyle === "dotted" || ind.cciLimitLineStyle === "dashed") ? ind.cciLimitLineStyle : "dotted") as IndicatorLineStyle,
      cciAsHistogram: ind.type === "CCI" ? (ind.cciAsHistogram === true) : false,
      cciHistogramColorAbove: ind.type === "CCI" && ind.cciAsHistogram ? (ind.cciHistogramColorAbove ?? "#059669") : "#059669",
      cciHistogramColorBelow: ind.type === "CCI" && ind.cciAsHistogram ? (ind.cciHistogramColorBelow ?? "#dc2626") : "#dc2626",
      cmfFixedScale: ind.type === "CMF" ? (ind.cmfFixedScale === true) : false,
      cmfLimits: ind.type === "CMF" ? (ind.cmfLimits === true) : true,
      cmfLimitUpper: ind.type === "CMF" && ind.cmfLimits ? (typeof ind.cmfLimitUpper === "number" ? Math.max(-1, Math.min(1, ind.cmfLimitUpper)) : 0.25) : 0.25,
      cmfLimitLower: ind.type === "CMF" && ind.cmfLimits ? (typeof ind.cmfLimitLower === "number" ? Math.max(-1, Math.min(1, ind.cmfLimitLower)) : -0.25) : -0.25,
      cmfLimitColor: ind.type === "CMF" && ind.cmfLimits ? (ind.cmfLimitColor ?? "#dc2626") : "#dc2626",
      cmfLimitLineWidth: (ind.type === "CMF" && ind.cmfLimits && (ind.cmfLimitLineWidth === "thin" || ind.cmfLimitLineWidth === "normal") ? ind.cmfLimitLineWidth : "normal") as IndicatorLineWidth,
      cmfLimitLineStyle: (ind.type === "CMF" && ind.cmfLimits && (ind.cmfLimitLineStyle === "solid" || ind.cmfLimitLineStyle === "dotted" || ind.cmfLimitLineStyle === "dashed") ? ind.cmfLimitLineStyle : "dotted") as IndicatorLineStyle,
      cmfAsHistogram: ind.type === "CMF" ? (ind.cmfAsHistogram === true) : false,
      cmfHistogramColorAbove: ind.type === "CMF" && ind.cmfAsHistogram ? (ind.cmfHistogramColorAbove ?? "#059669") : "#059669",
      cmfHistogramColorBelow: ind.type === "CMF" && ind.cmfAsHistogram ? (ind.cmfHistogramColorBelow ?? "#dc2626") : "#dc2626",
      obvVolumeSource: (ind.type === "OBV" && (ind.obvVolumeSource === "base" || ind.obvVolumeSource === "usdt")) ? ind.obvVolumeSource : "base",
      adVolumeSource: (ind.type === "AD" && (ind.adVolumeSource === "base" || ind.adVolumeSource === "usdt")) ? ind.adVolumeSource : "base",
      donchianShowUpper: ind.type === "Donchian" ? (ind.donchianShowUpper !== false) : true,
      donchianShowLower: ind.type === "Donchian" ? (ind.donchianShowLower !== false) : true,
      donchianShowMiddle: ind.type === "Donchian" ? (ind.donchianShowMiddle === true) : false,
      donchianBandOpacity: ind.type === "Donchian" ? (typeof ind.donchianBandOpacity === "number" ? Math.max(0, Math.min(0.3, ind.donchianBandOpacity)) : 0.2) : 0.2,
      donchianBandOpacityText: String(Math.round((ind.type === "Donchian" ? (typeof ind.donchianBandOpacity === "number" ? Math.max(0, Math.min(0.3, ind.donchianBandOpacity)) : 0.2) : 0.2) * 100)),
      donchianLimitsColor: ind.type === "Donchian" ? (ind.donchianLimitsColor ?? "#6366f1") : "#6366f1",
      donchianLimitsLineStyle: (ind.type === "Donchian" && (ind.donchianLimitsLineStyle === "solid" || ind.donchianLimitsLineStyle === "dotted" || ind.donchianLimitsLineStyle === "dashed") ? ind.donchianLimitsLineStyle : "solid") as IndicatorLineStyle,
      donchianLimitsLineWidth: (ind.type === "Donchian" && (ind.donchianLimitsLineWidth === "thin" || ind.donchianLimitsLineWidth === "normal") ? ind.donchianLimitsLineWidth : "normal") as IndicatorLineWidth,
      donchianMiddleColor: ind.type === "Donchian" ? (ind.donchianMiddleColor ?? "#a855f7") : "#a855f7",
      donchianMiddleLineStyle: (ind.type === "Donchian" && (ind.donchianMiddleLineStyle === "solid" || ind.donchianMiddleLineStyle === "dotted" || ind.donchianMiddleLineStyle === "dashed") ? ind.donchianMiddleLineStyle : "dashed") as IndicatorLineStyle,
      donchianMiddleLineWidth: (ind.type === "Donchian" && (ind.donchianMiddleLineWidth === "thin" || ind.donchianMiddleLineWidth === "normal") ? ind.donchianMiddleLineWidth : "normal") as IndicatorLineWidth,
      ichimokuTenkanPeriod: ind.type === "Ichimoku" ? (typeof ind.ichimokuTenkanPeriod === "number" ? Math.max(1, Math.min(500, ind.ichimokuTenkanPeriod)) : 9) : 9,
      ichimokuTenkanPeriodText: String(ind.type === "Ichimoku" ? (typeof ind.ichimokuTenkanPeriod === "number" ? Math.max(1, Math.min(500, ind.ichimokuTenkanPeriod)) : 9) : 9),
      ichimokuKijunPeriod: ind.type === "Ichimoku" ? (typeof ind.ichimokuKijunPeriod === "number" ? Math.max(1, Math.min(500, ind.ichimokuKijunPeriod)) : 26) : 26,
      ichimokuKijunPeriodText: String(ind.type === "Ichimoku" ? (typeof ind.ichimokuKijunPeriod === "number" ? Math.max(1, Math.min(500, ind.ichimokuKijunPeriod)) : 26) : 26),
      ichimokuSpanBPeriod: ind.type === "Ichimoku" ? (typeof ind.ichimokuSpanBPeriod === "number" ? Math.max(1, Math.min(500, ind.ichimokuSpanBPeriod)) : 52) : 52,
      ichimokuSpanBPeriodText: String(ind.type === "Ichimoku" ? (typeof ind.ichimokuSpanBPeriod === "number" ? Math.max(1, Math.min(500, ind.ichimokuSpanBPeriod)) : 52) : 52),
      ichimokuDisplacement: ind.type === "Ichimoku" ? (typeof ind.ichimokuDisplacement === "number" ? Math.max(0, Math.min(500, ind.ichimokuDisplacement)) : 26) : 26,
      ichimokuDisplacementText: String(ind.type === "Ichimoku" ? (typeof ind.ichimokuDisplacement === "number" ? Math.max(0, Math.min(500, ind.ichimokuDisplacement)) : 26) : 26),
      ichimokuTenkanColor: ind.type === "Ichimoku" ? (ind.ichimokuTenkanColor ?? "#6366f1") : "#6366f1",
      ichimokuKijunColor: ind.type === "Ichimoku" ? (ind.ichimokuKijunColor ?? "#ea580c") : "#ea580c",
      ichimokuSpanAColor: ind.type === "Ichimoku" ? (ind.ichimokuSpanAColor ?? "#22c55e") : "#22c55e",
      ichimokuSpanBColor: ind.type === "Ichimoku" ? (ind.ichimokuSpanBColor ?? "#ef4444") : "#ef4444",
      ichimokuChikouColor: ind.type === "Ichimoku" ? (ind.ichimokuChikouColor ?? "#a855f7") : "#a855f7",
      ichimokuTenkanLineWidth: (ind.type === "Ichimoku" && (ind.ichimokuTenkanLineWidth === "thin" || ind.ichimokuTenkanLineWidth === "normal") ? ind.ichimokuTenkanLineWidth : "normal") as IndicatorLineWidth,
      ichimokuTenkanLineStyle: (ind.type === "Ichimoku" && (ind.ichimokuTenkanLineStyle === "solid" || ind.ichimokuTenkanLineStyle === "dotted" || ind.ichimokuTenkanLineStyle === "dashed") ? ind.ichimokuTenkanLineStyle : "solid") as IndicatorLineStyle,
      ichimokuKijunLineWidth: (ind.type === "Ichimoku" && (ind.ichimokuKijunLineWidth === "thin" || ind.ichimokuKijunLineWidth === "normal") ? ind.ichimokuKijunLineWidth : "normal") as IndicatorLineWidth,
      ichimokuKijunLineStyle: (ind.type === "Ichimoku" && (ind.ichimokuKijunLineStyle === "solid" || ind.ichimokuKijunLineStyle === "dotted" || ind.ichimokuKijunLineStyle === "dashed") ? ind.ichimokuKijunLineStyle : "solid") as IndicatorLineStyle,
      ichimokuSpanALineWidth: (ind.type === "Ichimoku" && (ind.ichimokuSpanALineWidth === "thin" || ind.ichimokuSpanALineWidth === "normal") ? ind.ichimokuSpanALineWidth : "normal") as IndicatorLineWidth,
      ichimokuSpanALineStyle: (ind.type === "Ichimoku" && (ind.ichimokuSpanALineStyle === "solid" || ind.ichimokuSpanALineStyle === "dotted" || ind.ichimokuSpanALineStyle === "dashed") ? ind.ichimokuSpanALineStyle : "solid") as IndicatorLineStyle,
      ichimokuSpanBLineWidth: (ind.type === "Ichimoku" && (ind.ichimokuSpanBLineWidth === "thin" || ind.ichimokuSpanBLineWidth === "normal") ? ind.ichimokuSpanBLineWidth : "normal") as IndicatorLineWidth,
      ichimokuSpanBLineStyle: (ind.type === "Ichimoku" && (ind.ichimokuSpanBLineStyle === "solid" || ind.ichimokuSpanBLineStyle === "dotted" || ind.ichimokuSpanBLineStyle === "dashed") ? ind.ichimokuSpanBLineStyle : "solid") as IndicatorLineStyle,
      ichimokuChikouLineWidth: (ind.type === "Ichimoku" && (ind.ichimokuChikouLineWidth === "thin" || ind.ichimokuChikouLineWidth === "normal") ? ind.ichimokuChikouLineWidth : "normal") as IndicatorLineWidth,
      ichimokuChikouLineStyle: (ind.type === "Ichimoku" && (ind.ichimokuChikouLineStyle === "solid" || ind.ichimokuChikouLineStyle === "dotted" || ind.ichimokuChikouLineStyle === "dashed") ? ind.ichimokuChikouLineStyle : "solid") as IndicatorLineStyle,
      ichimokuCloudOpacity: ind.type === "Ichimoku" ? (typeof ind.ichimokuCloudOpacity === "number" ? Math.max(0, Math.min(0.7, ind.ichimokuCloudOpacity)) : 0.3) : 0.3,
      ichimokuCloudOpacityText: String(Math.round((ind.type === "Ichimoku" ? (typeof ind.ichimokuCloudOpacity === "number" ? Math.max(0, Math.min(0.7, ind.ichimokuCloudOpacity)) : 0.3) : 0.3) * 100)),
      ichimokuShowTenkan: ind.type === "Ichimoku" ? (ind.ichimokuShowTenkan !== false) : true,
      ichimokuShowKijun: ind.type === "Ichimoku" ? (ind.ichimokuShowKijun !== false) : true,
      ichimokuShowSpanA: ind.type === "Ichimoku" ? (ind.ichimokuShowSpanA !== false) : true,
      ichimokuShowSpanB: ind.type === "Ichimoku" ? (ind.ichimokuShowSpanB !== false) : true,
      ichimokuShowChikou: ind.type === "Ichimoku" ? (ind.ichimokuShowChikou === true) : false,
      sarStart: ind.type === "SAR" ? (typeof ind.sarStart === "number" ? Math.max(0.001, Math.min(1, ind.sarStart)) : 0.02) : 0.02,
      sarStartText: String(ind.type === "SAR" ? (typeof ind.sarStart === "number" ? Math.max(0.001, Math.min(1, ind.sarStart)) : 0.02) : 0.02),
      sarIncrement: ind.type === "SAR" ? (typeof ind.sarIncrement === "number" ? Math.max(0.001, Math.min(1, ind.sarIncrement)) : 0.02) : 0.02,
      sarIncrementText: String(ind.type === "SAR" ? (typeof ind.sarIncrement === "number" ? Math.max(0.001, Math.min(1, ind.sarIncrement)) : 0.02) : 0.02),
      sarMax: ind.type === "SAR" ? (typeof ind.sarMax === "number" ? Math.max(0.02, Math.min(1, ind.sarMax)) : 0.2) : 0.2,
      sarMaxText: String(ind.type === "SAR" ? (typeof ind.sarMax === "number" ? Math.max(0.02, Math.min(1, ind.sarMax)) : 0.2) : 0.2),
      sarPointSize: ind.type === "SAR" ? (ind.sarPointSize === "thin" || ind.sarPointSize === "normal" ? ind.sarPointSize : "normal") : "normal",
      bollingerMaType: ind.type === "Bollinger" ? (ind.bollingerMaType === "SMA" || ind.bollingerMaType === "EMA" || ind.bollingerMaType === "WMA" ? ind.bollingerMaType : "SMA") : "SMA",
      bollingerZ: ind.type === "Bollinger" ? (typeof ind.bollingerZ === "number" ? Math.max(0, Math.min(3, ind.bollingerZ)) : 2) : 2,
      bollingerZText: String(ind.type === "Bollinger" ? (typeof ind.bollingerZ === "number" ? Math.max(0, Math.min(3, ind.bollingerZ)) : 2) : 2),
      bollingerShowUpper: ind.type === "Bollinger" ? (ind.bollingerShowUpper !== false) : true,
      bollingerShowLower: ind.type === "Bollinger" ? (ind.bollingerShowLower !== false) : true,
      bollingerShowMiddle: ind.type === "Bollinger" ? (ind.bollingerShowMiddle === true) : false,
      bollingerBandOpacity: ind.type === "Bollinger" ? (typeof ind.bollingerBandOpacity === "number" ? Math.max(0, Math.min(0.3, ind.bollingerBandOpacity)) : 0.2) : 0.2,
      bollingerBandOpacityText: String(Math.round((ind.type === "Bollinger" ? (typeof ind.bollingerBandOpacity === "number" ? Math.max(0, Math.min(0.3, ind.bollingerBandOpacity)) : 0.2) : 0.2) * 100)),
      bollingerLimitsColor: ind.type === "Bollinger" ? (ind.bollingerLimitsColor ?? "#6366f1") : "#6366f1",
      bollingerLimitsLineStyle: (ind.type === "Bollinger" && (ind.bollingerLimitsLineStyle === "solid" || ind.bollingerLimitsLineStyle === "dotted" || ind.bollingerLimitsLineStyle === "dashed") ? ind.bollingerLimitsLineStyle : "solid") as IndicatorLineStyle,
      bollingerLimitsLineWidth: (ind.type === "Bollinger" && (ind.bollingerLimitsLineWidth === "thin" || ind.bollingerLimitsLineWidth === "normal") ? ind.bollingerLimitsLineWidth : "normal") as IndicatorLineWidth,
      bollingerMiddleColor: ind.type === "Bollinger" ? (ind.bollingerMiddleColor ?? "#a855f7") : "#a855f7",
      bollingerMiddleLineStyle: (ind.type === "Bollinger" && (ind.bollingerMiddleLineStyle === "solid" || ind.bollingerMiddleLineStyle === "dotted" || ind.bollingerMiddleLineStyle === "dashed") ? ind.bollingerMiddleLineStyle : "dashed") as IndicatorLineStyle,
      bollingerMiddleLineWidth: (ind.type === "Bollinger" && (ind.bollingerMiddleLineWidth === "thin" || ind.bollingerMiddleLineWidth === "normal") ? ind.bollingerMiddleLineWidth : "normal") as IndicatorLineWidth,
      keltnerMaType: ind.type === "Keltner" ? (ind.keltnerMaType === "SMA" || ind.keltnerMaType === "EMA" || ind.keltnerMaType === "WMA" ? ind.keltnerMaType : "EMA") : "EMA",
      keltnerMultiplier: ind.type === "Keltner" ? (typeof ind.keltnerMultiplier === "number" ? Math.max(0, Math.min(10, ind.keltnerMultiplier)) : 2) : 2,
      keltnerMultiplierText: String(ind.type === "Keltner" ? (typeof ind.keltnerMultiplier === "number" ? Math.max(0, Math.min(10, ind.keltnerMultiplier)) : 2) : 2),
      keltnerShowUpper: ind.type === "Keltner" ? (ind.keltnerShowUpper !== false) : true,
      keltnerShowLower: ind.type === "Keltner" ? (ind.keltnerShowLower !== false) : true,
      keltnerShowMiddle: ind.type === "Keltner" ? (ind.keltnerShowMiddle === true) : false,
      keltnerBandOpacity: ind.type === "Keltner" ? (typeof ind.keltnerBandOpacity === "number" ? Math.max(0, Math.min(0.3, ind.keltnerBandOpacity)) : 0.2) : 0.2,
      keltnerBandOpacityText: String(Math.round((ind.type === "Keltner" ? (typeof ind.keltnerBandOpacity === "number" ? Math.max(0, Math.min(0.3, ind.keltnerBandOpacity)) : 0.2) : 0.2) * 100)),
      keltnerLimitsColor: ind.type === "Keltner" ? (ind.keltnerLimitsColor ?? "#6366f1") : "#6366f1",
      keltnerLimitsLineStyle: (ind.type === "Keltner" && (ind.keltnerLimitsLineStyle === "solid" || ind.keltnerLimitsLineStyle === "dotted" || ind.keltnerLimitsLineStyle === "dashed") ? ind.keltnerLimitsLineStyle : "solid") as IndicatorLineStyle,
      keltnerLimitsLineWidth: (ind.type === "Keltner" && (ind.keltnerLimitsLineWidth === "thin" || ind.keltnerLimitsLineWidth === "normal") ? ind.keltnerLimitsLineWidth : "normal") as IndicatorLineWidth,
      keltnerMiddleColor: ind.type === "Keltner" ? (ind.keltnerMiddleColor ?? "#a855f7") : "#a855f7",
      keltnerMiddleLineStyle: (ind.type === "Keltner" && (ind.keltnerMiddleLineStyle === "solid" || ind.keltnerMiddleLineStyle === "dotted" || ind.keltnerMiddleLineStyle === "dashed") ? ind.keltnerMiddleLineStyle : "dashed") as IndicatorLineStyle,
      keltnerMiddleLineWidth: (ind.type === "Keltner" && (ind.keltnerMiddleLineWidth === "thin" || ind.keltnerMiddleLineWidth === "normal") ? ind.keltnerMiddleLineWidth : "normal") as IndicatorLineWidth,
      volumeInUsdt: ind.type === "Volume" ? (ind.volumeInUsdt === true) : false,
      volumeColorAbove: ind.type === "Volume" ? (ind.volumeColorAbove ?? "#10b981") : "#10b981",
      volumeColorBelow: ind.type === "Volume" ? (ind.volumeColorBelow ?? "#ef4444") : "#ef4444",
      showLastValueOnYAxis: ind.showLastValueOnYAxis !== false,
      wma2TimeUnit:
        isTimeWindowMa2Type(ind.type)
          ? (ind.wma2TimeUnit === "days" || ind.wma2TimeUnit === "hours" || ind.wma2TimeUnit === "minutes" ? ind.wma2TimeUnit : "hours")
          : "hours",
      wma2TimeValue: (() => {
        const u =
          ind.wma2TimeUnit === "days" || ind.wma2TimeUnit === "hours" || ind.wma2TimeUnit === "minutes" ? ind.wma2TimeUnit : "hours";
        const def = defaultMa2TimeValueForUnit(u);
        if (!isTimeWindowMa2Type(ind.type)) return def;
        const raw =
          typeof ind.wma2TimeValue === "number" && Number.isFinite(ind.wma2TimeValue)
            ? clampMa2TimeWindowUserValue(ind.wma2TimeValue)
            : def;
        return normalizeMa2TimeValueForUnit(u, raw);
      })(),
      wma2TimeValueText: (() => {
        const u =
          ind.wma2TimeUnit === "days" || ind.wma2TimeUnit === "hours" || ind.wma2TimeUnit === "minutes" ? ind.wma2TimeUnit : "hours";
        const def = defaultMa2TimeValueForUnit(u);
        if (!isTimeWindowMa2Type(ind.type)) return String(def);
        const raw =
          typeof ind.wma2TimeValue === "number" && Number.isFinite(ind.wma2TimeValue)
            ? clampMa2TimeWindowUserValue(ind.wma2TimeValue)
            : def;
        return String(normalizeMa2TimeValueForUnit(u, raw));
      })(),
      intervals: isTimeWindowMa2Type(ind.type) ? [] : [...(ind.intervals || [])],
    } as EditFormState);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId || !editForm) return;
    const ind = userIndicators.find((u) => u.id === editingId);
    const periodNum = (() => {
      const n = Number(editForm.periodText);
      return Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : editForm.period;
    })();
    const fastP = ind?.type === "MACD" ? (Number(editForm.macdFastPeriodText) || 12) : periodNum;
    const slowP = ind?.type === "MACD" ? (Number(editForm.macdSlowPeriodText) || 26) : periodNum;
    const wma2Parsed =
      ind != null && isTimeWindowMa2Type(ind.type)
        ? (() => {
            const n = Number(editForm.wma2TimeValueText);
            const u =
              editForm.wma2TimeUnit === "days" || editForm.wma2TimeUnit === "hours" || editForm.wma2TimeUnit === "minutes"
                ? editForm.wma2TimeUnit
                : "hours";
            const raw =
              Number.isFinite(n) && n > 0
                ? clampMa2TimeWindowUserValue(n)
                : editForm.wma2TimeValue ?? defaultMa2TimeValueForUnit(u);
            return normalizeMa2TimeValueForUnit(u, raw);
          })()
        : undefined;
    const updates = {
      period: ind != null && isTimeWindowMa2Type(ind.type) ? 1 : ind?.type === "MACD" ? fastP : periodNum,
      fieldKey: ind?.type === "OBV" || ind?.type === "AD" || ind?.type === "Volume" ? "volume" : ind?.type === "CCI" ? (editForm.fieldKey ?? "HLC3") : editForm.fieldKey,
      color: editForm.color,
      panel: ind?.type === "SAR" || ind?.type === "VWAP" || ind?.type === "Ichimoku" ? "main" : editForm.panel,
      intervals: ind != null && isTimeWindowMa2Type(ind.type) ? [] : (editForm.intervals ?? []),
      showLastValueOnYAxis: editForm.showLastValueOnYAxis,
      ...(ind?.type === "Volume" ? {
        volumeInUsdt: editForm.volumeInUsdt === true,
        volumeColorAbove: editForm.volumeColorAbove ?? "#10b981",
        volumeColorBelow: editForm.volumeColorBelow ?? "#ef4444",
      } : {}),
      lineWidth: editForm.lineWidth,
      lineStyle: editForm.lineStyle,
      ...(ind?.type === "RSI" ? { rsiFixedScale: editForm.rsiFixedScale, rsiCenterLine: editForm.rsiCenterLine, rsiCenterLineColor: editForm.rsiCenterLineColor, rsiCenterLineWidth: editForm.rsiCenterLineWidth, rsiCenterLineStyle: editForm.rsiCenterLineStyle, rsiLimits: editForm.rsiLimits, rsiLimitUpper: editForm.rsiLimitUpper, rsiLimitLower: editForm.rsiLimitLower, rsiLimitColor: editForm.rsiLimitColor, rsiLimitLineWidth: editForm.rsiLimitLineWidth, rsiLimitLineStyle: editForm.rsiLimitLineStyle } : {}),
      ...(ind?.type === "MFI" ? { mfiFixedScale: editForm.mfiFixedScale, mfiCenterLine: editForm.mfiCenterLine, mfiCenterLineColor: editForm.mfiCenterLineColor, mfiCenterLineWidth: editForm.mfiCenterLineWidth, mfiCenterLineStyle: editForm.mfiCenterLineStyle, mfiLimits: editForm.mfiLimits, mfiLimitUpper: editForm.mfiLimitUpper, mfiLimitLower: editForm.mfiLimitLower, mfiLimitColor: editForm.mfiLimitColor, mfiLimitLineWidth: editForm.mfiLimitLineWidth, mfiLimitLineStyle: editForm.mfiLimitLineStyle } : {}),
      ...(ind?.type === "MACD" ? {
        macdFastMaType: editForm.macdFastMaType,
        macdFastPeriod: Math.max(1, Math.min(500, fastP)),
        macdSlowMaType: editForm.macdSlowMaType,
        macdSlowPeriod: Math.max(1, Math.min(500, slowP)),
        macdSignalLine: editForm.macdSignalLine,
        macdSignalMaType: editForm.macdSignalMaType,
        macdSignalPeriod: editForm.macdSignalLine ? Math.max(1, Math.min(500, Number(editForm.macdSignalPeriodText) || 9)) : undefined,
        macdSignalColor: editForm.macdSignalLine ? editForm.macdSignalColor : undefined,
        macdSignalLineWidth: editForm.macdSignalLine ? editForm.macdSignalLineWidth : undefined,
        macdSignalLineStyle: editForm.macdSignalLine ? editForm.macdSignalLineStyle : undefined,
        macdHistogram: editForm.macdSignalLine && editForm.macdHistogram,
        macdHistogramColorAbove: editForm.macdSignalLine && editForm.macdHistogram ? editForm.macdHistogramColorAbove : undefined,
        macdHistogramColorBelow: editForm.macdSignalLine && editForm.macdHistogram ? editForm.macdHistogramColorBelow : undefined,
      } : {}),
      ...(ind?.type === "Stochastic" ? {
        stochLimits: editForm.stochLimits,
        stochLimitUpper: editForm.stochLimitUpper,
        stochLimitLower: editForm.stochLimitLower,
        stochLimitColor: editForm.stochLimitColor,
        stochLimitLineWidth: editForm.stochLimitLineWidth,
        stochLimitLineStyle: editForm.stochLimitLineStyle,
        stochDLine: editForm.stochDLine,
        stochDMaType: editForm.stochDMaType,
        stochDPeriod: editForm.stochDLine ? Math.max(1, Math.min(500, Number(editForm.stochDPeriodText) || 3)) : undefined,
        stochDColor: editForm.stochDLine ? editForm.stochDColor : undefined,
        stochDLineWidth: editForm.stochDLine ? editForm.stochDLineWidth : undefined,
        stochDLineStyle: editForm.stochDLine ? editForm.stochDLineStyle : undefined,
      } : {}),
      ...(ind?.type === "WilliamsR" ? {
        williamsRLimits: editForm.williamsRLimits,
        williamsRLimitUpper: editForm.williamsRLimitUpper,
        williamsRLimitLower: editForm.williamsRLimitLower,
        williamsRLimitColor: editForm.williamsRLimitColor,
        williamsRLimitLineWidth: editForm.williamsRLimitLineWidth,
        williamsRLimitLineStyle: editForm.williamsRLimitLineStyle,
      } : {}),
      ...(ind?.type === "ADX" ? {
        adxPlusDiColor: editForm.adxPlusDiColor,
        adxPlusDiLineWidth: editForm.adxPlusDiLineWidth,
        adxPlusDiLineStyle: editForm.adxPlusDiLineStyle,
        adxMinusDiColor: editForm.adxMinusDiColor,
        adxMinusDiLineWidth: editForm.adxMinusDiLineWidth,
        adxMinusDiLineStyle: editForm.adxMinusDiLineStyle,
        adxAdxColor: editForm.adxAdxColor,
        adxAdxLineWidth: editForm.adxAdxLineWidth,
        adxAdxLineStyle: editForm.adxAdxLineStyle,
        adxFixedScale: editForm.adxFixedScale,
        adxLimits: editForm.adxLimits,
        adxLimitUpper: editForm.adxLimitUpper,
        adxLimitLower: editForm.adxLimitLower,
        adxLimitColor: editForm.adxLimitColor,
        adxLimitLineWidth: editForm.adxLimitLineWidth,
        adxLimitLineStyle: editForm.adxLimitLineStyle,
      } : {}),
      ...(ind?.type === "CCI" ? {
        cciFixedScale: editForm.cciFixedScale,
        cciLimits: editForm.cciLimits,
        cciLimitUpper: editForm.cciLimitUpper,
        cciLimitLower: editForm.cciLimitLower,
        cciLimitColor: editForm.cciLimitColor,
        cciLimitLineWidth: editForm.cciLimitLineWidth,
        cciLimitLineStyle: editForm.cciLimitLineStyle,
        cciAsHistogram: editForm.cciAsHistogram,
        cciHistogramColorAbove: editForm.cciHistogramColorAbove,
        cciHistogramColorBelow: editForm.cciHistogramColorBelow,
      } : {}),
      ...(ind?.type === "CMF" ? {
        cmfFixedScale: editForm.cmfFixedScale,
        cmfLimits: editForm.cmfLimits,
        cmfLimitUpper: editForm.cmfLimitUpper,
        cmfLimitLower: editForm.cmfLimitLower,
        cmfLimitColor: editForm.cmfLimitColor,
        cmfLimitLineWidth: editForm.cmfLimitLineWidth,
        cmfLimitLineStyle: editForm.cmfLimitLineStyle,
        cmfAsHistogram: editForm.cmfAsHistogram,
        cmfHistogramColorAbove: editForm.cmfHistogramColorAbove,
        cmfHistogramColorBelow: editForm.cmfHistogramColorBelow,
      } : {}),
      ...(ind?.type === "OBV" ? { obvVolumeSource: editForm.obvVolumeSource ?? "base" } : {}),
      ...(ind?.type === "AD" ? { adVolumeSource: editForm.adVolumeSource ?? "base" } : {}),
      ...(ind?.type === "Donchian" ? {
        donchianShowUpper: editForm.donchianShowUpper,
        donchianShowLower: editForm.donchianShowLower,
        donchianShowMiddle: editForm.donchianShowMiddle,
        donchianBandOpacity: Math.max(0, Math.min(0.3, (parseFloat(editForm.donchianBandOpacityText) || 20) / 100)),
        donchianLimitsColor: editForm.donchianLimitsColor,
        donchianLimitsLineStyle: editForm.donchianLimitsLineStyle,
        donchianLimitsLineWidth: editForm.donchianLimitsLineWidth,
        donchianMiddleColor: editForm.donchianMiddleColor,
        donchianMiddleLineStyle: editForm.donchianMiddleLineStyle,
        donchianMiddleLineWidth: editForm.donchianMiddleLineWidth,
      } : {}),
      ...(ind?.type === "Ichimoku" ? {
        ichimokuTenkanPeriod: Math.max(1, Math.min(500, parseInt(editForm.ichimokuTenkanPeriodText, 10) || 9)),
        ichimokuKijunPeriod: Math.max(1, Math.min(500, parseInt(editForm.ichimokuKijunPeriodText, 10) || 26)),
        ichimokuSpanBPeriod: Math.max(1, Math.min(500, parseInt(editForm.ichimokuSpanBPeriodText, 10) || 52)),
        ichimokuDisplacement: Math.max(0, Math.min(500, parseInt(editForm.ichimokuDisplacementText, 10) || 26)),
        ichimokuTenkanColor: editForm.ichimokuTenkanColor,
        ichimokuTenkanLineWidth: editForm.ichimokuTenkanLineWidth,
        ichimokuTenkanLineStyle: editForm.ichimokuTenkanLineStyle,
        ichimokuKijunColor: editForm.ichimokuKijunColor,
        ichimokuKijunLineWidth: editForm.ichimokuKijunLineWidth,
        ichimokuKijunLineStyle: editForm.ichimokuKijunLineStyle,
        ichimokuSpanAColor: editForm.ichimokuSpanAColor,
        ichimokuSpanALineWidth: editForm.ichimokuSpanALineWidth,
        ichimokuSpanALineStyle: editForm.ichimokuSpanALineStyle,
        ichimokuSpanBColor: editForm.ichimokuSpanBColor,
        ichimokuSpanBLineWidth: editForm.ichimokuSpanBLineWidth,
        ichimokuSpanBLineStyle: editForm.ichimokuSpanBLineStyle,
        ichimokuChikouColor: editForm.ichimokuChikouColor,
        ichimokuChikouLineWidth: editForm.ichimokuChikouLineWidth,
        ichimokuChikouLineStyle: editForm.ichimokuChikouLineStyle,
        ichimokuCloudOpacity: Math.max(0, Math.min(0.7, (parseFloat(editForm.ichimokuCloudOpacityText) || 30) / 100)),
        ichimokuShowTenkan: editForm.ichimokuShowTenkan,
        ichimokuShowKijun: editForm.ichimokuShowKijun,
        ichimokuShowSpanA: editForm.ichimokuShowSpanA,
        ichimokuShowSpanB: editForm.ichimokuShowSpanB,
        ichimokuShowChikou: editForm.ichimokuShowChikou,
      } : {}),
      ...(ind?.type === "SAR" ? {
        sarStart: (() => { const n = parseFloat(editForm.sarStartText); return Number.isFinite(n) ? Math.max(0.001, Math.min(1, n)) : 0.02; })(),
        sarIncrement: (() => { const n = parseFloat(editForm.sarIncrementText); return Number.isFinite(n) ? Math.max(0.001, Math.min(1, n)) : 0.02; })(),
        sarMax: (() => { const n = parseFloat(editForm.sarMaxText); return Number.isFinite(n) ? Math.max(0.02, Math.min(1, n)) : 0.2; })(),
        sarPointSize: editForm.sarPointSize ?? "normal",
      } : {}),
      ...(ind?.type === "Bollinger" ? {
        bollingerMaType: editForm.bollingerMaType,
        bollingerZ: Math.max(0, Math.min(3, parseFloat(editForm.bollingerZText) || 2)),
        bollingerShowUpper: editForm.bollingerShowUpper,
        bollingerShowLower: editForm.bollingerShowLower,
        bollingerShowMiddle: editForm.bollingerShowMiddle,
        bollingerBandOpacity: Math.max(0, Math.min(0.3, (parseFloat(editForm.bollingerBandOpacityText) || 20) / 100)),
        bollingerLimitsColor: editForm.bollingerLimitsColor,
        bollingerLimitsLineStyle: editForm.bollingerLimitsLineStyle,
        bollingerLimitsLineWidth: editForm.bollingerLimitsLineWidth,
        bollingerMiddleColor: editForm.color,
        bollingerMiddleLineStyle: editForm.lineStyle,
        bollingerMiddleLineWidth: editForm.lineWidth,
      } : {}),
      ...(ind?.type === "Keltner" ? {
        keltnerMaType: editForm.keltnerMaType,
        keltnerMultiplier: Math.max(0, Math.min(10, parseFloat(editForm.keltnerMultiplierText) || 2)),
        keltnerShowUpper: editForm.keltnerShowUpper,
        keltnerShowLower: editForm.keltnerShowLower,
        keltnerShowMiddle: editForm.keltnerShowMiddle,
        keltnerBandOpacity: Math.max(0, Math.min(0.3, (parseFloat(editForm.keltnerBandOpacityText) || 20) / 100)),
        keltnerLimitsColor: editForm.keltnerLimitsColor,
        keltnerLimitsLineStyle: editForm.keltnerLimitsLineStyle,
        keltnerLimitsLineWidth: editForm.keltnerLimitsLineWidth,
        keltnerMiddleColor: editForm.color,
        keltnerMiddleLineStyle: editForm.lineStyle,
        keltnerMiddleLineWidth: editForm.lineWidth,
      } : {}),
      ...(ind != null && isTimeWindowMa2Type(ind.type) && wma2Parsed != null
        ? {
            wma2TimeUnit:
              editForm.wma2TimeUnit === "days" || editForm.wma2TimeUnit === "hours" || editForm.wma2TimeUnit === "minutes"
                ? editForm.wma2TimeUnit
                : "hours",
            wma2TimeValue: wma2Parsed,
          }
        : {}),
    };
    updateIndicatorWithStrategyReset(editingId, updates);
    const nextIndicators = userIndicators.map((u) => (u.id === editingId ? { ...u, ...updates } : u));
    chartLayoutSave?.saveLayoutNow("indicators", nextIndicators);
    setEditingId(null);
    setEditForm(null);
  }, [editingId, editForm, userIndicators, updateIndicatorWithStrategyReset, chartLayoutSave]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm(null);
  }, []);

  const contextValue = useMemo(
    () => ({
      t: t as Record<string, string>,
      userIndicators,
      fieldOptions,
      firstEnabledFieldValue,
      fieldOptionsVisibleForAdd,
      firstEnabledFieldValueForAdd,
      panelsWithSecondary,
      panelsFreeForSecondary,
      panelsFreeForSecondaryEdit,
      indicatorCountByPanel,
      isFreeUser,
      MAIN_MAX_INDICATORS,
      SECONDARY_MAX_INDICATORS,
      isMovingAverageType: isMA,
      INDICATOR_COLOR_PALETTE,
      INTERVAL_OPTIONS,
      addButtonDisabled,
      defaultModelMaxIndicatorsReached,
      isDefaultLayout: isDefaultModel,
      handleAdd,
      editingId,
      editForm,
      setEditForm,
      startEdit,
      saveEdit,
      cancelEdit,
      expandedId,
      setExpandedId,
      toggleInterval,
      setAllIntervals,
      isIntervalChecked,
      removeIndicator: requestRemoveIndicator,
      updateIndicator: updateIndicatorWithStrategyReset,
      getIndicatorLabel: getIndicatorLabel as IndicatorsPanelContextValue["getIndicatorLabel"],
    }),
    [
      t,
      userIndicators,
      fieldOptions,
      firstEnabledFieldValue,
      fieldOptionsVisibleForAdd,
      firstEnabledFieldValueForAdd,
      panelsWithSecondary,
      panelsFreeForSecondary,
      panelsFreeForSecondaryEdit,
      indicatorCountByPanel,
      isFreeUser,
      isMA,
      addButtonDisabled,
      defaultModelMaxIndicatorsReached,
      isDefaultModel,
      handleAdd,
      editingId,
      editForm,
      expandedId,
      toggleInterval,
      setAllIntervals,
      isIntervalChecked,
      requestRemoveIndicator,
      updateIndicatorWithStrategyReset,
    ]
  );

  return (
    <div
      className={`fixed inset-y-0 left-0 z-[1301] flex flex-col bg-white border-r border-zinc-200 shadow-xl overflow-hidden w-[66.666vw] sm:w-[33.333vw] max-w-[400px] ${hideStatusBar === false ? "crypto-status-bar-reserve" : ""}`}
      role="dialog"
      aria-label={t.indicatorsPanelTitle}
    >
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-zinc-50">
        <h2 className="text-sm font-semibold text-zinc-800">
          {initialView === "list"
            ? ((t as Record<string, string>).menuMyIndicators ?? t.indicatorsPanelTitle)
            : ((t as Record<string, string>).menuAddIndicator ?? "Add indicator")}
        </h2>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-zinc-200 text-zinc-600" aria-label="Close">
            <span className="text-lg leading-none">×</span>
          </button>
        )}
      </div>
      <div className="panel-scroll flex-1 min-h-0 overflow-auto p-3 space-y-4">
        <IndicatorsPanelContext.Provider value={contextValue}>
          {initialView === "add" && (
            <div ref={addFormRef}>
              <IndicatorsPanelAddForm form={addForm} setForm={setAddForm} />
            </div>
          )}
          {initialView === "list" && userIndicators.length === 0 && (
            <p className="text-sm text-zinc-500 py-2">{(t as Record<string, string>).noIndicatorsYet ?? "Nenhum indicador salvo. Use \"Adicionar indicador\" no menu para criar."}</p>
          )}
          {initialView === "list" && userIndicators.length > 0 && (() => {
            const indicatorsForCurrentTimeframe = currentGroupMinutes != null
              ? userIndicators.filter((ind) => {
                  if (ind.intervals.length === 1 && ind.intervals[0] === 0) return false;
                  return ind.intervals.length === 0 || ind.intervals.includes(currentGroupMinutes);
                })
              : userIndicators.filter((ind) => !(ind.intervals.length === 1 && ind.intervals[0] === 0));
            const currentTimeframeLabel = currentGroupMinutes != null ? (INTERVAL_OPTIONS.find((o) => o.value === currentGroupMinutes)?.label ?? String(currentGroupMinutes)) : "—";
            const listToShow = showOnlyCurrentTimeframe ? indicatorsForCurrentTimeframe : userIndicators;
            return (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <div className="flex rounded-md border border-zinc-300 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowOnlyCurrentTimeframe(true)}
                      className={`text-xs px-2.5 py-1 ${showOnlyCurrentTimeframe ? "bg-zinc-200 font-medium text-zinc-800" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
                    >
                      {(t as Record<string, string>).indicatorsFilterCurrentTimeframe ?? "Deste tempo"}{currentGroupMinutes != null ? ` (${currentTimeframeLabel})` : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowOnlyCurrentTimeframe(false)}
                      className={`text-xs px-2.5 py-1 border-l border-zinc-300 ${!showOnlyCurrentTimeframe ? "bg-zinc-200 font-medium text-zinc-800" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
                    >
                      {(t as Record<string, string>).indicatorsFilterAll ?? "Todos"}
                    </button>
                  </div>
                </div>
                {showOnlyCurrentTimeframe && indicatorsForCurrentTimeframe.length === 0 ? (
                  <p className="text-sm text-zinc-500 py-2">
                    {(t as Record<string, string>).noIndicatorsForTimeframe ?? "Nenhum indicador para este timeframe. Altere \"Mostrar em\" ao editar um indicador para incluir este período ou \"Todos os tempos\"."}
                  </p>
                ) : listToShow.length === 0 ? (
                  <p className="text-sm text-zinc-500 py-2">{(t as Record<string, string>).noIndicatorsYet ?? "Nenhum indicador salvo."}</p>
                ) : (
                  <div className="space-y-2">
                    {listToShow.map((ind) => (
                      <IndicatorsPanelIndicatorCard key={ind.id} ind={ind} />
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </IndicatorsPanelContext.Provider>
      </div>
      {deleteConfirmIndicator && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label={(t as Record<string, string>).indicatorDeleteConfirmTitle ?? "Remover indicador"}>
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-900">{(t as Record<string, string>).indicatorDeleteConfirmTitle ?? "Remover indicador"}</h3>
              <button type="button" onClick={() => setDeleteConfirmIndicator(null)} className="p-1 rounded hover:bg-zinc-200 text-zinc-600" aria-label={t.close ?? "Close"}>
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <div className="px-4 py-3 text-sm text-zinc-700">
              <p>{(t as Record<string, string>).indicatorDeleteConfirmMessage?.replace("{name}", deleteConfirmIndicator.label) ?? `Remover o indicador "${deleteConfirmIndicator.label}"? Esta ação não pode ser desfeita.`}</p>
            </div>
            <div className="px-4 py-3 border-t border-zinc-200 bg-white flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmIndicator(null)}
                className="crypto-btn rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 font-medium px-4 py-2"
              >
                {t.cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToRemove = deleteConfirmIndicator.id;
                  removeIndicatorWithStrategyReset(idToRemove);
                  setDeleteConfirmIndicator(null);
                  const nextIndicators = userIndicators.filter((u) => u.id !== idToRemove);
                  chartLayoutSave?.saveLayoutNow("indicators", nextIndicators);
                }}
                className="crypto-btn rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2"
              >
                {(t as Record<string, string>).indicatorConfirmDelete ?? "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
