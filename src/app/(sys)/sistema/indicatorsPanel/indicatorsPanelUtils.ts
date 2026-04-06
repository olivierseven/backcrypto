import { getCryptoT } from "@/app/lib/translations";
import type { UserIndicatorConfig, IndicatorFieldKey, Wma2TimeUnit } from "../KlinesIndicatorsContext";
import { clampMa2TimeWindowUserValue, defaultMa2TimeValueForUnit, isTimeWindowMa2Type, normalizeMa2TimeValueForUnit } from "./wma2Period";

export type KlinesT = ReturnType<typeof getCryptoT>["sistema"]["klines"];

function wma2WindowValue(ind: UserIndicatorConfig): { unit: Wma2TimeUnit; value: number } {
  const unit: Wma2TimeUnit =
    ind.wma2TimeUnit === "days" || ind.wma2TimeUnit === "hours" || ind.wma2TimeUnit === "minutes" ? ind.wma2TimeUnit : "hours";
  const raw =
    typeof ind.wma2TimeValue === "number" && Number.isFinite(ind.wma2TimeValue)
      ? clampMa2TimeWindowUserValue(ind.wma2TimeValue)
      : defaultMa2TimeValueForUnit(unit);
  const value = normalizeMa2TimeValueForUnit(unit, raw);
  return { unit, value };
}

function formatWma2WindowLong(ind: UserIndicatorConfig, t: KlinesT): string {
  const { unit, value } = wma2WindowValue(ind);
  const k = t as Record<string, string>;
  if (unit === "days") return (k.wma2WindowDays ?? "{n} days").replace("{n}", String(value));
  if (unit === "hours") return (k.wma2WindowHours ?? "{n} hours").replace("{n}", String(value));
  return (k.wma2WindowMinutes ?? "{n} minutes").replace("{n}", String(value));
}

