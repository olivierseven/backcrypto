import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { binanceSignedGet } from "@/lib/binance-user-api";
import { getUserBinanceCredentials } from "@/lib/user-binance-credentials";

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

/** GET ?symbol=BTCUSDT — comissões maker/taker (Spot) para estimativas na UI. */
export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
    if (!symbol || !symbol.endsWith("USDT")) {
      return NextResponse.json({ error: "invalid_symbol" }, { status: 400 });
    }

    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const creds = await getUserBinanceCredentials(userId);
    if (!creds) return NextResponse.json({ error: "not_connected" }, { status: 400 });

    const { ok, json } = await binanceSignedGet("/api/v3/tradeFee", creds.apiKey, creds.apiSecret, { symbol });
    if (!ok || !Array.isArray(json)) {
      const j = json as { code?: number; msg?: string } | null;
      return NextResponse.json(
        { error: "binance_rejected", code: j?.code, msg: j?.msg },
        { status: 400 }
      );
    }

    const row = json.find((x: unknown) => {
      if (typeof x !== "object" || x === null) return false;
      const s = (x as { symbol?: string }).symbol;
      return s === symbol;
    }) as { makerCommission?: string; takerCommission?: string } | undefined;

    if (!row) {
      return NextResponse.json({ error: "symbol_not_found" }, { status: 404 });
    }

    return NextResponse.json({
      symbol,
      makerCommission: row.makerCommission ?? "0.001",
      takerCommission: row.takerCommission ?? "0.001",
    });
  } catch (e) {
    console.error("[binance-connection/trade-fee GET]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
