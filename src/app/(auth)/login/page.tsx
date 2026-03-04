import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { jwtVerify } from "jose";
import BioLoginForm from "@/app/BioLoginForm";
import BioMaintenanceView from "@/app/BioMaintenanceView";
import { getRedirectOriginFromHeaders } from "@/lib/redirect-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const BIO_NEXT = "/backcrypto/sistema";

function safeNext(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return BIO_NEXT;
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const nextPath = safeNext(sp?.next);

  const store = await cookies();
  const token = store.get(COOKIE)?.value;

  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      const headersList = await headers();
      const origin = getRedirectOriginFromHeaders(headersList);
      const target = origin ? `${origin}${nextPath}` : nextPath;
      redirect(target);
    } catch {
      /* token inválido → exibe login */
    }
  }

  if (process.env.SITE_MAINTENANCE === "1") {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-zinc-600">Loading...</div>}>
        <BioMaintenanceView />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-zinc-600">Loading...</div>}>
      <BioLoginForm
        nextPath={nextPath}
        loginPagePath="/backcrypto/login"
      />
    </Suspense>
  );
}
