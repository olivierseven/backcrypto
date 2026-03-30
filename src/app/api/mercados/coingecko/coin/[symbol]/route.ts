/**
 * Dados gerais da moeda via CoinGecko (resolve par Binance → id, depois GET /coins/{id}).
 * GET /crypto/api/mercados/coingecko/coin/{symbol}?lang=en|pt — requer sessão.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import {
  baseAssetFromBinanceSymbol,
  htmlDescriptionToPlainText,
  normalizeBinanceSymbol,
  resolveCoinGeckoId,
} from "@/lib/coingecko";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const CG = "https://api.coingecko.com/api/v3";

export async function GET(
  req: Request,
  context: { params: Promise<{ symbol: string }> },
) {
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

    const { symbol: raw } = await context.params;
    const binanceSymbol = normalizeBinanceSymbol(raw ?? "");
    const base = baseAssetFromBinanceSymbol(binanceSymbol);
    if (!base) {
      return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const lang = searchParams.get("lang") === "pt" ? "pt" : "en";

    const id = await resolveCoinGeckoId(base);
    if (!id) {
      return NextResponse.json({ error: "Coin not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const cgUrl = new URL(`${CG}/coins/${id}`);
    cgUrl.searchParams.set("localization", "true");
    cgUrl.searchParams.set("tickers", "false");
    cgUrl.searchParams.set("market_data", "true");
    cgUrl.searchParams.set("community_data", "false");
    cgUrl.searchParams.set("developer_data", "false");
    cgUrl.searchParams.set("sparkline", "false");

    const cgRes = await fetch(cgUrl.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!cgRes.ok) {
      if (cgRes.status === 429) {
        return NextResponse.json({ error: "Rate limited", code: "RATE_LIMIT" }, { status: 503 });
      }
      return NextResponse.json({ error: "CoinGecko error" }, { status: 502 });
    }

    const coin = (await cgRes.json()) as Record<string, unknown>;
    const descriptions = coin.description as Record<string, string> | undefined;
    const rawDesc =
      (descriptions?.[lang] && String(descriptions[lang]).trim()) ||
      (descriptions?.en && String(descriptions.en).trim()) ||
      "";
    const descriptionText = htmlDescriptionToPlainText(rawDesc);

    const payload = {
      binanceSymbol,
      coingeckoId: id,
      name: coin.name as string,
      symbol: String(coin.symbol ?? "").toUpperCase(),
      image: (coin.image as { large?: string } | undefined)?.large ?? null,
      categories: (coin.categories as string[]) ?? [],
      genesis_date: (coin.genesis_date as string | null) ?? null,
      hashing_algorithm: (coin.hashing_algorithm as string | null) ?? null,
      descriptionText,
      market_data: coin.market_data ?? null,
      public_notice: (coin.public_notice as string | null) ?? null,
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[api/mercados/coingecko/coin]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
