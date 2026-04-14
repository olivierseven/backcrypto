"use client";

import type { CryptoLang } from "@/app/lib/translations";
import { formatAffiliateMoneyCents } from "@/lib/affiliate-stripe-plan-payment-amount";

function formatUsd(amount: number, lang: CryptoLang): string {
  return new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Ícone gráfico / estatísticas (SVG inline). */
function StatsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

export default function AffiliateStatsCard({
  lang,
  title,
  totalEvaluatedCents,
  totalEvaluatedCurrency,
  totalEvaluatedUsd,
  totalPendingCents,
  totalRefundedCents,
  totalToReceiveCents,
  totalPendingUsd,
  totalToReceiveUsd,
  totalRefundedUsd,
  labelEvaluated,
  labelPending,
  labelToReceive,
  labelRefunded,
  totalPaidCents,
  labelPaid,
  totalPaidUsd,
}: {
  lang: CryptoLang;
  title: string;
  /** Quando definido com `totalEvaluatedCurrency`, o cartão “total avaliado” usa moeda do afiliado. */
  totalEvaluatedCents?: number;
  totalEvaluatedCurrency?: "usd" | "brl";
  /** Fallback numérico em “unidades” (ex.: dólares) quando centavos + moeda não são passados. */
  totalEvaluatedUsd?: number;
  /** Quando `totalEvaluatedCurrency` está definido, estes centavos mostram na moeda do afiliado (ex.: página Estatísticas). */
  totalPendingCents?: number;
  totalRefundedCents?: number;
  totalToReceiveCents?: number;
  totalPendingUsd: number;
  totalToReceiveUsd: number;
  totalRefundedUsd: number;
  labelEvaluated: string;
  labelPending: string;
  labelToReceive: string;
  labelRefunded: string;
  /** Soma dos meses com fecho `pago` (só Estatísticas). */
  totalPaidCents?: number;
  labelPaid?: string;
  totalPaidUsd?: number;
}) {
  const cur = totalEvaluatedCurrency;
  const showPaid = labelPaid != null && labelPaid !== "";
  const evaluatedPrimary =
    totalEvaluatedCents != null && cur != null
      ? formatAffiliateMoneyCents(totalEvaluatedCents, cur, lang)
      : formatUsd(totalEvaluatedUsd ?? 0, lang);

  const moneyOrUsd = (cents: number | undefined, usdFallback: number) =>
    cents !== undefined && cur != null ? formatAffiliateMoneyCents(cents, cur, lang) : formatUsd(usdFallback, lang);
  return (
    <section
      id="affiliate-stats"
      className="card-crypto-generator crypto-card scroll-mt-4"
      aria-labelledby="affiliate-stats-heading"
    >
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 mb-4">
        <StatsIcon className="h-6 w-6 shrink-0 text-violet-700" />
        <h2 id="affiliate-stats-heading" className="text-lg font-semibold text-zinc-900 tracking-tight">
          {title}
        </h2>
      </div>
      <div
        className={
          showPaid
            ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        }
      >
        <div className="rounded-xl border border-zinc-200 bg-white/90 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{labelEvaluated}</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-zinc-900">
            {evaluatedPrimary}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white/90 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{labelPending}</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-zinc-600">
            {moneyOrUsd(totalPendingCents, totalPendingUsd)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white/90 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{labelRefunded}</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-zinc-600">
            {moneyOrUsd(totalRefundedCents, totalRefundedUsd)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white/90 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{labelToReceive}</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-zinc-600">
            {moneyOrUsd(totalToReceiveCents, totalToReceiveUsd)}
          </p>
        </div>
        {showPaid ? (
          <div className="rounded-xl border border-zinc-200 bg-white/90 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{labelPaid}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-emerald-700">
              {moneyOrUsd(totalPaidCents, totalPaidUsd ?? 0)}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
