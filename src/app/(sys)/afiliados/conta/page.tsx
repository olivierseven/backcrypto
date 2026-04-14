import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getCryptoT } from "@/app/lib/translations";
import {
  AFFILIATE_JWT_COOKIE_NAME,
  CRYPTO_AFFILIATE_LOGIN_PAGE,
  CRYPTO_AFFILIATE_CONTA_PAGE,
} from "@/lib/crypto-auth-next";
import { getLocaleFromRequest } from "@/lib/get-locale-server";
import { cryptoPrisma } from "@/lib/crypto-db";
import { normalizeEmail } from "@/lib/crypto";
import { isAffiliateAccountingAdminEmail } from "@/lib/affiliate-accounting-admin";
import { isAffiliateBillingSectionUnlocked } from "@/lib/affiliate-billing-section-unlocked";
import { getAffiliateBillingCompany } from "@/lib/affiliate-billing-company";
import AffiliateAreaHeader from "../AffiliateAreaHeader";
import AffiliateContaLanguageRow from "./AffiliateContaLanguageRow";
import AffiliateBillingCompanyCard from "./AffiliateBillingCompanyCard";
import AffiliatePayoutProfileCard from "./AffiliatePayoutProfileCard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE_PATH = "/crypto";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sevencoins.com.br";

const COOKIE = AFFILIATE_JWT_COOKIE_NAME;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

function formatCnpjBr(digits: string): string {
  if (digits.length !== 14) return digits;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocaleFromRequest();
  const t = getCryptoT(lang).landing.affiliatesConta;
  return {
    title: `${t.title} | Crypto Strategy`,
    robots: { index: false, follow: false },
    alternates: {
      canonical: `${BASE_URL}${CRYPTO_AFFILIATE_CONTA_PAGE}`,
    },
  };
}

