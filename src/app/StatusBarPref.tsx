"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { API_BASE } from "./constants";
import { useAppBarSafe } from "./AppBarSafeContext";

const APP_ROUTES = ["/sistema", "/conta", "/historico", "/plans", "/admin", "/oauth-return", "/reativar"];

function isAppRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return APP_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

export default function StatusBarPref() {
  const pathname = usePathname();
  const appliedRef = useRef<boolean | null>(null);
  const { setAppBarSafe } = useAppBarSafe();

  /* Buscar preferência em qualquer plataforma (app e web) para o vão no topo quando "ocultar" está desativado */
  useEffect(() => {
    if (typeof window === "undefined" || !isAppRoute(pathname)) return;

    const fetchAndSet = async () => {
      try {
        const res = await fetch(`${API_BASE}/user/notification-preferences`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const hide = data?.hideStatusBar === true;
        setAppBarSafe({ hideStatusBar: hide });
        if (Capacitor?.isNativePlatform?.()) {
          if (appliedRef.current !== hide) {
            appliedRef.current = hide;
            const { StatusBar } = await import("@capacitor/status-bar");
            if (hide) StatusBar.hide().catch(() => {});
            else StatusBar.show().catch(() => {});
          }
        }
      } catch {
        appliedRef.current = null;
      }
    };

    appliedRef.current = null;
    fetchAndSet();
  }, [pathname, setAppBarSafe]);

  /* No app nativo: reaplicar ao voltar do background */
  useEffect(() => {
    if (typeof window === "undefined" || !Capacitor?.isNativePlatform?.() || !isAppRoute(pathname)) return;

    const onAppStateChange = async (state: { isActive: boolean }) => {
      if (!state.isActive) return;
      appliedRef.current = null;
      try {
        const res = await fetch(`${API_BASE}/user/notification-preferences`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const hide = data?.hideStatusBar === true;
        setAppBarSafe({ hideStatusBar: hide });
        appliedRef.current = hide;
        const { StatusBar } = await import("@capacitor/status-bar");
        if (hide) StatusBar.hide().catch(() => {});
        else StatusBar.show().catch(() => {});
      } catch {
        appliedRef.current = null;
      }
    };

    let listenerPromise: Promise<{ remove: () => Promise<void> }> | null = null;
    import("@capacitor/app").then(({ App }) => {
      listenerPromise = App.addListener("appStateChange", onAppStateChange);
    });
    return () => {
      listenerPromise?.then((l) => l.remove());
    };
  }, [pathname, setAppBarSafe]);

  return null;
}
