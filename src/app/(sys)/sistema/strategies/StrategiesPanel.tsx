"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { useChartSymbol } from "../ChartSymbolContext";
import { useKlinesIndicators } from "../KlinesIndicatorsContext";
import { getIndicatorLabel } from "../IndicatorsPanel";
import { useStrategies } from "./StrategiesContext";
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
  createEmptyCrossoverCondition,
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
  const { userIndicators, currentGroupMinutes } = useKlinesIndicators();
  const { symbol } = useChartSymbol();
  const { strategies, addStrategy, updateStrategy, removeStrategy, applyStrategy, unapplyStrategy, isApplied } = useStrategies();
  const [addOpen, setAddOpen] = useState(initialView === "add");
  const [editingStrategyId, setEditingStrategyId] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addRoot, setAddRoot] = useState<StrategyGroupNode>(() => createEmptyGroup("AND"));
  const [addApplyToAllSymbols, setAddApplyToAllSymbols] = useState(false);
  /** Cor do candle quando a condição é verdadeira (mesma paleta das médias móveis). */
  const [addColor, setAddColor] = useState<string>(() => INDICATOR_COLOR_PALETTE?.[2] ?? "#ef4444");
  const [addColorOpen, setAddColorOpen] = useState(false);

  const chartIntervalMinutes = currentGroupMinutes ?? 5;
  const chartIntervalLabel = intervalMinutesToLabel(chartIntervalMinutes);

  const tKlines = getCryptoT(lang).sistema.klines;
  /** Painel padrão por tipo (igual ao do gráfico). */
  const getIndicatorPanel = (ind: (typeof userIndicators)[0]) =>
    ind.panel ?? (ind.type === "RSI" || ind.type === "MACD" || ind.type === "Stochastic" || ind.type === "WilliamsR" || ind.type === "OBV" || ind.type === "ATR" || ind.type === "Volume" ? "panel2" : "main");
  const panelToNum = (p: string) => (p === "main" ? 1 : p === "panel2" ? 2 : p === "panel3" ? 3 : p === "panel4" ? 4 : p === "panel5" ? 5 : 1);
  const seriesOptions = useMemo(() => {
    const opts: { key: string; label: string }[] = [
      { key: "open", label: `(1) ${tKlines.fieldOpen ?? "Open"}` },
      { key: "high", label: `(1) ${tKlines.fieldHigh ?? "High"}` },
      { key: "low", label: `(1) ${tKlines.fieldLow ?? "Low"}` },
      { key: "close", label: `(1) ${tKlines.fieldClose ?? "Close"}` },
      { key: "volume", label: `(1) ${tKlines.volUsdt ?? tKlines.volumeBtc ?? "Volume"}` },
    ];
    userIndicators.forEach((ind) => {
      const panel = getIndicatorPanel(ind);
      const num = panelToNum(panel);
      opts.push({ key: `ind_${ind.id}`, label: `(${num}) ${getIndicatorLabel(ind, tKlines, userIndicators)}` });
    });
    return opts;
  }, [userIndicators, tKlines]);

  const totalConditions = countConditionLeaves(addRoot);
  const canAddMore = totalConditions < STRATEGY_MAX_CONDITIONS;

  const handleSaveStrategy = () => {
    const raw = addName.trim() || t.defaultStrategyName;
    const name = normalizeStrategyName(raw).slice(0, 36);
    if (!name) {
      alert(t.strategyNameInvalid ?? "Use only letters (a-z, A-Z), numbers, underscore and hyphen. No spaces or accents.");
      return;
    }
    if (addRoot.children.length === 0) return;
    if (editingStrategyId) {
      updateStrategy(editingStrategyId, {
        name,
        root: addRoot,
        applyToAllSymbols: addApplyToAllSymbols,
        symbol: addApplyToAllSymbols ? undefined : symbol,
        color: addColor,
      });
      setEditingStrategyId(null);
    } else {
      const strategy: Strategy = {
        id: generateId(),
        name,
        root: addRoot,
        intervalMinutes: chartIntervalMinutes,
        applyToAllSymbols: addApplyToAllSymbols,
        symbol: addApplyToAllSymbols ? undefined : symbol,
        color: addColor,
      };
      addStrategy(strategy);
    }
    setAddName("");
    setAddRoot(createEmptyGroup("AND"));
    setAddApplyToAllSymbols(false);
    setAddColor(INDICATOR_COLOR_PALETTE?.[2] ?? "#ef4444");
    setAddColorOpen(false);
    setAddOpen(false);
  };

  const openEdit = (s: Strategy) => {
    setAddName(s.name);
    setAddRoot(JSON.parse(JSON.stringify(s.root)) as StrategyGroupNode);
    setAddApplyToAllSymbols(s.applyToAllSymbols ?? false);
    setAddColor(s.color ?? INDICATOR_COLOR_PALETTE?.[2] ?? "#ef4444");
    setEditingStrategyId(s.id);
    setAddOpen(true);
  };

  return (
    <div
      className="fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-zinc-200 shadow-xl overflow-hidden w-[66.666vw] sm:w-[33.333vw] max-w-[400px]"
      role="dialog"
      aria-label={t.panelTitle}
    >
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
          <p className="text-xs text-zinc-500 flex items-center gap-1 flex-wrap">
            {t.chartInterval}: <strong>{chartIntervalLabel}</strong>
            <HelpPopover content={t.strategyInterval} />
          </p>
        )}
        {!addOpen ? (
          <>
            {strategies.length === 0 ? (
              <p className="text-sm text-zinc-500">{t.noStrategies}</p>
            ) : (
              <ul className="space-y-2">
                {strategies.map((s) => {
                  const applied = isApplied(s.id);
                  const onApply = () => {
                    const indicatorIds = new Set(userIndicators.map((i) => i.id));
                    const result = validateStrategyReferences(s, indicatorIds);
                    if (!result.ok) {
                      const msg = result.missingIds
                        .map((id) => (t.strategyApplyErrorMissingIndicator ?? "Could not find indicator (id: {id}).").replace("{id}", id))
                        .join("\n");
                      alert(msg);
                      return;
                    }
                    applyStrategy(s.id);
                  };
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-zinc-50 border border-zinc-200"
                    >
                      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium text-zinc-800 truncate">{s.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 shrink-0">
                          {intervalMinutesToLabel(s.intervalMinutes)}
                        </span>
                        <HelpPopover content={t.strategyInterval} />
                        <span className="text-xs text-zinc-500 shrink-0">
                          {s.applyToAllSymbols ? `· ${t.anySymbol}` : `· ${s.symbol ?? ""}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
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
                            onClick={() => unapplyStrategy(s.id)}
                            className="text-xs px-2 py-1 rounded border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
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
                          onClick={() => removeStrategy(s.id)}
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
                seriesOptions={seriesOptions}
                t={t}
                canAddMore={canAddMore}
                depth={0}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveStrategy}
                className="flex-1 text-sm font-medium px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
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
}: {
  node: StrategyGroupNode;
  root: StrategyGroupNode;
  setRoot: (r: StrategyGroupNode) => void;
  seriesOptions: { key: string; label: string }[];
  t: Record<string, string>;
  canAddMore: boolean;
  depth: number;
  onRemoveGroup?: () => void;
}) {
  const updateThisGroup = (updater: (g: StrategyGroupNode) => StrategyGroupNode) => {
    if (node.id === root.id) setRoot(updater(node));
    else setRoot(updateNodeInTree(root, node.id, (n) => (n.type === "group" ? updater(n) : n)) as StrategyGroupNode);
  };
  const addCondition = () => {
    if (!canAddMore) return;
    updateThisGroup((g) => ({ ...g, children: [...g.children, createEmptyCondition()] }));
  };
  const addCrossover = () => {
    if (!canAddMore) return;
    updateThisGroup((g) => ({ ...g, children: [...g.children, createEmptyCrossoverCondition()] }));
  };
  const addNot = () => {
    if (!canAddMore) return;
    updateThisGroup((g) => ({ ...g, children: [...g.children, createEmptyNot()] }));
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
            <button type="button" onClick={addCrossover} className="text-xs px-2 py-1 rounded bg-white border border-zinc-300 hover:bg-zinc-100">
              {t.addCrossover}
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
}: {
  operand: StrategyOperand;
  onChange: (o: StrategyOperand) => void;
  seriesOptions: { key: string; label: string }[];
  seriesLabel: string;
  constantLabel: string;
  offsetLabel: string;
}) {
  const isSeries = operand.type === "series";
  const offset = isSeries ? normalizeOffset(operand.offset) : 0;
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
          <select
            value={operand.seriesKey}
            onChange={(e) => onChange({ type: "series", seriesKey: e.target.value, offset })}
            className="flex-1 min-w-0 text-xs border border-zinc-300 rounded px-1.5 py-1 max-w-[100px]"
          >
            {seriesOptions.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          <select
            value={offset}
            onChange={(e) => onChange({ type: "series", seriesKey: operand.seriesKey, offset: Number(e.target.value) })}
            className="text-xs border border-zinc-300 rounded px-1 py-1 w-14"
            aria-label={offsetLabel}
          >
            {Array.from({ length: STRATEGY_OFFSET_MAX - STRATEGY_OFFSET_MIN + 1 }, (_, i) => STRATEGY_OFFSET_MAX - i).map((v) => (
              <option key={v} value={v}>{v === 0 ? "0" : v}</option>
            ))}
          </select>
          <HelpPopover content={offsetLabel} />
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
}: {
  condition: StrategyConditionNode;
  seriesOptions: { key: string; label: string }[];
  t: Record<string, string>;
  onUpdate: (patch: Partial<StrategyConditionNode>) => void;
  onRemove?: () => void;
}) {
  const kind: StrategyConditionKind = condition.kind ?? "compare";
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

  return (
    <div className="p-2 rounded border border-zinc-200 bg-white text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as StrategyConditionKind)}
          className="text-xs border border-zinc-300 rounded px-1.5 py-1 bg-zinc-50 font-medium"
        >
          <option value="compare">{t.kindCompare}</option>
          <option value="crossover">{t.kindCrossover}</option>
          <option value="crossunder">{t.kindCrossunder}</option>
        </select>
        <HelpPopover content={t.conditionKind} />
        {kind === "compare" && (
          <>
            <OperandInput
              operand={condition.left}
              onChange={(left) => onUpdate({ left })}
              seriesOptions={seriesOptions}
              seriesLabel={t.series}
              constantLabel={t.constant}
              offsetLabel={t.operandOffset}
            />
            <select
              value={condition.operator}
              onChange={(e) => onUpdate({ operator: e.target.value as StrategyOperator })}
              className="text-xs border border-zinc-300 rounded px-1 py-1 w-12"
            >
              {STRATEGY_OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <OperandInput
              operand={condition.right}
              onChange={(right) => onUpdate({ right })}
              seriesOptions={seriesOptions}
              seriesLabel={t.series}
              constantLabel={t.constant}
              offsetLabel={t.operandOffset}
            />
          </>
        )}
        {(kind === "crossover" || kind === "crossunder") && (
          <>
            <span className="text-zinc-500">{kind === "crossover" ? "↑" : "↓"}</span>
            <SeriesOnlyInput
              operand={condition.left}
              onChange={(left) => onUpdate({ left })}
              seriesOptions={seriesOptions}
              offsetLabel={t.operandOffset}
            />
            <span className="text-zinc-500">×</span>
            <SeriesOnlyInput
              operand={condition.right}
              onChange={(right) => onUpdate({ right })}
              seriesOptions={seriesOptions}
              offsetLabel={t.operandOffset}
            />
            <span className="text-zinc-500 text-[10px]">{t.barsAfter}</span>
            <HelpPopover content={t.barsAfter} />
            <select
              value={barsAfter}
              onChange={(e) => onUpdate({ barsAfter: Number(e.target.value) })}
              className="text-xs border border-zinc-300 rounded px-1 py-1 w-10"
            >
              {Array.from({ length: STRATEGY_BARSAFTER_MAX - STRATEGY_BARSAFTER_MIN + 1 }, (_, i) => i).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} className="p-1 rounded text-zinc-700 hover:text-red-600 hover:bg-red-50 font-bold text-sm leading-none shrink-0" aria-label={t.delete}>×</button>
        )}
      </div>
    </div>
  );
}

/** Operando só série (para crossover/crossunder). */
function SeriesOnlyInput({
  operand,
  onChange,
  seriesOptions,
  offsetLabel,
}: {
  operand: StrategyOperand;
  onChange: (o: StrategyOperand) => void;
  seriesOptions: { key: string; label: string }[];
  offsetLabel: string;
}) {
  const op = operand.type === "series" ? operand : { type: "series" as const, seriesKey: "close", offset: 0 };
  const offset = normalizeOffset(op.offset);
  return (
    <div className="flex gap-1 flex-wrap items-center">
      <select
        value={op.seriesKey}
        onChange={(e) => onChange({ type: "series", seriesKey: e.target.value, offset })}
        className="text-xs border border-zinc-300 rounded px-1.5 py-1 max-w-[100px]"
      >
        {seriesOptions.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
      <select
        value={offset}
        onChange={(e) => onChange({ type: "series", seriesKey: op.seriesKey, offset: Number(e.target.value) })}
        className="text-xs border border-zinc-300 rounded px-1 py-1 w-14"
        aria-label={offsetLabel}
      >
        {Array.from({ length: STRATEGY_OFFSET_MAX - STRATEGY_OFFSET_MIN + 1 }, (_, i) => STRATEGY_OFFSET_MAX - i).map((v) => (
          <option key={v} value={v}>{v === 0 ? "0" : v}</option>
        ))}
      </select>
      <HelpPopover content={offsetLabel} />
    </div>
  );
}
