import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";
import { getRedirectOriginFromHeaders } from "@/lib/redirect-origin";
import CryptoPlansClient from "./CryptoPlansClient";

export const metadata: Metadata = {
  title: "Planos | Crypto",
  description: "Compre coins para o Crypto.",
};

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export const dynamic = "force-dynamic";

export default async function CryptoPlansPage() {
  const headersList = await headers();
  const origin = getRedirectOriginFromHeaders(headersList);
  const loginUrl = origin ? `${origin}${APP_CRYPTO_ROUTE_PREFIX}/login` : `${APP_CRYPTO_ROUTE_PREFIX}/login`;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) redirect(`${loginUrl}?next=${APP_CRYPTO_ROUTE_PREFIX}/plans`);

  let userId: string;
  try {
    const result = await jwtVerify(token, JWT_SECRET);
    const payload = result.payload as { sub?: string };
    if (typeof payload?.sub !== "string") redirect(loginUrl);
    userId = payload.sub;
  } catch {
    redirect(loginUrl);
  }

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
