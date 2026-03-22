import type { UserIndicatorConfig } from "../KlinesIndicatorsContext";
import type { RegressionOverlayPath } from "../klinesChart/types";
import {
  REGRESSION_LOOKBACK_MAX,
  REGRESSION_LOOKBACK_MIN,
  REGRESSION_PAST_OFFSET_MAX,
  type UserRegressionConfig,
} from "./KlinesRegressionsContext";
import { getIndicatorColumnStart } from "./indicatorsColumnStart";
import {
  CANDLE_REGRESSION_SOURCE_ID,
  ohlcRegressionValueFromRow,
  resolveRegressionSourceColumn,
  type RegressionSourceToken,
} from "./regressionSource";
import {
  evalCubic,
  evalLinear,
  evalQuadratic,
  evalQuartic,
  fitCubic,
  fitLinear,
  fitQuadratic,
  fitQuartic,
} from "./regressionMath";

function lineWidthToStroke(w: "thin" | "normal" | "thick" | undefined): number {
  return w === "thin" ? 0.5 : w === "thick" ? 2 : 1;
}

function parseCell(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Últimos `lookback` pontos válidos a partir do índice `endWi` (fim da amostra), indo para a esquerda. */
function collectSamplesFromWindow(
  windowSlice: (number | string | null)[][],
  col: number,
  lookback: number,
  logScale: boolean,
  pastEndOffsetBars: number
): { wi: number; y: number }[] {
  const cap = Math.max(REGRESSION_LOOKBACK_MIN, Math.min(REGRESSION_LOOKBACK_MAX, lookback));
  const off = Math.max(0, Math.min(REGRESSION_PAST_OFFSET_MAX, Math.round(pastEndOffsetBars)));
  const acc: { wi: number; y: number }[] = [];
  const endWi = windowSlice.length - 1 - off;
  if (endWi < 0) return [];
  for (let wi = endWi; wi >= 0 && acc.length < cap; wi--) {
    const row = windowSlice[wi];
    if (!row) continue;
    const yv = parseCell(row[col] as number | string | null);
    if (yv == null) continue;
    if (logScale && yv <= 0) continue;
    acc.push({ wi, y: yv });
  }
  acc.reverse();
  return acc;
}

function collectSamplesFromOhlcWindow(
  windowSlice: (number | string | null)[][],
  token: RegressionSourceToken,
  lookback: number,
  logScale: boolean,
  pastEndOffsetBars: number
): { wi: number; y: number }[] {
  const cap = Math.max(REGRESSION_LOOKBACK_MIN, Math.min(REGRESSION_LOOKBACK_MAX, lookback));
  const off = Math.max(0, Math.min(REGRESSION_PAST_OFFSET_MAX, Math.round(pastEndOffsetBars)));
  const acc: { wi: number; y: number }[] = [];
  const endWi = windowSlice.length - 1 - off;
  if (endWi < 0) return [];
  for (let wi = endWi; wi >= 0 && acc.length < cap; wi--) {
    const row = windowSlice[wi];
    const yv = ohlcRegressionValueFromRow(row, token);
    if (yv == null) continue;
    if (logScale && yv <= 0) continue;
    acc.push({ wi, y: yv });
  }
  acc.reverse();
  return acc;
}

export function computeRegressionOverlayPaths(args: {
  regressions: UserRegressionConfig[];
  groupMinutes: number;
  userIndicators: UserIndicatorConfig[];
  windowSlice: (number | string | null)[][];
  windowN: number;
  totalSlots: number;
  logScale: boolean;
  /** Se omitido, só preenche `extentYs` (para eixo Y); com cx+y gera também `paths`. */
  cx?: (i: number) => number;
  y?: (price: number) => number;
}): { paths: RegressionOverlayPath[]; extentYs: number[] } {
  const { regressions, groupMinutes, userIndicators, windowSlice, totalSlots, logScale, cx, y } = args;
  const paths: RegressionOverlayPath[] = [];
  const extentYs: number[] = [];
  const drawPaths = cx != null && y != null;

  for (const reg of regressions) {
    if (reg.groupMinutes !== groupMinutes) continue;

    const minPts =
      reg.model === "quartic" ? 5 : reg.model === "cubic" ? 4 : reg.model === "quadratic" ? 3 : 2;
    let samples: { wi: number; y: number }[];
    if (reg.sourceIndicatorId === CANDLE_REGRESSION_SOURCE_ID) {
      samples = collectSamplesFromOhlcWindow(windowSlice, reg.sourceToken as RegressionSourceToken, reg.lookback, logScale);
    } else {
      const u = userIndicators.findIndex((i) => i.id === reg.sourceIndicatorId);
      if (u < 0) continue;
      const ind = userIndicators[u];
      const start = getIndicatorColumnStart(userIndicators, u);
      const col = resolveRegressionSourceColumn(ind, reg.sourceToken as RegressionSourceToken, start);
      if (col == null) continue;
      samples = collectSamplesFromWindow(windowSlice, col, reg.lookback, logScale, reg.pastEndOffsetBars);
    }
    if (samples.length < minPts) continue;

    const xs = samples.map((_, i) => i);
    const ys = samples.map((s) => s.y);
    const coeffs =
      reg.model === "quartic"
        ? fitQuartic(xs, ys)
        : reg.model === "cubic"
          ? fitCubic(xs, ys)
          : reg.model === "quadratic"
            ? fitQuadratic(xs, ys)
            : fitLinear(xs, ys);
    if (!coeffs) continue;

    const firstWi = samples[0].wi;
    const lastWi = samples[samples.length - 1].wi;
    const endWi = Math.min(lastWi + reg.forecastBars, totalSlots - 1);

    const evalAt = (xFit: number): number | null => {
      if (reg.model === "quartic")
        return evalQuartic(coeffs as { a0: number; a1: number; a2: number; a3: number; a4: number }, xFit);
      if (reg.model === "cubic") return evalCubic(coeffs as { a0: number; a1: number; a2: number; a3: number }, xFit);
      if (reg.model === "quadratic") return evalQuadratic(coeffs as { a0: number; a1: number; a2: number }, xFit);
      return evalLinear(coeffs as { a0: number; a1: number }, xFit);
    };

    const dashForecast = reg.lineStyle === "dotted" ? "1 2" : "6 4";
    const strokeW = lineWidthToStroke(reg.lineWidth);

    const fitPts: { x: number; py: number }[] = [];
    for (let wi = firstWi; wi <= lastWi; wi++) {
      const xFit = wi - firstWi;
      const yHat = evalAt(xFit);
      if (yHat == null || !Number.isFinite(yHat)) continue;
      if (logScale && yHat <= 0) continue;
      extentYs.push(yHat);
      if (drawPaths) fitPts.push({ x: cx!(wi), py: y!(yHat) });
    }

    const fcPts: { x: number; py: number }[] = [];
    for (let wi = lastWi + 1; wi <= endWi; wi++) {
      const xFit = wi - firstWi;
      const yHat = evalAt(xFit);
      if (yHat == null || !Number.isFinite(yHat)) continue;
      if (logScale && yHat <= 0) continue;
      extentYs.push(yHat);
      if (drawPaths) {
        if (fcPts.length === 0 && fitPts.length > 0) fcPts.push(fitPts[fitPts.length - 1]!);
        fcPts.push({ x: cx!(wi), py: y!(yHat) });
      }
    }

    if (!drawPaths) continue;

    if (fitPts.length >= 2) {
      const dFit = fitPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.py}`).join(" ");
      paths.push({
        id: `${reg.id}__fit`,
        d: dFit,
        color: reg.color,
        strokeWidth: strokeW,
      });
    }
    if (fcPts.length >= 2) {
      const dFc = fcPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.py}`).join(" ");
      paths.push({
        id: `${reg.id}__fc`,
        d: dFc,
        color: reg.color,
        strokeWidth: strokeW,
        strokeDasharray: dashForecast,
      });
    }
  }

  return { paths, extentYs };
}
