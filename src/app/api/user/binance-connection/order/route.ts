import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { z } from "zod";
import { binanceSignedPost } from "@/lib/binance-user-api";
import { getUserBinanceCredentials } from "@/lib/user-binance-credentials";
import { cryptoPrisma } from "@/lib/crypto-db";
import { DEFAULT_SYMBOLS_LIST, getKlineSymbolsFromDb } from "@/app/lib/kline-symbols";
import {
  floorPriceToTick,
  floorQuantityToLotStep,
  getSymbolSpotFiltersForOrder,
  peekStaleSymbolSpotFilters,
} from "@/lib/binance-exchange-filters";
import { deriveSpotOrderExecutionPriceFromRawJson } from "@/lib/user-spot-order-chart";
import { parseBinanceOrderResponseForPerformance } from "@/lib/robot-spot-performance-from-order";
import { Prisma } from "@/lib/prisma-bio-client";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";

function orderUsesBinanceProxy(): boolean {
  return Boolean(process.env.BINANCE_PROXY_URL?.trim() && process.env.BINANCE_PROXY_SECRET?.trim());
}

/** Grava em `LogErro` (backcrypto); não usa console. Falhas de insert são ignoradas para não quebrar a resposta HTTP. */
async function persistOrderErrorLog(reason: string, payload: Record<string, unknown>): Promise<void> {
  const origem = `binance-connection/order:${reason}`.slice(0, 512);
  let msgErro: string;
  try {
    msgErro = JSON.stringify({ ...payload, viaProxy: orderUsesBinanceProxy() });
  } catch {
    msgErro = "[persistOrderErrorLog] JSON.stringify failed";
  }
  try {
    await cryptoPrisma.logErro.create({
      data: { origem, msgErro },
    });
  } catch {
    /* evita 500 se a tabela estiver indisponível */
  }
}
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
    robotId: z.string().trim().min(1).max(64).optional(),
    robotAlias: z.string().trim().max(160).optional(),
    executionRole: z.enum(["OPEN_BUY", "FLATTEN", "SIGNAL_SELL", "STOP_LOSS", "STOP_GAIN"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.robotId && !data.executionRole) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "robot_requires_execution_role" });
    }
    if (data.executionRole && !data.robotId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "execution_role_requires_robot_id" });
    }
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
    const priceStored =
      deriveSpotOrderExecutionPriceFromRawJson(orderJson) ??
      (typeof o.price === "string" && o.price.trim() !== "" ? o.price : null);
    await cryptoPrisma.userBinanceSpotOrder.create({
      data: {
        userId,
        symbol,
        binanceOrderId,
        side,
        orderType,
        status: typeof o.status === "string" ? o.status : null,
        price: priceStored,
        origQty: typeof o.origQty === "string" ? o.origQty : null,
        executedQty: typeof o.executedQty === "string" ? o.executedQty : null,
        rawJson: orderJson as object,
      },
    });
  } catch (e) {
    await persistOrderErrorLog("persist_failed", {
      symbol,
      side,
      orderType,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

async function persistRobotSpotPerformanceEvent(
  userId: string,
  symbol: string,
  input: {
    robotId: string;
    robotAlias: string | null;
    executionRole: string;
    side: string;
    orderJson: unknown;
  }
): Promise<void> {
  const orderJson = input.orderJson;
  try {
    if (typeof orderJson !== "object" || orderJson === null) return;
    const o = orderJson as Record<string, unknown>;
    const oid = o.orderId;
    if (oid === undefined || oid === null) return;
    const binanceOrderId = String(oid);
    const metrics = parseBinanceOrderResponseForPerformance(orderJson);
    await cryptoPrisma.robotSpotPerformanceEvent.create({
      data: {
        userId,
        robotId: input.robotId,
        robotAliasSnapshot: input.robotAlias?.trim() || null,
        symbol,
        side: input.side,
        executionRole: input.executionRole,
        binanceOrderId,
        executedQtyBase: metrics.executedQtyBase,
        quoteQtyUsdt: metrics.quoteQtyUsdt,
        avgPrice: metrics.avgPrice,
        feeUsdt: metrics.feeUsdt,
        realizedPnlUsdt: null,
        rawJson: orderJson as object,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return;
    }
    await persistOrderErrorLog("robot_performance_persist_failed", {
      symbol,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function POST(request: NextRequest) {
  const diag: Record<string, unknown> = { viaProxy: orderUsesBinanceProxy() };
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    diag.userId = userId;

    const jsonBody = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { symbol, side, type, quoteOrderQty, quantity, price, timeInForce, robotId, robotAlias, executionRole } =
      parsed.data;
    const sym = symbol.toUpperCase();
    diag.symbol = sym;
    diag.side = side;
    diag.type = type;

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

    const filters = await getSymbolSpotFiltersForOrder(sym);

    if (type === "LIMIT" && params.price) {
      if (!filters.price?.tickSize) {
        const stale = peekStaleSymbolSpotFilters(sym);
        await persistOrderErrorLog("exchange_filters_unavailable_price", {
          symbol: sym,
          side,
          type,
          mergedFilters: { hasPriceTick: false, hasLot: Boolean(filters.lot) },
          staleInstanceCache: stale
            ? { hasPriceTick: Boolean(stale.price?.tickSize), hasLot: Boolean(stale.lot) }
            : null,
        });
        return NextResponse.json(
          {
            error: "exchange_filters_unavailable",
            msg: "Could not load PRICE_FILTER for this symbol. Please try again in a moment.",
          },
          { status: 503 }
        );
      }
      params.price = floorPriceToTick(params.price, filters.price.tickSize);
    }

    if (type === "LIMIT" && params.quantity && !filters.lot) {
      const stale = peekStaleSymbolSpotFilters(sym);
      await persistOrderErrorLog("exchange_filters_unavailable_lot", {
        symbol: sym,
        side,
        type,
        mergedFilters: { hasPriceTick: Boolean(filters.price?.tickSize), hasLot: false },
        staleInstanceCache: stale
          ? { hasPriceTick: Boolean(stale.price?.tickSize), hasLot: Boolean(stale.lot) }
          : null,
      });
      return NextResponse.json(
        {
          error: "exchange_filters_unavailable",
          msg: "Could not load LOT_SIZE for this symbol. Please try again in a moment.",
        },
        { status: 503 }
      );
    }

    if (params.quantity) {
      const lot = filters.lot;
      if (lot) {
        const adjusted = floorQuantityToLotStep(params.quantity, lot.stepSize);
        const adjN = parseFloat(adjusted);
        const minN = parseFloat(lot.minQty);
        if (!Number.isFinite(adjN) || adjN <= 0) {
          await persistOrderErrorLog("lot_size_rounds_to_zero", {
            symbol: sym,
            side,
            type,
            stepSize: lot.stepSize,
            quantityBefore: params.quantity,
          });
          return NextResponse.json(
            { error: "binance_error", msg: "LOT_SIZE: quantity rounds to zero for this pair's step size.", code: -1013 },
            { status: 400 }
          );
        }
        if (Number.isFinite(minN) && adjN + 1e-12 < minN) {
          await persistOrderErrorLog("lot_size_below_min_qty", {
            symbol: sym,
            side,
            type,
            minQty: lot.minQty,
            stepSize: lot.stepSize,
            quantityAfterFloor: adjusted,
          });
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

    const minNotStr = filters.minNotional?.trim() ?? "";
    if (minNotStr !== "") {
      const minNot = parseFloat(minNotStr);
      if (Number.isFinite(minNot) && minNot > 0) {
        if (type === "LIMIT" && params.price && params.quantity) {
          const px = parseFloat(params.price);
          const q = parseFloat(params.quantity);
          if (Number.isFinite(px) && Number.isFinite(q) && px > 0 && q > 0) {
            const notional = px * q;
            if (notional + 1e-12 < minNot) {
              await persistOrderErrorLog("min_notional_below", {
                symbol: sym,
                side,
                type,
                notional,
                minNotional: minNotStr,
              });
              return NextResponse.json({ error: "binance_min_notional", minNotional: minNotStr }, { status: 400 });
            }
          }
        }
        if (type === "MARKET" && side === "BUY" && params.quoteOrderQty) {
          const quote = parseFloat(params.quoteOrderQty);
          if (Number.isFinite(quote) && quote > 0 && quote + 1e-12 < minNot) {
            await persistOrderErrorLog("min_notional_below_market_buy", {
              symbol: sym,
              quoteOrderQty: params.quoteOrderQty,
              minNotional: minNotStr,
            });
            return NextResponse.json({ error: "binance_min_notional", minNotional: minNotStr }, { status: 400 });
          }
        }
      }
    }

    const res = await binanceSignedPost("/api/v3/order", creds.apiKey, creds.apiSecret, params);
    if (!res.ok) {
      const j = res.json as { code?: number; msg?: string } | null;
      const rawMsg = j?.msg ?? "";
      await persistOrderErrorLog("binance_order_http_error", {
        symbol: sym,
        side,
        type,
        httpStatus: res.status,
        binanceCode: j?.code,
        binanceMsg: rawMsg,
      });
      if (/notional/i.test(rawMsg)) {
        const minStr = filters.minNotional?.trim();
        return NextResponse.json(
          {
            error: "binance_notional",
            ...(minStr ? { minNotional: minStr } : {}),
            msg: rawMsg,
            code: j?.code,
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "binance_error", code: j?.code, msg: rawMsg || "order_failed" },
        { status: 400 }
      );
    }

    await persistUserSpotOrder(userId, sym, side, type, res.json);

    if (robotId && executionRole) {
      await persistRobotSpotPerformanceEvent(userId, sym, {
        robotId: robotId.trim(),
        robotAlias: robotAlias?.trim() ?? null,
        executionRole,
        side,
        orderJson: res.json,
      });
    }

    return NextResponse.json({ success: true, order: res.json });
  } catch (e) {
    await persistOrderErrorLog("server_error", {
      ...diag,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
