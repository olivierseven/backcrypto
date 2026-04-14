/**
 * Ajuste mínimos quadrados para regressão sobre índices x = 0..n-1 (velas da amostra).
 */

export type LinearCoeffs = { a0: number; a1: number };
export type QuadraticCoeffs = { a0: number; a1: number; a2: number };
export type CubicCoeffs = { a0: number; a1: number; a2: number; a3: number };
export type QuarticCoeffs = { a0: number; a1: number; a2: number; a3: number; a4: number };

export function fitLinear(xs: number[], ys: number[]): LinearCoeffs | null {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return null;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumXY += x * y;
  }
  const den = n * sumXX - sumX * sumX;
  if (Math.abs(den) < 1e-18) return null;
  const a1 = (n * sumXY - sumX * sumY) / den;
  const a0 = (sumY - a1 * sumX) / n;
  if (!Number.isFinite(a0) || !Number.isFinite(a1)) return null;
  return { a0, a1 };
}

function solve3x3(A: number[][], b: number[]): number[] | null {
  const M = A.map((row, i) => [...row, b[i]]);
  const n = 3;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-18) return null;
    if (pivot !== col) [M[col], M[pivot]] = [M[pivot], M[col]];
    const div = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return [M[0][3], M[1][3], M[2][3]];
}

function solve4x4(A: number[][], b: number[]): number[] | null {
  const M = A.map((row, i) => [...row, b[i]]);
  const n = 4;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-18) return null;
    if (pivot !== col) [M[col], M[pivot]] = [M[pivot], M[col]];
    const div = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return [M[0][4], M[1][4], M[2][4], M[3][4]];
}

function solve5x5(A: number[][], b: number[]): number[] | null {
  const M = A.map((row, i) => [...row, b[i]]);
  const n = 5;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-18) return null;
    if (pivot !== col) [M[col], M[pivot]] = [M[pivot], M[col]];
    const div = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return [M[0][5], M[1][5], M[2][5], M[3][5], M[4][5]];
}

export function fitQuadratic(xs: number[], ys: number[]): QuadraticCoeffs | null {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  let S0 = n;
  let S1 = 0;
  let S2 = 0;
  let S3 = 0;
  let S4 = 0;
  let T0 = 0;
  let T1 = 0;
  let T2 = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const x2 = x * x;
    S1 += x;
    S2 += x2;
    S3 += x2 * x;
    S4 += x2 * x2;
    T0 += y;
    T1 += x * y;
    T2 += x2 * y;
  }
  const sol = solve3x3(
    [
      [S0, S1, S2],
      [S1, S2, S3],
      [S2, S3, S4],
    ],
    [T0, T1, T2]
  );
  if (!sol) return null;
  const [a0, a1, a2] = sol;
  if (!Number.isFinite(a0) || !Number.isFinite(a1) || !Number.isFinite(a2)) return null;
  return { a0, a1, a2 };
}

export function fitCubic(xs: number[], ys: number[]): CubicCoeffs | null {
  const n = xs.length;
  if (n < 4 || ys.length !== n) return null;
  const S0 = n;
  let S1 = 0;
  let S2 = 0;
  let S3 = 0;
  let S4 = 0;
  let S5 = 0;
  let S6 = 0;
  let T0 = 0;
  let T1 = 0;
  let T2 = 0;
  let T3 = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const x2 = x * x;
    const x3 = x2 * x;
    const x4 = x2 * x2;
    const x5 = x3 * x2;
    const x6 = x4 * x2;
    S1 += x;
    S2 += x2;
    S3 += x3;
    S4 += x4;
    S5 += x5;
    S6 += x6;
    T0 += y;
    T1 += x * y;
    T2 += x2 * y;
    T3 += x3 * y;
  }
  const sol = solve4x4(
    [
      [S0, S1, S2, S3],
      [S1, S2, S3, S4],
      [S2, S3, S4, S5],
      [S3, S4, S5, S6],
    ],
    [T0, T1, T2, T3]
  );
  if (!sol) return null;
  const [a0, a1, a2, a3] = sol;
  if (!Number.isFinite(a0) || !Number.isFinite(a1) || !Number.isFinite(a2) || !Number.isFinite(a3)) return null;
  return { a0, a1, a2, a3 };
}

export function fitQuartic(xs: number[], ys: number[]): QuarticCoeffs | null {
  const n = xs.length;
  if (n < 5 || ys.length !== n) return null;
  const S0 = n;
  let S1 = 0;
  let S2 = 0;
  let S3 = 0;
  let S4 = 0;
  let S5 = 0;
  let S6 = 0;
  let S7 = 0;
  let S8 = 0;
  let T0 = 0;
  let T1 = 0;
  let T2 = 0;
  let T3 = 0;
  let T4 = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const x2 = x * x;
    const x3 = x2 * x;
    const x4 = x2 * x2;
    const x5 = x3 * x2;
    const x6 = x4 * x2;
    const x7 = x4 * x3;
    const x8 = x4 * x4;
    S1 += x;
    S2 += x2;
    S3 += x3;
    S4 += x4;
    S5 += x5;
    S6 += x6;
    S7 += x7;
    S8 += x8;
    T0 += y;
    T1 += x * y;
    T2 += x2 * y;
    T3 += x3 * y;
    T4 += x4 * y;
  }
  const sol = solve5x5(
    [
      [S0, S1, S2, S3, S4],
      [S1, S2, S3, S4, S5],
      [S2, S3, S4, S5, S6],
      [S3, S4, S5, S6, S7],
      [S4, S5, S6, S7, S8],
    ],
    [T0, T1, T2, T3, T4]
  );
  if (!sol) return null;
  const [a0, a1, a2, a3, a4] = sol;
  if (!Number.isFinite(a0) || !Number.isFinite(a1) || !Number.isFinite(a2) || !Number.isFinite(a3) || !Number.isFinite(a4)) return null;
  return { a0, a1, a2, a3, a4 };
}

export function evalLinear(c: LinearCoeffs, x: number): number {
  return c.a0 + c.a1 * x;
}

export function evalQuadratic(c: QuadraticCoeffs, x: number): number {
  return c.a0 + c.a1 * x + c.a2 * x * x;
}

export function evalCubic(c: CubicCoeffs, x: number): number {
  const x2 = x * x;
  return c.a0 + c.a1 * x + c.a2 * x2 + c.a3 * x2 * x;
}

export function evalQuartic(c: QuarticCoeffs, x: number): number {
  return c.a0 + x * (c.a1 + x * (c.a2 + x * (c.a3 + x * c.a4)));
}
