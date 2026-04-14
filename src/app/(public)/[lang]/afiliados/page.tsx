import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BioAfiliadosPage from "@/app/(public)/afiliados/BioAfiliadosPage";
import type { Locale } from "@/lib/get-locale-server";

export const dynamic = "force-dynamic";
const BASE_PATH = "/crypto";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sevencoins.com.br";

const PAGE_META = {
  pt: {
    title: "Programa de Afiliados — CryptoStrategy | SevenCoins",
    description:
      "Ganhe comissões promovendo o CryptoStrategy. Cupom exclusivo, painel de afiliado e comissões sobre vendas confirmadas.",
    keywords: "afiliados, CryptoStrategy, SevenCoins, comissões, parcerias",
  },
  en: {
    title: "Affiliate Program — CryptoStrategy | SevenCoins",
    description:
      "Earn commissions promoting CryptoStrategy. Exclusive coupon, affiliate dashboard and commissions on confirmed sales.",
    keywords: "affiliates, CryptoStrategy, SevenCoins, commissions, partnerships",
  },
} as const;

type Props = { params: Promise<{ lang: string }> };

function assertLocale(lang: string): Locale {
  if (lang === "en" || lang === "pt") return lang;
  notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  assertLocale(raw);
  const lang = raw as Locale;
  const t = PAGE_META[lang];
  const path = `${BASE_PATH}/${lang}/afiliados`;
  return {
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${BASE_URL}${path}`,
      languages: {
        "pt-BR": `${BASE_URL}${BASE_PATH}/pt/afiliados`,
        en: `${BASE_URL}${BASE_PATH}/en/afiliados`,
        "x-default": `${BASE_URL}${BASE_PATH}/pt/afiliados`,
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

export default async function LangAfiliadosPage({ params }: Props) {
  const { lang: raw } = await params;
  const lang = assertLocale(raw);
  return <BioAfiliadosPage initialLocale={lang} />;
}
