"use client";

import { useCallback, useEffect, useState } from "react";
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

/** Lista só leitura (histórico) em tabela — mesma API GET que o card do painel. */
export default function AffiliateCouponHistoryList({
  lang,
  sectionTitle,
  emptyLabel,
  errorLabel,
  colCode,
  colCreated,
  colStatus,
  colExpires,
  statusInactive,
  statusActive,
  statusExpired,
}: {
  lang: CryptoLang;
  sectionTitle: string;
  emptyLabel: string;
  errorLabel: string;
  colCode: string;
  colCreated: string;
  colStatus: string;
  colExpires: string;
  statusInactive: string;
  statusActive: string;
  statusExpired: string;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/affiliate/coupon`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) setItems([]);
        else setError(errorLabel);
        return;
      }
      const data = (await res.json()) as { items: Item[] };
      setItems(data.items ?? []);
    } catch {
      setError(errorLabel);
    } finally {
      setLoading(false);
    }
  }, [errorLabel]);

  useEffect(() => {
    void load();
  }, [load]);

  const dateFmt = (iso: string) => formatAffiliateCouponDateTime(iso, lang);

  return (
    <div className="card-crypto-generator crypto-card">
      <h2 className="text-base font-semibold text-zinc-900 mb-3">{sectionTitle}</h2>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading ? (
        <p className="text-sm text-zinc-500">…</p>
      ) : !items?.length ? (
        <p className="text-sm text-zinc-500">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full min-w-[520px] text-sm text-left border-collapse">
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
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const expired = isPastExpiry(row.expiresAt);
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
                      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                        {statusText}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle text-zinc-700 whitespace-nowrap">
                      {expiresCell === "-" ? <span className="text-zinc-400">-</span> : expiresCell}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
