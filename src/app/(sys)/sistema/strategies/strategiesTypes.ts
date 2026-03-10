/** Operador de comparação entre dois operandos. */
export type StrategyOperator = ">" | "<" | "=" | ">=" | "<=" | "<>";

/** Indexador de período: 0 = valor atual da linha, -1 = 1 candle anterior, -2 = 2 anteriores, etc. (0 a -7). */
export const STRATEGY_OFFSET_MIN = -7;
export const STRATEGY_OFFSET_MAX = 0;

/** Para CROSSOVER/CROSSUNDER: quantos candles após o cruzamento a condição continua válida (0 = só no candle do cruzamento, 7 = até 7 candles depois). */
export const STRATEGY_BARSAFTER_MIN = 0;
export const STRATEGY_BARSAFTER_MAX = 7;

/** Operando: série (coluna do candle/indicador, com offset opcional) ou constante numérica. */
export type StrategyOperand =
  | { type: "series"; seriesKey: string; /** 0 = atual, -1 = anterior, ... -7. Default 0. */ offset?: number }
  | { type: "constant"; value: number };

/** Tipo de condição folha: comparação, cruzamento acima ou abaixo. */
export type StrategyConditionKind = "compare" | "crossover" | "crossunder";

/** Condição folha: compare (left op right), crossover (left cruza acima de right), crossunder (left cruza abaixo de right). */
export interface StrategyConditionNode {
  type: "condition";
  id: string;
  /** Default "compare". */
  kind?: StrategyConditionKind;
  left: StrategyOperand;
  operator: StrategyOperator;
  right: StrategyOperand;
  /** Só para kind crossover/crossunder: 0 = só no candle do cruzamento, 1..7 = válido até N candles depois. */
  barsAfter?: number;
}

/** Nó NOT: nega uma única condição (ou grupo). */
export interface StrategyNotNode {
  type: "not";
  id: string;
  child: StrategyNode;
}

/** Grupo com parênteses: ( child0 AND/OR child1 AND/OR ... ). */
export interface StrategyGroupNode {
  type: "group";
  id: string;
  combineWith: "AND" | "OR";
  children: StrategyNode[];
}

export type StrategyNode = StrategyConditionNode | StrategyGroupNode | StrategyNotNode;

/** Estratégia: nome + árvore de condições (grupos encadeados com AND/OR). */
export interface Strategy {
  id: string;
  name: string;
  /** Raiz sempre é um grupo (permite encadear AND/OR com parênteses). */
  root: StrategyGroupNode;
  /** Intervalo fixo (minutos) em que a estratégia foi definida — ex.: 240 = 4h. Sempre o do gráfico no momento da criação. */
  intervalMinutes: number;
  /** Se true, a coluna é criada para qualquer símbolo neste intervalo; se false, só para o símbolo em que foi criada. */
  applyToAllSymbols: boolean;
  /** Símbolo ao qual a estratégia se aplica quando applyToAllSymbols é false (ex.: BTCUSDT). */
  symbol?: string;
  /** Cor do candle quando a condição é verdadeira (hex). Usa a mesma paleta das médias móveis. */
  color?: string;
}

/** Formato legado (antes de intervalMinutes/applyToAllSymbols): migração. */
export interface StrategyLegacy {
  id: string;
  name: string;
  conditions?: StrategyConditionNode[];
  combineWith?: "AND" | "OR";
  root?: StrategyGroupNode;
  intervalMinutes?: number;
  applyToAllSymbols?: boolean;
  symbol?: string;
  color?: string;
}

export const STRATEGY_MAX_CONDITIONS = 7;

export const STRATEGY_OPERATORS: { value: StrategyOperator; label: string }[] = [
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: "=", label: "=" },
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: "<>", label: "<>" },
];

function isCondition(n: StrategyNode): n is StrategyConditionNode {
  return n.type === "condition";
}

