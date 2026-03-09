import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cryptoPrisma } from "@/lib/crypto-db";
import { jwtVerify } from "jose";
import { decryptEmail } from "@/lib/crypto";
import BioContaClient from "./ContaClient";
import BioHeaderSafe from "@/app/BioHeaderSafe";
import { APP_BACKCRYPTO_ROUTE_PREFIX, SISTEMA_PATH } from "@/app/constants";
import { getRedirectOriginFromHeaders } from "@/lib/redirect-origin";
import { getCryptoT } from "@/app/lib/translations";

export const metadata: Metadata = {
  title: "Minha Conta | Backtest Crypto",
  description: "Gerencie suas informações e preferências.",
};

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export const dynamic = "force-dynamic";

export default async function BioContaPage() {
  const headersList = await headers();
  const origin = getRedirectOriginFromHeaders(headersList);
  const loginUrl = origin ? `${origin}${APP_BACKCRYPTO_ROUTE_PREFIX}/login` : `${APP_BACKCRYPTO_ROUTE_PREFIX}/login`;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) redirect(`${loginUrl}?next=${APP_BACKCRYPTO_ROUTE_PREFIX}/conta`);

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

  const lang = (user.language ?? "en") as "en" | "pt";
  const t = getCryptoT(lang);

  return (
    <main className="bio-conta-page relative overflow-hidden min-h-screen flex flex-col items-center">
      <BioHeaderSafe>
      <header className="bio-header sticky top-0 z-10 shrink-0 w-full">
        <div className="bio-header-inner mx-auto max-w-2xl px-4 sm:px-6">
          <Link
            href={SISTEMA_PATH}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            {t.conta.backToSystem}
          </Link>
          <span className="text-sm font-semibold text-neutral-800">{t.conta.title}</span>
          <span className="w-14 shrink-0" aria-hidden />
        </div>
      </header>
      </BioHeaderSafe>

      <div className="bio-conta-wrap relative mx-auto w-full max-w-2xl flex-1 px-6 py-0 sm:px-8">
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
