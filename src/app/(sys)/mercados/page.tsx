import type { Metadata } from "next";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";
import { requireSysUserId } from "../require-sys-user";
import MercadosPageClient from "./MercadosPageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mercados | Crypto",
  description: "Lista 1m vs fechamento diário em cache.",
  robots: { index: false, follow: false },
};

export default async function MercadosPage() {
  await requireSysUserId(`${APP_CRYPTO_ROUTE_PREFIX}/mercados`);

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col">
      <MercadosPageClient />
    </div>
  );
}
