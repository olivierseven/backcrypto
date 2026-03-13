"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
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
import { IndicatorsPanelContext } from "./indicatorsPanel/IndicatorsPanelContext";
import { IndicatorsPanelAddForm } from "./indicatorsPanel/IndicatorsPanelAddForm";
import { IndicatorsPanelIndicatorCard } from "./indicatorsPanel/IndicatorsPanelIndicatorCard";
import type { AddFormState, IndicatorsPanelContextValue } from "./indicatorsPanel/indicatorsPanelTypes";

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
  volumeInUsdt: false,
  volumeColorAbove: "#10b981",
  volumeColorBelow: "#ef4444",
  volumeColorAboveOpen: false,
  volumeColorBelowOpen: false,
};

interface IndicatorsPanelProps {
  initialView?: "list" | "add";
  onClose?: () => void;
}

export default function IndicatorsPanel({ initialView = "list", onClose }: IndicatorsPanelProps) {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines;
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
  const [editForm, setEditForm] = useState<{
    period: number;
    periodText: string;
    fieldKey: import("./KlinesIndicatorsContext").IndicatorFieldKey;
    color: string;
    panel: IndicatorPanel;
    lineWidth: IndicatorLineWidth;
    lineStyle: IndicatorLineStyle;
    macdFastMaType: "SMA" | "EMA" | "WMA";
    macdFastPeriod: number;
    macdFastPeriodText: string;
    macdSlowMaType: "SMA" | "EMA" | "WMA";
    macdSlowPeriod: number;
    macdSlowPeriodText: string;
    macdSignalLine: boolean;
    macdSignalMaType: "SMA" | "EMA" | "WMA";
    macdSignalPeriod: number;
    macdSignalPeriodText: string;
    macdSignalColor: string;
    macdSignalLineWidth: IndicatorLineWidth;
    macdSignalLineStyle: IndicatorLineStyle;
    macdHistogram: boolean;
    macdHistogramColorAbove: string;
    macdHistogramColorBelow: string;
    rsiFixedScale: boolean;
    rsiCenterLine: boolean;
    rsiCenterLineColor: string;
    rsiCenterLineWidth: IndicatorLineWidth;
    rsiCenterLineStyle: IndicatorLineStyle;
    rsiLimits: boolean;
    rsiLimitUpper: number;
    rsiLimitLower: number;
    rsiLimitColor: string;
    rsiLimitLineWidth: IndicatorLineWidth;
    rsiLimitLineStyle: IndicatorLineStyle;
    stochLimits: boolean;
    stochLimitUpper: number;
    stochLimitLower: number;
    stochLimitColor: string;
    stochLimitLineWidth: IndicatorLineWidth;
    stochLimitLineStyle: IndicatorLineStyle;
    stochDLine: boolean;
    stochDMaType: "SMA" | "EMA" | "WMA";
    stochDPeriod: number;
    stochDPeriodText: string;
    stochDColor: string;
    stochDLineWidth: IndicatorLineWidth;
    stochDLineStyle: IndicatorLineStyle;
    williamsRLimits: boolean;
    williamsRLimitUpper: number;
    williamsRLimitLower: number;
    williamsRLimitColor: string;
    williamsRLimitLineWidth: IndicatorLineWidth;
    williamsRLimitLineStyle: IndicatorLineStyle;
    sarStart: number;
    sarStartText: string;
    sarIncrement: number;
    sarIncrementText: string;
    sarMax: number;
    sarMaxText: string;
    sarPointSize: "thin" | "normal";
  } | null>(null);

  const getPanel = (i: UserIndicatorConfig) => i.panel ?? (i.type === "RSI" || i.type === "MACD" || i.type === "Stochastic" || i.type === "WilliamsR" || i.type === "OBV" || i.type === "ATR" ? "panel2" : "main");

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
    panel3: indicatorCountByPanel.panel3 < SECONDARY_MAX_INDICATORS,
    panel4: indicatorCountByPanel.panel4 < SECONDARY_MAX_INDICATORS,
    panel5: indicatorCountByPanel.panel5 < SECONDARY_MAX_INDICATORS,
  }), [indicatorCountByPanel]);

  const panelsFreeForSecondaryEdit = useMemo(() => {
    if (!editingId) return { panel2: true, panel3: true, panel4: true, panel5: true };
    const editing = userIndicators.find((i) => i.id === editingId);
    const editingPanel = editing ? getPanel(editing) : null;
    return {
      panel2: indicatorCountByPanel.panel2 < SECONDARY_MAX_INDICATORS || editingPanel === "panel2",
      panel3: indicatorCountByPanel.panel3 < SECONDARY_MAX_INDICATORS || editingPanel === "panel3",
      panel4: indicatorCountByPanel.panel4 < SECONDARY_MAX_INDICATORS || editingPanel === "panel4",
      panel5: indicatorCountByPanel.panel5 < SECONDARY_MAX_INDICATORS || editingPanel === "panel5",
    };
  }, [userIndicators, editingId, indicatorCountByPanel]);

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
  const isSecondaryType = addForm.indicatorType === "RSI" || addForm.indicatorType === "MACD" || addForm.indicatorType === "Stochastic" || addForm.indicatorType === "WilliamsR" || addForm.indicatorType === "OBV" || addForm.indicatorType === "ATR" || addForm.indicatorType === "Volume";
  const hasEmptyPanelForVolume = indicatorCountByPanel.panel2 === 0 || indicatorCountByPanel.panel3 === 0 || indicatorCountByPanel.panel4 === 0 || indicatorCountByPanel.panel5 === 0;
  const chosenPanelUsedForVolume =
    (addForm.chartOption === "panel2" && indicatorCountByPanel.panel2 > 0) ||
    (addForm.chartOption === "panel3" && indicatorCountByPanel.panel3 > 0) ||
    (addForm.chartOption === "panel4" && indicatorCountByPanel.panel4 > 0) ||
    (addForm.chartOption === "panel5" && indicatorCountByPanel.panel5 > 0);
  const mainPanelFull = indicatorCountByPanel.main >= MAIN_MAX_INDICATORS;
  const chosenPanelFull =
    (addForm.chartOption === "main" && mainPanelFull) ||
    (addForm.chartOption === "panel2" && indicatorCountByPanel.panel2 >= SECONDARY_MAX_INDICATORS) ||
    (addForm.chartOption === "panel3" && indicatorCountByPanel.panel3 >= SECONDARY_MAX_INDICATORS) ||
    (addForm.chartOption === "panel4" && indicatorCountByPanel.panel4 >= SECONDARY_MAX_INDICATORS) ||
    (addForm.chartOption === "panel5" && indicatorCountByPanel.panel5 >= SECONDARY_MAX_INDICATORS);
  const addButtonDisabled =
    (addForm.indicatorType === "Volume" && (!hasEmptyPanelForVolume || chosenPanelUsedForVolume)) ||
    (isSecondaryType && addForm.indicatorType !== "Volume" && !hasFreePanelForSecondary) ||
    (!isSecondaryType && chosenPanelFull);

  const handleAdd = useCallback(() => {
    const n = Number(addForm.periodText);
    const periodNum = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : Math.max(1, Math.min(500, addForm.period));
    const fastP = addForm.indicatorType === "MACD" ? (Number(addForm.macdFastPeriodText) || 12) : periodNum;
    const slowP = addForm.indicatorType === "MACD" ? (Number(addForm.macdSlowPeriodText) || 26) : periodNum;
    setAddForm((prev) => ({ ...prev, period: periodNum, periodText: String(periodNum) }));
    const effectivePanel: IndicatorPanel = addForm.indicatorType === "SAR" || addForm.indicatorType === "VWAP"
      ? "main"
      : addForm.indicatorType === "Volume"
      ? (addForm.chartOption === "panel2" && indicatorCountByPanel.panel2 === 0) || (addForm.chartOption === "panel3" && indicatorCountByPanel.panel3 === 0) || (addForm.chartOption === "panel4" && indicatorCountByPanel.panel4 === 0) || (addForm.chartOption === "panel5" && indicatorCountByPanel.panel5 === 0)
        ? addForm.chartOption
        : (indicatorCountByPanel.panel2 === 0 ? "panel2" : indicatorCountByPanel.panel3 === 0 ? "panel3" : indicatorCountByPanel.panel4 === 0 ? "panel4" : indicatorCountByPanel.panel5 === 0 ? "panel5" : "panel2")
      : addForm.indicatorType === "RSI" || addForm.indicatorType === "MACD" || addForm.indicatorType === "Stochastic" || addForm.indicatorType === "WilliamsR" || addForm.indicatorType === "OBV" || addForm.indicatorType === "ATR"
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
    addIndicator({
      type: addForm.indicatorType,
      period: addForm.indicatorType === "MACD" ? fastP : addForm.indicatorType === "OBV" || addForm.indicatorType === "SAR" || addForm.indicatorType === "VWAP" || addForm.indicatorType === "Volume" ? 1 : periodNum,
      fieldKey: addForm.indicatorType === "OBV" || addForm.indicatorType === "Volume" ? "volume" : addForm.indicatorType === "SAR" || addForm.indicatorType === "ATR" || addForm.indicatorType === "VWAP" ? "close" : addForm.fieldKey,
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
      color: addForm.color,
      intervals: currentGroupMinutes != null ? [currentGroupMinutes] : [],
      panel: effectivePanel,
      lineWidth: addForm.lineWidth,
      lineStyle: addForm.lineStyle,
      ...(addForm.indicatorType === "RSI" ? { rsiFixedScale: addForm.rsiFixedScale, rsiCenterLine: addForm.rsiCenterLine, rsiCenterLineColor: addForm.rsiCenterLineColor, rsiCenterLineWidth: addForm.rsiCenterLineWidth, rsiCenterLineStyle: addForm.rsiCenterLineStyle, rsiLimits: addForm.rsiLimits, rsiLimitUpper: addForm.rsiLimitUpper, rsiLimitLower: addForm.rsiLimitLower, rsiLimitColor: addForm.rsiLimitColor, rsiLimitLineWidth: addForm.rsiLimitLineWidth, rsiLimitLineStyle: addForm.rsiLimitLineStyle } : {}),
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
      ...(addForm.indicatorType === "SAR" ? {
        sarStart: parseSar(addForm.sarStartText, 0.02, 0.001, 1),
        sarIncrement: parseSar(addForm.sarIncrementText, 0.02, 0.001, 1),
        sarMax: parseSar(addForm.sarMaxText, 0.2, 0.02, 1),
        sarPointSize: addForm.sarPointSize ?? "normal",
      } : {}),
      ...(addForm.indicatorType === "Volume" ? {
        volumeInUsdt: addForm.volumeInUsdt === true,
        volumeColorAbove: addForm.volumeColorAbove ?? "#10b981",
        volumeColorBelow: addForm.volumeColorBelow ?? "#ef4444",
      } : {}),
      ...(addForm.indicatorType === "Bollinger" ? {} : {}),
    });
  }, [addForm, panelsWithSecondary, currentGroupMinutes, addIndicator]);

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
    if (!ind) return;
    const isNone = ind.intervals.length === 1 && ind.intervals[0] === 0;
    const current = ind.intervals.length === 0 ? INTERVAL_OPTIONS.map((o) => o.value) : isNone ? [] : [...ind.intervals];
    const idx = current.indexOf(groupMinutes);
    let next = idx >= 0 ? current.filter((v) => v !== groupMinutes) : [...current, groupMinutes].sort((a, b) => a - b);
    if (next.length === 0) next = [0];
    updateIndicatorIntervalsWithStrategyReset(id, next);
  }, [userIndicators, updateIndicatorIntervalsWithStrategyReset]);

  const setAllIntervals = useCallback((id: string) => updateIndicatorIntervalsWithStrategyReset(id, []), [updateIndicatorIntervalsWithStrategyReset]);

  const isIntervalChecked = useCallback((ind: UserIndicatorConfig, value: number) => {
    if (ind.intervals.length === 1 && ind.intervals[0] === 0) return false;
    if (ind.intervals.length === 0) return true;
    return ind.intervals.includes(value);
  }, []);

  const startEdit = useCallback((ind: UserIndicatorConfig) => {
    setEditingId(ind.id);
    const panel = ind.panel === "main" || ind.panel === "panel2" || ind.panel === "panel3" || ind.panel === "panel4" || ind.panel === "panel5" ? ind.panel : (ind.type === "RSI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "ATR" || ind.type === "Volume" ? "panel2" : "main");
    const fieldKey = ind.type === "WilliamsR" ? "close" : ind.fieldKey;
    const fastP = ind.type === "MACD" ? (ind.macdFastPeriod ?? 12) : ind.period;
    const slowP = ind.type === "MACD" ? (ind.macdSlowPeriod ?? 26) : ind.period;
    setEditForm({
      period: ind.period,
      periodText: String(ind.period),
      fieldKey,
      color: ind.color,
      panel,
      lineWidth: (ind.lineWidth === "thin" || ind.lineWidth === "normal" ? ind.lineWidth : "normal") as IndicatorLineWidth,
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
      macdSignalLineWidth: ind.type === "MACD" && ind.macdSignalLine ? (ind.macdSignalLineWidth === "thin" || ind.macdSignalLineWidth === "normal" ? ind.macdSignalLineWidth : "normal") : "normal",
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
      stochDLineWidth: (ind.type === "Stochastic" && ind.stochDLine && (ind.stochDLineWidth === "thin" || ind.stochDLineWidth === "normal") ? ind.stochDLineWidth : "normal") as IndicatorLineWidth,
      stochDLineStyle: (ind.type === "Stochastic" && ind.stochDLine && (ind.stochDLineStyle === "solid" || ind.stochDLineStyle === "dotted" || ind.stochDLineStyle === "dashed") ? ind.stochDLineStyle : "dashed") as IndicatorLineStyle,
      williamsRLimits: ind.type === "WilliamsR" ? (ind.williamsRLimits === true) : false,
      williamsRLimitUpper: ind.type === "WilliamsR" && ind.williamsRLimits ? (typeof ind.williamsRLimitUpper === "number" ? Math.max(-100, Math.min(0, Math.round(ind.williamsRLimitUpper))) : -20) : -20,
      williamsRLimitLower: ind.type === "WilliamsR" && ind.williamsRLimits ? (typeof ind.williamsRLimitLower === "number" ? Math.max(-100, Math.min(0, Math.round(ind.williamsRLimitLower))) : -80) : -80,
      williamsRLimitColor: ind.type === "WilliamsR" && ind.williamsRLimits ? (ind.williamsRLimitColor ?? "#dc2626") : "#dc2626",
      williamsRLimitLineWidth: (ind.type === "WilliamsR" && ind.williamsRLimits && (ind.williamsRLimitLineWidth === "thin" || ind.williamsRLimitLineWidth === "normal") ? ind.williamsRLimitLineWidth : "normal") as IndicatorLineWidth,
      williamsRLimitLineStyle: (ind.type === "WilliamsR" && ind.williamsRLimits && (ind.williamsRLimitLineStyle === "solid" || ind.williamsRLimitLineStyle === "dotted" || ind.williamsRLimitLineStyle === "dashed") ? ind.williamsRLimitLineStyle : "dotted") as IndicatorLineStyle,
      sarStart: ind.type === "SAR" ? (typeof ind.sarStart === "number" ? Math.max(0.001, Math.min(1, ind.sarStart)) : 0.02) : 0.02,
      sarStartText: String(ind.type === "SAR" ? (typeof ind.sarStart === "number" ? Math.max(0.001, Math.min(1, ind.sarStart)) : 0.02) : 0.02),
      sarIncrement: ind.type === "SAR" ? (typeof ind.sarIncrement === "number" ? Math.max(0.001, Math.min(1, ind.sarIncrement)) : 0.02) : 0.02,
      sarIncrementText: String(ind.type === "SAR" ? (typeof ind.sarIncrement === "number" ? Math.max(0.001, Math.min(1, ind.sarIncrement)) : 0.02) : 0.02),
      sarMax: ind.type === "SAR" ? (typeof ind.sarMax === "number" ? Math.max(0.02, Math.min(1, ind.sarMax)) : 0.2) : 0.2,
      sarMaxText: String(ind.type === "SAR" ? (typeof ind.sarMax === "number" ? Math.max(0.02, Math.min(1, ind.sarMax)) : 0.2) : 0.2),
      sarPointSize: ind.type === "SAR" ? (ind.sarPointSize === "thin" || ind.sarPointSize === "normal" ? ind.sarPointSize : "normal") : "normal",
      ...(ind.type === "VWAP" ? { period: 1, periodText: "1", fieldKey: "close" as const } : {}),
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
      volumeInUsdt: ind.type === "Volume" ? (ind.volumeInUsdt === true) : false,
      volumeColorAbove: ind.type === "Volume" ? (ind.volumeColorAbove ?? "#10b981") : "#10b981",
      volumeColorBelow: ind.type === "Volume" ? (ind.volumeColorBelow ?? "#ef4444") : "#ef4444",
      showLastValueOnYAxis: ind.showLastValueOnYAxis !== false,
      intervals: [...(ind.intervals || [])],
    });
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
    const updates = {
      period: ind?.type === "MACD" ? fastP : periodNum,
      fieldKey: ind?.type === "OBV" || ind?.type === "Volume" ? "volume" : editForm.fieldKey,
      color: editForm.color,
      panel: ind?.type === "SAR" || ind?.type === "VWAP" ? "main" : editForm.panel,
      intervals: editForm.intervals ?? [],
      showLastValueOnYAxis: editForm.showLastValueOnYAxis,
      ...(ind?.type === "Volume" ? {
        volumeInUsdt: editForm.volumeInUsdt === true,
        volumeColorAbove: editForm.volumeColorAbove ?? "#10b981",
        volumeColorBelow: editForm.volumeColorBelow ?? "#ef4444",
      } : {}),
      lineWidth: editForm.lineWidth,
      lineStyle: editForm.lineStyle,
      ...(ind?.type === "RSI" ? { rsiFixedScale: editForm.rsiFixedScale, rsiCenterLine: editForm.rsiCenterLine, rsiCenterLineColor: editForm.rsiCenterLineColor, rsiCenterLineWidth: editForm.rsiCenterLineWidth, rsiCenterLineStyle: editForm.rsiCenterLineStyle, rsiLimits: editForm.rsiLimits, rsiLimitUpper: editForm.rsiLimitUpper, rsiLimitLower: editForm.rsiLimitLower, rsiLimitColor: editForm.rsiLimitColor, rsiLimitLineWidth: editForm.rsiLimitLineWidth, rsiLimitLineStyle: editForm.rsiLimitLineStyle } : {}),
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
      MAIN_MAX_INDICATORS,
      SECONDARY_MAX_INDICATORS,
      isMovingAverageType: isMA,
      INDICATOR_COLOR_PALETTE,
      INTERVAL_OPTIONS,
      addButtonDisabled,
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
      isMA,
      addButtonDisabled,
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
      className="fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-zinc-200 shadow-xl overflow-hidden w-[66.666vw] sm:w-[33.333vw] max-w-[400px]"
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
            if (indicatorsForCurrentTimeframe.length === 0) {
              return (
                <p className="text-sm text-zinc-500 py-2">
                  {(t as Record<string, string>).noIndicatorsForTimeframe ?? "Nenhum indicador para este timeframe. Altere \"Mostrar em\" ao editar um indicador para incluir este período ou \"Todos os tempos\"."}
                </p>
              );
            }
            return (
              <div className="space-y-2">
                {indicatorsForCurrentTimeframe.map((ind) => (
                  <IndicatorsPanelIndicatorCard key={ind.id} ind={ind} />
                ))}
              </div>
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
