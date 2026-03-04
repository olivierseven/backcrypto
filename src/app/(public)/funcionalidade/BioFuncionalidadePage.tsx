"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ASSET_PREFIX } from "@/app/constants";
import { getBioT, type BioLang } from "@/app/lib/translations";
import BioLandingHeader from "@/app/BioLandingHeader";
import BioLandingFooter from "@/app/BioLandingFooter";

const STATS_KEYS = ["stats1", "stats2", "stats3", "stats4", "stats5"] as const;
const PANEL_KEYS = [0, 1, 2, 3, 4, 5, 6] as const;
const MGMT_KEYS = ["mgmt1", "mgmt2", "mgmt3", "mgmt4"] as const;
function getInitialLang(): BioLang {
  if (typeof document === "undefined") return "pt";
  const m = document.cookie.match(/sevencoins-lang=([^;]+)/);
  return m?.[1] === "en" ? "en" : "pt";
}

export default function BioFuncionalidadePage() {
  const [lang, setLang] = useState<BioLang>("pt");
  useEffect(() => {
    const urlLang = new URLSearchParams(window.location.search).get("lang");
    if (urlLang === "en" || urlLang === "pt") setLang(urlLang);
    else setLang(getInitialLang());
  }, []);
  const t = getBioT(lang).landing.funcPage;

  return (
    <div className="min-h-screen w-full flex flex-col">
      <BioLandingHeader lang={lang} setLang={setLang} />
      <div className="flex-1 w-full flex justify-center min-w-0">
        <div className="w-full max-w-3xl flex flex-col flex-1 min-w-0 px-4 sm:px-6">
          <main className="flex-1 flex flex-col py-10 pb-12">
            {/* Hero */}
            <section className="text-center mb-10">
              <div className="mb-6 flex justify-center">
                <img
                  src={`${ASSET_PREFIX}/icon.png`}
                  alt="Backtest Crypto"
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain"
                  loading="eager"
                  decoding="async"
                />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 mb-4">{t.title}</h1>
              <p className="text-zinc-600 leading-relaxed max-w-xl mx-auto">{t.intro}</p>
            </section>

            {/* Card em destaque: Gráficos de análise (novidade) — em primeiro */}
            <section className="mb-8">
              <div className="rounded-2xl border border-zinc-200 bg-white/95 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                    <span role="img" aria-hidden>📈</span>
                    {t.chartsTitle}
                  </h2>
                  <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    {t.chartsNew}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 leading-relaxed">{t.chartsDesc}</p>
              </div>
            </section>

            <div className="rounded-2xl border border-zinc-200 bg-white/95 p-6 sm:p-8 shadow-sm space-y-8">
              {/* Título principal + etiqueta v1.00 */}
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-zinc-900 uppercase tracking-wide flex items-center gap-2">
                  <span role="img" aria-hidden>🔬</span>
                  {t.mainTitle}
                </h2>
                <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  {t.mainCardBadge}
                </span>
              </div>

              {/* Estatísticas no mapa */}
              <section>
                <h3 className="text-base font-semibold text-zinc-800 mb-2 flex items-center gap-2">
                  <span role="img" aria-hidden>📊</span>
                  {t.statsTitle}
                </h3>
                <ul className="list-disc list-inside text-sm text-zinc-700 space-y-1">
                  {STATS_KEYS.map((key) => (
                    <li key={key}>{t[key]}</li>
                  ))}
                </ul>
              </section>

              {/* Painéis de configuração */}
              <section>
                <h3 className="text-base font-semibold text-zinc-800 mb-3 flex items-center gap-2">
                  <span role="img" aria-hidden>⚙️</span>
                  {t.panelsTitle}
                </h3>
                <div className="space-y-4">
                  {PANEL_KEYS.map((n) => (
                    <div key={n} className="border-l-2 border-zinc-300 pl-4">
                      <h4 className="text-sm font-semibold text-zinc-800 mb-0.5">
                        {t[`panel${n}Title` as keyof typeof t]}
                      </h4>
                      <p className="text-sm text-zinc-600 leading-relaxed">
                        {t[`panel${n}Desc` as keyof typeof t]}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Gerenciamento e educação */}
              <section>
                <h3 className="text-base font-semibold text-zinc-800 mb-2 flex items-center gap-2">
                  <span role="img" aria-hidden>📁</span>
                  {t.managementTitle}
                </h3>
                <ul className="list-disc list-inside text-sm text-zinc-700 space-y-1">
                  {MGMT_KEYS.map((key) => (
                    <li key={key}>{t[key]}</li>
                  ))}
                </ul>
              </section>

            </div>

            {/* Botão voltar ao início */}
            <section className="mt-10 flex justify-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                ← {t.backToHome}
              </Link>
            </section>
          </main>
        </div>
      </div>
      <BioLandingFooter lang={lang} setLang={setLang} />
    </div>
  );
}
