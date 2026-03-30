/**
 * Renko / Range / Kagi a partir de aggTrade (BRICK_TICK_UNITS × tick de preço).
 * O tick vem de GET /api/binance/daily-close-tick: **0,01% do último fecho diário completo (UTC)** — não é % do tijolo anterior.
 * Renko: cada tijolo = BRICK_TICK_UNITS × esse tick (ex. 5 × tick); novo tijolo quando
 * o preço atinge lastClose ± B (ver `stepRenkoTable`). Sem regra especial de reversão.
 * Tabelas: BinanceRenkoFast | BinanceRangeFast | BinanceKagiFast (interval "5ticks");
 * Renko 2× (reversão 2B): BinanceRenko2xFast ("5ticks") — tijolos altura B; continuação como Renko 1×; reversão após ±2B.
 * trades/candle: BinanceTradeCountFast (ex. "500trades").
 */

/** Altura do tijolo Renko (e Range/Kagi) em ticks de preço = intervalo "5ticks". */
export const BRICK_TICK_UNITS = 5;

export type TradeAcc = {
  firstT: number | null;
  lastT: number | null;
  volBase: number;
  volQuote: number;
  trades: number;
  takerBuyBase: number;
  takerBuyQuote: number;
};

export type RenkoRef = {
  lastClose: number | null;
  serial: number;
  acc: TradeAcc;
  segMin: number | null;
  segMax: number | null;
};

export type AggFastBarRowPayload = {
  symbol: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteAssetVolume: number;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: number;
  takerBuyQuoteAssetVolume: number;
};

/** @deprecated use AggFastBarRowPayload */
export type AggFastRenkoRowPayload = AggFastBarRowPayload;

export type AggFastTableRowPersist = {
  persist: Omit<AggFastBarRowPayload, "symbol">;
};

export type RenkoTableRowPersist = AggFastTableRowPersist;

export type RangeRef = {
  serial: number;
  acc: TradeAcc;
  barOpen: number | null;
  barHigh: number;
  barLow: number;
};

export type KagiRef = {
  serial: number;
  acc: TradeAcc;
  anchor: number | null;
  dir: -1 | 0 | 1;
  extreme: number;
};

export function emptyAcc(): TradeAcc {
  return { firstT: null, lastT: null, volBase: 0, volQuote: 0, trades: 0, takerBuyBase: 0, takerBuyQuote: 0 };
}

export function emptyRangeRef(): RangeRef {
  return { serial: 0, acc: emptyAcc(), barOpen: null, barHigh: 0, barLow: 0 };
}

export function emptyKagiRef(): KagiRef {
  return { serial: 0, acc: emptyAcc(), anchor: null, dir: 0, extreme: 0 };
}

export function emptyRenkoRef(): RenkoRef {
  return { lastClose: null, serial: 0, acc: emptyAcc(), segMin: null, segMax: null };
}

export function addTrade(acc: TradeAcc, p: number, q: number, t: number, isBuyerMaker: boolean | undefined) {
  if (acc.firstT === null) acc.firstT = t;
  acc.lastT = t;
  acc.volBase += q;
  acc.volQuote += p * q;
  acc.trades += 1;
  if (isBuyerMaker === false) {
    acc.takerBuyBase += q;
    acc.takerBuyQuote += p * q;
  }
}

function buildPersistRow(
  o: number,
  c: number,
  atMs: number,
  withStats: boolean,
  acc: TradeAcc,
  high: number,
  low: number
): AggFastTableRowPersist {
  const openTime = withStats && acc.firstT != null ? acc.firstT : atMs;
  const closeTime = withStats && acc.lastT != null ? acc.lastT : atMs;
  const persist: Omit<AggFastBarRowPayload, "symbol"> = {
    openTime,
    closeTime,
    open: o,
    high,
    low,
    close: c,
    volume: withStats ? acc.volBase : 0,
    quoteAssetVolume: withStats ? acc.volQuote : 0,
    numberOfTrades: withStats ? acc.trades : 0,
    takerBuyBaseAssetVolume: withStats ? acc.takerBuyBase : 0,
    takerBuyQuoteAssetVolume: withStats ? acc.takerBuyQuote : 0,
  };
  return { persist };
}

