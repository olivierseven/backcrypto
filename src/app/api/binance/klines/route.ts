/**
 * Klines a partir de backcrypto.BinanceKlineFast (1m), backcrypto.BinanceKline (1h) e backcrypto.BinanceKlineCache.
 * Cache < 1h: de BinanceKlineFast; cache >= 1h: de BinanceKline.
 * Agregação do dia atual (UTC) em todos os intervalos: sempre a partir de BinanceKlineFast (1m).
 * openTime/closeTime são ajustados pelo timezoneOffset do utilizador (horas, -12..12) antes de devolver.
 * GET /api/binance/klines?symbol=BTCUSDT&interval=5m&limit=1000
 * Resposta: array no formato Binance [openTime, open, high, low, close, volume, closeTime, ...]
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Prisma } from "@/lib/prisma-bio-client";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const INTERVAL_TO_MINUTES: Record<string, number> = {
  "1m": 1,
  "3m": 3,
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "45m": 45,
  "1h": 60,
  "2h": 120,
  "3h": 180,
  "4h": 240,
  "6h": 360,
  "8h": 480,
  "12h": 720,
  "1d": 1440,
  "3d": 4320,
  "1w": 10080,
  "1M": 43200, // 30 days
};

/** Intervalos que existem na BinanceKlineCache (até 1D). Sem 1m. */
const CACHE_INTERVALS = new Set<string>([
  "3m", "5m", "15m", "30m", "45m", "1h", "2h", "3h", "4h", "6h", "8h", "12h", "1d",
]);

function parseIntervalMinutes(interval: string | null, groupMinutes: number | null): number {
  if (interval != null) {
    // 1M (month) antes do toLowerCase para não virar 1m (minute)
    if (interval === "1M" || interval === "1mo") return INTERVAL_TO_MINUTES["1M"];
    const fromInterval = INTERVAL_TO_MINUTES[interval.toLowerCase()];
    if (fromInterval != null) return fromInterval;
  }
  const fromGroup = groupMinutes != null && Number.isFinite(groupMinutes) ? groupMinutes : 1;
  return INTERVAL_TO_MINUTES[String(fromGroup) + "m"] ?? (fromGroup <= 0 ? 1 : Math.min(43200, fromGroup));
}

/** Início do dia atual UTC em ms. Cache contém apenas openTime < este valor. */
function startOfTodayUtcMs(): number {
  const now = new Date();
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0
  );
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Intervalos acima de 1d: usam cache 1d + dia atual agregado em 1d, depois reagrupam (3d, 1w, 1M). */
const ABOVE_1D_MINUTES = new Set<number>([4320, 10080, 43200]); // 3d, 1w, 1M

/** Para 3d/1w/1M: expressão SQL que calcula o bucket (openTime do candle agrupado). 1M = primeiro dia do mês UTC; 1w = segunda 00:00 UTC; 3d = múltiplo de 3 dias desde epoch. */
function above1dBucketExpr(groupMinutes: number, bucketMs: number) {
  if (groupMinutes === 43200) {
    return Prisma.sql`(EXTRACT(EPOCH FROM date_trunc('month', to_timestamp("openTime"/1000.0) AT TIME ZONE 'UTC'))::bigint * 1000)`;
  }
  if (groupMinutes === 10080) {
    return Prisma.sql`(EXTRACT(EPOCH FROM date_trunc('week', to_timestamp("openTime"/1000.0) AT TIME ZONE 'UTC'))::bigint * 1000)`;
  }
  return Prisma.sql`(("openTime"::bigint / ${bucketMs}) * ${bucketMs})`;
}

function toStr(v: unknown): string {
  if (v == null) return "0";
  if (typeof v === "object" && "toString" in v) return (v as { toString: () => string }).toString();
  return String(v);
}

function rowToKline(r: Record<string, unknown>) {
  return [
    Number(r.openTime),
    toStr(r.open),
    toStr(r.high),
    toStr(r.low),
    toStr(r.close),
    toStr(r.volume),
    Number(r.closeTime),
    toStr(r.quoteAssetVolume),
    Number(r.numberOfTrades ?? 0),
    toStr(r.takerBuyBaseAssetVolume),
    toStr(r.takerBuyQuoteAssetVolume),
    0,
  ];
}

