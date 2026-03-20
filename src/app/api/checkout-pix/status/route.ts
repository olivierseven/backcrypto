// GET …/api/checkout-pix/status — status PIX (Crypto)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { handleOrderPaid } from "@/lib/pagarme-order-paid";
import { dbg } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;
const PAGARME_ACCOUNT_ID = process.env.PAGARME_ACCOUNT_ID;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId")?.trim();
  if (!orderId) {
    return NextResponse.json({ error: "missing_order_id" }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = typeof payload?.sub === "string" ? payload.sub : null;
    if (!userId) return NextResponse.json({ error: "invalid_user" }, { status: 401 });

    let order = await cryptoPrisma.pagarMeOrder.findFirst({
      where: { id: orderId, userId },
      select: { id: true, status: true, coinsToCredit: true, amountTotalCents: true, completedAt: true },
    });

    if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

    // Fallback: se ainda CREATED, consultar Pagar.me (útil quando webhook não chega, ex. localhost)
    if (order.status === "CREATED" && PAGARME_SECRET_KEY) {
      try {
        const auth = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString("base64");
        const headers: Record<string, string> = {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        };
        if (PAGARME_ACCOUNT_ID) headers["X-Account-Id"] = PAGARME_ACCOUNT_ID;
        const res = await fetch(`https://api.pagar.me/core/v5/orders/${orderId}`, { method: "GET", headers });
        if (res.ok) {
          const pgOrder = await res.json().catch(() => ({}));
          if (pgOrder?.status === "paid") {
            dbg(`[crypto/checkout-pix/status] order paid at Pagar.me, processing orderId=${orderId}`);
            await handleOrderPaid(pgOrder);
            order = await cryptoPrisma.pagarMeOrder.findFirst({
              where: { id: orderId, userId },
              select: { id: true, status: true, coinsToCredit: true, amountTotalCents: true, completedAt: true },
            }) ?? order;
          }
        }
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      coins: order.coinsToCredit,
      amountCents: order.amountTotalCents,
      completedAt: order.completedAt?.toISOString() ?? null,
    });
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
