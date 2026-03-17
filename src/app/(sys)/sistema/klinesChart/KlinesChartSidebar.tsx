"use client";

/**
 * Sidebar do gráfico de candles: configuração, cores, desenho e save/load de layout.
 */
import { useState, useRef, useLayoutEffect, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ASSET_PREFIX } from "@/app/constants";
import { KLINE_LAST_LAYOUT_KEY, SIDEBAR_WIDTH } from "../KlinesChartConstants";
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
  chartStyle?: "candles" | "bars" | "line" | "linePoints" | "area";
  onChartStyleChange?: (style: "candles" | "bars" | "line" | "linePoints" | "area") => void;
  candleBodyStyle?: "filled" | "hollow";
  onCandleBodyStyleChange?: (style: "filled" | "hollow") => void;
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
  showCandleCountdown: boolean;
  setShowCandleCountdown: (v: boolean) => void;
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
  volumeAtPriceData?: unknown;
  volumeAtPriceEnabled?: boolean;
  volumeAtPriceBuckets?: number;
  volumeAtPricePercent?: number;
  onVolumeAtPricePercentChange?: (v: number) => void;
  vapTimeSpanLabel?: string;
  volumeAtPriceOpacity?: number;
  volumeAtPriceWidthPercent?: number;
  onVolumeAtPriceWidthPercentChange?: (v: number) => void;
  volumeAtPriceSide?: "left" | "right";
  volumeAtPriceColorAbove?: string;
  volumeAtPriceColorBelow?: string;
  onVolumeAtPriceEnabledChange?: (v: boolean) => void;
  onVolumeAtPriceBucketsChange?: (v: number) => void;
  onVolumeAtPriceOpacityChange?: (v: number) => void;
  onVolumeAtPriceSideChange?: (v: "left" | "right") => void;
  onVolumeAtPriceColorAboveChange?: (v: string) => void;
  onVolumeAtPriceColorBelowChange?: (v: string) => void;
  /** Chamado ao clicar em "Salvar" ao lado de Volume ou Volume no preço; persiste as prefs no layout (o gráfico já reflete as alterações em tempo real). */
  onSaveVolumePrefsToLayout?: () => void;
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
  drawTool: "line" | "fibonacci" | "freeRetracement" | "channel" | "stopGain" | "rectangle" | "horizontalLine" | "verticalLine" | "arrow" | "text" | "ruler" | "select" | "pencil";
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
  selectStopGainTool: () => void;
  selectRectangleTool: () => void;
  selectVerticalLineTool: () => void;
  selectTextTool: () => void;
  selectArrowTool: () => void;
  selectHorizontalLineTool: () => void;
  selectPencilTool: () => void;
  exitRulerToCrosshair: () => void;
  toggleRuler: () => void;
  selectSelectTool: () => void;
  clearAllDrawing: () => void;
}

