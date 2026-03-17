import type { Metadata } from "next";
import BioLandingPage from "@/app/BioLandingPage";
import { getLocaleFromRequest } from "@/lib/get-locale-server";

export const dynamic = "force-dynamic";

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
  };
}

export default function HomePage() {
  return <BioLandingPage />;
}
