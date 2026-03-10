// POST /api/biogenerator/webhooks/pagarme — Webhook Pagar.me para Crypto (auth: PAGARME_WEBHOOK_*)
// Crédito de coins e e-mail de recibo quando o webhook é chamado. Em localhost use URL pública (ex.: ngrok) ou teste em deploy.
import { NextResponse } from "next/server";
import { cryptoPrisma } from "@/lib/crypto-db";
import { CheckoutStatus } from "@/lib/prisma-bio-client";
import { handleOrderPaid } from "@/lib/pagarme-order-paid";
import { dbg, warn, error } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_USER = process.env.PAGARME_WEBHOOK_USER!;
const WEBHOOK_PASSWORD = process.env.PAGARME_WEBHOOK_PASSWORD!;

function parseBasicAuth(authHeader: string | null): { user: string; pass: string } | null {
  if (!authHeader || !authHeader.startsWith("Basic ")) return null;
  try {
    const b64 = authHeader.slice(6).trim();
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    const i = decoded.indexOf(":");
    if (i < 0) return null;
    return { user: decoded.slice(0, i), pass: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

async function handleOrderCanceled(data: any) {
  const orderId = data?.id;
  if (!orderId) return;
  const updated = await cryptoPrisma.pagarMeOrder.updateMany({
    where: { id: orderId, status: CheckoutStatus.CREATED },
    data: { status: CheckoutStatus.CANCELED },
  });
  if (updated.count > 0) dbg(`[pagarme-crypto] order.canceled orderId=${orderId}`);
}

export async function POST(req: Request) {
  const auth = parseBasicAuth(req.headers.get("authorization"));
  if (
    !WEBHOOK_USER ||
    !WEBHOOK_PASSWORD ||
    !auth ||
    auth.user !== WEBHOOK_USER ||
    auth.pass !== WEBHOOK_PASSWORD
  ) {
    warn(`[pagarme-crypto] webhook auth failed`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = body?.type ?? body?.event ?? "";
  const data = body?.data ?? body;

  dbg(`[pagarme-crypto] webhook type=${eventType} id=${body?.id ?? "-"}`);

  try {
    switch (eventType) {
      case "order.paid":
        await handleOrderPaid(data);
        break;
      case "order.canceled":
        await handleOrderCanceled(data);
        break;
      case "order.payment_failed":
        dbg(`[pagarme-crypto] order.payment_failed orderId=${data?.id ?? "-"}`);
        break;
      default:
        dbg(`[pagarme-crypto] unhandled event type=${eventType}`);
    }
    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`[pagarme-crypto] webhook error type=${eventType} ${msg}`);
    return NextResponse.json({ error: msg || "internal_error" }, { status: 500 });
  }
}
