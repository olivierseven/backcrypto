/**
 * Validação de klines por símbolo: conta registros e detecta gaps (intervalos pulados).
 * Usado por klines-validate (um símbolo) e klines-validate-all (todas as moedas).
 */
import type { PrismaClient } from "@/lib/prisma-bio-client";
import { Prisma } from "@/lib/prisma-bio-client";

const CORRETORA = "binance";
const ONE_MINUTE_MS = 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

// Regras do validador de tempo (por símbolo)
// "Precisa existir X de info ... não mais e nem menos" => validar somente a janela fixa,
// e marcar problema se essa janela não estiver completa (contagem exata + sem gaps não registrados).
const REQUIRED_1M_DAYS = 9;
const REQUIRED_5M_DAYS = 90; // "3 meses" => usa 90 dias (mesma convenção do resto do projeto)
const REQUIRED_1H_DAYS = 730; // "2 anos" => 730 dias
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type IntervalKey = "1m" | "5m" | "1h";

export type ValidateSingleResult = {
  symbol: string;
  interval: IntervalKey;
  table: string;
  oldest: string | null;
  newest: string | null;
  count: number;
  days: number;
  ok: boolean;
  gaps: { from: number; to: number }[];
};

function dayMs(days: number): number {
  return days * ONE_DAY_MS;
}

function rangeWindowFromNewest(opts: {
  newestOpenTimeMs: number;
  stepMs: number;
  requiredDays: number;
}) {
  const { newestOpenTimeMs, stepMs, requiredDays } = opts;
  const expectedCount = Math.floor(dayMs(requiredDays) / stepMs);
  // openTime do último candle deve ser o "newest" (já alinhado ao step).
  const endMs = newestOpenTimeMs;
  const startMs = endMs - (expectedCount - 1) * stepMs;
  return { startMs, endMs, expectedCount };
}

async function getNewestOpenTimeMs(db: PrismaClient, table: "fast" | "month" | "hour", symbol: string) {
  const query =
    table === "fast"
      ? Prisma.sql`
          SELECT max("openTime") AS newest
          FROM backcrypto."BinanceKlineFast"
          WHERE corretora = ${CORRETORA} AND symbol = ${symbol} AND "interval" = '1m'
        `
      : table === "month"
      ? Prisma.sql`
          SELECT max("openTime") AS newest
          FROM backcrypto."BinanceKlineMonth"
          WHERE corretora = ${CORRETORA} AND symbol = ${symbol} AND "interval" = '5m'
        `
      : Prisma.sql`
          SELECT max("openTime") AS newest
          FROM backcrypto."BinanceKline"
          WHERE corretora = ${CORRETORA} AND symbol = ${symbol} AND "interval" = '1h'
        `;

  const [row] = await db.$queryRaw<{ newest: bigint | null }[]>(query);
  return row?.newest != null ? Number(row.newest) : null;
}

