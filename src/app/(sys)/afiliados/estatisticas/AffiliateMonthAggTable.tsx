"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CryptoLang } from "@/app/lib/translations";
import { CRYPTO_BASE_PATH } from "@/lib/crypto-auth-next";
import {
  getMonthAggInvoiceAvailableFromUtc,
  MONTH_AGG_STATUS_AGUARDANDO_NOTA_FISCAL,
  MONTH_AGG_STATUS_EM_ABERTO,
  MONTH_AGG_STATUS_EXPIRADO,
  MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE,
  MONTH_AGG_STATUS_PAGO,
  MONTH_AGG_STATUS_REJEITADO_NF_INVALIDA,
  MONTH_AGG_STATUS_REJEITADO_VALOR_INCORRETO,
  monthAggStatusLabel,
} from "@/lib/affiliate-plan-payment-month-agg-status";
import { formatAffiliateMoneyCents } from "@/lib/affiliate-stripe-plan-payment-amount";

export type AffiliateMonthAggRow = {
  id: string;
  monthStart: string;
  /** Total de comissão no mês (`commission_affiliate_cents` agregado). */
  totalCommissionAffiliateCents: number;
  totalReembolsadoCommissionAffiliateCents: number;
  totalAprovadoCommissionAffiliateCents: number;
  currencyAffiliate: "usd" | "brl";
  status: string;
  hasInvoice: boolean;
};

