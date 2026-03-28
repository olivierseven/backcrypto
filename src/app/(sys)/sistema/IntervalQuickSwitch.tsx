"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { useChartHeader } from "./ChartHeaderContext";
import { useChartSymbol } from "./ChartSymbolContext";
import type { IntervalOption } from "./klinesChart/types";

/** 8: cabe `1month` (atalho do mês); também 2.5kT, etc. */
const MAX_INPUT_LEN = 8;
const IDLE_MS = 3000;

/** Rótulos exibidos (P5, N25…) e aliases “número primeiro” (5P, 25N…); trades 1000T ↔ 1kT; mês 1month ↔ 1M. */
export function intervalQuickAliases(label: string): string[] {
  const set = new Set<string>([label]);
  const trimmed = label.trim();
  if (/^1month$/i.test(trimmed)) {
    set.add("1M");
  }
  const tick = /^([PNRK])(\d+)$/i.exec(trimmed);
  if (tick) {
    set.add(`${tick[2]}${tick[1]!.toUpperCase()}`);
  }
  const plainT = /^(\d+)T$/i.exec(trimmed);
  if (plainT) {
    set.add(`${plainT[1]}T`);
  }
  const kT = /^(\d+(?:\.\d+)?)kT$/i.exec(trimmed);
  if (kT) {
    const mult = parseFloat(kT[1]!);
    if (Number.isFinite(mult)) {
      const n = Math.round(mult * 1000);
      set.add(`${n}T`);
    }
  }
  return [...set];
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return target.closest('[contenteditable="true"]') != null;
}

/**
 * Começa com número; sufixo em letras (até 6: `month`, ou 2 para P/T…); total ≤ MAX_INPUT_LEN.
 */
export function cleanIntervalQuickInput(raw: string): string {
  const s = raw.replace(/[^0-9a-zA-Z.]/g, "").slice(0, MAX_INPUT_LEN);
  if (!s.length) return "";
  const m = s.match(/^(\d+(?:\.\d+)?)([a-zA-Z]{0,6})/);
  if (!m) return "";
  return (m[1]! + (m[2] ?? "")).slice(0, MAX_INPUT_LEN);
}

function optionMatchesQueryPrefix(o: IntervalOption, q: string): boolean {
  const ql = q.toLowerCase();
  for (const a of intervalQuickAliases(o.label)) {
    if (a.toLowerCase().startsWith(ql)) return true;
  }
  return false;
}

export function matchIntervalsForQuickSwitch(options: readonly IntervalOption[], raw: string): IntervalOption[] {
  const q = cleanIntervalQuickInput(raw);
  if (!q) return [...options].sort((a, b) => a.label.localeCompare(b.label));
  const hit = options.filter((o) => optionMatchesQueryPrefix(o, q));
  const ql = q.toLowerCase();
  return hit.sort((a, b) => {
    const rank = (o: IntervalOption) => {
      let best = Infinity;
      for (const al of intervalQuickAliases(o.label)) {
        const all = al.toLowerCase();
        if (all.startsWith(ql)) {
          best = Math.min(best, al.length);
        }
      }
      return best;
    };
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.label.localeCompare(b.label);
  });
}

function resolvePickedInterval(query: string, matches: IntervalOption[], options: readonly IntervalOption[]): IntervalOption | null {
  const q = cleanIntervalQuickInput(query);
  if (!q) return null;
  const ql = q.toLowerCase();
  for (const o of options) {
    for (const a of intervalQuickAliases(o.label)) {
      if (a.toLowerCase() === ql) return o;
    }
  }
  return matches[0] ?? null;
}

function getGhostSuffix(query: string, firstMatch: IntervalOption | null): string {
  if (!firstMatch) return "";
  const q = cleanIntervalQuickInput(query);
  if (!q) return "";
  const ql = q.toLowerCase();
  let bestAlias: string | null = null;
  let bestGhostLen = Infinity;
  for (const a of intervalQuickAliases(firstMatch.label)) {
    const al = a.toLowerCase();
    if (al.startsWith(ql) && q.length < a.length) {
      const ghostLen = a.length - q.length;
      if (ghostLen < bestGhostLen) {
        bestGhostLen = ghostLen;
        bestAlias = a;
      }
    }
  }
  if (!bestAlias) return "";
  return bestAlias.slice(q.length);
}

type Props = { enabled?: boolean };

/**
 * Troca rápida de timeframe: começa com um dígito; até 5 caracteres; sufixo de no máx. 2 letras.
 * UI igual à troca de símbolos (texto grande + sufixo cinza).
 */
