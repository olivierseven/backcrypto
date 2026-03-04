"use client";

import { useAppBarSafe } from "./AppBarSafeContext";

/** Reserva espaço no topo quando "Oculta barra de status" está desativado (app, web desktop e mobile). */
export default function BioHeaderSafe({ children }: { children: React.ReactNode }) {
  const { hideStatusBar } = useAppBarSafe();
  if (hideStatusBar === true) return <>{children}</>;
  return <div className="bio-status-bar-reserve bio-status-bar-reserve-header">{children}</div>;
}
