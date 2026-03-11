"use client";

/**
 * Sidebar do gráfico de candles: configuração, cores, desenho e save/load de layout.
 */
import { useState, useRef, useLayoutEffect, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ASSET_PREFIX } from "@/app/constants";
import { SIDEBAR_WIDTH } from "../KlinesChartConstants";
import {
  CANDLE_COLOR_PRESETS,
  DEFAULT_CANDLE_PRESET,
  BACKGROUND_PALETTE,
  LINE_GRID_PALETTE,
  TEXT_PALETTE,
} from "./palettes";
import type {
  CandleColorPresetId,
  BackgroundId,
  LineGridId,
  TextColorId,
} from "./palettes";
import type { IntervalOption } from "./types";
export type KlinesChartSidebarTranslations = Record<string, string>;

export interface KlinesChartSidebarProps {
  chartHeight: number;
  settingsRef: RefObject<HTMLDivElement | null>;
  colorsRef: RefObject<HTMLDivElement | null>;
  saveLoadRef: RefObject<HTMLDivElement | null>;
  drawRef: RefObject<HTMLDivElement | null>;
  /** Layout da sidebar: vertical (esquerda) ou horizontal (topo). */
  orientation?: "vertical" | "horizontal";
  t: KlinesChartSidebarTranslations;
  /** Tempo selecionado (ex.: "4h") — exibido no topo da sidebar. */
  intervalLabel?: string;
  intervalOptions: IntervalOption[];
  groupMinutes: number;
  onIntervalChange: (value: number) => void;
  heikinAshi?: boolean;
  onHeikinAshiChange?: (enabled: boolean) => void;
  // Settings
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  colorsOpen: boolean;
  setColorsOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  yAxisAbbreviated: boolean;
  setYAxisAbbreviated: (v: boolean) => void;
  logScale: boolean;
  setLogScale: (v: boolean) => void;
  showMainAxis: boolean;
  setShowMainAxis: (v: boolean) => void;
  showSecondaryAxis: boolean;
  setShowSecondaryAxis: (v: boolean) => void;
  showLastCloseLine: boolean;
  setShowLastCloseLine: (v: boolean) => void;
  invisibleCandlesEnd: number;
  setInvisibleCandlesEnd: (v: number | ((v: number) => number)) => void;
  secondaryPanelHeightPercent: number;
  setSecondaryPanelHeightPercent: (v: number | ((v: number) => number)) => void;
  secondaryPanelHeightMin: number;
  secondaryPanelHeightMax: number;
  // Colors
  candleColorPreset: CandleColorPresetId;
  setCandleColorPreset: (v: CandleColorPresetId) => void;
  containerBackground: BackgroundId;
  setContainerBackground: (v: BackgroundId) => void;
  chartBackground: BackgroundId;
  setChartBackground: (v: BackgroundId) => void;
  footerYAxisBgColor: BackgroundId;
  setFooterYAxisBgColor: (v: BackgroundId) => void;
  backgroundTextColor: TextColorId;
  setBackgroundTextColor: (v: TextColorId) => void;
  footerYAxisTextColor: TextColorId;
  setFooterYAxisTextColor: (v: TextColorId) => void;
  lineTableColor: LineGridId;
  setLineTableColor: (v: LineGridId) => void;
  secondaryGridColor: LineGridId;
  setSecondaryGridColor: (v: LineGridId) => void;
  lastCloseLineColor: LineGridId;
  setLastCloseLineColor: (v: LineGridId) => void;
  lastCloseTextColor: LineGridId;
  setLastCloseTextColor: (v: LineGridId) => void;
  volumeOnPrice: boolean;
  setVolumeOnPrice: (v: boolean) => void;
  volumeOnPriceOpacity: number;
  setVolumeOnPriceOpacity: (v: number | ((v: number) => number)) => void;
  chartWidth: number;
  chartSizePercent: number;
  setChartSizePercent: (v: number | ((v: number) => number)) => void;
  yPadOffset: number;
  setYPadOffset: (v: number | ((v: number) => number)) => void;
  // Draw
  drawOpen: boolean;
  setDrawOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  drawingsVisible: boolean;
  setDrawingsVisible: (v: boolean | ((o: boolean) => boolean)) => void;
  drawMode: boolean;
  drawTool: "line" | "fibonacci" | "freeRetracement" | "channel" | "rectangle" | "horizontalLine" | "verticalLine" | "arrow" | "text" | "ruler" | "select";
  drawMagnetic: boolean;
  setDrawMagnetic: (v: boolean) => void;
  drawPanelSide: "left" | "right";
  setDrawPanelSide: (v: "left" | "right" | ((s: "left" | "right") => "left" | "right")) => void;
  openDrawPanel: () => void;
  closeDrawMode: () => void;
  selectLineTool: () => void;
  selectFibonacciTool: () => void;
  selectFreeRetracementTool: () => void;
  selectChannelTool: () => void;
  selectRectangleTool: () => void;
  selectVerticalLineTool: () => void;
  selectTextTool: () => void;
  selectArrowTool: () => void;
  selectHorizontalLineTool: () => void;
  exitRulerToCrosshair: () => void;
  toggleRuler: () => void;
  selectSelectTool: () => void;
  clearAllDrawing: () => void;
  // Save/Load
  saveOpen: boolean;
  setSaveOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  loadOpen: boolean;
  setLoadOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  savedLayouts: { slot: number; config: Record<string, unknown> }[];
  /** Admin: pode salvar no slot 0 (layout default). */
  canSaveDefault?: boolean;
  onSaveLayout: (slot: number) => void;
  onLoadLayout: (layout: { slot: number; config: Record<string, unknown> }) => void;
  onFetchSavedLayouts: () => void;
}

