import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getCryptoT } from "@/app/lib/translations";
import AffiliatePainelShell from "./AffiliatePainelShell";
import {
  AFFILIATE_JWT_COOKIE_NAME,
  CRYPTO_AFFILIATE_LOGIN_PAGE,
  CRYPTO_AFFILIATE_PAINEL_PAGE,
} from "@/lib/crypto-auth-next";
import { getLocaleFromRequest } from "@/lib/get-locale-server";
import { isAffiliateAccountingAdminEmail } from "@/lib/affiliate-accounting-admin";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE_PATH = "/crypto";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sevencoins.com.br";

const COOKIE = AFFILIATE_JWT_COOKIE_NAME;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const PAGE_META = {
  pt: {
    title: "Painel do afiliado | Crypto Strategy",
    description: "Painel de afiliados Crypto Strategy (SevenCoins).",
  },
  en: {
    title: "Affiliate panel | Crypto Strategy",
    description: "Crypto Strategy (SevenCoins) affiliate panel.",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocaleFromRequest();
  const t = PAGE_META[lang];
  return {
    title: t.title,
    description: t.description,
    robots: { index: false, follow: false },
    alternates: {
      canonical: `${BASE_URL}${CRYPTO_AFFILIATE_PAINEL_PAGE}`,
    },
  };
}

export default async function AfiliadosPainelPage() {
  const lang = await getLocaleFromRequest();
  const t = getCryptoT(lang).landing.affiliatesPainel;

  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) {
    redirect(
      `${CRYPTO_AFFILIATE_LOGIN_PAGE}?lang=${lang}&next=${encodeURIComponent(CRYPTO_AFFILIATE_PAINEL_PAGE)}`
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

  const logoutHref = `${BASE_PATH}/api/auth/afiliados/logout`;
  const showAccountingNav = await isAffiliateAccountingAdminEmail(email);

  return (
    <AffiliatePainelShell
      lang={lang}
      title={t.title}
      email={email}
      signedInAs={t.signedInAs}
      logoutHref={logoutHref}
      logoutLabel={t.logout}
      showAccountingNav={showAccountingNav}
    />
  );
}
