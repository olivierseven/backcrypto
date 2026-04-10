"use client";

import { useMemo, useEffect } from "react";
import type {
  UserIndicatorConfig,
  UserIndicatorType,
  IndicatorFieldKey,
} from "../KlinesIndicatorsContext";
import { getIndicatorLabel, isIndicatorVisibleForGroupMinutes, isMovingAverageType } from "./indicatorsPanelUtils";
import type { KlinesT } from "./indicatorsPanelUtils";

export type FieldOption = {
  value: IndicatorFieldKey;
  label: string;
  disabled?: boolean;
  isMovingAverage?: boolean;
  optionType?: UserIndicatorType;
};

export interface UseIndicatorsPanelFieldsParams<TEditForm extends { fieldKey: IndicatorFieldKey } = { fieldKey: IndicatorFieldKey }> {
  userIndicators: UserIndicatorConfig[];
  editingId: string | null;
  indicatorType: UserIndicatorType;
  t: KlinesT;
  fieldKey: IndicatorFieldKey;
  editForm: TEditForm | null;
  setFieldKey: (v: IndicatorFieldKey) => void;
  /** setState do editForm do parent; o efeito atualiza apenas fieldKey (spread prev + fieldKey). */
  setEditForm: React.Dispatch<React.SetStateAction<TEditForm | null>>;
  /** Timeframe do gráfico: opções `user_<id>` só incluem indicadores ativos neste intervalo (como na tabela). `null` = ainda sem TF (mesma regra que a lista de indicadores). */
  currentGroupMinutes: number | null;
}

function parseUserFieldRefId(fieldKey: IndicatorFieldKey): string | null {
  if (typeof fieldKey !== "string" || !fieldKey.startsWith("user_")) return null;
  const raw = fieldKey.slice(5);
  const sep = raw.indexOf(":");
  return sep < 0 ? raw : raw.slice(0, sep);
}

