"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { API_BASE } from "@/app/constants";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { useAppBarSafe } from "@/app/AppBarSafeContext";
import { getCryptoT } from "@/app/lib/translations";
import { useChartSymbol } from "../ChartSymbolContext";
import { useKlinesIndicators } from "../KlinesIndicatorsContext";
import { getIndicatorLabel } from "../IndicatorsPanel";
import { useStrategies } from "./StrategiesContext";
import { useChartLayoutSave } from "../ChartLayoutSaveContext";
import { KLINE_LAST_LAYOUT_KEY, DEFAULT_MODEL_MAX_STRATEGIES } from "../KlinesChartConstants";
import { INDICATOR_COLOR_PALETTE } from "../indicatorsPanel/indicatorsPanelConstants";
import {
  type Strategy,
  type StrategyNode,
  type StrategyGroupNode,
  type StrategyConditionNode,
  type StrategyNotNode,
  type StrategyOperand,
  type StrategyOperator,
  type StrategyConditionKind,
  STRATEGY_MAX_CONDITIONS,
  STRATEGY_OPERATORS,
  STRATEGY_OFFSET_MIN,
  STRATEGY_OFFSET_MAX,
  STRATEGY_BARSAFTER_MIN,
  STRATEGY_BARSAFTER_MAX,
  countConditionLeaves,
  createEmptyGroup,
  createEmptyCondition,
  createCombinedCondition,
  createEmptyNot,
  normalizeOffset,
  normalizeBarsAfter,
  intervalMinutesToLabel,
  replaceInNode,
  validateStrategyReferences,
} from "./strategiesTypes";

