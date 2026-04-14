import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getCryptoT } from "@/app/lib/translations";
import AffiliateEstatisticasShell from "./AffiliateEstatisticasShell";
import {
  AFFILIATE_JWT_COOKIE_NAME,
  CRYPTO_AFFILIATE_ESTATISTICAS_PAGE,
  CRYPTO_AFFILIATE_LOGIN_PAGE,
} from "@/lib/crypto-auth-next";
import { getLocaleFromRequest } from "@/lib/get-locale-server";
import { cryptoPrisma } from "@/lib/crypto-db";
import { isAffiliateAccountingAdminEmail } from "@/lib/affiliate-accounting-admin";
import { refreshAffiliatePlanPaymentMonthAgg } from "@/lib/affiliate-plan-payment-month-agg";
import { MONTH_AGG_STATUS_PAGO } from "@/lib/affiliate-plan-payment-month-agg-status";
import { isAffiliatePayoutProfilePaymentComplete } from "@/lib/affiliate-payout-profile-complete";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE_PATH = "/crypto";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sevencoins.com.br";

const COOKIE = AFFILIATE_JWT_COOKIE_NAME;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const PAGE_META = {
  pt: {
    title: "Estatísticas do afiliado | Crypto Strategy",
    description: "Estatísticas de comissões e repasses (afiliados SevenCoins).",
  },
  en: {
    title: "Affiliate statistics | Crypto Strategy",
    description: "Commission and payout statistics (SevenCoins affiliates).",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocaleFromRequest();
  const t = PAGE_META[lang];
  return {
    title: t.title,
    description: t.description,
    robots: { index: false, follow: false },
    alternates: {
      canonical: `${BASE_URL}${CRYPTO_AFFILIATE_ESTATISTICAS_PAGE}`,
    },
  };
}

function currencyFromApplicationLocale(locale: string | null | undefined): "usd" | "brl" {
  return (locale ?? "").toLowerCase().startsWith("pt") ? "brl" : "usd";
}

function monthAggCurrency(
  stored: string | null | undefined,
  fallback: "usd" | "brl",
): "usd" | "brl" {
  const t = (stored ?? "").trim().toLowerCase();
  if (t === "brl" || t === "usd") return t;
  return fallback;
}

export default async function AfiliadosEstatisticasPage() {
  const lang = await getLocaleFromRequest();
  const t = getCryptoT(lang).landing.affiliatesPainel;

  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) {
    redirect(
      `${CRYPTO_AFFILIATE_LOGIN_PAGE}?lang=${lang}&next=${encodeURIComponent(CRYPTO_AFFILIATE_ESTATISTICAS_PAGE)}`,
    );
  }

  let email = "";
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.affiliate !== true || typeof payload.email !== "string") {
      redirect(`${CRYPTO_AFFILIATE_LOGIN_PAGE}?lang=${lang}`);
    }
    email = payload.email;
  } catch {
    redirect(`${CRYPTO_AFFILIATE_LOGIN_PAGE}?lang=${lang}`);
  }

  const logoutHref = `${BASE_PATH}/api/auth/afiliados/logout`;

  const application = await cryptoPrisma.affiliateApplication.findUnique({
    where: { email },
    select: {
      idAfiliado: true,
      locale: true,
      payoutProfile: true,
    },
  });

  const payoutProfileComplete = isAffiliatePayoutProfilePaymentComplete(
    application?.payoutProfile ?? null,
  );

  const defaultCur = currencyFromApplicationLocale(application?.locale);

  /**
   * Recalcula meses (incl. transição para `expirado`) no servidor.
   * O sync pós-login (`?login=1` → POST sync-plan-payments) é assíncrono e pode não ter corrido antes deste render;
   * abrir Estatísticas pelo menu não dispara esse sync — sem isto os dados ficam desatualizados.
   */
  if (application?.idAfiliado) {
    await refreshAffiliatePlanPaymentMonthAgg(application.idAfiliado);
  }

  let statsTotalEvaluatedCents = 0;
  let statsTotalPendingCents = 0;
  let statsTotalRefundedCents = 0;
  let statsTotalToReceiveCents = 0;
  let statsTotalExpiredCents = 0;
  let statsTotalPaidCents = 0;
  if (application?.idAfiliado) {
    const [agg, paidAgg] = await Promise.all([
      cryptoPrisma.affiliatePlanPaymentMonthAgg.aggregate({
        where: { idAfiliado: application.idAfiliado },
        _sum: {
          totalCommissionAffiliateCents: true,
          totalAprovadoCommissionAffiliateCents: true,
          totalReembolsadoCommissionAffiliateCents: true,
          totalExpiradoCommissionAffiliateCents: true,
        },
      }),
      cryptoPrisma.affiliatePlanPaymentMonthAgg.aggregate({
        where: { idAfiliado: application.idAfiliado, status: MONTH_AGG_STATUS_PAGO },
        _sum: { totalAprovadoCommissionAffiliateCents: true },
      }),
    ]);
    const sumComm = agg._sum.totalCommissionAffiliateCents ?? 0;
    const sumAprov = agg._sum.totalAprovadoCommissionAffiliateCents ?? 0;
    const sumReemb = agg._sum.totalReembolsadoCommissionAffiliateCents ?? 0;
    statsTotalExpiredCents = agg._sum.totalExpiradoCommissionAffiliateCents ?? 0;
    statsTotalEvaluatedCents = sumComm;
    statsTotalRefundedCents = sumReemb;
    /** Pendente: avaliado − aprovado (ainda ativo) − estornado − o que já foi para expirado (era aprovado). */
    statsTotalPendingCents = Math.max(0, sumComm - sumAprov - sumReemb - statsTotalExpiredCents);
    /** Total comissão = soma de aprovado ainda em linhas não expiradas (`total_aprovado` só lá). */
    statsTotalToReceiveCents = sumAprov;
    /** Meses com fecho `pago`: comissão efetivamente paga. */
    statsTotalPaidCents = paidAgg._sum.totalAprovadoCommissionAffiliateCents ?? 0;
  }

  const monthAggDb =
    application?.idAfiliado != null
      ? await cryptoPrisma.affiliatePlanPaymentMonthAgg.findMany({
          where: { idAfiliado: application.idAfiliado },
          orderBy: { monthStart: "desc" },
          select: {
            id: true,
            monthStart: true,
            totalCommissionAffiliateCents: true,
            totalReembolsadoCommissionAffiliateCents: true,
            totalAprovadoCommissionAffiliateCents: true,
            currencyAffiliate: true,
            status: true,
            invoice: { select: { id: true } },
          },
        })
      : [];

  const monthAggRows = monthAggDb.map((r) => ({
    id: r.id,
    monthStart: r.monthStart.toISOString(),
    totalCommissionAffiliateCents: r.totalCommissionAffiliateCents,
    totalReembolsadoCommissionAffiliateCents: r.totalReembolsadoCommissionAffiliateCents,
    totalAprovadoCommissionAffiliateCents: r.totalAprovadoCommissionAffiliateCents,
    currencyAffiliate: monthAggCurrency(r.currencyAffiliate, defaultCur),
    status: r.status,
    hasInvoice: !!r.invoice,
  }));

  const showAccountingNav = await isAffiliateAccountingAdminEmail(email);

  return (
    <AffiliateEstatisticasShell
      lang={lang}
      title={t.statsPageTitle}
      email={email}
      signedInAs={t.signedInAs}
      logoutHref={logoutHref}
      logoutLabel={t.logout}
      statsTotalEvaluatedCents={statsTotalEvaluatedCents}
      statsTotalPendingCents={statsTotalPendingCents}
      statsTotalRefundedCents={statsTotalRefundedCents}
      statsTotalToReceiveCents={statsTotalToReceiveCents}
      statsTotalPaidCents={statsTotalPaidCents}
      statsTotalEvaluatedCurrency={defaultCur}
      monthAggRows={monthAggRows}
      payoutProfileComplete={payoutProfileComplete}
      showAccountingNav={showAccountingNav}
    />
  );
}
