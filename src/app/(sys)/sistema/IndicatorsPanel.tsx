"use client";

import { useState, useMemo } from "react";
import { useBioLang } from "@/app/contexts/BioLangContext";
import { getBioT } from "@/app/lib/translations";
import {
  useKlinesIndicators,
  getFieldIndex,
  type UserIndicatorConfig,
  type UserIndicatorType,
  type IndicatorFieldKey,
  type IndicatorLineWidth,
  type IndicatorLineStyle,
} from "./KlinesIndicatorsContext";

/** Paleta de cores (claro → escuro), pelo menos 12. */
const INDICATOR_COLOR_PALETTE = [
  "#ffffff",
  // cores base (compacta)
  "#000000",
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#84cc16", // lime
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#64748b", // slate
];

const INTERVAL_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "1m" },
  { value: 3, label: "3m" },
  { value: 5, label: "5m" },
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 45, label: "45m" },
  { value: 60, label: "1h" },
  { value: 120, label: "2h" },
  { value: 180, label: "3h" },
  { value: 240, label: "4h" },
  { value: 360, label: "6h" },
  { value: 480, label: "8h" },
  { value: 720, label: "12h" },
  { value: 1440, label: "1D" },
  { value: 4320, label: "3D" },
  { value: 10080, label: "1S" },
  { value: 43200, label: "1M" },
];

function getFieldLabel(
  fieldKey: IndicatorFieldKey,
  t: ReturnType<typeof getBioT>["sistema"]["klines"],
  userIndicators: UserIndicatorConfig[]
): string {
  const k = t as Record<string, string>;
  if (fieldKey === "open") return k.fieldOpen ?? "Open";
  if (fieldKey === "high") return k.fieldHigh ?? "High";
  if (fieldKey === "low") return k.fieldLow ?? "Low";
  if (fieldKey === "close") return k.fieldClose ?? "Close";
  if (fieldKey === "volume") return k.fieldVol ?? "Vol";
  if (fieldKey.startsWith("user_")) {
    const u = userIndicators.find((i) => i.id === fieldKey.slice(5));
    if (u) return `${u.type}(${u.period}) ${getFieldLabel(u.fieldKey, t, userIndicators)}`;
  }
  return String(fieldKey);
}

export function getIndicatorLabel(ind: UserIndicatorConfig, t: ReturnType<typeof getBioT>["sistema"]["klines"], userIndicators: UserIndicatorConfig[]): string {
  const fieldLabel = getFieldLabel(ind.fieldKey, t, userIndicators);
  return `${ind.type}(${ind.period}) ${fieldLabel}`;
}

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
  const [chartOption, setChartOption] = useState<"main">("main");
  const [lineWidth, setLineWidth] = useState<IndicatorLineWidth>("normal");
  const [lineStyle, setLineStyle] = useState<IndicatorLineStyle>("solid");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    period: number;
    periodText: string;
    fieldKey: IndicatorFieldKey;
    color: string;
    lineWidth: IndicatorLineWidth;
    lineStyle: IndicatorLineStyle;
  } | null>(null);

  const fieldOptions = useMemo(() => {
    const base: { value: IndicatorFieldKey; label: string }[] = [
      { value: "open", label: (t as Record<string, string>).fieldOpen ?? "Open" },
      { value: "high", label: (t as Record<string, string>).fieldHigh ?? "High" },
      { value: "low", label: (t as Record<string, string>).fieldLow ?? "Low" },
      { value: "close", label: (t as Record<string, string>).fieldClose ?? "Close" },
      { value: "volume", label: (t as Record<string, string>).fieldVol ?? "Vol" },
    ];
    userIndicators.forEach((u) => {
      base.push({
        value: `user_${u.id}` as IndicatorFieldKey,
        label: getIndicatorLabel(u, t, userIndicators),
      });
    });
    return base;
  }, [t, userIndicators]);

  const handleAdd = () => {
    const n = Number(periodText);
    const periodNum = Number.isFinite(n) && n > 0
      ? Math.max(1, Math.min(500, Math.round(n)))
      : Math.max(1, Math.min(500, Math.round(period)));
    setPeriod(periodNum);
    setPeriodText(String(periodNum));
    addIndicator({
      type: indicatorType,
      period: periodNum,
      fieldKey,
      color,
      intervals: currentGroupMinutes != null ? [currentGroupMinutes] : [],
      lineWidth,
      lineStyle,
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
    setEditForm({
      period: ind.period,
      periodText: String(ind.period),
      fieldKey: ind.fieldKey,
      color: ind.color,
      lineWidth: (ind.lineWidth === "thin" || ind.lineWidth === "normal" ? ind.lineWidth : "normal") as IndicatorLineWidth,
      lineStyle: (ind.lineStyle === "solid" || ind.lineStyle === "dotted" || ind.lineStyle === "dashed" ? ind.lineStyle : "solid") as IndicatorLineStyle,
    });
  };

  const saveEdit = () => {
    if (!editingId || !editForm) return;
    const periodNum = (() => {
      const n = Number(editForm.periodText);
      return Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : editForm.period;
    })();
    updateIndicator(editingId, {
      period: periodNum,
      fieldKey: editForm.fieldKey,
      color: editForm.color,
      lineWidth: editForm.lineWidth,
      lineStyle: editForm.lineStyle,
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
              value={chartOption}
              onChange={(e) => setChartOption(e.target.value as "main")}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
              aria-label={t.chartOption}
            >
              <option value="main">{(t as Record<string, string>).chartOptionMain ?? "Main"}</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.indicatorType}</span>
            <select
              value={indicatorType}
              onChange={(e) => setIndicatorType(e.target.value as UserIndicatorType)}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
              aria-label={t.indicatorType}
            >
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
              <option value="WMA">WMA</option>
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
              value={fieldKey}
              onChange={(e) => setFieldKey(e.target.value as IndicatorFieldKey)}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
              aria-label={t.field}
            >
              {fieldOptions.map((opt) => (
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
          className="w-full py-2 rounded bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700"
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
                        value={editForm.fieldKey}
                        onChange={(e) => setEditForm((f) => ({ ...f!, fieldKey: e.target.value as IndicatorFieldKey }))}
                        className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-2 py-1 bg-white"
                      >
                        {fieldOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
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
