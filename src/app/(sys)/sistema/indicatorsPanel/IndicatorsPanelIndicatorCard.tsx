"use client";

import { useState, useMemo } from "react";
import type { UserIndicatorConfig, Wma2TimeUnit, IndicatorPanel, IndicatorFieldKey, IndicatorLineWidth, IndicatorLineStyle } from "../KlinesIndicatorsContext";
import { Combobox, type ComboboxOption } from "../components/Combobox";
import { ColorPaletteCombobox } from "../components/ColorPaletteCombobox";
import { StepperButton } from "../components/StepperButton";
import { useIndicatorsPanelContext } from "./IndicatorsPanelContext";
import {
  clampMa2TimeWindowUserValue,
  defaultMa2TimeValueForUnit,
  isTimeWindowMa2Type,
  MA2_MAX_WINDOW_VALUE,
  normalizeMa2TimeValueForUnit,
} from "./wma2Period";
import { normalizeHmaCustomPeriods } from "@/app/api/binance/klines/indicators";
import {
  ALL_INDICATOR_INTERVAL_VALUES,
  applyIntervalGroupToggle,
  INDICATOR_INTERVAL_GROUPS,
} from "./aggIntervalOptions";
import type { EditFormState } from "./indicatorsPanelTypes";

interface IndicatorsPanelIndicatorCardProps {
  ind: UserIndicatorConfig;
}

