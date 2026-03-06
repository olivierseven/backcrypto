"use client";

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react";

export interface ChartHeaderData {
  chartContainerWidth: number | null;
  priceText: string | null;
  pctText: string | null;
  max24h: string | null;
  min24h: string | null;
  vol24hBtc: string | null;
  vol24hUsd: string | null;
}

const defaultData: ChartHeaderData = {
  chartContainerWidth: null,
  priceText: null,
  pctText: null,
  max24h: null,
  min24h: null,
  vol24hBtc: null,
  vol24hUsd: null,
};

interface ChartHeaderContextValue {
  data: ChartHeaderData;
  setHeaderData: (d: ChartHeaderData | null) => void;
}

const ChartHeaderContext = createContext<ChartHeaderContextValue | null>(null);

function chartHeaderDataEqual(a: ChartHeaderData, b: ChartHeaderData): boolean {
  return (
    a.chartContainerWidth === b.chartContainerWidth &&
    a.priceText === b.priceText &&
    a.pctText === b.pctText &&
    a.max24h === b.max24h &&
    a.min24h === b.min24h &&
    a.vol24hBtc === b.vol24hBtc &&
    a.vol24hUsd === b.vol24hUsd
  );
}

export function ChartHeaderProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ChartHeaderData>(defaultData);
  const setHeaderData = useCallback((d: ChartHeaderData | null) => {
    const next = d ?? defaultData;
    setData((prev) => (chartHeaderDataEqual(prev, next) ? prev : next));
  }, []);
  const value = useMemo(
    () => ({ data, setHeaderData }),
    [data, setHeaderData]
  );
  return (
    <ChartHeaderContext.Provider value={value}>
      {children}
    </ChartHeaderContext.Provider>
  );
}

export function useChartHeader(): ChartHeaderContextValue {
  const ctx = useContext(ChartHeaderContext);
  if (!ctx) return { data: defaultData, setHeaderData: () => {} };
  return ctx;
}
