"use client";

import { createPortal } from "react-dom";

export type AggDerivedKind = "renko" | "range" | "kagi" | "renko2x" | "trades";

const KIND_KEYS: Record<AggDerivedKind, { title: string; body: string }> = {
  renko: { title: "aggDerivedRenkoTitle", body: "aggDerivedRenkoBody" },
  range: { title: "aggDerivedRangeTitle", body: "aggDerivedRangeBody" },
  kagi: { title: "aggDerivedKagiTitle", body: "aggDerivedKagiBody" },
  renko2x: { title: "aggDerivedRenko2xTitle", body: "aggDerivedRenko2xBody" },
  trades: { title: "aggDerivedTradesTitle", body: "aggDerivedTradesBody" },
};

/**
 * Modal explicando que só o tier “5” (P5, N5, …) segue o cálculo completo a partir de trades;
 * os demais são OHLC derivados por agrupamento no cache.
 */
export function AggDerivedInfoModal(props: {
  kind: AggDerivedKind | null;
  onClose: () => void;
  t: Record<string, string>;
}) {
  const { kind, onClose, t } = props;
  if (kind == null) return null;
  const keys = KIND_KEYS[kind];
  const title = t[keys.title] ?? keys.title;
  const body = t[keys.body] ?? "";
  const closeLabel = t.aggDerivedModalClose ?? "OK";

  return createPortal(
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agg-derived-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white shadow-2xl shadow-zinc-900/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white px-4 py-3">
          <h2 id="agg-derived-modal-title" className="text-sm font-semibold text-violet-950 leading-snug pr-2">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-violet-700 hover:bg-violet-100/80 transition-colors"
            aria-label={closeLabel}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-4 py-3 text-xs text-zinc-700 leading-relaxed space-y-3">
          {body.split("\n\n").map((para, i) => (
            <p key={i} className="whitespace-pre-line">
              {para}
            </p>
          ))}
        </div>
        <div className="border-t border-zinc-100 bg-zinc-50/80 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AggDerivedInfoButton(props: {
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onClick();
      }}
      className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200 bg-white text-violet-600 hover:bg-violet-50 hover:border-violet-200 transition-colors"
      aria-label={props.ariaLabel}
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </button>
  );
}
