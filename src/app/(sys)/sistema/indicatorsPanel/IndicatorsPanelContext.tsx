"use client";

import { createContext, useContext } from "react";
import type { IndicatorsPanelContextValue } from "./indicatorsPanelTypes";

const IndicatorsPanelContext = createContext<IndicatorsPanelContextValue | null>(null);

export function useIndicatorsPanelContext(): IndicatorsPanelContextValue {
  const ctx = useContext(IndicatorsPanelContext);
  if (!ctx) throw new Error("useIndicatorsPanelContext must be used within IndicatorsPanelContext.Provider");
  return ctx;
}

export { IndicatorsPanelContext };