export default async function AfiliadosContaPage() {
  const lang = await getLocaleFromRequest();
  const tp = getCryptoT(lang).landing.affiliatesPainel;
  const tc = getCryptoT(lang).landing.affiliatesConta;
  const tConta = getCryptoT(lang).conta;

  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) {
    redirect(
      `${CRYPTO_AFFILIATE_LOGIN_PAGE}?lang=${lang}&next=${encodeURIComponent(CRYPTO_AFFILIATE_CONTA_PAGE)}`
    );
  }

  let email = "";
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.affiliate !== true || typeof payload.email !== "string") {
      redirect(`${CRYPTO_AFFILIATE_LOGIN_PAGE}?lang=${lang}`);
    }
    email = payload.email;
  } catch {
    redirect(`${CRYPTO_AFFILIATE_LOGIN_PAGE}?lang=${lang}`);
  }

  const emailNorm = normalizeEmail(email);
  const application = await cryptoPrisma.affiliateApplication.findUnique({
    where: { email: emailNorm },
  });

  const billingUnlocked =
    application != null && (await isAffiliateBillingSectionUnlocked(application.idAfiliado));

  const billingCompany = getAffiliateBillingCompany();

  const payoutProfileRow =
    application && billingUnlocked
      ? await cryptoPrisma.affiliatePayoutProfile.findUnique({
          where: { affiliateApplicationId: application.id },
        })
      : null;

  const payoutInitial =
    payoutProfileRow == null
      ? null
      : {
          activeTab: payoutProfileRow.activeTab,
          brRazaoSocial: payoutProfileRow.brRazaoSocial,
          brCnpjDigits: payoutProfileRow.brCnpjDigits,
          brBanco: payoutProfileRow.brBanco,
          brTipoConta: payoutProfileRow.brTipoConta,
          brAgencia: payoutProfileRow.brAgencia,
          brNumeroConta: payoutProfileRow.brNumeroConta,
          brChavePix: payoutProfileRow.brChavePix,
          intPaymentMethod: payoutProfileRow.intPaymentMethod,
          intPaypalEmail: payoutProfileRow.intPaypalEmail,
          intBankName: payoutProfileRow.intBankName,
          intAccountOrIban: payoutProfileRow.intAccountOrIban,
          intSwiftBic: payoutProfileRow.intSwiftBic,
          intAccountHolderName: payoutProfileRow.intAccountHolderName,
          intCountry: payoutProfileRow.intCountry,
        };

  const logoutHref = `${BASE_PATH}/api/auth/afiliados/logout`;
  const showAccountingNav = await isAffiliateAccountingAdminEmail(email);
  const dateLocale = lang === "pt" ? "pt-BR" : "en-US";
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeStyle: "short" }).format(d);

  return (
    <div className="flex h-[100dvh] min-h-0 min-w-0 w-full flex-col overflow-hidden bg-transparent">
      <AffiliateAreaHeader
        lang={lang}
        centerTitle={tc.title}
        showBackToPainel
        backToPainelLabel={tc.backToPanel}
        email={email}
        signedInAs={tp.signedInAs}
        logoutHref={logoutHref}
        logoutLabel={tp.logout}
        cuponsNavAria={tp.cuponsNavAria}
        statsNavAria={tp.statsNavAria}
        showAccountingNav={showAccountingNav}
        accountingNavAria={tp.contabilidadeNavAria}
      />
      <main className="crypto-conta-page relative flex flex-1 min-h-0 min-w-0 w-full flex-col items-center overflow-auto overflow-x-hidden">
        <div className="crypto-conta-wrap relative mx-auto w-full max-w-2xl flex-1 px-0 py-0 sm:px-6 md:px-8">
          <div className="space-y-6 pt-4 sm:pt-2">
            <div className="card-crypto-generator crypto-card">
              <h2 className="text-base font-semibold mb-3 text-zinc-900">{tc.preferencesCard}</h2>
              <dl className="space-y-2 text-sm">
                <AffiliateContaLanguageRow currentLang={lang} languageLabel={tConta.language} />
              </dl>
            </div>
            {!application ? (
              <div className="card-crypto-generator crypto-card">
                <p className="text-sm text-zinc-600">{tc.noApplication}</p>
              </div>
            ) : (
              <div className="card-crypto-generator crypto-card">
                <h2 className="text-base font-semibold mb-3 text-zinc-900">{tc.accountInfo}</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-700 shrink-0">{tc.idAfiliado}</dt>
                    <dd className="font-semibold text-right break-all">{application.idAfiliado}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-700 shrink-0">{tc.razaoSocial}</dt>
                    <dd className="min-w-0 flex-1 text-right break-words">{application.razaoSocial}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-700 shrink-0">{tc.responsavel}</dt>
                    <dd className="text-right break-words">{application.responsavel}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-700 shrink-0">{tc.email}</dt>
                    <dd className="text-right break-all">{application.email}</dd>
                  </div>
                  <div className="flex justify-between gap-3 items-start">
                    <dt className="text-zinc-700 shrink-0 pt-0.5">{tc.siteUrl}</dt>
                    <dd className="text-right min-w-0">
                      <a
                        href={application.siteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline break-all"
                      >
                        {application.siteUrl}
                      </a>
                    </dd>
                  </div>
                  {application.cnpjDigits ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-zinc-700 shrink-0">{tc.cnpj}</dt>
                      <dd className="font-mono font-semibold text-right">{formatCnpjBr(application.cnpjDigits)}</dd>
                    </div>
                  ) : null}
                  {application.taxId ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-zinc-700 shrink-0">{tc.taxId}</dt>
                      <dd className="text-right break-words">{application.taxId}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-700 shrink-0">{tc.locale}</dt>
                    <dd>{application.locale}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-700 shrink-0">{tc.approved}</dt>
                    <dd className={application.approved ? "text-emerald-600 font-medium" : "text-amber-600"}>
                      {application.approved ? tc.yes : tc.no}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-700 shrink-0">{tc.acceptedDocs}</dt>
                    <dd>{application.acceptedDocs ? tc.yes : tc.no}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-700 shrink-0">{tc.createdAt}</dt>
                    <dd>{fmtDate(application.createdAt)}</dd>
                  </div>
                </dl>
              </div>
            )}
            {application ? (
              <AffiliateBillingCompanyCard
                unlocked={billingUnlocked}
                billing={billingCompany}
                title={tc.billingCompanyCard}
                lockedHint={tc.billingLockedHint}
                labels={{
                  cnpj: tc.cnpj,
                  razaoSocial: tc.razaoSocial,
                  cep: tc.billingCep,
                  logradouro: tc.billingLogradouro,
                  numero: tc.billingNumero,
                  complemento: tc.billingComplemento,
                  bairro: tc.billingBairro,
                  municipio: tc.billingMunicipio,
                  uf: tc.billingUf,
                }}
              />
            ) : null}
            {application ? (
              <AffiliatePayoutProfileCard
                lang={lang}
                unlocked={billingUnlocked}
                lockedHint={tc.billingLockedHint}
                initialProfile={payoutInitial}
                prefill={{
                  razaoSocial: application.razaoSocial,
                  cnpjDigits: application.cnpjDigits,
                  email: application.email,
                }}
                labels={{
                  razaoSocial: tc.razaoSocial,
                  cnpj: tc.cnpj,
                  payoutCardTitle: tc.payoutCardTitle,
                  payoutCardLead: tc.payoutCardLead,
                  payoutTitularNotice: tc.payoutTitularNotice,
                  payoutBrReceiveMode: tc.payoutBrReceiveMode,
                  payoutBrModePix: tc.payoutBrModePix,
                  payoutBrModeBank: tc.payoutBrModeBank,
                  payoutBrHintPix: tc.payoutBrHintPix,
                  payoutBrHintBank: tc.payoutBrHintBank,
                  payoutTabBr: tc.payoutTabBr,
                  payoutTabIntl: tc.payoutTabIntl,
                  payoutYourSectionBr: tc.payoutYourSectionBr,
                  payoutBrBanco: tc.payoutBrBanco,
                  payoutBrTipoConta: tc.payoutBrTipoConta,
                  payoutBrTipoCorrente: tc.payoutBrTipoCorrente,
                  payoutBrTipoPoupanca: tc.payoutBrTipoPoupanca,
                  payoutBrTipoPlaceholder: tc.payoutBrTipoPlaceholder,
                  payoutBrAgencia: tc.payoutBrAgencia,
                  payoutBrNumeroConta: tc.payoutBrNumeroConta,
                  payoutBrChavePix: tc.payoutBrChavePix,
                  payoutYourSectionIntl: tc.payoutYourSectionIntl,
                  payoutIntlMethodPaypal: tc.payoutIntlMethodPaypal,
                  payoutIntlMethodWire: tc.payoutIntlMethodWire,
                  payoutIntlPaypalEmail: tc.payoutIntlPaypalEmail,
                  payoutIntlBankName: tc.payoutIntlBankName,
                  payoutIntlIban: tc.payoutIntlIban,
                  payoutIntlAccountNumber: tc.payoutIntlAccountNumber,
                  payoutIntlWireIbanOrAccountHint: tc.payoutIntlWireIbanOrAccountHint,
                  payoutIntlSwiftBic: tc.payoutIntlSwiftBic,
                  payoutIntlAccountHolder: tc.payoutIntlAccountHolder,
                  payoutIntlCountry: tc.payoutIntlCountry,
                  payoutSave: tc.payoutSave,
                  payoutSaving: tc.payoutSaving,
                  payoutSaved: tc.payoutSaved,
                  payoutErrorNetwork: tc.payoutErrorNetwork,
                  payoutErrorBrRequired: tc.payoutErrorBrRequired,
                  payoutErrorBrPayment: tc.payoutErrorBrPayment,
                  payoutErrorBrBankIncomplete: tc.payoutErrorBrBankIncomplete,
                  payoutErrorIntlWire: tc.payoutErrorIntlWire,
                  payoutErrorIntlWireIbanBoth: tc.payoutErrorIntlWireIbanBoth,
                  payoutErrorCnpj: tc.payoutErrorCnpj,
                  payoutErrorEmail: tc.payoutErrorEmail,
                  payoutErrorIntlMethod: tc.payoutErrorIntlMethod,
                }}
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
