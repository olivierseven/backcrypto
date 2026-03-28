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
import { useChartHeader } from "./ChartHeaderContext";
import { useChartSymbol } from "./ChartSymbolContext";

const MAX_INPUT_LEN = 9;
const IDLE_MS = 3000;

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return target.closest("[contenteditable=\"true\"]") != null;
}

/** Ordem: prefixo; senão substring (mais curto primeiro). */
export function matchSymbolsForQuickSwitch(options: readonly string[], raw: string): string[] {
  const q = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!q) return [...options].sort((a, b) => a.localeCompare(b));
  const upper = options.map((s) => s.toUpperCase());
  const prefixIdx: number[] = [];
  for (let i = 0; i < upper.length; i++) {
    if (upper[i]!.startsWith(q)) prefixIdx.push(i);
  }
  if (prefixIdx.length > 0) {
    return prefixIdx.map((i) => options[i]!).sort((a, b) => a.localeCompare(b));
  }
  const subIdx: number[] = [];
  for (let i = 0; i < upper.length; i++) {
    if (upper[i]!.includes(q)) subIdx.push(i);
  }
  return subIdx
    .map((i) => options[i]!)
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
}

function resolvePickedSymbol(query: string, matches: string[], options: readonly string[]): string | null {
  const u = query.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!u) return null;
  if (options.some((s) => s.toUpperCase() === u)) {
    return options.find((s) => s.toUpperCase() === u) ?? null;
  }
  return matches[0] ?? null;
}

function getGhostSuffix(query: string, firstMatch: string | null): string {
  if (!firstMatch) return "";
  const q = query.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!q) return "";
  const fm = firstMatch.toUpperCase();
  if (!fm.startsWith(q)) return "";
  return firstMatch.slice(q.length);
}

type Props = { enabled?: boolean };

/**
 * Troca rápida: sem modal — letras grandes no topo; sufixo cinza só visual (placeholder).
 * Input invisível captura teclas; Enter confirma, Esc cancela.
 */
export default function SymbolQuickSwitch({ enabled = true }: Props) {
  const {
    symbolOptions,
    setSymbol,
    symbolQuickSwitchOpen,
    openSymbolQuickSwitch,
    closeSymbolQuickSwitch,
    quickSwitchInitialRef,
  } = useChartSymbol();
  const { intervalQuickSwitchOpen, closeIntervalQuickSwitch } = useChartHeader();
  const [query, setQuery] = useState("");
  const [idleTick, setIdleTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const quickSwitchOpenedThisSessionRef = useRef(false);

  const matches = useMemo(() => matchSymbolsForQuickSwitch(symbolOptions, query), [symbolOptions, query]);
  const firstMatch = matches[0] ?? null;
  const ghostSuffix = useMemo(() => getGhostSuffix(query, firstMatch), [query, firstMatch]);

  const bumpIdle = useCallback(() => setIdleTick((x) => x + 1), []);

  const setQueryFromInput = useCallback((nextRaw: string) => {
    const cleaned = nextRaw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, MAX_INPUT_LEN);
    setQuery(cleaned);
  }, []);

  useEffect(() => {
    if (!enabled || symbolQuickSwitchOpen || intervalQuickSwitchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (isEditableEventTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1 || !/^[a-zA-Z]$/.test(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      closeIntervalQuickSwitch();
      openSymbolQuickSwitch(e.key.toUpperCase());
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled, symbolQuickSwitchOpen, intervalQuickSwitchOpen, closeIntervalQuickSwitch, openSymbolQuickSwitch]);

  useLayoutEffect(() => {
    if (!symbolQuickSwitchOpen) {
      quickSwitchOpenedThisSessionRef.current = false;
      return;
    }
    if (quickSwitchOpenedThisSessionRef.current) return;
    quickSwitchOpenedThisSessionRef.current = true;

    const seed = quickSwitchInitialRef.current;
    quickSwitchInitialRef.current = undefined;
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
  }, [symbolQuickSwitchOpen, setQueryFromInput]);

  useEffect(() => {
    if (!symbolQuickSwitchOpen) return;
    const t = window.setTimeout(() => closeSymbolQuickSwitch(), IDLE_MS);
    return () => window.clearTimeout(t);
  }, [symbolQuickSwitchOpen, query, idleTick, closeSymbolQuickSwitch]);

  const confirm = useCallback(() => {
    const picked = resolvePickedSymbol(query, matches, symbolOptions);
    if (picked) {
      setSymbol(picked);
      closeSymbolQuickSwitch();
    }
  }, [query, matches, symbolOptions, setSymbol, closeSymbolQuickSwitch]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      bumpIdle();
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeSymbolQuickSwitch();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        confirm();
      }
    },
    [bumpIdle, closeSymbolQuickSwitch, confirm]
  );

  if (!symbolQuickSwitchOpen) return null;

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
        aria-label="Symbol quick search"
        aria-live="polite"
        aria-atomic="true"
      />
      <div
        className="pointer-events-none fixed inset-0 z-[1350] flex items-center justify-center px-4"
        aria-hidden
      >
        <div className="flex max-w-[min(100%,28rem)] flex-nowrap items-baseline justify-center gap-0 overflow-hidden font-mono text-3xl font-bold uppercase tracking-wider text-zinc-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)] sm:text-4xl md:text-5xl">
          <span>{query}</span>
          {ghostSuffix ? (
            <span className="font-semibold text-zinc-300">{ghostSuffix}</span>
          ) : query.trim() !== "" && firstMatch ? (
            <span className="font-semibold text-zinc-300">{firstMatch}</span>
          ) : null}
        </div>
      </div>
    </>
  );
}
