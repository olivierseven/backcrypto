"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { API_BASE } from "@/app/constants";
import type { CryptoLang } from "@/app/lib/translations";
import { formatAffiliateCouponDateTime } from "./affiliateCouponDateTime";

type Item = {
  code: string;
  createdAt: string;
  ativo: boolean;
  expiresAt: string | null;
};

function isPastExpiry(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return Date.now() > new Date(expiresAt).getTime();
}

export default function AffiliateCouponCard({
  lang,
  title,
  discountTitle,
  discountSubtitle,
  generateLabel,
  generatingLabel,
  yourCodesLabel,
  loadingCodesLabel,
  emptyLabel,
  onlyExpiredSeeHistoryLabel,
  errorLabel,
  maxInactiveLabel,
  maxActiveLabel,
  generateBlockedHint,
  generateBlockedNotApprovedHint,
  couponNotApprovedError,
  activateBlockedByActiveHint,
  activateLabel,
  activatingActivateLabel,
  inactiveHint,
  activateConfirmTitle,
  activateConfirmBody,
  activateConfirmOk,
  activateConfirmCancel,
  colCode,
  colCreated,
  colStatus,
  colExpires,
  colAction,
  statusInactive,
  statusActive,
  statusExpired,
}: {
  lang: CryptoLang;
  title: string;
  discountTitle: string;
  discountSubtitle: string;
  generateLabel: string;
  generatingLabel: string;
  yourCodesLabel: string;
  loadingCodesLabel: string;
  emptyLabel: string;
  onlyExpiredSeeHistoryLabel: string;
  errorLabel: string;
  maxInactiveLabel: string;
  maxActiveLabel: string;
  generateBlockedHint: string;
  generateBlockedNotApprovedHint: string;
  couponNotApprovedError: string;
  activateBlockedByActiveHint: string;
  activateLabel: string;
  activatingActivateLabel: string;
  inactiveHint: string;
  activateConfirmTitle: string;
  activateConfirmBody: string;
  activateConfirmOk: string;
  activateConfirmCancel: string;
  colCode: string;
  colCreated: string;
  colStatus: string;
  colExpires: string;
  colAction: string;
  statusInactive: string;
  statusActive: string;
  statusExpired: string;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activatingCode, setActivatingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmActivateCode, setConfirmActivateCode] = useState<string | null>(null);
  const [canGenerate, setCanGenerate] = useState(true);
  const [applicationApproved, setApplicationApproved] = useState(true);
  const [hasValidActiveCoupon, setHasValidActiveCoupon] = useState(false);

  const load = useCallback(
    async (silent?: boolean) => {
      setError(null);
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/affiliate/coupon`, { credentials: "include" });
        if (!res.ok) {
          if (res.status === 401) setItems([]);
          else setError(errorLabel);
          return;
        }
        const data = (await res.json()) as {
          items: Item[];
          canGenerate?: boolean;
          applicationApproved?: boolean;
          hasValidActiveCoupon?: boolean;
        };
        setItems(data.items ?? []);
        setCanGenerate(data.canGenerate !== false);
        setApplicationApproved(data.applicationApproved !== false);
        setHasValidActiveCoupon(data.hasValidActiveCoupon === true);
      } catch {
        setError(errorLabel);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [errorLabel]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!confirmActivateCode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmActivateCode(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmActivateCode]);

  async function handleGenerate() {
    if (generating || !canGenerate) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/affiliate/coupon`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (res.status === 403 && data.error === "not_approved") {
          setError(couponNotApprovedError);
        } else if (res.status === 409 && data.error === "max_inactive_reached") {
          setError(maxInactiveLabel);
        } else {
          setError(errorLabel);
        }
        return;
      }
      await load(true);
    } catch {
      setError(errorLabel);
    } finally {
      setGenerating(false);
    }
  }

  async function handleActivate(code: string) {
    if (activatingCode) return;
    setActivatingCode(code);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/affiliate/coupon`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as Item & { error?: string };
      if (res.ok) {
        setConfirmActivateCode(null);
        await load(true);
      } else if (res.status === 409 && data.code) {
        setItems((prev) =>
          (prev ?? []).map((row) => (row.code === code ? { ...row, ...data } : row))
        );
        setConfirmActivateCode(null);
        await load(true);
      } else if (res.status === 409 && data.error === "max_active_reached") {
        setError(maxActiveLabel);
        setConfirmActivateCode(null);
        await load(true);
      } else if (res.status === 403 && data.error === "not_approved") {
        setError(couponNotApprovedError);
        setConfirmActivateCode(null);
      } else {
        setError(errorLabel);
      }
    } catch {
      setError(errorLabel);
    } finally {
      setActivatingCode(null);
    }
  }

  const dateFmt = (iso: string) => formatAffiliateCouponDateTime(iso, lang);

  const modalOpen = confirmActivateCode !== null && typeof document !== "undefined";

  /** Painel: só cupons ainda relevantes (não expirados). Expirados ficam só em Meus cupons. */
  const painelItems = useMemo(
    () => (items ?? []).filter((row) => !isPastExpiry(row.expiresAt)),
    [items]
  );

  return (
    <div className="card-crypto-generator crypto-card">
      <h2 className="text-base font-semibold text-zinc-900 mb-3">{title}</h2>

      <div className="relative mb-5 overflow-hidden rounded-2xl border border-violet-200/90 bg-gradient-to-br from-violet-50/95 via-white to-fuchsia-50/40 shadow-[0_1px_0_0_rgba(255,255,255,0.8)_inset] ring-1 ring-violet-100/80">
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-violet-200/30 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5">
          <div className="flex shrink-0 justify-center sm:justify-start">
            <div
              className="relative flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 text-white shadow-lg shadow-violet-500/25 ring-2 ring-white/60"
              aria-hidden
            >
              <svg
                className="absolute -right-0.5 -top-0.5 h-7 w-7 text-fuchsia-200/80"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              <span className="text-[1.75rem] font-black tabular-nums leading-none tracking-tight">20%</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 flex flex-col justify-center text-center sm:text-left">
            <p className="text-sm font-semibold text-zinc-900 leading-snug">{discountTitle}</p>
            <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed">{discountSubtitle}</p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={loading || generating || !canGenerate}
          title={
            !loading && !canGenerate
              ? applicationApproved
                ? generateBlockedHint
                : generateBlockedNotApprovedHint
              : undefined
          }
          className="crypto-btn inline-flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {generating ? generatingLabel : generateLabel}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div>
        <h3 className="text-sm font-medium text-zinc-800 mb-2">{yourCodesLabel}</h3>
        {loading ? (
          <p className="text-sm text-zinc-500">{loadingCodesLabel}</p>
        ) : !items?.length ? (
          <p className="text-sm text-zinc-500">{emptyLabel}</p>
        ) : !painelItems.length ? (
          <p className="text-sm text-zinc-600">{onlyExpiredSeeHistoryLabel}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[560px] text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th scope="col" className="px-3 py-2.5 font-semibold text-zinc-800 whitespace-nowrap">
                    {colCode}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-zinc-800 whitespace-nowrap">
                    {colCreated}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-zinc-800 whitespace-nowrap">
                    {colStatus}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-zinc-800 whitespace-nowrap">
                    {colExpires}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-zinc-800 whitespace-nowrap">
                    {colAction}
                  </th>
                </tr>
              </thead>
              <tbody>
                {painelItems.map((row) => {
                  const expired = isPastExpiry(row.expiresAt);
                  const canActivate = !row.ativo && !expired && !hasValidActiveCoupon;
                  const activeValid = row.ativo && !expired;
                  const statusText = expired ? statusExpired : !row.ativo ? statusInactive : statusActive;
                  const statusClass = expired
                    ? "bg-zinc-100 text-zinc-800"
                    : !row.ativo
                      ? "bg-amber-100 text-amber-900"
                      : "bg-emerald-100 text-emerald-900";
                  const expiresCell =
                    expired && row.expiresAt
                      ? dateFmt(row.expiresAt)
                      : activeValid && row.expiresAt
                        ? dateFmt(row.expiresAt)
                        : "-";

                  return (
                    <tr key={row.code} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80">
                      <td className="px-3 py-2.5 align-middle">
                        <code className="font-mono text-sm font-semibold tracking-wider text-zinc-900">{row.code}</code>
                      </td>
                      <td className="px-3 py-2.5 align-middle text-zinc-700 whitespace-nowrap">{dateFmt(row.createdAt)}</td>
                      <td className="px-3 py-2.5 align-middle">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${statusClass}`}
                          title={!expired && !row.ativo ? inactiveHint : undefined}
                        >
                          {statusText}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-middle text-zinc-700 whitespace-nowrap">
                        {expiresCell === "-" ? (
                          <span className="text-zinc-400">-</span>
                        ) : (
                          expiresCell
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                        {canActivate ? (
                          <button
                            type="button"
                            onClick={() => setConfirmActivateCode(row.code)}
                            disabled={activatingCode !== null}
                            className="crypto-btn inline-flex rounded-lg border border-violet-300 bg-white px-2.5 py-1 text-xs font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
                          >
                            {activatingCode === row.code ? activatingActivateLabel : activateLabel}
                          </button>
                        ) : !row.ativo && !expired && hasValidActiveCoupon ? (
                          <button
                            type="button"
                            disabled
                            title={activateBlockedByActiveHint}
                            className="crypto-btn inline-flex rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-400 cursor-not-allowed"
                          >
                            {activateLabel}
                          </button>
                        ) : (
                          <span className="text-zinc-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aff-coupon-activate-title"
            onClick={() => setConfirmActivateCode(null)}
          >
            <div
              className="relative z-10 bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-zinc-200"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="aff-coupon-activate-title" className="text-lg font-semibold text-zinc-900 mb-3">
                {activateConfirmTitle}
              </h2>
              <p className="text-sm text-zinc-700 leading-relaxed mb-6">{activateConfirmBody}</p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmActivateCode(null)}
                  className="crypto-btn px-4 py-2 rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  {activateConfirmCancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const c = confirmActivateCode;
                    if (c) void handleActivate(c);
                  }}
                  disabled={activatingCode !== null}
                  className="crypto-btn px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-50"
                >
                  {activatingCode === confirmActivateCode ? activatingActivateLabel : activateConfirmOk}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