export function useIndicatorsPanelFields<TEditForm extends { fieldKey: IndicatorFieldKey }>({
  userIndicators,
  editingId,
  indicatorType,
  t,
  fieldKey,
  editForm,
  setFieldKey,
  setEditForm,
  currentGroupMinutes,
}: UseIndicatorsPanelFieldsParams<TEditForm>) {
  const usedOutputIds = useMemo(() => {
    const ids = new Set<string>();
    userIndicators.forEach((ind) => {
      if (ind.id === editingId) return;
      const mainRef = parseUserFieldRefId(ind.fieldKey);
      if (mainRef) ids.add(mainRef);
      const firstRef = ind.type === "DIFF" ? parseUserFieldRefId(ind.diffFirstFieldKey ?? "close") : null;
      if (firstRef) ids.add(firstRef);
      const secondRef = ind.type === "DIFF" ? parseUserFieldRefId(ind.diffSecondFieldKey ?? ind.fieldKey) : null;
      if (secondRef) ids.add(secondRef);
    });
    return ids;
  }, [userIndicators, editingId]);

  const fieldOptions = useMemo(() => {
    const base: FieldOption[] = [
      { value: "open", label: (t as Record<string, string>).fieldOpen ?? "Open" },
      { value: "high", label: (t as Record<string, string>).fieldHigh ?? "High" },
      { value: "low", label: (t as Record<string, string>).fieldLow ?? "Low" },
      { value: "close", label: (t as Record<string, string>).fieldClose ?? "Close" },
      { value: "volume", label: (t as Record<string, string>).fieldVol ?? "Vol" },
      { value: "volumeUsdt", label: (t as Record<string, string>).fieldVolUsdt ?? "Vol (USDT)" },
      { value: "HL2", label: (t as Record<string, string>).fieldHL2 ?? "HL2" },
      { value: "HLC3", label: (t as Record<string, string>).fieldHLC3 ?? "HLC3" },
      { value: "OHLC4", label: (t as Record<string, string>).fieldOHLC4 ?? "OHLC4" },
      { value: "HLCC4", label: (t as Record<string, string>).fieldHLCC4 ?? "HLCC4" },
    ];
    userIndicators.forEach((u) => {
      if (currentGroupMinutes == null) {
        if (u.intervals.length === 1 && u.intervals[0] === 0) return;
      } else if (!isIndicatorVisibleForGroupMinutes(u, currentGroupMinutes)) {
        return;
      }
      const outputUsed = usedOutputIds.has(String(u.id));
      const inputUsed = (() => {
        const ref = parseUserFieldRefId(u.fieldKey);
        return ref != null && usedOutputIds.has(ref);
      })();
      const disabled = outputUsed || inputUsed;
      const pushOpt = (value: string, label: string) =>
        base.push({
          value: value as IndicatorFieldKey,
          label,
          disabled,
          isMovingAverage: isMovingAverageType(u.type),
          optionType: u.type,
        });
      const baseLabel = getIndicatorLabel(u, t, userIndicators);
      const tx = t as Record<string, string>;
      pushOpt(`user_${String(u.id)}`, baseLabel);
      if (u.type === "Bollinger") {
        if (u.bollingerShowUpper !== false) pushOpt(`user_${u.id}:upper`, `${baseLabel} (${tx.regressionBollingerUpper ?? "Upper"})`);
        if (u.bollingerShowMiddle === true) pushOpt(`user_${u.id}:middle`, `${baseLabel} (${tx.regressionBollingerMiddle ?? "Middle"})`);
        if (u.bollingerShowLower !== false) pushOpt(`user_${u.id}:lower`, `${baseLabel} (${tx.regressionBollingerLower ?? "Lower"})`);
      } else if (u.type === "Keltner") {
        if (u.keltnerShowUpper !== false) pushOpt(`user_${u.id}:upper`, `${baseLabel} (${tx.regressionKeltnerUpper ?? "Upper"})`);
        if (u.keltnerShowMiddle === true) pushOpt(`user_${u.id}:middle`, `${baseLabel} (${tx.regressionKeltnerMiddle ?? "Middle"})`);
        if (u.keltnerShowLower !== false) pushOpt(`user_${u.id}:lower`, `${baseLabel} (${tx.regressionKeltnerLower ?? "Lower"})`);
      } else if (u.type === "Donchian") {
        if (u.donchianShowUpper !== false) pushOpt(`user_${u.id}:upper`, `${baseLabel} (${tx.regressionDonchianUpper ?? "Upper"})`);
        if (u.donchianShowMiddle === true) pushOpt(`user_${u.id}:middle`, `${baseLabel} (${tx.regressionDonchianMiddle ?? "Middle"})`);
        if (u.donchianShowLower !== false) pushOpt(`user_${u.id}:lower`, `${baseLabel} (${tx.regressionDonchianLower ?? "Lower"})`);
      } else if (u.type === "ADX") {
        pushOpt(`user_${u.id}:plusDi`, `${baseLabel} (+DI)`);
        pushOpt(`user_${u.id}:minusDi`, `${baseLabel} (-DI)`);
        pushOpt(`user_${u.id}:adx`, `${baseLabel} (ADX)`);
      } else if (u.type === "Ichimoku") {
        if (u.ichimokuShowTenkan !== false) pushOpt(`user_${u.id}:tenkan`, `${baseLabel} (Tenkan)`);
        if (u.ichimokuShowKijun !== false) pushOpt(`user_${u.id}:kijun`, `${baseLabel} (Kijun)`);
        if (u.ichimokuShowSpanA !== false) pushOpt(`user_${u.id}:spanA`, `${baseLabel} (Span A)`);
        if (u.ichimokuShowSpanB !== false) pushOpt(`user_${u.id}:spanB`, `${baseLabel} (Span B)`);
        if (u.ichimokuShowChikou === true) pushOpt(`user_${u.id}:chikou`, `${baseLabel} (Chikou)`);
      } else if (u.type === "MACD") {
        if (u.macdSignalLine) pushOpt(`user_${u.id}:signal`, `${baseLabel} (${tx.macdSignalLabel?.replace("{period}", String(u.macdSignalPeriod ?? 9)) ?? `Signal(${u.macdSignalPeriod ?? 9})`})`);
        if (u.macdHistogram) pushOpt(`user_${u.id}:hist`, `${baseLabel} (${tx.macdHistogramLabel ?? "Histogram"})`);
      } else if (u.type === "DIFF") {
        if (u.diffSignalLine) pushOpt(`user_${u.id}:signal`, `${baseLabel} (${tx.diffSignalLabel?.replace("{period}", String(u.diffSignalPeriod ?? 9)) ?? `Signal(${u.diffSignalPeriod ?? 9})`})`);
        if (u.diffHistogram) pushOpt(`user_${u.id}:hist`, `${baseLabel} (${tx.macdHistogramLabel ?? "Histogram"})`);
      } else if (u.type === "Stochastic" && u.stochDLine) {
        pushOpt(`user_${u.id}:d`, `${baseLabel} (%D)`);
      }
    });
    return base;
  }, [t, userIndicators, editingId, usedOutputIds, currentGroupMinutes]);

  const firstEnabledFieldValue = useMemo(
    () => (fieldOptions.find((o) => !o.disabled)?.value ?? "close") as IndicatorFieldKey,
    [fieldOptions]
  );

  const firstEnabledFieldValueForAdd = useMemo(
    () =>
      (fieldOptions.find(
        (o) =>
          !o.disabled &&
          o.optionType !== indicatorType &&
          !(o.isMovingAverage && isMovingAverageType(indicatorType))
      )?.value ?? firstEnabledFieldValue) as IndicatorFieldKey,
    [fieldOptions, indicatorType, firstEnabledFieldValue]
  );

  const fieldOptionsVisibleForAdd = useMemo(
    () =>
      fieldOptions.filter(
        (o) =>
          !o.disabled &&
          o.optionType !== indicatorType &&
          !(o.isMovingAverage && isMovingAverageType(indicatorType))
      ),
    [fieldOptions, indicatorType]
  );

  useEffect(() => {
    const sel = fieldOptions.find((o) => o.value === fieldKey);
    const missingUserSeries =
      typeof fieldKey === "string" && fieldKey.startsWith("user_") && !sel;
    const disabled =
      missingUserSeries ||
      sel?.disabled ||
      Boolean(sel?.isMovingAverage && isMovingAverageType(indicatorType)) ||
      sel?.optionType === indicatorType;
    if (disabled) setFieldKey(firstEnabledFieldValueForAdd);
  }, [fieldOptions, firstEnabledFieldValueForAdd, fieldKey, indicatorType, setFieldKey]);

  useEffect(() => {
    if (!editingId || !editForm) return;
    const editingType = userIndicators.find((i) => i.id === editingId)?.type;
    if (!editingType) return;
    const visibleForEdit = fieldOptions.filter(
      (o) =>
        !o.disabled &&
        o.optionType !== editingType &&
        !(o.isMovingAverage && isMovingAverageType(editingType))
    );
    const firstForEdit = (visibleForEdit[0]?.value ?? firstEnabledFieldValue) as IndicatorFieldKey;
    if (!visibleForEdit.some((o) => o.value === editForm.fieldKey)) {
      setEditForm((f) => (f ? ({ ...f, fieldKey: firstForEdit } as TEditForm) : f));
    }
  }, [
    editingId,
    editForm?.fieldKey,
    fieldOptions,
    userIndicators,
    firstEnabledFieldValue,
    setEditForm,
  ]);

  return {
    fieldOptions,
    firstEnabledFieldValue,
    firstEnabledFieldValueForAdd,
    fieldOptionsVisibleForAdd,
    isMovingAverageType,
  };
}
