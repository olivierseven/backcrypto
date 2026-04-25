import type { UserIndicatorConfig } from "../KlinesIndicatorsContext";
import { getIndicatorLabel } from "../IndicatorsPanel";

type IndicatorLabelT = Parameters<typeof getIndicatorLabel>[1];
import { getIndicatorColumnStart } from "./indicatorsColumnStart";

/** Painel onde a linha do indicador é desenhada (como em KlinesTable ao montar ChartIndicatorLine). */
export function chartLinePanelForUserIndicator(ind: UserIndicatorConfig): "main" | "panel2" | "panel3" | "panel4" | "panel5" | "panel6" | "panel7" {
  return (
    ind.panel ??
    (ind.type === "RSI" ||
    ind.type === "MFI" ||
    ind.type === "MACD" ||
    ind.type === "DIFF" ||
    ind.type === "Stochastic" ||
    ind.type === "WilliamsR" ||
    ind.type === "OBV" ||
    ind.type === "AD" ||
    ind.type === "ATR" ||
    ind.type === "ADX" ||
    ind.type === "Volume" ||
    ind.type === "CCI" ||
    ind.type === "CMF" ||
    ind.type === "MA_ANGLE"
      ? "panel2"
      : "main")
  );
}

/** ID fixo para regressão sobre OHLC das velas (não é indicador `ui_*`). */
export const CANDLE_REGRESSION_SOURCE_ID = "__candle_ohlc__";

export type RegressionSourceToken =
  | "line"
  | "ohlc_open"
  | "ohlc_high"
  | "ohlc_low"
  | "ohlc_close"
  | "ohlc_hl2"
  | "ohlc_oc2"
  | "ohlc_hlc3"
  | "ohlc_ohlc4"
  | "bollinger_upper"
  | "bollinger_middle"
  | "bollinger_lower"
  | "keltner_upper"
  | "keltner_middle"
  | "keltner_lower"
  | "donchian_upper"
  | "donchian_middle"
  | "donchian_lower"
  | "ichimoku_tenkan"
  | "ichimoku_kijun"
  | "ichimoku_spanA"
  | "ichimoku_spanB"
  | "ichimoku_chikou";

