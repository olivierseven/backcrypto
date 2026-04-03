import { redirect } from "next/navigation";
import { CRYPTO_AFFILIATE_ESTATISTICAS_PAGE } from "@/lib/crypto-auth-next";

type Props = { params: Promise<{ lang: string }> };

/** URL canónica: `/crypto/afiliados/estatisticas` (ver `(sys)/afiliados/estatisticas`). */
export default async function AfiliadosEstatisticasLegacyRedirect({ params }: Props) {
  const { lang: raw } = await params;
  const l = raw === "en" ? "en" : "pt";
  redirect(`${CRYPTO_AFFILIATE_ESTATISTICAS_PAGE}?lang=${l}`);
}
