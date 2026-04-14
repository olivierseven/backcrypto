import { isValidCnpjDigits, normalizeCnpjDigits } from "@/lib/cnpj";

function isLooseEmail(s: string): boolean {
  const t = s.trim();
  return t.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/** Campos necessários para espelhar a validação de `PUT /api/affiliate/payout-profile`. */
export type AffiliatePayoutProfileLike = {
  activeTab: string | null;
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
};

/**
 * Indica se o afiliado tem dados de recebimento válidos para a aba atual (`activeTab`),
 * conforme gravado em `AffiliatePayoutProfile`.
 */
export function isAffiliatePayoutProfilePaymentComplete(
  profile: AffiliatePayoutProfileLike | null | undefined,
): boolean {
  if (!profile) return false;
  const tab = (profile.activeTab ?? "br").trim().toLowerCase();
  if (tab === "intl") {
    const method = (profile.intPaymentMethod ?? "").trim().toLowerCase();
    if (method === "paypal") {
      const e = (profile.intPaypalEmail ?? "").trim();
      return e.length > 0 && isLooseEmail(e);
    }
    if (method === "wire") {
      const acc = (profile.intAccountOrIban ?? "").trim();
      return !!(
        (profile.intBankName ?? "").trim() &&
        (profile.intSwiftBic ?? "").trim() &&
        (profile.intAccountHolderName ?? "").trim() &&
        (profile.intCountry ?? "").trim() &&
        acc
      );
    }
    return false;
  }
  const razao = (profile.brRazaoSocial ?? "").trim();
  const cnpj = normalizeCnpjDigits(profile.brCnpjDigits ?? "");
  if (!razao || cnpj.length !== 14 || !isValidCnpjDigits(cnpj)) return false;
  const chavePix = (profile.brChavePix ?? "").trim();
  const tipo = (profile.brTipoConta ?? "").trim().toLowerCase();
  const tipoOk = tipo === "corrente" || tipo === "poupanca";
  const fullBank = !!(
    (profile.brBanco ?? "").trim() &&
    (profile.brAgencia ?? "").trim() &&
    (profile.brNumeroConta ?? "").trim() &&
    tipoOk
  );
  const hasPix = chavePix.length > 0;
  return hasPix || fullBank;
}
