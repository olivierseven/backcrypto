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
import type { Strategy } from "./strategiesTypes";
import { legacyToRoot } from "./strategiesTypes";

interface StrategiesContextValue {
  strategies: Strategy[];
  addStrategy: (s: Strategy) => void;
  updateStrategy: (id: string, s: Partial<Strategy>) => void;
  removeStrategy: (id: string) => void;
  /** Incrementa quando uma estratégia nova é criada (para autosave do layout atual). */
  strategyCreatedTick: number;
  /** Incrementa ao aplicar ou desaplicar estratégia (para autosave do layout e persistir appliedStrategyIds). */
  appliedStrategyIdsTick: number;
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

/** Estratégias e aplicadas vêm só do layout (banco). Não usar localStorage. */
function loadStrategies(): Strategy[] {
  return [];
}

function loadAppliedStrategyIds(): string[] {
  return [];
}

export function StrategiesProvider({ children }: { children: ReactNode }) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [appliedStrategyIds, setAppliedStrategyIds] = useState<string[]>([]);
  const [strategyCreatedTick, setStrategyCreatedTick] = useState(0);
  const [appliedStrategyIdsTick, setAppliedStrategyIdsTick] = useState(0);

  useEffect(() => {
    setStrategies(loadStrategies());
    setAppliedStrategyIds(loadAppliedStrategyIds());
  }, []);

  const addStrategy = useCallback((s: Strategy) => {
    setStrategies((prev) => [...prev, s]);
    setStrategyCreatedTick((x) => x + 1);
  }, []);

  const updateStrategy = useCallback((id: string, patch: Partial<Strategy>) => {
    setStrategies((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setStrategyCreatedTick((x) => x + 1);
  }, []);

  const removeStrategy = useCallback((id: string) => {
    setStrategies((prev) => prev.filter((s) => s.id !== id));
    setAppliedStrategyIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const applyStrategy = useCallback((id: string) => {
    setAppliedStrategyIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setAppliedStrategyIdsTick((t) => t + 1);
  }, []);

  const unapplyStrategy = useCallback((id: string) => {
    setAppliedStrategyIds((prev) => prev.filter((x) => x !== id));
    setAppliedStrategyIdsTick((t) => t + 1);
  }, []);

  const isApplied = useCallback(
    (id: string) => appliedStrategyIds.includes(id),
    [appliedStrategyIds]
  );

  const replaceStrategiesFromLayout = useCallback((raw: unknown) => {
    if (!Array.isArray(raw)) return;
    const list = raw.map((s: unknown) => legacyToRoot(s as Strategy & { conditions?: unknown; combineWith?: unknown }));
    setStrategies(list);
  }, []);

  const replaceAppliedStrategyIdsFromLayout = useCallback((raw: unknown) => {
    if (!Array.isArray(raw)) return;
    const ids = raw.filter((x): x is string => typeof x === "string");
    setAppliedStrategyIds(ids);
  }, []);

  const value = useMemo(
    () => ({
      strategies,
      addStrategy,
      updateStrategy,
      removeStrategy,
      strategyCreatedTick,
      appliedStrategyIdsTick,
      appliedStrategyIds,
      applyStrategy,
      unapplyStrategy,
      isApplied,
      replaceStrategiesFromLayout,
      replaceAppliedStrategyIdsFromLayout,
    }),
    [strategies, addStrategy, updateStrategy, removeStrategy, strategyCreatedTick, appliedStrategyIdsTick, appliedStrategyIds, applyStrategy, unapplyStrategy, isApplied, replaceStrategiesFromLayout, replaceAppliedStrategyIdsFromLayout]
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
      appliedStrategyIdsTick: 0,
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
