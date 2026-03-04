"use client";

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
    isMovingAverageType,
    INDICATOR_COLOR_PALETTE,
    INTERVAL_OPTIONS,
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
    getIndicatorLabel,
  } = useIndicatorsPanelContext();

  const visibleForEdit = fieldOptions.filter(
    (o) => !o.disabled && o.optionType !== ind.type && !(o.isMovingAverage && isMovingAverageType(ind.type))
  );
  const firstForEdit = (visibleForEdit[0]?.value ?? firstEnabledFieldValue) as IndicatorFieldKey;
  const editFieldValue = (visibleForEdit.some((o) => o.value === editForm?.fieldKey) ? editForm!.fieldKey : firstForEdit) as string;

  return (
    <div className="rounded border border-zinc-200 p-2 space-y-1.5 bg-zinc-50/50">
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 rounded shrink-0 border border-zinc-300" style={{ backgroundColor: ind.color }} />
        <span className="text-xs font-medium text-zinc-800 truncate flex-1">{getIndicatorLabel(ind, t, userIndicators)}</span>
        <button type="button" onClick={() => startEdit(ind)} className="text-xs text-zinc-600 hover:underline shrink-0">
          {(t as Record<string, string>).editIndicator ?? "Edit"}
        </button>
        <button type="button" onClick={() => removeIndicator(ind.id)} className="text-xs text-red-600 hover:underline shrink-0">
          {t.removeIndicator}
        </button>
      </div>
      <div className="text-[10px] text-zinc-500">
        {t.showOn}:{" "}
        {ind.intervals.length === 0
          ? t.allIntervals
          : ind.intervals.map((v) => INTERVAL_OPTIONS.find((o) => o.value === v)?.label ?? v).join(", ")}
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
          <button type="button" onClick={() => setAllIntervals(ind.id)} className="block text-[10px] text-zinc-600 hover:underline">
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
          ) : (
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
            <select
              value={editForm.panel}
              onChange={(e) => setEditForm((f) => (f ? { ...f, panel: e.target.value as IndicatorPanel } : f))}
              className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white"
            >
              {ind.type === "RSI" || ind.type === "MACD" ? (
                <>
                  <option value="panel2">{(t as Record<string, string>).chartOptionPanel2 ?? "Panel 2"}</option>
                  <option value="panel3">{(t as Record<string, string>).chartOptionPanel3 ?? "Panel 3"}</option>
                  <option value="panel4">{(t as Record<string, string>).chartOptionPanel4 ?? "Panel 4"}</option>
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
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, rsiLimitUpper: Math.max(0, Math.min(100, (f.rsiLimitUpper ?? 90) - 1)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">−</button>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.rsiLimitUpper}</span>
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, rsiLimitUpper: Math.max(0, Math.min(100, (f.rsiLimitUpper ?? 90) + 1)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{(t as Record<string, string>).rsiLimitLowerLabel ?? "Inferior %"}</span>
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, rsiLimitLower: Math.max(0, Math.min(100, (f.rsiLimitLower ?? 10) - 1)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">−</button>
                      <span className="w-8 text-center text-xs tabular-nums">{editForm.rsiLimitLower}</span>
                      <button type="button" onClick={() => setEditForm((f) => (f ? { ...f, rsiLimitLower: Math.max(0, Math.min(100, (f.rsiLimitLower ?? 10) + 1)) } : f))} className="w-7 h-7 rounded border border-zinc-300 bg-white text-zinc-600 text-xs">+</button>
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
