import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { fetchBinanceAccount } from "@/lib/binance-user-api";
import { getUserBinanceCredentials } from "@/lib/user-binance-credentials";
import { cryptoPrisma } from "@/lib/crypto-db";
import { DEFAULT_SYMBOLS_LIST, getKlineSymbolsFromDb } from "@/app/lib/kline-symbols";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

/** Ativos spot a mostrar: moedas de cotação (USDT/USDC) + bases dos pares listados em KlineSymbol (ex.: BTCUSDT → BTC). */
function allowedSpotAssetsFromKlineSymbols(symbols: string[]): Set<string> {
  const allowed = new Set<string>(["USDT"]);
  for (const raw of symbols) {
    const s = raw.trim().toUpperCase();
    if (s.endsWith("USDT") && s.length > 4) {
      allowed.add(s.slice(0, -4));
    } else if (s.endsWith("USDC") && s.length > 4) {
      allowed.add(s.slice(0, -4));
      allowed.add("USDC");
    }
  }
  return allowed;
}

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

/** GET: saldos spot (chama Binance com as chaves guardadas). */
export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const creds = await getUserBinanceCredentials(userId);
    if (!creds) return NextResponse.json({ error: "not_connected" }, { status: 400 });

    let account;
    try {
      account = await fetchBinanceAccount(creds.apiKey, creds.apiSecret);
    } catch (e) {
      console.error("[binance-connection/balances]", e);
      return NextResponse.json({ error: "binance_network" }, { status: 502 });
    }

    if (!account.ok) {
      return NextResponse.json(
        { error: "binance_rejected", code: account.code, msg: account.msg },
        { status: 400 }
      );
    }

    const usdtFromAccount = account.balances.find((b) => b.asset.trim().toUpperCase() === "USDT");

    let pairSymbols: string[] = [];
    try {
      pairSymbols = await getKlineSymbolsFromDb(cryptoPrisma);
    } catch (e) {
      console.error("[binance-connection/balances] getKlineSymbolsFromDb", e);
      pairSymbols = [];
    }
    if (pairSymbols.length === 0) {
      pairSymbols = [...DEFAULT_SYMBOLS_LIST];
    }
    const allowedAssets = allowedSpotAssetsFromKlineSymbols(pairSymbols);

    const nonzero = account.balances
      .map((b) => ({
        asset: b.asset.trim().toUpperCase(),
        free: b.free,
        locked: b.locked,
        total: (parseFloat(b.free) + parseFloat(b.locked)).toFixed(8),
      }))
      .filter((b) => parseFloat(b.total) > 0 && allowedAssets.has(b.asset))
      .sort((a, b) => {
        if (a.asset === "USDT") return -1;
        if (b.asset === "USDT") return 1;
        return a.asset.localeCompare(b.asset);
      });

    return NextResponse.json({
      balances: nonzero,
      /** USDT livre direto da conta (spot), útil se o filtro por KlineSymbol falhar ou a lista filtrada omitir USDT. */
      usdtSpotFree: usdtFromAccount?.free ?? "0",
    });
  } catch (e) {
    console.error("[binance-connection/balances GET]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
