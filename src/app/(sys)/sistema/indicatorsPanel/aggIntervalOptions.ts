/**
 * Intervalos atemporais (cache2 / `groupMinutes` 920000+) para "Mostrar em" dos indicadores.
 * Alinhado a `KlinesChartConstants` + `renkoKlineCache2Build`.
 */
import {
  CACHE2_TICK_KIND_STRIDE,
  formatCache2IntervalShortLabel,
  GROUP_MINUTES_CACHE2_BASE,
  GROUP_MINUTES_CACHE2_TRADES_BASE,
  type AggChartKind,
} from "../KlinesChartConstants";
import { RENKO_CACHE_TICK_INTERVALS, TRADE_CACHE_TRADE_INTERVALS } from "@/app/lib/renkoKlineCache2Build";
import { INTERVAL_OPTIONS } from "./indicatorsPanelConstants";

export type AggIntervalGroup = {
  /** Chave em `translations` (ex.: intervalSectionRenko). */
  titleKey: string;
  options: { value: number; label: string }[];
};

function buildTickChartOptions(kindIndex: number, kind: AggChartKind): { value: number; label: string }[] {
  const out: { value: number; label: string }[] = [];
  for (let ti = 0; ti < RENKO_CACHE_TICK_INTERVALS.length; ti++) {
    const ticks = RENKO_CACHE_TICK_INTERVALS[ti]!;
    const gm = GROUP_MINUTES_CACHE2_BASE + kindIndex * CACHE2_TICK_KIND_STRIDE + ti;
    const interval = `${ticks}ticks`;
    out.push({ value: gm, label: formatCache2IntervalShortLabel(kind, interval) });
  }
  return out;
}

const KINDS: AggChartKind[] = ["renko", "range", "kagi", "renko2x"];
const TITLE_KEYS = [
  "intervalSectionRenko",
  "intervalSectionRange",
  "intervalSectionKagi",
  "intervalSectionRenko2x",
] as const;

/** Grupos: Renko, Range, Kagi, Renko2×, Trades. */
export const AGG_INTERVAL_GROUPS: AggIntervalGroup[] = [
  ...KINDS.map((kind, ki) => ({
    titleKey: TITLE_KEYS[ki]!,
    options: buildTickChartOptions(ki, kind),
  })),
  {
    titleKey: "intervalSectionTrades",
    options: TRADE_CACHE_TRADE_INTERVALS.map((tr, ti) => {
      const gm = GROUP_MINUTES_CACHE2_TRADES_BASE + ti;
      const interval = `${tr}trades`;
      return { value: gm, label: formatCache2IntervalShortLabel("trades500", interval) };
    }),
  },
];

export const AGG_INTERVAL_OPTIONS: { value: number; label: string }[] = AGG_INTERVAL_GROUPS.flatMap((g) => g.options);

/** Só timeframes OHLC (1m … 1M). */
export const CLASSIC_INTERVAL_VALUES: readonly number[] = INTERVAL_OPTIONS.map((o) => o.value);

/** Todos os `groupMinutes` elegíveis (clássicos + atemporais), ordenados. */
export const ALL_INDICATOR_INTERVAL_VALUES: number[] = (() => {
  const classic = INTERVAL_OPTIONS.map((o) => o.value);
  const agg = AGG_INTERVAL_OPTIONS.map((o) => o.value);
  return [...new Set([...classic, ...agg])].sort((a, b) => a - b);
})();

/** Grupos para UI: 1) timeframes clássicos 2) Renko … Trades. */
export const INDICATOR_INTERVAL_GROUPS: AggIntervalGroup[] = [
  { titleKey: "indicatorIntervalsGroupTimeframes", options: INTERVAL_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
  ...AGG_INTERVAL_GROUPS,
];

/**
 * Expande o estado guardado para lista explícita.
 * `[]` = mostrar em todos → union completa (para toggles).
 */
export function expandIntervalsExplicit(intervals: readonly number[]): number[] {
  if (intervals.length === 0) return [...ALL_INDICATOR_INTERVAL_VALUES];
  if (intervals.length === 1 && intervals[0] === 0) return [];
  return [...intervals];
}

/**
 * Liga/desliga **só** um grupo: não colapsa para `[]` quando a união coincide com “tudo”
 * (o atalho global continua a ser o botão “Todos os tempos” → `intervals: []`).
 */
export function applyIntervalGroupToggle(
  expanded: readonly number[],
  groupValues: readonly number[]
): number[] {
  if (groupValues.length === 0) return [...expanded];
  const allIn = groupValues.every((v) => expanded.includes(v));
  const next = allIn
    ? expanded.filter((v) => !groupValues.includes(v))
    : [...new Set([...expanded, ...groupValues])].sort((a, b) => a - b);
  if (next.length === 0) return [0];
  return next;
}

export function getIndicatorIntervalLabel(value: number): string {
  const c = INTERVAL_OPTIONS.find((o) => o.value === value);
  if (c) return c.label;
  const a = AGG_INTERVAL_OPTIONS.find((o) => o.value === value);
  if (a) return a.label;
  return String(value);
}
