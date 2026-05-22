import type { Metadata } from "next";
import type { ReactNode } from "react";
import nextDynamic from "next/dynamic";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";
import { cryptoPrisma } from "@/lib/crypto-db";
import ConnectionErrorView from "@/app/(sys)/sistema/ConnectionErrorView";
import { AFFILIATE_JWT_COOKIE_NAME, isAffiliatePainelSysPath } from "@/lib/crypto-auth-next";
import { getLocaleFromRequest } from "@/lib/get-locale-server";
import { isAffiliateAccountAtivo } from "@/lib/affiliate-account-ativo";
import { jwtVerify } from "jose";
import { requireSysUserId } from "./require-sys-user";
import { syncUserTierAndIsFree } from "@/lib/user-tier";

/** Import dinâmico: o shell do layout fica num chunk menor; o cliente pesado carrega à parte (alivia ChunkLoadError/timeout com basePath + HMR). */
const SistemaLayoutClient = nextDynamic(() => import("@/app/(sys)/sistema/SistemaLayoutClient"), {
  loading: () => (
    <div className="h-[100dvh] min-h-0 w-full flex flex-col items-center justify-center bg-zinc-50" aria-busy aria-label="Loading">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" />
    </div>
  ),
});

const AFF_JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SysLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-crypto-pathname") ?? "";
  if (isAffiliatePainelSysPath(pathname)) {
    const token = (await cookies()).get(AFFILIATE_JWT_COOKIE_NAME)?.value;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, AFF_JWT_SECRET);
        if (payload.affiliate === true && typeof payload.sub === "string") {
          if (!(await isAffiliateAccountAtivo(payload.sub))) {
            const lang = await getLocaleFromRequest();
            redirect(`/api/auth/afiliados/logout?login=inactive&lang=${lang}`);
          }
        }
      } catch {
        /* JWT inválido: páginas de afiliado redirecionam */
      }
    }
    return <>{children}</>;
  }

  const userId = await requireSysUserId();

  let user: { language: string | null; hideStatusBar: boolean | null; role: string | null } | null;
  try {
    user = await cryptoPrisma.user.findUnique({
      where: { id: userId },
      select: { language: true, hideStatusBar: true, role: true },
    });
  } catch (err) {
    const isConnectionError =
      err &&
      typeof err === "object" &&
      "name" in err &&
      (err as { name?: string }).name === "PrismaClientKnownRequestError" &&
      ("code" in err && (err as { code?: string }).code === "P1001" ||
        "message" in err && typeof (err as { message?: string }).message === "string" &&
        (err as { message: string }).message.includes("Can't reach database"));
    if (isConnectionError) {
      const headersList = await headers();
      const preferredLang = headersList.get("accept-language")?.toLowerCase().includes("pt") ? "pt" : "en";
      return <ConnectionErrorView lang={preferredLang} />;
    }
    throw err;
  }
  if (!user) {
    redirect(`${APP_CRYPTO_ROUTE_PREFIX}/login`);
  }

  const lang = (user.language ?? "en") as "en" | "pt";
  const isAdmin = user.role === "admin";
  const { isFreeUser } = await syncUserTierAndIsFree(userId);

  return (
    <div className="h-[100dvh] min-h-0 w-full flex flex-col">
      <SistemaLayoutClient lang={lang} hideStatusBar={user.hideStatusBar ?? true} isAdmin={isAdmin} isFreeUser={isFreeUser}>
        {children}
      </SistemaLayoutClient>
    </div>
  );
}
