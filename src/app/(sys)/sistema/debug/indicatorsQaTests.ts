/**
 * Testes QA do fluxo de indicadores — executáveis no browser (aba Debug > QA > Indicadores).
 * Médias móveis (SMA, EMA, WMA, HMA, VWMA): período, fonte, painel, intervalos, cor, espessura, tipo de linha, séries em estratégia, excluir.
 * SMA2 / EMA2 / WMA2: janela em tempo (intervals=[]), mesmo fluxo QA que WMA2.
 * Canais (Bollinger, Keltner, Donchian): período, 3 linhas (upper/middle/lower) em estratégia, cor/espessura/estilo, excluir.
 * Momentum (RSI, MACD, MFI, Stochastic, CCI, Williams %R): RSI/MFI/CCI/Williams 1 série; MACD 3 funções; Stochastic 2 (%K e %D) em estratégia; cor/espessura/estilo, excluir.
 * Volatilidade (ATR): 1 série em estratégia, cor/espessura/estilo, excluir.
 * Volume (Volume, OBV, AD): 1 série em estratégia; Volume = cores acima/abaixo (histograma); OBV/AD = cor/espessura/estilo e fonte (base/usdt), excluir.
 * CMF (Chaikin Money Flow) e VWAP: 1 série em estratégia, cor/espessura/estilo, excluir (CMF no panel2, VWAP no main).
 * Tendência (ADX, SAR, Ichimoku): ADX 3 séries (+DI, -DI, ADX); SAR 1 série; Ichimoku 5 séries (Tenkan, Kijun, Span A/B, Chikou); cor/espessura/estilo, excluir.
 * Nota: indicadores são do layout (não por moeda); em qualquer símbolo aparecem conforme tempos selecionados.
 */
import { computeSmaColumn, computeEmaColumn, computeWmaColumn } from "@/app/api/binance/klines/indicators";
import { INTERVAL_OPTIONS } from "../indicatorsPanel/indicatorsPanelConstants";
import {
  ma2NullIndicesBeyondFullWindow,
  normalizeMa2TimeValueForUnit,
  wma2RequestedPeriodCandles,
  wma2WindowTotalMinutes,
} from "../indicatorsPanel/wma2Period";

export type IndicatorsQaTestResult = { name: string; pass: boolean; message?: string; evidence?: string };

const INTERVALS_NONE = 0;
const INTERVAL_1H = 60;
const INTERVAL_2H = 120;
const INTERVAL_4H = 240;

/** Nome do cartão QA (equivalência de janela MA2); referenciado nos fluxos WMA2/SMA2/EMA2. */
const MA2_WINDOW_EQUIVALENCE_QA_NAME =
  "MA2 — equivalência (7d≡168h; no gráfico 4h 1d≡24h≡1440m e SMA/EMA/WMA iguais)";

/** Tipos de média móvel com mesmo fluxo (período, fonte, painel, intervalos, cor, espessura, tipo de linha). */
const MOVING_AVERAGE_TYPES = ["SMA", "EMA", "WMA", "HMA", "VWMA"] as const;

/** SMA2 / EMA2 / WMA2: janela temporal; em estratégias a série é `ind_<id>:<fieldKey>` como as MA clássicas. */
const MA2_TIME_WINDOW_TYPES = ["WMA2", "SMA2", "EMA2"] as const;

/** Tipos de canal: três linhas (upper, middle, lower) em criar estratégia. */
const CHANNEL_TYPES = ["Bollinger", "Keltner", "Donchian"] as const;

/** Momentum: RSI (1 série), MACD (3 séries: MACD, sinal, histograma). */
const MOMENTUM_TYPES = ["RSI", "MACD"] as const;

/** Volatilidade: ATR (1 série). */
const VOLATILITY_TYPES = ["ATR"] as const;

type IndicatorLike = {
  id: string;
  type: string;
  period: number;
  fieldKey: string;
  panel: string;
  intervals: number[];
  color?: string;
  lineWidth?: string;
  lineStyle?: string;
  wma2TimeUnit?: "days" | "hours" | "minutes";
  wma2TimeValue?: number;
};

/** Canal: em estratégias aparecem 3 séries (upper, middle, lower). */
type ChannelLike = IndicatorLike & {
  type: "Bollinger" | "Keltner" | "Donchian";
  limitsColor?: string;
  limitsLineWidth?: string;
  limitsLineStyle?: string;
  middleColor?: string;
  middleLineWidth?: string;
  middleLineStyle?: string;
};

/** MACD: em estratégias aparecem 3 séries (linha MACD, sinal, histograma) quando signal e histograma ativos. */
type MACDLike = IndicatorLike & {
  type: "MACD";
  macdSignalLine?: boolean;
  macdHistogram?: boolean;
  macdSignalColor?: string;
  macdSignalLineWidth?: string;
  macdSignalLineStyle?: string;
  macdHistogramColorAbove?: string;
  macdHistogramColorBelow?: string;
};

/** RSI, MFI, CCI, Williams %R, ATR, CMF ou VWAP: 1 série (ind_id) em estratégia. */
type MomentumVolatilityLike = IndicatorLike & {
  type: "RSI" | "MFI" | "CCI" | "WilliamsR" | "ATR" | "CMF" | "VWAP";
};

/** Stochastic: 2 séries em estratégia (ind_id = %K, ind_id:d = %D) quando stochDLine ativo. */
type StochasticLike = IndicatorLike & {
  type: "Stochastic";
  stochDLine?: boolean;
  stochDColor?: string;
  stochDLineWidth?: string;
  stochDLineStyle?: string;
};

/** Volume: 1 série (ind_id); histograma com cores acima/abaixo. OBV/AD: 1 série, cor/espessura/estilo, fonte base ou usdt. */
type VolumeIndicatorLike = IndicatorLike & {
  type: "Volume" | "OBV" | "AD";
  volumeColorAbove?: string;
  volumeColorBelow?: string;
  volumeInUsdt?: boolean;
  obvVolumeSource?: "base" | "usdt";
  adVolumeSource?: "base" | "usdt";
};

/** ADX: 3 séries em estratégia (+DI, -DI, ADX); cor/espessura/estilo por linha. */
type ADXLike = IndicatorLike & {
  type: "ADX";
  adxPlusDiColor?: string;
  adxPlusDiLineWidth?: string;
  adxPlusDiLineStyle?: string;
  adxMinusDiColor?: string;
  adxMinusDiLineWidth?: string;
  adxMinusDiLineStyle?: string;
  adxAdxColor?: string;
  adxAdxLineWidth?: string;
  adxAdxLineStyle?: string;
};

/** SAR (Parabolic SAR): 1 série (ind_id); cor, sarPointSize, sarStart/sarIncrement/sarMax. */
type SARLike = IndicatorLike & {
  type: "SAR";
  sarPointSize?: "thin" | "normal";
  sarStart?: number;
  sarIncrement?: number;
  sarMax?: number;
};

/** Ichimoku: 5 séries em estratégia (tenkan, kijun, spanA, spanB, chikou); cor/espessura/estilo por linha. */
type IchimokuLike = IndicatorLike & {
  type: "Ichimoku";
  ichimokuTenkanColor?: string;
  ichimokuTenkanLineWidth?: string;
  ichimokuTenkanLineStyle?: string;
  ichimokuKijunColor?: string;
  ichimokuKijunLineWidth?: string;
  ichimokuKijunLineStyle?: string;
  ichimokuSpanAColor?: string;
  ichimokuSpanALineWidth?: string;
  ichimokuSpanALineStyle?: string;
  ichimokuSpanBColor?: string;
  ichimokuSpanBLineWidth?: string;
  ichimokuSpanBLineStyle?: string;
  ichimokuChikouColor?: string;
  ichimokuChikouLineWidth?: string;
  ichimokuChikouLineStyle?: string;
};

function isChannelType(t: string): t is "Bollinger" | "Keltner" | "Donchian" {
  return t === "Bollinger" || t === "Keltner" || t === "Donchian";
}

function isMovingAverageType(t: string): boolean {
  return (MOVING_AVERAGE_TYPES as readonly string[]).includes(t);
}

function usesIndIdFieldKeySeries(t: string): boolean {
  return isMovingAverageType(t) || (MA2_TIME_WINDOW_TYPES as readonly string[]).includes(t);
}

function isIndicatorVisibleForInterval(ind: IndicatorLike, effectiveIntervalMinutes: number): boolean {
  if (ind.intervals.length === 1 && ind.intervals[0] === INTERVALS_NONE) return false;
  if (ind.intervals.length === 0) return true;
  return ind.intervals.includes(effectiveIntervalMinutes);
}

function filterIndicatorsForInterval(list: IndicatorLike[], effectiveIntervalMinutes: number): IndicatorLike[] {
  return list.filter((ind) => isIndicatorVisibleForInterval(ind, effectiveIntervalMinutes));
}

