import { redirect } from "next/navigation";
import { CRYPTO_AFFILIATE_PAINEL_PAGE } from "@/lib/crypto-auth-next";

type Props = { params: Promise<{ lang: string }> };

/** URL canónica: `/crypto/afiliados/painel` (ver `(sys)/afiliados/painel`). */
export default async function AfiliadosPainelLegacyRedirect({ params }: Props) {
  const { lang: raw } = await params;
  const l = raw === "en" ? "en" : "pt";
  redirect(`${CRYPTO_AFFILIATE_PAINEL_PAGE}?lang=${l}`);
}
