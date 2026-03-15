"use client";

/**
 * Gráfico de candles (OHLC). Janela visível configurável.
 * Eixo Y: preço USDT (ajustado aos candles visíveis). Eixo X: tempo + subeixo por data.
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { API_BASE, APP_CRYPTO_ROUTE_PREFIX, ASSET_PREFIX, SISTEMA_PATH } from "@/app/constants";
import { useSistemaDebug } from "./SistemaDebugContext";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import {
  ASPECT_BREAKPOINT,
  MIN_CHART_HEIGHT,
  PAD_Y,
  Y_PAD_OFFSET_MIN,
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
  VISIBLE_COUNT_MIN,
  VISIBLE_COUNT_MAX,
  DEFAULT_VISIBLE,
  INVISIBLE_CANDLES_END,
  SIDEBAR_WIDTH,
  KLINE_PREFS_KEY,
  KLINE_LOCAL_PREFS_KEY,
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
import { DEFAULT_SEGMENT_COLOR, DEFAULT_TEXT_COLOR as DEFAULT_DRAW_TEXT_COLOR, type DrawSegment, type DrawDefaults } from "./KlinesChartDrawing";
import { flushSync } from "react-dom";
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
} from "./klinesChart/palettes";
import type { CandleColorPresetId, BackgroundId, LineGridId, TextColorId } from "./klinesChart/palettes";
import { DEFAULT_LAYOUT_FALLBACK } from "./klinesChart/defaultLayoutFallback";
import { KlinesChartSidebar } from "./klinesChart/KlinesChartSidebar";
import { KlinesChartSegmentOptions } from "./klinesChart/KlinesChartSegmentOptions";
import { KlinesChartSvg } from "./klinesChart/KlinesChartSvg";
import { KlinesChartYAxis } from "./klinesChart/KlinesChartYAxis";
import { KlinesChartFooter } from "./klinesChart/KlinesChartFooter";
import { computeVolumeAtPriceBuckets } from "./klinesChart/volumeAtPrice";
import { useChartLayoutSave } from "./ChartLayoutSaveContext";
import { getSessionTabId } from "./sessionTabId";

export type { ChartIndicatorLine } from "./klinesChart/types";

const BUILTIN_DRAW_DEFAULTS: DrawDefaults = {
  segment: { color: SEGMENT_COLOR_PALETTE[0], startCap: "point", endCap: "arrow", showPercent: true, showValues: false },
  fibonacci: { color: SEGMENT_COLOR_PALETTE[8], fibLevel618Color: SEGMENT_COLOR_PALETTE[4], showPercent: false, showValues: false, fibStrokeWidth: "medium", fibLevel618StrokeWidth: "thin", fibLevelPct1: 33.33, fibShow1618: false, fibShowValuesOnYAxis: false },
  freeRetracement: { color: SEGMENT_COLOR_PALETTE[0], freeRetracementLevelPct1: 25, freeRetracementLevelPct: 75, freeRetracementLevelPctExt: 100, freeRetracementShowValuesOnYAxis: false, freeRetracementExtensionIndices: 0, fibStrokeWidth: "medium", showPercent: true, showValues: false },
  channel: { color: SEGMENT_COLOR_PALETTE[0], channelExtremityColor: SEGMENT_COLOR_PALETTE[0], channelMidStrokeWidth: "thin", channelExtremityStrokeWidth: "thin", showValues: false },
  stopGain: { stopGainRatioUp: 1, stopGainRatioDown: 1, stopGainFillOpacity: 0.5, stopGainShowPercent: false, stopGainShowValuesOnYAxis: false, stopGainStrokeWidth: "medium" },
  rectangle: { color: SEGMENT_COLOR_PALETTE[0], rectangleStrokeWidth: "medium", rectangleFilled: false },
  horizontalLine: { color: SEGMENT_COLOR_PALETTE[0], horizontalLineStrokeWidth: "medium", horizontalLineStrokeStyle: "solid" },
  verticalLine: { color: SEGMENT_COLOR_PALETTE[0], verticalLineStrokeWidth: "medium", verticalLineStrokeStyle: "solid" },
  arrow: { color: SEGMENT_COLOR_PALETTE[0], arrowSize: "medium" },
  text: { color: DEFAULT_DRAW_TEXT_COLOR, textBold: false, textSize: "small" },
  pencil: { color: SEGMENT_COLOR_PALETTE[0], pencilStrokeWidth: "medium" },
};

export default function KlinesChart({ klines, groupMinutes, timezoneOffset = 0, intervalLabel, intervalOptions, onIntervalChange, width, indicatorLines = [], strategyCandleOverlays = [], onLayoutConfigLoaded, getLayoutExtraConfig, layoutAppliedTick, maxChartHeight, onChartDimensionsChange, symbol: symbolProp, onOpenSymbolPanel, heikinAshi = false, onHeikinAshiChange, volumeAtPriceEnabled = false, volumeAtPriceKlines, volumeAtPriceBuckets = 20, volumeAtPricePercent = 100, onVolumeAtPricePercentChange, vapTimeSpanLabel = "", volumeAtPriceOpacity = 40, volumeAtPriceWidthPercent = 100, volumeAtPriceSide = "left", volumeAtPriceColorAbove = "#059669", volumeAtPriceColorBelow = "#dc2626", onVolumeAtPriceEnabledChange, onVolumeAtPriceBucketsChange, onVolumeAtPriceOpacityChange, onVolumeAtPriceWidthPercentChange, onVolumeAtPriceSideChange, onVolumeAtPriceColorAboveChange, onVolumeAtPriceColorBelowChange, liveLastClose, onCurrentLayoutLabelChange, isAdmin = false, isFreeUser = false }: KlinesChartProps) {
  const pathname = usePathname();
  const { addLayoutLoadLog, layoutSaveLoadDebugEnabled } = useSistemaDebug();
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines;
  const [visibleCount, setVisibleCountState] = useState<number>(DEFAULT_VISIBLE);
  const setVisibleCount = useCallback((v: number | ((prev: number) => number)) => {
    setVisibleCountState((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      return Math.max(VISIBLE_COUNT_MIN, Math.min(VISIBLE_COUNT_MAX, Math.round(next)));
    });
  }, []);
  const [startIndex, setStartIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [segmentToolboxCollapsed, setSegmentToolboxCollapsed] = useState(false);
  const [segmentToolboxSide, setSegmentToolboxSide] = useState<"left" | "right">("left");
  const [showClearDrawConfirm, setShowClearDrawConfirm] = useState(false);
  const [drawPanelSide, setDrawPanelSide] = useState<"left" | "right">("right");
  /** Posição (px) da caixa de desenho na área do gráfico; null = canto superior direito (right-2 top-2). */
  const [drawToolboxPosition, setDrawToolboxPosition] = useState<{ x: number; y: number } | null>(null);
  const drawToolboxRef = useRef<HTMLDivElement>(null);
  const chartRowRef = useRef<HTMLDivElement>(null);
  const chartYAxisContainerRef = useRef<HTMLDivElement>(null);
  const drawToolboxDragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);
  /** Posição (px) da caixa de opções do segmento; null = canto superior esquerdo (left: 8, top: 8). */
  const [segmentOptionsPosition, setSegmentOptionsPosition] = useState<{ x: number; y: number } | null>(null);
  const segmentOptionsRef = useRef<HTMLDivElement>(null);
  /** Padrões iniciais para novos desenhos (persistidos no localStorage). */
  const [drawDefaults, setDrawDefaults] = useState<DrawDefaults>(BUILTIN_DRAW_DEFAULTS);
  const [savedLayouts, setSavedLayouts] = useState<{ slot: number; config: Record<string, unknown>; name?: string }[]>([]);
  const [savedLayoutsError, setSavedLayoutsError] = useState<string | null>(null);
  const [saveLoadMsg, setSaveLoadMsg] = useState<string | null>(null);
  const [saveSuccessModalOpen, setSaveSuccessModalOpen] = useState(false);
  const [savedLayoutName, setSavedLayoutName] = useState<string | null>(null);
  const [saveConfirmSlot, setSaveConfirmSlot] = useState<number | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [yAxisAbbreviated, setYAxisAbbreviated] = useState(false); // false = 2 decimais (default), true = abreviado
  const [logScale, setLogScale] = useState(false);
  const [showMainAxis, setShowMainAxis] = useState(true);
  const [showSecondaryAxis, setShowSecondaryAxis] = useState(true);
  const [showLastCloseLine, setShowLastCloseLine] = useState(true);
  const [showCandleCountdown, setShowCandleCountdown] = useState(true);
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
  const [chartStyle, setChartStyle] = useState<"candles" | "bars" | "line" | "linePoints" | "area">("candles");
  const [candleBodyStyle, setCandleBodyStyle] = useState<"filled" | "hollow">("filled");
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
  /** Conversão pixel → dados para o crosshair (com snap aos OHLC quando drawMagnetic está ativo). */
  const crosshairPixelToDataRef = useRef<((x: number, yCoord: number) => { index: number; price: number }) | null>(null);
  const crosshairPointRef = useRef(crosshairPoint);
  const crosshairOverlayRef = useRef<SVGRectElement>(null);
  const crosshairOverlayDivRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const colorsRef = useRef<HTMLDivElement>(null);
  const saveLoadRef = useRef<HTMLDivElement>(null);
  const chartSvgRef = useRef<SVGSVGElement>(null);
  const chartDimensionsRef = useRef<{ w: number; h: number; sizePercent?: number }>({ w: 0, h: 0 });
  const candleAreaRef = useRef({ left: MARGIN_LEFT, top: MARGIN_TOP, width: 0, height: 0 });
  /** Evitar gravar segmentos/visibilidade do intervalo anterior na chave do novo ao trocar timeframe (race entre load e persist). */
  const lastPersistedDrawKeyRef = useRef<string>("");
  const lastPersistedVisibleKeyRef = useRef<string>("");

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
    drawPendingRectSecond,
    setDrawPendingRectSecond,
    drawPendingFibSecond,
    setDrawPendingFibSecond,
    drawPendingFreeRetraceSecond,
    setDrawPendingFreeRetraceSecond,
    drawPendingLineSecond,
    setDrawPendingLineSecond,
    drawPendingChannelSecond,
    setDrawPendingChannelSecond,
    drawPendingStopGainSecond,
    setDrawPendingStopGainSecond,
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
    selectFreeRetracementTool,
    selectChannelTool,
    selectStopGainTool,
    selectHorizontalLineTool,
    selectVerticalLineTool,
    selectArrowTool,
    selectTextTool,
    selectRulerTool,
    selectRectangleTool,
    selectSelectTool,
    clearAllDrawing,
    drawPendingHorizontalSecond,
    setDrawPendingHorizontalSecond,
    drawPendingArrow,
    setDrawPendingArrow,
    drawPendingText,
    setDrawPendingText,
    drawPendingPencil,
    setDrawPendingPencil,
    selectPencilTool,
  } = drawing;

  const fullReversed = [...klines].reverse();
  const n = fullReversed.length;

  /** Volume no preço: usa klines do cache (volumeAtPriceKlines) quando fornecido; já vêm com a quantidade certa do fetch. */
  const volumeAtPriceData = useMemo(() => {
    const source = volumeAtPriceKlines?.length ? volumeAtPriceKlines : klines;
    return volumeAtPriceEnabled && source.length > 0
      ? computeVolumeAtPriceBuckets(source as (string | number)[][], volumeAtPriceBuckets)
      : null;
  }, [volumeAtPriceEnabled, volumeAtPriceKlines, klines, volumeAtPriceBuckets]);

  // Sempre abrir a caixa de desenho encostada no canto esquerdo
  useEffect(() => {
    if (!drawOpen) setDrawToolboxPosition(null);
  }, [drawOpen]);

  // Sempre abrir a caixa de opções do segmento encostada no canto esquerdo
  useEffect(() => {
    if (selectedSegmentIndex === null) setSegmentOptionsPosition(null);
  }, [selectedSegmentIndex]);

  // Com a caixa de opções do segmento aberta, desativa a rolagem por toque só na div role="presentation" (área do plot)
  const segmentOptionsOpen = drawMode && selectedSegmentIndex !== null && drawSegments[selectedSegmentIndex] != null;
  useEffect(() => {
    if (!segmentOptionsOpen || !crosshairOverlayDivRef.current) return;
    const el = crosshairOverlayDivRef.current;
    const preventTouchScroll = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", preventTouchScroll, { passive: false });
    return () => el.removeEventListener("touchmove", preventTouchScroll);
  }, [segmentOptionsOpen]);

  // Ao trocar intervalo: loading breve (1 frame) para recarregar segmentos; em seguida voltar a exibir o gráfico
  useEffect(() => {
    setSegmentsApplied(false);
    setChartReady(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setChartReady(true));
    });
    return () => cancelAnimationFrame(id);
  }, [groupMinutes]);

  // Chave de storage por timeframe (símbolo + intervalo) para desenhos e visibilidade
  const drawStorageKey = (symbolProp ? `${String(symbolProp)}|${groupMinutes}` : String(groupMinutes));

  // Carregar segmentos e visibilidade de desenho do localStorage ao mudar o timeframe (símbolo ou intervalo)
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_DRAW_SEGMENTS_KEY) : null;
      if (!raw) {
        setDrawSegments([]);
        setSelectedSegmentIndex(null);
        setDrawPending(null);
      } else {
        const data = JSON.parse(raw) as Record<string, DrawSegment[]>;
        const loaded = Array.isArray(data[drawStorageKey]) ? data[drawStorageKey] : (Array.isArray(data[String(groupMinutes)]) ? data[String(groupMinutes)] : []);
        setDrawSegments(loaded);
        setSelectedSegmentIndex(null);
        setDrawPending(null);
      }
      const visibleRaw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_DRAW_VISIBLE_KEY) : null;
      if (visibleRaw) {
        try {
          const visibleData = JSON.parse(visibleRaw) as Record<string, boolean>;
          if (typeof visibleData[drawStorageKey] === "boolean") setDrawingsVisible(visibleData[drawStorageKey]);
          else if (typeof visibleData[String(groupMinutes)] === "boolean") setDrawingsVisible(visibleData[String(groupMinutes)]);
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
  }, [groupMinutes, symbolProp, drawStorageKey]);

  // Ouvir evento de limpeza de cache de desenhos (ex.: menu mobile "Limpar todo o cache")
  useEffect(() => {
    const handler = () => clearAllDrawing();
    window.addEventListener("backcrypto-drawings-cleared", handler);
    return () => window.removeEventListener("backcrypto-drawings-cleared", handler);
  }, [clearAllDrawing]);

  // Ouvir evento de atualização de um desenho (ex.: exclusão de um item no painel Desenhos)
  useEffect(() => {
    const handler = () => {
      try {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_DRAW_SEGMENTS_KEY) : null;
        if (!raw) {
          setDrawSegments([]);
          setSelectedSegmentIndex(null);
          setDrawPending(null);
          return;
        }
        const data = JSON.parse(raw) as Record<string, DrawSegment[]>;
        const loaded = Array.isArray(data[drawStorageKey]) ? data[drawStorageKey] : [];
        setDrawSegments(loaded);
        setSelectedSegmentIndex(null);
        setDrawPending(null);
      } catch {
        setDrawSegments([]);
        setSelectedSegmentIndex(null);
        setDrawPending(null);
      }
    };
    window.addEventListener("backcrypto-drawings-updated", handler);
    return () => window.removeEventListener("backcrypto-drawings-updated", handler);
  }, [groupMinutes, symbolProp, drawStorageKey]);

  // Editar desenho a partir do menu Desenhos: fecha o painel, seleciona o objeto e leva o gráfico até o candle do primeiro ponto
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ index: number }>;
      const i = ev.detail?.index ?? -1;
      if (i < 0) return;
      const idx = Math.min(i, Math.max(0, drawSegments.length - 1));
      if (idx < 0) return;
      const seg = drawSegments[idx];
      if (seg) {
        const targetCandle = Math.min(seg.index1, seg.index2);
        const newStart = Math.max(0, Math.min(n - visibleCount, targetCandle - Math.floor(visibleCount / 2)));
        setStartIndex(newStart);
      }
      setSelectedSegmentIndex(idx);
      selectSelectTool();
      setDrawOpen(true); // abre a sidebar para mostrar as opções do segmento
    };
    window.addEventListener("backcrypto-drawings-edit", handler);
    return () => window.removeEventListener("backcrypto-drawings-edit", handler);
  }, [drawSegments, n, visibleCount, setSelectedSegmentIndex, selectSelectTool, setDrawOpen]);

  // Carregar padrões de desenho do localStorage (uma vez ao montar)
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_DRAW_DEFAULTS_KEY) : null;
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<DrawDefaults>;
      setDrawDefaults({
        segment: { ...BUILTIN_DRAW_DEFAULTS.segment, ...parsed.segment },
        fibonacci: { ...BUILTIN_DRAW_DEFAULTS.fibonacci, ...parsed.fibonacci },
        freeRetracement: { ...BUILTIN_DRAW_DEFAULTS.freeRetracement, ...parsed.freeRetracement },
        channel: { ...BUILTIN_DRAW_DEFAULTS.channel, ...parsed.channel },
        stopGain: { ...BUILTIN_DRAW_DEFAULTS.stopGain, ...parsed.stopGain },
        rectangle: { ...BUILTIN_DRAW_DEFAULTS.rectangle, ...parsed.rectangle },
        horizontalLine: { ...BUILTIN_DRAW_DEFAULTS.horizontalLine, ...parsed.horizontalLine },
        verticalLine: { ...BUILTIN_DRAW_DEFAULTS.verticalLine, ...parsed.verticalLine },
        arrow: { ...BUILTIN_DRAW_DEFAULTS.arrow, ...parsed.arrow },
        text: { ...BUILTIN_DRAW_DEFAULTS.text, ...parsed.text },
        pencil: { ...BUILTIN_DRAW_DEFAULTS.pencil, ...parsed.pencil },
      });
    } catch {
      /* ignore */
    }
  }, []);

  // Persistir padrões quando o usuário altera opções de um segmento
  const persistDrawDefault = useCallback((type: "segment" | "fibonacci" | "freeRetracement" | "channel" | "stopGain" | "rectangle" | "horizontalLine" | "verticalLine" | "arrow" | "text" | "pencil", partial: Partial<DrawSegment>) => {
    setDrawDefaults((prev) => {
      const next: DrawDefaults = {
        segment: type === "segment" ? { ...prev.segment, ...partial } : prev.segment,
        fibonacci: type === "fibonacci" ? { ...prev.fibonacci, ...partial } : prev.fibonacci,
        freeRetracement: type === "freeRetracement" ? { ...prev.freeRetracement, ...partial } : prev.freeRetracement,
        channel: type === "channel" ? { ...prev.channel, ...partial } : prev.channel,
        stopGain: type === "stopGain" ? { ...prev.stopGain, ...partial } : prev.stopGain,
        rectangle: type === "rectangle" ? { ...prev.rectangle, ...partial } : prev.rectangle,
        horizontalLine: type === "horizontalLine" ? { ...prev.horizontalLine, ...partial } : prev.horizontalLine,
        verticalLine: type === "verticalLine" ? { ...prev.verticalLine, ...partial } : prev.verticalLine,
        arrow: type === "arrow" ? { ...prev.arrow, ...partial } : prev.arrow,
        text: type === "text" ? { ...prev.text, ...partial } : prev.text,
        pencil: type === "pencil" ? { ...prev.pencil, ...partial } : prev.pencil,
      };
      try {
        if (typeof window !== "undefined") window.localStorage.setItem(KLINE_DRAW_DEFAULTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const handleCreateTextSegment = useCallback(
    (textContent: string) => {
      if (!drawPendingText) return;
      const { index1, price1 } = drawPendingText;
      const df = drawDefaults.text;
      const newSeg: DrawSegment = {
        index1,
        price1,
        index2: index1,
        price2: price1,
        type: "text",
        textContent: textContent || " ",
        color: df?.color ?? DEFAULT_DRAW_TEXT_COLOR,
        textBold: df?.textBold ?? false,
        textSize: df?.textSize ?? "small",
      };
      let newIndex = 0;
      flushSync(() => {
        setDrawSegments((prev) => {
          newIndex = prev.length;
          return [...prev, newSeg];
        });
      });
      setDrawPendingText(null);
      setSelectedSegmentIndex(newIndex);
      selectSelectTool();
      setDrawOpen(true);
      setSegmentToolboxCollapsed(false);
    },
    [drawPendingText, drawDefaults.text, setDrawSegments, setDrawPendingText, setSelectedSegmentIndex, selectSelectTool, setDrawOpen, setSegmentToolboxCollapsed]
  );

  // Persistir visibilidade dos desenhos (por timeframe: símbolo + intervalo). Não gravar ao trocar timeframe (estado ainda é o anterior).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (drawStorageKey !== lastPersistedVisibleKeyRef.current) {
      lastPersistedVisibleKeyRef.current = drawStorageKey;
      return;
    }
    try {
      const raw = window.localStorage.getItem(KLINE_DRAW_VISIBLE_KEY);
      const data: Record<string, boolean> = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      data[drawStorageKey] = drawingsVisible;
      window.localStorage.setItem(KLINE_DRAW_VISIBLE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [drawStorageKey, drawingsVisible]);

  // Persistir segmentos só no localStorage ao criar/editar (não dispara save de layout no servidor).
  // Só grava depois do carregamento inicial (segmentsApplied), senão sobrescreve o localStorage com [] no primeiro render.
  // Chave por timeframe (símbolo + intervalo). Ao trocar timeframe, não gravar nesta rodada (drawSegments ainda é do intervalo anterior).
  useEffect(() => {
    if (!segmentsApplied || typeof window === "undefined") return;
    if (drawStorageKey !== lastPersistedDrawKeyRef.current) {
      lastPersistedDrawKeyRef.current = drawStorageKey;
      return;
    }
    try {
      const raw = window.localStorage.getItem(KLINE_DRAW_SEGMENTS_KEY);
      const data: Record<string, DrawSegment[]> = raw ? (JSON.parse(raw) as Record<string, DrawSegment[]>) : {};
      data[drawStorageKey] = drawSegments;
      window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [drawStorageKey, drawSegments, segmentsApplied]);

  const formatYAxis = yAxisAbbreviated ? formatUsdt : formatUsdtTwoDecimals;
  const candleColors = CANDLE_COLOR_PRESETS.find((p) => p.id === candleColorPreset) ?? CANDLE_COLOR_PRESETS[0];

  // Layout default e slots 1–7 vêm somente do banco; não inicializar do localStorage para não interferir.
  // (Antes o default era aplicado de KLINE_PREFS_KEY; agora o default é aplicado no effect do layout via API defaultLayout.)

  // Inicializar quantidade de candles, tipo de gráfico e olho visible do localStorage (última situação do usuário).
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_LOCAL_PREFS_KEY) : null;
      if (!raw) return;
      const data = JSON.parse(raw) as { visibleCount?: number; chartStyle?: string; candleBodyStyle?: string; drawingsVisible?: boolean; chartSizePercent?: number; yPadOffset?: number };
      const vc = typeof data.visibleCount === "number" && data.visibleCount >= VISIBLE_COUNT_MIN && data.visibleCount <= VISIBLE_COUNT_MAX ? Math.round(data.visibleCount) : null;
      if (vc != null) setVisibleCount(vc);
      if (data.chartStyle === "candles" || data.chartStyle === "bars" || data.chartStyle === "line" || data.chartStyle === "linePoints" || data.chartStyle === "area") setChartStyle(data.chartStyle);
      if (data.candleBodyStyle === "filled" || data.candleBodyStyle === "hollow") setCandleBodyStyle(data.candleBodyStyle);
      if (typeof data.drawingsVisible === "boolean") setDrawingsVisible(data.drawingsVisible);
      const csp = typeof data.chartSizePercent === "number" && data.chartSizePercent >= CHART_SIZE_PERCENT_MIN && data.chartSizePercent <= CHART_SIZE_PERCENT_MAX ? Math.round(data.chartSizePercent) : null;
      if (csp != null) setChartSizePercent(csp);
      const ypo = typeof data.yPadOffset === "number" && data.yPadOffset >= Y_PAD_OFFSET_MIN && data.yPadOffset <= Y_PAD_OFFSET_MAX ? Math.round(data.yPadOffset) : null;
      if (ypo != null) setYPadOffset(ypo);
    } catch {
      /* ignore */
    }
  }, []);

  const prefsWriteSkippedRef = useRef(false);
  // Persistir prefs no localStorage só quando o layout ativo for default (slot 0); em slot 1–7 o estado vem do layout no banco.
  // Ignorar a primeira execução para não sobrescrever com valores default antes do restore do localStorage.
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (!prefsWriteSkippedRef.current) {
        prefsWriteSkippedRef.current = true;
        return;
      }
      const layoutRaw = window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY);
      const slotNum = layoutRaw != null && layoutRaw !== "default" && layoutRaw !== "0" ? Number(layoutRaw) : 0;
      if (Number.isInteger(slotNum) && slotNum >= 1 && slotNum <= 7) return;
      window.localStorage.setItem(
        KLINE_PREFS_KEY,
        JSON.stringify({ visibleCount, invisibleCandlesEnd, candleColorPreset, yAxisAbbreviated, logScale, containerBackground, chartBackground, footerYAxisBgColor, backgroundTextColor, footerYAxisTextColor, lineTableColor, secondaryGridColor, showMainAxis, showSecondaryAxis, showLastCloseLine, showCandleCountdown, lastCloseLineColor, lastCloseTextColor, secondaryPanelHeightPercent, volumeOnPrice, volumeOnPriceOpacity, chartSizePercent, yPadOffset, chartStyle, candleBodyStyle })
      );
    } catch {
      /* ignore */
    }
  }, [visibleCount, invisibleCandlesEnd, candleColorPreset, yAxisAbbreviated, logScale, containerBackground, chartBackground, footerYAxisBgColor, backgroundTextColor, footerYAxisTextColor, lineTableColor, secondaryGridColor, showMainAxis, showSecondaryAxis, showLastCloseLine, showCandleCountdown, lastCloseLineColor, lastCloseTextColor, secondaryPanelHeightPercent, volumeOnPrice, volumeOnPriceOpacity, chartSizePercent, yPadOffset, chartStyle, candleBodyStyle]);

  // Persistir prefs locais ao alterar; pular a 1ª execução para não sobrescrever antes do restore do init.
  const localPrefsWriteSkippedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localPrefsWriteSkippedRef.current) {
      localPrefsWriteSkippedRef.current = true;
      return;
    }
    try {
      window.localStorage.setItem(KLINE_LOCAL_PREFS_KEY, JSON.stringify({ visibleCount, chartStyle, candleBodyStyle, drawingsVisible, chartSizePercent, yPadOffset }));
    } catch {
      /* ignore */
    }
  }, [visibleCount, chartStyle, candleBodyStyle, drawingsVisible, chartSizePercent, yPadOffset]);

  // Persistir others no servidor em tempo real (slot 1–7: PATCH; slot 0 e admin: POST chart-models). Debounce 500ms.
  const othersInstantPushSkippedRef = useRef(false);
  const othersPushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!othersInstantPushSkippedRef.current) {
      othersInstantPushSkippedRef.current = true;
      return;
    }
    if (isFreeUser) return;

    const payload = {
      visibleCount,
      chartStyle,
      candleBodyStyle,
      drawingsVisible,
      chartSizePercent,
      yPadOffset,
    };

    if (othersPushTimeoutRef.current) clearTimeout(othersPushTimeoutRef.current);
    othersPushTimeoutRef.current = setTimeout(() => {
      othersPushTimeoutRef.current = null;
      if (Date.now() - layoutAppliedAtRef.current < 2000) return;
      const raw = window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY);
      const slot = raw === "default" || raw === "0" || raw == null ? 0 : Math.min(7, Math.max(1, Number(raw) || 0));

      if (slot >= 1 && slot <= 7) {
        fetch(`${API_BASE}/chart-layouts`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-Tab-Id": getSessionTabId() },
          credentials: "include",
          body: JSON.stringify({ slot, others: payload }),
        }).catch(() => {});
      } else if (slot === 0 && isAdmin) {
        fetch(`${API_BASE}/chart-models`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ slot: 0, others: payload }),
        }).catch(() => {});
      }
    }, 500);

    return () => {
      if (othersPushTimeoutRef.current) {
        clearTimeout(othersPushTimeoutRef.current);
        othersPushTimeoutRef.current = null;
      }
    };
  }, [visibleCount, chartStyle, candleBodyStyle, drawingsVisible, chartSizePercent, yPadOffset, isAdmin, isFreeUser]);

  // Toda vez que entrar na página do gráfico ou trocar símbolo: carregar layout do banco e reaplicar (incluindo estratégias e indicadores).
  const lastLayoutApplyAtRef = useRef<number>(0);
  const LAYOUT_APPLY_DEBOUNCE_MS = 3000;
  const LAYOUT_APPLY_DELAY_MS = 0;

  useEffect(() => {
    lastLayoutApplyAtRef.current = 0;
  }, [symbolProp]);

  // Usuário free: sempre layout default; forçar localStorage e não usar slot 1–7.
  useEffect(() => {
    if (!isFreeUser || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY);
    if (raw !== "default" && raw !== "0") {
      window.localStorage.setItem(KLINE_LAST_LAYOUT_KEY, "default");
      setShowUpgradeModal(true);
    }
  }, [isFreeUser]);

  useEffect(() => {
    if (pathname !== SISTEMA_PATH) return;
    // Só aplicar layout depois do carregamento dos indicadores (klines/gráfico com dados).
    if (klines.length === 0) {
      addLayoutLoadLog(`klines.length=0 → aguardando carregamento dos indicadores`);
      return;
    }
    const now = Date.now();
    if (lastLayoutApplyAtRef.current && now - lastLayoutApplyAtRef.current < LAYOUT_APPLY_DEBOUNCE_MS) {
      addLayoutLoadLog(`skip: layout aplicado há ${Math.round((now - lastLayoutApplyAtRef.current) / 1000)}s`);
      setLayoutApplied(true);
      return;
    }
    addLayoutLoadLog(`pathname=${pathname} → efeito layout rodando`);
    let cancelled = false;
    let applyDelayTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const done = () => {
      if (!cancelled) setLayoutApplied(true);
    };
    let raw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY) : null;
    if (isFreeUser) {
      raw = "default";
      if (typeof window !== "undefined") window.localStorage.setItem(KLINE_LAST_LAYOUT_KEY, "default");
    }
    addLayoutLoadLog(`KLINE_LAST_LAYOUT_KEY raw="${raw ?? "null"}"${isFreeUser ? " (free→default)" : ""}`);
    const timeoutId = setTimeout(done, 2000);
    (async () => {
      let isSlot1to7 = false;
      let useDelay = false;
      try {
        const res = await fetch(`${API_BASE}/chart-layouts`, { credentials: "include", cache: "no-store", headers: { "X-Tab-Id": getSessionTabId() } });
        if (cancelled) {
          addLayoutLoadLog("cancelled (ignorar, não aplicar layout)");
          done();
          return;
        }
        if (!res.ok) {
          addLayoutLoadLog(`fetch !ok ${res.status} (default não aplica)`);
          clearTimeout(timeoutId);
          done();
          return;
        }
        const data = await res.json();
        if (cancelled) {
          addLayoutLoadLog("cancelled após parse (ignorar)");
          done();
          return;
        }
        const layouts = Array.isArray(data.layouts) ? (data.layouts as { slot: number; config: Record<string, unknown>; name?: string }[]) : [];
        const defaultLayout = data.defaultLayout != null && typeof data.defaultLayout === "object" && !Array.isArray(data.defaultLayout)
          ? (data.defaultLayout as Record<string, unknown>)
          : null;
        addLayoutLoadLog(`API ok: layouts slots=[${layouts.map((l) => l.slot).join(",")}], hasDefault=${!!defaultLayout}`);

        const getLayoutLabel = (layout: { slot: number; name?: string }) =>
          layout.name?.trim() || (layout.slot === 0 ? t.defaultLayout : t.layoutName.replace("{n}", String(layout.slot)));

        const markApplied = () => {
          lastLayoutApplyAtRef.current = Date.now();
        };

        // Reaplicação só para layouts 1–7; no default não aplica nada (nem imediatamente nem com delay).
        const slotNum = raw != null && raw !== "default" && raw !== "0" ? Number(raw) : 0;
        isSlot1to7 = Number.isInteger(slotNum) && slotNum >= 1 && slotNum <= 7;
        useDelay = isSlot1to7 && LAYOUT_APPLY_DELAY_MS > 0;

        if (!isSlot1to7) {
          // Default: carregar somente do banco (defaultLayout); storage não interfere.
          const defaultConfig = defaultLayout && typeof defaultLayout === "object" && !Array.isArray(defaultLayout) && defaultLayout.config != null && typeof defaultLayout.config === "object" && !Array.isArray(defaultLayout.config)
            ? (defaultLayout as { config: Record<string, unknown> }).config
            : null;
          if (defaultConfig) {
            addLayoutLoadLog("aplicando layout default do banco");
            applyLayoutConfig(defaultConfig, 0, "api");
            // Criar no localStorage apenas as prefs que ainda não existirem (não sobrescrever).
            try {
              if (typeof window !== "undefined") {
                const cur = window.localStorage.getItem(KLINE_LOCAL_PREFS_KEY);
                const curData = cur ? (JSON.parse(cur) as Record<string, unknown>) : {};
                const vc = typeof defaultConfig.visibleCount === "number" && defaultConfig.visibleCount >= VISIBLE_COUNT_MIN && defaultConfig.visibleCount <= VISIBLE_COUNT_MAX ? Math.round(Number(defaultConfig.visibleCount)) : undefined;
                const cs = (defaultConfig.chartStyle === "candles" || defaultConfig.chartStyle === "bars" || defaultConfig.chartStyle === "line" || defaultConfig.chartStyle === "linePoints" || defaultConfig.chartStyle === "area") ? defaultConfig.chartStyle as string : undefined;
                const cbs = (defaultConfig.candleBodyStyle === "filled" || defaultConfig.candleBodyStyle === "hollow") ? defaultConfig.candleBodyStyle as string : undefined;
                const dv = typeof defaultConfig.drawingsVisible === "boolean" ? defaultConfig.drawingsVisible : undefined;
                const csp = typeof defaultConfig.chartSizePercent === "number" && defaultConfig.chartSizePercent >= CHART_SIZE_PERCENT_MIN && defaultConfig.chartSizePercent <= CHART_SIZE_PERCENT_MAX ? Math.round(Number(defaultConfig.chartSizePercent)) : undefined;
                const ypo = typeof defaultConfig.yPadOffset === "number" && defaultConfig.yPadOffset >= Y_PAD_OFFSET_MIN && defaultConfig.yPadOffset <= Y_PAD_OFFSET_MAX ? Math.round(Number(defaultConfig.yPadOffset)) : undefined;
                if (curData.visibleCount === undefined && vc != null) curData.visibleCount = vc;
                if (curData.chartStyle === undefined && cs != null) curData.chartStyle = cs;
                if (curData.candleBodyStyle === undefined && cbs != null) curData.candleBodyStyle = cbs;
                if (curData.drawingsVisible === undefined && dv !== undefined) curData.drawingsVisible = dv;
                if (curData.chartSizePercent === undefined && csp != null) curData.chartSizePercent = csp;
                if (curData.yPadOffset === undefined && ypo != null) curData.yPadOffset = ypo;
                window.localStorage.setItem(KLINE_LOCAL_PREFS_KEY, JSON.stringify(curData));
              }
            } catch {
              /* ignore */
            }
            markApplied();
          } else {
            addLayoutLoadLog("default/0: sem defaultLayout no banco, não aplica");
          }
          onCurrentLayoutLabelChange?.(t.defaultLayout);
          clearTimeout(timeoutId);
          done();
        } else {
          const runApply = () => {
            if (cancelled) return;
            const layout = layouts.find((l) => l.slot === slotNum);
            if (layout) {
              const applied = Array.isArray((layout.config as Record<string, unknown>).appliedStrategyIds)
                ? (layout.config as Record<string, unknown>).appliedStrategyIds as string[]
                : [];
              addLayoutLoadLog(`aplicando slot ${slotNum}, appliedStrategyIds(${applied.length})=[${applied.slice(0, 5).join(",")}${applied.length > 5 ? "…" : ""}]`);
              applyLayoutConfig(layout.config, layout.slot, "api");
              // Criar no localStorage apenas as prefs que ainda não existirem (não sobrescrever).
              try {
                if (typeof window !== "undefined") {
                  const c = layout.config as Record<string, unknown>;
                  const cur = window.localStorage.getItem(KLINE_LOCAL_PREFS_KEY);
                  const curData = cur ? (JSON.parse(cur) as Record<string, unknown>) : {};
                  const vc = typeof c.visibleCount === "number" && c.visibleCount >= VISIBLE_COUNT_MIN && c.visibleCount <= VISIBLE_COUNT_MAX ? Math.round(Number(c.visibleCount)) : undefined;
                  const cs = (c.chartStyle === "candles" || c.chartStyle === "bars" || c.chartStyle === "line" || c.chartStyle === "linePoints" || c.chartStyle === "area") ? c.chartStyle as string : undefined;
                  const cbs = (c.candleBodyStyle === "filled" || c.candleBodyStyle === "hollow") ? c.candleBodyStyle as string : undefined;
                  const dv = typeof c.drawingsVisible === "boolean" ? c.drawingsVisible : undefined;
                  const csp = typeof c.chartSizePercent === "number" && c.chartSizePercent >= CHART_SIZE_PERCENT_MIN && c.chartSizePercent <= CHART_SIZE_PERCENT_MAX ? Math.round(Number(c.chartSizePercent)) : undefined;
                  const ypo = typeof c.yPadOffset === "number" && c.yPadOffset >= Y_PAD_OFFSET_MIN && c.yPadOffset <= Y_PAD_OFFSET_MAX ? Math.round(Number(c.yPadOffset)) : undefined;
                  if (curData.visibleCount === undefined && vc != null) curData.visibleCount = vc;
                  if (curData.chartStyle === undefined && cs != null) curData.chartStyle = cs;
                  if (curData.candleBodyStyle === undefined && cbs != null) curData.candleBodyStyle = cbs;
                  if (curData.drawingsVisible === undefined && dv !== undefined) curData.drawingsVisible = dv;
                  if (curData.chartSizePercent === undefined && csp != null) curData.chartSizePercent = csp;
                  if (curData.yPadOffset === undefined && ypo != null) curData.yPadOffset = ypo;
                  window.localStorage.setItem(KLINE_LOCAL_PREFS_KEY, JSON.stringify(curData));
                  window.localStorage.setItem(KLINE_LAST_LAYOUT_KEY, String(slotNum));
                }
              } catch {
                /* ignore */
              }
              markApplied();
              onCurrentLayoutLabelChange?.(getLayoutLabel(layout));
            } else {
              addLayoutLoadLog(`slot ${slotNum} não encontrado em layouts, não aplica`);
              onCurrentLayoutLabelChange?.(t.defaultLayout);
            }
            clearTimeout(timeoutId);
            done();
          };

          if (useDelay) {
            addLayoutLoadLog(`aguardando ${LAYOUT_APPLY_DELAY_MS}ms antes de reaplicar layout slot ${slotNum}`);
            applyDelayTimeoutId = setTimeout(runApply, LAYOUT_APPLY_DELAY_MS);
          } else {
            requestAnimationFrame(runApply);
          }
        }
      } catch (e) {
        addLayoutLoadLog(`catch: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        if (isSlot1to7 && !useDelay) {
          clearTimeout(timeoutId);
          done();
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      if (applyDelayTimeoutId != null) clearTimeout(applyDelayTimeoutId);
    };
  }, [pathname, klines.length, symbolProp, addLayoutLoadLog, onCurrentLayoutLabelChange, t.defaultLayout, t.layoutName]);

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

  const [canSaveDefault, setCanSaveDefault] = useState(false);

  const fetchSavedLayouts = useCallback(async () => {
    setSavedLayoutsError(null);
    try {
      const res = await fetch(`${API_BASE}/chart-layouts`, { credentials: "include", cache: "no-store", headers: { "X-Tab-Id": getSessionTabId() } });
      if (!res.ok) {
        setSavedLayoutsError(t.loadError);
        return;
      }
      const data = await res.json();
      const layouts = Array.isArray(data.layouts) ? (data.layouts as { slot: number; config: Record<string, unknown>; name?: string }[]) : [];
      const def = data.defaultLayout;
      const defaultLayout =
        def != null && typeof def === "object" && !Array.isArray(def) && def.config != null
          ? { slot: 0, config: def.config as Record<string, unknown>, name: def.name as string | undefined }
          : null;
      setCanSaveDefault(Boolean(data.canSaveDefault));
      setSavedLayouts(defaultLayout ? [defaultLayout, ...layouts] : layouts);
    } catch {
      setSavedLayoutsError(t.loadError);
    }
  }, [t.loadError]);

  useEffect(() => {
    fetchSavedLayouts();
  }, [fetchSavedLayouts]);

  useEffect(() => {
    if (loadOpen) fetchSavedLayouts();
  }, [loadOpen, fetchSavedLayouts]);

  const getCurrentLayoutConfigRef = useRef<() => Record<string, unknown>>(() => ({}));
  getCurrentLayoutConfigRef.current = () => {
    const baseConfig = { visibleCount, invisibleCandlesEnd, candleColorPreset, yAxisAbbreviated, logScale, containerBackground, chartBackground, footerYAxisBgColor, backgroundTextColor, footerYAxisTextColor, lineTableColor, secondaryGridColor, showMainAxis, showSecondaryAxis, showLastCloseLine, showCandleCountdown, lastCloseLineColor, lastCloseTextColor, secondaryPanelHeightPercent, volumeOnPrice, volumeOnPriceOpacity, chartSizePercent, yPadOffset, chartStyle, candleBodyStyle };
    const extra = getLayoutExtraConfig?.() ?? {};
    return { ...baseConfig, ...extra };
  };
  useEffect(() => {
    const handler = () => {
      window.dispatchEvent(new CustomEvent("chart-layout-config", { detail: getCurrentLayoutConfigRef.current() }));
    };
    window.addEventListener("chart-layout-get-config", handler);
    return () => window.removeEventListener("chart-layout-get-config", handler);
  }, []);

  /** Monta as 3 colunas a partir do estado atual (chart + extra do KlinesTable). Desenhos ficam só no localStorage, não vão no layout do servidor. */
  const buildLayoutColumns = useCallback(() => {
    const baseConfig = { visibleCount, invisibleCandlesEnd, candleColorPreset, yAxisAbbreviated, logScale, containerBackground, chartBackground, footerYAxisBgColor, backgroundTextColor, footerYAxisTextColor, lineTableColor, secondaryGridColor, showMainAxis, showSecondaryAxis, showLastCloseLine, showCandleCountdown, lastCloseLineColor, lastCloseTextColor, secondaryPanelHeightPercent, volumeOnPrice, volumeOnPriceOpacity, chartSizePercent, yPadOffset, chartStyle, candleBodyStyle };
    const extra = getLayoutExtraConfig?.() ?? {} as Record<string, unknown>;
    const layout = {
      ...baseConfig,
      volumeAtPriceEnabled: extra.volumeAtPriceEnabled,
      volumeAtPriceBuckets: extra.volumeAtPriceBuckets,
      volumeAtPricePercent: extra.volumeAtPricePercent,
      volumeAtPriceOpacity: extra.volumeAtPriceOpacity,
      volumeAtPriceWidthPercent: extra.volumeAtPriceWidthPercent,
      volumeAtPriceSide: extra.volumeAtPriceSide,
      volumeAtPriceColorAbove: extra.volumeAtPriceColorAbove,
      volumeAtPriceColorBelow: extra.volumeAtPriceColorBelow,
    };
    const indicators = Array.isArray(extra.userIndicators) ? extra.userIndicators : [];
    const strategiesPayload = {
      strategies: Array.isArray(extra.strategies) ? extra.strategies : [],
      appliedStrategyIds: Array.isArray(extra.appliedStrategyIds) ? extra.appliedStrategyIds : [],
    };
    return { layout, indicators, strategies: strategiesPayload };
  }, [visibleCount, invisibleCandlesEnd, candleColorPreset, yAxisAbbreviated, logScale, containerBackground, chartBackground, footerYAxisBgColor, backgroundTextColor, footerYAxisTextColor, lineTableColor, secondaryGridColor, showMainAxis, showSecondaryAxis, showLastCloseLine, showCandleCountdown, lastCloseLineColor, lastCloseTextColor, secondaryPanelHeightPercent, volumeOnPrice, volumeOnPriceOpacity, chartSizePercent, yPadOffset, chartStyle, candleBodyStyle, getLayoutExtraConfig]);

  /** Chaves do eixo Y (para debug save/load). */
  const LAYOUT_Y_AXIS_KEYS = ["footerYAxisBgColor", "backgroundTextColor", "footerYAxisTextColor"] as const;

  const performSaveLayout = async (slot: number) => {
    setSavedLayoutsError(null);
    if (slot === 0) {
      const baseConfig = { visibleCount, invisibleCandlesEnd, candleColorPreset, yAxisAbbreviated, logScale, containerBackground, chartBackground, footerYAxisBgColor, backgroundTextColor, footerYAxisTextColor, lineTableColor, secondaryGridColor, showMainAxis, showSecondaryAxis, showLastCloseLine, showCandleCountdown, lastCloseLineColor, lastCloseTextColor, secondaryPanelHeightPercent, volumeOnPrice, volumeOnPriceOpacity, chartSizePercent, yPadOffset, chartStyle, candleBodyStyle };
      const extra = getLayoutExtraConfig?.() ?? {};
      const config: Record<string, unknown> = { ...baseConfig, ...extra, strategies: [], userIndicators: [], appliedStrategyIds: [] };
      const res = await fetch(`${API_BASE}/chart-models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slot: 0, config, name: "" }),
      });
      if (res.ok) {
        setSavedLayoutName(t.defaultLayout);
        setSaveSuccessModalOpen(true);
        await fetchSavedLayouts();
      }
      return;
    }
    const { layout, indicators, strategies } = buildLayoutColumns();
    if (layoutSaveLoadDebugEnabled) {
      const yAxisSlice = LAYOUT_Y_AXIS_KEYS.reduce((acc, k) => ({ ...acc, [k]: layout[k], [`${k}_typeof`]: typeof layout[k] }), {} as Record<string, unknown>);
      const msg = `[layout save] slot=${slot} Y axis: ${JSON.stringify(yAxisSlice)}`;
      addLayoutLoadLog(msg);
      if (typeof console !== "undefined") console.log(msg);
    }
    const res = await fetch(`${API_BASE}/chart-layouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tab-Id": getSessionTabId() },
      credentials: "include",
      body: JSON.stringify({ slot, layout, indicators, strategies }),
    });
    if (!res.ok) {
      setSavedLayoutsError((t as Record<string, string>).saveError ?? t.loadError);
      return;
    }
    const label = savedLayouts.find((l) => l.slot === slot)?.name?.trim() || t.layoutName.replace("{n}", String(slot));
    setSavedLayoutName(label);
    setSaveSuccessModalOpen(true);
    await fetchSavedLayouts();
  };

  const getLayoutLabelBySlot = (slot: number) =>
    slot === 0 ? t.defaultLayout : (savedLayouts.find((l) => l.slot === slot)?.name?.trim() || t.layoutName.replace("{n}", String(slot)));

  const handleSaveLayout = (slot: number) => {
    setSaveOpen(false);
    if (isFreeUser) {
      setShowUpgradeModal(true);
      return;
    }
    setSaveConfirmSlot(slot);
  };

  const handleConfirmSaveLayout = async () => {
    const slot = saveConfirmSlot;
    if (slot == null) return;
    setSaveConfirmSlot(null);
    await performSaveLayout(slot);
  };

  const handleRenameLayout = async (
    layout: { slot: number; config: Record<string, unknown>; name?: string },
    newName: string
  ) => {
    const name = newName.trim().slice(0, 24);
    if (layout.slot === 0) {
      const res = await fetch(`${API_BASE}/chart-models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slot: 0, config: layout.config, name: name || "" }),
      });
      if (res.ok) {
        setSavedLayoutName(name || layout.name?.trim() || t.defaultLayout);
        setSaveSuccessModalOpen(true);
        fetchSavedLayouts();
      }
      return;
    }
    const res = await fetch(`${API_BASE}/chart-layouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tab-Id": getSessionTabId() },
      credentials: "include",
      body: JSON.stringify({ slot: layout.slot, config: layout.config, name: name || "" }),
    });
    if (res.ok) {
      setSavedLayoutName(name || layout.name?.trim() || t.layoutName.replace("{n}", String(layout.slot)));
      setSaveSuccessModalOpen(true);
      await fetchSavedLayouts();
    }
  };

  /** Persiste no servidor (slot 1–7). part = só essa coluna; payload = para "indicators" array, para "strategies" { strategies, appliedStrategyIds }. */
  const saveLayoutToServerIfSlot = useCallback(async (part?: "layout" | "indicators" | "strategies", payload?: unknown) => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY) : null;
      if (!raw || raw === "default") return;
      const slot = Number(raw);
      if (!Number.isInteger(slot) || slot < 1 || slot > 7) return;

      if (part) {
        const indicatorsPayload = part === "indicators" && Array.isArray(payload) ? payload : null;
        const strategiesPayload = part === "strategies" && payload != null && typeof payload === "object" && "strategies" in payload && "appliedStrategyIds" in payload ? (payload as { strategies: unknown[]; appliedStrategyIds: string[] }) : null;
        const { layout: layoutCol, indicators: indicatorsCol, strategies: strategiesCol } = buildLayoutColumns();
        const body = part === "layout" ? { slot, layout: layoutCol } : part === "indicators" ? { slot, indicators: indicatorsPayload ?? indicatorsCol } : { slot, strategies: strategiesPayload ?? strategiesCol };
        await fetch(`${API_BASE}/chart-layouts`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-Tab-Id": getSessionTabId() },
          credentials: "include",
          body: JSON.stringify(body),
        }).catch(() => {});
      } else {
        const { layout: layoutCol, indicators: indicatorsCol, strategies: strategiesCol } = buildLayoutColumns();
        await fetch(`${API_BASE}/chart-layouts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Tab-Id": getSessionTabId() },
          credentials: "include",
          body: JSON.stringify({ slot, layout: layoutCol, indicators: indicatorsCol, strategies: strategiesCol }),
        }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }, [buildLayoutColumns]);

  const saveLayoutToServerIfSlotRef = useRef(saveLayoutToServerIfSlot);
  saveLayoutToServerIfSlotRef.current = saveLayoutToServerIfSlot;

  const chartLayoutSave = useChartLayoutSave();
  /** Save manual: ao clicar em "Salvar" ao lado de Volume/Volume no preço; persiste só a coluna layout. */
  const saveVolumePrefsToLayout = useCallback(() => {
    chartLayoutSave?.saveLayoutNow("layout");
  }, [chartLayoutSave]);

  useEffect(() => {
    if (!chartLayoutSave) return;
    chartLayoutSave.registerSaveLayout((part, payload) => saveLayoutToServerIfSlotRef.current?.(part, payload));
    return () => chartLayoutSave.registerSaveLayout(null);
  }, [chartLayoutSave]);

  const onLayoutConfigLoadedRef = useRef(onLayoutConfigLoaded);
  onLayoutConfigLoadedRef.current = onLayoutConfigLoaded;

  const layoutAppliedAtRef = useRef(0);
  const applyLayoutConfig = (c: Record<string, unknown>, slot?: number, source?: "api" | "user-load") => {
    layoutAppliedAtRef.current = Date.now();
    const num = (v: unknown): number | null => (typeof v === "number" && !Number.isNaN(v) ? v : typeof v === "string" ? (Number(v) as number) : null);
    // Preferir localStorage para prefs locais: se já existir valor salvo, não sobrescrever com o do layout.
    let localPrefs: { visibleCount?: number; chartStyle?: string; candleBodyStyle?: string; drawingsVisible?: boolean; chartSizePercent?: number; yPadOffset?: number } = {};
    try {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(KLINE_LOCAL_PREFS_KEY);
        if (raw) localPrefs = JSON.parse(raw) as typeof localPrefs;
      }
    } catch {
      /* ignore */
    }
    const visibleCountVal = num(c.visibleCount);
    const useVisibleCount = localPrefs.visibleCount != null && localPrefs.visibleCount >= VISIBLE_COUNT_MIN && localPrefs.visibleCount <= VISIBLE_COUNT_MAX
      ? Math.round(localPrefs.visibleCount)
      : (visibleCountVal != null && visibleCountVal >= VISIBLE_COUNT_MIN && visibleCountVal <= VISIBLE_COUNT_MAX ? Math.round(visibleCountVal) : null);
    if (useVisibleCount != null) setVisibleCount(useVisibleCount);
    if (typeof c.candleColorPreset === "string") {
      const id = (c.candleColorPreset === "redGreen" ? "greenRed" : c.candleColorPreset === "whiteBlack" ? "blackWhite" : c.candleColorPreset) as CandleColorPresetId;
      if (CANDLE_COLOR_PRESETS.some((p) => p.id === id)) setCandleColorPreset(id);
    }
    if (typeof c.yAxisAbbreviated === "boolean") setYAxisAbbreviated(c.yAxisAbbreviated);
    if (typeof c.logScale === "boolean") setLogScale(c.logScale);
    const containerBg = num(c.containerBackground);
    if (containerBg != null && BACKGROUND_PALETTE.some((b) => b.id === containerBg)) setContainerBackground(containerBg as BackgroundId);
    const chartBg = num(c.chartBackground);
    if (chartBg != null && BACKGROUND_PALETTE.some((b) => b.id === chartBg)) setChartBackground(chartBg as BackgroundId);
    const footerYAxisBg = num(c.footerYAxisBgColor);
    if (footerYAxisBg != null && BACKGROUND_PALETTE.some((b) => b.id === footerYAxisBg)) setFooterYAxisBgColor(footerYAxisBg as BackgroundId);
    const backgroundText = num(c.backgroundTextColor);
    if (backgroundText != null && TEXT_PALETTE.some((b) => b.id === backgroundText)) setBackgroundTextColor(backgroundText as TextColorId);
    const footerYAxisText = num(c.footerYAxisTextColor);
    if (footerYAxisText != null && TEXT_PALETTE.some((b) => b.id === footerYAxisText)) setFooterYAxisTextColor(footerYAxisText as TextColorId);
    const lineTable = num(c.lineTableColor);
    if (lineTable != null && LINE_GRID_PALETTE.some((b) => b.id === lineTable)) setLineTableColor(lineTable as LineGridId);
    const secondaryGrid = num(c.secondaryGridColor);
    if (secondaryGrid != null && LINE_GRID_PALETTE.some((b) => b.id === secondaryGrid)) setSecondaryGridColor(secondaryGrid as LineGridId);
    if (typeof c.showMainAxis === "boolean") setShowMainAxis(c.showMainAxis);
    if (typeof c.showSecondaryAxis === "boolean") setShowSecondaryAxis(c.showSecondaryAxis);
    if (typeof c.showLastCloseLine === "boolean") setShowLastCloseLine(c.showLastCloseLine);
    if (typeof c.showCandleCountdown === "boolean") setShowCandleCountdown(c.showCandleCountdown);
    const lastCloseLine = num(c.lastCloseLineColor);
    if (lastCloseLine != null && LINE_GRID_PALETTE.some((b) => b.id === lastCloseLine)) setLastCloseLineColor(lastCloseLine as LineGridId);
    const lastCloseText = num(c.lastCloseTextColor);
    if (lastCloseText != null && LINE_GRID_PALETTE.some((b) => b.id === lastCloseText)) setLastCloseTextColor(lastCloseText as LineGridId);
    const invisibleEnd = num(c.invisibleCandlesEnd);
    if (invisibleEnd != null && invisibleEnd >= 0 && invisibleEnd <= 50) setInvisibleCandlesEnd(invisibleEnd);
    const secondaryPanelH = num(c.secondaryPanelHeightPercent);
    if (secondaryPanelH != null && secondaryPanelH >= SECONDARY_PANEL_HEIGHT_MIN && secondaryPanelH <= SECONDARY_PANEL_HEIGHT_MAX) setSecondaryPanelHeightPercent(Math.round(secondaryPanelH));
    if (typeof c.volumeOnPrice === "boolean") setVolumeOnPrice(c.volumeOnPrice);
    const volOpacity = num(c.volumeOnPriceOpacity);
    if (volOpacity != null && volOpacity >= 0 && volOpacity <= 30) setVolumeOnPriceOpacity(Math.round(volOpacity));
    const chartSizeVal = num(c.chartSizePercent);
    const useChartSize = localPrefs.chartSizePercent != null && localPrefs.chartSizePercent >= CHART_SIZE_PERCENT_MIN && localPrefs.chartSizePercent <= CHART_SIZE_PERCENT_MAX
      ? Math.round(localPrefs.chartSizePercent)
      : (chartSizeVal != null && chartSizeVal >= CHART_SIZE_PERCENT_MIN && chartSizeVal <= CHART_SIZE_PERCENT_MAX ? Math.round(chartSizeVal) : null);
    if (useChartSize != null) setChartSizePercent(useChartSize);
    const yPadVal = num(c.yPadOffset);
    const useYPad = localPrefs.yPadOffset != null && localPrefs.yPadOffset >= Y_PAD_OFFSET_MIN && localPrefs.yPadOffset <= Y_PAD_OFFSET_MAX
      ? Math.round(localPrefs.yPadOffset)
      : (yPadVal != null && yPadVal >= Y_PAD_OFFSET_MIN && yPadVal <= Y_PAD_OFFSET_MAX ? Math.round(yPadVal) : null);
    if (useYPad != null) setYPadOffset(useYPad);
    const chartStyleVal = (c.chartStyle === "candles" || c.chartStyle === "bars" || c.chartStyle === "line" || c.chartStyle === "linePoints" || c.chartStyle === "area") ? c.chartStyle as "candles" | "bars" | "line" | "linePoints" | "area" : null;
    const useChartStyle = (localPrefs.chartStyle === "candles" || localPrefs.chartStyle === "bars" || localPrefs.chartStyle === "line" || localPrefs.chartStyle === "linePoints" || localPrefs.chartStyle === "area") ? localPrefs.chartStyle as "candles" | "bars" | "line" | "linePoints" | "area" : chartStyleVal;
    if (useChartStyle != null) setChartStyle(useChartStyle);
    const candleBodyVal = (c.candleBodyStyle === "filled" || c.candleBodyStyle === "hollow") ? c.candleBodyStyle as "filled" | "hollow" : null;
    const useCandleBody = (localPrefs.candleBodyStyle === "filled" || localPrefs.candleBodyStyle === "hollow") ? localPrefs.candleBodyStyle as "filled" | "hollow" : candleBodyVal;
    if (useCandleBody != null) setCandleBodyStyle(useCandleBody);
    if (typeof localPrefs.drawingsVisible === "boolean") setDrawingsVisible(localPrefs.drawingsVisible);
    else if (typeof c.drawingsVisible === "boolean") setDrawingsVisible(c.drawingsVisible);
    onLayoutConfigLoadedRef.current?.(c, slot, source);
  };

  const getLayoutLabel = (layout: { slot: number; name?: string }) =>
    layout.name?.trim() || (layout.slot === 0 ? t.defaultLayout : t.layoutName.replace("{n}", String(layout.slot)));

  const handleLoadLayout = (layout: { slot: number; config: Record<string, unknown>; name?: string }) => {
    setLoadOpen(false);
    // Free user pode carregar modelo default (slot 0); só bloquear slots 1–7
    if (isFreeUser && layout.slot >= 1) {
      setShowUpgradeModal(true);
      return;
    }
    if (layoutSaveLoadDebugEnabled) {
      const yAxisSlice = LAYOUT_Y_AXIS_KEYS.reduce((acc, k) => ({ ...acc, [k]: layout.config[k], [`${k}_typeof`]: typeof layout.config[k] }), {} as Record<string, unknown>);
      const msg = `[layout load] slot=${layout.slot} Y axis: ${JSON.stringify(yAxisSlice)}`;
      addLayoutLoadLog(msg);
      if (typeof console !== "undefined") console.log(msg);
    }
    applyLayoutConfig(layout.config, layout.slot, "user-load");
    onCurrentLayoutLabelChange?.(getLayoutLabel(layout));
    try {
      if (typeof window !== "undefined") {
        const c = layout.config;
        const cur = window.localStorage.getItem(KLINE_LOCAL_PREFS_KEY);
        const curData = cur ? (JSON.parse(cur) as Record<string, unknown>) : {};
        const vc = typeof c.visibleCount === "number" && c.visibleCount >= VISIBLE_COUNT_MIN && c.visibleCount <= VISIBLE_COUNT_MAX ? Math.round(Number(c.visibleCount)) : undefined;
        const cs = (c.chartStyle === "candles" || c.chartStyle === "bars" || c.chartStyle === "line" || c.chartStyle === "linePoints" || c.chartStyle === "area") ? c.chartStyle as string : undefined;
        const cbs = (c.candleBodyStyle === "filled" || c.candleBodyStyle === "hollow") ? c.candleBodyStyle as string : undefined;
        const dv = typeof c.drawingsVisible === "boolean" ? c.drawingsVisible : undefined;
        const csp = typeof c.chartSizePercent === "number" && c.chartSizePercent >= CHART_SIZE_PERCENT_MIN && c.chartSizePercent <= CHART_SIZE_PERCENT_MAX ? Math.round(Number(c.chartSizePercent)) : undefined;
        const ypo = typeof c.yPadOffset === "number" && c.yPadOffset >= Y_PAD_OFFSET_MIN && c.yPadOffset <= Y_PAD_OFFSET_MAX ? Math.round(Number(c.yPadOffset)) : undefined;
        if (curData.visibleCount === undefined && vc != null) curData.visibleCount = vc;
        if (curData.chartStyle === undefined && cs != null) curData.chartStyle = cs;
        if (curData.candleBodyStyle === undefined && cbs != null) curData.candleBodyStyle = cbs;
        if (curData.drawingsVisible === undefined && dv !== undefined) curData.drawingsVisible = dv;
        if (curData.chartSizePercent === undefined && csp != null) curData.chartSizePercent = csp;
        if (curData.yPadOffset === undefined && ypo != null) curData.yPadOffset = ypo;
        window.localStorage.setItem(KLINE_LOCAL_PREFS_KEY, JSON.stringify(curData));
        window.localStorage.setItem(KLINE_LAST_LAYOUT_KEY, layout.slot === 0 ? "default" : String(layout.slot));
      }
    } catch {
      /* ignore */
    }
  };

  // Ao mudar visibleCount (+/-, listbox) ou n: sempre mostrar os últimos candles
  useEffect(() => {
    setStartIndex(Math.max(0, n - visibleCount));
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

  const exitRulerToCrosshair = useCallback(() => {
    closeDrawMode();
    setDrawPending(null);
    setDrawPendingLineSecond(null);
  }, [closeDrawMode, setDrawPending, setDrawPendingLineSecond]);

  const toggleRuler = useCallback(() => {
    if (drawMode && drawTool === "ruler") {
      exitRulerToCrosshair();
    } else {
      selectRulerTool();
    }
  }, [drawMode, drawTool, exitRulerToCrosshair, selectRulerTool]);

  // Clique fora da área dos candles: desativa a régua (volta ao crosshair)
  useEffect(() => {
    if (drawTool !== "ruler" || !drawMode) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest?.("[data-ruler-toggle]")) return;
      const svg = chartSvgRef.current;
      const area = candleAreaRef.current;
      if (!svg) {
        exitRulerToCrosshair();
        return;
      }
      if (!svg.contains(target as Node)) {
        exitRulerToCrosshair();
        return;
      }
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const svgPt = pt.matrixTransform(ctm.inverse());
      if (area.width > 0 && area.height > 0 && (svgPt.x < area.left || svgPt.x > area.left + area.width || svgPt.y < area.top || svgPt.y > area.top + area.height)) {
        exitRulerToCrosshair();
      }
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [drawTool, drawMode, exitRulerToCrosshair]);

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
    (ind.panel as "main" | "panel2" | "panel3" | "panel4" | "panel5") ?? (ind.type === "RSI" || ind.type === "MFI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "ATR" || ind.type === "ADX" || ind.type === "Volume" ? "panel2" : "main");
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

  /** Escala dos textos (indicadores e eixo Y): reduz quando o plot está reduzido; aumento global (~25%). */
  const textScale = Math.min(1.15, Math.max(0.7, Math.min(1, displayPlotWidth / maxPlotWidth)) * 1.25);

  const is2hOrAbove = groupMinutes >= 120;
  const chartW = displayPlotWidth - MARGIN_LEFT - gapPlotYAxisScaled;
  candleAreaRef.current = { left: MARGIN_LEFT, top: MARGIN_TOP, width: chartW, height: chartH };
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
      lines.every((ind) => (ind.type === "RSI" && ind.rsiFixedScale !== false) || (ind.type === "MFI" && ind.mfiFixedScale !== false) || ind.type === "Stochastic" || (ind.type === "ADX" && ind.adxFixedScale !== false));
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
    if (lines.some((ind) => (ind.type === "RSI") || (ind.type === "Stochastic") || (ind.type === "ADX" && ind.adxFixedScale !== false))) {
      min = Math.min(min, 0);
      max = Math.max(max, 100);
    }
    if (lines.some((ind) => ind.type === "WilliamsR")) {
      min = Math.min(min, -100);
      max = Math.max(max, 0);
    }
    if (lines.some((ind) => ind.type === "CCI")) {
      min = Math.min(min, -100);
      max = Math.max(max, 100);
    }
    if (lines.some((ind) => ind.type === "CMF" && ind.cmfFixedScale)) {
      min = Math.min(min, -1);
      max = Math.max(max, 1);
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
    const cols =
      ind.type === "Bollinger" || ind.type === "Donchian"
        ? [col, col + 1, col + 2]
        : ind.type === "Ichimoku"
          ? [col, col + 1, col + 2, col + 3]
          : [col];
    for (let i = 0; i < windowSlice.length; i++) {
      for (const c of cols) {
        const v = windowSlice[i][c];
        if (v != null && typeof v === "number" && Number.isFinite(v)) priceExtents.push(v);
      }
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
  crosshairPixelToDataRef.current = snapToCandlePoint;

  const yTickValues: number[] = [];
  for (let i = 0; i <= numIntervals; i++) {
    const v = yMin + (yRange * i) / numIntervals;
    yTickValues.push(Math.round(v * 10) / 10);
  }

  // Data no subeixo: por dia (mudança de data) ou, no diário/semanal, a cada 7 candles
  const isDailyOrWeekly = groupMinutes === 1440 || groupMinutes === 10080;
  const dateBreaks: { index: number; dateStr: string; openTime?: number }[] = [];
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
  for (let i = anchorIndex + verticalEvery; i < totalSlots; i += verticalEvery) verticalIndices.push(i);
  verticalIndices.sort((a, b) => a - b);
  const verticalIndicesFiltered = [...new Set(verticalIndices)].filter((i) => i >= 0 && i < totalSlots);

  // Quebras de data no futuro (velas invisíveis) para desenhar a grade vertical de dias
  if (invisibleCandlesEnd > 0 && windowN > 0) {
    const lastOpenTime = Number(windowSlice[windowN - 1][0]);
    const intervalMs = groupMinutes * 60 * 1000;
    if (Number.isFinite(lastOpenTime) && Number.isFinite(intervalMs)) {
      for (let i = windowN; i < totalSlots; i += verticalEvery) {
        const fakeOpenTime = lastOpenTime + (i - windowN + 1) * intervalMs;
        dateBreaks.push({ index: i, dateStr: formatDateLabel(fakeOpenTime), openTime: fakeOpenTime });
      }
    }
  }

  // Evitar sobreposição de datas: só mostrar data se distância da última exibida for >= minGapCandles
  const minGapCandlesForDate = 10;
  const dateBreaksFiltered: { index: number; dateStr: string; openTime?: number }[] = [];
  for (const b of dateBreaks) {
    if (dateBreaksFiltered.length === 0 || b.index - dateBreaksFiltered[dateBreaksFiltered.length - 1].index >= minGapCandlesForDate) {
      dateBreaksFiltered.push({ index: b.index, dateStr: b.dateStr, openTime: b.openTime });
    }
  }

  // Dia (dd) em cada quebra de data (usado em 2h+ linha 1; 1h usa em linha 2)
  const dayBreaksFiltered: { index: number; label: string; openTime?: number }[] = [];
  for (const b of dateBreaksFiltered) {
    const openTime = b.openTime ?? (b.index < windowN ? (windowSlice[b.index][0] as number) : undefined);
    const label = openTime != null ? formatDayOnly(openTime) : "";
    dayBreaksFiltered.push({ index: b.index, label, openTime });
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

  const canPrev = startIndex > 0;
  const canNext = startIndex + visibleCount < n;

  // Último fechamento: preferir preço ao vivo (evita mostrar BTC após trocar para ETH quando klines[0] ainda é do par anterior)
  const lastClose =
    liveLastClose != null && Number.isFinite(parseNum(liveLastClose))
      ? parseNum(liveLastClose)
      : (n > 0 ? parseNum(klines[0][4]) : 0);
  const lastCloseY = y(lastClose);
  const lastCloseInVisibleRange =
    lastClose >= yMin && lastClose <= yMax;
  const showLastClose = lastClose > 0 && lastCloseInVisibleRange;
  const rawOpenTime = n > 0 ? klines[0][0] : null;
  const openTimeMs = rawOpenTime != null ? (typeof rawOpenTime === "number" ? rawOpenTime : Number(rawOpenTime)) : null;
  const offsetMs = timezoneOffset * 60 * 60 * 1000;
  const validCloseTimeMs =
    openTimeMs != null && Number.isFinite(openTimeMs)
      ? (openTimeMs - offsetMs) + groupMinutes * 60 * 1000
      : null;

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

  // Na página do sistema: esconder o gráfico até o layout do banco ser aplicado (evita flash com estado inicial errado)
  if (pathname === SISTEMA_PATH && !layoutApplied) {
    return (
      <div
        className="rounded-lg border border-zinc-200 overflow-hidden flex flex-col flex-shrink-0 w-fit animate-pulse"
        style={{ minWidth: totalChartWidth, minHeight: chartHeight, backgroundColor: "#e4e4e7" }}
        aria-busy="true"
        aria-label={t.loading.replace("{interval}", intervalLabel ?? "")}
      />
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
            onIntervalChange={onIntervalChange ?? (() => { })}
            heikinAshi={heikinAshi}
            onHeikinAshiChange={onHeikinAshiChange}
            chartStyle={chartStyle}
            onChartStyleChange={setChartStyle}
            candleBodyStyle={candleBodyStyle}
            onCandleBodyStyleChange={setCandleBodyStyle}
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
            showCandleCountdown={showCandleCountdown}
            setShowCandleCountdown={setShowCandleCountdown}
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
            volumeAtPriceData={volumeAtPriceData}
            volumeAtPriceEnabled={volumeAtPriceEnabled}
            volumeAtPriceBuckets={volumeAtPriceBuckets}
            volumeAtPricePercent={volumeAtPricePercent}
            onVolumeAtPricePercentChange={onVolumeAtPricePercentChange}
            vapTimeSpanLabel={vapTimeSpanLabel}
            volumeAtPriceOpacity={volumeAtPriceOpacity}
            volumeAtPriceWidthPercent={volumeAtPriceWidthPercent}
            onVolumeAtPriceWidthPercentChange={onVolumeAtPriceWidthPercentChange}
            onVolumeAtPriceEnabledChange={onVolumeAtPriceEnabledChange}
            onVolumeAtPriceBucketsChange={onVolumeAtPriceBucketsChange}
            onVolumeAtPriceOpacityChange={onVolumeAtPriceOpacityChange}
            volumeAtPriceSide={volumeAtPriceSide}
            volumeAtPriceColorAbove={volumeAtPriceColorAbove}
            volumeAtPriceColorBelow={volumeAtPriceColorBelow}
            onVolumeAtPriceSideChange={onVolumeAtPriceSideChange}
            onVolumeAtPriceColorAboveChange={onVolumeAtPriceColorAboveChange}
            onVolumeAtPriceColorBelowChange={onVolumeAtPriceColorBelowChange}
            onSaveVolumePrefsToLayout={saveVolumePrefsToLayout}
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
            selectFreeRetracementTool={selectFreeRetracementTool}
            selectChannelTool={selectChannelTool}
            selectStopGainTool={selectStopGainTool}
            selectRectangleTool={selectRectangleTool}
            selectVerticalLineTool={selectVerticalLineTool}
            selectTextTool={selectTextTool}
            selectArrowTool={selectArrowTool}
            selectHorizontalLineTool={selectHorizontalLineTool}
            selectPencilTool={selectPencilTool}
            exitRulerToCrosshair={exitRulerToCrosshair}
            toggleRuler={toggleRuler}
            selectSelectTool={selectSelectTool}
            clearAllDrawing={clearAllDrawing}
            saveOpen={saveOpen}
            setSaveOpen={setSaveOpen}
            loadOpen={loadOpen}
            setLoadOpen={setLoadOpen}
            savedLayouts={savedLayouts}
            savedLayoutsError={savedLayoutsError}
            canSaveDefault={canSaveDefault}
            canRenameChartModels={isAdmin}
            onSaveLayout={handleSaveLayout}
            onLoadLayout={handleLoadLayout}
            onRenameLayout={handleRenameLayout}
            onFetchSavedLayouts={fetchSavedLayouts}
            isFreeUser={isFreeUser}
            onUpgradeRequest={() => setShowUpgradeModal(true)}
          />
        </div>
        <div className="flex flex-col flex-shrink-0 min-w-0" style={{ touchAction: drawTool === "rectangle" || drawTool === "fibonacci" || drawTool === "freeRetracement" || drawTool === "line" || drawTool === "channel" || drawTool === "stopGain" || drawTool === "horizontalLine" || drawTool === "verticalLine" || drawTool === "arrow" || drawTool === "text" || drawTool === "ruler" || drawTool === "pencil" ? "none" : "pan-x pan-y" }}>
          <div ref={chartRowRef} className="flex flex-shrink-0 flex-row relative" style={{ backgroundColor: containerBgHex }}>
            {drawOpen && (
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
                <div className="flex flex-col min-h-0 max-h-[min(70vh,400px)]">
                  <div className="grid grid-cols-2 gap-0.5 overflow-y-auto py-0.5">
                    <button
                      type="button"
                      onClick={selectLineTool}
                      title={t.lineSegment}
                      className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "line" ? "bg-zinc-100" : ""}`}
                      aria-label={t.lineSegment}
                    >
                      <img src={`${ASSET_PREFIX}/assets/draw/trend.webp`} alt="" className="w-6 h-6 object-contain pointer-events-none" />
                    </button>
                    <button
                      type="button"
                      onClick={selectHorizontalLineTool}
                      title={(t as Record<string, string>).horizontalLine ?? "Horizontal line"}
                      className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "horizontalLine" ? "bg-zinc-100" : ""}`}
                      aria-label={(t as Record<string, string>).horizontalLine ?? "Horizontal line"}
                    >
                      <span aria-hidden>―</span>
                    </button>
                    <button
                      type="button"
                      onClick={selectFibonacciTool}
                      title={(t as Record<string, string>).fibonacciRetracement ?? "Fibonacci retracement"}
                      className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "fibonacci" ? "bg-zinc-100" : ""}`}
                      aria-label={(t as Record<string, string>).fibonacciRetracement ?? "Fibonacci retracement"}
                    >
                      <img src={`${ASSET_PREFIX}/assets/draw/fibonacci.webp`} alt="" className="w-6 h-6 object-contain pointer-events-none" />
                    </button>
                    <button
                      type="button"
                      onClick={selectFreeRetracementTool}
                      title={(t as Record<string, string>).freeRetracement ?? "Retração livre"}
                      className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "freeRetracement" ? "bg-zinc-100" : ""}`}
                      aria-label={(t as Record<string, string>).freeRetracement ?? "Retração livre"}
                    >
                      <img src={`${ASSET_PREFIX}/assets/draw/retracao.webp`} alt="" className="w-6 h-6 object-contain pointer-events-none" />
                    </button>
                    <button
                      type="button"
                      onClick={selectRectangleTool}
                      title={(t as Record<string, string>).rectangleTool ?? "Rectangle"}
                      className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "rectangle" ? "bg-zinc-100" : ""}`}
                      aria-label={(t as Record<string, string>).rectangleTool ?? "Rectangle"}
                    >
                      <img src={`${ASSET_PREFIX}/assets/draw/retangulo.webp`} alt="" className="w-6 h-6 object-contain pointer-events-none" />
                    </button>
                    <button
                      type="button"
                      onClick={selectChannelTool}
                      title={(t as Record<string, string>).channelTool ?? "Channel"}
                      className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "channel" ? "bg-zinc-100" : ""}`}
                      aria-label={(t as Record<string, string>).channelTool ?? "Channel"}
                    >
                      <img src={`${ASSET_PREFIX}/assets/draw/canal.webp`} alt="" className="w-6 h-6 object-contain pointer-events-none" />
                    </button>
                    <button
                      type="button"
                      onClick={selectStopGainTool}
                      title={(t as Record<string, string>).stopGainTool ?? "Stop/Gain"}
                      className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "stopGain" ? "bg-zinc-100" : ""}`}
                      aria-label={(t as Record<string, string>).stopGainTool ?? "Stop/Gain"}
                    >
                      <img src={`${ASSET_PREFIX}/assets/draw/stopgain.webp`} alt="" className="w-6 h-6 object-contain pointer-events-none" />
                    </button>
                    <button
                      type="button"
                      onClick={selectVerticalLineTool}
                      title={(t as Record<string, string>).verticalLine ?? "Vertical line"}
                      className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "verticalLine" ? "bg-zinc-100" : ""}`}
                      aria-label={(t as Record<string, string>).verticalLine ?? "Vertical line"}
                    >
                      <span aria-hidden>|</span>
                    </button>
                    <button
                      type="button"
                      onClick={selectTextTool}
                      title={(t as Record<string, string>).drawTextTool ?? "Text"}
                      className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "text" ? "bg-zinc-100" : ""}`}
                      aria-label={(t as Record<string, string>).drawTextTool ?? "Text"}
                    >
                      <img src={`${ASSET_PREFIX}/assets/draw/text.webp`} alt="" className="w-6 h-6 object-contain pointer-events-none" />
                    </button>
                    <button
                      type="button"
                      onClick={selectArrowTool}
                      title={(t as Record<string, string>).arrowTool ?? "Arrow"}
                      className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "arrow" ? "bg-zinc-100" : ""}`}
                      aria-label={(t as Record<string, string>).arrowTool ?? "Arrow"}
                    >
                      <img src={`${ASSET_PREFIX}/assets/draw/seta.webp`} alt="" className="w-6 h-6 object-contain pointer-events-none" />
                    </button>
                    <button
                      type="button"
                      onClick={selectPencilTool}
                      title={(t as Record<string, string>).pencilTool ?? "Lápis"}
                      className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 shrink-0 ${drawTool === "pencil" ? "bg-zinc-100" : ""}`}
                      aria-label={(t as Record<string, string>).pencilTool ?? "Lápis"}
                    >
                      <span aria-hidden className="text-lg leading-none">✎</span>
                    </button>
                  </div>
                  <div className="flex justify-center border-t border-zinc-100 pt-0.5 mt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowClearDrawConfirm(true)}
                      title={t.drawClearAll}
                      className="flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 text-zinc-700 shrink-0"
                      aria-label={t.drawClearAll}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )}
            {showClearDrawConfirm && (
              <div className="absolute inset-0 z-[200] flex items-center justify-center">
                <div
                  className="absolute inset-0 bg-black/30"
                  aria-hidden
                  onClick={() => setShowClearDrawConfirm(false)}
                />
                <div
                  className="relative z-[201] w-[min(320px,90vw)] rounded-xl border border-zinc-200 bg-white p-4 shadow-xl"
                  role="alertdialog"
                  aria-labelledby="clear-draw-confirm-title"
                  aria-describedby="clear-draw-confirm-desc"
                >
                  <h3 id="clear-draw-confirm-title" className="text-sm font-semibold text-zinc-800 mb-2">
                    {t.drawClearAll}
                  </h3>
                  <p id="clear-draw-confirm-desc" className="text-sm text-zinc-600 mb-4">
                    {((t as Record<string, string>).clearDrawingsConfirmMessageTimeframe ?? "Delete all drawings for {interval}? This action cannot be undone.").replace(
                      "{interval}",
                      intervalLabel ?? (groupMinutes < 60 ? `${groupMinutes}m` : groupMinutes === 60 ? "1h" : groupMinutes < 1440 ? `${groupMinutes / 60}h` : groupMinutes === 1440 ? "1d" : groupMinutes === 10080 ? "1w" : `${groupMinutes}m`)
                    )}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowClearDrawConfirm(false)}
                      className="px-3 py-2 text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-100 rounded-lg border border-zinc-300"
                    >
                      {(t as Record<string, string>).clearDrawingsConfirmNo ?? "No"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearAllDrawing();
                        setShowClearDrawConfirm(false);
                      }}
                      className="px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                    >
                      {(t as Record<string, string>).clearDrawingsConfirmYes ?? "Yes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {drawMode && selectedSegmentIndex !== null && drawSegments[selectedSegmentIndex] && (
              <KlinesChartSegmentOptions
                segmentOptionsRef={segmentOptionsRef}
                segmentOptionsPosition={segmentOptionsPosition}
                setSegmentOptionsPosition={setSegmentOptionsPosition}
                chartRowRef={chartRowRef}
                drawSegments={drawSegments}
                selectedSegmentIndex={selectedSegmentIndex}
                setDrawSegments={setDrawSegments}
                setSelectedSegmentIndex={setSelectedSegmentIndex}
                persistDrawDefault={persistDrawDefault}
                segmentToPixel={segmentToPixel}
                pixelToData={pixelToData}
                t={t}
                segmentToolboxCollapsed={segmentToolboxCollapsed}
              />
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
              chartStyle={chartStyle}
              candleBodyStyle={candleBodyStyle}
              y={y}
              cx={cx}
              segmentToPixel={segmentToPixel}
              snapToCandlePoint={snapToCandlePoint}
              windowSlice={windowSlice}
              fullReversed={fullReversed}
              startIndex={startIndex}
              windowN={windowN}
              totalSlots={totalSlots}
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
              volumeAtPriceData={volumeAtPriceData}
              volumeAtPriceOpacity={volumeAtPriceOpacity}
              volumeAtPriceWidthPercent={volumeAtPriceWidthPercent}
              volumeAtPriceSide={volumeAtPriceSide}
              volumeAtPriceColorAbove={volumeAtPriceColorAbove}
              volumeAtPriceColorBelow={volumeAtPriceColorBelow}
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
              drawPendingRectSecond={drawPendingRectSecond}
              setDrawPendingRectSecond={setDrawPendingRectSecond}
              drawPendingFibSecond={drawPendingFibSecond}
              setDrawPendingFibSecond={setDrawPendingFibSecond}
              drawPendingFreeRetraceSecond={drawPendingFreeRetraceSecond}
              setDrawPendingFreeRetraceSecond={setDrawPendingFreeRetraceSecond}
              drawPendingLineSecond={drawPendingLineSecond}
              setDrawPendingLineSecond={setDrawPendingLineSecond}
              drawPendingChannelSecond={drawPendingChannelSecond}
              setDrawPendingChannelSecond={setDrawPendingChannelSecond}
              drawPendingStopGainSecond={drawPendingStopGainSecond}
              setDrawPendingStopGainSecond={setDrawPendingStopGainSecond}
              drawPendingHorizontalSecond={drawPendingHorizontalSecond}
              setDrawPendingHorizontalSecond={setDrawPendingHorizontalSecond}
              drawPendingArrow={drawPendingArrow}
              setDrawPendingArrow={setDrawPendingArrow}
              drawPendingText={drawPendingText}
              setDrawPendingText={setDrawPendingText}
              drawPendingPencil={drawPendingPencil}
              setDrawPendingPencil={setDrawPendingPencil}
              onCreateTextSegment={handleCreateTextSegment}
              pixelToData={pixelToData}
              selectedSegmentIndex={selectedSegmentIndex}
              setSelectedSegmentIndex={setSelectedSegmentIndex}
              drawMode={drawMode}
              drawTool={drawTool}
              setDrawDragging={setDrawDragging}
              onSelectToolPan={onSelectToolPan}
              onChartDrawClick={() => {
                setSegmentToolboxCollapsed(true);
                // Não fechar a caixa de desenho ao clicar no gráfico; reabrir após criar fica a cargo de onSegmentCreated/handleCreateTextSegment
              }}
              onSegmentCreated={(newIndex) => {
                setSelectedSegmentIndex(newIndex);
                selectSelectTool();
                setDrawOpen(true);
                setSegmentToolboxCollapsed(false);
              }}
              t={t}
              textScale={textScale}
              strategyCandleOverlays={strategyCandleOverlays}
            />
            {/* Overlay só no modo crosshair (!drawMode). Em modo desenho o rect do SVG cuida de select (pan + grab) e de desenho (line/rect/fib). */}
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
                    cursor: segmentOptionsOpen ? "grab" : (drawMode && drawTool === "select" ? (crosshairDragging ? "grabbing" : "grab") : (crosshairDragging ? "grabbing" : crosshairPoint !== null ? "grab" : "crosshair")),
                  }}
                  onPointerDown={!segmentOptionsOpen ? ((e: React.PointerEvent<HTMLDivElement>) => {
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
                  }) : undefined}
                  onPointerMove={!segmentOptionsOpen ? ((e: React.PointerEvent<HTMLDivElement>) => {
                    if (!crosshairDraggingRef.current) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const px = MARGIN_LEFT + (e.clientX - rect.left) * (chartW / (rect.width || 1));
                    const py = MARGIN_TOP + (e.clientY - rect.top) * (chartH / (rect.height || 1));
                    const toData = crosshairPixelToDataRef.current;
                    if (toData) setCrosshairPoint(toData(px, py));
                  }) : undefined}
                  onPointerUp={!segmentOptionsOpen ? ((e: React.PointerEvent<HTMLDivElement>) => {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                    crosshairDraggingRef.current = false;
                    setCrosshairDragging(false);
                  }) : undefined}
                  onPointerCancel={!segmentOptionsOpen ? ((e: React.PointerEvent<HTMLDivElement>) => {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                    crosshairDraggingRef.current = false;
                    setCrosshairDragging(false);
                  }) : undefined}
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
            <div ref={chartYAxisContainerRef} className="contents">
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
                currentCandleCloseTimeMs={validCloseTimeMs}
                showCandleCountdown={showCandleCountdown}
                groupMinutes={groupMinutes}
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
                horizontalLineAxisLabels={
                  drawingsVisible
                    ? [
                      ...drawSegments
                        .filter((s): s is DrawSegment & { type: "horizontalLine" } => s.type === "horizontalLine" && s.horizontalLineShowOnYAxis === true)
                        .map((s) => ({ price: s.price1, color: s.color ?? DEFAULT_SEGMENT_COLOR })),
                      ...drawSegments
                        .filter((s): s is DrawSegment & { type: "fibonacci" } => s.type === "fibonacci" && s.fibShowValuesOnYAxis === true)
                        .flatMap((s) => {
                          const range = s.price1 - s.price2;
                          const level618Color = s.fibLevel618Color ?? s.color ?? DEFAULT_SEGMENT_COLOR;
                          const entries: { price: number; color: string }[] = [
                            { price: s.price2 + range * 0.618, color: level618Color },
                          ];
                          if (s.fibShow1618 === true) entries.push({ price: s.price2 + range * 1.618, color: level618Color });
                          return entries;
                        }),
                      ...drawSegments
                        .filter((s): s is DrawSegment & { type: "freeRetracement" } => s.type === "freeRetracement" && s.freeRetracementShowValuesOnYAxis === true)
                        .flatMap((s) => {
                          const range = s.price1 - s.price2;
                          const c = s.color ?? DEFAULT_SEGMENT_COLOR;
                          const k1 = Math.max(0, Math.min(0.5, (s.freeRetracementLevelPct1 ?? 25) / 100));
                          const k3 = Math.max(0.5, Math.min(1, (s.freeRetracementLevelPct ?? 75) / 100));
                          const kExt = Math.max(1, Math.min(2, (s.freeRetracementLevelPctExt ?? 100) / 100));
                          return [
                            { price: s.price2, color: c },
                            { price: s.price2 + range * k1, color: c },
                            { price: s.price2 + range * 0.5, color: c },
                            { price: s.price2 + range * k3, color: c },
                            { price: s.price1, color: c },
                            { price: s.price2 + range * kExt, color: c },
                          ];
                        }),
                      ...drawSegments
                        .filter((s): s is DrawSegment & { type: "stopGain" } => s.type === "stopGain" && s.stopGainShowValuesOnYAxis === true)
                        .flatMap((s) => {
                          const midPrice = s.price1;
                          const ru = Math.max(1, Math.min(10, Math.round((s.stopGainRatioUp ?? 1) * 100) / 100));
                          const rd = Math.max(1, Math.min(10, Math.round((s.stopGainRatioDown ?? 1) * 100) / 100));
                          const openAmount = Math.max(0, s.stopGainOpenAmount ?? 0);
                          const gainOffset = openAmount * (ru / (ru + rd));
                          const stopOffset = openAmount * (rd / (ru + rd));
                          const midColor = s.color ?? DEFAULT_SEGMENT_COLOR;
                          return [
                            { price: midPrice - stopOffset, color: "#dc2626" },
                            { price: midPrice, color: midColor },
                            { price: midPrice + gainOffset, color: "#059669" },
                          ];
                        }),
                    ]
                    : undefined
                }
              />
            </div>
          </div>
          {showUpgradeModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label={(t as Record<string, string>).upgradePlanModalTitle ?? "Atualize seu plano"}>
              <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 bg-violet-50 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-violet-800">{(t as Record<string, string>).upgradePlanModalTitle ?? "Atualize seu plano"}</h3>
                  <button type="button" onClick={() => setShowUpgradeModal(false)} className="p-1 rounded hover:bg-violet-100 text-violet-700" aria-label={t.close}>
                    <span className="text-lg leading-none">×</span>
                  </button>
                </div>
                <div className="px-4 py-3 text-sm text-zinc-600">
                  {(t as Record<string, string>).upgradePlanModalMessage ?? "Salvar e carregar layouts estão disponíveis em planos pagos. Atualize para acessar essas funcionalidades."}
                </div>
                <div className="px-4 py-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowUpgradeModal(false)} className="crypto-btn rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 px-4 py-2 font-medium">
                    {t.cancel}
                  </button>
                  <a href={`${APP_CRYPTO_ROUTE_PREFIX}/plans`} className="crypto-btn rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-2">
                    {(t as Record<string, string>).upgradePlanCta ?? "Ver planos"}
                  </a>
                </div>
              </div>
            </div>
          )}
          {saveSuccessModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label={t.savedSuccess}>
              <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 bg-emerald-50 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-emerald-800">{t.savedSuccess}</h3>
                  <button type="button" onClick={() => { setSaveSuccessModalOpen(false); setSavedLayoutName(null); }} className="p-1 rounded hover:bg-emerald-100 text-emerald-700" aria-label={t.close}>
                    <span className="text-lg leading-none">×</span>
                  </button>
                </div>
                {savedLayoutName && (
                  <div className="px-4 py-2 text-sm text-zinc-600">
                    {savedLayoutName}
                  </div>
                )}
                <div className="px-4 py-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setSaveSuccessModalOpen(false); setSavedLayoutName(null); }}
                    className="crypto-btn rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2"
                  >
                    {t.renameLayoutOk}
                  </button>
                </div>
              </div>
            </div>
          )}
          {saveConfirmSlot !== null && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label={t.saveLayout}>
              <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 bg-amber-50 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-amber-800">{t.saveLayout} &quot;{getLayoutLabelBySlot(saveConfirmSlot)}&quot;</h3>
                  <button type="button" onClick={() => setSaveConfirmSlot(null)} className="p-1 rounded hover:bg-amber-100 text-amber-700" aria-label={t.close}>
                    <span className="text-lg leading-none">×</span>
                  </button>
                </div>
                <div className="px-4 py-3 text-sm text-zinc-600">
                  {(t as Record<string, string>).saveLayoutConfirmMessage ?? (t as Record<string, string>).saveDefaultConfirmMessage ?? ""}
                </div>
                <div className="px-4 py-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSaveConfirmSlot(null)}
                    className="crypto-btn rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 font-medium px-4 py-2"
                  >
                    {t.renameLayoutCancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSaveLayout}
                    className="crypto-btn rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2"
                  >
                    {(t as Record<string, string>).saveLayoutConfirmConfirm ?? (t as Record<string, string>).saveDefaultConfirmConfirm ?? t.renameLayoutOk}
                  </button>
                </div>
              </div>
            </div>
          )}
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
