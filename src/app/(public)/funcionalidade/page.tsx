import type { Metadata } from "next";
import BioFuncionalidadePage from "./BioFuncionalidadePage";
import { getLocaleFromRequest } from "@/lib/get-locale-server";

export const dynamic = "force-dynamic";

const PAGE_META = {
  pt: {
    title: "Funcionalidades | Crypto",
    description:
      "Conheça as funcionalidades do Crypto: menu lateral, exibição de gráficos, mapa interativo e gráficos de análise.",
    keywords:
      "Crypto, funcionalidades, simulador populacional, painéis de configuração, gráficos de análise, SevenCoins",
  },
  en: {
    title: "Features | Crypto",
    description:
      "Discover Crypto features: sidebar menu, chart display, interactive map and analysis charts.",
    keywords:
      "Crypto, features, population simulator, configuration panels, analysis charts, SevenCoins",
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

export default function FuncionalidadePage() {
  return <BioFuncionalidadePage />;
}