function renkoHighLowForBrick(o: number, c: number, tickSize: number, segMin: number, segMax: number): { high: number; low: number } {
  const thresh = BRICK_TICK_UNITS * tickSize - 1e-12;
  if (c > o) return { high: c, low: o - segMin > 0 && o - segMin < thresh ? segMin : o };
  if (c < o) return { high: segMax - o > 0 && segMax - o < thresh ? segMax : o, low: c };
  return { high: Math.max(o, c), low: Math.min(o, c) };
}

/**
 * Renko "5ticks": B = BRICK_TICK_UNITS × tick diário. Último fechamento do tijolo = `lastClose` (lc).
 * - Se price >= lc + B → tijolo(s) de alta (cada tijolo +B até o preço deixar de satisfazer).
 * - Se price <= lc − B → tijolo(s) de baixa (−B cada).
 * Sem regra especial de reversão; um ramo por negócio (p > lc vs p < lc; p === lc não gera tijolo).
 * eps nas comparações para float. Tijolos consecutivos no mesmo fluxo encadeiam open/close; gaps entre sessões/fontes são outra história.
 */
export function stepRenkoTable(ref: RenkoRef, p: number, closeEventMs: number, tickSize: number): AggFastTableRowPersist[] {
  const B = BRICK_TICK_UNITS * tickSize;
  if (!(B > 0)) return [];
  if (ref.lastClose === null) {
    ref.lastClose = p;
    ref.segMin = null;
    ref.segMax = null;
    return [];
  }

  const lc0 = ref.lastClose;
  ref.segMin = ref.segMin == null ? Math.min(lc0, p) : Math.min(ref.segMin, p);
  ref.segMax = ref.segMax == null ? Math.max(lc0, p) : Math.max(ref.segMax, p);

  const pending: Array<{ o: number; c: number }> = [];
  let lc = ref.lastClose;
  const eps = 1e-9;

  if (p > lc) {
    let runOpen = lc;
    while (p >= runOpen + B - eps) {
      const runClose = runOpen + B;
      pending.push({ o: runOpen, c: runClose });
      runOpen = runClose;
    }
    lc = runOpen;
  } else if (p < lc) {
    let runOpen = lc;
    while (p <= runOpen - B + eps) {
      const runClose = runOpen - B;
      pending.push({ o: runOpen, c: runClose });
      runOpen = runClose;
    }
    lc = runOpen;
  }

  ref.lastClose = lc;
  const rows: AggFastTableRowPersist[] = [];
  const multi = pending.length > 1;
  const segMinSnap = ref.segMin;
  const segMaxSnap = ref.segMax;
  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    ref.serial += 1;
    let hi = item.c;
    let lo = item.o;
    if (!multi && segMinSnap != null && segMaxSnap != null) {
      const hl = renkoHighLowForBrick(item.o, item.c, tickSize, segMinSnap, segMaxSnap);
      hi = hl.high;
      lo = hl.low;
    }
    const atMsForRow = multi ? closeEventMs + i : closeEventMs;
    rows.push(buildPersistRow(item.o, item.c, atMsForRow, !multi, ref.acc, hi, lo));
  }

  if (pending.length > 0) {
    ref.acc = emptyAcc();
    ref.segMin = Math.min(lc, p);
    ref.segMax = Math.max(lc, p);
  }

  return rows;
}

/**
 * Renko “2×” (reversão dupla): tijolo sempre altura B = BRICK_TICK_UNITS × tick (igual ao Renko 1×).
 * Continuação a favor da tendência: passos de B (como `stepRenkoTable`).
 * Reversão: só após movimento adverso de 2B em relação a `lastClose` — primeiro tijolo oposto continua com altura B.
 */
export type RenkoClassic2xRef = {
  lastClose: number | null;
  /** Direção do último tijolo fechado; null antes do primeiro tijolo após âncora. */
  lastUp: boolean | null;
  serial: number;
  acc: TradeAcc;
  segMin: number | null;
  segMax: number | null;
};

export function emptyRenkoClassic2xRef(): RenkoClassic2xRef {
  return { lastClose: null, lastUp: null, serial: 0, acc: emptyAcc(), segMin: null, segMax: null };
}

