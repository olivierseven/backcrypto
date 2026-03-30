"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/app/constants";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { formatAbbreviated } from "@/app/(sys)/sistema/klinesFormatters";

type CoinInfoPayload = {
  binanceSymbol: string;
  coingeckoId: string;
  name: string;
  symbol: string;
  image: string | null;
  categories: string[];
  genesis_date: string | null;
  hashing_algorithm: string | null;
  descriptionText: string;
  market_data: Record<string, unknown> | null;
  public_notice: string | null;
};

function numUsd(v: unknown): number | null {
  if (v == null || typeof v !== "object") return null;
  const u = (v as Record<string, unknown>).usd;
  if (typeof u === "number" && Number.isFinite(u)) return u;
  return null;
}

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `$${formatAbbreviated(n, 2)}`;
  if (n >= 1e6) return `$${formatAbbreviated(n, 2)}`;
  if (n >= 1) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function fmtPctRaw(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function CoinInfoClient({ symbolParam }: { symbolParam: string }) {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines as Record<string, string>;
  const [data, setData] = useState<CoinInfoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tk = getCryptoT(lang).sistema.klines as Record<string, string>;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/mercados/coingecko/coin/${encodeURIComponent(symbolParam)}?lang=${lang}`,
        { credentials: "include", cache: "no-store" },
      );
      if (res.status === 401) {
        setError(tk.mercadosCoinInfoUnauthorized ?? "Session required.");
        setData(null);
        return;
      }
      if (res.status === 404) {
        setError(tk.mercadosCoinInfoNotFound ?? "Coin not found.");
        setData(null);
        return;
      }
      if (!res.ok) {
        setError(tk.mercadosCoinInfoError ?? "Could not load.");
        setData(null);
        return;
      }
      setData((await res.json()) as CoinInfoPayload);
    } catch {
      setError(tk.mercadosCoinInfoError ?? "Could not load.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbolParam, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  const md = data?.market_data ?? null;
  const price = md ? numUsd(md.current_price) : null;
  const cap = md ? numUsd(md.market_cap) : null;
  const vol = md ? numUsd(md.total_volume) : null;
  const high = md ? numUsd(md.high_24h) : null;
  const low = md ? numUsd(md.low_24h) : null;
  const rank = md && typeof md.market_cap_rank === "number" ? md.market_cap_rank : null;
  const ch24 =
    md && typeof md.price_change_percentage_24h === "number" ? md.price_change_percentage_24h : null;

  return (
    <main className="flex-1 min-h-0 w-full flex flex-col items-start px-2 sm:px-3 py-3 overflow-auto">
      <div className="w-full max-w-2xl flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/mercados"
            className="text-sm font-medium text-zinc-800 hover:text-zinc-950 underline-offset-2 hover:underline"
          >
            ← {t.mercadosCoinInfoBack ?? "Back to markets"}
          </Link>
        </div>

        {loading && <p className="text-sm text-zinc-700">{t.mercadosCoinInfoLoading ?? "Loading…"}</p>}
        {error != null && <p className="text-sm text-red-600">{error}</p>}

        {!loading && data && (
          <>
            <header className="flex flex-wrap items-start gap-4 border-b border-zinc-200 pb-4">
              {data.image ? (
                <img src={data.image} alt="" width={64} height={64} className="rounded-full bg-zinc-100" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-zinc-200" />
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold text-zinc-900">{data.name}</h1>
                <p className="text-sm text-zinc-800">
                  {data.symbol} · {data.binanceSymbol} · CoinGecko: {data.coingeckoId}
                </p>
                {data.categories.length > 0 && (
                  <p className="mt-1 text-xs text-zinc-700">{data.categories.join(" · ")}</p>
                )}
              </div>
            </header>

            {data.public_notice && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {data.public_notice}
              </p>
            )}

            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-900">{t.mercadosCoinInfoMarket ?? "Market (USD)"}</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex justify-between gap-2 border-b border-zinc-100 py-1">
                  <dt className="text-zinc-700">{t.mercadosCoinInfoRank ?? "Rank"}</dt>
                  <dd className="font-mono tabular-nums text-zinc-900">{rank ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-zinc-100 py-1">
                  <dt className="text-zinc-700">{t.mercadosCoinInfoPrice ?? "Price"}</dt>
                  <dd className="font-mono tabular-nums text-zinc-900">{fmtUsd(price)}</dd>
                </div>
                <div className="flex justify-between items-center gap-2 border-b border-zinc-100 py-1">
                  <dt className="text-zinc-700">{t.mercadosCoinInfo24h ?? "24h"}</dt>
                  <dd className="font-mono tabular-nums text-right shrink-0">
                    {ch24 == null ? (
                      <span className="text-zinc-700">—</span>
                    ) : (
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums border shadow-sm ${
                          ch24 >= 0
                            ? "border-emerald-600/80 bg-emerald-100 text-emerald-950"
                            : "border-red-600/80 bg-red-100 text-red-950"
                        }`}
                      >
                        {fmtPctRaw(ch24)}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-zinc-100 py-1">
                  <dt className="text-zinc-700">{t.mercadosCoinInfoMcap ?? "Market cap"}</dt>
                  <dd className="font-mono tabular-nums text-zinc-900">{fmtUsd(cap)}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-zinc-100 py-1">
                  <dt className="text-zinc-700">{t.mercadosCoinInfoVolume ?? "Volume 24h"}</dt>
                  <dd className="font-mono tabular-nums text-zinc-900">{fmtUsd(vol)}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-zinc-100 py-1">
                  <dt className="text-zinc-700">{t.mercadosCoinInfoHighLow ?? "High / Low 24h"}</dt>
                  <dd className="font-mono tabular-nums text-zinc-900 text-right">
                    {fmtUsd(high)} / {fmtUsd(low)}
                  </dd>
                </div>
              </dl>
            </section>

            {(data.genesis_date || data.hashing_algorithm) && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-zinc-900">{t.mercadosCoinInfoMetadata ?? "Details"}</h2>
                <dl className="text-sm space-y-1">
                  {data.genesis_date && (
                    <div className="flex flex-wrap gap-2">
                      <dt className="text-zinc-700">{t.mercadosCoinInfoGenesis ?? "Genesis"}</dt>
                      <dd className="text-zinc-900">{data.genesis_date}</dd>
                    </div>
                  )}
                  {data.hashing_algorithm && (
                    <div className="flex flex-wrap gap-2">
                      <dt className="text-zinc-700">{t.mercadosCoinInfoHash ?? "Hashing"}</dt>
                      <dd className="text-zinc-900">{data.hashing_algorithm}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {data.descriptionText.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-zinc-900">{t.mercadosCoinInfoDescription ?? "Description"}</h2>
                <p className="text-sm text-zinc-900 whitespace-pre-wrap leading-relaxed">{data.descriptionText}</p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
