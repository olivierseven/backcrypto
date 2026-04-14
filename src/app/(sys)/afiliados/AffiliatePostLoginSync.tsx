"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CRYPTO_BASE_PATH } from "@/lib/crypto-auth-next";

/**
 * Se a URL tiver `login=1` (pós-redirect do login), remove o parâmetro já e dispara o sync em segundo plano
 * (no máximo 1×/dia no servidor). O fetch não bloqueia a UI; erros são ignorados.
 */
export default function AffiliatePostLoginSync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (searchParams.get("login") !== "1") return;
    ran.current = true;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("login");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);

    const syncUrl = `${CRYPTO_BASE_PATH}/api/affiliate/sync-plan-payments`;
    queueMicrotask(() => {
      void fetch(syncUrl, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postLogin: true }),
      }).catch(() => {});
    });
  }, [pathname, router, searchParams]);

  return null;
}
