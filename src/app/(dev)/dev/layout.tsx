import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Evita HTML estático cacheado; bloqueio em produção no middleware. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DevSegmentLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
