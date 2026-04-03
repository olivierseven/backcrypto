"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCryptoT, type CryptoLang } from "@/app/lib/translations";
import { API_BASE } from "@/app/constants";
import { isValidCnpjDigits, normalizeCnpjDigits } from "@/lib/cnpj";
import BioLandingHeader from "@/app/BioLandingHeader";
import BioLandingFooter from "@/app/BioLandingFooter";

const SC_BASE = "https://sevencoins.com.br";

function formatCnpjInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function getInitialLang(): CryptoLang {
  if (typeof document === "undefined") return "pt";
  const m = document.cookie.match(/sevencoins-lang=([^;]+)/);
  return m?.[1] === "en" ? "en" : "pt";
}

type AffiliatesDoc = {
  title: string;
  backToHome: string;
  lead: string;
  intro2: string;
  howTitle: string;
  howIntro: string;
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  benefitsTitle: string;
  benefit1: string;
  benefit2: string;
  benefit3: string;
  benefit4: string;
  commissionTitle: string;
  commissionP1: string;
  subscriptionPlansTitle: string;
  subscriptionRule1: string;
  subscriptionRule2: string;
  requirementsTitle: string;
  requirementsLead: string;
  requirementsIntro: string;
  req1: string;
  req2: string;
  req3: string;
  requirementsFooter: string;
  paymentsTitle: string;
  paymentsLead: string;
  pay1: string;
  pay2: string;
  pay3: string;
  paymentsClosing: string;
  transparencyTitle: string;
  transparencyBody: string;
  formSectionTitle: string;
  formDocsIntro: string;
  linkPrivacyPolicy: string;
  linkTermsOfUse: string;
  linkAffiliateProgramTerms: string;
  docsCheckbox: string;
  labelCnpj: string;
  /** EN: campo único em substituição de CNPJ + razão social. */
  labelTaxId?: string;
  labelRazaoSocial: string;
  labelResponsavel: string;
  labelEmail: string;
  labelSiteUrl: string;
  placeholderEmail: string;
  placeholderUrl: string;
  placeholderCnpj: string;
  placeholderRazaoSocial?: string;
  placeholderResponsavel?: string;
  placeholderTaxId?: string;
  submit: string;
  submitting: string;
  successP1: string;
  successP2: string;
  successIdLine: string;
  successSubmitLocked: string;
  errorGeneric: string;
  errorCnpj: string;
  errorTaxId?: string;
  errorEmail: string;
  errorEmailUnique: string;
  errorUrl: string;
  errorRequired: string;
  errorRateLimited: string;
};

type Props = { initialLocale: CryptoLang };

