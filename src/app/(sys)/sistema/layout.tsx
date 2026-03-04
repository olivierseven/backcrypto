import type { ReactNode } from "react";

/** Layout da página sistema: tela cheia, sem scroll, fundo cobre até o fim. */
export default function SistemaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-10 h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-transparent">
      {children}
    </div>
  );
}
