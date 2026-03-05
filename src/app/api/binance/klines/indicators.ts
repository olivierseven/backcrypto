/**
 * Indicadores calculados sobre o array de klines retornado pela API.
 * Kline: [0] openTime, [1] open, [2] high, [3] low, [4] close, [5] volume, ...
 * Dados chegam em ordem DESC (índice 0 = mais recente).
 * Cada indicador é adicionado como novo elemento ao final de cada linha (12+).
 */

/** Índice da coluna close no array kline. */
export const CLOSE_INDEX = 4;

/**
 * Média móvel simples sobre uma coluna do array de klines (janela [i, i+period) em dados DESC).
 * Exportada para uso no cliente (cálculo de indicadores do usuário).
 */
export function computeSmaColumn(
  data: (string | number)[][],
  valueIndex: number,
  period: number
): (number | null)[] {
  const n = data.length;
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const end = Math.min(i + period, n);
    let sum = 0;
    let count = 0;
    for (let j = i; j < end; j++) {
      const raw = data[j]?.[valueIndex];
      if (raw != null) {
        const v = Number(raw);
        if (Number.isFinite(v)) {
          sum += v;
          count += 1;
        }
      }
    }
    out.push(count > 0 ? sum / count : null);
  }
  return out;
}

/**
 * Média móvel exponencial (EMA) sobre uma coluna do array de klines (dados DESC).
 * α = 2/(period+1). Inicializa com SMA dos primeiros "period" pontos (em ordem de tempo)
 * e depois EMA[i] = α*value[i] + (1-α)*EMA[i+1] do mais antigo para o mais recente.
 */
export function computeEmaColumn(
  data: (string | number)[][],
  valueIndex: number,
  period: number
): (number | null)[] {
  const n = data.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (period < 1 || n < period) return out;
  const alpha = 2 / (period + 1);
  const startIdx = n - period; // primeira janela completa (em ordem tempo: índices startIdx..n-1)
  let sum = 0;
  let count = 0;
  for (let j = startIdx; j < n; j++) {
    const raw = data[j]?.[valueIndex];
    if (raw != null) {
      const v = Number(raw);
      if (Number.isFinite(v)) {
        sum += v;
        count += 1;
      }
    }
  }
  const initial = count > 0 ? sum / count : null;
  if (initial == null) return out;
  out[startIdx] = initial;
  for (let j = startIdx - 1; j >= 0; j--) {
    const raw = data[j]?.[valueIndex];
    if (raw != null) {
      const v = Number(raw);
      if (Number.isFinite(v) && out[j + 1] != null) {
        out[j] = alpha * v + (1 - alpha) * (out[j + 1] as number);
      } else {
        out[j] = out[j + 1];
      }
    } else {
      out[j] = out[j + 1];
    }
  }
  // índices sem janela completa (mais antigos que startIdx em tempo = j > startIdx)
  for (let j = startIdx + 1; j < n; j++) out[j] = null;
  return out;
}

/**
 * Média móvel ponderada (WMA) sobre uma coluna do array de klines (janela [i, i+period) em DESC).
 * Peso period no índice i (mais recente), period-1 em i+1, ..., 1 em i+period-1.
 * Denominador = 1+2+...+period = period*(period+1)/2.
 */
export function computeWmaColumn(
  data: (string | number)[][],
  valueIndex: number,
  period: number
): (number | null)[] {
  const n = data.length;
  const denom = (period * (period + 1)) / 2;
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let totalWeight = 0;
    for (let k = 0; k < period && i + k < n; k++) {
      const raw = data[i + k]?.[valueIndex];
      if (raw != null) {
        const v = Number(raw);
        if (Number.isFinite(v)) {
          const w = period - k;
          sum += w * v;
          totalWeight += w;
        }
      }
    }
    if (totalWeight > 0 && totalWeight === denom) {
      out.push(sum / denom);
    } else if (totalWeight > 0) {
      out.push(sum / totalWeight);
    } else {
      out.push(null);
    }
  }
  return out;
}

/**
 * Desvio padrão (populacional) da janela [i, i+period) em dados DESC.
 * DP = sqrt( média dos (x - média)² ).
 */
