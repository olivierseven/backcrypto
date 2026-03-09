import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { getRedirectOriginFromHeaders } from "@/lib/redirect-origin";
import { APP_BACKCRYPTO_ROUTE_PREFIX } from "@/app/constants";
import SistemaLayoutClient from "@/app/(sys)/sistema/SistemaLayoutClient";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export const dynamic = "force-dynamic";

export default async function SysLayout({ children }: { children: ReactNode }) {
  const headersList = await headers();
  const origin = getRedirectOriginFromHeaders(headersList);
  const loginUrl = origin ? `${origin}${APP_BACKCRYPTO_ROUTE_PREFIX}/login` : `${APP_BACKCRYPTO_ROUTE_PREFIX}/login`;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) redirect(`${loginUrl}?next=${encodeURIComponent(APP_BACKCRYPTO_ROUTE_PREFIX + "/sistema")}`);

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
    select: { language: true, hideStatusBar: true, role: true },
  });
  if (!user) redirect(loginUrl);

  const lang = (user.language ?? "en") as "en" | "pt";
  const isAdmin = user.role === "admin";

  return (
    <div className="h-[100dvh] min-h-0 w-full flex flex-col">
      <SistemaLayoutClient lang={lang} hideStatusBar={user.hideStatusBar ?? true} isAdmin={isAdmin}>
        {children}
      </SistemaLayoutClient>
    </div>
  );
}
