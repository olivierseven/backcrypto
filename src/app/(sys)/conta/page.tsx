import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cryptoPrisma } from "@/lib/crypto-db";
import { decryptEmail } from "@/lib/crypto";
import BioContaClient from "./ContaClient";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";
import { requireSysUserId } from "../require-sys-user";

export const metadata: Metadata = {
  title: "Minha Conta | Crypto",
  description: "Gerencie suas informações e preferências.",
};

export const dynamic = "force-dynamic";

export default async function BioContaPage() {
  const userId = await requireSysUserId(`${APP_CRYPTO_ROUTE_PREFIX}/conta`);

  const user = await cryptoPrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      nickname: true,
      nicknameChanges: true,
      avatarId: true,
      emailEnc: true,
      emailIv: true,
      emailTag: true,
      emailVerifiedAt: true,
      role: true,
      tier: true,
      createdAt: true,
      hideStatusBar: true,
      language: true,
      timezoneOffset: true,
    },
  });

  if (!user) redirect(`${APP_CRYPTO_ROUTE_PREFIX}/login`);

  const wallet = await cryptoPrisma.userCoinWallet.findUnique({
    where: { userId },
    select: { balance: true },
  });
  const coinsBalance = wallet?.balance ?? 0;

  let email: string | null = null;
  try {
    email = decryptEmail(user.emailEnc, user.emailIv, user.emailTag);
  } catch {
    // ignore
  }

  return (
    <main className="crypto-conta-page relative overflow-hidden min-h-screen flex flex-col items-center">
      <div className="crypto-conta-wrap relative mx-auto w-full max-w-2xl flex-1 px-0 py-0 sm:px-6 md:px-8">
        <div className="w-full">
          <BioContaClient
            user={user}
            email={email}
            coinsBalance={coinsBalance}
            hideStatusBar={user.hideStatusBar}
            language={user.language ?? "en"}
            timezoneOffset={(user as { timezoneOffset?: number }).timezoneOffset ?? 0}
          />
        </div>
      </div>
    </main>
  );
}
