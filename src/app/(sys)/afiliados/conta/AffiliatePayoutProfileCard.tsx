"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CryptoLang } from "@/app/lib/translations";
import { CRYPTO_BASE_PATH } from "@/lib/crypto-auth-next";
import { isValidCnpjDigits, normalizeCnpjDigits } from "@/lib/cnpj";

export type AffiliatePayoutProfileInitial = {
  activeTab: string;
  brRazaoSocial: string | null;
  brCnpjDigits: string | null;
  brBanco: string | null;
  brTipoConta: string | null;
  brAgencia: string | null;
  brNumeroConta: string | null;
  brChavePix: string | null;
  intPaymentMethod: string | null;
  intPaypalEmail: string | null;
  intBankName: string | null;
  intAccountOrIban: string | null;
  intSwiftBic: string | null;
  intAccountHolderName: string | null;
  intCountry: string | null;
} | null;

type Labels = {
  razaoSocial: string;
  cnpj: string;
  payoutCardTitle: string;
  payoutCardLead: string;
  payoutTitularNotice: string;
  payoutBrReceiveMode: string;
  payoutBrModePix: string;
  payoutBrModeBank: string;
  payoutBrHintPix: string;
  payoutBrHintBank: string;
  payoutTabBr: string;
  payoutTabIntl: string;
  payoutYourSectionBr: string;
  payoutBrBanco: string;
  payoutBrTipoConta: string;
  payoutBrTipoCorrente: string;
  payoutBrTipoPoupanca: string;
  payoutBrTipoPlaceholder: string;
  payoutBrAgencia: string;
  payoutBrNumeroConta: string;
  payoutBrChavePix: string;
  payoutYourSectionIntl: string;
  payoutIntlMethodPaypal: string;
  payoutIntlMethodWire: string;
  payoutIntlPaypalEmail: string;
  payoutIntlBankName: string;
  payoutIntlIban: string;
  payoutIntlAccountNumber: string;
  payoutIntlWireIbanOrAccountHint: string;
  payoutIntlSwiftBic: string;
  payoutIntlAccountHolder: string;
  payoutIntlCountry: string;
  payoutSave: string;
  payoutSaving: string;
  payoutSaved: string;
  payoutErrorNetwork: string;
  payoutErrorBrRequired: string;
  payoutErrorBrPayment: string;
  payoutErrorBrBankIncomplete: string;
  payoutErrorIntlWire: string;
  payoutErrorIntlWireIbanBoth: string;
  payoutErrorCnpj: string;
  payoutErrorEmail: string;
  payoutErrorIntlMethod: string;
};

