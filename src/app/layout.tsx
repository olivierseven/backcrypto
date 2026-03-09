import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getLocaleFromRequest } from "@/lib/get-locale-server";
import { AppBarSafeProvider } from "./AppBarSafeContext";
import StatusBarPref from "./StatusBarPref";

const BASE_PATH = "/crypto";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sevencoins.com.br";

const ROOT_META = {
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

const SHARED_META: Metadata = {
  metadataBase: new URL(BASE_URL),
  robots: { index: false, follow: false },
  manifest: `${BASE_PATH}/manifest.json`,
  icons: {
    icon: [
      { url: `${BASE_PATH}/icon.svg`, type: "image/svg+xml" },
      { url: `${BASE_PATH}/favicon.ico`, sizes: "any" },
    ],
    apple: { url: `${BASE_PATH}/apple-icon.png`, type: "image/png" },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Crypto",
  },
  openGraph: {
    siteName: "Crypto",
    type: "website",
    images: [{ url: `${BASE_PATH}/icon.png` }],
  },
  twitter: {
    card: "summary_large_image",
    images: [`${BASE_PATH}/bio_banner_x.png`],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocaleFromRequest();
  const t = ROOT_META[lang];

  return {
    ...SHARED_META,
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    openGraph: {
      ...SHARED_META.openGraph,
      title: t.title,
      description: t.description,
    },
    twitter: {
      ...SHARED_META.twitter,
      title: t.title,
      description: t.description,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await getLocaleFromRequest();
  const ptHref = `${BASE_URL}${BASE_PATH}/`;
  const enHref = `${BASE_URL}${BASE_PATH}/?lang=en`;

  return (
    <html lang={lang === "pt" ? "pt-BR" : "en"}>
      <head>
        {/* hreflang: pt-BR padrão, en = ?lang=en */}
        <link rel="alternate" hrefLang="pt-BR" href={ptHref} />
        <link rel="alternate" hrefLang="en" href={enHref} />
        <link rel="alternate" hrefLang="x-default" href={ptHref} />

        {/* Schema.org SoftwareApplication (structured data) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Crypto",
              applicationCategory: "EducationalApplication",
              operatingSystem: "Web",
              description: ROOT_META[lang].description,
              url: `${BASE_URL}${BASE_PATH}/`,
              publisher: {
                "@type": "Organization",
                name: "SevenCoins",
                url: "https://sevencoins.com.br",
              },
              sameAs: [
                "https://play.google.com/store/apps/details?id=com.sevencoins.biogenerator",
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-dvh bg-gradient-to-br from-zinc-300 to-zinc-600 text-zinc-900 antialiased">
        <main className="w-full px-0 py-0">
          <AppBarSafeProvider>
            <StatusBarPref />
            <div data-app="crypto" className="crypto-generator-app min-h-screen text-zinc-900">
              {children}
            </div>
          </AppBarSafeProvider>
        </main>
      </body>
    </html>
  );
}
