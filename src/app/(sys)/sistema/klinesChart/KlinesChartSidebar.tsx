"use client";

/**
 * Sidebar do gráfico de candles: configuração, cores, desenho e save/load de layout.
 */
import type { RefObject } from "react";
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
export type KlinesChartSidebarTranslations = Record<string, string>;

export interface KlinesChartSidebarProps {
  chartHeight: number;
  settingsRef: RefObject<HTMLDivElement | null>;
  colorsRef: RefObject<HTMLDivElement | null>;
  saveLoadRef: RefObject<HTMLDivElement | null>;
  drawRef: RefObject<HTMLDivElement | null>;
  t: KlinesChartSidebarTranslations;
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
  showIndicatorLastValueOnYAxis: boolean;
  setShowIndicatorLastValueOnYAxis: (v: boolean) => void;
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
  // Draw
  drawOpen: boolean;
  setDrawOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  drawingsVisible: boolean;
  setDrawingsVisible: (v: boolean | ((o: boolean) => boolean)) => void;
  drawMode: boolean;
  drawTool: "line" | "select";
  drawMagnetic: boolean;
  setDrawMagnetic: (v: boolean) => void;
  drawPanelSide: "left" | "right";
  setDrawPanelSide: (v: "left" | "right" | ((s: "left" | "right") => "left" | "right")) => void;
  openDrawPanel: () => void;
  closeDrawMode: () => void;
  selectLineTool: () => void;
  selectSelectTool: () => void;
  clearAllDrawing: () => void;
  // Save/Load
  saveOpen: boolean;
  setSaveOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  loadOpen: boolean;
  setLoadOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  savedLayouts: { slot: number; config: Record<string, unknown> }[];
  onSaveLayout: (slot: number) => void;
  onLoadDefaultLayout: () => void;
  onLoadLayout: (layout: { slot: number; config: Record<string, unknown> }) => void;
  onFetchSavedLayouts: () => void;
}

