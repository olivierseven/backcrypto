"use client";

/**
 * Gráfico de candles (OHLC). Janela visível configurável.
 * Eixo Y: preço USDT (ajustado aos candles visíveis). Eixo X: tempo + subeixo por data.
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { API_BASE } from "@/app/constants";
import { useBioLang } from "@/app/contexts/BioLangContext";
import { getBioT } from "@/app/lib/translations";
import {
  ASPECT_BREAKPOINT,
  MIN_CHART_HEIGHT,
  PAD_Y,
  Y_PAD_OFFSET_MAX,
  BODY_WIDTH_RATIO,
  Y_AXIS_WIDTH,
  GAP_PLOT_Y_AXIS,
  MARGIN_LEFT,
  MARGIN_TOP,
  MARGIN_BOTTOM_TABLE,
  PANEL2_BOTTOM_MARGIN,
  MAIN_TO_PANEL_GAP,
  PANEL_GAP,
  INDICATOR_STRIP_HEIGHT,
  CHART_TOP_PADDING,
  VISIBLE_OPTIONS,
  DEFAULT_VISIBLE,
  INVISIBLE_CANDLES_END,
  SIDEBAR_WIDTH,
  KLINE_PREFS_KEY,
  SECONDARY_PANEL_HEIGHT_MIN,
  SECONDARY_PANEL_HEIGHT_MAX,
  SECONDARY_PANEL_HEIGHT_DEFAULT,
  CHART_SIZE_PERCENT_MIN,
  CHART_SIZE_PERCENT_MAX,
  CHART_SIZE_PERCENT_DEFAULT,
  CHART_SIZE_PERCENT_STEP,
  KLINE_LAST_LAYOUT_KEY,
  KLINE_DRAW_SEGMENTS_KEY,
  KLINE_DRAW_VISIBLE_KEY,
  KLINE_DRAW_DEFAULTS_KEY,
  MS_PER_DAY,
  type VisibleCount,
} from "./KlinesChartConstants";
import {
  parseNum,
  formatUsdt,
  formatUsdtTwoDecimals,
  formatTimeLabel,
  formatDateLabel,
  formatDateYyyyMmDd,
  formatAbbreviated,
  formatObvYAxis,
  dayKey,
  monthKey,
  formatDayOnly,
  formatMonthOnly,
  formatMonthYearShort,
  isStartOfDay,
} from "./klinesFormatters";
import { distanceToSegment, DEFAULT_SEGMENT_COLOR } from "./KlinesChartDrawing";
import type { DrawSegment, DrawDefaults, SegmentCap } from "./KlinesChartDrawing";
import { useKlinesChartDrawing } from "./useKlinesChartDrawing";
import { useKlinesIndicators } from "./KlinesIndicatorsContext";
import type { Kline, KlinesChartProps } from "./klinesChart/types";
import {
  CANDLE_COLOR_PRESETS,
  DEFAULT_CANDLE_PRESET,
  DEFAULT_BACKGROUND,
  DEFAULT_LINE_TABLE_COLOR,
  DEFAULT_SECONDARY_GRID_COLOR,
  DEFAULT_TEXT_COLOR,
  BACKGROUND_PALETTE,
  LINE_GRID_PALETTE,
  TEXT_PALETTE,
  SEGMENT_COLOR_PALETTE,
  SEGMENT_CAP_OPTIONS,
} from "./klinesChart/palettes";
import type { CandleColorPresetId, BackgroundId, LineGridId, TextColorId } from "./klinesChart/palettes";
import { KlinesChartSidebar } from "./klinesChart/KlinesChartSidebar";
import { KlinesChartSvg } from "./klinesChart/KlinesChartSvg";
import { KlinesChartYAxis } from "./klinesChart/KlinesChartYAxis";
import { KlinesChartFooter } from "./klinesChart/KlinesChartFooter";

export type { ChartIndicatorLine } from "./klinesChart/types";

const BUILTIN_DRAW_DEFAULTS: DrawDefaults = {
  segment: { color: SEGMENT_COLOR_PALETTE[0], startCap: "point", endCap: "arrow", showPercent: true, showValues: false },
  fibonacci: { color: SEGMENT_COLOR_PALETTE[8], fibLevel618Color: SEGMENT_COLOR_PALETTE[4], showPercent: false, showValues: false },
};

export default function KlinesChart({ klines, groupMinutes, intervalLabel, intervalOptions, onIntervalChange, width, indicatorLines = [], strategyCandleOverlays = [], onLayoutConfigLoaded, getLayoutExtraConfig, maxChartHeight, onChartDimensionsChange, symbol: symbolProp, onOpenSymbolPanel }: KlinesChartProps) {
  const lang = useBioLang();
  const t = getBioT(lang).sistema.klines;
  const [visibleCount, setVisibleCount] = useState<VisibleCount>(DEFAULT_VISIBLE);
  const [startIndex, setStartIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [segmentToolboxCollapsed, setSegmentToolboxCollapsed] = useState(false);
  const [segmentColorListboxOpen, setSegmentColorListboxOpen] = useState(false);
  const [fibLevel618ColorListboxOpen, setFibLevel618ColorListboxOpen] = useState(false);
  const [segmentToolboxSide, setSegmentToolboxSide] = useState<"left" | "right">("left");
  const [drawPanelSide, setDrawPanelSide] = useState<"left" | "right">("right");
  /** Posição (px) da caixa de desenho na área do gráfico; null = canto superior direito (right-2 top-2). */
  const [drawToolboxPosition, setDrawToolboxPosition] = useState<{ x: number; y: number } | null>(null);
  const drawToolboxRef = useRef<HTMLDivElement>(null);
  const chartRowRef = useRef<HTMLDivElement>(null);
  const drawToolboxDragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);
  /** Posição (px) da caixa de opções do segmento; null = canto superior esquerdo (left: 8, top: 8). */
  const [segmentOptionsPosition, setSegmentOptionsPosition] = useState<{ x: number; y: number } | null>(null);
  const segmentOptionsRef = useRef<HTMLDivElement>(null);
  /** Padrões iniciais para novos desenhos (persistidos no localStorage). */
  const [drawDefaults, setDrawDefaults] = useState<DrawDefaults>(BUILTIN_DRAW_DEFAULTS);
  const [savedLayouts, setSavedLayouts] = useState<{ slot: number; config: Record<string, unknown> }[]>([]);
  const [saveLoadMsg, setSaveLoadMsg] = useState<string | null>(null);
  const [yAxisAbbreviated, setYAxisAbbreviated] = useState(false); // false = 2 decimais (default), true = abreviado
  const [logScale, setLogScale] = useState(false);
  const [showMainAxis, setShowMainAxis] = useState(true);
  const [showSecondaryAxis, setShowSecondaryAxis] = useState(true);
  const [showLastCloseLine, setShowLastCloseLine] = useState(true);
  const [invisibleCandlesEnd, setInvisibleCandlesEnd] = useState(INVISIBLE_CANDLES_END);
  const [secondaryPanelHeightPercent, setSecondaryPanelHeightPercent] = useState(SECONDARY_PANEL_HEIGHT_DEFAULT);
  const [candleColorPreset, setCandleColorPreset] = useState<CandleColorPresetId>(DEFAULT_CANDLE_PRESET);
  const [containerBackground, setContainerBackground] = useState<BackgroundId>(DEFAULT_BACKGROUND);
  const [chartBackground, setChartBackground] = useState<BackgroundId>(DEFAULT_BACKGROUND);
  const [footerYAxisBgColor, setFooterYAxisBgColor] = useState<BackgroundId>(DEFAULT_BACKGROUND);
  const [backgroundTextColor, setBackgroundTextColor] = useState<TextColorId>(DEFAULT_TEXT_COLOR);
  const [footerYAxisTextColor, setFooterYAxisTextColor] = useState<TextColorId>(DEFAULT_TEXT_COLOR);
  const [lineTableColor, setLineTableColor] = useState<LineGridId>(DEFAULT_LINE_TABLE_COLOR);
  const [secondaryGridColor, setSecondaryGridColor] = useState<LineGridId>(DEFAULT_SECONDARY_GRID_COLOR);
  const [lastCloseLineColor, setLastCloseLineColor] = useState<LineGridId>(1); // preto
  const [lastCloseTextColor, setLastCloseTextColor] = useState<LineGridId>(1); // preto (texto do fechamento no eixo Y)
  const [volumeOnPrice, setVolumeOnPrice] = useState(false);
  const [volumeOnPriceOpacity, setVolumeOnPriceOpacity] = useState(20); // 0–30%, default 20%
  const [chartSizePercent, setChartSizePercent] = useState(CHART_SIZE_PERCENT_DEFAULT); // desktop 16:9, 100–200%
  const [yPadOffset, setYPadOffset] = useState(0); // -3 a +3: margem extra no eixo Y para previsões
  /** Largura da tela: quando < 696px, área do plot reduz proporcional (40px e 56px fixos). */
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 696));
  useEffect(() => {
    // Throttle por frame: evita re-render pesado a cada pixel no resize (melhora os warnings de performance).
    let rafId: number | null = null;
    let pendingWidth = typeof window !== "undefined" ? window.innerWidth : 696;

    const flush = () => {
      rafId = null;
      setViewportWidth((prev) => (prev === pendingWidth ? prev : pendingWidth));
    };

    const onResize = () => {
      pendingWidth = window.innerWidth;
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(flush);
    };

    // Sincroniza ao montar (ex.: após hidratação / zoom / barras do navegador).
    onResize();

    window.addEventListener("resize", onResize, { passive: true } as AddEventListenerOptions);
    return () => {
      if (rafId != null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  /** Exibir gráfico; loading só por um instante ao trocar o intervalo (evita travar por efeitos assíncronos). */
  const [chartReady, setChartReady] = useState(true);
  const [layoutApplied, setLayoutApplied] = useState(false);
  const [segmentsApplied, setSegmentsApplied] = useState(false);
  /** Ocultar/exibir todos os desenhos do timeframe/símbolo atual (persistido por intervalo). */
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  /** Ponto do crosshair (clique/arraste); índice global e preço. Display só quando estiver sobre um candle visível. */
  const [crosshairPoint, setCrosshairPoint] = useState<{ index: number; price: number; panelClickY?: number; panelValue?: number } | null>(null);
  const crosshairDraggingRef = useRef(false);
  const crosshairStartedInPanelRef = useRef(false);
  const [crosshairDragging, setCrosshairDragging] = useState(false);
  /** Conversão pixel → dados para o crosshair (sem atração magnética). */
  const crosshairPixelToDataRef = useRef<((x: number, yCoord: number) => { index: number; price: number }) | null>(null);
  const crosshairPointRef = useRef(crosshairPoint);
  const crosshairOverlayRef = useRef<SVGRectElement>(null);
  const crosshairOverlayDivRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const colorsRef = useRef<HTMLDivElement>(null);
  const saveLoadRef = useRef<HTMLDivElement>(null);
  const chartSvgRef = useRef<SVGSVGElement>(null);
  const chartDimensionsRef = useRef<{ w: number; h: number; sizePercent?: number }>({ w: 0, h: 0 });

  const drawing = useKlinesChartDrawing(chartSvgRef);
  const {
    drawOpen,
    setDrawOpen,
    drawMode,
    drawTool,
    drawMagnetic,
    setDrawMagnetic,
    drawSegments,
    setDrawSegments,
    drawPending,
    setDrawPending,
    selectedSegmentIndex,
    setSelectedSegmentIndex,
    setDrawDragging,
    drawRef,
    drawConversionRef,
    drawSnapPointsRef,
    openDrawPanel,
    closeDrawMode,
    selectLineTool,
    selectFibonacciTool,
    selectSelectTool,
    clearAllDrawing,
  } = drawing;

  const fullReversed = [...klines].reverse();
  const n = fullReversed.length;

  useEffect(() => {
    if (segmentToolboxCollapsed) {
      setSegmentColorListboxOpen(false);
      setFibLevel618ColorListboxOpen(false);
    }
  }, [segmentToolboxCollapsed]);

  // Sempre abrir a caixa de desenho encostada no canto esquerdo
  useEffect(() => {
    if (!drawOpen) setDrawToolboxPosition(null);
  }, [drawOpen]);

  // Sempre abrir a caixa de opções do segmento encostada no canto esquerdo
  useEffect(() => {
    if (selectedSegmentIndex === null) setSegmentOptionsPosition(null);
  }, [selectedSegmentIndex]);

  // Selecionar um desenho fecha a caixa de ferramentas de desenho
  useEffect(() => {
    if (selectedSegmentIndex !== null) setDrawOpen(false);
  }, [selectedSegmentIndex]);

  // Ao trocar intervalo: loading breve (1 frame) para recarregar segmentos; em seguida voltar a exibir o gráfico
  useEffect(() => {
    setSegmentsApplied(false);
    setChartReady(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setChartReady(true));
    });
    return () => cancelAnimationFrame(id);
  }, [groupMinutes]);

  // Carregar segmentos e visibilidade de desenho do localStorage ao mudar o intervalo
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_DRAW_SEGMENTS_KEY) : null;
      if (!raw) {
        setDrawSegments([]);
        setSelectedSegmentIndex(null);
        setDrawPending(null);
      } else {
        const data = JSON.parse(raw) as Record<string, DrawSegment[]>;
        const key = String(groupMinutes);
        const loaded = Array.isArray(data[key]) ? data[key] : [];
        setDrawSegments(loaded);
        setSelectedSegmentIndex(null);
        setDrawPending(null);
      }
      const visibleRaw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_DRAW_VISIBLE_KEY) : null;
      if (visibleRaw) {
        try {
          const visibleData = JSON.parse(visibleRaw) as Record<string, boolean>;
          const key = String(groupMinutes);
          if (typeof visibleData[key] === "boolean") setDrawingsVisible(visibleData[key]);
        } catch {
          /* ignore */
        }
      }
    } catch {
      setDrawSegments([]);
      setSelectedSegmentIndex(null);
      setDrawPending(null);
    }
    setSegmentsApplied(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when interval changes
  }, [groupMinutes]);

  // Carregar padrões de desenho do localStorage (uma vez ao montar)
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_DRAW_DEFAULTS_KEY) : null;
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<DrawDefaults>;
      setDrawDefaults({
        segment: { ...BUILTIN_DRAW_DEFAULTS.segment, ...parsed.segment },
        fibonacci: { ...BUILTIN_DRAW_DEFAULTS.fibonacci, ...parsed.fibonacci },
      });
    } catch {
      /* ignore */
    }
  }, []);

  // Persistir padrões quando o usuário altera opções de um segmento
  const persistDrawDefault = useCallback((type: "segment" | "fibonacci", partial: Partial<DrawSegment>) => {
    setDrawDefaults((prev) => {
      const next: DrawDefaults = {
        segment: type === "segment" ? { ...prev.segment, ...partial } : prev.segment,
        fibonacci: type === "fibonacci" ? { ...prev.fibonacci, ...partial } : prev.fibonacci,
      };
      try {
        if (typeof window !== "undefined") window.localStorage.setItem(KLINE_DRAW_DEFAULTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Persistir visibilidade dos desenhos (por intervalo)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(KLINE_DRAW_VISIBLE_KEY);
      const data: Record<string, boolean> = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      data[String(groupMinutes)] = drawingsVisible;
      window.localStorage.setItem(KLINE_DRAW_VISIBLE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [groupMinutes, drawingsVisible]);

  // Persistir segmentos no localStorage (por intervalo; em outros intervalos não são exibidos)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(KLINE_DRAW_SEGMENTS_KEY);
      const data: Record<string, DrawSegment[]> = raw ? (JSON.parse(raw) as Record<string, DrawSegment[]>) : {};
      const key = String(groupMinutes);
      data[key] = drawSegments;
      window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [groupMinutes, drawSegments]);

  const formatYAxis = yAxisAbbreviated ? formatUsdt : formatUsdtTwoDecimals;
  const candleColors = CANDLE_COLOR_PRESETS.find((p) => p.id === candleColorPreset) ?? CANDLE_COLOR_PRESETS[0];

  // Inicializar do localStorage
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_PREFS_KEY) : null;
      if (!raw) return;
      const data = JSON.parse(raw) as { visibleCount?: number; invisibleCandlesEnd?: number; candleColorPreset?: string; yAxisAbbreviated?: boolean; logScale?: boolean; containerBackground?: number; chartBackground?: number; footerYAxisBgColor?: number; backgroundTextColor?: number; footerYAxisTextColor?: number; lineTableColor?: number; secondaryGridColor?: number; showMainAxis?: boolean; showSecondaryAxis?: boolean; showLastCloseLine?: boolean; lastCloseLineColor?: number; lastCloseTextColor?: number; secondaryPanelHeightPercent?: number; volumeOnPrice?: boolean; volumeOnPriceOpacity?: number; chartSizePercent?: number };
      if (typeof data.visibleCount === "number" && (VISIBLE_OPTIONS as readonly number[]).includes(data.visibleCount)) setVisibleCount(data.visibleCount as VisibleCount);
      if (typeof data.invisibleCandlesEnd === "number" && data.invisibleCandlesEnd >= 0 && data.invisibleCandlesEnd <= 30) setInvisibleCandlesEnd(data.invisibleCandlesEnd);
      if (typeof data.candleColorPreset === "string" && CANDLE_COLOR_PRESETS.some((p) => p.id === data.candleColorPreset)) setCandleColorPreset(data.candleColorPreset as CandleColorPresetId);
      if (typeof data.yAxisAbbreviated === "boolean") setYAxisAbbreviated(data.yAxisAbbreviated);
      if (typeof data.logScale === "boolean") setLogScale(data.logScale);
      if (typeof data.containerBackground === "number" && BACKGROUND_PALETTE.some((b) => b.id === data.containerBackground)) setContainerBackground(data.containerBackground as BackgroundId);
      if (typeof data.chartBackground === "number" && BACKGROUND_PALETTE.some((b) => b.id === data.chartBackground)) setChartBackground(data.chartBackground as BackgroundId);
      if (typeof data.footerYAxisBgColor === "number" && BACKGROUND_PALETTE.some((b) => b.id === data.footerYAxisBgColor)) setFooterYAxisBgColor(data.footerYAxisBgColor as BackgroundId);
      if (typeof data.backgroundTextColor === "number" && TEXT_PALETTE.some((b) => b.id === data.backgroundTextColor)) setBackgroundTextColor(data.backgroundTextColor as TextColorId);
      if (typeof data.footerYAxisTextColor === "number" && TEXT_PALETTE.some((b) => b.id === data.footerYAxisTextColor)) setFooterYAxisTextColor(data.footerYAxisTextColor as TextColorId);
      if (typeof data.lineTableColor === "number" && LINE_GRID_PALETTE.some((b) => b.id === data.lineTableColor)) setLineTableColor(data.lineTableColor as LineGridId);
      if (typeof data.secondaryGridColor === "number" && LINE_GRID_PALETTE.some((b) => b.id === data.secondaryGridColor)) setSecondaryGridColor(data.secondaryGridColor as LineGridId);
      if (typeof data.showMainAxis === "boolean") setShowMainAxis(data.showMainAxis);
      if (typeof data.showSecondaryAxis === "boolean") setShowSecondaryAxis(data.showSecondaryAxis);
      if (typeof data.showLastCloseLine === "boolean") setShowLastCloseLine(data.showLastCloseLine);
      if (typeof data.lastCloseLineColor === "number" && LINE_GRID_PALETTE.some((b) => b.id === data.lastCloseLineColor)) setLastCloseLineColor(data.lastCloseLineColor as LineGridId);
      if (typeof data.lastCloseTextColor === "number" && LINE_GRID_PALETTE.some((b) => b.id === data.lastCloseTextColor)) setLastCloseTextColor(data.lastCloseTextColor as LineGridId);
      if (typeof data.secondaryPanelHeightPercent === "number" && data.secondaryPanelHeightPercent >= SECONDARY_PANEL_HEIGHT_MIN && data.secondaryPanelHeightPercent <= SECONDARY_PANEL_HEIGHT_MAX) setSecondaryPanelHeightPercent(Math.round(data.secondaryPanelHeightPercent));
      if (typeof data.volumeOnPrice === "boolean") setVolumeOnPrice(data.volumeOnPrice);
      if (typeof data.volumeOnPriceOpacity === "number" && data.volumeOnPriceOpacity >= 0 && data.volumeOnPriceOpacity <= 30) setVolumeOnPriceOpacity(Math.round(data.volumeOnPriceOpacity));
      if (typeof data.chartSizePercent === "number" && data.chartSizePercent >= CHART_SIZE_PERCENT_MIN && data.chartSizePercent <= CHART_SIZE_PERCENT_MAX) setChartSizePercent(Math.round(data.chartSizePercent));
    } catch {
      /* ignore */
    }
  }, []);

  // Persistir no localStorage
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(
        KLINE_PREFS_KEY,
        JSON.stringify({ visibleCount, invisibleCandlesEnd, candleColorPreset, yAxisAbbreviated, logScale, containerBackground, chartBackground, footerYAxisBgColor, backgroundTextColor, footerYAxisTextColor, lineTableColor, secondaryGridColor, showMainAxis, showSecondaryAxis, showLastCloseLine, lastCloseLineColor, lastCloseTextColor, secondaryPanelHeightPercent, volumeOnPrice, volumeOnPriceOpacity, chartSizePercent })
      );
    } catch {
      /* ignore */
    }
  }, [visibleCount, invisibleCandlesEnd, candleColorPreset, yAxisAbbreviated, logScale, containerBackground, chartBackground, footerYAxisBgColor, backgroundTextColor, footerYAxisTextColor, lineTableColor, secondaryGridColor, showMainAxis, showSecondaryAxis, showLastCloseLine, lastCloseLineColor, lastCloseTextColor, secondaryPanelHeightPercent, volumeOnPrice, volumeOnPriceOpacity, chartSizePercent]);

  // Ao montar: se existir último layout selecionado, aplicá-lo (default ou slot da API). Sempre chama done() para desbloquear o gráfico.
  useEffect(() => {
    let cancelled = false;
    const done = () => {
      if (!cancelled) setLayoutApplied(true);
    };
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY) : null;
      if (raw == null) {
        done();
        return;
      }
      if (raw === "default") {
        applyLayoutConfig(getDefaultConfig());
        done();
        return;
      }
    } catch {
      done();
      return;
    }
    const timeoutId = setTimeout(done, 2000);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/chart-layouts`);
        if (!res.ok || cancelled) {
          done();
          return;
        }
        const data = await res.json();
        if (!Array.isArray(data.layouts) || cancelled) {
          done();
          return;
        }
        const layouts = data.layouts as { slot: number; config: Record<string, unknown> }[];
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY) : null;
        if (raw == null || raw === "default") {
          done();
          return;
        }
        const slot = Number(raw);
        if (!Number.isInteger(slot) || cancelled) {
          done();
          return;
        }
        const layout = layouts.find((l) => l.slot === slot);
        if (layout) applyLayoutConfig(layout.config);
      } catch {
        /* ignore */
      } finally {
        clearTimeout(timeoutId);
        done();
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const close = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [settingsOpen]);

  useEffect(() => {
    if (!colorsOpen) return;
    const close = (e: MouseEvent) => {
      if (colorsRef.current && !colorsRef.current.contains(e.target as Node)) setColorsOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [colorsOpen]);

  useEffect(() => {
    if (!saveOpen && !loadOpen) return;
    const close = (e: MouseEvent) => {
      if (saveLoadRef.current && !saveLoadRef.current.contains(e.target as Node)) {
        setSaveOpen(false);
        setLoadOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [saveOpen, loadOpen]);

  const fetchSavedLayouts = async () => {
    const res = await fetch(`${API_BASE}/chart-layouts`);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.layouts)) setSavedLayouts(data.layouts);
  };

  const handleSaveLayout = async (slot: number) => {
    setSaveOpen(false);
    const baseConfig = { visibleCount, invisibleCandlesEnd, candleColorPreset, yAxisAbbreviated, logScale, containerBackground, chartBackground, footerYAxisBgColor, backgroundTextColor, footerYAxisTextColor, lineTableColor, secondaryGridColor, showMainAxis, showSecondaryAxis, showLastCloseLine, lastCloseLineColor, lastCloseTextColor, secondaryPanelHeightPercent, volumeOnPrice, volumeOnPriceOpacity, chartSizePercent, groupMinutes };
    const extra = getLayoutExtraConfig?.() ?? {};
    const config = { ...baseConfig, ...extra };
    const res = await fetch(`${API_BASE}/chart-layouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot, config }),
    });
    if (res.ok) {
      setSaveLoadMsg(t.savedSuccess);
      setTimeout(() => setSaveLoadMsg(null), 2000);
    }
  };

  const applyLayoutConfig = (c: Record<string, unknown>) => {
    if (typeof c.visibleCount === "number" && (VISIBLE_OPTIONS as readonly number[]).includes(c.visibleCount)) setVisibleCount(c.visibleCount as VisibleCount);
    if (typeof c.candleColorPreset === "string") {
      const id = (c.candleColorPreset === "redGreen" ? "greenRed" : c.candleColorPreset === "whiteBlack" ? "blackWhite" : c.candleColorPreset) as CandleColorPresetId;
      if (CANDLE_COLOR_PRESETS.some((p) => p.id === id)) setCandleColorPreset(id);
    }
    if (typeof c.yAxisAbbreviated === "boolean") setYAxisAbbreviated(c.yAxisAbbreviated);
    if (typeof c.logScale === "boolean") setLogScale(c.logScale);
    if (typeof c.containerBackground === "number" && BACKGROUND_PALETTE.some((b) => b.id === c.containerBackground)) setContainerBackground(c.containerBackground as BackgroundId);
    if (typeof c.chartBackground === "number" && BACKGROUND_PALETTE.some((b) => b.id === c.chartBackground)) setChartBackground(c.chartBackground as BackgroundId);
    if (typeof c.footerYAxisBgColor === "number" && BACKGROUND_PALETTE.some((b) => b.id === c.footerYAxisBgColor)) setFooterYAxisBgColor(c.footerYAxisBgColor as BackgroundId);
    if (typeof c.backgroundTextColor === "number" && TEXT_PALETTE.some((b) => b.id === c.backgroundTextColor)) setBackgroundTextColor(c.backgroundTextColor as TextColorId);
    if (typeof c.footerYAxisTextColor === "number" && TEXT_PALETTE.some((b) => b.id === c.footerYAxisTextColor)) setFooterYAxisTextColor(c.footerYAxisTextColor as TextColorId);
    if (typeof c.lineTableColor === "number" && LINE_GRID_PALETTE.some((b) => b.id === c.lineTableColor)) setLineTableColor(c.lineTableColor as LineGridId);
    if (typeof c.secondaryGridColor === "number" && LINE_GRID_PALETTE.some((b) => b.id === c.secondaryGridColor)) setSecondaryGridColor(c.secondaryGridColor as LineGridId);
    if (typeof c.showMainAxis === "boolean") setShowMainAxis(c.showMainAxis);
    if (typeof c.showSecondaryAxis === "boolean") setShowSecondaryAxis(c.showSecondaryAxis);
    if (typeof c.showLastCloseLine === "boolean") setShowLastCloseLine(c.showLastCloseLine);
    if (typeof c.lastCloseLineColor === "number" && LINE_GRID_PALETTE.some((b) => b.id === c.lastCloseLineColor)) setLastCloseLineColor(c.lastCloseLineColor as LineGridId);
    if (typeof c.lastCloseTextColor === "number" && LINE_GRID_PALETTE.some((b) => b.id === c.lastCloseTextColor)) setLastCloseTextColor(c.lastCloseTextColor as LineGridId);
    if (typeof c.invisibleCandlesEnd === "number" && c.invisibleCandlesEnd >= 0 && c.invisibleCandlesEnd <= 30) setInvisibleCandlesEnd(c.invisibleCandlesEnd);
    if (typeof c.secondaryPanelHeightPercent === "number" && c.secondaryPanelHeightPercent >= SECONDARY_PANEL_HEIGHT_MIN && c.secondaryPanelHeightPercent <= SECONDARY_PANEL_HEIGHT_MAX) setSecondaryPanelHeightPercent(Math.round(c.secondaryPanelHeightPercent));
    if (typeof c.volumeOnPrice === "boolean") setVolumeOnPrice(c.volumeOnPrice);
    if (typeof c.volumeOnPriceOpacity === "number" && c.volumeOnPriceOpacity >= 0 && c.volumeOnPriceOpacity <= 30) setVolumeOnPriceOpacity(Math.round(c.volumeOnPriceOpacity));
    if (typeof c.chartSizePercent === "number" && c.chartSizePercent >= CHART_SIZE_PERCENT_MIN && c.chartSizePercent <= CHART_SIZE_PERCENT_MAX) setChartSizePercent(Math.round(c.chartSizePercent));
    onLayoutConfigLoaded?.(c);
  };

  const getDefaultConfig = (): Record<string, unknown> => ({
    visibleCount: DEFAULT_VISIBLE,
    invisibleCandlesEnd: INVISIBLE_CANDLES_END,
    candleColorPreset: DEFAULT_CANDLE_PRESET,
    yAxisAbbreviated: false,
    logScale: false,
    containerBackground: DEFAULT_BACKGROUND,
    chartBackground: DEFAULT_BACKGROUND,
    footerYAxisBgColor: DEFAULT_BACKGROUND,
    backgroundTextColor: DEFAULT_TEXT_COLOR,
    footerYAxisTextColor: DEFAULT_TEXT_COLOR,
    lineTableColor: DEFAULT_LINE_TABLE_COLOR,
    secondaryGridColor: DEFAULT_SECONDARY_GRID_COLOR,
    showMainAxis: true,
    showSecondaryAxis: true,
    showLastCloseLine: true,
    lastCloseLineColor: 1,
    lastCloseTextColor: 1,
    secondaryPanelHeightPercent: SECONDARY_PANEL_HEIGHT_DEFAULT,
    volumeOnPrice: false,
    volumeOnPriceOpacity: 20,
    chartSizePercent: CHART_SIZE_PERCENT_DEFAULT,
    groupMinutes,
  });

  const handleLoadDefaultLayout = () => {
    setLoadOpen(false);
    applyLayoutConfig(getDefaultConfig());
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(KLINE_LAST_LAYOUT_KEY, "default");
    } catch {
      /* ignore */
    }
  };

  const handleLoadLayout = (layout: { slot: number; config: Record<string, unknown> }) => {
    setLoadOpen(false);
    applyLayoutConfig(layout.config);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(KLINE_LAST_LAYOUT_KEY, String(layout.slot));
    } catch {
      /* ignore */
    }
  };

  // Garantir que startIndex fica dentro dos dados ao mudar visibleCount ou n
  useEffect(() => {
    const maxStart = Math.max(0, n - visibleCount);
    setStartIndex((prev) => Math.min(prev, maxStart));
  }, [n, visibleCount]);

  // Ao carregar/atualizar dados, ir para o fim (mais recente)
  useEffect(() => {
    setStartIndex(Math.max(0, n - visibleCount));
  }, [klines.length, groupMinutes]);

  crosshairPointRef.current = crosshairPoint;

  // Clique fora do gráfico: desativa o crosshair
  useEffect(() => {
    if (crosshairPoint === null) return;
    const onDocClick = (e: MouseEvent) => {
      if (chartSvgRef.current && !chartSvgRef.current.contains(e.target as Node)) {
        setCrosshairPoint(null);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [crosshairPoint]);

  useLayoutEffect(() => {
    const d = chartDimensionsRef.current;
    if (d.w > 0 && onChartDimensionsChange) onChartDimensionsChange(d.w, d.h, d.sizePercent ?? 100);
  }, [onChartDimensionsChange, width, chartSizePercent, chartReady, visibleCount, indicatorLines?.length, secondaryPanelHeightPercent, klines.length, viewportWidth]);

  const onSelectToolPan = useCallback(
    (deltaCandles: number) => {
      setStartIndex((prev) => {
        const maxStart = Math.max(0, n - visibleCount);
        return Math.max(0, Math.min(maxStart, prev + deltaCandles));
      });
    },
    [n, visibleCount]
  );

  if (klines.length === 0 || width < 100) {
    chartDimensionsRef.current = { w: 0, h: 0, sizePercent: 100 };
    return null;
  }

  const windowSlice = fullReversed.slice(startIndex, startIndex + visibleCount);
  const windowN = windowSlice.length;
  if (windowN === 0) return null;

  const getPanel = (ind: { type?: string; panel?: string }): "main" | "panel2" | "panel3" | "panel4" | "panel5" =>
    (ind.panel as "main" | "panel2" | "panel3" | "panel4" | "panel5") ?? (ind.type === "RSI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "ATR" || ind.type === "Volume" ? "panel2" : "main");
  const hasPanel2 = indicatorLines.some((ind) => getPanel(ind) === "panel2");
  const hasPanel3 = indicatorLines.some((ind) => getPanel(ind) === "panel3");
  const hasPanel4 = indicatorLines.some((ind) => getPanel(ind) === "panel4");
  const hasPanel5 = indicatorLines.some((ind) => getPanel(ind) === "panel5");
  const hasAnySecondaryPanel = hasPanel2 || hasPanel3 || hasPanel4 || hasPanel5;
  const mainToPanelGap = hasAnySecondaryPanel ? MAIN_TO_PANEL_GAP : 0;
  const gap2_3 = hasPanel2 && hasPanel3 ? PANEL_GAP : 0;
  const gap3_4 = hasPanel3 && hasPanel4 ? PANEL_GAP : 0;
  const gap4_5 = hasPanel4 && hasPanel5 ? PANEL_GAP : 0;
  const marginBottom = MARGIN_BOTTOM_TABLE;
  const secondaryPanelRatio = secondaryPanelHeightPercent / 100;
  const nSecondaryPanels = (hasPanel2 ? 1 : 0) + (hasPanel3 ? 1 : 0) + (hasPanel4 ? 1 : 0) + (hasPanel5 ? 1 : 0);

  /** Teto do plot (600px em 100%, 750px em 125%). Largura máxima total do chart = 660px (600 + 60 eixo). */
  const MAX_PLOT_WIDTH_BASE = 600;
  const maxPlotWidth = Math.round(MAX_PLOT_WIDTH_BASE * (chartSizePercent / 100));
  /** Sidebar agora fica no topo; na horizontal só o eixo Y é fixo. */
  const FIXED_WIDTH = Y_AXIS_WIDTH;
  const MIN_PLOT_WIDTH = 200;
  // `width` aqui é a largura disponível para o plot (sem o eixo Y). Também limitamos pela viewport para não estourar em telas menores.
  const availableForPlot = Math.min(width, viewportWidth - FIXED_WIDTH);
  const displayPlotWidth =
    availableForPlot >= maxPlotWidth
      ? maxPlotWidth
      : Math.max(MIN_PLOT_WIDTH, Math.min(availableForPlot, maxPlotWidth));
  /** Proporções fixas: área dos candles 592×320 (razão 1,85). Em 100% mantém o teto 320px; no zoom (>=125%) a altura cresce com a largura. Cada painel = 1/3 da altura do main. */
  const MAIN_PLOT_HEIGHT_PER_WIDTH = 320 / 592;
  // IMPORTANT: 100% já estava calibrado com teto fixo 320px. No zoom, liberamos teto proporcional.
  const MAIN_PLOT_HEIGHT_CAP =
    chartSizePercent <= 100
      ? 320
      : Math.round(maxPlotWidth * MAIN_PLOT_HEIGHT_PER_WIDTH);
  const PANEL_TO_MAIN_RATIO = 1 / 3;
  const minChartH = MIN_CHART_HEIGHT - MARGIN_TOP - marginBottom;
  // A largura "real" do plot (área dos candles) é `displayPlotWidth - GAP_PLOT_Y_AXIS`.
  // Em zoom, o gap deve escalar (ex.: 8px → 10px em 125%) para manter 592→740 exatamente.
  const gapPlotYAxisScaled = Math.round(GAP_PLOT_Y_AXIS * (chartSizePercent / 100));
  const chartWForAspect = displayPlotWidth - MARGIN_LEFT - gapPlotYAxisScaled;
  const chartH = Math.max(minChartH, Math.min(MAIN_PLOT_HEIGHT_CAP, Math.round(chartWForAspect * MAIN_PLOT_HEIGHT_PER_WIDTH)));
  const baseChartHeight = chartH + MARGIN_TOP + marginBottom;
  const panel2Height = hasPanel2 ? chartH * PANEL_TO_MAIN_RATIO : 0;
  const panel3Height = hasPanel3 ? chartH * PANEL_TO_MAIN_RATIO : 0;
  const panel4Height = hasPanel4 ? chartH * PANEL_TO_MAIN_RATIO : 0;
  const panel5Height = hasPanel5 ? chartH * PANEL_TO_MAIN_RATIO : 0;
  const chartHeight = baseChartHeight + mainToPanelGap + panel2Height + panel3Height + panel4Height + panel5Height + gap2_3 + gap3_4 + gap4_5 + (hasAnySecondaryPanel ? PANEL2_BOTTOM_MARGIN : 0);

  /** Escala dos textos (indicadores e eixo Y): reduz quando o plot está reduzido, não necessariamente na mesma proporção. */
  const textScale = Math.max(0.6, Math.min(1, displayPlotWidth / maxPlotWidth));

  const is2hOrAbove = groupMinutes >= 120;
  const chartW = displayPlotWidth - MARGIN_LEFT - gapPlotYAxisScaled;
  const panel2Top = MARGIN_TOP + chartH + marginBottom + mainToPanelGap;
  const panel3Top = panel2Top + panel2Height + (hasPanel2 ? PANEL_GAP : 0);
  const panel4Top = panel3Top + panel3Height + (hasPanel3 ? PANEL_GAP : 0);
  const panel5Top = panel4Top + panel4Height + (hasPanel4 ? PANEL_GAP : 0);
  const panelTop = (p: "panel2" | "panel3" | "panel4" | "panel5") => p === "panel2" ? panel2Top : p === "panel3" ? panel3Top : p === "panel4" ? panel4Top : panel5Top;
  const panelHeight = (p: "panel2" | "panel3" | "panel4" | "panel5") => p === "panel2" ? panel2Height : p === "panel3" ? panel3Height : p === "panel4" ? panel4Height : panel5Height;
  const tableTop = MARGIN_TOP + chartH;
  const chartBottom = hasPanel5
    ? panelTop("panel5") + panelHeight("panel5")
    : hasPanel4
      ? panelTop("panel4") + panelHeight("panel4")
      : hasPanel3
        ? panelTop("panel3") + panelHeight("panel3")
        : hasPanel2
          ? panelTop("panel2") + panelHeight("panel2")
          : tableTop;
  const yValInPanel = (val: number, top: number, h: number, pMin: number, pMax: number) => {
    const range = pMax - pMin || 1;
    const t = (val - pMin) / range;
    return top + h - Math.max(0, Math.min(1, t)) * h;
  };
  const buildPanelExtent = (panelKey: "panel2" | "panel3" | "panel4" | "panel5") => {
    const lines = indicatorLines.filter((ind) => getPanel(ind) === panelKey);
    const hasObv = lines.some((ind) => ind.type === "OBV");
    const useFixedScale =
      !hasObv &&
      lines.length > 0 &&
      lines.every((ind) => (ind.type === "RSI" && ind.rsiFixedScale !== false) || ind.type === "Stochastic");
    if (useFixedScale) return { min: 0, max: 100 };
    const useFixedScaleWilliams =
      !hasObv &&
      lines.length > 0 &&
      lines.every((ind) => ind.type === "WilliamsR");
    if (useFixedScaleWilliams) return { min: -100, max: 0 };

    const ext: number[] = [];
    if (lines.some((ind) => ind.display === "histogram" && ind.type !== "Volume")) ext.push(0);
    if (lines.some((ind) => ind.type === "Volume")) ext.push(0);
    for (const ind of lines) {
      const col = ind.columnIndex;
      if (col < 12 && ind.type !== "Volume") continue;
      for (let i = 0; i < windowSlice.length; i++) {
        const row = windowSlice[i];
        if (row.length <= col) continue;
        const raw = row[col];
        const v = raw != null ? Number(raw) : NaN;
        if (!Number.isFinite(v)) continue;
        if (ind.type === "OBV" && Math.abs(v) > 1e11) continue;
        if (ind.type === "Volume" && v < 0) continue;
        ext.push(v);
      }
    }
    let min = ext.length ? Math.min(...ext) : 0;
    let max = ext.length ? Math.max(...ext) : 100;
    const hasVolume = lines.some((ind) => ind.type === "Volume");
    if (hasVolume) {
      min = 0;
      if (max < 0) max = 0;
    }
    if (lines.some((ind) => ind.type === "RSI" || ind.type === "Stochastic")) {
      min = Math.min(min, 0);
      max = Math.max(max, 100);
    }
    if (lines.some((ind) => ind.type === "WilliamsR")) {
      min = Math.min(min, -100);
      max = Math.max(max, 0);
    }
    if (min !== 0 || max !== 100) {
      const range = max - min || 1;
      const pad = range * 0.05;
      if (!hasVolume) min -= pad;
      max += pad;
    }
    if (hasVolume && min < 0) min = 0;
    return { min, max };
  };
  const panelExtents: Record<"panel2" | "panel3" | "panel4" | "panel5", { min: number; max: number }> = {
    panel2: buildPanelExtent("panel2"),
    panel3: buildPanelExtent("panel3"),
    panel4: buildPanelExtent("panel4"),
    panel5: buildPanelExtent("panel5"),
  };
  const yRsiPanel2 = (rsi: number) => yValInPanel(rsi, panel2Top, panel2Height, panelExtents.panel2.min, panelExtents.panel2.max);
  const yRsiPanel3 = (rsi: number) => yValInPanel(rsi, panel3Top, panel3Height, panelExtents.panel3.min, panelExtents.panel3.max);
  const yRsiPanel4 = (rsi: number) => yValInPanel(rsi, panel4Top, panel4Height, panelExtents.panel4.min, panelExtents.panel4.max);
  const yRsiPanel5 = (rsi: number) => yValInPanel(rsi, panel5Top, panel5Height, panelExtents.panel5.min, panelExtents.panel5.max);
  const yRsiByPanel = (rsi: number, panel: "panel2" | "panel3" | "panel4" | "panel5") =>
    panel === "panel2" ? yRsiPanel2(rsi) : panel === "panel3" ? yRsiPanel3(rsi) : panel === "panel4" ? yRsiPanel4(rsi) : yRsiPanel5(rsi);
  const totalSlots = windowN + invisibleCandlesEnd;
  const gap = chartW / totalSlots;
  const candleW = Math.max(2, gap * BODY_WIDTH_RATIO);
  const cx = (i: number) => MARGIN_LEFT + (i + 0.5) * gap;

  // Y apenas da janela visível (OHLC + indicadores de preço no Main; indicadores em panel 2/3/4 não entram)
  const lows = windowSlice.map((k) => parseNum(k[3]));
  const highs = windowSlice.map((k) => parseNum(k[2]));
  const priceExtents: number[] = [...lows, ...highs];
  for (const ind of indicatorLines) {
    if (getPanel(ind) !== "main") continue;
    const col = ind.columnIndex;
    for (let i = 0; i < windowSlice.length; i++) {
      const v = windowSlice[i][col];
      if (v != null && typeof v === "number" && Number.isFinite(v)) priceExtents.push(v);
    }
  }
  const minPrice = priceExtents.length > 0 ? Math.min(...priceExtents) : Math.min(...lows);
  const maxPrice = priceExtents.length > 0 ? Math.max(...priceExtents) : Math.max(...highs);
  const range = maxPrice - minPrice || 1;
  const pad = range * PAD_Y;
  const yMinLinear = minPrice - pad;
  const yMaxLinear = maxPrice + pad;
  const Y_TICK_STEP = 0.10;
  const floorToMultiple = (x: number, m: number) => Math.floor(x / m) * m;
  const ceilToMultiple = (x: number, m: number) => Math.ceil(x / m) * m;
  const roundToMultiple = (x: number, m: number) => Math.round(x / m) * m;

  // Offset 0: visão base — 5 intervalos, 6 rótulos, nada fora do gráfico.
  // Offset 1..3: ↑ adiciona espaço igual pra cima e pra baixo (espreme candles pro centro); ↓ reduz até voltar ao original.
  let yMin: number;
  let yMax: number;
  let step: number;
  let numIntervals: number;

  if (yPadOffset === 0) {
    let yMinVal = logScale ? Math.max(yMinLinear, minPrice * 0.5 || 0.001) : yMinLinear;
    let yMaxVal = logScale ? (yMaxLinear <= 0 ? yMinVal * 1.1 : yMaxLinear + pad) : yMaxLinear;
    const yMinFloor = floorToMultiple(yMinVal, Y_TICK_STEP);
    const yMaxCeil = ceilToMultiple(yMaxVal, Y_TICK_STEP);
    step = roundToMultiple((yMaxCeil - yMinFloor) / 5, Y_TICK_STEP);
    if (step < Y_TICK_STEP) step = Y_TICK_STEP;
    yMin = yMinFloor;
    yMax = yMinFloor + 5 * step;
    numIntervals = 5;
  } else {
    const yMinFloorBase = floorToMultiple(yMinLinear, Y_TICK_STEP);
    const yMaxCeilBase = ceilToMultiple(yMaxLinear, Y_TICK_STEP);
    step = roundToMultiple((yMaxCeilBase - yMinFloorBase) / 5, Y_TICK_STEP);
    if (step < Y_TICK_STEP) step = Y_TICK_STEP;
    const yMinBase = yMinFloorBase;
    const yMaxBase = yMinFloorBase + 5 * step;
    // Espaço igual em cima e embaixo: +offset intervalos em cada lado
    yMin = yMinBase - yPadOffset * step;
    yMax = yMaxBase + yPadOffset * step;
    numIntervals = 5 + 2 * yPadOffset;
  }

  const yRange = yMax - yMin;

  const safeLog = (p: number) => Math.log(Math.max(p, 0.001));
  const yLogMin = logScale ? safeLog(yMin) : 0;
  const yLogRange = logScale ? safeLog(yMax) - yLogMin : 1;

  const y = (price: number) => {
    if (logScale) {
      const t = (safeLog(price) - yLogMin) / yLogRange;
      return MARGIN_TOP + chartH - Math.max(0, Math.min(1, t)) * chartH;
    }
    return MARGIN_TOP + chartH - ((price - yMin) / yRange) * chartH;
  };

  const maxDrawIndex = startIndex + windowN + invisibleCandlesEnd - 1;

  // Parâmetros para converter pixel <-> dados (segmentos ficam fixos ao rolar)
  drawConversionRef.current = {
    startIndex,
    gap,
    MARGIN_LEFT,
    MARGIN_TOP,
    chartH,
    chartW,
    yMin,
    yRange,
    n,
    maxDrawIndex,
    logScale,
    yLogMin,
    yLogRange,
    drawMagnetic,
  };

  const segmentToPixel = (index: number, price: number) => ({
    x: MARGIN_LEFT + (index - startIndex + 0.5) * gap,
    y: y(price),
  });
  const pixelToData = (x: number, yCoord: number) => {
    const idx = Math.max(0, Math.min(maxDrawIndex, Math.round((x - MARGIN_LEFT) / gap - 0.5) + startIndex));
    const price = logScale
      ? Math.exp(yLogMin + (1 - (yCoord - MARGIN_TOP) / chartH) * yLogRange)
      : yMin + (1 - (yCoord - MARGIN_TOP) / chartH) * yRange;
    return { index: idx, price };
  };

  // Pontos reais (open, high, low, close) de cada candle visível — para magnético grudar só neles
  drawSnapPointsRef.current = [];
  for (let i = 0; i < windowSlice.length; i++) {
    const k = windowSlice[i];
    const openP = parseNum(k[1]);
    const highP = parseNum(k[2]);
    const lowP = parseNum(k[3]);
    const closeP = parseNum(k[4]);
    const globalIndex = startIndex + i;
    drawSnapPointsRef.current.push({ index: globalIndex, price: openP });
    drawSnapPointsRef.current.push({ index: globalIndex, price: highP });
    drawSnapPointsRef.current.push({ index: globalIndex, price: lowP });
    drawSnapPointsRef.current.push({ index: globalIndex, price: closeP });
  }

  const snapToCandlePoint = (px: number, py: number): { index: number; price: number } => {
    const snapPoints = drawSnapPointsRef.current;
    if (!drawMagnetic || snapPoints.length === 0) return pixelToData(px, py);
    let best = snapPoints[0];
    let bestD = Infinity;
    for (const pt of snapPoints) {
      const screen = segmentToPixel(pt.index, pt.price);
      const d = (px - screen.x) ** 2 + (py - screen.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = pt;
      }
    }
    return best;
  };
  crosshairPixelToDataRef.current = pixelToData;

  const yTickValues: number[] = [];
  for (let i = 0; i <= numIntervals; i++) {
    const v = yMin + (yRange * i) / numIntervals;
    yTickValues.push(Math.round(v * 10) / 10);
  }

  // Data no subeixo: por dia (mudança de data) ou, no diário/semanal, a cada 7 candles
  const isDailyOrWeekly = groupMinutes === 1440 || groupMinutes === 10080;
  const dateBreaks: { index: number; dateStr: string }[] = [];
  if (isDailyOrWeekly) {
    for (let i = 0; i < windowN; i += 7) {
      dateBreaks.push({ index: i, dateStr: formatDateLabel(windowSlice[i][0]) });
    }
  } else {
    let lastDay = "";
    for (let i = 0; i < windowN; i++) {
      const day = dayKey(windowSlice[i][0]);
      if (day !== lastDay) {
        lastDay = day;
        dateBreaks.push({ index: i, dateStr: formatDateLabel(windowSlice[i][0]) });
      }
    }
  }

  // Evitar sobreposição de datas: só mostrar data se distância da última exibida for >= minGapCandles
  const minGapCandlesForDate = 10;
  const dateBreaksFiltered: { index: number; dateStr: string }[] = [];
  for (const b of dateBreaks) {
    if (dateBreaksFiltered.length === 0 || b.index - dateBreaksFiltered[dateBreaksFiltered.length - 1].index >= minGapCandlesForDate) {
      dateBreaksFiltered.push(b);
    }
  }

  // Dia (dd) em cada quebra de data (usado em 2h+ linha 1; 1h usa em linha 2)
  const dayBreaksFiltered: { index: number; label: string }[] = [];
  for (const b of dateBreaksFiltered) {
    dayBreaksFiltered.push({ index: b.index, label: formatDayOnly(windowSlice[b.index][0] as number) });
  }

  // Mês/ano uma vez por mês, centralizado (mesmo mecanismo para 1h e 2h+)
  const monthYearCentered: { centerIndex: number; label: string }[] = [];
  const monthRanges: { start: number; end: number; label: string }[] = [];
  let lastMonth = "";
  let monthStart = 0;
  for (let i = 0; i <= windowN; i++) {
    const m = i < windowN ? monthKey(windowSlice[i][0] as number) : "";
    if (m !== lastMonth && lastMonth !== "") {
      const ms = windowSlice[monthStart][0] as number;
      monthRanges.push({ start: monthStart, end: i, label: formatMonthYearShort(ms) });
      monthStart = i;
    }
    if (i < windowN && lastMonth === "") monthStart = i;
    lastMonth = m;
  }
  if (lastMonth !== "" && monthStart < windowN) {
    const ms = windowSlice[monthStart][0] as number;
    monthRanges.push({ start: monthStart, end: windowN, label: formatMonthYearShort(ms) });
  }
  for (const r of monthRanges) {
    const centerIndex = r.start + Math.floor((r.end - r.start) / 2);
    monthYearCentered.push({ centerIndex, label: r.label });
  }

  // Verticais: quantidade 30→6, 50→6, 100→8, 150→12; primeira vertical sempre no início do dia (meia-noite UTC)
  const numVerticals =
    windowN <= 30 ? 6
      : windowN <= 50 ? 6
        : windowN <= 100 ? 8
          : 12;
  const verticalEvery = numVerticals <= 1 ? 1 : Math.max(1, Math.floor(windowN / (numVerticals - 1)));
  const firstMidnightIndex = windowSlice.findIndex((k) => isStartOfDay(k[0] as number));
  const anchorIndex = firstMidnightIndex >= 0 ? firstMidnightIndex : (dateBreaks[0]?.index ?? 0);
  const verticalIndices: number[] = [];
  for (let i = anchorIndex; i >= 0; i -= verticalEvery) verticalIndices.push(i);
  for (let i = anchorIndex + verticalEvery; i < windowN; i += verticalEvery) verticalIndices.push(i);
  verticalIndices.sort((a, b) => a - b);
  const verticalIndicesFiltered = [...new Set(verticalIndices)].filter((i) => i >= 0 && i < windowN);

  const canPrev = startIndex > 0;
  const canNext = startIndex + visibleCount < n;

  // Último fechamento do dataset (candle mais recente); API retorna ORDER BY openTime DESC → [0] = mais recente
  const lastClose = n > 0 ? parseNum(klines[0][4]) : 0;
  const lastCloseY = y(lastClose);
  const lastCloseInVisibleRange =
    lastClose >= yMin && lastClose <= yMax;
  const showLastClose = lastClose > 0 && lastCloseInVisibleRange;

  const totalChartWidth = displayPlotWidth + Y_AXIS_WIDTH;
  chartDimensionsRef.current = { w: totalChartWidth, h: chartHeight, sizePercent: chartSizePercent };

  const containerBgHex = BACKGROUND_PALETTE.find((b) => b.id === containerBackground)?.hex ?? "#ffffff";
  const chartBgHex = BACKGROUND_PALETTE.find((b) => b.id === chartBackground)?.hex ?? "#ffffff";
  const footerYAxisHex = BACKGROUND_PALETTE.find((b) => b.id === footerYAxisBgColor)?.hex ?? "#ffffff";
  const backgroundTextHex = TEXT_PALETTE.find((b) => b.id === backgroundTextColor)?.hex ?? "#000000";
  const footerYAxisTextHex = TEXT_PALETTE.find((b) => b.id === footerYAxisTextColor)?.hex ?? "#000000";
  const lineTableHex = LINE_GRID_PALETTE.find((b) => b.id === lineTableColor)?.hex ?? "#171717";
  const secondaryGridHex = LINE_GRID_PALETTE.find((b) => b.id === secondaryGridColor)?.hex ?? "#71717a";
  const lastCloseLineHex = LINE_GRID_PALETTE.find((b) => b.id === lastCloseLineColor)?.hex ?? "#000000";
  const lastCloseTextHex = LINE_GRID_PALETTE.find((b) => b.id === lastCloseTextColor)?.hex ?? "#000000";
  const isDarkBg = chartBackground >= 4; // cinza escuro e mais escuro (área de plot)
  const isDarkFooterYAxis = footerYAxisBgColor >= 4; // rodapé e eixo Y escuros

  // Estado de carregamento apenas na primeira renderização ou ao trocar o intervalo (não ao atualizar klines em background)
  if (!chartReady) {
    chartDimensionsRef.current = { w: 0, h: 0, sizePercent: 100 };
    return (
      <div
        className="rounded-lg border border-zinc-200 overflow-visible flex flex-col flex-shrink-0 w-fit flex items-center justify-center"
        style={{ minWidth: totalChartWidth, minHeight: MIN_CHART_HEIGHT, backgroundColor: "#f5f5f5" }}
      >
        <p className="text-zinc-500 text-sm">{t.loading.replace("{interval}", intervalLabel ?? "")}</p>
      </div>
    );
  }

  const hasIndicatorStrip = indicatorLines.length > 0;

  return (
    <div
      className="rounded-lg border border-zinc-200 overflow-visible flex flex-col flex-shrink-0 w-fit"
      style={{ minWidth: totalChartWidth, backgroundColor: containerBgHex, paddingTop: CHART_TOP_PADDING }}
    >
      <div className="flex flex-col min-w-0 flex-shrink-0">
        <div className="flex-shrink-0 min-w-0 w-full" style={{ touchAction: "pan-x pan-y", marginBottom: 0, maxWidth: "100vw" }}>
          <KlinesChartSidebar
            chartHeight={chartHeight}
            settingsRef={settingsRef}
            colorsRef={colorsRef}
            saveLoadRef={saveLoadRef}
            drawRef={drawRef}
            orientation="horizontal"
            t={t}
            intervalLabel={intervalLabel}
            intervalOptions={intervalOptions ?? []}
            groupMinutes={groupMinutes}
            onIntervalChange={onIntervalChange ?? (() => {})}
            settingsOpen={settingsOpen}
            setSettingsOpen={setSettingsOpen}
            colorsOpen={colorsOpen}
            setColorsOpen={setColorsOpen}
            yAxisAbbreviated={yAxisAbbreviated}
            setYAxisAbbreviated={setYAxisAbbreviated}
            logScale={logScale}
            setLogScale={setLogScale}
            showMainAxis={showMainAxis}
            setShowMainAxis={setShowMainAxis}
            showSecondaryAxis={showSecondaryAxis}
            setShowSecondaryAxis={setShowSecondaryAxis}
            showLastCloseLine={showLastCloseLine}
            setShowLastCloseLine={setShowLastCloseLine}
            invisibleCandlesEnd={invisibleCandlesEnd}
            setInvisibleCandlesEnd={setInvisibleCandlesEnd}
            secondaryPanelHeightPercent={secondaryPanelHeightPercent}
            setSecondaryPanelHeightPercent={setSecondaryPanelHeightPercent}
            secondaryPanelHeightMin={SECONDARY_PANEL_HEIGHT_MIN}
            secondaryPanelHeightMax={SECONDARY_PANEL_HEIGHT_MAX}
            candleColorPreset={candleColorPreset}
            setCandleColorPreset={setCandleColorPreset}
            containerBackground={containerBackground}
            setContainerBackground={setContainerBackground}
            chartBackground={chartBackground}
            setChartBackground={setChartBackground}
            footerYAxisBgColor={footerYAxisBgColor}
            setFooterYAxisBgColor={setFooterYAxisBgColor}
            backgroundTextColor={backgroundTextColor}
            setBackgroundTextColor={setBackgroundTextColor}
            footerYAxisTextColor={footerYAxisTextColor}
            setFooterYAxisTextColor={setFooterYAxisTextColor}
            lineTableColor={lineTableColor}
            setLineTableColor={setLineTableColor}
            secondaryGridColor={secondaryGridColor}
            setSecondaryGridColor={setSecondaryGridColor}
            lastCloseLineColor={lastCloseLineColor}
            setLastCloseLineColor={setLastCloseLineColor}
            lastCloseTextColor={lastCloseTextColor}
            setLastCloseTextColor={setLastCloseTextColor}
            volumeOnPrice={volumeOnPrice}
            setVolumeOnPrice={setVolumeOnPrice}
            volumeOnPriceOpacity={volumeOnPriceOpacity}
            setVolumeOnPriceOpacity={setVolumeOnPriceOpacity}
            chartWidth={width}
            chartSizePercent={chartSizePercent}
            setChartSizePercent={setChartSizePercent}
            yPadOffset={yPadOffset}
            setYPadOffset={setYPadOffset}
            drawOpen={drawOpen}
            setDrawOpen={setDrawOpen}
            drawingsVisible={drawingsVisible}
            setDrawingsVisible={setDrawingsVisible}
            drawMode={drawMode}
            drawTool={drawTool}
            drawMagnetic={drawMagnetic}
            setDrawMagnetic={setDrawMagnetic}
            drawPanelSide={drawPanelSide}
            setDrawPanelSide={setDrawPanelSide}
            openDrawPanel={openDrawPanel}
            closeDrawMode={closeDrawMode}
            selectLineTool={selectLineTool}
            selectFibonacciTool={selectFibonacciTool}
            selectSelectTool={selectSelectTool}
            clearAllDrawing={clearAllDrawing}
            saveOpen={saveOpen}
            setSaveOpen={setSaveOpen}
            loadOpen={loadOpen}
            setLoadOpen={setLoadOpen}
            savedLayouts={savedLayouts}
            onSaveLayout={handleSaveLayout}
            onLoadDefaultLayout={handleLoadDefaultLayout}
            onLoadLayout={handleLoadLayout}
            onFetchSavedLayouts={fetchSavedLayouts}
          />
        </div>
        <div className="flex flex-col flex-shrink-0 min-w-0" style={{ touchAction: "pan-x pan-y" }}>
          <div ref={chartRowRef} className="flex flex-shrink-0 flex-row relative" style={{ backgroundColor: containerBgHex }}>
          {drawOpen && drawPanelSide === "right" && (
            <div
              ref={drawToolboxRef}
              className="absolute z-[100] flex w-fit flex-col items-center rounded-lg border border-zinc-200 bg-white shadow-lg py-1 px-1"
              style={drawToolboxPosition === null ? { left: 8, top: 8 } : { left: drawToolboxPosition.x, top: drawToolboxPosition.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex w-full min-w-0 items-center justify-between gap-0.5 px-0.5 pb-1 border-b border-zinc-100">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDrawOpen(false); closeDrawMode(); }}
                  className="p-0.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 text-base leading-none font-semibold"
                  title={t.drawExitMode}
                  aria-label={t.drawExitMode}
                >
                  <span aria-hidden>×</span>
                </button>
                <div
                  role="button"
                  tabIndex={0}
                  className="p-0.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 text-base leading-none cursor-grab active:cursor-grabbing select-none touch-none"
                  title={t.drawToolboxDrag}
                  aria-label={t.drawToolboxDrag}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!drawToolboxRef.current || !chartRowRef.current) return;
                    const box = drawToolboxRef.current.getBoundingClientRect();
                    const row = chartRowRef.current.getBoundingClientRect();
                    const currentX = drawToolboxPosition?.x ?? 8;
                    const currentY = drawToolboxPosition?.y ?? 8;
                    if (drawToolboxPosition === null) setDrawToolboxPosition({ x: currentX, y: currentY });
                    const startClientX = e.clientX;
                    const startClientY = e.clientY;
                    const startX = currentX;
                    const startY = currentY;
                    const onMove = (ev: PointerEvent) => {
                      if (!drawToolboxRef.current || !chartRowRef.current) return;
                      if (ev.cancelable) ev.preventDefault();
                      const boxRect = drawToolboxRef.current.getBoundingClientRect();
                      const rowRect = chartRowRef.current.getBoundingClientRect();
                      const cw = rowRect.width;
                      const ch = rowRect.height;
                      let newX = startX + (ev.clientX - startClientX);
                      let newY = startY + (ev.clientY - startClientY);
                      newX = Math.max(0, Math.min(cw - boxRect.width, newX));
                      newY = Math.max(0, Math.min(ch - boxRect.height, newY));
                      setDrawToolboxPosition({ x: newX, y: newY });
                    };
                    const onUp = () => {
                      document.removeEventListener("pointermove", onMove);
                      document.removeEventListener("pointerup", onUp);
                      document.removeEventListener("pointercancel", onUp);
                    };
                    document.addEventListener("pointermove", onMove);
                    document.addEventListener("pointerup", onUp);
                    document.addEventListener("pointercancel", onUp);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") e.preventDefault();
                  }}
                >
                  <span aria-hidden>⠿</span>
                </div>
              </div>
              <button
                type="button"
                onClick={selectLineTool}
                title={t.lineSegment}
                className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "line" ? "bg-zinc-100" : ""}`}
                aria-label={t.lineSegment}
              >
                📏
              </button>
              <button
                type="button"
                onClick={selectFibonacciTool}
                title={(t as Record<string, string>).fibonacciRetracement ?? "Fibonacci retracement"}
                className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "fibonacci" ? "bg-zinc-100" : ""}`}
                aria-label={(t as Record<string, string>).fibonacciRetracement ?? "Fibonacci retracement"}
              >
                ◫
              </button>
              <button
                type="button"
                onClick={clearAllDrawing}
                title={t.drawClearAll}
                className="flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 text-zinc-700 shrink-0"
                aria-label={t.drawClearAll}
              >
                🗑️
              </button>
            </div>
          )}
          {drawMode && selectedSegmentIndex !== null && drawSegments[selectedSegmentIndex] && (
            <div
              ref={segmentOptionsRef}
              className="absolute z-[100] rounded-lg border border-zinc-200 bg-white shadow-lg overflow-hidden w-fit min-w-0 max-w-[180px]"
              style={segmentOptionsPosition === null ? { left: 8, top: 8 } : { left: segmentOptionsPosition.x, top: segmentOptionsPosition.y }}
              onClick={(e) => e.stopPropagation()}
              role="group"
              aria-label={t.segmentOptionsTitle}
            >
              <div className="flex items-center justify-between gap-0.5 bg-zinc-50 border-b border-zinc-200 px-1.5 py-1">
                <span className="text-[11px] font-medium text-zinc-600 truncate min-w-0 flex-1">{t.segmentOptionsTitle}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedSegmentIndex(null); }}
                  className="p-0.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 text-base leading-none font-semibold shrink-0"
                  title={t.drawExitMode}
                  aria-label={t.drawExitMode}
                >
                  <span aria-hidden>×</span>
                </button>
                <div
                  role="button"
                  tabIndex={0}
                  className="p-0.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 text-base leading-none cursor-grab active:cursor-grabbing select-none touch-none shrink-0"
                  title={t.drawToolboxDrag}
                  aria-label={t.drawToolboxDrag}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!segmentOptionsRef.current || !chartRowRef.current) return;
                    const box = segmentOptionsRef.current.getBoundingClientRect();
                    const row = chartRowRef.current.getBoundingClientRect();
                    const currentX = segmentOptionsPosition?.x ?? 8;
                    const currentY = segmentOptionsPosition?.y ?? 8;
                    if (segmentOptionsPosition === null) setSegmentOptionsPosition({ x: currentX, y: currentY });
                    const startClientX = e.clientX;
                    const startClientY = e.clientY;
                    const startX = currentX;
                    const startY = currentY;
                    const onMove = (ev: PointerEvent) => {
                      if (!segmentOptionsRef.current || !chartRowRef.current) return;
                      if (ev.cancelable) ev.preventDefault();
                      const boxRect = segmentOptionsRef.current.getBoundingClientRect();
                      const rowRect = chartRowRef.current.getBoundingClientRect();
                      const cw = rowRect.width;
                      const ch = rowRect.height;
                      let newX = startX + (ev.clientX - startClientX);
                      let newY = startY + (ev.clientY - startClientY);
                      newX = Math.max(0, Math.min(cw - boxRect.width, newX));
                      newY = Math.max(0, Math.min(ch - boxRect.height, newY));
                      setSegmentOptionsPosition({ x: newX, y: newY });
                    };
                    const onUp = () => {
                      document.removeEventListener("pointermove", onMove);
                      document.removeEventListener("pointerup", onUp);
                      document.removeEventListener("pointercancel", onUp);
                    };
                    document.addEventListener("pointermove", onMove);
                    document.addEventListener("pointerup", onUp);
                    document.addEventListener("pointercancel", onUp);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.preventDefault(); }}
                >
                  <span aria-hidden>⠿</span>
                </div>
              </div>
              <div className="py-1.5 px-1.5 space-y-1.5">
                  <div>
                    <div className="text-[10px] font-medium text-zinc-500 pb-0.5">{drawSegments[selectedSegmentIndex]?.type === "fibonacci" ? t.fibonacciColor : t.segmentColor}</div>
                    <div className="relative">
                      <button
                        type="button"
                        role="combobox"
                        aria-expanded={segmentColorListboxOpen}
                        aria-haspopup="listbox"
                        aria-label={drawSegments[selectedSegmentIndex]?.type === "fibonacci" ? t.fibonacciColor : t.segmentColor}
                        onClick={() => setSegmentColorListboxOpen((o) => !o)}
                        className="w-full flex items-center gap-1.5 rounded border border-zinc-300 px-1.5 py-1 bg-white text-left min-h-[24px]"
                      >
                        <span
                          className="w-4 h-4 rounded border border-zinc-300 shrink-0"
                          style={{ backgroundColor: drawSegments[selectedSegmentIndex]?.color ?? DEFAULT_SEGMENT_COLOR }}
                        />
                        <span className="text-zinc-500 text-xs shrink-0 ml-auto" aria-hidden>{segmentColorListboxOpen ? "▲" : "▼"}</span>
                      </button>
                      {segmentColorListboxOpen && (
                        <div
                          role="listbox"
                          aria-label={drawSegments[selectedSegmentIndex]?.type === "fibonacci" ? t.fibonacciColor : t.segmentColor}
                          className="absolute left-0 top-full mt-0.5 z-20 grid grid-cols-3 gap-1 p-1 rounded border border-zinc-200 bg-white shadow-lg"
                        >
                          {SEGMENT_COLOR_PALETTE.map((hex) => {
                            const isSelected = (drawSegments[selectedSegmentIndex]?.color ?? DEFAULT_SEGMENT_COLOR) === hex;
                            return (
                              <button
                                key={hex}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                aria-label={drawSegments[selectedSegmentIndex]?.type === "fibonacci" ? t.fibonacciColor : t.segmentColor}
                                onClick={() => {
                                  const segType = drawSegments[selectedSegmentIndex]?.type ?? "segment";
                                  setDrawSegments((prev) => {
                                    const next = [...prev];
                                    const seg = next[selectedSegmentIndex];
                                    if (seg) next[selectedSegmentIndex] = { ...seg, color: hex };
                                    return next;
                                  });
                                  persistDrawDefault(segType, { color: hex });
                                  setSegmentColorListboxOpen(false);
                                }}
                                className={`w-5 h-5 rounded border-2 shrink-0 hover:opacity-90 ${isSelected ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                                style={{ backgroundColor: hex }}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  {drawSegments[selectedSegmentIndex]?.type === "fibonacci" && (
                    <div>
                      <div className="text-[10px] font-medium text-zinc-500 pb-0.5">{t.fibLevel618Color}</div>
                      <div className="relative">
                        <button
                          type="button"
                          role="combobox"
                          aria-expanded={fibLevel618ColorListboxOpen}
                          aria-haspopup="listbox"
                          aria-label={t.fibLevel618Color}
                          onClick={() => setFibLevel618ColorListboxOpen((o) => !o)}
                          className="w-full flex items-center gap-1.5 rounded border border-zinc-300 px-1.5 py-1 bg-white text-left min-h-[24px]"
                        >
                          <span
                            className="w-4 h-4 rounded border border-zinc-300 shrink-0"
                            style={{ backgroundColor: drawSegments[selectedSegmentIndex]?.fibLevel618Color ?? drawSegments[selectedSegmentIndex]?.color ?? DEFAULT_SEGMENT_COLOR }}
                          />
                          <span className="text-zinc-500 text-xs shrink-0 ml-auto" aria-hidden>{fibLevel618ColorListboxOpen ? "▲" : "▼"}</span>
                        </button>
                        {fibLevel618ColorListboxOpen && (
                          <div
                            role="listbox"
                            aria-label={t.fibLevel618Color}
                            className="absolute left-0 top-full mt-0.5 z-20 grid grid-cols-3 gap-1 p-1 rounded border border-zinc-200 bg-white shadow-lg"
                          >
                            {SEGMENT_COLOR_PALETTE.map((hex) => {
                              const seg = drawSegments[selectedSegmentIndex];
                              const currentColor = seg?.fibLevel618Color ?? seg?.color ?? DEFAULT_SEGMENT_COLOR;
                              const isSelected = currentColor === hex;
                              return (
                                <button
                                  key={hex}
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  aria-label={t.fibLevel618Color}
                                  onClick={() => {
                                    setDrawSegments((prev) => {
                                      const next = [...prev];
                                      const s = next[selectedSegmentIndex];
                                      if (s) next[selectedSegmentIndex] = { ...s, fibLevel618Color: hex };
                                      return next;
                                    });
                                    persistDrawDefault("fibonacci", { fibLevel618Color: hex });
                                    setFibLevel618ColorListboxOpen(false);
                                  }}
                                  className={`w-5 h-5 rounded border-2 shrink-0 hover:opacity-90 ${isSelected ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                                  style={{ backgroundColor: hex }}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {drawSegments[selectedSegmentIndex]?.type !== "fibonacci" && (
                    <>
                      <div>
                        <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="segment-startcap-listbox">{t.segmentStartCap}</label>
                        <select
                          id="segment-startcap-listbox"
                          value={drawSegments[selectedSegmentIndex]?.startCap ?? "none"}
                          onChange={(e) => {
                            const cap = e.target.value as SegmentCap;
                            setDrawSegments((prev) => {
                              const next = [...prev];
                              const seg = next[selectedSegmentIndex];
                              if (seg) next[selectedSegmentIndex] = { ...seg, startCap: cap };
                              return next;
                            });
                            persistDrawDefault("segment", { startCap: cap });
                          }}
                          className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                          aria-label={t.segmentStartCap}
                        >
                          {SEGMENT_CAP_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{t[opt.labelKey]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="segment-endcap-listbox">{t.segmentEndCap}</label>
                        <select
                          id="segment-endcap-listbox"
                          value={drawSegments[selectedSegmentIndex]?.endCap ?? "none"}
                          onChange={(e) => {
                            const cap = e.target.value as SegmentCap;
                            setDrawSegments((prev) => {
                              const next = [...prev];
                              const seg = next[selectedSegmentIndex];
                              if (seg) next[selectedSegmentIndex] = { ...seg, endCap: cap };
                              return next;
                            });
                            persistDrawDefault("segment", { endCap: cap });
                          }}
                          className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                          aria-label={t.segmentEndCap}
                        >
                          {SEGMENT_CAP_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{t[opt.labelKey]}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-700">
                    <input
                      type="checkbox"
                      checked={drawSegments[selectedSegmentIndex]?.showPercent !== false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const segType = drawSegments[selectedSegmentIndex]?.type ?? "segment";
                        setDrawSegments((prev) => {
                          const next = [...prev];
                          const seg = next[selectedSegmentIndex];
                          if (seg) next[selectedSegmentIndex] = { ...seg, showPercent: checked };
                          return next;
                        });
                        persistDrawDefault(segType, { showPercent: checked });
                      }}
                      className="rounded border-zinc-300"
                    />
                    <span>{t.segmentShowPercent}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-700">
                    <input
                      type="checkbox"
                      checked={drawSegments[selectedSegmentIndex]?.showValues === true}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const segType = drawSegments[selectedSegmentIndex]?.type ?? "segment";
                        setDrawSegments((prev) => {
                          const next = [...prev];
                          const seg = next[selectedSegmentIndex];
                          if (seg) next[selectedSegmentIndex] = { ...seg, showValues: checked };
                          return next;
                        });
                        persistDrawDefault(segType, { showValues: checked });
                      }}
                      className="rounded border-zinc-300"
                    />
                    <span>{t.segmentShowValues}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSegmentIndex === null) return;
                      setDrawSegments((prev) => prev.filter((_, i) => i !== selectedSegmentIndex));
                      setSelectedSegmentIndex(null);
                    }}
                    className="w-full flex items-center justify-center py-1 rounded border border-zinc-300 bg-zinc-50 hover:bg-red-50 hover:border-red-300 text-base"
                    title={t.segmentDelete}
                    aria-label={t.segmentDelete}
                  >
                    <span aria-hidden>🗑️</span>
                  </button>
                </div>
            </div>
          )}
          <KlinesChartSvg
            chartSvgRef={chartSvgRef}
            crosshairOverlayRef={crosshairOverlayRef}
            width={displayPlotWidth}
            chartHeight={chartHeight}
            chartW={chartW}
            chartH={chartH}
            gap={gap}
            candleW={candleW}
            y={y}
            cx={cx}
            segmentToPixel={segmentToPixel}
            snapToCandlePoint={snapToCandlePoint}
            windowSlice={windowSlice}
            fullReversed={fullReversed}
            startIndex={startIndex}
            windowN={windowN}
            n={n}
            candleColors={candleColors}
            yTickValues={yTickValues}
            verticalIndicesFiltered={verticalIndicesFiltered}
            dateBreaksFiltered={dateBreaksFiltered}
            dayBreaksFiltered={dayBreaksFiltered}
            showMainAxis={showMainAxis}
            showSecondaryAxis={showSecondaryAxis}
            showLastCloseLine={showLastCloseLine}
            showLastClose={showLastClose}
            lastCloseY={lastCloseY}
            volumeOnPrice={volumeOnPrice}
            volumeOnPriceOpacity={volumeOnPriceOpacity}
            lineTableHex={lineTableHex}
            secondaryGridHex={secondaryGridHex}
            lastCloseLineHex={lastCloseLineHex}
            chartBgHex={chartBgHex}
            backgroundTextHex={backgroundTextHex}
            formatYAxis={formatYAxis}
            hasPanel2={hasPanel2}
            hasPanel3={hasPanel3}
            hasPanel4={hasPanel4}
            hasPanel5={hasPanel5}
            panel2Top={panel2Top}
            panel3Top={panel3Top}
            panel4Top={panel4Top}
            panel5Top={panel5Top}
            panelTop={panelTop}
            panelHeight={panelHeight}
            panelExtents={panelExtents}
            indicatorLines={indicatorLines}
            getPanel={getPanel}
            yValInPanel={yValInPanel}
            hasIndicatorStrip={hasIndicatorStrip}
            isDarkBg={isDarkBg}
            crosshairPoint={crosshairPoint}
            crosshairDragging={crosshairDragging}
            setCrosshairPoint={setCrosshairPoint}
            setCrosshairDragging={setCrosshairDragging}
            drawingsVisible={drawingsVisible}
            drawSegments={drawSegments}
            setDrawSegments={setDrawSegments}
            drawDefaults={drawDefaults}
            drawPending={drawPending}
            setDrawPending={setDrawPending}
            selectedSegmentIndex={selectedSegmentIndex}
            setSelectedSegmentIndex={setSelectedSegmentIndex}
            drawMode={drawMode}
            drawTool={drawTool}
            setDrawDragging={setDrawDragging}
            onSelectToolPan={onSelectToolPan}
            onChartDrawClick={() => {
              setSegmentToolboxCollapsed(true);
              setDrawOpen(false);
            }}
            t={t}
            textScale={textScale}
            strategyCandleOverlays={strategyCandleOverlays}
          />
          {!drawMode && (
            <>
              <div
                ref={crosshairOverlayDivRef}
                role="presentation"
                style={{
                  position: "absolute",
                  left: MARGIN_LEFT,
                  top: MARGIN_TOP,
                  width: chartW,
                  height: chartH,
                  touchAction: "none",
                  zIndex: 1,
                  cursor: crosshairDragging ? "grabbing" : crosshairPoint !== null ? "grab" : "crosshair",
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const rect = e.currentTarget.getBoundingClientRect();
                  const px = MARGIN_LEFT + (e.clientX - rect.left) * (chartW / (rect.width || 1));
                  const py = MARGIN_TOP + (e.clientY - rect.top) * (chartH / (rect.height || 1));
                  const toData = crosshairPixelToDataRef.current;
                  if (!toData) return;
                  const newPoint = toData(px, py);
                  const isSamePoint = crosshairPoint !== null && crosshairPoint.index === newPoint.index && Math.abs(crosshairPoint.price - newPoint.price) < 1e-9;
                  if (isSamePoint) {
                    setCrosshairPoint(null);
                    return;
                  }
                  setCrosshairPoint(newPoint);
                  crosshairDraggingRef.current = true;
                  setCrosshairDragging(true);
                }}
                onPointerMove={(e) => {
                  if (!crosshairDraggingRef.current) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const px = MARGIN_LEFT + (e.clientX - rect.left) * (chartW / (rect.width || 1));
                  const py = MARGIN_TOP + (e.clientY - rect.top) * (chartH / (rect.height || 1));
                  const toData = crosshairPixelToDataRef.current;
                  if (toData) setCrosshairPoint(toData(px, py));
                }}
                onPointerUp={(e) => {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  crosshairDraggingRef.current = false;
                  setCrosshairDragging(false);
                }}
                onPointerCancel={(e) => {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  crosshairDraggingRef.current = false;
                  setCrosshairDragging(false);
                }}
              />
              {hasPanel2 || hasPanel3 || hasPanel4 || hasPanel5 ? (
                <div
                  role="presentation"
                  style={{
                    position: "absolute",
                    left: MARGIN_LEFT,
                    top: tableTop,
                    width: chartW,
                    height: chartBottom - tableTop,
                    touchAction: "pan-x pan-y",
                    zIndex: 1,
                  }}
                  onPointerDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const secH = chartBottom - tableTop;
                    const px = MARGIN_LEFT + (e.clientX - rect.left) * (chartW / (rect.width || 1));
                    const py = tableTop + (e.clientY - rect.top) * (secH / (rect.height || 1));
                    const inPanel2 = hasPanel2 && py >= panel2Top && py < panel2Top + panel2Height;
                    const inPanel3 = hasPanel3 && py >= panel3Top && py < panel3Top + panel3Height;
                    const inPanel4 = hasPanel4 && py >= panel4Top && py < panel4Top + panel4Height;
                    const inPanel5 = hasPanel5 && py >= panel5Top && py < panel5Top + panel5Height;
                    if (!inPanel2 && !inPanel3 && !inPanel4 && !inPanel5) return;
                    const idx = Math.max(0, Math.min(n - 1, Math.round((px - MARGIN_LEFT) / gap - 0.5) + startIndex));
                    const close = parseNum(String(fullReversed[idx]?.[4] ?? 0));
                    let panelValue: number;
                    if (inPanel2) {
                      const { min, max } = panelExtents.panel2;
                      panelValue = min + (1 - (py - panel2Top) / panel2Height) * (max - min);
                    } else if (inPanel3) {
                      const { min, max } = panelExtents.panel3;
                      panelValue = min + (1 - (py - panel3Top) / panel3Height) * (max - min);
                    } else if (inPanel4) {
                      const { min, max } = panelExtents.panel4;
                      panelValue = min + (1 - (py - panel4Top) / panel4Height) * (max - min);
                    } else {
                      const { min, max } = panelExtents.panel5;
                      panelValue = min + (1 - (py - panel5Top) / panel5Height) * (max - min);
                    }
                    const newPoint = { index: idx, price: close, panelClickY: py, panelValue };
                    const isSamePoint = crosshairPoint !== null && crosshairPoint.index === newPoint.index && Math.abs(crosshairPoint.price - newPoint.price) < 1e-9;
                    if (isSamePoint) {
                      setCrosshairPoint(null);
                      return;
                    }
                    setCrosshairPoint(newPoint);
                  }}
                />
              ) : null}
            </>
          )}
          <KlinesChartYAxis
              chartHeight={chartHeight}
              yTickValues={yTickValues}
              y={y}
              formatYAxis={formatYAxis}
              formatPanelValue={(v: number) => (v >= 0 && v <= 100 && v === Math.round(v) ? String(v) : formatAbbreviated(v))}
              formatObvValue={formatObvYAxis}
              footerYAxisTextHex={footerYAxisTextHex}
              isDarkFooterYAxis={isDarkFooterYAxis}
              footerYAxisHex={footerYAxisHex}
              lineTableHex={lineTableHex}
              yAxisAbbreviated={yAxisAbbreviated}
              hasPanel2={hasPanel2}
              hasPanel3={hasPanel3}
              hasPanel4={hasPanel4}
              hasPanel5={hasPanel5}
              panelExtents={panelExtents}
              yRsiPanel2={yRsiPanel2}
              yRsiPanel3={yRsiPanel3}
              yRsiPanel4={yRsiPanel4}
              yRsiPanel5={yRsiPanel5}
              yRsiByPanel={yRsiByPanel}
              showLastClose={showLastClose}
              lastCloseY={lastCloseY}
              lastClose={lastClose}
              lastCloseTextHex={lastCloseTextHex}
              indicatorLines={indicatorLines}
              klines={klines}
              n={n}
              getPanel={getPanel}
              yMin={yMin}
              yMax={yMax}
              crosshairPoint={crosshairPoint}
              startIndex={startIndex}
              windowN={windowN}
              crosshairDragging={crosshairDragging}
              volumeOnPrice={volumeOnPrice}
              volumeLabelY={volumeOnPrice && windowN > 0 ? MARGIN_TOP + chartH - chartH / 6 : undefined}
              volumeLabelValue={
                volumeOnPrice && windowN > 0
                  ? (() => {
                      const lastRow = windowSlice[windowN - 1];
                      if (!lastRow) return undefined;
                      const v = lastRow[5];
                      const num = v != null ? (typeof v === "number" ? v : Number(v)) : NaN;
                      return Number.isFinite(num) ? formatAbbreviated(num) : undefined;
                    })()
                  : undefined
              }
              volumeLabelColor={
                volumeOnPrice && windowN > 0
                  ? (() => {
                      const lastRow = windowSlice[windowN - 1];
                      if (!lastRow) return undefined;
                      const open = parseNum(String(lastRow[1] ?? ""));
                      const close = parseNum(String(lastRow[4] ?? ""));
                      return Number.isFinite(open) && Number.isFinite(close) && close >= open ? candleColors.bull : candleColors.bear;
                    })()
                  : undefined
              }
              textScale={textScale}
            />
          </div>
          <KlinesChartFooter
            footerYAxisHex={footerYAxisHex}
            footerYAxisTextHex={footerYAxisTextHex}
            isDarkFooterYAxis={isDarkFooterYAxis}
            saveLoadMsg={saveLoadMsg}
            intervalLabel={intervalLabel}
            groupMinutes={groupMinutes}
            t={t}
            visibleCount={visibleCount}
            setVisibleCount={setVisibleCount}
            setStartIndex={setStartIndex}
            n={n}
            canPrev={canPrev}
            canNext={canNext}
            symbol={symbolProp}
            onOpenSymbolPanel={onOpenSymbolPanel}
          />
        </div>
      </div>
    </div>
  );
}