export function computeStdColumn(
  data: (string | number)[][],
  valueIndex: number,
  period: number
): (number | null)[] {
  const n = data.length;
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const end = Math.min(i + period, n);
    let sum = 0;
    let count = 0;
    const vals: number[] = [];
    for (let j = i; j < end; j++) {
      const raw = data[j]?.[valueIndex];
      if (raw != null) {
        const v = Number(raw);
        if (Number.isFinite(v)) {
          sum += v;
          count++;
          vals.push(v);
        }
      }
    }
    if (count < 2) {
      out.push(null);
      continue;
    }
    const mean = sum / count;
    let sqSum = 0;
    for (let k = 0; k < vals.length; k++) {
      const d = vals[k]! - mean;
      sqSum += d * d;
    }
    const variance = sqSum / count;
    out.push(Math.sqrt(variance));
  }
  return out;
}

export type BollingerMaType = "SMA" | "EMA" | "WMA";

/**
 * Bollinger Bands: MM(T) = média móvel do campo no período T; DP(T) = desvio padrão no período T.
 * Banda superior = MM(T) + Z * DP(T), banda inferior = MM(T) - Z * DP(T).
 * Retorna três colunas: upper, middle, lower (todas no mesmo tamanho que data).
 */
export function computeBollingerBands(
  data: (string | number)[][],
  valueIndex: number,
  period: number,
  maType: BollingerMaType,
  z: number
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const periodUse = Math.max(1, Math.min(500, period));
  const zUse = Math.max(0, Math.min(3, z));
  const middle =
    maType === "EMA"
      ? computeEmaColumn(data, valueIndex, periodUse)
      : maType === "WMA"
        ? computeWmaColumn(data, valueIndex, periodUse)
        : computeSmaColumn(data, valueIndex, periodUse);
  const std = computeStdColumn(data, valueIndex, periodUse);
  const n = data.length;
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const m = middle[i];
    const s = std[i];
    if (m != null && s != null && Number.isFinite(m) && Number.isFinite(s)) {
      const half = zUse * s;
      upper.push(m + half);
      lower.push(m - half);
    } else {
      upper.push(null);
      lower.push(null);
    }
  }
  return { upper, middle, lower };
}

/**
 * RSI (Índice de Força Relativa) sobre uma coluna (tipicamente close).
 * Período padrão 14. Suavização de Wilder: primeira média = SMA dos primeiros "period" ganhos/perdas,
 * depois média suavizada = (anterior * (period-1) + atual) / period.
 * Retorna valores entre 0 e 100 (ou null quando não há dados suficientes).
 * Dados em ordem DESC (índice 0 = mais recente).
 */
export function computeRsiColumn(
  data: (string | number)[][],
  valueIndex: number,
  period: number
): (number | null)[] {
  const n = data.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (period < 1 || n < period + 2) return out;

  const getNum = (row: (string | number)[], col: number): number | null => {
    const raw = row?.[col];
    if (raw == null) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };

  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const cur = getNum(data[i], valueIndex);
    const prev = getNum(data[i + 1], valueIndex);
    if (cur == null || prev == null) {
      gains.push(0);
      losses.push(0);
    } else {
      const ch = cur - prev;
      gains.push(ch > 0 ? ch : 0);
      losses.push(ch < 0 ? -ch : 0);
    }
  }

  const startIdx = n - period - 1;
  let sumG = 0;
  let sumL = 0;
  for (let j = startIdx; j < startIdx + period && j < gains.length; j++) {
    sumG += gains[j];
    sumL += losses[j];
  }
  let avgGain = sumG / period;
  let avgLoss = sumL / period;

  const rsiFromAvgs = (ag: number, al: number): number => {
    if (al === 0) return 100;
    const rs = ag / al;
    return 100 - 100 / (1 + rs);
  };

  out[startIdx] = rsiFromAvgs(avgGain, avgLoss);

  for (let j = startIdx - 1; j >= 0; j--) {
    avgGain = (avgGain * (period - 1) + gains[j]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[j]) / period;
    out[j] = rsiFromAvgs(avgGain, avgLoss);
  }

  return out;
}

export type MaType = "SMA" | "EMA" | "WMA";

function computeMaColumn(
  data: (string | number)[][],
  valueIndex: number,
  maType: MaType,
  period: number
): (number | null)[] {
  if (maType === "EMA") return computeEmaColumn(data, valueIndex, period);
  if (maType === "WMA") return computeWmaColumn(data, valueIndex, period);
  return computeSmaColumn(data, valueIndex, period);
}

