"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { AggIntervalPickerConfig, IntervalOption } from "./klinesChart/types";

/** Registo do seletor de intervalo (KlinesTable) para o header ao lado de Plans. */
export type ChartIntervalPickerRegistration = {
  groupMinutes: number;
  intervalLabel: string;
  onIntervalChange: (value: number) => void;
  intervalOptions: IntervalOption[];
  aggIntervalPicker: AggIntervalPickerConfig;
  /** Layout default: bloquear 1m e atemporais na UI (dropdown / troca rápida). */
  isIntervalOptionDisabled?: (value: number) => boolean;
};

export interface ChartHeaderData {
  chartContainerWidth: number | null;
  priceText: string | null;
  /** Preço de referência numérico (USDT) para o par atual — mesmo valor usado em `priceText`, sem formatação. */
  lastPriceUsdt: number | null;
  pctText: string | null;
  max24h: string | null;
  min24h: string | null;
  vol24hBtc: string | null;
  vol24hUsd: string | null;
  intervalLabel: string | null;
  /** Preço limite de compra (USDT) na boleta, para linha no gráfico; null se não aplicável. */
  limitBuyOrderPriceUsdt: number | null;
  /** Ordens limite de compra abertas na Binance (NEW / parcial) — preços para linhas no gráfico. */
  openLimitBuyPricesUsdt: number[];
  /** Mesmas ordens com id (cancelar no gráfico). */
  openLimitBuyOrdersUsdt: { orderId: string; price: number }[];
  /** Ordens limite de venda abertas (preços para linhas vermelhas no gráfico). */
  openLimitSellPricesUsdt: number[];
  openLimitSellOrdersUsdt: { orderId: string; price: number }[];
  /** Preço USDT no eixo principal onde a mira está fixa; null sem mira ou mira só em painel secundário. */
  crosshairMainPriceUsdt: number | null;
}

const defaultData: ChartHeaderData = {
  chartContainerWidth: null,
  priceText: null,
  lastPriceUsdt: null,
  pctText: null,
  max24h: null,
  min24h: null,
  vol24hBtc: null,
  vol24hUsd: null,
  intervalLabel: null,
  limitBuyOrderPriceUsdt: null,
  openLimitBuyPricesUsdt: [],
  openLimitBuyOrdersUsdt: [],
  openLimitSellPricesUsdt: [],
  openLimitSellOrdersUsdt: [],
  crosshairMainPriceUsdt: null,
};

function sameNumberArray(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sameLimitBuyOrders(
  a: { orderId: string; price: number }[],
  b: { orderId: string; price: number }[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].orderId !== b[i].orderId || a[i].price !== b[i].price) return false;
  }
  return true;
}

function chartHeaderDataEqual(a: ChartHeaderData, b: ChartHeaderData): boolean {
  return (
    a.chartContainerWidth === b.chartContainerWidth &&
    a.priceText === b.priceText &&
    a.lastPriceUsdt === b.lastPriceUsdt &&
    a.pctText === b.pctText &&
    a.max24h === b.max24h &&
    a.min24h === b.min24h &&
    a.vol24hBtc === b.vol24hBtc &&
    a.vol24hUsd === b.vol24hUsd &&
    a.intervalLabel === b.intervalLabel &&
    a.limitBuyOrderPriceUsdt === b.limitBuyOrderPriceUsdt &&
    sameNumberArray(a.openLimitBuyPricesUsdt, b.openLimitBuyPricesUsdt) &&
    sameLimitBuyOrders(a.openLimitBuyOrdersUsdt, b.openLimitBuyOrdersUsdt) &&
    sameNumberArray(a.openLimitSellPricesUsdt, b.openLimitSellPricesUsdt) &&
    sameLimitBuyOrders(a.openLimitSellOrdersUsdt, b.openLimitSellOrdersUsdt) &&
    a.crosshairMainPriceUsdt === b.crosshairMainPriceUsdt
  );
}

type ChartHeaderContextValue = {
  data: ChartHeaderData;
  setHeaderData: (d: ChartHeaderData | null) => void;
  setLimitBuyOrderPriceUsdt: (v: number | null) => void;
  setOpenLimitBuyPricesUsdt: (v: number[]) => void;
  setOpenLimitBuyOrdersUsdt: (v: { orderId: string; price: number }[]) => void;
  setOpenLimitSellPricesUsdt: (v: number[]) => void;
  setOpenLimitSellOrdersUsdt: (v: { orderId: string; price: number }[]) => void;
  setCrosshairMainPriceUsdt: (v: number | null) => void;
  intervalPicker: ChartIntervalPickerRegistration | null;
  setIntervalPicker: (next: ChartIntervalPickerRegistration | null) => void;
  /** Troca rápida de timeframe por teclado (número + sufixo de letra). */
  intervalQuickSwitchOpen: boolean;
  openIntervalQuickSwitch: (initialQuery?: string) => void;
  closeIntervalQuickSwitch: () => void;
  intervalQuickSwitchInitialRef: MutableRefObject<string | undefined>;
};

