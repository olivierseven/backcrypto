"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppBarSafe } from "@/app/AppBarSafeContext";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { API_BASE } from "@/app/constants";
import { ColorPaletteCombobox } from "./components/ColorPaletteCombobox";
import { KLINE_LAST_LAYOUT_KEY } from "./KlinesChartConstants";
import { getSessionTabId } from "./sessionTabId";
import { useKlinesIndicators } from "./KlinesIndicatorsContext";
import { INDICATOR_COLOR_PALETTE, INTERVAL_OPTIONS } from "./indicatorsPanel/indicatorsPanelConstants";
import {
  maxForecastBarsForModel,
  REGRESSION_LOOKBACK_MAX,
  REGRESSION_LOOKBACK_MIN,
  REGRESSION_PAST_OFFSET_MAX,
  REGRESSION_PAST_OFFSET_MIN,
  useKlinesRegressions,
  type RegressionLineStyle,
  type RegressionModel,
  type UserRegressionConfig,
} from "./regression/KlinesRegressionsContext";
import {
  listMainChartRegressionSources,
  type RegressionSourceOption,
  type RegressionSourceToken,
} from "./regression/regressionSource";

function formatPastEndOffsetAsNegative(n: number): string {
  return n <= 0 ? "0" : `-${n}`;
}

function regressionModelFromSelectValue(v: string): RegressionModel {
  if (v === "quartic") return "quartic";
  if (v === "cubic") return "cubic";
  if (v === "quadratic") return "quadratic";
  return "linear";
}

function regressionModelShortLabel(m: RegressionModel, tx: Record<string, string>): string {
  if (m === "quartic") return tx.regressionModelQuartic ?? "Quartic";
  if (m === "cubic") return tx.regressionModelCubic ?? "Cubic";
  if (m === "quadratic") return tx.regressionModelQuadratic ?? "Quadratic";
  return tx.regressionModelLinear ?? "Linear";
}

function regressionLineStyleUiLabel(ls: UserRegressionConfig["lineStyle"], tx: Record<string, string>): string {
  return ls === "dotted" ? (tx.lineStyleDotted ?? "Dotted") : (tx.lineStyleDashed ?? "Dashed");
}

function regressionLineWidthUiLabel(lw: UserRegressionConfig["lineWidth"], tx: Record<string, string>): string {
  if (lw === "thin") return tx.strokeThin ?? "Thin";
  if (lw === "thick") return tx.strokeThick ?? "Thick";
  return tx.strokeMedium ?? "Medium";
}

function RegressionListItemSubtitle({
  r,
  sourceOptions,
  tx,
}: {
  r: UserRegressionConfig;
  sourceOptions: RegressionSourceOption[];
  tx: Record<string, string>;
}) {
  const src = sourceOptions.find((o) => o.indicatorId === r.sourceIndicatorId && o.token === r.sourceToken);
  const seriesTitle = src?.label ?? (tx.regressionSourceUnavailable ?? "Unavailable series");
  const detailTitle = `${seriesTitle} · ${regressionLineStyleUiLabel(r.lineStyle, tx)} · ${regressionLineWidthUiLabel(r.lineWidth, tx)} · ${r.color}`;
  return (
    <div className="flex items-start gap-2 mt-1 min-w-0 text-xs text-zinc-600">
      <span
        className="shrink-0 mt-0.5 w-4 h-4 rounded border border-zinc-300 shadow-sm"
        style={{ backgroundColor: r.color }}
        title={r.color}
        role="img"
        aria-label={(tx.regressionColorSwatchAria ?? "Line color: {hex}").replace("{hex}", r.color)}
      />
      <div className="min-w-0 leading-snug">
        <div className="truncate font-medium text-zinc-700" title={detailTitle}>
          {seriesTitle}
        </div>
        <div className="text-zinc-500">
          {regressionLineStyleUiLabel(r.lineStyle, tx)} · {regressionLineWidthUiLabel(r.lineWidth, tx)}
        </div>
      </div>
    </div>
  );
}

interface RegressionsPanelProps {
  initialView?: "list" | "add";
  onClose?: () => void;
  isFreeUser?: boolean;
}

