// backcrypto/sistema — app Backtest Crypto (apenas header + fundo)
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cryptoPrisma } from "@/lib/crypto-db";
import { jwtVerify } from "jose";
import SistemaLayoutClient from "./SistemaLayoutClient";
import KlinesTable from "./KlinesTable";
import { APP_BACKCRYPTO_ROUTE_PREFIX, APP_BACKCRYPTO_SISTEMA_PATH } from "@/app/constants";
import { getRedirectOriginFromHeaders } from "@/lib/redirect-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export default async function BackcryptoSistemaPage() {
  const headersList = await headers();
  const origin = getRedirectOriginFromHeaders(headersList);
  const loginUrl = origin ? `${origin}${APP_BACKCRYPTO_ROUTE_PREFIX}/login` : `${APP_BACKCRYPTO_ROUTE_PREFIX}/login`;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) redirect(`${loginUrl}?next=${APP_BACKCRYPTO_SISTEMA_PATH}`);

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
    select: { id: true, language: true, hideStatusBar: true, role: true },
  });
  if (!user) redirect(loginUrl);
  const lang = (user.language ?? "en") as "en" | "pt";
  const isAdmin = user.role === "admin";

  return (
    <SistemaLayoutClient lang={lang} hideStatusBar={user.hideStatusBar} isAdmin={isAdmin}>
      <div className="flex-1 min-h-0 w-full min-h-screen">
        <KlinesTable isAdmin={isAdmin} />
      </div>
    </SistemaLayoutClient>
  );
}
