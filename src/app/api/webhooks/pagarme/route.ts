// POST /api/biogenerator/webhooks/pagarme — Webhook Pagar.me para Bio (auth: BG_PAGARME_WEBHOOK_*)
// Crédito de coins e e-mail de recibo só ocorrem quando este webhook é chamado. Em localhost o Pagar.me
// precisa de URL pública (ex.: ngrok) ou teste em ambiente deployado.
import { NextResponse } from "next/server";
import { bioPrisma } from "@/lib/bio-db";
import { CheckoutStatus } from "@/lib/prisma-bio-client";
import { handleOrderPaid } from "@/lib/pagarme-order-paid";
import { dbg, warn, error } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BG_WEBHOOK_USER = process.env.BG_PAGARME_WEBHOOK_USER!;
const BG_WEBHOOK_PASSWORD = process.env.BG_PAGARME_WEBHOOK_PASSWORD!;

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
  const updated = await bioPrisma.pagarMeOrder.updateMany({
    where: { id: orderId, status: CheckoutStatus.CREATED },
    data: { status: CheckoutStatus.CANCELED },
  });
  if (updated.count > 0) dbg(`[pagarme-bio] order.canceled orderId=${orderId}`);
}

export async function POST(req: Request) {
  const auth = parseBasicAuth(req.headers.get("authorization"));
  if (
    !BG_WEBHOOK_USER ||
    !BG_WEBHOOK_PASSWORD ||
    !auth ||
    auth.user !== BG_WEBHOOK_USER ||
    auth.pass !== BG_WEBHOOK_PASSWORD
  ) {
    warn(`[pagarme-bio] webhook auth failed`);
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

  dbg(`[pagarme-bio] webhook type=${eventType} id=${body?.id ?? "-"}`);

  try {
    switch (eventType) {
      case "order.paid":
        await handleOrderPaid(data);
        break;
      case "order.canceled":
        await handleOrderCanceled(data);
        break;
      case "order.payment_failed":
        dbg(`[pagarme-bio] order.payment_failed orderId=${data?.id ?? "-"}`);
        break;
      default:
        dbg(`[pagarme-bio] unhandled event type=${eventType}`);
    }
    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`[pagarme-bio] webhook error type=${eventType} ${msg}`);
    return NextResponse.json({ error: msg || "internal_error" }, { status: 500 });
  }
}