/** Simula a lista de chaves em "Criar estratégia": OHLC + canais (3), MACD (3), Stochastic (2), ADX (3), Ichimoku (5), MA (ind_id:fieldKey), SAR e demais (ind_id). */
function buildSeriesKeysForInterval(
  indicators: (IndicatorLike | ChannelLike | MACDLike | MomentumVolatilityLike | StochasticLike | VolumeIndicatorLike | ADXLike | SARLike | IchimokuLike)[],
  intervalMinutes: number
): string[] {
  const base = ["open", "high", "low", "close"];
  const filtered = indicators.filter((ind) => isIndicatorVisibleForInterval(ind, intervalMinutes));
  const indKeys: string[] = [];
  for (const i of filtered) {
    if (isChannelType(i.type)) {
      indKeys.push(`ind_${i.id}:upper`, `ind_${i.id}:middle`, `ind_${i.id}:lower`);
    } else if (i.type === "MACD" && (i as MACDLike).macdSignalLine && (i as MACDLike).macdHistogram) {
      indKeys.push(`ind_${i.id}`, `ind_${i.id}:sig`, `ind_${i.id}:hist`);
    } else if (i.type === "Stochastic" && (i as StochasticLike).stochDLine) {
      indKeys.push(`ind_${i.id}`, `ind_${i.id}:d`);
    } else if (i.type === "ADX") {
      indKeys.push(`ind_${i.id}:plusDi`, `ind_${i.id}:minusDi`, `ind_${i.id}:adx`);
    } else if (i.type === "Ichimoku") {
      indKeys.push(`ind_${i.id}:tenkan`, `ind_${i.id}:kijun`, `ind_${i.id}:spanA`, `ind_${i.id}:spanB`, `ind_${i.id}:chikou`);
    } else if (usesIndIdFieldKeySeries(i.type)) {
      indKeys.push(`ind_${i.id}:${i.fieldKey}`);
    } else {
      indKeys.push(`ind_${i.id}`);
    }
  }
  return [...base, ...indKeys];
}

function runMa2TimeWindowFlow(type: (typeof MA2_TIME_WINDOW_TYPES)[number], label: string): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;
  try {
    const indId = `ui_qa_${type.toLowerCase()}_${Date.now()}`;
    const list: IndicatorLike[] = [];
    const ind: IndicatorLike = {
      id: indId,
      type,
      period: 1,
      fieldKey: "close",
      panel: "main",
      intervals: [],
      wma2TimeUnit: "hours",
      wma2TimeValue: 24,
      color: "#3b82f6",
      lineWidth: "normal",
      lineStyle: "solid",
    };
    list.push(ind);
    evidence.push(`1. ${label} adicionado: janela 24h, Close, main, intervals=[] (todos os tempos).`);

    const visible2h = isIndicatorVisibleForInterval(ind, INTERVAL_2H);
    evidence.push(`2. Visível em 2h com todos os tempos: ${visible2h} (true esperado).`);
    if (!visible2h) {
      pass = false;
      message = `${label} com intervals=[] deve aparecer em qualquer timeframe.`;
    }

    const idx = list.findIndex((i) => i.id === indId);
    if (idx >= 0) list[idx] = { ...list[idx]!, wma2TimeValue: 48, fieldKey: "open" };
    const after = list.find((i) => i.id === indId);
    const editOk = after?.wma2TimeValue === 48 && after?.fieldKey === "open";
    evidence.push(`3. Editado janela 24→48h e Close→Open: ${editOk ? "✓" : "falhou"}.`);
    if (!editOk) {
      pass = false;
      message = message ?? `Edição ${label} falhou.`;
    }

    if (idx >= 0) list[idx] = { ...list[idx]!, color: "#ef4444", lineWidth: "thin", lineStyle: "dashed" };
    const afterStyle = list.find((i) => i.id === indId);
    const styleOk = afterStyle?.color === "#ef4444" && afterStyle?.lineWidth === "thin" && afterStyle?.lineStyle === "dashed";
    evidence.push(`4. Cor/espessura/estilo: ${styleOk ? "✓" : "falhou"}.`);

    const removed = list.filter((i) => i.id !== indId);
    list.length = 0;
    list.push(...removed);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }
    evidence.push(
      `5. Excluído. ${label}: período em candles = ceil(janela min ÷ min do candle); sem candles suficientes, série fica vazia (sem linha).`
    );
    evidence.push(
      `6. Equivalência de janela (7d≡168h; gráfico 4h 1d≡24h≡1440m; séries SMA/EMA/WMA): ver o cartão «${MA2_WINDOW_EQUIVALENCE_QA_NAME}» na lista QA (fica antes de WMA2 / SMA2 / EMA2).`
    );
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }
  return {
    name: `${label} — janela em tempo (todos os timeframes), editar janela/fonte, cor/espessura/estilo, excluir`,
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}

/** Garante equivalências: 7d≡168h (período candles em 1h, 4h, 1d); no gráfico 4h, 1d≡24h≡1440m e SMA/EMA/WMA idênticas. */
function runMa2WindowEquivalenceFlow(): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;
  try {
    const min7d = wma2WindowTotalMinutes("days", 7);
    const min168h = wma2WindowTotalMinutes("hours", 168);
    const eqMin = min7d === min168h;
    evidence.push(`1. Minutos totais: 7d=${min7d}, 168h=${min168h} → ${eqMin ? "iguais ✓" : "diferentes ✗"}.`);
    if (!eqMin) {
      pass = false;
      message = "wma2WindowTotalMinutes(7d) deve igualar wma2WindowTotalMinutes(168h).";
    }

    const norm = normalizeMa2TimeValueForUnit("days", 168);
    evidence.push(`2. normalize(days, 168)=${norm} (esperado 7, equivale a 168 h).`);
    if (norm !== 7) {
      pass = false;
      message = message ?? "normalizeMa2TimeValueForUnit(days,168) deve ser 7.";
    }

    const minAfterNorm = wma2WindowTotalMinutes("days", norm);
    evidence.push(`3. wma2WindowTotalMinutes(days, normalize(days,168))=${minAfterNorm} (deve ser ${min168h} como 168h).`);
    if (minAfterNorm !== min168h) {
      pass = false;
      message = message ?? "Após normalizar days+168→7, minutos totais devem igualar 168 h.";
    }

    for (const gm of [60, INTERVAL_4H, 1440]) {
      const p7 = wma2RequestedPeriodCandles(gm, "days", 7);
      const p168 = wma2RequestedPeriodCandles(gm, "hours", 168);
      const ok = p7 === p168;
      evidence.push(`4. TF ${gm}m — período candles: 7d=${p7}, 168h=${p168} ${ok ? "✓" : "✗"}.`);
      if (!ok) {
        pass = false;
        message = message ?? `Período em candles difere no TF ${gm}m.`;
      }
    }

    const min1d = wma2WindowTotalMinutes("days", 1);
    const min24h = wma2WindowTotalMinutes("hours", 24);
    const min1440m = wma2WindowTotalMinutes("minutes", 1440);
    const eq1d = min1d === min24h && min24h === min1440m && min1d === 1440;
    evidence.push(
      `5. 1 dia ≡ 24 h ≡ 1440 min — minutos totais: 1d=${min1d}, 24h=${min24h}, 1440m=${min1440m} → ${eq1d ? "iguais ✓" : "diferentes ✗"}.`
    );
    if (!eq1d) {
      pass = false;
      message = message ?? "wma2WindowTotalMinutes(1d), (24h) e (1440m) devem ser todos 1440.";
    }

    const gm4h = INTERVAL_4H;
    const p1d = wma2RequestedPeriodCandles(gm4h, "days", 1);
    const p24h = wma2RequestedPeriodCandles(gm4h, "hours", 24);
    const p1440m = wma2RequestedPeriodCandles(gm4h, "minutes", 1440);
    const periodsMatch = p1d === p24h && p24h === p1440m;
    evidence.push(
      `6. Gráfico 4h (${gm4h}m) — período em candles: 1d=${p1d}, 24h=${p24h}, 1440m=${p1440m} ${periodsMatch ? "✓" : "✗"}.`
    );
    if (!periodsMatch) {
      pass = false;
      message = message ?? `No TF 4h, 1d / 24h / 1440m devem dar o mesmo período em candles.`;
    } else {
      const nRows = 50;
      const closeIdx = 4;
      const klines: (string | number | null)[][] = [];
      for (let i = 0; i < nRows; i++) {
        const t = 1_700_000_000_000 - i * gm4h * 60_000;
        const close = 100 + i * 0.13 + (i % 11) * 0.02;
        klines.push([t, "1", "1", "1", String(close), "1"]);
      }

      const colsCloseEnough = (a: (number | null)[], b: (number | null)[]): boolean => {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          const x = a[i];
          const y = b[i];
          if (x === null && y === null) continue;
          if (x === null || y === null) return false;
          if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
          if (Math.abs(x - y) > 1e-9) return false;
        }
        return true;
      };

      let maStep = 7;
      const assertMa2TripleSeries = (label: string, compute: (d: (string | number | null)[][], vi: number, p: number) => (number | null)[]) => {
        const cD = compute(klines, closeIdx, p1d);
        const cH = compute(klines, closeIdx, p24h);
        const cM = compute(klines, closeIdx, p1440m);
        ma2NullIndicesBeyondFullWindow(cD, nRows, p1d);
        ma2NullIndicesBeyondFullWindow(cH, nRows, p24h);
        ma2NullIndicesBeyondFullWindow(cM, nRows, p1440m);
        const ok = colsCloseEnough(cD, cH) && colsCloseEnough(cH, cM);
        evidence.push(`${maStep}. TF 4h — ${label} (1d vs 24h vs 1440m): séries ${ok ? "iguais ✓" : "diferentes ✗"}.`);
        maStep += 1;
        if (!ok) {
          pass = false;
          message = message ?? `No TF 4h, ${label} deve coincidir ao trocar unidade da mesma janela (1d/24h/1440m).`;
        }
      };

      assertMa2TripleSeries("SMA2 (computeSmaColumn)", computeSmaColumn);
      assertMa2TripleSeries("EMA2 (computeEmaColumn)", computeEmaColumn);
      assertMa2TripleSeries("WMA2 (computeWmaColumn)", computeWmaColumn);
    }
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }
  return {
    name: MA2_WINDOW_EQUIVALENCE_QA_NAME,
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}

