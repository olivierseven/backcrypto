import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { jwtVerify } from "jose";
import { z } from "zod";
import { cryptoPrisma } from "@/lib/crypto-db";
import { encryptSensitiveString } from "@/lib/crypto";
import { fetchBinanceAccount } from "@/lib/binance-user-api";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const postSchema = z.object({
  apiKey: z.string().trim().min(10, "apiKey"),
  apiSecret: z.string().trim().min(10, "apiSecret"),
  consentAccepted: z.literal(true),
});

const patchSchema = z
  .object({
    defaultQuoteUsdtPerOrder: z.union([z.null(), z.number().positive().max(1_000_000_000)]).optional(),
    /** Taxa taker 0–1 (ex. 0.001); null = usar defeito global nas estimativas. */
    feeEstimateTakerFallback: z.union([z.null(), z.number().min(0).max(0.05)]).optional(),
  })
  .refine((d) => d.defaultQuoteUsdtPerOrder !== undefined || d.feeEstimateTakerFallback !== undefined, {
    message: "no_fields",
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

/** GET: estado da ligação (sem chamar Binance). */
export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const row = await cryptoPrisma.userBinanceConnection.findUnique({
      where: { userId },
      select: {
        apiKeyLast4: true,
        lastVerifiedAt: true,
        createdAt: true,
        defaultQuoteUsdtPerOrder: true,
        feeEstimateTakerFallback: true,
      },
    });
    if (!row) {
      return NextResponse.json({ connected: false });
    }
    return NextResponse.json({
      connected: true,
      apiKeyLast4: row.apiKeyLast4,
      lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
      connectedAt: row.createdAt.toISOString(),
      defaultQuoteUsdtPerOrder:
        row.defaultQuoteUsdtPerOrder != null ? row.defaultQuoteUsdtPerOrder.toString() : null,
      feeEstimateTakerFallback:
        row.feeEstimateTakerFallback != null ? row.feeEstimateTakerFallback.toString() : null,
    });
  } catch (e) {
    console.error("[binance-connection GET]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/** POST: guardar chaves (testa leitura na Binance antes). */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { apiKey, apiSecret } = parsed.data;

    let account;
    try {
      account = await fetchBinanceAccount(apiKey, apiSecret);
    } catch (e) {
      console.error("[binance-connection] fetch account", e);
      return NextResponse.json({ error: "binance_network" }, { status: 502 });
    }

    if (!account.ok) {
      return NextResponse.json(
        {
          error: "binance_rejected",
          code: account.code,
          msg: account.msg,
        },
        { status: 400 }
      );
    }

    const payloadJson = JSON.stringify({ apiKey, apiSecret });
    let enc: ReturnType<typeof encryptSensitiveString>;
    try {
      enc = encryptSensitiveString(payloadJson);
    } catch (e) {
      console.error("[binance-connection] encrypt", e);
      return NextResponse.json({ error: "encryption_unavailable" }, { status: 500 });
    }

    const apiKeyLast4 = apiKey.length >= 4 ? apiKey.slice(-4) : "****";
    const now = new Date();

    await cryptoPrisma.userBinanceConnection.upsert({
      where: { userId },
      create: {
        userId,
        payloadEnc: enc.enc,
        payloadIv: enc.iv,
        payloadTag: enc.tag,
        apiKeyLast4,
        lastVerifiedAt: now,
      },
      update: {
        payloadEnc: enc.enc,
        payloadIv: enc.iv,
        payloadTag: enc.tag,
        apiKeyLast4,
        lastVerifiedAt: now,
      },
    });

    revalidatePath(`${APP_CRYPTO_ROUTE_PREFIX}/conta`, "layout");
    return NextResponse.json({
      success: true,
      apiKeyLast4,
      lastVerifiedAt: now.toISOString(),
      balancesSample: summarizeBalances(account.balances),
    });
  } catch (e) {
    console.error("[binance-connection POST]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

function summarizeBalances(balances: { asset: string; free: string; locked: string }[]) {
  const nonzero = balances.filter((b) => {
    const t = parseFloat(b.free) + parseFloat(b.locked);
    return Number.isFinite(t) && t > 0;
  });
  const usdt = nonzero.find((b) => b.asset === "USDT");
  return {
    nonZeroCount: nonzero.length,
    usdtFree: usdt ? usdt.free : null,
  };
}

/** PATCH: preferências (ex.: USDT por operação nas boletas). */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { defaultQuoteUsdtPerOrder, feeEstimateTakerFallback } = parsed.data;

    const existing = await cryptoPrisma.userBinanceConnection.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "not_connected" }, { status: 400 });
    }

    const data: { defaultQuoteUsdtPerOrder?: null | number; feeEstimateTakerFallback?: null | number } = {};
    if (defaultQuoteUsdtPerOrder !== undefined) {
      data.defaultQuoteUsdtPerOrder = defaultQuoteUsdtPerOrder === null ? null : defaultQuoteUsdtPerOrder;
    }
    if (feeEstimateTakerFallback !== undefined) {
      data.feeEstimateTakerFallback =
        feeEstimateTakerFallback === null ? null : feeEstimateTakerFallback;
    }

    await cryptoPrisma.userBinanceConnection.update({
      where: { userId },
      data,
    });

    revalidatePath(`${APP_CRYPTO_ROUTE_PREFIX}/conta`, "layout");
    const updated = await cryptoPrisma.userBinanceConnection.findUnique({
      where: { userId },
      select: { defaultQuoteUsdtPerOrder: true, feeEstimateTakerFallback: true },
    });
    return NextResponse.json({
      success: true,
      defaultQuoteUsdtPerOrder:
        updated?.defaultQuoteUsdtPerOrder != null ? updated.defaultQuoteUsdtPerOrder.toString() : null,
      feeEstimateTakerFallback:
        updated?.feeEstimateTakerFallback != null ? updated.feeEstimateTakerFallback.toString() : null,
    });
  } catch (e) {
    console.error("[binance-connection PATCH]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/** DELETE: remover ligação. */
export async function DELETE() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    await cryptoPrisma.userBinanceConnection.deleteMany({ where: { userId } });
    revalidatePath(`${APP_CRYPTO_ROUTE_PREFIX}/conta`, "layout");
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[binance-connection DELETE]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
