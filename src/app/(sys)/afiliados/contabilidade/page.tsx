import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getCryptoT } from "@/app/lib/translations";
import AffiliateContabilidadeShell from "./AffiliateContabilidadeShell";
import {
  AFFILIATE_JWT_COOKIE_NAME,
  CRYPTO_AFFILIATE_CONTABILIDADE_PAGE,
  CRYPTO_AFFILIATE_LOGIN_PAGE,
  CRYPTO_AFFILIATE_PAINEL_PAGE,
} from "@/lib/crypto-auth-next";
import { getLocaleFromRequest } from "@/lib/get-locale-server";
import { cryptoPrisma } from "@/lib/crypto-db";
import { isAffiliateAccountingAdminEmail } from "@/lib/affiliate-accounting-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE_PATH = "/crypto";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sevencoins.com.br";

const COOKIE = AFFILIATE_JWT_COOKIE_NAME;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const PAGE_META = {
  pt: {
    title: "Contabilidade afiliados | Crypto Strategy",
    description: "Visão global de fechos mensais (admin).",
  },
  en: {
    title: "Affiliate accounting | Crypto Strategy",
    description: "Global monthly affiliate totals (admin).",
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
      canonical: `${BASE_URL}${CRYPTO_AFFILIATE_CONTABILIDADE_PAGE}`,
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

export default async function AfiliadosContabilidadePage() {
  const lang = await getLocaleFromRequest();
  const t = getCryptoT(lang).landing.affiliatesPainel;

  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) {
    redirect(
      `${CRYPTO_AFFILIATE_LOGIN_PAGE}?lang=${lang}&next=${encodeURIComponent(CRYPTO_AFFILIATE_CONTABILIDADE_PAGE)}`,
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

  if (!(await isAffiliateAccountingAdminEmail(email))) {
    redirect(`${CRYPTO_AFFILIATE_PAINEL_PAGE}?lang=${lang}`);
  }

  const rawRows = await cryptoPrisma.affiliatePlanPaymentMonthAgg.findMany({
    orderBy: [{ monthStart: "desc" }, { idAfiliado: "asc" }],
    select: {
      id: true,
      idAfiliado: true,
      monthStart: true,
      totalCommissionAffiliateCents: true,
      totalReembolsadoCommissionAffiliateCents: true,
      totalAprovadoCommissionAffiliateCents: true,
      currencyAffiliate: true,
      status: true,
      expiresAt: true,
      invoice: { select: { id: true } },
    },
  });

  const idAfiliados = [...new Set(rawRows.map((r) => r.idAfiliado))];
  const locales =
    idAfiliados.length > 0
      ? await cryptoPrisma.affiliateApplication.findMany({
          where: { idAfiliado: { in: idAfiliados } },
          select: { idAfiliado: true, locale: true },
        })
      : [];
  const defaultCurByAff = new Map<string, "usd" | "brl">(
    locales.map((a) => [a.idAfiliado, currencyFromApplicationLocale(a.locale)]),
  );

  const rows = rawRows.map((r) => ({
    id: r.id,
    idAfiliado: r.idAfiliado,
    monthStart: r.monthStart.toISOString(),
    totalCommissionAffiliateCents: r.totalCommissionAffiliateCents,
    totalReembolsadoCommissionAffiliateCents: r.totalReembolsadoCommissionAffiliateCents,
    totalAprovadoCommissionAffiliateCents: r.totalAprovadoCommissionAffiliateCents,
    currencyAffiliate: monthAggCurrency(r.currencyAffiliate, defaultCurByAff.get(r.idAfiliado) ?? "usd"),
    status: r.status,
    hasInvoice: !!r.invoice,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
  }));

  let sumTotalAvaliadoCents = 0;
  let sumComissaoCents = 0;
  let sumReembolsadoCents = 0;
  let sumPagoCents = 0;
  for (const r of rawRows) {
    sumTotalAvaliadoCents += r.totalCommissionAffiliateCents;
    sumComissaoCents += r.totalAprovadoCommissionAffiliateCents;
    sumReembolsadoCents += r.totalReembolsadoCommissionAffiliateCents;
    if (r.status.trim().toLowerCase() === "pago") {
      sumPagoCents += r.totalAprovadoCommissionAffiliateCents;
    }
  }
  const sumPendingCents = Math.max(0, sumComissaoCents - sumPagoCents);

  const logoutHref = `${BASE_PATH}/api/auth/afiliados/logout`;

  return (
    <AffiliateContabilidadeShell
      lang={lang}
      title={t.contabilidadePageTitle}
      statsCardsTitle={t.contabilidadeStatsCardsTitle}
      totalEvaluatedUsd={sumTotalAvaliadoCents / 100}
      totalPendingUsd={sumPendingCents / 100}
      totalToReceiveUsd={sumPagoCents / 100}
      totalRefundedUsd={sumReembolsadoCents / 100}
      labelEvaluated={t.statsTotalEvaluated}
      labelPending={t.statsTotalPending}
      labelToReceive={t.contabilidadeStatsTotalPago}
      labelRefunded={t.statsTotalRefunded}
      sectionTitle={t.contabilidadeSectionTitle}
      email={email}
      signedInAs={t.signedInAs}
      logoutHref={logoutHref}
      logoutLabel={t.logout}
      rows={rows}
      colAffiliateId={t.contabilidadeColAffiliateId}
      colMonth={t.statsMonthColMonth}
      colStatus={t.statsMonthColStatus}
      colTotal={t.statsTotalEvaluated}
      colRefunded={t.statsMonthColRefunded}
      colApproved={t.contabilidadeColComissao}
      colHasInvoice={t.contabilidadeColHasInvoice}
      hasInvoiceYes={t.contabilidadeHasInvoiceYes}
      hasInvoiceNo={t.contabilidadeHasInvoiceNo}
      downloadInvoiceLabel={t.statsMonthDownloadInvoice}
      emptyMessage={t.contabilidadeEmpty}
      monthAggStatusEmAberto={t.monthAggStatusEmAberto}
      monthAggStatusAguardandoNotaFiscal={t.monthAggStatusAguardandoNotaFiscal}
      monthAggStatusNotaFiscalEmAnalise={t.monthAggStatusNotaFiscalEmAnalise}
      monthAggStatusPago={t.monthAggStatusPago}
      monthAggStatusRejeitadoValorIncorreto={t.monthAggStatusRejeitadoValorIncorreto}
      monthAggStatusRejeitadoNfInvalida={t.monthAggStatusRejeitadoNfInvalida}
      monthAggStatusExpirado={t.monthAggStatusExpirado}
      colExpiration={t.statsMonthColExpiration}
      colAcoes={t.contabilidadeColAcoes}
      actionMarkAsPaid={t.contabilidadeActionMarkAsPaid}
      actionRejectWrongValue={t.contabilidadeActionRejectWrongValue}
      actionRejectInvalidNf={t.contabilidadeActionRejectInvalidNf}
      actionUpdating={t.contabilidadeActionUpdating}
      actionUpdateError={t.contabilidadeActionUpdateError}
    />
  );
}