/**
 * Estocástico %K: 100 * (price - lowestLow) / (highestHigh - lowestLow) na janela dos últimos "period" candles.
 * Dados em ordem DESC (índice 0 = mais recente). Retorna valores entre 0 e 100 (ou null).
 * - Sobre preço (valueIndex 1=open, 4=close): highestHigh/lowestLow usam high[2] e low[3]; price usa valueIndex.
 * - Sobre outro indicador (valueIndex >= 12): usa a mesma coluna para min/max no período e valor atual (Stochastic do indicador).
 */
export function computeStochasticKColumn(
  data: (string | number)[][],
  period: number,
  valueIndex: number
): (number | null)[] {
  const n = data.length;
  const out: (number | null)[] = [];
  const getNum = (row: (string | number)[], col: number): number | null => {
    const raw = row?.[col];
    if (raw == null) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };
  const isOhlc = valueIndex >= 1 && valueIndex <= 4;
  for (let i = 0; i < n; i++) {
    let lowest: number | null = null;
    let highest: number | null = null;
    for (let j = i; j < Math.min(i + period, n); j++) {
      if (isOhlc) {
        const low = getNum(data[j], 3);
        const high = getNum(data[j], 2);
        if (low != null && (lowest == null || low < lowest)) lowest = low;
        if (high != null && (highest == null || high > highest)) highest = high;
      } else {
        const v = getNum(data[j], valueIndex);
        if (v != null) {
          if (lowest == null || v < lowest) lowest = v;
          if (highest == null || v > highest) highest = v;
        }
      }
    }
    const price = getNum(data[i], valueIndex);
    if (price == null || lowest == null || highest == null || highest === lowest) {
      out.push(null);
      continue;
    }
    const k = 100 * (price - lowest) / (highest - lowest);
    out.push(Math.max(0, Math.min(100, k)));
  }
  return out;
}

/**
 * Williams %R: -100 * (Highest High - Close) / (Highest High - Lowest Low) na janela dos últimos "period" candles.
 * Praticamente o inverso do estocástico: escala -100 a 0. Overbought perto de -20, oversold perto de -80.
 * Dados em ordem DESC; usa high[2], low[3], price = valueIndex (tipicamente close 4).
 */
export function computeWilliamsRColumn(
  data: (string | number)[][],
  period: number,
  valueIndex: number
): (number | null)[] {
  const n = data.length;
  const out: (number | null)[] = [];
  const getNum = (row: (string | number)[], col: number): number | null => {
    const raw = row?.[col];
    if (raw == null) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };
  for (let i = 0; i < n; i++) {
    let lowest: number | null = null;
    let highest: number | null = null;
    for (let j = i; j < Math.min(i + period, n); j++) {
      const low = getNum(data[j], 3);
      const high = getNum(data[j], 2);
      if (low != null && (lowest == null || low < lowest)) lowest = low;
      if (high != null && (highest == null || high > highest)) highest = high;
    }
    const price = getNum(data[i], valueIndex);
    if (price == null || lowest == null || highest == null || highest === lowest) {
      out.push(null);
      continue;
    }
    const wr = -100 * (highest - price) / (highest - lowest);
    out.push(Math.max(-100, Math.min(0, wr)));
  }
  return out;
}

/** Índice da coluna volume no array kline. */
export const VOLUME_INDEX = 5;

/**
 * OBV (On-Balance Volume): volume acumulado com sinal dado pela variação do close.
 * Se close atual > close anterior: OBV += volume; se close < anterior: OBV -= volume; senão mantém.
 * Dados em ordem DESC (índice 0 = mais recente). Usa close[4] e volume[5].
 */
export function computeObvColumn(data: (string | number)[][]): (number | null)[] {
  const n = data.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n === 0) return out;
  const getNum = (row: (string | number)[], col: number): number | null => {
    const raw = row?.[col];
    if (raw == null) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };
  const closeIdx = 4;
  const volIdx = 5;
  out[n - 1] = 0;
  for (let j = n - 2; j >= 0; j--) {
    const prevObv = out[j + 1];
    if (prevObv == null) {
      out[j] = null;
      continue;
    }
    const currClose = getNum(data[j], closeIdx);
    const prevClose = getNum(data[j + 1], closeIdx);
    const vol = getNum(data[j], volIdx);
    if (vol == null) {
      out[j] = prevObv;
      continue;
    }
    if (currClose == null || prevClose == null) {
      out[j] = prevObv;
      continue;
    }
    if (currClose > prevClose) out[j] = prevObv + vol;
    else if (currClose < prevClose) out[j] = prevObv - vol;
    else out[j] = prevObv;
  }
  return out;
}