function formatMonthUtc(monthStartIso: string, lang: CryptoLang): string {
  const d = new Date(monthStartIso.slice(0, 10) + "T12:00:00.000Z");
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function formatInvoiceAvailableFromUtc(monthStartIso: string, lang: CryptoLang): string {
  const ms = new Date(monthStartIso.slice(0, 10) + "T12:00:00.000Z");
  const from = getMonthAggInvoiceAvailableFromUtc(ms);
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(from);
}

function statusBadgeClass(status: string): string {
  if (status === MONTH_AGG_STATUS_PAGO) return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (status === MONTH_AGG_STATUS_REJEITADO_VALOR_INCORRETO || status === MONTH_AGG_STATUS_REJEITADO_NF_INVALIDA) {
    return "bg-rose-100 text-rose-800 ring-rose-200";
  }
  if (status === MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE) return "bg-amber-100 text-amber-800 ring-amber-200";
  if (status === MONTH_AGG_STATUS_AGUARDANDO_NOTA_FISCAL) return "bg-violet-100 text-violet-800 ring-violet-200";
  if (status === MONTH_AGG_STATUS_EM_ABERTO) return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  if (status === MONTH_AGG_STATUS_EXPIRADO) return "bg-slate-200 text-slate-800 ring-slate-300";
  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

export default function AffiliateMonthAggTable({
  lang,
  rows,
  title,
  colMonth,
  colStatus,
  colTotal,
  colRefunded,
  colApproved,
  emptyMessage,
  sendInvoiceLabel,
  sendInvoiceDisabledHint,
  sendInvoiceDisabledNoCommissionHint,
  sendInvoiceTooltipEmAbertoWithDate,
  sendInvoiceDisabledExpiredHint,
  sendInvoiceDisabledNoPayoutProfileHint,
  statsMonthUploadPayoutProfileRequired,
  statsMonthSendInvoiceHintButtonAria,
  statsMonthSendInvoiceHintClose,
  payoutProfileComplete,
  monthAggStatusEmAberto,
  monthAggStatusAguardandoNotaFiscal,
  monthAggStatusNotaFiscalEmAnalise,
  monthAggStatusPago,
  monthAggStatusRejeitadoValorIncorreto,
  monthAggStatusRejeitadoNfInvalida,
  monthAggStatusExpirado,
  statsMonthUploading,
  statsMonthUploadError,
  statsMonthInvoiceAlreadySent,
}: {
  lang: CryptoLang;
  rows: AffiliateMonthAggRow[];
  title: string;
  colMonth: string;
  colStatus: string;
  colTotal: string;
  colRefunded: string;
  colApproved: string;
  emptyMessage: string;
  sendInvoiceLabel: string;
  sendInvoiceDisabledHint: string;
  sendInvoiceDisabledNoCommissionHint: string;
  /** Placeholder `{date}` = data (UTC) em que o envio de NF fica disponível. */
  sendInvoiceTooltipEmAbertoWithDate: string;
  sendInvoiceDisabledExpiredHint: string;
  sendInvoiceDisabledNoPayoutProfileHint: string;
  statsMonthUploadPayoutProfileRequired: string;
  statsMonthSendInvoiceHintButtonAria: string;
  statsMonthSendInvoiceHintClose: string;
  payoutProfileComplete: boolean;
  monthAggStatusEmAberto: string;
  monthAggStatusAguardandoNotaFiscal: string;
  monthAggStatusNotaFiscalEmAnalise: string;
  monthAggStatusPago: string;
  monthAggStatusRejeitadoValorIncorreto: string;
  monthAggStatusRejeitadoNfInvalida: string;
  monthAggStatusExpirado: string;
  statsMonthUploading: string;
  statsMonthUploadError: string;
  statsMonthInvoiceAlreadySent: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingMonthAggIdRef = useRef<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** Texto da ajuda ao enviar NF; `null` = overlay fechado. */
  const [invoiceHintOverlayText, setInvoiceHintOverlayText] = useState<string | null>(null);

  const statusLabels = {
    monthAggStatusEmAberto,
    monthAggStatusAguardandoNotaFiscal,
    monthAggStatusNotaFiscalEmAnalise,
    monthAggStatusPago,
    monthAggStatusRejeitadoValorIncorreto,
    monthAggStatusRejeitadoNfInvalida,
    monthAggStatusExpirado,
  };

  const onPickInvoice = (monthAggId: string) => {
    setUploadError(null);
    pendingMonthAggIdRef.current = monthAggId;
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const monthAggId = pendingMonthAggIdRef.current;
    e.target.value = "";
    pendingMonthAggIdRef.current = null;
    if (!file || !monthAggId) return;

    setUploadingId(monthAggId);
    setUploadError(null);
    const fd = new FormData();
    fd.append("monthAggId", monthAggId);
    fd.append("file", file);

    try {
      const res = await fetch(`${CRYPTO_BASE_PATH}/api/affiliate/month-agg-invoice`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        let code = "";
        try {
          const j = (await res.json()) as { error?: string };
          code = typeof j.error === "string" ? j.error : "";
        } catch {
          /* ignore */
        }
        setUploadError(
          code === "payout_profile_incomplete"
            ? statsMonthUploadPayoutProfileRequired
            : statsMonthUploadError,
        );
        return;
      }
      router.refresh();
    } catch {
      setUploadError(statsMonthUploadError);
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <section
      className="card-crypto-generator crypto-card scroll-mt-4"
      aria-labelledby="affiliate-month-agg-heading"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={onFileChange}
      />

      <h2
        id="affiliate-month-agg-heading"
        className="text-lg font-semibold text-zinc-900 tracking-tight border-b border-zinc-200 pb-3 mb-4"
      >
        {title}
      </h2>

      {uploadError ? (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {uploadError}
        </p>
      ) : null}

      {invoiceHintOverlayText != null ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={statsMonthSendInvoiceHintButtonAria}
          onClick={() => setInvoiceHintOverlayText(null)}
        >
          <div
            className="max-h-[min(70vh,24rem)] w-full max-w-sm overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm leading-relaxed text-zinc-800">{invoiceHintOverlayText}</p>
            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-violet-600 bg-violet-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
              onClick={() => setInvoiceHintOverlayText(null)}
            >
              {statsMonthSendInvoiceHintClose}
            </button>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-600">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500">
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
                <th scope="col" className="py-2 pl-2 text-right w-[1%] whitespace-nowrap">
                  <span className="sr-only">{sendInvoiceLabel}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const alreadySent = r.status === MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE;
                const alreadyPaid = r.status === MONTH_AGG_STATUS_PAGO;
                const busy = uploadingId === r.id;
                /** Só após o limite (regra em `computeMonthAggStatus`) ou reenvio pós-rejeição — não em `em_aberto`. */
                const canUploadByStatus =
                  r.status !== MONTH_AGG_STATUS_EXPIRADO &&
                  (r.status === MONTH_AGG_STATUS_AGUARDANDO_NOTA_FISCAL ||
                    r.status === MONTH_AGG_STATUS_REJEITADO_VALOR_INCORRETO ||
                    r.status === MONTH_AGG_STATUS_REJEITADO_NF_INVALIDA);
                /** Coluna «Comissão»: `total_aprovado` (0 em `expirado` — valor em Expirado). */
                const hasCommission = r.totalAprovadoCommissionAffiliateCents > 0;
                const canSend =
                  payoutProfileComplete &&
                  canUploadByStatus &&
                  hasCommission &&
                  !alreadySent &&
                  !alreadyPaid &&
                  !busy;
                const dateAvailableUtc = formatInvoiceAvailableFromUtc(r.monthStart, lang);
                /** Ordem: motivo do período (aberto / expirado) antes de dados bancários ou comissão. */
                const disabledTitle = !canSend && !busy
                  ? alreadySent
                    ? statsMonthInvoiceAlreadySent
                    : alreadyPaid
                      ? statsMonthInvoiceAlreadySent
                      : r.status === MONTH_AGG_STATUS_EXPIRADO
                        ? sendInvoiceDisabledExpiredHint
                        : r.status === MONTH_AGG_STATUS_EM_ABERTO
                          ? sendInvoiceTooltipEmAbertoWithDate.replace("{date}", dateAvailableUtc)
                          : !payoutProfileComplete
                            ? sendInvoiceDisabledNoPayoutProfileHint
                            : canUploadByStatus && !hasCommission
                              ? sendInvoiceDisabledNoCommissionHint
                              : sendInvoiceDisabledHint
                  : undefined;
                return (
                  <tr key={r.id} className="border-b border-zinc-100 last:border-0">
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
                    <td className="py-3 pl-2 text-right whitespace-nowrap w-[1%]">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (busy) return;
                          if (canSend) onPickInvoice(r.id);
                          else if (disabledTitle) setInvoiceHintOverlayText(disabledTitle);
                        }}
                        className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium leading-tight shadow-sm transition touch-manipulation ${
                          busy
                            ? "cursor-not-allowed border-zinc-300 bg-zinc-200 text-zinc-500 opacity-80"
                            : canSend
                              ? "border-violet-600 bg-violet-600 text-white hover:bg-violet-700"
                              : "cursor-pointer border-zinc-300 bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
                        }`}
                      >
                        {busy ? statsMonthUploading : sendInvoiceLabel}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
