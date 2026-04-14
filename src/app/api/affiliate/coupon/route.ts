import { NextResponse } from "next/server";
import { Prisma } from "@/lib/prisma-bio-client";
import { cryptoPrisma } from "@/lib/crypto-db";
import { normalizeEmail } from "@/lib/crypto";
import { getAffiliateSessionFromCookie } from "@/lib/affiliate-jwt-server";
import { rateLimit } from "@/lib/rate";

/** Sessão + candidatura aprovada (cupom só com `AffiliateApplication.approved`). */
async function getAffiliateCouponContext(): Promise<{
  affiliateId: string;
  applicationApproved: boolean;
} | null> {
  const session = await getAffiliateSessionFromCookie();
  if (!session) return null;
  const app = await cryptoPrisma.affiliateApplication.findUnique({
    where: { email: normalizeEmail(session.email) },
    select: { approved: true },
  });
  return {
    affiliateId: session.accountId,
    applicationApproved: app?.approved === true,
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Janela após ativar o cupom (48 horas). */
const ACTIVATE_DURATION_MS = 48 * 60 * 60 * 1000;

/** Charset visível (A–Z e 0–9), 7 caracteres — ~78 bi combinações. */
const CODE_LEN = 7;
const CODE_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomCode7(): string {
  const buf = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < CODE_LEN; i++) {
    s += CODE_CHARS[buf[i]! % CODE_CHARS.length]!;
  }
  return s;
}

const MAX_INSERT_ATTEMPTS = 48;

function mapCouponRow(r: {
  code: string;
  createdAt: Date;
  ativo: boolean;
  expiresAt: Date | null;
}) {
  return {
    code: r.code,
    createdAt: r.createdAt.toISOString(),
    ativo: r.ativo,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
  };
}

/** Cupom ainda não ativado (único “rascunho” permitido por afiliado). */
async function countNeverActivatedInactive(affiliateId: string): Promise<number> {
  return cryptoPrisma.affiliateCoupon.count({
    where: {
      affiliateAccountId: affiliateId,
      ativo: false,
      expiresAt: null,
    },
  });
}

/** Cupom com validade ainda vigente (no máximo um por afiliado). */
async function countCurrentlyValidActive(affiliateId: string): Promise<number> {
  const now = new Date();
  return cryptoPrisma.affiliateCoupon.count({
    where: {
      affiliateAccountId: affiliateId,
      ativo: true,
      expiresAt: { gt: now },
    },
  });
}

/** GET — lista cupons do afiliado autenticado (mais recentes primeiro). */
export async function GET() {
  const ctx = await getAffiliateCouponContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { affiliateId, applicationApproved } = ctx;

  const [items, neverActivatedInactive, validActive] = await Promise.all([
    cryptoPrisma.affiliateCoupon.findMany({
      where: { affiliateAccountId: affiliateId },
      orderBy: { createdAt: "desc" },
      select: { code: true, createdAt: true, ativo: true, expiresAt: true },
    }),
    countNeverActivatedInactive(affiliateId),
    countCurrentlyValidActive(affiliateId),
  ]);

  return NextResponse.json({
    items: items.map(mapCouponRow),
    canGenerate: neverActivatedInactive === 0 && applicationApproved,
    applicationApproved,
    hasValidActiveCoupon: validActive >= 1,
  });
}

/** POST — gera novo cupom (ativo=false, expiresAt=null até o afiliado ativar). */
export async function POST() {
  const ctx = await getAffiliateCouponContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.applicationApproved) {
    return NextResponse.json({ error: "not_approved" }, { status: 403 });
  }
  const affiliateId = ctx.affiliateId;

  const acc = await cryptoPrisma.affiliateAccount.findUnique({
    where: { id: affiliateId },
    select: { id: true, ativo: true },
  });
  if (!acc?.ativo) {
    return NextResponse.json({ error: "inactive" }, { status: 403 });
  }

  const { ok, retryAfter } = rateLimit(`aff-coupon-gen:${affiliateId}`, 24, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: retryAfter },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfter / 1000)) } }
    );
  }

  if ((await countNeverActivatedInactive(affiliateId)) >= 1) {
    return NextResponse.json({ error: "max_inactive_reached" }, { status: 409 });
  }

  for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt++) {
    const code = randomCode7();
    try {
      const row = await cryptoPrisma.affiliateCoupon.create({
        data: {
          affiliateAccountId: affiliateId,
          code,
        },
      });
      return NextResponse.json(mapCouponRow(row));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        continue;
      }
      throw e;
    }
  }

  return NextResponse.json({ error: "unique_code_failed" }, { status: 503 });
}

/** PATCH — ativa cupom: ativo=true e expiresAt = agora + 48h (só se ainda inativo). Body: { "code": "ABC12XY" } */
export async function PATCH(request: Request) {
  const ctx = await getAffiliateCouponContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.applicationApproved) {
    return NextResponse.json({ error: "not_approved" }, { status: 403 });
  }
  const affiliateId = ctx.affiliateId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const codeRaw = typeof (body as { code?: unknown })?.code === "string" ? (body as { code: string }).code.trim().toUpperCase() : "";
  if (codeRaw.length !== CODE_LEN || !/^[0-9A-Z]{7}$/.test(codeRaw)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const acc = await cryptoPrisma.affiliateAccount.findUnique({
    where: { id: affiliateId },
    select: { ativo: true },
  });
  if (!acc?.ativo) {
    return NextResponse.json({ error: "inactive" }, { status: 403 });
  }

  const { ok, retryAfter } = rateLimit(`aff-coupon-act:${affiliateId}`, 40, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: retryAfter },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfter / 1000)) } }
    );
  }

  const coupon = await cryptoPrisma.affiliateCoupon.findFirst({
    where: { code: codeRaw, affiliateAccountId: affiliateId },
  });
  if (!coupon) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (coupon.ativo) {
    return NextResponse.json(
      {
        error: "already_active",
        ...mapCouponRow(coupon),
      },
      { status: 409 }
    );
  }
  /** Já foi ativado alguma vez (ex.: após expirar) — não reativar. */
  if (coupon.expiresAt != null) {
    return NextResponse.json(
      {
        error: "cannot_reactivate",
        ...mapCouponRow(coupon),
      },
      { status: 409 }
    );
  }

  if ((await countCurrentlyValidActive(affiliateId)) >= 1) {
    return NextResponse.json({ error: "max_active_reached" }, { status: 409 });
  }

  const expiresAt = new Date(Date.now() + ACTIVATE_DURATION_MS);
  const updated = await cryptoPrisma.affiliateCoupon.update({
    where: { id: coupon.id },
    data: { ativo: true, expiresAt },
  });

  return NextResponse.json(mapCouponRow(updated));
}
