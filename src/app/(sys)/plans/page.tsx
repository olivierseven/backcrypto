import type { Metadata } from "next";
import { cryptoPrisma } from "@/lib/crypto-db";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";
import CryptoPlansClient from "./CryptoPlansClient";
import { requireSysUserId } from "../require-sys-user";

export const metadata: Metadata = {
  title: "Planos | Crypto",
  description: "Compre coins para o Crypto.",
};

export const dynamic = "force-dynamic";

export default async function CryptoPlansPage() {
  const userId = await requireSysUserId(`${APP_CRYPTO_ROUTE_PREFIX}/plans`);

  const user = await cryptoPrisma.user.findUnique({
    where: { id: userId },
    select: { language: true },
  });
  const lang = (user?.language ?? "en") as "en" | "pt";

  return (
    <main className="crypto-conta-page relative overflow-hidden min-h-screen flex flex-col items-center">
      <div className="crypto-conta-wrap relative mx-auto w-full max-w-2xl flex-1 px-6 py-0 sm:px-8">
        <div className="w-full">
          <CryptoPlansClient lang={lang} />
        </div>
      </div>
    </main>
  );
}
