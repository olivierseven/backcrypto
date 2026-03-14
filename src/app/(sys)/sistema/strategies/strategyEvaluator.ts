/**
 * Avalia uma estratégia por linha da tabela de klines.
 * extendedKlines[0] = candle mais recente; rowIndex 0 = linha atual (mais recente).
 * offset 0 = candle atual, -1 = anterior, etc.
 */

import type { UserIndicatorConfig } from "../KlinesIndicatorsContext";
import type {
  StrategyNode,
  StrategyConditionNode,
  StrategyGroupNode,
  StrategyNotNode,
  StrategyOperand,
  StrategyOperator,
} from "./strategiesTypes";
import { normalizeOffset, normalizeBarsAfter } from "./strategiesTypes";

export type KlineRow = (string | number | null)[];

function getBaseColumnIndex(seriesKey: string): number | null {
  switch (seriesKey) {
    case "open": return 1;
    case "high": return 2;
    case "low": return 3;
    case "close": return 4;
    case "volume": return 5;
    default: return null;
  }
}

/** Valor numérico da série na linha (rowIndex 0 = mais recente). offset 0 = esta linha, -1 = anterior. */
export function getSeriesValue(
  extendedKlines: KlineRow[],
  rowIndex: number,
  seriesKey: string,
  offset: number,
  userIndicators: UserIndicatorConfig[],
  getIndicatorColumnStart: (indicatorIndex: number) => number,
  strategyResultsById?: Map<string, boolean[]>
): number | null {
  const off = normalizeOffset(offset);
  const row = rowIndex - off;
  if (row < 0 || row >= extendedKlines.length) return null;
  const k = extendedKlines[row];

  if (seriesKey.startsWith("strat_") && strategyResultsById) {
    const id = seriesKey.slice(6);
    const results = strategyResultsById.get(id);
    if (!results || row >= results.length) return null;
    return results[row] ? 1 : 0;
  }

  const baseCol = getBaseColumnIndex(seriesKey);
  if (baseCol != null) {
    const v = k[baseCol];
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // Funções calculadas a partir de OHLC (sem coluna na tabela)
  const o = k[1] != null ? Number(k[1]) : NaN;
  const h = k[2] != null ? Number(k[2]) : NaN;
  const l = k[3] != null ? Number(k[3]) : NaN;
  const c = k[4] != null ? Number(k[4]) : NaN;
  if (seriesKey === "HL2") {
    if (!Number.isFinite(h) || !Number.isFinite(l)) return null;
    return (h + l) / 2;
  }
  if (seriesKey === "HLC3") {
    if (!Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) return null;
    return (h + l + c) / 3;
  }
  if (seriesKey === "OHLC4") {
    if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) return null;
    return (o + h + l + c) / 4;
  }
  if (seriesKey === "HLCC4") {
    if (!Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) return null;
    return (h + l + c + c) / 4;
  }

  if (seriesKey.startsWith("ind_")) {
    const raw = seriesKey.slice(4);
    const [id, part] = raw.split(":");
    const indIdx = userIndicators.findIndex((i) => i.id === id);
    if (indIdx < 0) return null;
    const col = getIndicatorColumnStart(indIdx);
    const ind = userIndicators[indIdx];
    const extraOffset = (() => {
      if (!part) return 0;
      if (part === "sig") return ind.type === "MACD" ? 1 : null;
      if (part === "hist") return ind.type === "MACD" ? 2 : null;
      if (part === "d") return ind.type === "Stochastic" ? 1 : null;
      if (part === "upper") return ind.type === "Bollinger" || ind.type === "Donchian" ? 0 : null;
      if (part === "middle") return ind.type === "Bollinger" || ind.type === "Donchian" ? 1 : null;
      if (part === "lower") return ind.type === "Bollinger" || ind.type === "Donchian" ? 2 : null;
      if (part === "plusDi") return ind.type === "ADX" ? 0 : null;
      if (part === "minusDi") return ind.type === "ADX" ? 1 : null;
      if (part === "adx") return ind.type === "ADX" ? 2 : null;
      return null;
    })();
    if (extraOffset == null) return null;
    const v = k[col + extraOffset];
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function getOperandValue(
  operand: StrategyOperand,
  extendedKlines: KlineRow[],
  rowIndex: number,
  userIndicators: UserIndicatorConfig[],
  getIndicatorColumnStart: (indicatorIndex: number) => number,
  strategyResultsById?: Map<string, boolean[]>
): number | null {
  if (operand.type === "constant") return operand.value;
  return getSeriesValue(
    extendedKlines,
    rowIndex,
    operand.seriesKey,
    operand.offset ?? 0,
    userIndicators,
    getIndicatorColumnStart,
    strategyResultsById
  );
}

function applyOperator(left: number, op: StrategyOperator, right: number): boolean {
  switch (op) {
    case ">": return left > right;
    case "<": return left < right;
    case "=": return left === right;
    case ">=": return left >= right;
    case "<=": return left <= right;
    case "<>": return left !== right;
    default: return false;
  }
}

function evaluateCondition(
  condition: StrategyConditionNode,
  extendedKlines: KlineRow[],
  rowIndex: number,
  userIndicators: UserIndicatorConfig[],
  getIndicatorColumnStart: (indicatorIndex: number) => number,
  strategyResultsById?: Map<string, boolean[]>
): boolean {
  const kind = condition.kind ?? "compare";

  if (kind === "compare") {
    const leftVal = getOperandValue(condition.left, extendedKlines, rowIndex, userIndicators, getIndicatorColumnStart, strategyResultsById);
    const rightVal = getOperandValue(condition.right, extendedKlines, rowIndex, userIndicators, getIndicatorColumnStart, strategyResultsById);
    if (leftVal == null || rightVal == null) return false;
    return applyOperator(leftVal, condition.operator, rightVal);
  }

  if (kind === "crossover" || kind === "crossunder") {
    const barsAfter = normalizeBarsAfter(condition.barsAfter);
    const leftKey = condition.left.type === "series" ? condition.left.seriesKey : null;
    const rightKey = condition.right.type === "series" ? condition.right.seriesKey : null;
    if (leftKey == null || rightKey == null) return false;

    // Exige que "agora" (t(0)) já esteja na relação correta (acima para crossover, abaixo para crossunder).
    // Não exige que t(-1) já estivesse assim, senão o cruzamento no candle atual (índice 0) nunca dispara.
    const nowLeft = getSeriesValue(extendedKlines, rowIndex, leftKey, 0, userIndicators, getIndicatorColumnStart, strategyResultsById);
    const nowRight = getSeriesValue(extendedKlines, rowIndex, rightKey, 0, userIndicators, getIndicatorColumnStart, strategyResultsById);
    if (nowLeft == null || nowRight == null) return false;
    if (kind === "crossover") {
      if (!(nowLeft > nowRight)) return false;
    } else {
      if (!(nowLeft < nowRight)) return false;
    }

    for (let j = 0; j <= barsAfter; j++) {
      const crossRow = rowIndex + j;
      const prevRow = crossRow + 1;
      if (prevRow >= extendedKlines.length) continue;

      const leftPrev = getSeriesValue(extendedKlines, crossRow, leftKey, -1, userIndicators, getIndicatorColumnStart, strategyResultsById);
      const rightPrev = getSeriesValue(extendedKlines, crossRow, rightKey, -1, userIndicators, getIndicatorColumnStart, strategyResultsById);
      const leftCur = getSeriesValue(extendedKlines, crossRow, leftKey, 0, userIndicators, getIndicatorColumnStart, strategyResultsById);
      const rightCur = getSeriesValue(extendedKlines, crossRow, rightKey, 0, userIndicators, getIndicatorColumnStart, strategyResultsById);

      if (leftPrev == null || rightPrev == null || leftCur == null || rightCur == null) continue;

      if (kind === "crossover") {
        if (leftPrev <= rightPrev && leftCur > rightCur) return true;
      } else {
        if (leftPrev >= rightPrev && leftCur < rightCur) return true;
      }
    }
  }

  return false;
}

export function evaluateNode(
  node: StrategyNode,
  extendedKlines: KlineRow[],
  rowIndex: number,
  userIndicators: UserIndicatorConfig[],
  getIndicatorColumnStart: (indicatorIndex: number) => number,
  strategyResultsById?: Map<string, boolean[]>
): boolean {
  if (node.type === "condition") {
    return evaluateCondition(node, extendedKlines, rowIndex, userIndicators, getIndicatorColumnStart, strategyResultsById);
  }
  if (node.type === "not") {
    return !evaluateNode((node as StrategyNotNode).child, extendedKlines, rowIndex, userIndicators, getIndicatorColumnStart, strategyResultsById);
  }
  const group = node as StrategyGroupNode;
  const combine = group.combineWith === "OR";
  for (const child of group.children) {
    const v = evaluateNode(child, extendedKlines, rowIndex, userIndicators, getIndicatorColumnStart, strategyResultsById);
    if (combine && v) return true;
    if (!combine && !v) return false;
  }
  return !combine;
}
