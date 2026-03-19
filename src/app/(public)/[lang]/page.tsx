import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BioLandingPage from "@/app/BioLandingPage";
import type { Locale } from "@/lib/get-locale-server";

export const dynamic = "force-dynamic";
const BASE_PATH = "/crypto";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sevencoins.com.br";

const PAGE_META = {
  pt: {
    title: "Crypto Strategy | Criador de Estratégias de Trading",
    description:
      "Crie, combine e teste estratégias de trading diretamente no gráfico. Utilize indicadores técnicos, regras de entrada e saída e dados reais do mercado — sem precisar programar.",
    keywords:
      "estratégias trading, strategy builder, indicadores técnicos, RSI, MACD, médias móveis, análise gráfica, criptomoedas, SevenCoins",
  },
  en: {
    title: "Crypto Strategy | Trading Strategy Builder",
    description:
      "Create, combine and test trading strategies directly on the chart. Use technical indicators, entry and exit rules, and real market data — no coding required.",
    keywords:
      "trading strategies, strategy builder, technical indicators, RSI, MACD, moving averages, crypto analysis, SevenCoins",
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
  const path = `${BASE_PATH}/${lang}`;
  return {
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${BASE_URL}${path}`,
      languages: {
        "pt-BR": `${BASE_URL}${BASE_PATH}/pt`,
        en: `${BASE_URL}${BASE_PATH}/en`,
        "x-default": `${BASE_URL}${BASE_PATH}/pt`,
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

export default async function LangHomePage({ params }: Props) {
  const { lang: raw } = await params;
  const lang = assertLocale(raw);
  return <BioLandingPage initialLocale={lang} />;
}