function isLooseIntlPaypalEmail(raw: string): boolean {
  const s = raw.trim();
  return s.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Reparte valor legado único: IBAN (formato típico) vs número de conta. */
function splitStoredAccountOrIban(raw: string | null | undefined): {
  iban: string;
  accountNumber: string;
} {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { iban: "", accountNumber: "" };
  const compact = trimmed.replace(/\s+/g, "");
  const upper = compact.toUpperCase();
  if (
    /^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(upper) &&
    compact.length >= 15 &&
    compact.length <= 34
  ) {
    return { iban: trimmed, accountNumber: "" };
  }
  return { iban: "", accountNumber: trimmed };
}

function isIntlWireComplete(intl: {
  bankName: string;
  iban: string;
  accountNumber: string;
  swiftBic: string;
  accountHolderName: string;
  country: string;
}): boolean {
  const ib = intl.iban.trim();
  const acc = intl.accountNumber.trim();
  if (ib.length > 0 && acc.length > 0) return false;
  return (
    intl.bankName.trim().length > 0 &&
    (ib.length > 0 || acc.length > 0) &&
    intl.swiftBic.trim().length > 0 &&
    intl.accountHolderName.trim().length > 0 &&
    intl.country.trim().length > 0
  );
}

function formatCnpjBr(digits: string): string {
  const d = normalizeCnpjDigits(digits);
  if (!d) return "";
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function buildBrState(
  profile: AffiliatePayoutProfileInitial,
  prefill: { razaoSocial: string; cnpjDigits: string | null }
) {
  return {
    razaoSocial: profile?.brRazaoSocial ?? prefill.razaoSocial ?? "",
    cnpjDigits: profile?.brCnpjDigits ?? prefill.cnpjDigits ?? "",
    banco: profile?.brBanco ?? "",
    tipoConta: profile?.brTipoConta === "poupanca" ? "poupanca" : profile?.brTipoConta === "corrente" ? "corrente" : "",
    agencia: profile?.brAgencia ?? "",
    numeroConta: profile?.brNumeroConta ?? "",
    chavePix: profile?.brChavePix ?? "",
  };
}

function inferBrPaymentMode(profile: AffiliatePayoutProfileInitial): "pix" | "bank" {
  const pix = (profile?.brChavePix ?? "").trim().length > 0;
  const tipoOk = profile?.brTipoConta === "corrente" || profile?.brTipoConta === "poupanca";
  const fullBank = !!(
    (profile?.brBanco ?? "").trim() &&
    (profile?.brAgencia ?? "").trim() &&
    (profile?.brNumeroConta ?? "").trim() &&
    tipoOk
  );
  if (fullBank && !pix) return "bank";
  if (pix && !fullBank) return "pix";
  if (pix && fullBank) return "pix";
  return "pix";
}

function buildIntlState(
  profile: AffiliatePayoutProfileInitial,
  _prefill: { email: string }
) {
  /** Só PayPal explícito na BD escolhe PayPal; caso contrário abre em transferência (e-mail PayPal em branco). */
  const method = profile?.intPaymentMethod === "paypal" ? "paypal" : "wire";
  const split = splitStoredAccountOrIban(profile?.intAccountOrIban);
  return {
    paymentMethod: method as "paypal" | "wire",
    paypalEmail: profile?.intPaypalEmail ?? "",
    bankName: profile?.intBankName ?? "",
    iban: split.iban,
    accountNumber: split.accountNumber,
    swiftBic: profile?.intSwiftBic ?? "",
    accountHolderName: profile?.intAccountHolderName ?? "",
    country: profile?.intCountry ?? "",
  };
}

export default function AffiliatePayoutProfileCard({
  lang: _lang,
  unlocked,
  lockedHint,
  initialProfile,
  prefill,
  labels: t,
}: {
  lang: CryptoLang;
  unlocked: boolean;
  lockedHint: string;
  initialProfile: AffiliatePayoutProfileInitial;
  prefill: {
    razaoSocial: string;
    cnpjDigits: string | null;
    email: string;
  };
  labels: Labels;
}) {
  void _lang;
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"br" | "intl">(
    initialProfile?.activeTab === "intl" ? "intl" : "br"
  );

  const [br, setBr] = useState(() => buildBrState(initialProfile, prefill));
  const [brPaymentMode, setBrPaymentMode] = useState<"pix" | "bank">(() =>
    inferBrPaymentMode(initialProfile)
  );
  const [intl, setIntl] = useState(() => buildIntlState(initialProfile, prefill));

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<"saved" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveDisabledIntlIncomplete =
    activeTab === "intl" &&
    (intl.paymentMethod === "paypal"
      ? !isLooseIntlPaypalEmail(intl.paypalEmail)
      : !isIntlWireComplete(intl));

  async function onSave() {
    setNotice(null);
    setError(null);

    if (activeTab === "br") {
      const cnpj = normalizeCnpjDigits(br.cnpjDigits);
      const tipoOk = br.tipoConta === "corrente" || br.tipoConta === "poupanca";
      const anyBank = !!(
        br.banco.trim() ||
        br.agencia.trim() ||
        br.numeroConta.trim() ||
        br.tipoConta
      );
      const bankOk =
        !!(br.banco.trim() && br.agencia.trim() && br.numeroConta.trim() && tipoOk);
      if (!br.razaoSocial.trim()) {
        setError(t.payoutErrorBrRequired);
        return;
      }
      if (cnpj.length !== 14 || !isValidCnpjDigits(cnpj)) {
        setError(t.payoutErrorCnpj);
        return;
      }
      if (brPaymentMode === "pix") {
        if (!br.chavePix.trim()) {
          setError(t.payoutErrorBrPayment);
          return;
        }
      } else {
        if (anyBank && !bankOk) {
          setError(t.payoutErrorBrBankIncomplete);
          return;
        }
        if (!bankOk) {
          setError(t.payoutErrorBrPayment);
          return;
        }
      }
    } else {
      if (intl.paymentMethod === "paypal") {
        if (!isLooseIntlPaypalEmail(intl.paypalEmail)) {
          setError(t.payoutErrorEmail);
          return;
        }
      } else {
        const ib = intl.iban.trim();
        const acc = intl.accountNumber.trim();
        if (ib.length > 0 && acc.length > 0) {
          setError(t.payoutErrorIntlWireIbanBoth);
          return;
        }
        if (!isIntlWireComplete(intl)) {
          setError(t.payoutErrorIntlWire);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`${CRYPTO_BASE_PATH}/api/affiliate/payout-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          activeTab,
          br: {
            razaoSocial: br.razaoSocial,
            cnpjDigits: br.cnpjDigits,
            banco: brPaymentMode === "bank" ? br.banco : "",
            tipoConta: brPaymentMode === "bank" ? br.tipoConta : "",
            agencia: brPaymentMode === "bank" ? br.agencia : "",
            numeroConta: brPaymentMode === "bank" ? br.numeroConta : "",
            chavePix: brPaymentMode === "pix" ? br.chavePix : "",
          },
          intl: {
            paymentMethod: intl.paymentMethod,
            paypalEmail: intl.paypalEmail,
            bankName: intl.bankName,
            iban: intl.iban,
            accountNumber: intl.accountNumber,
            swiftBic: intl.swiftBic,
            accountHolderName: intl.accountHolderName,
            country: intl.country,
          },
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.status === 403 && data.error === "payout_section_locked") {
        setError(lockedHint);
        return;
      }
      if (!res.ok || !data.ok) {
        const code = data.error ?? "";
        const map: Record<string, string> = {
          br_required_fields: t.payoutErrorBrRequired,
          br_invalid_cnpj: t.payoutErrorCnpj,
          br_payment_required: t.payoutErrorBrPayment,
          br_bank_incomplete: t.payoutErrorBrBankIncomplete,
          intl_invalid_method: t.payoutErrorIntlMethod,
          intl_paypal_email: t.payoutErrorEmail,
          intl_wire_required: t.payoutErrorIntlWire,
          intl_wire_iban_both: t.payoutErrorIntlWireIbanBoth,
        };
        setError(map[code] ?? t.payoutErrorNetwork);
        return;
      }
      setNotice("saved");
      window.setTimeout(() => setNotice(null), 3500);
      router.refresh();
    } catch {
      setError(t.payoutErrorNetwork);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-crypto-generator crypto-card relative overflow-hidden">
      <h2 className="text-base font-semibold mb-2 text-zinc-900">{t.payoutCardTitle}</h2>

      {!unlocked ? (
        <div
          className="relative rounded-xl border border-zinc-200 bg-zinc-50/90 px-4 py-10 text-center mt-2"
          role="region"
          aria-label={t.payoutCardTitle}
        >
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/75 backdrop-blur-[6px] px-4"
            aria-hidden
          >
            <svg
              className="h-10 w-10 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <p className="max-w-sm text-sm text-zinc-600 leading-relaxed">{lockedHint}</p>
          </div>
          <div className="select-none blur-md opacity-40" aria-hidden>
            <p className="font-mono text-sm">••••••••</p>
            <p className="mt-2 text-sm">••••••••••••••••</p>
          </div>
        </div>
      ) : (
        <>
      <p className="text-sm text-zinc-600 mb-3 leading-relaxed">{t.payoutCardLead}</p>
      <p
        className="text-xs text-zinc-800 leading-relaxed border-l-2 border-amber-400 bg-amber-50/90 pl-3 py-2 rounded-r-lg mb-4"
        role="note"
      >
        {t.payoutTitularNotice}
      </p>

      <div className="flex gap-2 mb-4 border-b border-zinc-200 pb-px">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "br"}
          onClick={() => setActiveTab("br")}
          className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "br"
              ? "bg-white text-violet-700 border border-b-0 border-zinc-200 -mb-px"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          {t.payoutTabBr}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "intl"}
          onClick={() => setActiveTab("intl")}
          className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "intl"
              ? "bg-white text-violet-700 border border-b-0 border-zinc-200 -mb-px"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          {t.payoutTabIntl}
        </button>
      </div>

      {activeTab === "br" ? (
        <div role="tabpanel" className="space-y-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t.payoutYourSectionBr}</p>
          <label className="block space-y-1">
            <span className="text-zinc-700">{t.razaoSocial}</span>
            <input
              type="text"
              value={br.razaoSocial}
              onChange={(e) => setBr((s) => ({ ...s, razaoSocial: e.target.value }))}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900"
              autoComplete="organization"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-zinc-700">{t.cnpj}</span>
            <input
              type="text"
              inputMode="numeric"
              value={formatCnpjBr(normalizeCnpjDigits(br.cnpjDigits))}
              onChange={(e) =>
                setBr((s) => ({ ...s, cnpjDigits: normalizeCnpjDigits(e.target.value) }))
              }
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-zinc-900"
              placeholder="00.000.000/0001-00"
            />
          </label>

          <fieldset className="space-y-2 pt-1">
            <legend className="text-xs font-medium text-zinc-700">{t.payoutBrReceiveMode}</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-6">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="br-payment-mode"
                  className="h-4 w-4 border-zinc-300 text-violet-600 focus:ring-violet-500"
                  checked={brPaymentMode === "pix"}
                  onChange={() => setBrPaymentMode("pix")}
                />
                <span className="text-zinc-800">{t.payoutBrModePix}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="br-payment-mode"
                  className="h-4 w-4 border-zinc-300 text-violet-600 focus:ring-violet-500"
                  checked={brPaymentMode === "bank"}
                  onChange={() => setBrPaymentMode("bank")}
                />
                <span className="text-zinc-800">{t.payoutBrModeBank}</span>
              </label>
            </div>
          </fieldset>

          <p className="text-xs text-zinc-600 leading-relaxed border-l-2 border-violet-300 pl-3 py-0.5">
            {brPaymentMode === "pix" ? t.payoutBrHintPix : t.payoutBrHintBank}
          </p>

          {brPaymentMode === "pix" ? (
            <label className="block space-y-1">
              <span className="text-zinc-700">{t.payoutBrChavePix}</span>
              <input
                type="text"
                value={br.chavePix}
                onChange={(e) => setBr((s) => ({ ...s, chavePix: e.target.value }))}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900"
                autoComplete="off"
              />
            </label>
          ) : (
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-zinc-700">{t.payoutBrBanco}</span>
                <input
                  type="text"
                  value={br.banco}
                  onChange={(e) => setBr((s) => ({ ...s, banco: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-zinc-700">{t.payoutBrTipoConta}</span>
                <select
                  value={br.tipoConta}
                  onChange={(e) => setBr((s) => ({ ...s, tipoConta: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900"
                >
                  <option value="">{t.payoutBrTipoPlaceholder}</option>
                  <option value="corrente">{t.payoutBrTipoCorrente}</option>
                  <option value="poupanca">{t.payoutBrTipoPoupanca}</option>
                </select>
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-zinc-700">{t.payoutBrAgencia}</span>
                  <input
                    type="text"
                    value={br.agencia}
                    onChange={(e) => setBr((s) => ({ ...s, agencia: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-zinc-700">{t.payoutBrNumeroConta}</span>
                  <input
                    type="text"
                    value={br.numeroConta}
                    onChange={(e) => setBr((s) => ({ ...s, numeroConta: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div role="tabpanel" className="space-y-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t.payoutYourSectionIntl}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIntl((s) => ({ ...s, paymentMethod: "paypal" }))}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                intl.paymentMethod === "paypal"
                  ? "border-violet-600 bg-violet-50 text-violet-800"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
              }`}
            >
              {t.payoutIntlMethodPaypal}
            </button>
            <button
              type="button"
              onClick={() => setIntl((s) => ({ ...s, paymentMethod: "wire" }))}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                intl.paymentMethod === "wire"
                  ? "border-violet-600 bg-violet-50 text-violet-800"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
              }`}
            >
              {t.payoutIntlMethodWire}
            </button>
          </div>

          {intl.paymentMethod === "paypal" ? (
            <label className="block space-y-1">
              <span className="text-zinc-700">{t.payoutIntlPaypalEmail}</span>
              <input
                type="email"
                value={intl.paypalEmail}
                onChange={(e) => setIntl((s) => ({ ...s, paypalEmail: e.target.value }))}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900"
                autoComplete="email"
              />
            </label>
          ) : (
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-zinc-700">{t.payoutIntlAccountHolder}</span>
                <input
                  type="text"
                  value={intl.accountHolderName}
                  onChange={(e) => setIntl((s) => ({ ...s, accountHolderName: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-zinc-700">{t.payoutIntlBankName}</span>
                <input
                  type="text"
                  value={intl.bankName}
                  onChange={(e) => setIntl((s) => ({ ...s, bankName: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-zinc-700">{t.payoutIntlSwiftBic}</span>
                <input
                  type="text"
                  value={intl.swiftBic}
                  onChange={(e) => setIntl((s) => ({ ...s, swiftBic: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-zinc-900"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-zinc-700">{t.payoutIntlCountry}</span>
                <input
                  type="text"
                  value={intl.country}
                  onChange={(e) => setIntl((s) => ({ ...s, country: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900"
                  autoComplete="country-name"
                />
              </label>
              <p className="text-xs text-zinc-600 leading-relaxed border-l-2 border-violet-300 pl-3 py-0.5">
                {t.payoutIntlWireIbanOrAccountHint}
              </p>
              <label className="block space-y-1">
                <span className="text-zinc-700">{t.payoutIntlIban}</span>
                <input
                  type="text"
                  value={intl.iban}
                  onChange={(e) => setIntl((s) => ({ ...s, iban: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-zinc-900"
                  autoComplete="off"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-zinc-700">{t.payoutIntlAccountNumber}</span>
                <input
                  type="text"
                  value={intl.accountNumber}
                  onChange={(e) => setIntl((s) => ({ ...s, accountNumber: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-zinc-900"
                  autoComplete="off"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {notice === "saved" ? (
        <p className="mt-3 text-sm text-emerald-600" role="status">
          {t.payoutSaved}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || saveDisabledIntlIncomplete}
          className="inline-flex items-center justify-center rounded-lg border border-violet-600 bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? t.payoutSaving : t.payoutSave}
        </button>
      </div>
        </>
      )}
    </div>
  );
}