export function stepRenkoClassic2xTable(ref: RenkoClassic2xRef, p: number, closeEventMs: number, tickSize: number): AggFastTableRowPersist[] {
  const B = BRICK_TICK_UNITS * tickSize;
  const R2 = 2 * B;
  const eps = 1e-9;
  if (!(B > 0)) return [];
  if (ref.lastClose === null) {
    ref.lastClose = p;
    ref.segMin = null;
    ref.segMax = null;
    ref.lastUp = null;
    return [];
  }

  const lc0 = ref.lastClose;
  ref.segMin = ref.segMin == null ? Math.min(lc0, p) : Math.min(ref.segMin, p);
  ref.segMax = ref.segMax == null ? Math.max(lc0, p) : Math.max(ref.segMax, p);

  const pending: Array<{ o: number; c: number }> = [];
  let lc = ref.lastClose;
  let reversalCommitted = false;

  if (ref.lastUp === null) {
    if (p > lc && p >= lc + B - eps) {
      const n = Math.floor((p - lc + eps) / B);
      const runOpen = lc + (Math.max(1, n) - 1) * B;
      const runClose = runOpen + B;
      pending.push({ o: runOpen, c: runClose });
      lc = runClose;
      ref.lastUp = true;
    } else if (p < lc && p <= lc - B + eps) {
      const n = Math.floor((lc - p + eps) / B);
      const runOpen = lc - (Math.max(1, n) - 1) * B;
      const runClose = runOpen - B;
      pending.push({ o: runOpen, c: runClose });
      lc = runClose;
      ref.lastUp = false;
    }
  } else {
    let guard = 0;
    while (guard++ < 100_000) {
      let progressed = false;
      if (ref.lastUp === true) {
        if (p >= lc + B - eps) {
          const n = Math.floor((p - lc + eps) / B);
          const runOpen = lc + (Math.max(1, n) - 1) * B;
          const runClose = runOpen + B;
          pending.push({ o: runOpen, c: runClose });
          lc = runClose;
          progressed = true;
        }
        if (progressed) continue;
        if (p <= lc - R2 + eps) {
          const steps = Math.floor((lc - p + eps) / B);
          const n = Math.max(2, steps);
          const revOpen = lc - (n - 1) * B;
          const revClose = revOpen - B;
          pending.push({ o: revOpen, c: revClose });
          lc = revClose;
          ref.lastUp = false;
          reversalCommitted = true;
          break;
        }
      } else {
        if (p <= lc - B + eps) {
          const n = Math.floor((lc - p + eps) / B);
          const runOpen = lc - (Math.max(1, n) - 1) * B;
          const runClose = runOpen - B;
          pending.push({ o: runOpen, c: runClose });
          lc = runClose;
          progressed = true;
        }
        if (progressed) continue;
        if (p >= lc + R2 - eps) {
          const steps = Math.floor((p - lc + eps) / B);
          const n = Math.max(2, steps);
          const revOpen = lc + (n - 1) * B;
          const revClose = revOpen + B;
          pending.push({ o: revOpen, c: revClose });
          lc = revClose;
          ref.lastUp = true;
          reversalCommitted = true;
          break;
        }
      }
      break;
    }
  }

  ref.lastClose = lc;
  const rows: AggFastTableRowPersist[] = [];
  const multi = pending.length > 1;
  const segMinSnap = ref.segMin;
  const segMaxSnap = ref.segMax;
  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    ref.serial += 1;
    let hi = item.c;
    let lo = item.o;
    if (!multi && segMinSnap != null && segMaxSnap != null) {
      if (reversalCommitted) {
        // Na reversão 2x, preserva o extremo real do movimento no pavio.
        hi = Math.max(item.o, item.c, segMaxSnap);
        lo = Math.min(item.o, item.c, segMinSnap);
      } else {
        const hl = renkoHighLowForBrick(item.o, item.c, tickSize, segMinSnap, segMaxSnap);
        hi = hl.high;
        lo = hl.low;
      }
    }
    const atMsForRow = multi ? closeEventMs + i : closeEventMs;
    rows.push(buildPersistRow(item.o, item.c, atMsForRow, !multi, ref.acc, hi, lo));
  }

  if (pending.length > 0) {
    ref.acc = emptyAcc();
    ref.segMin = Math.min(lc, p);
    ref.segMax = Math.max(lc, p);
  }

  return rows;
}

/** Candle por contagem de eventos aggTrade (1 evento = 1 trade na contagem). */
export const TRADES_PER_CANDLE = 500;

export type TradeCountCandleRef = {
  serial: number;
  acc: TradeAcc;
  tradesInBucket: number;
  bucketOpen: number | null;
  bucketHigh: number;
  bucketLow: number;
};

export function emptyTradeCountCandleRef(): TradeCountCandleRef {
  return { serial: 0, acc: emptyAcc(), tradesInBucket: 0, bucketOpen: null, bucketHigh: 0, bucketLow: 0 };
}

