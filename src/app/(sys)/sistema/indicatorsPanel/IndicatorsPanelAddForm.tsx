"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { UserIndicatorType, Wma2TimeUnit, IndicatorPanel, IndicatorFieldKey, IndicatorLineWidth, IndicatorLineStyle } from "../KlinesIndicatorsContext";
import { DEFAULT_LAYOUT_ALLOWED_INDICATOR_TYPES } from "../KlinesChartConstants";
import {
  clampMa2TimeWindowUserValue,
  defaultMa2TimeValueForUnit,
  isTimeWindowMa2Type,
  MA2_MAX_WINDOW_VALUE,
  normalizeMa2TimeValueForUnit,
} from "./wma2Period";
import { normalizeHmaCustomPeriods } from "@/app/api/binance/klines/indicators";
import { Combobox, type ComboboxOption } from "../components/Combobox";
import { ColorPaletteCombobox } from "../components/ColorPaletteCombobox";
import { StepperButton } from "../components/StepperButton";
import { useIndicatorsPanelContext } from "./IndicatorsPanelContext";
import type { AddFormState } from "./indicatorsPanelTypes";

interface IndicatorsPanelAddFormProps {
  form: AddFormState;
  setForm: React.Dispatch<React.SetStateAction<AddFormState>>;
}

type IchimokuColorLine = "Tenkan" | "Kijun" | "Span A" | "Span B" | "Chikou";

/** Grupos e tipos para o combobox de tipo de indicador (mesma ordem e labels do select antigo). */
const INDICATOR_TYPE_GROUPS: { groupLabelKey: string; types: { value: UserIndicatorType; labelKey?: string; labelEn?: string }[] }[] = [
  { groupLabelKey: "indicatorGroupMovingAverages", types: [{ value: "SMA", labelEn: "SMA" }, { value: "SMA2", labelKey: "sma2Label" }, { value: "EMA", labelEn: "EMA" }, { value: "EMA2", labelKey: "ema2Label" }, { value: "WMA", labelEn: "WMA" }, { value: "WMA2", labelKey: "wma2Label" }, { value: "HMA", labelKey: "hmaLabel" }, { value: "HMA_CUSTOM", labelKey: "hmaCustomLabel" }, { value: "VWMA", labelKey: "vwmaLabel" }] },
  { groupLabelKey: "indicatorGroupMomentum", types: [{ value: "RSI", labelEn: "RSI" }, { value: "MFI", labelKey: "mfiLabel" }, { value: "MACD", labelEn: "MACD" }, { value: "Stochastic", labelEn: "Stochastic" }, { value: "WilliamsR", labelKey: "williamsRLabel" }, { value: "CCI", labelKey: "cciLabel" }] },
  { groupLabelKey: "indicatorGroupTrend", types: [{ value: "ADX", labelKey: "adxLabel" }, { value: "SAR", labelKey: "sarLabel" }, { value: "Ichimoku", labelKey: "ichimokuLabel" }, { value: "LINEAR_FIT", labelKey: "linearFitLabel" }, { value: "QUADRATIC_FIT", labelKey: "quadraticFitLabel" }] },
  { groupLabelKey: "indicatorGroupVolume", types: [{ value: "Volume", labelKey: "volumeLabel" }, { value: "OBV", labelEn: "OBV" }, { value: "AD", labelKey: "adLabel" }, { value: "CMF", labelKey: "cmfLabel" }, { value: "VWAP", labelKey: "vwapLabel" }] },
  { groupLabelKey: "indicatorGroupVolatilityChannels", types: [{ value: "ATR", labelKey: "atrLabel" }, { value: "Bollinger", labelKey: "bollingerLabel" }, { value: "Keltner", labelKey: "keltnerLabel" }, { value: "Donchian", labelKey: "donchianLabel" }] },
];

/** Chave em `sistema.klines` para o texto teórico de cada tipo (PT/EN em translations). */
const INDICATOR_THEORY_I18N_KEY: Record<UserIndicatorType, string> = {
  SMA: "indicatorTheorySMA",
  SMA2: "indicatorTheorySMA2",
  EMA: "indicatorTheoryEMA",
  EMA2: "indicatorTheoryEMA2",
  WMA: "indicatorTheoryWMA",
  WMA2: "indicatorTheoryWMA2",
  HMA: "indicatorTheoryHMA",
  HMA_CUSTOM: "indicatorTheoryHMA_CUSTOM",
  VWMA: "indicatorTheoryVWMA",
  LINEAR_FIT: "indicatorTheoryLINEAR_FIT",
  QUADRATIC_FIT: "indicatorTheoryQUADRATIC_FIT",
  RSI: "indicatorTheoryRSI",
  MFI: "indicatorTheoryMFI",
  MACD: "indicatorTheoryMACD",
  Stochastic: "indicatorTheoryStochastic",
  WilliamsR: "indicatorTheoryWilliamsR",
  OBV: "indicatorTheoryOBV",
  AD: "indicatorTheoryAD",
  SAR: "indicatorTheorySAR",
  ATR: "indicatorTheoryATR",
  VWAP: "indicatorTheoryVWAP",
  Bollinger: "indicatorTheoryBollinger",
  Keltner: "indicatorTheoryKeltner",
  Donchian: "indicatorTheoryDonchian",
  Volume: "indicatorTheoryVolume",
  ADX: "indicatorTheoryADX",
  CCI: "indicatorTheoryCCI",
  CMF: "indicatorTheoryCMF",
  Ichimoku: "indicatorTheoryIchimoku",
};

