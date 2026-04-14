"use client";

import { useAppBarSafe } from "./AppBarSafeContext";

/** Reserva espaço no topo apenas quando "Ocultar barra de status" está desativado (false). Se true ou null, não reserva. */
export default function BioHeaderSafe({ children }: { children: React.ReactNode }) {
  const { hideStatusBar } = useAppBarSafe();
  if (hideStatusBar !== false) return <>{children}</>;
  return <div className="crypto-status-bar-reserve crypto-status-bar-reserve-header">{children}</div>;
}
