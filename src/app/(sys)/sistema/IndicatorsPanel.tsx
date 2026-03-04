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
export { getIndicatorLabel, getIndicatorLabelShort, getIndicatorLabelSignal, getIndicatorLabelShortSignal } from "./indicatorsPanel/index";

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
  } | null>(null);

  const getPanel = (i: UserIndicatorConfig) => i.panel ?? (i.type === "RSI" || i.type === "MACD" ? "panel2" : "main");

  const panelsWithSecondary = useMemo(() => ({
    panel2: userIndicators.some((i) => getPanel(i) === "panel2" && (i.type === "RSI" || i.type === "MACD")),
    panel3: userIndicators.some((i) => getPanel(i) === "panel3" && (i.type === "RSI" || i.type === "MACD")),
    panel4: userIndicators.some((i) => getPanel(i) === "panel4" && (i.type === "RSI" || i.type === "MACD")),
  }), [userIndicators]);

  const panelsFreeForSecondary = useMemo(() => ({
    panel2: !panelsWithSecondary.panel2,
    panel3: !panelsWithSecondary.panel3,
    panel4: !panelsWithSecondary.panel4,
  }), [panelsWithSecondary]);

  const panelsFreeForSecondaryEdit = useMemo(() => {
    if (!editingId) return { panel2: true, panel3: true, panel4: true };
    return {
      panel2: !userIndicators.some((i) => getPanel(i) === "panel2" && (i.type === "RSI" || i.type === "MACD") && i.id !== editingId),
      panel3: !userIndicators.some((i) => getPanel(i) === "panel3" && (i.type === "RSI" || i.type === "MACD") && i.id !== editingId),
      panel4: !userIndicators.some((i) => getPanel(i) === "panel4" && (i.type === "RSI" || i.type === "MACD") && i.id !== editingId),
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

  const addButtonDisabled = false;

  const handleAdd = useCallback(() => {
    const n = Number(addForm.periodText);
    const periodNum = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : Math.max(1, Math.min(500, addForm.period));
    const fastP = addForm.indicatorType === "MACD" ? (Number(addForm.macdFastPeriodText) || 12) : periodNum;
    const slowP = addForm.indicatorType === "MACD" ? (Number(addForm.macdSlowPeriodText) || 26) : periodNum;
    setAddForm((prev) => ({ ...prev, period: periodNum, periodText: String(periodNum) }));
    const effectivePanel: IndicatorPanel = addForm.indicatorType === "RSI" || addForm.indicatorType === "MACD"
      ? (addForm.chartOption === "panel2" || addForm.chartOption === "panel3" || addForm.chartOption === "panel4" ? addForm.chartOption : "panel2")
      : (addForm.chartOption === "panel2" && !panelsWithSecondary.panel2) || (addForm.chartOption === "panel3" && !panelsWithSecondary.panel3) || (addForm.chartOption === "panel4" && !panelsWithSecondary.panel4)
        ? "main"
        : (addForm.chartOption === "panel2" || addForm.chartOption === "panel3" || addForm.chartOption === "panel4" ? addForm.chartOption : "main");
    addIndicator({
      type: addForm.indicatorType,
      period: addForm.indicatorType === "MACD" ? fastP : periodNum,
      fieldKey: addForm.fieldKey,
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
    const panel = ind.panel === "main" || ind.panel === "panel2" || ind.panel === "panel3" || ind.panel === "panel4" ? ind.panel : (ind.type === "RSI" || ind.type === "MACD" ? "panel2" : "main");
    const fastP = ind.type === "MACD" ? (ind.macdFastPeriod ?? 12) : ind.period;
    const slowP = ind.type === "MACD" ? (ind.macdSlowPeriod ?? 26) : ind.period;
    setEditForm({
      period: ind.period,
      periodText: String(ind.period),
      fieldKey: ind.fieldKey,
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
      fieldKey: editForm.fieldKey,
      color: editForm.color,
      panel: editForm.panel,
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
