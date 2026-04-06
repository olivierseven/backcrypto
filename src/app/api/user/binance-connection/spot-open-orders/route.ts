import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { binanceSignedGet } from "@/lib/binance-user-api";
import { getUserBinanceCredentials } from "@/lib/user-binance-credentials";
import { cryptoPrisma } from "@/lib/crypto-db";
import { DEFAULT_SYMBOLS_LIST, getKlineSymbolsFromDb } from "@/app/lib/kline-symbols";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

async function getUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

type BinanceOpenOrder = {
  symbol?: string;
  side?: string;
  type?: string;
  status?: string;
  price?: string;
  orderId?: number | string;
};

type OpenLimitRow = { orderId: string; price: number };

const EMPTY_OPEN_LIMITS = {
  prices: [] as number[],
  orders: [] as OpenLimitRow[],
  sellPrices: [] as number[],
  sellOrders: [] as OpenLimitRow[],
};

/** GET: ordens limite abertas compra + venda (LIMIT / LIMIT_MAKER, NEW / PARTIALLY_FILLED) — preços para linhas no gráfico. */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
    if (symbol.length < 5 || symbol.length > 32) {
      return NextResponse.json({ error: "invalid_symbol" }, { status: 400 });
    }

    let allowed = await getKlineSymbolsFromDb(cryptoPrisma);
    if (allowed.length === 0) allowed = [...DEFAULT_SYMBOLS_LIST];
    if (!allowed.includes(symbol)) {
      return NextResponse.json({ error: "symbol_not_allowed" }, { status: 400 });
    }

    const creds = await getUserBinanceCredentials(userId);
    if (!creds) return NextResponse.json({ error: "not_connected", ...EMPTY_OPEN_LIMITS }, { status: 200 });

    const res = await binanceSignedGet("/api/v3/openOrders", creds.apiKey, creds.apiSecret, {
      symbol,
      recvWindow: "5000",
    });

    if (!res.ok) {
      return NextResponse.json(EMPTY_OPEN_LIMITS);
    }

    const raw = res.json;
    if (!Array.isArray(raw)) {
      return NextResponse.json(EMPTY_OPEN_LIMITS);
    }

    const orders: OpenLimitRow[] = [];
    const prices = new Set<number>();
    const sellOrders: OpenLimitRow[] = [];
    const sellPrices = new Set<number>();

    for (const o of raw as BinanceOpenOrder[]) {
      const t = String(o.type ?? "").toUpperCase();
      if (t !== "LIMIT" && t !== "LIMIT_MAKER") continue;
      const st = String(o.status ?? "").toUpperCase();
      if (st !== "NEW" && st !== "PARTIALLY_FILLED") continue;
      const px = parseFloat(String(o.price ?? ""));
      if (!Number.isFinite(px) || px <= 0) continue;
      const oid = o.orderId;
      if (oid === undefined || oid === null) continue;
      const side = String(o.side ?? "").toUpperCase();
      if (side === "BUY") {
        prices.add(px);
        orders.push({ orderId: String(oid), price: px });
      } else if (side === "SELL") {
        sellPrices.add(px);
        sellOrders.push({ orderId: String(oid), price: px });
      }
    }

    orders.sort((a, b) => a.price - b.price || a.orderId.localeCompare(b.orderId));
    const sorted = [...prices].sort((a, b) => a - b);
    sellOrders.sort((a, b) => b.price - a.price || a.orderId.localeCompare(b.orderId));
    const sellSorted = [...sellPrices].sort((a, b) => b - a);
    return NextResponse.json({ prices: sorted, orders, sellPrices: sellSorted, sellOrders });
  } catch (e) {
    console.error("[binance-connection/spot-open-orders GET]", e);
    return NextResponse.json({ error: "server_error", ...EMPTY_OPEN_LIMITS }, { status: 500 });
  }
}