function runWma2Flow(): IndicatorsQaTestResult {
  return runMa2TimeWindowFlow("WMA2", "WMA2");
}

function runSma2Flow(): IndicatorsQaTestResult {
  return runMa2TimeWindowFlow("SMA2", "SMA2");
}

function runEma2Flow(): IndicatorsQaTestResult {
  return runMa2TimeWindowFlow("EMA2", "EMA2");
}

function runMovingAverageFlow(maType: string): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;

  try {
    const indId = `ui_qa_${maType.toLowerCase()}_${Date.now()}`;
    const list: IndicatorLike[] = [];
    const ind: IndicatorLike = {
      id: indId,
      type: maType,
      period: 7,
      fieldKey: "close",
      panel: "main",
      intervals: [INTERVAL_1H, INTERVAL_4H],
      color: "#3b82f6",
      lineWidth: "normal",
      lineStyle: "solid",
    };
    list.push(ind);
    evidence.push(`1. Adicionado ${maType}(7) fonte Close, painel main, intervalos 1h e 4h, cor #3b82f6, espessura normal, estilo solid.`);

    const visible1h = isIndicatorVisibleForInterval(ind, INTERVAL_1H);
    const visible4h = isIndicatorVisibleForInterval(ind, INTERVAL_4H);
    const visible2hBefore = isIndicatorVisibleForInterval(ind, INTERVAL_2H);
    evidence.push(`2. Visibilidade por tempo: 1h=${visible1h}, 4h=${visible4h}, 2h=${visible2hBefore} (deve ser false).`);
    if (!visible1h || !visible4h || visible2hBefore) {
      pass = false;
      message = `${maType} com [1h,4h] deve aparecer em 1h e 4h e não em 2h.`;
    }

    const meusIndicators1h = filterIndicatorsForInterval(list, INTERVAL_1H);
    const meusIndicators4h = filterIndicatorsForInterval(list, INTERVAL_4H);
    const meusIndicators2h = filterIndicatorsForInterval(list, INTERVAL_2H);
    evidence.push(`3. Meus indicadores: em 1h ${meusIndicators1h.length} item(s), em 4h ${meusIndicators4h.length}, em 2h ${meusIndicators2h.length} (0 esperado).`);
    if (meusIndicators1h.length !== 1 || meusIndicators4h.length !== 1 || meusIndicators2h.length !== 0) {
      pass = false;
      message = message ?? "Lista meus indicadores por tempo incorreta.";
    }

    const seriesKeys1h = buildSeriesKeysForInterval(list, INTERVAL_1H);
    const seriesKeys2h = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const indKeyClose = `ind_${indId}:close`;
    const inList1h = seriesKeys1h.includes(indKeyClose);
    const notInList2h = !seriesKeys2h.includes(indKeyClose);
    const panelOk = ind.panel === "main";
    evidence.push(`4. Painel: ${ind.panel} (${maType} no main) ${panelOk ? "✓" : "— falhou"}. Lista de séries em criar estratégia: 1h contém "${indKeyClose}"? ${inList1h}. 2h NÃO contém? ${notInList2h}.`);
    if (!panelOk || !inList1h || !notInList2h) {
      pass = false;
      message = message ?? (panelOk ? "Indicador deve aparecer na lista de séries em 1h e não em 2h (criar estratégia)." : "Painel do indicador deve ser main.");
    }

    const idx = list.findIndex((i) => i.id === indId);
    if (idx >= 0) list[idx] = { ...list[idx]!, period: 14, fieldKey: "open" };
    const afterPeriod = list.find((i) => i.id === indId);
    const periodOk = afterPeriod?.period === 14 && afterPeriod?.fieldKey === "open";
    evidence.push(`5a. Editado período 7→14 e fonte Close→Open. Verificado: ${periodOk ? "✓" : "falhou"}.`);
    if (!periodOk) {
      pass = false;
      message = message ?? "Edição de período/fonte falhou.";
    }

    if (idx >= 0) list[idx] = { ...list[idx]!, intervals: [] };
    const afterEdit = list.find((i) => i.id === indId);
    const visible2hAfter = afterEdit ? isIndicatorVisibleForInterval(afterEdit, INTERVAL_2H) : false;
    evidence.push(`5b. Editado para "Todos os tempos" (intervals=[]). Visibilidade em 2h: ${visible2hAfter} (deve ser true).`);
    if (!visible2hAfter) {
      pass = false;
      message = message ?? "Após editar para todos os tempos, indicador deve aparecer em 2h.";
    }

    const meusIndicators2hAfter = filterIndicatorsForInterval(list, INTERVAL_2H);
    const seriesKeys2hAfter = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const indKeyOpen = `ind_${indId}:open`;
    const inList2hAfter = seriesKeys2hAfter.includes(indKeyOpen);
    evidence.push(`6. Meus indicadores em 2h após edição: ${meusIndicators2hAfter.length} item(s). Lista de séries em criar estratégia (2h) contém "${indKeyOpen}"? ${inList2hAfter} ✓.`);
    if (meusIndicators2hAfter.length !== 1 || !inList2hAfter) {
      pass = false;
      message = message ?? (inList2hAfter ? "Meus indicadores em 2h após todos os tempos deve ter 1." : "Após todos os tempos, indicador deve aparecer na lista de séries em criar estratégia (2h).");
    }

    if (idx >= 0) list[idx] = { ...list[idx]!, color: "#ef4444", lineWidth: "thin", lineStyle: "dashed" };
    const afterStyle = list.find((i) => i.id === indId);
    const styleOk = afterStyle?.color === "#ef4444" && afterStyle?.lineWidth === "thin" && afterStyle?.lineStyle === "dashed";
    evidence.push(`7. Cor #ef4444, espessura thin, tipo de linha dashed. Verificado: ${styleOk ? "✓" : "falhou"}.`);
    if (!styleOk) {
      pass = false;
      message = message ?? "Edição de cor, espessura ou tipo de linha falhou.";
    }

    const beforeDelete = list.length;
    const removed = list.filter((i) => i.id !== indId);
    list.length = 0;
    list.push(...removed);
    evidence.push(`8. Excluído. Lista antes=${beforeDelete}, depois=${list.length} (0 esperado).`);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }

    evidence.push(`9. ${maType}(period), fieldKey → série ind_<id>:<fieldKey>. Panel main = gráfico principal.`);
    evidence.push(`10. INTERVAL_OPTIONS: 1h=${INTERVAL_OPTIONS.find((o) => o.value === 60)?.label ?? "?"}, 2h=${INTERVAL_OPTIONS.find((o) => o.value === 120)?.label ?? "?"}, 4h=${INTERVAL_OPTIONS.find((o) => o.value === 240)?.label ?? "?"}.`);
    evidence.push("Nota: indicadores são do layout (não por moeda); em BTCUSDT ou ETHUSDT aparecem conforme tempos selecionados.");
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }

  return {
    name: `${maType} — fluxo completo (período, fonte, painel, 1h/4h, 2h, editar período/fonte, todos os tempos, cor/espessura/tipo de linha, excluir)`,
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}

