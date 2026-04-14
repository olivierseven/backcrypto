"use client";

import AffiliateAreaHeader from "../AffiliateAreaHeader";
import AffiliateMonthAggTable, { type AffiliateMonthAggRow } from "./AffiliateMonthAggTable";
import AffiliateStatsCard from "../painel/AffiliateStatsCard";
import { getCryptoT } from "@/app/lib/translations";
import type { CryptoLang } from "@/app/lib/translations";

export default function AffiliateEstatisticasShell({
  lang,
  title,
  email,
  signedInAs,
  logoutHref,
  logoutLabel,
  statsTotalEvaluatedCents,
  statsTotalPendingCents,
  statsTotalRefundedCents,
  statsTotalToReceiveCents,
  statsTotalPaidCents,
  statsTotalEvaluatedCurrency,
  monthAggRows,
  payoutProfileComplete,
  showAccountingNav = false,
}: {
  lang: CryptoLang;
  title: string;
  email: string;
  signedInAs: string;
  logoutHref: string;
  logoutLabel: string;
  statsTotalEvaluatedCents: number;
  statsTotalPendingCents: number;
  statsTotalRefundedCents: number;
  statsTotalToReceiveCents: number;
  statsTotalPaidCents: number;
  statsTotalEvaluatedCurrency: "usd" | "brl";
  monthAggRows: AffiliateMonthAggRow[];
  payoutProfileComplete: boolean;
  showAccountingNav?: boolean;
}) {
  const t = getCryptoT(lang).landing.affiliatesPainel;

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
        cuponsNavAria={t.cuponsNavAria}
        statsNavAria={t.statsNavAria}
        showAccountingNav={showAccountingNav}
        accountingNavAria={t.contabilidadeNavAria}
      />
      <main className="crypto-conta-page relative flex flex-1 min-h-0 min-w-0 w-full flex-col items-center overflow-auto overflow-x-hidden">
        <div className="crypto-conta-wrap relative mx-auto w-full max-w-[900px] flex-1 px-0 py-0 sm:px-6 md:px-8">
          <div className="space-y-6 pt-4 sm:pt-2 pb-8">
            <AffiliateStatsCard
              lang={lang}
              title={t.statsSectionTitle}
              totalEvaluatedCents={statsTotalEvaluatedCents}
              totalEvaluatedCurrency={statsTotalEvaluatedCurrency}
              totalPendingCents={statsTotalPendingCents}
              totalRefundedCents={statsTotalRefundedCents}
              totalToReceiveCents={statsTotalToReceiveCents}
              totalPendingUsd={0}
              totalToReceiveUsd={0}
              totalRefundedUsd={0}
              labelEvaluated={t.statsTotalEvaluated}
              labelPending={t.statsTotalPending}
              labelToReceive={t.statsTotalToReceive}
              labelRefunded={t.statsTotalRefunded}
              totalPaidCents={statsTotalPaidCents}
              labelPaid={t.statsTotalPaid}
              totalPaidUsd={0}
            />
            <AffiliateMonthAggTable
              lang={lang}
              rows={monthAggRows}
              title={t.statsMonthBreakdownTitle}
              colMonth={t.statsMonthColMonth}
              colStatus={t.statsMonthColStatus}
              colTotal={t.statsMonthColTotal}
              colRefunded={t.statsMonthColRefunded}
              colApproved={t.statsMonthColApproved}
              emptyMessage={t.statsMonthEmpty}
              sendInvoiceLabel={t.statsMonthSendInvoice}
              sendInvoiceDisabledHint={t.statsMonthSendInvoiceDisabledHint}
              sendInvoiceDisabledNoCommissionHint={t.statsMonthSendInvoiceDisabledNoCommissionHint}
              sendInvoiceTooltipEmAbertoWithDate={t.statsMonthSendInvoiceTooltipEmAbertoWithDate}
              sendInvoiceDisabledExpiredHint={t.statsMonthSendInvoiceDisabledExpiredHint}
              sendInvoiceDisabledNoPayoutProfileHint={t.statsMonthSendInvoiceDisabledNoPayoutProfileHint}
              statsMonthUploadPayoutProfileRequired={t.statsMonthUploadPayoutProfileRequired}
              statsMonthSendInvoiceHintButtonAria={t.statsMonthSendInvoiceHintButtonAria}
              statsMonthSendInvoiceHintClose={t.statsMonthSendInvoiceHintClose}
              payoutProfileComplete={payoutProfileComplete}
              monthAggStatusEmAberto={t.monthAggStatusEmAberto}
              monthAggStatusAguardandoNotaFiscal={t.monthAggStatusAguardandoNotaFiscal}
              monthAggStatusNotaFiscalEmAnalise={t.monthAggStatusNotaFiscalEmAnalise}
              monthAggStatusPago={t.monthAggStatusPago}
              monthAggStatusRejeitadoValorIncorreto={t.monthAggStatusRejeitadoValorIncorreto}
              monthAggStatusRejeitadoNfInvalida={t.monthAggStatusRejeitadoNfInvalida}
              monthAggStatusExpirado={t.monthAggStatusExpirado}
              statsMonthUploading={t.statsMonthUploading}
              statsMonthUploadError={t.statsMonthUploadError}
              statsMonthInvoiceAlreadySent={t.statsMonthInvoiceAlreadySent}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