export function KlinesChartSidebar({
  chartHeight,
  settingsRef,
  colorsRef,
  saveLoadRef,
  drawRef,
  t,
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
  showIndicatorLastValueOnYAxis,
  setShowIndicatorLastValueOnYAxis,
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
  selectSelectTool,
  clearAllDrawing,
  saveOpen,
  setSaveOpen,
  loadOpen,
  setLoadOpen,
  savedLayouts,
  onSaveLayout,
  onLoadDefaultLayout,
  onLoadLayout,
  onFetchSavedLayouts,
}: KlinesChartSidebarProps) {
  return (
    <div
      ref={settingsRef}
      className="flex-shrink-0 border-r border-zinc-200 bg-zinc-50 flex flex-col items-center relative"
      style={{ width: SIDEBAR_WIDTH, height: chartHeight }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setSettingsOpen((o) => !o);
          setColorsOpen(false);
        }}
        className="w-full flex items-center justify-center py-2 text-lg hover:bg-zinc-200/80 transition-colors"
        title={t.configTitle}
        aria-expanded={settingsOpen}
      >
        ⚙️
      </button>
      {settingsOpen && (
        <div
          className="absolute left-full top-0 ml-1 z-10 min-w-[160px] rounded-lg border border-zinc-200 bg-white shadow-lg py-2 px-2"
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
          <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={showIndicatorLastValueOnYAxis}
              onChange={(e) => setShowIndicatorLastValueOnYAxis(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span>{t.showIndicatorLastValueOnYAxis}</span>
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
      <div ref={colorsRef} className="relative w-full flex flex-col items-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setColorsOpen((o) => !o);
            setSettingsOpen(false);
          }}
          className="w-full flex items-center justify-center py-2 text-lg hover:bg-zinc-200/80 transition-colors"
          title={t.candleColors}
          aria-expanded={colorsOpen}
        >
          🎨
        </button>
        {colorsOpen && (
          <div
            className="absolute left-full top-0 ml-1 z-10 min-w-[180px] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg py-2 px-2"
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
                <span>
                  {preset.id === "greenRed" && t.candleColorGreenRed}
                  {preset.id === "blueOrange" && t.candleColorBlueOrange}
                  {preset.id === "blackWhite" && t.candleColorBlackWhite}
                  {preset.id === "purpleAmber" && t.candleColorPurpleAmber}
                  {preset.id === "cyanRose" && t.candleColorCyanRose}
                </span>
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
      <div ref={drawRef} className="relative w-full flex flex-col items-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDrawingsVisible((v) => !v);
          }}
          className={`w-full flex items-center justify-center py-2 text-lg hover:bg-zinc-200/80 transition-colors ${!drawingsVisible ? "opacity-60" : ""}`}
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
          className={`w-full flex items-center justify-center py-2 text-lg hover:bg-zinc-200/80 transition-colors ${drawMode ? "bg-zinc-200" : ""}`}
          title={t.drawTool}
          aria-expanded={drawOpen}
        >
          📐
        </button>
        {drawOpen && drawPanelSide === "left" && (
          <div
            className="absolute left-full top-0 ml-1 z-10 w-fit min-w-0 rounded-lg border border-zinc-200 bg-white shadow-lg py-1 px-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-0.5 px-0.5 pb-1 border-b border-zinc-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDrawPanelSide((s) => (s === "left" ? "right" : "left"));
                }}
                className="p-0.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 text-xs leading-none"
                title={drawPanelSide === "left" ? t.segmentToolboxMoveRight : t.segmentToolboxMoveLeft}
                aria-label={drawPanelSide === "left" ? t.segmentToolboxMoveRight : t.segmentToolboxMoveLeft}
              >
                {drawPanelSide === "left" ? "→" : "←"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDrawOpen(false);
                  closeDrawMode();
                }}
                className="p-0.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 text-sm leading-none font-semibold"
                title={t.drawExitMode}
                aria-label={t.drawExitMode}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            <button
              type="button"
              onClick={selectLineTool}
              title={t.lineSegment}
              className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 ${drawTool === "line" ? "bg-zinc-100" : ""}`}
              aria-label={t.lineSegment}
            >
              📏
            </button>
            <button
              type="button"
              onClick={selectSelectTool}
              title={t.drawSelectSegment}
              className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 ${drawTool === "select" ? "bg-zinc-100" : ""}`}
              aria-label={t.drawSelectSegment}
            >
              👆
            </button>
            <label
              className={`flex items-center justify-center w-8 h-8 cursor-pointer rounded text-base hover:bg-zinc-100 ${drawMagnetic ? "bg-zinc-100" : ""}`}
              title={t.drawMagnetic}
            >
              <input
                type="checkbox"
                checked={drawMagnetic}
                onChange={(e) => setDrawMagnetic(e.target.checked)}
                className="rounded border-zinc-300 sr-only"
              />
              <span aria-hidden>🧲</span>
            </label>
            <button
              type="button"
              onClick={clearAllDrawing}
              title={t.drawClearAll}
              className="flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 text-zinc-700"
              aria-label={t.drawClearAll}
            >
              🗑️
            </button>
          </div>
        )}
      </div>
      <div ref={saveLoadRef} className="w-full flex flex-col items-center">
        <div className="relative w-full">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSaveOpen((o) => !o);
              setLoadOpen(false);
            }}
            className="w-full flex items-center justify-center py-2 text-lg hover:bg-zinc-200/80 transition-colors"
            title={t.saveLayout}
            aria-expanded={saveOpen}
          >
            💾
          </button>
          {saveOpen && (
            <div
              className="absolute left-full top-0 ml-1 z-10 min-w-[140px] rounded-lg border border-zinc-200 bg-white shadow-lg py-2 px-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5">{t.saveLayout}</div>
              {([1, 2, 3, 4, 5, 6, 7] as const).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onSaveLayout(slot)}
                  className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-zinc-100"
                >
                  {t.layoutName.replace("{n}", String(slot))}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative w-full">
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
            className="w-full flex items-center justify-center py-2 text-lg hover:bg-zinc-200/80 transition-colors"
            title={t.loadLayout}
            aria-expanded={loadOpen}
          >
            📂
          </button>
          {loadOpen && (
            <div
              className="absolute left-full top-0 ml-1 z-10 min-w-[140px] rounded-lg border border-zinc-200 bg-white shadow-lg py-2 px-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5">{t.loadLayout}</div>
              <button
                type="button"
                onClick={onLoadDefaultLayout}
                className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-zinc-100 font-medium"
              >
                {t.defaultLayout}
              </button>
              {savedLayouts.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-zinc-500 border-t border-zinc-100 mt-1 pt-1">{t.noSavedLayouts}</p>
              ) : (
                <>
                  <div className="border-t border-zinc-100 mt-1 pt-1" />
                  {savedLayouts.map((layout) => (
                    <button
                      key={layout.slot}
                      type="button"
                      onClick={() => onLoadLayout(layout)}
                      className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-zinc-100"
                    >
                      {t.layoutName.replace("{n}", String(layout.slot))}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
