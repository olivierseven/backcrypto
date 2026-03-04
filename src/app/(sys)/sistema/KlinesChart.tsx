"use client";

/**
 * Gráfico de candles (OHLC). Janela visível configurável.
 * Eixo Y: preço USDT (ajustado aos candles visíveis). Eixo X: tempo + subeixo por data.
 */
import { useState, useEffect, useRef } from "react";
import { API_BASE } from "@/app/constants";
import { useBioLang } from "@/app/contexts/BioLangContext";
import { getBioT } from "@/app/lib/translations";
import {
  ASPECT_BREAKPOINT,
  MIN_CHART_HEIGHT,
  PAD_Y,
  BODY_WIDTH_RATIO,
  Y_AXIS_WIDTH,
  GAP_PLOT_Y_AXIS,
  MARGIN_LEFT,
  MARGIN_TOP,
  MARGIN_BOTTOM_TABLE,
  INDICATOR_STRIP_HEIGHT,
  VISIBLE_OPTIONS,
  DEFAULT_VISIBLE,
  INVISIBLE_CANDLES_END,
  SIDEBAR_WIDTH,
  KLINE_PREFS_KEY,
  KLINE_LAST_LAYOUT_KEY,
  KLINE_DRAW_SEGMENTS_KEY,
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
  dayKey,
  monthKey,
  formatDayOnly,
  formatMonthOnly,
  formatMonthYearShort,
  isStartOfDay,
} from "./klinesFormatters";
import { distanceToSegment, DEFAULT_SEGMENT_COLOR } from "./KlinesChartDrawing";
import type { DrawSegment, SegmentCap } from "./KlinesChartDrawing";
import { useKlinesChartDrawing } from "./useKlinesChartDrawing";
import { useKlinesIndicators } from "./KlinesIndicatorsContext";

type Kline = [
  number, string, string, string, string, string, number, string, number, string, string, number,
  ...(number | null)[],
];

/** Indicador a desenhar no gráfico: coluna (índice 12+), cor, espessura, tipo de traço e rótulo para a faixa no topo. */
export interface ChartIndicatorLine {
  columnIndex: number;
  color: string;
  lineWidth?: "thin" | "normal";
  lineStyle?: "solid" | "dotted" | "dashed";
  /** Rótulo exibido na faixa de indicadores no topo (ex.: "SMA(7) Close"). */
  label?: string;
}

type Props = {
  klines: Kline[];
  groupMinutes: number;
  intervalLabel?: string;
  width: number;
  /** Indicadores do usuário (ex.: SMA) a desenhar como linhas. */
  indicatorLines?: ChartIndicatorLine[];
  /** Chamado ao carregar um layout; permite ao pai (ex.: KlinesTable) aplicar preferências que não são do chart (ex.: groupMinutes). */
  onLayoutConfigLoaded?: (config: Record<string, unknown>) => void;
};

const CANDLE_COLOR_PRESETS = [
  { id: "greenRed" as const, bull: "#059669", bear: "#dc2626" },
  { id: "blueOrange" as const, bull: "#2563eb", bear: "#ea580c" },
  { id: "blackWhite" as const, bull: "#f5f5f5", bear: "#171717" },
  { id: "purpleAmber" as const, bull: "#7c3aed", bear: "#f59e0b" },
  { id: "cyanRose" as const, bull: "#0891b2", bear: "#e11d48" },
] as const;
type CandleColorPresetId = (typeof CANDLE_COLOR_PRESETS)[number]["id"];
const DEFAULT_CANDLE_PRESET: CandleColorPresetId = "greenRed";

/** Paleta básica para cor do segmento de reta. */
const SEGMENT_COLOR_PALETTE = [
  "#000000", "#ffffff", "#dc2626", "#ea580c", "#ca8a04", "#65a30d", "#059669", "#0891b2", "#2563eb", "#7c3aed", "#db2777", "#78716c",
] as const;

const SEGMENT_CAP_OPTIONS: { value: SegmentCap; labelKey: "capNone" | "capPoint" | "capArrow" }[] = [
  { value: "none", labelKey: "capNone" },
  { value: "point", labelKey: "capPoint" },
  { value: "arrow", labelKey: "capArrow" },
];

// Paleta Área de plot: branco, cinzas, pretos, marrons (10 cores)
const BACKGROUND_PALETTE = [
  { id: 0, hex: "#ffffff", labelKey: "bgWhite" as const },
  { id: 1, hex: "#f5f5f5", labelKey: "bgLightGray" as const },
  { id: 2, hex: "#e5e5e5", labelKey: "bgGray" as const },
  { id: 3, hex: "#a3a3a3", labelKey: "bgMediumGray" as const },
  { id: 4, hex: "#525252", labelKey: "bgDarkGray" as const },
  { id: 5, hex: "#171717", labelKey: "bgBlack" as const },
  { id: 6, hex: "#d6d3d1", labelKey: "bgLightBrown" as const },
  { id: 7, hex: "#78716c", labelKey: "bgBrown" as const },
  { id: 8, hex: "#57534e", labelKey: "bgDarkBrown" as const },
  { id: 9, hex: "#292524", labelKey: "bgVeryDarkBrown" as const },
] as const;
type BackgroundId = (typeof BACKGROUND_PALETTE)[number]["id"];
const DEFAULT_BACKGROUND: BackgroundId = 0;

// Paleta Linhas/tabela/grade: branco, preto, vermelho, verde, azul, roxo, ciano, amarelo, laranja, cinza, marrom (11 cores)
const LINE_GRID_PALETTE = [
  { id: 0, hex: "#ffffff", labelKey: "lineWhite" as const },
  { id: 1, hex: "#000000", labelKey: "lineBlack" as const },
  { id: 2, hex: "#dc2626", labelKey: "lineRed" as const },
  { id: 3, hex: "#16a34a", labelKey: "lineGreen" as const },
  { id: 4, hex: "#2563eb", labelKey: "lineBlue" as const },
  { id: 5, hex: "#9333ea", labelKey: "linePurple" as const },
  { id: 6, hex: "#0891b2", labelKey: "lineCyan" as const },
  { id: 7, hex: "#ca8a04", labelKey: "lineYellow" as const },
  { id: 8, hex: "#ea580c", labelKey: "lineOrange" as const },
  { id: 9, hex: "#71717a", labelKey: "lineGray" as const },
  { id: 10, hex: "#78716c", labelKey: "lineBrown" as const },
] as const;
type LineGridId = (typeof LINE_GRID_PALETTE)[number]["id"];
const DEFAULT_LINE_TABLE_COLOR: LineGridId = 1; // preto
const DEFAULT_SECONDARY_GRID_COLOR: LineGridId = 9; // cinza

// Paleta texto: branco, preto, cinzas, marrom, vermelho, azul, roxo (10 cores) — para texto no fundo e no rodapé/eixo Y
const TEXT_PALETTE = [
  { id: 0, hex: "#ffffff", labelKey: "textWhite" as const },
  { id: 1, hex: "#000000", labelKey: "textBlack" as const },
  { id: 2, hex: "#f5f5f5", labelKey: "textLightGray" as const },
  { id: 3, hex: "#a3a3a3", labelKey: "textGray" as const },
  { id: 4, hex: "#525252", labelKey: "textDarkGray" as const },
  { id: 5, hex: "#78716c", labelKey: "textBrown" as const },
  { id: 6, hex: "#dc2626", labelKey: "textRed" as const },
  { id: 7, hex: "#2563eb", labelKey: "textBlue" as const },
  { id: 8, hex: "#9333ea", labelKey: "textPurple" as const },
  { id: 9, hex: "#71717a", labelKey: "textMediumGray" as const },
] as const;
type TextColorId = (typeof TEXT_PALETTE)[number]["id"];
const DEFAULT_TEXT_COLOR: TextColorId = 1; // preto