export async function validate1m(db: PrismaClient, symbol: string, requiredDays?: number): Promise<ValidateSingleResult> {
  const newestOpenTimeMs = await getNewestOpenTimeMs(db, "fast", symbol);
  if (newestOpenTimeMs == null) {
    return {
      symbol,
      interval: "1m",
      table: "BinanceKlineFast",
      oldest: null,
      newest: null,
      count: 0,
      days: 0,
      ok: false,
      gaps: [],
    };
  }

  const windowDays = requiredDays ?? REQUIRED_1M_DAYS;
  const { startMs, endMs, expectedCount } = rangeWindowFromNewest({
    newestOpenTimeMs,
    stepMs: ONE_MINUTE_MS,
    requiredDays: windowDays,
  });
  const startBig = BigInt(startMs);
  const endBig = BigInt(endMs);

  const [statsRow] = await db.$queryRaw<
    [{ count: bigint; oldest: bigint | null; newest: bigint | null }]
  >(
    Prisma.sql`
      SELECT count(*)::bigint AS count, min("openTime") AS oldest, max("openTime") AS newest
      FROM backcrypto."BinanceKlineFast"
      WHERE corretora = ${CORRETORA}
        AND symbol = ${symbol}
        AND "interval" = '1m'
        AND "openTime" >= ${startBig}
        AND "openTime" <= ${endBig}
    `
  );

  const count = Number(statsRow?.count ?? 0);
  const oldest = statsRow?.oldest != null ? Number(statsRow.oldest) : null;
  const newest = statsRow?.newest != null ? Number(statsRow.newest) : null;
  let days = 0;
  if (oldest != null && newest != null && newest > oldest) {
    days = (newest - oldest) / ONE_DAY_MS;
  }

  const gaps = await db.$queryRaw<{ openTime: bigint; next_open: bigint }[]>(
    Prisma.sql`
      WITH ordered AS (
        SELECT "openTime", lead("openTime") OVER (ORDER BY "openTime") AS next_open
        FROM backcrypto."BinanceKlineFast"
        WHERE corretora = ${CORRETORA}
          AND symbol = ${symbol}
          AND "interval" = '1m'
          AND "openTime" >= ${startBig}
          AND "openTime" <= ${endBig}
      )
      SELECT "openTime", next_open FROM ordered
      WHERE next_open IS NOT NULL
        AND (next_open - "openTime") <> ${ONE_MINUTE_MS}
      ORDER BY "openTime" LIMIT 500
    `
  );

  let gapList = (Array.isArray(gaps) ? gaps : []).map((g) => ({
    from: Number(g.openTime),
    to: Number(g.next_open),
  }));

  const registered1m = await db.binanceKlineGap.findMany({
    where: {
      symbol,
      interval: "1m",
      gapFrom: { gte: startBig, lte: endBig },
      gapTo: { gte: startBig, lte: endBig },
    },
    select: { gapFrom: true, gapTo: true },
  });

  const registeredSet1m = new Set(
    registered1m.map((r) => `${Number(r.gapFrom)}_${Number(r.gapTo)}`)
  );
  gapList = gapList.filter((g) => !registeredSet1m.has(`${g.from}_${g.to}`));

  const ok = gapList.length === 0 && count === expectedCount;
  return {
    symbol,
    interval: "1m",
    table: "BinanceKlineFast",
    oldest: oldest != null ? new Date(oldest).toISOString() : null,
    newest: newest != null ? new Date(newest).toISOString() : null,
    count,
    days: Math.round(days * 100) / 100,
    ok,
    gaps: gapList,
  };
}

export async function validate5m(db: PrismaClient, symbol: string, requiredDays?: number): Promise<ValidateSingleResult> {
  const newestOpenTimeMs = await getNewestOpenTimeMs(db, "month", symbol);
  if (newestOpenTimeMs == null) {
    return {
      symbol,
      interval: "5m",
      table: "BinanceKlineMonth",
      oldest: null,
      newest: null,
      count: 0,
      days: 0,
      ok: false,
      gaps: [],
    };
  }

  const windowDays = requiredDays ?? REQUIRED_5M_DAYS;
  const { startMs, endMs, expectedCount } = rangeWindowFromNewest({
    newestOpenTimeMs,
    stepMs: FIVE_MINUTES_MS,
    requiredDays: windowDays,
  });
  const startBig = BigInt(startMs);
  const endBig = BigInt(endMs);

  const [statsRow] = await db.$queryRaw<
    [{ count: bigint; oldest: bigint | null; newest: bigint | null }]
  >(
    Prisma.sql`
      SELECT count(*)::bigint AS count, min("openTime") AS oldest, max("openTime") AS newest
      FROM backcrypto."BinanceKlineMonth"
      WHERE corretora = ${CORRETORA}
        AND symbol = ${symbol}
        AND "interval" = '5m'
        AND "openTime" >= ${startBig}
        AND "openTime" <= ${endBig}
    `
  );

  const count = Number(statsRow?.count ?? 0);
  const oldest = statsRow?.oldest != null ? Number(statsRow.oldest) : null;
  const newest = statsRow?.newest != null ? Number(statsRow.newest) : null;
  let days = 0;
  if (oldest != null && newest != null && newest > oldest) {
    days = (newest - oldest) / ONE_DAY_MS;
  }

  const gaps = await db.$queryRaw<{ openTime: bigint; next_open: bigint }[]>(
    Prisma.sql`
      WITH ordered AS (
        SELECT "openTime", lead("openTime") OVER (ORDER BY "openTime") AS next_open
        FROM backcrypto."BinanceKlineMonth"
        WHERE corretora = ${CORRETORA}
          AND symbol = ${symbol}
          AND "interval" = '5m'
          AND "openTime" >= ${startBig}
          AND "openTime" <= ${endBig}
      )
      SELECT "openTime", next_open FROM ordered
      WHERE next_open IS NOT NULL
        AND (next_open - "openTime") <> ${FIVE_MINUTES_MS}
      ORDER BY "openTime" LIMIT 500
    `
  );

  let gapList = (Array.isArray(gaps) ? gaps : []).map((g) => ({
    from: Number(g.openTime),
    to: Number(g.next_open),
  }));

  const registered5m = await db.binanceKlineGap.findMany({
    where: {
      symbol,
      interval: "5m",
      gapFrom: { gte: startBig, lte: endBig },
      gapTo: { gte: startBig, lte: endBig },
    },
    select: { gapFrom: true, gapTo: true },
  });

  const registeredSet5m = new Set(
    registered5m.map((r) => `${Number(r.gapFrom)}_${Number(r.gapTo)}`)
  );
  gapList = gapList.filter((g) => !registeredSet5m.has(`${g.from}_${g.to}`));

  const ok = gapList.length === 0 && count === expectedCount;
  return {
    symbol,
    interval: "5m",
    table: "BinanceKlineMonth",
    oldest: oldest != null ? new Date(oldest).toISOString() : null,
    newest: newest != null ? new Date(newest).toISOString() : null,
    count,
    days: Math.round(days * 100) / 100,
    ok,
    gaps: gapList,
  };
}