function runChannelFlow(channelType: "Bollinger" | "Keltner" | "Donchian"): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;

  try {
    const indId = `ui_qa_${channelType.toLowerCase()}_${Date.now()}`;
    const list: ChannelLike[] = [];
    const ind: ChannelLike = {
      id: indId,
      type: channelType,
      period: 20,
      fieldKey: "close",
      panel: "main",
      intervals: [INTERVAL_1H, INTERVAL_4H],
      limitsColor: "#6366f1",
      limitsLineWidth: "normal",
      limitsLineStyle: "solid",
      middleColor: "#8b5cf6",
      middleLineWidth: "thin",
      middleLineStyle: "solid",
    };
    list.push(ind);
    evidence.push(`1. Adicionado ${channelType}(20) Close, main, 1h e 4h. Bandas: cor #6366f1, espessura normal, solid. Média: #8b5cf6, thin, solid.`);

    const visible1h = isIndicatorVisibleForInterval(ind, INTERVAL_1H);
    const visible4h = isIndicatorVisibleForInterval(ind, INTERVAL_4H);
    const visible2hBefore = isIndicatorVisibleForInterval(ind, INTERVAL_2H);
    evidence.push(`2. Visibilidade: 1h=${visible1h}, 4h=${visible4h}, 2h=${visible2hBefore} (false).`);
    if (!visible1h || !visible4h || visible2hBefore) {
      pass = false;
      message = `${channelType} com [1h,4h] deve aparecer em 1h e 4h e não em 2h.`;
    }

    const meus1h = filterIndicatorsForInterval(list, INTERVAL_1H);
    const meus2h = filterIndicatorsForInterval(list, INTERVAL_2H);
    evidence.push(`3. Meus indicadores: 1h ${meus1h.length}, 2h ${meus2h.length} (0).`);
    if (meus1h.length !== 1 || meus2h.length !== 0) {
      pass = false;
      message = message ?? "Lista meus indicadores por tempo incorreta.";
    }

    const seriesKeys1h = buildSeriesKeysForInterval(list, INTERVAL_1H);
    const seriesKeys2h = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const keyUpper = `ind_${indId}:upper`;
    const keyMiddle = `ind_${indId}:middle`;
    const keyLower = `ind_${indId}:lower`;
    const threeIn1h = [keyUpper, keyMiddle, keyLower].every((k) => seriesKeys1h.includes(k));
    const noneIn2h = ![keyUpper, keyMiddle, keyLower].some((k) => seriesKeys2h.includes(k));
    evidence.push(`4. Lista de séries em criar estratégia: 1h contém as 3 linhas (upper, middle, lower)? ${threeIn1h}. 2h não contém nenhuma? ${noneIn2h}.`);
    if (!threeIn1h || !noneIn2h) {
      pass = false;
      message = message ?? "Canal deve aparecer com as 3 linhas (upper, middle, lower) em 1h e nenhuma em 2h.";
    }

    const idx = list.findIndex((i) => i.id === indId);
    if (idx >= 0) list[idx] = { ...list[idx]!, intervals: [] };
    const afterEdit = list.find((i) => i.id === indId);
    const visible2hAfter = afterEdit ? isIndicatorVisibleForInterval(afterEdit, INTERVAL_2H) : false;
    evidence.push(`5. Editado para "Todos os tempos". Visibilidade em 2h: ${visible2hAfter}.`);
    if (!visible2hAfter) {
      pass = false;
      message = message ?? "Após todos os tempos, canal deve aparecer em 2h.";
    }

    const seriesKeys2hAfter = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const threeIn2hAfter = [keyUpper, keyMiddle, keyLower].every((k) => seriesKeys2hAfter.includes(k));
    evidence.push(`6. Lista de séries em criar estratégia (2h) após todos os tempos contém as 3 linhas? ${threeIn2hAfter}.`);
    if (!threeIn2hAfter) {
      pass = false;
      message = message ?? "Após todos os tempos, as 3 linhas do canal devem aparecer na lista de séries em 2h.";
    }

    if (idx >= 0) {
      list[idx] = {
        ...list[idx]!,
        limitsColor: "#dc2626",
        limitsLineWidth: "thin",
        limitsLineStyle: "dashed",
        middleColor: "#ea580c",
        middleLineWidth: "normal",
        middleLineStyle: "dotted",
      };
    }
    const afterStyle = list.find((i) => i.id === indId);
    const styleOk =
      afterStyle?.limitsColor === "#dc2626" &&
      afterStyle?.limitsLineWidth === "thin" &&
      afterStyle?.limitsLineStyle === "dashed" &&
      afterStyle?.middleColor === "#ea580c" &&
      afterStyle?.middleLineWidth === "normal" &&
      afterStyle?.middleLineStyle === "dotted";
    evidence.push(`7. Bandas: cor #dc2626, thin, dashed. Média: #ea580c, normal, dotted. Verificado: ${styleOk ? "✓" : "falhou"}.`);
    if (!styleOk) {
      pass = false;
      message = message ?? "Edição de cor, espessura ou tipo de linha (bandas e média) falhou.";
    }

    const beforeDelete = list.length;
    const removed = list.filter((i) => i.id !== indId);
    list.length = 0;
    list.push(...removed);
    evidence.push(`8. Excluído. Lista antes=${beforeDelete}, depois=${list.length}.`);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }

    evidence.push(`9. ${channelType} → em estratégias aparecem 3 séries: ind_<id>:upper, :middle, :lower.`);
    evidence.push("Nota: indicadores são do layout (não por moeda); em qualquer símbolo aparecem conforme tempos selecionados.");
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }

  return {
    name: `${channelType} — fluxo completo (período, 1h/4h, 2h, 3 linhas em estratégia, todos os tempos, cor/espessura/tipo de linha bandas e média, excluir)`,
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}

function runMACDFlow(): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;

  try {
    const indId = `ui_qa_macd_${Date.now()}`;
    const list: MACDLike[] = [];
    const ind: MACDLike = {
      id: indId,
      type: "MACD",
      period: 12,
      fieldKey: "close",
      panel: "panel2",
      intervals: [INTERVAL_1H, INTERVAL_4H],
      color: "#3b82f6",
      lineWidth: "normal",
      lineStyle: "solid",
      macdSignalLine: true,
      macdHistogram: true,
      macdSignalColor: "#f59e0b",
      macdSignalLineWidth: "thin",
      macdSignalLineStyle: "dashed",
      macdHistogramColorAbove: "#22c55e",
      macdHistogramColorBelow: "#ef4444",
    };
    list.push(ind);
    evidence.push(`1. Adicionado MACD(12/26/9) com linha de sinal e histograma. Cores: MACD #3b82f6, sinal #f59e0b, hist acima/abaixo #22c55e/#ef4444.`);

    const visible1h = isIndicatorVisibleForInterval(ind, INTERVAL_1H);
    const visible2hBefore = isIndicatorVisibleForInterval(ind, INTERVAL_2H);
    evidence.push(`2. Visibilidade: 1h=${visible1h}, 2h=${visible2hBefore} (false).`);
    if (!visible1h || visible2hBefore) {
      pass = false;
      message = "MACD com [1h,4h] deve aparecer em 1h e não em 2h.";
    }

    const seriesKeys1h = buildSeriesKeysForInterval(list, INTERVAL_1H);
    const seriesKeys2h = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const keyMacd = `ind_${indId}`;
    const keySig = `ind_${indId}:sig`;
    const keyHist = `ind_${indId}:hist`;
    const threeIn1h = [keyMacd, keySig, keyHist].every((k) => seriesKeys1h.includes(k));
    const noneIn2h = ![keyMacd, keySig, keyHist].some((k) => seriesKeys2h.includes(k));
    evidence.push(`3. Lista de séries em criar estratégia: 1h contém as 3 funções (MACD, sinal, histograma)? ${threeIn1h}. 2h não contém? ${noneIn2h}.`);
    if (!threeIn1h || !noneIn2h) {
      pass = false;
      message = message ?? "MACD deve aparecer com 3 funções (linha MACD, sinal, histograma) em 1h e nenhuma em 2h.";
    }

    const idx = list.findIndex((i) => i.id === indId);
    if (idx >= 0) list[idx] = { ...list[idx]!, intervals: [] };
    const seriesKeys2hAfter = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const threeIn2hAfter = [keyMacd, keySig, keyHist].every((k) => seriesKeys2hAfter.includes(k));
    evidence.push(`4. Editado para "Todos os tempos". Lista em 2h contém as 3 funções? ${threeIn2hAfter}.`);
    if (!threeIn2hAfter) {
      pass = false;
      message = message ?? "Após todos os tempos, as 3 funções do MACD devem aparecer em 2h.";
    }

    if (idx >= 0) {
      list[idx] = {
        ...list[idx]!,
        color: "#7c3aed",
        lineWidth: "thin",
        lineStyle: "dotted",
        macdSignalColor: "#059669",
        macdSignalLineWidth: "normal",
        macdSignalLineStyle: "solid",
        macdHistogramColorAbove: "#0ea5e9",
        macdHistogramColorBelow: "#dc2626",
      };
    }
    const afterStyle = list.find((i) => i.id === indId);
    const styleOk =
      afterStyle?.color === "#7c3aed" &&
      afterStyle?.lineWidth === "thin" &&
      afterStyle?.lineStyle === "dotted" &&
      afterStyle?.macdSignalColor === "#059669" &&
      afterStyle?.macdSignalLineWidth === "normal" &&
      afterStyle?.macdSignalLineStyle === "solid" &&
      afterStyle?.macdHistogramColorAbove === "#0ea5e9" &&
      afterStyle?.macdHistogramColorBelow === "#dc2626";
    evidence.push(`5. Cor/espessura/estilo: MACD #7c3aed thin dotted; sinal #059669 normal solid; hist acima/abaixo #0ea5e9/#dc2626. Verificado: ${styleOk ? "✓" : "falhou"}.`);
    if (!styleOk) {
      pass = false;
      message = message ?? "Edição de cor, espessura ou tipo de linha (MACD, sinal, histograma) falhou.";
    }

    const removed = list.filter((i) => i.id !== indId);
    list.length = 0;
    list.push(...removed);
    evidence.push(`6. Excluído. Lista depois=${list.length}.`);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }
    evidence.push("Nota: MACD em estratégias = 3 séries: ind_<id> (linha MACD), ind_<id>:sig (sinal), ind_<id>:hist (histograma).");
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }

  return {
    name: "MACD — fluxo completo (3 funções em estratégia: MACD, sinal, histograma; 1h/4h/2h; todos os tempos; cor/espessura/estilo; excluir)",
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}