function formatWma2WindowCompact(ind: UserIndicatorConfig): string {
  const { unit, value } = wma2WindowValue(ind);
  if (unit === "days") return `${value}d`;
  if (unit === "hours") return `${value}h`;
  return `${value}m`;
}

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
  if (fieldKey === "volumeUsdt") return k.fieldVolUsdt ?? "Vol (USDT)";
  if (fieldKey === "HL2") return k.fieldHL2 ?? "HL2";
  if (fieldKey === "HLC3") return k.fieldHLC3 ?? "HLC3";
  if (fieldKey === "OHLC4") return k.fieldOHLC4 ?? "OHLC4";
  if (fieldKey === "HLCC4") return k.fieldHLCC4 ?? "HLCC4";
  if (fieldKey.startsWith("user_")) {
    const u = userIndicators.find((i) => i.id === fieldKey.slice(5));
    if (u) {
      const p = isTimeWindowMa2Type(u.type)
        ? formatWma2WindowLong(u, t)
        : u.type === "HMA_CUSTOM"
          ? `${u.hmaCustomFastPeriod ?? 10},${u.hmaCustomLongPeriod ?? u.period ?? 20},${u.hmaCustomSmoothPeriod ?? 4},${u.hmaCustomFastMaType ?? "WMA"},${u.hmaCustomLongMaType ?? "WMA"},${u.hmaCustomSmoothMaType ?? "WMA"}`
          : String(u.period);
      return `${u.type}(${p}) ${getFieldLabel(u.fieldKey, t, userIndicators)}`;
    }
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
  if (ind.type === "WilliamsR") {
    return `Williams %R(${ind.period}) ${fieldLabel}`;
  }
  if (ind.type === "OBV") {
    return `OBV ${fieldLabel}`;
  }
  if (ind.type === "AD") {
    return "A/D";
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
    return `BB(${ind.period},${z}) ${fieldLabel}`;
  }
  if (ind.type === "Keltner") {
    const mult = typeof ind.keltnerMultiplier === "number" ? ind.keltnerMultiplier : 2;
    return `KC(${ind.period},${mult}) ${fieldLabel}`;
  }
  if (ind.type === "Donchian") {
    return `DC(${ind.period}) ${fieldLabel}`;
  }
  if (ind.type === "Ichimoku") {
    const t = ind.ichimokuTenkanPeriod ?? 9;
    const k = ind.ichimokuKijunPeriod ?? 26;
    const b = ind.ichimokuSpanBPeriod ?? 52;
    return `Ichimoku(${t}/${k}/${b})`;
  }
  if (ind.type === "Volume") {
    return ind.volumeInUsdt ? (typeof (t as Record<string, string>).volumeUsdtLabel === "string" ? (t as Record<string, string>).volumeUsdtLabel : "Volume (USDT)") : (typeof (t as Record<string, string>).volumeLabel === "string" ? (t as Record<string, string>).volumeLabel : "Volume");
  }
  if (ind.type === "ADX") {
    return `ADX(${ind.period})`;
  }
  if (ind.type === "CCI") {
    return `CCI(${ind.period}) ${fieldLabel}`;
  }
  if (ind.type === "CMF") {
    return `CMF(${ind.period})`;
  }
  if (ind.type === "MFI") {
    return `MFI(${ind.period})`;
  }
  if (ind.type === "HMA_CUSTOM") {
    const sm = ind.hmaCustomSmoothPeriod ?? 4;
    const fa = ind.hmaCustomFastPeriod ?? 10;
    const lo = ind.hmaCustomLongPeriod ?? ind.period ?? 20;
    const short = (t as Record<string, string>).hmaCustomShortLabel ?? "HMA*";
    const ft = ind.hmaCustomFastMaType ?? "WMA";
    const lt = ind.hmaCustomLongMaType ?? "WMA";
    const st = ind.hmaCustomSmoothMaType ?? "WMA";
    const typesExtra = ft === "WMA" && lt === "WMA" && st === "WMA" ? "" : ` · ${ft}/${lt}/${st}`;
    return `${short}(${fa},${lo},${sm})${typesExtra} ${fieldLabel}`;
  }
  if (isTimeWindowMa2Type(ind.type)) {
    return `${ind.type}(${formatWma2WindowLong(ind, t)}) ${fieldLabel}`;
  }
  if (ind.type === "LINEAR_FIT") {
    const k = t as Record<string, string>;
    return `${k.linearFitLabel ?? "Ajuste Linear"}(${ind.period}) ${fieldLabel}`;
  }
  if (ind.type === "QUADRATIC_FIT") {
    const k = t as Record<string, string>;
    return `${k.quadraticFitLabel ?? "Ajuste quadrático"}(${ind.period}) ${fieldLabel}`;
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
  if (fieldKey === "volumeUsdt") return "U";
  if (fieldKey === "HL2") return "2";
  if (fieldKey === "HLC3") return "3";
  if (fieldKey === "OHLC4") return "4";
  if (fieldKey === "HLCC4") return "C"; // (H+L+2*C)/4
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
  if (ind.type === "WilliamsR") {
    return `%R(${ind.period}) ${letter}`;
  }
  if (ind.type === "OBV") {
    return `OBV ${letter}`;
  }
  if (ind.type === "AD") {
    return "A/D";
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
    return `BB(${ind.period},${z}) ${letter}`;
  }
  if (ind.type === "Keltner") {
    const mult = typeof ind.keltnerMultiplier === "number" ? ind.keltnerMultiplier : 2;
    return `KC(${ind.period},${mult}) ${letter}`;
  }
  if (ind.type === "Donchian") {
    return `DC(${ind.period}) ${letter}`;
  }
  if (ind.type === "Ichimoku") {
    return `Ichimoku(${ind.ichimokuTenkanPeriod ?? 9}/${ind.ichimokuKijunPeriod ?? 26})`;
  }
  if (ind.type === "ADX") {
    return `ADX(${ind.period})`;
  }
  if (ind.type === "CCI") {
    return `CCI(${ind.period}) ${letter}`;
  }
  if (ind.type === "CMF") {
    return `CMF(${ind.period})`;
  }
  if (ind.type === "Volume") {
    return ind.volumeInUsdt ? "Vol USDT" : "Vol";
  }
  if (ind.type === "MFI") {
    return `MFI(${ind.period})`;
  }
  if (ind.type === "HMA_CUSTOM") {
    const sm = ind.hmaCustomSmoothPeriod ?? 4;
    const fa = ind.hmaCustomFastPeriod ?? 10;
    const lo = ind.hmaCustomLongPeriod ?? ind.period ?? 20;
    const ft = ind.hmaCustomFastMaType ?? "WMA";
    const lt = ind.hmaCustomLongMaType ?? "WMA";
    const st = ind.hmaCustomSmoothMaType ?? "WMA";
    const typesExtra = ft === "WMA" && lt === "WMA" && st === "WMA" ? "" : ` · ${ft}/${lt}/${st}`;
    return `HMA*(${fa},${lo},${sm})${typesExtra} ${letter}`;
  }
  if (ind.type === "LINEAR_FIT") {
    return `Lin(${ind.period}) ${letter}`;
  }
  if (ind.type === "QUADRATIC_FIT") {
    return `Quad(${ind.period}) ${letter}`;
  }
  if (isTimeWindowMa2Type(ind.type)) {
    return `${ind.type}(${formatWma2WindowCompact(ind)}) ${letter}`;
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

/** Mesma regra que a tabela/gráfico: indicador visível neste `groupMinutes` (intervalos vazio = todos). */
export function isIndicatorVisibleForGroupMinutes(ind: UserIndicatorConfig, groupMinutes: number): boolean {
  if (ind.intervals.length === 1 && ind.intervals[0] === 0) return false;
  if (ind.intervals.length === 0) return true;
  return ind.intervals.includes(groupMinutes);
}

/**
 * Indicador entra no limite de painel (7 main / 3 sec.) para o timeframe atual.
 * Exclui «nenhum intervalo»; com `currentGroupMinutes` só conta os ativos nesse tempo (como a lista «deste tempo»).
 */
export function indicatorAppliesToCurrentChartTimeframe(
  ind: UserIndicatorConfig,
  currentGroupMinutes: number | null
): boolean {
  if (ind.intervals.length === 1 && ind.intervals[0] === 0) return false;
  if (currentGroupMinutes == null) return true;
  return isIndicatorVisibleForGroupMinutes(ind, currentGroupMinutes);
}

export function isMovingAverageType(type: string): boolean {
  return (
    type === "SMA" ||
    type === "SMA2" ||
    type === "EMA" ||
    type === "EMA2" ||
    type === "WMA" ||
    type === "WMA2" ||
    type === "HMA" ||
    type === "HMA_CUSTOM" ||
    type === "VWMA" ||
    type === "LINEAR_FIT" ||
    type === "QUADRATIC_FIT"
  );
}
