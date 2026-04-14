"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCryptoT, type CryptoLang } from "@/app/lib/translations";
import BioLandingHeader from "@/app/BioLandingHeader";
import BioLandingFooter from "@/app/BioLandingFooter";

const FEAT_KEYS = [1, 2, 3, 4, 5, 6, 7] as const;
const FUTURE_KEYS = [1, 2, 3, 4, 5] as const;
const FEAT_EMOJIS: Record<number, string> = {
  1: "📊",
  2: "🔗",
  3: "📈",
  4: "📉",
  5: "📊",
  6: "📅",
  7: "⚙️",
};
const FUTURE_EMOJIS: Record<number, string> = {
  1: "🪙",
  2: "⏱️",
  3: "📊",
  4: "🎨",
  5: "🔌",
};

function getInitialLang(): CryptoLang {
  if (typeof document === "undefined") return "pt";
  const m = document.cookie.match(/sevencoins-lang=([^;]+)/);
  return m?.[1] === "en" ? "en" : "pt";
}

type Props = { initialLocale: CryptoLang };

export default function BioFuncionalidadePage({ initialLocale }: Props) {
  const pathname = usePathname();
  const [lang, setLang] = useState<CryptoLang>(initialLocale);

  useEffect(() => {
    const parts = pathname.split("/").filter(Boolean);
    const seg = parts[0];
    if (seg === "en" || seg === "pt") {
      setLang(seg);
      return;
    }
    const urlLang = new URLSearchParams(window.location.search).get("lang");
    if (urlLang === "en" || urlLang === "pt") setLang(urlLang);
    else setLang(getInitialLang());
  }, [pathname]);
  const t = getCryptoT(lang).landing.funcPage;

  return (
    <div className="min-h-screen w-full flex flex-col">
      <BioLandingHeader lang={lang} setLang={setLang} />
      <div className="flex-1 w-full flex justify-center min-w-0">
        <div className="w-full max-w-3xl flex flex-col flex-1 min-w-0 px-4 sm:px-6">
          <main className="flex-1 flex flex-col py-10 pb-12">
            {/* Card: Principais Funcionalidades */}
            <div className="rounded-2xl border border-zinc-200 bg-white/95 p-6 sm:p-8 shadow-sm space-y-8 mb-8">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-zinc-900 uppercase tracking-wide">
                  {t.mainTitle}
                </h2>
                <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  {(t as { mainCardBadge?: string }).mainCardBadge}
                </span>
              </div>

              {FEAT_KEYS.map((n) => (
                <section key={n}>
                  <h3 className="text-base font-semibold text-zinc-800 mb-2 flex items-center gap-2">
                    <span role="img" aria-hidden>{FEAT_EMOJIS[n]}</span>
                    {t[`feat${n}Title` as keyof typeof t]}
                  </h3>
                  <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">
                    {t[`feat${n}Desc` as keyof typeof t]}
                  </p>
                </section>
              ))}
              {(t as Record<string, string>).closingCta ? (
                <p className="text-sm font-medium text-zinc-800 leading-relaxed pt-2 border-t border-zinc-100">
                  {(t as Record<string, string>).closingCta}
                </p>
              ) : null}
            </div>

            {/* Card: Funcionalidades Planejadas */}
            <section>
              <div className="rounded-2xl border border-zinc-200 bg-white/95 p-6 sm:p-8 shadow-sm space-y-6">
                <h2 className="text-lg font-bold text-zinc-700 uppercase tracking-wide">
                  {(t as Record<string, string>).futureTitle}
                </h2>
                {FUTURE_KEYS.map((n) => (
                  <div key={n}>
                    <h3 className="text-base font-semibold text-zinc-800 mb-1.5 flex items-center gap-2">
                      <span role="img" aria-hidden>{FUTURE_EMOJIS[n]}</span>
                      {(t as Record<string, string>)[`future${n}Title`]}
                    </h3>
                    <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line pl-7">
                      {(t as Record<string, string>)[`future${n}Desc`]}
                    </p>
                  </div>
                ))}
              </div>
            </section>

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