function generateId(): string {
  return `str_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Ícone "?" clicável que abre um popover com o texto de ajuda. Renderizado em portal para ficar sempre por cima do painel. */
function HelpPopover({ content, className }: { content: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPosition({ left: rect.left, top: rect.bottom + 4 });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <>
      <span className={`relative inline-flex ${className ?? ""}`} ref={ref}>
        <button
          type="button"
          onClick={toggle}
          className="w-5 h-5 rounded-full border border-zinc-300 bg-zinc-100 text-zinc-600 flex items-center justify-center text-xs font-medium hover:bg-zinc-200 shrink-0"
          aria-label={content}
        >
          ?
        </button>
      </span>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[9999] min-w-[160px] max-w-[260px] px-2.5 py-2 text-xs text-zinc-700 bg-zinc-100 border border-zinc-300 rounded shadow-lg"
            style={{ left: position.left, top: position.top }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}

/** Combobox para escolher série/indicador: botão com label + dropdown (lista com scroll até 200px, largura ao texto). */
function SeriesCombobox({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: { key: string; label: string }[];
  onChange: (key: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.key === value);
  const label = selected?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel ?? "Series"}
        onClick={() => setOpen((o) => !o)}
        className="text-xs border border-zinc-300 rounded px-1.5 py-1 bg-white text-left w-max min-w-[6rem] flex items-center justify-between gap-1"
      >
        <span>{label}</span>
        <span className="text-zinc-500 shrink-0" aria-hidden>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel ?? "Series"}
          className="absolute left-0 top-full mt-0.5 z-20 min-w-full w-max max-h-[200px] overflow-y-scroll rounded border border-zinc-200 bg-white shadow-lg py-0.5 series-combobox-listbox"
        >
          <div className="series-combobox-listbox-inner">
            {options.map((o) => {
              const isSelected = o.key === value;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  className={`w-full text-left text-xs px-2 py-1.5 whitespace-nowrap hover:bg-zinc-100 ${isSelected ? "bg-zinc-100 font-medium" : ""}`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Padrão ANSI: apenas letras (a-z, A-Z), números, underscore e hífen. Sem espaços nem acentos. */
function normalizeStrategyName(s: string): string {
  const withoutAccents = s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return withoutAccents.replace(/[^a-zA-Z0-9_-]/g, "");
}


/** Substitui um nó na árvore pelo id (só em filhos diretos de grupo; para nós dentro de NOT usa replaceInNode). */
function replaceNodeInTree(
  root: StrategyGroupNode,
  nodeId: string,
  replace: (parent: StrategyGroupNode, index: number, node: StrategyNode) => StrategyNode[] | null
): StrategyGroupNode | null {
  if (root.id === nodeId) return null;
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    if (child.id === nodeId) {
      const newChildren = replace(root, i, child);
      if (newChildren == null) return null;
      return { ...root, children: newChildren };
    }
    if (child.type === "group") {
      const updated = replaceNodeInTree(child, nodeId, replace);
      if (updated) return { ...root, children: root.children.map((c, j) => (j === i ? updated : c)) };
    }
  }
  return null;
}

/** Atualiza um nó na árvore pelo id (inclui nós dentro de NOT). */
function updateNodeInTree(
  root: StrategyGroupNode,
  nodeId: string,
  updater: (node: StrategyNode) => StrategyNode
): StrategyGroupNode {
  return replaceInNode(root, nodeId, updater) as StrategyGroupNode;
}


interface StrategiesPanelProps {
  onClose?: () => void;
  /** 'list' = lista de estratégias; 'add' = abre direto o formulário de criar. */
  initialView?: "list" | "add";
}

export default function StrategiesPanel({ onClose, initialView = "list" }: StrategiesPanelProps) {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.strategies as Record<string, string>;
  const { hideStatusBar } = useAppBarSafe();
  const { userIndicators, currentGroupMinutes } = useKlinesIndicators();
  const { symbol } = useChartSymbol();
  const { strategies, appliedStrategyIds, addStrategy, updateStrategy, removeStrategy, applyStrategy, unapplyStrategy, isApplied } = useStrategies();
  const chartLayoutSave = useChartLayoutSave();
  /** Estratégias combinadas atualmente aplicadas. */
  const appliedCombinedStrategies = useMemo(
    () => strategies.filter((s) => s.isCombined && appliedStrategyIds.includes(s.id)),
    [strategies, appliedStrategyIds]
  );
  /** Verifica se uma combinada "cobre" o símbolo S (aplicável a esse símbolo). */
  const combinedCoversSymbol = useCallback((c: Strategy, sym: string | null) => c.applyToAllSymbols || c.symbol === sym, []);
  /** IDs das estratégias normais bloqueadas: só as do mesmo símbolo que alguma combinada aplicada (ou do símbolo atual se combinada for "qualquer símbolo"). */
  const blockedNormalIds = useMemo(() => {
    const set = new Set<string>();
    strategies
      .filter((s) => !s.isCombined)
      .forEach((norm) => {
        const symbolOfNorm = norm.applyToAllSymbols ? symbol : (norm.symbol ?? symbol);
        const blocked = appliedCombinedStrategies.some((c) => combinedCoversSymbol(c, symbolOfNorm));
        if (blocked) set.add(norm.id);
      });
    return set;
  }, [strategies, appliedCombinedStrategies, symbol, combinedCoversSymbol]);
  const [validationModal, setValidationModal] = useState<{ title: string; lines: string[] } | null>(null);
  const [deleteConfirmStrategy, setDeleteConfirmStrategy] = useState<{ id: string; name: string } | null>(null);
  const [addOpen, setAddOpen] = useState(initialView === "add");
  const [editingStrategyId, setEditingStrategyId] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addRootStrategies, setAddRootStrategies] = useState<StrategyGroupNode>(() => createEmptyGroup("AND"));
  const [addRootCombined, setAddRootCombined] = useState<StrategyGroupNode>(() => createEmptyGroup("AND"));
  /** Modo do formulário de criar: "current" = indicadores + OHLC; "combined" = só estratégias criadas. */
  const [addStrategyMode, setAddStrategyMode] = useState<"current" | "combined">("current");
  const addRoot = addStrategyMode === "combined" ? addRootCombined : addRootStrategies;
  const setAddRoot = useCallback(
    (r: StrategyGroupNode) => {
      if (addStrategyMode === "combined") setAddRootCombined(r);
      else setAddRootStrategies(r);
    },
    [addStrategyMode]
  );
  const [addApplyToAllSymbols, setAddApplyToAllSymbols] = useState(false);
  /** Cor do candle quando a condição é verdadeira (mesma paleta das médias móveis). */
  const [addColor, setAddColor] = useState<string>(() => INDICATOR_COLOR_PALETTE?.[2] ?? "#ef4444");
  const [addColorOpen, setAddColorOpen] = useState(false);
  /** true = só do símbolo atual (ou "qualquer símbolo"); false = todas as estratégias. */
  const [showOnlyCurrentSymbol, setShowOnlyCurrentSymbol] = useState(true);

  const chartIntervalMinutes = currentGroupMinutes ?? 5;
  const chartIntervalLabel = intervalMinutesToLabel(chartIntervalMinutes);

  /** Persiste no banco apenas appliedStrategyIds (ativação/inativação por estratégia). */
  const saveActivationToServer = useCallback(async (nextAppliedIds: string[]) => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY) : null;
    if (!raw || raw === "default") return;
    const slot = Number(raw);
    if (!Number.isInteger(slot) || slot < 1 || slot > 7) return;
    try {
      await fetch(`${API_BASE}/chart-layouts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slot, appliedStrategyIds: nextAppliedIds }),
      });
    } catch {
      /* ignore */
    }
  }, []);

  /** Estratégias a exibir: do símbolo atual ou aplicáveis a qualquer símbolo. */
  const visibleStrategies = useMemo(
    () => strategies.filter((s) => s.applyToAllSymbols === true || s.symbol === symbol),
    [strategies, symbol]
  );
  /** Lista efetiva conforme o alternador: só do símbolo ou todas. */
  const listStrategies = showOnlyCurrentSymbol ? visibleStrategies : strategies;

  /** Estratégias normais e combinadas em ordem alfabética, para exibir com divisor. */
  const { listNormals, listCombined } = useMemo(() => {
    const normals = listStrategies.filter((s) => !s.isCombined).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    const combined = listStrategies.filter((s) => s.isCombined).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return { listNormals: normals, listCombined: combined };
  }, [listStrategies]);

  const tKlines = getCryptoT(lang).sistema.klines;
  /** Painel padrão por tipo (igual ao do gráfico). */
  const getIndicatorPanel = (ind: (typeof userIndicators)[0]) =>
    ind.panel ?? (ind.type === "RSI" || ind.type === "MFI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "AD" || ind.type === "ATR" || ind.type === "ADX" || ind.type === "Volume" || ind.type === "CCI" || ind.type === "CMF" ? "panel2" : "main");
  const panelToNum = (p: string) => (p === "main" ? 1 : p === "panel2" ? 2 : p === "panel3" ? 3 : p === "panel4" ? 4 : p === "panel5" ? 5 : 1);
  const seriesOptions = useMemo(() => {
    const tStrat = getCryptoT(lang).sistema.strategies as Record<string, string>;
    const fnShort = tStrat.seriesFunctionsShort ?? "F";
    const opts: { key: string; label: string }[] = [
      { key: "open", label: `(1) ${tKlines.fieldOpen ?? "Open"}` },
      { key: "high", label: `(1) ${tKlines.fieldHigh ?? "High"}` },
      { key: "low", label: `(1) ${tKlines.fieldLow ?? "Low"}` },
      { key: "close", label: `(1) ${tKlines.fieldClose ?? "Close"}` },
      { key: "volume", label: `(1) ${(tKlines as Record<string, string>).volumeBaseLabel ?? tKlines.volumeBtc ?? "Vol (base)"}` },
      { key: "volumeUsdt", label: `(1) ${(tKlines as Record<string, string>).volumeUsdtLabel ?? "Vol (USDT)"}` },
      // Funções calculadas a partir de OHLC (sem coluna na tabela)
      { key: "HL2", label: `(${fnShort}) ${(tKlines as Record<string, string>).fieldHL2 ?? "HL2"}` },
      { key: "HLC3", label: `(${fnShort}) ${(tKlines as Record<string, string>).fieldHLC3 ?? "HLC3"}` },
      { key: "OHLC4", label: `(${fnShort}) ${(tKlines as Record<string, string>).fieldOHLC4 ?? "OHLC4"}` },
      { key: "HLCC4", label: `(${fnShort}) ${(tKlines as Record<string, string>).fieldHLCC4 ?? "HLCC4"}` },
    ];
    userIndicators.forEach((ind) => {
      const panel = getIndicatorPanel(ind);
      const num = panelToNum(panel);
      // Bollinger: nome da fonte (BB(period,Z) + campo) + bandas/meio abreviados
      if (ind.type === "Bollinger") {
        const indLabel = getIndicatorLabel(ind, tKlines, userIndicators);
        const t = tKlines as Record<string, string>;
        const upperLabel = t.bollingerShortUpper ?? "Up";
        const middleLabel = t.bollingerShortMiddle ?? "Mid";
        const lowerLabel = t.bollingerShortLower ?? "Lo";
        opts.push({ key: `ind_${ind.id}:upper`, label: `(${num}) ${indLabel} – ${upperLabel}` });
        opts.push({ key: `ind_${ind.id}:middle`, label: `(${num}) ${indLabel} – ${middleLabel}` });
        opts.push({ key: `ind_${ind.id}:lower`, label: `(${num}) ${indLabel} – ${lowerLabel}` });
        return;
      }
      // Donchian: nome da fonte (DC(period) + campo) + bandas/meio abreviados
      if (ind.type === "Donchian") {
        const indLabel = getIndicatorLabel(ind, tKlines, userIndicators);
        const t = tKlines as Record<string, string>;
        const upperLabel = t.donchianShortUpper ?? "Up";
        const middleLabel = t.donchianShortMiddle ?? "Mid";
        const lowerLabel = t.donchianShortLower ?? "Lo";
        opts.push({ key: `ind_${ind.id}:upper`, label: `(${num}) ${indLabel} – ${upperLabel}` });
        opts.push({ key: `ind_${ind.id}:middle`, label: `(${num}) ${indLabel} – ${middleLabel}` });
        opts.push({ key: `ind_${ind.id}:lower`, label: `(${num}) ${indLabel} – ${lowerLabel}` });
        return;
      }
      // Keltner: nome da fonte (getIndicatorLabel = KC(period,mult) + campo ex. Fech.) + bandas/meio abreviados
      if (ind.type === "Keltner") {
        const indLabel = getIndicatorLabel(ind, tKlines, userIndicators);
        const t = tKlines as Record<string, string>;
        const upperLabel = t.keltnerShortUpper ?? "Up";
        const middleLabel = t.keltnerShortMiddle ?? "Mid";
        const lowerLabel = t.keltnerShortLower ?? "Lo";
        opts.push({ key: `ind_${ind.id}:upper`, label: `(${num}) ${indLabel} – ${upperLabel}` });
        opts.push({ key: `ind_${ind.id}:middle`, label: `(${num}) ${indLabel} – ${middleLabel}` });
        opts.push({ key: `ind_${ind.id}:lower`, label: `(${num}) ${indLabel} – ${lowerLabel}` });
        return;
      }
      // ADX: só as 3 colunas (+DI, -DI, ADX), sem opção genérica
      if (ind.type === "ADX") {
        const adxLabel = getIndicatorLabel(ind, tKlines, userIndicators);
        opts.push({ key: `ind_${ind.id}:plusDi`, label: `(${num}) +DI (${adxLabel})` });
        opts.push({ key: `ind_${ind.id}:minusDi`, label: `(${num}) -DI (${adxLabel})` });
        opts.push({ key: `ind_${ind.id}:adx`, label: `(${num}) ADX (${adxLabel})` });
        return;
      }
      // Ichimoku: 5 colunas (Tenkan, Kijun, Span A, Span B, Chikou), sem opção genérica
      if (ind.type === "Ichimoku") {
        const indLabel = getIndicatorLabel(ind, tKlines, userIndicators);
        opts.push({ key: `ind_${ind.id}:tenkan`, label: `(${num}) ${indLabel} – Tenkan` });
        opts.push({ key: `ind_${ind.id}:kijun`, label: `(${num}) ${indLabel} – Kijun` });
        opts.push({ key: `ind_${ind.id}:spanA`, label: `(${num}) ${indLabel} – Span A` });
        opts.push({ key: `ind_${ind.id}:spanB`, label: `(${num}) ${indLabel} – Span B` });
        opts.push({ key: `ind_${ind.id}:chikou`, label: `(${num}) ${indLabel} – Chikou` });
        return;
      }
      opts.push({ key: `ind_${ind.id}`, label: `(${num}) ${getIndicatorLabel(ind, tKlines, userIndicators)}` });
      // - MACD: Signal e Histogram
      if (ind.type === "MACD" && ind.macdSignalLine) {
        const sigLabel = (tKlines as Record<string, string>).macdSignalLabel
          ? String((tKlines as Record<string, string>).macdSignalLabel).replace("{period}", String(ind.macdSignalPeriod ?? 9))
          : `MACD Signal(${ind.macdSignalPeriod ?? 9})`;
        opts.push({ key: `ind_${ind.id}:sig`, label: `(${num}) ${sigLabel}` });
        if (ind.macdHistogram) {
          const histLabel = (tKlines as Record<string, string>).macdHistogramLabel ?? "MACD (histogram)";
          opts.push({ key: `ind_${ind.id}:hist`, label: `(${num}) ${histLabel}` });
        }
      }
      // - Stochastic: %D
      if (ind.type === "Stochastic" && ind.stochDLine) {
        const dLabel = (tKlines as Record<string, string>).stochDLabel
          ? String((tKlines as Record<string, string>).stochDLabel).replace("{period}", String(ind.stochDPeriod ?? 3))
          : `Stoch %D(${ind.stochDPeriod ?? 3})`;
        opts.push({ key: `ind_${ind.id}:d`, label: `(${num}) ${dLabel}` });
      }
    });
    return opts;
  }, [lang, userIndicators, tKlines]);

  /** No modo combinado: lista só colunas de estratégias criadas (estratégia e valor na visualização = comparação com constante). */
  /** No modo combinado só aparecem estratégias normais (não combinadas), para montar "está verdadeira/falsa". */
  const seriesOptionsCombined = useMemo(() => {
    return listStrategies
      .filter((s) => !s.isCombined)
      .map((s) => ({ key: `strat_${s.id}`, label: s.name }));
  }, [listStrategies]);

  const seriesOptionsForForm = addStrategyMode === "combined" ? seriesOptionsCombined : seriesOptions;

  const canUseCombinedMode = visibleStrategies.length >= 2;

  const rawLayout = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY) : null;
  const isDefaultModel = rawLayout === "default" || rawLayout === "0";
  const defaultModelMaxStrategiesReached = isDefaultModel && strategies.length >= DEFAULT_MODEL_MAX_STRATEGIES;

  useEffect(() => {
    if (addStrategyMode === "combined" && !canUseCombinedMode) setAddStrategyMode("current");
  }, [addStrategyMode, canUseCombinedMode]);

  useEffect(() => {
    if (addStrategyMode === "combined" && !editingStrategyId) setAddApplyToAllSymbols(false);
  }, [addStrategyMode, editingStrategyId]);

  const totalConditions = countConditionLeaves(addRoot);
  const canAddMore = totalConditions < STRATEGY_MAX_CONDITIONS;

  const handleSaveStrategy = () => {
    const raw = addName.trim() || t.defaultStrategyName;
    const name = normalizeStrategyName(raw).slice(0, 36);
    if (!name) {
      setValidationModal({
        title: t.validationErrorTitle ?? "Validation error",
        lines: [t.strategyNameInvalid ?? "Use only letters (a-z, A-Z), numbers, underscore and hyphen. No spaces or accents."],
      });
      return;
    }
    if (addRoot.children.length === 0) return;
    if (!editingStrategyId && defaultModelMaxStrategiesReached) {
      setValidationModal({
        title: t.validationErrorTitle ?? "Validation error",
        lines: [(t as Record<string, string>).defaultModelMaxStrategies ?? "Only one strategy allowed on default model. Save to a layout (1–7) to add more."],
      });
      return;
    }
    const isCombined = addStrategyMode === "combined";
    const applyToAll = addApplyToAllSymbols;
    const strategySymbol = applyToAll ? undefined : (symbol || undefined);
    if (!applyToAll && !strategySymbol) {
      setValidationModal({
        title: t.validationErrorTitle ?? "Validation error",
        lines: [(t as Record<string, string>).strategyCombinedNeedSymbol ?? "Marque 'qualquer símbolo' ou selecione um par no gráfico."],
      });
      return;
    }
    if (editingStrategyId) {
      const updates = { name, root: addRoot, applyToAllSymbols: applyToAll, symbol: strategySymbol, color: addColor, isCombined };
      updateStrategy(editingStrategyId, updates);
      const nextStrategies = strategies.map((s) => (s.id === editingStrategyId ? { ...s, ...updates } : s));
      chartLayoutSave?.saveLayoutNow("strategies", { strategies: nextStrategies, appliedStrategyIds });
      setEditingStrategyId(null);
    } else {
      const strategy: Strategy = {
        id: generateId(),
        name,
        root: addRoot,
        intervalMinutes: chartIntervalMinutes,
        applyToAllSymbols: applyToAll,
        symbol: strategySymbol,
        color: addColor,
        isCombined,
      };
      addStrategy(strategy);
      chartLayoutSave?.saveLayoutNow("strategies", { strategies: [...strategies, strategy], appliedStrategyIds });
    }
    setAddName("");
    setAddRootStrategies(createEmptyGroup("AND"));
    setAddRootCombined(createEmptyGroup("AND"));
    setAddApplyToAllSymbols(false);
    setAddColor(INDICATOR_COLOR_PALETTE?.[2] ?? "#ef4444");
    setAddColorOpen(false);
    setAddOpen(false);
  };

  const openEdit = (s: Strategy) => {
    setAddName(s.name);
    const mode: "current" | "combined" = s.isCombined ? "combined" : "current";
    setAddStrategyMode(mode);
    const rootCopy = JSON.parse(JSON.stringify(s.root)) as StrategyGroupNode;
    setAddRootStrategies(mode === "current" ? rootCopy : createEmptyGroup("AND"));
    setAddRootCombined(mode === "combined" ? rootCopy : createEmptyGroup("AND"));
    setAddApplyToAllSymbols(s.applyToAllSymbols ?? false);
    setAddColor(s.color ?? INDICATOR_COLOR_PALETTE?.[2] ?? "#ef4444");
    setEditingStrategyId(s.id);
    setAddOpen(true);
  };

  return (
    <div
      className={`fixed inset-y-0 left-0 z-[1301] flex flex-col bg-white border-r border-zinc-200 shadow-xl overflow-hidden w-[66.666vw] sm:w-[33.333vw] max-w-[400px] ${hideStatusBar === false ? "crypto-status-bar-reserve" : ""}`}
      role="dialog"
      aria-label={t.panelTitle}
    >
      {validationModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label={validationModal.title}>
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-900">{validationModal.title}</h3>
              <button type="button" onClick={() => setValidationModal(null)} className="p-1 rounded hover:bg-zinc-200 text-zinc-600" aria-label={t.close ?? "Close"}>
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <div className="px-4 py-3 text-sm text-zinc-700">
              {validationModal.lines.length <= 1 ? (
                <p className="whitespace-pre-wrap">{validationModal.lines[0] ?? ""}</p>
              ) : (
                <ul className="list-disc pl-5 space-y-1">
                  {validationModal.lines.map((line, i) => (
                    <li key={i} className="whitespace-pre-wrap">{line}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-4 py-3 border-t border-zinc-200 bg-white flex justify-end">
              <button
                type="button"
                onClick={() => setValidationModal(null)}
                className="crypto-btn rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-2"
              >
                {t.modalOk ?? "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirmStrategy && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label={(t as Record<string, string>).strategyDeleteConfirmTitle ?? "Excluir estratégia"}>
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-900">{(t as Record<string, string>).strategyDeleteConfirmTitle ?? "Excluir estratégia"}</h3>
              <button type="button" onClick={() => setDeleteConfirmStrategy(null)} className="p-1 rounded hover:bg-zinc-200 text-zinc-600" aria-label={t.close ?? "Close"}>
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <div className="px-4 py-3 text-sm text-zinc-700">
              <p>{(t as Record<string, string>).strategyDeleteConfirmMessage?.replace("{name}", deleteConfirmStrategy.name) ?? `Excluir a estratégia "${deleteConfirmStrategy.name}"? Esta ação não pode ser desfeita.`}</p>
            </div>
            <div className="px-4 py-3 border-t border-zinc-200 bg-white flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmStrategy(null)}
                className="crypto-btn rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 font-medium px-4 py-2"
              >
                {t.cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToRemove = deleteConfirmStrategy.id;
                  removeStrategy(idToRemove);
                  setDeleteConfirmStrategy(null);
                  const nextStrategies = strategies.filter((s) => s.id !== idToRemove);
                  const nextAppliedIds = appliedStrategyIds.filter((id) => id !== idToRemove);
                  chartLayoutSave?.saveLayoutNow("strategies", { strategies: nextStrategies, appliedStrategyIds: nextAppliedIds });
                }}
                className="crypto-btn rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2"
              >
                {(t as Record<string, string>).strategyConfirmDelete ?? "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-zinc-50">
        <h2 className="text-sm font-semibold text-zinc-800">{t.panelTitle}</h2>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-zinc-200 text-zinc-600" aria-label={t.close}>
            <span className="text-lg leading-none">×</span>
          </button>
        )}
      </div>
      <div className="panel-scroll flex-1 min-h-0 overflow-auto p-3 space-y-4">
        {!addOpen && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-md border border-zinc-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowOnlyCurrentSymbol(true)}
                  className={`text-xs px-2.5 py-1 ${showOnlyCurrentSymbol ? "bg-zinc-200 font-medium text-zinc-800" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
                >
                  {symbol || (t.strategiesFilterSymbol ?? "Só do símbolo")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOnlyCurrentSymbol(false)}
                  className={`text-xs px-2.5 py-1 border-l border-zinc-300 ${!showOnlyCurrentSymbol ? "bg-zinc-200 font-medium text-zinc-800" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
                >
                  {t.strategiesFilterAll ?? "Todas"}
                </button>
              </div>
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                {t.chartInterval}: <strong>{chartIntervalLabel}</strong>
                <HelpPopover content={t.strategyInterval} />
              </span>
            </div>
          </>
        )}
        {!addOpen ? (
          <>
            {listNormals.length === 0 && listCombined.length === 0 ? (
              <p className="text-sm text-zinc-500">{t.noStrategies}</p>
            ) : (
              <ul className="space-y-2">
                {listNormals.map((s) => {
                  const applied = isApplied(s.id);
                  const blocked = blockedNormalIds.has(s.id);
                  const onApply = () => {
                    const indicatorIds = new Set(userIndicators.map((i) => i.id));
                    const strategyIds = new Set(appliedStrategyIds);
                    const result = validateStrategyReferences(s, indicatorIds, strategyIds);
                    if (!result.ok) {
                      const lines = result.missingIds.map((id) =>
                        (t.strategyApplyErrorMissingIndicator ?? "Could not find indicator (id: {id}).")
                          .replace("{id}", id)
                      );
                      setValidationModal({
                        title: t.validationErrorTitle ?? "Validation error",
                        lines,
                      });
                      return;
                    }
                    applyStrategy(s.id);
                    saveActivationToServer([...appliedStrategyIds, s.id]);
                  };
                  const onUnapply = () => {
                    unapplyStrategy(s.id);
                    saveActivationToServer(appliedStrategyIds.filter((id) => id !== s.id));
                  };
                  const blockTitle = (t as Record<string, string>).strategyBlockedByCombined ?? "Desative a estratégia combinada para editar, aplicar ou excluir.";
                  return (
                    <li
                      key={s.id}
                      className={`flex flex-col gap-2 p-2 rounded-md border border-zinc-200 sm:flex-row sm:items-center sm:justify-between ${blocked ? "bg-zinc-100/80 opacity-70" : "bg-zinc-50"}`}
                      title={blocked ? blockTitle : undefined}
                    >
                      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-zinc-800 break-words">{s.name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 shrink-0">
                            {intervalMinutesToLabel(s.intervalMinutes)}
                          </span>
                          {blocked && (
                            <span className="text-xs text-amber-700 shrink-0" title={blockTitle}>
                              🔒
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {s.isCombined && <span className="text-violet-600">{(t as Record<string, string>).strategyTagCombined ?? "Combinada"} · </span>}
                          {s.isCombined ? (s.applyToAllSymbols ? t.anySymbol : (s.symbol ?? "")) : (s.applyToAllSymbols ? t.anySymbol : (s.symbol ?? ""))}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => !blocked && openEdit(s)}
                          disabled={blocked}
                          className="text-xs px-2 py-1 rounded border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 disabled:opacity-70 disabled:cursor-not-allowed"
                          title={blocked ? blockTitle : t.editStrategy}
                        >
                          {t.editStrategy}
                        </button>
                        {applied ? (
                          <button
                            type="button"
                            onClick={() => !blocked && onUnapply()}
                            disabled={blocked}
                            className="text-xs px-2 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                            {t.removeFromTable}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => !blocked && onApply()}
                            disabled={blocked}
                            className="text-xs px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                            {t.applyStrategy}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => !blocked && setDeleteConfirmStrategy({ id: s.id, name: s.name })}
                          disabled={blocked}
                          className="p-1 rounded text-zinc-500 hover:text-red-600 hover:bg-zinc-200 disabled:opacity-70 disabled:cursor-not-allowed"
                          aria-label={t.delete}
                          title={blocked ? blockTitle : t.delete}
                        >
                          🗑️
                        </button>
                      </div>
                    </li>
                  );
                })}
                {listNormals.length > 0 && listCombined.length > 0 && (
                  <li key="divider-combined" className="py-2" aria-hidden>
                    <hr className="border-zinc-300" />
                    <span className="text-xs font-medium text-zinc-500 mt-2 block">
                      {(t as Record<string, string>).strategySectionCombined ?? "Combinadas"}
                    </span>
                  </li>
                )}
                {listCombined.map((s) => {
                  const applied = isApplied(s.id);
                  const onApply = () => {
                    const indicatorIds = new Set(userIndicators.map((i) => i.id));
                    // Combinada referencia outras estratégias por strat_<id>: basta existirem (o gráfico as avalia como dependência).
                    const strategyIds = new Set(strategies.map((x) => x.id));
                    const result = validateStrategyReferences(s, indicatorIds, strategyIds);
                    if (!result.ok) {
                      const msgTpl = (t as Record<string, string>).strategyApplyErrorMissingColumn ?? (t.strategyApplyErrorMissingIndicator ?? "Could not find indicator (id: {id}).");
                      const lines = result.missingIds.map((id) => msgTpl.replace("{id}", id));
                      setValidationModal({
                        title: t.validationErrorTitle ?? "Validation error",
                        lines,
                      });
                      return;
                    }
                    applyStrategy(s.id);
                    saveActivationToServer([...appliedStrategyIds, s.id]);
                  };
                  const onUnapply = () => {
                    unapplyStrategy(s.id);
                    saveActivationToServer(appliedStrategyIds.filter((id) => id !== s.id));
                  };
                  return (
                    <li
                      key={s.id}
                      className="flex flex-col gap-2 p-2 rounded-md border border-violet-200 bg-violet-50/30 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-zinc-800 break-words">{s.name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 shrink-0">
                            {intervalMinutesToLabel(s.intervalMinutes)}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500">
                          <span className="text-violet-600">{(t as Record<string, string>).strategyTagCombined ?? "Combinada"} · </span>
                          {s.applyToAllSymbols ? t.anySymbol : (s.symbol ?? "")}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="text-xs px-2 py-1 rounded border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
                          title={t.editStrategy}
                        >
                          {t.editStrategy}
                        </button>
                        {applied ? (
                          <button
                            type="button"
                            onClick={onUnapply}
                            className="text-xs px-2 py-1 rounded bg-orange-500 text-white hover:bg-orange-600"
                          >
                            {t.removeFromTable}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={onApply}
                            className="text-xs px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700"
                          >
                            {t.applyStrategy}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmStrategy({ id: s.id, name: s.name })}
                          className="p-1 rounded text-zinc-500 hover:text-red-600 hover:bg-zinc-200"
                          aria-label={t.delete}
                        >
                          🗑️
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {editingStrategyId && (
              <p className="text-xs font-medium text-violet-700">
                {t.editStrategy}: {strategies.find((x) => x.id === editingStrategyId)?.name ?? ""}
              </p>
            )}
            <p className="text-xs text-zinc-600 flex items-center gap-1 flex-wrap">
              {t.strategyInterval}: <strong>{chartIntervalLabel}</strong>
              <HelpPopover content={t.strategyInterval} />
            </p>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-600 flex items-center gap-1">
                {(t as Record<string, string>).strategyCreateModeLabel ?? "Modo"}
                <HelpPopover content={(t as Record<string, string>).strategyModeHint ?? ""} />
              </span>
              <div className="flex rounded-md border border-zinc-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAddStrategyMode("current")}
                  className={`text-xs px-2.5 py-1.5 flex-1 ${addStrategyMode === "current" ? "bg-zinc-200 font-medium text-zinc-800" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
                >
                  {(t as Record<string, string>).strategyModeCurrent ?? "Estratégias"}
                </button>
                <button
                  type="button"
                  onClick={() => canUseCombinedMode && setAddStrategyMode("combined")}
                  disabled={!canUseCombinedMode}
                  title={!canUseCombinedMode ? ((t as Record<string, string>).needTwoStrategiesForCombined ?? "") : undefined}
                  className={`text-xs px-2.5 py-1.5 flex-1 border-l border-zinc-300 ${addStrategyMode === "combined" ? "bg-zinc-200 font-medium text-zinc-800" : "bg-white text-zinc-600 hover:bg-zinc-50"} ${!canUseCombinedMode ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {(t as Record<string, string>).strategyModeCombined ?? "Combinado"}
                </button>
              </div>
              {!canUseCombinedMode && (
                <p className="text-xs text-zinc-500">
                  {(t as Record<string, string>).needTwoStrategiesForCombined ?? "Crie pelo menos 2 estratégias neste símbolo para usar o modo combinado."}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">{t.strategyName}</label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(normalizeStrategyName(e.target.value).slice(0, 36))}
                placeholder={t.strategyNamePlaceholder ?? "ex: MyStrategy_1"}
                className="w-full text-sm border border-zinc-300 rounded-md px-2.5 py-1.5 font-mono"
                maxLength={36}
              />
              <p className="mt-0.5 text-[10px] text-zinc-500">{t.strategyNameHint}</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={addApplyToAllSymbols}
                onChange={(e) => setAddApplyToAllSymbols(e.target.checked)}
                className="rounded border-zinc-300"
              />
              <span className="text-sm text-zinc-700">{t.applyToAllSymbols}</span>
            </label>
            <div className="flex items-center gap-2 relative">
              <label className="text-xs font-medium text-zinc-600 w-40 shrink-0">{t.strategyCandleColor}</label>
              <button
                type="button"
                onClick={() => setAddColorOpen((o) => !o)}
                className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white flex items-center justify-between gap-2"
                aria-expanded={addColorOpen}
                aria-label={t.strategyCandleColor}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-4 h-4 rounded border border-zinc-300 shrink-0" style={{ backgroundColor: addColor }} />
                </span>
                <span className="text-zinc-500 text-xs">▾</span>
              </button>
              {addColorOpen && (
                <>
                  <div className="fixed inset-0 z-30" aria-hidden onClick={() => setAddColorOpen(false)} />
                  <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg p-2 panel-scroll">
                    <div className="grid grid-cols-3 gap-2">
                      {(INDICATOR_COLOR_PALETTE ?? []).map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => {
                            setAddColor(hex);
                            setAddColorOpen(false);
                          }}
                          className={`w-10 h-10 rounded border-2 shrink-0 ${addColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-zinc-600">{t.conditions} ({totalConditions}/{STRATEGY_MAX_CONDITIONS})</span>
              </div>
              <GroupEditor
                node={addRoot}
                root={addRoot}
                setRoot={setAddRoot}
                seriesOptions={seriesOptionsForForm}
                t={t}
                canAddMore={canAddMore}
                depth={0}
                combinedMode={addStrategyMode === "combined"}
                disableCrossoverCrossunder={isDefaultModel}
              />
            </div>
            {!editingStrategyId && defaultModelMaxStrategiesReached && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                {(t as Record<string, string>).defaultModelMaxStrategies ?? "Only one strategy on default model. Save to a layout (1–7) to add more."}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveStrategy}
                disabled={!editingStrategyId && defaultModelMaxStrategiesReached}
                className={`flex-1 text-sm font-medium px-3 py-2 rounded-md ${!editingStrategyId && defaultModelMaxStrategiesReached ? "bg-zinc-400 cursor-not-allowed text-white" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
              >
                {t.save}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  setEditingStrategyId(null);
                  setAddApplyToAllSymbols(false);
                  setAddColorOpen(false);
                }}
                className="px-3 py-2 text-sm font-medium rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupEditor({
  node,
  root,
  setRoot,
  seriesOptions,
  t,
  canAddMore,
  depth,
  onRemoveGroup,
  combinedMode = false,
  disableCrossoverCrossunder = false,
}: {
  node: StrategyGroupNode;
  root: StrategyGroupNode;
  setRoot: (r: StrategyGroupNode) => void;
  seriesOptions: { key: string; label: string }[];
  t: Record<string, string>;
  canAddMore: boolean;
  depth: number;
  onRemoveGroup?: () => void;
  combinedMode?: boolean;
  disableCrossoverCrossunder?: boolean;
}) {
  const updateThisGroup = (updater: (g: StrategyGroupNode) => StrategyGroupNode) => {
    if (node.id === root.id) setRoot(updater(node));
    else setRoot(updateNodeInTree(root, node.id, (n) => (n.type === "group" ? updater(n) : n)) as StrategyGroupNode);
  };
  const addCondition = () => {
    if (!canAddMore) return;
    const newChild = combinedMode ? createCombinedCondition(seriesOptions[0]?.key ?? "") : createEmptyCondition();
    updateThisGroup((g) => ({ ...g, children: [...g.children, newChild] }));
  };
  const addNot = () => {
    if (!canAddMore) return;
    const notChild = combinedMode
      ? { type: "not" as const, id: `not_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, child: createCombinedCondition(seriesOptions[0]?.key ?? "") }
      : createEmptyNot();
    updateThisGroup((g) => ({ ...g, children: [...g.children, notChild] }));
  };
  const addGroup = () => {
    if (!canAddMore) return;
    updateThisGroup((g) => ({ ...g, children: [...g.children, createEmptyGroup("AND")] }));
  };
  const removeChild = (childId: string) => {
    const next = replaceNodeInTree(root, childId, (parent, index) =>
      parent.children.filter((_, j) => j !== index)
    );
    if (next) setRoot(next);
  };
  const updateChild = (childId: string, updater: (n: StrategyNode) => StrategyNode) => {
    setRoot(updateNodeInTree(root, childId, updater) as StrategyGroupNode);
  };

  return (
    <div className="rounded border border-zinc-300 bg-zinc-50/50 p-2 space-y-2" style={{ marginLeft: depth * 8 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500">(</span>
        <select
          value={node.combineWith}
          onChange={(e) => updateThisGroup((g) => ({ ...g, combineWith: e.target.value as "AND" | "OR" }))}
          className="text-xs border border-zinc-300 rounded px-1.5 py-0.5 bg-white"
        >
          <option value="AND">{t.and}</option>
          <option value="OR">{t.or}</option>
        </select>
        <HelpPopover content={t.combineWith} />
        {onRemoveGroup && (
          <button type="button" onClick={onRemoveGroup} className="p-1 rounded text-zinc-700 hover:text-red-600 hover:bg-red-50 font-bold text-sm leading-none ml-auto" aria-label={t.delete}>×</button>
        )}
      </div>
      {node.children.map((child, idx) => (
        <div key={child.id} className="space-y-1">
          {idx > 0 && <div className="text-xs font-medium text-zinc-500">{node.combineWith}</div>}
          {child.type === "condition" ? (
            <ConditionRow
              condition={child}
              seriesOptions={seriesOptions}
              t={t}
              onUpdate={(patch) => updateChild(child.id, (n) => (n.type === "condition" ? { ...n, ...patch } : n))}
              onRemove={node.children.length > 1 ? () => removeChild(child.id) : undefined}
              combinedMode={combinedMode}
              disableCrossoverCrossunder={disableCrossoverCrossunder}
            />
          ) : child.type === "not" ? (
            <div className="rounded border border-amber-200 bg-amber-50/50 p-2">
              <span className="text-xs font-medium text-amber-800">NOT (</span>
              <div className="mt-1">
                {child.child.type === "condition" ? (
                  <ConditionRow
                    condition={child.child}
                    seriesOptions={seriesOptions}
                    t={t}
                    onUpdate={(patch) => updateChild(child.child.id, (n) => (n.type === "condition" ? { ...n, ...patch } : n))}
                    onRemove={() => removeChild(child.id)}
                    combinedMode={combinedMode}
                    disableCrossoverCrossunder={disableCrossoverCrossunder}
                  />
                ) : child.child.type === "group" ? (
                  <GroupEditor
                    node={child.child}
                    root={root}
                    setRoot={setRoot}
                    seriesOptions={seriesOptions}
                    t={t}
                    canAddMore={canAddMore}
                    depth={depth + 1}
                    combinedMode={combinedMode}
                    disableCrossoverCrossunder={disableCrossoverCrossunder}
                  />
                ) : null}
              </div>
              <span className="text-xs text-amber-800">)</span>
              {node.children.length > 1 && (
                <button type="button" onClick={() => removeChild(child.id)} className="ml-1 p-1 rounded text-amber-800 hover:text-red-600 hover:bg-red-50 font-bold text-sm leading-none" aria-label={t.delete}>×</button>
              )}
            </div>
          ) : (
            <GroupEditor
              node={child}
              root={root}
              setRoot={setRoot}
              seriesOptions={seriesOptions}
              t={t}
              canAddMore={canAddMore}
              depth={depth + 1}
              onRemoveGroup={node.children.length > 1 ? () => removeChild(child.id) : undefined}
              combinedMode={combinedMode}
              disableCrossoverCrossunder={disableCrossoverCrossunder}
            />
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-1 pt-1">
        {canAddMore && (
          <>
            <button type="button" onClick={addCondition} className="text-xs px-2 py-1 rounded bg-white border border-zinc-300 hover:bg-zinc-100">
              {t.addCondition}
            </button>
            <button type="button" onClick={addNot} className="text-xs px-2 py-1 rounded bg-amber-100 border border-amber-300 hover:bg-amber-200 text-amber-900">
              {t.addNot}
            </button>
            <button type="button" onClick={addGroup} className="text-xs px-2 py-1 rounded bg-white border border-zinc-300 hover:bg-zinc-100">
              {t.addGroup}
            </button>
          </>
        )}
      </div>
      <span className="text-xs text-zinc-500">)</span>
    </div>
  );
}

function OperandInput({
  operand,
  onChange,
  seriesOptions,
  seriesLabel,
  constantLabel,
  offsetLabel,
  hideOffset = false,
  seriesOnly = false,
  disableNegativeOffsets = false,
}: {
  operand: StrategyOperand;
  onChange: (o: StrategyOperand) => void;
  seriesOptions: { key: string; label: string }[];
  seriesLabel: string;
  constantLabel: string;
  offsetLabel: string;
  hideOffset?: boolean;
  /** Modo combinado: só estratégia (sem constante nem select série/valor). */
  seriesOnly?: boolean;
  /** Quando true, desabilita opções de offset -1 a -7 (modelo default). */
  disableNegativeOffsets?: boolean;
}) {
  const isSeries = operand.type === "series";
  const offset = hideOffset ? 0 : (isSeries ? normalizeOffset(operand.offset) : 0);
  const effectiveKey = isSeries ? operand.seriesKey : (seriesOptions[0]?.key ?? "close");

  if (seriesOnly) {
    return (
      <div className="flex gap-1 flex-wrap items-center">
        <span className="text-xs text-zinc-600 shrink-0">{seriesLabel}:</span>
        <SeriesCombobox
          value={effectiveKey}
          options={seriesOptions}
          onChange={(key) => onChange({ type: "series", seriesKey: key, offset: 0 })}
          ariaLabel={seriesLabel}
        />
      </div>
    );
  }

  return (
    <div className="flex gap-1 flex-wrap items-center">
      <select
        value={isSeries ? "series" : "constant"}
        onChange={(e) => {
          if (e.target.value === "series") onChange({ type: "series", seriesKey: "close", offset: 0 });
          else onChange({ type: "constant", value: 0 });
        }}
        className="text-xs border border-zinc-300 rounded px-1.5 py-1 w-20"
      >
        <option value="series">{seriesLabel}</option>
        <option value="constant">{constantLabel}</option>
      </select>
      {isSeries ? (
        <>
          <SeriesCombobox
            value={operand.seriesKey}
            options={seriesOptions}
            onChange={(key) => onChange({ type: "series", seriesKey: key, offset: hideOffset ? 0 : offset })}
            ariaLabel={seriesLabel}
          />
          {!hideOffset && (
            <>
              <select
                value={offset}
                onChange={(e) => onChange({ type: "series", seriesKey: operand.seriesKey, offset: Number(e.target.value) })}
                className="text-xs border border-zinc-300 rounded px-1 py-1 w-14"
                aria-label={offsetLabel}
              >
                {Array.from({ length: STRATEGY_OFFSET_MAX - STRATEGY_OFFSET_MIN + 1 }, (_, i) => STRATEGY_OFFSET_MAX - i).map((v) => {
                  const isDisabled = disableNegativeOffsets && v < 0;
                  const label = v === 0 ? "0" : String(v);
                  return (
                    <option key={v} value={v} disabled={isDisabled}>{isDisabled ? "🔒 " : ""}{label}</option>
                  );
                })}
              </select>
              <HelpPopover content={offsetLabel} />
            </>
          )}
        </>
      ) : (
        <input
          type="number"
          step="0.01"
          value={operand.value}
          onChange={(e) => {
            const raw = Number(e.target.value);
            const value = Number.isNaN(raw) ? 0 : Math.round(raw * 100) / 100;
            onChange({ type: "constant", value });
          }}
          className="w-20 text-xs border border-zinc-300 rounded px-1.5 py-1"
        />
      )}
    </div>
  );
}

function ConditionRow({
  condition,
  seriesOptions,
  t,
  onUpdate,
  onRemove,
  combinedMode = false,
  disableCrossoverCrossunder = false,
}: {
  condition: StrategyConditionNode;
  seriesOptions: { key: string; label: string }[];
  t: Record<string, string>;
  onUpdate: (patch: Partial<StrategyConditionNode>) => void;
  onRemove?: () => void;
  combinedMode?: boolean;
  disableCrossoverCrossunder?: boolean;
}) {
  const kind: StrategyConditionKind = condition.kind ?? "compare";
  const effectiveKind = combinedMode ? "compare" as const : kind;
  const setKind = (k: StrategyConditionKind) => {
    if (k === "crossover" || k === "crossunder") {
      const left = condition.left?.type === "series" ? condition.left : { type: "series" as const, seriesKey: "close", offset: 0 };
      const right = condition.right?.type === "series" ? condition.right : { type: "series" as const, seriesKey: "close", offset: -1 };
      onUpdate({ kind: k, left, right, barsAfter: normalizeBarsAfter(condition.barsAfter) });
    } else {
      onUpdate({ kind: "compare", barsAfter: undefined });
    }
  };
  const barsAfter = normalizeBarsAfter(condition.barsAfter);
  const seriesLabel = combinedMode ? ((t as Record<string, string>).strategyLabel ?? "Estratégia") : t.series;

  const firstStrategyKey = combinedMode ? (seriesOptions[0]?.key ?? "") : (seriesOptions[0]?.key ?? "close");
  const isValidSeriesKey = (key: string) => seriesOptions.some((o) => o.key === key);

  useEffect(() => {
    if (!combinedMode) return;
    if (kind === "crossover" || kind === "crossunder") {
      onUpdate({
        kind: "compare",
        barsAfter: undefined,
        left: { type: "series" as const, seriesKey: firstStrategyKey, offset: 0 },
        operator: "=",
        right: { type: "constant" as const, value: 1 },
      });
      return;
    }
    if (kind === "compare") {
      const patches: Partial<StrategyConditionNode> = {};
      const leftKey = condition.left?.type === "series" && isValidSeriesKey(condition.left.seriesKey) ? condition.left.seriesKey : firstStrategyKey;
      if (condition.left?.type !== "series" || condition.left.seriesKey !== leftKey || condition.left.offset !== 0) {
        patches.left = { type: "series" as const, seriesKey: leftKey, offset: 0 };
      }
      const rightVal = condition.right?.type === "constant" && (condition.right.value === 0 || condition.right.value === 1) ? condition.right.value : 1;
      if (condition.operator !== "=" || condition.right?.type !== "constant" || condition.right.value !== rightVal) {
        patches.operator = "=";
        patches.right = { type: "constant" as const, value: rightVal };
      }
      if (Object.keys(patches).length > 0) onUpdate(patches);
    }
  }, [combinedMode, kind, firstStrategyKey, condition.left?.type, condition.left?.type === "series" ? condition.left.seriesKey : null, condition.operator, condition.right?.type, condition.right?.type === "constant" ? condition.right.value : null]);

  return (
    <div className={`p-2 rounded border border-zinc-200 bg-white text-xs ${disableCrossoverCrossunder ? "strategies-default-model" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {!combinedMode && (
          <>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as StrategyConditionKind)}
              className="text-xs border border-zinc-300 rounded px-1.5 py-1 bg-zinc-50 font-medium"
            >
              <option value="compare">{t.kindCompare}</option>
              <option value="crossover" disabled={disableCrossoverCrossunder}>{disableCrossoverCrossunder ? "🔒 " : ""}{t.kindCrossover}</option>
              <option value="crossunder" disabled={disableCrossoverCrossunder}>{disableCrossoverCrossunder ? "🔒 " : ""}{t.kindCrossunder}</option>
            </select>
            <HelpPopover content={t.conditionKind} />
          </>
        )}
        {effectiveKind === "compare" && combinedMode && (
          <>
            <span className="text-xs text-zinc-600 shrink-0">{seriesLabel}:</span>
            <SeriesCombobox
              value={condition.left?.type === "series" ? condition.left.seriesKey : firstStrategyKey}
              options={seriesOptions}
              onChange={(key) => onUpdate({ left: { type: "series", seriesKey: key, offset: 0 }, operator: "=", right: { type: "constant", value: condition.right?.type === "constant" ? condition.right.value : 1 } })}
              ariaLabel={seriesLabel}
            />
            <select
              value={condition.right?.type === "constant" && (condition.right.value === 0 || condition.right.value === 1) ? String(condition.right.value) : "1"}
              onChange={(e) => onUpdate({ right: { type: "constant", value: e.target.value === "1" ? 1 : 0 } })}
              className="text-xs border border-zinc-300 rounded px-1.5 py-1 bg-white"
            >
              <option value="1">{(t as Record<string, string>).strategyIsTrue ?? "está verdadeira"}</option>
              <option value="0">{(t as Record<string, string>).strategyIsFalse ?? "está falsa"}</option>
            </select>
          </>
        )}
        {effectiveKind === "compare" && !combinedMode && (
          <>
            <OperandInput
              operand={condition.left?.type === "series" ? { ...condition.left, offset: condition.left.offset } : { type: "series" as const, seriesKey: "close", offset: 0 }}
              onChange={(left) => onUpdate({ left: left?.type === "series" ? { ...left, offset: left.offset ?? 0 } : left })}
              seriesOptions={seriesOptions}
              seriesLabel={seriesLabel}
              constantLabel={t.constant}
              offsetLabel={t.operandOffset}
              hideOffset={false}
              seriesOnly={false}
              disableNegativeOffsets={disableCrossoverCrossunder}
            />
            <select
              value={condition.operator}
              onChange={(e) => onUpdate({ operator: e.target.value as StrategyOperator })}
              className="text-xs border border-zinc-300 rounded px-1 py-1 w-12"
            >
              {STRATEGY_OPERATORS.map((o) => {
                const isDisabled = disableCrossoverCrossunder && o.value !== ">";
                return (
                  <option key={o.value} value={o.value} disabled={isDisabled}>{isDisabled ? "🔒 " : ""}{o.label}</option>
                );
              })}
            </select>
            <OperandInput
              operand={condition.right?.type === "series" ? { ...condition.right, offset: condition.right.offset } : condition.right?.type === "constant" ? condition.right : { type: "constant" as const, value: 0 }}
              onChange={(right) => onUpdate({ right })}
              seriesOptions={seriesOptions}
              seriesLabel={seriesLabel}
              constantLabel={t.constant}
              offsetLabel={t.operandOffset}
              hideOffset={false}
              seriesOnly={false}
              disableNegativeOffsets={disableCrossoverCrossunder}
            />
          </>
        )}
        {!combinedMode && (kind === "crossover" || kind === "crossunder") && (
          <>
            <div className="w-full flex flex-col gap-1 pt-1">
              <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                <span>{kind === "crossover" ? t.kindCrossover : t.kindCrossunder}</span>
                <HelpPopover content={t.conditionKind} />
                <span className="text-zinc-500">{kind === "crossover" ? "↑" : "↓"}</span>
              </div>

              <div className="flex items-stretch gap-1">
                <div className="flex flex-col gap-1 min-w-0">
                  <SeriesOnlyInput
                    operand={condition.left}
                    onChange={(left) => onUpdate({ left })}
                    seriesOptions={seriesOptions}
                  />
                  <SeriesOnlyInput
                    operand={condition.right}
                    onChange={(right) => onUpdate({ right })}
                    seriesOptions={seriesOptions}
                  />
                </div>
                <span className="flex items-center justify-center text-zinc-400 shrink-0 w-16 h-16" aria-hidden title="Cruzamento">
                  <svg width="64" height="64" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </span>
              </div>

              <div className="flex items-center gap-1">
                <select
                  value={barsAfter}
                  onChange={(e) => onUpdate({ barsAfter: Number(e.target.value) })}
                  className="text-xs border border-zinc-300 rounded px-1 py-1 w-10"
                >
                  {Array.from({ length: STRATEGY_BARSAFTER_MAX - STRATEGY_BARSAFTER_MIN + 1 }, (_, i) => i).map((v) => (
                    <option key={v} value={v}>{v === 0 ? "0" : `-${v}`}</option>
                  ))}
                </select>
                <span className="text-zinc-500 text-[10px]">{t.barsAfter}</span>
                <HelpPopover content={t.barsAfterHint ?? t.barsAfter} />
              </div>
            </div>
          </>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} className="p-1 rounded text-zinc-700 hover:text-red-600 hover:bg-red-50 font-bold text-sm leading-none shrink-0" aria-label={t.delete}>×</button>
        )}
      </div>
    </div>
  );
}

/** Operando só série (para crossover). */
function SeriesOnlyInput({
  operand,
  onChange,
  seriesOptions,
}: {
  operand: StrategyOperand;
  onChange: (o: StrategyOperand) => void;
  seriesOptions: { key: string; label: string }[];
}) {
  const op = operand.type === "series" ? operand : { type: "series" as const, seriesKey: "close" };
  return (
    <div className="flex gap-1 flex-wrap items-center">
      <SeriesCombobox
        value={op.seriesKey}
        options={seriesOptions}
        onChange={(key) => onChange({ type: "series", seriesKey: key })}
      />
    </div>
  );
}