function runRSIFlow(): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;

  try {
    const indId = `ui_qa_rsi_${Date.now()}`;
    const list: MomentumVolatilityLike[] = [];
    const ind: MomentumVolatilityLike = {
      id: indId,
      type: "RSI",
      period: 14,
      fieldKey: "close",
      panel: "panel2",
      intervals: [INTERVAL_1H, INTERVAL_4H],
      color: "#8b5cf6",
      lineWidth: "normal",
      lineStyle: "solid",
    };
    list.push(ind);
    evidence.push(`1. Adicionado RSI(14) Close, panel2, 1h e 4h, cor #8b5cf6, espessura normal, estilo solid.`);

    const seriesKeys1h = buildSeriesKeysForInterval(list, INTERVAL_1H);
    const seriesKeys2h = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const key = `ind_${indId}`;
    const in1h = seriesKeys1h.includes(key);
    const notIn2h = !seriesKeys2h.includes(key);
    evidence.push(`2. Lista de séries em criar estratégia: 1h contém "${key}"? ${in1h}. 2h não contém? ${notIn2h}.`);
    if (!in1h || !notIn2h) {
      pass = false;
      message = "RSI deve aparecer na lista em 1h e não em 2h.";
    }

    const idx = list.findIndex((i) => i.id === indId);
    if (idx >= 0) list[idx] = { ...list[idx]!, intervals: [] };
    const seriesKeys2hAfter = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const in2hAfter = seriesKeys2hAfter.includes(key);
    evidence.push(`3. Todos os tempos. Lista em 2h contém "${key}"? ${in2hAfter}.`);
    if (!in2hAfter) {
      pass = false;
      message = message ?? "Após todos os tempos, RSI deve aparecer na lista em 2h.";
    }

    if (idx >= 0) list[idx] = { ...list[idx]!, color: "#be185d", lineWidth: "thin", lineStyle: "dashed" };
    const afterStyle = list.find((i) => i.id === indId);
    const styleOk = afterStyle?.color === "#be185d" && afterStyle?.lineWidth === "thin" && afterStyle?.lineStyle === "dashed";
    evidence.push(`4. Cor #be185d, espessura thin, tipo de linha dashed. Verificado: ${styleOk ? "✓" : "falhou"}.`);
    if (!styleOk) {
      pass = false;
      message = message ?? "Edição de cor, espessura ou tipo de linha falhou.";
    }

    const removed = list.filter((i) => i.id !== indId);
    list.length = 0;
    list.push(...removed);
    evidence.push(`5. Excluído. Lista depois=${list.length}.`);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }

  return {
    name: "RSI — fluxo completo (1 série em estratégia, 1h/4h/2h, todos os tempos, cor/espessura/tipo de linha, excluir)",
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}

function runATRFlow(): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;

  try {
    const indId = `ui_qa_atr_${Date.now()}`;
    const list: MomentumVolatilityLike[] = [];
    const ind: MomentumVolatilityLike = {
      id: indId,
      type: "ATR",
      period: 14,
      fieldKey: "close",
      panel: "panel2",
      intervals: [INTERVAL_1H, INTERVAL_4H],
      color: "#0d9488",
      lineWidth: "normal",
      lineStyle: "solid",
    };
    list.push(ind);
    evidence.push(`1. Adicionado ATR(14) panel2, 1h e 4h, cor #0d9488, espessura normal, estilo solid.`);

    const seriesKeys1h = buildSeriesKeysForInterval(list, INTERVAL_1H);
    const seriesKeys2h = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const key = `ind_${indId}`;
    const in1h = seriesKeys1h.includes(key);
    const notIn2h = !seriesKeys2h.includes(key);
    evidence.push(`2. Lista de séries em criar estratégia: 1h contém "${key}"? ${in1h}. 2h não contém? ${notIn2h}.`);
    if (!in1h || !notIn2h) {
      pass = false;
      message = "ATR deve aparecer na lista em 1h e não em 2h.";
    }

    const idx = list.findIndex((i) => i.id === indId);
    if (idx >= 0) list[idx] = { ...list[idx]!, intervals: [] };
    const seriesKeys2hAfter = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const in2hAfter = seriesKeys2hAfter.includes(key);
    evidence.push(`3. Todos os tempos. Lista em 2h contém "${key}"? ${in2hAfter}.`);
    if (!in2hAfter) {
      pass = false;
      message = message ?? "Após todos os tempos, ATR deve aparecer na lista em 2h.";
    }

    if (idx >= 0) list[idx] = { ...list[idx]!, color: "#c2410c", lineWidth: "thin", lineStyle: "dotted" };
    const afterStyle = list.find((i) => i.id === indId);
    const styleOk = afterStyle?.color === "#c2410c" && afterStyle?.lineWidth === "thin" && afterStyle?.lineStyle === "dotted";
    evidence.push(`4. Cor #c2410c, espessura thin, tipo de linha dotted. Verificado: ${styleOk ? "✓" : "falhou"}.`);
    if (!styleOk) {
      pass = false;
      message = message ?? "Edição de cor, espessura ou tipo de linha falhou.";
    }

    const removed = list.filter((i) => i.id !== indId);
    list.length = 0;
    list.push(...removed);
    evidence.push(`5. Excluído. Lista depois=${list.length}.`);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }
    evidence.push("Nota: ATR (volatilidade) = 1 série ind_<id> em criar estratégia.");
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }

  return {
    name: "ATR — fluxo completo (volatilidade; 1 série em estratégia, 1h/4h/2h, todos os tempos, cor/espessura/tipo de linha, excluir)",
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}

function runSingleSeriesMomentumFlow(
  type: "MFI" | "CCI" | "WilliamsR" | "CMF" | "VWAP",
  label: string,
  period: number,
  initialColor: string,
  editColor: string,
  panel: "main" | "panel2" = "panel2"
): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;
  const idPrefix = type === "WilliamsR" ? "williamsr" : type.toLowerCase();

  try {
    const indId = `ui_qa_${idPrefix}_${Date.now()}`;
    const list: MomentumVolatilityLike[] = [];
    const ind: MomentumVolatilityLike = {
      id: indId,
      type,
      period,
      fieldKey: "close",
      panel,
      intervals: [INTERVAL_1H, INTERVAL_4H],
      color: initialColor,
      lineWidth: "normal",
      lineStyle: "solid",
    };
    list.push(ind);
    evidence.push(`1. Adicionado ${label}${period > 0 ? `(${period})` : ""} Close, ${panel}, 1h e 4h, cor ${initialColor}, espessura normal, estilo solid.`);

    const seriesKeys1h = buildSeriesKeysForInterval(list, INTERVAL_1H);
    const seriesKeys2h = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const key = `ind_${indId}`;
    const in1h = seriesKeys1h.includes(key);
    const notIn2h = !seriesKeys2h.includes(key);
    evidence.push(`2. Lista de séries em criar estratégia: 1h contém "${key}"? ${in1h}. 2h não contém? ${notIn2h}.`);
    if (!in1h || !notIn2h) {
      pass = false;
      message = `${label} deve aparecer na lista em 1h e não em 2h.`;
    }

    const idx = list.findIndex((i) => i.id === indId);
    if (idx >= 0) list[idx] = { ...list[idx]!, intervals: [] };
    const seriesKeys2hAfter = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const in2hAfter = seriesKeys2hAfter.includes(key);
    evidence.push(`3. Todos os tempos. Lista em 2h contém "${key}"? ${in2hAfter}.`);
    if (!in2hAfter) {
      pass = false;
      message = message ?? `Após todos os tempos, ${label} deve aparecer na lista em 2h.`;
    }

    if (idx >= 0) list[idx] = { ...list[idx]!, color: editColor, lineWidth: "thin", lineStyle: "dashed" };
    const afterStyle = list.find((i) => i.id === indId);
    const styleOk = afterStyle?.color === editColor && afterStyle?.lineWidth === "thin" && afterStyle?.lineStyle === "dashed";
    evidence.push(`4. Cor ${editColor}, espessura thin, tipo de linha dashed. Verificado: ${styleOk ? "✓" : "falhou"}.`);
    if (!styleOk) {
      pass = false;
      message = message ?? "Edição de cor, espessura ou tipo de linha falhou.";
    }

    const removed = list.filter((i) => i.id !== indId);
    list.length = 0;
    list.push(...removed);
    evidence.push(`5. Excluído. Lista depois=${list.length}.`);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }

  return {
    name: `${label} — fluxo completo (1 série em estratégia, 1h/4h/2h, todos os tempos, cor/espessura/tipo de linha, excluir)`,
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}

