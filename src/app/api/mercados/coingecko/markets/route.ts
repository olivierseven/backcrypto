/**
 * Mercado “geral” (CoinGecko): volume 24h USD, preço USD, variação % 24h por símbolo ativo (mesmo universo do snapshot).
 * GET /crypto/api/mercados/coingecko/markets — requer sessão.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { unstable_cache } from "next/cache";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Prisma } from "@/lib/prisma-bio-client";
import {
  baseAssetFromBinanceSymbol,
  coinIdsForBaseFromList,
  resolveCoinGeckoId,
} from "@/lib/coingecko";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const CG = "https://api.coingecko.com/api/v3";

const fetchCoinsList = unstable_cache(
  async () => {
    const res = await fetch(`${CG}/coins/list?include_platform=false`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) throw new Error("CoinGecko coins/list failed");
    return (await res.json()) as { id: string; symbol: string }[];
  },
  ["coingecko-coins-list-mercados"],
  { revalidate: 86_400 },
);

type CgMarket = {
  id: string;
  current_price: number | null;
  total_volume: number | null;
  market_cap: number | null;
  price_change_percentage_24h: number | null;
};

function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}

async function fetchMarketsByIds(ids: string[]): Promise<Map<string, CgMarket>> {
  const map = new Map<string, CgMarket>();
  const chunkSize = 200;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const url = new URL(`${CG}/coins/markets`);
    url.searchParams.set("vs_currency", "usd");
    url.searchParams.set("ids", chunk.join(","));
    url.searchParams.set("order", "market_cap_desc");
    url.searchParams.set("per_page", "250");
    url.searchParams.set("page", "1");
    url.searchParams.set("sparkline", "false");

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("RATE_LIMIT");
      throw new Error(`CoinGecko markets ${res.status}`);
    }
    const arr = (await res.json()) as Record<string, unknown>[];
    for (const row of arr) {
      const id = String(row.id ?? "");
      if (!id) continue;
      map.set(id, {
        id,
        current_price: num(row.current_price),
        total_volume: num(row.total_volume),
        market_cap: num(row.market_cap),
        price_change_percentage_24h: num(row.price_change_percentage_24h),
      });
    }
  }
  return map;
}

/** Entre vários ids com o mesmo símbolo, escolhe o de maior volume 24h USD (como no site CoinGecko); empate por market cap. */
function pickBestCoinGeckoId(candidateIds: string[], marketById: Map<string, CgMarket>): string | null {
  if (candidateIds.length === 0) return null;
  let bestId: string | null = null;
  let bestVol = -Infinity;
  let bestCap = -Infinity;
  for (const id of candidateIds) {
    const m = marketById.get(id);
    const vol = m?.total_volume;
    const cap = m?.market_cap;
    const v = vol != null && Number.isFinite(vol) ? vol : -Infinity;
    const c = cap != null && Number.isFinite(cap) ? cap : -Infinity;
    if (v > bestVol || (v === bestVol && c > bestCap)) {
      bestVol = v;
      bestCap = c;
      bestId = id;
    }
  }
  return bestId;
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

    const symRows = await cryptoPrisma.$queryRaw<{ symbol: string }[]>(Prisma.sql`
      SELECT symbol FROM backcrypto."KlineSymbol" WHERE ativo = true ORDER BY symbol ASC
    `);

    const list = await fetchCoinsList();
    const binanceToCandidates = new Map<string, string[]>();
    const allCandidateIds = new Set<string>();

    for (const { symbol: binanceSym } of symRows) {
      const base = baseAssetFromBinanceSymbol(binanceSym);
      if (!base) continue;
      let candidates = coinIdsForBaseFromList(list, base);
      if (candidates.length === 0) {
        const resolved = await resolveCoinGeckoId(base);
        if (resolved) candidates = [resolved];
      }
      if (candidates.length === 0) continue;
      binanceToCandidates.set(binanceSym, candidates);
      candidates.forEach((id) => allCandidateIds.add(id));
    }

    let marketById = new Map<string, CgMarket>();
    try {
      const uniqueIds = [...allCandidateIds];
      if (uniqueIds.length > 0) {
        marketById = await fetchMarketsByIds(uniqueIds);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "RATE_LIMIT") {
        return NextResponse.json({ error: "Rate limited", code: "RATE_LIMIT" }, { status: 503 });
      }
      throw e;
    }

    const idBySymbol = new Map<string, string>();
    for (const [binanceSym, candidates] of binanceToCandidates) {
      const bestId = pickBestCoinGeckoId(candidates, marketById);
      if (bestId) idBySymbol.set(binanceSym, bestId);
    }

    const rows = symRows.map(({ symbol: binanceSym }) => {
      const base = baseAssetFromBinanceSymbol(binanceSym);
      if (!base) {
        return {
          symbol: binanceSym,
          coingeckoId: null as string | null,
          volumeUsd24h: null as number | null,
          lastPriceUsd: null as number | null,
          pct24h: null as number | null,
        };
      }
      const id = idBySymbol.get(binanceSym) ?? null;
      if (!id) {
        return {
          symbol: binanceSym,
          coingeckoId: null,
          volumeUsd24h: null,
          lastPriceUsd: null,
          pct24h: null,
        };
      }
      const m = marketById.get(id);
      return {
        symbol: binanceSym,
        coingeckoId: id,
        volumeUsd24h: m?.total_volume ?? null,
        lastPriceUsd: m?.current_price ?? null,
        pct24h: m?.price_change_percentage_24h ?? null,
      };
    });

    return NextResponse.json({ rows, fetchedAt: Date.now(), source: "coingecko" as const });
  } catch (e) {
    console.error("[api/mercados/coingecko/markets]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