export function KlinesChartSidebar({
  chartHeight,
  settingsRef,
  colorsRef,
  saveLoadRef,
  drawRef,
  orientation = "vertical",
  t,
  intervalLabel,
  intervalOptions,
  groupMinutes,
  onIntervalChange,
  heikinAshi = false,
  onHeikinAshiChange,
  settingsOpen,
  setSettingsOpen,
  colorsOpen,
  setColorsOpen,
  yAxisAbbreviated,
  setYAxisAbbreviated,
  logScale,
  setLogScale,
  showMainAxis,
  setShowMainAxis,
  showSecondaryAxis,
  setShowSecondaryAxis,
  showLastCloseLine,
  setShowLastCloseLine,
  invisibleCandlesEnd,
  setInvisibleCandlesEnd,
  secondaryPanelHeightPercent,
  setSecondaryPanelHeightPercent,
  secondaryPanelHeightMin,
  secondaryPanelHeightMax,
  candleColorPreset,
  setCandleColorPreset,
  containerBackground,
  setContainerBackground,
  chartBackground,
  setChartBackground,
  footerYAxisBgColor,
  setFooterYAxisBgColor,
  backgroundTextColor,
  setBackgroundTextColor,
  footerYAxisTextColor,
  setFooterYAxisTextColor,
  lineTableColor,
  setLineTableColor,
  secondaryGridColor,
  setSecondaryGridColor,
  lastCloseLineColor,
  setLastCloseLineColor,
  lastCloseTextColor,
  setLastCloseTextColor,
  volumeOnPrice,
  setVolumeOnPrice,
  volumeOnPriceOpacity,
  setVolumeOnPriceOpacity,
  chartWidth,
  chartSizePercent,
  setChartSizePercent,
  yPadOffset,
  setYPadOffset,
  drawOpen,
  setDrawOpen,
  drawingsVisible,
  setDrawingsVisible,
  drawMode,
  drawTool,
  drawMagnetic,
  setDrawMagnetic,
  drawPanelSide,
  setDrawPanelSide,
  openDrawPanel,
  closeDrawMode,
  selectLineTool,
  selectFibonacciTool,
  selectFreeRetracementTool,
  selectChannelTool,
  selectRectangleTool,
  selectVerticalLineTool,
  selectTextTool,
  selectArrowTool,
  selectHorizontalLineTool,
  exitRulerToCrosshair,
  toggleRuler,
  selectSelectTool,
  clearAllDrawing,
  saveOpen,
  setSaveOpen,
  loadOpen,
  setLoadOpen,
  savedLayouts,
  canSaveDefault = false,
  onSaveLayout,
  onLoadLayout,
  onFetchSavedLayouts,
}: KlinesChartSidebarProps) {
  const candlePresetLabel = (id: string) => {
    const map: Record<string, string> = {
      greenRed: t.candleColorGreenRed,
      blueOrange: t.candleColorBlueOrange,
      blackWhite: t.candleColorBlackWhite,
      purpleAmber: t.candleColorPurpleAmber,
      cyanRose: t.candleColorCyanRose,
      amberBlue: t.candleColorAmberBlue,
      limePurple: t.candleColorLimePurple,
      tealOrange: t.candleColorTealOrange,
      pinkIndigo: t.candleColorPinkIndigo,
      redCyan: t.candleColorRedCyan,
      whiteWhite: t.candleColorWhiteWhite,
      blackBlack: t.candleColorBlackBlack,
    };
    return map[id] ?? id;
  };

  const [intervalsOpen, setIntervalsOpen] = useState(false);
  const currentIntervalLabel = intervalLabel ?? intervalOptions.find((o) => o.value === groupMinutes)?.label ?? "—";
  const isHorizontal = orientation === "horizontal";
  const intervalTriggerRef = useRef<HTMLDivElement>(null);
  const settingsTriggerRef = useRef<HTMLDivElement>(null);
  const saveTriggerRef = useRef<HTMLDivElement>(null);
  const loadTriggerRef = useRef<HTMLDivElement>(null);
  const [portalStyle, setPortalStyle] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!isHorizontal) return;
    const el =
      intervalsOpen
        ? intervalTriggerRef.current
        : settingsOpen
          ? settingsTriggerRef.current
          : colorsOpen
            ? colorsRef.current
            : drawOpen && drawPanelSide === "left"
              ? drawRef.current
              : saveOpen
                ? saveTriggerRef.current
                : loadOpen
                  ? loadTriggerRef.current
                  : null;
    if (!el) {
      setPortalStyle(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setPortalStyle({
      top: rect.bottom + 4,
      left: rect.left,
    });
  }, [
    isHorizontal,
    intervalsOpen,
    settingsOpen,
    colorsOpen,
    drawOpen,
    drawPanelSide,
    saveOpen,
    loadOpen,
  ]);

  const popoverPositionClass = isHorizontal ? "absolute left-0 top-full mt-1" : "absolute left-full top-0 ml-1";
  const rootClassName = isHorizontal
    ? "min-w-0 border border-zinc-200 bg-zinc-50 flex flex-row items-center relative w-full rounded-lg"
    : "flex-shrink-0 border-r border-zinc-200 bg-zinc-50 flex flex-col items-center relative h-full";
  const horizontalMaxWidth = Math.round(660 * (chartSizePercent / 100));
  const horizontalInnerMaxWidth = Math.round(600 * (chartSizePercent / 100));
  const rootStyle = isHorizontal ? ({ height: 44, maxWidth: `min(${horizontalMaxWidth}px, 100vw)` } as const) : ({ width: SIDEBAR_WIDTH } as const);
  const iconButtonClassName = isHorizontal
    ? "w-10 h-10 flex items-center justify-center text-lg hover:bg-zinc-200/80 transition-colors"
    : "w-full flex items-center justify-center py-2 text-lg hover:bg-zinc-200/80 transition-colors";
  const sectionWrapClassName = isHorizontal ? "relative flex items-center" : "relative w-full flex flex-col items-center";

  return (
    <div
      ref={settingsRef}
      className={rootClassName}
      style={rootStyle}
    >
      <div className={isHorizontal ? "flex-1 min-w-0 overflow-x-auto flex flex-row items-center" : "contents"} style={isHorizontal ? { maxWidth: `min(${horizontalInnerMaxWidth}px, calc(100% - 60px))` } : undefined}>
      {intervalOptions.length > 0 && (
        <div
          ref={intervalTriggerRef}
          className={
            isHorizontal
              ? "relative flex items-center px-1 border-r border-zinc-200/80"
              : "w-full flex flex-col items-center px-1 border-b border-zinc-200/80"
          }
        >
          <button
            type="button"
            id="interval-listbox"
            onClick={() => {
              setIntervalsOpen((o) => !o);
              setSettingsOpen(false);
              setColorsOpen(false);
            }}
            aria-label={t.interval}
            aria-expanded={intervalsOpen}
            aria-haspopup="dialog"
            title={currentIntervalLabel}
            className={
              isHorizontal
                ? "w-10 h-10 flex items-center justify-center text-sm font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded cursor-pointer"
                : "w-full flex items-center justify-center py-2 text-sm font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded cursor-pointer"
            }
          >
            {currentIntervalLabel}
          </button>
          {intervalsOpen && !isHorizontal && (
            <div
              className={`${popoverPositionClass} z-20 min-w-[140px] max-h-[80vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg py-2 px-2 flex flex-col`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label={(t as Record<string, string>).intervalsPanelTitle ?? t.interval}
            >
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide px-2 pb-2 border-b border-zinc-100 mb-2">
                {(t as Record<string, string>).intervalsPanelTitle ?? t.interval}
              </p>
              <div className="grid grid-cols-3 gap-1 mb-3">
                {intervalOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onIntervalChange(opt.value);
                      setIntervalsOpen(false);
                    }}
                    className={`text-xs font-medium py-1.5 px-2 rounded border transition-colors ${
                      opt.value === groupMinutes
                        ? "bg-zinc-200 border-zinc-300 text-zinc-900"
                        : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-100">
                {t.tableNote}
              </p>
            </div>
          )}
        </div>
      )}
      {onHeikinAshiChange != null && (
        <div
          className={
            isHorizontal
              ? "relative flex items-center px-1 border-r border-zinc-200/80"
              : "w-full flex flex-col items-center px-1 border-b border-zinc-200/80"
          }
        >
          <button
            type="button"
            onClick={() => onHeikinAshiChange(!heikinAshi)}
            className={
              isHorizontal
                ? `w-10 h-10 flex items-center justify-center text-xs font-semibold rounded cursor-pointer border ${heikinAshi ? "bg-amber-100 border-amber-300 text-amber-800" : "text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border-zinc-200"}`
                : `w-full flex items-center justify-center py-2 text-xs font-semibold rounded cursor-pointer border ${heikinAshi ? "bg-amber-100 border-amber-300 text-amber-800" : "text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border-zinc-200"}`
            }
            title={(t as Record<string, string>).heikinAshiTitle ?? "Heikin Ashi – OHLC suavizado"}
            aria-pressed={heikinAshi}
            aria-label={(t as Record<string, string>).heikinAshi ?? "Heikin Ashi"}
          >
            {(t as Record<string, string>).heikinAshi ?? "HA"}
          </button>
        </div>
      )}
      <div ref={settingsTriggerRef} className={isHorizontal ? "relative flex items-center" : undefined}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSettingsOpen((o) => !o);
            setColorsOpen(false);
          }}
          className={iconButtonClassName}
          title={t.configTitle}
          aria-expanded={settingsOpen}
        >
          ⚙️
        </button>
      <button
        type="button"
        onClick={() => setChartSizePercent((v) => (v >= 150 ? 100 : v >= 125 ? 150 : 125))}
        className={`${iconButtonClassName} ${chartSizePercent >= 125 ? "bg-zinc-200/80" : ""}`}
        title={
          chartSizePercent >= 150
            ? ((t as Record<string, string>).chartSizeRestore150 ?? "Tamanho atual: 150% (clique para voltar a 100%)")
            : chartSizePercent >= 125
              ? ((t as Record<string, string>).chartSizeTo150 ?? "Tamanho atual: 125% (clique para 150%)")
              : ((t as Record<string, string>).chartSizeEnlarge ?? "Tamanho atual: 100% (clique para expandir a 125%)")
        }
        aria-pressed={chartSizePercent >= 125}
      >
        🔍
      </button>
      {settingsOpen && !isHorizontal && (
        <div
          className={`${popoverPositionClass} z-10 min-w-[160px] rounded-lg border border-zinc-200 bg-white shadow-lg py-2 px-2`}
          onClick={(e) => e.stopPropagation()}
        >
          <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={yAxisAbbreviated}
              onChange={(e) => setYAxisAbbreviated(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span>{t.yAxisAbbreviated}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={logScale}
              onChange={(e) => setLogScale(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span>{t.logScale}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={showMainAxis}
              onChange={(e) => setShowMainAxis(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span>{t.mainAxis}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={showSecondaryAxis}
              onChange={(e) => setShowSecondaryAxis(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span>{t.secondaryAxis}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={showLastCloseLine}
              onChange={(e) => setShowLastCloseLine(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span>{t.lastCloseLine}</span>
          </label>
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700">
            <span className="shrink-0">{t.invisibleCandlesEnd}</span>
            <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setInvisibleCandlesEnd((v) => Math.max(0, v - 1))}
                disabled={invisibleCandlesEnd <= 0}
                aria-label="-"
                className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                −
              </button>
              <span className="w-6 text-center font-mono text-zinc-800 tabular-nums" aria-live="polite">
                {invisibleCandlesEnd}
              </span>
              <button
                type="button"
                onClick={() => setInvisibleCandlesEnd((v) => Math.min(30, v + 1))}
                disabled={invisibleCandlesEnd >= 30}
                aria-label="+"
                className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700">
            <span className="shrink-0">{t.secondaryPanelHeight}</span>
            <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setSecondaryPanelHeightPercent((v) => Math.max(secondaryPanelHeightMin, v - 1))}
                disabled={secondaryPanelHeightPercent <= secondaryPanelHeightMin}
                aria-label="-"
                className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                −
              </button>
              <span className="w-8 text-center font-mono text-zinc-800 tabular-nums" aria-live="polite">
                {secondaryPanelHeightPercent}%
              </span>
              <button
                type="button"
                onClick={() => setSecondaryPanelHeightPercent((v) => Math.min(secondaryPanelHeightMax, v + 1))}
                disabled={secondaryPanelHeightPercent >= secondaryPanelHeightMax}
                aria-label="+"
                className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={volumeOnPrice}
              onChange={(e) => setVolumeOnPrice(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span>{(t as Record<string, string>).volumeOnPrice ?? "Volume on price"}</span>
          </label>
          {volumeOnPrice && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700">
              <span className="shrink-0">{(t as Record<string, string>).volOpacity ?? "Vol opacity"}</span>
              <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setVolumeOnPriceOpacity((v) => Math.max(0, v - 1))}
                  disabled={volumeOnPriceOpacity <= 0}
                  aria-label="-1%"
                  className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <span className="w-8 text-center font-mono text-zinc-800 tabular-nums" aria-live="polite">
                  {volumeOnPriceOpacity}%
                </span>
                <button
                  type="button"
                  onClick={() => setVolumeOnPriceOpacity((v) => Math.min(30, v + 1))}
                  disabled={volumeOnPriceOpacity >= 30}
                  aria-label="+1%"
                  className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
      <div ref={colorsRef} className={sectionWrapClassName}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setColorsOpen((o) => !o);
            setSettingsOpen(false);
          }}
          className={iconButtonClassName}
          title={t.candleColors}
          aria-expanded={colorsOpen}
        >
          🎨
        </button>
        {colorsOpen && !isHorizontal && (
          <div
            className={`${popoverPositionClass} z-10 min-w-[180px] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg py-2 px-2`}
            style={{ maxHeight: `${Math.max(200, chartHeight - 24)}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5">{t.candleColors}</div>
            {CANDLE_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setCandleColorPreset(preset.id)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${candleColorPreset === preset.id ? "bg-zinc-200 font-medium" : "hover:bg-zinc-100"}`}
              >
                <span className="w-3 h-3 rounded-full shrink-0 border border-zinc-300" style={{ backgroundColor: preset.bull }} />
                <span className="w-3 h-3 rounded-full shrink-0 border border-zinc-300" style={{ backgroundColor: preset.bear }} />
                <span>{candlePresetLabel(preset.id)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCandleColorPreset(DEFAULT_CANDLE_PRESET)}
              className="w-full text-left px-2 py-1.5 rounded text-sm mt-1 border-t border-zinc-100 hover:bg-zinc-100 text-zinc-600"
            >
              {t.default}
            </button>
            <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.background}</div>
            <div className="flex flex-wrap gap-1 px-2">
              {BACKGROUND_PALETTE.map((bg) => (
                <button
                  key={`cb-${bg.id}`}
                  type="button"
                  onClick={() => setContainerBackground(bg.id)}
                  title={t[bg.labelKey]}
                  className={`w-6 h-6 rounded border-2 shrink-0 ${containerBackground === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                  style={{ backgroundColor: bg.hex }}
                />
              ))}
            </div>
            <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.areaPlot}</div>
            <div className="flex flex-wrap gap-1 px-2">
              {BACKGROUND_PALETTE.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setChartBackground(bg.id)}
                  title={t[bg.labelKey]}
                  className={`w-6 h-6 rounded border-2 shrink-0 ${chartBackground === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                  style={{ backgroundColor: bg.hex }}
                />
              ))}
            </div>
            <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.footerAndYAxis}</div>
            <div className="flex flex-wrap gap-1 px-2">
              {BACKGROUND_PALETTE.map((bg) => (
                <button
                  key={`fy-${bg.id}`}
                  type="button"
                  onClick={() => setFooterYAxisBgColor(bg.id)}
                  title={t[bg.labelKey]}
                  className={`w-6 h-6 rounded border-2 shrink-0 ${footerYAxisBgColor === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                  style={{ backgroundColor: bg.hex }}
                />
              ))}
            </div>
            <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.linesAndTable}</div>
            <div className="flex flex-wrap gap-1 px-2">
              {LINE_GRID_PALETTE.map((bg) => (
                <button
                  key={`lt-${bg.id}`}
                  type="button"
                  onClick={() => setLineTableColor(bg.id)}
                  title={t[bg.labelKey]}
                  className={`w-6 h-6 rounded border-2 shrink-0 ${lineTableColor === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                  style={{ backgroundColor: bg.hex }}
                />
              ))}
            </div>
            <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.secondaryGrid}</div>
            <div className="flex flex-wrap gap-1 px-2">
              {LINE_GRID_PALETTE.map((bg) => (
                <button
                  key={`sg-${bg.id}`}
                  type="button"
                  onClick={() => setSecondaryGridColor(bg.id)}
                  title={t[bg.labelKey]}
                  className={`w-6 h-6 rounded border-2 shrink-0 ${secondaryGridColor === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                  style={{ backgroundColor: bg.hex }}
                />
              ))}
            </div>
            <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.lastCloseLineColor}</div>
            <div className="flex flex-wrap gap-1 px-2">
              {LINE_GRID_PALETTE.map((bg) => (
                <button
                  key={`lcl-${bg.id}`}
                  type="button"
                  onClick={() => setLastCloseLineColor(bg.id)}
                  title={t[bg.labelKey]}
                  className={`w-6 h-6 rounded border-2 shrink-0 ${lastCloseLineColor === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                  style={{ backgroundColor: bg.hex }}
                />
              ))}
            </div>
            <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.lastCloseTextColor}</div>
            <div className="flex flex-wrap gap-1 px-2">
              {LINE_GRID_PALETTE.map((bg) => (
                <button
                  key={`lct-${bg.id}`}
                  type="button"
                  onClick={() => setLastCloseTextColor(bg.id)}
                  title={t[bg.labelKey]}
                  className={`w-6 h-6 rounded border-2 shrink-0 ${lastCloseTextColor === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                  style={{ backgroundColor: bg.hex }}
                />
              ))}
            </div>
            <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.textBackground}</div>
            <div className="flex flex-wrap gap-1 px-2">
              {TEXT_PALETTE.map((bg) => (
                <button
                  key={`bt-${bg.id}`}
                  type="button"
                  onClick={() => setBackgroundTextColor(bg.id)}
                  title={t[bg.labelKey]}
                  className={`w-6 h-6 rounded border-2 shrink-0 ${backgroundTextColor === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                  style={{ backgroundColor: bg.hex }}
                />
              ))}
            </div>
            <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.textFooterYAxis}</div>
            <div className="flex flex-wrap gap-1 px-2">
              {TEXT_PALETTE.map((bg) => (
                <button
                  key={`ft-${bg.id}`}
                  type="button"
                  onClick={() => setFooterYAxisTextColor(bg.id)}
                  title={t[bg.labelKey]}
                  className={`w-6 h-6 rounded border-2 shrink-0 ${footerYAxisTextColor === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                  style={{ backgroundColor: bg.hex }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <div ref={drawRef} className={sectionWrapClassName}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDrawingsVisible((v) => !v);
          }}
          className={`${iconButtonClassName} ${!drawingsVisible ? "opacity-60" : ""}`}
          title={(t as Record<string, string>).drawVisibilityTitle}
          aria-label={(t as Record<string, string>).drawVisibilityAria}
          aria-pressed={!drawingsVisible}
        >
          <span className={!drawingsVisible ? "opacity-50" : ""} aria-hidden>👁</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setColorsOpen(false);
            setSettingsOpen(false);
            openDrawPanel();
          }}
          className={`${iconButtonClassName} ${drawOpen ? "bg-zinc-200" : ""}`}
          title={t.drawTool}
          aria-expanded={drawOpen}
        >
          <img src={`${ASSET_PREFIX}/assets/draw/esquadro.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (drawMode && drawTool === "select") {
              closeDrawMode();
            } else {
              selectSelectTool();
            }
          }}
          title={t.drawSelectSegment}
          className={`${iconButtonClassName} ${drawMode && drawTool === "select" ? "bg-zinc-200" : ""}`}
          aria-label={t.drawSelectSegment}
          aria-pressed={drawMode && drawTool === "select"}
        >
          <span aria-hidden>👆</span>
        </button>
        <button
          type="button"
          data-ruler-toggle
          onClick={(e) => {
            e.stopPropagation();
            toggleRuler();
          }}
          title={drawMode && drawTool === "ruler" ? ((t as Record<string, string>).drawRuler ?? "Ruler") : ((t as Record<string, string>).drawCrosshair ?? "Crosshair")}
          className={`${iconButtonClassName} ${drawMode && drawTool === "ruler" ? "bg-zinc-200" : ""}`}
          aria-label={drawMode && drawTool === "ruler" ? ((t as Record<string, string>).drawRuler ?? "Ruler") : ((t as Record<string, string>).drawCrosshair ?? "Crosshair")}
          aria-pressed={drawMode && drawTool === "ruler"}
        >
          <img src={`${ASSET_PREFIX}/assets/draw/${drawMode && drawTool === "ruler" ? "ruler" : "crosshair"}.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" aria-hidden />
        </button>
        <label className={`${iconButtonClassName} ${drawMagnetic ? "bg-zinc-200" : ""}`} title={t.drawMagnetic}>
          <input type="checkbox" checked={drawMagnetic} onChange={(e) => setDrawMagnetic(e.target.checked)} className="rounded border-zinc-300 sr-only" />
          <span aria-hidden>🧲</span>
        </label>
      </div>
      <div ref={saveLoadRef} className={isHorizontal ? "flex items-center" : "w-full flex flex-col items-center"}>
        <div ref={saveTriggerRef} className={isHorizontal ? "relative flex items-center" : "relative w-full"}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSaveOpen((o) => !o);
              setLoadOpen(false);
            }}
            className={iconButtonClassName}
            title={t.saveLayout}
            aria-expanded={saveOpen}
          >
            💾
          </button>
          {saveOpen && !isHorizontal && (
            <div
              className={`${popoverPositionClass} z-10 min-w-[140px] rounded-lg border border-zinc-200 bg-white shadow-lg py-2 px-2`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5">{t.saveLayout}</div>
              {(canSaveDefault ? [0, 1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7]).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onSaveLayout(slot)}
                  className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-zinc-100"
                >
                  {slot === 0 ? t.defaultLayout : t.layoutName.replace("{n}", String(slot))}
                </button>
              ))}
            </div>
          )}
        </div>
        <div ref={loadTriggerRef} className={isHorizontal ? "relative flex items-center" : "relative w-full"}>
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              setLoadOpen((o) => {
                if (!o) onFetchSavedLayouts();
                return !o;
              });
              setSaveOpen(false);
            }}
            className={iconButtonClassName}
            title={t.loadLayout}
            aria-expanded={loadOpen}
          >
            📂
          </button>
          {loadOpen && !isHorizontal && (
            <div
              className={`${popoverPositionClass} z-10 min-w-[140px] rounded-lg border border-zinc-200 bg-white shadow-lg py-2 px-2`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5">{t.loadLayout}</div>
              {savedLayouts.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-zinc-500">{t.noSavedLayouts}</p>
              ) : (
                savedLayouts.map((layout) => (
                  <button
                    key={layout.slot}
                    type="button"
                    onClick={() => onLoadLayout(layout)}
                    className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-zinc-100"
                  >
                    {layout.slot === 0 ? t.defaultLayout : t.layoutName.replace("{n}", String(layout.slot))}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      </div>
      {isHorizontal && (
        <div className="ml-auto flex w-[60px] shrink-0 items-center justify-center border-l border-zinc-200/80 pl-1">
          <button
            type="button"
            onClick={() => setYPadOffset((v) => Math.max(0, v - 1))}
            disabled={yPadOffset <= 0}
            className={`${iconButtonClassName} !w-[30px]`}
            title={(t as Record<string, string>).yPadLess ?? "Diminuir margem no eixo Y (voltar ao original)"}
            aria-label={(t as Record<string, string>).yPadLess ?? "Diminuir margem eixo Y"}
          >
            <span className="inline-block h-4 w-3" aria-hidden>
              <svg viewBox="0 0 12 16" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="2" x2="6" y2="14" />
                <path d="M3 11 l3-3 3 3" />
                <path d="M3 5 l3 3 3-3" />
              </svg>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setYPadOffset((v) => Math.min(3, v + 1))}
            disabled={yPadOffset >= 3}
            className={`${iconButtonClassName} !w-[30px]`}
            title={(t as Record<string, string>).yPadMore ?? "Aumentar margem no eixo Y (previsões)"}
            aria-label={(t as Record<string, string>).yPadMore ?? "Aumentar margem eixo Y"}
          >
            <span className="inline-block h-4 w-3" aria-hidden>
              <svg viewBox="0 0 12 16" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="2" x2="6" y2="14" />
                <path d="M3 5 l3-3 3 3" />
                <path d="M3 11 l3 3 3-3" />
              </svg>
            </span>
          </button>
        </div>
      )}
      {isHorizontal &&
        portalStyle &&
        (intervalsOpen || settingsOpen || colorsOpen || (drawOpen && drawPanelSide === "left") || saveOpen || loadOpen) &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[100] min-w-[140px] max-h-[85vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg py-2 px-2"
            style={{ top: portalStyle.top, left: portalStyle.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {intervalsOpen && (
              <>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide px-2 pb-2 border-b border-zinc-100 mb-2">
                  {(t as Record<string, string>).intervalsPanelTitle ?? t.interval}
                </p>
                <div className="grid grid-cols-3 gap-1 mb-3">
                  {intervalOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onIntervalChange(opt.value);
                        setIntervalsOpen(false);
                      }}
                      className={`text-xs font-medium py-1.5 px-2 rounded border transition-colors ${
                        opt.value === groupMinutes ? "bg-zinc-200 border-zinc-300 text-zinc-900" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-100">{t.tableNote}</p>
              </>
            )}
            {settingsOpen && !intervalsOpen && (
              <>
                <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
                  <input type="checkbox" checked={yAxisAbbreviated} onChange={(e) => setYAxisAbbreviated(e.target.checked)} className="rounded border-zinc-300" />
                  <span>{t.yAxisAbbreviated}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
                  <input type="checkbox" checked={logScale} onChange={(e) => setLogScale(e.target.checked)} className="rounded border-zinc-300" />
                  <span>{t.logScale}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
                  <input type="checkbox" checked={showMainAxis} onChange={(e) => setShowMainAxis(e.target.checked)} className="rounded border-zinc-300" />
                  <span>{t.mainAxis}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
                  <input type="checkbox" checked={showSecondaryAxis} onChange={(e) => setShowSecondaryAxis(e.target.checked)} className="rounded border-zinc-300" />
                  <span>{t.secondaryAxis}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
                  <input type="checkbox" checked={showLastCloseLine} onChange={(e) => setShowLastCloseLine(e.target.checked)} className="rounded border-zinc-300" />
                  <span>{t.lastCloseLine}</span>
                </label>
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700">
                  <span className="shrink-0">{t.invisibleCandlesEnd}</span>
                  <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                    <button type="button" onClick={() => setInvisibleCandlesEnd((v) => Math.max(0, v - 1))} disabled={invisibleCandlesEnd <= 0} aria-label="-" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed">−</button>
                    <span className="w-6 text-center font-mono text-zinc-800 tabular-nums" aria-live="polite">{invisibleCandlesEnd}</span>
                    <button type="button" onClick={() => setInvisibleCandlesEnd((v) => Math.min(30, v + 1))} disabled={invisibleCandlesEnd >= 30} aria-label="+" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed">+</button>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700">
                  <span className="shrink-0">{t.secondaryPanelHeight}</span>
                  <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                    <button type="button" onClick={() => setSecondaryPanelHeightPercent((v) => Math.max(secondaryPanelHeightMin, v - 1))} disabled={secondaryPanelHeightPercent <= secondaryPanelHeightMin} aria-label="-" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed">−</button>
                    <span className="w-8 text-center font-mono text-zinc-800 tabular-nums" aria-live="polite">{secondaryPanelHeightPercent}%</span>
                    <button type="button" onClick={() => setSecondaryPanelHeightPercent((v) => Math.min(secondaryPanelHeightMax, v + 1))} disabled={secondaryPanelHeightPercent >= secondaryPanelHeightMax} aria-label="+" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed">+</button>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
                  <input type="checkbox" checked={volumeOnPrice} onChange={(e) => setVolumeOnPrice(e.target.checked)} className="rounded border-zinc-300" />
                  <span>{(t as Record<string, string>).volumeOnPrice ?? "Volume on price"}</span>
                </label>
                {volumeOnPrice && (
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700">
                    <span className="shrink-0">{(t as Record<string, string>).volOpacity ?? "Vol opacity"}</span>
                    <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                      <button type="button" onClick={() => setVolumeOnPriceOpacity((v) => Math.max(0, v - 1))} disabled={volumeOnPriceOpacity <= 0} aria-label="-1%" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed">−</button>
                      <span className="w-8 text-center font-mono text-zinc-800 tabular-nums" aria-live="polite">{volumeOnPriceOpacity}%</span>
                      <button type="button" onClick={() => setVolumeOnPriceOpacity((v) => Math.min(30, v + 1))} disabled={volumeOnPriceOpacity >= 30} aria-label="+1%" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed">+</button>
                    </div>
                  </div>
                )}
              </>
            )}
            {colorsOpen && !intervalsOpen && !settingsOpen && (
              <div className="min-w-[180px]" style={{ maxHeight: `${Math.max(200, chartHeight - 24)}px` }}>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5">{t.candleColors}</div>
                {CANDLE_COLOR_PRESETS.map((preset) => (
                  <button key={preset.id} type="button" onClick={() => setCandleColorPreset(preset.id)} className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${candleColorPreset === preset.id ? "bg-zinc-200 font-medium" : "hover:bg-zinc-100"}`}>
                    <span className="w-3 h-3 rounded-full shrink-0 border border-zinc-300" style={{ backgroundColor: preset.bull }} />
                    <span className="w-3 h-3 rounded-full shrink-0 border border-zinc-300" style={{ backgroundColor: preset.bear }} />
                    <span>{candlePresetLabel(preset.id)}</span>
                  </button>
                ))}
                <button type="button" onClick={() => setCandleColorPreset(DEFAULT_CANDLE_PRESET)} className="w-full text-left px-2 py-1.5 rounded text-sm mt-1 border-t border-zinc-100 hover:bg-zinc-100 text-zinc-600">{t.default}</button>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.background}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {BACKGROUND_PALETTE.map((bg) => (
                    <button key={`cb-${bg.id}`} type="button" onClick={() => setContainerBackground(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${containerBackground === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.areaPlot}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {BACKGROUND_PALETTE.map((bg) => (
                    <button key={bg.id} type="button" onClick={() => setChartBackground(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${chartBackground === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.footerAndYAxis}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {BACKGROUND_PALETTE.map((bg) => (
                    <button key={`fy-${bg.id}`} type="button" onClick={() => setFooterYAxisBgColor(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${footerYAxisBgColor === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.linesAndTable}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {LINE_GRID_PALETTE.map((bg) => (
                    <button key={`lt-${bg.id}`} type="button" onClick={() => setLineTableColor(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${lineTableColor === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.secondaryGrid}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {LINE_GRID_PALETTE.map((bg) => (
                    <button key={`sg-${bg.id}`} type="button" onClick={() => setSecondaryGridColor(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${secondaryGridColor === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.lastCloseLineColor}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {LINE_GRID_PALETTE.map((bg) => (
                    <button key={`lcl-${bg.id}`} type="button" onClick={() => setLastCloseLineColor(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${lastCloseLineColor === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.lastCloseTextColor}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {LINE_GRID_PALETTE.map((bg) => (
                    <button key={`lct-${bg.id}`} type="button" onClick={() => setLastCloseTextColor(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${lastCloseTextColor === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.textBackground}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {TEXT_PALETTE.map((bg) => (
                    <button key={`bt-${bg.id}`} type="button" onClick={() => setBackgroundTextColor(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${backgroundTextColor === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.textFooterYAxis}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {TEXT_PALETTE.map((bg) => (
                    <button key={`ft-${bg.id}`} type="button" onClick={() => setFooterYAxisTextColor(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${footerYAxisTextColor === bg.id ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
              </div>
            )}
            {drawOpen && drawPanelSide === "left" && !intervalsOpen && !settingsOpen && !colorsOpen && !saveOpen && !loadOpen && (
              <>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide px-2 pb-2 border-b border-zinc-100 mb-2">
                  {t.drawTool}
                </p>
                <div className="grid grid-cols-2 gap-1">
                  <button type="button" onClick={selectLineTool} title={t.lineSegment} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "line" ? "bg-zinc-200" : ""}`} aria-label={t.lineSegment}>
                    <img src={`${ASSET_PREFIX}/assets/draw/trend.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" />
                  </button>
                  <button type="button" onClick={selectHorizontalLineTool} title={(t as Record<string, string>).horizontalLine ?? "Horizontal line"} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "horizontalLine" ? "bg-zinc-200" : ""}`} aria-label={(t as Record<string, string>).horizontalLine ?? "Horizontal line"}>
                    <span aria-hidden>―</span>
                  </button>
                  <button type="button" onClick={selectFibonacciTool} title={(t as Record<string, string>).fibonacciRetracement ?? "Fibonacci retracement"} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "fibonacci" ? "bg-zinc-200" : ""}`} aria-label={(t as Record<string, string>).fibonacciRetracement ?? "Fibonacci retracement"}>
                    <img src={`${ASSET_PREFIX}/assets/draw/fibonacci.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" />
                  </button>
                  <button type="button" onClick={selectFreeRetracementTool} title={(t as Record<string, string>).freeRetracement ?? "Retração livre"} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "freeRetracement" ? "bg-zinc-200" : ""}`} aria-label={(t as Record<string, string>).freeRetracement ?? "Retração livre"}>
                    <img src={`${ASSET_PREFIX}/assets/draw/retracao.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" aria-hidden />
                  </button>
                  <button type="button" onClick={selectRectangleTool} title={(t as Record<string, string>).rectangleTool ?? "Rectangle"} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "rectangle" ? "bg-zinc-200" : ""}`} aria-label={(t as Record<string, string>).rectangleTool ?? "Rectangle"}>
                    <img src={`${ASSET_PREFIX}/assets/draw/retangulo.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" />
                  </button>
                  <button type="button" onClick={selectChannelTool} title={(t as Record<string, string>).channelTool ?? "Channel"} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "channel" ? "bg-zinc-200" : ""}`} aria-label={(t as Record<string, string>).channelTool ?? "Channel"}>
                    <img src={`${ASSET_PREFIX}/assets/draw/canal.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" />
                  </button>
                  <button type="button" onClick={selectVerticalLineTool} title={(t as Record<string, string>).verticalLine ?? "Vertical line"} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "verticalLine" ? "bg-zinc-200" : ""}`} aria-label={(t as Record<string, string>).verticalLine ?? "Vertical line"}>
                    <span aria-hidden>|</span>
                  </button>
                  <button type="button" onClick={selectTextTool} title={(t as Record<string, string>).drawTextTool ?? "Text"} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "text" ? "bg-zinc-200" : ""}`} aria-label={(t as Record<string, string>).drawTextTool ?? "Text"}>
                    <img src={`${ASSET_PREFIX}/assets/draw/text.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" />
                  </button>
                  <button type="button" onClick={selectArrowTool} title={(t as Record<string, string>).arrowTool ?? "Arrow"} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "arrow" ? "bg-zinc-200" : ""}`} aria-label={(t as Record<string, string>).arrowTool ?? "Arrow"}>
                    <img src={`${ASSET_PREFIX}/assets/draw/seta.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" />
                  </button>
                </div>
              </>
            )}
            {saveOpen && !intervalsOpen && !settingsOpen && !colorsOpen && !(drawOpen && drawPanelSide === "left") && (
              <>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5">{t.saveLayout}</div>
                {(canSaveDefault ? [0, 1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7]).map((slot) => (
                  <button key={slot} type="button" onClick={() => onSaveLayout(slot)} className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-zinc-100">{slot === 0 ? t.defaultLayout : t.layoutName.replace("{n}", String(slot))}</button>
                ))}
              </>
            )}
            {loadOpen && !intervalsOpen && !settingsOpen && !colorsOpen && !(drawOpen && drawPanelSide === "left") && !saveOpen && (
              <>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5">{t.loadLayout}</div>
                {savedLayouts.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-zinc-500">{t.noSavedLayouts}</p>
                ) : (
                  savedLayouts.map((layout) => (
                    <button key={layout.slot} type="button" onClick={() => onLoadLayout(layout)} className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-zinc-100">{layout.slot === 0 ? t.defaultLayout : t.layoutName.replace("{n}", String(layout.slot))}</button>
                  ))
                )}
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
