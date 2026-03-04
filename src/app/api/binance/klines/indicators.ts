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