export default function KlinesChart({ klines, groupMinutes, intervalLabel, width, indicatorLines = [], onLayoutConfigLoaded }: Props) {
  const lang = useBioLang();
  const t = getBioT(lang).sistema.klines;
  const { showIndicatorLastValueOnYAxis, setShowIndicatorLastValueOnYAxis } = useKlinesIndicators();
  const [visibleCount, setVisibleCount] = useState<VisibleCount>(DEFAULT_VISIBLE);
  const [startIndex, setStartIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [segmentToolboxCollapsed, setSegmentToolboxCollapsed] = useState(false);
  const [segmentColorListboxOpen, setSegmentColorListboxOpen] = useState(false);
  const [segmentToolboxSide, setSegmentToolboxSide] = useState<"left" | "right">("left");
  const [drawPanelSide, setDrawPanelSide] = useState<"left" | "right">("left");
  const [savedLayouts, setSavedLayouts] = useState<{ slot: number; config: Record<string, unknown> }[]>([]);
  const [saveLoadMsg, setSaveLoadMsg] = useState<string | null>(null);
  const [yAxisAbbreviated, setYAxisAbbreviated] = useState(false); // false = 2 decimais (default), true = abreviado
  const [logScale, setLogScale] = useState(false);
  const [showMainAxis, setShowMainAxis] = useState(true);
  const [showSecondaryAxis, setShowSecondaryAxis] = useState(true);
  const [showLastCloseLine, setShowLastCloseLine] = useState(true);
  const [invisibleCandlesEnd, setInvisibleCandlesEnd] = useState(INVISIBLE_CANDLES_END);
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
  /** Exibir gráfico; loading só por um instante ao trocar o intervalo (evita travar por efeitos assíncronos). */
  const [chartReady, setChartReady] = useState(true);
  const [layoutApplied, setLayoutApplied] = useState(false);
  const [segmentsApplied, setSegmentsApplied] = useState(false);
  /** Ponto do crosshair (clique/arraste); índice global e preço. Display só quando estiver sobre um candle visível. */
  const [crosshairPoint, setCrosshairPoint] = useState<{ index: number; price: number } | null>(null);
  const crosshairDraggingRef = useRef(false);
  const [crosshairDragging, setCrosshairDragging] = useState(false);
  /** Conversão pixel → dados para o crosshair (sem atração magnética). */
  const crosshairPixelToDataRef = useRef<((x: number, yCoord: number) => { index: number; price: number }) | null>(null);
  const crosshairPointRef = useRef(crosshairPoint);
  const crosshairOverlayRef = useRef<SVGRectElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const colorsRef = useRef<HTMLDivElement>(null);
  const saveLoadRef = useRef<HTMLDivElement>(null);
  const chartSvgRef = useRef<SVGSVGElement>(null);

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
    selectSelectTool,
    clearAllDrawing,
  } = drawing;

  const fullReversed = [...klines].reverse();
  const n = fullReversed.length;

  useEffect(() => {
    if (segmentToolboxCollapsed) setSegmentColorListboxOpen(false);
  }, [segmentToolboxCollapsed]);

  // Ao trocar intervalo: loading breve (1 frame) para recarregar segmentos; em seguida voltar a exibir o gráfico
  useEffect(() => {
    setSegmentsApplied(false);
    setChartReady(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setChartReady(true));
    });
    return () => cancelAnimationFrame(id);
  }, [groupMinutes]);

  // Carregar segmentos de desenho do localStorage ao mudar o intervalo (só os do intervalo atual ficam ativos/visíveis)
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_DRAW_SEGMENTS_KEY) : null;
      if (!raw) {
        setDrawSegments([]);
        setSelectedSegmentIndex(null);
        setDrawPending(null);
        setSegmentsApplied(true);
        return;
      }
      const data = JSON.parse(raw) as Record<string, DrawSegment[]>;
      const key = String(groupMinutes);
      const loaded = Array.isArray(data[key]) ? data[key] : [];
      setDrawSegments(loaded);
      setSelectedSegmentIndex(null);
      setDrawPending(null);
    } catch {
      setDrawSegments([]);
      setSelectedSegmentIndex(null);
      setDrawPending(null);
    }
    setSegmentsApplied(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when interval changes
  }, [groupMinutes]);

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
      const data = JSON.parse(raw) as { visibleCount?: number; invisibleCandlesEnd?: number; candleColorPreset?: string; yAxisAbbreviated?: boolean; logScale?: boolean; containerBackground?: number; chartBackground?: number; footerYAxisBgColor?: number; backgroundTextColor?: number; footerYAxisTextColor?: number; lineTableColor?: number; secondaryGridColor?: number; showMainAxis?: boolean; showSecondaryAxis?: boolean; showLastCloseLine?: boolean; lastCloseLineColor?: number; lastCloseTextColor?: number; showIndicatorLastValueOnYAxis?: boolean };
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
      if (typeof data.showIndicatorLastValueOnYAxis === "boolean") setShowIndicatorLastValueOnYAxis(data.showIndicatorLastValueOnYAxis);
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
        JSON.stringify({ visibleCount, invisibleCandlesEnd, candleColorPreset, yAxisAbbreviated, logScale, containerBackground, chartBackground, footerYAxisBgColor, backgroundTextColor, footerYAxisTextColor, lineTableColor, secondaryGridColor, showMainAxis, showSecondaryAxis, showLastCloseLine, lastCloseLineColor, lastCloseTextColor, showIndicatorLastValueOnYAxis })
      );
    } catch {
      /* ignore */
    }
  }, [visibleCount, invisibleCandlesEnd, candleColorPreset, yAxisAbbreviated, logScale, containerBackground, chartBackground, footerYAxisBgColor, backgroundTextColor, footerYAxisTextColor, lineTableColor, secondaryGridColor, showMainAxis, showSecondaryAxis, showLastCloseLine, lastCloseLineColor, lastCloseTextColor, showIndicatorLastValueOnYAxis]);

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
    const config = { visibleCount, invisibleCandlesEnd, candleColorPreset, yAxisAbbreviated, logScale, containerBackground, chartBackground, footerYAxisBgColor, backgroundTextColor, footerYAxisTextColor, lineTableColor, secondaryGridColor, showMainAxis, showSecondaryAxis, showLastCloseLine, lastCloseLineColor, lastCloseTextColor, showIndicatorLastValueOnYAxis, groupMinutes };
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
    if (typeof c.showIndicatorLastValueOnYAxis === "boolean") setShowIndicatorLastValueOnYAxis(c.showIndicatorLastValueOnYAxis);
    if (typeof c.invisibleCandlesEnd === "number" && c.invisibleCandlesEnd >= 0 && c.invisibleCandlesEnd <= 30) setInvisibleCandlesEnd(c.invisibleCandlesEnd);
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
    showIndicatorLastValueOnYAxis: true,
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

  // Arraste do crosshair: mousemove/mouseup; conversão usa rect do overlay (área de plot) + drawConversionRef para alinhar com o clique
  useEffect(() => {
    const getCoords = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ("touches" in e && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if ("clientX" in e) return { x: e.clientX, y: e.clientY };
      return null;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!crosshairDraggingRef.current) return;
      const coords = getCoords(e);
      if (!coords) return;
      const overlay = crosshairOverlayRef.current;
      const dims = drawConversionRef.current;
      if (!overlay || !dims) return;
      if (e.cancelable && "touches" in e) e.preventDefault();
      const rect = overlay.getBoundingClientRect();
      const px = MARGIN_LEFT + (coords.x - rect.left) * (dims.chartW / (rect.width || 1));
      const py = MARGIN_TOP + (coords.y - rect.top) * (dims.chartH / (rect.height || 1));
      const toData = crosshairPixelToDataRef.current;
      if (toData) setCrosshairPoint(toData(px, py));
    };
    const onUp = () => {
      crosshairDraggingRef.current = false;
      setCrosshairDragging(false);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
    document.addEventListener("touchcancel", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
      document.removeEventListener("touchcancel", onUp);
    };
  }, []);

  // Touch no overlay com passive: false para permitir preventDefault (evita scroll ao arrastar crosshair)
  useEffect(() => {
    if (drawMode) return;
    const el = crosshairOverlayRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      e.preventDefault();
      const t = e.touches[0];
      const overlay = crosshairOverlayRef.current;
      const dims = drawConversionRef.current;
      if (!overlay || !dims) return;
      const rect = overlay.getBoundingClientRect();
      const px = MARGIN_LEFT + (t.clientX - rect.left) * (dims.chartW / (rect.width || 1));
      const py = MARGIN_TOP + (t.clientY - rect.top) * (dims.chartH / (rect.height || 1));
      const toData = crosshairPixelToDataRef.current;
      if (!toData) return;
      const newPoint = toData(px, py);
      const current = crosshairPointRef.current;
      const isSamePoint = current !== null && current.index === newPoint.index && Math.abs(current.price - newPoint.price) < 1e-9;
      if (isSamePoint) {
        setCrosshairPoint(null);
        return;
      }
      const hadCrosshair = current !== null;
      setCrosshairPoint(newPoint);
      if (hadCrosshair) {
        crosshairDraggingRef.current = true;
        setCrosshairDragging(true);
      }
    };
    el.addEventListener("touchstart", handler, { passive: false });
    return () => el.removeEventListener("touchstart", handler);
  }, [drawMode]);

  if (klines.length === 0 || width < 100) return null;

  const windowSlice = fullReversed.slice(startIndex, startIndex + visibleCount);
  const windowN = windowSlice.length;
  if (windowN === 0) return null;

  const chartHeight = Math.max(
    MIN_CHART_HEIGHT,
    width < ASPECT_BREAKPOINT ? Math.round(width * (16 / 9)) : Math.round(width * (9 / 16))
  );

  const is2hOrAbove = groupMinutes >= 120;
  const marginBottom = MARGIN_BOTTOM_TABLE;
  const chartW = width - MARGIN_LEFT - GAP_PLOT_Y_AXIS;
  const chartH = chartHeight - MARGIN_TOP - marginBottom;
  const totalSlots = windowN + invisibleCandlesEnd;
  const gap = chartW / totalSlots;
  const candleW = Math.max(2, gap * BODY_WIDTH_RATIO);
  const cx = (i: number) => MARGIN_LEFT + (i + 0.5) * gap;

  // Y apenas da janela visível (OHLC + valores dos indicadores)
  const lows = windowSlice.map((k) => parseNum(k[3]));
  const highs = windowSlice.map((k) => parseNum(k[2]));
  const priceExtents: number[] = [...lows, ...highs];
  for (const ind of indicatorLines) {
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
  const yRangeLinear = yMaxLinear - yMinLinear;
  const Y_TICK_STEP = 0.10;
  const floorToMultiple = (x: number, m: number) => Math.floor(x / m) * m;
  const ceilToMultiple = (x: number, m: number) => Math.ceil(x / m) * m;
  const roundToMultiple = (x: number, m: number) => Math.round(x / m) * m;

  let yMin = logScale ? Math.max(yMinLinear, minPrice * 0.5 || 0.001) : yMinLinear;
  let yMax = logScale ? (yMaxLinear <= 0 ? yMin * 1.1 : yMaxLinear + pad) : yMaxLinear;
  // Sempre ajustar limites e marcas para múltiplos de 0,10 (valores originais); escala log só altera o posicionamento vertical
  const yMinFloor = floorToMultiple(yMin, Y_TICK_STEP);
  const yMaxCeil = ceilToMultiple(yMax, Y_TICK_STEP);
  let step = roundToMultiple((yMaxCeil - yMinFloor) / 5, Y_TICK_STEP);
  if (step < Y_TICK_STEP) step = Y_TICK_STEP;
  yMin = yMinFloor;
  yMax = yMinFloor + 5 * step;
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

  const yTicks = 5;
  const yTickValues: number[] = [];
  for (let i = 0; i <= yTicks; i++) {
    const v = yMin + (yRange * i) / yTicks;
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

  const totalChartWidth = SIDEBAR_WIDTH + width + Y_AXIS_WIDTH;

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
    return (
      <div
        className="rounded-lg border border-zinc-200 overflow-hidden flex flex-col flex-shrink-0 w-fit flex items-center justify-center"
        style={{ minWidth: width, minHeight: MIN_CHART_HEIGHT, backgroundColor: "#f5f5f5" }}
      >
        <p className="text-zinc-500 text-sm">{t.loading.replace("{interval}", intervalLabel ?? "")}</p>
      </div>
    );
  }

  const hasIndicatorStrip = indicatorLines.length > 0;

  return (
    <div
      className="rounded-lg border border-zinc-200 overflow-hidden flex flex-col flex-shrink-0 w-fit"
      style={{ minWidth: totalChartWidth, backgroundColor: containerBgHex }}
    >
      <div className="flex min-w-0 flex-shrink-0">
        {/* Sidebar: configuração + cores dos candles (mesma altura do gráfico) */}
        <div
          ref={settingsRef}
          className="flex-shrink-0 border-r border-zinc-200 bg-zinc-50 flex flex-col items-center relative"
          style={{ width: SIDEBAR_WIDTH, height: chartHeight }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setSettingsOpen((o) => !o); setColorsOpen(false); }}
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
            </div>
          )}
          <div ref={colorsRef} className="relative w-full flex flex-col items-center">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setColorsOpen((o) => !o); setSettingsOpen(false); }}
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
              onClick={(e) => { e.stopPropagation(); setColorsOpen(false); setSettingsOpen(false); openDrawPanel(); }}
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
                    onClick={(e) => { e.stopPropagation(); setDrawPanelSide((s) => s === "left" ? "right" : "left"); }}
                    className="p-0.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 text-xs leading-none"
                    title={drawPanelSide === "left" ? t.segmentToolboxMoveRight : t.segmentToolboxMoveLeft}
                    aria-label={drawPanelSide === "left" ? t.segmentToolboxMoveRight : t.segmentToolboxMoveLeft}
                  >
                    {drawPanelSide === "left" ? "→" : "←"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDrawOpen(false); closeDrawMode(); }}
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
                <label className={`flex items-center justify-center w-8 h-8 cursor-pointer rounded text-base hover:bg-zinc-100 ${drawMagnetic ? "bg-zinc-100" : ""}`} title={t.drawMagnetic}>
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
                onClick={(e) => { e.stopPropagation(); setSaveOpen((o) => !o); setLoadOpen(false); }}
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
                      onClick={() => handleSaveLayout(slot)}
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
                    if (!o) fetchSavedLayouts();
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
                  onClick={handleLoadDefaultLayout}
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
                        onClick={() => handleLoadLayout(layout)}
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
        <div className="flex-shrink-0 relative" style={{ backgroundColor: containerBgHex }}>
          {drawOpen && drawPanelSide === "right" && (
            <div
              className="absolute right-2 top-2 z-10 w-fit min-w-0 rounded-lg border border-zinc-200 bg-white shadow-lg py-1 px-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-0.5 px-0.5 pb-1 border-b border-zinc-100">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDrawPanelSide((s) => s === "left" ? "right" : "left"); }}
                  className="p-0.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 text-xs leading-none"
                  title={t.segmentToolboxMoveLeft}
                  aria-label={t.segmentToolboxMoveLeft}
                >
                  <span aria-hidden>←</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDrawOpen(false); closeDrawMode(); }}
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
                className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 w-full ${drawTool === "line" ? "bg-zinc-100" : ""}`}
                aria-label={t.lineSegment}
              >
                📏
              </button>
              <button
                type="button"
                onClick={selectSelectTool}
                title={t.drawSelectSegment}
                className={`flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 w-full ${drawTool === "select" ? "bg-zinc-100" : ""}`}
                aria-label={t.drawSelectSegment}
              >
                👆
              </button>
              <label className={`flex items-center justify-center w-8 h-8 cursor-pointer rounded text-base hover:bg-zinc-100 w-full ${drawMagnetic ? "bg-zinc-100" : ""}`} title={t.drawMagnetic}>
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
                className="flex items-center justify-center w-8 h-8 rounded text-base hover:bg-zinc-100 text-zinc-700 w-full"
                aria-label={t.drawClearAll}
              >
                🗑️
              </button>
            </div>
          )}
          {drawMode && selectedSegmentIndex !== null && drawSegments[selectedSegmentIndex] && (
            <div
              className={`absolute top-12 z-10 rounded-lg border border-zinc-200 bg-white shadow-lg overflow-hidden w-fit min-w-0 max-w-[180px] ${segmentToolboxSide === "left" ? "left-2" : "right-2"}`}
              onClick={(e) => e.stopPropagation()}
              role="group"
              aria-label={t.segmentOptionsTitle}
            >
              <div
                className="flex items-center justify-between gap-1 bg-zinc-50 border-b border-zinc-200 px-1.5 py-1 cursor-pointer hover:bg-zinc-100 transition-colors"
                onClick={() => setSegmentToolboxCollapsed((c) => !c)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSegmentToolboxCollapsed((c) => !c); } }}
                aria-expanded={!segmentToolboxCollapsed}
              >
                <span className="text-[10px] font-medium text-zinc-600 truncate min-w-0">{t.segmentOptionsTitle}</span>
                <span className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSegmentToolboxSide((s) => s === "left" ? "right" : "left"); }}
                    className="p-0.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 text-xs leading-none"
                    title={segmentToolboxSide === "left" ? t.segmentToolboxMoveRight : t.segmentToolboxMoveLeft}
                    aria-label={segmentToolboxSide === "left" ? t.segmentToolboxMoveRight : t.segmentToolboxMoveLeft}
                  >
                    {segmentToolboxSide === "left" ? "→" : "←"}
                  </button>
                  <span className="text-zinc-500 text-xs leading-none" aria-hidden>
                    {segmentToolboxCollapsed ? "▶" : "▼"}
                  </span>
                </span>
              </div>
              {!segmentToolboxCollapsed && (
                <div className="py-1.5 px-1.5 space-y-1.5">
                  <div>
                    <div className="text-[10px] font-medium text-zinc-500 pb-0.5">{t.segmentColor}</div>
                    <div className="relative">
                      <button
                        type="button"
                        role="combobox"
                        aria-expanded={segmentColorListboxOpen}
                        aria-haspopup="listbox"
                        aria-label={t.segmentColor}
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
                          aria-label={t.segmentColor}
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
                                aria-label={t.segmentColor}
                                onClick={() => {
                                  setDrawSegments((prev) => {
                                    const next = [...prev];
                                    const seg = next[selectedSegmentIndex];
                                    if (seg) next[selectedSegmentIndex] = { ...seg, color: hex };
                                    return next;
                                  });
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
                  <div>
                    <label className="text-[10px] font-medium text-zinc-500 block pb-0.5" htmlFor="segment-startcap-listbox">{t.segmentStartCap}</label>
                    <select
                      id="segment-startcap-listbox"
                      value={drawSegments[selectedSegmentIndex]?.startCap ?? "none"}
                      onChange={(e) => setDrawSegments((prev) => {
                        const next = [...prev];
                        const seg = next[selectedSegmentIndex];
                        if (seg) next[selectedSegmentIndex] = { ...seg, startCap: e.target.value as SegmentCap };
                        return next;
                      })}
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
                      onChange={(e) => setDrawSegments((prev) => {
                        const next = [...prev];
                        const seg = next[selectedSegmentIndex];
                        if (seg) next[selectedSegmentIndex] = { ...seg, endCap: e.target.value as SegmentCap };
                        return next;
                      })}
                      className="w-full min-w-0 text-xs rounded border border-zinc-300 px-1.5 py-0.5 bg-white text-zinc-800"
                      aria-label={t.segmentEndCap}
                    >
                      {SEGMENT_CAP_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{t[opt.labelKey]}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-700">
                    <input
                      type="checkbox"
                      checked={drawSegments[selectedSegmentIndex]?.showPercent !== false}
                      onChange={(e) => setDrawSegments((prev) => {
                        const next = [...prev];
                        const seg = next[selectedSegmentIndex];
                        if (seg) next[selectedSegmentIndex] = { ...seg, showPercent: e.target.checked };
                        return next;
                      })}
                      className="rounded border-zinc-300"
                    />
                    <span>{t.segmentShowPercent}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-700">
                    <input
                      type="checkbox"
                      checked={drawSegments[selectedSegmentIndex]?.showValues === true}
                      onChange={(e) => setDrawSegments((prev) => {
                        const next = [...prev];
                        const seg = next[selectedSegmentIndex];
                        if (seg) next[selectedSegmentIndex] = { ...seg, showValues: e.target.checked };
                        return next;
                      })}
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
              )}
            </div>
          )}
        <div className="flex flex-shrink-0 relative" style={{ width: width + Y_AXIS_WIDTH }}>
          {/* Faixa de indicadores sobreposta ao topo da área de plot (não ocupa espaço) */}
          {hasIndicatorStrip && (
            <div
              className="absolute left-0 top-0 z-10 flex items-center gap-2 flex-wrap pointer-events-none"
              style={{
                height: INDICATOR_STRIP_HEIGHT,
                width,
                paddingLeft: MARGIN_LEFT,
                paddingTop: 2,
              }}
              role="list"
              aria-label={t.indicatorsOnChart ?? "Indicadores no gráfico"}
            >
              {indicatorLines.map((ind, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{
                    color: ind.color,
                    backgroundColor: isDarkBg ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.85)",
                    boxShadow: "0 0 4px rgba(0,0,0,0.15)",
                  }}
                  role="listitem"
                >
                  <span className="w-2 h-0.5 rounded-full shrink-0" style={{ backgroundColor: ind.color }} aria-hidden />
                  <span>{ind.label ?? `Ind ${idx + 1}`}</span>
                </span>
              ))}
            </div>
          )}
        <svg ref={chartSvgRef} width={width} height={chartHeight} className={`flex-shrink-0 ${isDarkBg ? "text-zinc-400" : "text-zinc-700"}`}>
          {/* Área de plotagem (só candles + grade) com cor de fundo */}
          <rect
            x={MARGIN_LEFT}
            y={MARGIN_TOP}
            width={chartW}
            height={chartH}
            fill={chartBgHex}
          />
          {/* Eixo secundário: grade do plot (verticais tracejadas + grid horizontal) — cor da paleta Área de plot */}
          {showSecondaryAxis && (
            <>
              {verticalIndicesFiltered.map((idx) => (
                <line
                  key={`dash-${idx}`}
                  x1={cx(idx)}
                  y1={MARGIN_TOP}
                  x2={cx(idx)}
                  y2={MARGIN_TOP + chartH}
                  stroke={secondaryGridHex}
                  strokeOpacity={0.5}
                  strokeDasharray="4 2"
                />
              ))}
              {yTickValues.map((v, i) => (
                <line
                  key={i}
                  x1={MARGIN_LEFT}
                  y1={y(v)}
                  x2={MARGIN_LEFT + chartW}
                  y2={y(v)}
                  stroke={secondaryGridHex}
                  strokeOpacity={0.5}
                  strokeDasharray="2 2"
                />
              ))}
            </>
          )}
          {/* Linha pontilhada do último fechamento (atravessa o gráfico) */}
          {showLastCloseLine && showLastClose && (
            <line
              x1={MARGIN_LEFT}
              y1={lastCloseY}
              x2={MARGIN_LEFT + chartW}
              y2={lastCloseY}
              stroke={lastCloseLineHex}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          )}
          {/* Eixo principal: verticais do dia */}
          {showMainAxis && dateBreaksFiltered.map((b) => (
            <line
              key={`date-${b.index}`}
              x1={cx(b.index)}
              y1={MARGIN_TOP}
              x2={cx(b.index)}
              y2={MARGIN_TOP + chartH}
              stroke={lineTableHex}
              strokeWidth={1}
              strokeDasharray="4 2"
            />
          ))}
          {/* Eixo X: linha 1 = dias (dia 01 = mês a 45°); linha 2 = grade secundária (sempre) hh:mm, sem desenho de tabela */}
          {(() => {
            const tableTop = MARGIN_TOP + chartH;
            const rowH = 12;
            const labelOffsetDown = 4;
            const yRow1 = tableTop + rowH - 2 + labelOffsetDown;
            const yRow2 = tableTop + rowH + rowH - 2 + labelOffsetDown;
            return (
              <>
                {/* Dias (dd); dia 01 = mês abreviado a 45° no mesmo lugar, substituindo o 01 — 12px */}
                <g className="text-[12px] font-mono" fill={backgroundTextHex}>
                  {dayBreaksFiltered.map((b) => {
                    const isDay01 = b.label === "01";
                    const openTimeMs = windowSlice[b.index][0] as number;
                    const x = cx(b.index);
                    if (isDay01) {
                      return (
                        <text
                          key={b.index}
                          x={x}
                          y={yRow1}
                          textAnchor="middle"
                          className="text-[12px] font-mono"
                          fill={backgroundTextHex}
                          transform={`rotate(-45, ${x}, ${yRow1})`}
                        >
                          {formatMonthOnly(openTimeMs)}
                        </text>
                      );
                    }
                    return <text key={b.index} x={x} y={yRow1} textAnchor="middle">{b.label}</text>;
                  })}
                </g>
                {/* Linha 2: grade secundária hh:mm só quando o eixo secundário está ativo */}
                {showSecondaryAxis && (
                  <g className="text-[9px] font-mono" fill={secondaryGridHex}>
                    {verticalIndicesFiltered.map((idx) => (
                      <text key={`sec-${idx}`} x={cx(idx)} y={yRow2} textAnchor="middle">
                        {formatTimeLabel(windowSlice[idx][0] as number)}
                      </text>
                    ))}
                  </g>
                )}
              </>
            );
          })()}
          {/* Candles */}
          {windowSlice.map((k, i) => {
            const openP = parseNum(k[1]);
            const highP = parseNum(k[2]);
            const lowP = parseNum(k[3]);
            const closeP = parseNum(k[4]);
            const bull = closeP >= openP;
            const x = cx(i);
            const bodyTop = y(Math.max(openP, closeP));
            const bodyBottom = y(Math.min(openP, closeP));
            const bodyH = Math.max(1, bodyBottom - bodyTop);
            const wickTop = y(highP);
            const wickBottom = y(lowP);
            const color = bull ? candleColors.bull : candleColors.bear;
            const strokeColor = color === "#f5f5f5" ? "#171717" : color;
            const slotLeft = MARGIN_LEFT + i * gap;
            const slotRight = MARGIN_LEFT + (i + 1) * gap;
            return (
              <g key={i}>
                {/* Área de clique ampliada (crosshair é tratado pelo overlay) */}
                <rect x={slotLeft} y={MARGIN_TOP} width={gap} height={chartH} fill="transparent" />
                <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={strokeColor} strokeWidth={1} />
                <rect
                  x={x - candleW / 2}
                  y={bodyTop}
                  width={candleW}
                  height={bodyH}
                  fill={color}
                  stroke={strokeColor}
                  strokeWidth={1}
                />
              </g>
            );
          })}
          {/* Linhas dos indicadores (SMA etc.) */}
          {indicatorLines.map((ind, indIdx) => {
            const col = ind.columnIndex;
            const points: { i: number; val: number }[] = [];
            for (let i = 0; i < windowSlice.length; i++) {
              const v = windowSlice[i][col];
              if (v != null && typeof v === "number" && Number.isFinite(v)) points.push({ i, val: v });
            }
            if (points.length < 2) return null;
            const d = points
              .map((p, idx) => `${idx === 0 ? "M" : "L"} ${cx(p.i)} ${y(p.val)}`)
              .join(" ");
            const strokeWidth = ind.lineWidth === "thin" ? 1 : 2;
            const strokeDasharray =
              ind.lineStyle === "dotted"
                ? "2 2"
                : ind.lineStyle === "dashed"
                  ? "6 4"
                  : undefined;
            return (
              <path
                key={indIdx}
                d={d}
                fill="none"
                stroke={ind.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
          {/* Crosshair: linhas pontilhadas + marcador (visível sobre candle ou durante arraste; ao arrastar fora, fica na borda) */}
          {(() => {
            if (!crosshairPoint) return null;
            const isOverCandle = crosshairPoint.index >= startIndex && crosshairPoint.index < startIndex + windowN;
            const showCrosshair = isOverCandle || crosshairDragging;
            if (!showCrosshair) return null;
            let crossX = segmentToPixel(crosshairPoint.index, crosshairPoint.price).x;
            let crossY = y(crosshairPoint.price);
            if (crosshairDragging) {
              crossX = Math.max(MARGIN_LEFT, Math.min(MARGIN_LEFT + chartW, crossX));
              crossY = Math.max(MARGIN_TOP, Math.min(MARGIN_TOP + chartH, crossY));
            }
            const strokeCross = lineTableHex;
            const tableTop = MARGIN_TOP + chartH;
            const openTimeMs = crosshairPoint.index >= 0 && crosshairPoint.index < n ? Number(fullReversed[crosshairPoint.index][0]) : null;
            const boxPad = 6;
            const lineH = 10;
            const boxW = 72;
            const boxH = lineH * 2 + boxPad * 2;
            const boxX = Math.max(MARGIN_LEFT, Math.min(MARGIN_LEFT + chartW - boxW, crossX - boxW / 2));
            const boxY = tableTop + 2;
            return (
              <g pointerEvents="none">
                {/* Vertical pontilhada */}
                <line x1={crossX} y1={MARGIN_TOP} x2={crossX} y2={tableTop} stroke={strokeCross} strokeWidth={1} strokeDasharray="4 2" />
                {/* Horizontal pontilhada */}
                <line x1={MARGIN_LEFT} y1={crossY} x2={MARGIN_LEFT + chartW} y2={crossY} stroke={strokeCross} strokeWidth={1} strokeDasharray="4 2" />
                {/* Marcação do ponto */}
                <circle cx={crossX} cy={crossY} r={3} fill={strokeCross} stroke="none" />
                {/* Data/hora embaixo da vertical: fundo preto 80%, texto branco, quebra de linha (yyyy-mm-dd) */}
                {openTimeMs != null && (
                  <g>
                    <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={2} fill="#000000" fillOpacity={0.8} />
                    <text x={boxX + boxW / 2} y={boxY + boxPad + lineH - 1} textAnchor="middle" className="text-[10px] font-mono" fill="#ffffff">
                      {formatDateYyyyMmDd(openTimeMs)}
                    </text>
                    <text x={boxX + boxW / 2} y={boxY + boxPad + lineH * 2 - 1} textAnchor="middle" className="text-[10px] font-mono" fill="#ffffff">
                      {formatTimeLabel(openTimeMs)}
                    </text>
                  </g>
                )}
              </g>
            );
          })()}
          {/* Tooltip OHLC do candle só quando o ponto está dentro dos limites (min/max) do candle */}
          {(() => {
            const isOverCandle = crosshairPoint !== null && crosshairPoint.index >= startIndex && crosshairPoint.index < startIndex + windowN;
            if (!isOverCandle || !crosshairPoint) return null;
            const localIndex = crosshairPoint.index - startIndex;
            const k = windowSlice[localIndex];
            if (!k) return null;
            const openP = parseNum(k[1]);
            const highP = parseNum(k[2]);
            const lowP = parseNum(k[3]);
            const closeP = parseNum(k[4]);
            if (crosshairPoint.price < lowP || crosshairPoint.price > highP) return null;
            const openTimeMs = Number(k[0]);
            const prevK = localIndex > 0 ? windowSlice[localIndex - 1] : null;
            const prevClose = prevK ? parseNum(prevK[4]) : 0;
            const amplitude = closeP - openP;
            const amplitudePct = openP > 0 ? (amplitude / openP) * 100 : 0;
            const pctVsPrev = prevClose > 0 ? ((closeP - prevClose) / prevClose) * 100 : 0;
            const pctVsPrevStr = pctVsPrev >= 0 ? `+${pctVsPrev.toFixed(2)}%` : pctVsPrev.toFixed(2) + "%";
            const volume = parseNum(k[5]);
            const volumeUsdt = parseNum(k[7]);
            const x = cx(localIndex);
            const wickTop = y(highP);
            const bodyBottom = y(Math.min(openP, closeP));
            const tw = 130;
            const lineH = 11;
            const pad = 6;
            const numLines = 11;
            const th = pad * 2 + lineH * numLines;
            const tx = Math.max(MARGIN_LEFT + 4, Math.min(MARGIN_LEFT + chartW - tw - 4, x - tw / 2));
            const showAbove = wickTop - th - 4 >= MARGIN_TOP;
            const ty = showAbove ? wickTop - th - 4 : bodyBottom + 4;
            const fmt = (v: number) => formatYAxis(v);
            const y1 = ty + pad + 9;
            const blue = "#2563eb";
            const green = "#059669";
            const red = "#dc2626";
            return (
              <g pointerEvents="none" opacity={0.8}>
                <rect x={tx} y={ty} width={tw} height={th} rx={4} ry={4} fill="white" stroke="#e4e4e7" strokeWidth={1} />
                <text x={tx + pad} y={y1} className="text-[10px] font-mono" fill="#171717">{t.date}: {formatDateLabel(openTimeMs)}</text>
                <text x={tx + pad} y={y1 + lineH} className="text-[10px] font-mono" fill="#171717">{t.time}: {formatTimeLabel(openTimeMs)}</text>
                <text x={tx + pad} y={y1 + lineH * 2} className="text-[10px] font-mono font-medium" fill="#171717">{t.open}: {fmt(openP)}</text>
                <text x={tx + pad} y={y1 + lineH * 3} className="text-[10px] font-mono" fill="#171717">{t.high}: {fmt(highP)}</text>
                <text x={tx + pad} y={y1 + lineH * 4} className="text-[10px] font-mono" fill="#171717">{t.low}: {fmt(lowP)}</text>
                <text x={tx + pad} y={y1 + lineH * 5} className="text-[10px] font-mono" fill="#171717">{t.close}: {fmt(closeP)}</text>
                <text x={tx + pad} y={y1 + lineH * 6} className="text-[10px] font-mono" fill={blue}>{t.amplitude}: {fmt(amplitude)}</text>
                <text x={tx + pad} y={y1 + lineH * 7} className="text-[10px] font-mono" fill={blue}>{t.amplitudeVar}: {amplitudePct.toFixed(2)}%</text>
                <text x={tx + pad} y={y1 + lineH * 8} className="text-[10px] font-mono" fill={pctVsPrev >= 0 ? green : red}>{t.vsPrevClose} {pctVsPrevStr}</text>
                <text x={tx + pad} y={y1 + lineH * 9} className="text-[10px] font-mono" fill="#171717">{t.volumeBtc}: {formatAbbreviated(volume)}</text>
                <text x={tx + pad} y={y1 + lineH * 10} className="text-[10px] font-mono" fill="#171717">{t.volUsdt}: {formatAbbreviated(volumeUsdt)}</text>
              </g>
            );
          })()}
          {/* Overlay: clique define/atualiza crosshair; mousedown com crosshair ativo inicia arraste (somente quando não está no modo desenho) */}
          {!drawMode && (
            <rect
              ref={crosshairOverlayRef}
              x={MARGIN_LEFT}
              y={MARGIN_TOP}
              width={chartW}
              height={chartH}
              fill="transparent"
              style={{ cursor: crosshairDragging ? "grabbing" : crosshairPoint !== null ? "grab" : "crosshair" }}
              onMouseDown={(e) => {
                const overlay = crosshairOverlayRef.current;
                const dims = drawConversionRef.current;
                if (!overlay || !dims) return;
                const rect = overlay.getBoundingClientRect();
                const px = MARGIN_LEFT + (e.clientX - rect.left) * (dims.chartW / (rect.width || 1));
                const py = MARGIN_TOP + (e.clientY - rect.top) * (dims.chartH / (rect.height || 1));
                const toData = crosshairPixelToDataRef.current;
                if (!toData) return;
                const newPoint = toData(px, py);
                const isSamePoint = crosshairPoint !== null && crosshairPoint.index === newPoint.index && Math.abs(crosshairPoint.price - newPoint.price) < 1e-9;
                if (isSamePoint) {
                  setCrosshairPoint(null);
                  return;
                }
                const hadCrosshair = crosshairPoint !== null;
                setCrosshairPoint(newPoint);
                if (hadCrosshair) {
                  crosshairDraggingRef.current = true;
                  setCrosshairDragging(true);
                }
              }}
            />
          )}
          {/* Segmentos de reta desenhados (em dados: índice + preço; convertidos para pixel); cor e pontas (ponto/seta) */}
          {drawSegments.map((seg, idx) => {
            const p1 = segmentToPixel(seg.index1, seg.price1);
            const p2 = segmentToPixel(seg.index2, seg.price2);
            const strokeColor = seg.color ?? DEFAULT_SEGMENT_COLOR;
            const startCap = seg.startCap ?? "none";
            const endCap = seg.endCap ?? "none";
            const isSelected = selectedSegmentIndex === idx;
            const lineW = isSelected ? 2 : 1;
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const arrowLen = 8;
            const arrowW = 4;
            return (
              <g key={idx}>
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={strokeColor}
                  strokeWidth={lineW}
                />
                {startCap === "point" && <circle cx={p1.x} cy={p1.y} r={3} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />}
                {endCap === "point" && <circle cx={p2.x} cy={p2.y} r={3} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />}
                {startCap === "arrow" && (() => {
                  const tip = p1;
                  const u1 = (p1.x - p2.x) / len;
                  const u2 = (p1.y - p2.y) / len;
                  const backX = tip.x - arrowLen * u1;
                  const backY = tip.y - arrowLen * u2;
                  const leftX = backX - u2 * arrowW;
                  const leftY = backY + u1 * arrowW;
                  const rightX = backX + u2 * arrowW;
                  const rightY = backY - u1 * arrowW;
                  return <path d={`M ${tip.x} ${tip.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />;
                })()}
                {endCap === "arrow" && (() => {
                  const tip = p2;
                  const backX = tip.x - arrowLen * ux;
                  const backY = tip.y - arrowLen * uy;
                  const leftX = backX - uy * arrowW;
                  const leftY = backY + ux * arrowW;
                  const rightX = backX + uy * arrowW;
                  const rightY = backY - ux * arrowW;
                  return <path d={`M ${tip.x} ${tip.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />;
                })()}
                {seg.showPercent !== false && (() => {
                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;
                  const offset = 12;
                  const labelX = midX + uy * offset;
                  const labelY = midY - ux * offset;
                  const percent = seg.price1 !== 0 ? ((seg.price2 - seg.price1) / seg.price1) * 100 : 0;
                  const percentStr = percent >= 0 ? `+${percent.toFixed(4)}%` : `${percent.toFixed(4)}%`;
                  const i1 = Math.max(0, Math.min(seg.index1, n - 1));
                  const i2 = Math.max(0, Math.min(seg.index2, n - 1));
                  const openTime1 = fullReversed[i1]?.[0] ?? 0;
                  const openTime2 = fullReversed[i2]?.[0] ?? 0;
                  const days = Math.round((openTime2 - openTime1) / MS_PER_DAY);
                  const daysStr = `${days}d`;
                  const textColor = percent >= 0 ? "#059669" : "#dc2626";
                  const padW = 44;
                  const padH = 14;
                  return (
                    <g>
                      <rect x={labelX - padW} y={labelY - 12} width={padW * 2} height={padH * 2} rx={4} ry={4} fill="#ffffff" fillOpacity={0.8} stroke={textColor} strokeWidth={1} />
                      <text x={labelX} y={labelY} textAnchor="middle" fill={textColor} className="text-[10px] font-medium select-none" style={{ fontSize: 10 }}>
                        <tspan x={labelX} dy={0}>{percentStr}</tspan>
                        <tspan x={labelX} dy={11}>{daysStr}</tspan>
                      </text>
                    </g>
                  );
                })()}
                {seg.showValues === true && (() => {
                  const fmt = (v: number) => formatYAxis(v);
                  const v1 = fmt(seg.price1);
                  const v2 = fmt(seg.price2);
                  const vPadW = 34;
                  const vHeight = 16;
                  const textBaselineY = -6;
                  const textCenterY = textBaselineY - 5;
                  const rectY1 = p1.y + textCenterY - vHeight / 2;
                  const rectY2 = p2.y + textCenterY - vHeight / 2;
                  return (
                    <>
                      <rect x={p1.x - vPadW} y={rectY1} width={vPadW * 2} height={vHeight} rx={3} ry={3} fill="#ffffff" fillOpacity={0.8} stroke={strokeColor} strokeWidth={1} />
                      <text x={p1.x} y={p1.y - 6} textAnchor="middle" fill={strokeColor} className="text-[10px] font-medium select-none" style={{ fontSize: 10 }}>{v1}</text>
                      <rect x={p2.x - vPadW} y={rectY2} width={vPadW * 2} height={vHeight} rx={3} ry={3} fill="#ffffff" fillOpacity={0.8} stroke={strokeColor} strokeWidth={1} />
                      <text x={p2.x} y={p2.y - 6} textAnchor="middle" fill={strokeColor} className="text-[10px] font-medium select-none" style={{ fontSize: 10 }}>{v2}</text>
                    </>
                  );
                })()}
              </g>
            );
          })}
          {/* Primeiro ponto ao desenhar (aguardando segundo clique) */}
          {drawPending && (() => {
            const p = segmentToPixel(drawPending.index1, drawPending.price1);
            return <circle cx={p.x} cy={p.y} r={4} fill="none" stroke="#000000" strokeWidth={1} />;
          })()}
          {/* Overlay no modo desenho: captura cliques para segmento de reta ou seleção (evita que candles capturem) */}
          {drawMode && (
            <rect
              x={MARGIN_LEFT}
              y={MARGIN_TOP}
              width={chartW}
              height={chartH}
              fill="transparent"
              style={{ cursor: drawTool === "select" ? "pointer" : "crosshair" }}
              onClick={(e) => {
                if (!chartSvgRef.current) return;
                const svg = chartSvgRef.current;
                const rect = svg.getBoundingClientRect();
                const svgW = svg.width.baseVal.value;
                const svgH = svg.height.baseVal.value;
                const px = (e.nativeEvent.clientX - rect.left) * (svgW / rect.width);
                const py = (e.nativeEvent.clientY - rect.top) * (svgH / rect.height);
                if (drawTool === "select") {
                  const HIT_THRESHOLD = 12;
                  let bestIdx = -1;
                  let bestD = HIT_THRESHOLD;
                  drawSegments.forEach((seg, idx) => {
                    const p1 = segmentToPixel(seg.index1, seg.price1);
                    const p2 = segmentToPixel(seg.index2, seg.price2);
                    const d = distanceToSegment(px, py, p1.x, p1.y, p2.x, p2.y);
                    if (d < bestD) {
                      bestD = d;
                      bestIdx = idx;
                    }
                  });
                  setSelectedSegmentIndex(bestIdx >= 0 ? bestIdx : null);
                  return;
                }
                const d = snapToCandlePoint(px, py);
                if (drawPending === null) {
                  setDrawPending({ index1: d.index, price1: d.price });
                } else {
                  setDrawSegments((seg) => [...seg, { index1: drawPending.index1, price1: drawPending.price1, index2: d.index, price2: d.price, startCap: "point", endCap: "arrow", showPercent: true }]);
                  setDrawPending(null);
                }
              }}
            />
          )}
          {/* Handles do segmento selecionado (reajustar posição dos pontos); cor do segmento */}
          {drawMode && selectedSegmentIndex !== null && drawSegments[selectedSegmentIndex] && (() => {
            const seg = drawSegments[selectedSegmentIndex];
            const h1 = segmentToPixel(seg.index1, seg.price1);
            const h2 = segmentToPixel(seg.index2, seg.price2);
            const handleColor = seg.color ?? DEFAULT_SEGMENT_COLOR;
            return (
              <g pointerEvents="all">
                <circle
                  cx={h1.x}
                  cy={h1.y}
                  r={2.5}
                  fill={handleColor}
                  stroke={handleColor}
                  strokeWidth={1}
                  style={{ cursor: "grab" }}
                  onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 0 }); }}
                  onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 0 }); }}
                  onClick={(e) => e.stopPropagation()}
                />
                <circle
                  cx={h2.x}
                  cy={h2.y}
                  r={2.5}
                  fill={handleColor}
                  stroke={handleColor}
                  strokeWidth={1}
                  style={{ cursor: "grab" }}
                  onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 1 }); }}
                  onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 1 }); }}
                  onClick={(e) => e.stopPropagation()}
                />
              </g>
            );
          })()}
        </svg>
        {/* Eixo Y (USDT) — fixo à direita; último fechamento sempre visível — cor do texto rodapé/eixo Y */}
        <div className="flex-shrink-0 border-l border-zinc-200" style={{ backgroundColor: footerYAxisHex }}>
          <svg width={Y_AXIS_WIDTH} height={chartHeight} className="text-[10px] font-mono">
            {yTickValues.map((v, i) => (
              <text
                key={i}
                x={Y_AXIS_WIDTH - 6}
                y={y(v) + 4}
                textAnchor="end"
                fill={footerYAxisTextHex}
              >
                {formatYAxis(v)}
              </text>
            ))}
            {showLastClose && (
              <g>
                <rect
                  x={yAxisAbbreviated ? Y_AXIS_WIDTH - 52 : Y_AXIS_WIDTH - 62}
                  y={lastCloseY - 7}
                  width={yAxisAbbreviated ? 46 : 56}
                  height={14}
                  fill={isDarkFooterYAxis ? "#3f3f46" : "white"}
                  stroke={isDarkFooterYAxis ? "#52525b" : "#e4e4e7"}
                  strokeWidth={1}
                  rx={2}
                />
                <text
                  x={Y_AXIS_WIDTH - 6}
                  y={lastCloseY + 4}
                  textAnchor="end"
                  className="font-semibold"
                  fill={lastCloseTextHex}
                >
                  {formatYAxis(lastClose)}
                </text>
              </g>
            )}
            {showIndicatorLastValueOnYAxis && indicatorLines.map((ind, indIdx) => {
              const lastVal = n > 0 ? (() => {
                const v = klines[0][ind.columnIndex];
                return v != null && typeof v === "number" && Number.isFinite(v) ? v : null;
              })() : null;
              if (lastVal == null) return null;
              const lastValY = y(lastVal);
              const inRange = lastVal >= yMin && lastVal <= yMax;
              if (!inRange) return null;
              return (
                <g key={indIdx}>
                  <rect
                    x={yAxisAbbreviated ? Y_AXIS_WIDTH - 52 : Y_AXIS_WIDTH - 62}
                    y={lastValY - 7}
                    width={yAxisAbbreviated ? 46 : 56}
                    height={14}
                    fill="white"
                    fillOpacity={0.9}
                    stroke="#e4e4e7"
                    strokeWidth={1}
                    rx={2}
                  />
                  <text
                    x={Y_AXIS_WIDTH - 6}
                    y={lastValY + 4}
                    textAnchor="end"
                    className="font-semibold font-mono text-[10px]"
                    fill={ind.color}
                  >
                    {formatYAxis(lastVal)}
                  </text>
                </g>
              );
            })}
            {/* Marcador do crosshair no eixo Y: valor + percentual (visível sobre candle ou durante arraste) */}
            {crosshairPoint !== null && (crosshairPoint.index >= startIndex && crosshairPoint.index < startIndex + windowN || crosshairDragging) && (() => {
              const crossY = y(crosshairPoint.price);
              const pctVsLast = lastClose > 0 ? ((crosshairPoint.price - lastClose) / lastClose) * 100 : 0;
              const pctStr = pctVsLast >= 0 ? `+${pctVsLast.toFixed(2)}%` : pctVsLast.toFixed(2) + "%";
              const pctColor = pctVsLast >= 0 ? "#059669" : "#dc2626";
              const boxH = 28;
              const boxY = crossY - 8;
              return (
                <g>
                  <rect
                    x={yAxisAbbreviated ? Y_AXIS_WIDTH - 52 : Y_AXIS_WIDTH - 62}
                    y={boxY}
                    width={yAxisAbbreviated ? 46 : 56}
                    height={boxH}
                    fill={isDarkFooterYAxis ? "#3f3f46" : "white"}
                    stroke={lineTableHex}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    rx={2}
                  />
                  <text
                    x={Y_AXIS_WIDTH - 6}
                    y={crossY + 4}
                    textAnchor="end"
                    className="font-mono font-medium"
                    fill={footerYAxisTextHex}
                  >
                    {formatYAxis(crosshairPoint.price)}
                  </text>
                  <text
                    x={Y_AXIS_WIDTH - 6}
                    y={crossY + 15}
                    textAnchor="end"
                    className="text-[10px] font-mono"
                    fill={pctColor}
                  >
                    {pctStr}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>
        </div>
      </div>
      </div>
      <div
        className={`px-3 pt-3 pb-2 text-[10px] border-t flex items-center justify-end gap-3 flex-wrap ${footerYAxisBgColor >= 4 ? "border-zinc-600" : "border-zinc-100"}`}
        style={{ backgroundColor: footerYAxisHex, color: footerYAxisTextHex }}
      >
        {saveLoadMsg && <span className="mr-auto text-emerald-600 font-medium">{saveLoadMsg}</span>}
        <span className="mr-auto">BTCUSDT {intervalLabel ?? `${groupMinutes}m`} · USDT</span>
        <div className="flex items-center gap-2">
          <label htmlFor="candles-listbox">{t.candles}:</label>
          <select
            id="candles-listbox"
            value={visibleCount}
            onChange={(e) => setVisibleCount(Number(e.target.value) as VisibleCount)}
            aria-label={t.candlesAria}
            className={`text-[10px] font-medium rounded px-1.5 py-0.5 cursor-pointer ${isDarkFooterYAxis ? "text-zinc-100 bg-zinc-600 border-zinc-500 border" : "text-zinc-700 bg-zinc-100 border border-zinc-200"}`}
          >
            {VISIBLE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStartIndex((i) => Math.max(0, i - Math.floor(visibleCount / 2)))}
            disabled={!canPrev}
            className={`px-2 py-0.5 rounded border disabled:opacity-40 disabled:cursor-not-allowed ${isDarkFooterYAxis ? "border-zinc-500 hover:bg-zinc-600" : "border-zinc-200 hover:bg-zinc-100"}`}
          >
            {t.previous}
          </button>
          <button
            type="button"
            onClick={() => setStartIndex((i) => Math.min(n - visibleCount, i + visibleCount))}
            disabled={!canNext}
            className={`px-2 py-0.5 rounded border disabled:opacity-40 disabled:cursor-not-allowed ${isDarkFooterYAxis ? "border-zinc-500 hover:bg-zinc-600" : "border-zinc-200 hover:bg-zinc-100"}`}
          >
            {t.next}
          </button>
        </div>
      </div>
    </div>
  );
}
