"use client";

import { useState } from "react";
import type { UserIndicatorType, IndicatorPanel, IndicatorFieldKey, IndicatorLineWidth, IndicatorLineStyle } from "../KlinesIndicatorsContext";
import { useIndicatorsPanelContext } from "./IndicatorsPanelContext";
import type { AddFormState } from "./indicatorsPanelTypes";

interface IndicatorsPanelAddFormProps {
  form: AddFormState;
  setForm: React.Dispatch<React.SetStateAction<AddFormState>>;
}

type IchimokuColorLine = "Tenkan" | "Kijun" | "Span A" | "Span B" | "Chikou";

export function IndicatorsPanelAddForm({ form, setForm }: IndicatorsPanelAddFormProps) {
  const [ichimokuColorOpen, setIchimokuColorOpen] = useState<IchimokuColorLine | null>(null);
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
    handleAdd,
  } = useIndicatorsPanelContext();

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
  const chartOptionValue: string =
    form.indicatorType === "SAR" || form.indicatorType === "VWAP" || form.indicatorType === "Bollinger" || form.indicatorType === "Keltner" || form.indicatorType === "Donchian" || form.indicatorType === "HMA" || form.indicatorType === "VWMA"
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
        <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.indicatorType}</span>
        <select
          value={form.indicatorType}
          onChange={(e) => setType(e.target.value as UserIndicatorType)}
          className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
          aria-label={t.indicatorType}
        >
          <optgroup label={(t as Record<string, string>).indicatorGroupMovingAverages ?? "Moving Averages"}>
            <option value="SMA">SMA</option>
            <option value="EMA">EMA</option>
            <option value="WMA">WMA</option>
            <option value="HMA">{(t as Record<string, string>).hmaLabel ?? "HMA"}</option>
            <option value="VWMA">{(t as Record<string, string>).vwmaLabel ?? "VWMA"}</option>
          </optgroup>
          <optgroup label={(t as Record<string, string>).indicatorGroupMomentum ?? "Momentum"}>
            <option value="RSI">RSI</option>
            <option value="MFI">{(t as Record<string, string>).mfiLabel ?? "MFI"}</option>
            <option value="MACD">MACD</option>
            <option value="Stochastic">Stochastic</option>
            <option value="WilliamsR">{(t as Record<string, string>).williamsRLabel ?? "Williams %R"}</option>
            <option value="CCI">{(t as Record<string, string>).cciLabel ?? "CCI"}</option>
          </optgroup>
          <optgroup label={(t as Record<string, string>).indicatorGroupTrend ?? "Trend"}>
            <option value="ADX">{(t as Record<string, string>).adxLabel ?? "ADX"}</option>
            <option value="SAR">{(t as Record<string, string>).sarLabel ?? "Parabolic SAR"}</option>
            <option value="Ichimoku">{(t as Record<string, string>).ichimokuLabel ?? "Ichimoku"}</option>
          </optgroup>
          <optgroup label={(t as Record<string, string>).indicatorGroupVolume ?? "Volume"}>
            <option value="Volume">{(t as Record<string, string>).volumeLabel ?? "Volume"}</option>
            <option value="OBV">OBV</option>
            <option value="AD">{(t as Record<string, string>).adLabel ?? "A/D"}</option>
            <option value="CMF">{(t as Record<string, string>).cmfLabel ?? "CMF"}</option>
            <option value="VWAP">{(t as Record<string, string>).vwapLabel ?? "VWAP"}</option>
          </optgroup>
          <optgroup label={(t as Record<string, string>).indicatorGroupVolatilityChannels ?? "Volatility / Channels"}>
            <option value="ATR">{(t as Record<string, string>).atrLabel ?? "ATR"}</option>
            <option value="Bollinger">{(t as Record<string, string>).bollingerLabel ?? "Bollinger Bands"}</option>
            <option value="Keltner">{(t as Record<string, string>).keltnerLabel ?? "Keltner Channels"}</option>
            <option value="Donchian">{(t as Record<string, string>).donchianLabel ?? "Donchian Channels"}</option>
          </optgroup>
        </select>
      </div>

      {form.indicatorType === "Ichimoku" && (
        <>
          <div className="grid grid-cols-1 gap-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-xs font-medium text-zinc-600 sm:w-20 shrink-0">{(t as Record<string, string>).ichimokuTenkanPeriod ?? "Tenkan"}</span>
              <div className="flex items-center gap-1 w-full sm:flex-1 min-w-0">
                <button type="button" onClick={() => { const v = Math.max(1, (form.ichimokuTenkanPeriod ?? 9) - 1); setForm((p) => ({ ...p, ichimokuTenkanPeriod: v, ichimokuTenkanPeriodText: String(v) })); }} disabled={(form.ichimokuTenkanPeriod ?? 9) <= 1} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 disabled:opacity-40 shrink-0">−</button>
                <input type="text" inputMode="numeric" value={form.ichimokuTenkanPeriodText} onChange={(e) => setForm((p) => ({ ...p, ichimokuTenkanPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = parseInt(form.ichimokuTenkanPeriodText, 10); const v = Number.isFinite(n) ? Math.max(1, Math.min(500, n)) : 9; setForm((p) => ({ ...p, ichimokuTenkanPeriod: v, ichimokuTenkanPeriodText: String(v) })); }} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 text-center" />
                <button type="button" onClick={() => { const v = Math.min(500, (form.ichimokuTenkanPeriod ?? 9) + 1); setForm((p) => ({ ...p, ichimokuTenkanPeriod: v, ichimokuTenkanPeriodText: String(v) })); }} disabled={(form.ichimokuTenkanPeriod ?? 9) >= 500} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 disabled:opacity-40 shrink-0">+</button>
              </div>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-xs font-medium text-zinc-600 sm:w-20 shrink-0">{(t as Record<string, string>).ichimokuKijunPeriod ?? "Kijun"}</span>
              <div className="flex items-center gap-1 w-full sm:flex-1 min-w-0">
                <button type="button" onClick={() => { const v = Math.max(1, (form.ichimokuKijunPeriod ?? 26) - 1); setForm((p) => ({ ...p, ichimokuKijunPeriod: v, ichimokuKijunPeriodText: String(v) })); }} disabled={(form.ichimokuKijunPeriod ?? 26) <= 1} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 disabled:opacity-40 shrink-0">−</button>
                <input type="text" inputMode="numeric" value={form.ichimokuKijunPeriodText} onChange={(e) => setForm((p) => ({ ...p, ichimokuKijunPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = parseInt(form.ichimokuKijunPeriodText, 10); const v = Number.isFinite(n) ? Math.max(1, Math.min(500, n)) : 26; setForm((p) => ({ ...p, ichimokuKijunPeriod: v, ichimokuKijunPeriodText: String(v) })); }} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 text-center" />
                <button type="button" onClick={() => { const v = Math.min(500, (form.ichimokuKijunPeriod ?? 26) + 1); setForm((p) => ({ ...p, ichimokuKijunPeriod: v, ichimokuKijunPeriodText: String(v) })); }} disabled={(form.ichimokuKijunPeriod ?? 26) >= 500} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 disabled:opacity-40 shrink-0">+</button>
              </div>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-xs font-medium text-zinc-600 sm:w-20 shrink-0">{(t as Record<string, string>).ichimokuSpanBPeriod ?? "Span B"}</span>
              <div className="flex items-center gap-1 w-full sm:flex-1 min-w-0">
                <button type="button" onClick={() => { const v = Math.max(1, (form.ichimokuSpanBPeriod ?? 52) - 1); setForm((p) => ({ ...p, ichimokuSpanBPeriod: v, ichimokuSpanBPeriodText: String(v) })); }} disabled={(form.ichimokuSpanBPeriod ?? 52) <= 1} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 disabled:opacity-40 shrink-0">−</button>
                <input type="text" inputMode="numeric" value={form.ichimokuSpanBPeriodText} onChange={(e) => setForm((p) => ({ ...p, ichimokuSpanBPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = parseInt(form.ichimokuSpanBPeriodText, 10); const v = Number.isFinite(n) ? Math.max(1, Math.min(500, n)) : 52; setForm((p) => ({ ...p, ichimokuSpanBPeriod: v, ichimokuSpanBPeriodText: String(v) })); }} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 text-center" />
                <button type="button" onClick={() => { const v = Math.min(500, (form.ichimokuSpanBPeriod ?? 52) + 1); setForm((p) => ({ ...p, ichimokuSpanBPeriod: v, ichimokuSpanBPeriodText: String(v) })); }} disabled={(form.ichimokuSpanBPeriod ?? 52) >= 500} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 disabled:opacity-40 shrink-0">+</button>
              </div>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-xs font-medium text-zinc-600 sm:w-20 shrink-0">{(t as Record<string, string>).ichimokuDisplacement ?? "Desloc."}</span>
              <div className="flex items-center gap-1 w-full sm:flex-1 min-w-0">
                <button type="button" onClick={() => { const v = Math.max(0, (form.ichimokuDisplacement ?? 26) - 1); setForm((p) => ({ ...p, ichimokuDisplacement: v, ichimokuDisplacementText: String(v) })); }} disabled={(form.ichimokuDisplacement ?? 26) <= 0} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 disabled:opacity-40 shrink-0">−</button>
                <input type="text" inputMode="numeric" value={form.ichimokuDisplacementText} onChange={(e) => setForm((p) => ({ ...p, ichimokuDisplacementText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = parseInt(form.ichimokuDisplacementText, 10); const v = Number.isFinite(n) ? Math.max(0, Math.min(500, n)) : 26; setForm((p) => ({ ...p, ichimokuDisplacement: v, ichimokuDisplacementText: String(v) })); }} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 text-center" />
                <button type="button" onClick={() => { const v = Math.min(500, (form.ichimokuDisplacement ?? 26) + 1); setForm((p) => ({ ...p, ichimokuDisplacement: v, ichimokuDisplacementText: String(v) })); }} disabled={(form.ichimokuDisplacement ?? 26) >= 500} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 disabled:opacity-40 shrink-0">+</button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).ichimokuCloudOpacity ?? "Opac. nuvem"}</span>
            <button type="button" onClick={() => { const v = Math.max(0, (form.ichimokuCloudOpacity ?? 0.3) * 100 - 10); setForm((p) => ({ ...p, ichimokuCloudOpacity: v / 100, ichimokuCloudOpacityText: String(Math.round(v)) })); }} disabled={((form.ichimokuCloudOpacity ?? 0.3) * 100) <= 0} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">−</button>
            <span className="w-10 text-center text-sm font-mono tabular-nums">{Math.round((form.ichimokuCloudOpacity ?? 0.3) * 100)}%</span>
            <button type="button" onClick={() => { const v = Math.min(70, (form.ichimokuCloudOpacity ?? 0.3) * 100 + 10); setForm((p) => ({ ...p, ichimokuCloudOpacity: v / 100, ichimokuCloudOpacityText: String(Math.round(v)) })); }} disabled={((form.ichimokuCloudOpacity ?? 0.3) * 100) >= 70} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">+</button>
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
                  <button type="button" onClick={() => setIchimokuColorOpen(ichimokuColorOpen === label ? null : label)} className="w-6 h-6 rounded border border-zinc-300 shrink-0" style={{ backgroundColor: val }} aria-label={(t as Record<string, string>).color ?? "Cor"} />
                  {ichimokuColorOpen === label && (
                    <>
                      <div className="fixed inset-0 z-10" aria-hidden onClick={() => setIchimokuColorOpen(null)} />
                      <div className="absolute left-0 top-full mt-1 z-20 p-2 bg-white border border-zinc-200 rounded-lg shadow-lg w-[min-content] min-w-[8rem]">
                        <div className="grid grid-cols-4 gap-1.5 [&>button]:w-6 [&>button]:h-6 [&>button]:shrink-0 [&>button]:rounded [&>button]:border">
                          {INDICATOR_COLOR_PALETTE.map((hex) => (
                            <button key={hex} type="button" onClick={() => { setForm((p) => ({ ...p, [colorKey]: hex })); setIchimokuColorOpen(null); }} className={val === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"} style={{ backgroundColor: hex }} />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  <select value={form[widthKey]} onChange={(e) => setForm((p) => ({ ...p, [widthKey]: e.target.value as IndicatorLineWidth }))} className="text-[10px] border border-zinc-300 rounded px-1 py-0.5 bg-white w-20">
                    <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Fino"}</option>
                    <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                  </select>
                  <select value={form[styleKey]} onChange={(e) => setForm((p) => ({ ...p, [styleKey]: e.target.value as IndicatorLineStyle }))} className="text-[10px] border border-zinc-300 rounded px-1 py-0.5 bg-white w-24">
                    <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Sólido"}</option>
                    <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Pontilhado"}</option>
                    <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Tracejado"}</option>
                  </select>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!(form.indicatorType === "SAR" || form.indicatorType === "VWAP" || form.indicatorType === "Bollinger" || form.indicatorType === "Keltner" || form.indicatorType === "Donchian" || form.indicatorType === "HMA" || form.indicatorType === "VWMA" || form.indicatorType === "Ichimoku") && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.chartOption}</span>
          <select
            value={chartOptionValue}
            onChange={(e) => setForm((prev) => ({ ...prev, chartOption: e.target.value as IndicatorPanel }))}
            className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
            aria-label={t.chartOption}
          >
            {form.indicatorType === "Volume" ? (
              <>
                {indicatorCountByPanel.panel2 === 0 && <option value="panel2">{(t as Record<string, string>).chartOptionPanel2 ?? "Panel 2"}</option>}
                {!isFreeUser && indicatorCountByPanel.panel3 === 0 && <option value="panel3">{(t as Record<string, string>).chartOptionPanel3 ?? "Panel 3"}</option>}
                {!isFreeUser && indicatorCountByPanel.panel4 === 0 && <option value="panel4">{(t as Record<string, string>).chartOptionPanel4 ?? "Panel 4"}</option>}
                {!isFreeUser && indicatorCountByPanel.panel5 === 0 && <option value="panel5">{(t as Record<string, string>).chartOptionPanel5 ?? "Panel 5"}</option>}
                {!hasEmptyPanelForVolume && (
                  <option value="">{(t as Record<string, string>).chartOptionNoPanelAvailable ?? "Nenhum painel disponível"}</option>
                )}
              </>
            ) : (form.indicatorType === "RSI" || form.indicatorType === "MFI" || form.indicatorType === "MACD" || form.indicatorType === "Stochastic" || form.indicatorType === "WilliamsR" || form.indicatorType === "OBV" || form.indicatorType === "AD" || form.indicatorType === "ATR" || form.indicatorType === "ADX" || form.indicatorType === "CCI" || form.indicatorType === "CMF") ? (
              <>
                {panelsFreeForSecondary.panel2 && <option value="panel2">{(t as Record<string, string>).chartOptionPanel2 ?? "Panel 2"}</option>}
                {panelsFreeForSecondary.panel3 && <option value="panel3">{(t as Record<string, string>).chartOptionPanel3 ?? "Panel 3"}</option>}
                {panelsFreeForSecondary.panel4 && <option value="panel4">{(t as Record<string, string>).chartOptionPanel4 ?? "Panel 4"}</option>}
                {panelsFreeForSecondary.panel5 && <option value="panel5">{(t as Record<string, string>).chartOptionPanel5 ?? "Panel 5"}</option>}
                {!panelsFreeForSecondary.panel2 && !panelsFreeForSecondary.panel3 && !panelsFreeForSecondary.panel4 && !panelsFreeForSecondary.panel5 && (
                  <option value="">{(t as Record<string, string>).chartOptionNoPanelAvailable ?? "Nenhum painel disponível"}</option>
                )}
              </>
            ) : (
              <>
                <option value="main" disabled={indicatorCountByPanel.main >= MAIN_MAX_INDICATORS}>{(t as Record<string, string>).chartOptionMain ?? "Main"}</option>
                <option value="panel2" disabled={indicatorCountByPanel.panel2 >= SECONDARY_MAX_INDICATORS}>{(t as Record<string, string>).chartOptionPanel2 ?? "Panel 2"}</option>
                <option value="panel3" disabled={indicatorCountByPanel.panel3 >= SECONDARY_MAX_INDICATORS || isFreeUser}>{isFreeUser ? "🔒 " : ""}{(t as Record<string, string>).chartOptionPanel3 ?? "Panel 3"}</option>
                <option value="panel4" disabled={indicatorCountByPanel.panel4 >= SECONDARY_MAX_INDICATORS || isFreeUser}>{isFreeUser ? "🔒 " : ""}{(t as Record<string, string>).chartOptionPanel4 ?? "Panel 4"}</option>
                <option value="panel5" disabled={indicatorCountByPanel.panel5 >= SECONDARY_MAX_INDICATORS || isFreeUser}>{isFreeUser ? "🔒 " : ""}{(t as Record<string, string>).chartOptionPanel5 ?? "Panel 5"}</option>
              </>
            )}
          </select>
        </div>
      )}

      {form.indicatorType !== "OBV" && form.indicatorType !== "AD" && form.indicatorType !== "SAR" && form.indicatorType !== "ATR" && form.indicatorType !== "ADX" && form.indicatorType !== "VWAP" && form.indicatorType !== "Volume" && form.indicatorType !== "Donchian" && form.indicatorType !== "MFI" && form.indicatorType !== "Ichimoku" && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.field}</span>
          <select
            value={(fieldOptionsVisibleForAdd.some((o) => o.value === form.fieldKey) ? form.fieldKey : firstEnabledFieldValueForAdd) as string}
            onChange={(e) => {
              const newKey = e.target.value as IndicatorFieldKey;
              setForm((prev) => ({ ...prev, fieldKey: newKey }));
            }}
            className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
            aria-label={t.field}
          >
            {fieldOptionsVisibleForAdd.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {(form.indicatorType === "OBV" || form.indicatorType === "AD") && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).volumeSourceLabel ?? "Fonte de volume"}</span>
          <select
            value={form.indicatorType === "OBV" ? (form.obvVolumeSource ?? "base") : (form.adVolumeSource ?? "base")}
            onChange={(e) => {
              const v = e.target.value as "base" | "usdt";
              setForm((prev) => ({
                ...prev,
                ...(prev.indicatorType === "OBV" ? { obvVolumeSource: v } : { adVolumeSource: v }),
              }));
            }}
            className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
            aria-label={(t as Record<string, string>).volumeSourceLabel ?? "Fonte de volume"}
          >
            <option value="base">{(t as Record<string, string>).volumeBaseLabel ?? "Vol (base)"}</option>
            <option value="usdt">{(t as Record<string, string>).volumeUsdtLabel ?? "Vol (USDT)"}</option>
          </select>
        </div>
      )}

      {form.indicatorType !== "MACD" && form.indicatorType !== "OBV" && form.indicatorType !== "AD" && form.indicatorType !== "SAR" && form.indicatorType !== "VWAP" && form.indicatorType !== "Volume" && form.indicatorType !== "Ichimoku" && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.period}</span>
          <div className="flex-1 min-w-0 flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const next = Math.max(1, Math.min(500, Math.round((form.period ?? 7) - 1)));
                setForm((prev) => ({ ...prev, period: next, periodText: String(next) }));
              }}
              className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              aria-label="-"
            >
              −
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.periodText}
              onFocus={(e) => {
                const el = e.currentTarget;
                queueMicrotask(() => el?.select());
              }}
              onChange={(e) => setForm((prev) => ({ ...prev, periodText: e.target.value.replace(/[^\d]/g, "") }))}
              onBlur={() => {
                const n = Number(form.periodText);
                const next = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 7;
                setForm((prev) => ({ ...prev, period: next, periodText: String(next) }));
              }}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5"
              aria-label={t.period}
            />
            <button
              type="button"
              onClick={() => {
                const next = Math.max(1, Math.min(500, Math.round((form.period ?? 7) + 1)));
                setForm((prev) => ({ ...prev, period: next, periodText: String(next) }));
              }}
              className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              aria-label="+"
            >
              +
            </button>
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
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, cciHistogramColorAbove: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.cciHistogramColorAbove === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo de 0"}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, cciHistogramColorBelow: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.cciHistogramColorBelow === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
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
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, cciLimitUpper: Math.max(-500, Math.min(500, prev.cciLimitUpper - 10)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                  <span className="w-10 text-center text-sm tabular-nums">{form.cciLimitUpper}</span>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, cciLimitUpper: Math.max(-500, Math.min(500, prev.cciLimitUpper + 10)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).cciLimitLowerLabel ?? "Inferior"}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, cciLimitLower: Math.max(-500, Math.min(500, prev.cciLimitLower - 10)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                  <span className="w-10 text-center text-sm tabular-nums">{form.cciLimitLower}</span>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, cciLimitLower: Math.max(-500, Math.min(500, prev.cciLimitLower + 10)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, cciLimitColor: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.cciLimitColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                <select value={form.cciLimitLineWidth} onChange={(e) => setForm((prev) => ({ ...prev, cciLimitLineWidth: e.target.value as IndicatorLineWidth }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Thin"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                <select value={form.cciLimitLineStyle} onChange={(e) => setForm((prev) => ({ ...prev, cciLimitLineStyle: e.target.value as IndicatorLineStyle }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Solid"}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Dotted"}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Dashed"}</option>
                </select>
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
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, cmfHistogramColorAbove: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.cmfHistogramColorAbove === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo de 0"}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, cmfHistogramColorBelow: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.cmfHistogramColorBelow === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
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
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, cmfLimitUpper: Math.max(-1, Math.min(1, Math.round((prev.cmfLimitUpper - 0.05) * 100) / 100)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                  <span className="w-14 text-center text-sm tabular-nums">{form.cmfLimitUpper.toFixed(2)}</span>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, cmfLimitUpper: Math.max(-1, Math.min(1, Math.round((prev.cmfLimitUpper + 0.05) * 100) / 100)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).cmfLimitLowerLabel ?? "Inferior"}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, cmfLimitLower: Math.max(-1, Math.min(1, Math.round((prev.cmfLimitLower - 0.05) * 100) / 100)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                  <span className="w-14 text-center text-sm tabular-nums">{form.cmfLimitLower.toFixed(2)}</span>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, cmfLimitLower: Math.max(-1, Math.min(1, Math.round((prev.cmfLimitLower + 0.05) * 100) / 100)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, cmfLimitColor: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.cmfLimitColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                <select value={form.cmfLimitLineWidth} onChange={(e) => setForm((prev) => ({ ...prev, cmfLimitLineWidth: e.target.value as IndicatorLineWidth }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Thin"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                <select value={form.cmfLimitLineStyle} onChange={(e) => setForm((prev) => ({ ...prev, cmfLimitLineStyle: e.target.value as IndicatorLineStyle }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Solid"}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Dotted"}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Dashed"}</option>
                </select>
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
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, rsiCenterLineColor: hex }))}
                      className={`w-6 h-6 rounded border shrink-0 ${form.rsiCenterLineColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                <select
                  value={form.rsiCenterLineWidth}
                  onChange={(e) => setForm((prev) => ({ ...prev, rsiCenterLineWidth: e.target.value as IndicatorLineWidth }))}
                  className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
                >
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Thin"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                <select
                  value={form.rsiCenterLineStyle}
                  onChange={(e) => setForm((prev) => ({ ...prev, rsiCenterLineStyle: e.target.value as IndicatorLineStyle }))}
                  className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
                >
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Solid"}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Dotted"}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Dashed"}</option>
                </select>
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
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, mfiCenterLineColor: hex }))}
                      className={`w-6 h-6 rounded border shrink-0 ${form.mfiCenterLineColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                <select
                  value={form.mfiCenterLineWidth}
                  onChange={(e) => setForm((prev) => ({ ...prev, mfiCenterLineWidth: e.target.value as IndicatorLineWidth }))}
                  className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
                >
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Thin"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                <select
                  value={form.mfiCenterLineStyle}
                  onChange={(e) => setForm((prev) => ({ ...prev, mfiCenterLineStyle: e.target.value as IndicatorLineStyle }))}
                  className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
                >
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Solid"}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Dotted"}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Dashed"}</option>
                </select>
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
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, mfiLimitUpper: Math.max(0, Math.min(100, prev.mfiLimitUpper - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                  <span className="w-10 text-center text-sm tabular-nums">{form.mfiLimitUpper}</span>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, mfiLimitUpper: Math.max(0, Math.min(100, prev.mfiLimitUpper + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).mfiLimitLowerLabel ?? "Inferior %"}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, mfiLimitLower: Math.max(0, Math.min(100, prev.mfiLimitLower - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                  <span className="w-10 text-center text-sm tabular-nums">{form.mfiLimitLower}</span>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, mfiLimitLower: Math.max(0, Math.min(100, prev.mfiLimitLower + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, mfiLimitColor: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.mfiLimitColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                <select value={form.mfiLimitLineWidth} onChange={(e) => setForm((prev) => ({ ...prev, mfiLimitLineWidth: e.target.value as IndicatorLineWidth }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Thin"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                <select value={form.mfiLimitLineStyle} onChange={(e) => setForm((prev) => ({ ...prev, mfiLimitLineStyle: e.target.value as IndicatorLineStyle }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Solid"}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Dotted"}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Dashed"}</option>
                </select>
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
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, rsiLimitUpper: Math.max(0, Math.min(100, prev.rsiLimitUpper - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                  <span className="w-10 text-center text-sm tabular-nums">{form.rsiLimitUpper}</span>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, rsiLimitUpper: Math.max(0, Math.min(100, prev.rsiLimitUpper + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).rsiLimitLowerLabel ?? "Inferior %"}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, rsiLimitLower: Math.max(0, Math.min(100, prev.rsiLimitLower - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                  <span className="w-10 text-center text-sm tabular-nums">{form.rsiLimitLower}</span>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, rsiLimitLower: Math.max(0, Math.min(100, prev.rsiLimitLower + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, rsiLimitColor: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.rsiLimitColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
                <select value={form.rsiLimitLineWidth} onChange={(e) => setForm((prev) => ({ ...prev, rsiLimitLineWidth: e.target.value as IndicatorLineWidth }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Thin"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
                <select value={form.rsiLimitLineStyle} onChange={(e) => setForm((prev) => ({ ...prev, rsiLimitLineStyle: e.target.value as IndicatorLineStyle }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Solid"}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Dotted"}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Dashed"}</option>
                </select>
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
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, volumeColorAboveOpen: !prev.volumeColorAboveOpen }))}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white flex items-center justify-between gap-2"
              aria-expanded={form.volumeColorAboveOpen}
            >
              <span className="w-4 h-4 rounded shrink-0 border border-zinc-300" style={{ backgroundColor: form.volumeColorAbove }} />
              <span className="text-zinc-500 text-xs">▼</span>
            </button>
          </div>
          {form.volumeColorAboveOpen && (
            <div className="flex flex-wrap gap-1 p-1 border border-zinc-200 rounded bg-zinc-50">
              {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                <button
                  key={hex}
                  type="button"
                  className="w-6 h-6 rounded border border-zinc-300 shrink-0"
                  style={{ backgroundColor: hex }}
                  onClick={() => setForm((prev) => ({ ...prev, volumeColorAbove: hex, volumeColorAboveOpen: false }))}
                  aria-label={hex}
                />
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-24 shrink-0">{(t as Record<string, string>).volumeColorNegative ?? "Cor negativo"}</span>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, volumeColorBelowOpen: !prev.volumeColorBelowOpen }))}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white flex items-center justify-between gap-2"
              aria-expanded={form.volumeColorBelowOpen}
            >
              <span className="w-4 h-4 rounded shrink-0 border border-zinc-300" style={{ backgroundColor: form.volumeColorBelow }} />
              <span className="text-zinc-500 text-xs">▼</span>
            </button>
          </div>
          {form.volumeColorBelowOpen && (
            <div className="flex flex-wrap gap-1 p-1 border border-zinc-200 rounded bg-zinc-50">
              {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                <button
                  key={hex}
                  type="button"
                  className="w-6 h-6 rounded border border-zinc-300 shrink-0"
                  style={{ backgroundColor: hex }}
                  onClick={() => setForm((prev) => ({ ...prev, volumeColorBelow: hex, volumeColorBelowOpen: false }))}
                  aria-label={hex}
                />
              ))}
            </div>
          )}
        </>
      )}

      {form.indicatorType === "Bollinger" && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).bollingerMaType ?? "Média móvel"}</span>
            <select
              value={form.bollingerMaType}
              onChange={(e) => setForm((prev) => ({ ...prev, bollingerMaType: e.target.value as "SMA" | "EMA" | "WMA" }))}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
            >
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
              <option value="WMA">WMA</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).field ?? "Campo"}</span>
            <select
              value={form.fieldKey}
              onChange={(e) => setForm((prev) => ({ ...prev, fieldKey: e.target.value as typeof form.fieldKey }))}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
            >
              {fieldOptionsVisibleForAdd.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).period ?? "Período"}</span>
            <div className="flex-1 min-w-0 flex items-center gap-1">
              <button type="button" onClick={() => setForm((p) => ({ ...p, period: Math.max(1, p.period - 1), periodText: String(Math.max(1, p.period - 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">−</button>
              <input type="text" inputMode="numeric" value={form.periodText} onChange={(e) => setForm((p) => ({ ...p, periodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.periodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 20; setForm((p) => ({ ...p, period: v, periodText: String(v) })); }} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5" />
              <button type="button" onClick={() => setForm((p) => ({ ...p, period: Math.min(500, p.period + 1), periodText: String(Math.min(500, p.period + 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">+</button>
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
          <div className="flex items-center gap-2 relative">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).bollingerLimitsColor ?? "Cor bandas"}</span>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, bollingerLimitsColorOpen: !prev.bollingerLimitsColorOpen }))}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white flex items-center justify-between gap-2"
              aria-label={(t as Record<string, string>).bollingerLimitsColor ?? "Cor bandas"}
              aria-expanded={form.bollingerLimitsColorOpen}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-4 h-4 rounded border border-zinc-300 shrink-0" style={{ backgroundColor: form.bollingerLimitsColor }} />
              </span>
              <span className="text-zinc-500 text-xs">▾</span>
            </button>
            {form.bollingerLimitsColorOpen && (
              <>
                <div className="fixed inset-0 z-30" aria-hidden onClick={() => setForm((prev) => ({ ...prev, bollingerLimitsColorOpen: false }))} />
                <div className="absolute left-[4.5rem] right-0 top-full z-40 mt-1 max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg p-2">
                  <div className="grid grid-cols-3 gap-2">
                    {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, bollingerLimitsColor: hex, bollingerLimitsColorOpen: false }))}
                        className={`w-10 h-10 rounded border-2 ${form.bollingerLimitsColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                        style={{ backgroundColor: hex }}
                        aria-label={`Color ${hex}`}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura bandas"}</span>
            <select value={form.bollingerLimitsLineWidth} onChange={(e) => setForm((p) => ({ ...p, bollingerLimitsLineWidth: e.target.value as typeof form.bollingerLimitsLineWidth }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
              <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Fina"}</option>
              <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
            </select>
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo bandas"}</span>
            <select value={form.bollingerLimitsLineStyle} onChange={(e) => setForm((p) => ({ ...p, bollingerLimitsLineStyle: e.target.value as typeof form.bollingerLimitsLineStyle }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
              <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Sólido"}</option>
              <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Pontilhado"}</option>
              <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Tracejado"}</option>
            </select>
          </div>
        </>
      )}

      {form.indicatorType === "Keltner" && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).keltnerMaType ?? "Média móvel"}</span>
            <select
              value={form.keltnerMaType}
              onChange={(e) => setForm((prev) => ({ ...prev, keltnerMaType: e.target.value as "SMA" | "EMA" | "WMA" }))}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
            >
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
              <option value="WMA">WMA</option>
            </select>
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
          <div className="flex items-center gap-2 relative">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).keltnerLimitsColor ?? "Cor bandas"}</span>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, keltnerLimitsColorOpen: !prev.keltnerLimitsColorOpen }))}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white flex items-center justify-between gap-2"
              aria-label={(t as Record<string, string>).keltnerLimitsColor ?? "Cor bandas"}
              aria-expanded={form.keltnerLimitsColorOpen}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-4 h-4 rounded border border-zinc-300 shrink-0" style={{ backgroundColor: form.keltnerLimitsColor }} />
              </span>
              <span className="text-zinc-500 text-xs">▾</span>
            </button>
            {form.keltnerLimitsColorOpen && (
              <>
                <div className="fixed inset-0 z-30" aria-hidden onClick={() => setForm((prev) => ({ ...prev, keltnerLimitsColorOpen: false }))} />
                <div className="absolute left-[4.5rem] right-0 top-full z-40 mt-1 max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg p-2">
                  <div className="grid grid-cols-3 gap-2">
                    {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, keltnerLimitsColor: hex, keltnerLimitsColorOpen: false }))}
                        className={`w-10 h-10 rounded border-2 ${form.keltnerLimitsColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                        style={{ backgroundColor: hex }}
                        aria-label={`Color ${hex}`}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura bandas"}</span>
            <select value={form.keltnerLimitsLineWidth} onChange={(e) => setForm((p) => ({ ...p, keltnerLimitsLineWidth: e.target.value as typeof form.keltnerLimitsLineWidth }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
              <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Fina"}</option>
              <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
            </select>
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo bandas"}</span>
            <select value={form.keltnerLimitsLineStyle} onChange={(e) => setForm((p) => ({ ...p, keltnerLimitsLineStyle: e.target.value as typeof form.keltnerLimitsLineStyle }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
              <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Sólido"}</option>
              <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Pontilhado"}</option>
              <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Tracejado"}</option>
            </select>
          </div>
        </>
      )}

      {form.indicatorType === "Donchian" && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).period ?? "Período"}</span>
            <div className="flex-1 min-w-0 flex items-center gap-1">
              <button type="button" onClick={() => setForm((p) => ({ ...p, period: Math.max(1, p.period - 1), periodText: String(Math.max(1, p.period - 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">−</button>
              <input type="text" inputMode="numeric" value={form.periodText} onChange={(e) => setForm((p) => ({ ...p, periodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.periodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 20; setForm((p) => ({ ...p, period: v, periodText: String(v) })); }} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5" />
              <button type="button" onClick={() => setForm((p) => ({ ...p, period: Math.min(500, p.period + 1), periodText: String(Math.min(500, p.period + 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">+</button>
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
              <button type="button" onClick={() => { const v = Math.max(0, (form.donchianBandOpacity ?? 0.2) - 0.05); setForm((p) => ({ ...p, donchianBandOpacity: v, donchianBandOpacityText: String(Math.round(v * 100)) })); }} disabled={(form.donchianBandOpacity ?? 0.2) <= 0} className="w-9 h-9 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">−</button>
              <span className="w-10 text-center text-sm font-mono text-zinc-800 tabular-nums" aria-live="polite">{Math.round((form.donchianBandOpacity ?? 0.2) * 100)}%</span>
              <button type="button" onClick={() => { const v = Math.min(0.3, (form.donchianBandOpacity ?? 0.2) + 0.05); setForm((p) => ({ ...p, donchianBandOpacity: v, donchianBandOpacityText: String(Math.round(v * 100)) })); }} disabled={(form.donchianBandOpacity ?? 0.2) >= 0.3} className="w-9 h-9 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">+</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).donchianLimitsColor ?? "Cor canais"}</span>
            <div className="flex flex-wrap gap-1">
              {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, donchianLimitsColor: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.donchianLimitsColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura"}</span>
            <select value={form.donchianLimitsLineWidth} onChange={(e) => setForm((p) => ({ ...p, donchianLimitsLineWidth: e.target.value as typeof form.donchianLimitsLineWidth }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
              <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Fina"}</option>
              <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
            </select>
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo"}</span>
            <select value={form.donchianLimitsLineStyle} onChange={(e) => setForm((p) => ({ ...p, donchianLimitsLineStyle: e.target.value as typeof form.donchianLimitsLineStyle }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
              <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Sólido"}</option>
              <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Pontilhado"}</option>
              <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Tracejado"}</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).donchianMiddleColor ?? "Cor linha meio"}</span>
            <div className="flex flex-wrap gap-1">
              {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, donchianMiddleColor: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.donchianMiddleColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
              ))}
            </div>
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
            <select
              value={form.sarPointSize}
              onChange={(e) => setForm((prev) => ({ ...prev, sarPointSize: e.target.value as "thin" | "normal" }))}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
            >
              <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Fino"}</option>
              <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
            </select>
          </div>
        </>
      )}

      {form.indicatorType === "MACD" && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdFastMa ?? "Média rápida"}</span>
            <select
              value={form.macdFastMaType}
              onChange={(e) => setForm((prev) => ({ ...prev, macdFastMaType: e.target.value as "SMA" | "EMA" | "WMA" }))}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
            >
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
              <option value="WMA">WMA</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdFastPeriod ?? "Período rápido"}</span>
            <div className="flex-1 min-w-0 flex items-center gap-1">
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, macdFastPeriod: Math.max(1, prev.macdFastPeriod - 1), macdFastPeriodText: String(Math.max(1, prev.macdFastPeriod - 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">−</button>
              <input type="text" inputMode="numeric" value={form.macdFastPeriodText} onChange={(e) => setForm((prev) => ({ ...prev, macdFastPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.macdFastPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 12; setForm((prev) => ({ ...prev, macdFastPeriod: v, macdFastPeriodText: String(v) })); }} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5" />
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, macdFastPeriod: Math.min(500, prev.macdFastPeriod + 1), macdFastPeriodText: String(Math.min(500, prev.macdFastPeriod + 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">+</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdSlowMa ?? "Média lenta"}</span>
            <select
              value={form.macdSlowMaType}
              onChange={(e) => setForm((prev) => ({ ...prev, macdSlowMaType: e.target.value as "SMA" | "EMA" | "WMA" }))}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
            >
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
              <option value="WMA">WMA</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdSlowPeriod ?? "Período lento"}</span>
            <div className="flex-1 min-w-0 flex items-center gap-1">
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, macdSlowPeriod: Math.max(1, prev.macdSlowPeriod - 1), macdSlowPeriodText: String(Math.max(1, prev.macdSlowPeriod - 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">−</button>
              <input type="text" inputMode="numeric" value={form.macdSlowPeriodText} onChange={(e) => setForm((prev) => ({ ...prev, macdSlowPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.macdSlowPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 26; setForm((prev) => ({ ...prev, macdSlowPeriod: v, macdSlowPeriodText: String(v) })); }} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5" />
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, macdSlowPeriod: Math.min(500, prev.macdSlowPeriod + 1), macdSlowPeriodText: String(Math.min(500, prev.macdSlowPeriod + 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">+</button>
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
                <select value={form.macdSignalMaType} onChange={(e) => setForm((prev) => ({ ...prev, macdSignalMaType: e.target.value as "SMA" | "EMA" | "WMA" }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="SMA">SMA</option>
                  <option value="EMA">EMA</option>
                  <option value="WMA">WMA</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdSignalPeriod ?? "Período sinal"}</span>
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, macdSignalPeriod: Math.max(1, prev.macdSignalPeriod - 1), macdSignalPeriodText: String(Math.max(1, prev.macdSignalPeriod - 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">−</button>
                  <input type="text" inputMode="numeric" value={form.macdSignalPeriodText} onChange={(e) => setForm((prev) => ({ ...prev, macdSignalPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.macdSignalPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 9; setForm((prev) => ({ ...prev, macdSignalPeriod: v, macdSignalPeriodText: String(v) })); }} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5" />
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, macdSignalPeriod: Math.min(500, prev.macdSignalPeriod + 1), macdSignalPeriodText: String(Math.min(500, prev.macdSignalPeriod + 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, macdSignalColor: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.macdSignalColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura"}</span>
                <select value={form.macdSignalLineWidth} onChange={(e) => setForm((prev) => ({ ...prev, macdSignalLineWidth: e.target.value as IndicatorLineWidth }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Fina"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo"}</span>
                <select value={form.macdSignalLineStyle} onChange={(e) => setForm((prev) => ({ ...prev, macdSignalLineStyle: e.target.value as IndicatorLineStyle }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Contínuo"}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Pontilhado"}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Tracejado"}</option>
                </select>
              </div>
            </div>
          )}
          {form.macdSignalLine && form.macdHistogram && (
            <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdHistogramColorAbove ?? "Cor acima de 0"}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, macdHistogramColorAbove: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.macdHistogramColorAbove === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).macdHistogramColorBelow ?? "Cor abaixo de 0"}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, macdHistogramColorBelow: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.macdHistogramColorBelow === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {form.indicatorType !== "Ichimoku" && (
        <div className="flex items-center gap-2 relative">
          <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, colorOpen: !prev.colorOpen }))}
            className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white flex items-center justify-between gap-2"
            aria-label={t.color}
            aria-expanded={form.colorOpen}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-4 h-4 rounded border border-zinc-300 shrink-0" style={{ backgroundColor: form.color }} />
            </span>
            <span className="text-zinc-500 text-xs">▾</span>
          </button>
          {form.colorOpen && (
            <>
              <div className="fixed inset-0 z-30" aria-hidden onClick={() => setForm((prev) => ({ ...prev, colorOpen: false }))} />
              <div className="absolute left-[4.5rem] right-0 top-full z-40 mt-1 max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg p-2">
                <div className="grid grid-cols-3 gap-2">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, color: hex, colorOpen: false }))}
                      className={`w-10 h-10 rounded border-2 shrink-0 ${form.color === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300 hover:border-zinc-500"}`}
                      style={{ backgroundColor: hex }}
                      aria-label={`Color ${hex}`}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {(form.indicatorType !== "SAR" && form.indicatorType !== "VWAP" && form.indicatorType !== "Ichimoku") && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Thickness"}</span>
            <select
              value={form.lineWidth}
              onChange={(e) => setForm((prev) => ({ ...prev, lineWidth: e.target.value as IndicatorLineWidth }))}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
              aria-label={(t as Record<string, string>).lineWidth}
            >
              <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Thin"}</option>
              <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Line style"}</span>
            <select
              value={form.lineStyle}
              onChange={(e) => setForm((prev) => ({ ...prev, lineStyle: e.target.value as IndicatorLineStyle }))}
              className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
              aria-label={(t as Record<string, string>).lineStyle}
            >
              <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Solid"}</option>
              <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Dotted"}</option>
              <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Dashed"}</option>
            </select>
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
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, stochLimitUpper: Math.max(0, Math.min(100, prev.stochLimitUpper - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                  <span className="w-10 text-center text-sm tabular-nums">{form.stochLimitUpper}</span>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, stochLimitUpper: Math.max(0, Math.min(100, prev.stochLimitUpper + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).stochLimitLowerLabel ?? "Inferior %"}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, stochLimitLower: Math.max(0, Math.min(100, prev.stochLimitLower - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                  <span className="w-10 text-center text-sm tabular-nums">{form.stochLimitLower}</span>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, stochLimitLower: Math.max(0, Math.min(100, prev.stochLimitLower + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, stochLimitColor: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.stochLimitColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura"}</span>
                <select value={form.stochLimitLineWidth} onChange={(e) => setForm((prev) => ({ ...prev, stochLimitLineWidth: e.target.value as IndicatorLineWidth }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Fina"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo"}</span>
                <select value={form.stochLimitLineStyle} onChange={(e) => setForm((prev) => ({ ...prev, stochLimitLineStyle: e.target.value as IndicatorLineStyle }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Contínuo"}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Pontilhado"}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Tracejado"}</option>
                </select>
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
                <select value={form.stochDMaType} onChange={(e) => setForm((prev) => ({ ...prev, stochDMaType: e.target.value as "SMA" | "EMA" | "WMA" }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="SMA">SMA</option>
                  <option value="EMA">EMA</option>
                  <option value="WMA">WMA</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).stochDPeriodLabel ?? "Período %D"}</span>
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, stochDPeriod: Math.max(1, prev.stochDPeriod - 1), stochDPeriodText: String(Math.max(1, prev.stochDPeriod - 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">−</button>
                  <input type="text" inputMode="numeric" value={form.stochDPeriodText} onChange={(e) => setForm((prev) => ({ ...prev, stochDPeriodText: e.target.value.replace(/[^\d]/g, "") }))} onBlur={() => { const n = Number(form.stochDPeriodText); const v = Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(500, Math.round(n))) : 3; setForm((prev) => ({ ...prev, stochDPeriod: v, stochDPeriodText: String(v) })); }} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5" />
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, stochDPeriod: Math.min(500, prev.stochDPeriod + 1), stochDPeriodText: String(Math.min(500, prev.stochDPeriod + 1)) }))} className="w-9 h-9 flex items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, stochDColor: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.stochDColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura"}</span>
                <select value={form.stochDLineWidth} onChange={(e) => setForm((prev) => ({ ...prev, stochDLineWidth: e.target.value as IndicatorLineWidth }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Fina"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo"}</span>
                <select value={form.stochDLineStyle} onChange={(e) => setForm((prev) => ({ ...prev, stochDLineStyle: e.target.value as IndicatorLineStyle }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Contínuo"}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Pontilhado"}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Tracejado"}</option>
                </select>
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
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, williamsRLimitUpper: Math.max(-100, Math.min(0, prev.williamsRLimitUpper - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                  <span className="w-10 text-center text-sm tabular-nums">{form.williamsRLimitUpper}</span>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, williamsRLimitUpper: Math.max(-100, Math.min(0, prev.williamsRLimitUpper + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).williamsRLimitLowerLabel ?? "Inferior"}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, williamsRLimitLower: Math.max(-100, Math.min(0, prev.williamsRLimitLower - 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">−</button>
                  <span className="w-10 text-center text-sm tabular-nums">{form.williamsRLimitLower}</span>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, williamsRLimitLower: Math.max(-100, Math.min(0, prev.williamsRLimitLower + 1)) }))} className="w-8 h-8 rounded border border-zinc-300 bg-white text-zinc-600">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{t.color}</span>
                <div className="flex flex-wrap gap-1">
                  {INDICATOR_COLOR_PALETTE.map((hex: string) => (
                    <button key={hex} type="button" onClick={() => setForm((prev) => ({ ...prev, williamsRLimitColor: hex }))} className={`w-6 h-6 rounded border shrink-0 ${form.williamsRLimitColor === hex ? "border-zinc-900 ring-1 ring-zinc-400" : "border-zinc-300"}`} style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineWidth ?? "Espessura"}</span>
                <select value={form.williamsRLimitLineWidth} onChange={(e) => setForm((prev) => ({ ...prev, williamsRLimitLineWidth: e.target.value as IndicatorLineWidth }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="thin">{(t as Record<string, string>).lineWidthThin ?? "Fina"}</option>
                  <option value="normal">{(t as Record<string, string>).lineWidthNormal ?? "Normal"}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 w-16 shrink-0">{(t as Record<string, string>).lineStyle ?? "Estilo"}</span>
                <select value={form.williamsRLimitLineStyle} onChange={(e) => setForm((prev) => ({ ...prev, williamsRLimitLineStyle: e.target.value as IndicatorLineStyle }))} className="flex-1 min-w-0 text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="solid">{(t as Record<string, string>).lineStyleSolid ?? "Contínuo"}</option>
                  <option value="dotted">{(t as Record<string, string>).lineStyleDotted ?? "Pontilhado"}</option>
                  <option value="dashed">{(t as Record<string, string>).lineStyleDashed ?? "Tracejado"}</option>
                </select>
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
    </div>
  );
}