export default function IntervalQuickSwitch({ enabled = true }: Props) {
  const lang = useCryptoLang();
  const tAria = getCryptoT(lang).sistema.klines.intervalQuickSearchAria;
  const {
    intervalPicker,
    intervalQuickSwitchOpen,
    openIntervalQuickSwitch,
    closeIntervalQuickSwitch,
    intervalQuickSwitchInitialRef,
  } = useChartHeader();
  const { symbolQuickSwitchOpen, closeSymbolQuickSwitch } = useChartSymbol();

  const options = useMemo((): IntervalOption[] => {
    if (!intervalPicker) return [];
    const a = intervalPicker.aggIntervalPicker;
    const tier = (o: { value: number; label: string }): IntervalOption => ({
      value: o.value,
      label: o.label,
      param: o.label,
    });
    return [
      ...intervalPicker.intervalOptions,
      ...a.renko.map(tier),
      ...a.range.map(tier),
      ...a.kagi.map(tier),
      ...a.renko2x.map(tier),
      ...a.trades500.map(tier),
    ];
  }, [intervalPicker]);
  const onIntervalChange = intervalPicker?.onIntervalChange;

  const [query, setQuery] = useState("");
  const [idleTick, setIdleTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const openedThisSessionRef = useRef(false);

  const matches = useMemo(() => matchIntervalsForQuickSwitch(options, query), [options, query]);
  const firstMatch = matches[0] ?? null;
  const ghostSuffix = useMemo(() => getGhostSuffix(query, firstMatch), [query, firstMatch]);

  const bumpIdle = useCallback(() => setIdleTick((x) => x + 1), []);

  const setQueryFromInput = useCallback((nextRaw: string) => {
    setQuery(cleanIntervalQuickInput(nextRaw));
  }, []);

  useEffect(() => {
    if (!enabled || !intervalPicker || intervalQuickSwitchOpen || symbolQuickSwitchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (isEditableEventTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1 || !/^[0-9]$/.test(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      closeSymbolQuickSwitch();
      openIntervalQuickSwitch(e.key);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    enabled,
    intervalPicker,
    intervalQuickSwitchOpen,
    symbolQuickSwitchOpen,
    closeSymbolQuickSwitch,
    openIntervalQuickSwitch,
  ]);

  useLayoutEffect(() => {
    if (!intervalQuickSwitchOpen) {
      openedThisSessionRef.current = false;
      return;
    }
    if (openedThisSessionRef.current) return;
    openedThisSessionRef.current = true;

    const seed = intervalQuickSwitchInitialRef.current;
    intervalQuickSwitchInitialRef.current = undefined;
    setIdleTick((x) => x + 1);
    if (seed != null && seed.length > 0) {
      setQueryFromInput(seed);
    } else {
      setQuery("");
    }
    const id = requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const placeCaretAtEnd = () => {
        const len = el.value.length;
        try {
          el.setSelectionRange(len, len);
        } catch {
          /* ignore */
        }
      };
      placeCaretAtEnd();
      requestAnimationFrame(placeCaretAtEnd);
    });
    return () => cancelAnimationFrame(id);
  }, [intervalQuickSwitchOpen, setQueryFromInput]);

  useEffect(() => {
    if (!intervalQuickSwitchOpen) return;
    const t = window.setTimeout(() => closeIntervalQuickSwitch(), IDLE_MS);
    return () => window.clearTimeout(t);
  }, [intervalQuickSwitchOpen, query, idleTick, closeIntervalQuickSwitch]);

  const confirm = useCallback(() => {
    if (!onIntervalChange) {
      closeIntervalQuickSwitch();
      return;
    }
    const picked = resolvePickedInterval(query, matches, options);
    if (picked) {
      onIntervalChange(picked.value);
      closeIntervalQuickSwitch();
    }
  }, [query, matches, options, onIntervalChange, closeIntervalQuickSwitch]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      bumpIdle();
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeIntervalQuickSwitch();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        confirm();
      }
    },
    [bumpIdle, closeIntervalQuickSwitch, confirm]
  );

  if (!intervalQuickSwitchOpen) return null;

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={MAX_INPUT_LEN}
        value={query}
        onChange={(e) => {
          bumpIdle();
          setQueryFromInput(e.target.value);
        }}
        onKeyDown={onKeyDown}
        className="sr-only"
        aria-label={tAria}
        aria-live="polite"
        aria-atomic="true"
      />
      <div
        className="pointer-events-none fixed inset-0 z-[1350] flex items-center justify-center px-4"
        aria-hidden
      >
        <div className="flex max-w-[min(100%,28rem)] flex-nowrap items-baseline justify-center gap-0 overflow-hidden font-mono text-3xl font-bold tracking-wider text-zinc-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)] sm:text-4xl md:text-5xl">
          <span>{query}</span>
          {ghostSuffix ? (
            <span className="font-semibold text-zinc-300">{ghostSuffix}</span>
          ) : query.trim() !== "" && firstMatch ? (
            <span className="font-semibold text-zinc-300">{firstMatch.label}</span>
          ) : null}
        </div>
      </div>
    </>
  );
}
