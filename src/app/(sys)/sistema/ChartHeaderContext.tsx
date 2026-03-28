"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AggIntervalPickerConfig, IntervalOption } from "./klinesChart/types";

/** Registo do seletor de intervalo (KlinesTable) para o header ao lado de Plans. */
export type ChartIntervalPickerRegistration = {
  groupMinutes: number;
  intervalLabel: string;
  onIntervalChange: (value: number) => void;
  intervalOptions: IntervalOption[];
  aggIntervalPicker: AggIntervalPickerConfig;
};

export interface ChartHeaderData {
  chartContainerWidth: number | null;
  priceText: string | null;
  pctText: string | null;
  max24h: string | null;
  min24h: string | null;
  vol24hBtc: string | null;
  vol24hUsd: string | null;
  intervalLabel: string | null;
}

const defaultData: ChartHeaderData = {
  chartContainerWidth: null,
  priceText: null,
  pctText: null,
  max24h: null,
  min24h: null,
  vol24hBtc: null,
  vol24hUsd: null,
  intervalLabel: null,
};

function chartHeaderDataEqual(a: ChartHeaderData, b: ChartHeaderData): boolean {
  return (
    a.chartContainerWidth === b.chartContainerWidth &&
    a.priceText === b.priceText &&
    a.pctText === b.pctText &&
    a.max24h === b.max24h &&
    a.min24h === b.min24h &&
    a.vol24hBtc === b.vol24hBtc &&
    a.vol24hUsd === b.vol24hUsd &&
    a.intervalLabel === b.intervalLabel
  );
}

type ChartHeaderContextValue = {
  data: ChartHeaderData;
  setHeaderData: (d: ChartHeaderData | null) => void;
  intervalPicker: ChartIntervalPickerRegistration | null;
  setIntervalPicker: (next: ChartIntervalPickerRegistration | null) => void;
};

const ChartHeaderContext = createContext<ChartHeaderContextValue | null>(null);

export function ChartHeaderProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ChartHeaderData>(defaultData);
  const [intervalPicker, setIntervalPickerState] = useState<ChartIntervalPickerRegistration | null>(null);

  const setHeaderData = useCallback((d: ChartHeaderData | null) => {
    const next = d ?? defaultData;
    setData((prev) => (chartHeaderDataEqual(prev, next) ? prev : next));
  }, []);

  const setIntervalPicker = useCallback((next: ChartIntervalPickerRegistration | null) => {
    setIntervalPickerState(next);
  }, []);

  const value = useMemo(
    () => ({ data, setHeaderData, intervalPicker, setIntervalPicker }),
    [data, setHeaderData, intervalPicker, setIntervalPicker]
  );

  return <ChartHeaderContext.Provider value={value}>{children}</ChartHeaderContext.Provider>;
}

export function useChartHeader(): ChartHeaderContextValue {
  const ctx = useContext(ChartHeaderContext);
  if (!ctx) {
    return {
      data: defaultData,
      setHeaderData: () => {},
      intervalPicker: null,
      setIntervalPicker: () => {},
    };
  }
  return ctx;
}