export function isNotNode(n: StrategyNode): n is StrategyNotNode {
  return n.type === "not";
}

/** Garante offset entre STRATEGY_OFFSET_MIN e STRATEGY_OFFSET_MAX; default 0. */
export function normalizeOffset(offset: number | undefined): number {
  if (offset == null || typeof offset !== "number") return 0;
  return Math.max(STRATEGY_OFFSET_MIN, Math.min(STRATEGY_OFFSET_MAX, Math.round(offset)));
}

/** Garante barsAfter entre STRATEGY_BARSAFTER_MIN e STRATEGY_BARSAFTER_MAX; default 0. */
export function normalizeBarsAfter(bars: number | undefined): number {
  if (bars == null || typeof bars !== "number") return 0;
  return Math.max(STRATEGY_BARSAFTER_MIN, Math.min(STRATEGY_BARSAFTER_MAX, Math.round(bars)));
}

/** Conta quantas condições folha existem na árvore (máx 10). NOT conta o filho; condition conta 1. */
export function countConditionLeaves(node: StrategyNode): number {
  if (isCondition(node)) return 1;
  if (isNotNode(node)) return countConditionLeaves(node.child);
  return node.children.reduce((sum, c) => sum + countConditionLeaves(c), 0);
}

/** Cria um grupo vazio com uma condição. */
export function createEmptyGroup(combineWith: "AND" | "OR" = "AND"): StrategyGroupNode {
  return {
    type: "group",
    id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    combineWith,
    children: [createEmptyCondition()],
  };
}

/** Cria uma condição padrão (compare). */
export function createEmptyCondition(): StrategyConditionNode {
  return {
    type: "condition",
    id: `cond_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    kind: "compare",
    left: { type: "series", seriesKey: "close", offset: 0 },
    operator: ">",
    right: { type: "constant", value: 0 },
  };
}

/** Cria condição CROSSOVER (duas séries; barsAfter 0..7). */
export function createEmptyCrossoverCondition(): StrategyConditionNode {
  return {
    type: "condition",
    id: `cond_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    kind: "crossover",
    left: { type: "series", seriesKey: "close", offset: 0 },
    operator: ">",
    right: { type: "series", seriesKey: "close", offset: -1 },
    barsAfter: 0,
  };
}

