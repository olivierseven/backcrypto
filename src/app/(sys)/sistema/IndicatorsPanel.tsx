"use client";

import { useState, useMemo } from "react";
import { useBioLang } from "@/app/contexts/BioLangContext";
import { getBioT } from "@/app/lib/translations";
import {
  useKlinesIndicators,
  type UserIndicatorConfig,
  type UserIndicatorType,
  type IndicatorPanel,
  type IndicatorFieldKey,
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

/** Re-export para quem importa de IndicatorsPanel (ex.: KlinesTable). */
export { getIndicatorLabel, getIndicatorLabelShort } from "./indicatorsPanel/index";

interface IndicatorsPanelProps {
  onClose?: () => void;
}

export default function IndicatorsPanel({ onClose }: IndicatorsPanelProps) {
  const lang = useBioLang();
  const t = getBioT(lang).sistema.klines;
  const { userIndicators, currentGroupMinutes, showIndicatorLastValueOnYAxis, setShowIndicatorLastValueOnYAxis, addIndicator, removeIndicator, updateIndicator, updateIndicatorIntervals } = useKlinesIndicators();

  const [indicatorType, setIndicatorType] = useState<UserIndicatorType>("SMA");
  const [period, setPeriod] = useState(7);
  const [periodText, setPeriodText] = useState("7");
  const [fieldKey, setFieldKey] = useState<IndicatorFieldKey>("close");
  const [color, setColor] = useState(INDICATOR_COLOR_PALETTE[7] ?? "#3b82f6");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [chartOption, setChartOption] = useState<IndicatorPanel>("main");
  const [lineWidth, setLineWidth] = useState<IndicatorLineWidth>("normal");
  const [lineStyle, setLineStyle] = useState<IndicatorLineStyle>("solid");
  const [rsiFixedScale, setRsiFixedScale] = useState(true);
  const [rsiCenterLine, setRsiCenterLine] = useState(false);
  const [rsiCenterLineColor, setRsiCenterLineColor] = useState("#71717a");
  const [rsiCenterLineWidth, setRsiCenterLineWidth] = useState<IndicatorLineWidth>("normal");
  const [rsiCenterLineStyle, setRsiCenterLineStyle] = useState<IndicatorLineStyle>("dotted");
  const [rsiLimits, setRsiLimits] = useState(false);
  const [rsiLimitUpper, setRsiLimitUpper] = useState(90);
  const [rsiLimitLower, setRsiLimitLower] = useState(10);
  const [rsiLimitColor, setRsiLimitColor] = useState("#dc2626");
  const [rsiLimitLineWidth, setRsiLimitLineWidth] = useState<IndicatorLineWidth>("normal");
  const [rsiLimitLineStyle, setRsiLimitLineStyle] = useState<IndicatorLineStyle>("dotted");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    period: number;
    periodText: string;
    fieldKey: IndicatorFieldKey;
    color: string;
    panel: IndicatorPanel;
    lineWidth: IndicatorLineWidth;
    lineStyle: IndicatorLineStyle;
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

  const getPanel = (i: UserIndicatorConfig) => i.panel ?? (i.type === "RSI" ? "panel2" : "main");

  /** Panéis que já têm indicador secundário (ex.: RSI) — médias móveis só fazem sentido nesses painéis. */
  const panelsWithSecondary = useMemo(() => {
    return {
      panel2: userIndicators.some((i) => getPanel(i) === "panel2" && i.type === "RSI"),
      panel3: userIndicators.some((i) => getPanel(i) === "panel3" && i.type === "RSI"),
      panel4: userIndicators.some((i) => getPanel(i) === "panel4" && i.type === "RSI"),
    };
  }, [userIndicators]);

  /** Para RSI no add: painéis livres (sem outro secundário). Um secundário não pode ocupar o mesmo panel que outro. */
  const panelsFreeForSecondary = useMemo(() => ({
    panel2: !panelsWithSecondary.panel2,
    panel3: !panelsWithSecondary.panel3,
    panel4: !panelsWithSecondary.panel4,
  }), [panelsWithSecondary]);

  /** Para RSI no edit: painel disponível se estiver livre ou se o único ocupante é o indicador que estamos editando. */
  const panelsFreeForSecondaryEdit = useMemo(() => {
    if (!editingId) return { panel2: true, panel3: true, panel4: true };
    return {
      panel2: !userIndicators.some((i) => getPanel(i) === "panel2" && i.type === "RSI" && i.id !== editingId),
      panel3: !userIndicators.some((i) => getPanel(i) === "panel3" && i.type === "RSI" && i.id !== editingId),
      panel4: !userIndicators.some((i) => getPanel(i) === "panel4" && i.type === "RSI" && i.id !== editingId),
    };
  }, [userIndicators, editingId]);

  const {
    fieldOptions,
    firstEnabledFieldValue,
    firstEnabledFieldValueForAdd,
    fieldOptionsVisibleForAdd,
    isMovingAverageType: isMA,
  } = useIndicatorsPanelFields({
    userIndicators,
    editingId,
    indicatorType,
    t,
    fieldKey,
    editForm,
    setFieldKey,
    setEditForm,
  });
  const isMovingAverageType = isMA;

  const rsiNoPanelFree = indicatorType === "RSI" && !panelsFreeForSecondary.panel2 && !panelsFreeForSecondary.panel3 && !panelsFreeForSecondary.panel4;
  const addButtonDisabled = rsiNoPanelFree;

  const handleAdd = () => {
    if (addButtonDisabled) return;
    const n = Number(periodText);
    const periodNum = Number.isFinite(n) && n > 0
      ? Math.max(1, Math.min(500, Math.round(n)))
      : Math.max(1, Math.min(500, Math.round(period)));
    setPeriod(periodNum);
    setPeriodText(String(periodNum));
    const effectivePanel: IndicatorPanel = indicatorType === "RSI"
      ? (["panel2", "panel3", "panel4"] as const).filter((p) => p === "panel2" ? panelsFreeForSecondary.panel2 : p === "panel3" ? panelsFreeForSecondary.panel3 : panelsFreeForSecondary.panel4).includes(chartOption as "panel2" | "panel3" | "panel4")
        ? chartOption
        : ((["panel2", "panel3", "panel4"] as const).find((p) => p === "panel2" ? panelsFreeForSecondary.panel2 : p === "panel3" ? panelsFreeForSecondary.panel3 : panelsFreeForSecondary.panel4) ?? "panel2")
      : (chartOption === "panel2" && !panelsWithSecondary.panel2) || (chartOption === "panel3" && !panelsWithSecondary.panel3) || (chartOption === "panel4" && !panelsWithSecondary.panel4)
        ? "main"
        : (chartOption === "panel2" || chartOption === "panel3" || chartOption === "panel4" ? chartOption : "main");
    addIndicator({
      type: indicatorType,
      period: periodNum,
      fieldKey,
      color,
      intervals: currentGroupMinutes != null ? [currentGroupMinutes] : [],
      panel: effectivePanel,
      lineWidth,
      lineStyle,
      ...(indicatorType === "RSI" ? { rsiFixedScale, rsiCenterLine, rsiCenterLineColor, rsiCenterLineWidth, rsiCenterLineStyle, rsiLimits, rsiLimitUpper, rsiLimitLower, rsiLimitColor, rsiLimitLineWidth, rsiLimitLineStyle } : {}),
    });
  };

  const toggleInterval = (id: string, groupMinutes: number) => {
    const ind = userIndicators.find((u) => u.id === id);
    if (!ind) return;
    const current = ind.intervals.length === 0
      ? INTERVAL_OPTIONS.map((o) => o.value)
      : [...ind.intervals];
    const idx = current.indexOf(groupMinutes);
    let next: number[];
    if (idx >= 0) {
      next = current.filter((v) => v !== groupMinutes);
      if (next.length === 0) next = []; // all
    } else {
      next = [...current, groupMinutes].sort((a, b) => a - b);
    }
    updateIndicatorIntervals(id, next);
  };

  const setAllIntervals = (id: string) => {
    updateIndicatorIntervals(id, []);
  };

  const isIntervalChecked = (ind: UserIndicatorConfig, value: number) => {
    if (ind.intervals.length === 0) return true;
    return ind.intervals.includes(value);
  };

  const startEdit = (ind: UserIndicatorConfig) => {
    setEditingId(ind.id);
    const panel = ind.panel === "main" || ind.panel === "panel2" || ind.panel === "panel3" || ind.panel === "panel4"
      ? ind.panel
      : (ind.type === "RSI" ? "panel2" : "main");
    setEditForm({
      period: ind.period,
      periodText: String(ind.period),
      fieldKey: ind.fieldKey,
      color: ind.color,
      panel,
      lineWidth: (ind.lineWidth === "thin" || ind.lineWidth === "normal" ? ind.lineWidth : "normal") as IndicatorLineWidth,
      lineStyle: (ind.lineStyle === "solid" || ind.lineStyle === "dotted" || ind.lineStyle === "dashed" ? ind.lineStyle : "solid") as IndicatorLineStyle,
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
  };

  const saveEdit = () => {
    if (!editingId || !editForm) return;
    const ind = userIndicators.find((u) => u.id === editingId);
    const periodNum = (() => {
      const n = Number(editForm.periodText);
      return Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : editForm.period;
    })();
    updateIndicator(editingId, {
      period: periodNum,
      fieldKey: editForm.fieldKey,
      color: editForm.color,
      panel: editForm.panel,
      lineWidth: editForm.lineWidth,
      lineStyle: editForm.lineStyle,
      ...(ind?.type === "RSI" ? { rsiFixedScale: editForm.rsiFixedScale, rsiCenterLine: editForm.rsiCenterLine, rsiCenterLineColor: editForm.rsiCenterLineColor, rsiCenterLineWidth: editForm.rsiCenterLineWidth, rsiCenterLineStyle: editForm.rsiCenterLineStyle, rsiLimits: editForm.rsiLimits, rsiLimitUpper: editForm.rsiLimitUpper, rsiLimitLower: editForm.rsiLimitLower, rsiLimitColor: editForm.rsiLimitColor, rsiLimitLineWidth: editForm.rsiLimitLineWidth, rsiLimitLineStyle: editForm.rsiLimitLineStyle } : {}),
    });
    setEditingId(null);
    setEditForm(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  return (
    <div
      className="fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-zinc-200 shadow-xl overflow-hidden w-[66.666vw] sm:w-[33.333vw] max-w-[400px]"
      role="dialog"
      aria-label={t.indicatorsPanelTitle}
    >
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-zinc-50">
        <h2 className="text-sm font-semibold text-zinc-800">{t.indicatorsPanelTitle}</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-200 text-zinc-600"
            aria-label="Close"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-4">
        <label className="flex items-center gap-2 cursor-pointer px-1 py-2 rounded hover:bg-zinc-50 text-sm text-zinc-700 border-b border-zinc-100">
          <input
            type="checkbox"
            checked={showIndicatorLastValueOnYAxis}
            onChange={(e) => setShowIndicatorLastValueOnYAxis(e.target.checked)}
            className="rounded border-zinc-300"
          />
          <span>{(t as Record<string, string>).showIndicatorLastValueOnYAxis ?? "Valores dos indicadores no eixo Y"}</span>
        </label>
        {/* Panel 1: opção do gráfico + form indicador */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.chartOption}</span>
            <select
              value={
                indicatorType === "RSI"
                  ? rsiNoPanelFree
                    ? ""
                    : ((["panel2", "panel3", "panel4"] as const).filter((p) => p === "panel2" ? panelsFreeForSecondary.panel2 : p === "panel3" ? panelsFreeForSecondary.panel3 : panelsFreeForSecondary.panel4).includes(chartOption as "panel2" | "panel3" | "panel4")
                      ? chartOption
                      : ((["panel2", "panel3", "panel4"] as const).find((p) => p === "panel2" ? panelsFreeForSecondary.panel2 : p === "panel3" ? panelsFreeForSecondary.panel3 : panelsFreeForSecondary.panel4) ?? "panel2"))
                  : (chartOption === "panel2" && !panelsWithSecondary.panel2) || (chartOption === "panel3" && !panelsWithSecondary.panel3) || (chartOption === "panel4" && !panelsWithSecondary.panel4)
                    ? "main"
                    : chartOption
              }
              onChange={(e) => setChartOption(e.target.value as IndicatorPanel)}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
              aria-label={t.chartOption}
            >
              {indicatorType === "RSI" ? (
                <>
                  {rsiNoPanelFree ? (
                    <option value="">{(t as Record<string, string>).chartOptionNoPanelAvailable ?? "Nenhum painel disponível"}</option>
                  ) : (
                    <>
                      {panelsFreeForSecondary.panel2 && <option value="panel2">{(t as Record<string, string>).chartOptionPanel2 ?? "Panel 2"}</option>}
                      {panelsFreeForSecondary.panel3 && <option value="panel3">{(t as Record<string, string>).chartOptionPanel3 ?? "Panel 3"}</option>}
                      {panelsFreeForSecondary.panel4 && <option value="panel4">{(t as Record<string, string>).chartOptionPanel4 ?? "Panel 4"}</option>}
                    </>
                  )}
                </>
              ) : (
                <>
                  <option value="main">{(t as Record<string, string>).chartOptionMain ?? "Main"}</option>
                  {panelsWithSecondary.panel2 && <option value="panel2">{(t as Record<string, string>).chartOptionPanel2 ?? "Panel 2"}</option>}
                  {panelsWithSecondary.panel3 && <option value="panel3">{(t as Record<string, string>).chartOptionPanel3 ?? "Panel 3"}</option>}
                  {panelsWithSecondary.panel4 && <option value="panel4">{(t as Record<string, string>).chartOptionPanel4 ?? "Panel 4"}</option>}
                </>
              )}
            </select>
          </div>

          {indicatorType === "RSI" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rsiFixedScale}
                onChange={(e) => setRsiFixedScale(e.target.checked)}
                className="rounded border-zinc-300"
              />
              <span className="text-xs text-zinc-700">{(t as Record<string, string>).rsiFixedScaleLabel ?? "Escala fixa 0–100 no eixo Y"}</span>
            </label>
          )}

          {indicatorType === "RSI" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rsiCenterLine}
                  onChange={(e) => setRsiCenterLine(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                <span className="text-xs text-zinc-700">{(t as Record<string, string>).rsiCenterLineLabel ?? "Linha central 50%"}</span>
              </label>
              {rsiCenterLine && (
                <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                    <div className="flex flex-wrap gap-1">
                      {INDICATOR_COLOR_PALETTE.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setRsiCenterLineColor(hex)}
                          className={`w-6 h-6 rounded border shrink-0 ${rsiCenterLineColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                    <select
                      value={rsiCenterLineWidth}
                      onChange={(e) => setRsiCenterLineWidth(e.target.value as IndicatorLineWidth)}
                      className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
                    >
                      <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Thin"}</option>
                      <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                    <select
                      value={rsiCenterLineStyle}
                      onChange={(e) => setRsiCenterLineStyle(e.target.value as IndicatorLineStyle)}
                      className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
                    >
                      <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Solid"}</option>
                      <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Dotted"}</option>
                      <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Dashed"}</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          {indicatorType === "RSI" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rsiLimits}
                  onChange={(e) => setRsiLimits(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                <span className="text-xs text-zinc-700">{(t as Record<string, string>).rsiLimitsLabel ?? "Limites superior e inferior"}</span>
              </label>
              {rsiLimits && (
                <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).rsiLimitUpperLabel ?? "Superior %"}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setRsiLimitUpper((v) => Math.max(0, Math.min(100, v - 1)))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                      <span className="w-10 text-center text-sm tabular-nums">{rsiLimitUpper}</span>
                      <button type="button" onClick={() => setRsiLimitUpper((v) => Math.max(0, Math.min(100, v + 1)))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).rsiLimitLowerLabel ?? "Inferior %"}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setRsiLimitLower((v) => Math.max(0, Math.min(100, v - 1)))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                      <span className="w-10 text-center text-sm tabular-nums">{rsiLimitLower}</span>
                      <button type="button" onClick={() => setRsiLimitLower((v) => Math.max(0, Math.min(100, v + 1)))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                    <div className="flex flex-wrap gap-1">
                      {INDICATOR_COLOR_PALETTE.map((hex) => (
                        <button key={hex} type="button" onClick={() => setRsiLimitColor(hex)} className={`w-6 h-6 rounded border shrink-0 ${rsiLimitColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                    <select value={rsiLimitLineWidth} onChange={(e) => setRsiLimitLineWidth(e.target.value as IndicatorLineWidth)} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                      <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Thin"}</option>
                      <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                    <select value={rsiLimitLineStyle} onChange={(e) => setRsiLimitLineStyle(e.target.value as IndicatorLineStyle)} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                      <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Solid"}</option>
                      <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Dotted"}</option>
                      <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Dashed"}</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.indicatorType}</span>
            <select
              value={indicatorType}
              onChange={(e) => {
                const newType = e.target.value as UserIndicatorType;
                setIndicatorType(newType);
                if (newType === "RSI") {
                  setPeriod(14);
                  setPeriodText("14");
                  setChartOption("panel2");
                  setRsiFixedScale(true);
                  setRsiCenterLine(false);
                  setRsiCenterLineColor("#71717a");
                  setRsiCenterLineWidth("normal");
                  setRsiCenterLineStyle("dotted");
                  setRsiLimits(false);
                  setRsiLimitUpper(90);
                  setRsiLimitLower(10);
                  setRsiLimitColor("#dc2626");
                  setRsiLimitLineWidth("normal");
                  setRsiLimitLineStyle("dotted");
                }
              }}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
              aria-label={t.indicatorType}
            >
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
              <option value="WMA">WMA</option>
              <option value="RSI">RSI</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.period}</span>
            <div className="flex-1 min-w-0 flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const next = Math.max(1, Math.min(500, Math.round((period ?? 7) - 1)));
                  setPeriod(next);
                  setPeriodText(String(next));
                }}
                className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                aria-label="-"
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={periodText}
                onFocus={(e) => {
                  // Em mobile, ajuda a selecionar tudo para digitar por cima (capturar ref: currentTarget é null no microtask)
                  const el = e.currentTarget;
                  queueMicrotask(() => el?.select());
                }}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, "");
                  setPeriodText(raw);
                }}
                onBlur={() => {
                  const n = Number(periodText);
                  const next = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 7;
                  setPeriod(next);
                  setPeriodText(String(next));
                }}
                className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5"
                aria-label={t.period}
              />
              <button
                type="button"
                onClick={() => {
                  const next = Math.max(1, Math.min(500, Math.round((period ?? 7) + 1)));
                  setPeriod(next);
                  setPeriodText(String(next));
                }}
                className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                aria-label="+"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.field}</span>
            <select
              value={(fieldOptionsVisibleForAdd.some((o) => o.value === fieldKey) ? fieldKey : firstEnabledFieldValueForAdd) as string}
              onChange={(e) => {
                const newKey = e.target.value as IndicatorFieldKey;
                setFieldKey(newKey);
                if (newKey.startsWith("user_")) {
                  const id = newKey.slice(5);
                  const baseInd = userIndicators.find((i) => i.id === id);
                  const p = baseInd?.panel ?? (baseInd?.type === "RSI" ? "panel2" : "main");
                  if (p === "panel2" || p === "panel3" || p === "panel4") setChartOption(p);
                }
              }}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
              aria-label={t.field}
            >
              {fieldOptionsVisibleForAdd.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 relative">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
            <button
              type="button"
              onClick={() => setColorOpen((v) => !v)}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white flex items-center justify-between gap-2"
              aria-label={t.color}
              aria-expanded={colorOpen}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-4 h-4 rounded border border-zinc-300 shrink-0" style={{ backgroundColor: color }} />
              </span>
              <span className="text-zinc-500 text-xs">▾</span>
            </button>
            {colorOpen && (
              <>
                <div className="fixed inset-0 z-30" aria-hidden onClick={() => setColorOpen(false)} />
                <div className="absolute left-[4.5rem] right-0 top-full z-40 mt-1 max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg p-2">
                  <div className="grid grid-cols-3 gap-2">
                    {INDICATOR_COLOR_PALETTE.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => { setColor(hex); setColorOpen(false); }}
                        className={`w-10 h-10 rounded border-2 ${color === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                        style={{ backgroundColor: hex }}
                        aria-label={`Color ${hex}`}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
            <select
              value={lineWidth}
              onChange={(e) => setLineWidth(e.target.value as IndicatorLineWidth)}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
              aria-label={(t as Record<string, string>).lineWidth}
            >
              <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Thin"}</option>
              <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
            <select
              value={lineStyle}
              onChange={(e) => setLineStyle(e.target.value as IndicatorLineStyle)}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
              aria-label={(t as Record<string, string>).lineStyle}
            >
              <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Solid"}</option>
              <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Dotted"}</option>
              <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Dashed"}</option>
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={addButtonDisabled}
          className="w-full py-2 rounded bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.addIndicator}
        </button>

        {/* Lista de indicadores salvos */}
        {userIndicators.length > 0 && (
          <div className="pt-3 border-t border-zinc-200 space-y-2">
            {userIndicators.map((ind) => (
              <div
                key={ind.id}
                className="rounded border border-zinc-200 p-2 space-y-1.5 bg-zinc-50/50"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded shrink-0 border border-zinc-300"
                    style={{ backgroundColor: ind.color }}
                  />
                  <span className="text-xs font-medium text-zinc-800 truncate flex-1">
                    {getIndicatorLabel(ind, t, userIndicators)}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(ind)}
                    className="text-xs text-zinc-600 hover:underline shrink-0"
                  >
                    {(t as Record<string, string>).editIndicator ?? "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeIndicator(ind.id)}
                    className="text-xs text-red-600 hover:underline shrink-0"
                  >
                    {t.removeIndicator}
                  </button>
                </div>
                <div className="text-[10px] text-zinc-500">
                  {t.showOn}:{" "}
                  {ind.intervals.length === 0
                    ? t.allIntervals
                    : ind.intervals
                        .map((v) => INTERVAL_OPTIONS.find((o) => o.value === v)?.label ?? v)
                        .join(", ")}
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === ind.id ? null : ind.id)}
                  className="text-[10px] text-zinc-600 hover:underline"
                >
                  {expandedId === ind.id ? (t as Record<string, string>).changeTimeframesHide : (t as Record<string, string>).changeTimeframesShow}
                </button>
                {expandedId === ind.id && (
                  <div className="pt-1.5 space-y-1">
                    <button
                      type="button"
                      onClick={() => setAllIntervals(ind.id)}
                      className="block text-[10px] text-zinc-600 hover:underline"
                    >
                      {t.allIntervals}
                    </button>
                    <div className="flex flex-wrap gap-1">
                      {INTERVAL_OPTIONS.map((opt) => (
                        <label key={opt.value} className="inline-flex items-center gap-1 text-[10px]">
                          <input
                            type="checkbox"
                            checked={isIntervalChecked(ind, opt.value)}
                            onChange={() => toggleInterval(ind.id, opt.value)}
                            className="rounded border-zinc-300"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {editingId === ind.id && editForm && (
                  <div className="pt-2 mt-2 border-t border-zinc-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.period}</span>
                      <div className="flex-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.max(1, Math.min(500, (editForm.period ?? 7) - 1));
                            setEditForm((f) => ({ ...f!, period: next, periodText: String(next) }));
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editForm.periodText}
                          onFocus={(e) => {
                            const el = e.currentTarget;
                            queueMicrotask(() => el?.select());
                          }}
                          onChange={(e) => setEditForm((f) => ({ ...f!, periodText: e.target.value.replace(/[^\d]/g, "") }))}
                          onBlur={() => {
                            const n = Number(editForm.periodText);
                            const next = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : editForm.period;
                            setEditForm((f) => ({ ...f!, period: next, periodText: String(next) }));
                          }}
                          className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.max(1, Math.min(500, (editForm.period ?? 7) + 1));
                            setEditForm((f) => ({ ...f!, period: next, periodText: String(next) }));
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.field}</span>
                      <select
                        value={(() => {
                          const visibleForEdit = fieldOptions.filter(
                            (o) =>
                              !o.disabled &&
                              o.optionType !== ind.type &&
                              !(o.isMovingAverage && isMovingAverageType(ind.type))
                          );
                          const firstForEdit = (visibleForEdit[0]?.value ?? firstEnabledFieldValue) as IndicatorFieldKey;
                          return (visibleForEdit.some((o) => o.value === editForm.fieldKey) ? editForm.fieldKey : firstForEdit) as string;
                        })()}
                        onChange={(e) => {
                          const newKey = e.target.value as IndicatorFieldKey;
                          setEditForm((f) => {
                            const next = { ...f!, fieldKey: newKey };
                            if (newKey.startsWith("user_")) {
                              const id = newKey.slice(5);
                              const baseInd = userIndicators.find((i) => i.id === id);
                              const p = baseInd?.panel ?? (baseInd?.type === "RSI" ? "panel2" : "main");
                              if (p === "panel2" || p === "panel3" || p === "panel4") next.panel = p;
                            }
                            return next;
                          });
                        }}
                        className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white"
                      >
                        {fieldOptions
                          .filter(
                            (o) =>
                              !o.disabled &&
                              o.optionType !== ind.type &&
                              !(o.isMovingAverage && isMovingAverageType(ind.type))
                          )
                          .map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                      <div className="flex-1 flex flex-wrap gap-1">
                        {INDICATOR_COLOR_PALETTE.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => setEditForm((f) => ({ ...f!, color: hex }))}
                            className={`w-6 h-6 rounded border shrink-0 ${editForm.color === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`}
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.chartOption}</span>
                      <select
                        value={editForm.panel}
                        onChange={(e) => setEditForm((f) => ({ ...f!, panel: e.target.value as IndicatorPanel }))}
                        className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white"
                      >
                        {ind.type === "RSI" ? (
                          <>
                            {panelsFreeForSecondaryEdit.panel2 && <option value="panel2">{(t as Record<string, string>).chartOptionPanel2 ?? "Panel 2"}</option>}
                            {panelsFreeForSecondaryEdit.panel3 && <option value="panel3">{(t as Record<string, string>).chartOptionPanel3 ?? "Panel 3"}</option>}
                            {panelsFreeForSecondaryEdit.panel4 && <option value="panel4">{(t as Record<string, string>).chartOptionPanel4 ?? "Panel 4"}</option>}
                          </>
                        ) : (
                          <>
                            <option value="main">{(t as Record<string, string>).chartOptionMain ?? "Main"}</option>
                            {(panelsWithSecondary.panel2 || editForm.panel === "panel2") && <option value="panel2">{(t as Record<string, string>).chartOptionPanel2 ?? "Panel 2"}</option>}
                            {(panelsWithSecondary.panel3 || editForm.panel === "panel3") && <option value="panel3">{(t as Record<string, string>).chartOptionPanel3 ?? "Panel 3"}</option>}
                            {(panelsWithSecondary.panel4 || editForm.panel === "panel4") && <option value="panel4">{(t as Record<string, string>).chartOptionPanel4 ?? "Panel 4"}</option>}
                          </>
                        )}
                      </select>
                    </div>
                    {ind.type === "RSI" && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.rsiFixedScale}
                          onChange={(e) => setEditForm((f) => ({ ...f!, rsiFixedScale: e.target.checked }))}
                          className="rounded border-zinc-300"
                        />
                        <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).rsiFixedScaleLabel ?? "Escala fixa 0–100 no eixo Y"}</span>
                      </label>
                    )}
                    {ind.type === "RSI" && (
                      <>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.rsiCenterLine}
                            onChange={(e) => setEditForm((f) => ({ ...f!, rsiCenterLine: e.target.checked }))}
                            className="rounded border-zinc-300"
                          />
                          <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).rsiCenterLineLabel ?? "Linha central 50%"}</span>
                        </label>
                        {editForm.rsiCenterLine && (
                          <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                              <div className="flex flex-wrap gap-1">
                                {INDICATOR_COLOR_PALETTE.map((hex) => (
                                  <button
                                    key={hex}
                                    type="button"
                                    onClick={() => setEditForm((f) => ({ ...f!, rsiCenterLineColor: hex }))}
                                    className={`w-5 h-5 rounded border shrink-0 ${editForm.rsiCenterLineColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`}
                                    style={{ backgroundColor: hex }}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                              <select
                                value={editForm.rsiCenterLineWidth}
                                onChange={(e) => setEditForm((f) => ({ ...f!, rsiCenterLineWidth: e.target.value as IndicatorLineWidth }))}
                                className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white"
                              >
                                <option value="thin">{(t as Record<string, string>).lineWidthThin}</option>
                                <option value="normal">{(t as Record<string, string>).lineWidthNormal}</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                              <select
                                value={editForm.rsiCenterLineStyle}
                                onChange={(e) => setEditForm((f) => ({ ...f!, rsiCenterLineStyle: e.target.value as IndicatorLineStyle }))}
                                className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white"
                              >
                                <option value="solid">{(t as Record<string, string>).lineStyleSolid}</option>
                                <option value="dotted">{(t as Record<string, string>).lineStyleDotted}</option>
                                <option value="dashed">{(t as Record<string, string>).lineStyleDashed}</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {ind.type === "RSI" && (
                      <>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.rsiLimits}
                            onChange={(e) => setEditForm((f) => ({ ...f!, rsiLimits: e.target.checked }))}
                            className="rounded border-zinc-300"
                          />
                          <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).rsiLimitsLabel ?? "Limites superior e inferior"}</span>
                        </label>
                        {editForm.rsiLimits && (
                          <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).rsiLimitUpperLabel ?? "Superior %"}</span>
                              <div className="flex items-center gap-0.5">
                                <button type="button" onClick={() => setEditForm((f) => ({ ...f!, rsiLimitUpper: Math.max(0, Math.min(100, (f!.rsiLimitUpper ?? 90) - 1)) }))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">−</button>
                                <span className="w-8 text-center text-xs tabular-nums">{editForm.rsiLimitUpper}</span>
                                <button type="button" onClick={() => setEditForm((f) => ({ ...f!, rsiLimitUpper: Math.max(0, Math.min(100, (f!.rsiLimitUpper ?? 90) + 1)) }))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">+</button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).rsiLimitLowerLabel ?? "Inferior %"}</span>
                              <div className="flex items-center gap-0.5">
                                <button type="button" onClick={() => setEditForm((f) => ({ ...f!, rsiLimitLower: Math.max(0, Math.min(100, (f!.rsiLimitLower ?? 10) - 1)) }))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">−</button>
                                <span className="w-8 text-center text-xs tabular-nums">{editForm.rsiLimitLower}</span>
                                <button type="button" onClick={() => setEditForm((f) => ({ ...f!, rsiLimitLower: Math.max(0, Math.min(100, (f!.rsiLimitLower ?? 10) + 1)) }))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">+</button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                              <div className="flex flex-wrap gap-1">
                                {INDICATOR_COLOR_PALETTE.map((hex) => (
                                  <button key={hex} type="button" onClick={() => setEditForm((f) => ({ ...f!, rsiLimitColor: hex }))} className={`w-5 h-5 rounded border shrink-0 ${editForm.rsiLimitColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                              <select value={editForm.rsiLimitLineWidth} onChange={(e) => setEditForm((f) => ({ ...f!, rsiLimitLineWidth: e.target.value as IndicatorLineWidth }))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                                <option value="thin">{(t as Record<string, string>).lineWidthThin}</option>
                                <option value="normal">{(t as Record<string, string>).lineWidthNormal}</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                              <select value={editForm.rsiLimitLineStyle} onChange={(e) => setEditForm((f) => ({ ...f!, rsiLimitLineStyle: e.target.value as IndicatorLineStyle }))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                                <option value="solid">{(t as Record<string, string>).lineStyleSolid}</option>
                                <option value="dotted">{(t as Record<string, string>).lineStyleDotted}</option>
                                <option value="dashed">{(t as Record<string, string>).lineStyleDashed}</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                      <select
                        value={editForm.lineWidth}
                        onChange={(e) => setEditForm((f) => ({ ...f!, lineWidth: e.target.value as IndicatorLineWidth }))}
                        className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white"
                      >
                        <option value="thin">{(t as Record<string, string>).lineWidthThin}</option>
                        <option value="normal">{(t as Record<string, string>).lineWidthNormal}</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                      <select
                        value={editForm.lineStyle}
                        onChange={(e) => setEditForm((f) => ({ ...f!, lineStyle: e.target.value as IndicatorLineStyle }))}
                        className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white"
                      >
                        <option value="solid">{(t as Record<string, string>).lineStyleSolid}</option>
                        <option value="dotted">{(t as Record<string, string>).lineStyleDotted}</option>
                        <option value="dashed">{(t as Record<string, string>).lineStyleDashed}</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="flex-1 py-1.5 rounded bg-zinc-800 text-white text-xs font-medium"
                      >
                        {(t as Record<string, string>).saveIndicator ?? "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="flex-1 py-1.5 rounded border border-zinc-300 text-zinc-700 text-xs font-medium"
                      >
                        {(t as Record<string, string>).cancel ?? "Cancel"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
