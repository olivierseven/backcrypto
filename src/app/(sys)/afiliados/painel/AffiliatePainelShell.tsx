"use client";

import AffiliateAreaHeader from "../AffiliateAreaHeader";
import AffiliateCouponCard from "./AffiliateCouponCard";
import { getCryptoT } from "@/app/lib/translations";
import type { CryptoLang } from "@/app/lib/translations";

/** Shell do painel de afiliado: header + card de boas-vindas e comissões. */
export default function AffiliatePainelShell({
  lang,
  title,
  email,
  signedInAs,
  logoutHref,
  logoutLabel,
  showAccountingNav = false,
}: {
  lang: CryptoLang;
  title: string;
  email: string;
  signedInAs: string;
  logoutHref: string;
  logoutLabel: string;
  showAccountingNav?: boolean;
}) {
  const t = getCryptoT(lang).landing.affiliatesPainel;

  return (
    <div className="flex h-[100dvh] min-h-0 min-w-0 w-full flex-col overflow-hidden bg-transparent">
      <AffiliateAreaHeader
        lang={lang}
        centerTitle={title}
        showBackToPainel={false}
        backToPainelLabel=""
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
            <div className="card-crypto-generator crypto-card">
              <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">{t.welcomeTitle}</h2>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{t.welcomeSubtitle}</p>

              <p className="mt-6 text-sm font-semibold text-zinc-800 text-center">
                [ {t.commissionRatesTitle} ]
              </p>

              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-zinc-200 bg-white/90 px-4 py-3">
                  <p className="text-sm font-medium text-zinc-900">{t.annualPlanLabel}</p>
                  <p className="mt-1 text-sm text-emerald-700 font-medium">{t.annualPlanEarn}</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white/90 px-4 py-3">
                  <p className="text-sm font-medium text-zinc-900">{t.monthlyPlanLabel}</p>
                  <p className="mt-1 text-sm text-emerald-700 font-medium">{t.monthlyPlanEarn}</p>
                </div>
              </div>

              <p className="mt-6 pt-4 border-t border-zinc-200 text-sm text-zinc-600 leading-relaxed">
                {t.payoutSettlementNote}
              </p>
            </div>

            <AffiliateCouponCard
              lang={lang}
              title={t.campaignCouponTitle}
              discountTitle={t.couponUserDiscountTitle}
              discountSubtitle={t.couponUserDiscountSubtitle}
              generateLabel={t.generateCouponButton}
              generatingLabel={t.generatingCoupon}
              yourCodesLabel={t.yourCouponCodes}
              loadingCodesLabel={t.couponCodesLoading}
              emptyLabel={t.noCouponsYet}
              onlyExpiredSeeHistoryLabel={t.couponPainelOnlyExpired}
              errorLabel={t.couponLoadError}
              maxInactiveLabel={t.couponMaxInactiveReached}
              maxActiveLabel={t.couponMaxActiveReached}
              generateBlockedHint={t.generateCouponBlockedHint}
              generateBlockedNotApprovedHint={t.generateCouponBlockedNotApprovedHint}
              couponNotApprovedError={t.couponNotApprovedError}
              activateBlockedByActiveHint={t.activateBlockedByActiveHint}
              activateLabel={t.activateCouponButton}
              activatingActivateLabel={t.activatingCouponActivate}
              inactiveHint={t.couponInactiveHint}
              activateConfirmTitle={t.couponActivateConfirmTitle}
              activateConfirmBody={t.couponActivateConfirmBody}
              activateConfirmOk={t.couponActivateConfirmOk}
              activateConfirmCancel={t.couponActivateConfirmCancel}
              colCode={t.couponTableColCode}
              colCreated={t.couponTableColCreated}
              colStatus={t.couponTableColStatus}
              colExpires={t.couponTableColExpires}
              colAction={t.couponTableColAction}
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