/** Cria nó NOT com uma condição vazia dentro. */
export function createEmptyNot(): StrategyNotNode {
  return {
    type: "not",
    id: `not_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    child: createEmptyCondition(),
  };
}

/** Converte estratégia legada em Strategy completa (root + intervalMinutes + applyToAllSymbols). */
export function legacyToRoot(s: StrategyLegacy | Strategy): Strategy {
  const str = s as Strategy;
  if (str.root && str.root.type === "group" && Array.isArray(str.root.children)) {
    return {
      ...str,
      intervalMinutes: str.intervalMinutes ?? 5,
      applyToAllSymbols: str.applyToAllSymbols ?? true,
      symbol: str.symbol,
      color: str.color,
    };
  }
  const leg = s as StrategyLegacy;
  const conditions = leg.conditions ?? [];
  const combineWith = leg.combineWith ?? "AND";
  const normalizeCond = (c: StrategyConditionNode): StrategyConditionNode => {
    const kind = (c.kind ?? "compare") as StrategyConditionKind;
    const left = c.left?.type === "series" ? { ...c.left, offset: normalizeOffset(c.left.offset) } : c.left ?? { type: "series" as const, seriesKey: "close", offset: 0 };
    const right = c.right?.type === "series" ? { ...c.right, offset: normalizeOffset(c.right.offset) } : c.right ?? { type: "constant" as const, value: 0 };
    return {
      ...c,
      type: "condition",
      kind,
      left,
      right,
      operator: c.operator ?? ">",
      barsAfter: kind !== "compare" ? normalizeBarsAfter(c.barsAfter) : undefined,
    };
  };
  const root: StrategyGroupNode = {
    type: "group",
    id: `grp_${leg.id}`,
    combineWith,
    children: conditions.length > 0
      ? conditions.map((c) => normalizeCond(c as StrategyConditionNode))
      : [createEmptyCondition()],
  };
  return {
    id: leg.id,
    name: leg.name,
    root,
    intervalMinutes: leg.intervalMinutes ?? 5,
    applyToAllSymbols: leg.applyToAllSymbols ?? true,
    symbol: leg.symbol,
    color: leg.color,
  };
}

/** Rótulo curto do intervalo para exibição (ex.: 240 → "4h"). */
export const INTERVAL_LABELS: Record<number, string> = {
  1: "1m", 3: "3m", 5: "5m", 15: "15m", 30: "30m", 45: "45m",
  60: "1h", 120: "2h", 180: "3h", 240: "4h", 360: "6h", 480: "8h", 720: "12h",
  1440: "1D", 4320: "3D", 10080: "1S", 43200: "1M",
};
export function intervalMinutesToLabel(min: number): string {
  return INTERVAL_LABELS[min] ?? `${min}m`;
}

/** Substitui um nó na árvore pelo id (percorre grupos e NOT). Retorna a nova raiz. */
export function replaceInNode(
  node: StrategyNode,
  nodeId: string,
  replacer: (n: StrategyNode) => StrategyNode
): StrategyNode {
  if (node.id === nodeId) return replacer(node);
  if (node.type === "group") {
    const newChildren = node.children.map((c) => replaceInNode(c, nodeId, replacer));
    if (newChildren.every((c, i) => c === node.children[i])) return node;
    return { ...node, children: newChildren };
  }
  if (node.type === "not") {
    const newChild = replaceInNode(node.child, nodeId, replacer);
    if (newChild === node.child) return node;
    return { ...node, child: newChild };
  }
  return node;
}

/** Retorna estratégias que se aplicam ao intervalo e símbolo atuais (para uso na tabela/gráfico). */
export function strategiesForContext(
  strategies: Strategy[],
  groupMinutes: number,
  symbol: string
): Strategy[] {
  return strategies.filter(
    (s) =>
      s.intervalMinutes === groupMinutes &&
      (s.applyToAllSymbols || (s.symbol != null && s.symbol === symbol))
  );
}

/** Coleta todas as seriesKey usadas na árvore (ex.: "close", "ind_xyz"). */
function collectSeriesKeys(node: StrategyNode): string[] {
  const keys: string[] = [];
  if (node.type === "condition") {
    if (node.left?.type === "series") keys.push(node.left.seriesKey);
    if (node.right?.type === "series") keys.push(node.right.seriesKey);
    return keys;
  }
  if (node.type === "not") return collectSeriesKeys(node.child);
  if (node.type === "group") {
    for (const c of node.children) keys.push(...collectSeriesKeys(c));
    return keys;
  }
  return keys;
}

/**
 * Valida se todos os indicadores referenciados na estratégia existem.
 * indicatorIds = Set dos id dos indicadores atuais (ex.: userIndicators.map(i => i.id)).
 * Retorna { ok: true } ou { ok: false, missingIds: string[] }.
 */
export function validateStrategyReferences(
  strategy: Strategy,
  indicatorIds: Set<string>
): { ok: true } | { ok: false; missingIds: string[] } {
  const keys = collectSeriesKeys(strategy.root);
  const missingIds: string[] = [];
  for (const key of keys) {
    if (key.startsWith("ind_")) {
      // Suporta sub-séries como "ind_<id>:sig", "ind_<id>:hist", "ind_<id>:d"
      const raw = key.slice(4);
      const id = raw.split(":")[0] ?? "";
      if (id && !indicatorIds.has(id)) missingIds.push(id);
    }
  }
  if (missingIds.length > 0) return { ok: false, missingIds };
  return { ok: true };
}