export default function BioAfiliadosPage({ initialLocale }: Props) {
  const pathname = usePathname();
  const [lang, setLang] = useState<CryptoLang>(initialLocale);
  const [cnpj, setCnpj] = useState("");
  const [taxId, setTaxId] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [email, setEmail] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [acceptedDocs, setAcceptedDocs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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

  const t = getCryptoT(lang).landing.affiliatesPage as unknown as AffiliatesDoc;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (lang === "en") {
      const tax = taxId.trim();
      if (
        !acceptedDocs ||
        !razaoSocial.trim() ||
        !tax ||
        !responsavel.trim() ||
        !email.trim() ||
        !siteUrl.trim()
      ) {
        setFormError(t.errorRequired);
        return;
      }
      if (tax.length < 4 || tax.length > 200) {
        setFormError(t.errorTaxId ?? "Invalid Tax ID.");
        return;
      }
    } else {
      const cnpjDigits = normalizeCnpjDigits(cnpj);
      if (
        !acceptedDocs ||
        !razaoSocial.trim() ||
        !responsavel.trim() ||
        !email.trim() ||
        !siteUrl.trim() ||
        cnpjDigits.length !== 14
      ) {
        setFormError(t.errorRequired);
        return;
      }
      if (!isValidCnpjDigits(cnpjDigits)) {
        setFormError(t.errorCnpj);
        return;
      }
    }

    setSubmitting(true);
    try {
      const body =
        lang === "en"
          ? {
              taxId: taxId.trim(),
              razaoSocial: razaoSocial.trim(),
              responsavel: responsavel.trim(),
              email: email.trim(),
              siteUrl: siteUrl.trim(),
              acceptedDocs,
              locale: lang,
            }
          : {
              cnpj,
              razaoSocial: razaoSocial.trim(),
              responsavel: responsavel.trim(),
              email: email.trim(),
              siteUrl: siteUrl.trim(),
              acceptedDocs,
              locale: lang,
            };

      const res = await fetch(`${API_BASE}/affiliate-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { idAfiliado?: string; code?: string };
      if (res.status === 429) {
        setFormError(t.errorRateLimited);
        return;
      }
      if (res.status === 409 && data.code === "email_unique") {
        setFormError(t.errorEmailUnique);
        return;
      }
      if (!res.ok) {
        if (res.status === 400 && data.code === "cnpj") setFormError(t.errorCnpj);
        else if (res.status === 400 && data.code === "taxId") setFormError(t.errorTaxId ?? t.errorRequired);
        else if (res.status === 400 && data.code === "email") setFormError(t.errorEmail);
        else if (res.status === 400 && data.code === "url") setFormError(t.errorUrl);
        else if (res.status === 400) setFormError(t.errorRequired);
        else setFormError(t.errorGeneric);
        return;
      }
      if (data.idAfiliado) setSuccessId(data.idAfiliado);
      else setFormError(t.errorGeneric);
    } catch {
      setFormError(t.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col">
      <BioLandingHeader lang={lang} setLang={setLang} />
      <div className="flex-1 w-full flex justify-center min-w-0">
        <div className="w-full max-w-3xl flex flex-col flex-1 min-w-0 px-4 sm:px-6">
          <main className="flex-1 flex flex-col py-10 pb-12">
            <article className="rounded-2xl border border-zinc-200 bg-white/95 p-6 sm:p-8 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90">
              <div
                className="crypto-policies-content prose prose-sm max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-lg prose-p:leading-relaxed prose-ul:my-3 prose-li:my-1 text-zinc-700 dark:prose-invert dark:text-zinc-300 prose-headings:text-zinc-900 dark:prose-headings:text-zinc-100"
              >
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-b border-zinc-200 pb-3 dark:border-zinc-600">
                  {t.title}
                </h1>
                <p className="lead text-base text-zinc-800 dark:text-zinc-200">{t.lead}</p>
                <p>{t.intro2}</p>

                <h2>{t.howTitle}</h2>
                {t.howIntro.trim() ? <p>{t.howIntro}</p> : null}
                <ol className="list-decimal pl-5 space-y-2">
                  <li>{t.step1}</li>
                  <li>{t.step2}</li>
                  <li>{t.step3}</li>
                  <li>{t.step4}</li>
                </ol>

                <h2>{t.benefitsTitle}</h2>
                <ul className="list-none pl-0 space-y-2">
                  <li>{t.benefit1}</li>
                  <li>{t.benefit2}</li>
                  <li>{t.benefit3}</li>
                  <li>{t.benefit4}</li>
                </ul>

                <h2>{t.commissionTitle}</h2>
                <p>{t.commissionP1}</p>
                <p className="font-medium text-zinc-800 dark:text-zinc-200">{t.subscriptionPlansTitle}</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{t.subscriptionRule1}</li>
                  <li>{t.subscriptionRule2}</li>
                </ul>

                <h2>{t.requirementsTitle}</h2>
                <p>{t.requirementsLead}</p>
                <p>{t.requirementsIntro}</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{t.req1}</li>
                  <li>{t.req2}</li>
                  <li>{t.req3}</li>
                </ul>
                <p>{t.requirementsFooter}</p>

                <h2>{t.paymentsTitle}</h2>
                <p>{t.paymentsLead}</p>
                {[t.pay1, t.pay2, t.pay3].some((x) => x.trim()) ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {[t.pay1, t.pay2, t.pay3]
                      .filter((x) => x.trim())
                      .map((text, i) => (
                        <li key={i}>{text}</li>
                      ))}
                  </ul>
                ) : null}
                <p>{t.paymentsClosing}</p>

                <h2>{t.transparencyTitle}</h2>
                <p>{t.transparencyBody}</p>
              </div>
            </article>

            <section className="mt-8 rounded-2xl border border-zinc-200 bg-white/95 p-6 sm:p-8 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{t.formSectionTitle}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">{t.formDocsIntro}</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-700 dark:text-zinc-300 mb-6">
                <li>
                  <a
                    href={`${SC_BASE}/privacy`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    {t.linkPrivacyPolicy}
                  </a>
                </li>
                <li>
                  <a
                    href={`${SC_BASE}/terms`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    {t.linkTermsOfUse}
                  </a>
                </li>
                <li>
                  <a
                    href={`${SC_BASE}/${lang}/affiliate-terms`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    {t.linkAffiliateProgramTerms}
                  </a>
                </li>
              </ul>

              {successId ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100 space-y-3"
                >
                  <p className="leading-relaxed m-0">{t.successP1}</p>
                  <p className="leading-relaxed m-0">{t.successP2}</p>
                  <p className="text-sm font-medium text-emerald-950 dark:text-emerald-50 m-0 pt-1 border-t border-emerald-200/80 dark:border-emerald-800/80">
                    {t.successIdLine.replace("{idAfiliado}", successId)}
                  </p>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="mt-2 inline-flex w-full sm:w-auto justify-center rounded-xl bg-emerald-600/50 px-5 py-2.5 text-sm font-medium text-white cursor-not-allowed opacity-70 dark:bg-emerald-800/60"
                  >
                    {t.successSubmitLocked}
                  </button>
                </div>
              ) : (
                <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <label className="flex items-start gap-3 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      required
                      checked={acceptedDocs}
                      onChange={(e) => setAcceptedDocs(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{t.docsCheckbox}</span>
                  </label>

                  {lang === "en" ? (
                    <div>
                      <label htmlFor="aff-taxid" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1">
                        {t.labelTaxId ?? "Tax ID / Business Registration Number"}
                      </label>
                      <input
                        id="aff-taxid"
                        type="text"
                        required
                        autoComplete="off"
                        placeholder={t.placeholderTaxId ?? ""}
                        value={taxId}
                        onChange={(e) => setTaxId(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="aff-cnpj" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1">
                          {t.labelCnpj}
                        </label>
                        <input
                          id="aff-cnpj"
                          type="text"
                          required
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder={t.placeholderCnpj}
                          value={cnpj}
                          onChange={(e) => setCnpj(formatCnpjInput(e.target.value))}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label htmlFor="aff-razao" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1">
                          {t.labelRazaoSocial}
                        </label>
                        <input
                          id="aff-razao"
                          type="text"
                          required
                          autoComplete="organization"
                          placeholder={t.placeholderRazaoSocial ?? ""}
                          value={razaoSocial}
                          onChange={(e) => setRazaoSocial(e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label htmlFor="aff-resp" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1">
                      {t.labelResponsavel}
                    </label>
                    <input
                      id="aff-resp"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder={t.placeholderResponsavel ?? ""}
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="aff-email" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1">
                      {t.labelEmail}
                    </label>
                    <input
                      id="aff-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder={t.placeholderEmail}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="aff-url" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1">
                      {t.labelSiteUrl}
                    </label>
                    <input
                      id="aff-url"
                      type="url"
                      required
                      inputMode="url"
                      autoComplete="url"
                      placeholder={t.placeholderUrl}
                      value={siteUrl}
                      onChange={(e) => setSiteUrl(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>

                  {formError ? (
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                      {formError}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting || !acceptedDocs}
                    className="inline-flex justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                  >
                    {submitting ? t.submitting : t.submit}
                  </button>
                </form>
              )}
            </section>

            <section className="mt-10 flex justify-center">
              <Link
                href={`/${lang}`}
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
