"use client";

import type { UserIndicatorType, IndicatorPanel, IndicatorFieldKey, IndicatorLineWidth, IndicatorLineStyle } from "../KlinesIndicatorsContext";
import { useIndicatorsPanelContext } from "./IndicatorsPanelContext";
import type { AddFormState } from "./indicatorsPanelTypes";

interface IndicatorsPanelAddFormProps {
  form: AddFormState;
  setForm: React.Dispatch<React.SetStateAction<AddFormState>>;
}

export function IndicatorsPanelAddForm({ form, setForm }: IndicatorsPanelAddFormProps) {
  const {
    t,
    userIndicators,
    fieldOptionsVisibleForAdd,
    firstEnabledFieldValueForAdd,
    panelsWithSecondary,
    INDICATOR_COLOR_PALETTE,
    addButtonDisabled,
    handleAdd,
  } = useIndicatorsPanelContext();

  /** Indicadores secundários (RSI, MACD) podem ir em qualquer um dos painéis 2, 3 ou 4 (nunca no main). */
  const chartOptionValue: string =
    form.indicatorType === "RSI" || form.indicatorType === "MACD"
      ? (form.chartOption === "panel2" || form.chartOption === "panel3" || form.chartOption === "panel4" ? form.chartOption : "panel2")
      : (form.chartOption === "panel2" && !panelsWithSecondary.panel2) || (form.chartOption === "panel3" && !panelsWithSecondary.panel3) || (form.chartOption === "panel4" && !panelsWithSecondary.panel4)
        ? "main"
        : form.chartOption;

  const setType = (newType: UserIndicatorType) => {
    setForm((prev) => {
      if (newType === "RSI") {
        return {
          ...prev,
          indicatorType: "RSI",
          period: 14,
          periodText: "14",
          chartOption: "panel2",
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
      }
      if (newType === "MACD") {
        return {
          ...prev,
          indicatorType: "MACD",
          chartOption: "panel2",
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
        };
      }
      return { ...prev, indicatorType: newType };
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.chartOption}</span>
        <select
          value={chartOptionValue}
          onChange={(e) => setForm((prev) => ({ ...prev, chartOption: e.target.value as IndicatorPanel }))}
          className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
          aria-label={t.chartOption}
        >
          {(form.indicatorType === "RSI" || form.indicatorType === "MACD") ? (
            <>
              <option value="panel2">{(t as Record<string, string>).chartOptionPanel2 ?? "Panel 2"}</option>
              <option value="panel3">{(t as Record<string, string>).chartOptionPanel3 ?? "Panel 3"}</option>
              <option value="panel4">{(t as Record<string, string>).chartOptionPanel4 ?? "Panel 4"}</option>
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

      {form.indicatorType === "RSI" && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.rsiFixedScale}
            onChange={(e) => setForm((prev) => ({ ...prev, rsiFixedScale: e.target.checked }))}
            className="rounded border-zinc-300"
          />
          <span className="text-xs text-zinc-700">{(t as Record<string, string>).rsiFixedScaleLabel ?? "Escala fixa 0–100 no eixo Y"}</span>
        </label>
      )}

      {form.indicatorType === "RSI" && (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.rsiCenterLine}
              onChange={(e) => setForm((prev) => ({ ...prev, rsiCenterLine: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).rsiCenterLineLabel ?? "Linha central 50%"}</span>
          </label>
          {form.rsiCenterLine && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, rsiCenterLineColor: hex }))}
                      className={`w-6 h-6 rounded border shrink-0 ${form.rsiCenterLineColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                <select
                  value={form.rsiCenterLineWidth}
                  onChange={(e) => setForm((prev) => ({ ...prev, rsiCenterLineWidth: e.target.value as IndicatorLineWidth }))}
                  className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
                >
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Thin"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                <select
                  value={form.rsiCenterLineStyle}
                  onChange={(e) => setForm((prev) => ({ ...prev, rsiCenterLineStyle: e.target.value as IndicatorLineStyle }))}
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

      {form.indicatorType === "RSI" && (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.rsiLimits}
              onChange={(e) => setForm((prev) => ({ ...prev, rsiLimits: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).rsiLimitsLabel ?? "Limites superior e inferior"}</span>
          </label>
          {form.rsiLimits && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).rsiLimitUpperLabel ?? "Superior %"}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, rsiLimitUpper: Math.max(0, Math.min(100, prev.rsiLimitUpper - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                  <span className="w-10 text-center text-sm tabular-nums">{form.rsiLimitUpper}</span>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, rsiLimitUpper: Math.max(0, Math.min(100, prev.rsiLimitUpper + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).rsiLimitLowerLabel ?? "Inferior %"}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, rsiLimitLower: Math.max(0, Math.min(100, prev.rsiLimitLower - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                  <span className="w-10 text-center text-sm tabular-nums">{form.rsiLimitLower}</span>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, rsiLimitLower: Math.max(0, Math.min(100, prev.rsiLimitLower + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, rsiLimitColor: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.rsiLimitColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                <select value={form.rsiLimitLineWidth} onChange={(e) => setForm((prev) => ({ ...prev, rsiLimitLineWidth: e.target.value as IndicatorLineWidth }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Thin"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                <select value={form.rsiLimitLineStyle} onChange={(e) => setForm((prev) => ({ ...prev, rsiLimitLineStyle: e.target.value as IndicatorLineStyle }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
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
          value={form.indicatorType}
          onChange={(e) => setType(e.target.value as UserIndicatorType)}
          className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
          aria-label={t.indicatorType}
        >
          <option value="SMA">SMA</option>
          <option value="EMA">EMA</option>
          <option value="WMA">WMA</option>
          <option value="RSI">RSI</option>
          <option value="MACD">MACD</option>
        </select>
      </div>

      {form.indicatorType === "MACD" && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdFastMa ?? "Média rápida"}</span>
            <select
              value={form.macdFastMaType}
              onChange={(e) => setForm((prev) => ({ ...prev, macdFastMaType: e.target.value as "SMA" | "EMA" | "WMA" }))}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
            >
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
              <option value="WMA">WMA</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdFastPeriod ?? "Período rápido"}</span>
            <div className="flex-1 min-w-0 flex items-center gap-1">
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, macdFastPeriod: Math.max(1, prev.macdFastPeriod - 1), macdFastPeriodText: String(Math.max(1, prev.macdFastPeriod - 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">−</button>
              <input type="text" inputMode="numeric" value={form.macdFastPeriodText} onChange={(e) => setForm((prev) => ({ ...prev, macdFastPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.macdFastPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 12; setForm((prev) => ({ ...prev, macdFastPeriod: v, macdFastPeriodText: String(v) })); }} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5" />
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, macdFastPeriod: Math.min(500, prev.macdFastPeriod + 1), macdFastPeriodText: String(Math.min(500, prev.macdFastPeriod + 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">+</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdSlowMa ?? "Média lenta"}</span>
            <select
              value={form.macdSlowMaType}
              onChange={(e) => setForm((prev) => ({ ...prev, macdSlowMaType: e.target.value as "SMA" | "EMA" | "WMA" }))}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
            >
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
              <option value="WMA">WMA</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdSlowPeriod ?? "Período lento"}</span>
            <div className="flex-1 min-w-0 flex items-center gap-1">
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, macdSlowPeriod: Math.max(1, prev.macdSlowPeriod - 1), macdSlowPeriodText: String(Math.max(1, prev.macdSlowPeriod - 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">−</button>
              <input type="text" inputMode="numeric" value={form.macdSlowPeriodText} onChange={(e) => setForm((prev) => ({ ...prev, macdSlowPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.macdSlowPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 26; setForm((prev) => ({ ...prev, macdSlowPeriod: v, macdSlowPeriodText: String(v) })); }} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5" />
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, macdSlowPeriod: Math.min(500, prev.macdSlowPeriod + 1), macdSlowPeriodText: String(Math.min(500, prev.macdSlowPeriod + 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">+</button>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.macdSignalLine} onChange={(e) => setForm((prev) => ({ ...prev, macdSignalLine: e.target.checked }))} className="rounded border-zinc-300" />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).macdSignalLineLabel ?? "Linha de sinal"}</span>
          </label>
          <label className={`flex items-center gap-2 ${form.macdSignalLine ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
            <input
              type="checkbox"
              checked={form.macdHistogram}
              disabled={!form.macdSignalLine}
              onChange={(e) => setForm((prev) => ({ ...prev, macdHistogram: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).macdHistogramLabel ?? "MACD (histograma)"}</span>
          </label>
          {form.macdSignalLine && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdSignalMa ?? "MA da sinal"}</span>
                <select value={form.macdSignalMaType} onChange={(e) => setForm((prev) => ({ ...prev, macdSignalMaType: e.target.value as "SMA" | "EMA" | "WMA" }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="SMA">SMA</option>
                  <option value="EMA">EMA</option>
                  <option value="WMA">WMA</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdSignalPeriod ?? "Período sinal"}</span>
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, macdSignalPeriod: Math.max(1, prev.macdSignalPeriod - 1), macdSignalPeriodText: String(Math.max(1, prev.macdSignalPeriod - 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">−</button>
                  <input type="text" inputMode="numeric" value={form.macdSignalPeriodText} onChange={(e) => setForm((prev) => ({ ...prev, macdSignalPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.macdSignalPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 9; setForm((prev) => ({ ...prev, macdSignalPeriod: v, macdSignalPeriodText: String(v) })); }} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5" />
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, macdSignalPeriod: Math.min(500, prev.macdSignalPeriod + 1), macdSignalPeriodText: String(Math.min(500, prev.macdSignalPeriod + 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, macdSignalColor: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.macdSignalColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura"}</span>
                <select value={form.macdSignalLineWidth} onChange={(e) => setForm((prev) => ({ ...prev, macdSignalLineWidth: e.target.value as IndicatorLineWidth }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Fina"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo"}</span>
                <select value={form.macdSignalLineStyle} onChange={(e) => setForm((prev) => ({ ...prev, macdSignalLineStyle: e.target.value as IndicatorLineStyle }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Contínuo"}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Pontilhado"}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Tracejado"}</option>
                </select>
              </div>
            </div>
          )}
          {form.macdSignalLine && form.macdHistogram && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdHistogramColorAbove ?? "Cor acima de 0"}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, macdHistogramColorAbove: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.macdHistogramColorAbove === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo de 0"}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, macdHistogramColorBelow: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.macdHistogramColorBelow === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {form.indicatorType !== "MACD" && (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.period}</span>
        <div className="flex-1 min-w-0 flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const next = Math.max(1, Math.min(500, Math.round((form.period ?? 7) - 1)));
              setForm((prev) => ({ ...prev, period: next, periodText: String(next) }));
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
            value={form.periodText}
            onFocus={(e) => {
              const el = e.currentTarget;
              queueMicrotask(() => el?.select());
            }}
            onChange={(e) => setForm((prev) => ({ ...prev, periodText: e.target.value.replace(/[^\d]/g, "") }))}
            onBlur={() => {
              const n = Number(form.periodText);
              const next = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 7;
              setForm((prev) => ({ ...prev, period: next, periodText: String(next) }));
            }}
            className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5"
            aria-label={t.period}
          />
          <button
            type="button"
            onClick={() => {
              const next = Math.max(1, Math.min(500, Math.round((form.period ?? 7) + 1)));
              setForm((prev) => ({ ...prev, period: next, periodText: String(next) }));
            }}
            className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            aria-label="+"
          >
            +
          </button>
        </div>
      </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.field}</span>
        <select
          value={(fieldOptionsVisibleForAdd.some((o) => o.value === form.fieldKey) ? form.fieldKey : firstEnabledFieldValueForAdd) as string}
          onChange={(e) => {
            const newKey = e.target.value as IndicatorFieldKey;
            setForm((prev) => ({ ...prev, fieldKey: newKey }));
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
          onClick={() => setForm((prev) => ({ ...prev, colorOpen: !prev.colorOpen }))}
          className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white flex items-center justify-between gap-2"
          aria-label={t.color}
          aria-expanded={form.colorOpen}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-4 h-4 rounded border border-zinc-300 shrink-0" style={{ backgroundColor: form.color }} />
          </span>
          <span className="text-zinc-500 text-xs">▾</span>
        </button>
        {form.colorOpen && (
          <>
            <div className="fixed inset-0 z-30" aria-hidden onClick={() => setForm((prev) => ({ ...prev, colorOpen: false }))} />
            <div className="absolute left-[4.5rem] right-0 top-full z-40 mt-1 max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg p-2">
              <div className="grid grid-cols-3 gap-2">
                {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, color: hex, colorOpen: false }))}
                    className={`w-10 h-10 rounded border-2 ${form.color === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
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
          value={form.lineWidth}
          onChange={(e) => setForm((prev) => ({ ...prev, lineWidth: e.target.value as IndicatorLineWidth }))}
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
          value={form.lineStyle}
          onChange={(e) => setForm((prev) => ({ ...prev, lineStyle: e.target.value as IndicatorLineStyle }))}
          className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
          aria-label={(t as Record<string, string>).lineStyle}
        >
          <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Solid"}</option>
          <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Dotted"}</option>
          <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Dashed"}</option>
        </select>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={addButtonDisabled}
        className="w-full py-2 rounded bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t.addIndicator}
      </button>
    </div>
  );
}