const ChartHeaderContext = createContext<ChartHeaderContextValue | null>(null);

export function ChartHeaderProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ChartHeaderData>(defaultData);
  const [intervalPicker, setIntervalPickerState] = useState<ChartIntervalPickerRegistration | null>(null);
  const [intervalQuickSwitchOpen, setIntervalQuickSwitchOpen] = useState(false);
  const intervalQuickSwitchInitialRef = useRef<string | undefined>(undefined);

  const setHeaderData = useCallback((d: ChartHeaderData | null) => {
    const next = d ?? defaultData;
    setData((prev) => (chartHeaderDataEqual(prev, next) ? prev : next));
  }, []);

  const setLimitBuyOrderPriceUsdt = useCallback((v: number | null) => {
    setData((prev) => {
      const next = { ...prev, limitBuyOrderPriceUsdt: v };
      return chartHeaderDataEqual(prev, next) ? prev : next;
    });
  }, []);

  const setOpenLimitBuyPricesUsdt = useCallback((v: number[]) => {
    setData((prev) => {
      const next = { ...prev, openLimitBuyPricesUsdt: v };
      return chartHeaderDataEqual(prev, next) ? prev : next;
    });
  }, []);

  const setOpenLimitBuyOrdersUsdt = useCallback((v: { orderId: string; price: number }[]) => {
    setData((prev) => {
      const next = { ...prev, openLimitBuyOrdersUsdt: v };
      return chartHeaderDataEqual(prev, next) ? prev : next;
    });
  }, []);

  const setOpenLimitSellPricesUsdt = useCallback((v: number[]) => {
    setData((prev) => {
      const next = { ...prev, openLimitSellPricesUsdt: v };
      return chartHeaderDataEqual(prev, next) ? prev : next;
    });
  }, []);

  const setOpenLimitSellOrdersUsdt = useCallback((v: { orderId: string; price: number }[]) => {
    setData((prev) => {
      const next = { ...prev, openLimitSellOrdersUsdt: v };
      return chartHeaderDataEqual(prev, next) ? prev : next;
    });
  }, []);

  const setCrosshairMainPriceUsdt = useCallback((v: number | null) => {
    setData((prev) => {
      const next = { ...prev, crosshairMainPriceUsdt: v };
      return chartHeaderDataEqual(prev, next) ? prev : next;
    });
  }, []);

  const setIntervalPicker = useCallback((next: ChartIntervalPickerRegistration | null) => {
    setIntervalPickerState(next);
  }, []);

  const openIntervalQuickSwitch = useCallback((initialQuery?: string) => {
    intervalQuickSwitchInitialRef.current = initialQuery;
    setIntervalQuickSwitchOpen(true);
  }, []);

  const closeIntervalQuickSwitch = useCallback(() => {
    setIntervalQuickSwitchOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      data,
      setHeaderData,
      setLimitBuyOrderPriceUsdt,
      setOpenLimitBuyPricesUsdt,
      setOpenLimitBuyOrdersUsdt,
      setOpenLimitSellPricesUsdt,
      setOpenLimitSellOrdersUsdt,
      setCrosshairMainPriceUsdt,
      intervalPicker,
      setIntervalPicker,
      intervalQuickSwitchOpen,
      openIntervalQuickSwitch,
      closeIntervalQuickSwitch,
      intervalQuickSwitchInitialRef,
    }),
    [
      data,
      setHeaderData,
      setLimitBuyOrderPriceUsdt,
      setOpenLimitBuyPricesUsdt,
      setOpenLimitBuyOrdersUsdt,
      setOpenLimitSellPricesUsdt,
      setOpenLimitSellOrdersUsdt,
      setCrosshairMainPriceUsdt,
      intervalPicker,
      setIntervalPicker,
      intervalQuickSwitchOpen,
      openIntervalQuickSwitch,
      closeIntervalQuickSwitch,
    ]
  );

  return <ChartHeaderContext.Provider value={value}>{children}</ChartHeaderContext.Provider>;
}

export function useChartHeader(): ChartHeaderContextValue {
  const ctx = useContext(ChartHeaderContext);
  if (!ctx) {
    const emptyRef: MutableRefObject<string | undefined> = { current: undefined };
    return {
      data: defaultData,
      setHeaderData: () => {},
      setLimitBuyOrderPriceUsdt: () => {},
      setOpenLimitBuyPricesUsdt: () => {},
      setOpenLimitBuyOrdersUsdt: () => {},
      setOpenLimitSellPricesUsdt: () => {},
      setOpenLimitSellOrdersUsdt: () => {},
      setCrosshairMainPriceUsdt: () => {},
      intervalPicker: null,
      setIntervalPicker: () => {},
      intervalQuickSwitchOpen: false,
      openIntervalQuickSwitch: () => {},
      closeIntervalQuickSwitch: () => {},
      intervalQuickSwitchInitialRef: emptyRef,
    };
  }
  return ctx;
}