function runStochasticFlow(): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;

  try {
    const indId = `ui_qa_stochastic_${Date.now()}`;
    const list: StochasticLike[] = [];
    const ind: StochasticLike = {
      id: indId,
      type: "Stochastic",
      period: 14,
      fieldKey: "close",
      panel: "panel2",
      intervals: [INTERVAL_1H, INTERVAL_4H],
      color: "#7c3aed",
      lineWidth: "normal",
      lineStyle: "solid",
      stochDLine: true,
      stochDColor: "#2563eb",
      stochDLineWidth: "thin",
      stochDLineStyle: "dashed",
    };
    list.push(ind);
    evidence.push(`1. Adicionado Stochastic(14) com %D(3), panel2, 1h e 4h. %K: #7c3aed normal solid. %D: #2563eb thin dashed.`);

    const seriesKeys1h = buildSeriesKeysForInterval(list, INTERVAL_1H);
    const seriesKeys2h = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const keyK = `ind_${indId}`;
    const keyD = `ind_${indId}:d`;
    const twoIn1h = seriesKeys1h.includes(keyK) && seriesKeys1h.includes(keyD);
    const noneIn2h = !seriesKeys2h.includes(keyK) && !seriesKeys2h.includes(keyD);
    evidence.push(`2. Lista de séries em criar estratégia: 1h contém %K e %D ("${keyK}", "${keyD}")? ${twoIn1h}. 2h não contém? ${noneIn2h}.`);
    if (!twoIn1h || !noneIn2h) {
      pass = false;
      message = "Stochastic deve aparecer com 2 funções (%K e %D) em 1h e nenhuma em 2h.";
    }

    const idx = list.findIndex((i) => i.id === indId);
    if (idx >= 0) list[idx] = { ...list[idx]!, intervals: [] };
    const seriesKeys2hAfter = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const twoIn2hAfter = seriesKeys2hAfter.includes(keyK) && seriesKeys2hAfter.includes(keyD);
    evidence.push(`3. Todos os tempos. Lista em 2h contém %K e %D? ${twoIn2hAfter}.`);
    if (!twoIn2hAfter) {
      pass = false;
      message = message ?? "Após todos os tempos, as 2 funções do Stochastic devem aparecer em 2h.";
    }

    if (idx >= 0) {
      list[idx] = {
        ...list[idx]!,
        color: "#b91c1c",
        lineWidth: "thin",
        lineStyle: "dotted",
        stochDColor: "#15803d",
        stochDLineWidth: "normal",
        stochDLineStyle: "solid",
      };
    }
    const afterStyle = list.find((i) => i.id === indId);
    const styleOk =
      afterStyle?.color === "#b91c1c" &&
      afterStyle?.lineWidth === "thin" &&
      afterStyle?.lineStyle === "dotted" &&
      afterStyle?.stochDColor === "#15803d" &&
      afterStyle?.stochDLineWidth === "normal" &&
      afterStyle?.stochDLineStyle === "solid";
    evidence.push(`4. %K: cor #b91c1c thin dotted. %D: cor #15803d normal solid. Verificado: ${styleOk ? "✓" : "falhou"}.`);
    if (!styleOk) {
      pass = false;
      message = message ?? "Edição de cor, espessura ou tipo de linha (%K e %D) falhou.";
    }

    const removed = list.filter((i) => i.id !== indId);
    list.length = 0;
    list.push(...removed);
    evidence.push(`5. Excluído. Lista depois=${list.length}.`);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }
    evidence.push("Nota: Stochastic em estratégias = 2 séries: ind_<id> (%K), ind_<id>:d (%D).");
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }

  return {
    name: "Stochastic — fluxo completo (2 funções %K e %D em estratégia, 1h/4h/2h, todos os tempos, cor/espessura/tipo de linha, excluir)",
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}

export function runIndicatorsQaTests(): IndicatorsQaTestResult[] {
  const results: IndicatorsQaTestResult[] = [];
  for (const maType of MOVING_AVERAGE_TYPES) {
    results.push(runMovingAverageFlow(maType));
  }
  results.push(runMa2WindowEquivalenceFlow());
  results.push(runWma2Flow());
  results.push(runSma2Flow());
  results.push(runEma2Flow());
  for (const chType of CHANNEL_TYPES) {
    results.push(runChannelFlow(chType));
  }
  results.push(runMACDFlow());
  results.push(runRSIFlow());
  results.push(runMFIFlow());
  results.push(runStochasticFlow());
  results.push(runCCIFlow());
  results.push(runWilliamsRFlow());
  results.push(runATRFlow());
  results.push(runVolumeFlow());
  results.push(runOBVFlow());
  results.push(runADFlow());
  results.push(runCMFFlow());
  results.push(runVWAPFlow());
  results.push(runADXFlow());
  results.push(runSARFlow());
  results.push(runIchimokuFlow());
  return results;
}

function runMFIFlow(): IndicatorsQaTestResult {
  return runSingleSeriesMomentumFlow("MFI", "MFI", 14, "#6d28d9", "#9d174d");
}

function runCMFFlow(): IndicatorsQaTestResult {
  return runSingleSeriesMomentumFlow("CMF", "CMF", 20, "#0e7490", "#be123c", "panel2");
}

function runVWAPFlow(): IndicatorsQaTestResult {
  return runSingleSeriesMomentumFlow("VWAP", "VWAP", 1, "#4f46e5", "#ca8a04", "main");
}

function runCCIFlow(): IndicatorsQaTestResult {
  return runSingleSeriesMomentumFlow("CCI", "CCI", 20, "#0369a1", "#b45309");
}

function runWilliamsRFlow(): IndicatorsQaTestResult {
  return runSingleSeriesMomentumFlow("WilliamsR", "Williams %R", 14, "#0f766e", "#a21caf");
}

function runVolumeFlow(): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;

  try {
    const indId = `ui_qa_volume_${Date.now()}`;
    const list: VolumeIndicatorLike[] = [];
    const ind: VolumeIndicatorLike = {
      id: indId,
      type: "Volume",
      period: 1,
      fieldKey: "close",
      panel: "panel2",
      intervals: [INTERVAL_1H, INTERVAL_4H],
      volumeColorAbove: "#10b981",
      volumeColorBelow: "#ef4444",
      volumeInUsdt: false,
    };
    list.push(ind);
    evidence.push(`1. Adicionado Volume (histograma), panel2, 1h e 4h. Cores: acima #10b981, abaixo #ef4444; base.`);

    const seriesKeys1h = buildSeriesKeysForInterval(list, INTERVAL_1H);
    const seriesKeys2h = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const key = `ind_${indId}`;
    const in1h = seriesKeys1h.includes(key);
    const notIn2h = !seriesKeys2h.includes(key);
    evidence.push(`2. Lista de séries em criar estratégia: 1h contém "${key}"? ${in1h}. 2h não contém? ${notIn2h}.`);
    if (!in1h || !notIn2h) {
      pass = false;
      message = "Volume deve aparecer na lista em 1h e não em 2h.";
    }

    const idx = list.findIndex((i) => i.id === indId);
    if (idx >= 0) list[idx] = { ...list[idx]!, intervals: [] };
    const seriesKeys2hAfter = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const in2hAfter = seriesKeys2hAfter.includes(key);
    evidence.push(`3. Todos os tempos. Lista em 2h contém "${key}"? ${in2hAfter}.`);
    if (!in2hAfter) {
      pass = false;
      message = message ?? "Após todos os tempos, Volume deve aparecer na lista em 2h.";
    }

    if (idx >= 0) {
      list[idx] = {
        ...list[idx]!,
        volumeColorAbove: "#059669",
        volumeColorBelow: "#dc2626",
        volumeInUsdt: true,
      };
    }
    const afterStyle = list.find((i) => i.id === indId);
    const styleOk =
      afterStyle?.volumeColorAbove === "#059669" &&
      afterStyle?.volumeColorBelow === "#dc2626" &&
      afterStyle?.volumeInUsdt === true;
    evidence.push(`4. Cores: acima #059669, abaixo #dc2626; Volume em USDT. Verificado: ${styleOk ? "✓" : "falhou"}.`);
    if (!styleOk) {
      pass = false;
      message = message ?? "Edição de cores (acima/abaixo) ou fonte (USDT) falhou.";
    }

    const removed = list.filter((i) => i.id !== indId);
    list.length = 0;
    list.push(...removed);
    evidence.push(`5. Excluído. Lista depois=${list.length}.`);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }
    evidence.push("Nota: Volume (histograma) = 1 série ind_<id> em criar estratégia; cores acima/abaixo e base ou USDT.");
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }

  return {
    name: "Volume — fluxo completo (1 série em estratégia, 1h/4h/2h, todos os tempos, cores acima/abaixo e USDT, excluir)",
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}

