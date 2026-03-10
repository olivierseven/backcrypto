// POST /api/biogenerator/checkout-pix — Cria pedido PIX via Pagar.me (Crypto, salva em cryptoPrisma)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate";
import crypto from "node:crypto";
import { decryptEmail } from "@/lib/crypto";
import { dbg, warn, error } from "@/lib/logger";
import { getUsdToBrlRate } from "@/lib/usd-brl-rate";
import { getBalance } from "@/lib/spend-coins";
import { hasActiveCredits } from "@/lib/user-tier";

const MAX_COINS_BEFORE_PURCHASE = 700_000_000; // 700 milhões — não permitir compra acima disso

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY!;
const PAGARME_ACCOUNT_ID = process.env.PAGARME_ACCOUNT_ID;
const PIX_EXPIRES_IN_SECONDS = 30 * 60;
/** Override para teste: ex. 100 = R$ 1,00. Em dev (NODE_ENV !== 'production') usa 100 se não definido; em produção só usa se a variável estiver definida. */
const PIX_TEST_AMOUNT_BRL_CENTS = (() => {
  const raw = process.env.PIX_TEST_AMOUNT_BRL_CENTS;
  const parsed = raw != null && raw !== "" ? Math.max(1, Math.min(50000, parseInt(raw, 10) || 100)) : null;
  if (parsed != null) return parsed;
  return process.env.NODE_ENV !== "production" ? 100 : 0;
})();
const PIX_CPF_SEM_INFORMAR = "01234567890";

// Crypto: $7 → 7 coins | $49 → 49 coins (valores em USD; PIX converte para BRL na hora)
const PLANS_USD = {
  "7": { coins: 7, amountUsdCents: 700 },
  "49": { coins: 49, amountUsdCents: 4900 },
} as const;

function usdCentsToBrlCents(usdCents: number, rate: number): number {
  return Math.round((usdCents / 100) * rate * 100);
}

type PlanKey = keyof typeof PLANS_USD;

