"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type VoidFn = () => void;

export interface SaveLoadLayout {
  slot: number;
  config: Record<string, unknown>;
  name?: string;
}

export interface ChartSaveLoadData {
  savedLayouts: SaveLoadLayout[];
  savedLayoutsError: string | null;
  canSaveDefault: boolean;
  canRenameChartModels: boolean;
  getLayoutLabel: (layout: { slot: number; name?: string }) => string;
  onSaveLayout: (slot: number) => void;
  onLoadLayout: (layout: SaveLoadLayout) => void;
  onRenameLayout: (layout: SaveLoadLayout, name: string) => void;
  fetchSavedLayouts: VoidFn;
  isFreeUser: boolean;
  onUpgradeRequest?: VoidFn;
}

export type SaveLoadPanelView = "save" | "load";

interface ChartSaveLoadContextValue {
  panelView: SaveLoadPanelView | null;
  openSavePanel: VoidFn;
  openLoadPanel: VoidFn;
  closePanel: VoidFn;
  saveLoadData: ChartSaveLoadData | null;
  registerSaveLoad: (openSave: VoidFn, openLoad: VoidFn) => void;
  registerSaveLoadData: (data: ChartSaveLoadData | null) => void;
}

const ChartSaveLoadContext = createContext<ChartSaveLoadContextValue | null>(null);

const noop = () => {};

export function ChartSaveLoadProvider({ children }: { children: ReactNode }) {
  const callbacksRef = useRef<{ openSave: VoidFn; openLoad: VoidFn }>({ openSave: noop, openLoad: noop });
  const [panelView, setPanelView] = useState<SaveLoadPanelView | null>(null);
  const [saveLoadData, setSaveLoadData] = useState<ChartSaveLoadData | null>(null);

  const registerSaveLoad = useCallback((openSave: VoidFn, openLoad: VoidFn) => {
    callbacksRef.current.openSave = openSave;
    callbacksRef.current.openLoad = openLoad;
  }, []);

  const registerSaveLoadData = useCallback((data: ChartSaveLoadData | null) => {
    setSaveLoadData(data);
  }, []);

  const openSavePanel = useCallback(() => {
    setPanelView("save");
  }, []);

  const openLoadPanel = useCallback(() => {
    setPanelView("load");
  }, []);

  const closePanel = useCallback(() => {
    setPanelView(null);
  }, []);

  const value = useMemo(
    () => ({
      panelView,
      openSavePanel,
      openLoadPanel,
      closePanel,
      saveLoadData,
      registerSaveLoad,
      registerSaveLoadData,
    }),
    [panelView, openSavePanel, openLoadPanel, closePanel, saveLoadData, registerSaveLoad, registerSaveLoadData]
  );

  return (
    <ChartSaveLoadContext.Provider value={value}>
      {children}
    </ChartSaveLoadContext.Provider>
  );
}

export function useChartSaveLoad(): ChartSaveLoadContextValue {
  const ctx = useContext(ChartSaveLoadContext);
  if (!ctx)
    return {
      panelView: null,
      openSavePanel: noop,
      openLoadPanel: noop,
      closePanel: noop,
      saveLoadData: null,
      registerSaveLoad: () => {},
      registerSaveLoadData: () => {},
    };
  return ctx;
}
