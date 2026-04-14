import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { jwtVerify } from "jose";
import BioAffiliateLoginForm from "@/app/BioAffiliateLoginForm";
import BioMaintenanceView from "@/app/BioMaintenanceView";
import { getRedirectOriginFromHeaders } from "@/lib/redirect-origin";
import {
  getBypassCookieName,
  verifyBypassCookie,
  isBypassConfigured,
} from "@/lib/maintenance-bypass";
import {
  AFFILIATE_JWT_COOKIE_NAME,
  safeAffiliateNext,
  CRYPTO_AFFILIATE_LOGIN_PAGE,
} from "@/lib/crypto-auth-next";
import { getLocaleForAffiliateLoginPage } from "@/lib/get-locale-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE_PATH = "/crypto";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sevencoins.com.br";

const COOKIE = AFFILIATE_JWT_COOKIE_NAME;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const PAGE_META = {
  pt: {
    title: "Login de afiliado | Crypto Strategy",
    description: "Acesso ao painel de afiliados Crypto Strategy (SevenCoins).",
    keywords: "afiliados, login, crypto strategy, SevenCoins",
  },
  en: {
    title: "Affiliate Login | Crypto Strategy",
    description: "Crypto Strategy (SevenCoins) affiliate panel login.",
    keywords: "affiliates, login, crypto strategy, SevenCoins",
  },
} as const;

type Props = {
  searchParams: Promise<{ next?: string; lang?: string }>;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const lang = await getLocaleForAffiliateLoginPage(sp);
  const t = PAGE_META[lang];
  const path = CRYPTO_AFFILIATE_LOGIN_PAGE;
  return {
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${BASE_URL}${path}`,
      languages: {
        "pt-BR": `${BASE_URL}${path}`,
        en: `${BASE_URL}${path}`,
        "x-default": `${BASE_URL}${path}`,
      },
    },
    openGraph: {
      type: "website",
      title: t.title,
      description: t.description,
      url: `${BASE_URL}${path}`,
      images: [{ url: `${BASE_PATH}/crypto_banner_x.png` }],
    },
    twitter: {
      card: "summary_large_image",
      title: t.title,
      description: t.description,
      images: [`${BASE_PATH}/crypto_banner_x.png`],
    },
  };
}

export default async function AfiliadosLoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const lang = await getLocaleForAffiliateLoginPage(sp);
  const nextPath = safeAffiliateNext(sp?.next, lang);
  const loginPagePath = CRYPTO_AFFILIATE_LOGIN_PAGE;

  const store = await cookies();
  const token = store.get(COOKIE)?.value;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      if (payload.affiliate === true) {
        const headersList = await headers();
        const origin = getRedirectOriginFromHeaders(headersList);
        const target = origin ? `${origin}${nextPath}` : nextPath;
        redirect(target);
      }
    } catch {
      /* token inválido → exibe login */
    }
  }

  if (process.env.SITE_MAINTENANCE === "1") {
    const bypassCookie = store.get(getBypassCookieName())?.value;
    if (!verifyBypassCookie(bypassCookie)) {
      return (
        <Suspense
          fallback={<div className="flex min-h-screen items-center justify-center text-zinc-600">Loading...</div>}
        >
          <BioMaintenanceView showBypassForm={isBypassConfigured()} />
        </Suspense>
      );
    }
  }

  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center text-zinc-600">Loading...</div>}
    >
      <BioAffiliateLoginForm lang={lang} nextPath={nextPath} loginPagePath={loginPagePath} />
    </Suspense>
  );
}
