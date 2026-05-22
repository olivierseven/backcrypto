// backcrypto/sistema — conteúdo do gráfico (layout (sys) fornece header + shell)
import { redirect } from "next/navigation";
import { cryptoPrisma } from "@/lib/crypto-db";
import KlinesTable from "./KlinesTable";
import { APP_CRYPTO_ROUTE_PREFIX, APP_CRYPTO_SISTEMA_PATH } from "@/app/constants";
import { requireSysUserId } from "../require-sys-user";
import { syncUserTierAndIsFree } from "@/lib/user-tier";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BackcryptoSistemaPage() {
  const userId = await requireSysUserId(APP_CRYPTO_SISTEMA_PATH);

  const user = await cryptoPrisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user) redirect(`${APP_CRYPTO_ROUTE_PREFIX}/login`);
  const isAdmin = user.role === "admin";
  const { isFreeUser } = await syncUserTierAndIsFree(userId);

  return (
    <div className="flex-1 min-h-0 w-full">
      <KlinesTable isAdmin={isAdmin} isFreeUser={isFreeUser} />
    </div>
  );
}
