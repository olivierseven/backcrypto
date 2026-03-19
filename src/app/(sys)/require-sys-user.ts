import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";
import { getRedirectOriginFromHeaders } from "@/lib/redirect-origin";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function requireSysUserId(nextPath = `${APP_CRYPTO_ROUTE_PREFIX}/sistema`): Promise<string> {
  const headersList = await headers();
  const origin = getRedirectOriginFromHeaders(headersList);
  const loginUrl = origin ? `${origin}${APP_CRYPTO_ROUTE_PREFIX}/login` : `${APP_CRYPTO_ROUTE_PREFIX}/login`;

  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) redirect(`${loginUrl}?next=${encodeURIComponent(nextPath)}`);

  try {
    const result = await jwtVerify(token, JWT_SECRET);
    const payload = result.payload as { sub?: string };
    if (typeof payload?.sub !== "string" || !payload.sub) {
      redirect(loginUrl);
    }
    return payload.sub;
  } catch {
    redirect(loginUrl);
  }
}
