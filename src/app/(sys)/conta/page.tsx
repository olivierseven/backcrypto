import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cryptoPrisma } from "@/lib/crypto-db";
import { jwtVerify } from "jose";
import { decryptEmail } from "@/lib/crypto";
import BioContaClient from "./ContaClient";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";
import { getRedirectOriginFromHeaders } from "@/lib/redirect-origin";

export const metadata: Metadata = {
  title: "Minha Conta | Crypto",
  description: "Gerencie suas informações e preferências.",
};

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export const dynamic = "force-dynamic";

export default async function BioContaPage() {
  const headersList = await headers();
  const origin = getRedirectOriginFromHeaders(headersList);
  const loginUrl = origin ? `${origin}${APP_CRYPTO_ROUTE_PREFIX}/login` : `${APP_CRYPTO_ROUTE_PREFIX}/login`;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) redirect(`${loginUrl}?next=${APP_CRYPTO_ROUTE_PREFIX}/conta`);

  let payload: { sub?: string };
  try {
    const result = await jwtVerify(token, JWT_SECRET);
    payload = result.payload as { sub?: string };
  } catch {
    redirect(loginUrl);
  }

  const userId = typeof payload?.sub === "string" ? payload.sub : undefined;
  if (!userId) redirect(loginUrl);

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

  if (!user) redirect(loginUrl);

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
      <div className="crypto-conta-wrap relative mx-auto w-full max-w-2xl flex-1 px-6 py-0 sm:px-8">
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
