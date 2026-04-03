"use client";

import React from "react";
import LanguageSwitcher from "./components/LanguageSwitcher";
import { getCryptoT, type CryptoLang } from "./lib/translations";

const SC_BASE = "https://sevencoins.com.br";

type Props = {
  lang: CryptoLang;
  setLang: (lang: CryptoLang) => void;
};

export default function BioLandingFooter({ lang, setLang }: Props) {
  const L = getCryptoT(lang).footer;

  return (
    <footer className="border-t border-white/60 bg-white/70 backdrop-blur-xl dark:border-zinc-700 dark:bg-zinc-800/70">
      <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <LanguageSwitcher currentLang={lang} onLangChange={setLang} className="shrink-0" />
              <span>
                © {new Date().getFullYear()} • SevenCoins • 63.778.661/0001-62 • {L.tagline}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-zinc-500 dark:text-zinc-500">{L.followUs}</span>
              <a
                href="https://x.com/SevenCoins77"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:scale-110 transition-transform duration-200"
                aria-label="X (Twitter)"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <a href={`${SC_BASE}/privacy`} className="text-zinc-600 dark:text-zinc-400 hover:underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              {L.privacy}
            </a>
            <a href={`${SC_BASE}/terms`} className="text-zinc-600 dark:text-zinc-400 hover:underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              {L.terms}
            </a>
            <a
              href={`${SC_BASE}/${lang}/affiliate-terms`}
              className="text-zinc-600 dark:text-zinc-400 hover:underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              {L.affiliateTerms}
            </a>
            <a href={`${SC_BASE}/refund-policy`} className="text-zinc-600 dark:text-zinc-400 hover:underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              {L.refund}
            </a>
            <a href={`${SC_BASE}/privacy#cookies`} className="text-zinc-600 dark:text-zinc-400 hover:underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              {L.cookies}
            </a>
            <a href={`${SC_BASE}/contato`} className="text-zinc-600 dark:text-zinc-400 hover:underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              {L.contact}
            </a>
            <a href={`${SC_BASE}/sobre`} className="text-zinc-600 dark:text-zinc-400 hover:underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              {L.about}
            </a>
            <a href={`${SC_BASE}/powered-by`} className="text-zinc-600 dark:text-zinc-400 hover:underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              {L.poweredBy}
            </a>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div></div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              🔒 <span className="hidden sm:inline">Powered by</span> Stripe
            </span>
            <span className="flex items-center gap-1">🛡️ Secure SSL</span>
            <span className="flex items-center gap-1">📋 LGPD Compliant</span>
          </div>
          <div />
        </div>
      </div>
    </footer>
  );
}
