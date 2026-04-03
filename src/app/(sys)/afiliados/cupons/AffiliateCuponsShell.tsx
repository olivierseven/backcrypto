"use client";

import AffiliateAreaHeader from "../AffiliateAreaHeader";
import AffiliateCouponHistoryList from "../painel/AffiliateCouponHistoryList";
import { getCryptoT } from "@/app/lib/translations";
import type { CryptoLang } from "@/app/lib/translations";

/** Tela dedicada: só histórico (gerar/ativar fica no painel). */
export default function AffiliateCuponsShell({
  lang,
  title,
  historyLead,
  email,
  signedInAs,
  logoutHref,
  logoutLabel,
  backToPanelLabel,
  showAccountingNav = false,
}: {
  lang: CryptoLang;
  title: string;
  historyLead: string;
  email: string;
  signedInAs: string;
  logoutHref: string;
  logoutLabel: string;
  backToPanelLabel: string;
  showAccountingNav?: boolean;
}) {
  const t = getCryptoT(lang).landing.affiliatesPainel;

  return (
    <div className="flex h-[100dvh] min-h-0 min-w-0 w-full flex-col overflow-hidden bg-transparent">
      <AffiliateAreaHeader
        lang={lang}
        centerTitle={title}
        showBackToPainel
        backToPainelLabel={backToPanelLabel}
        email={email}
        signedInAs={signedInAs}
        logoutHref={logoutHref}
        logoutLabel={logoutLabel}
        cuponsNavAria={t.cuponsNavAria}
        statsNavAria={t.statsNavAria}
        showAccountingNav={showAccountingNav}
        accountingNavAria={t.contabilidadeNavAria}
      />
      <main className="crypto-conta-page relative flex flex-1 min-h-0 min-w-0 w-full flex-col items-center overflow-auto overflow-x-hidden">
        <div className="crypto-conta-wrap relative mx-auto w-full max-w-[900px] flex-1 px-0 py-0 sm:px-6 md:px-8">
          <div className="space-y-6 pt-4 sm:pt-2 pb-8">
            <p className="text-sm text-zinc-600 leading-relaxed">{historyLead}</p>
            <AffiliateCouponHistoryList
              lang={lang}
              sectionTitle={t.cuponsHistorySectionTitle}
              emptyLabel={t.noCouponsYet}
              errorLabel={t.couponLoadError}
              colCode={t.couponTableColCode}
              colCreated={t.couponTableColCreated}
              colStatus={t.couponTableColStatus}
              colExpires={t.couponTableColExpires}
              statusInactive={t.couponStatusInactive}
              statusActive={t.couponStatusActive}
              statusExpired={t.couponStatusExpired}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
