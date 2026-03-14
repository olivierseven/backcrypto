"use client";

import { useState } from "react";
import type { UserIndicatorConfig, IndicatorPanel, IndicatorFieldKey, IndicatorLineWidth, IndicatorLineStyle } from "../KlinesIndicatorsContext";
import { useIndicatorsPanelContext } from "./IndicatorsPanelContext";

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

  const panel = ind.panel ?? (ind.type === "RSI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "ATR" || ind.type === "ADX" || ind.type === "CCI" || ind.type === "Volume" ? "panel2" : "main");
  const panelNum = panel === "panel2" ? "2" : panel === "panel3" ? "3" : panel === "panel4" ? "4" : panel === "panel5" ? "5" : null;
  const [bollingerLimitsColorOpen, setBollingerLimitsColorOpen] = useState(false);

  return (
    <div className="rounded border border-zinc-200 p-2 space-y-1.5 bg-zinc-50/50">
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 rounded shrink-0 border border-zinc-300" style={{ backgroundColor: ind.color }} />
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
            : ind.intervals.map((v) => INTERVAL_OPTIONS.find((o) => o.value === v)?.label ?? v).join(", ")}
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
          <div className="text-[10px] font-medium text-zinc-600">{t.showOn}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, intervals: [] } : f))} className="text-[10px] text-zinc-600 hover:underline">
              {t.allIntervals}
            </button>
            <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, intervals: [0] } : f))} className="text-[10px] text-zinc-600 hover:underline">
              {(t as Record<string, string>).noIntervals ?? "Nenhum"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {INTERVAL_OPTIONS.map((opt) => {
              const formIntervals = editForm.intervals ?? [];
              const isNone = formIntervals.length === 1 && formIntervals[0] === 0;
              const isAll = formIntervals.length === 0;
              const checked = isAll || (!isNone && formIntervals.includes(opt.value));
              return (
                <label key={opt.value} className="inline-flex items-center gap-1 text-[10px]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setEditForm((f) => {
                        if (!f) return f;
                        const fi = f.intervals ?? [];
                        const fIsNone = fi.length === 1 && fi[0] === 0;
                        const fIsAll = fi.length === 0;
                        const current = fIsNone ? [] : fIsAll ? INTERVAL_OPTIONS.map((o) => o.value) : [...fi].filter((x) => x !== 0);
                        const next = current.includes(opt.value) ? current.filter((x) => x !== opt.value) : [...current, opt.value].sort((a, b) => a - b);
                        return { ...f, intervals: next.length === 0 ? [0] : next.length === INTERVAL_OPTIONS.length ? [] : next };
                      });
                    }}
                    className="rounded border-zinc-300"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.chartOption}</span>
            {ind.type === "SAR" || ind.type === "VWAP" || ind.type === "Bollinger" || ind.type === "Donchian" || ind.type === "HMA" || ind.type === "VWMA" ? (
              <span className="text-xs text-zinc-700">{(t as Record<string, string>).chartOptionMain ?? "Main"}</span>
            ) : (
              <select
                value={editForm.panel}
                onChange={(e) => setEditForm((f) => (f ? { ...f, panel: e.target.value as IndicatorPanel } : f))}
                className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white"
              >
                {ind.type === "RSI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "ATR" || ind.type === "ADX" || ind.type === "CCI" || ind.type === "Volume" ? (
                  <>
                    {panelsFreeForSecondaryEdit.panel2 && <option value="panel2">{(t as Record<string, string>).chartOptionPanel2 ?? "Panel 2"}</option>}
                    {panelsFreeForSecondaryEdit.panel3 && <option value="panel3">{(t as Record<string, string>).chartOptionPanel3 ?? "Panel 3"}</option>}
                    {panelsFreeForSecondaryEdit.panel4 && <option value="panel4">{(t as Record<string, string>).chartOptionPanel4 ?? "Panel 4"}</option>}
                    {panelsFreeForSecondaryEdit.panel5 && <option value="panel5">{(t as Record<string, string>).chartOptionPanel5 ?? "Panel 5"}</option>}
                  </>
                ) : (
                  <>
                    <option value="main" disabled={indicatorCountByPanel.main >= MAIN_MAX_INDICATORS && editForm.panel !== "main"}>{(t as Record<string, string>).chartOptionMain ?? "Main"}</option>
                    <option value="panel2" disabled={indicatorCountByPanel.panel2 >= SECONDARY_MAX_INDICATORS && editForm.panel !== "panel2"}>{(t as Record<string, string>).chartOptionPanel2 ?? "Panel 2"}</option>
                    <option value="panel3" disabled={(indicatorCountByPanel.panel3 >= SECONDARY_MAX_INDICATORS && editForm.panel !== "panel3") || isFreeUser}>{isFreeUser ? "🔒 " : ""}{(t as Record<string, string>).chartOptionPanel3 ?? "Panel 3"}</option>
                    <option value="panel4" disabled={(indicatorCountByPanel.panel4 >= SECONDARY_MAX_INDICATORS && editForm.panel !== "panel4") || isFreeUser}>{isFreeUser ? "🔒 " : ""}{(t as Record<string, string>).chartOptionPanel4 ?? "Panel 4"}</option>
                    <option value="panel5" disabled={(indicatorCountByPanel.panel5 >= SECONDARY_MAX_INDICATORS && editForm.panel !== "panel5") || isFreeUser}>{isFreeUser ? "🔒 " : ""}{(t as Record<string, string>).chartOptionPanel5 ?? "Panel 5"}</option>
                  </>
                )}
              </select>
            )}
          </div>
          {ind.type === "MACD" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdFastMa ?? "Média rápida"}</span>
                <select value={editForm.macdFastMaType} onChange={(e) => setEditForm((f) => (f ? { ...f, macdFastMaType: e.target.value as "SMA" | "EMA" | "WMA" } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="SMA">SMA</option>
                  <option value="EMA">EMA</option>
                  <option value="WMA">WMA</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdFastPeriod ?? "Período rápido"}</span>
                <div className="flex-1 flex items-center gap-1">
                  <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, macdFastPeriod: Math.max(1, f.macdFastPeriod - 1), macdFastPeriodText: String(Math.max(1, f.macdFastPeriod - 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">−</button>
                  <input type="text" inputMode="numeric" value={editForm.macdFastPeriodText} onChange={(e) => setEditForm((f) => (f ? { ...f, macdFastPeriodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.macdFastPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 12; setEditForm((f) => (f ? { ...f, macdFastPeriod: v, macdFastPeriodText: String(v) } : f)); }} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1" />
                  <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, macdFastPeriod: Math.min(500, f.macdFastPeriod + 1), macdFastPeriodText: String(Math.min(500, f.macdFastPeriod + 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdSlowMa ?? "Média lenta"}</span>
                <select value={editForm.macdSlowMaType} onChange={(e) => setEditForm((f) => (f ? { ...f, macdSlowMaType: e.target.value as "SMA" | "EMA" | "WMA" } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="SMA">SMA</option>
                  <option value="EMA">EMA</option>
                  <option value="WMA">WMA</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdSlowPeriod ?? "Período lento"}</span>
                <div className="flex-1 flex items-center gap-1">
                  <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, macdSlowPeriod: Math.max(1, f.macdSlowPeriod - 1), macdSlowPeriodText: String(Math.max(1, f.macdSlowPeriod - 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">−</button>
                  <input type="text" inputMode="numeric" value={editForm.macdSlowPeriodText} onChange={(e) => setEditForm((f) => (f ? { ...f, macdSlowPeriodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.macdSlowPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 26; setEditForm((f) => (f ? { ...f, macdSlowPeriod: v, macdSlowPeriodText: String(v) } : f)); }} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1" />
                  <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, macdSlowPeriod: Math.min(500, f.macdSlowPeriod + 1), macdSlowPeriodText: String(Math.min(500, f.macdSlowPeriod + 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">+</button>
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
                    <select value={editForm.macdSignalMaType} onChange={(e) => setEditForm((f) => (f ? { ...f, macdSignalMaType: e.target.value as "SMA" | "EMA" | "WMA" } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                      <option value="SMA">SMA</option>
                      <option value="EMA">EMA</option>
                      <option value="WMA">WMA</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdSignalPeriod ?? "Período sinal"}</span>
                    <div className="flex-1 flex items-center gap-1">
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, macdSignalPeriod: Math.max(1, f.macdSignalPeriod - 1), macdSignalPeriodText: String(Math.max(1, f.macdSignalPeriod - 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">−</button>
                      <input type="text" inputMode="numeric" value={editForm.macdSignalPeriodText} onChange={(e) => setEditForm((f) => (f ? { ...f, macdSignalPeriodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.macdSignalPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 9; setEditForm((f) => (f ? { ...f, macdSignalPeriod: v, macdSignalPeriodText: String(v) } : f)); }} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1" />
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, macdSignalPeriod: Math.min(500, f.macdSignalPeriod + 1), macdSignalPeriodText: String(Math.min(500, f.macdSignalPeriod + 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <div className="flex flex-wrap gap-1">
                      {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                        <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, macdSignalColor: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.macdSignalColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                    <select value={editForm.macdSignalLineWidth} onChange={(e) => setEditForm((f) => (f ? { ...f, macdSignalLineWidth: e.target.value as IndicatorLineWidth } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                      <option value="thin">{(t as Record<string, string>).lineWidthThin}</option>
                      <option value="normal">{(t as Record<string, string>).lineWidthNormal}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                    <select value={editForm.macdSignalLineStyle} onChange={(e) => setEditForm((f) => (f ? { ...f, macdSignalLineStyle: e.target.value as IndicatorLineStyle } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                      <option value="solid">{(t as Record<string, string>).lineStyleSolid}</option>
                      <option value="dotted">{(t as Record<string, string>).lineStyleDotted}</option>
                      <option value="dashed">{(t as Record<string, string>).lineStyleDashed}</option>
                    </select>
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
                    <div className="flex flex-wrap gap-1">
                      {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                        <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, macdHistogramColorAbove: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.macdHistogramColorAbove === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo de 0"}</span>
                    <div className="flex flex-wrap gap-1">
                      {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                        <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, macdHistogramColorBelow: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.macdHistogramColorBelow === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : ind.type === "Bollinger" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.field}</span>
                <select value={editForm.fieldKey} onChange={(e) => setEditForm((f) => (f ? { ...f, fieldKey: e.target.value as IndicatorFieldKey } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  {visibleForEdit.map((opt) => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.period}</span>
                <div className="flex-1 flex items-center gap-1">
                  <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, period: Math.max(1, f.period - 1), periodText: String(Math.max(1, f.period - 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">−</button>
                  <input type="text" inputMode="numeric" value={editForm.periodText} onChange={(e) => setEditForm((f) => (f ? { ...f, periodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.periodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 20; setEditForm((f) => (f ? { ...f, period: v, periodText: String(v) } : f)); }} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1" />
                  <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, period: Math.min(500, f.period + 1), periodText: String(Math.min(500, f.period + 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).bollingerMaType ?? "Média móvel"}</span>
                <select value={editForm.bollingerMaType} onChange={(e) => setEditForm((f) => (f ? { ...f, bollingerMaType: e.target.value as "SMA" | "EMA" | "WMA" } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="SMA">SMA</option>
                  <option value="EMA">EMA</option>
                  <option value="WMA">WMA</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).bollingerZ ?? "Z (0–3)"}</span>
                <input type="text" inputMode="decimal" value={editForm.bollingerZText} onChange={(e) => setEditForm((f) => (f ? { ...f, bollingerZText: e.target.value } : f))} onBlur={() => { const n = parseFloat(editForm.bollingerZText); const v = Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 2; setEditForm((f) => (f ? { ...f, bollingerZ: v, bollingerZText: String(v) } : f)); }} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.bollingerShowUpper} onChange={(e) => setEditForm((f) => (f ? { ...f, bollingerShowUpper: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).bollingerShowUpper ?? "Banda sup."}</label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.bollingerShowLower} onChange={(e) => setEditForm((f) => (f ? { ...f, bollingerShowLower: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).bollingerShowLower ?? "Banda inf."}</label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.bollingerShowMiddle} onChange={(e) => setEditForm((f) => (f ? { ...f, bollingerShowMiddle: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).bollingerShowMiddle ?? "Média"}</label>
              </div>
              <div className="flex items-center gap-2 relative">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).bollingerLimitsColor ?? "Cor bandas"}</span>
                <button
                  type="button"
                  onClick={() => setBollingerLimitsColorOpen((o) => !o)}
                  className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white flex items-center justify-between gap-1"
                  aria-label={(t as Record<string, string>).bollingerLimitsColor ?? "Cor bandas"}
                  aria-expanded={bollingerLimitsColorOpen}
                >
                  <span className="w-4 h-4 rounded border border-zinc-300 shrink-0" style={{ backgroundColor: editForm.bollingerLimitsColor }} />
                  <span className="text-zinc-500 text-[10px]">▾</span>
                </button>
                {bollingerLimitsColorOpen && (
                  <>
                    <div className="fixed inset-0 z-30" aria-hidden onClick={() => setBollingerLimitsColorOpen(false)} />
                    <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-40 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg p-1.5">
                      <div className="grid grid-cols-3 gap-1.5">
                        {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => { setEditForm((f) => (f ? { ...f, bollingerLimitsColor: hex } : f)); setBollingerLimitsColorOpen(false); }}
                            className={`w-8 h-8 rounded border-2 ${editForm.bollingerLimitsColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
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
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura bandas"}</span>
                <select value={editForm.bollingerLimitsLineWidth} onChange={(e) => setEditForm((f) => (f ? { ...f, bollingerLimitsLineWidth: e.target.value as IndicatorLineWidth } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Fino"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo bandas"}</span>
                <select value={editForm.bollingerLimitsLineStyle} onChange={(e) => setEditForm((f) => (f ? { ...f, bollingerLimitsLineStyle: e.target.value as IndicatorLineStyle } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Sólido"}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Pontilhado"}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Tracejado"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, color: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.color === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura média"}</span>
                <select value={editForm.lineWidth} onChange={(e) => setEditForm((f) => (f ? { ...f, lineWidth: e.target.value as IndicatorLineWidth } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Fino"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo média"}</span>
                <select value={editForm.lineStyle} onChange={(e) => setEditForm((f) => (f ? { ...f, lineStyle: e.target.value as IndicatorLineStyle } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Sólido"}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Pontilhado"}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Tracejado"}</option>
                </select>
              </div>
            </>
          ) : ind.type === "Donchian" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.period}</span>
                <div className="flex-1 flex items-center gap-1">
                  <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, period: Math.max(1, f.period - 1), periodText: String(Math.max(1, f.period - 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">−</button>
                  <input type="text" inputMode="numeric" value={editForm.periodText} onChange={(e) => setEditForm((f) => (f ? { ...f, periodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.periodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 20; setEditForm((f) => (f ? { ...f, period: v, periodText: String(v) } : f)); }} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1" />
                  <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, period: Math.min(500, f.period + 1), periodText: String(Math.min(500, f.period + 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.donchianShowUpper} onChange={(e) => setEditForm((f) => (f ? { ...f, donchianShowUpper: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).donchianShowUpper ?? "Canal sup."}</label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.donchianShowLower} onChange={(e) => setEditForm((f) => (f ? { ...f, donchianShowLower: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).donchianShowLower ?? "Canal inf."}</label>
                <label className="flex items-center gap-1.5 text-[10px] text-zinc-600"><input type="checkbox" checked={editForm.donchianShowMiddle} onChange={(e) => setEditForm((f) => (f ? { ...f, donchianShowMiddle: e.target.checked } : f))} className="rounded" />{(t as Record<string, string>).donchianShowMiddle ?? "Linha meio"}</label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).donchianBandOpacity ?? "Opacidade"}</span>
                <input type="text" inputMode="numeric" value={editForm.donchianBandOpacityText} onChange={(e) => setEditForm((f) => (f ? { ...f, donchianBandOpacityText: e.target.value } : f))} onBlur={() => { const n = parseInt(editForm.donchianBandOpacityText, 10); const v = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 20; setEditForm((f) => (f ? { ...f, donchianBandOpacity: v / 100, donchianBandOpacityText: String(v) } : f)); }} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).donchianLimitsColor ?? "Cor canais"}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, donchianLimitsColor: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.donchianLimitsColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                <select value={editForm.donchianLimitsLineWidth} onChange={(e) => setEditForm((f) => (f ? { ...f, donchianLimitsLineWidth: e.target.value as IndicatorLineWidth } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal}</option>
                </select>
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                <select value={editForm.donchianLimitsLineStyle} onChange={(e) => setEditForm((f) => (f ? { ...f, donchianLimitsLineStyle: e.target.value as IndicatorLineStyle } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).donchianMiddleColor ?? "Cor linha meio"}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, donchianMiddleColor: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.donchianMiddleColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
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
                  className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1"
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
                  className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1"
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
                  className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).sarPointSize ?? "Tamanho do ponto"}</span>
                <select value={editForm.sarPointSize} onChange={(e) => setEditForm((f) => (f ? { ...f, sarPointSize: e.target.value as "thin" | "normal" } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Fino"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
              </div>
            </>
          ) : ind.type === "Stochastic" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.period}</span>
                <div className="flex-1 flex items-center gap-1">
                  <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, period: Math.max(1, f.period - 1), periodText: String(Math.max(1, f.period - 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">−</button>
                  <input type="text" inputMode="numeric" value={editForm.periodText} onChange={(e) => setEditForm((f) => (f ? { ...f, periodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.periodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 14; setEditForm((f) => (f ? { ...f, period: v, periodText: String(v) } : f)); }} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1" />
                  <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, period: Math.min(500, f.period + 1), periodText: String(Math.min(500, f.period + 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">+</button>
                </div>
              </div>
            </>
          ) : ind.type === "WilliamsR" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.period}</span>
                <div className="flex-1 flex items-center gap-1">
                  <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, period: Math.max(1, f.period - 1), periodText: String(Math.max(1, f.period - 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">−</button>
                  <input type="text" inputMode="numeric" value={editForm.periodText} onChange={(e) => setEditForm((f) => (f ? { ...f, periodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.periodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 14; setEditForm((f) => (f ? { ...f, period: v, periodText: String(v) } : f)); }} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1" />
                  <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, period: Math.min(500, f.period + 1), periodText: String(Math.min(500, f.period + 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">+</button>
                </div>
              </div>
            </>
          ) : ind.type === "OBV" ? null : (
          <>
          {ind.type !== "ATR" && ind.type !== "ADX" && ind.type !== "VWAP" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.field}</span>
              <select
                value={editFieldValue}
                onChange={(e) => {
                  const newKey = e.target.value as IndicatorFieldKey;
                  setEditForm((f) => (f ? { ...f, fieldKey: newKey } : f));
                }}
                className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white"
              >
                {visibleForEdit.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {ind.type !== "VWAP" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.period}</span>
              <div className="flex-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(1, Math.min(500, (editForm.period ?? 7) - 1));
                    setEditForm((f) => (f ? { ...f, period: next, periodText: String(next) } : f));
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm"
                >
                  −
                </button>
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
                  className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(1, Math.min(500, (editForm.period ?? 7) + 1));
                    setEditForm((f) => (f ? { ...f, period: next, periodText: String(next) } : f));
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm"
                >
                  +
                </button>
              </div>
            </div>
          )}
          </>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
            <div className="flex-1 flex flex-wrap gap-1">
              {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setEditForm((f) => (f ? { ...f, color: hex } : f))}
                  className={`w-6 h-6 rounded border shrink-0 ${editForm.color === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.chartOption}</span>
            {ind.type === "SAR" || ind.type === "VWAP" || ind.type === "Bollinger" || ind.type === "Donchian" || ind.type === "HMA" || ind.type === "VWMA" ? (
              <span className="text-xs text-zinc-700">{(t as Record<string, string>).chartOptionMain ?? "Main"}</span>
            ) : (
              <select
                value={editForm.panel}
                onChange={(e) => setEditForm((f) => (f ? { ...f, panel: e.target.value as IndicatorPanel } : f))}
                className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white"
              >
                {ind.type === "RSI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "ATR" || ind.type === "ADX" || ind.type === "CCI" || ind.type === "Volume" ? (
                  <>
                    {panelsFreeForSecondaryEdit.panel2 && <option value="panel2">{(t as Record<string, string>).chartOptionPanel2 ?? "Panel 2"}</option>}
                    {panelsFreeForSecondaryEdit.panel3 && <option value="panel3">{(t as Record<string, string>).chartOptionPanel3 ?? "Panel 3"}</option>}
                    {panelsFreeForSecondaryEdit.panel4 && <option value="panel4">{(t as Record<string, string>).chartOptionPanel4 ?? "Panel 4"}</option>}
                    {panelsFreeForSecondaryEdit.panel5 && <option value="panel5">{(t as Record<string, string>).chartOptionPanel5 ?? "Panel 5"}</option>}
                  </>
                ) : (
                  <>
                    <option value="main" disabled={indicatorCountByPanel.main >= MAIN_MAX_INDICATORS && editForm.panel !== "main"}>{(t as Record<string, string>).chartOptionMain ?? "Main"}</option>
                    <option value="panel2" disabled={indicatorCountByPanel.panel2 >= SECONDARY_MAX_INDICATORS && editForm.panel !== "panel2"}>{(t as Record<string, string>).chartOptionPanel2 ?? "Panel 2"}</option>
                    <option value="panel3" disabled={(indicatorCountByPanel.panel3 >= SECONDARY_MAX_INDICATORS && editForm.panel !== "panel3") || isFreeUser}>{isFreeUser ? "🔒 " : ""}{(t as Record<string, string>).chartOptionPanel3 ?? "Panel 3"}</option>
                    <option value="panel4" disabled={(indicatorCountByPanel.panel4 >= SECONDARY_MAX_INDICATORS && editForm.panel !== "panel4") || isFreeUser}>{isFreeUser ? "🔒 " : ""}{(t as Record<string, string>).chartOptionPanel4 ?? "Panel 4"}</option>
                    <option value="panel5" disabled={(indicatorCountByPanel.panel5 >= SECONDARY_MAX_INDICATORS && editForm.panel !== "panel5") || isFreeUser}>{isFreeUser ? "🔒 " : ""}{(t as Record<string, string>).chartOptionPanel5 ?? "Panel 5"}</option>
                  </>
                )}
              </select>
            )}
          </div>
          {ind.type === "Volume" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.volumeInUsdt} onChange={(e) => setEditForm((f) => (f ? { ...f, volumeInUsdt: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).volumeInUsdtLabel ?? "Exibir em USDT"}</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).volumeColorPositive ?? "Cor positivo"}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, volumeColorAbove: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.volumeColorAbove === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} aria-label={hex} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).volumeColorNegative ?? "Cor negativo"}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, volumeColorBelow: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.volumeColorBelow === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} aria-label={hex} />
                  ))}
                </div>
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
                    <div className="flex flex-wrap gap-1">
                      {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                        <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, rsiCenterLineColor: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.rsiCenterLineColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                    <select value={editForm.rsiCenterLineWidth} onChange={(e) => setEditForm((f) => (f ? { ...f, rsiCenterLineWidth: e.target.value as IndicatorLineWidth } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                      <option value="thin">{(t as Record<string, string>).lineWidthThin}</option>
                      <option value="normal">{(t as Record<string, string>).lineWidthNormal}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                    <select value={editForm.rsiCenterLineStyle} onChange={(e) => setEditForm((f) => (f ? { ...f, rsiCenterLineStyle: e.target.value as IndicatorLineStyle } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
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
                <input type="checkbox" checked={editForm.rsiLimits} onChange={(e) => setEditForm((f) => (f ? { ...f, rsiLimits: e.target.checked } : f))} className="rounded border-zinc-300" />
                <span className="text-[10px] text-zinc-700">{(t as Record<string, string>).rsiLimitsLabel ?? "Limites superior e inferior"}</span>
              </label>
              {editForm.rsiLimits && (
                <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).rsiLimitUpperLabel ?? "Superior %"}</span>
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, rsiLimitUpper: Math.max(0, Math.min(100, (f.rsiLimitUpper ?? 70) - 1)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">−</button>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.rsiLimitUpper}</span>
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, rsiLimitUpper: Math.max(0, Math.min(100, (f.rsiLimitUpper ?? 70) + 1)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).rsiLimitLowerLabel ?? "Inferior %"}</span>
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, rsiLimitLower: Math.max(0, Math.min(100, (f.rsiLimitLower ?? 30) - 1)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">−</button>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.rsiLimitLower}</span>
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, rsiLimitLower: Math.max(0, Math.min(100, (f.rsiLimitLower ?? 30) + 1)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <div className="flex flex-wrap gap-1">
                      {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                        <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, rsiLimitColor: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.rsiLimitColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                    <select value={editForm.rsiLimitLineWidth} onChange={(e) => setEditForm((f) => (f ? { ...f, rsiLimitLineWidth: e.target.value as IndicatorLineWidth } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                      <option value="thin">{(t as Record<string, string>).lineWidthThin}</option>
                      <option value="normal">{(t as Record<string, string>).lineWidthNormal}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                    <select value={editForm.rsiLimitLineStyle} onChange={(e) => setEditForm((f) => (f ? { ...f, rsiLimitLineStyle: e.target.value as IndicatorLineStyle } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                      <option value="solid">{(t as Record<string, string>).lineStyleSolid}</option>
                      <option value="dotted">{(t as Record<string, string>).lineStyleDotted}</option>
                      <option value="dashed">{(t as Record<string, string>).lineStyleDashed}</option>
                    </select>
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
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, adxPlusDiColor: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.adxPlusDiColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
                <select value={editForm.adxPlusDiLineWidth} onChange={(e) => setEditForm((f) => (f ? { ...f, adxPlusDiLineWidth: e.target.value as IndicatorLineWidth } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal}</option>
                </select>
                <select value={editForm.adxPlusDiLineStyle} onChange={(e) => setEditForm((f) => (f ? { ...f, adxPlusDiLineStyle: e.target.value as IndicatorLineStyle } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).adxMinusDiLabel ?? "-DI"}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, adxMinusDiColor: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.adxMinusDiColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
                <select value={editForm.adxMinusDiLineWidth} onChange={(e) => setEditForm((f) => (f ? { ...f, adxMinusDiLineWidth: e.target.value as IndicatorLineWidth } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal}</option>
                </select>
                <select value={editForm.adxMinusDiLineStyle} onChange={(e) => setEditForm((f) => (f ? { ...f, adxMinusDiLineStyle: e.target.value as IndicatorLineStyle } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).adxLineLabel ?? "ADX"}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, adxAdxColor: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.adxAdxColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
                <select value={editForm.adxAdxLineWidth} onChange={(e) => setEditForm((f) => (f ? { ...f, adxAdxLineWidth: e.target.value as IndicatorLineWidth } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal}</option>
                </select>
                <select value={editForm.adxAdxLineStyle} onChange={(e) => setEditForm((f) => (f ? { ...f, adxAdxLineStyle: e.target.value as IndicatorLineStyle } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed}</option>
                </select>
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
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, adxLimitUpper: Math.max(0, Math.min(100, (f.adxLimitUpper ?? 25) - 1)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">−</button>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.adxLimitUpper}</span>
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, adxLimitUpper: Math.max(0, Math.min(100, (f.adxLimitUpper ?? 25) + 1)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).adxLimitLowerLabel ?? "Inferior"}</span>
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, adxLimitLower: Math.max(0, Math.min(100, (f.adxLimitLower ?? 20) - 1)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">−</button>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.adxLimitLower}</span>
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, adxLimitLower: Math.max(0, Math.min(100, (f.adxLimitLower ?? 20) + 1)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <div className="flex flex-wrap gap-1">
                      {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                        <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, adxLimitColor: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.adxLimitColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                    <select value={editForm.adxLimitLineWidth} onChange={(e) => setEditForm((f) => (f ? { ...f, adxLimitLineWidth: e.target.value as IndicatorLineWidth } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                      <option value="thin">{(t as Record<string, string>).lineWidthThin}</option>
                      <option value="normal">{(t as Record<string, string>).lineWidthNormal}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                    <select value={editForm.adxLimitLineStyle} onChange={(e) => setEditForm((f) => (f ? { ...f, adxLimitLineStyle: e.target.value as IndicatorLineStyle } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                      <option value="solid">{(t as Record<string, string>).lineStyleSolid}</option>
                      <option value="dotted">{(t as Record<string, string>).lineStyleDotted}</option>
                      <option value="dashed">{(t as Record<string, string>).lineStyleDashed}</option>
                    </select>
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
                    <div className="flex flex-wrap gap-1">
                      {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                        <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, cciHistogramColorAbove: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.cciHistogramColorAbove === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo de 0"}</span>
                    <div className="flex flex-wrap gap-1">
                      {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                        <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, cciHistogramColorBelow: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.cciHistogramColorBelow === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
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
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, cciLimitUpper: Math.max(-500, Math.min(500, (f.cciLimitUpper ?? 100) - 10)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">−</button>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.cciLimitUpper}</span>
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, cciLimitUpper: Math.max(-500, Math.min(500, (f.cciLimitUpper ?? 100) + 10)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).cciLimitLowerLabel ?? "Inferior"}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, cciLimitLower: Math.max(-500, Math.min(500, (f.cciLimitLower ?? -100) - 10)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">−</button>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.cciLimitLower}</span>
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, cciLimitLower: Math.max(-500, Math.min(500, (f.cciLimitLower ?? -100) + 10)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <div className="flex flex-wrap gap-1">
                      {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                        <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, cciLimitColor: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.cciLimitColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                    <select value={editForm.cciLimitLineWidth} onChange={(e) => setEditForm((f) => (f ? { ...f, cciLimitLineWidth: e.target.value as IndicatorLineWidth } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                      <option value="thin">{(t as Record<string, string>).lineWidthThin}</option>
                      <option value="normal">{(t as Record<string, string>).lineWidthNormal}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                    <select value={editForm.cciLimitLineStyle} onChange={(e) => setEditForm((f) => (f ? { ...f, cciLimitLineStyle: e.target.value as IndicatorLineStyle } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                      <option value="solid">{(t as Record<string, string>).lineStyleSolid}</option>
                      <option value="dotted">{(t as Record<string, string>).lineStyleDotted}</option>
                      <option value="dashed">{(t as Record<string, string>).lineStyleDashed}</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
          {ind.type !== "SAR" && ind.type !== "ADX" && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineWidth}</span>
                <select value={editForm.lineWidth} onChange={(e) => setEditForm((f) => (f ? { ...f, lineWidth: e.target.value as IndicatorLineWidth } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).lineStyle}</span>
                <select value={editForm.lineStyle} onChange={(e) => setEditForm((f) => (f ? { ...f, lineStyle: e.target.value as IndicatorLineStyle } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed}</option>
                </select>
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
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, stochLimitUpper: Math.max(0, Math.min(100, f.stochLimitUpper - 1)) } : f))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600 text-sm">−</button>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.stochLimitUpper}</span>
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, stochLimitUpper: Math.max(0, Math.min(100, f.stochLimitUpper + 1)) } : f))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600 text-sm">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).stochLimitLowerLabel ?? "Inferior %"}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, stochLimitLower: Math.max(0, Math.min(100, f.stochLimitLower - 1)) } : f))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600 text-sm">−</button>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.stochLimitLower}</span>
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, stochLimitLower: Math.max(0, Math.min(100, f.stochLimitLower + 1)) } : f))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600 text-sm">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <div className="flex flex-wrap gap-1">
                      {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                        <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, stochLimitColor: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.stochLimitColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
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
                    <select value={editForm.stochDMaType} onChange={(e) => setEditForm((f) => (f ? { ...f, stochDMaType: e.target.value as "SMA" | "EMA" | "WMA" } : f))} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white">
                      <option value="SMA">SMA</option>
                      <option value="EMA">EMA</option>
                      <option value="WMA">WMA</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).stochDPeriodLabel ?? "Período %D"}</span>
                    <div className="flex-1 flex items-center gap-1">
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, stochDPeriod: Math.max(1, f.stochDPeriod - 1), stochDPeriodText: String(Math.max(1, f.stochDPeriod - 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">−</button>
                      <input type="text" inputMode="numeric" value={editForm.stochDPeriodText} onChange={(e) => setEditForm((f) => (f ? { ...f, stochDPeriodText: e.target.value.replace(/[^\d]/g, "") } : f))} onBlur={() => { const n = Number(editForm.stochDPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 3; setEditForm((f) => (f ? { ...f, stochDPeriod: v, stochDPeriodText: String(v) } : f)); }} className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1" />
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, stochDPeriod: Math.min(500, f.stochDPeriod + 1), stochDPeriodText: String(Math.min(500, f.stochDPeriod + 1)) } : f))} className="w-8 h-8 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 text-sm">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <div className="flex flex-wrap gap-1">
                      {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                        <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, stochDColor: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.stochDColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
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
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, williamsRLimitUpper: Math.max(-100, Math.min(0, f.williamsRLimitUpper - 1)) } : f))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600 text-sm">−</button>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.williamsRLimitUpper}</span>
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, williamsRLimitUpper: Math.max(-100, Math.min(0, f.williamsRLimitUpper + 1)) } : f))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600 text-sm">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).williamsRLimitLowerLabel ?? "Inferior"}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, williamsRLimitLower: Math.max(-100, Math.min(0, f.williamsRLimitLower - 1)) } : f))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600 text-sm">−</button>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.williamsRLimitLower}</span>
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, williamsRLimitLower: Math.max(-100, Math.min(0, f.williamsRLimitLower + 1)) } : f))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600 text-sm">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{t.color}</span>
                    <div className="flex flex-wrap gap-1">
                      {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                        <button key={hex} type="button" onClick={() => setEditForm((f) => (f ? { ...f, williamsRLimitColor: hex } : f))} className={`w-5 h-5 rounded border shrink-0 ${editForm.williamsRLimitColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
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
