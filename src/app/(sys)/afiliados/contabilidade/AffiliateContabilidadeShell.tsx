"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AffiliateAreaHeader from "../AffiliateAreaHeader";
import AffiliateStatsCard from "../painel/AffiliateStatsCard";
import { getCryptoT } from "@/app/lib/translations";
import type { CryptoLang } from "@/app/lib/translations";
import {
  MONTH_AGG_STATUS_AGUARDANDO_NOTA_FISCAL,
  MONTH_AGG_STATUS_EM_ABERTO,
  MONTH_AGG_STATUS_EXPIRADO,
  MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE,
  MONTH_AGG_STATUS_PAGO,
  MONTH_AGG_STATUS_REJEITADO_NF_INVALIDA,
  MONTH_AGG_STATUS_REJEITADO_VALOR_INCORRETO,
  monthAggStatusLabel,
} from "@/lib/affiliate-plan-payment-month-agg-status";
import { CRYPTO_BASE_PATH } from "@/lib/crypto-auth-next";
import { formatAffiliateMoneyCents } from "@/lib/affiliate-stripe-plan-payment-amount";

export type ContabilidadeRow = {
  id: string;
  idAfiliado: string;
  monthStart: string;
  totalCommissionAffiliateCents: number;
  totalReembolsadoCommissionAffiliateCents: number;
  totalAprovadoCommissionAffiliateCents: number;
  currencyAffiliate: "usd" | "brl";
  status: string;
  hasInvoice: boolean;
  expiresAt: string | null;
};

