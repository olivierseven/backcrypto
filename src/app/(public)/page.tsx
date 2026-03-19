import type { Metadata } from "next";
import BioLandingPage from "@/app/BioLandingPage";
import { getLocaleFromRequest } from "@/lib/get-locale-server";

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

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocaleFromRequest();
  const t = PAGE_META[lang];
  return {
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${BASE_URL}${BASE_PATH}/`,
      languages: {
        "pt-BR": `${BASE_URL}${BASE_PATH}/`,
        en: `${BASE_URL}${BASE_PATH}/?lang=en`,
        "x-default": `${BASE_URL}${BASE_PATH}/`,
      },
    },
    openGraph: {
      type: "website",
      title: t.title,
      description: t.description,
      url: `${BASE_URL}${BASE_PATH}/`,
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

export default function HomePage() {
  return <BioLandingPage />;
}
