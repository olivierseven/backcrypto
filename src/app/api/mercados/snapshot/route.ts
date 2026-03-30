/**
 * Último fechamento 1m (BinanceKlineFast) + último 1d em cache (BinanceKlineCache).
 * Volume 24h USDT: soma de quoteAssetVolume das últimas 24 velas 1h (BinanceKline interval 1h).
 * Variação % = (close1m − closeDaily) / closeDaily × 100.
 * GET /crypto/api/mercados/snapshot — requer sessão.
 */
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Prisma } from "@/lib/prisma-bio-client";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const CORRETORA = "binance";

function numFromDb(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function bigIntFromDb(v: unknown): bigint | null {
  if (v == null) return null;
  if (typeof v === "bigint") return v;
  try {
    return BigInt(String(v));
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      await jwtVerify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = await cryptoPrisma.$queryRaw<
      {
        symbol: string;
        close_1m: unknown;
        ot_1m: unknown;
        vol_24h_usdt: unknown;
        close_1d: unknown;
        ot_1d: unknown;
      }[]
    >(Prisma.sql`
      WITH sym AS (
        SELECT symbol FROM backcrypto."KlineSymbol" WHERE ativo = true
      ),
      last1m AS (
        SELECT DISTINCT ON (f.symbol)
          f.symbol,
          f.close AS close_1m,
          f."openTime" AS ot_1m
        FROM backcrypto."BinanceKlineFast" f
        INNER JOIN sym s ON s.symbol = f.symbol
        WHERE f.corretora = ${CORRETORA} AND f.interval = '1m'
        ORDER BY f.symbol ASC, f."openTime" DESC
      ),
      vol24h AS (
        SELECT t.symbol, SUM(t.qv) AS vol_24h_usdt
        FROM (
          SELECT
            k.symbol,
            k."quoteAssetVolume"::numeric AS qv,
            ROW_NUMBER() OVER (PARTITION BY k.symbol ORDER BY k."openTime" DESC) AS rn
          FROM backcrypto."BinanceKline" k
          INNER JOIN sym s ON s.symbol = k.symbol
          WHERE k.corretora = ${CORRETORA} AND k.interval = '1h'
        ) t
        WHERE t.rn <= 24
        GROUP BY t.symbol
      ),
      last1d AS (
        SELECT DISTINCT ON (c.symbol)
          c.symbol,
          c.close AS close_1d,
          c."openTime" AS ot_1d
        FROM backcrypto."BinanceKlineCache" c
        INNER JOIN sym s ON s.symbol = c.symbol
        WHERE c.interval = '1d' AND c."chartKind" = 'interval'
        ORDER BY c.symbol ASC, c."openTime" DESC
      )
      SELECT
        s.symbol,
        l.close_1m,
        l.ot_1m,
        v.vol_24h_usdt,
        d.close_1d,
        d.ot_1d
      FROM sym s
      LEFT JOIN last1m l ON l.symbol = s.symbol
      LEFT JOIN vol24h v ON v.symbol = s.symbol
      LEFT JOIN last1d d ON d.symbol = s.symbol
      ORDER BY s.symbol ASC
    `);

    const fetchedAt = Date.now();
    const rows = raw.map((r) => {
      const close1m = numFromDb(r.close_1m);
      const closeDaily = numFromDb(r.close_1d);
      const openTime1m = bigIntFromDb(r.ot_1m);
      const openTimeDaily = bigIntFromDb(r.ot_1d);
      let pctVsDaily: number | null = null;
      if (close1m != null && closeDaily != null && closeDaily !== 0) {
        pctVsDaily = ((close1m - closeDaily) / closeDaily) * 100;
      }
      return {
        symbol: r.symbol,
        close1m,
        openTime1m: openTime1m != null ? Number(openTime1m) : null,
        volumeUsdt24h: numFromDb(r.vol_24h_usdt),
        closeDaily,
        openTimeDaily: openTimeDaily != null ? Number(openTimeDaily) : null,
        pctVsDaily,
      };
    });

    return NextResponse.json({ rows, fetchedAt });
  } catch (e) {
    console.error("[api/mercados/snapshot]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
