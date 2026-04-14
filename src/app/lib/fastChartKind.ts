export const FAST_CHART_KINDS = ["renko", "renko2x", "range", "kagi"] as const;
export type FastChartKind = (typeof FAST_CHART_KINDS)[number];

export function isFastChartKind(x: string): x is FastChartKind {
  return (FAST_CHART_KINDS as readonly string[]).includes(x);
}
