import { cryptoPrisma } from "@/lib/crypto-db";
import { decryptEmail, normalizeEmail } from "@/lib/crypto";

const CODE_LEN = 7;

/** Normaliza entrada do utilizador para comparação com `AffiliateCoupon.code` (7 caracteres A–Z / 0–9). */
export function normalizeAffiliateCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export type ResolvedAffiliateCouponPlan = {
  code: string;
  affiliateAccountId: string;
  /** `idAfiliado` público quando existe `AffiliateApplication` com o mesmo e-mail da conta. */
  idAfiliado: string | null;
};

export type ResolveAffiliateCouponResult =
  | { ok: true; affiliate: null }
  | { ok: true; affiliate: ResolvedAffiliateCouponPlan }
  | { ok: false; error: "coupon_invalid_format" | "coupon_invalid_or_expired" };

/**
 * Cupom de plano: tem de existir em `AffiliateCoupon`, estar `ativo` e `expiresAt` > agora.
 * Devolve código + `affiliateAccountId` e, se possível, `idAfiliado` para metadata (Stripe / Pagar.me).
 */
export async function resolveAffiliateCouponForPlanCheckout(
  raw: string | undefined
): Promise<ResolveAffiliateCouponResult> {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return { ok: true, affiliate: null };

  const code = normalizeAffiliateCouponCode(s);
  if (code.length !== CODE_LEN) {
    return { ok: false, error: "coupon_invalid_format" };
  }

  const row = await cryptoPrisma.affiliateCoupon.findUnique({
    where: { code },
    select: { code: true, affiliateAccountId: true, ativo: true, expiresAt: true },
  });

  const now = new Date();
  if (!row || !row.ativo || !row.expiresAt || row.expiresAt <= now) {
    return { ok: false, error: "coupon_invalid_or_expired" };
  }

  let idAfiliado: string | null = null;
  try {
    const acc = await cryptoPrisma.affiliateAccount.findUnique({
      where: { id: row.affiliateAccountId },
      select: { emailEnc: true, emailIv: true, emailTag: true },
    });
    if (acc) {
      const email = decryptEmail(acc.emailEnc, acc.emailIv, acc.emailTag);
      const app = await cryptoPrisma.affiliateApplication.findUnique({
        where: { email: normalizeEmail(email) },
        select: { idAfiliado: true },
      });
      idAfiliado = app?.idAfiliado ?? null;
    }
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    affiliate: {
      code: row.code,
      affiliateAccountId: row.affiliateAccountId,
      idAfiliado,
    },
  };
}

/**
 * `StripePlanPayment.id_afiliado` e webhooks usam o `idAfiliado` público de `AffiliateApplication`, não o `id` (cuid) de `AffiliateAccount`.
 * O JWT de afiliado guarda `sub` = conta → converte aqui para o mesmo identificador das linhas de pagamento.
 */
export async function resolveAffiliateApplicationIdAfiliadoByAccountId(
  affiliateAccountId: string
): Promise<string | null> {
  const id = typeof affiliateAccountId === "string" ? affiliateAccountId.trim() : "";
  if (!id) return null;
  try {
    const acc = await cryptoPrisma.affiliateAccount.findUnique({
      where: { id },
      select: { emailEnc: true, emailIv: true, emailTag: true },
    });
    if (!acc) return null;
    const email = decryptEmail(acc.emailEnc, acc.emailIv, acc.emailTag);
    const app = await cryptoPrisma.affiliateApplication.findUnique({
      where: { email: normalizeEmail(email) },
      select: { idAfiliado: true },
    });
    return app?.idAfiliado ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve `idAfiliado` pelo código do cupom (sem exigir ativo/não-expirado).
 * Usado em webhooks para manter vínculo histórico nas cobranças recorrentes.
 */
export async function resolveAffiliateIdFromCouponCode(
  raw: string | undefined | null
): Promise<string | null> {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  const code = normalizeAffiliateCouponCode(s);
  if (code.length !== CODE_LEN) return null;

  try {
    const row = await cryptoPrisma.affiliateCoupon.findUnique({
      where: { code },
      select: { affiliateAccountId: true },
    });
    if (!row) return null;

    const acc = await cryptoPrisma.affiliateAccount.findUnique({
      where: { id: row.affiliateAccountId },
      select: { emailEnc: true, emailIv: true, emailTag: true },
    });
    if (!acc) return null;

    const email = decryptEmail(acc.emailEnc, acc.emailIv, acc.emailTag);
    const app = await cryptoPrisma.affiliateApplication.findUnique({
      where: { email: normalizeEmail(email) },
      select: { idAfiliado: true },
    });
    return app?.idAfiliado ?? null;
  } catch {
    return null;
  }
}
