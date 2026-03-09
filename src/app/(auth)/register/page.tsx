import { Suspense } from "react";
import BioRegisterForm from "@/app/BioRegisterForm";
import BioMaintenanceView from "@/app/BioMaintenanceView";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REGISTER_PAGE_PATH = `${APP_CRYPTO_ROUTE_PREFIX}/register`;

export default function RegisterPage() {
  if (process.env.SITE_MAINTENANCE === "1") {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-zinc-600">Loading...</div>}>
        <BioMaintenanceView />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-zinc-600">Loading...</div>}>
      <BioRegisterForm registerPagePath={REGISTER_PAGE_PATH} />
    </Suspense>
  );
}