export function stepTradeCountCandle(
  ref: TradeCountCandleRef,
  p: number,
  q: number,
  t: number,
  isBuyerMaker: boolean | undefined,
  closeEventMs: number
): AggFastTableRowPersist[] {
  addTrade(ref.acc, p, q, t, isBuyerMaker);
  if (ref.bucketOpen === null) {
    ref.bucketOpen = p;
    ref.bucketHigh = p;
    ref.bucketLow = p;
  } else {
    ref.bucketHigh = Math.max(ref.bucketHigh, p);
    ref.bucketLow = Math.min(ref.bucketLow, p);
  }
  ref.tradesInBucket += 1;
  if (ref.tradesInBucket < TRADES_PER_CANDLE) return [];

  const o = ref.bucketOpen!;
  const c = p;
  const hi = ref.bucketHigh;
  const lo = ref.bucketLow;
  ref.serial += 1;
  const row = buildPersistRow(o, c, closeEventMs, true, ref.acc, hi, lo);
  ref.acc = emptyAcc();
  ref.tradesInBucket = 0;
  ref.bucketOpen = null;
  ref.bucketHigh = 0;
  ref.bucketLow = 0;
  return [row];
}

/** Igual a `stepRangeTable` em dev/ticks. */
export function stepRangeTable(ref: RangeRef, p: number, closeEventMs: number, tickSize: number): AggFastTableRowPersist[] {
  const R = BRICK_TICK_UNITS * tickSize;
  if (!(R > 0)) return [];
  if (ref.barOpen === null) {
    ref.barOpen = p;
    ref.barHigh = p;
    ref.barLow = p;
    return [];
  }
  ref.barHigh = Math.max(ref.barHigh, p);
  ref.barLow = Math.min(ref.barLow, p);
  const amp = ref.barHigh - ref.barLow;
  if (amp >= R - 1e-9) {
    ref.serial += 1;
    const row = buildPersistRow(ref.barOpen, p, closeEventMs, true, ref.acc, ref.barHigh, ref.barLow);
    ref.acc = emptyAcc();
    ref.barOpen = p;
    ref.barHigh = p;
    ref.barLow = p;
    return [row];
  }
  return [];
}

/** Igual a `stepKagiTable` em dev/ticks. */
export function stepKagiTable(ref: KagiRef, p: number, closeEventMs: number, tickSize: number): AggFastTableRowPersist[] {
  const R = BRICK_TICK_UNITS * tickSize;
  if (!(R > 0)) return [];

  if (ref.anchor === null) {
    ref.anchor = p;
    ref.extreme = p;
    return [];
  }

  const rows: AggFastTableRowPersist[] = [];

  if (ref.dir === 0) {
    const moved = p - ref.anchor;
    if (moved >= R || moved <= -R) {
      ref.serial += 1;
      rows.push(buildPersistRow(ref.anchor, p, closeEventMs, true, ref.acc, Math.max(ref.anchor, p), Math.min(ref.anchor, p)));
      ref.dir = moved > 0 ? 1 : -1;
      ref.extreme = p;
      ref.acc = emptyAcc();
      return rows;
    }
    return [];
  }

  if (ref.dir > 0) {
    if (p > ref.extreme) ref.extreme = p;
    if (p <= ref.extreme - R) {
      ref.serial += 1;
      rows.push(buildPersistRow(ref.extreme, p, closeEventMs, true, ref.acc, ref.extreme, p));
      ref.dir = -1;
      ref.extreme = p;
      ref.acc = emptyAcc();
      return rows;
    }
    return [];
  }

  if (p < ref.extreme) ref.extreme = p;
  if (p >= ref.extreme + R) {
    ref.serial += 1;
    rows.push(buildPersistRow(ref.extreme, p, closeEventMs, true, ref.acc, p, ref.extreme));
    ref.dir = 1;
    ref.extreme = p;
    ref.acc = emptyAcc();
    return rows;
  }
  return [];
}

export function syncRangeRefFromLatestDbClose(ref: RangeRef, latestClose: number | null) {
  if (latestClose == null || !Number.isFinite(latestClose)) {
    ref.barOpen = null;
    ref.barHigh = 0;
    ref.barLow = 0;
    ref.serial = 0;
    ref.acc = emptyAcc();
    return;
  }
  ref.barOpen = latestClose;
  ref.barHigh = latestClose;
  ref.barLow = latestClose;
  ref.serial = 0;
  ref.acc = emptyAcc();
}

