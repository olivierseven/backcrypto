import { cookies } from "next/headers";
import { Suspense } from "react";
import BioResetPasswordForm from "@/app/BioResetPasswordForm";
import BioMaintenanceView from "@/app/BioMaintenanceView";
import {
  getBypassCookieName,
  verifyBypassCookie,
  isBypassConfigured,
} from "@/lib/maintenance-bypass";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ResetPasswordPage() {
  if (process.env.SITE_MAINTENANCE === "1") {
    const store = await cookies();
    const bypassCookie = store.get(getBypassCookieName())?.value;
    if (!verifyBypassCookie(bypassCookie)) {
      return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-zinc-600">Loading...</div>}>
          <BioMaintenanceView showBypassForm={isBypassConfigured()} />
        </Suspense>
      );
    }
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-zinc-600">Loading...</div>}>
      <BioResetPasswordForm />
    </Suspense>
  );
}
