import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { z } from "zod";
import { binanceSignedPost } from "@/lib/binance-user-api";
import { getUserBinanceCredentials } from "@/lib/user-binance-credentials";
import { cryptoPrisma } from "@/lib/crypto-db";
import { DEFAULT_SYMBOLS_LIST, getKlineSymbolsFromDb } from "@/app/lib/kline-symbols";
import { floorPriceToTick, floorQuantityToLotStep, getSymbolSpotFilters } from "@/lib/binance-exchange-filters";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const bodySchema = z
  .object({
    symbol: z.string().trim().min(5).max(32),
    side: z.enum(["BUY", "SELL"]),
    type: z.enum(["MARKET", "LIMIT"]),
    quoteOrderQty: z.string().trim().optional(),
    quantity: z.string().trim().optional(),
    price: z.string().trim().optional(),
    timeInForce: z.enum(["GTC"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "LIMIT") {
      if (!data.price || !data.quantity) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "limit_requires_price_quantity" });
      }
    } else if (data.type === "MARKET") {
      if (data.side === "BUY") {
        if (!data.quoteOrderQty && !data.quantity) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "market_buy_requires_quote_or_qty" });
        }
      } else if (!data.quantity) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "market_sell_requires_quantity" });
      }
    }
  });

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

/** Spot USDT pair: BTCUSDT → base BTC, quote USDT */
function parseUsdtPair(symbol: string): { base: string; quote: "USDT" } | null {
  const s = symbol.trim().toUpperCase();
  if (!s.endsWith("USDT") || s.length <= 4) return null;
  return { base: s.slice(0, -4), quote: "USDT" };
}

async function persistUserSpotOrder(
  userId: string,
  symbol: string,
  side: string,
  orderType: string,
  orderJson: unknown
): Promise<void> {
  try {
    if (typeof orderJson !== "object" || orderJson === null) return;
    const o = orderJson as Record<string, unknown>;
    const oid = o.orderId;
    if (oid === undefined || oid === null) return;
    const binanceOrderId = String(oid);
    await cryptoPrisma.userBinanceSpotOrder.create({
      data: {
        userId,
        symbol,
        binanceOrderId,
        side,
        orderType,
        status: typeof o.status === "string" ? o.status : null,
        price: typeof o.price === "string" ? o.price : null,
        origQty: typeof o.origQty === "string" ? o.origQty : null,
        executedQty: typeof o.executedQty === "string" ? o.executedQty : null,
        rawJson: orderJson as object,
      },
    });
  } catch (e) {
    console.error("[binance-connection/order] persist", e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const jsonBody = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { symbol, side, type, quoteOrderQty, quantity, price, timeInForce } = parsed.data;
    const sym = symbol.toUpperCase();

    let allowed = await getKlineSymbolsFromDb(cryptoPrisma);
    if (allowed.length === 0) allowed = [...DEFAULT_SYMBOLS_LIST];
    if (!allowed.includes(sym)) {
      return NextResponse.json({ error: "symbol_not_allowed" }, { status: 400 });
    }

    if (!parseUsdtPair(sym)) {
      return NextResponse.json({ error: "pair_unsupported" }, { status: 400 });
    }

    const creds = await getUserBinanceCredentials(userId);
    if (!creds) return NextResponse.json({ error: "not_connected" }, { status: 400 });

    const params: Record<string, string> = {
      symbol: sym,
      side,
      type,
      recvWindow: "5000",
    };

    if (type === "MARKET") {
      if (side === "BUY") {
        const qUsdt = quoteOrderQty?.trim() ?? "";
        const qBase = quantity?.trim() ?? "";
        if (qUsdt.length > 0) {
          params.quoteOrderQty = qUsdt;
        } else if (qBase.length > 0) {
          params.quantity = qBase;
        }
      } else {
        params.quantity = quantity!.trim();
      }
    } else {
      params.timeInForce = timeInForce ?? "GTC";
      params.price = price!.trim();
      params.quantity = quantity!.trim();
    }

    const filters = await getSymbolSpotFilters(sym);

    if (type === "LIMIT" && params.price && filters.price) {
      params.price = floorPriceToTick(params.price, filters.price.tickSize);
    }

    if (params.quantity) {
      const lot = filters.lot;
      if (lot) {
        const adjusted = floorQuantityToLotStep(params.quantity, lot.stepSize);
        const adjN = parseFloat(adjusted);
        const minN = parseFloat(lot.minQty);
        if (!Number.isFinite(adjN) || adjN <= 0) {
          return NextResponse.json(
            { error: "binance_error", msg: "LOT_SIZE: quantity rounds to zero for this pair's step size.", code: -1013 },
            { status: 400 }
          );
        }
        if (Number.isFinite(minN) && adjN + 1e-12 < minN) {
          return NextResponse.json(
            {
              error: "binance_error",
              msg: `Quantity below minimum (${lot.minQty}) for this symbol after LOT_SIZE rounding.`,
              code: -1013,
            },
            { status: 400 }
          );
        }
        params.quantity = adjusted;
      }
    }

    const res = await binanceSignedPost("/api/v3/order", creds.apiKey, creds.apiSecret, params);
    if (!res.ok) {
      const j = res.json as { code?: number; msg?: string } | null;
      return NextResponse.json(
        { error: "binance_error", code: j?.code, msg: j?.msg ?? "order_failed" },
        { status: 400 }
      );
    }

    await persistUserSpotOrder(userId, sym, side, type, res.json);

    return NextResponse.json({ success: true, order: res.json });
  } catch (e) {
    console.error("[binance-connection/order POST]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
