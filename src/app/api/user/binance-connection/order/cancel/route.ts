import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { z } from "zod";
import { binanceSignedDelete } from "@/lib/binance-user-api";
import { getUserBinanceCredentials } from "@/lib/user-binance-credentials";
import { cryptoPrisma } from "@/lib/crypto-db";
import { DEFAULT_SYMBOLS_LIST, getKlineSymbolsFromDb } from "@/app/lib/kline-symbols";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const bodySchema = z.object({
  symbol: z.string().trim().min(5).max(32),
  orderId: z.string().trim().min(1).max(32),
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

/** POST: cancelar ordem spot na Binance (só se existir registo nosso para user+symbol+orderId). */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const jsonBody = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
    }

    const sym = parsed.data.symbol.toUpperCase();
    const orderId = parsed.data.orderId.trim();

    let allowed = await getKlineSymbolsFromDb(cryptoPrisma);
    if (allowed.length === 0) allowed = [...DEFAULT_SYMBOLS_LIST];
    if (!allowed.includes(sym)) {
      return NextResponse.json({ error: "symbol_not_allowed" }, { status: 400 });
    }

    const row = await cryptoPrisma.userBinanceSpotOrder.findUnique({
      where: {
        userId_symbol_binanceOrderId: {
          userId,
          symbol: sym,
          binanceOrderId: orderId,
        },
      },
    });
    if (!row) {
      return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    }
    if (row.canceledAt != null) {
      return NextResponse.json({ error: "already_canceled" }, { status: 400 });
    }

    const creds = await getUserBinanceCredentials(userId);
    if (!creds) return NextResponse.json({ error: "not_connected" }, { status: 400 });

    const res = await binanceSignedDelete("/api/v3/order", creds.apiKey, creds.apiSecret, {
      symbol: sym,
      orderId,
      recvWindow: "5000",
    });

    if (!res.ok) {
      const j = res.json as { code?: number; msg?: string } | null;
      return NextResponse.json(
        { error: "binance_error", code: j?.code, msg: j?.msg ?? "cancel_failed" },
        { status: 400 }
      );
    }

    const canceled = res.json as { status?: string } | null;
    await cryptoPrisma.userBinanceSpotOrder.update({
      where: { id: row.id },
      data: {
        canceledAt: new Date(),
        status: typeof canceled?.status === "string" ? canceled.status : "CANCELED",
      },
    });

    return NextResponse.json({ success: true, order: res.json });
  } catch (e) {
    console.error("[binance-connection/order/cancel POST]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