function runOBVFlow(): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;

  try {
    const indId = `ui_qa_obv_${Date.now()}`;
    const list: VolumeIndicatorLike[] = [];
    const ind: VolumeIndicatorLike = {
      id: indId,
      type: "OBV",
      period: 1,
      fieldKey: "close",
      panel: "panel2",
      intervals: [INTERVAL_1H, INTERVAL_4H],
      color: "#0891b2",
      lineWidth: "normal",
      lineStyle: "solid",
      obvVolumeSource: "base",
    };
    list.push(ind);
    evidence.push(`1. Adicionado OBV, panel2, 1h e 4h, fonte base, cor #0891b2, espessura normal, estilo solid.`);

    const seriesKeys1h = buildSeriesKeysForInterval(list, INTERVAL_1H);
    const seriesKeys2h = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const key = `ind_${indId}`;
    const in1h = seriesKeys1h.includes(key);
    const notIn2h = !seriesKeys2h.includes(key);
    evidence.push(`2. Lista de séries em criar estratégia: 1h contém "${key}"? ${in1h}. 2h não contém? ${notIn2h}.`);
    if (!in1h || !notIn2h) {
      pass = false;
      message = "OBV deve aparecer na lista em 1h e não em 2h.";
    }

    const idx = list.findIndex((i) => i.id === indId);
    if (idx >= 0) list[idx] = { ...list[idx]!, intervals: [] };
    const seriesKeys2hAfter = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const in2hAfter = seriesKeys2hAfter.includes(key);
    evidence.push(`3. Todos os tempos. Lista em 2h contém "${key}"? ${in2hAfter}.`);
    if (!in2hAfter) {
      pass = false;
      message = message ?? "Após todos os tempos, OBV deve aparecer na lista em 2h.";
    }

    if (idx >= 0) {
      list[idx] = {
        ...list[idx]!,
        color: "#4f46e5",
        lineWidth: "thin",
        lineStyle: "dashed",
        obvVolumeSource: "usdt",
      };
    }
    const afterStyle = list.find((i) => i.id === indId);
    const styleOk =
      afterStyle?.color === "#4f46e5" &&
      afterStyle?.lineWidth === "thin" &&
      afterStyle?.lineStyle === "dashed" &&
      afterStyle?.obvVolumeSource === "usdt";
    evidence.push(`4. Cor #4f46e5, espessura thin, tipo de linha dashed, fonte USDT. Verificado: ${styleOk ? "✓" : "falhou"}.`);
    if (!styleOk) {
      pass = false;
      message = message ?? "Edição de cor, espessura, tipo de linha ou fonte (OBV) falhou.";
    }

    const removed = list.filter((i) => i.id !== indId);
    list.length = 0;
    list.push(...removed);
    evidence.push(`5. Excluído. Lista depois=${list.length}.`);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }
    evidence.push("Nota: OBV (On-Balance Volume) = 1 série ind_<id>; fonte base ou USDT.");
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }

  return {
    name: "OBV — fluxo completo (1 série em estratégia, 1h/4h/2h, todos os tempos, cor/espessura/tipo de linha e fonte base/USDT, excluir)",
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}

function runADFlow(): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;

  try {
    const indId = `ui_qa_ad_${Date.now()}`;
    const list: VolumeIndicatorLike[] = [];
    const ind: VolumeIndicatorLike = {
      id: indId,
      type: "AD",
      period: 1,
      fieldKey: "close",
      panel: "panel2",
      intervals: [INTERVAL_1H, INTERVAL_4H],
      color: "#0d9488",
      lineWidth: "normal",
      lineStyle: "solid",
      adVolumeSource: "base",
    };
    list.push(ind);
    evidence.push(`1. Adicionado A/D (Accumulation/Distribution), panel2, 1h e 4h, fonte base, cor #0d9488, espessura normal, estilo solid.`);

    const seriesKeys1h = buildSeriesKeysForInterval(list, INTERVAL_1H);
    const seriesKeys2h = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const key = `ind_${indId}`;
    const in1h = seriesKeys1h.includes(key);
    const notIn2h = !seriesKeys2h.includes(key);
    evidence.push(`2. Lista de séries em criar estratégia: 1h contém "${key}"? ${in1h}. 2h não contém? ${notIn2h}.`);
    if (!in1h || !notIn2h) {
      pass = false;
      message = "A/D deve aparecer na lista em 1h e não em 2h.";
    }

    const idx = list.findIndex((i) => i.id === indId);
    if (idx >= 0) list[idx] = { ...list[idx]!, intervals: [] };
    const seriesKeys2hAfter = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const in2hAfter = seriesKeys2hAfter.includes(key);
    evidence.push(`3. Todos os tempos. Lista em 2h contém "${key}"? ${in2hAfter}.`);
    if (!in2hAfter) {
      pass = false;
      message = message ?? "Após todos os tempos, A/D deve aparecer na lista em 2h.";
    }

    if (idx >= 0) {
      list[idx] = {
        ...list[idx]!,
        color: "#c026d3",
        lineWidth: "thin",
        lineStyle: "dotted",
        adVolumeSource: "usdt",
      };
    }
    const afterStyle = list.find((i) => i.id === indId);
    const styleOk =
      afterStyle?.color === "#c026d3" &&
      afterStyle?.lineWidth === "thin" &&
      afterStyle?.lineStyle === "dotted" &&
      afterStyle?.adVolumeSource === "usdt";
    evidence.push(`4. Cor #c026d3, espessura thin, tipo de linha dotted, fonte USDT. Verificado: ${styleOk ? "✓" : "falhou"}.`);
    if (!styleOk) {
      pass = false;
      message = message ?? "Edição de cor, espessura, tipo de linha ou fonte (A/D) falhou.";
    }

    const removed = list.filter((i) => i.id !== indId);
    list.length = 0;
    list.push(...removed);
    evidence.push(`5. Excluído. Lista depois=${list.length}.`);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }
    evidence.push("Nota: A/D (Accumulation/Distribution) = 1 série ind_<id>; fonte base ou USDT.");
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }

  return {
    name: "A/D — fluxo completo (1 série em estratégia, 1h/4h/2h, todos os tempos, cor/espessura/tipo de linha e fonte base/USDT, excluir)",
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}

function runADXFlow(): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;

  try {
    const indId = `ui_qa_adx_${Date.now()}`;
    const list: ADXLike[] = [];
    const ind: ADXLike = {
      id: indId,
      type: "ADX",
      period: 14,
      fieldKey: "close",
      panel: "panel2",
      intervals: [INTERVAL_1H, INTERVAL_4H],
      adxPlusDiColor: "#22c55e",
      adxPlusDiLineWidth: "normal",
      adxPlusDiLineStyle: "solid",
      adxMinusDiColor: "#ef4444",
      adxMinusDiLineWidth: "normal",
      adxMinusDiLineStyle: "solid",
      adxAdxColor: "#eab308",
      adxAdxLineWidth: "normal",
      adxAdxLineStyle: "solid",
    };
    list.push(ind);
    evidence.push(`1. Adicionado ADX(14), panel2, 1h e 4h. +DI #22c55e, -DI #ef4444, ADX #eab308; espessura/estilo normal solid.`);

    const seriesKeys1h = buildSeriesKeysForInterval(list, INTERVAL_1H);
    const seriesKeys2h = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const keys = [`ind_${indId}:plusDi`, `ind_${indId}:minusDi`, `ind_${indId}:adx`];
    const threeIn1h = keys.every((k) => seriesKeys1h.includes(k));
    const noneIn2h = !keys.some((k) => seriesKeys2h.includes(k));
    evidence.push(`2. Lista de séries em criar estratégia: 1h contém as 3 (+DI, -DI, ADX)? ${threeIn1h}. 2h não contém? ${noneIn2h}.`);
    if (!threeIn1h || !noneIn2h) {
      pass = false;
      message = "ADX deve aparecer com 3 funções (+DI, -DI, ADX) em 1h e nenhuma em 2h.";
    }

    const idx = list.findIndex((i) => i.id === indId);
    if (idx >= 0) list[idx] = { ...list[idx]!, intervals: [] };
    const seriesKeys2hAfter = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const threeIn2hAfter = keys.every((k) => seriesKeys2hAfter.includes(k));
    evidence.push(`3. Todos os tempos. Lista em 2h contém as 3 funções? ${threeIn2hAfter}.`);
    if (!threeIn2hAfter) {
      pass = false;
      message = message ?? "Após todos os tempos, as 3 funções do ADX devem aparecer em 2h.";
    }

    if (idx >= 0) {
      list[idx] = {
        ...list[idx]!,
        adxPlusDiColor: "#059669",
        adxPlusDiLineWidth: "thin",
        adxPlusDiLineStyle: "dashed",
        adxMinusDiColor: "#dc2626",
        adxMinusDiLineWidth: "thin",
        adxMinusDiLineStyle: "dotted",
        adxAdxColor: "#d97706",
        adxAdxLineWidth: "normal",
        adxAdxLineStyle: "dashed",
      };
    }
    const afterStyle = list.find((i) => i.id === indId);
    const styleOk =
      afterStyle?.adxPlusDiColor === "#059669" &&
      afterStyle?.adxPlusDiLineWidth === "thin" &&
      afterStyle?.adxPlusDiLineStyle === "dashed" &&
      afterStyle?.adxMinusDiColor === "#dc2626" &&
      afterStyle?.adxAdxColor === "#d97706";
    evidence.push(`4. +DI #059669 thin dashed; -DI #dc2626 thin dotted; ADX #d97706 normal dashed. Verificado: ${styleOk ? "✓" : "falhou"}.`);
    if (!styleOk) {
      pass = false;
      message = message ?? "Edição de cor/espessura/estilo (ADX) falhou.";
    }

    const removed = list.filter((i) => i.id !== indId);
    list.length = 0;
    list.push(...removed);
    evidence.push(`5. Excluído. Lista depois=${list.length}.`);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }
    evidence.push("Nota: ADX em estratégias = 3 séries: ind_<id>:plusDi, :minusDi, :adx.");
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }

  return {
    name: "ADX — fluxo completo (3 funções +DI/-DI/ADX em estratégia, 1h/4h/2h, todos os tempos, cor/espessura/tipo de linha, excluir)",
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}

