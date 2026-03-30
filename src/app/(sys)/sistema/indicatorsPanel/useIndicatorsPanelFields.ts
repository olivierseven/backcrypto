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
      const fk = ind.fieldKey;
      if (typeof fk === "string" && fk.startsWith("user_")) ids.add(fk.slice(5));
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
      const key = `user_${String(u.id)}` as IndicatorFieldKey;
      const outputUsed = usedOutputIds.has(String(u.id));
      const inputUsed =
        typeof u.fieldKey === "string" &&
        u.fieldKey.startsWith("user_") &&
        usedOutputIds.has(u.fieldKey.slice(5));
      base.push({
        value: key,
        label: getIndicatorLabel(u, t, userIndicators),
        disabled: outputUsed || inputUsed,
        isMovingAverage: isMovingAverageType(u.type),
        optionType: u.type,
      });
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
