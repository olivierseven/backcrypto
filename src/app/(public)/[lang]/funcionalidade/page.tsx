import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BioFuncionalidadePage from "@/app/(public)/funcionalidade/BioFuncionalidadePage";
import type { Locale } from "@/lib/get-locale-server";

export const dynamic = "force-dynamic";
const BASE_PATH = "/crypto";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sevencoins.com.br";

const PAGE_META = {
  pt: {
    title: "Funcionalidades | Crypto",
    description:
      "Conheça as funcionalidades do Crypto Strategy: construtor de estratégias, indicadores técnicos, sinais no gráfico e backtest com dados históricos.",
    keywords:
      "crypto strategy, funcionalidades, construtor de estratégias, indicadores técnicos, sinais, backtest, SevenCoins",
  },
  en: {
    title: "Features | Crypto",
    description:
      "Discover Crypto Strategy features: strategy builder, technical indicators, chart signals and historical backtesting.",
    keywords:
      "crypto strategy, features, strategy builder, technical indicators, chart signals, backtesting, SevenCoins",
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
  const path = `${BASE_PATH}/${lang}/funcionalidade`;
  return {
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${BASE_URL}${path}`,
      languages: {
        "pt-BR": `${BASE_URL}${BASE_PATH}/pt/funcionalidade`,
        en: `${BASE_URL}${BASE_PATH}/en/funcionalidade`,
        "x-default": `${BASE_URL}${BASE_PATH}/pt/funcionalidade`,
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

export default async function LangFuncionalidadePage({ params }: Props) {
  const { lang: raw } = await params;
  const lang = assertLocale(raw);
  return <BioFuncionalidadePage initialLocale={lang} />;
}
