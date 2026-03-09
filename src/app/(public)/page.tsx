import type { Metadata } from "next";
import BioLandingPage from "@/app/BioLandingPage";
import { getLocaleFromRequest } from "@/lib/get-locale-server";

export const dynamic = "force-dynamic";

const PAGE_META = {
  pt: {
    title: "Crypto | Simulador de Estratégias para Criptomoedas",
    description:
      "Simulador avançado de estratégias para criptomoedas com modelagem estatística aplicada a dados históricos. Teste indicadores técnicos, MACD, RSI e compare com Buy & Hold.",
    keywords:
      "backtest criptomoedas, simulador estratégias, MACD, RSI, médias móveis, Bitcoin, SevenCoins, análise técnica",
  },
  en: {
    title: "Crypto | Crypto Strategy Simulator",
    description:
      "Advanced crypto strategy simulator with statistical modeling applied to historical data. Test technical indicators, MACD, RSI and compare with Buy & Hold.",
    keywords:
      "crypto backtest, strategy simulator, MACD, RSI, moving averages, Bitcoin, SevenCoins, technical analysis",
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