/** Aplica timezoneOffset (horas, -12..12) a openTime [0] e closeTime [6] de cada linha. */
function applyTimezoneOffset(data: (string | number)[][], offsetHours: number): (string | number)[][] {
  if (offsetHours === 0) return data;
  const offsetMs = offsetHours * 60 * 60 * 1000;
  return data.map((row) => {
    const out = [...row];
    out[0] = Number(row[0]) + offsetMs;
    out[6] = Number(row[6]) + offsetMs;
    return out;
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol") ?? "BTCUSDT";
  const limit = Math.min(Number(searchParams.get("limit")) || 1000, 5000);
  const groupMinutes = parseIntervalMinutes(
    searchParams.get("interval"),
    searchParams.get("groupMinutes") ? Number(searchParams.get("groupMinutes")) : null
  );
  const bucketMs = groupMinutes * 60 * 1000;

  let timezoneOffset = 0;
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    if (token) {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      const userId = typeof payload?.sub === "string" ? payload.sub : null;
      if (userId) {
        const user = await cryptoPrisma.user.findUnique({
          where: { id: userId },
          select: { timezoneOffset: true },
        });
        const tz = user?.timezoneOffset ?? 0;
        timezoneOffset = Math.max(-12, Math.min(12, Number(tz) || 0));
      }
    }
  } catch {
    // sem sessão ou erro: usar 0
  }

  const intervalParam = (searchParams.get("interval") ?? "").toLowerCase();
  // Intervalo canônico para cache/histórico (baseado no agrupamento), mesmo que a UI envie interval=1m.
  // Ex.: groupMinutes=60 => "1h"; 240 => "4h"; 1440 => "1d"; caso contrário usa "<n>m".
  const canonicalIntervalParam =
    groupMinutes === 1440
      ? "1d"
      : groupMinutes >= 60 && groupMinutes % 60 === 0 && groupMinutes < 1440
        ? `${groupMinutes / 60}h`
        : `${groupMinutes}m`;
  const useCache =
    groupMinutes !== 1 &&
    CACHE_INTERVALS.has(canonicalIntervalParam);

  try {
    if (groupMinutes === 1) {
      const rows = await cryptoPrisma.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`
          SELECT "openTime", "open", "high", "low", "close", "volume",
                 "closeTime", "quoteAssetVolume", "numberOfTrades",
                 "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
          FROM backcrypto."BinanceKlineFast"
          WHERE symbol = ${symbol} AND "interval" = '1m'
          ORDER BY "openTime" DESC
          LIMIT ${limit}
        `
      );
      const list = Array.isArray(rows) ? rows : [];
      let data = list.map(rowToKline);
      data = applyTimezoneOffset(data, timezoneOffset);
      return NextResponse.json(data);
    }

    if (useCache) {
      // Apenas cache: sem fallback para tabelas de origem. Se não houver cache, retornar needsRefresh.
      const hasCache = await cryptoPrisma
        .$queryRaw<[{ exists: boolean }]>(
          Prisma.sql`
            SELECT EXISTS (
              SELECT 1 FROM backcrypto."BinanceKlineCache"
              WHERE symbol = ${symbol} AND "interval" = ${canonicalIntervalParam}
              LIMIT 1
            ) AS "exists"
          `
        )
        .then((r) => Array.isArray(r) && r[0]?.exists === true);

      if (!hasCache) {
        return NextResponse.json({ klines: [], needsRefresh: true });
      }

      const cacheRows = await cryptoPrisma.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`
          SELECT "openTime", "open", "high", "low", "close", "volume",
                 "closeTime", "quoteAssetVolume", "numberOfTrades",
                 "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
          FROM backcrypto."BinanceKlineCache"
          WHERE symbol = ${symbol} AND "interval" = ${canonicalIntervalParam}
          ORDER BY "openTime" DESC
          LIMIT ${limit}
        `
      );
      const list = Array.isArray(cacheRows) ? cacheRows : [];
      let data = list.map(rowToKline);
      data = applyTimezoneOffset(data, timezoneOffset);
      return NextResponse.json(data);
    }

    // Intervalos acima de 1d (3d, 1w, 1M): cache 1d + dia atual em 1d, depois reagrupa. Sem cache: 1d a partir de BinanceKline (1h).
    if (ABOVE_1D_MINUTES.has(groupMinutes)) {
      const bucketExpr = above1dBucketExpr(groupMinutes, bucketMs);
      const startOfToday = startOfTodayUtcMs();
      const hasCache1d = await cryptoPrisma
        .$queryRaw<[{ exists: boolean }]>(
          Prisma.sql`
            SELECT EXISTS (
              SELECT 1 FROM backcrypto."BinanceKlineCache"
              WHERE symbol = ${symbol} AND "interval" = '1d' LIMIT 1
            ) AS "exists"
          `
        )
        .then((r) => Array.isArray(r) && r[0]?.exists === true);

      if (!hasCache1d) {
        return NextResponse.json({ klines: [], needsRefresh: true });
      }

      const rows = await cryptoPrisma.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`
          WITH k_today AS (
            SELECT
              (("openTime" / ${ONE_DAY_MS}) * ${ONE_DAY_MS}) AS bucket,
              "openTime",
              "open", "high", "low", "close", "volume", "closeTime",
              "quoteAssetVolume", "numberOfTrades",
              "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
            FROM backcrypto."BinanceKlineFast"
            WHERE symbol = ${symbol} AND "interval" = '1m' AND "openTime" >= ${startOfToday}
          ),
          today_1d AS (
            SELECT
              k.bucket::bigint AS "openTime",
              (array_agg(k."open" ORDER BY k."openTime"))[1] AS "open",
              max(k."high") AS "high",
              min(k."low") AS "low",
              (array_agg(k."close" ORDER BY k."openTime" DESC))[1] AS "close",
              sum(k."volume") AS "volume",
              max(k."closeTime") AS "closeTime",
              sum(k."quoteAssetVolume") AS "quoteAssetVolume",
              sum(k."numberOfTrades")::int AS "numberOfTrades",
              sum(k."takerBuyBaseAssetVolume") AS "takerBuyBaseAssetVolume",
              sum(k."takerBuyQuoteAssetVolume") AS "takerBuyQuoteAssetVolume"
            FROM k_today k
            GROUP BY k.bucket
          ),
          cache_1d AS (
            SELECT "openTime", "open", "high", "low", "close", "volume",
                   "closeTime", "quoteAssetVolume", "numberOfTrades",
                   "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
            FROM backcrypto."BinanceKlineCache"
            WHERE symbol = ${symbol} AND "interval" = '1d'
            ORDER BY "openTime" DESC
            LIMIT 5000
          ),
          daily AS (
            (SELECT "openTime", "open", "high", "low", "close", "volume", "closeTime",
                    "quoteAssetVolume", "numberOfTrades", "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume" FROM today_1d)
            UNION ALL
            (SELECT "openTime", "open", "high", "low", "close", "volume", "closeTime",
                    "quoteAssetVolume", "numberOfTrades", "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume" FROM cache_1d)
          ),
          daily_with_bucket AS (
            SELECT
              ${bucketExpr} AS bucket,
              "openTime",
              "open", "high", "low", "close", "volume", "closeTime",
              "quoteAssetVolume", "numberOfTrades", "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
            FROM daily
          ),
          grouped AS (
            SELECT
              d.bucket AS "openTime",
              (array_agg(d."open" ORDER BY d."openTime"))[1] AS "open",
              max(d."high") AS "high",
              min(d."low") AS "low",
              (array_agg(d."close" ORDER BY d."openTime" DESC))[1] AS "close",
              sum(d."volume") AS "volume",
              max(d."closeTime") AS "closeTime",
              sum(d."quoteAssetVolume") AS "quoteAssetVolume",
              sum(d."numberOfTrades")::int AS "numberOfTrades",
              sum(d."takerBuyBaseAssetVolume") AS "takerBuyBaseAssetVolume",
              sum(d."takerBuyQuoteAssetVolume") AS "takerBuyQuoteAssetVolume"
            FROM daily_with_bucket d
            GROUP BY d.bucket
            ORDER BY d.bucket DESC
            LIMIT ${limit}
          )
          SELECT * FROM grouped
        `
      );
      const list = Array.isArray(rows) ? rows : [];
      let data = list.map(rowToKline);
      data = applyTimezoneOffset(data, timezoneOffset);
      return NextResponse.json(data);
    }

    // Sem cache: não usar tabelas de origem; pedir refresh no front.
    return NextResponse.json({ klines: [], needsRefresh: true });
  } catch (e) {
    console.error("[api/binance/klines]", e);
    return NextResponse.json(
      { error: "Failed to fetch klines from database" },
      { status: 500 }
    );
  }
}
