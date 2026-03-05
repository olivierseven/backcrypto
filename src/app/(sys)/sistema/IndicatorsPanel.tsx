"use client";

import { useState, useMemo, useCallback } from "react";
import { useBioLang } from "@/app/contexts/BioLangContext";
import { getBioT } from "@/app/lib/translations";
import {
  useKlinesIndicators,
  type UserIndicatorConfig,
  type IndicatorPanel,
  type IndicatorLineWidth,
  type IndicatorLineStyle,
} from "./KlinesIndicatorsContext";
import {
  INDICATOR_COLOR_PALETTE,
  INTERVAL_OPTIONS,
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
};

interface IndicatorsPanelProps {
  onClose?: () => void;
}

export default function IndicatorsPanel({ onClose }: IndicatorsPanelProps) {
  const lang = useBioLang();
  const t = getBioT(lang).sistema.klines;
  const { userIndicators, currentGroupMinutes, showIndicatorLastValueOnYAxis, setShowIndicatorLastValueOnYAxis, addIndicator, removeIndicator, updateIndicator, updateIndicatorIntervals } = useKlinesIndicators();

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
    sarStart: number;
    sarStartText: string;
    sarIncrement: number;
    sarIncrementText: string;
    sarMax: number;
    sarMaxText: string;
    sarPointSize: "thin" | "normal";
  } | null>(null);

  const getPanel = (i: UserIndicatorConfig) => i.panel ?? (i.type === "RSI" || i.type === "MACD" || i.type === "Stochastic" || i.type === "OBV" || i.type === "ATR" ? "panel2" : "main");

  const panelsWithSecondary = useMemo(() => ({
    panel2: userIndicators.some((i) => getPanel(i) === "panel2" && (i.type === "RSI" || i.type === "MACD" || i.type === "Stochastic" || i.type === "OBV" || i.type === "ATR")),
    panel3: userIndicators.some((i) => getPanel(i) === "panel3" && (i.type === "RSI" || i.type === "MACD" || i.type === "Stochastic" || i.type === "OBV" || i.type === "ATR")),
    panel4: userIndicators.some((i) => getPanel(i) === "panel4" && (i.type === "RSI" || i.type === "MACD" || i.type === "Stochastic" || i.type === "OBV" || i.type === "ATR")),
  }), [userIndicators]);

  const panelsFreeForSecondary = useMemo(() => ({
    panel2: !panelsWithSecondary.panel2,
    panel3: !panelsWithSecondary.panel3,
    panel4: !panelsWithSecondary.panel4,
  }), [panelsWithSecondary]);

  const panelsFreeForSecondaryEdit = useMemo(() => {
    if (!editingId) return { panel2: true, panel3: true, panel4: true };
    const isSecondary = (i: UserIndicatorConfig) => i.type === "RSI" || i.type === "MACD" || i.type === "Stochastic" || i.type === "OBV" || i.type === "ATR";
    return {
      panel2: !userIndicators.some((i) => getPanel(i) === "panel2" && isSecondary(i) && i.id !== editingId),
      panel3: !userIndicators.some((i) => getPanel(i) === "panel3" && isSecondary(i) && i.id !== editingId),
      panel4: !userIndicators.some((i) => getPanel(i) === "panel4" && isSecondary(i) && i.id !== editingId),
    };
  }, [userIndicators, editingId]);

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

  const hasFreePanelForSecondary = panelsFreeForSecondary.panel2 || panelsFreeForSecondary.panel3 || panelsFreeForSecondary.panel4;
  const addButtonDisabled =
    (addForm.indicatorType === "RSI" || addForm.indicatorType === "MACD" || addForm.indicatorType === "Stochastic" || addForm.indicatorType === "OBV" || addForm.indicatorType === "ATR") && !hasFreePanelForSecondary;

  const handleAdd = useCallback(() => {
    const n = Number(addForm.periodText);
    const periodNum = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : Math.max(1, Math.min(500, addForm.period));
    const fastP = addForm.indicatorType === "MACD" ? (Number(addForm.macdFastPeriodText) || 12) : periodNum;
    const slowP = addForm.indicatorType === "MACD" ? (Number(addForm.macdSlowPeriodText) || 26) : periodNum;
    setAddForm((prev) => ({ ...prev, period: periodNum, periodText: String(periodNum) }));
    const effectivePanel: IndicatorPanel = addForm.indicatorType === "SAR" || addForm.indicatorType === "VWAP"
      ? "main"
      : addForm.indicatorType === "RSI" || addForm.indicatorType === "MACD" || addForm.indicatorType === "Stochastic" || addForm.indicatorType === "OBV" || addForm.indicatorType === "ATR"
      ? (addForm.chartOption === "panel2" && panelsFreeForSecondary.panel2) || (addForm.chartOption === "panel3" && panelsFreeForSecondary.panel3) || (addForm.chartOption === "panel4" && panelsFreeForSecondary.panel4)
        ? addForm.chartOption
        : (panelsFreeForSecondary.panel2 ? "panel2" : panelsFreeForSecondary.panel3 ? "panel3" : panelsFreeForSecondary.panel4 ? "panel4" : "panel2")
      : (addForm.chartOption === "panel2" && !panelsWithSecondary.panel2) || (addForm.chartOption === "panel3" && !panelsWithSecondary.panel3) || (addForm.chartOption === "panel4" && !panelsWithSecondary.panel4)
        ? addForm.chartOption
        : (addForm.chartOption === "panel2" || addForm.chartOption === "panel3" || addForm.chartOption === "panel4" ? addForm.chartOption : "main");
    const parseSar = (s: string, def: number, min: number, max: number) => {
      const n = parseFloat(s);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
    };
    addIndicator({
      type: addForm.indicatorType,
      period: addForm.indicatorType === "MACD" ? fastP : addForm.indicatorType === "OBV" || addForm.indicatorType === "SAR" || addForm.indicatorType === "VWAP" ? 1 : periodNum,
      fieldKey: addForm.indicatorType === "OBV" ? "volume" : addForm.indicatorType === "SAR" || addForm.indicatorType === "ATR" || addForm.indicatorType === "VWAP" ? "close" : addForm.fieldKey,
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
      ...(addForm.indicatorType === "SAR" ? {
        sarStart: parseSar(addForm.sarStartText, 0.02, 0.001, 1),
        sarIncrement: parseSar(addForm.sarIncrementText, 0.02, 0.001, 1),
        sarMax: parseSar(addForm.sarMaxText, 0.2, 0.02, 1),
        sarPointSize: addForm.sarPointSize ?? "normal",
      } : {}),
      ...(addForm.indicatorType === "Bollinger" ? {} : {}),
    });
  }, [addForm, panelsWithSecondary, currentGroupMinutes, addIndicator]);

  const toggleInterval = useCallback((id: string, groupMinutes: number) => {
    const ind = userIndicators.find((u) => u.id === id);
    if (!ind) return;
    const current = ind.intervals.length === 0 ? INTERVAL_OPTIONS.map((o) => o.value) : [...ind.intervals];
    const idx = current.indexOf(groupMinutes);
    const next = idx >= 0 ? (current.filter((v) => v !== groupMinutes).length === 0 ? [] : current.filter((v) => v !== groupMinutes)) : [...current, groupMinutes].sort((a, b) => a - b);
    updateIndicatorIntervals(id, next);
  }, [userIndicators, updateIndicatorIntervals]);

  const setAllIntervals = useCallback((id: string) => updateIndicatorIntervals(id, []), [updateIndicatorIntervals]);

  const isIntervalChecked = useCallback((ind: UserIndicatorConfig, value: number) => {
    if (ind.intervals.length === 0) return true;
    return ind.intervals.includes(value);
  }, []);

  const startEdit = useCallback((ind: UserIndicatorConfig) => {
    setEditingId(ind.id);
    const panel = ind.panel === "main" || ind.panel === "panel2" || ind.panel === "panel3" || ind.panel === "panel4" ? ind.panel : (ind.type === "RSI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "OBV" || ind.type === "ATR" ? "panel2" : "main");
    const fieldKey = ind.type === "Stochastic" && ind.fieldKey !== "open" && ind.fieldKey !== "close" ? "close" : ind.fieldKey;
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
    updateIndicator(editingId, {
      period: ind?.type === "MACD" ? fastP : periodNum,
      fieldKey: ind?.type === "OBV" ? "volume" : editForm.fieldKey,
      color: editForm.color,
      panel: ind?.type === "SAR" || ind?.type === "VWAP" ? "main" : editForm.panel,
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
    });
    setEditingId(null);
    setEditForm(null);
  }, [editingId, editForm, userIndicators, updateIndicator]);

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
      removeIndicator,
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
      isMA,
      addButtonDisabled,
      handleAdd,
      editingId,
      editForm,
      expandedId,
      toggleInterval,
      setAllIntervals,
      isIntervalChecked,
      removeIndicator,
    ]
  );

  return (
    <div
      className="fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-zinc-200 shadow-xl overflow-hidden w-[66.666vw] sm:w-[33.333vw] max-w-[400px]"
      role="dialog"
      aria-label={t.indicatorsPanelTitle}
    >
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-zinc-50">
        <h2 className="text-sm font-semibold text-zinc-800">{t.indicatorsPanelTitle}</h2>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-zinc-200 text-zinc-600" aria-label="Close">
            <span className="text-lg leading-none">×</span>
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-4">
        <label className="flex items-center gap-2 cursor-pointer px-1 py-2 rounded hover:bg-zinc-50 text-sm text-zinc-700 border-b border-zinc-100">
          <input type="checkbox" checked={showIndicatorLastValueOnYAxis} onChange={(e) => setShowIndicatorLastValueOnYAxis(e.target.checked)} className="rounded border-zinc-300" />
          <span>{(t as Record<string, string>).showIndicatorLastValueOnYAxis ?? "Valores dos indicadores no eixo Y"}</span>
        </label>
        <IndicatorsPanelContext.Provider value={contextValue}>
          <IndicatorsPanelAddForm form={addForm} setForm={setAddForm} />
          {userIndicators.length > 0 && (
            <div className="pt-3 border-t border-zinc-200 space-y-2">
              {userIndicators.map((ind) => (
                <IndicatorsPanelIndicatorCard key={ind.id} ind={ind} />
              ))}
            </div>
          )}
        </IndicatorsPanelContext.Provider>
      </div>
    </div>
  );
}