export default function RegressionsPanel({ initialView = "list", onClose, isFreeUser = false }: RegressionsPanelProps) {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines;
  const tx = t as Record<string, string>;
  const { hideStatusBar } = useAppBarSafe();
  const { currentGroupMinutes, userIndicators } = useKlinesIndicators();
  const { userRegressions, addRegression, updateRegression, removeRegression } = useKlinesRegressions();

  const rawLayout = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY) : null;
  const isDefaultModel = rawLayout === "default" || rawLayout === "0";

  const sourceOptions = useMemo(() => {
    if (currentGroupMinutes == null) return [];
    return listMainChartRegressionSources(userIndicators, currentGroupMinutes, t);
  }, [currentGroupMinutes, userIndicators, t]);

  const defaultSourceKey =
    sourceOptions.length > 0 ? `${sourceOptions[0].indicatorId}:${sourceOptions[0].token}` : "";

  const [model, setModel] = useState<RegressionModel>("linear");
  const [lookback, setLookback] = useState(14);
  const [sourceKey, setSourceKey] = useState("");
  const [forecastBars, setForecastBars] = useState(3);
  const [pastEndOffsetBars, setPastEndOffsetBars] = useState(0);
  const [lineStyle, setLineStyle] = useState<RegressionLineStyle>("dotted");
  const [lineWidth, setLineWidth] = useState<"thin" | "normal" | "thick">("normal");
  const [color, setColor] = useState(INDICATOR_COLOR_PALETTE[4] ?? "#6366f1");

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);
  const [editDraft, setEditDraft] = useState<UserRegressionConfig | null>(null);
  const [listTab, setListTab] = useState<"current" | "all">("current");

  const addFormForecastMax = useMemo(() => maxForecastBarsForModel(model), [model]);

  useEffect(() => {
    const cap = maxForecastBarsForModel(model);
    setForecastBars((f) => (f > cap ? cap : f));
  }, [model]);

  useEffect(() => {
    if (sourceOptions.length === 0) {
      setSourceKey("");
      return;
    }
    const first = `${sourceOptions[0].indicatorId}:${sourceOptions[0].token}`;
    setSourceKey((prev) => {
      if (!prev) return first;
      const valid = sourceOptions.some((o) => `${o.indicatorId}:${o.token}` === prev);
      return valid ? prev : first;
    });
  }, [sourceOptions]);

  const parsedSource = useMemo(() => {
    const [indicatorId, token] = sourceKey.split(":");
    if (!indicatorId || !token) return null;
    return { indicatorId, token: token as RegressionSourceToken };
  }, [sourceKey]);

  /** PATCH só na coluna `regressions` (slot 1–7); não passa pelo JSON `layout`. */
  const persistRegressionsColumn = useCallback((next: UserRegressionConfig[]) => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY);
    if (!raw || raw === "default") return;
    const slot = Number(raw);
    if (!Number.isInteger(slot) || slot < 1 || slot > 7) return;
    void fetch(`${API_BASE}/chart-layouts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Tab-Id": getSessionTabId() },
      credentials: "include",
      body: JSON.stringify({ slot, regressions: next }),
    }).catch(() => {});
  }, []);

  const handleAdd = useCallback(() => {
    if (isDefaultModel || isFreeUser || currentGroupMinutes == null || !parsedSource) return;
    const newR = addRegression({
      groupMinutes: currentGroupMinutes,
      model,
      lookback,
      sourceIndicatorId: parsedSource.indicatorId,
      sourceToken: parsedSource.token,
      forecastBars,
      pastEndOffsetBars,
      lineStyle,
      lineWidth,
      color,
    });
    persistRegressionsColumn([...userRegressions, newR]);
  }, [
    addRegression,
    color,
    currentGroupMinutes,
    forecastBars,
    pastEndOffsetBars,
    isDefaultModel,
    isFreeUser,
    lineStyle,
    lineWidth,
    lookback,
    model,
    parsedSource,
    persistRegressionsColumn,
    userRegressions,
  ]);

  const regressionsForTf = useMemo(() => {
    if (currentGroupMinutes == null) return [];
    return userRegressions.filter((r) => r.groupMinutes === currentGroupMinutes);
  }, [userRegressions, currentGroupMinutes]);

  const regressionsOtherTf = useMemo(() => {
    if (currentGroupMinutes == null) return userRegressions;
    return userRegressions.filter((r) => r.groupMinutes !== currentGroupMinutes);
  }, [userRegressions, currentGroupMinutes]);

  const tfLabel =
    currentGroupMinutes != null ? (INTERVAL_OPTIONS.find((o) => o.value === currentGroupMinutes)?.label ?? String(currentGroupMinutes)) : "—";

  const regressionTimeframeLabel = useCallback((groupMinutes: number) => {
    return INTERVAL_OPTIONS.find((o) => o.value === groupMinutes)?.label ?? String(groupMinutes);
  }, []);

  const addBlocked = isDefaultModel || isFreeUser || currentGroupMinutes == null || sourceOptions.length === 0 || !parsedSource;

  const editBlocked = isDefaultModel || isFreeUser;

  const editSourceOptions = useMemo(() => {
    if (!editDraft) return sourceOptions;
    const k = `${editDraft.sourceIndicatorId}:${editDraft.sourceToken}`;
    if (sourceOptions.some((o) => `${o.indicatorId}:${o.token}` === k)) return sourceOptions;
    return [
      ...sourceOptions,
      {
        indicatorId: editDraft.sourceIndicatorId,
        token: editDraft.sourceToken,
        label: tx.regressionSourceUnavailable ?? "Unavailable series",
      },
    ];
  }, [editDraft, sourceOptions, tx.regressionSourceUnavailable]);

  const editSourceKey = editDraft ? `${editDraft.sourceIndicatorId}:${editDraft.sourceToken}` : "";

  const handleSaveEdit = useCallback(() => {
    if (!editDraft || editBlocked) return;
    const [indicatorId, token] = editSourceKey.split(":");
    if (!indicatorId || !token) return;
    updateRegression(editDraft.id, {
      model: editDraft.model,
      lookback: editDraft.lookback,
      sourceIndicatorId: indicatorId,
      sourceToken: token as RegressionSourceToken,
      forecastBars: editDraft.forecastBars,
      pastEndOffsetBars: editDraft.pastEndOffsetBars,
      lineStyle: editDraft.lineStyle,
      lineWidth: editDraft.lineWidth,
      color: editDraft.color,
    });
    const nextRegressions = userRegressions.map((r) =>
      r.id === editDraft.id
        ? {
            ...r,
            model: editDraft.model,
            lookback: editDraft.lookback,
            sourceIndicatorId: indicatorId,
            sourceToken: token as RegressionSourceToken,
            forecastBars: editDraft.forecastBars,
            pastEndOffsetBars: editDraft.pastEndOffsetBars,
            lineStyle: editDraft.lineStyle,
            lineWidth: editDraft.lineWidth,
            color: editDraft.color,
          }
        : r
    );
    persistRegressionsColumn(nextRegressions);
    setEditDraft(null);
  }, [editDraft, editSourceKey, editBlocked, updateRegression, persistRegressionsColumn, userRegressions]);

  return (
    <div
      className={`fixed inset-y-0 left-0 z-[1301] flex flex-col bg-white border-r border-zinc-200 shadow-xl overflow-hidden w-[66.666vw] sm:w-[33.333vw] max-w-[400px] ${hideStatusBar === false ? "crypto-status-bar-reserve" : ""}`}
      role="dialog"
      aria-label={tx.regressionsPanelTitle ?? "Regressions"}
    >
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-zinc-50">
        <h2 className="text-sm font-semibold text-zinc-800">
          {initialView === "list" ? (tx.menuMyRegressions ?? "My regressions") : (tx.menuAddRegression ?? "Add regression")}
        </h2>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-zinc-200 text-zinc-600" aria-label="Close">
            <span className="text-lg leading-none">×</span>
          </button>
        )}
      </div>
      <div className="panel-scroll flex-1 min-h-0 overflow-auto p-3 space-y-4">
        {initialView === "add" && (
          <>
            {(isDefaultModel || isFreeUser) && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-2">
                {tx.regressionsBlockedDefaultLayout ?? tx.indicatorsBlockedDefaultLayout}
              </p>
            )}
            {currentGroupMinutes == null && <p className="text-sm text-zinc-500">{tx.regressionsWaitInterval ?? "Open the chart to select a timeframe."}</p>}

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">{tx.regressionModelLabel ?? "Model"}</label>
              <select
                className="w-full text-sm border border-zinc-300 rounded-md px-2 py-1.5 bg-white"
                value={model}
                onChange={(e) => setModel(regressionModelFromSelectValue(e.target.value))}
              >
                <option value="linear">{tx.regressionModelLinear ?? "Linear"}</option>
                <option value="quadratic">{tx.regressionModelQuadratic ?? "Quadratic"}</option>
                <option value="cubic">{tx.regressionModelCubic ?? "Cubic"}</option>
                <option value="quartic">{tx.regressionModelQuartic ?? "Quartic"}</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">{tx.regressionLookbackLabel ?? "Lookback (bars)"}</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={REGRESSION_LOOKBACK_MIN}
                  max={REGRESSION_LOOKBACK_MAX}
                  value={lookback}
                  onChange={(e) => setLookback(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-9 text-right tabular-nums">{lookback}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">{tx.regressionSourceLabel ?? "Indicator series"}</label>
              <select
                className="w-full text-sm border border-zinc-300 rounded-md px-2 py-1.5 bg-white"
                value={sourceKey || defaultSourceKey}
                onChange={(e) => setSourceKey(e.target.value)}
                disabled={sourceOptions.length === 0}
              >
                {sourceOptions.map((o) => (
                  <option key={`${o.indicatorId}:${o.token}`} value={`${o.indicatorId}:${o.token}`}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">{tx.regressionForecastLabel ?? "Forecast (future bars)"}</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={addFormForecastMax}
                  value={forecastBars}
                  onChange={(e) => setForecastBars(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-9 text-right tabular-nums">{forecastBars}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">{tx.regressionPastEndOffsetLabel ?? "Shift sample end (past)"}</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={REGRESSION_PAST_OFFSET_MIN}
                  max={REGRESSION_PAST_OFFSET_MAX}
                  value={pastEndOffsetBars}
                  onChange={(e) => setPastEndOffsetBars(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-11 text-right tabular-nums shrink-0">{formatPastEndOffsetAsNegative(pastEndOffsetBars)}</span>
              </div>
              <p className="text-xs text-zinc-500">{tx.regressionPastEndOffsetHint ?? ""}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">{tx.lineStyle ?? "Line style"}</label>
              <select
                className="w-full text-sm border border-zinc-300 rounded-md px-2 py-1.5 bg-white"
                value={lineStyle}
                onChange={(e) => setLineStyle(e.target.value as RegressionLineStyle)}
              >
                <option value="dotted">{tx.lineStyleDotted ?? "Dotted"}</option>
                <option value="dashed">{tx.lineStyleDashed ?? "Dashed"}</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">{tx.regressionLineWidthLabel ?? "Line width"}</label>
              <select
                className="w-full text-sm border border-zinc-300 rounded-md px-2 py-1.5 bg-white"
                value={lineWidth}
                onChange={(e) => setLineWidth(e.target.value as "thin" | "normal" | "thick")}
              >
                <option value="thin">{tx.strokeThin ?? "Thin"}</option>
                <option value="normal">{tx.strokeMedium ?? "Medium"}</option>
                <option value="thick">{tx.strokeThick ?? "Thick"}</option>
              </select>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-600">{tx.color ?? "Color"}</span>
              <ColorPaletteCombobox value={color} onChange={setColor} palette={INDICATOR_COLOR_PALETTE} aria-label={tx.color ?? "Color"} />
            </div>

            <p className="text-xs text-zinc-500">
              {(tx.regressionAppliesToInterval ?? "Applies only to {interval}.").replace("{interval}", tfLabel)}
            </p>

            <button
              type="button"
              onClick={handleAdd}
              disabled={addBlocked}
              className="w-full py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800"
            >
              {tx.regressionAddButton ?? "Add regression"}
            </button>
          </>
        )}

        {initialView === "list" && (
          <>
            <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              <button
                type="button"
                onClick={() => setListTab("current")}
                className={`px-2.5 py-1 text-xs rounded-md ${listTab === "current" ? "bg-white border border-zinc-300 text-zinc-900" : "text-zinc-600 hover:text-zinc-800"}`}
              >
                {tx.regressionsTabCurrent ?? "Current"}
              </button>
              <button
                type="button"
                onClick={() => setListTab("all")}
                className={`px-2.5 py-1 text-xs rounded-md ${listTab === "all" ? "bg-white border border-zinc-300 text-zinc-900" : "text-zinc-600 hover:text-zinc-800"}`}
              >
                {tx.regressionsTabAll ?? "All"} ({userRegressions.length})
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              {listTab === "current"
                ? (tx.regressionsListHint ?? "Regressions for this chart interval ({interval}).").replace("{interval}", tfLabel)
                : (tx.regressionsAllListHint ?? "Regressions from all timeframes.")}
            </p>
            {(listTab === "current" ? regressionsForTf : userRegressions).length === 0 ? (
              <p className="text-sm text-zinc-500 py-2">
                {listTab === "current"
                  ? (tx.noRegressionsYet ?? "No regressions for this timeframe. Use \"Add regression\" in the menu.")
                  : (tx.noRegressionsAtAll ?? "No regressions yet. Use \"Add regression\" in the menu.")}
              </p>
            ) : (
              <ul className="space-y-2">
                {(listTab === "current" ? regressionsForTf : userRegressions).map((r) => (
                  <li key={r.id} className="border border-zinc-200 rounded-lg p-2 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] text-zinc-500 mb-0.5">
                          {(tx.regressionBelongsToTimeframe ?? "Timeframe: {interval}").replace(
                            "{interval}",
                            regressionTimeframeLabel(r.groupMinutes)
                          )}
                        </div>
                        <div className="text-sm font-medium text-zinc-800">
                          {regressionModelShortLabel(r.model, tx)}{" "}
                          · {r.lookback} · +{r.forecastBars}
                          {r.pastEndOffsetBars !== 0 ? ` · ${formatPastEndOffsetAsNegative(r.pastEndOffsetBars)}` : ""}
                        </div>
                        <RegressionListItemSubtitle r={r} sourceOptions={sourceOptions} tx={tx} />
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {!editBlocked && (
                          <button
                            type="button"
                            className="text-xs text-zinc-700 hover:underline"
                            onClick={() => {
                              if (editDraft?.id === r.id) setEditDraft(null);
                              else setEditDraft({ ...r });
                            }}
                          >
                            {editDraft?.id === r.id ? (tx.regressionCancelEdit ?? "Cancel") : (tx.regressionEdit ?? "Edit")}
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => {
                            const src = sourceOptions.find((o) => o.indicatorId === r.sourceIndicatorId && o.token === r.sourceToken);
                            setDeleteConfirm({ id: r.id, label: src?.label ?? r.id });
                          }}
                        >
                          {tx.regressionRemove ?? "Remove"}
                        </button>
                      </div>
                    </div>
                    {editDraft?.id === r.id && (
                      <div className="pt-2 border-t border-zinc-100 space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-zinc-600">{tx.regressionModelLabel ?? "Model"}</label>
                          <select
                            className="w-full text-sm border border-zinc-300 rounded-md px-2 py-1.5 bg-white"
                            value={editDraft.model}
                            onChange={(e) => {
                              const m = regressionModelFromSelectValue(e.target.value);
                              const cap = maxForecastBarsForModel(m);
                              setEditDraft((d) =>
                                d ? { ...d, model: m, forecastBars: Math.min(d.forecastBars, cap) } : null
                              );
                            }}
                          >
                            <option value="linear">{tx.regressionModelLinear ?? "Linear"}</option>
                            <option value="quadratic">{tx.regressionModelQuadratic ?? "Quadratic"}</option>
                            <option value="cubic">{tx.regressionModelCubic ?? "Cubic"}</option>
                            <option value="quartic">{tx.regressionModelQuartic ?? "Quartic"}</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-zinc-600">{tx.regressionLookbackLabel ?? "Lookback"}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={REGRESSION_LOOKBACK_MIN}
                              max={REGRESSION_LOOKBACK_MAX}
                              value={editDraft.lookback}
                              onChange={(e) => setEditDraft((d) => (d ? { ...d, lookback: Number(e.target.value) } : null))}
                              className="flex-1"
                            />
                            <span className="text-sm font-mono w-9 text-right tabular-nums">{editDraft.lookback}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-zinc-600">{tx.regressionSourceLabel ?? "Indicator series"}</label>
                          <select
                            className="w-full text-sm border border-zinc-300 rounded-md px-2 py-1.5 bg-white"
                            value={editSourceKey}
                            onChange={(e) => {
                              const v = e.target.value;
                              const i = v.indexOf(":");
                              if (i <= 0) return;
                              setEditDraft((d) =>
                                d
                                  ? {
                                      ...d,
                                      sourceIndicatorId: v.slice(0, i),
                                      sourceToken: v.slice(i + 1) as RegressionSourceToken,
                                    }
                                  : null
                              );
                            }}
                            disabled={editSourceOptions.length === 0}
                          >
                            {editSourceOptions.map((o) => (
                              <option key={`${o.indicatorId}:${o.token}`} value={`${o.indicatorId}:${o.token}`}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-zinc-600">{tx.regressionForecastLabel ?? "Forecast"}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={1}
                              max={maxForecastBarsForModel(editDraft.model)}
                              value={editDraft.forecastBars}
                              onChange={(e) => setEditDraft((d) => (d ? { ...d, forecastBars: Number(e.target.value) } : null))}
                              className="flex-1"
                            />
                            <span className="text-sm font-mono w-9 text-right tabular-nums">{editDraft.forecastBars}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-zinc-600">{tx.regressionPastEndOffsetLabel ?? "Shift sample end (past)"}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={REGRESSION_PAST_OFFSET_MIN}
                              max={REGRESSION_PAST_OFFSET_MAX}
                              value={editDraft.pastEndOffsetBars}
                              onChange={(e) =>
                                setEditDraft((d) => (d ? { ...d, pastEndOffsetBars: Number(e.target.value) } : null))
                              }
                              className="flex-1"
                            />
                            <span className="text-sm font-mono w-11 text-right tabular-nums shrink-0">
                              {formatPastEndOffsetAsNegative(editDraft.pastEndOffsetBars)}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500">{tx.regressionPastEndOffsetHint ?? ""}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-zinc-600">{tx.lineStyle ?? "Line style"}</label>
                          <select
                            className="w-full text-sm border border-zinc-300 rounded-md px-2 py-1.5 bg-white"
                            value={editDraft.lineStyle}
                            onChange={(e) =>
                              setEditDraft((d) => (d ? { ...d, lineStyle: e.target.value as RegressionLineStyle } : null))
                            }
                          >
                            <option value="dotted">{tx.lineStyleDotted ?? "Dotted"}</option>
                            <option value="dashed">{tx.lineStyleDashed ?? "Dashed"}</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-zinc-600">{tx.regressionLineWidthLabel ?? "Line width"}</label>
                          <select
                            className="w-full text-sm border border-zinc-300 rounded-md px-2 py-1.5 bg-white"
                            value={editDraft.lineWidth}
                            onChange={(e) =>
                              setEditDraft((d) => (d ? { ...d, lineWidth: e.target.value as "thin" | "normal" | "thick" } : null))
                            }
                          >
                            <option value="thin">{tx.strokeThin ?? "Thin"}</option>
                            <option value="normal">{tx.strokeMedium ?? "Medium"}</option>
                            <option value="thick">{tx.strokeThick ?? "Thick"}</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-zinc-600">{tx.color ?? "Color"}</span>
                          <ColorPaletteCombobox
                            value={editDraft.color}
                            onChange={(hex) => setEditDraft((d) => (d ? { ...d, color: hex } : null))}
                            palette={INDICATOR_COLOR_PALETTE}
                            aria-label={tx.color ?? "Color"}
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={editSourceOptions.length === 0}
                            className="flex-1 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium disabled:opacity-40 hover:bg-zinc-800"
                          >
                            {tx.regressionSaveChanges ?? "Save changes"}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {listTab === "current" && regressionsOtherTf.length > 0 && (
              <div className="pt-2 border-t border-zinc-100">
                <p className="text-xs font-medium text-zinc-600 mb-1">{tx.regressionsOtherIntervals ?? "Other timeframes"}</p>
                <p className="text-xs text-zinc-500">
                  {tx.regressionsOtherIntervalsHint ?? "Switch interval on the chart to see or add regressions for those periods."} ({regressionsOtherTf.length})
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50">
              <h3 className="text-sm font-semibold text-zinc-900">{tx.regressionDeleteTitle ?? "Remove regression"}</h3>
            </div>
            <div className="px-4 py-3 text-sm text-zinc-700">
              <p>{(tx.regressionDeleteMessage ?? 'Remove "{name}"?').replace("{name}", deleteConfirm.label)}</p>
            </div>
            <div className="px-4 py-3 border-t border-zinc-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="crypto-btn rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 font-medium px-4 py-2"
              >
                {tx.cancel ?? "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = deleteConfirm.id;
                  removeRegression(id);
                  setEditDraft((d) => (d?.id === id ? null : d));
                  setDeleteConfirm(null);
                  persistRegressionsColumn(userRegressions.filter((r) => r.id !== id));
                }}
                className="crypto-btn rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium px-4 py-2"
              >
                {tx.regressionRemove ?? "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
