/**
 * Dados da empresa tomadora para emissão de NF / cobrança (afiliados).
 * Sobrescrever via env em deploy se necessário (valores default = SevenCoins / Crypto Strategy).
 */
export type AffiliateBillingCompany = {
  cnpjFormatted: string;
  razaoSocial: string;
  /** E-mail fiscal/financeiro da tomadora (aparece na NF / invoice). */
  fiscalEmail: string;
  cepFormatted: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
};

const DEFAULT: AffiliateBillingCompany = {
  cnpjFormatted: "63.778.661/0001-62",
  razaoSocial: "OLIVIER ORQUIZA DESENVOLVIMENTO DE SOFTWARE LTDA",
  fiscalEmail: "financeiro@sevencoins.com.br",
  cepFormatted: "05424-150",
  logradouro: "RUA PAIS LEME",
  numero: "215",
  complemento: "CONJ 1713",
  bairro: "PINHEIROS",
  municipio: "São Paulo",
  uf: "SP",
};

function trimOr<T extends string | undefined>(v: T, fallback: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s || fallback;
}

/** Lê `NEXT_PUBLIC_AFFILIATE_BILLING_*` quando definidos. */
export function getAffiliateBillingCompany(): AffiliateBillingCompany {
  return {
    cnpjFormatted: trimOr(process.env.NEXT_PUBLIC_AFFILIATE_BILLING_CNPJ, DEFAULT.cnpjFormatted),
    razaoSocial: trimOr(process.env.NEXT_PUBLIC_AFFILIATE_BILLING_RAZAO_SOCIAL, DEFAULT.razaoSocial),
    fiscalEmail: trimOr(process.env.NEXT_PUBLIC_AFFILIATE_BILLING_FISCAL_EMAIL, DEFAULT.fiscalEmail),
    cepFormatted: trimOr(process.env.NEXT_PUBLIC_AFFILIATE_BILLING_CEP, DEFAULT.cepFormatted),
    logradouro: trimOr(process.env.NEXT_PUBLIC_AFFILIATE_BILLING_LOGRADOURO, DEFAULT.logradouro),
    numero: trimOr(process.env.NEXT_PUBLIC_AFFILIATE_BILLING_NUMERO, DEFAULT.numero),
    complemento: trimOr(process.env.NEXT_PUBLIC_AFFILIATE_BILLING_COMPLEMENTO, DEFAULT.complemento),
    bairro: trimOr(process.env.NEXT_PUBLIC_AFFILIATE_BILLING_BAIRRO, DEFAULT.bairro),
    municipio: trimOr(process.env.NEXT_PUBLIC_AFFILIATE_BILLING_MUNICIPIO, DEFAULT.municipio),
    uf: trimOr(process.env.NEXT_PUBLIC_AFFILIATE_BILLING_UF, DEFAULT.uf),
  };
}

/** Uma linha legível com endereço completo (NF / invoice internacional). */
export function formatAffiliateBillingAddressOneLine(b: AffiliateBillingCompany): string {
  const line = [
    `${b.logradouro}, ${b.numero}`,
    b.complemento.trim() ? b.complemento : null,
    b.bairro,
    `${b.municipio}, ${b.uf}`,
    `CEP ${b.cepFormatted}`,
    "Brazil",
  ]
    .filter((x): x is string => Boolean(x && String(x).trim()));
  return line.join(" — ");
}
