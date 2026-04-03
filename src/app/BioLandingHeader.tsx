"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ASSET_PREFIX } from "./constants";
import LanguageSwitcher from "./components/LanguageSwitcher";
import { getCryptoT, type CryptoLang } from "./lib/translations";

const SC_BASE = "https://sevencoins.com.br";

type Props = {
  lang: CryptoLang;
  setLang: (lang: CryptoLang) => void;
};

export default function BioLandingHeader({ lang, setLang }: Props) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const t = getCryptoT(lang).landing;
  const nav = t.nav;

  const earnProgramHref = `/${lang}/afiliados`;
  const earnLoginPath = "/afiliados/login";
  const earnLoginHref = `${earnLoginPath}?lang=${lang}`;

  const navLinks = useMemo(
    () =>
      [
        { href: `/${lang}`, key: "home" as const, external: false },
        { href: SC_BASE, key: "sevencoins" as const, external: true },
        { href: `/${lang}/funcionalidade`, key: "functionality" as const, external: false },
        { href: "/comunidade", key: "community" as const, external: false },
      ] as const,
    [lang],
  );

  const linkClass = "px-3 py-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700";
  const linkClassActive = "px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50";

  const isActive = (key: (typeof navLinks)[number]["key"]) => {
    if (key === "home") return pathname === `/${lang}`;
    if (key === "functionality") return pathname === `/${lang}/funcionalidade`;
    if (key === "community") return pathname === "/comunidade";
    return false;
  };

  const isEarnActive =
    pathname === earnProgramHref ||
    pathname === earnLoginPath ||
    pathname.startsWith(`/${lang}/afiliados/`);

  const earnTriggerClass = isEarnActive ? linkClassActive : linkClass;

  const subLinkClass = (href: string) => {
    const pathOnly = href.split("?")[0] ?? href;
    const active = pathname === href || pathname === pathOnly;
    return `block w-full text-left px-3 py-2 text-sm rounded-lg ${
      active
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
        : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
    }`;
  };

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-zinc-800/80 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto max-w-7xl px-4 py-1">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href={`/${lang}`} className="flex items-center gap-2">
              <img
                src={`${ASSET_PREFIX}/assets/logo.webp`}
                alt="Crypto"
                className="h-10 w-auto max-h-10 max-w-[min(140px,55vw)] object-contain object-left"
                loading="eager"
              />
            </Link>
          </div>

          {/* Menu desktop */}
          <nav className="hidden md:flex items-center gap-6">
            <div className="flex gap-2 text-sm items-center">
              {navLinks.map(({ href, key, external }) => {
                const className = isActive(key) ? linkClassActive : linkClass;
                return external ? (
                  <a key={key} href={href} className={className}>
                    {nav[key]}
                  </a>
                ) : (
                  <Link key={key} href={href} className={className}>
                    {nav[key]}
                  </Link>
                );
              })}

              {/* Afiliados ▾ Programa / Login */}
              <div className="relative group">
                <button
                  type="button"
                  className={`${earnTriggerClass} inline-flex items-center gap-0.5 cursor-default`}
                  aria-haspopup="menu"
                  aria-expanded="false"
                  aria-label={nav.earnMenuAria}
                >
                  {nav.earn}
                  <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  role="menu"
                  className="absolute left-0 top-full z-50 min-w-[12.5rem] pt-1 opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto transition-opacity"
                >
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-zinc-800 py-1 shadow-lg">
                    <Link href={earnProgramHref} role="menuitem" className={subLinkClass(earnProgramHref)}>
                      {nav.affiliateProgram}
                    </Link>
                    <Link href={earnLoginHref} role="menuitem" className={subLinkClass(earnLoginHref)}>
                      {nav.affiliateLogin}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          {/* Botões desktop */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher currentLang={lang} onLangChange={setLang} />
            <Link
              href={`${SC_BASE}/produtos`}
              className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium shadow-sm border border-neutral-200 dark:border-neutral-600 bg-[#D4AF37] text-neutral-900 no-underline hover:brightness-95 active:scale-[.99]"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM15.1 8H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
              {nav.platforms}
            </Link>
          </div>

          {/* Botões mobile */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageSwitcher currentLang={lang} onLangChange={setLang} />
            <Link
              href={`${SC_BASE}/produtos`}
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium shadow-sm border border-neutral-200 dark:border-neutral-600 bg-[#D4AF37] text-neutral-900 no-underline hover:brightness-95 active:scale-[.99]"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM15.1 8H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
              {nav.platforms}
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
              aria-label={t.menuAria}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Menu mobile */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-200 dark:border-neutral-700 py-3">
            <div className="flex justify-end">
              <nav className="flex flex-col gap-2 w-fit max-w-full items-end">
                {navLinks.map(({ href, key, external }) => {
                  const itemClass = `px-3 py-2 rounded-lg text-sm text-left ${isActive(key) ? linkClassActive : linkClass}`;
                  if (external) {
                    return (
                      <a
                        key={key}
                        href={href}
                        className={itemClass}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {nav[key]}
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={key}
                      href={href}
                      className={itemClass}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {nav[key]}
                    </Link>
                  );
                })}

                <div className="w-full border-t border-neutral-200 dark:border-neutral-700 pt-2 mt-1 flex flex-col gap-1 items-stretch">
                  <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-500 text-right`}>
                    {nav.earn}
                  </span>
                  <Link
                    href={earnProgramHref}
                    className={`${subLinkClass(earnProgramHref)} text-right`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {nav.affiliateProgram}
                  </Link>
                  <Link
                    href={earnLoginHref}
                    className={`${subLinkClass(earnLoginHref)} text-right`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {nav.affiliateLogin}
                  </Link>
                </div>
              </nav>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
