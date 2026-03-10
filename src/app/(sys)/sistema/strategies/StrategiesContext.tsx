"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { KLINE_STRATEGIES_KEY, KLINE_STRATEGIES_APPLIED_KEY } from "../KlinesChartConstants";
import type { Strategy } from "./strategiesTypes";
import { legacyToRoot } from "./strategiesTypes";

interface StrategiesContextValue {
  strategies: Strategy[];
  addStrategy: (s: Strategy) => void;
  updateStrategy: (id: string, s: Partial<Strategy>) => void;
  removeStrategy: (id: string) => void;
  /** Incrementa quando uma estratégia nova é criada (para autosave do layout atual). */
  strategyCreatedTick: number;
  /** IDs das estratégias que têm coluna na tabela (aplicadas). */
  appliedStrategyIds: string[];
  applyStrategy: (id: string) => void;
  unapplyStrategy: (id: string) => void;
  isApplied: (id: string) => boolean;
  /** Restaura lista de estratégias a partir do layout (ex.: ao carregar layout salvo). */
  replaceStrategiesFromLayout: (raw: unknown) => void;
  /** Restaura lista de IDs aplicados a partir do layout. */
  replaceAppliedStrategyIdsFromLayout: (raw: unknown) => void;
}

const StrategiesContext = createContext<StrategiesContextValue | null>(null);

function loadStrategies(): Strategy[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KLINE_STRATEGIES_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map((s: unknown) => legacyToRoot(s as Strategy & { conditions?: unknown; combineWith?: unknown }));
  } catch {
    return [];
  }
}

function saveStrategies(list: Strategy[]) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KLINE_STRATEGIES_KEY, JSON.stringify(list));
    }
  } catch {
    /* ignore */
  }
}

function loadAppliedStrategyIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KLINE_STRATEGIES_APPLIED_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveAppliedStrategyIds(ids: string[]) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KLINE_STRATEGIES_APPLIED_KEY, JSON.stringify(ids));
    }
  } catch {
    /* ignore */
  }
}

export function StrategiesProvider({ children }: { children: ReactNode }) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [appliedStrategyIds, setAppliedStrategyIds] = useState<string[]>([]);
  const [strategyCreatedTick, setStrategyCreatedTick] = useState(0);

  useEffect(() => {
    setStrategies(loadStrategies());
    setAppliedStrategyIds(loadAppliedStrategyIds());
  }, []);

  const addStrategy = useCallback((s: Strategy) => {
    setStrategies((prev) => {
      const next = [...prev, s];
      saveStrategies(next);
      return next;
    });
    setStrategyCreatedTick((x) => x + 1);
  }, []);

  const updateStrategy = useCallback((id: string, patch: Partial<Strategy>) => {
    setStrategies((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      saveStrategies(next);
      return next;
    });
  }, []);

  const removeStrategy = useCallback((id: string) => {
    setStrategies((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveStrategies(next);
      return next;
    });
    setAppliedStrategyIds((prev) => {
      const next = prev.filter((x) => x !== id);
      saveAppliedStrategyIds(next);
      return next;
    });
  }, []);

  const applyStrategy = useCallback((id: string) => {
    setAppliedStrategyIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveAppliedStrategyIds(next);
      return next;
    });
  }, []);

  const unapplyStrategy = useCallback((id: string) => {
    setAppliedStrategyIds((prev) => {
      const next = prev.filter((x) => x !== id);
      saveAppliedStrategyIds(next);
      return next;
    });
  }, []);

  const isApplied = useCallback(
    (id: string) => appliedStrategyIds.includes(id),
    [appliedStrategyIds]
  );

  const replaceStrategiesFromLayout = useCallback((raw: unknown) => {
    if (!Array.isArray(raw)) return;
    const list = raw.map((s: unknown) => legacyToRoot(s as Strategy & { conditions?: unknown; combineWith?: unknown }));
    setStrategies(list);
    saveStrategies(list);
  }, []);

  const replaceAppliedStrategyIdsFromLayout = useCallback((raw: unknown) => {
    if (!Array.isArray(raw)) return;
    const ids = raw.filter((x): x is string => typeof x === "string");
    setAppliedStrategyIds(ids);
    saveAppliedStrategyIds(ids);
  }, []);

  const value = useMemo(
    () => ({
      strategies,
      addStrategy,
      updateStrategy,
      removeStrategy,
      strategyCreatedTick,
      appliedStrategyIds,
      applyStrategy,
      unapplyStrategy,
      isApplied,
      replaceStrategiesFromLayout,
      replaceAppliedStrategyIdsFromLayout,
    }),
    [strategies, addStrategy, updateStrategy, removeStrategy, strategyCreatedTick, appliedStrategyIds, applyStrategy, unapplyStrategy, isApplied, replaceStrategiesFromLayout, replaceAppliedStrategyIdsFromLayout]
  );

  return (
    <StrategiesContext.Provider value={value}>
      {children}
    </StrategiesContext.Provider>
  );
}

export function useStrategies(): StrategiesContextValue {
  const ctx = useContext(StrategiesContext);
  if (!ctx) {
    return {
      strategies: [],
      addStrategy: () => {},
      updateStrategy: () => {},
      removeStrategy: () => {},
      strategyCreatedTick: 0,
      appliedStrategyIds: [],
      applyStrategy: () => {},
      unapplyStrategy: () => {},
      isApplied: () => false,
      replaceStrategiesFromLayout: () => {},
      replaceAppliedStrategyIdsFromLayout: () => {},
    };
  }
  return ctx;
}
