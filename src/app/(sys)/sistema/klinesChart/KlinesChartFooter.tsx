"use client";

/**
 * Rodapé do gráfico: mensagem save/load, par, seletor de candles e botões anterior/próximo.
 */
import { VISIBLE_OPTIONS } from "../KlinesChartConstants";
import type { VisibleCount } from "../KlinesChartConstants";

export interface KlinesChartFooterProps {
  footerYAxisHex: string;
  footerYAxisTextHex: string;
  isDarkFooterYAxis: boolean;
  saveLoadMsg: string | null;
  intervalLabel: string | undefined;
  groupMinutes: number;
  t: Record<string, string>;
  visibleCount: VisibleCount;
  setVisibleCount: (v: VisibleCount) => void;
  setStartIndex: (fn: (i: number) => number) => void;
  n: number;
  canPrev: boolean;
  canNext: boolean;
}

export function KlinesChartFooter({
  footerYAxisHex,
  footerYAxisTextHex,
  isDarkFooterYAxis,
  saveLoadMsg,
  intervalLabel,
  groupMinutes,
  t,
  visibleCount,
  setVisibleCount,
  setStartIndex,
  n,
  canPrev,
  canNext,
}: KlinesChartFooterProps) {
  return (
    <div
      className={`px-3 pt-3 pb-2 text-[10px] border-t flex items-center justify-end gap-3 flex-wrap ${isDarkFooterYAxis ? "border-zinc-600" : "border-zinc-100"}`}
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
  );
}