/**
 * Average True Range (ATR) — Wilder.
 * TR = max(H-L, |H-prevClose|, |L-prevClose|). ATR = RMA (Wilder smoothing) de TR com o período dado.
 * Dados em ordem DESC (índice 0 = mais recente). Usa apenas high, low, close (sem escolha de campo).
 */
export function computeAtrColumn(
  data: (string | number)[][],
  period: number
): (number | null)[] {
  const n = data.length;
  const out: (number | null)[] = new Array(n).fill(null);
  const periodUse = Math.max(1, Math.min(500, period));
  if (n < periodUse) return out;

  const get = (row: (string | number)[], col: number): number | null => {
    const raw = row?.[col];
    if (raw == null) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };

  const tr: (number | null)[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const h = get(data[i], 2);
    const l = get(data[i], 3);
    if (h == null || l == null) {
      tr[i] = null;
      continue;
    }
    if (i + 1 >= n) {
      tr[i] = h - l;
      continue;
    }
    const prevC = get(data[i + 1], CLOSE_INDEX);
    if (prevC == null) {
      tr[i] = h - l;
      continue;
    }
    const hl = h - l;
    const hc = Math.abs(h - prevC);
    const lc = Math.abs(l - prevC);
    tr[i] = Math.max(hl, hc, lc);
  }

  const startIdx = n - periodUse;
  let sum = 0;
  let count = 0;
  for (let j = startIdx; j < n; j++) {
    if (tr[j] != null) {
      sum += tr[j]!;
      count++;
    }
  }
  if (count < periodUse) return out;
  out[startIdx] = sum / periodUse;
  for (let j = startIdx - 1; j >= 0; j--) {
    if (tr[j] != null && out[j + 1] != null) {
      out[j] = ((out[j + 1] as number) * (periodUse - 1) + tr[j]!) / periodUse;
    } else {
      out[j] = out[j + 1];
    }
  }
  return out;
}

/** Um dia em ms (UTC). */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * VWAP (Volume Weighted Average Price).
 * Preço típico = (High + Low + Close) / 3. Por sessão (dia UTC): VWAP = cumulativo(TP * Volume) / cumulativo(Volume).
 * Reinicia a cada novo dia. Dados em ordem DESC (índice 0 = mais recente). Usa high[2], low[3], close[4], volume[5].
 */
export function computeVwapColumn(data: (string | number)[][]): (number | null)[] {
  const n = data.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n === 0) return out;

  const get = (row: (string | number)[], col: number): number | null => {
    const raw = row?.[col];
    if (raw == null) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };

  let prevDay = -1;
  let cumTPV = 0;
  let cumV = 0;

  for (let j = n - 1; j >= 0; j--) {
    const openTime = get(data[j], 0);
    const h = get(data[j], 2);
    const l = get(data[j], 3);
    const c = get(data[j], CLOSE_INDEX);
    const v = get(data[j], 5);
    if (openTime == null) continue;
    const day = Math.floor(openTime / MS_PER_DAY);
    if (day !== prevDay) {
      prevDay = day;
      cumTPV = 0;
      cumV = 0;
    }
    if (h == null || l == null || c == null || v == null || v <= 0) {
      out[j] = cumV > 0 ? cumTPV / cumV : null;
      continue;
    }
    const tp = (h + l + c) / 3;
    cumTPV += tp * v;
    cumV += v;
    out[j] = cumV > 0 ? cumTPV / cumV : null;
  }
  return out;
}

/** Índices high, low, close no array kline. */
const HIGH_INDEX = 2;
const LOW_INDEX = 3;

/**
 * Parabolic SAR (Stop and Reverse) — Wilder (1978).
 * Parâmetros: start (AF inicial, default 0.02), increment (incremento do AF, default 0.02), max (AF máximo, default 0.2).
 * Dados em ordem DESC (índice 0 = mais recente). Usa high, low, close.
 */
