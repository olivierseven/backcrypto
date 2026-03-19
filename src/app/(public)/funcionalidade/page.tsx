import type { Metadata } from "next";
import BioFuncionalidadePage from "./BioFuncionalidadePage";
import { getLocaleFromRequest } from "@/lib/get-locale-server";

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

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocaleFromRequest();
  const t = PAGE_META[lang];
  return {
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${BASE_URL}${BASE_PATH}/funcionalidade`,
      languages: {
        "pt-BR": `${BASE_URL}${BASE_PATH}/funcionalidade`,
        en: `${BASE_URL}${BASE_PATH}/funcionalidade?lang=en`,
        "x-default": `${BASE_URL}${BASE_PATH}/funcionalidade`,
      },
    },
    openGraph: {
      type: "website",
      title: t.title,
      description: t.description,
      url: `${BASE_URL}${BASE_PATH}/funcionalidade`,
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

export default function FuncionalidadePage() {
  return <BioFuncionalidadePage />;
}