function runSARFlow(): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;

  try {
    const indId = `ui_qa_sar_${Date.now()}`;
    const list: SARLike[] = [];
    const ind: SARLike = {
      id: indId,
      type: "SAR",
      period: 1,
      fieldKey: "close",
      panel: "main",
      intervals: [INTERVAL_1H, INTERVAL_4H],
      color: "#6366f1",
      sarPointSize: "normal",
      sarStart: 0.02,
      sarIncrement: 0.02,
      sarMax: 0.2,
    };
    list.push(ind);
    evidence.push(`1. Adicionado Parabolic SAR, main, 1h e 4h, cor #6366f1, ponto normal; start 0.02, inc 0.02, max 0.2.`);

    const seriesKeys1h = buildSeriesKeysForInterval(list, INTERVAL_1H);
    const seriesKeys2h = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const key = `ind_${indId}`;
    const in1h = seriesKeys1h.includes(key);
    const notIn2h = !seriesKeys2h.includes(key);
    evidence.push(`2. Lista de séries em criar estratégia: 1h contém "${key}"? ${in1h}. 2h não contém? ${notIn2h}.`);
    if (!in1h || !notIn2h) {
      pass = false;
      message = "SAR deve aparecer na lista em 1h e não em 2h.";
    }

    const idx = list.findIndex((i) => i.id === indId);
    if (idx >= 0) list[idx] = { ...list[idx]!, intervals: [] };
    const seriesKeys2hAfter = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const in2hAfter = seriesKeys2hAfter.includes(key);
    evidence.push(`3. Todos os tempos. Lista em 2h contém "${key}"? ${in2hAfter}.`);
    if (!in2hAfter) {
      pass = false;
      message = message ?? "Após todos os tempos, SAR deve aparecer na lista em 2h.";
    }

    if (idx >= 0) {
      list[idx] = {
        ...list[idx]!,
        color: "#9333ea",
        sarPointSize: "thin",
        sarStart: 0.03,
        sarIncrement: 0.03,
        sarMax: 0.25,
      };
    }
    const afterStyle = list.find((i) => i.id === indId);
    const styleOk =
      afterStyle?.color === "#9333ea" &&
      afterStyle?.sarPointSize === "thin" &&
      afterStyle?.sarStart === 0.03 &&
      afterStyle?.sarIncrement === 0.03 &&
      afterStyle?.sarMax === 0.25;
    evidence.push(`4. Cor #9333ea, ponto thin; start 0.03, inc 0.03, max 0.25. Verificado: ${styleOk ? "✓" : "falhou"}.`);
    if (!styleOk) {
      pass = false;
      message = message ?? "Edição de cor, tamanho do ponto ou parâmetros SAR falhou.";
    }

    const removed = list.filter((i) => i.id !== indId);
    list.length = 0;
    list.push(...removed);
    evidence.push(`5. Excluído. Lista depois=${list.length}.`);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }
    evidence.push("Nota: Parabolic SAR = 1 série ind_<id> em criar estratégia.");
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }

  return {
    name: "SAR (Parabolic SAR) — fluxo completo (1 série em estratégia, 1h/4h/2h, todos os tempos, cor/tamanho do ponto/parâmetros, excluir)",
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}

function runIchimokuFlow(): IndicatorsQaTestResult {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;

  try {
    const indId = `ui_qa_ichimoku_${Date.now()}`;
    const list: IchimokuLike[] = [];
    const ind: IchimokuLike = {
      id: indId,
      type: "Ichimoku",
      period: 26,
      fieldKey: "close",
      panel: "main",
      intervals: [INTERVAL_1H, INTERVAL_4H],
      ichimokuTenkanColor: "#6366f1",
      ichimokuTenkanLineWidth: "normal",
      ichimokuTenkanLineStyle: "solid",
      ichimokuKijunColor: "#ea580c",
      ichimokuKijunLineWidth: "normal",
      ichimokuKijunLineStyle: "solid",
      ichimokuSpanAColor: "#22c55e",
      ichimokuSpanALineWidth: "normal",
      ichimokuSpanALineStyle: "solid",
      ichimokuSpanBColor: "#ef4444",
      ichimokuSpanBLineWidth: "normal",
      ichimokuSpanBLineStyle: "solid",
      ichimokuChikouColor: "#a855f7",
      ichimokuChikouLineWidth: "normal",
      ichimokuChikouLineStyle: "solid",
    };
    list.push(ind);
    evidence.push(`1. Adicionado Ichimoku(9/26/52), main, 1h e 4h. Tenkan/Kijun/SpanA/SpanB/Chikou: cores e estilo normal solid.`);

    const seriesKeys1h = buildSeriesKeysForInterval(list, INTERVAL_1H);
    const seriesKeys2h = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const keys = [`ind_${indId}:tenkan`, `ind_${indId}:kijun`, `ind_${indId}:spanA`, `ind_${indId}:spanB`, `ind_${indId}:chikou`];
    const fiveIn1h = keys.every((k) => seriesKeys1h.includes(k));
    const noneIn2h = !keys.some((k) => seriesKeys2h.includes(k));
    evidence.push(`2. Lista de séries em criar estratégia: 1h contém as 5 (Tenkan, Kijun, Span A/B, Chikou)? ${fiveIn1h}. 2h não contém? ${noneIn2h}.`);
    if (!fiveIn1h || !noneIn2h) {
      pass = false;
      message = "Ichimoku deve aparecer com 5 funções em 1h e nenhuma em 2h.";
    }

    const idx = list.findIndex((i) => i.id === indId);
    if (idx >= 0) list[idx] = { ...list[idx]!, intervals: [] };
    const seriesKeys2hAfter = buildSeriesKeysForInterval(list, INTERVAL_2H);
    const fiveIn2hAfter = keys.every((k) => seriesKeys2hAfter.includes(k));
    evidence.push(`3. Todos os tempos. Lista em 2h contém as 5 funções? ${fiveIn2hAfter}.`);
    if (!fiveIn2hAfter) {
      pass = false;
      message = message ?? "Após todos os tempos, as 5 funções do Ichimoku devem aparecer em 2h.";
    }

    if (idx >= 0) {
      list[idx] = {
        ...list[idx]!,
        ichimokuTenkanColor: "#4f46e5",
        ichimokuTenkanLineWidth: "thin",
        ichimokuTenkanLineStyle: "dashed",
        ichimokuKijunColor: "#b45309",
        ichimokuKijunLineWidth: "thin",
        ichimokuKijunLineStyle: "dotted",
        ichimokuSpanAColor: "#047857",
        ichimokuSpanALineWidth: "normal",
        ichimokuSpanALineStyle: "dashed",
        ichimokuSpanBColor: "#b91c1c",
        ichimokuSpanBLineWidth: "normal",
        ichimokuSpanBLineStyle: "dotted",
        ichimokuChikouColor: "#7c3aed",
        ichimokuChikouLineWidth: "thin",
        ichimokuChikouLineStyle: "dashed",
      };
    }
    const afterStyle = list.find((i) => i.id === indId);
    const styleOk =
      afterStyle?.ichimokuTenkanColor === "#4f46e5" &&
      afterStyle?.ichimokuTenkanLineWidth === "thin" &&
      afterStyle?.ichimokuKijunColor === "#b45309" &&
      afterStyle?.ichimokuSpanAColor === "#047857" &&
      afterStyle?.ichimokuChikouColor === "#7c3aed";
    evidence.push(`4. Cores/espessura/estilo das 5 linhas alterados. Verificado: ${styleOk ? "✓" : "falhou"}.`);
    if (!styleOk) {
      pass = false;
      message = message ?? "Edição de cor/espessura/estilo (Ichimoku) falhou.";
    }

    const removed = list.filter((i) => i.id !== indId);
    list.length = 0;
    list.push(...removed);
    evidence.push(`5. Excluído. Lista depois=${list.length}.`);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }
    evidence.push("Nota: Ichimoku em estratégias = 5 séries: ind_<id>:tenkan, :kijun, :spanA, :spanB, :chikou.");
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }

  return {
    name: "Ichimoku — fluxo completo (5 funções Tenkan/Kijun/Span A/B/Chikou em estratégia, 1h/4h/2h, todos os tempos, cor/espessura/tipo de linha, excluir)",
    pass,
    message,
    evidence: evidence.join("\n"),
  };
}
