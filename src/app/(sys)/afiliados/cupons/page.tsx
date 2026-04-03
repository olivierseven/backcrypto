import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getCryptoT } from "@/app/lib/translations";
import {
  AFFILIATE_JWT_COOKIE_NAME,
  CRYPTO_AFFILIATE_CUPONS_PAGE,
  CRYPTO_AFFILIATE_LOGIN_PAGE,
} from "@/lib/crypto-auth-next";
import { getLocaleFromRequest } from "@/lib/get-locale-server";
import { isAffiliateAccountingAdminEmail } from "@/lib/affiliate-accounting-admin";
import AffiliateCuponsShell from "./AffiliateCuponsShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE_PATH = "/crypto";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sevencoins.com.br";

const COOKIE = AFFILIATE_JWT_COOKIE_NAME;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const PAGE_META = {
  pt: {
    title: "Meus cupons | Crypto Strategy",
    description: "Histórico de cupons do programa de afiliados.",
  },
  en: {
    title: "My coupons | Crypto Strategy",
    description: "Affiliate program coupon history.",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocaleFromRequest();
  const m = PAGE_META[lang];
  return {
    title: m.title,
    description: m.description,
    robots: { index: false, follow: false },
    alternates: {
      canonical: `${BASE_URL}${CRYPTO_AFFILIATE_CUPONS_PAGE}`,
    },
  };
}

export default async function AfiliadosCuponsPage() {
  const lang = await getLocaleFromRequest();
  const tp = getCryptoT(lang).landing.affiliatesPainel;
  const tc = getCryptoT(lang).landing.affiliatesConta;

  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) {
    redirect(
      `${CRYPTO_AFFILIATE_LOGIN_PAGE}?lang=${lang}&next=${encodeURIComponent(CRYPTO_AFFILIATE_CUPONS_PAGE)}`
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
    <AffiliateCuponsShell
      lang={lang}
      title={tp.cuponsPageTitle}
      historyLead={tp.cuponsHistoryLead}
      email={email}
      signedInAs={tp.signedInAs}
      logoutHref={logoutHref}
      logoutLabel={tp.logout}
      backToPanelLabel={tc.backToPanel}
      showAccountingNav={showAccountingNav}
    />
  );
}
