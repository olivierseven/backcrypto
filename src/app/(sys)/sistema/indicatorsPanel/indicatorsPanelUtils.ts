import { getCryptoT } from "@/app/lib/translations";
import type { UserIndicatorConfig, IndicatorFieldKey, Wma2TimeUnit } from "../KlinesIndicatorsContext";
import { clampMa2TimeWindowUserValue, defaultMa2TimeValueForUnit, isTimeWindowMa2Type, normalizeMa2TimeValueForUnit } from "./wma2Period";

export type KlinesT = ReturnType<typeof getCryptoT>["sistema"]["klines"];

function parseUserFieldRef(fieldKey: IndicatorFieldKey): { id: string; part: string | null } | null {
  if (!fieldKey.startsWith("user_")) return null;
  const raw = fieldKey.slice(5);
  const sep = raw.indexOf(":");
  if (sep < 0) return { id: raw, part: null };
  return { id: raw.slice(0, sep), part: raw.slice(sep + 1) || null };
}

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
  const ref = parseUserFieldRef(fieldKey);
  if (ref != null) {
    const u = userIndicators.find((i) => i.id === ref.id);
    if (u) {
      const partLabel = (() => {
        if (!ref.part) return "";
        const kk = t as Record<string, string>;
        if (ref.part === "upper") return ` (${kk.regressionBollingerUpper ?? "Upper"})`;
        if (ref.part === "middle") return ` (${kk.regressionBollingerMiddle ?? "Middle"})`;
        if (ref.part === "lower") return ` (${kk.regressionBollingerLower ?? "Lower"})`;
        if (ref.part === "signal" || ref.part === "sig") return ` (${kk.macdSignalLabel?.replace("{period}", String(u.macdSignalPeriod ?? u.diffSignalPeriod ?? 9)) ?? "Signal"})`;
        if (ref.part === "hist" || ref.part === "histogram") return ` (${kk.macdHistogramLabel ?? "Histogram"})`;
        if (ref.part === "d") return " (%D)";
        if (ref.part === "plusDi") return " (+DI)";
        if (ref.part === "minusDi") return " (-DI)";
        if (ref.part === "adx") return " (ADX)";
        if (ref.part === "tenkan") return " (Tenkan)";
        if (ref.part === "kijun") return " (Kijun)";
        if (ref.part === "spanA") return " (Span A)";
        if (ref.part === "spanB") return " (Span B)";
        if (ref.part === "chikou") return " (Chikou)";
        return ` (${ref.part})`;
      })();
      const p = isTimeWindowMa2Type(u.type)
        ? formatWma2WindowLong(u, t)
        : u.type === "HMA_CUSTOM"
          ? `${u.hmaCustomFastPeriod ?? 10},${u.hmaCustomLongPeriod ?? u.period ?? 20},${u.hmaCustomSmoothPeriod ?? 4},${u.hmaCustomFastMaType ?? "WMA"},${u.hmaCustomLongMaType ?? "WMA"},${u.hmaCustomSmoothMaType ?? "WMA"}`
          : String(u.period);
      return `${u.type}(${p}) ${getFieldLabel(u.fieldKey, t, userIndicators)}${partLabel}`;
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
  if (ind.type === "DIFF") {
    const first = getFieldLabel(ind.diffFirstFieldKey ?? "close", t, userIndicators);
    const second = getFieldLabel(ind.diffSecondFieldKey ?? ind.fieldKey ?? "close", t, userIndicators);
    if (ind.diffRelativePercent) {
      return `DIFF%(${second}-${first})/${first}`;
    }
    return `DIFF(${second}-${first})`;
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
  if (ind.type === "MA_ANGLE") {
    const mt = ind.maAngleMaType === "SMA" || ind.maAngleMaType === "EMA" || ind.maAngleMaType === "WMA" || ind.maAngleMaType === "HMA" || ind.maAngleMaType === "VWMA" ? ind.maAngleMaType : "EMA";
    const lb = ind.maAngleLookback ?? 3;
    return `MA∠(${mt},${ind.period},L${lb}) ${fieldLabel}`;
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
  const ref = parseUserFieldRef(fieldKey);
  if (ref != null) {
    const u = userIndicators.find((i) => i.id === ref.id);
    if (u) {
      const base = getFieldShortLetter(u.fieldKey, userIndicators);
      if (!ref.part) return base;
      if (ref.part === "upper") return "U";
      if (ref.part === "middle") return "M";
      if (ref.part === "lower") return "L";
      if (ref.part === "signal" || ref.part === "sig") return "S";
      if (ref.part === "hist" || ref.part === "histogram") return "H";
      if (ref.part === "d") return "D";
      if (ref.part === "plusDi") return "+";
      if (ref.part === "minusDi") return "-";
      if (ref.part === "adx") return "X";
      if (ref.part === "tenkan") return "T";
      if (ref.part === "kijun") return "K";
      if (ref.part === "spanA") return "A";
      if (ref.part === "spanB") return "B";
      if (ref.part === "chikou") return "C";
      return base;
    }
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
  if (ind.type === "DIFF") {
    const a = getFieldShortLetter(ind.diffFirstFieldKey ?? "close", userIndicators);
    const b = getFieldShortLetter(ind.diffSecondFieldKey ?? ind.fieldKey ?? "close", userIndicators);
    return ind.diffRelativePercent ? `DIFF%(${b}-${a})/${a}` : `DIFF(${b}-${a})`;
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
  if (ind.type === "MA_ANGLE") {
    const mt = ind.maAngleMaType === "SMA" || ind.maAngleMaType === "EMA" || ind.maAngleMaType === "WMA" || ind.maAngleMaType === "HMA" || ind.maAngleMaType === "VWMA" ? ind.maAngleMaType : "EMA";
    const lb = ind.maAngleLookback ?? 3;
    return `∠${mt}(${ind.period},${lb}) ${letter}`;
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
  const period = ind.type === "DIFF" ? (ind.diffSignalPeriod ?? 9) : (ind.macdSignalPeriod ?? 9);
  const k = t as Record<string, string>;
  const template = ind.type === "DIFF" ? (k.diffSignalLabel ?? "DIFF Signal({period})") : (k.macdSignalLabel ?? "MACD Signal({period})");
  return template.replace("{period}", String(period));
}

/** Rótulo curto da linha de sinal (ex.: "MACD Sig(9)"). */
export function getIndicatorLabelShortSignal(ind: UserIndicatorConfig): string {
  const period = ind.type === "DIFF" ? (ind.diffSignalPeriod ?? 9) : (ind.macdSignalPeriod ?? 9);
  return ind.type === "DIFF" ? `DIFF Sig(${period})` : `MACD Sig(${period})`;
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

export { indicatorColumnSpan, indicatorColumnStart } from "../regression/indicatorsColumnStart";

function parseUserFieldRefIdFromFieldKey(fieldKey: string | undefined): string | null {
  if (fieldKey == null || typeof fieldKey !== "string" || !fieldKey.startsWith("user_")) return null;
  const raw = fieldKey.slice(5);
  const sep = raw.indexOf(":");
  return sep < 0 ? raw : raw.slice(0, sep);
}

/**
 * Ids de outros indicadores referenciados em `fieldKey` (ex.: médias, Bollinger, etc. sobre `user_<id>` de **qualquer**
 * indicador anterior: RSI, MACD, outra banda, Stochastic…) e em DIFF. Define a ordem de cálculo (fonte antes do dependente).
 */
export function collectIndicatorDependencyIds(ind: UserIndicatorConfig): string[] {
  const ids: string[] = [];
  const add = (fk: string | undefined) => {
    const id = parseUserFieldRefIdFromFieldKey(fk);
    if (id && id !== ind.id) ids.push(id);
  };
  add(ind.fieldKey as string);
  if (ind.type === "DIFF") {
    add(ind.diffFirstFieldKey);
    add(ind.diffSecondFieldKey);
  }
  return ids;
}

/**
 * Ordem de cálculo segura: indicadores referenciados por `user_<id>` são calculados antes dos que deles dependem.
 * Se houver ciclo ou dependência em falta, devolve [0..n-1].
 */
export function topologicalUserIndicatorOrder(userIndicators: UserIndicatorConfig[]): number[] {
  const n = userIndicators.length;
  if (n <= 1) return [...Array(n).keys()];
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < n; i++) idToIndex.set(userIndicators[i]!.id, i);

  const adj = new Map<number, number[]>();
  const inDeg = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const deps = collectIndicatorDependencyIds(userIndicators[i]!);
    for (const id of deps) {
      const j = idToIndex.get(id);
      if (j === undefined || j === i) continue;
      if (!adj.has(j)) adj.set(j, []);
      adj.get(j)!.push(i);
      inDeg[i]++;
    }
  }

  const q: number[] = [];
  for (let i = 0; i < n; i++) if (inDeg[i] === 0) q.push(i);
  const out: number[] = [];
  while (q.length > 0) {
    const u = q.shift()!;
    out.push(u);
    for (const v of adj.get(u) ?? []) {
      inDeg[v]--;
      if (inDeg[v] === 0) q.push(v);
    }
  }
  if (out.length !== n) return [...Array(n).keys()];
  return out;
}