function parseOhlcCell(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Valor Y para regressão a partir da linha kline [1]=O [2]=H [3]=L [4]=C. */
export function ohlcRegressionValueFromRow(
  row: (number | string | null | undefined)[] | undefined,
  token: RegressionSourceToken
): number | null {
  if (!row || row.length < 5) return null;
  const o = parseOhlcCell(row[1]);
  const h = parseOhlcCell(row[2]);
  const l = parseOhlcCell(row[3]);
  const c = parseOhlcCell(row[4]);
  switch (token) {
    case "ohlc_open":
      return o;
    case "ohlc_high":
      return h;
    case "ohlc_low":
      return l;
    case "ohlc_close":
      return c;
    case "ohlc_hl2":
      return h != null && l != null ? (h + l) / 2 : null;
    case "ohlc_oc2":
      return o != null && c != null ? (o + c) / 2 : null;
    case "ohlc_hlc3":
      return h != null && l != null && c != null ? (h + l + c) / 3 : null;
    case "ohlc_ohlc4":
      return o != null && h != null && l != null && c != null ? (o + h + l + c) / 4 : null;
    default:
      return null;
  }
}

export function resolveRegressionSourceColumn(
  ind: UserIndicatorConfig,
  token: RegressionSourceToken,
  start: number
): number | null {
  switch (token) {
    case "ohlc_open":
    case "ohlc_high":
    case "ohlc_low":
    case "ohlc_close":
    case "ohlc_hl2":
    case "ohlc_oc2":
    case "ohlc_hlc3":
    case "ohlc_ohlc4":
      return null;
    case "line":
      if (ind.type === "Bollinger" || ind.type === "Keltner" || ind.type === "Donchian" || ind.type === "Ichimoku") return null;
      return start;
    case "bollinger_upper":
      return ind.type === "Bollinger" ? start : null;
    case "bollinger_middle":
      return ind.type === "Bollinger" ? start + 1 : null;
    case "bollinger_lower":
      return ind.type === "Bollinger" ? start + 2 : null;
    case "keltner_upper":
      return ind.type === "Keltner" ? start : null;
    case "keltner_middle":
      return ind.type === "Keltner" ? start + 1 : null;
    case "keltner_lower":
      return ind.type === "Keltner" ? start + 2 : null;
    case "donchian_upper":
      return ind.type === "Donchian" ? start : null;
    case "donchian_middle":
      return ind.type === "Donchian" ? start + 1 : null;
    case "donchian_lower":
      return ind.type === "Donchian" ? start + 2 : null;
    case "ichimoku_tenkan":
      return ind.type === "Ichimoku" ? start : null;
    case "ichimoku_kijun":
      return ind.type === "Ichimoku" ? start + 1 : null;
    case "ichimoku_spanA":
      return ind.type === "Ichimoku" ? start + 2 : null;
    case "ichimoku_spanB":
      return ind.type === "Ichimoku" ? start + 3 : null;
    case "ichimoku_chikou":
      return ind.type === "Ichimoku" ? start + 4 : null;
    default:
      return null;
  }
}

export type RegressionSourceOption = { indicatorId: string; token: RegressionSourceToken; label: string };

/** Séries no painel principal (escala de preço), para ajuste de regressão. */
export function listMainChartRegressionSources(
  userIndicators: UserIndicatorConfig[],
  groupMinutes: number,
  t: IndicatorLabelT
): RegressionSourceOption[] {
  const tx = t as Record<string, string>;
  const candlePrefix = tx.regressionOhlcPrefix ?? "Candles";
  const out: RegressionSourceOption[] = [
    { indicatorId: CANDLE_REGRESSION_SOURCE_ID, token: "ohlc_open", label: `${candlePrefix} — ${tx.regressionOhlcOpen ?? "Open (O)"}` },
    { indicatorId: CANDLE_REGRESSION_SOURCE_ID, token: "ohlc_high", label: `${candlePrefix} — ${tx.regressionOhlcHigh ?? "High (H)"}` },
    { indicatorId: CANDLE_REGRESSION_SOURCE_ID, token: "ohlc_low", label: `${candlePrefix} — ${tx.regressionOhlcLow ?? "Low (L)"}` },
    { indicatorId: CANDLE_REGRESSION_SOURCE_ID, token: "ohlc_close", label: `${candlePrefix} — ${tx.regressionOhlcClose ?? "Close (C)"}` },
    { indicatorId: CANDLE_REGRESSION_SOURCE_ID, token: "ohlc_hl2", label: `${candlePrefix} — ${tx.regressionOhlcHl2 ?? "HL2"}` },
    { indicatorId: CANDLE_REGRESSION_SOURCE_ID, token: "ohlc_oc2", label: `${candlePrefix} — ${tx.regressionOhlcOc2 ?? "OC2"}` },
    { indicatorId: CANDLE_REGRESSION_SOURCE_ID, token: "ohlc_hlc3", label: `${candlePrefix} — ${tx.regressionOhlcHlc3 ?? "HLC3"}` },
    { indicatorId: CANDLE_REGRESSION_SOURCE_ID, token: "ohlc_ohlc4", label: `${candlePrefix} — ${tx.regressionOhlcOhlc4 ?? "OHLC4"}` },
  ];
  for (let u = 0; u < userIndicators.length; u++) {
    const ind = userIndicators[u];
    if (ind.intervals.length === 1 && ind.intervals[0] === 0) continue;
    if (ind.intervals.length > 0 && !ind.intervals.includes(groupMinutes)) continue;
    if (ind.type === "Volume") continue;
    if (chartLinePanelForUserIndicator(ind) !== "main") continue;

    const start = getIndicatorColumnStart(userIndicators, u);
    const base = getIndicatorLabel(ind, t, userIndicators);

    if (ind.type === "Bollinger") {
      if (ind.bollingerShowUpper !== false) out.push({ indicatorId: ind.id, token: "bollinger_upper", label: `${base} (${t.regressionBollingerUpper ?? "Upper"})` });
      if (ind.bollingerShowMiddle === true) out.push({ indicatorId: ind.id, token: "bollinger_middle", label: `${base} (${t.regressionBollingerMiddle ?? "Middle"})` });
      if (ind.bollingerShowLower !== false) out.push({ indicatorId: ind.id, token: "bollinger_lower", label: `${base} (${t.regressionBollingerLower ?? "Lower"})` });
      continue;
    }
    if (ind.type === "Keltner") {
      if (ind.keltnerShowUpper !== false) out.push({ indicatorId: ind.id, token: "keltner_upper", label: `${base} (${t.regressionKeltnerUpper ?? "Upper"})` });
      if (ind.keltnerShowMiddle === true) out.push({ indicatorId: ind.id, token: "keltner_middle", label: `${base} (${t.regressionKeltnerMiddle ?? "Middle"})` });
      if (ind.keltnerShowLower !== false) out.push({ indicatorId: ind.id, token: "keltner_lower", label: `${base} (${t.regressionKeltnerLower ?? "Lower"})` });
      continue;
    }
    if (ind.type === "Donchian") {
      if (ind.donchianShowUpper !== false) out.push({ indicatorId: ind.id, token: "donchian_upper", label: `${base} (${t.regressionDonchianUpper ?? "Upper"})` });
      if (ind.donchianShowMiddle === true) out.push({ indicatorId: ind.id, token: "donchian_middle", label: `${base} (${t.regressionDonchianMiddle ?? "Middle"})` });
      if (ind.donchianShowLower !== false) out.push({ indicatorId: ind.id, token: "donchian_lower", label: `${base} (${t.regressionDonchianLower ?? "Lower"})` });
      continue;
    }
    if (ind.type === "Ichimoku") {
      if (ind.ichimokuShowTenkan !== false) out.push({ indicatorId: ind.id, token: "ichimoku_tenkan", label: `${base} Tenkan` });
      if (ind.ichimokuShowKijun !== false) out.push({ indicatorId: ind.id, token: "ichimoku_kijun", label: `${base} Kijun` });
      if (ind.ichimokuShowSpanA !== false) out.push({ indicatorId: ind.id, token: "ichimoku_spanA", label: `${base} Span A` });
      if (ind.ichimokuShowSpanB !== false) out.push({ indicatorId: ind.id, token: "ichimoku_spanB", label: `${base} Span B` });
      if (ind.ichimokuShowChikou === true) out.push({ indicatorId: ind.id, token: "ichimoku_chikou", label: `${base} Chikou` });
      continue;
    }

    out.push({ indicatorId: ind.id, token: "line", label: base });
  }
  return out;
}