export function IndicatorsPanelAddForm({ form, setForm }: IndicatorsPanelAddFormProps) {
  const [ichimokuColorOpen, setIchimokuColorOpen] = useState<IchimokuColorLine | null>(null);
  const [showBlockedLayoutHint, setShowBlockedLayoutHint] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const {
    t,
    userIndicators,
    fieldOptionsVisibleForAdd,
    firstEnabledFieldValueForAdd,
    panelsWithSecondary,
    panelsFreeForSecondary,
    indicatorCountByPanel,
    isFreeUser,
    MAIN_MAX_INDICATORS,
    SECONDARY_MAX_INDICATORS,
    INDICATOR_COLOR_PALETTE,
    addButtonDisabled,
    defaultModelMaxIndicatorsReached,
    isDefaultLayout,
    handleAdd,
  } = useIndicatorsPanelContext();

  const isTypeBlockedInDefaultLayout = (type: string) => Boolean(isDefaultLayout && !DEFAULT_LAYOUT_ALLOWED_INDICATOR_TYPES.includes(type));

  useEffect(() => {
    if (!typeDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) setTypeDropdownOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [typeDropdownOpen]);

  const tRecord = t as Record<string, string>;
  const commitHmaAddForm = (p: AddFormState, long?: number, fast?: number, smooth?: number): AddFormState => {
    const lo = long ?? p.hmaCustomLongPeriod ?? 20;
    const fa = fast ?? p.hmaCustomFastPeriod ?? 10;
    const sm = smooth ?? p.hmaCustomSmoothPeriod ?? 4;
    const o = normalizeHmaCustomPeriods(sm, fa, lo);
    return {
      ...p,
      hmaCustomLongPeriod: o.hmaCustomLongPeriod,
      hmaCustomFastPeriod: o.hmaCustomFastPeriod,
      hmaCustomSmoothPeriod: o.hmaCustomSmoothPeriod,
      hmaCustomLongPeriodText: String(o.hmaCustomLongPeriod),
      hmaCustomFastPeriodText: String(o.hmaCustomFastPeriod),
      hmaCustomSmoothPeriodText: String(o.hmaCustomSmoothPeriod),
      period: o.hmaCustomLongPeriod,
      periodText: String(o.hmaCustomLongPeriod),
    };
  };
  const getTypeLabel = (value: UserIndicatorType, item: { labelKey?: string; labelEn?: string }) =>
    item.labelKey ? (tRecord[item.labelKey] ?? value) : (item.labelEn ?? value);
  const currentTypeLabel = (() => {
    for (const g of INDICATOR_TYPE_GROUPS) {
      for (const item of g.types) {
        if (item.value === form.indicatorType) return getTypeLabel(form.indicatorType, item);
      }
    }
    return form.indicatorType;
  })();

  const hasFreePanelForSecondary = panelsFreeForSecondary.panel2 || panelsFreeForSecondary.panel3 || panelsFreeForSecondary.panel4 || panelsFreeForSecondary.panel5;
  const firstFreePanelForSecondary: IndicatorPanel =
    panelsFreeForSecondary.panel2 ? "panel2" : panelsFreeForSecondary.panel3 ? "panel3" : panelsFreeForSecondary.panel4 ? "panel4" : panelsFreeForSecondary.panel5 ? "panel5" : "panel2";

  /** Volume só pode ir em painel vazio (0 indicadores). Modo free: apenas painel 2. */
  const hasEmptyPanelForVolume = isFreeUser
    ? indicatorCountByPanel.panel2 === 0
    : (indicatorCountByPanel.panel2 === 0 || indicatorCountByPanel.panel3 === 0 || indicatorCountByPanel.panel4 === 0 || indicatorCountByPanel.panel5 === 0);
  const firstEmptyPanelForVolume: IndicatorPanel = isFreeUser
    ? (indicatorCountByPanel.panel2 === 0 ? "panel2" : "panel2")
    : (indicatorCountByPanel.panel2 === 0 ? "panel2" : indicatorCountByPanel.panel3 === 0 ? "panel3" : indicatorCountByPanel.panel4 === 0 ? "panel4" : indicatorCountByPanel.panel5 === 0 ? "panel5" : "panel2");

  const chartPanelOptions: ComboboxOption[] = useMemo(() => {
    const p2 = tRecord.chartOptionPanel2 ?? "Panel 2";
    const p3 = tRecord.chartOptionPanel3 ?? "Panel 3";
    const p4 = tRecord.chartOptionPanel4 ?? "Panel 4";
    const p5 = tRecord.chartOptionPanel5 ?? "Panel 5";
    const main = tRecord.chartOptionMain ?? "Main";
    const none = tRecord.chartOptionNoPanelAvailable ?? "Nenhum painel disponível";
    if (form.indicatorType === "Volume") {
      const opts: ComboboxOption[] = [];
      if (indicatorCountByPanel.panel2 === 0) opts.push({ value: "panel2", label: p2 });
      if (!isFreeUser && indicatorCountByPanel.panel3 === 0) opts.push({ value: "panel3", label: p3 });
      if (!isFreeUser && indicatorCountByPanel.panel4 === 0) opts.push({ value: "panel4", label: p4 });
      if (!isFreeUser && indicatorCountByPanel.panel5 === 0) opts.push({ value: "panel5", label: p5 });
      const hasEmpty = isFreeUser ? indicatorCountByPanel.panel2 === 0 : (indicatorCountByPanel.panel2 === 0 || indicatorCountByPanel.panel3 === 0 || indicatorCountByPanel.panel4 === 0 || indicatorCountByPanel.panel5 === 0);
      if (!hasEmpty) opts.push({ value: "", label: none });
      return opts;
    }
    if (form.indicatorType === "RSI" || form.indicatorType === "MFI" || form.indicatorType === "MACD" || form.indicatorType === "Stochastic" || form.indicatorType === "WilliamsR" || form.indicatorType === "OBV" || form.indicatorType === "AD" || form.indicatorType === "ATR" || form.indicatorType === "ADX" || form.indicatorType === "CCI" || form.indicatorType === "CMF") {
      const opts: ComboboxOption[] = [];
      if (panelsFreeForSecondary.panel2) opts.push({ value: "panel2", label: p2 });
      if (panelsFreeForSecondary.panel3) opts.push({ value: "panel3", label: p3 });
      if (panelsFreeForSecondary.panel4) opts.push({ value: "panel4", label: p4 });
      if (panelsFreeForSecondary.panel5) opts.push({ value: "panel5", label: p5 });
      if (!panelsFreeForSecondary.panel2 && !panelsFreeForSecondary.panel3 && !panelsFreeForSecondary.panel4 && !panelsFreeForSecondary.panel5) opts.push({ value: "", label: none });
      return opts;
    }
    return [
      { value: "main", label: main, disabled: indicatorCountByPanel.main >= MAIN_MAX_INDICATORS },
      { value: "panel2", label: p2, disabled: indicatorCountByPanel.panel2 >= SECONDARY_MAX_INDICATORS },
      { value: "panel3", label: (isFreeUser ? "🔒 " : "") + p3, disabled: indicatorCountByPanel.panel3 >= SECONDARY_MAX_INDICATORS || isFreeUser },
      { value: "panel4", label: (isFreeUser ? "🔒 " : "") + p4, disabled: indicatorCountByPanel.panel4 >= SECONDARY_MAX_INDICATORS || isFreeUser },
      { value: "panel5", label: (isFreeUser ? "🔒 " : "") + p5, disabled: indicatorCountByPanel.panel5 >= SECONDARY_MAX_INDICATORS || isFreeUser },
    ];
  }, [form.indicatorType, indicatorCountByPanel, panelsFreeForSecondary, isFreeUser, tRecord]);

  const lineWidthOptions: ComboboxOption[] = useMemo(() => [
    { value: "thin", label: tRecord.lineWidthThin ?? "Fino" },
    { value: "normal", label: tRecord.lineWidthNormal ?? "Normal" },
    { value: "thick", label: tRecord.lineWidthThick ?? "Grossa" },
  ], [tRecord]);
  const lineStyleOptions: ComboboxOption[] = useMemo(() => [
    { value: "solid", label: tRecord.lineStyleSolid ?? "Sólido" },
    { value: "dotted", label: tRecord.lineStyleDotted ?? "Pontilhado" },
    { value: "dashed", label: tRecord.lineStyleDashed ?? "Tracejado" },
  ], [tRecord]);
  const maTypeOptions: ComboboxOption[] = useMemo(() => [
    { value: "SMA", label: "SMA" },
    { value: "EMA", label: "EMA" },
    { value: "WMA", label: "WMA" },
  ], []);
  const macdMaTypeOptions: ComboboxOption[] = useMemo(
    () => [
      { value: "SMA", label: "SMA" },
      { value: "EMA", label: "EMA" },
      { value: "WMA", label: "WMA" },
      { value: "LINEAR_FIT", label: tRecord.linearFitLabel ?? "Ajuste linear" },
      { value: "QUADRATIC_FIT", label: tRecord.quadraticFitLabel ?? "Ajuste quadrático" },
    ],
    [tRecord]
  );
  const hmaCustomLegMaTypeOptions: ComboboxOption[] = macdMaTypeOptions;
  const volumeSourceOptions: ComboboxOption[] = useMemo(() => [
    { value: "base", label: tRecord.volumeBaseLabel ?? "Vol (base)" },
    { value: "usdt", label: tRecord.volumeUsdtLabel ?? "Vol (USDT)" },
  ], [tRecord]);
  const wma2UnitOptions: ComboboxOption[] = useMemo(
    () => [
      { value: "days", label: tRecord.wma2TimeUnitDays ?? "Days" },
      { value: "hours", label: tRecord.wma2TimeUnitHours ?? "Hours" },
      { value: "minutes", label: tRecord.wma2TimeUnitMinutes ?? "Minutes" },
    ],
    [tRecord]
  );

  const chartOptionValue: string =
    form.indicatorType === "SAR" || form.indicatorType === "VWAP" || form.indicatorType === "Keltner" || form.indicatorType === "Donchian" || form.indicatorType === "HMA" || form.indicatorType === "HMA_CUSTOM" || form.indicatorType === "VWMA" || form.indicatorType === "LINEAR_FIT" || form.indicatorType === "QUADRATIC_FIT"
      ? "main"
      : form.indicatorType === "Volume"
        ? (form.chartOption === "panel2" && indicatorCountByPanel.panel2 === 0) || (form.chartOption === "panel3" && indicatorCountByPanel.panel3 === 0) || (form.chartOption === "panel4" && indicatorCountByPanel.panel4 === 0) || (form.chartOption === "panel5" && indicatorCountByPanel.panel5 === 0)
          ? form.chartOption
          : hasEmptyPanelForVolume
            ? firstEmptyPanelForVolume
            : ""
        : form.indicatorType === "RSI" || form.indicatorType === "MFI" || form.indicatorType === "MACD" || form.indicatorType === "Stochastic" || form.indicatorType === "WilliamsR" || form.indicatorType === "OBV" || form.indicatorType === "AD" || form.indicatorType === "ATR" || form.indicatorType === "ADX" || form.indicatorType === "CCI" || form.indicatorType === "CMF"
          ? (form.chartOption === "panel2" && panelsFreeForSecondary.panel2) || (form.chartOption === "panel3" && panelsFreeForSecondary.panel3) || (form.chartOption === "panel4" && panelsFreeForSecondary.panel4) || (form.chartOption === "panel5" && panelsFreeForSecondary.panel5)
            ? form.chartOption
            : hasFreePanelForSecondary
              ? firstFreePanelForSecondary
              : ""
          : form.chartOption;

  const setType = (newType: UserIndicatorType) => {
    setForm((prev) => {
      const freePanel: IndicatorPanel = panelsFreeForSecondary.panel2 ? "panel2" : panelsFreeForSecondary.panel3 ? "panel3" : panelsFreeForSecondary.panel4 ? "panel4" : panelsFreeForSecondary.panel5 ? "panel5" : "panel2";
      if (newType === "RSI") {
        return {
          ...prev,
          indicatorType: "RSI",
          period: 14,
          periodText: "14",
          chartOption: freePanel,
          rsiFixedScale: true,
          rsiCenterLine: false,
          rsiCenterLineColor: "#71717a",
          rsiCenterLineWidth: "normal",
          rsiCenterLineStyle: "dotted",
          rsiLimits: false,
          rsiLimitUpper: 70,
          rsiLimitLower: 30,
          rsiLimitColor: "#dc2626",
          rsiLimitLineWidth: "normal",
          rsiLimitLineStyle: "dotted",
        };
      }
      if (newType === "MFI") {
        return {
          ...prev,
          indicatorType: "MFI",
          period: 14,
          periodText: "14",
          chartOption: freePanel,
          mfiFixedScale: true,
          mfiCenterLine: false,
          mfiCenterLineColor: "#71717a",
          mfiCenterLineWidth: "normal",
          mfiCenterLineStyle: "dotted",
          mfiLimits: false,
          mfiLimitUpper: 80,
          mfiLimitLower: 20,
          mfiLimitColor: "#dc2626",
          mfiLimitLineWidth: "normal",
          mfiLimitLineStyle: "dotted",
        };
      }
      if (newType === "MACD") {
        return {
          ...prev,
          indicatorType: "MACD",
          chartOption: freePanel,
          macdFastMaType: "EMA",
          macdFastPeriod: 12,
          macdFastPeriodText: "12",
          macdSlowMaType: "EMA",
          macdSlowPeriod: 26,
          macdSlowPeriodText: "26",
          macdSignalLine: false,
          macdSignalMaType: "EMA",
          macdSignalPeriod: 9,
          macdSignalPeriodText: "9",
          macdSignalColor: "#ea580c",
          macdSignalLineWidth: "normal",
          macdSignalLineStyle: "dashed",
          macdHistogram: false,
          macdHistogramColorAbove: "#059669",
          macdHistogramColorBelow: "#dc2626",
        };
      }
      if (newType === "Stochastic") {
        return {
          ...prev,
          indicatorType: "Stochastic",
          period: 14,
          periodText: "14",
          fieldKey: "close",
          chartOption: freePanel,
          stochLimits: false,
          stochLimitUpper: 80,
          stochLimitLower: 20,
          stochLimitColor: "#dc2626",
          stochLimitLineWidth: "normal",
          stochLimitLineStyle: "dotted",
          stochDLine: false,
          stochDMaType: "SMA",
          stochDPeriod: 3,
          stochDPeriodText: "3",
          stochDColor: "#ea580c",
          stochDLineWidth: "normal",
          stochDLineStyle: "dashed",
        };
      }
      if (newType === "WilliamsR") {
        return {
          ...prev,
          indicatorType: "WilliamsR",
          period: 14,
          periodText: "14",
          fieldKey: "close",
          chartOption: freePanel,
          williamsRLimits: true,
          williamsRLimitUpper: -20,
          williamsRLimitLower: -80,
          williamsRLimitColor: "#dc2626",
          williamsRLimitLineWidth: "normal",
          williamsRLimitLineStyle: "dotted",
        };
      }
      if (newType === "OBV") {
        return {
          ...prev,
          indicatorType: "OBV",
          period: 1,
          periodText: "1",
          fieldKey: "volume",
          chartOption: freePanel,
          obvVolumeSource: "base",
        };
      }
      if (newType === "AD") {
        return {
          ...prev,
          indicatorType: "AD",
          period: 1,
          periodText: "1",
          fieldKey: "volume",
          chartOption: freePanel,
          adVolumeSource: "base",
        };
      }
      if (newType === "SAR") {
        return {
          ...prev,
          indicatorType: "SAR",
          chartOption: "main",
          sarStart: 0.02,
          sarStartText: "0.02",
          sarIncrement: 0.02,
          sarIncrementText: "0.02",
          sarMax: 0.2,
          sarMaxText: "0.2",
          sarPointSize: "normal",
          lineStyle: "dotted",
        };
      }
      if (newType === "ATR") {
        return {
          ...prev,
          indicatorType: "ATR",
          period: 14,
          periodText: "14",
          fieldKey: "close",
          chartOption: freePanel,
        };
      }
      if (newType === "ADX") {
        return {
          ...prev,
          indicatorType: "ADX",
          period: 14,
          periodText: "14",
          fieldKey: "close",
          chartOption: freePanel,
          adxPlusDiColor: "#22c55e",
          adxPlusDiLineWidth: "normal",
          adxPlusDiLineStyle: "solid",
          adxMinusDiColor: "#ef4444",
          adxMinusDiLineWidth: "normal",
          adxMinusDiLineStyle: "solid",
          adxAdxColor: "#eab308",
          adxAdxLineWidth: "normal",
          adxAdxLineStyle: "solid",
          adxFixedScale: true,
          adxLimits: false,
          adxLimitUpper: 25,
          adxLimitLower: 20,
          adxLimitColor: "#71717a",
          adxLimitLineWidth: "normal",
          adxLimitLineStyle: "dotted",
        };
      }
      if (newType === "CCI") {
        return {
          ...prev,
          indicatorType: "CCI",
          period: 20,
          periodText: "20",
          fieldKey: "HLC3",
          chartOption: freePanel,
          cciFixedScale: false,
          cciLimits: true,
          cciLimitUpper: 100,
          cciLimitLower: -100,
          cciLimitColor: "#dc2626",
          cciLimitLineWidth: "normal",
          cciLimitLineStyle: "dotted",
          cciAsHistogram: false,
          cciHistogramColorAbove: "#059669",
          cciHistogramColorBelow: "#dc2626",
        };
      }
      if (newType === "CMF") {
        return {
          ...prev,
          indicatorType: "CMF",
          period: 20,
          periodText: "20",
          fieldKey: "close",
          chartOption: freePanel,
          cmfFixedScale: false,
          cmfLimits: true,
          cmfLimitUpper: 0.25,
          cmfLimitLower: -0.25,
          cmfLimitColor: "#dc2626",
          cmfLimitLineWidth: "normal",
          cmfLimitLineStyle: "dotted",
          cmfAsHistogram: false,
          cmfHistogramColorAbove: "#059669",
          cmfHistogramColorBelow: "#dc2626",
        };
      }
      if (newType === "VWAP") {
        return {
          ...prev,
          indicatorType: "VWAP",
          period: 1,
          periodText: "1",
          fieldKey: "close",
          chartOption: "main",
        };
      }
      if (newType === "Bollinger") {
        return {
          ...prev,
          indicatorType: "Bollinger",
          period: 20,
          periodText: "20",
          fieldKey: "close",
          chartOption: "main",
          bollingerMaType: "SMA",
          bollingerZ: 2,
          bollingerZText: "2",
          bollingerShowUpper: true,
          bollingerShowLower: true,
          bollingerShowMiddle: false,
          bollingerBandOpacity: 0.2,
          bollingerBandOpacityText: "20",
          bollingerLimitsColor: "#6366f1",
          bollingerLimitsColorOpen: false,
          bollingerLimitsLineStyle: "solid",
          bollingerLimitsLineWidth: "normal",
          bollingerMiddleColor: "#a855f7",
          bollingerMiddleLineStyle: "dashed",
          bollingerMiddleLineWidth: "normal",
        };
      }
      if (newType === "Keltner") {
        return {
          ...prev,
          indicatorType: "Keltner",
          period: 20,
          periodText: "20",
          fieldKey: "close",
          chartOption: "main",
          keltnerMaType: "EMA",
          keltnerMultiplier: 2,
          keltnerMultiplierText: "2",
          keltnerShowUpper: true,
          keltnerShowLower: true,
          keltnerShowMiddle: false,
          keltnerBandOpacity: 0.2,
          keltnerBandOpacityText: "20",
          keltnerLimitsColor: "#6366f1",
          keltnerLimitsColorOpen: false,
          keltnerLimitsLineStyle: "solid",
          keltnerLimitsLineWidth: "normal",
          keltnerMiddleColor: "#a855f7",
          keltnerMiddleLineStyle: "dashed",
          keltnerMiddleLineWidth: "normal",
        };
      }
      if (newType === "Donchian") {
        return {
          ...prev,
          indicatorType: "Donchian",
          period: 20,
          periodText: "20",
          fieldKey: "close",
          chartOption: "main",
          donchianShowUpper: true,
          donchianShowLower: true,
          donchianShowMiddle: false,
          donchianBandOpacity: 0.2,
          donchianBandOpacityText: "20",
          donchianLimitsColor: "#6366f1",
          donchianLimitsLineStyle: "solid",
          donchianLimitsLineWidth: "normal",
          donchianMiddleColor: "#a855f7",
          donchianMiddleLineStyle: "dashed",
          donchianMiddleLineWidth: "normal",
        };
      }
      if (newType === "Ichimoku") {
        return {
          ...prev,
          indicatorType: "Ichimoku",
          period: 26,
          periodText: "26",
          fieldKey: "close",
          chartOption: "main",
          ichimokuTenkanPeriod: 9,
          ichimokuTenkanPeriodText: "9",
          ichimokuKijunPeriod: 26,
          ichimokuKijunPeriodText: "26",
          ichimokuSpanBPeriod: 52,
          ichimokuSpanBPeriodText: "52",
          ichimokuDisplacement: 26,
          ichimokuDisplacementText: "26",
          ichimokuTenkanColor: "#6366f1",
          ichimokuKijunColor: "#ea580c",
          ichimokuSpanAColor: "#22c55e",
          ichimokuSpanBColor: "#ef4444",
          ichimokuChikouColor: "#a855f7",
          ichimokuTenkanLineWidth: "normal",
          ichimokuTenkanLineStyle: "solid",
          ichimokuKijunLineWidth: "normal",
          ichimokuKijunLineStyle: "solid",
          ichimokuSpanALineWidth: "normal",
          ichimokuSpanALineStyle: "solid",
          ichimokuSpanBLineWidth: "normal",
          ichimokuSpanBLineStyle: "solid",
          ichimokuChikouLineWidth: "normal",
          ichimokuChikouLineStyle: "solid",
          ichimokuCloudOpacity: 0.3,
          ichimokuCloudOpacityText: "30",
          ichimokuShowTenkan: true,
          ichimokuShowKijun: true,
          ichimokuShowSpanA: true,
          ichimokuShowSpanB: true,
          ichimokuShowChikou: false,
        };
      }
      if (newType === "HMA") {
        return {
          ...prev,
          indicatorType: "HMA",
          period: 20,
          periodText: "20",
          fieldKey: "close",
          chartOption: "main",
        };
      }
      if (newType === "HMA_CUSTOM") {
        return {
          ...prev,
          indicatorType: "HMA_CUSTOM",
          period: 20,
          periodText: "20",
          fieldKey: "close",
          chartOption: "main",
          hmaCustomLongPeriod: 20,
          hmaCustomLongPeriodText: "20",
          hmaCustomFastPeriod: 10,
          hmaCustomFastPeriodText: "10",
          hmaCustomSmoothPeriod: 4,
          hmaCustomSmoothPeriodText: "4",
          hmaCustomLongMaType: "WMA",
          hmaCustomFastMaType: "WMA",
          hmaCustomSmoothMaType: "WMA",
        };
      }
      if (newType === "VWMA") {
        return {
          ...prev,
          indicatorType: "VWMA",
          period: 20,
          periodText: "20",
          fieldKey: "close",
          chartOption: "main",
        };
      }
      if (newType === "LINEAR_FIT") {
        return {
          ...prev,
          indicatorType: "LINEAR_FIT",
          period: 20,
          periodText: "20",
          fieldKey: "close",
          chartOption: "main",
        };
      }
      if (newType === "QUADRATIC_FIT") {
        return {
          ...prev,
          indicatorType: "QUADRATIC_FIT",
          period: 20,
          periodText: "20",
          fieldKey: "close",
          chartOption: "main",
        };
      }
      if (isTimeWindowMa2Type(newType)) {
        return {
          ...prev,
          indicatorType: newType,
          period: 1,
          periodText: "1",
          fieldKey: "close",
          chartOption: "main",
          wma2TimeUnit: "hours",
          wma2TimeValue: 168,
          wma2TimeValueText: "168",
        };
      }
      if (newType === "Volume") {
        const emptyPanel: IndicatorPanel = indicatorCountByPanel.panel2 === 0 ? "panel2" : indicatorCountByPanel.panel3 === 0 ? "panel3" : indicatorCountByPanel.panel4 === 0 ? "panel4" : indicatorCountByPanel.panel5 === 0 ? "panel5" : "panel2";
        return {
          ...prev,
          indicatorType: "Volume",
          period: 1,
          periodText: "1",
          fieldKey: "volume",
          chartOption: emptyPanel,
          volumeInUsdt: false,
          volumeColorAbove: "#10b981",
          volumeColorBelow: "#ef4444",
        };
      }
      return { ...prev, indicatorType: newType };
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-600 w-16 shrink-0 flex items-center gap-1">
          {t.indicatorType}
          {isDefaultLayout && (
            <button
              type="button"
              onClick={() => setShowBlockedLayoutHint((v) => !v)}
              className="w-5 h-5 flex items-center justify-center rounded-full border border-zinc-400 text-zinc-500 text-xs font-bold hover:bg-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              aria-label={(t as Record<string, string>).indicatorsBlockedDefaultLayoutInfoButton ?? "Ver aviso"}
              title={(t as Record<string, string>).indicatorsBlockedDefaultLayout}
            >
              ?
            </button>
          )}
        </span>
        <div className="flex-1 min-w-0 relative" ref={typeDropdownRef}>
          <button
            type="button"
            onClick={() => setTypeDropdownOpen((v) => !v)}
            className="w-full text-left text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white flex items-center justify-between gap-1"
            aria-label={t.indicatorType}
            aria-expanded={typeDropdownOpen}
            aria-haspopup="listbox"
          >
            <span className="truncate">{currentTypeLabel}</span>
            <span className="text-zinc-500 text-xs shrink-0">▾</span>
          </button>
          {typeDropdownOpen && (
            <div
              className="absolute left-0 right-0 top-full z-40 mt-1 combobox-dropdown-max rounded-lg border border-zinc-200 bg-white shadow-lg py-1 px-1"
              role="listbox"
              aria-label={t.indicatorType}
            >
              {INDICATOR_TYPE_GROUPS.map((group) => (
                <div key={group.groupLabelKey}>
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide px-2 py-1 sticky top-0 bg-white border-b border-zinc-100">
                    {tRecord[group.groupLabelKey] ?? group.groupLabelKey}
                  </div>
                  {group.types.map((item) => {
                    const blocked = isTypeBlockedInDefaultLayout(item.value);
                    return (
                      <button
                        key={item.value}
                        type="button"
                        role="option"
                        aria-selected={form.indicatorType === item.value}
                        disabled={blocked}
                        title={blocked ? tRecord.indicatorsBlockedDefaultLayout : undefined}
                        onClick={() => {
                          if (!blocked) {
                            setType(item.value);
                            setTypeDropdownOpen(false);
                          }
                        }}
                        className={`w-full text-left text-sm px-2 py-1.5 rounded flex items-center gap-1 ${form.indicatorType === item.value ? "bg-zinc-200 font-medium" : "hover:bg-zinc-100"} ${blocked ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        {blocked ? "🔒 " : ""}{getTypeLabel(item.value, item)}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {isDefaultLayout && showBlockedLayoutHint && (
        <p className="text-xs text-zinc-600 bg-zinc-100 border border-zinc-200 rounded px-2 py-1.5">
          {(t as Record<string, string>).indicatorsBlockedDefaultLayout}
        </p>
      )}

      {form.indicatorType === "Ichimoku" && (
        <>
          <div className="grid grid-cols-1 gap-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-xs font-medium text-zinc-600 sm:w-20 shrink-0">{(t as Record<string, string>).ichimokuTenkanPeriod ?? "Tenkan"}</span>
              <div className="flex items-center gap-1 w-full sm:flex-1 min-w-0">
                <StepperButton onStep={() => { const v = Math.max(1, (form.ichimokuTenkanPeriod ?? 9) - 1); setForm((p) => ({ ...p, ichimokuTenkanPeriod: v, ichimokuTenkanPeriodText: String(v) })); }} disabled={(form.ichimokuTenkanPeriod ?? 9) <= 1} className="stepper-btn">−</StepperButton>
                <input type="text" inputMode="numeric" value={form.ichimokuTenkanPeriodText} onChange={(e) => setForm((p) => ({ ...p, ichimokuTenkanPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = parseInt(form.ichimokuTenkanPeriodText, 10); const v = Number.isFinite(n) ? Math.max(1, Math.min(500, n)) : 9; setForm((p) => ({ ...p, ichimokuTenkanPeriod: v, ichimokuTenkanPeriodText: String(v) })); }} className="w-14 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5" />
                <StepperButton onStep={() => { const v = Math.min(500, (form.ichimokuTenkanPeriod ?? 9) + 1); setForm((p) => ({ ...p, ichimokuTenkanPeriod: v, ichimokuTenkanPeriodText: String(v) })); }} disabled={(form.ichimokuTenkanPeriod ?? 9) >= 500} className="stepper-btn">+</StepperButton>
              </div>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-xs font-medium text-zinc-600 sm:w-20 shrink-0">{(t as Record<string, string>).ichimokuKijunPeriod ?? "Kijun"}</span>
              <div className="flex items-center gap-1 w-full sm:flex-1 min-w-0">
                <StepperButton onStep={() => { const v = Math.max(1, (form.ichimokuKijunPeriod ?? 26) - 1); setForm((p) => ({ ...p, ichimokuKijunPeriod: v, ichimokuKijunPeriodText: String(v) })); }} disabled={(form.ichimokuKijunPeriod ?? 26) <= 1} className="stepper-btn">−</StepperButton>
                <input type="text" inputMode="numeric" value={form.ichimokuKijunPeriodText} onChange={(e) => setForm((p) => ({ ...p, ichimokuKijunPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = parseInt(form.ichimokuKijunPeriodText, 10); const v = Number.isFinite(n) ? Math.max(1, Math.min(500, n)) : 26; setForm((p) => ({ ...p, ichimokuKijunPeriod: v, ichimokuKijunPeriodText: String(v) })); }} className="w-14 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5" />
                <StepperButton onStep={() => { const v = Math.min(500, (form.ichimokuKijunPeriod ?? 26) + 1); setForm((p) => ({ ...p, ichimokuKijunPeriod: v, ichimokuKijunPeriodText: String(v) })); }} disabled={(form.ichimokuKijunPeriod ?? 26) >= 500} className="stepper-btn">+</StepperButton>
              </div>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-xs font-medium text-zinc-600 sm:w-20 shrink-0">{(t as Record<string, string>).ichimokuSpanBPeriod ?? "Span B"}</span>
              <div className="flex items-center gap-1 w-full sm:flex-1 min-w-0">
                <StepperButton onStep={() => { const v = Math.max(1, (form.ichimokuSpanBPeriod ?? 52) - 1); setForm((p) => ({ ...p, ichimokuSpanBPeriod: v, ichimokuSpanBPeriodText: String(v) })); }} disabled={(form.ichimokuSpanBPeriod ?? 52) <= 1} className="stepper-btn">−</StepperButton>
                <input type="text" inputMode="numeric" value={form.ichimokuSpanBPeriodText} onChange={(e) => setForm((p) => ({ ...p, ichimokuSpanBPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = parseInt(form.ichimokuSpanBPeriodText, 10); const v = Number.isFinite(n) ? Math.max(1, Math.min(500, n)) : 52; setForm((p) => ({ ...p, ichimokuSpanBPeriod: v, ichimokuSpanBPeriodText: String(v) })); }} className="w-14 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5" />
                <StepperButton onStep={() => { const v = Math.min(500, (form.ichimokuSpanBPeriod ?? 52) + 1); setForm((p) => ({ ...p, ichimokuSpanBPeriod: v, ichimokuSpanBPeriodText: String(v) })); }} disabled={(form.ichimokuSpanBPeriod ?? 52) >= 500} className="stepper-btn">+</StepperButton>
              </div>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-xs font-medium text-zinc-600 sm:w-20 shrink-0">{(t as Record<string, string>).ichimokuDisplacement ?? "Desloc."}</span>
              <div className="flex items-center gap-1 w-full sm:flex-1 min-w-0">
                <StepperButton onStep={() => { const v = Math.max(0, (form.ichimokuDisplacement ?? 26) - 1); setForm((p) => ({ ...p, ichimokuDisplacement: v, ichimokuDisplacementText: String(v) })); }} disabled={(form.ichimokuDisplacement ?? 26) <= 0} className="stepper-btn">−</StepperButton>
                <input type="text" inputMode="numeric" value={form.ichimokuDisplacementText} onChange={(e) => setForm((p) => ({ ...p, ichimokuDisplacementText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = parseInt(form.ichimokuDisplacementText, 10); const v = Number.isFinite(n) ? Math.max(0, Math.min(500, n)) : 26; setForm((p) => ({ ...p, ichimokuDisplacement: v, ichimokuDisplacementText: String(v) })); }} className="w-14 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5" />
                <StepperButton onStep={() => { const v = Math.min(500, (form.ichimokuDisplacement ?? 26) + 1); setForm((p) => ({ ...p, ichimokuDisplacement: v, ichimokuDisplacementText: String(v) })); }} disabled={(form.ichimokuDisplacement ?? 26) >= 500} className="stepper-btn">+</StepperButton>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).ichimokuCloudOpacity ?? "Opac. nuvem"}</span>
            <StepperButton onStep={() => { const v = Math.max(0, (form.ichimokuCloudOpacity ?? 0.3) * 100 - 10); setForm((p) => ({ ...p, ichimokuCloudOpacity: v / 100, ichimokuCloudOpacityText: String(Math.round(v)) })); }} disabled={((form.ichimokuCloudOpacity ?? 0.3) * 100) <= 0} className="stepper-btn">−</StepperButton>
            <span className="w-10 text-center text-sm font-mono tabular-nums">{Math.round((form.ichimokuCloudOpacity ?? 0.3) * 100)}%</span>
            <StepperButton onStep={() => { const v = Math.min(70, (form.ichimokuCloudOpacity ?? 0.3) * 100 + 10); setForm((p) => ({ ...p, ichimokuCloudOpacity: v / 100, ichimokuCloudOpacityText: String(Math.round(v)) })); }} disabled={((form.ichimokuCloudOpacity ?? 0.3) * 100) >= 70} className="stepper-btn">+</StepperButton>
          </div>
          <div className="text-xs font-medium text-zinc-600">{(t as Record<string, string>).ichimokuShowLinesLabel ?? "Linhas a mostrar"}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(["Tenkan", "Kijun", "Span A", "Span B", "Chikou"] as const).map((label) => {
              const showKey = label === "Tenkan" ? "ichimokuShowTenkan" : label === "Kijun" ? "ichimokuShowKijun" : label === "Span A" ? "ichimokuShowSpanA" : label === "Span B" ? "ichimokuShowSpanB" : "ichimokuShowChikou";
              return (
                <label key={label} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={form[showKey]} onChange={(e) => setForm((p) => ({ ...p, [showKey]: e.target.checked }))} className="rounded border-zinc-300" />
                  <span className="text-[10px] text-zinc-700">{label}</span>
                </label>
              );
            })}
          </div>
          <div className="grid grid-cols-1 gap-y-2">
            {(["Tenkan", "Kijun", "Span A", "Span B", "Chikou"] as const).map((label) => {
              const colorKey = label === "Tenkan" ? "ichimokuTenkanColor" : label === "Kijun" ? "ichimokuKijunColor" : label === "Span A" ? "ichimokuSpanAColor" : label === "Span B" ? "ichimokuSpanBColor" : "ichimokuChikouColor";
              const widthKey = label === "Tenkan" ? "ichimokuTenkanLineWidth" : label === "Kijun" ? "ichimokuKijunLineWidth" : label === "Span A" ? "ichimokuSpanALineWidth" : label === "Span B" ? "ichimokuSpanBLineWidth" : "ichimokuChikouLineWidth";
              const styleKey = label === "Tenkan" ? "ichimokuTenkanLineStyle" : label === "Kijun" ? "ichimokuKijunLineStyle" : label === "Span A" ? "ichimokuSpanALineStyle" : label === "Span B" ? "ichimokuSpanBLineStyle" : "ichimokuChikouLineStyle";
              const val = form[colorKey];
              return (
                <div key={label} className="relative flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-medium text-zinc-600 w-14 shrink-0">{label}</span>
                  <ColorPaletteCombobox value={val} onChange={(hex) => setForm((p) => ({ ...p, [colorKey]: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).color ?? "Cor"} />
                  <Combobox value={form[widthKey]} onChange={(v) => setForm((p) => ({ ...p, [widthKey]: v as IndicatorLineWidth }))} options={lineWidthOptions} size="sm" className="w-20" aria-label={(t as Record<string, string>).lineWidth ?? "Espessura"} />
                  <Combobox value={form[styleKey]} onChange={(v) => setForm((p) => ({ ...p, [styleKey]: v as IndicatorLineStyle }))} options={lineStyleOptions} size="sm" className="w-24" aria-label={(t as Record<string, string>).lineStyle ?? "Estilo"} />
                </div>
              );
            })}
          </div>
        </>
      )}

      {form.indicatorType === "HMA_CUSTOM" && (
        <div className="space-y-2">
          <p className="text-[11px] text-zinc-500">{tRecord.hmaCustomHint ?? ""}</p>
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            <span className="text-xs font-medium text-zinc-600 sm:w-28 shrink-0">{tRecord.hmaCustomLongPeriod ?? "Long MA"}</span>
            <Combobox
              value={form.hmaCustomLongMaType}
              onChange={(v) => setForm((prev) => ({ ...prev, hmaCustomLongMaType: v as AddFormState["hmaCustomLongMaType"] }))}
              options={hmaCustomLegMaTypeOptions}
              className="w-full sm:w-[5.5rem] shrink-0"
              size="lg"
              aria-label={`${tRecord.hmaCustomLongPeriod ?? "Long MA"} — ${tRecord.hmaCustomMaTypeAria ?? "Averaging type"}`}
            />
            <div className="flex items-center gap-1">
              <StepperButton
                onStep={() => setForm((p) => commitHmaAddForm(p, Math.max(3, (p.hmaCustomLongPeriod ?? 20) - 1)))}
                disabled={(form.hmaCustomLongPeriod ?? 20) <= 3}
                className="stepper-btn"
              >
                −
              </StepperButton>
              <input
                type="text"
                inputMode="numeric"
                value={form.hmaCustomLongPeriodText}
                onChange={(e) => setForm((prev) => ({ ...prev, hmaCustomLongPeriodText: e.target.value.replace(/[^\d]/g, "") }))}
                onBlur={() =>
                  setForm((p) => {
                    const n = parseInt(p.hmaCustomLongPeriodText, 10);
                    return commitHmaAddForm(p, Number.isFinite(n) ? n : p.hmaCustomLongPeriod);
                  })
                }
                className="w-14 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5"
              />
              <StepperButton
                onStep={() => setForm((p) => commitHmaAddForm(p, Math.min(500, (p.hmaCustomLongPeriod ?? 20) + 1)))}
                disabled={(form.hmaCustomLongPeriod ?? 20) >= 500}
                className="stepper-btn"
              >
                +
              </StepperButton>
            </div>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            <span className="text-xs font-medium text-zinc-600 sm:w-28 shrink-0">{tRecord.hmaCustomFastPeriod ?? "Fast MA"}</span>
            <Combobox
              value={form.hmaCustomFastMaType}
              onChange={(v) => setForm((prev) => ({ ...prev, hmaCustomFastMaType: v as AddFormState["hmaCustomFastMaType"] }))}
              options={hmaCustomLegMaTypeOptions}
              className="w-full sm:w-[5.5rem] shrink-0"
              size="lg"
              aria-label={`${tRecord.hmaCustomFastPeriod ?? "Fast MA"} — ${tRecord.hmaCustomMaTypeAria ?? "Averaging type"}`}
            />
            <div className="flex items-center gap-1">
              <StepperButton
                onStep={() => setForm((p) => commitHmaAddForm(p, undefined, Math.max(2, (p.hmaCustomFastPeriod ?? 10) - 1)))}
                disabled={(form.hmaCustomFastPeriod ?? 10) <= 2}
                className="stepper-btn"
              >
                −
              </StepperButton>
              <input
                type="text"
                inputMode="numeric"
                value={form.hmaCustomFastPeriodText}
                onChange={(e) => setForm((prev) => ({ ...prev, hmaCustomFastPeriodText: e.target.value.replace(/[^\d]/g, "") }))}
                onBlur={() =>
                  setForm((p) => {
                    const n = parseInt(p.hmaCustomFastPeriodText, 10);
                    return commitHmaAddForm(p, undefined, Number.isFinite(n) ? n : p.hmaCustomFastPeriod);
                  })
                }
                className="w-14 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5"
              />
              <StepperButton
                onStep={() => setForm((p) => commitHmaAddForm(p, undefined, Math.min(499, (p.hmaCustomFastPeriod ?? 10) + 1)))}
                disabled={(form.hmaCustomFastPeriod ?? 10) >= 499}
                className="stepper-btn"
              >
                +
              </StepperButton>
            </div>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            <span className="text-xs font-medium text-zinc-600 sm:w-28 shrink-0">{tRecord.hmaCustomSmoothPeriod ?? "Smoothing"}</span>
            <Combobox
              value={form.hmaCustomSmoothMaType}
              onChange={(v) => setForm((prev) => ({ ...prev, hmaCustomSmoothMaType: v as "SMA" | "EMA" | "WMA" }))}
              options={maTypeOptions}
              className="w-full sm:w-[5.5rem] shrink-0"
              size="lg"
              aria-label={`${tRecord.hmaCustomSmoothPeriod ?? "Smoothing"} — ${tRecord.hmaCustomMaTypeAria ?? "Averaging type"}`}
            />
            <div className="flex items-center gap-1">
              <StepperButton
                onStep={() => setForm((p) => commitHmaAddForm(p, undefined, undefined, Math.max(1, (p.hmaCustomSmoothPeriod ?? 4) - 1)))}
                disabled={(form.hmaCustomSmoothPeriod ?? 4) <= 1}
                className="stepper-btn"
              >
                −
              </StepperButton>
              <input
                type="text"
                inputMode="numeric"
                value={form.hmaCustomSmoothPeriodText}
                onChange={(e) => setForm((prev) => ({ ...prev, hmaCustomSmoothPeriodText: e.target.value.replace(/[^\d]/g, "") }))}
                onBlur={() =>
                  setForm((p) => {
                    const n = parseInt(p.hmaCustomSmoothPeriodText, 10);
                    return commitHmaAddForm(p, undefined, undefined, Number.isFinite(n) ? n : p.hmaCustomSmoothPeriod);
                  })
                }
                className="w-14 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5"
              />
              <StepperButton
                onStep={() => setForm((p) => commitHmaAddForm(p, undefined, undefined, Math.min(498, (p.hmaCustomSmoothPeriod ?? 4) + 1)))}
                disabled={(form.hmaCustomSmoothPeriod ?? 4) >= 498}
                className="stepper-btn"
              >
                +
              </StepperButton>
            </div>
          </div>
        </div>
      )}

      {!(form.indicatorType === "SAR" || form.indicatorType === "VWAP" || form.indicatorType === "Keltner" || form.indicatorType === "Donchian" || form.indicatorType === "HMA" || form.indicatorType === "HMA_CUSTOM" || form.indicatorType === "VWMA" || form.indicatorType === "LINEAR_FIT" || form.indicatorType === "QUADRATIC_FIT" || form.indicatorType === "Ichimoku" || isTimeWindowMa2Type(form.indicatorType)) && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.chartOption}</span>
          <Combobox
            value={chartOptionValue}
            onChange={(v) => setForm((prev) => ({ ...prev, chartOption: v as IndicatorPanel }))}
            options={chartPanelOptions}
            className="flex-1 min-w-0"
            size="lg"
            aria-label={t.chartOption}
          />
        </div>
      )}

      {form.indicatorType !== "OBV" && form.indicatorType !== "AD" && form.indicatorType !== "SAR" && form.indicatorType !== "ATR" && form.indicatorType !== "ADX" && form.indicatorType !== "VWAP" && form.indicatorType !== "Volume" && form.indicatorType !== "Donchian" && form.indicatorType !== "MFI" && form.indicatorType !== "Ichimoku" && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.field}</span>
          <Combobox
            value={(fieldOptionsVisibleForAdd.some((o) => o.value === form.fieldKey) ? form.fieldKey : firstEnabledFieldValueForAdd) as string}
            onChange={(v) => setForm((prev) => ({ ...prev, fieldKey: v as IndicatorFieldKey }))}
            options={fieldOptionsVisibleForAdd.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))}
            className="flex-1 min-w-0"
            size="lg"
            aria-label={t.field}
          />
        </div>
      )}

      {isTimeWindowMa2Type(form.indicatorType) && (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{tRecord.wma2WindowLabel ?? "Averaging window"}</span>
            <Combobox
              value={form.wma2TimeUnit === "days" || form.wma2TimeUnit === "hours" || form.wma2TimeUnit === "minutes" ? form.wma2TimeUnit : "hours"}
              onChange={(v) => {
                const u = v as Wma2TimeUnit;
                const d = defaultMa2TimeValueForUnit(u);
                setForm((prev) => ({ ...prev, wma2TimeUnit: u, wma2TimeValue: d, wma2TimeValueText: String(d) }));
              }}
              options={wma2UnitOptions}
              className="w-32 shrink-0"
              size="lg"
              aria-label={tRecord.wma2WindowLabel ?? "Window unit"}
            />
            <div className="flex items-center gap-1">
              <StepperButton
                onStep={() => {
                  const u =
                    form.wma2TimeUnit === "days" || form.wma2TimeUnit === "hours" || form.wma2TimeUnit === "minutes"
                      ? form.wma2TimeUnit
                      : "hours";
                  const next = Math.max(1, (form.wma2TimeValue ?? defaultMa2TimeValueForUnit(u)) - 1);
                  setForm((prev) => ({ ...prev, wma2TimeValue: next, wma2TimeValueText: String(next) }));
                }}
                className="stepper-btn"
                aria-label="−"
              >
                −
              </StepperButton>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.wma2TimeValueText}
                onFocus={(e) => {
                  const el = e.currentTarget;
                  queueMicrotask(() => el?.select());
                }}
                onChange={(e) => setForm((prev) => ({ ...prev, wma2TimeValueText: e.target.value.replace(/[^\d]/g, "") }))}
                onBlur={() => {
                  const n = Number(form.wma2TimeValueText);
                  const u =
                    form.wma2TimeUnit === "days" || form.wma2TimeUnit === "hours" || form.wma2TimeUnit === "minutes"
                      ? form.wma2TimeUnit
                      : "hours";
                  const def = defaultMa2TimeValueForUnit(u);
                  const raw = Number.isFinite(n) && n > 0 ? clampMa2TimeWindowUserValue(n) : def;
                  const next = normalizeMa2TimeValueForUnit(u, raw);
                  setForm((prev) => ({ ...prev, wma2TimeValue: next, wma2TimeValueText: String(next) }));
                }}
                className="w-16 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5"
                aria-label={tRecord.wma2WindowLabel ?? "Window value"}
              />
              <StepperButton
                onStep={() => {
                  const u =
                    form.wma2TimeUnit === "days" || form.wma2TimeUnit === "hours" || form.wma2TimeUnit === "minutes"
                      ? form.wma2TimeUnit
                      : "hours";
                  const next = Math.min(MA2_MAX_WINDOW_VALUE, (form.wma2TimeValue ?? defaultMa2TimeValueForUnit(u)) + 1);
                  setForm((prev) => ({ ...prev, wma2TimeValue: next, wma2TimeValueText: String(next) }));
                }}
                className="stepper-btn"
                aria-label="+"
              >
                +
              </StepperButton>
            </div>
          </div>
        </div>
      )}

      {(form.indicatorType === "OBV" || form.indicatorType === "AD") && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).volumeSourceLabel ?? "Fonte de volume"}</span>
          <Combobox
            value={form.indicatorType === "OBV" ? (form.obvVolumeSource ?? "base") : (form.adVolumeSource ?? "base")}
            onChange={(v) => setForm((prev) => ({ ...prev, ...(prev.indicatorType === "OBV" ? { obvVolumeSource: v as "base" | "usdt" } : { adVolumeSource: v as "base" | "usdt" }) }))}
            options={volumeSourceOptions}
            className="flex-1 min-w-0"
            size="lg"
            aria-label={(t as Record<string, string>).volumeSourceLabel ?? "Fonte de volume"}
          />
        </div>
      )}

      {form.indicatorType !== "MACD" && form.indicatorType !== "OBV" && form.indicatorType !== "AD" && form.indicatorType !== "SAR" && form.indicatorType !== "VWAP" && form.indicatorType !== "Volume" && form.indicatorType !== "Ichimoku" && form.indicatorType !== "HMA_CUSTOM" && form.indicatorType !== "Bollinger" && form.indicatorType !== "Donchian" && !isTimeWindowMa2Type(form.indicatorType) && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.period}</span>
          <div className="flex items-center gap-1">
            <StepperButton onStep={() => { const next = Math.max(1, Math.min(500, Math.round((form.period ?? 7) - 1))); setForm((prev) => ({ ...prev, period: next, periodText: String(next) })); }} className="stepper-btn" aria-label="-">−</StepperButton>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.periodText}
              onFocus={(e) => { const el = e.currentTarget; queueMicrotask(() => el?.select()); }}
              onChange={(e) => setForm((prev) => ({ ...prev, periodText: e.target.value.replace(/[^\d]/g, "") }))}
              onBlur={() => { const n = Number(form.periodText); const next = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 7; setForm((prev) => ({ ...prev, period: next, periodText: String(next) })); }}
              className="w-14 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5"
              aria-label={t.period}
            />
            <StepperButton onStep={() => { const next = Math.max(1, Math.min(500, Math.round((form.period ?? 7) + 1))); setForm((prev) => ({ ...prev, period: next, periodText: String(next) })); }} className="stepper-btn" aria-label="+">+</StepperButton>
          </div>
        </div>
      )}

      {form.indicatorType === "RSI" && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.rsiFixedScale}
            onChange={(e) => setForm((prev) => ({ ...prev, rsiFixedScale: e.target.checked }))}
            className="rounded border-zinc-300"
          />
          <span className="text-xs text-zinc-700">{(t as Record<string, string>).rsiFixedScaleLabel ?? "Escala fixa 0–100 no eixo Y"}</span>
        </label>
      )}

      {form.indicatorType === "MFI" && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.mfiFixedScale}
            onChange={(e) => setForm((prev) => ({ ...prev, mfiFixedScale: e.target.checked }))}
            className="rounded border-zinc-300"
          />
          <span className="text-xs text-zinc-700">{(t as Record<string, string>).mfiFixedScaleLabel ?? "Escala fixa 0–100 no eixo Y"}</span>
        </label>
      )}

      {form.indicatorType === "ADX" && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.adxFixedScale}
            onChange={(e) => setForm((prev) => ({ ...prev, adxFixedScale: e.target.checked }))}
            className="rounded border-zinc-300"
          />
          <span className="text-xs text-zinc-700">{(t as Record<string, string>).adxFixedScaleLabel ?? "Escala fixa 0–100 no eixo Y"}</span>
        </label>
      )}

      {form.indicatorType === "CCI" && (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.cciAsHistogram}
              onChange={(e) => setForm((prev) => ({ ...prev, cciAsHistogram: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).cciAsHistogramLabel ?? "Exibir como histograma"}</span>
          </label>
          {form.cciAsHistogram && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdHistogramColorAbove ?? "Cor acima de 0"}</span>
                <ColorPaletteCombobox value={form.cciHistogramColorAbove} onChange={(hex) => setForm((prev) => ({ ...prev, cciHistogramColorAbove: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).macdHistogramColorAbove ?? "Cor acima"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo de 0"}</span>
                <ColorPaletteCombobox value={form.cciHistogramColorBelow} onChange={(hex) => setForm((prev) => ({ ...prev, cciHistogramColorBelow: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo"} />
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.cciLimits}
              onChange={(e) => setForm((prev) => ({ ...prev, cciLimits: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).cciLimitsLabel ?? "Limites superior e inferior (-100 a 100)"}</span>
          </label>
          {form.cciLimits && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).cciLimitUpperLabel ?? "Superior"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, cciLimitUpper: Math.max(-500, Math.min(500, prev.cciLimitUpper - 10)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</StepperButton>
                  <span className="w-10 text-center text-sm tabular-nums">{form.cciLimitUpper}</span>
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, cciLimitUpper: Math.max(-500, Math.min(500, prev.cciLimitUpper + 10)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).cciLimitLowerLabel ?? "Inferior"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, cciLimitLower: Math.max(-500, Math.min(500, prev.cciLimitLower - 10)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</StepperButton>
                  <span className="w-10 text-center text-sm tabular-nums">{form.cciLimitLower}</span>
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, cciLimitLower: Math.max(-500, Math.min(500, prev.cciLimitLower + 10)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <ColorPaletteCombobox value={form.cciLimitColor} onChange={(hex) => setForm((prev) => ({ ...prev, cciLimitColor: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                <Combobox value={form.cciLimitLineWidth} onChange={(v) => setForm((prev) => ({ ...prev, cciLimitLineWidth: v as IndicatorLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineWidth ?? "Espessura"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                <Combobox value={form.cciLimitLineStyle} onChange={(v) => setForm((prev) => ({ ...prev, cciLimitLineStyle: v as IndicatorLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineStyle ?? "Estilo"} />
              </div>
            </div>
          )}
        </>
      )}

      {form.indicatorType === "CMF" && (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.cmfFixedScale} onChange={(e) => setForm((prev) => ({ ...prev, cmfFixedScale: e.target.checked }))} className="rounded border-zinc-300" />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).cmfFixedScaleLabel ?? "Escala fixa -1 a 1 no eixo Y"}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.cmfAsHistogram} onChange={(e) => setForm((prev) => ({ ...prev, cmfAsHistogram: e.target.checked }))} className="rounded border-zinc-300" />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).cmfAsHistogramLabel ?? "Exibir como histograma"}</span>
          </label>
          {form.cmfAsHistogram && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdHistogramColorAbove ?? "Cor acima de 0"}</span>
                <ColorPaletteCombobox value={form.cmfHistogramColorAbove} onChange={(hex) => setForm((prev) => ({ ...prev, cmfHistogramColorAbove: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).macdHistogramColorAbove ?? "Cor acima"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo de 0"}</span>
                <ColorPaletteCombobox value={form.cmfHistogramColorBelow} onChange={(hex) => setForm((prev) => ({ ...prev, cmfHistogramColorBelow: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo"} />
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.cmfLimits} onChange={(e) => setForm((prev) => ({ ...prev, cmfLimits: e.target.checked }))} className="rounded border-zinc-300" />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).cmfLimitsLabel ?? "Limites superior e inferior (-1 a 1)"}</span>
          </label>
          {form.cmfLimits && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).cmfLimitUpperLabel ?? "Superior"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, cmfLimitUpper: Math.max(-1, Math.min(1, Math.round((prev.cmfLimitUpper - 0.05) * 100) / 100)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</StepperButton>
                  <span className="w-14 text-center text-sm tabular-nums">{form.cmfLimitUpper.toFixed(2)}</span>
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, cmfLimitUpper: Math.max(-1, Math.min(1, Math.round((prev.cmfLimitUpper + 0.05) * 100) / 100)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).cmfLimitLowerLabel ?? "Inferior"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, cmfLimitLower: Math.max(-1, Math.min(1, Math.round((prev.cmfLimitLower - 0.05) * 100) / 100)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</StepperButton>
                  <span className="w-14 text-center text-sm tabular-nums">{form.cmfLimitLower.toFixed(2)}</span>
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, cmfLimitLower: Math.max(-1, Math.min(1, Math.round((prev.cmfLimitLower + 0.05) * 100) / 100)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <ColorPaletteCombobox value={form.cmfLimitColor} onChange={(hex) => setForm((prev) => ({ ...prev, cmfLimitColor: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                <Combobox value={form.cmfLimitLineWidth} onChange={(v) => setForm((prev) => ({ ...prev, cmfLimitLineWidth: v as IndicatorLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineWidth ?? "Espessura"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                <Combobox value={form.cmfLimitLineStyle} onChange={(v) => setForm((prev) => ({ ...prev, cmfLimitLineStyle: v as IndicatorLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineStyle ?? "Estilo"} />
              </div>
            </div>
          )}
        </>
      )}

      {form.indicatorType === "RSI" && (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.rsiCenterLine}
              onChange={(e) => setForm((prev) => ({ ...prev, rsiCenterLine: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).rsiCenterLineLabel ?? "Linha central 50%"}</span>
          </label>
          {form.rsiCenterLine && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <ColorPaletteCombobox value={form.rsiCenterLineColor} onChange={(hex) => setForm((prev) => ({ ...prev, rsiCenterLineColor: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                <Combobox value={form.rsiCenterLineWidth} onChange={(v) => setForm((prev) => ({ ...prev, rsiCenterLineWidth: v as IndicatorLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineWidth ?? "Espessura"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                <Combobox value={form.rsiCenterLineStyle} onChange={(v) => setForm((prev) => ({ ...prev, rsiCenterLineStyle: v as IndicatorLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineStyle ?? "Estilo"} />
              </div>
            </div>
          )}
        </>
      )}

      {form.indicatorType === "MFI" && (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.mfiCenterLine}
              onChange={(e) => setForm((prev) => ({ ...prev, mfiCenterLine: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).mfiCenterLineLabel ?? "Linha central 50%"}</span>
          </label>
          {form.mfiCenterLine && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <ColorPaletteCombobox value={form.mfiCenterLineColor} onChange={(hex) => setForm((prev) => ({ ...prev, mfiCenterLineColor: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                <Combobox value={form.mfiCenterLineWidth} onChange={(v) => setForm((prev) => ({ ...prev, mfiCenterLineWidth: v as IndicatorLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineWidth ?? "Espessura"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                <Combobox value={form.mfiCenterLineStyle} onChange={(v) => setForm((prev) => ({ ...prev, mfiCenterLineStyle: v as IndicatorLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineStyle ?? "Estilo"} />
              </div>
            </div>
          )}
        </>
      )}

      {form.indicatorType === "MFI" && (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.mfiLimits}
              onChange={(e) => setForm((prev) => ({ ...prev, mfiLimits: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).mfiLimitsLabel ?? "Limites superior e inferior"}</span>
          </label>
          {form.mfiLimits && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).mfiLimitUpperLabel ?? "Superior %"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, mfiLimitUpper: Math.max(0, Math.min(100, prev.mfiLimitUpper - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</StepperButton>
                  <span className="w-10 text-center text-sm tabular-nums">{form.mfiLimitUpper}</span>
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, mfiLimitUpper: Math.max(0, Math.min(100, prev.mfiLimitUpper + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).mfiLimitLowerLabel ?? "Inferior %"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, mfiLimitLower: Math.max(0, Math.min(100, prev.mfiLimitLower - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</StepperButton>
                  <span className="w-10 text-center text-sm tabular-nums">{form.mfiLimitLower}</span>
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, mfiLimitLower: Math.max(0, Math.min(100, prev.mfiLimitLower + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <ColorPaletteCombobox value={form.mfiLimitColor} onChange={(hex) => setForm((prev) => ({ ...prev, mfiLimitColor: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                <Combobox value={form.mfiLimitLineWidth} onChange={(v) => setForm((prev) => ({ ...prev, mfiLimitLineWidth: v as IndicatorLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineWidth ?? "Espessura"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                <Combobox value={form.mfiLimitLineStyle} onChange={(v) => setForm((prev) => ({ ...prev, mfiLimitLineStyle: v as IndicatorLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineStyle ?? "Estilo"} />
              </div>
            </div>
          )}
        </>
      )}

      {form.indicatorType === "RSI" && (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.rsiLimits}
              onChange={(e) => setForm((prev) => ({ ...prev, rsiLimits: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).rsiLimitsLabel ?? "Limites superior e inferior"}</span>
          </label>
          {form.rsiLimits && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).rsiLimitUpperLabel ?? "Superior %"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, rsiLimitUpper: Math.max(0, Math.min(100, prev.rsiLimitUpper - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</StepperButton>
                  <span className="w-10 text-center text-sm tabular-nums">{form.rsiLimitUpper}</span>
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, rsiLimitUpper: Math.max(0, Math.min(100, prev.rsiLimitUpper + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).rsiLimitLowerLabel ?? "Inferior %"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, rsiLimitLower: Math.max(0, Math.min(100, prev.rsiLimitLower - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</StepperButton>
                  <span className="w-10 text-center text-sm tabular-nums">{form.rsiLimitLower}</span>
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, rsiLimitLower: Math.max(0, Math.min(100, prev.rsiLimitLower + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <ColorPaletteCombobox value={form.rsiLimitColor} onChange={(hex) => setForm((prev) => ({ ...prev, rsiLimitColor: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                <Combobox value={form.rsiLimitLineWidth} onChange={(v) => setForm((prev) => ({ ...prev, rsiLimitLineWidth: v as IndicatorLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineWidth ?? "Espessura"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                <Combobox value={form.rsiLimitLineStyle} onChange={(v) => setForm((prev) => ({ ...prev, rsiLimitLineStyle: v as IndicatorLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineStyle ?? "Estilo"} />
              </div>
            </div>
          )}
        </>
      )}

      {form.indicatorType === "Volume" && (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.volumeInUsdt}
              onChange={(e) => setForm((prev) => ({ ...prev, volumeInUsdt: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).volumeInUsdtLabel ?? "Exibir em USDT"}</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-24 shrink-0">{(t as Record<string, string>).volumeColorPositive ?? "Cor positivo"}</span>
            <ColorPaletteCombobox value={form.volumeColorAbove} onChange={(hex) => setForm((prev) => ({ ...prev, volumeColorAbove: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).volumeColorPositive ?? "Cor positivo"} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-24 shrink-0">{(t as Record<string, string>).volumeColorNegative ?? "Cor negativo"}</span>
            <ColorPaletteCombobox value={form.volumeColorBelow} onChange={(hex) => setForm((prev) => ({ ...prev, volumeColorBelow: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).volumeColorNegative ?? "Cor negativo"} />
          </div>
        </>
      )}

      {form.indicatorType === "Bollinger" && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).bollingerMaType ?? "Média móvel"}</span>
            <Combobox value={form.bollingerMaType} onChange={(v) => setForm((prev) => ({ ...prev, bollingerMaType: v as "SMA" | "EMA" | "WMA" }))} options={maTypeOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).macdFastMa ?? "MA"} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).field ?? "Campo"}</span>
            <Combobox value={form.fieldKey} onChange={(v) => setForm((prev) => ({ ...prev, fieldKey: v as typeof form.fieldKey }))} options={fieldOptionsVisibleForAdd.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))} className="flex-1 min-w-0" size="lg" aria-label={t.field} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).period ?? "Período"}</span>
            <div className="flex items-center gap-1">
              <StepperButton onStep={() => setForm((p) => ({ ...p, period: Math.max(1, p.period - 1), periodText: String(Math.max(1, p.period - 1)) }))} className="stepper-btn">−</StepperButton>
              <input type="text" inputMode="numeric" value={form.periodText} onChange={(e) => setForm((p) => ({ ...p, periodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.periodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 20; setForm((p) => ({ ...p, period: v, periodText: String(v) })); }} className="w-14 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5" />
              <StepperButton onStep={() => setForm((p) => ({ ...p, period: Math.min(500, p.period + 1), periodText: String(Math.min(500, p.period + 1)) }))} className="stepper-btn">+</StepperButton>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).bollingerZ ?? "Z (0–3)"}</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.bollingerZText}
              onChange={(e) => setForm((prev) => ({ ...prev, bollingerZText: e.target.value }))}
              onBlur={() => {
                const n = parseFloat(form.bollingerZText);
                const v = Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 2;
                setForm((prev) => ({ ...prev, bollingerZ: v, bollingerZText: String(v) }));
              }}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
              <input type="checkbox" checked={form.bollingerShowUpper} onChange={(e) => setForm((p) => ({ ...p, bollingerShowUpper: e.target.checked }))} className="rounded" />
              {(t as Record<string, string>).bollingerShowUpper ?? "Banda superior"}
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
              <input type="checkbox" checked={form.bollingerShowLower} onChange={(e) => setForm((p) => ({ ...p, bollingerShowLower: e.target.checked }))} className="rounded" />
              {(t as Record<string, string>).bollingerShowLower ?? "Banda inferior"}
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
              <input type="checkbox" checked={form.bollingerShowMiddle} onChange={(e) => setForm((p) => ({ ...p, bollingerShowMiddle: e.target.checked }))} className="rounded" />
              {(t as Record<string, string>).bollingerShowMiddle ?? "Média móvel"}
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).bollingerLimitsColor ?? "Cor bandas"}</span>
            <ColorPaletteCombobox
              value={form.bollingerLimitsColor}
              onChange={(hex) => setForm((prev) => ({ ...prev, bollingerLimitsColor: hex, color: hex }))}
              palette={INDICATOR_COLOR_PALETTE}
              aria-label={(t as Record<string, string>).bollingerLimitsColor ?? "Cor bandas"}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura bandas"}</span>
            <Combobox value={form.bollingerLimitsLineWidth} onChange={(v) => setForm((p) => ({ ...p, bollingerLimitsLineWidth: v as typeof form.bollingerLimitsLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineWidth ?? "Espessura"} />
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo bandas"}</span>
            <Combobox value={form.bollingerLimitsLineStyle} onChange={(v) => setForm((p) => ({ ...p, bollingerLimitsLineStyle: v as typeof form.bollingerLimitsLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineStyle ?? "Estilo"} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).bollingerMiddleColor ?? "Cor da média"}</span>
            <ColorPaletteCombobox value={form.bollingerMiddleColor} onChange={(hex) => setForm((prev) => ({ ...prev, bollingerMiddleColor: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).bollingerMiddleColor ?? "Cor da média"} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).bollingerMiddleThickness ?? "Espessura da média"}</span>
            <Combobox value={form.bollingerMiddleLineWidth} onChange={(v) => setForm((p) => ({ ...p, bollingerMiddleLineWidth: v as typeof form.bollingerMiddleLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).bollingerMiddleThickness ?? "Espessura"} />
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).bollingerMiddleStroke ?? "Traço da média"}</span>
            <Combobox value={form.bollingerMiddleLineStyle} onChange={(v) => setForm((p) => ({ ...p, bollingerMiddleLineStyle: v as typeof form.bollingerMiddleLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).bollingerMiddleStroke ?? "Traço"} />
          </div>
        </>
      )}

      {form.indicatorType === "Keltner" && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).keltnerMaType ?? "Média móvel"}</span>
            <Combobox value={form.keltnerMaType} onChange={(v) => setForm((prev) => ({ ...prev, keltnerMaType: v as "SMA" | "EMA" | "WMA" }))} options={maTypeOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).macdFastMa ?? "MA"} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).keltnerMultiplierLabel ?? "Multiplicador ATR (0–10)"}</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.keltnerMultiplierText}
              onChange={(e) => setForm((prev) => ({ ...prev, keltnerMultiplierText: e.target.value }))}
              onBlur={() => {
                const n = parseFloat(form.keltnerMultiplierText);
                const v = Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 2;
                setForm((prev) => ({ ...prev, keltnerMultiplier: v, keltnerMultiplierText: String(v) }));
              }}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
              <input type="checkbox" checked={form.keltnerShowUpper} onChange={(e) => setForm((p) => ({ ...p, keltnerShowUpper: e.target.checked }))} className="rounded" />
              {(t as Record<string, string>).keltnerShowUpper ?? "Banda superior"}
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
              <input type="checkbox" checked={form.keltnerShowLower} onChange={(e) => setForm((p) => ({ ...p, keltnerShowLower: e.target.checked }))} className="rounded" />
              {(t as Record<string, string>).keltnerShowLower ?? "Banda inferior"}
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
              <input type="checkbox" checked={form.keltnerShowMiddle} onChange={(e) => setForm((p) => ({ ...p, keltnerShowMiddle: e.target.checked }))} className="rounded" />
              {(t as Record<string, string>).keltnerShowMiddle ?? "Média móvel"}
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).keltnerLimitsColor ?? "Cor bandas"}</span>
            <ColorPaletteCombobox
              value={form.keltnerLimitsColor}
              onChange={(hex) => setForm((prev) => ({ ...prev, keltnerLimitsColor: hex, color: hex }))}
              palette={INDICATOR_COLOR_PALETTE}
              aria-label={(t as Record<string, string>).keltnerLimitsColor ?? "Cor bandas"}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura bandas"}</span>
            <Combobox value={form.keltnerLimitsLineWidth} onChange={(v) => setForm((p) => ({ ...p, keltnerLimitsLineWidth: v as typeof form.keltnerLimitsLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineWidth ?? "Espessura"} />
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo bandas"}</span>
            <Combobox value={form.keltnerLimitsLineStyle} onChange={(v) => setForm((p) => ({ ...p, keltnerLimitsLineStyle: v as typeof form.keltnerLimitsLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineStyle ?? "Estilo"} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).keltnerMiddleColor ?? "Cor da média"}</span>
            <ColorPaletteCombobox
              value={form.keltnerMiddleColor}
              onChange={(hex) => setForm((prev) => ({ ...prev, keltnerMiddleColor: hex }))}
              palette={INDICATOR_COLOR_PALETTE}
              aria-label={(t as Record<string, string>).keltnerMiddleColor ?? "Cor da média"}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).keltnerMiddleThickness ?? "Espessura da média"}</span>
            <Combobox
              value={form.keltnerMiddleLineWidth}
              onChange={(v) => setForm((p) => ({ ...p, keltnerMiddleLineWidth: v as typeof form.keltnerMiddleLineWidth }))}
              options={lineWidthOptions}
              className="flex-1 min-w-0"
              size="lg"
              aria-label={(t as Record<string, string>).keltnerMiddleThickness ?? "Espessura da média"}
            />
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).keltnerMiddleStroke ?? "Traço da média"}</span>
            <Combobox
              value={form.keltnerMiddleLineStyle}
              onChange={(v) => setForm((p) => ({ ...p, keltnerMiddleLineStyle: v as typeof form.keltnerMiddleLineStyle }))}
              options={lineStyleOptions}
              className="flex-1 min-w-0"
              size="lg"
              aria-label={(t as Record<string, string>).keltnerMiddleStroke ?? "Traço da média"}
            />
          </div>
        </>
      )}

      {form.indicatorType === "Donchian" && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).period ?? "Período"}</span>
            <div className="flex items-center gap-1">
              <StepperButton onStep={() => setForm((p) => ({ ...p, period: Math.max(1, p.period - 1), periodText: String(Math.max(1, p.period - 1)) }))} className="stepper-btn">−</StepperButton>
              <input type="text" inputMode="numeric" value={form.periodText} onChange={(e) => setForm((p) => ({ ...p, periodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.periodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 20; setForm((p) => ({ ...p, period: v, periodText: String(v) })); }} className="w-14 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5" />
              <StepperButton onStep={() => setForm((p) => ({ ...p, period: Math.min(500, p.period + 1), periodText: String(Math.min(500, p.period + 1)) }))} className="stepper-btn">+</StepperButton>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
              <input type="checkbox" checked={form.donchianShowUpper} onChange={(e) => setForm((p) => ({ ...p, donchianShowUpper: e.target.checked }))} className="rounded" />
              {(t as Record<string, string>).donchianShowUpper ?? "Canal superior"}
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
              <input type="checkbox" checked={form.donchianShowLower} onChange={(e) => setForm((p) => ({ ...p, donchianShowLower: e.target.checked }))} className="rounded" />
              {(t as Record<string, string>).donchianShowLower ?? "Canal inferior"}
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
              <input type="checkbox" checked={form.donchianShowMiddle} onChange={(e) => setForm((p) => ({ ...p, donchianShowMiddle: e.target.checked }))} className="rounded" />
              {(t as Record<string, string>).donchianShowMiddle ?? "Linha do meio"}
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).donchianBandOpacity ?? "Opacidade faixa"}</span>
            <div className="flex items-center gap-0.5 rounded border border-zinc-300 bg-white overflow-hidden">
              <StepperButton onStep={() => { const v = Math.max(0, (form.donchianBandOpacity ?? 0.2) - 0.05); setForm((p) => ({ ...p, donchianBandOpacity: v, donchianBandOpacityText: String(Math.round(v * 100)) })); }} disabled={(form.donchianBandOpacity ?? 0.2) <= 0} className="stepper-btn">−</StepperButton>
              <span className="w-10 text-center text-sm font-mono text-zinc-800 tabular-nums" aria-live="polite">{Math.round((form.donchianBandOpacity ?? 0.2) * 100)}%</span>
              <StepperButton onStep={() => { const v = Math.min(0.3, (form.donchianBandOpacity ?? 0.2) + 0.05); setForm((p) => ({ ...p, donchianBandOpacity: v, donchianBandOpacityText: String(Math.round(v * 100)) })); }} disabled={(form.donchianBandOpacity ?? 0.2) >= 0.3} className="stepper-btn">+</StepperButton>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).donchianLimitsColor ?? "Cor canais"}</span>
            <ColorPaletteCombobox value={form.donchianLimitsColor} onChange={(hex) => setForm((prev) => ({ ...prev, donchianLimitsColor: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).donchianLimitsColor ?? "Cor canais"} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura"}</span>
            <Combobox value={form.donchianLimitsLineWidth} onChange={(v) => setForm((p) => ({ ...p, donchianLimitsLineWidth: v as typeof form.donchianLimitsLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineWidth ?? "Espessura"} />
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo"}</span>
            <Combobox value={form.donchianLimitsLineStyle} onChange={(v) => setForm((p) => ({ ...p, donchianLimitsLineStyle: v as typeof form.donchianLimitsLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineStyle ?? "Estilo"} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).donchianMiddleColor ?? "Cor linha meio"}</span>
            <ColorPaletteCombobox
              value={form.donchianMiddleColor}
              onChange={(hex) => setForm((prev) => ({ ...prev, donchianMiddleColor: hex, color: hex }))}
              palette={INDICATOR_COLOR_PALETTE}
              aria-label={(t as Record<string, string>).donchianMiddleColor ?? "Cor linha meio"}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).donchianMiddleThickness ?? "Espessura linha meio"}</span>
            <Combobox
              value={form.donchianMiddleLineWidth}
              onChange={(v) =>
                setForm((p) => ({ ...p, donchianMiddleLineWidth: v as typeof form.donchianMiddleLineWidth, lineWidth: v as typeof form.lineWidth }))
              }
              options={lineWidthOptions}
              className="flex-1 min-w-0"
              size="lg"
              aria-label={(t as Record<string, string>).donchianMiddleThickness ?? "Espessura linha meio"}
            />
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).donchianMiddleStroke ?? "Traço linha meio"}</span>
            <Combobox
              value={form.donchianMiddleLineStyle}
              onChange={(v) =>
                setForm((p) => ({ ...p, donchianMiddleLineStyle: v as typeof form.donchianMiddleLineStyle, lineStyle: v as typeof form.lineStyle }))
              }
              options={lineStyleOptions}
              className="flex-1 min-w-0"
              size="lg"
              aria-label={(t as Record<string, string>).donchianMiddleStroke ?? "Traço linha meio"}
            />
          </div>
        </>
      )}

      {form.indicatorType === "SAR" && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).sarStart ?? "Start"}</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.sarStartText}
              onChange={(e) => setForm((prev) => ({ ...prev, sarStartText: e.target.value }))}
              onBlur={() => {
                const n = parseFloat(form.sarStartText);
                const v = Number.isFinite(n) && n >= 0.001 && n <= 1 ? Math.max(0.001, Math.min(1, n)) : 0.02;
                setForm((prev) => ({ ...prev, sarStart: v, sarStartText: String(v) }));
              }}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).sarIncrement ?? "Increment"}</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.sarIncrementText}
              onChange={(e) => setForm((prev) => ({ ...prev, sarIncrementText: e.target.value }))}
              onBlur={() => {
                const n = parseFloat(form.sarIncrementText);
                const v = Number.isFinite(n) && n >= 0.001 && n <= 1 ? Math.max(0.001, Math.min(1, n)) : 0.02;
                setForm((prev) => ({ ...prev, sarIncrement: v, sarIncrementText: String(v) }));
              }}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).sarMax ?? "Max value"}</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.sarMaxText}
              onChange={(e) => setForm((prev) => ({ ...prev, sarMaxText: e.target.value }))}
              onBlur={() => {
                const n = parseFloat(form.sarMaxText);
                const v = Number.isFinite(n) && n >= 0.02 && n <= 1 ? Math.max(0.02, Math.min(1, n)) : 0.2;
                setForm((prev) => ({ ...prev, sarMax: v, sarMaxText: String(v) }));
              }}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).sarPointSize ?? "Tamanho do ponto"}</span>
            <Combobox value={form.sarPointSize} onChange={(v) => setForm((prev) => ({ ...prev, sarPointSize: v as "thin" | "normal" }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).sarPointSize ?? "Tamanho"} />
          </div>
        </>
      )}

      {form.indicatorType === "MACD" && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdFastMa ?? "Média rápida"}</span>
            <Combobox value={form.macdFastMaType} onChange={(v) => setForm((prev) => ({ ...prev, macdFastMaType: v as AddFormState["macdFastMaType"] }))} options={macdMaTypeOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).macdFastMa ?? "MA"} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdFastPeriod ?? "Período rápido"}</span>
            <div className="flex items-center gap-1">
              <StepperButton onStep={() => setForm((prev) => ({ ...prev, macdFastPeriod: Math.max(1, prev.macdFastPeriod - 1), macdFastPeriodText: String(Math.max(1, prev.macdFastPeriod - 1)) }))} className="stepper-btn">−</StepperButton>
              <input type="text" inputMode="numeric" value={form.macdFastPeriodText} onChange={(e) => setForm((prev) => ({ ...prev, macdFastPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.macdFastPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 12; setForm((prev) => ({ ...prev, macdFastPeriod: v, macdFastPeriodText: String(v) })); }} className="w-14 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5" />
              <StepperButton onStep={() => setForm((prev) => ({ ...prev, macdFastPeriod: Math.min(500, prev.macdFastPeriod + 1), macdFastPeriodText: String(Math.min(500, prev.macdFastPeriod + 1)) }))} className="stepper-btn">+</StepperButton>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdSlowMa ?? "Média lenta"}</span>
            <Combobox value={form.macdSlowMaType} onChange={(v) => setForm((prev) => ({ ...prev, macdSlowMaType: v as AddFormState["macdSlowMaType"] }))} options={macdMaTypeOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).macdSlowMa ?? "MA"} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdSlowPeriod ?? "Período lento"}</span>
            <div className="flex items-center gap-1">
              <StepperButton onStep={() => setForm((prev) => ({ ...prev, macdSlowPeriod: Math.max(1, prev.macdSlowPeriod - 1), macdSlowPeriodText: String(Math.max(1, prev.macdSlowPeriod - 1)) }))} className="stepper-btn">−</StepperButton>
              <input type="text" inputMode="numeric" value={form.macdSlowPeriodText} onChange={(e) => setForm((prev) => ({ ...prev, macdSlowPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.macdSlowPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 26; setForm((prev) => ({ ...prev, macdSlowPeriod: v, macdSlowPeriodText: String(v) })); }} className="w-14 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5" />
              <StepperButton onStep={() => setForm((prev) => ({ ...prev, macdSlowPeriod: Math.min(500, prev.macdSlowPeriod + 1), macdSlowPeriodText: String(Math.min(500, prev.macdSlowPeriod + 1)) }))} className="stepper-btn">+</StepperButton>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.macdSignalLine} onChange={(e) => setForm((prev) => ({ ...prev, macdSignalLine: e.target.checked }))} className="rounded border-zinc-300" />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).macdSignalLineLabel ?? "Linha de sinal"}</span>
          </label>
          <label className={`flex items-center gap-2 ${form.macdSignalLine ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
            <input
              type="checkbox"
              checked={form.macdHistogram}
              disabled={!form.macdSignalLine}
              onChange={(e) => setForm((prev) => ({ ...prev, macdHistogram: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).macdHistogramLabel ?? "MACD (histograma)"}</span>
          </label>
          {form.macdSignalLine && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdSignalMa ?? "MA da sinal"}</span>
                <Combobox value={form.macdSignalMaType} onChange={(v) => setForm((prev) => ({ ...prev, macdSignalMaType: v as AddFormState["macdSignalMaType"] }))} options={macdMaTypeOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).macdSignalMa ?? "MA"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdSignalPeriod ?? "Período sinal"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, macdSignalPeriod: Math.max(1, prev.macdSignalPeriod - 1), macdSignalPeriodText: String(Math.max(1, prev.macdSignalPeriod - 1)) }))} className="stepper-btn">−</StepperButton>
                  <input type="text" inputMode="numeric" value={form.macdSignalPeriodText} onChange={(e) => setForm((prev) => ({ ...prev, macdSignalPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.macdSignalPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 9; setForm((prev) => ({ ...prev, macdSignalPeriod: v, macdSignalPeriodText: String(v) })); }} className="w-14 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5" />
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, macdSignalPeriod: Math.min(500, prev.macdSignalPeriod + 1), macdSignalPeriodText: String(Math.min(500, prev.macdSignalPeriod + 1)) }))} className="stepper-btn">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <ColorPaletteCombobox value={form.macdSignalColor} onChange={(hex) => setForm((prev) => ({ ...prev, macdSignalColor: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura"}</span>
                <Combobox value={form.macdSignalLineWidth} onChange={(v) => setForm((prev) => ({ ...prev, macdSignalLineWidth: v as IndicatorLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineWidth ?? "Espessura"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo"}</span>
                <Combobox value={form.macdSignalLineStyle} onChange={(v) => setForm((prev) => ({ ...prev, macdSignalLineStyle: v as IndicatorLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineStyle ?? "Estilo"} />
              </div>
            </div>
          )}
          {form.macdSignalLine && form.macdHistogram && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdHistogramColorAbove ?? "Cor acima de 0"}</span>
                <ColorPaletteCombobox value={form.macdHistogramColorAbove} onChange={(hex) => setForm((prev) => ({ ...prev, macdHistogramColorAbove: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).macdHistogramColorAbove ?? "Cor acima"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo de 0"}</span>
                <ColorPaletteCombobox value={form.macdHistogramColorBelow} onChange={(hex) => setForm((prev) => ({ ...prev, macdHistogramColorBelow: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo"} />
              </div>
            </div>
          )}
        </>
      )}

      {form.indicatorType !== "Ichimoku" && form.indicatorType !== "Bollinger" && form.indicatorType !== "Donchian" && form.indicatorType !== "Keltner" && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
          <ColorPaletteCombobox value={form.color} onChange={(hex) => setForm((prev) => ({ ...prev, color: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
        </div>
      )}

      {(form.indicatorType !== "SAR" && form.indicatorType !== "VWAP" && form.indicatorType !== "Ichimoku" && form.indicatorType !== "Bollinger" && form.indicatorType !== "Donchian" && form.indicatorType !== "Keltner") && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
            <Combobox value={form.lineWidth} onChange={(v) => setForm((prev) => ({ ...prev, lineWidth: v as IndicatorLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineWidth} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
            <Combobox value={form.lineStyle} onChange={(v) => setForm((prev) => ({ ...prev, lineStyle: v as IndicatorLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineStyle} />
          </div>
        </>
      )}

      {form.indicatorType === "Stochastic" && (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.stochLimits}
              onChange={(e) => setForm((prev) => ({ ...prev, stochLimits: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).stochLimitsLabel ?? "Limites superior e inferior (0–100)"}</span>
          </label>
          {form.stochLimits && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).stochLimitUpperLabel ?? "Superior %"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, stochLimitUpper: Math.max(0, Math.min(100, prev.stochLimitUpper - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</StepperButton>
                  <span className="w-10 text-center text-sm tabular-nums">{form.stochLimitUpper}</span>
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, stochLimitUpper: Math.max(0, Math.min(100, prev.stochLimitUpper + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).stochLimitLowerLabel ?? "Inferior %"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, stochLimitLower: Math.max(0, Math.min(100, prev.stochLimitLower - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</StepperButton>
                  <span className="w-10 text-center text-sm tabular-nums">{form.stochLimitLower}</span>
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, stochLimitLower: Math.max(0, Math.min(100, prev.stochLimitLower + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <ColorPaletteCombobox value={form.stochLimitColor} onChange={(hex) => setForm((prev) => ({ ...prev, stochLimitColor: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura"}</span>
                <Combobox value={form.stochLimitLineWidth} onChange={(v) => setForm((prev) => ({ ...prev, stochLimitLineWidth: v as IndicatorLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineWidth ?? "Espessura"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo"}</span>
                <Combobox value={form.stochLimitLineStyle} onChange={(v) => setForm((prev) => ({ ...prev, stochLimitLineStyle: v as IndicatorLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineStyle ?? "Estilo"} />
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.stochDLine} onChange={(e) => setForm((prev) => ({ ...prev, stochDLine: e.target.checked }))} className="rounded border-zinc-300" />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).stochDLineLabel ?? "Linha %D (média móvel da %K)"}</span>
          </label>
          {form.stochDLine && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).stochDMaLabel ?? "Tipo da MM"}</span>
                <Combobox value={form.stochDMaType} onChange={(v) => setForm((prev) => ({ ...prev, stochDMaType: v as "SMA" | "EMA" | "WMA" }))} options={maTypeOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).stochDMaLabel ?? "MA"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).stochDPeriodLabel ?? "Período %D"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, stochDPeriod: Math.max(1, prev.stochDPeriod - 1), stochDPeriodText: String(Math.max(1, prev.stochDPeriod - 1)) }))} className="stepper-btn">−</StepperButton>
                  <input type="text" inputMode="numeric" value={form.stochDPeriodText} onChange={(e) => setForm((prev) => ({ ...prev, stochDPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.stochDPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 3; setForm((prev) => ({ ...prev, stochDPeriod: v, stochDPeriodText: String(v) })); }} className="w-14 text-center tabular-nums text-sm border border-zinc-300 rounded px-2 py-1.5" />
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, stochDPeriod: Math.min(500, prev.stochDPeriod + 1), stochDPeriodText: String(Math.min(500, prev.stochDPeriod + 1)) }))} className="stepper-btn">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <ColorPaletteCombobox value={form.stochDColor} onChange={(hex) => setForm((prev) => ({ ...prev, stochDColor: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura"}</span>
                <Combobox value={form.stochDLineWidth} onChange={(v) => setForm((prev) => ({ ...prev, stochDLineWidth: v as IndicatorLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineWidth ?? "Espessura"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo"}</span>
                <Combobox value={form.stochDLineStyle} onChange={(v) => setForm((prev) => ({ ...prev, stochDLineStyle: v as IndicatorLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineStyle ?? "Estilo"} />
              </div>
            </div>
          )}
        </>
      )}

      {form.indicatorType === "WilliamsR" && (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.williamsRLimits}
              onChange={(e) => setForm((prev) => ({ ...prev, williamsRLimits: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            <span className="text-xs text-zinc-700">{(t as Record<string, string>).williamsRLimitsLabel ?? "Limites (-100 a 0: ex. -80 / -20)"}</span>
          </label>
          {form.williamsRLimits && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).williamsRLimitUpperLabel ?? "Superior"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, williamsRLimitUpper: Math.max(-100, Math.min(0, prev.williamsRLimitUpper - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</StepperButton>
                  <span className="w-10 text-center text-sm tabular-nums">{form.williamsRLimitUpper}</span>
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, williamsRLimitUpper: Math.max(-100, Math.min(0, prev.williamsRLimitUpper + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).williamsRLimitLowerLabel ?? "Inferior"}</span>
                <div className="flex items-center gap-1">
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, williamsRLimitLower: Math.max(-100, Math.min(0, prev.williamsRLimitLower - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</StepperButton>
                  <span className="w-10 text-center text-sm tabular-nums">{form.williamsRLimitLower}</span>
                  <StepperButton onStep={() => setForm((prev) => ({ ...prev, williamsRLimitLower: Math.max(-100, Math.min(0, prev.williamsRLimitLower + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</StepperButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <ColorPaletteCombobox value={form.williamsRLimitColor} onChange={(hex) => setForm((prev) => ({ ...prev, williamsRLimitColor: hex }))} palette={INDICATOR_COLOR_PALETTE} aria-label={t.color} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura"}</span>
                <Combobox value={form.williamsRLimitLineWidth} onChange={(v) => setForm((prev) => ({ ...prev, williamsRLimitLineWidth: v as IndicatorLineWidth }))} options={lineWidthOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineWidth ?? "Espessura"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo"}</span>
                <Combobox value={form.williamsRLimitLineStyle} onChange={(v) => setForm((prev) => ({ ...prev, williamsRLimitLineStyle: v as IndicatorLineStyle }))} options={lineStyleOptions} className="flex-1 min-w-0" size="lg" aria-label={(t as Record<string, string>).lineStyle ?? "Estilo"} />
              </div>
            </div>
          )}
        </>
      )}

      {defaultModelMaxIndicatorsReached && (
        <p className="text-xs text-amber-700 mb-1.5" role="status">
          {(t as Record<string, string>).defaultModelMaxIndicators}
        </p>
      )}
      <button
        type="button"
        onClick={handleAdd}
        disabled={addButtonDisabled}
        className="w-full py-2 rounded bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t.addIndicator}
      </button>
      <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-xs font-semibold text-zinc-800 mb-1.5">{tRecord.indicatorTheoryHeading}</p>
        <div className="max-h-72 overflow-y-auto pr-1 text-xs text-zinc-600 leading-relaxed [scrollbar-gutter:stable]">
          {tRecord[INDICATOR_THEORY_I18N_KEY[form.indicatorType]] ?? ""}
        </div>
      </div>
    </div>
  );
}
