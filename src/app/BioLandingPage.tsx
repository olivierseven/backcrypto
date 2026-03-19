"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ASSET_PREFIX } from "./constants";
import { getCryptoT, type CryptoLang } from "./lib/translations";
import BioLandingHeader from "./BioLandingHeader";
import BioLandingFooter from "./BioLandingFooter";

const FEATURES = [
  { emoji: "📊", key: "feature1" as const },
  { emoji: "🎯", key: "feature2" as const },
  { emoji: "📈", key: "feature3" as const },
  { emoji: "📉", key: "feature4" as const },
  { emoji: "🔬", key: "feature5" as const },
  { emoji: "📱", key: "feature6" as const },
] as const;

function getInitialLang(): CryptoLang {
  if (typeof document === "undefined") return "pt";
  const m = document.cookie.match(/sevencoins-lang=([^;]+)/);
  return m?.[1] === "en" ? "en" : "pt";
}

export default function BioLandingPage() {
  const [lang, setLang] = useState<CryptoLang>("pt");
  useEffect(() => {
    const urlLang = new URLSearchParams(window.location.search).get("lang");
    if (urlLang === "en" || urlLang === "pt") setLang(urlLang);
    else setLang(getInitialLang());
  }, []);
  const t = getCryptoT(lang).landing;

  return (
    <div className="min-h-screen w-full flex flex-col">
      <BioLandingHeader lang={lang} setLang={setLang} />
      <div className="flex-1 w-full flex justify-center min-w-0">
        <div
          className="w-full max-w-4xl flex flex-col flex-1 min-w-0"
          style={{
            boxSizing: "border-box",
            paddingLeft: "1rem",
            paddingRight: "1rem",
          }}
        >
      <main className="flex-1 flex flex-col items-center pb-8">
        {/* Hero */}
        <section className="w-full flex justify-center pt-6 pb-6">
          <div className="w-full max-w-4xl flex flex-col items-center px-2">
            {/* Ícone e título centralizados */}
            <div className="mb-4 flex items-center justify-center gap-4">
              <img
                src={`${ASSET_PREFIX}/icon.png`}
                alt="Crypto Strategy"
                width={80}
                height={80}
                className="h-20 w-20 object-contain shrink-0"
                loading="eager"
                decoding="async"
              />
              <div className="flex flex-col items-center">
                <div className="relative inline-block text-center">
                  <span
                    className="absolute -top-1.5 right-0 rounded-sm border border-amber-200 bg-amber-100 px-1 py-0.4 text-[10px] font-semibold uppercase tracking-wider text-amber-800"
                    aria-label="Versão beta"
                  >
                    Beta
                  </span>
                  <h1 className="text-4xl font-bold text-zinc-900">{t.title}</h1>
                  <p className="text-lg text-zinc-500 mt-0.5">{t.subtitle}</p>
                </div>
              </div>
            </div>
            <p className="text-lg text-[#0a1628] mb-4 text-center">{t.tagline}</p>
            <p className="text-[#0a1628] mb-6 leading-relaxed text-center">{t.description}</p>
            <div className="w-full flex justify-center pt-1 pb-1">
              <Link
                href="/login"
                target="_self"
                className="inline-flex items-center justify-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl focus-visible:outline focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                {t.startAnalysis}
              </Link>
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 pb-8" id="features">
          {FEATURES.map(({ emoji, key }) => (
            <div
              key={key}
              className="rounded-xl border border-zinc-200 bg-white/80 p-5 shadow-sm hover:shadow-md transition-shadow text-center"
            >
              <span className="text-3xl block mb-2 mx-auto" role="img" aria-hidden>
                {emoji}
              </span>
              <h3 className="text-lg font-semibold text-zinc-900 mb-1.5 text-center">{t[`${key}Title`]}</h3>
              <p className="text-sm text-zinc-600 text-center leading-relaxed">{t[`${key}Desc`]}</p>
            </div>
          ))}
        </section>

        {/* CTA section */}
        <section className="w-full flex justify-center pt-6 pb-8 border-t border-zinc-200">
          <div className="w-full max-w-2xl flex flex-col items-center text-center px-2">
            <h2 className="text-2xl font-bold text-zinc-900 mb-4">{t.sectionTitle}</h2>
            <p className="text-[#0a1628] mb-6 leading-relaxed">{t.sectionSubtitle}</p>
            <div className="w-full flex justify-center pt-1 pb-1">
              <Link
                href="/login"
                target="_self"
                className="inline-flex items-center justify-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl focus-visible:outline focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                {t.accessPlatform}
              </Link>
            </div>
          </div>
        </section>

        {/* Notice */}
        <section className="w-full flex justify-center pb-0">
          <div className="w-full max-w-2xl rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 text-center px-3">
            <p className="leading-relaxed whitespace-pre-line">{t.notice}</p>
          </div>
        </section>
      </main>
        </div>
      </div>

      <BioLandingFooter lang={lang} setLang={setLang} />
    </div>
  );
}