export function syncKagiRefFromLatestDbClose(ref: KagiRef, latestClose: number | null) {
  if (latestClose == null || !Number.isFinite(latestClose)) {
    ref.anchor = null;
    ref.extreme = 0;
    ref.dir = 0;
    ref.serial = 0;
    ref.acc = emptyAcc();
    return;
  }
  ref.anchor = latestClose;
  ref.extreme = latestClose;
  ref.dir = 0;
  ref.serial = 0;
  ref.acc = emptyAcc();
}

export function parseAggTradeForSymbol(
  raw: string,
  symbolUpper: string
): { p: number; q: number; t: number; m?: boolean } | null {
  try {
    const root = JSON.parse(raw) as {
      stream?: string;
      data?: { s?: string; p?: string; q?: string; T?: number; E?: number; m?: boolean };
    };
    const j = root.data ?? (root as { s?: string; p?: string; q?: string; T?: number; E?: number; m?: boolean });
    const sym = String(j.s ?? "").toUpperCase();
    if (sym !== symbolUpper) return null;
    const p = Number.parseFloat(String(j.p ?? ""));
    const q = Number.parseFloat(String(j.q ?? ""));
    const t =
      typeof j.T === "number" && Number.isFinite(j.T)
        ? j.T
        : typeof j.E === "number" && Number.isFinite(j.E)
          ? j.E
          : Date.now();
    if (!Number.isFinite(p) || !Number.isFinite(q)) return null;
    const m = typeof j.m === "boolean" ? j.m : undefined;
    return { p, q, t, m };
  } catch {
    return null;
  }
}

/** Início do minuto UTC (ms) que contém `utcMs`. */
export function minuteFloorUtc(utcMs: number): number {
  return Math.floor(utcMs / 60_000) * 60_000;
}

/**
 * Só processa negócios com T >= este valor (UTC ms).
 * Com série carregada: início do minuto UTC do open da barra mais recente (após reverter o offset de exibição).
 * Sem série: início do minuto UTC atual.
 *
 * Importante: **não** usar max(início do minuto atual, dbMin). Isso elevava o piso ao “minuto agora” e,
 * com relógio do cliente adiantado ou trades com T no minuto anterior, `aggTrade` era descartado em massa
 * enquanto o miniTicker continuava a atualizar o spot — Renko parava, tijolo “em formação” esticava.
 */
export function streamMinTradeMsUtc(opts: { nowMs: number; timezoneOffsetHours: number; klinesNewestOpenDisplayMs: number | null }): number {
  const nowMin = minuteFloorUtc(opts.nowMs);
  const disp = opts.klinesNewestOpenDisplayMs;
  if (disp == null || !Number.isFinite(disp)) return nowMin;
  const utcOpen = disp - opts.timezoneOffsetHours * 60 * 60 * 1000;
  if (!Number.isFinite(utcOpen)) return nowMin;
  return minuteFloorUtc(utcOpen);
}

export function syncRenkoRefFromLatestDbClose(ref: RenkoRef, latestClose: number | null) {
  if (latestClose == null || !Number.isFinite(latestClose)) {
    ref.lastClose = null;
    ref.serial = 0;
    ref.acc = emptyAcc();
    ref.segMin = null;
    ref.segMax = null;
    return;
  }
  ref.lastClose = latestClose;
  ref.acc = emptyAcc();
  ref.segMin = null;
  ref.segMax = null;
}

export function syncRenkoClassic2xRefFromLatestDbClose(ref: RenkoClassic2xRef, latestClose: number | null) {
  if (latestClose == null || !Number.isFinite(latestClose)) {
    ref.lastClose = null;
    ref.lastUp = null;
    ref.serial = 0;
    ref.acc = emptyAcc();
    ref.segMin = null;
    ref.segMax = null;
    return;
  }
  ref.lastClose = latestClose;
  ref.lastUp = null;
  ref.acc = emptyAcc();
  ref.segMin = null;
  ref.segMax = null;
}

/** Reseta bucket em formação quando o GET devolve velas do servidor (evita contagem duplicada). */
export function syncTradeCountRefFromLatestDbClose(ref: TradeCountCandleRef, _latestClose: number | null) {
  ref.serial = 0;
  ref.acc = emptyAcc();
  ref.tradesInBucket = 0;
  ref.bucketOpen = null;
  ref.bucketHigh = 0;
  ref.bucketLow = 0;
}