function formatMonthUtc(monthStartIso: string, lang: CryptoLang): string {
  const d = new Date(monthStartIso.slice(0, 10) + "T12:00:00.000Z");
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function statusBadgeClass(status: string): string {
  if (status === MONTH_AGG_STATUS_PAGO) {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  }
  if (status === MONTH_AGG_STATUS_REJEITADO_VALOR_INCORRETO || status === MONTH_AGG_STATUS_REJEITADO_NF_INVALIDA) {
    return "bg-rose-100 text-rose-800 ring-rose-200";
  }
  if (status === MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE) {
    return "bg-amber-100 text-amber-800 ring-amber-200";
  }
  if (status === MONTH_AGG_STATUS_AGUARDANDO_NOTA_FISCAL) {
    return "bg-violet-100 text-violet-800 ring-violet-200";
  }
  if (status === MONTH_AGG_STATUS_EM_ABERTO) {
    return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
  if (status === MONTH_AGG_STATUS_EXPIRADO) {
    return "bg-slate-200 text-slate-800 ring-slate-300";
  }
  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function formatExpiresAtUtc(isoDate: string | null, lang: CryptoLang): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate.slice(0, 10) + "T12:00:00.000Z");
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(d);
}

export default function AffiliateContabilidadeShell({
  lang,
  title,
  statsCardsTitle,
  totalEvaluatedUsd,
  totalPendingUsd,
  totalToReceiveUsd,
  totalRefundedUsd,
  labelEvaluated,
  labelPending,
  labelToReceive,
  labelRefunded,
  sectionTitle,
  email,
  signedInAs,
  logoutHref,
  logoutLabel,
  rows,
  colAffiliateId,
  colMonth,
  colStatus,
  colTotal,
  colRefunded,
  colApproved,
  colExpiration,
  colHasInvoice,
  hasInvoiceYes,
  hasInvoiceNo,
  downloadInvoiceLabel,
  emptyMessage,
  monthAggStatusEmAberto,
  monthAggStatusAguardandoNotaFiscal,
  monthAggStatusNotaFiscalEmAnalise,
  monthAggStatusPago,
  monthAggStatusRejeitadoValorIncorreto,
  monthAggStatusRejeitadoNfInvalida,
  monthAggStatusExpirado,
  colAcoes,
  actionMarkAsPaid,
  actionRejectWrongValue,
  actionRejectInvalidNf,
  actionUpdating,
  actionUpdateError,
}: {
  lang: CryptoLang;
  title: string;
  statsCardsTitle: string;
  totalEvaluatedUsd: number;
  totalPendingUsd: number;
  totalToReceiveUsd: number;
  totalRefundedUsd: number;
  labelEvaluated: string;
  labelPending: string;
  labelToReceive: string;
  labelRefunded: string;
  sectionTitle: string;
  email: string;
  signedInAs: string;
  logoutHref: string;
  logoutLabel: string;
  rows: ContabilidadeRow[];
  colAffiliateId: string;
  colMonth: string;
  colStatus: string;
  colTotal: string;
  colRefunded: string;
  colApproved: string;
  colExpiration: string;
  colHasInvoice: string;
  hasInvoiceYes: string;
  hasInvoiceNo: string;
  downloadInvoiceLabel: string;
  emptyMessage: string;
  monthAggStatusEmAberto: string;
  monthAggStatusAguardandoNotaFiscal: string;
  monthAggStatusNotaFiscalEmAnalise: string;
  monthAggStatusPago: string;
  monthAggStatusRejeitadoValorIncorreto: string;
  monthAggStatusRejeitadoNfInvalida: string;
  monthAggStatusExpirado: string;
  colAcoes: string;
  actionMarkAsPaid: string;
  actionRejectWrongValue: string;
  actionRejectInvalidNf: string;
  actionUpdating: string;
  actionUpdateError: string;
}) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const tp = getCryptoT(lang).landing.affiliatesPainel;
  const statusLabels = {
    monthAggStatusEmAberto,
    monthAggStatusAguardandoNotaFiscal,
    monthAggStatusNotaFiscalEmAnalise,
    monthAggStatusPago,
    monthAggStatusRejeitadoValorIncorreto,
    monthAggStatusRejeitadoNfInvalida,
    monthAggStatusExpirado,
  };

  async function onChangeStatus(
    rowId: string,
    action: "pago" | "rejeitado_valor_incorreto" | "rejeitado_nf_invalida",
  ) {
    setUpdatingId(rowId);
    setActionError(null);
    try {
      const res = await fetch(`${CRYPTO_BASE_PATH}/api/affiliate/month-agg-status`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthAggId: rowId, action }),
      });
      if (!res.ok) {
        setActionError(actionUpdateError);
        return;
      }
      router.refresh();
    } catch {
      setActionError(actionUpdateError);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex h-[100dvh] min-h-0 min-w-0 w-full flex-col overflow-hidden bg-transparent">
      <AffiliateAreaHeader
        lang={lang}
        centerTitle={title}
        showBackToPainel={false}
        backToPainelLabel=""
        email={email}
        signedInAs={signedInAs}
        logoutHref={logoutHref}
        logoutLabel={logoutLabel}
        cuponsNavAria={tp.cuponsNavAria}
        statsNavAria={tp.statsNavAria}
        showAccountingNav
        accountingNavAria={tp.contabilidadeNavAria}
      />
      <main className="crypto-conta-page relative flex flex-1 min-h-0 min-w-0 w-full flex-col items-center overflow-auto overflow-x-hidden">
        <div className="crypto-conta-wrap relative mx-auto w-full max-w-[1200px] flex-1 px-0 py-0 sm:px-6 md:px-8">
          <div className="space-y-6 pt-4 sm:pt-2 pb-8">
            <AffiliateStatsCard
              lang={lang}
              title={statsCardsTitle}
              totalEvaluatedUsd={totalEvaluatedUsd}
              totalPendingUsd={totalPendingUsd}
              totalToReceiveUsd={totalToReceiveUsd}
              totalRefundedUsd={totalRefundedUsd}
              labelEvaluated={labelEvaluated}
              labelPending={labelPending}
              labelToReceive={labelToReceive}
              labelRefunded={labelRefunded}
            />
            <section
              className="card-crypto-generator crypto-card scroll-mt-4"
              aria-labelledby="affiliate-contabilidade-heading"
            >
              <h2
                id="affiliate-contabilidade-heading"
                className="text-lg font-semibold text-zinc-900 tracking-tight border-b border-zinc-200 pb-3 mb-4"
              >
                {sectionTitle}
              </h2>
              {actionError ? <p className="mb-3 text-sm text-red-600">{actionError}</p> : null}
              {rows.length === 0 ? (
                <p className="text-sm text-zinc-600">{emptyMessage}</p>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full min-w-[1180px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500">
                        <th scope="col" className="py-2 pr-3">
                          {colAffiliateId}
                        </th>
                        <th scope="col" className="py-2 pr-3">
                          {colMonth}
                        </th>
                        <th scope="col" className="py-2 pr-3">
                          {colStatus}
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right tabular-nums">
                          {colTotal}
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right tabular-nums">
                          {colRefunded}
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right tabular-nums">
                          {colApproved}
                        </th>
                        <th scope="col" className="py-2 pr-3 whitespace-nowrap">
                          {colExpiration}
                        </th>
                        <th scope="col" className="py-2 pr-3 text-center">
                          {colHasInvoice}
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right whitespace-nowrap">
                          {colAcoes}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const canReview = r.status === MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE;
                        const busy = updatingId === r.id;
                        return (
                        <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                          <td className="py-3 pr-3 font-mono text-xs text-zinc-800">{r.idAfiliado}</td>
                          <td className="py-3 pr-3 text-zinc-900">{formatMonthUtc(r.monthStart, lang)}</td>
                          <td className="py-3 pr-3 text-zinc-700">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusBadgeClass(r.status)}`}
                            >
                              {monthAggStatusLabel(r.status, statusLabels)}
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-zinc-900">
                            {formatAffiliateMoneyCents(r.totalCommissionAffiliateCents, r.currencyAffiliate, lang)}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-zinc-600">
                            {formatAffiliateMoneyCents(
                              r.totalReembolsadoCommissionAffiliateCents,
                              r.currencyAffiliate,
                              lang,
                            )}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-zinc-600">
                            {formatAffiliateMoneyCents(
                              r.totalAprovadoCommissionAffiliateCents,
                              r.currencyAffiliate,
                              lang,
                            )}
                          </td>
                          <td className="py-3 pr-3 text-zinc-600 tabular-nums whitespace-nowrap">
                            {formatExpiresAtUtc(r.expiresAt, lang)}
                          </td>
                          <td className="py-3 pr-3 text-center text-zinc-700">
                            {r.hasInvoice ? (
                              <span className="inline-flex flex-col items-center gap-1">
                                <span>{hasInvoiceYes}</span>
                                <a
                                  href={`${CRYPTO_BASE_PATH}/api/affiliate/month-agg-invoice/${encodeURIComponent(r.id)}`}
                                  className="text-violet-700 underline text-xs font-medium hover:text-violet-900"
                                >
                                  {downloadInvoiceLabel}
                                </a>
                              </span>
                            ) : (
                              hasInvoiceNo
                            )}
                          </td>
                          <td className="py-3 pr-3 text-right">
                            {canReview ? (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => onChangeStatus(r.id, MONTH_AGG_STATUS_PAGO)}
                                  className="inline-flex items-center justify-center rounded-lg border border-emerald-600 bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
                                >
                                  {busy ? actionUpdating : actionMarkAsPaid}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => onChangeStatus(r.id, "rejeitado_valor_incorreto")}
                                  className="inline-flex items-center justify-center rounded-lg border border-amber-500 bg-amber-500 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
                                >
                                  {actionRejectWrongValue}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => onChangeStatus(r.id, "rejeitado_nf_invalida")}
                                  className="inline-flex items-center justify-center rounded-lg border border-rose-600 bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
                                >
                                  {actionRejectInvalidNf}
                                </button>
                              </div>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
