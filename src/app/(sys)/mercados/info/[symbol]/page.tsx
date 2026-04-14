import type { Metadata } from "next";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";
import { requireSysUserId } from "@/app/(sys)/require-sys-user";
import CoinInfoClient from "./CoinInfoClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const s = (symbol ?? "").toUpperCase();
  return {
    title: s ? `${s} · Info | Crypto` : "Info | Crypto",
    description: "CoinGecko: market data and general info.",
    robots: { index: false, follow: false },
  };
}

export default async function MercadosCoinInfoPage({ params }: Props) {
  const { symbol } = await params;
  const path = `${APP_CRYPTO_ROUTE_PREFIX}/mercados/info/${(symbol ?? "").toLowerCase()}`;
  await requireSysUserId(path);

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col">
      <CoinInfoClient symbolParam={symbol ?? ""} />
    </div>
  );
}
