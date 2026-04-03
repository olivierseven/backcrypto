import { redirect } from "next/navigation";
import { CRYPTO_AFFILIATE_CONTABILIDADE_PAGE } from "@/lib/crypto-auth-next";

type Props = { params: Promise<{ lang: string }> };

/** URL canónica: `/crypto/afiliados/contabilidade` (ver `(sys)/afiliados/contabilidade`). */
export default async function AfiliadosContabilidadeLegacyRedirect({ params }: Props) {
  const { lang: raw } = await params;
  const l = raw === "en" ? "en" : "pt";
  redirect(`${CRYPTO_AFFILIATE_CONTABILIDADE_PAGE}?lang=${l}`);
}