export function computeParabolicSarColumn(
  data: (string | number)[][],
  start: number,
  increment: number,
  max: number
): (number | null)[] {
  const n = data.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < 2) return out;

  const get = (row: (string | number)[], col: number): number | null => {
    const raw = row?.[col];
    if (raw == null) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };

  const startVal = Math.max(0.001, Math.min(1, start));
  const incVal = Math.max(0.001, Math.min(1, increment));
  const maxVal = Math.max(startVal, Math.min(1, max));

  // Barra mais antiga (índice n-1): SAR não definido
  let trend: "up" | "down" = "up";
  let sar: number;
  let ep: number;
  let af: number;

  const c0 = get(data[n - 1], CLOSE_INDEX);
  const c1 = get(data[n - 2], CLOSE_INDEX);
  const h0 = get(data[n - 1], HIGH_INDEX);
  const l0 = get(data[n - 1], LOW_INDEX);
  const h1 = get(data[n - 2], HIGH_INDEX);
  const l1 = get(data[n - 2], LOW_INDEX);
  if (c0 == null || c1 == null || h0 == null || l0 == null || h1 == null || l1 == null) return out;

  if (c1 > c0) {
    trend = "up";
    sar = l0;
    ep = l1;
  } else {
    trend = "down";
    sar = h0;
    ep = h1;
  }
  af = startVal;
  out[n - 2] = sar;

  for (let i = n - 3; i >= 0; i--) {
    const high = get(data[i], HIGH_INDEX);
    const low = get(data[i], LOW_INDEX);
    const prevLow = get(data[i + 1], LOW_INDEX);
    const prevHigh = get(data[i + 1], HIGH_INDEX);
    const prevPrevLow = i + 2 < n ? get(data[i + 2], LOW_INDEX) : null;
    const prevPrevHigh = i + 2 < n ? get(data[i + 2], HIGH_INDEX) : null;
    if (high == null || low == null || prevLow == null || prevHigh == null) {
      out[i] = sar;
      continue;
    }

    let sarNew = sar + af * (ep - sar);

    // Reversão
    if (trend === "up" && low < sar) {
      trend = "down";
      sar = ep;
      ep = high;
      af = startVal;
      out[i] = sar;
      continue;
    }
    if (trend === "down" && high > sar) {
      trend = "up";
      sar = ep;
      ep = low;
      af = startVal;
      out[i] = sar;
      continue;
    }

    // Restrição: em uptrend SAR não pode ficar acima dos dois lows anteriores; em downtrend não abaixo dos dois highs
    if (trend === "up") {
      if (prevPrevLow != null && sarNew > prevPrevLow) sarNew = prevPrevLow;
      if (sarNew > prevLow) sarNew = prevLow;
    } else {
      if (prevPrevHigh != null && sarNew < prevPrevHigh) sarNew = prevPrevHigh;
      if (sarNew < prevHigh) sarNew = prevHigh;
    }

    sar = sarNew;
    out[i] = sar;

    // Atualizar EP e AF
    if (trend === "up") {
      if (high > ep) {
        ep = high;
        af = Math.min(af + incVal, maxVal);
      }
    } else {
      if (low < ep) {
        ep = low;
        af = Math.min(af + incVal, maxVal);
      }
    }
  }

  return out;
}

/**
 * MACD line = fast MA - slow MA (diferença entre duas médias móveis).
 * Indicador secundário: valores podem ser negativos; escala automática no painel.
 * Dados em ordem DESC (índice 0 = mais recente).
 */
export function computeMacdColumn(
  data: (string | number)[][],
  valueIndex: number,
  fastMaType: MaType,
  fastPeriod: number,
  slowMaType: MaType,
  slowPeriod: number
): (number | null)[] {
  const fast = computeMaColumn(data, valueIndex, fastMaType, Math.max(1, fastPeriod));
  const slow = computeMaColumn(data, valueIndex, slowMaType, Math.max(1, slowPeriod));
  const n = data.length;
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const f = fast[i];
    const s = slow[i];
    if (f != null && s != null && Number.isFinite(f) && Number.isFinite(s)) {
      out.push(f - s);
    } else {
      out.push(null);
    }
  }
  return out;
}
