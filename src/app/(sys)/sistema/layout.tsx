import type { ReactNode } from "react";

/** Layout da página sistema: preenche a área de conteúdo do shell (sys). */
export default function SistemaLayout({ children }: { children: ReactNode }) {
  return <div className="flex-1 min-h-0 w-full">{children}</div>;
}
