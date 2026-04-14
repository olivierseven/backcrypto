"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCryptoT } from "@/app/lib/translations";
import type { CryptoLang } from "@/app/lib/translations";

export default function AffiliateAreaHeader({
  lang,
  centerTitle,
  showBackToPainel,
  backToPainelLabel,
  email,
  signedInAs,
  logoutHref,
  logoutLabel,
  cuponsNavAria,
  statsNavAria,
  showAccountingNav = false,
  accountingNavAria = "",
}: {
  lang: CryptoLang;
  centerTitle: string;
  showBackToPainel: boolean;
  backToPainelLabel: string;
  email: string;
  signedInAs: string;
  logoutHref: string;
  logoutLabel: string;
  /** Acessibilidade do atalho para `/afiliados/cupons`. */
  cuponsNavAria: string;
  /** Acessibilidade do atalho para `/afiliados/estatisticas`. */
  statsNavAria: string;
  /** Só quando o e-mail coincide com `CRYPTO_ACCOUNTING_ADMIN_EMAIL`: atalho para contabilidade global. */
  showAccountingNav?: boolean;
  accountingNavAria?: string;
}) {
  const pathname = usePathname();
  const isPainel = pathname?.includes("/afiliados/painel") === true;
  const isConta = pathname?.includes("/afiliados/conta") === true;
  const isCupons = pathname?.includes("/afiliados/cupons") === true;
  const isEstatisticas = pathname?.includes("/afiliados/estatisticas") === true;
  const isContabilidade = pathname?.includes("/afiliados/contabilidade") === true;
  const tk = getCryptoT(lang).sistema.klines;
  const menuConta = (tk as Record<string, string>).menuConta ?? "Account";

  return (
    <header
      className="affiliate-area-header shrink-0 min-h-0 w-full min-w-0 border-b border-neutral-200 bg-white/80 backdrop-blur flex items-center justify-between gap-2 px-3 py-1 min-h-[40px] z-[1000] relative box-border"
      aria-label={centerTitle}
    >
      <div className="min-w-0 flex-1 flex items-center gap-2">
        {showBackToPainel && (
          <Link
            href="/afiliados/painel"
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900 shrink-0 rounded-md px-2 py-1.5 hover:bg-zinc-100"
          >
            ← {backToPainelLabel}
          </Link>
        )}
        <span className="text-sm font-semibold text-zinc-900 truncate">{centerTitle}</span>
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <Link
          href="/afiliados/painel"
          className={`p-1.5 sm:p-2 rounded shrink-0 ${isPainel ? "bg-violet-100 text-violet-900" : "text-zinc-700 hover:bg-zinc-100"}`}
          title="Painel"
          aria-label="Painel"
          aria-current={isPainel ? "page" : undefined}
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l9-9 9 9M5 10v10h14V10M9 20v-6h6v6"
            />
          </svg>
        </Link>
        <Link
          href="/afiliados/estatisticas"
          className={`p-1.5 sm:p-2 rounded shrink-0 ${isEstatisticas ? "bg-violet-100 text-violet-900" : "text-zinc-700 hover:bg-zinc-100"}`}
          title={statsNavAria}
          aria-label={statsNavAria}
          aria-current={isEstatisticas ? "page" : undefined}
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </Link>
        {showAccountingNav ? (
          <Link
            href="/afiliados/contabilidade"
            className={`p-1.5 sm:p-2 rounded shrink-0 ${isContabilidade ? "bg-violet-100 text-violet-900" : "text-zinc-700 hover:bg-zinc-100"}`}
            title={accountingNavAria}
            aria-label={accountingNavAria}
            aria-current={isContabilidade ? "page" : undefined}
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </Link>
        ) : null}
        <Link
          href="/afiliados/cupons"
          className={`p-1.5 sm:p-2 rounded shrink-0 ${isCupons ? "bg-violet-100 text-violet-900" : "text-zinc-700 hover:bg-zinc-100"}`}
          title={cuponsNavAria}
          aria-label={cuponsNavAria}
          aria-current={isCupons ? "page" : undefined}
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
            />
          </svg>
        </Link>
        <Link
          href="/afiliados/conta"
          className={`p-1.5 sm:p-2 rounded shrink-0 ${isConta ? "bg-zinc-200 text-zinc-900" : "text-zinc-700 hover:bg-zinc-100"}`}
          title={`${signedInAs}: ${email}`}
          aria-label={`${menuConta}. ${signedInAs}: ${email}`}
          aria-current={isConta ? "page" : undefined}
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </Link>
        <a
          href={logoutHref}
          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 px-2 py-1.5 rounded-md hover:bg-zinc-100"
        >
          {logoutLabel}
        </a>
      </div>
    </header>
  );
}
