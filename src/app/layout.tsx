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
    title: "Crypto Strategy | Construtor de Estratégias para Criptomoedas",
    description:
      "Crie e combine estratégias com um construtor visual baseado em regras: indicadores técnicos, condições de mercado e sinais no gráfico usando dados históricos. Explore vários ativos e cenários — simulação educacional, sem execução de ordens.",
    keywords:
      "construtor de estratégias cripto, crypto strategy builder, regras de trading, indicadores técnicos, sinais no gráfico, Bitcoin, Ethereum, SevenCoins, análise técnica",
  },
  en: {
    title: "Crypto Strategy | Visual Strategy Builder for Crypto",
    description:
      "Build and combine strategies with a visual, rule-based builder: technical indicators, market conditions and on-chart signals using historical data. Explore multiple assets and scenarios — educational simulation, no order execution.",
    keywords:
      "crypto strategy builder, visual rule builder, trading rules, technical indicators, chart signals, Bitcoin, Ethereum, SevenCoins, technical analysis",
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
    title: "Crypto Strategy",
  },
  openGraph: {
    siteName: "Crypto Strategy",
    type: "website",
    images: [{ url: `${BASE_PATH}/crypto_banner_x.png` }],
  },
  twitter: {
    card: "summary_large_image",
    images: [`${BASE_PATH}/crypto_banner_x.png`],
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
  const ptHref = `${BASE_URL}${BASE_PATH}/pt`;
  const enHref = `${BASE_URL}${BASE_PATH}/en`;

  return (
    <html lang={lang === "pt" ? "pt-BR" : "en"}>
      <head>
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
              name: "Crypto Strategy",
              applicationCategory: "EducationalApplication",
              operatingSystem: "Web",
              description: ROOT_META[lang].description,
              url: `${BASE_URL}${BASE_PATH}/pt`,
              publisher: {
                "@type": "Organization",
                name: "SevenCoins",
                url: "https://sevencoins.com.br",
              },
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
