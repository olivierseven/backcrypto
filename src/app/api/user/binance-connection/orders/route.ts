import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { DEFAULT_SYMBOLS_LIST, getKlineSymbolsFromDb } from "@/app/lib/kline-symbols";
import { parseSpotOrderRawJson } from "@/lib/user-spot-order-chart";

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

/** GET: lê só `UserBinanceSpotOrder` (Prisma) — ordens gravadas quando o utilizador envia ordem via esta app (`POST …/order`). Não lista ordens da exchange que não passaram pela app. */
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

    const rows = await cryptoPrisma.userBinanceSpotOrder.findMany({
      where: {
        userId,
        symbol,
        canceledAt: null,
        OR: [{ status: null }, { status: { notIn: ["CANCELED", "CANCELLED"] } }],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        binanceOrderId: true,
        side: true,
        orderType: true,
        status: true,
        price: true,
        origQty: true,
        executedQty: true,
        rawJson: true,
        canceledAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      orders: rows.map((o) => {
        const parsed = parseSpotOrderRawJson(o.rawJson);
        const transactTimeMs =
          parsed.transactTimeMs != null && Number.isFinite(parsed.transactTimeMs)
            ? parsed.transactTimeMs
            : o.createdAt.getTime();
        return {
          binanceOrderId: o.binanceOrderId,
          side: o.side,
          orderType: o.orderType,
          status: o.status,
          price: o.price,
          origQty: o.origQty,
          executedQty: o.executedQty,
          transactTimeMs,
          quoteQty: parsed.quoteQty,
          avgPrice: parsed.avgPrice,
          commission: parsed.commission,
          commissionAsset: parsed.commissionAsset,
          canceledAt: o.canceledAt?.toISOString() ?? null,
          createdAt: o.createdAt.toISOString(),
        };
      }),
    });
  } catch (e) {
    console.error("[binance-connection/orders GET]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