export async function validate1h(db: PrismaClient, symbol: string, requiredDays?: number): Promise<ValidateSingleResult> {
  const newestOpenTimeMs = await getNewestOpenTimeMs(db, "hour", symbol);
  if (newestOpenTimeMs == null) {
    return {
      symbol,
      interval: "1h",
      table: "BinanceKline",
      oldest: null,
      newest: null,
      count: 0,
      days: 0,
      ok: false,
      gaps: [],
    };
  }

  const windowDays = requiredDays ?? REQUIRED_1H_DAYS;
  const { startMs, endMs, expectedCount } = rangeWindowFromNewest({
    newestOpenTimeMs,
    stepMs: ONE_HOUR_MS,
    requiredDays: windowDays,
  });
  const startBig = BigInt(startMs);
  const endBig = BigInt(endMs);

  const [statsRow] = await db.$queryRaw<
    [{ count: bigint; oldest: bigint | null; newest: bigint | null }]
  >(
    Prisma.sql`
      SELECT count(*)::bigint AS count, min("openTime") AS oldest, max("openTime") AS newest
      FROM backcrypto."BinanceKline"
      WHERE corretora = ${CORRETORA}
        AND symbol = ${symbol}
        AND "interval" = '1h'
        AND "openTime" >= ${startBig}
        AND "openTime" <= ${endBig}
    `
  );

  const count = Number(statsRow?.count ?? 0);
  const oldest = statsRow?.oldest != null ? Number(statsRow.oldest) : null;
  const newest = statsRow?.newest != null ? Number(statsRow.newest) : null;
  let days = 0;
  if (oldest != null && newest != null && newest > oldest) {
    days = (newest - oldest) / ONE_DAY_MS;
  }

  const gaps = await db.$queryRaw<{ openTime: bigint; next_open: bigint }[]>(
    Prisma.sql`
      WITH ordered AS (
        SELECT "openTime", lead("openTime") OVER (ORDER BY "openTime") AS next_open
        FROM backcrypto."BinanceKline"
        WHERE corretora = ${CORRETORA}
          AND symbol = ${symbol}
          AND "interval" = '1h'
          AND "openTime" >= ${startBig}
          AND "openTime" <= ${endBig}
      )
      SELECT "openTime", next_open FROM ordered
      WHERE next_open IS NOT NULL
        AND (next_open - "openTime") <> ${ONE_HOUR_MS}
      ORDER BY "openTime" LIMIT 500
    `
  );

  let gapList = (Array.isArray(gaps) ? gaps : []).map((g) => ({
    from: Number(g.openTime),
    to: Number(g.next_open),
  }));

  const registered1h = await db.binanceKlineGap.findMany({
    where: {
      symbol,
      interval: "1h",
      gapFrom: { gte: startBig, lte: endBig },
      gapTo: { gte: startBig, lte: endBig },
    },
    select: { gapFrom: true, gapTo: true },
  });

  const registeredSet1h = new Set(
    registered1h.map((r) => `${Number(r.gapFrom)}_${Number(r.gapTo)}`)
  );
  gapList = gapList.filter((g) => !registeredSet1h.has(`${g.from}_${g.to}`));

  const ok = gapList.length === 0 && count === expectedCount;
  return {
    symbol,
    interval: "1h",
    table: "BinanceKline",
    oldest: oldest != null ? new Date(oldest).toISOString() : null,
    newest: newest != null ? new Date(newest).toISOString() : null,
    count,
    days: Math.round(days * 100) / 100,
    ok,
    gaps: gapList,
  };
}
