import type { ReactNode } from "react";
import { Suspense } from "react";
import AffiliatePostLoginSync from "./AffiliatePostLoginSync";

export default function AfiliadosLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <AffiliatePostLoginSync />
      </Suspense>
      {children}
    </>
  );
}
