import { Suspense } from "react";
import BioResetPasswordForm from "@/app/BioResetPasswordForm";
import BioMaintenanceView from "@/app/BioMaintenanceView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function ResetPasswordPage() {
  if (process.env.SITE_MAINTENANCE === "1") {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-zinc-600">Loading...</div>}>
        <BioMaintenanceView />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-zinc-600">Loading...</div>}>
      <BioResetPasswordForm />
    </Suspense>
  );
}
