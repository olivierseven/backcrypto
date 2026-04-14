"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/app/constants";

type Credit = {
  id: string;
  amount: number;
  consumed: number;
  remaining: number;
  expiresAt: string;
  createdAt: string;
  packageLabel?: string;
  subscriptionId?: string | null;
  subscriptionCancelled?: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function fullDaysUntilExpiry(expiresAtIso: string): number {
  const end = new Date(expiresAtIso).getTime();
  return Math.max(0, Math.ceil((end - Date.now()) / MS_PER_DAY));
}

function fullDaysInWindow(createdAtIso: string, expiresAtIso: string): number {
  const start = new Date(createdAtIso).getTime();
  const end = new Date(expiresAtIso).getTime();
  return Math.max(1, Math.ceil((end - start) / MS_PER_DAY));
}

const DEFAULT_T = {
  package: "Pacote",
  remaining: "Dias restantes",
  day: "dia",
  days: "dias",
  expiresAt: "Vence em",
  seeLess: "Ver menos",
  seeAll: "Ver todos ({n})",
  remainingPct: "{pct}% do período restante",
  cancelPlan: "Cancelar plano",
  cancelPlanConfirm: "Tem certeza que deseja cancelar o plano? Você mantém os coins até o vencimento.",
  cancelPlanModalBack: "Voltar",
  cancelPlanModalConfirm: "Sim, cancelar plano",
  renewalCancelled: "Renovação cancelada",
  cancelPlanSuccess: "Plano cancelado.",
  cancelPlanError: "Não foi possível cancelar.",
};

export default function ExpandableCreditsList({
  credits,
  translations,
  locale = "pt-BR",
}: {
  credits: Credit[];
  translations?: Partial<typeof DEFAULT_T>;
  locale?: string;
}) {
  const t = { ...DEFAULT_T, ...translations };
  const [expanded, setExpanded] = useState(false);
  const [cancelModal, setCancelModal] = useState<{ creditId: string; subscriptionId: string } | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<{ id: string; type: "ok" | "err" } | null>(null);
  const visible = expanded ? credits : credits.slice(0, 2);
  const router = useRouter();

  function fmtNum(n: number) {
    return n.toLocaleString(locale);
  }
  function fmtDateIso(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(locale);
    } catch {
      return iso;
    }
  }

  function openCancelModal(creditId: string, subscriptionId: string) {
    setCancelMessage(null);
    setCancelModal({ creditId, subscriptionId });
  }

  async function confirmCancelPlan() {
    if (!cancelModal) return;
    const { creditId, subscriptionId } = cancelModal;
    setCancelModal(null);
    setCancellingId(creditId);
    setCancelMessage(null);
    try {
      const res = await fetch(`${API_BASE}/subscription/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setCancelMessage({ id: creditId, type: "ok" });
        router.refresh();
      } else {
        setCancelMessage({ id: creditId, type: "err" });
      }
    } catch {
      setCancelMessage({ id: creditId, type: "err" });
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="grid gap-3">
      {visible.map((c) => {
        const daysLeft = fullDaysUntilExpiry(c.expiresAt);
        const windowDays = fullDaysInWindow(c.createdAt, c.expiresAt);
        const pct = Math.max(0, Math.min(100, Math.round((daysLeft / windowDays) * 100)));
        const label = c.packageLabel ?? `${t.package}: ${fmtNum(c.amount)}`;
        const daysUnit = daysLeft === 1 ? t.day : t.days;
        const showCancelButton = Boolean(c.subscriptionId) && !c.subscriptionCancelled;
        const showCancelledStatus = Boolean(c.subscriptionId) && c.subscriptionCancelled;
        const isCancelling = cancellingId === c.id;
        const msg = cancelMessage?.id === c.id ? cancelMessage : null;
        return (
          <div key={c.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="text-neutral-700">
                <b>{label}</b>
                <span className="text-neutral-500">
                  {" "}
                  · {t.remaining}: {fmtNum(daysLeft)} {daysUnit}
                </span>
              </div>
              <div className="text-neutral-600">{t.expiresAt} <b>{fmtDateIso(c.expiresAt)}</b></div>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-white/70 ring-1 ring-neutral-200">
              <div
                className="h-2 rounded-full bg-emerald-600 transition-[width]"
                style={{ width: `${pct}%` }}
                aria-label={t.remainingPct.replace("{pct}", String(pct))}
              />
            </div>
            {showCancelledStatus && (
              <div className="mt-3">
                <span className="inline-flex items-center rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-600">
                  {t.renewalCancelled}
                </span>
              </div>
            )}
            {showCancelButton && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => c.subscriptionId && openCancelModal(c.id, c.subscriptionId)}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  {isCancelling ? "…" : t.cancelPlan}
                </button>
                {msg?.type === "ok" && <span className="text-sm text-emerald-700">{t.cancelPlanSuccess}</span>}
                {msg?.type === "err" && <span className="text-sm text-amber-700">{t.cancelPlanError}</span>}
              </div>
            )}
          </div>
        );
      })}

      {credits.length > 2 && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50 active:scale-[.99]"
          >
            <span>{expanded ? t.seeLess : t.seeAll.replace("{n}", String(credits.length))}</span>
            <svg
              className={"h-4 w-4 transition-transform " + (expanded ? "rotate-180" : "")}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-zinc-200">
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">{t.cancelPlan}</h3>
            <p className="text-sm text-zinc-700 mb-6">{t.cancelPlanConfirm}</p>
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => setCancelModal(null)}
                className="crypto-btn rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 font-medium px-4 py-2"
              >
                {t.cancelPlanModalBack}
              </button>
              <button
                type="button"
                onClick={confirmCancelPlan}
                className="crypto-btn rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2"
              >
                {t.cancelPlanModalConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
