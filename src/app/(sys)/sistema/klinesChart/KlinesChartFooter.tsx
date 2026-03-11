"use client";

/**
 * Rodapé do gráfico: mensagem save/load, seletor de candles com +/- (30–150), botões anterior/próximo.
 */
import { VISIBLE_OPTIONS, VISIBLE_COUNT_MIN, VISIBLE_COUNT_MAX } from "../KlinesChartConstants";

export interface KlinesChartFooterProps {
  footerYAxisHex: string;
  footerYAxisTextHex: string;
  isDarkFooterYAxis: boolean;
  saveLoadMsg: string | null;
  intervalLabel: string | undefined;
  groupMinutes: number;
  t: Record<string, string>;
  visibleCount: number;
  setVisibleCount: (v: number | ((prev: number) => number)) => void;
  setStartIndex: (fn: (i: number) => number) => void;
  n: number;
  canPrev: boolean;
  canNext: boolean;
  /** Símbolo exibido (ex.: BTCUSDT). Se onOpenSymbolPanel for passado, o símbolo é clicável. */
  symbol?: string;
  onOpenSymbolPanel?: () => void;
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
  symbol = "BTCUSDT",
  onOpenSymbolPanel,
}: KlinesChartFooterProps) {
  const symbolNode = onOpenSymbolPanel ? (
    <button
      type="button"
      onClick={onOpenSymbolPanel}
      className="font-medium hover:underline underline-offset-1"
      aria-label={t.symbolAria ?? "Select symbol"}
    >
      {symbol}
    </button>
  ) : (
    <span>{symbol}</span>
  );
  const selectOptions = [...new Set([...VISIBLE_OPTIONS, visibleCount])].sort((a, b) => a - b);
  const btnClass = `w-6 h-6 flex items-center justify-center rounded border text-[10px] font-medium disabled:opacity-40 disabled:cursor-not-allowed ${isDarkFooterYAxis ? "border-zinc-500 hover:bg-zinc-600" : "border-zinc-200 hover:bg-zinc-100"}`;
  return (
    <div
      className={`relative z-[11] px-3 pt-3 pb-2 text-[10px] border-t flex items-center justify-end gap-3 flex-wrap ${isDarkFooterYAxis ? "border-zinc-600" : "border-zinc-100"}`}
      style={{ backgroundColor: footerYAxisHex, color: footerYAxisTextHex }}
    >
      {saveLoadMsg && <span className="mr-auto text-emerald-600 font-medium">{saveLoadMsg}</span>}
      <span className="mr-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c - 1)}
          disabled={visibleCount <= VISIBLE_COUNT_MIN}
          className={btnClass}
          aria-label={t.candlesDecrease ?? "Menos candles"}
        >
          −
        </button>
        <select
          id="candles-listbox"
          value={visibleCount}
          onChange={(e) => setVisibleCount(Number(e.target.value))}
          aria-label={t.candlesAria}
          className={`min-w-[2.5rem] text-[10px] font-medium rounded px-1 py-0.5 cursor-pointer ${isDarkFooterYAxis ? "text-zinc-100 bg-zinc-600 border-zinc-500 border" : "text-zinc-700 bg-zinc-100 border border-zinc-200"}`}
        >
          {selectOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + 1)}
          disabled={visibleCount >= VISIBLE_COUNT_MAX}
          className={btnClass}
          aria-label={t.candlesIncrease ?? "Mais candles"}
        >
          +
        </button>
      </span>
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