export function KlinesChartSidebar({
  chartHeight,
  settingsRef,
  colorsRef,
  drawRef,
  orientation = "vertical",
  t,
  intervalLabel,
  intervalOptions,
  groupMinutes,
  onIntervalChange,
  heikinAshi = false,
  onHeikinAshiChange,
  chartStyle = "candles",
  onChartStyleChange,
  candleBodyStyle = "filled",
  onCandleBodyStyleChange,
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
  showCandleCountdown,
  setShowCandleCountdown,
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
  volumeAtPriceEnabled = false,
  volumeAtPriceBuckets = 20,
  volumeAtPricePercent = 100,
  onVolumeAtPricePercentChange,
  vapTimeSpanLabel = "",
  volumeAtPriceOpacity = 40,
  volumeAtPriceWidthPercent = 100,
  onVolumeAtPriceWidthPercentChange,
  volumeAtPriceSide = "left",
  volumeAtPriceColorAbove = "#059669",
  volumeAtPriceColorBelow = "#dc2626",
  onVolumeAtPriceEnabledChange,
  onVolumeAtPriceBucketsChange,
  onVolumeAtPriceOpacityChange,
  onVolumeAtPriceSideChange,
  onVolumeAtPriceColorAboveChange,
  onVolumeAtPriceColorBelowChange,
  onSaveVolumePrefsToLayout,
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
  selectStopGainTool,
  selectRectangleTool,
  selectVerticalLineTool,
  selectTextTool,
  selectArrowTool,
  selectHorizontalLineTool,
  selectPencilTool,
  exitRulerToCrosshair,
  toggleRuler,
  selectSelectTool,
  clearAllDrawing,
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
  const [chartTypeOpen, setChartTypeOpen] = useState(false);
  const [vapColorAboveOpen, setVapColorAboveOpen] = useState(false);
  const [vapColorBelowOpen, setVapColorBelowOpen] = useState(false);
  const [showVolumePrefsSaved, setShowVolumePrefsSaved] = useState(false);
  const volumePrefsSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Chamado ao clicar em "Salvar" ao lado de Volume ou Volume no preço: persiste as prefs atuais no layout (aplicação no gráfico já é imediata). */
  const handleSaveVolumePrefsToLayout = () => {
    onSaveVolumePrefsToLayout?.();
    if (volumePrefsSavedTimeoutRef.current) clearTimeout(volumePrefsSavedTimeoutRef.current);
    setShowVolumePrefsSaved(true);
    volumePrefsSavedTimeoutRef.current = setTimeout(() => {
      setShowVolumePrefsSaved(false);
      volumePrefsSavedTimeoutRef.current = null;
    }, 2000);
  };
  useLayoutEffect(() => {
    return () => {
      if (volumePrefsSavedTimeoutRef.current) clearTimeout(volumePrefsSavedTimeoutRef.current);
    };
  }, []);
  useLayoutEffect(() => {
    if (!settingsOpen) {
      setVapColorAboveOpen(false);
      setVapColorBelowOpen(false);
    }
  }, [settingsOpen]);
  const currentIntervalLabel = intervalLabel ?? intervalOptions.find((o) => o.value === groupMinutes)?.label ?? "—";
  const rawLayout = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY) : null;
  const isDefaultModel = rawLayout === "default" || rawLayout === "0";
  const isHorizontal = orientation === "horizontal";
  const intervalTriggerRef = useRef<HTMLDivElement>(null);
  const chartTypeTriggerRef = useRef<HTMLDivElement>(null);
  const settingsTriggerRef = useRef<HTMLDivElement>(null);
  const [portalStyle, setPortalStyle] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const anyOpen = chartTypeOpen || intervalsOpen || settingsOpen || colorsOpen || (drawOpen && drawPanelSide === "left");
    if (!anyOpen) {
      setPortalStyle(null);
      return;
    }
    const el =
      chartTypeOpen
        ? chartTypeTriggerRef.current
        : intervalsOpen
          ? intervalTriggerRef.current
          : settingsOpen
            ? settingsTriggerRef.current
            : colorsOpen
              ? colorsRef.current
              : drawOpen && drawPanelSide === "left"
                ? drawRef.current
                : null;
    if (!el) {
      setPortalStyle(null);
      return;
    }
    const updatePosition = () => {
      const r = el.getBoundingClientRect();
      if (isHorizontal) {
        setPortalStyle((prev) => {
          const next = { top: r.bottom + 4, left: r.left };
          if (prev && prev.top === next.top && prev.left === next.left) return prev;
          return next;
        });
      } else {
        setPortalStyle((prev) => {
          const next = { top: r.top, left: r.right + 4 };
          if (prev && prev.top === next.top && prev.left === next.left) return prev;
          return next;
        });
      }
    };
    updatePosition();
    let rafId: number;
    const tick = () => {
      updatePosition();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    const onResize = () => updatePosition();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, [isHorizontal, chartTypeOpen, intervalsOpen, settingsOpen, colorsOpen, drawOpen, drawPanelSide]);

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
        </div>
      )}
      {onHeikinAshiChange != null && onChartStyleChange != null && onCandleBodyStyleChange != null && (
        <div
          ref={chartTypeTriggerRef}
          className={
            isHorizontal
              ? "relative flex items-center px-1 border-r border-zinc-200/80"
              : "w-full flex flex-col items-center px-1 border-b border-zinc-200/80"
          }
        >
          {(() => {
            const chartTypeLabel = heikinAshi
              ? ((t as Record<string, string>).chartTypeHeikinAshi ?? "Heikin Ashi")
              : chartStyle === "bars"
                ? ((t as Record<string, string>).chartTypeBars ?? "Barras")
                : chartStyle === "line"
                  ? ((t as Record<string, string>).chartTypeLine ?? "Linhas")
                  : chartStyle === "linePoints"
                    ? ((t as Record<string, string>).chartTypeLinePoints ?? "Linhas ponto")
                    : chartStyle === "area"
                      ? ((t as Record<string, string>).chartTypeArea ?? "Área")
                      : candleBodyStyle === "hollow"
                        ? ((t as Record<string, string>).chartTypeCandlesHollow ?? "Candles vazias")
                        : ((t as Record<string, string>).chartTypeCandles ?? "Candles");
            return (
              <>
                <button
                  type="button"
                  id="chart-type-listbox"
                  onClick={() => {
                    setChartTypeOpen((o) => !o);
                    setIntervalsOpen(false);
                    setSettingsOpen(false);
                    setColorsOpen(false);
                  }}
                  aria-label={(t as Record<string, string>).chartTypeLabel ?? "Tipo de gráfico"}
                  aria-expanded={chartTypeOpen}
                  aria-haspopup="dialog"
                  title={chartTypeLabel}
                  className={
                    isHorizontal
                      ? "w-10 h-10 flex items-center justify-center text-sm font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded cursor-pointer"
                      : "w-full flex items-center justify-center py-2 text-sm font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded cursor-pointer"
                  }
                >
                  6
                </button>
              </>
            );
          })()}
        </div>
      )}
      <div className={sectionWrapClassName}>
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
      <div ref={drawRef} className={sectionWrapClassName}>
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
      </div>
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
      {false && settingsOpen && !isHorizontal && (
        <div
          className={`${popoverPositionClass} z-10 min-w-[160px] combobox-dropdown-max rounded-lg border border-zinc-200 bg-white shadow-lg py-2 px-2`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label={t.configTitle}
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
              checked={showCandleCountdown}
              onChange={(e) => setShowCandleCountdown(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span>{(t as Record<string, string>).showCandleCountdown ?? "Candle countdown"}</span>
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
                onClick={() => setInvisibleCandlesEnd((v) => Math.min(50, v + 1))}
                disabled={invisibleCandlesEnd >= 50}
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
            <span>{(t as Record<string, string>).volumeOnPrice ?? "Volume"}</span>
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
          {volumeOnPrice && onSaveVolumePrefsToLayout != null && (
            <div className="px-2 py-1 flex items-center gap-2">
              <button type="button" onClick={handleSaveVolumePrefsToLayout} className="px-2 py-1 rounded border border-zinc-800 bg-zinc-900 text-sm text-white hover:bg-zinc-800">
                {(t as Record<string, string>).save ?? "Salvar"}
              </button>
              {showVolumePrefsSaved && (
                <span className="text-sm text-zinc-600" aria-live="polite">{(t as Record<string, string>).saved ?? "Salvo"}</span>
              )}
            </div>
          )}
          {onVolumeAtPriceEnabledChange != null && (
            <>
              <div className="border-t border-zinc-100 pt-2 mt-2" />
              <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
                <input type="checkbox" checked={volumeAtPriceEnabled} onChange={(e) => onVolumeAtPriceEnabledChange?.(e.target.checked)} className="rounded border-zinc-300" />
                <span>{(t as Record<string, string>).volumeAtPrice ?? "Volume no preço"}</span>
              </label>
              {volumeAtPriceEnabled && (
                <>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700">
                    <span className="shrink-0">{(t as Record<string, string>).volumeAtPriceBuckets ?? "Intervalos (eixo Y)"}</span>
                    <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                      <button type="button" onClick={() => onVolumeAtPriceBucketsChange?.(Math.max(20, (volumeAtPriceBuckets ?? 20) - 2))} disabled={(volumeAtPriceBuckets ?? 20) <= 20} aria-label="−2" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">−</button>
                      <span className="w-8 text-center font-mono text-zinc-800 tabular-nums" aria-live="polite">{volumeAtPriceBuckets ?? 20}</span>
                      <button type="button" onClick={() => onVolumeAtPriceBucketsChange?.(Math.min(60, (volumeAtPriceBuckets ?? 20) + 2))} disabled={(volumeAtPriceBuckets ?? 20) >= 60} aria-label="+2" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">+</button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 px-2 py-1.5 text-sm text-zinc-700">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0">{(t as Record<string, string>).volumeAtPricePercent ?? "Percentual de velas"}</span>
                      <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                        <button type="button" onClick={() => onVolumeAtPricePercentChange?.(Math.max(20, (volumeAtPricePercent ?? 100) - 1))} disabled={(volumeAtPricePercent ?? 100) <= 20} aria-label="−1%" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">−</button>
                        <span className="w-10 text-center font-mono text-zinc-800 tabular-nums" aria-live="polite">{volumeAtPricePercent ?? 100}%</span>
                        <button type="button" onClick={() => onVolumeAtPricePercentChange?.(Math.min(100, (volumeAtPricePercent ?? 100) + 1))} disabled={(volumeAtPricePercent ?? 100) >= 100} aria-label="+1%" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">+</button>
                      </div>
                    </div>
                    {vapTimeSpanLabel ? <span className="text-xs text-zinc-500">({vapTimeSpanLabel})</span> : null}
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700">
                    <span className="shrink-0">{(t as Record<string, string>).volumeAtPriceSide ?? "Lado"}</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => onVolumeAtPriceSideChange?.("left")} className={`px-2 py-1 rounded border text-xs font-medium ${(volumeAtPriceSide ?? "left") === "left" ? "bg-zinc-200 border-zinc-400" : "border-zinc-200 hover:bg-zinc-100"}`}>{(t as Record<string, string>).volumeAtPriceSideLeft ?? "Esquerda"}</button>
                      <button type="button" onClick={() => onVolumeAtPriceSideChange?.("right")} className={`px-2 py-1 rounded border text-xs font-medium ${(volumeAtPriceSide ?? "left") === "right" ? "bg-zinc-200 border-zinc-400" : "border-zinc-200 hover:bg-zinc-100"}`}>{(t as Record<string, string>).volumeAtPriceSideRight ?? "Direita"}</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700">
                    <span className="shrink-0">{(t as Record<string, string>).volumeAtPriceOpacity ?? "Opacidade"}</span>
                    <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                      <button type="button" onClick={() => onVolumeAtPriceOpacityChange?.(Math.max(10, (volumeAtPriceOpacity ?? 40) - 5))} disabled={(volumeAtPriceOpacity ?? 40) <= 10} aria-label="−5%" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">−</button>
                      <span className="w-10 text-center font-mono text-zinc-800 tabular-nums" aria-live="polite">{volumeAtPriceOpacity ?? 40}%</span>
                      <button type="button" onClick={() => onVolumeAtPriceOpacityChange?.(Math.min(70, (volumeAtPriceOpacity ?? 40) + 5))} disabled={(volumeAtPriceOpacity ?? 40) >= 70} aria-label="+5%" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700">
                    <span className="shrink-0">{(t as Record<string, string>).volumeAtPriceWidth ?? "Largura"}</span>
                    <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                      <button type="button" onClick={() => onVolumeAtPriceWidthPercentChange?.(Math.max(30, (volumeAtPriceWidthPercent ?? 100) - 1))} disabled={(volumeAtPriceWidthPercent ?? 100) <= 30} aria-label="−1%" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">−</button>
                      <span className="w-10 text-center font-mono text-zinc-800 tabular-nums" aria-live="polite">{volumeAtPriceWidthPercent ?? 100}%</span>
                      <button type="button" onClick={() => onVolumeAtPriceWidthPercentChange?.(Math.min(100, (volumeAtPriceWidthPercent ?? 100) + 1))} disabled={(volumeAtPriceWidthPercent ?? 100) >= 100} aria-label="+1%" className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">+</button>
                    </div>
                  </div>
                  <div className="px-2 py-1.5 text-sm text-zinc-700 relative">
                    <button
                      type="button"
                      onClick={() => { setVapColorBelowOpen(false); setVapColorAboveOpen((o) => !o); }}
                      aria-expanded={vapColorAboveOpen}
                      aria-haspopup="listbox"
                      aria-label={(t as Record<string, string>).volumeAtPriceColorAbove ?? "Cor metade acima"}
                      className="w-full flex items-center gap-2 rounded border border-zinc-300 bg-white px-2 py-1.5 text-left hover:bg-zinc-50"
                    >
                      <span className="shrink-0">{(t as Record<string, string>).volumeAtPriceColorAbove ?? "Cor metade acima"}</span>
                      <span className="w-5 h-5 rounded border border-zinc-300 shrink-0" style={{ backgroundColor: volumeAtPriceColorAbove ?? "#059669" }} aria-hidden />
                    </button>
                    {vapColorAboveOpen && (
                      <div className="absolute left-0 top-full mt-1 z-20 min-w-[120px] combobox-dropdown-max rounded-lg border border-zinc-200 bg-white shadow-lg p-2" role="listbox" aria-label={(t as Record<string, string>).volumeAtPriceColorAbove ?? "Cor metade acima"} onClick={(e) => e.stopPropagation()}>
                        <div className="grid grid-cols-4 gap-1">
                          {CANDLE_COLOR_PRESETS.flatMap((p) => [p.bull, p.bear]).filter((hex, i, arr) => arr.indexOf(hex) === i).map((hex) => (
                            <button key={hex} type="button" role="option" aria-selected={(volumeAtPriceColorAbove ?? "#059669") === hex} onClick={() => { onVolumeAtPriceColorAboveChange?.(hex); setVapColorAboveOpen(false); }} title={hex} className={`w-6 h-6 rounded border-2 shrink-0 ${(volumeAtPriceColorAbove ?? "#059669") === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: hex }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-1.5 text-sm text-zinc-700 relative">
                    <button
                      type="button"
                      onClick={() => { setVapColorAboveOpen(false); setVapColorBelowOpen((o) => !o); }}
                      aria-expanded={vapColorBelowOpen}
                      aria-haspopup="listbox"
                      aria-label={(t as Record<string, string>).volumeAtPriceColorBelow ?? "Cor metade abaixo"}
                      className="w-full flex items-center gap-2 rounded border border-zinc-300 bg-white px-2 py-1.5 text-left hover:bg-zinc-50"
                    >
                      <span className="shrink-0">{(t as Record<string, string>).volumeAtPriceColorBelow ?? "Cor metade abaixo"}</span>
                      <span className="w-5 h-5 rounded border border-zinc-300 shrink-0" style={{ backgroundColor: volumeAtPriceColorBelow ?? "#dc2626" }} aria-hidden />
                    </button>
                    {vapColorBelowOpen && (
                      <div className="absolute left-0 top-full mt-1 z-20 min-w-[120px] combobox-dropdown-max rounded-lg border border-zinc-200 bg-white shadow-lg p-2" role="listbox" aria-label={(t as Record<string, string>).volumeAtPriceColorBelow ?? "Cor metade abaixo"} onClick={(e) => e.stopPropagation()}>
                        <div className="grid grid-cols-4 gap-1">
                          {CANDLE_COLOR_PRESETS.flatMap((p) => [p.bull, p.bear]).filter((hex, i, arr) => arr.indexOf(hex) === i).map((hex) => (
                            <button key={hex} type="button" role="option" aria-selected={(volumeAtPriceColorBelow ?? "#dc2626") === hex} onClick={() => { onVolumeAtPriceColorBelowChange?.(hex); setVapColorBelowOpen(false); }} title={hex} className={`w-6 h-6 rounded border-2 shrink-0 ${(volumeAtPriceColorBelow ?? "#dc2626") === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: hex }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {onSaveVolumePrefsToLayout != null && (
                    <div className="px-2 py-1 flex items-center gap-2">
                      <button type="button" onClick={handleSaveVolumePrefsToLayout} className="px-2 py-1 rounded border border-zinc-800 bg-zinc-900 text-sm text-white hover:bg-zinc-800">
                        {(t as Record<string, string>).save ?? "Salvar"}
                      </button>
                      {showVolumePrefsSaved && (
                        <span className="text-sm text-zinc-600" aria-live="polite">{(t as Record<string, string>).saved ?? "Salvo"}</span>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
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
        {false && colorsOpen && !isHorizontal && (
          <div
            className={`${popoverPositionClass} z-10 min-w-[180px] combobox-dropdown-max rounded-lg border border-zinc-200 bg-white shadow-lg py-2 px-2`}
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
      <div className={sectionWrapClassName}>
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
      </div>
      </div>
      {isHorizontal && (
        <div className="flex h-full min-w-[60px] w-[60px] shrink-0 flex-none items-center justify-center pl-1" style={{ width: 60, background: "transparent", border: "none", touchAction: "pan-y" }} aria-hidden>
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
      {portalStyle &&
        (chartTypeOpen || intervalsOpen || settingsOpen || colorsOpen || (drawOpen && drawPanelSide === "left")) &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[100] w-max min-w-[7.5rem] combobox-dropdown-max rounded-lg border border-zinc-200 bg-white shadow-lg py-2 px-2"
            style={{ top: portalStyle.top, left: portalStyle.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {chartTypeOpen && (
              <>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide px-2 pb-2 border-b border-zinc-100 mb-2">{(t as Record<string, string>).chartTypeLabel ?? "Tipo de gráfico"}</p>
                <div className="grid grid-cols-1 gap-1 mb-2">
                  <button type="button" onClick={() => { onHeikinAshiChange?.(false); onChartStyleChange?.("candles"); onCandleBodyStyleChange?.("filled"); setChartTypeOpen(false); }} className={`text-xs font-medium py-1.5 px-2 rounded border text-left ${!heikinAshi && chartStyle === "candles" && candleBodyStyle === "filled" ? "bg-zinc-200 border-zinc-300" : "bg-white border-zinc-200 hover:bg-zinc-50"}`}>{(t as Record<string, string>).chartTypeCandles ?? "Candles"}</button>
                  <button type="button" disabled={isDefaultModel} onClick={() => { if (!isDefaultModel) { onHeikinAshiChange?.(false); onChartStyleChange?.("candles"); onCandleBodyStyleChange?.("hollow"); setChartTypeOpen(false); } }} className={`text-xs font-medium py-1.5 px-2 rounded border text-left flex items-center gap-1.5 ${!heikinAshi && chartStyle === "candles" && candleBodyStyle === "hollow" ? "bg-zinc-200 border-zinc-300" : "bg-white border-zinc-200 hover:bg-zinc-50"} ${isDefaultModel ? "opacity-50 cursor-not-allowed" : ""}`}>{isDefaultModel ? "🔒 " : ""}{(t as Record<string, string>).chartTypeCandlesHollow ?? "Candles vazias"}</button>
                  <button type="button" disabled={isDefaultModel} onClick={() => { if (!isDefaultModel) { onHeikinAshiChange?.(false); onChartStyleChange?.("bars"); setChartTypeOpen(false); } }} className={`text-xs font-medium py-1.5 px-2 rounded border text-left flex items-center gap-1.5 ${!heikinAshi && chartStyle === "bars" ? "bg-zinc-200 border-zinc-300" : "bg-white border-zinc-200 hover:bg-zinc-50"} ${isDefaultModel ? "opacity-50 cursor-not-allowed" : ""}`}>{isDefaultModel ? "🔒 " : ""}{(t as Record<string, string>).chartTypeBars ?? "Barras"}</button>
                  <button type="button" disabled={isDefaultModel} onClick={() => { if (!isDefaultModel) { onHeikinAshiChange?.(false); onChartStyleChange?.("line"); setChartTypeOpen(false); } }} className={`text-xs font-medium py-1.5 px-2 rounded border text-left flex items-center gap-1.5 ${!heikinAshi && chartStyle === "line" ? "bg-zinc-200 border-zinc-300" : "bg-white border-zinc-200 hover:bg-zinc-50"} ${isDefaultModel ? "opacity-50 cursor-not-allowed" : ""}`}>{isDefaultModel ? "🔒 " : ""}{(t as Record<string, string>).chartTypeLine ?? "Linhas"}</button>
                  <button type="button" disabled={isDefaultModel} onClick={() => { if (!isDefaultModel) { onHeikinAshiChange?.(false); onChartStyleChange?.("linePoints"); setChartTypeOpen(false); } }} className={`text-xs font-medium py-1.5 px-2 rounded border text-left flex items-center gap-1.5 ${!heikinAshi && chartStyle === "linePoints" ? "bg-zinc-200 border-zinc-300" : "bg-white border-zinc-200 hover:bg-zinc-50"} ${isDefaultModel ? "opacity-50 cursor-not-allowed" : ""}`}>{isDefaultModel ? "🔒 " : ""}{(t as Record<string, string>).chartTypeLinePoints ?? "Linhas ponto"}</button>
                  <button type="button" disabled={isDefaultModel} onClick={() => { if (!isDefaultModel) { onHeikinAshiChange?.(false); onChartStyleChange?.("area"); setChartTypeOpen(false); } }} className={`text-xs font-medium py-1.5 px-2 rounded border text-left flex items-center gap-1.5 ${!heikinAshi && chartStyle === "area" ? "bg-zinc-200 border-zinc-300" : "bg-white border-zinc-200 hover:bg-zinc-50"} ${isDefaultModel ? "opacity-50 cursor-not-allowed" : ""}`}>{isDefaultModel ? "🔒 " : ""}{(t as Record<string, string>).chartTypeArea ?? "Área"}</button>
                  <button type="button" disabled={isDefaultModel} onClick={() => { if (!isDefaultModel) { onHeikinAshiChange?.(true); onChartStyleChange?.("candles"); onCandleBodyStyleChange?.("filled"); setChartTypeOpen(false); } }} className={`text-xs font-medium py-1.5 px-2 rounded border text-left flex items-center gap-1.5 ${heikinAshi ? "bg-zinc-200 border-zinc-300" : "bg-white border-zinc-200 hover:bg-zinc-50"} ${isDefaultModel ? "opacity-50 cursor-not-allowed" : ""}`}>{isDefaultModel ? "🔒 " : ""}{(t as Record<string, string>).chartTypeHeikinAshi ?? "Heikin Ashi"}</button>
                </div>
              </>
            )}
            {intervalsOpen && !chartTypeOpen && (
              <>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide px-2 pb-2 border-b border-zinc-100 mb-2">{(t as Record<string, string>).intervalsPanelTitle ?? t.interval}</p>
                <div className="grid grid-cols-3 gap-1 mb-3">
                  {intervalOptions.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => { onIntervalChange(opt.value); setIntervalsOpen(false); }} className={`text-xs font-medium py-1.5 px-2 rounded border ${opt.value === groupMinutes ? "bg-zinc-200 border-zinc-300" : "bg-white border-zinc-200 hover:bg-zinc-50"}`}>{opt.label}</button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-100">{t.tableNote}</p>
              </>
            )}
            {settingsOpen && !chartTypeOpen && !intervalsOpen && (
              <div className="min-w-[160px]">
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
                <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
                  <input type="checkbox" checked={showCandleCountdown} onChange={(e) => setShowCandleCountdown(e.target.checked)} className="rounded border-zinc-300" />
                  <span>{(t as Record<string, string>).showCandleCountdown ?? "Candle countdown"}</span>
                </label>
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700">
                  <span className="shrink-0">{t.invisibleCandlesEnd}</span>
                  <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                    <button type="button" onClick={() => setInvisibleCandlesEnd((v) => Math.max(0, v - 1))} disabled={invisibleCandlesEnd <= 0} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">−</button>
                    <span className="w-6 text-center font-mono text-zinc-800 tabular-nums">{invisibleCandlesEnd}</span>
                    <button type="button" onClick={() => setInvisibleCandlesEnd((v) => Math.min(50, v + 1))} disabled={invisibleCandlesEnd >= 50} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">+</button>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700">
                  <span className="shrink-0">{t.secondaryPanelHeight}</span>
                  <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                    <button type="button" onClick={() => setSecondaryPanelHeightPercent((v) => Math.max(secondaryPanelHeightMin, v - 1))} disabled={secondaryPanelHeightPercent <= secondaryPanelHeightMin} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">−</button>
                    <span className="w-8 text-center font-mono text-zinc-800 tabular-nums">{secondaryPanelHeightPercent}%</span>
                    <button type="button" onClick={() => setSecondaryPanelHeightPercent((v) => Math.min(secondaryPanelHeightMax, v + 1))} disabled={secondaryPanelHeightPercent >= secondaryPanelHeightMax} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">+</button>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
                  <input type="checkbox" checked={volumeOnPrice} onChange={(e) => setVolumeOnPrice(e.target.checked)} className="rounded border-zinc-300" />
                  <span>{(t as Record<string, string>).volumeOnPrice ?? "Volume"}</span>
                </label>
                {volumeOnPrice && (
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700">
                    <span className="shrink-0">{(t as Record<string, string>).volOpacity ?? "Vol opacity"}</span>
                    <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                      <button type="button" onClick={() => setVolumeOnPriceOpacity((v) => Math.max(0, v - 1))} disabled={volumeOnPriceOpacity <= 0} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">−</button>
                      <span className="w-8 text-center font-mono text-zinc-800 tabular-nums">{volumeOnPriceOpacity}%</span>
                      <button type="button" onClick={() => setVolumeOnPriceOpacity((v) => Math.min(30, v + 1))} disabled={volumeOnPriceOpacity >= 30} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">+</button>
                    </div>
                  </div>
                )}
                {volumeOnPrice && onSaveVolumePrefsToLayout != null && (
                  <div className="px-2 py-1 flex items-center gap-2">
                    <button type="button" onClick={handleSaveVolumePrefsToLayout} className="px-2 py-1 rounded border border-zinc-800 bg-zinc-900 text-sm text-white hover:bg-zinc-800">{(t as Record<string, string>).save ?? "Salvar"}</button>
                    {showVolumePrefsSaved && (
                      <span className="text-sm text-zinc-600" aria-live="polite">{(t as Record<string, string>).saved ?? "Salvo"}</span>
                    )}
                  </div>
                )}
                {onVolumeAtPriceEnabledChange != null && (
                  <>
                    <div className="border-t border-zinc-100 pt-2 mt-2" />
                    <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700">
                      <input type="checkbox" checked={volumeAtPriceEnabled} onChange={(e) => onVolumeAtPriceEnabledChange?.(e.target.checked)} className="rounded border-zinc-300" />
                      <span>{(t as Record<string, string>).volumeAtPrice ?? "Volume no preço"}</span>
                    </label>
                    {volumeAtPriceEnabled && (
                      <div className="space-y-2 py-1">
                        <div className="flex items-center gap-2 px-2 text-sm text-zinc-700">
                          <span className="shrink-0">{(t as Record<string, string>).volumeAtPriceBuckets ?? "Intervalos"}</span>
                          <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                            <button type="button" onClick={() => onVolumeAtPriceBucketsChange?.(Math.max(20, (volumeAtPriceBuckets ?? 20) - 2))} disabled={(volumeAtPriceBuckets ?? 20) <= 20} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">−</button>
                            <span className="w-8 text-center font-mono text-zinc-800 tabular-nums">{volumeAtPriceBuckets ?? 20}</span>
                            <button type="button" onClick={() => onVolumeAtPriceBucketsChange?.(Math.min(60, (volumeAtPriceBuckets ?? 20) + 2))} disabled={(volumeAtPriceBuckets ?? 20) >= 60} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">+</button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5 px-2 text-sm text-zinc-700">
                          <div className="flex items-center gap-2">
                            <span className="shrink-0">{(t as Record<string, string>).volumeAtPricePercent ?? "Percentual de velas"}</span>
                            <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                              <button type="button" onClick={() => onVolumeAtPricePercentChange?.(Math.max(20, (volumeAtPricePercent ?? 100) - 1))} disabled={(volumeAtPricePercent ?? 100) <= 20} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">−</button>
                              <span className="w-10 text-center font-mono text-zinc-800 tabular-nums">{volumeAtPricePercent ?? 100}%</span>
                              <button type="button" onClick={() => onVolumeAtPricePercentChange?.(Math.min(100, (volumeAtPricePercent ?? 100) + 1))} disabled={(volumeAtPricePercent ?? 100) >= 100} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">+</button>
                            </div>
                          </div>
                          {vapTimeSpanLabel ? <span className="text-xs text-zinc-500">({vapTimeSpanLabel})</span> : null}
                        </div>
                        <div className="flex items-center gap-2 px-2 text-sm text-zinc-700">
                          <span className="shrink-0">{(t as Record<string, string>).volumeAtPriceSide ?? "Lado"}</span>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => onVolumeAtPriceSideChange?.("left")} className={`px-2 py-1 rounded border text-xs ${(volumeAtPriceSide ?? "left") === "left" ? "bg-zinc-200 border-zinc-400" : "border-zinc-200 hover:bg-zinc-100"}`}>{(t as Record<string, string>).volumeAtPriceSideLeft ?? "Esq."}</button>
                            <button type="button" onClick={() => onVolumeAtPriceSideChange?.("right")} className={`px-2 py-1 rounded border text-xs ${(volumeAtPriceSide ?? "left") === "right" ? "bg-zinc-200 border-zinc-400" : "border-zinc-200 hover:bg-zinc-100"}`}>{(t as Record<string, string>).volumeAtPriceSideRight ?? "Dir."}</button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-2 text-sm text-zinc-700">
                          <span className="shrink-0">{(t as Record<string, string>).volumeAtPriceOpacity ?? "Opacidade"}</span>
                          <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                            <button type="button" onClick={() => onVolumeAtPriceOpacityChange?.(Math.max(10, (volumeAtPriceOpacity ?? 40) - 5))} disabled={(volumeAtPriceOpacity ?? 40) <= 10} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">−</button>
                            <span className="w-10 text-center font-mono text-zinc-800 tabular-nums">{volumeAtPriceOpacity ?? 40}%</span>
                            <button type="button" onClick={() => onVolumeAtPriceOpacityChange?.(Math.min(70, (volumeAtPriceOpacity ?? 40) + 5))} disabled={(volumeAtPriceOpacity ?? 40) >= 70} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">+</button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-2 text-sm text-zinc-700">
                          <span className="shrink-0">{(t as Record<string, string>).volumeAtPriceWidth ?? "Largura"}</span>
                          <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
                            <button type="button" onClick={() => onVolumeAtPriceWidthPercentChange?.(Math.max(30, (volumeAtPriceWidthPercent ?? 100) - 1))} disabled={(volumeAtPriceWidthPercent ?? 100) <= 30} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">−</button>
                            <span className="w-10 text-center font-mono text-zinc-800 tabular-nums">{volumeAtPriceWidthPercent ?? 100}%</span>
                            <button type="button" onClick={() => onVolumeAtPriceWidthPercentChange?.(Math.min(100, (volumeAtPriceWidthPercent ?? 100) + 1))} disabled={(volumeAtPriceWidthPercent ?? 100) >= 100} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">+</button>
                          </div>
                        </div>
                        <div className="px-2 relative">
                          <button type="button" onClick={() => { setVapColorBelowOpen(false); setVapColorAboveOpen((o) => !o); }} className="w-full flex items-center gap-2 rounded border border-zinc-300 bg-white px-2 py-1.5 text-left hover:bg-zinc-50 text-sm">
                            <span className="shrink-0">{(t as Record<string, string>).volumeAtPriceColorAbove ?? "Cor acima"}</span>
                            <span className="w-4 h-4 rounded border border-zinc-300 shrink-0" style={{ backgroundColor: volumeAtPriceColorAbove ?? "#059669" }} />
                          </button>
                          {vapColorAboveOpen && (
                            <div className="absolute left-0 top-full mt-1 z-[101] min-w-[100px] combobox-dropdown-max rounded-lg border border-zinc-200 bg-white shadow-lg p-1.5">
                              <div className="grid grid-cols-4 gap-0.5">
                                {CANDLE_COLOR_PRESETS.flatMap((p) => [p.bull, p.bear]).filter((hex, i, arr) => arr.indexOf(hex) === i).map((hex) => (
                                  <button key={hex} type="button" onClick={() => { onVolumeAtPriceColorAboveChange?.(hex); setVapColorAboveOpen(false); }} className={`w-5 h-5 rounded border shrink-0 ${(volumeAtPriceColorAbove ?? "#059669") === hex ? "border-zinc-900 ring-1" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="px-2 relative">
                          <button type="button" onClick={() => { setVapColorAboveOpen(false); setVapColorBelowOpen((o) => !o); }} className="w-full flex items-center gap-2 rounded border border-zinc-300 bg-white px-2 py-1.5 text-left hover:bg-zinc-50 text-sm">
                            <span className="shrink-0">{(t as Record<string, string>).volumeAtPriceColorBelow ?? "Cor abaixo"}</span>
                            <span className="w-4 h-4 rounded border border-zinc-300 shrink-0" style={{ backgroundColor: volumeAtPriceColorBelow ?? "#dc2626" }} />
                          </button>
                          {vapColorBelowOpen && (
                            <div className="absolute left-0 top-full mt-1 z-[101] min-w-[100px] combobox-dropdown-max rounded-lg border border-zinc-200 bg-white shadow-lg p-1.5">
                              <div className="grid grid-cols-4 gap-0.5">
                                {CANDLE_COLOR_PRESETS.flatMap((p) => [p.bull, p.bear]).filter((hex, i, arr) => arr.indexOf(hex) === i).map((hex) => (
                                  <button key={hex} type="button" onClick={() => { onVolumeAtPriceColorBelowChange?.(hex); setVapColorBelowOpen(false); }} className={`w-5 h-5 rounded border shrink-0 ${(volumeAtPriceColorBelow ?? "#dc2626") === hex ? "border-zinc-900 ring-1" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {onSaveVolumePrefsToLayout != null && (
                          <div className="px-2 py-1 flex items-center gap-2">
                            <button type="button" onClick={handleSaveVolumePrefsToLayout} className="px-2 py-1 rounded border border-zinc-800 bg-zinc-900 text-sm text-white hover:bg-zinc-800">{(t as Record<string, string>).save ?? "Salvar"}</button>
                            {showVolumePrefsSaved && (
                              <span className="text-sm text-zinc-600" aria-live="polite">{(t as Record<string, string>).saved ?? "Salvo"}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {colorsOpen && !chartTypeOpen && !intervalsOpen && !settingsOpen && (
              <div className="min-w-[180px]" style={{ maxHeight: "400px" }}>
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
                    <button key={`cb-${bg.id}`} type="button" onClick={() => setContainerBackground(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${containerBackground === bg.id ? "border-zinc-900 ring-1" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.areaPlot}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {BACKGROUND_PALETTE.map((bg) => (
                    <button key={bg.id} type="button" onClick={() => setChartBackground(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${chartBackground === bg.id ? "border-zinc-900 ring-1" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.footerAndYAxis}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {BACKGROUND_PALETTE.map((bg) => (
                    <button key={`fy-${bg.id}`} type="button" onClick={() => setFooterYAxisBgColor(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${footerYAxisBgColor === bg.id ? "border-zinc-900 ring-1" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.linesAndTable}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {LINE_GRID_PALETTE.map((bg) => (
                    <button key={`lt-${bg.id}`} type="button" onClick={() => setLineTableColor(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${lineTableColor === bg.id ? "border-zinc-900 ring-1" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.secondaryGrid}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {LINE_GRID_PALETTE.map((bg) => (
                    <button key={`sg-${bg.id}`} type="button" onClick={() => setSecondaryGridColor(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${secondaryGridColor === bg.id ? "border-zinc-900 ring-1" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.lastCloseLineColor}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {LINE_GRID_PALETTE.map((bg) => (
                    <button key={`lcl-${bg.id}`} type="button" onClick={() => setLastCloseLineColor(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${lastCloseLineColor === bg.id ? "border-zinc-900 ring-1" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.lastCloseTextColor}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {LINE_GRID_PALETTE.map((bg) => (
                    <button key={`lct-${bg.id}`} type="button" onClick={() => setLastCloseTextColor(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${lastCloseTextColor === bg.id ? "border-zinc-900 ring-1" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.textBackground}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {TEXT_PALETTE.map((bg) => (
                    <button key={`bt-${bg.id}`} type="button" onClick={() => setBackgroundTextColor(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${backgroundTextColor === bg.id ? "border-zinc-900 ring-1" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
                <div className="text-[10px] font-medium text-zinc-500 px-2 pb-1.5 pt-2 mt-1 border-t border-zinc-100">{t.textFooterYAxis}</div>
                <div className="flex flex-wrap gap-1 px-2">
                  {TEXT_PALETTE.map((bg) => (
                    <button key={`ft-${bg.id}`} type="button" onClick={() => setFooterYAxisTextColor(bg.id)} title={t[bg.labelKey]} className={`w-6 h-6 rounded border-2 shrink-0 ${footerYAxisTextColor === bg.id ? "border-zinc-900 ring-1" : "border-zinc-300 hover:border-zinc-500"}`} style={{ backgroundColor: bg.hex }} />
                  ))}
                </div>
              </div>
            )}
            {drawOpen && drawPanelSide === "left" && !chartTypeOpen && !intervalsOpen && !settingsOpen && !colorsOpen && (
              <>
                <div className="flex items-center justify-between gap-2 px-2 pb-2 border-b border-zinc-100 mb-2">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{t.drawTool}</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDrawingsVisible((v) => !v); }}
                    className={`w-8 h-8 flex items-center justify-center rounded text-base hover:bg-zinc-100 shrink-0 ${!drawingsVisible ? "opacity-60" : ""}`}
                    title={(t as Record<string, string>).drawVisibilityTitle}
                    aria-label={(t as Record<string, string>).drawVisibilityAria}
                    aria-pressed={!drawingsVisible}
                  >
                    <span className={!drawingsVisible ? "opacity-50" : ""} aria-hidden>👁</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button type="button" onClick={selectLineTool} title={t.lineSegment} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "line" ? "bg-zinc-200" : ""}`}><img src={`${ASSET_PREFIX}/assets/draw/trend.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" /></button>
                  <button type="button" onClick={selectHorizontalLineTool} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "horizontalLine" ? "bg-zinc-200" : ""}`}><span aria-hidden>―</span></button>
                  <button type="button" onClick={selectFibonacciTool} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "fibonacci" ? "bg-zinc-200" : ""}`}><img src={`${ASSET_PREFIX}/assets/draw/fibonacci.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" /></button>
                  <button type="button" onClick={selectFreeRetracementTool} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "freeRetracement" ? "bg-zinc-200" : ""}`}><img src={`${ASSET_PREFIX}/assets/draw/retracao.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" aria-hidden /></button>
                  <button type="button" onClick={selectRectangleTool} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "rectangle" ? "bg-zinc-200" : ""}`}><img src={`${ASSET_PREFIX}/assets/draw/retangulo.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" /></button>
                  <button type="button" onClick={selectChannelTool} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "channel" ? "bg-zinc-200" : ""}`}><img src={`${ASSET_PREFIX}/assets/draw/canal.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" /></button>
                  <button type="button" onClick={selectStopGainTool} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "stopGain" ? "bg-zinc-200" : ""}`}><img src={`${ASSET_PREFIX}/assets/draw/stopgain.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" /></button>
                  <button type="button" onClick={selectVerticalLineTool} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "verticalLine" ? "bg-zinc-200" : ""}`}><span aria-hidden>|</span></button>
                  <button type="button" onClick={selectTextTool} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "text" ? "bg-zinc-200" : ""}`}><img src={`${ASSET_PREFIX}/assets/draw/text.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" /></button>
                  <button type="button" onClick={selectArrowTool} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "arrow" ? "bg-zinc-200" : ""}`}><img src={`${ASSET_PREFIX}/assets/draw/seta.webp`} alt="" className="w-5 h-5 object-contain pointer-events-none" /></button>
                  <button type="button" onClick={selectPencilTool} className={`flex items-center justify-center w-9 h-9 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "pencil" ? "bg-zinc-200" : ""}`} title={(t as Record<string, string>).pencilTool ?? "Lápis"}><span aria-hidden>✎</span></button>
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
