import { getBioT } from "@/app/lib/translations";
import type { UserIndicatorConfig, IndicatorFieldKey } from "../KlinesIndicatorsContext";

export type KlinesT = ReturnType<typeof getBioT>["sistema"]["klines"];

export function getFieldLabel(
  fieldKey: IndicatorFieldKey,
  t: KlinesT,
  userIndicators: UserIndicatorConfig[]
): string {
  const k = t as Record<string, string>;
  if (fieldKey === "open") return k.fieldOpen ?? "Open";
  if (fieldKey === "high") return k.fieldHigh ?? "High";
  if (fieldKey === "low") return k.fieldLow ?? "Low";
  if (fieldKey === "close") return k.fieldClose ?? "Close";
  if (fieldKey === "volume") return k.fieldVol ?? "Vol";
  if (fieldKey.startsWith("user_")) {
    const u = userIndicators.find((i) => i.id === fieldKey.slice(5));
    if (u) return `${u.type}(${u.period}) ${getFieldLabel(u.fieldKey, t, userIndicators)}`;
  }
  return String(fieldKey);
}

export function getIndicatorLabel(
  ind: UserIndicatorConfig,
  t: KlinesT,
  userIndicators: UserIndicatorConfig[]
): string {
  const fieldLabel = getFieldLabel(ind.fieldKey, t, userIndicators);
  if (ind.type === "MACD") {
    const fast = ind.macdFastPeriod ?? 12;
    const slow = ind.macdSlowPeriod ?? 26;
    return `MACD(${fast},${slow}) ${fieldLabel}`;
  }
  if (ind.type === "Stochastic") {
    return `Stoch %K(${ind.period}) ${fieldLabel}`;
  }
  if (ind.type === "OBV") {
    return `OBV ${fieldLabel}`;
  }
  if (ind.type === "SAR") {
    const start = ind.sarStart ?? 0.02;
    const inc = ind.sarIncrement ?? 0.02;
    const max = ind.sarMax ?? 0.2;
    return `SAR(${start}, ${inc}, ${max})`;
  }
  if (ind.type === "ATR") {
    return `ATR(${ind.period})`;
  }
  if (ind.type === "VWAP") {
    return "VWAP";
  }
  if (ind.type === "Bollinger") {
    const z = ind.bollingerZ ?? 2;
    return `Bollinger(${ind.period}) Z=${z} ${fieldLabel}`;
  }
  return `${ind.type}(${ind.period}) ${fieldLabel}`;
}

/** Uma letra para o campo: O, H, L, C, V (para uso no display sobreposto do gráfico). */
export function getFieldShortLetter(
  fieldKey: IndicatorFieldKey,
  userIndicators: UserIndicatorConfig[]
): string {
  if (fieldKey === "open") return "O";
  if (fieldKey === "high") return "H";
  if (fieldKey === "low") return "L";
  if (fieldKey === "close") return "C";
  if (fieldKey === "volume") return "V";
  if (fieldKey.startsWith("user_")) {
    const u = userIndicators.find((i) => i.id === fieldKey.slice(5));
    if (u) return getFieldShortLetter(u.fieldKey, userIndicators);
  }
  return String(fieldKey).charAt(0).toUpperCase();
}

export function getIndicatorLabelShort(
  ind: UserIndicatorConfig,
  userIndicators: UserIndicatorConfig[]
): string {
  const letter = getFieldShortLetter(ind.fieldKey, userIndicators);
  if (ind.type === "MACD") {
    const fast = ind.macdFastPeriod ?? 12;
    const slow = ind.macdSlowPeriod ?? 26;
    return `MACD(${fast},${slow}) ${letter}`;
  }
  if (ind.type === "Stochastic") {
    return `%K(${ind.period}) ${letter}`;
  }
  if (ind.type === "OBV") {
    return `OBV ${letter}`;
  }
  if (ind.type === "SAR") {
    return "SAR";
  }
  if (ind.type === "ATR") {
    return `ATR(${ind.period})`;
  }
  if (ind.type === "VWAP") {
    return "VWAP";
  }
  if (ind.type === "Bollinger") {
    const z = ind.bollingerZ ?? 2;
    return `BB(${ind.period}) Z=${z} ${letter}`;
  }
  return `${ind.type}(${ind.period}) ${letter}`;
}

/** Rótulo da linha de sinal do MACD (ex.: "MACD Signal(9)"). */
export function getIndicatorLabelSignal(
  ind: UserIndicatorConfig,
  t: KlinesT
): string {
  const period = ind.macdSignalPeriod ?? 9;
  const k = t as Record<string, string>;
  const template = k.macdSignalLabel ?? "MACD Signal({period})";
  return template.replace("{period}", String(period));
}

/** Rótulo curto da linha de sinal (ex.: "MACD Sig(9)"). */
export function getIndicatorLabelShortSignal(ind: UserIndicatorConfig): string {
  const period = ind.macdSignalPeriod ?? 9;
  return `MACD Sig(${period})`;
}

/** Rótulo da linha %D do Stochastic (ex.: "Stoch %D(3)"). */
export function getIndicatorLabelStochD(ind: UserIndicatorConfig, t: KlinesT): string {
  const period = ind.stochDPeriod ?? 3;
  const k = t as Record<string, string>;
  const template = k.stochDLabel ?? "Stoch %D({period})";
  return template.replace("{period}", String(period));
}

/** Rótulo curto da linha %D (ex.: "%D(3)"). */
export function getIndicatorLabelShortStochD(ind: UserIndicatorConfig): string {
  const period = ind.stochDPeriod ?? 3;
  return `%D(${period})`;
}

export function isMovingAverageType(type: string): boolean {
  return type === "SMA" || type === "EMA" || type === "WMA";
}