function redactId(id?: string) {
  if (!id) return "";
  return id.length <= 10 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function pricingLabel(amountBrlCents: number, planKey: PlanKey) {
  return planKey === "7" ? `R$${(amountBrlCents / 100).toFixed(0)}→49k` : `R$${(amountBrlCents / 100).toFixed(0)}→490k`;
}

export async function POST(req: Request) {
  const rid = (crypto as any).randomUUID?.() ?? crypto.randomBytes(8).toString("hex");

  if (!PAGARME_SECRET_KEY) {
    error("[crypto/checkout-pix] PAGARME_SECRET_KEY missing");
    return NextResponse.json({ error: "pix_not_configured" }, { status: 503 });
  }

  const { ok } = rateLimit(clientKeyFromRequest(req, "crypto-checkout-pix"), 10, 60_000);
  if (!ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let payload: { sub?: string };
  try {
    const result = await jwtVerify(token, JWT_SECRET);
    payload = result.payload as { sub?: string };
  } catch {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  const userId = typeof payload?.sub === "string" ? payload.sub : null;
  if (!userId) return NextResponse.json({ error: "invalid_user" }, { status: 401 });

  const exists = await cryptoPrisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) {
    warn(`[crypto/checkout-pix] user not in DB userId=${userId.slice(0, 8)}...`);
    return NextResponse.json({ error: "user_not_found" }, { status: 403 });
  }

  const user = await cryptoPrisma.user.findUnique({
    where: { id: userId },
    select: { emailEnc: true, emailIv: true, emailTag: true, name: true },
  });
  if (!user) return NextResponse.json({ error: "invalid_user" }, { status: 401 });

  let userEmail = "";
  try {
    userEmail = decryptEmail(user.emailEnc, user.emailIv, user.emailTag);
  } catch {
    error("[crypto/checkout-pix] email_decrypt_fail");
    return NextResponse.json({ error: "email_decrypt_fail" }, { status: 500 });
  }

  let body: { plan?: string; returnTo?: string; cpf?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const planKey: PlanKey = body?.plan === "49" ? "49" : "7";
  const plan = PLANS_USD[planKey];

  const balance = await getBalance(userId);
  if (balance >= MAX_COINS_BEFORE_PURCHASE) {
    return NextResponse.json(
      { error: "balance_limit_reached", message: "Você já possui o limite máximo de coins. Não é possível comprar mais." },
      { status: 400 }
    );
  }

  const hasActive = await hasActiveCredits(userId);
  if (hasActive) {
    return NextResponse.json(
      { error: "already_has_active_plan", message: "Você já possui créditos ativos. Use-os ou aguarde o vencimento antes de comprar novamente." },
      { status: 409 }
    );
  }

  let amountBrlCents: number;
  let usdToBrlForLog: number | undefined;
  if (PIX_TEST_AMOUNT_BRL_CENTS > 0) {
    amountBrlCents = PIX_TEST_AMOUNT_BRL_CENTS;
    dbg(`[crypto/checkout-pix] using test override amountBrlCents=${amountBrlCents} (plan $${plan.amountUsdCents / 100})`);
  } else {
    const { rate } = await getUsdToBrlRate();
    usdToBrlForLog = rate;
    amountBrlCents = usdCentsToBrlCents(plan.amountUsdCents, rate);
  }

  const cpfRaw = typeof body?.cpf === "string" ? body.cpf.replace(/\D/g, "").slice(0, 11) : "";
  const customerCpf = cpfRaw.length === 11 ? cpfRaw.padStart(11, "0") : PIX_CPF_SEM_INFORMAR;
  const customerName = (user.name && user.name.trim()) || userEmail.split("@")[0] || "Cliente";

  const customer: Record<string, unknown> = {
    name: customerName,
    email: userEmail,
    type: "individual" as const,
    document: customerCpf,
    address: { line_1: "N/A", zip_code: "01310100", city: "São Paulo", state: "SP", country: "BR" },
    phones: { mobile_phone: { country_code: "55", area_code: "11", number: "999999999" } },
  };

  const orderPayload = {
    customer,
    items: [
      { amount: amountBrlCents, description: `${plan.coins.toLocaleString("pt-BR")} coins - Crypto (equiv. $${plan.amountUsdCents / 100})`, quantity: 1, code: `crypto_coins_${planKey}` },
    ],
    payments: [{ payment_method: "pix" as const, pix: { expires_in: PIX_EXPIRES_IN_SECONDS } }],
    metadata: { userId, coins: String(plan.coins), plan: planKey, crypto: "1" },
  };

  const auth = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString("base64");
  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
  };
  if (PAGARME_ACCOUNT_ID) headers["X-Account-Id"] = PAGARME_ACCOUNT_ID;

  try {
    dbg(`[crypto/checkout-pix] POST orders rid=${redactId(rid)} amountBrl=${amountBrlCents} ($${plan.amountUsdCents / 100}${usdToBrlForLog != null ? ` @ ${usdToBrlForLog}` : ""}) coins=${plan.coins}`);
    const apiRes = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers,
      body: JSON.stringify(orderPayload),
    });

    const responseData = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) {
      error(`[crypto/checkout-pix] Pagar.me API error status=${apiRes.status} body=${JSON.stringify(responseData)}`);
      return NextResponse.json(
        { error: responseData?.message || responseData?.errors?.[0]?.message || "pix_order_failed" },
        { status: 502 }
      );
    }

    const orderId = responseData?.id;
    if (!orderId) {
      error("[crypto/checkout-pix] Pagar.me response missing id");
      return NextResponse.json({ error: "pix_order_invalid_response" }, { status: 502 });
    }

    function stringOrNull(v: any): string | null {
      if (v == null) return null;
      const s = typeof v === "string" ? v.trim() : String(v).trim();
      return s.length > 0 ? s : null;
    }
    function looksLikePixEmv(s: string): boolean {
      return s.length >= 50 && !s.startsWith("http") && !s.startsWith("data:");
    }
    function extractPixFromPayload(data: any): { qrCode: string | null; qrCodeUrl: string | null; pixCopyPaste: string | null; expiresAt: Date | null } {
      let qrCode: string | null = null;
      let qrCodeUrl: string | null = null;
      let pixCopyPaste: string | null = null;
      let expiresAt: Date | null = null;
      function fromTx(tx: any) {
        if (!tx || typeof tx !== "object") return;
        const qr = tx.qr_code;
        if (qr != null && typeof qr === "object") {
          qrCode = stringOrNull(qr.content ?? qr.qr_code ?? qr.emv ?? qr.br_code) ?? qrCode;
          qrCodeUrl = stringOrNull(qr.qr_code_url ?? qr.url) ?? qrCodeUrl;
          pixCopyPaste = stringOrNull(qr.pix_copy_paste ?? qr.content ?? qr.emv ?? qr.br_code) ?? pixCopyPaste;
        } else {
          qrCode = stringOrNull(tx.qr_code ?? tx.qr_code_url ?? tx.qr_code_base64 ?? tx.content ?? tx.br_code) ?? qrCode;
          qrCodeUrl = stringOrNull(tx.qr_code_url ?? tx.qr_code) ?? qrCodeUrl;
          pixCopyPaste = stringOrNull(tx.pix_copy_paste ?? tx.pix_copy_paste_code ?? tx.emv ?? tx.br_code ?? tx.content) ?? pixCopyPaste;
        }
        if (tx.expires_at) expiresAt = new Date(tx.expires_at);
      }
      const charges = data?.charges ?? [];
      for (const c of charges) {
        if (c?.payment_method !== "pix") continue;
        fromTx(c?.last_transaction);
        if (qrCode || qrCodeUrl || pixCopyPaste) break;
        fromTx(c);
        const txs = Array.isArray(c?.transactions) ? c.transactions : [];
        for (const t of txs) {
          fromTx(t);
          if (qrCode || qrCodeUrl || pixCopyPaste) break;
        }
        if (qrCode || qrCodeUrl || pixCopyPaste) break;
      }
      if (!pixCopyPaste && !qrCode && Array.isArray(data?.qr_codes)) {
        const first = data.qr_codes[0];
        if (first) {
          qrCode = stringOrNull(first.qr_code ?? first.content) ?? qrCode;
          qrCodeUrl = stringOrNull(first.qr_code_url ?? first.content) ?? qrCodeUrl;
          pixCopyPaste = stringOrNull(first.pix_copy_paste ?? first.emv ?? first.content) ?? pixCopyPaste;
          if (first.expires_at) expiresAt = new Date(first.expires_at);
        }
      }
      if (!pixCopyPaste && qrCode && looksLikePixEmv(qrCode)) pixCopyPaste = qrCode;
      if (!pixCopyPaste && qrCodeUrl && looksLikePixEmv(qrCodeUrl)) pixCopyPaste = qrCodeUrl;
      return { qrCode, qrCodeUrl, pixCopyPaste, expiresAt };
    }

    let extracted = extractPixFromPayload(responseData);
    if (!extracted.pixCopyPaste && !extracted.qrCode && !extracted.qrCodeUrl) {
      dbg(`[crypto/checkout-pix] no PIX data in create response, fetching order orderId=${redactId(orderId)}`);
      try {
        const getRes = await fetch(`https://api.pagar.me/core/v5/orders/${orderId}`, {
          method: "GET",
          headers,
        });
        if (getRes.ok) extracted = extractPixFromPayload(await getRes.json().catch(() => ({})));
      } catch (e: any) {
        warn(`[crypto/checkout-pix] GET order failed ${e?.message ?? e}`);
      }
    }

    // Fallback: buscar cada charge individualmente (o QR pode vir só em GET /charges/{id})
    let chargeIds: string[] = (responseData?.charges ?? []).map((c: any) => c?.id).filter((id: any) => typeof id === "string");
    if (!extracted.pixCopyPaste && !extracted.qrCode && !extracted.qrCodeUrl && chargeIds.length === 0) {
      try {
        const getRes = await fetch(`https://api.pagar.me/core/v5/orders/${orderId}`, {
          method: "GET",
          headers,
        });
        if (getRes.ok) {
          const getData = await getRes.json().catch(() => ({}));
          chargeIds = (getData?.charges ?? []).map((c: any) => c?.id).filter((id: any) => typeof id === "string");
        }
      } catch {
        /* ignore */
      }
    }
    if (!extracted.pixCopyPaste && !extracted.qrCode && !extracted.qrCodeUrl && chargeIds.length > 0) {
      for (const chargeId of chargeIds) {
        if (extracted.pixCopyPaste || extracted.qrCode || extracted.qrCodeUrl) break;
        try {
          const chRes = await fetch(`https://api.pagar.me/core/v5/charges/${chargeId}`, {
            method: "GET",
            headers,
          });
          if (chRes.ok) {
            const chData = await chRes.json().catch(() => ({}));
            extracted = extractPixFromPayload({ charges: [chData] });
          }
        } catch (e: any) {
          warn(`[crypto/checkout-pix] GET charge failed chargeId=${chargeId} ${e?.message ?? e}`);
        }
      }
    }

    const { qrCode, qrCodeUrl, pixCopyPaste, expiresAt } = extracted;
    const expiresAtFallback = new Date(Date.now() + PIX_EXPIRES_IN_SECONDS * 1000);

    await cryptoPrisma.pagarMeOrder.create({
      data: {
        id: orderId,
        userId,
        status: "CREATED",
        amountTotalCents: amountBrlCents,
        coinsToCredit: plan.coins,
        currency: "BRL",
        pricingLabel: pricingLabel(amountBrlCents, planKey),
        qrCode: qrCode ?? undefined,
        qrCodeUrl: qrCodeUrl ?? undefined,
        pixCopyPaste: pixCopyPaste ?? undefined,
        expiresAt: expiresAt ?? expiresAtFallback,
      },
    });

    dbg(`[crypto/checkout-pix] order created orderId=${redactId(orderId)}`);
    return NextResponse.json(
      {
        orderId,
        qrCode: qrCode || qrCodeUrl,
        qrCodeUrl: qrCodeUrl || qrCode,
        pixCopyPaste,
        expiresAt: (expiresAt ?? expiresAtFallback).toISOString(),
        amountCents: amountBrlCents,
        amountUsd: plan.amountUsdCents / 100,
        coins: plan.coins,
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    error(`[crypto/checkout-pix] handler error ${msg}`);
    return NextResponse.json({ error: msg || "internal_error" }, { status: 500 });
  }
}
