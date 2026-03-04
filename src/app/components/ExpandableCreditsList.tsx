"use client";

import { useState } from "react";

type Credit = {
  id: string;
  amount: number;
  consumed: number;
  remaining: number;
  expiresAt: string;
  createdAt: string;
};

const DEFAULT_T = {
  package: "Pacote",
  remaining: "Restante",
  expiresAt: "Vence em",
  seeLess: "Ver menos",
  seeAll: "Ver todos ({n})",
  remainingPct: "Restante {pct}%",
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
  const visible = expanded ? credits : credits.slice(0, 2);

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

  return (
    <div className="grid gap-3">
      {visible.map((c) => {
        const pct = Math.max(0, Math.min(100, Math.round((c.remaining / c.amount) * 100)));
        return (
          <div key={c.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex items-center justify-between text-sm">
              <div className="text-neutral-700">
                {t.package}: <b>{fmtNum(c.amount)}</b> &middot; {t.remaining}: <b>{fmtNum(c.remaining)}</b>
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
    </div>
  );
}
