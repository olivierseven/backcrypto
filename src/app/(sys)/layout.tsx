import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";
import { cryptoPrisma } from "@/lib/crypto-db";
import SistemaLayoutClient from "@/app/(sys)/sistema/SistemaLayoutClient";
import ConnectionErrorView from "@/app/(sys)/sistema/ConnectionErrorView";
import { requireSysUserId } from "./require-sys-user";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SysLayout({ children }: { children: ReactNode }) {
  const userId = await requireSysUserId();

  let user: { language: string | null; hideStatusBar: boolean | null; role: string | null; tier: string | null } | null;
  try {
    user = await cryptoPrisma.user.findUnique({
      where: { id: userId },
      select: { language: true, hideStatusBar: true, role: true, tier: true },
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
  const isFreeUser = user.tier === "free";

  return (
    <div className="h-[100dvh] min-h-0 w-full flex flex-col">
      <SistemaLayoutClient lang={lang} hideStatusBar={user.hideStatusBar ?? true} isAdmin={isAdmin} isFreeUser={isFreeUser}>
        {children}
      </SistemaLayoutClient>
    </div>
  );
}
