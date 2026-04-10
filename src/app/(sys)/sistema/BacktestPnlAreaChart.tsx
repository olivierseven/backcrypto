"use client";

import { useMemo } from "react";
import type { RobotBacktestRow } from "./robotBacktest";

const W = 520;
const H = 176;
const PAD_L = 50;
const PAD_R = 10;
const PAD_T = 18;
const PAD_B = 30;

function fmtPctAxis(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 100) return `${n.toFixed(0)}%`;
  if (a >= 10) return `${n.toFixed(1)}%`;
  return `${n.toFixed(2)}%`;
}

/** P&L do robô em % vs capital inicial; linha buy & hold = diagonal 0% → ganho do B&amp;H em % do inicial virtual. */
export default function BacktestPnlAreaChart(props: {
  rows: RobotBacktestRow[];
  initialUsdt: number;
  /** % final do buy & hold vs capital inicial (mesma escala que a curva do robô); null = não desenhar linha. */
  buyHoldNetPnlPct: number | null;
  title: string;
  axisLabel?: string;
  buyHoldLegend?: string;
}) {
  const { rows, initialUsdt, buyHoldNetPnlPct, title, axisLabel, buyHoldLegend } = props;

  const chart = useMemo(() => {
    const n = rows.length;
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;

    const inv0 = initialUsdt > 1e-9 ? initialUsdt : 1;
    const toPct = (eq: number) => (100 * (eq - initialUsdt)) / inv0;

    const pnls: number[] = rows.map((r) => {
      const eq = r.equityUsdt;
      return Number.isFinite(eq) ? toPct(eq) : NaN;
    });
    for (let i = 0; i < pnls.length; i++) {
      if (!Number.isFinite(pnls[i])) {
        pnls[i] = i > 0 ? pnls[i - 1] : 0;
      }
    }

    const bhFinal =
      buyHoldNetPnlPct != null && Number.isFinite(buyHoldNetPnlPct) ? buyHoldNetPnlPct : null;
    const bhAt = (i: number) => {
      if (bhFinal == null) return 0;
      if (n <= 1) return bhFinal;
      return (i / (n - 1)) * bhFinal;
    };

    if (n === 0) {
      return {
        lineD: "",
        buyHoldD: "",
        greenD: "",
        redD: "",
        zeroY: PAD_T + plotH / 2,
        minV: 0,
        maxV: 1,
        yTicks: [] as { v: number; y: number }[],
        firstBar: "",
        lastBar: "",
        single: null as { cx: number; cy: number; positive: boolean } | null,
      };
    }

    let minP = Math.min(0, ...pnls);
    let maxP = Math.max(0, ...pnls);
    if (bhFinal != null) {
      minP = Math.min(minP, 0, bhFinal);
      maxP = Math.max(maxP, 0, bhFinal);
    }
    if (Math.abs(maxP - minP) < 1e-6) {
      minP -= 0.5;
      maxP += 0.5;
    }
    const pad = (maxP - minP) * 0.08;
    const minV = minP - pad;
    const maxV = maxP + pad;

    const xAt = (i: number) => PAD_L + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const yAt = (v: number) => PAD_T + plotH - ((v - minV) / (maxV - minV)) * plotH;
    const zeroY = yAt(0);

    const pts = pnls.map((v, i) => ({ x: xAt(i), y: yAt(v), v }));
    const lineD =
      n === 1
        ? ""
        : pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

    let buyHoldD = "";
    if (bhFinal != null) {
      if (n === 1) {
        const cx = xAt(0);
        const y0 = yAt(0);
        const y1 = yAt(bhFinal);
        buyHoldD = `M ${cx.toFixed(2)} ${y0.toFixed(2)} L ${cx.toFixed(2)} ${y1.toFixed(2)}`;
      } else {
        buyHoldD = Array.from({ length: n }, (_, i) => {
          const x = xAt(i);
          const y = yAt(bhAt(i));
          return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(" ");
      }
    }

    const green: string[] = [];
    const red: string[] = [];
    const eps = 1e-12;

    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const v0 = p0.v;
      const v1 = p1.v;
      const { x: x0, y: y0 } = p0;
      const { x: x1, y: y1 } = p1;

      if (v0 >= -eps && v1 >= -eps) {
        green.push(
          `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x1.toFixed(2)} ${zeroY.toFixed(2)} L ${x0.toFixed(2)} ${zeroY.toFixed(2)} Z`
        );
      } else if (v0 <= eps && v1 <= eps) {
        red.push(
          `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x1.toFixed(2)} ${zeroY.toFixed(2)} L ${x0.toFixed(2)} ${zeroY.toFixed(2)} Z`
        );
      } else if (v0 > eps && v1 < -eps) {
        const t = v0 / (v0 - v1);
        const xc = x0 + t * (x1 - x0);
        green.push(
          `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${xc.toFixed(2)} ${zeroY.toFixed(2)} L ${x0.toFixed(2)} ${zeroY.toFixed(2)} Z`
        );
        red.push(
          `M ${xc.toFixed(2)} ${zeroY.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x1.toFixed(2)} ${zeroY.toFixed(2)} Z`
        );
      } else if (v0 < -eps && v1 > eps) {
        const t = v0 / (v0 - v1);
        const xc = x0 + t * (x1 - x0);
        red.push(
          `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${xc.toFixed(2)} ${zeroY.toFixed(2)} L ${x0.toFixed(2)} ${zeroY.toFixed(2)} Z`
        );
        green.push(
          `M ${xc.toFixed(2)} ${zeroY.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x1.toFixed(2)} ${zeroY.toFixed(2)} Z`
        );
      } else {
        if (v0 >= -eps || v1 >= -eps) {
          green.push(
            `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x1.toFixed(2)} ${zeroY.toFixed(2)} L ${x0.toFixed(2)} ${zeroY.toFixed(2)} Z`
          );
        } else {
          red.push(
            `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x1.toFixed(2)} ${zeroY.toFixed(2)} L ${x0.toFixed(2)} ${zeroY.toFixed(2)} Z`
          );
        }
      }
    }

    const tickVals: number[] = [maxV, minV];
    if (minV < -1e-9 && maxV > 1e-9) tickVals.splice(1, 0, 0);
    tickVals.sort((a, b) => b - a);
    const yTicks = tickVals.map((v) => ({ v, y: yAt(v) }));

    const single =
      n === 1 ? { cx: xAt(0), cy: yAt(pnls[0]), positive: pnls[0] >= 0 } : null;

    return {
      lineD,
      buyHoldD,
      greenD: green.join(" "),
      redD: red.join(" "),
      zeroY,
      minV,
      maxV,
      yTicks,
      firstBar: String(rows[0]?.barNum ?? ""),
      lastBar: String(rows[n - 1]?.barNum ?? ""),
      single,
    };
  }, [rows, initialUsdt, buyHoldNetPnlPct]);

  const strokeClass =
    rows.length > 0 && Number.isFinite(rows[rows.length - 1].equityUsdt)
      ? (100 * (rows[rows.length - 1].equityUsdt - initialUsdt)) / (initialUsdt > 1e-9 ? initialUsdt : 1) >= 0
        ? "stroke-emerald-700"
        : "stroke-red-700"
      : "stroke-zinc-600";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1.5 px-0.5">
        <p className="text-xs font-semibold text-zinc-800">{title}</p>
        {buyHoldLegend && chart.buyHoldD ? (
          <span className="text-[10px] text-sky-700 font-medium flex items-center gap-1">
            <span className="inline-block w-4 h-0 border-t border-sky-600 border-dashed" aria-hidden />
            {buyHoldLegend}
          </span>
        ) : null}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto max-h-[220px]"
        role="img"
        aria-label={title}
      >
        {axisLabel ? (
          <text x={4} y={PAD_T + 2} className="fill-zinc-500 text-[9px]">
            {axisLabel}
          </text>
        ) : null}
        {chart.yTicks.map(({ v, y }, i) => (
          <g key={`yt-${i}-${v}`}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
              className={Math.abs(v) < 1e-9 ? "stroke-zinc-300" : "stroke-zinc-100"}
              strokeWidth={Math.abs(v) < 1e-9 ? 1.25 : 1}
              strokeDasharray={Math.abs(v) < 1e-9 ? "5 4" : "0"}
            />
            <text
              x={PAD_L - 6}
              y={y + 3}
              textAnchor="end"
              className="fill-zinc-500 text-[9px] font-mono tabular-nums"
            >
              {fmtPctAxis(v)}
            </text>
          </g>
        ))}
        {chart.greenD ? <path d={chart.greenD} className="fill-emerald-500/25" /> : null}
        {chart.redD ? <path d={chart.redD} className="fill-red-500/18" /> : null}
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={chart.zeroY}
          y2={chart.zeroY}
          className="stroke-zinc-400/90"
          strokeWidth={1}
        />
        {chart.buyHoldD ? (
          <path
            d={chart.buyHoldD}
            fill="none"
            className="stroke-sky-600"
            strokeWidth={1.75}
            strokeDasharray="5 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {chart.lineD ? (
          <path
            d={chart.lineD}
            fill="none"
            className={strokeClass}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {chart.single ? (
          <circle
            cx={chart.single.cx}
            cy={chart.single.cy}
            r={4}
            className={
              chart.single.positive ? "fill-emerald-600 stroke-white" : "fill-red-600 stroke-white"
            }
            strokeWidth={1.5}
          />
        ) : null}
        <text x={PAD_L} y={H - 4} className="fill-zinc-400 text-[9px]">
          {chart.firstBar ? `Bar ${chart.firstBar}` : ""}
        </text>
        <text x={W - PAD_R} y={H - 4} textAnchor="end" className="fill-zinc-400 text-[9px]">
          {chart.lastBar ? `Bar ${chart.lastBar}` : ""}
        </text>
      </svg>
    </div>
  );
}