export function IndicatorsPanelIndicatorCard({ ind }: IndicatorsPanelIndicatorCardProps) {
  const {
    t,
    userIndicators,
    fieldOptions,
    firstEnabledFieldValue,
    panelsWithSecondary,
    panelsFreeForSecondaryEdit,
    indicatorCountByPanel,
    isFreeUser,
    MAIN_MAX_INDICATORS,
    SECONDARY_MAX_INDICATORS,
    isMovingAverageType,
    INDICATOR_COLOR_PALETTE,
    INTERVAL_OPTIONS,
    getIndicatorIntervalLabel,
    editingId,
    editForm,
    setEditForm,
    startEdit,
    saveEdit,
    cancelEdit,
    removeIndicator,
    getIndicatorLabel,
    updateIndicator,
  } = useIndicatorsPanelContext();

  const visibleForEdit = fieldOptions.filter(
    (o) => {
      if (o.disabled || o.optionType === ind.type || (o.isMovingAverage && isMovingAverageType(ind.type))) return false;
      if (ind.type === "WilliamsR") return o.value === "open" || o.value === "close";
      return true;
    }
  );
  const firstForEdit = (visibleForEdit[0]?.value ?? (ind.type === "WilliamsR" ? "close" : firstEnabledFieldValue)) as IndicatorFieldKey;
  const editFieldValue = (visibleForEdit.some((o) => o.value === editForm?.fieldKey) ? editForm!.fieldKey : firstForEdit) as string;

  const panel = ind.panel ?? (ind.type === "RSI" || ind.type === "MFI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "AD" || ind.type === "ATR" || ind.type === "ADX" || ind.type === "CCI" || ind.type === "CMF" || ind.type === "Volume" ? "panel2" : "main");
  const panelNum = panel === "panel2" ? "2" : panel === "panel3" ? "3" : panel === "panel4" ? "4" : panel === "panel5" ? "5" : null;

  const tRecord = t as Record<string, string>;
  const lineWidthOptions: ComboboxOption[] = useMemo(() => [
    { value: "thin", label: tRecord.lineWidthThin ?? "Fino" },
    { value: "normal", label: tRecord.lineWidthNormal ?? "Normal" },
    { value: "thick", label: tRecord.lineWidthThick ?? "Grossa" },
  ], [tRecord]);
  const lineStyleOptions: ComboboxOption[] = useMemo(() => [
    { value: "solid", label: tRecord.lineStyleSolid ?? "Sólido" },
    { value: "dotted", label: tRecord.lineStyleDotted ?? "Pontilhado" },
    { value: "dashed", label: tRecord.lineStyleDashed ?? "Tracejado" },
  ], [tRecord]);
  const maTypeOptions: ComboboxOption[] = useMemo(() => [
    { value: "SMA", label: "SMA" },
    { value: "EMA", label: "EMA" },
    { value: "WMA", label: "WMA" },
  ], []);
  const macdMaTypeOptions: ComboboxOption[] = useMemo(
    () => [
      { value: "SMA", label: "SMA" },
      { value: "EMA", label: "EMA" },
      { value: "WMA", label: "WMA" },
      { value: "LINEAR_FIT", label: tRecord.linearFitLabel ?? "Ajuste linear" },
      { value: "QUADRATIC_FIT", label: tRecord.quadraticFitLabel ?? "Ajuste quadrático" },
    ],
    [tRecord]
  );
  const hmaCustomLegMaTypeOptions: ComboboxOption[] = macdMaTypeOptions;
  const wma2UnitOptions: ComboboxOption[] = useMemo(
    () => [
      { value: "days", label: tRecord.wma2TimeUnitDays ?? "Days" },
      { value: "hours", label: tRecord.wma2TimeUnitHours ?? "Hours" },
      { value: "minutes", label: tRecord.wma2TimeUnitMinutes ?? "Minutes" },
    ],
    [tRecord]
  );
  const editPanelOptions: ComboboxOption[] = useMemo(() => {
    const p2 = tRecord.chartOptionPanel2 ?? "Panel 2";
    const p3 = tRecord.chartOptionPanel3 ?? "Panel 3";
    const p4 = tRecord.chartOptionPanel4 ?? "Panel 4";
    const p5 = tRecord.chartOptionPanel5 ?? "Panel 5";
    const main = tRecord.chartOptionMain ?? "Main";
    if (ind.type === "RSI" || ind.type === "MFI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "AD" || ind.type === "ATR" || ind.type === "ADX" || ind.type === "CCI" || ind.type === "CMF" || ind.type === "Volume") {
      const opts: ComboboxOption[] = [];
      if (panelsFreeForSecondaryEdit.panel2) opts.push({ value: "panel2", label: p2 });
      if (panelsFreeForSecondaryEdit.panel3) opts.push({ value: "panel3", label: p3 });
      if (panelsFreeForSecondaryEdit.panel4) opts.push({ value: "panel4", label: p4 });
      if (panelsFreeForSecondaryEdit.panel5) opts.push({ value: "panel5", label: p5 });
      return opts;
    }
    return [
      { value: "main", label: main, disabled: indicatorCountByPanel.main >= MAIN_MAX_INDICATORS && editForm?.panel !== "main" },
      { value: "panel2", label: p2, disabled: indicatorCountByPanel.panel2 >= SECONDARY_MAX_INDICATORS && editForm?.panel !== "panel2" },
      { value: "panel3", label: (isFreeUser ? "🔒 " : "") + p3, disabled: (indicatorCountByPanel.panel3 >= SECONDARY_MAX_INDICATORS && editForm?.panel !== "panel3") || isFreeUser },
      { value: "panel4", label: (isFreeUser ? "🔒 " : "") + p4, disabled: (indicatorCountByPanel.panel4 >= SECONDARY_MAX_INDICATORS && editForm?.panel !== "panel4") || isFreeUser },
      { value: "panel5", label: (isFreeUser ? "🔒 " : "") + p5, disabled: (indicatorCountByPanel.panel5 >= SECONDARY_MAX_INDICATORS && editForm?.panel !== "panel5") || isFreeUser },
    ];
  }, [ind.type, indicatorCountByPanel, panelsFreeForSecondaryEdit, isFreeUser, editForm?.panel, tRecord]);
  const volumeSourceOptions: ComboboxOption[] = useMemo(() => [
    { value: "base", label: tRecord.volumeBaseLabel ?? "Vol (base)" },
    { value: "usdt", label: tRecord.volumeUsdtLabel ?? "Vol (USDT)" },
  ], [tRecord]);

  return (
    <div className="rounded border border-zinc-200 p-2 space-y-1.5 bg-zinc-50/50">
      <div className="flex items-center gap-2">
        <span
          className="w-4 h-4 rounded shrink-0 border border-zinc-300"
          style={{
            backgroundColor:
              ind.type === "Ichimoku"
                ? (ind.ichimokuTenkanColor ?? ind.color)
                : ind.type === "Keltner"
                  ? (ind.keltnerLimitsColor ?? ind.color)
                  : ind.type === "Bollinger"
                    ? (ind.bollingerLimitsColor ?? ind.color)
                    : ind.type === "Donchian"
                      ? (ind.donchianLimitsColor ?? ind.color)
                      : ind.color,
          }}
        />
        <span className="text-xs font-medium text-zinc-800 truncate flex-1">
          {panelNum != null && <span className="text-zinc-500">({panelNum}) </span>}
          {getIndicatorLabel(ind, t, userIndicators)}
        </span>
        <button type="button" onClick={() => startEdit(ind)} className="text-xs text-zinc-600 hover:underline shrink-0">
          {(t as Record<string, string>).editIndicator ?? "Edit"}
        </button>
        <button type="button" onClick={() => removeIndicator(ind.id)} className="text-xs text-red-600 hover:underline shrink-0">
          {t.removeIndicator}
        </button>
      </div>
      <div className="text-[10px] text-zinc-600">
        {(t as Record<string, string>).showIndicatorLastValueOnYAxis ?? "Valor no eixo Y"}: {ind.showLastValueOnYAxis !== false ? (t as Record<string, string>).yes ?? "Sim" : (t as Record<string, string>).no ?? "Não"}
      </div>
      <div className="text-[10px] text-zinc-500">
        {t.showOn}:{" "}
        {ind.intervals.length === 0
          ? t.allIntervals
          : ind.intervals.length === 1 && ind.intervals[0] === 0
            ? (t as Record<string, string>).noIntervals ?? "Nenhum"
            : ind.intervals.map((v) => getIndicatorIntervalLabel(v)).join(", ")}
      </div>
      {editingId === ind.id && editForm && (
        <div className="pt-2 mt-2 border-t border-zinc-200 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-[10px] text-zinc-600">
            <input
              type="checkbox"
              checked={editForm.showLastValueOnYAxis !== false}
              onChange={(e) => setEditForm((f) => (f ? { ...f, showLastValueOnYAxis: e.target.checked } : f))}
              className="rounded border-zinc-300"
            />
            <span>{(t as Record<string, string>).showIndicatorLastValueOnYAxis ?? "Valor no eixo Y"}</span>
          </label>
          <>
            <div className="text-[10px] font-medium text-zinc-600">{t.showOn}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, intervals: [] } : f))} className="text-[10px] text-zinc-600 hover:underline">
                {t.allIntervals}
              </button>
              <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, intervals: [0] } : f))} className="text-[10px] text-zinc-600 hover:underline">
                {(t as Record<string, string>).noIntervals ?? "Nenhum"}
              </button>
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-0.5">
              {INDICATOR_INTERVAL_GROUPS.map((group) => (
                <div key={group.titleKey} className="space-y-1 border-b border-zinc-100 pb-2 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[10px] font-medium text-zinc-700">
                      {tRecord[group.titleKey] ?? group.titleKey}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditForm((f) => {
                          if (!f) return f;
                          const fi = f.intervals ?? [];
                          const fIsNone = fi.length === 1 && fi[0] === 0;
                          const fIsAll = fi.length === 0;
                          const expanded = fIsNone ? [] : fIsAll ? [...ALL_INDICATOR_INTERVAL_VALUES] : [...fi].filter((x) => x !== 0);
                          const gv = group.options.map((o) => o.value);
                          const next = applyIntervalGroupToggle(expanded, gv);
                          return { ...f, intervals: next };
                        });
                      }}
                      className="text-[10px] text-zinc-600 hover:underline"
                    >
                      {tRecord.indicatorIntervalsAllInGroup ?? "Todos deste grupo"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.options.map((opt) => {
                      const formIntervals = editForm.intervals ?? [];
                      const isNone = formIntervals.length === 1 && formIntervals[0] === 0;
                      const isAll = formIntervals.length === 0;
                      const checked = isAll || (!isNone && formIntervals.includes(opt.value));
                      return (
                        <label key={`${group.titleKey}-${opt.value}`} className="inline-flex items-center gap-1 text-[10px]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setEditForm((f) => {
                                if (!f) return f;
                                const fi = f.intervals ?? [];
                                const fIsNone = fi.length === 1 && fi[0] === 0;
                                const fIsAll = fi.length === 0;
                                const current = fIsNone ? [] : fIsAll ? [...ALL_INDICATOR_INTERVAL_VALUES] : [...fi].filter((x) => x !== 0);
                                const next = current.includes(opt.value)
                                  ? current.filter((x) => x !== opt.value)
                                  : [...current, opt.value].sort((a, b) => a - b);
                                return { ...f, intervals: next.length === 0 ? [0] : next };
                              });
                            }}
                            className="rounded border-zinc-300"
                          />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.chartOption}</span>
            {ind.type === "SAR" || ind.type === "VWAP" || ind.type === "Keltner" || ind.type === "Donchian" || ind.type === "HMA" || ind.type === "HMA_CUSTOM" || ind.type === "VWMA" || ind.type === "LINEAR_FIT" || ind.type === "QUADRATIC_FIT" || ind.type === "Ichimoku" ? (
              <span className="text-xs text-zinc-700">{(t as Record<string, string>).chartOptionMain ?? "Main"}</span>
            ) : (
              <Combobox value={editForm.panel} onChange={(v) => setEditForm((f) => (f ? { ...f, panel: v as IndicatorPanel } : f))} options={editPanelOptions} className="flex-1 min-w-0" size="md" aria-label={t.chartOption} />
            )}
          </div>
          {ind.type === "MACD" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdFastMa ?? "Média rápida"}</span>
                <Combobox value={editForm.macdFastMaType} onChange={(v) => setEditForm((f) => (f ? { ...f, macdFastMaType: v as EditFormState["macdFastMaType"] } : f))} options={macdMaTypeOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.macdFastMa ?? "MA"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdFastPeriod ?? "Período rápido"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, macdFastPeriod: Math.max(1, f.macdFastPeriod - 1), macdFastPeriodText: String(Math.max(1, f.macdFastPeriod - 1)) } : f))} className="stepper-btn">−</StepperButton>
                  <input type="text" inputMode="numeric" value={editForm.macdFastPeriodText} onChange={(e) => setEditForm((f) => (f ? { ...f, macdFastPeriodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.macdFastPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 12; setEditForm((f) => (f ? { ...f, macdFastPeriod: v, macdFastPeriodText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1" />
                  <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, macdFastPeriod: Math.min(500, f.macdFastPeriod + 1), macdFastPeriodText: String(Math.min(500, f.macdFastPeriod + 1)) } : f))} className="stepper-btn">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdSlowMa ?? "Média lenta"}</span>
                <Combobox value={editForm.macdSlowMaType} onChange={(v) => setEditForm((f) => (f ? { ...f, macdSlowMaType: v as EditFormState["macdSlowMaType"] } : f))} options={macdMaTypeOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.macdSlowMa ?? "MA"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdSlowPeriod ?? "Período lento"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, macdSlowPeriod: Math.max(1, f.macdSlowPeriod - 1), macdSlowPeriodText: String(Math.max(1, f.macdSlowPeriod - 1)) } : f))} className="stepper-btn">−</StepperButton>
                  <input type="text" inputMode="numeric" value={editForm.macdSlowPeriodText} onChange={(e) => setEditForm((f) => (f ? { ...f, macdSlowPeriodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.macdSlowPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 26; setEditForm((f) => (f ? { ...f, macdSlowPeriod: v, macdSlowPeriodText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1" />
                  <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, macdSlowPeriod: Math.min(500, f.macdSlowPeriod + 1), macdSlowPeriodText: String(Math.min(500, f.macdSlowPeriod + 1)) } : f))} className="stepper-btn">+</StepperButton>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.macdSignalLine} onChange={(e) => setEditForm((f) => (f ? { ...f, macdSignalLine: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).macdSignalLineLabel ?? "Linha de sinal"}</span>
              </label>
              {editForm.macdSignalLine && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdSignalMa ?? "MA sinal"}</span>
                    <Combobox value={editForm.macdSignalMaType} onChange={(v) => setEditForm((f) => (f ? { ...f, macdSignalMaType: v as EditFormState["macdSignalMaType"] } : f))} options={macdMaTypeOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.macdSignalMa ?? "MA"} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdSignalPeriod ?? "Período sinal"}</span>
                    <div className="flex items-center gap-1">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, macdSignalPeriod: Math.max(1, f.macdSignalPeriod - 1), macdSignalPeriodText: String(Math.max(1, f.macdSignalPeriod - 1)) } : f))} className="stepper-btn">−</StepperButton>
                      <input type="text" inputMode="numeric" value={editForm.macdSignalPeriodText} onChange={(e) => setEditForm((f) => (f ? { ...f, macdSignalPeriodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.macdSignalPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 9; setEditForm((f) => (f ? { ...f, macdSignalPeriod: v, macdSignalPeriodText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1" />
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, macdSignalPeriod: Math.min(500, f.macdSignalPeriod + 1), macdSignalPeriodText: String(Math.min(500, f.macdSignalPeriod + 1)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <ColorPaletteCombobox value={editForm.macdSignalColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, macdSignalColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                    <Combobox value={editForm.macdSignalLineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, macdSignalLineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                    <Combobox value={editForm.macdSignalLineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, macdSignalLineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle} />
                  </div>
                </div>
              )}
              <label className={`flex items-center gap-2 ${editForm.macdSignalLine ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                <input type="checkbox" checked={editForm.macdHistogram} disabled={!editForm.macdSignalLine} onChange={(e) => setEditForm((f) => (f ? { ...f, macdHistogram: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).macdHistogramLabel ?? "MACD (histograma)"}</span>
              </label>
              {editForm.macdSignalLine && editForm.macdHistogram && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdHistogramColorAbove ?? "Cor acima de 0"}</span>
                    <ColorPaletteCombobox value={editForm.macdHistogramColorAbove} onChange={(hex) => setEditForm((f) => (f ? { ...f, macdHistogramColorAbove: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).macdHistogramColorAbove ?? "Cor acima"} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo de 0"}</span>
                    <ColorPaletteCombobox value={editForm.macdHistogramColorBelow} onChange={(hex) => setEditForm((f) => (f ? { ...f, macdHistogramColorBelow: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo"} />
                  </div>
                </div>
              )}
            </>
          ) : ind.type === "Bollinger" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.field}</span>
                <Combobox value={editForm.fieldKey} onChange={(v) => setEditForm((f) => (f ? { ...f, fieldKey: v as IndicatorFieldKey } : f))} options={visibleForEdit.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))} className="flex-1 min-w-0" size="md" aria-label={t.field} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.period}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, period: Math.max(1, f.period - 1), periodText: String(Math.max(1, f.period - 1)) } : f))} className="stepper-btn">−</StepperButton>
                  <input type="text" inputMode="numeric" value={editForm.periodText} onChange={(e) => setEditForm((f) => (f ? { ...f, periodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.periodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 20; setEditForm((f) => (f ? { ...f, period: v, periodText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1" />
                  <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, period: Math.min(500, f.period + 1), periodText: String(Math.min(500, f.period + 1)) } : f))} className="stepper-btn">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).bollingerMaType ?? "Média móvel"}</span>
                <Combobox value={editForm.bollingerMaType} onChange={(v) => setEditForm((f) => (f ? { ...f, bollingerMaType: v as "SMA" | "EMA" | "WMA" } : f))} options={maTypeOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.bollingerMaType ?? "MA"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).bollingerZ ?? "Z (0–3)"}</span>
                <input type="text" inputMode="decimal" value={editForm.bollingerZText} onChange={(e) => setEditForm((f) => (f ? { ...f, bollingerZText: e.target.value } : f))} onBlur={() => { const n = parseFloat(editForm.bollingerZText); const v = Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 2; setEditForm((f) => (f ? { ...f, bollingerZ: v, bollingerZText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.bollingerShowUpper} onChange={(e) => setEditForm((f) => (f ? { ...f, bollingerShowUpper: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).bollingerShowUpper ?? "Banda sup."}</label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.bollingerShowLower} onChange={(e) => setEditForm((f) => (f ? { ...f, bollingerShowLower: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).bollingerShowLower ?? "Banda inf."}</label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.bollingerShowMiddle} onChange={(e) => setEditForm((f) => (f ? { ...f, bollingerShowMiddle: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).bollingerShowMiddle ?? "Média"}</label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).bollingerLimitsColor ?? "Cor bandas"}</span>
                <ColorPaletteCombobox
                  value={editForm.bollingerLimitsColor}
                  onChange={(hex) => setEditForm((f) => (f ? { ...f, bollingerLimitsColor: hex, color: hex } : f))}
                  palette={INDICATOR_COLOR_PALETTE}
                  aria-label={(t as Record<string, string>).bollingerLimitsColor ?? "Cor bandas"}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura bandas"}</span>
                <Combobox value={editForm.bollingerLimitsLineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, bollingerLimitsLineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth ?? "Espessura"} />
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo bandas"}</span>
                <Combobox value={editForm.bollingerLimitsLineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, bollingerLimitsLineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle ?? "Estilo"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).bollingerMiddleColor ?? "Cor da média"}</span>
                <ColorPaletteCombobox
                  value={editForm.bollingerMiddleColor}
                  onChange={(hex) => setEditForm((f) => (f ? { ...f, bollingerMiddleColor: hex } : f))}
                  palette={INDICATOR_COLOR_PALETTE}
                  aria-label={(t as Record<string, string>).bollingerMiddleColor ?? "Cor da média"}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).bollingerMiddleThickness ?? "Espessura da média"}</span>
                <Combobox
                  value={editForm.bollingerMiddleLineWidth}
                  onChange={(v) =>
                    setEditForm((f) =>
                      f
                        ? {
                            ...f,
                            bollingerMiddleLineWidth: v as IndicatorLineWidth,
                            lineWidth: v as IndicatorLineWidth,
                          }
                        : f
                    )
                  }
                  options={lineWidthOptions}
                  className="flex-1 min-w-0"
                  size="md"
                  aria-label={(t as Record<string, string>).bollingerMiddleThickness ?? "Espessura da média"}
                />
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).bollingerMiddleStroke ?? "Traço da média"}</span>
                <Combobox
                  value={editForm.bollingerMiddleLineStyle}
                  onChange={(v) =>
                    setEditForm((f) =>
                      f
                        ? {
                            ...f,
                            bollingerMiddleLineStyle: v as IndicatorLineStyle,
                            lineStyle: v as IndicatorLineStyle,
                          }
                        : f
                    )
                  }
                  options={lineStyleOptions}
                  className="flex-1 min-w-0"
                  size="md"
                  aria-label={(t as Record<string, string>).bollingerMiddleStroke ?? "Traço da média"}
                />
              </div>
            </>
          ) : ind.type === "Keltner" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.field}</span>
                <Combobox value={editForm.fieldKey} onChange={(v) => setEditForm((f) => (f ? { ...f, fieldKey: v as IndicatorFieldKey } : f))} options={visibleForEdit.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))} className="flex-1 min-w-0" size="md" aria-label={t.field} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.period}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, period: Math.max(1, f.period - 1), periodText: String(Math.max(1, f.period - 1)) } : f))} className="stepper-btn">−</StepperButton>
                  <input type="text" inputMode="numeric" value={editForm.periodText} onChange={(e) => setEditForm((f) => (f ? { ...f, periodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.periodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 20; setEditForm((f) => (f ? { ...f, period: v, periodText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1" />
                  <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, period: Math.min(500, f.period + 1), periodText: String(Math.min(500, f.period + 1)) } : f))} className="stepper-btn">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).keltnerMaType ?? "Média móvel"}</span>
                <Combobox value={editForm.keltnerMaType} onChange={(v) => setEditForm((f) => (f ? { ...f, keltnerMaType: v as "SMA" | "EMA" | "WMA" } : f))} options={maTypeOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.keltnerMaType ?? "MA"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).keltnerMultiplierLabel ?? "Mult. ATR (0–10)"}</span>
                <input type="text" inputMode="decimal" value={editForm.keltnerMultiplierText} onChange={(e) => setEditForm((f) => (f ? { ...f, keltnerMultiplierText: e.target.value } : f))} onBlur={() => { const n = parseFloat(editForm.keltnerMultiplierText); const v = Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 2; setEditForm((f) => (f ? { ...f, keltnerMultiplier: v, keltnerMultiplierText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.keltnerShowUpper} onChange={(e) => setEditForm((f) => (f ? { ...f, keltnerShowUpper: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).keltnerShowUpper ?? "Banda sup."}</label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.keltnerShowLower} onChange={(e) => setEditForm((f) => (f ? { ...f, keltnerShowLower: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).keltnerShowLower ?? "Banda inf."}</label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.keltnerShowMiddle} onChange={(e) => setEditForm((f) => (f ? { ...f, keltnerShowMiddle: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).keltnerShowMiddle ?? "Média"}</label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).keltnerLimitsColor ?? "Cor bandas"}</span>
                <ColorPaletteCombobox
                  value={editForm.keltnerLimitsColor}
                  onChange={(hex) => setEditForm((f) => (f ? { ...f, keltnerLimitsColor: hex, color: hex } : f))}
                  palette={INDICATOR_COLOR_PALETTE}
                  aria-label={(t as Record<string, string>).keltnerLimitsColor ?? "Cor bandas"}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura bandas"}</span>
                <Combobox value={editForm.keltnerLimitsLineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, keltnerLimitsLineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth ?? "Espessura"} />
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo bandas"}</span>
                <Combobox value={editForm.keltnerLimitsLineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, keltnerLimitsLineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle ?? "Estilo"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).keltnerMiddleColor ?? "Cor da média"}</span>
                <ColorPaletteCombobox
                  value={editForm.keltnerMiddleColor}
                  onChange={(hex) => setEditForm((f) => (f ? { ...f, keltnerMiddleColor: hex } : f))}
                  palette={INDICATOR_COLOR_PALETTE}
                  aria-label={(t as Record<string, string>).keltnerMiddleColor ?? "Cor da média"}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).keltnerMiddleThickness ?? "Espessura da média"}</span>
                <Combobox
                  value={editForm.keltnerMiddleLineWidth}
                  onChange={(v) => setEditForm((f) => (f ? { ...f, keltnerMiddleLineWidth: v as IndicatorLineWidth } : f))}
                  options={lineWidthOptions}
                  className="flex-1 min-w-0"
                  size="md"
                  aria-label={(t as Record<string, string>).keltnerMiddleThickness ?? "Espessura da média"}
                />
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).keltnerMiddleStroke ?? "Traço da média"}</span>
                <Combobox
                  value={editForm.keltnerMiddleLineStyle}
                  onChange={(v) => setEditForm((f) => (f ? { ...f, keltnerMiddleLineStyle: v as IndicatorLineStyle } : f))}
                  options={lineStyleOptions}
                  className="flex-1 min-w-0"
                  size="md"
                  aria-label={(t as Record<string, string>).keltnerMiddleStroke ?? "Traço da média"}
                />
              </div>
            </>
          ) : ind.type === "Donchian" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.period}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, period: Math.max(1, f.period - 1), periodText: String(Math.max(1, f.period - 1)) } : f))} className="stepper-btn">−</StepperButton>
                  <input type="text" inputMode="numeric" value={editForm.periodText} onChange={(e) => setEditForm((f) => (f ? { ...f, periodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.periodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 20; setEditForm((f) => (f ? { ...f, period: v, periodText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1" />
                  <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, period: Math.min(500, f.period + 1), periodText: String(Math.min(500, f.period + 1)) } : f))} className="stepper-btn">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.donchianShowUpper} onChange={(e) => setEditForm((f) => (f ? { ...f, donchianShowUpper: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).donchianShowUpper ?? "Canal sup."}</label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.donchianShowLower} onChange={(e) => setEditForm((f) => (f ? { ...f, donchianShowLower: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).donchianShowLower ?? "Canal inf."}</label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.donchianShowMiddle} onChange={(e) => setEditForm((f) => (f ? { ...f, donchianShowMiddle: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).donchianShowMiddle ?? "Linha meio"}</label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).donchianBandOpacity ?? "Opacidade"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => { const cur = editForm.donchianBandOpacity ?? 0.2; const v = Math.max(0, cur - 0.05); setEditForm((f) => (f ? { ...f, donchianBandOpacity: v, donchianBandOpacityText: String(Math.round(v * 100)) } : f)); }} disabled={(editForm.donchianBandOpacity ?? 0.2) <= 0} className="stepper-btn">−</StepperButton>
                  <span className="w-10 text-center text-xs font-mono text-zinc-800 tabular-nums">{Math.round((editForm.donchianBandOpacity ?? 0.2) * 100)}%</span>
                  <StepperButton onStep={() => { const cur = editForm.donchianBandOpacity ?? 0.2; const v = Math.min(0.3, cur + 0.05); setEditForm((f) => (f ? { ...f, donchianBandOpacity: v, donchianBandOpacityText: String(Math.round(v * 100)) } : f)); }} disabled={(editForm.donchianBandOpacity ?? 0.2) >= 0.3} className="stepper-btn">+</StepperButton>
                </div>
              </div>
                <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).donchianLimitsColor ?? "Cor canais"}</span>
                <ColorPaletteCombobox value={editForm.donchianLimitsColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, donchianLimitsColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).donchianLimitsColor ?? "Cor canais"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                <Combobox value={editForm.donchianLimitsLineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, donchianLimitsLineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth} />
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                <Combobox value={editForm.donchianLimitsLineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, donchianLimitsLineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).donchianMiddleColor ?? "Cor linha meio"}</span>
                <ColorPaletteCombobox
                  value={editForm.donchianMiddleColor}
                  onChange={(hex) => setEditForm((f) => (f ? { ...f, donchianMiddleColor: hex, color: hex } : f))}
                  palette={INDICATOR_COLOR_PALETTE}
                  aria-label={(t as Record<string, string>).donchianMiddleColor ?? "Cor linha meio"}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).donchianMiddleThickness ?? "Espessura linha meio"}</span>
                <Combobox
                  value={editForm.donchianMiddleLineWidth}
                  onChange={(v) =>
                    setEditForm((f) =>
                      f ? { ...f, donchianMiddleLineWidth: v as IndicatorLineWidth, lineWidth: v as IndicatorLineWidth } : f
                    )
                  }
                  options={lineWidthOptions}
                  className="flex-1 min-w-0"
                  size="md"
                  aria-label={(t as Record<string, string>).donchianMiddleThickness ?? "Espessura linha meio"}
                />
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).donchianMiddleStroke ?? "Traço linha meio"}</span>
                <Combobox
                  value={editForm.donchianMiddleLineStyle}
                  onChange={(v) =>
                    setEditForm((f) =>
                      f ? { ...f, donchianMiddleLineStyle: v as IndicatorLineStyle, lineStyle: v as IndicatorLineStyle } : f
                    )
                  }
                  options={lineStyleOptions}
                  className="flex-1 min-w-0"
                  size="md"
                  aria-label={(t as Record<string, string>).donchianMiddleStroke ?? "Traço linha meio"}
                />
              </div>
            </>
          ) : ind.type === "Ichimoku" ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 sm:gap-x-2 sm:gap-y-1">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1">
                  <span className="text-[10px] font-medium text-zinc-600 sm:w-12 shrink-0">{(t as Record<string, string>).ichimokuTenkanPeriod ?? "Tenkan"}</span>
                  <div className="flex items-center gap-0.5 w-full sm:flex-1 min-w-0">
                    <StepperButton onStep={() => { const v = Math.max(1, (editForm.ichimokuTenkanPeriod ?? 9) - 1); setEditForm((f) => (f ? { ...f, ichimokuTenkanPeriod: v, ichimokuTenkanPeriodText: String(v) } : f)); }} disabled={(editForm.ichimokuTenkanPeriod ?? 9) <= 1} className="stepper-btn">−</StepperButton>
                    <input type="text" inputMode="numeric" value={editForm.ichimokuTenkanPeriodText} onChange={(e) => setEditForm((f) => (f ? { ...f, ichimokuTenkanPeriodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = parseInt(editForm.ichimokuTenkanPeriodText, 10); const v = Number.isFinite(n) ? Math.max(1, Math.min(500, n)) : 9; setEditForm((f) => (f ? { ...f, ichimokuTenkanPeriod: v, ichimokuTenkanPeriodText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-1.5 py-0.5" />
                    <StepperButton onStep={() => { const v = Math.min(500, (editForm.ichimokuTenkanPeriod ?? 9) + 1); setEditForm((f) => (f ? { ...f, ichimokuTenkanPeriod: v, ichimokuTenkanPeriodText: String(v) } : f)); }} disabled={(editForm.ichimokuTenkanPeriod ?? 9) >= 500} className="stepper-btn">+</StepperButton>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1">
                  <span className="text-[10px] font-medium text-zinc-600 sm:w-12 shrink-0">{(t as Record<string, string>).ichimokuKijunPeriod ?? "Kijun"}</span>
                  <div className="flex items-center gap-0.5 w-full sm:flex-1 min-w-0">
                    <StepperButton onStep={() => { const v = Math.max(1, (editForm.ichimokuKijunPeriod ?? 26) - 1); setEditForm((f) => (f ? { ...f, ichimokuKijunPeriod: v, ichimokuKijunPeriodText: String(v) } : f)); }} disabled={(editForm.ichimokuKijunPeriod ?? 26) <= 1} className="stepper-btn">−</StepperButton>
                    <input type="text" inputMode="numeric" value={editForm.ichimokuKijunPeriodText} onChange={(e) => setEditForm((f) => (f ? { ...f, ichimokuKijunPeriodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = parseInt(editForm.ichimokuKijunPeriodText, 10); const v = Number.isFinite(n) ? Math.max(1, Math.min(500, n)) : 26; setEditForm((f) => (f ? { ...f, ichimokuKijunPeriod: v, ichimokuKijunPeriodText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-1.5 py-0.5" />
                    <StepperButton onStep={() => { const v = Math.min(500, (editForm.ichimokuKijunPeriod ?? 26) + 1); setEditForm((f) => (f ? { ...f, ichimokuKijunPeriod: v, ichimokuKijunPeriodText: String(v) } : f)); }} disabled={(editForm.ichimokuKijunPeriod ?? 26) >= 500} className="stepper-btn">+</StepperButton>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1">
                  <span className="text-[10px] font-medium text-zinc-600 sm:w-12 shrink-0">{(t as Record<string, string>).ichimokuSpanBPeriod ?? "Span B"}</span>
                  <div className="flex items-center gap-0.5 w-full sm:flex-1 min-w-0">
                    <StepperButton onStep={() => { const v = Math.max(1, (editForm.ichimokuSpanBPeriod ?? 52) - 1); setEditForm((f) => (f ? { ...f, ichimokuSpanBPeriod: v, ichimokuSpanBPeriodText: String(v) } : f)); }} disabled={(editForm.ichimokuSpanBPeriod ?? 52) <= 1} className="stepper-btn">−</StepperButton>
                    <input type="text" inputMode="numeric" value={editForm.ichimokuSpanBPeriodText} onChange={(e) => setEditForm((f) => (f ? { ...f, ichimokuSpanBPeriodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = parseInt(editForm.ichimokuSpanBPeriodText, 10); const v = Number.isFinite(n) ? Math.max(1, Math.min(500, n)) : 52; setEditForm((f) => (f ? { ...f, ichimokuSpanBPeriod: v, ichimokuSpanBPeriodText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-1.5 py-0.5" />
                    <StepperButton onStep={() => { const v = Math.min(500, (editForm.ichimokuSpanBPeriod ?? 52) + 1); setEditForm((f) => (f ? { ...f, ichimokuSpanBPeriod: v, ichimokuSpanBPeriodText: String(v) } : f)); }} disabled={(editForm.ichimokuSpanBPeriod ?? 52) >= 500} className="stepper-btn">+</StepperButton>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1">
                  <span className="text-[10px] font-medium text-zinc-600 sm:w-12 shrink-0">{(t as Record<string, string>).ichimokuDisplacement ?? "Desloc."}</span>
                  <div className="flex items-center gap-0.5 w-full sm:flex-1 min-w-0">
                    <StepperButton onStep={() => { const v = Math.max(0, (editForm.ichimokuDisplacement ?? 26) - 1); setEditForm((f) => (f ? { ...f, ichimokuDisplacement: v, ichimokuDisplacementText: String(v) } : f)); }} disabled={(editForm.ichimokuDisplacement ?? 26) <= 0} className="stepper-btn">−</StepperButton>
                    <input type="text" inputMode="numeric" value={editForm.ichimokuDisplacementText} onChange={(e) => setEditForm((f) => (f ? { ...f, ichimokuDisplacementText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = parseInt(editForm.ichimokuDisplacementText, 10); const v = Number.isFinite(n) ? Math.max(0, Math.min(500, n)) : 26; setEditForm((f) => (f ? { ...f, ichimokuDisplacement: v, ichimokuDisplacementText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-1.5 py-0.5" />
                    <StepperButton onStep={() => { const v = Math.min(500, (editForm.ichimokuDisplacement ?? 26) + 1); setEditForm((f) => (f ? { ...f, ichimokuDisplacement: v, ichimokuDisplacementText: String(v) } : f)); }} disabled={(editForm.ichimokuDisplacement ?? 26) >= 500} className="stepper-btn">+</StepperButton>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).ichimokuCloudOpacity ?? "Opac. nuvem"}</span>
                <StepperButton onStep={() => { const v = Math.max(0, (editForm.ichimokuCloudOpacity ?? 0.3) * 100 - 10); setEditForm((f) => (f ? { ...f, ichimokuCloudOpacity: v / 100, ichimokuCloudOpacityText: String(Math.round(v)) } : f)); }} disabled={((editForm.ichimokuCloudOpacity ?? 0.3) * 100) <= 0} className="stepper-btn">−</StepperButton>
                <span className="w-6 text-center text-[10px] font-mono tabular-nums">{Math.round((editForm.ichimokuCloudOpacity ?? 0.3) * 100)}%</span>
                <StepperButton onStep={() => { const v = Math.min(70, (editForm.ichimokuCloudOpacity ?? 0.3) * 100 + 10); setEditForm((f) => (f ? { ...f, ichimokuCloudOpacity: v / 100, ichimokuCloudOpacityText: String(Math.round(v)) } : f)); }} disabled={((editForm.ichimokuCloudOpacity ?? 0.3) * 100) >= 70} className="stepper-btn">+</StepperButton>
              </div>
              <div className="text-[10px] font-medium text-zinc-600">{(t as Record<string, string>).ichimokuShowLinesLabel ?? "Linhas a mostrar"}</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {(["Tenkan", "Kijun", "Span A", "Span B", "Chikou"] as const).map((label) => {
                  const showKey = label === "Tenkan" ? "ichimokuShowTenkan" : label === "Kijun" ? "ichimokuShowKijun" : label === "Span A" ? "ichimokuShowSpanA" : label === "Span B" ? "ichimokuShowSpanB" : "ichimokuShowChikou";
                  return (
                    <label key={label} className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={editForm[showKey as keyof typeof editForm] as boolean} onChange={(e) => setEditForm((f) => (f ? { ...f, [showKey]: e.target.checked } : f))} className="rounded border-zinc-300" />
                      <span className="text-[10px] text-zinc-700">{label}</span>
                    </label>
                  );
                })}
              </div>
              {(["Tenkan", "Kijun", "Span A", "Span B", "Chikou"] as const).map((label) => {
                const colorKey = label === "Tenkan" ? "ichimokuTenkanColor" : label === "Kijun" ? "ichimokuKijunColor" : label === "Span A" ? "ichimokuSpanAColor" : label === "Span B" ? "ichimokuSpanBColor" : "ichimokuChikouColor";
                const widthKey = label === "Tenkan" ? "ichimokuTenkanLineWidth" : label === "Kijun" ? "ichimokuKijunLineWidth" : label === "Span A" ? "ichimokuSpanALineWidth" : label === "Span B" ? "ichimokuSpanBLineWidth" : "ichimokuChikouLineWidth";
                const styleKey = label === "Tenkan" ? "ichimokuTenkanLineStyle" : label === "Kijun" ? "ichimokuKijunLineStyle" : label === "Span A" ? "ichimokuSpanALineStyle" : label === "Span B" ? "ichimokuSpanBLineStyle" : "ichimokuChikouLineStyle";
                const val = editForm[colorKey as keyof typeof editForm] as string;
                return (
                  <div key={label} className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-zinc-600 w-12 shrink-0">{label}</span>
                    <ColorPaletteCombobox value={val} onChange={(hex) => setEditForm((f) => (f ? { ...f, [colorKey]: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).color ?? "Cor"} />
                    <Combobox value={editForm[widthKey as keyof typeof editForm] as string} onChange={(v) => setEditForm((f) => (f ? { ...f, [widthKey]: v as IndicatorLineWidth } : f))} options={lineWidthOptions} size="sm" className="w-14" aria-label={tRecord.lineWidth ?? "Espessura"} />
                    <Combobox value={editForm[styleKey as keyof typeof editForm] as string} onChange={(v) => setEditForm((f) => (f ? { ...f, [styleKey]: v as IndicatorLineStyle } : f))} options={lineStyleOptions} size="sm" className="w-14" aria-label={tRecord.lineStyle ?? "Estilo"} />
                  </div>
                );
              })}
            </>
          ) : ind.type === "SAR" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).sarStart ?? "Start"}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editForm.sarStartText}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, sarStartText: e.target.value } : f))}
                  onBlur={() => { const n = parseFloat(editForm.sarStartText); const v = Number.isFinite(n) && n >= 0.001 && n <= 1 ? Math.max(0.001, Math.min(1, n)) : 0.02; setEditForm((f) => (f ? { ...f, sarStart: v, sarStartText: String(v) } : f)); }}
                  className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).sarIncrement ?? "Increment"}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editForm.sarIncrementText}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, sarIncrementText: e.target.value } : f))}
                  onBlur={() => { const n = parseFloat(editForm.sarIncrementText); const v = Number.isFinite(n) && n >= 0.001 && n <= 1 ? Math.max(0.001, Math.min(1, n)) : 0.02; setEditForm((f) => (f ? { ...f, sarIncrement: v, sarIncrementText: String(v) } : f)); }}
                  className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).sarMax ?? "Max value"}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editForm.sarMaxText}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, sarMaxText: e.target.value } : f))}
                  onBlur={() => { const n = parseFloat(editForm.sarMaxText); const v = Number.isFinite(n) && n >= 0.02 && n <= 1 ? Math.max(0.02, Math.min(1, n)) : 0.2; setEditForm((f) => (f ? { ...f, sarMax: v, sarMaxText: String(v) } : f)); }}
                  className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).sarPointSize ?? "Tamanho do ponto"}</span>
                <Combobox value={editForm.sarPointSize} onChange={(v) => setEditForm((f) => (f ? { ...f, sarPointSize: v as "thin" | "normal" } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.sarPointSize ?? "Tamanho"} />
              </div>
            </>
          ) : ind.type === "Stochastic" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.period}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, period: Math.max(1, f.period - 1), periodText: String(Math.max(1, f.period - 1)) } : f))} className="stepper-btn">−</StepperButton>
                  <input type="text" inputMode="numeric" value={editForm.periodText} onChange={(e) => setEditForm((f) => (f ? { ...f, periodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.periodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 14; setEditForm((f) => (f ? { ...f, period: v, periodText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1" />
                  <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, period: Math.min(500, f.period + 1), periodText: String(Math.min(500, f.period + 1)) } : f))} className="stepper-btn">+</StepperButton>
                </div>
              </div>
            </>
          ) : ind.type === "WilliamsR" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.period}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, period: Math.max(1, f.period - 1), periodText: String(Math.max(1, f.period - 1)) } : f))} className="stepper-btn">−</StepperButton>
                  <input type="text" inputMode="numeric" value={editForm.periodText} onChange={(e) => setEditForm((f) => (f ? { ...f, periodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.periodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 14; setEditForm((f) => (f ? { ...f, period: v, periodText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1" />
                  <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, period: Math.min(500, f.period + 1), periodText: String(Math.min(500, f.period + 1)) } : f))} className="stepper-btn">+</StepperButton>
                </div>
              </div>
            </>
          ) : ind.type === "HMA_CUSTOM" ? (
            <>
              <p className="text-[10px] text-zinc-500">{tRecord.hmaCustomHint ?? ""}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{tRecord.hmaCustomLongPeriod ?? "Long MA"}</span>
                <Combobox
                  value={editForm.hmaCustomLongMaType ?? "WMA"}
                  onChange={(v) => setEditForm((f) => (f ? { ...f, hmaCustomLongMaType: v as EditFormState["hmaCustomLongMaType"] } : f))}
                  options={hmaCustomLegMaTypeOptions}
                  className="w-[4.75rem] shrink-0"
                  size="md"
                  aria-label={`${tRecord.hmaCustomLongPeriod ?? "Long MA"} — ${tRecord.hmaCustomMaTypeAria ?? "Averaging type"}`}
                />
                <div className="flex items-center gap-1">
                  <StepperButton
                    onStep={() =>
                      setEditForm((f) => {
                        if (!f) return f;
                        const o = normalizeHmaCustomPeriods(
                          f.hmaCustomSmoothPeriod ?? 4,
                          f.hmaCustomFastPeriod ?? 10,
                          Math.max(3, (f.hmaCustomLongPeriod ?? 20) - 1)
                        );
                        return {
                          ...f,
                          ...o,
                          hmaCustomLongPeriodText: String(o.hmaCustomLongPeriod),
                          hmaCustomFastPeriodText: String(o.hmaCustomFastPeriod),
                          hmaCustomSmoothPeriodText: String(o.hmaCustomSmoothPeriod),
                          period: o.hmaCustomLongPeriod,
                          periodText: String(o.hmaCustomLongPeriod),
                        };
                      })
                    }
                    disabled={(editForm.hmaCustomLongPeriod ?? 20) <= 3}
                    className="stepper-btn"
                  >
                    −
                  </StepperButton>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editForm.hmaCustomLongPeriodText}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, hmaCustomLongPeriodText: e.target.value.replace(/[^\d]/g, "") } : f))}
                    onBlur={() =>
                      setEditForm((f) => {
                        if (!f) return f;
                        const n = parseInt(f.hmaCustomLongPeriodText, 10);
                        const o = normalizeHmaCustomPeriods(
                          f.hmaCustomSmoothPeriod ?? 4,
                          f.hmaCustomFastPeriod ?? 10,
                          Number.isFinite(n) ? n : f.hmaCustomLongPeriod ?? 20
                        );
                        return {
                          ...f,
                          ...o,
                          hmaCustomLongPeriodText: String(o.hmaCustomLongPeriod),
                          hmaCustomFastPeriodText: String(o.hmaCustomFastPeriod),
                          hmaCustomSmoothPeriodText: String(o.hmaCustomSmoothPeriod),
                          period: o.hmaCustomLongPeriod,
                          periodText: String(o.hmaCustomLongPeriod),
                        };
                      })
                    }
                    className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1"
                  />
                  <StepperButton
                    onStep={() =>
                      setEditForm((f) => {
                        if (!f) return f;
                        const o = normalizeHmaCustomPeriods(
                          f.hmaCustomSmoothPeriod ?? 4,
                          f.hmaCustomFastPeriod ?? 10,
                          Math.min(500, (f.hmaCustomLongPeriod ?? 20) + 1)
                        );
                        return {
                          ...f,
                          ...o,
                          hmaCustomLongPeriodText: String(o.hmaCustomLongPeriod),
                          hmaCustomFastPeriodText: String(o.hmaCustomFastPeriod),
                          hmaCustomSmoothPeriodText: String(o.hmaCustomSmoothPeriod),
                          period: o.hmaCustomLongPeriod,
                          periodText: String(o.hmaCustomLongPeriod),
                        };
                      })
                    }
                    disabled={(editForm.hmaCustomLongPeriod ?? 20) >= 500}
                    className="stepper-btn"
                  >
                    +
                  </StepperButton>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{tRecord.hmaCustomFastPeriod ?? "Fast MA"}</span>
                <Combobox
                  value={editForm.hmaCustomFastMaType ?? "WMA"}
                  onChange={(v) => setEditForm((f) => (f ? { ...f, hmaCustomFastMaType: v as EditFormState["hmaCustomFastMaType"] } : f))}
                  options={hmaCustomLegMaTypeOptions}
                  className="w-[4.75rem] shrink-0"
                  size="md"
                  aria-label={`${tRecord.hmaCustomFastPeriod ?? "Fast MA"} — ${tRecord.hmaCustomMaTypeAria ?? "Averaging type"}`}
                />
                <div className="flex items-center gap-1">
                  <StepperButton
                    onStep={() =>
                      setEditForm((f) => {
                        if (!f) return f;
                        const o = normalizeHmaCustomPeriods(
                          f.hmaCustomSmoothPeriod ?? 4,
                          Math.max(2, (f.hmaCustomFastPeriod ?? 10) - 1),
                          f.hmaCustomLongPeriod ?? 20
                        );
                        return {
                          ...f,
                          ...o,
                          hmaCustomLongPeriodText: String(o.hmaCustomLongPeriod),
                          hmaCustomFastPeriodText: String(o.hmaCustomFastPeriod),
                          hmaCustomSmoothPeriodText: String(o.hmaCustomSmoothPeriod),
                          period: o.hmaCustomLongPeriod,
                          periodText: String(o.hmaCustomLongPeriod),
                        };
                      })
                    }
                    disabled={(editForm.hmaCustomFastPeriod ?? 10) <= 2}
                    className="stepper-btn"
                  >
                    −
                  </StepperButton>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editForm.hmaCustomFastPeriodText}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, hmaCustomFastPeriodText: e.target.value.replace(/[^\d]/g, "") } : f))}
                    onBlur={() =>
                      setEditForm((f) => {
                        if (!f) return f;
                        const n = parseInt(f.hmaCustomFastPeriodText, 10);
                        const o = normalizeHmaCustomPeriods(
                          f.hmaCustomSmoothPeriod ?? 4,
                          Number.isFinite(n) ? n : f.hmaCustomFastPeriod ?? 10,
                          f.hmaCustomLongPeriod ?? 20
                        );
                        return {
                          ...f,
                          ...o,
                          hmaCustomLongPeriodText: String(o.hmaCustomLongPeriod),
                          hmaCustomFastPeriodText: String(o.hmaCustomFastPeriod),
                          hmaCustomSmoothPeriodText: String(o.hmaCustomSmoothPeriod),
                          period: o.hmaCustomLongPeriod,
                          periodText: String(o.hmaCustomLongPeriod),
                        };
                      })
                    }
                    className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1"
                  />
                  <StepperButton
                    onStep={() =>
                      setEditForm((f) => {
                        if (!f) return f;
                        const o = normalizeHmaCustomPeriods(
                          f.hmaCustomSmoothPeriod ?? 4,
                          Math.min(499, (f.hmaCustomFastPeriod ?? 10) + 1),
                          f.hmaCustomLongPeriod ?? 20
                        );
                        return {
                          ...f,
                          ...o,
                          hmaCustomLongPeriodText: String(o.hmaCustomLongPeriod),
                          hmaCustomFastPeriodText: String(o.hmaCustomFastPeriod),
                          hmaCustomSmoothPeriodText: String(o.hmaCustomSmoothPeriod),
                          period: o.hmaCustomLongPeriod,
                          periodText: String(o.hmaCustomLongPeriod),
                        };
                      })
                    }
                    disabled={(editForm.hmaCustomFastPeriod ?? 10) >= 499}
                    className="stepper-btn"
                  >
                    +
                  </StepperButton>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{tRecord.hmaCustomSmoothPeriod ?? "Smoothing"}</span>
                <Combobox
                  value={editForm.hmaCustomSmoothMaType ?? "WMA"}
                  onChange={(v) => setEditForm((f) => (f ? { ...f, hmaCustomSmoothMaType: v as "SMA" | "EMA" | "WMA" } : f))}
                  options={maTypeOptions}
                  className="w-[4.75rem] shrink-0"
                  size="md"
                  aria-label={`${tRecord.hmaCustomSmoothPeriod ?? "Smoothing"} — ${tRecord.hmaCustomMaTypeAria ?? "Averaging type"}`}
                />
                <div className="flex items-center gap-1">
                  <StepperButton
                    onStep={() =>
                      setEditForm((f) => {
                        if (!f) return f;
                        const o = normalizeHmaCustomPeriods(
                          Math.max(1, (f.hmaCustomSmoothPeriod ?? 4) - 1),
                          f.hmaCustomFastPeriod ?? 10,
                          f.hmaCustomLongPeriod ?? 20
                        );
                        return {
                          ...f,
                          ...o,
                          hmaCustomLongPeriodText: String(o.hmaCustomLongPeriod),
                          hmaCustomFastPeriodText: String(o.hmaCustomFastPeriod),
                          hmaCustomSmoothPeriodText: String(o.hmaCustomSmoothPeriod),
                          period: o.hmaCustomLongPeriod,
                          periodText: String(o.hmaCustomLongPeriod),
                        };
                      })
                    }
                    disabled={(editForm.hmaCustomSmoothPeriod ?? 4) <= 1}
                    className="stepper-btn"
                  >
                    −
                  </StepperButton>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editForm.hmaCustomSmoothPeriodText}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, hmaCustomSmoothPeriodText: e.target.value.replace(/[^\d]/g, "") } : f))}
                    onBlur={() =>
                      setEditForm((f) => {
                        if (!f) return f;
                        const n = parseInt(f.hmaCustomSmoothPeriodText, 10);
                        const o = normalizeHmaCustomPeriods(
                          Number.isFinite(n) ? n : f.hmaCustomSmoothPeriod ?? 4,
                          f.hmaCustomFastPeriod ?? 10,
                          f.hmaCustomLongPeriod ?? 20
                        );
                        return {
                          ...f,
                          ...o,
                          hmaCustomLongPeriodText: String(o.hmaCustomLongPeriod),
                          hmaCustomFastPeriodText: String(o.hmaCustomFastPeriod),
                          hmaCustomSmoothPeriodText: String(o.hmaCustomSmoothPeriod),
                          period: o.hmaCustomLongPeriod,
                          periodText: String(o.hmaCustomLongPeriod),
                        };
                      })
                    }
                    className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1"
                  />
                  <StepperButton
                    onStep={() =>
                      setEditForm((f) => {
                        if (!f) return f;
                        const o = normalizeHmaCustomPeriods(
                          Math.min(498, (f.hmaCustomSmoothPeriod ?? 4) + 1),
                          f.hmaCustomFastPeriod ?? 10,
                          f.hmaCustomLongPeriod ?? 20
                        );
                        return {
                          ...f,
                          ...o,
                          hmaCustomLongPeriodText: String(o.hmaCustomLongPeriod),
                          hmaCustomFastPeriodText: String(o.hmaCustomFastPeriod),
                          hmaCustomSmoothPeriodText: String(o.hmaCustomSmoothPeriod),
                          period: o.hmaCustomLongPeriod,
                          periodText: String(o.hmaCustomLongPeriod),
                        };
                      })
                    }
                    disabled={(editForm.hmaCustomSmoothPeriod ?? 4) >= 498}
                    className="stepper-btn"
                  >
                    +
                  </StepperButton>
                </div>
              </div>
            </>
          ) : isTimeWindowMa2Type(ind.type) ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.field}</span>
                <Combobox
                  value={editFieldValue}
                  onChange={(v) => setEditForm((f) => (f ? { ...f, fieldKey: v as IndicatorFieldKey } : f))}
                  options={visibleForEdit.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))}
                  className="flex-1 min-w-0"
                  size="md"
                  aria-label={t.field}
                />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{tRecord.wma2WindowLabel ?? "Averaging window"}</span>
                  <Combobox
                    value={editForm.wma2TimeUnit === "days" || editForm.wma2TimeUnit === "hours" || editForm.wma2TimeUnit === "minutes" ? editForm.wma2TimeUnit : "hours"}
                    onChange={(v) => {
                      const u = v as Wma2TimeUnit;
                      const d = defaultMa2TimeValueForUnit(u);
                      setEditForm((f) => (f ? { ...f, wma2TimeUnit: u, wma2TimeValue: d, wma2TimeValueText: String(d) } : f));
                    }}
                    options={wma2UnitOptions}
                    className="w-28 shrink-0"
                    size="md"
                    aria-label={tRecord.wma2WindowLabel ?? "Window unit"}
                  />
                  <div className="flex items-center gap-1">
                    <StepperButton
                      onStep={() => {
                        const u =
                          editForm.wma2TimeUnit === "days" || editForm.wma2TimeUnit === "hours" || editForm.wma2TimeUnit === "minutes"
                            ? editForm.wma2TimeUnit
                            : "hours";
                        const next = Math.max(1, (editForm.wma2TimeValue ?? defaultMa2TimeValueForUnit(u)) - 1);
                        setEditForm((f) => (f ? { ...f, wma2TimeValue: next, wma2TimeValueText: String(next) } : f));
                      }}
                      className="stepper-btn"
                    >
                      −
                    </StepperButton>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editForm.wma2TimeValueText}
                      onFocus={(e) => {
                        queueMicrotask(() => e.currentTarget?.select());
                      }}
                      onChange={(e) => setEditForm((f) => (f ? { ...f, wma2TimeValueText: e.target.value.replace(/[^\d]/g, "") } : f))}
                      onBlur={() => {
                        const n = Number(editForm.wma2TimeValueText);
                        const u =
                          editForm.wma2TimeUnit === "days" || editForm.wma2TimeUnit === "hours" || editForm.wma2TimeUnit === "minutes"
                            ? editForm.wma2TimeUnit
                            : "hours";
                        const def = defaultMa2TimeValueForUnit(u);
                        const raw = Number.isFinite(n) && n > 0 ? clampMa2TimeWindowUserValue(n) : editForm.wma2TimeValue ?? def;
                        const next = normalizeMa2TimeValueForUnit(u, raw);
                        setEditForm((f) => (f ? { ...f, wma2TimeValue: next, wma2TimeValueText: String(next) } : f));
                      }}
                      className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1"
                    />
                    <StepperButton
                      onStep={() => {
                        const u =
                          editForm.wma2TimeUnit === "days" || editForm.wma2TimeUnit === "hours" || editForm.wma2TimeUnit === "minutes"
                            ? editForm.wma2TimeUnit
                            : "hours";
                        const next = Math.min(MA2_MAX_WINDOW_VALUE, (editForm.wma2TimeValue ?? defaultMa2TimeValueForUnit(u)) + 1);
                        setEditForm((f) => (f ? { ...f, wma2TimeValue: next, wma2TimeValueText: String(next) } : f));
                      }}
                      className="stepper-btn"
                    >
                      +
                    </StepperButton>
                  </div>
                </div>
              </div>
            </>
          ) : ind.type === "OBV" || ind.type === "AD" ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).volumeSourceLabel ?? "Fonte de volume"}</span>
              <Combobox
                value={ind.type === "OBV" ? (editForm.obvVolumeSource ?? "base") : (editForm.adVolumeSource ?? "base")}
                onChange={(v) => setEditForm((f) => (f ? { ...f, ...(ind.type === "OBV" ? { obvVolumeSource: v as "base" | "usdt" } : { adVolumeSource: v as "base" | "usdt" }) } : f))}
                options={volumeSourceOptions}
                className="flex-1 min-w-0"
                size="md"
                aria-label={(t as Record<string, string>).volumeSourceLabel ?? "Fonte de volume"}
              />
            </div>
          ) : (
          <>
          {!["ATR", "ADX", "VWAP", "Donchian", "Ichimoku"].includes(ind.type as string) && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.field}</span>
              <Combobox value={editFieldValue} onChange={(v) => setEditForm((f) => (f ? { ...f, fieldKey: v as IndicatorFieldKey } : f))} options={visibleForEdit.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))} className="flex-1 min-w-0" size="md" aria-label={t.field} />
            </div>
          )}
          {ind.type !== "VWAP" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.period}</span>
              <div className="flex items-center gap-1">
                <StepperButton onStep={() => { const next = Math.max(1, Math.min(500, (editForm.period ?? 7) - 1)); setEditForm((f) => (f ? { ...f, period: next, periodText: String(next) } : f)); }} className="stepper-btn">−</StepperButton>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editForm.periodText}
                  onFocus={(e) => { queueMicrotask(() => e.currentTarget?.select()); }}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, periodText: e.target.value.replace(/[^\d]/g, "") } : f))}
                  onBlur={() => {
                    const n = Number(editForm.periodText);
                    const next = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : editForm.period;
                    setEditForm((f) => (f ? { ...f, period: next, periodText: String(next) } : f));
                  }}
                  className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1"
                />
                <StepperButton onStep={() => { const next = Math.max(1, Math.min(500, (editForm.period ?? 7) + 1)); setEditForm((f) => (f ? { ...f, period: next, periodText: String(next) } : f)); }} className="stepper-btn">+</StepperButton>
              </div>
            </div>
          )}
          </>
          )}
          {ind.type !== "Ichimoku" && ind.type !== "Bollinger" && ind.type !== "Donchian" && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
            <ColorPaletteCombobox value={editForm.color} onChange={(hex) => setEditForm((f) => (f ? { ...f, color: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
          </div>
          )}
          {!(ind.type === "SAR" || ind.type === "VWAP" || ind.type === "Bollinger" || ind.type === "Keltner" || ind.type === "Donchian" || ind.type === "HMA" || ind.type === "HMA_CUSTOM" || ind.type === "VWMA" || ind.type === "LINEAR_FIT" || ind.type === "QUADRATIC_FIT" || ind.type === "Ichimoku") && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.chartOption}</span>
            {ind.type === "RSI" || ind.type === "MFI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "AD" || ind.type === "ATR" || ind.type === "ADX" || ind.type === "CCI" || ind.type === "CMF" || ind.type === "Volume" ? (
              <Combobox value={editForm.panel} onChange={(v) => setEditForm((f) => (f ? { ...f, panel: v as IndicatorPanel } : f))} options={editPanelOptions} className="flex-1 min-w-0" size="md" aria-label={t.chartOption} />
            ) : (
              <Combobox value={editForm.panel} onChange={(v) => setEditForm((f) => (f ? { ...f, panel: v as IndicatorPanel } : f))} options={editPanelOptions} className="flex-1 min-w-0" size="md" aria-label={t.chartOption} />
            )}
          </div>
          )}
          {ind.type === "Volume" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.volumeInUsdt} onChange={(e) => setEditForm((f) => (f ? { ...f, volumeInUsdt: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).volumeInUsdtLabel ?? "Exibir em USDT"}</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).volumeColorPositive ?? "Cor positivo"}</span>
                <ColorPaletteCombobox value={editForm.volumeColorAbove} onChange={(hex) => setEditForm((f) => (f ? { ...f, volumeColorAbove: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).volumeColorPositive ?? "Cor positivo"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).volumeColorNegative ?? "Cor negativo"}</span>
                <ColorPaletteCombobox value={editForm.volumeColorBelow} onChange={(hex) => setEditForm((f) => (f ? { ...f, volumeColorBelow: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).volumeColorNegative ?? "Cor negativo"} />
              </div>
            </>
          )}
          {ind.type === "RSI" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editForm.rsiFixedScale} onChange={(e) => setEditForm((f) => (f ? { ...f, rsiFixedScale: e.target.checked } : f))} className="rounded border-zinc-300" />
              <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).rsiFixedScaleLabel ?? "Escala fixa 0–100 no eixo Y"}</span>
            </label>
          )}
          {ind.type === "RSI" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.rsiCenterLine} onChange={(e) => setEditForm((f) => (f ? { ...f, rsiCenterLine: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).rsiCenterLineLabel ?? "Linha central 50%"}</span>
              </label>
              {editForm.rsiCenterLine && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <ColorPaletteCombobox value={editForm.rsiCenterLineColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, rsiCenterLineColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                    <Combobox value={editForm.rsiCenterLineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, rsiCenterLineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                    <Combobox value={editForm.rsiCenterLineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, rsiCenterLineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle} />
                  </div>
                </div>
              )}
            </>
          )}
          {ind.type === "RSI" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.rsiLimits} onChange={(e) => setEditForm((f) => (f ? { ...f, rsiLimits: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).rsiLimitsLabel ?? "Limites superior e inferior"}</span>
              </label>
              {editForm.rsiLimits && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).rsiLimitUpperLabel ?? "Superior %"}</span>
                    <div className="flex items-center gap-0.5">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, rsiLimitUpper: Math.max(0, Math.min(100, (f.rsiLimitUpper ?? 70) - 1)) } : f))} className="stepper-btn">−</StepperButton>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.rsiLimitUpper}</span>
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, rsiLimitUpper: Math.max(0, Math.min(100, (f.rsiLimitUpper ?? 70) + 1)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).rsiLimitLowerLabel ?? "Inferior %"}</span>
                    <div className="flex items-center gap-0.5">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, rsiLimitLower: Math.max(0, Math.min(100, (f.rsiLimitLower ?? 30) - 1)) } : f))} className="stepper-btn">−</StepperButton>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.rsiLimitLower}</span>
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, rsiLimitLower: Math.max(0, Math.min(100, (f.rsiLimitLower ?? 30) + 1)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <ColorPaletteCombobox value={editForm.rsiLimitColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, rsiLimitColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                    <Combobox value={editForm.rsiLimitLineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, rsiLimitLineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                    <Combobox value={editForm.rsiLimitLineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, rsiLimitLineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle} />
                  </div>
                </div>
              )}
            </>
          )}
          {ind.type === "MFI" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editForm.mfiFixedScale} onChange={(e) => setEditForm((f) => (f ? { ...f, mfiFixedScale: e.target.checked } : f))} className="rounded border-zinc-300" />
              <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).mfiFixedScaleLabel ?? "Escala fixa 0–100 no eixo Y"}</span>
            </label>
          )}
          {ind.type === "MFI" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.mfiCenterLine} onChange={(e) => setEditForm((f) => (f ? { ...f, mfiCenterLine: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).mfiCenterLineLabel ?? "Linha central 50%"}</span>
              </label>
              {editForm.mfiCenterLine && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <ColorPaletteCombobox value={editForm.mfiCenterLineColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, mfiCenterLineColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                    <Combobox value={editForm.mfiCenterLineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, mfiCenterLineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                    <Combobox value={editForm.mfiCenterLineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, mfiCenterLineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle} />
                  </div>
                </div>
              )}
            </>
          )}
          {ind.type === "MFI" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.mfiLimits} onChange={(e) => setEditForm((f) => (f ? { ...f, mfiLimits: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).mfiLimitsLabel ?? "Limites superior e inferior"}</span>
              </label>
              {editForm.mfiLimits && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).mfiLimitUpperLabel ?? "Superior %"}</span>
                    <div className="flex items-center gap-0.5">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, mfiLimitUpper: Math.max(0, Math.min(100, (f.mfiLimitUpper ?? 80) - 1)) } : f))} className="stepper-btn">−</StepperButton>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.mfiLimitUpper}</span>
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, mfiLimitUpper: Math.max(0, Math.min(100, (f.mfiLimitUpper ?? 80) + 1)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).mfiLimitLowerLabel ?? "Inferior %"}</span>
                    <div className="flex items-center gap-0.5">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, mfiLimitLower: Math.max(0, Math.min(100, (f.mfiLimitLower ?? 20) - 1)) } : f))} className="stepper-btn">−</StepperButton>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.mfiLimitLower}</span>
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, mfiLimitLower: Math.max(0, Math.min(100, (f.mfiLimitLower ?? 20) + 1)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <ColorPaletteCombobox value={editForm.mfiLimitColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, mfiLimitColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                    <Combobox value={editForm.mfiLimitLineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, mfiLimitLineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                    <Combobox value={editForm.mfiLimitLineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, mfiLimitLineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle} />
                  </div>
                </div>
              )}
            </>
          )}
          {ind.type === "ADX" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.adxFixedScale} onChange={(e) => setEditForm((f) => (f ? { ...f, adxFixedScale: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).adxFixedScaleLabel ?? "Escala fixa 0–100 no eixo Y"}</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).adxPlusDiLabel ?? "+DI"}</span>
                <ColorPaletteCombobox value={editForm.adxPlusDiColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, adxPlusDiColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).adxPlusDiLabel ?? "+DI"} />
                <Combobox value={editForm.adxPlusDiLineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, adxPlusDiLineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth} />
                <Combobox value={editForm.adxPlusDiLineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, adxPlusDiLineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).adxMinusDiLabel ?? "-DI"}</span>
                <ColorPaletteCombobox value={editForm.adxMinusDiColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, adxMinusDiColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).adxMinusDiLabel ?? "-DI"} />
                <Combobox value={editForm.adxMinusDiLineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, adxMinusDiLineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth} />
                <Combobox value={editForm.adxMinusDiLineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, adxMinusDiLineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).adxLineLabel ?? "ADX"}</span>
                <ColorPaletteCombobox value={editForm.adxAdxColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, adxAdxColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).adxLineLabel ?? "ADX"} />
                <Combobox value={editForm.adxAdxLineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, adxAdxLineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth} />
                <Combobox value={editForm.adxAdxLineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, adxAdxLineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.adxLimits} onChange={(e) => setEditForm((f) => (f ? { ...f, adxLimits: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).adxLimitsLabel ?? "Limites superior e inferior"}</span>
              </label>
              {editForm.adxLimits && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).adxLimitUpperLabel ?? "Superior"}</span>
                    <div className="flex items-center gap-0.5">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, adxLimitUpper: Math.max(0, Math.min(100, (f.adxLimitUpper ?? 25) - 1)) } : f))} className="stepper-btn">−</StepperButton>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.adxLimitUpper}</span>
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, adxLimitUpper: Math.max(0, Math.min(100, (f.adxLimitUpper ?? 25) + 1)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).adxLimitLowerLabel ?? "Inferior"}</span>
                    <div className="flex items-center gap-0.5">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, adxLimitLower: Math.max(0, Math.min(100, (f.adxLimitLower ?? 20) - 1)) } : f))} className="stepper-btn">−</StepperButton>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.adxLimitLower}</span>
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, adxLimitLower: Math.max(0, Math.min(100, (f.adxLimitLower ?? 20) + 1)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <ColorPaletteCombobox value={editForm.adxLimitColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, adxLimitColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                    <Combobox value={editForm.adxLimitLineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, adxLimitLineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                    <Combobox value={editForm.adxLimitLineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, adxLimitLineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle} />
                  </div>
                </div>
              )}
            </>
          )}
          {ind.type === "CCI" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.cciAsHistogram} onChange={(e) => setEditForm((f) => (f ? { ...f, cciAsHistogram: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).cciAsHistogramLabel ?? "Exibir como histograma"}</span>
              </label>
              {editForm.cciAsHistogram && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdHistogramColorAbove ?? "Cor acima de 0"}</span>
                    <ColorPaletteCombobox value={editForm.cciHistogramColorAbove} onChange={(hex) => setEditForm((f) => (f ? { ...f, cciHistogramColorAbove: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).macdHistogramColorAbove ?? "Cor acima"} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo de 0"}</span>
                    <ColorPaletteCombobox value={editForm.cciHistogramColorBelow} onChange={(hex) => setEditForm((f) => (f ? { ...f, cciHistogramColorBelow: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo"} />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.cciLimits} onChange={(e) => setEditForm((f) => (f ? { ...f, cciLimits: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).cciLimitsLabel ?? "Limites -100 a 100"}</span>
              </label>
              {editForm.cciLimits && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).cciLimitUpperLabel ?? "Superior"}</span>
                    <div className="flex items-center gap-1">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, cciLimitUpper: Math.max(-500, Math.min(500, (f.cciLimitUpper ?? 100) - 10)) } : f))} className="stepper-btn">−</StepperButton>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.cciLimitUpper}</span>
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, cciLimitUpper: Math.max(-500, Math.min(500, (f.cciLimitUpper ?? 100) + 10)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).cciLimitLowerLabel ?? "Inferior"}</span>
                    <div className="flex items-center gap-1">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, cciLimitLower: Math.max(-500, Math.min(500, (f.cciLimitLower ?? -100) - 10)) } : f))} className="stepper-btn">−</StepperButton>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.cciLimitLower}</span>
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, cciLimitLower: Math.max(-500, Math.min(500, (f.cciLimitLower ?? -100) + 10)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <ColorPaletteCombobox value={editForm.cciLimitColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, cciLimitColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                    <Combobox value={editForm.cciLimitLineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, cciLimitLineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                    <Combobox value={editForm.cciLimitLineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, cciLimitLineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle} />
                  </div>
                </div>
              )}
            </>
          )}
          {ind.type === "CMF" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.cmfFixedScale} onChange={(e) => setEditForm((f) => (f ? { ...f, cmfFixedScale: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).cmfFixedScaleLabel ?? "Escala fixa -1 a 1 no eixo Y"}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.cmfAsHistogram} onChange={(e) => setEditForm((f) => (f ? { ...f, cmfAsHistogram: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).cmfAsHistogramLabel ?? "Exibir como histograma"}</span>
              </label>
              {editForm.cmfAsHistogram && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdHistogramColorAbove ?? "Cor acima de 0"}</span>
                    <ColorPaletteCombobox value={editForm.cmfHistogramColorAbove} onChange={(hex) => setEditForm((f) => (f ? { ...f, cmfHistogramColorAbove: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).macdHistogramColorAbove ?? "Cor acima"} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo de 0"}</span>
                    <ColorPaletteCombobox value={editForm.cmfHistogramColorBelow} onChange={(hex) => setEditForm((f) => (f ? { ...f, cmfHistogramColorBelow: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo"} />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.cmfLimits} onChange={(e) => setEditForm((f) => (f ? { ...f, cmfLimits: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).cmfLimitsLabel ?? "Limites -1 a 1"}</span>
              </label>
              {editForm.cmfLimits && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).cmfLimitUpperLabel ?? "Superior"}</span>
                    <div className="flex items-center gap-1">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, cmfLimitUpper: Math.max(-1, Math.min(1, Math.round((f.cmfLimitUpper - 0.05) * 100) / 100)) } : f))} className="stepper-btn">−</StepperButton>
                      <span className="w-10 text-center text-xs tabular-nums">{editForm.cmfLimitUpper.toFixed(2)}</span>
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, cmfLimitUpper: Math.max(-1, Math.min(1, Math.round((f.cmfLimitUpper + 0.05) * 100) / 100)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).cmfLimitLowerLabel ?? "Inferior"}</span>
                    <div className="flex items-center gap-1">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, cmfLimitLower: Math.max(-1, Math.min(1, Math.round((f.cmfLimitLower - 0.05) * 100) / 100)) } : f))} className="stepper-btn">−</StepperButton>
                      <span className="w-10 text-center text-xs tabular-nums">{editForm.cmfLimitLower.toFixed(2)}</span>
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, cmfLimitLower: Math.max(-1, Math.min(1, Math.round((f.cmfLimitLower + 0.05) * 100) / 100)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <ColorPaletteCombobox value={editForm.cmfLimitColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, cmfLimitColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                    <Combobox value={editForm.cmfLimitLineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, cmfLimitLineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                    <Combobox value={editForm.cmfLimitLineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, cmfLimitLineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle} />
                  </div>
                </div>
              )}
            </>
          )}
          {ind.type !== "SAR" && ind.type !== "ADX" && ind.type !== "Ichimoku" && ind.type !== "Bollinger" && ind.type !== "Donchian" && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                <Combobox value={editForm.lineWidth} onChange={(v) => setEditForm((f) => (f ? { ...f, lineWidth: v as IndicatorLineWidth } : f))} options={lineWidthOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineWidth} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                <Combobox value={editForm.lineStyle} onChange={(v) => setEditForm((f) => (f ? { ...f, lineStyle: v as IndicatorLineStyle } : f))} options={lineStyleOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.lineStyle} />
              </div>
            </>
          )}
          {ind.type === "Stochastic" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.stochLimits} onChange={(e) => setEditForm((f) => (f ? { ...f, stochLimits: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).stochLimitsLabel ?? "Limites 0–100"}</span>
              </label>
              {editForm.stochLimits && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).stochLimitUpperLabel ?? "Superior %"}</span>
                    <div className="flex items-center gap-1">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, stochLimitUpper: Math.max(0, Math.min(100, f.stochLimitUpper - 1)) } : f))} className="stepper-btn">−</StepperButton>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.stochLimitUpper}</span>
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, stochLimitUpper: Math.max(0, Math.min(100, f.stochLimitUpper + 1)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).stochLimitLowerLabel ?? "Inferior %"}</span>
                    <div className="flex items-center gap-1">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, stochLimitLower: Math.max(0, Math.min(100, f.stochLimitLower - 1)) } : f))} className="stepper-btn">−</StepperButton>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.stochLimitLower}</span>
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, stochLimitLower: Math.max(0, Math.min(100, f.stochLimitLower + 1)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <ColorPaletteCombobox value={editForm.stochLimitColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, stochLimitColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.stochDLine} onChange={(e) => setEditForm((f) => (f ? { ...f, stochDLine: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).stochDLineLabel ?? "Linha %D"}</span>
              </label>
              {editForm.stochDLine && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).stochDMaLabel ?? "Tipo MM"}</span>
                    <Combobox value={editForm.stochDMaType} onChange={(v) => setEditForm((f) => (f ? { ...f, stochDMaType: v as "SMA" | "EMA" | "WMA" } : f))} options={maTypeOptions} className="flex-1 min-w-0" size="md" aria-label={tRecord.stochDMaLabel ?? "MA"} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).stochDPeriodLabel ?? "Período %D"}</span>
                    <div className="flex items-center gap-1">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, stochDPeriod: Math.max(1, f.stochDPeriod - 1), stochDPeriodText: String(Math.max(1, f.stochDPeriod - 1)) } : f))} className="stepper-btn">−</StepperButton>
                      <input type="text" inputMode="numeric" value={editForm.stochDPeriodText} onChange={(e) => setEditForm((f) => (f ? { ...f, stochDPeriodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.stochDPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 3; setEditForm((f) => (f ? { ...f, stochDPeriod: v, stochDPeriodText: String(v) } : f)); }} className="w-14 text-center tabular-nums text-xs border border-zinc-300 rounded px-2 py-1" />
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, stochDPeriod: Math.min(500, f.stochDPeriod + 1), stochDPeriodText: String(Math.min(500, f.stochDPeriod + 1)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <ColorPaletteCombobox value={editForm.stochDColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, stochDColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
                  </div>
                </div>
              )}
            </>
          )}
          {ind.type === "WilliamsR" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.williamsRLimits} onChange={(e) => setEditForm((f) => (f ? { ...f, williamsRLimits: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).williamsRLimitsLabel ?? "Limites -100 a 0"}</span>
              </label>
              {editForm.williamsRLimits && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).williamsRLimitUpperLabel ?? "Superior"}</span>
                    <div className="flex items-center gap-1">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, williamsRLimitUpper: Math.max(-100, Math.min(0, f.williamsRLimitUpper - 1)) } : f))} className="stepper-btn">−</StepperButton>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.williamsRLimitUpper}</span>
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, williamsRLimitUpper: Math.max(-100, Math.min(0, f.williamsRLimitUpper + 1)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).williamsRLimitLowerLabel ?? "Inferior"}</span>
                    <div className="flex items-center gap-1">
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, williamsRLimitLower: Math.max(-100, Math.min(0, f.williamsRLimitLower - 1)) } : f))} className="stepper-btn">−</StepperButton>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.williamsRLimitLower}</span>
                      <StepperButton onStep={() => setEditForm((f) => (f ? { ...f, williamsRLimitLower: Math.max(-100, Math.min(0, f.williamsRLimitLower + 1)) } : f))} className="stepper-btn">+</StepperButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <ColorPaletteCombobox value={editForm.williamsRLimitColor} onChange={(hex) => setEditForm((f) => (f ? { ...f, williamsRLimitColor: hex } : f))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
                  </div>
                </div>
              )}
            </>
          )}
          <div className="flex gap-2 pt-1">
<button type="button" onClick={saveEdit} className="flex-1 py-1.5 rounded bg-zinc-800 text-white text-xs font-medium">
                  {(t as Record<string, string>).saveIndicator ?? "Save"}
                </button>
                <button type="button" onClick={cancelEdit} className="flex-1 py-1.5 rounded border border-zinc-300 text-zinc-700 text-xs font-medium">
                  {(t as Record<string, string>).cancel ?? "Cancel"}
                </button>
          </div>
        </div>
      )}
    </div>
  );
}
