"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";

type AppBarSafe = {
  hideStatusBar: boolean | null;
  isNative: boolean;
};

const defaultState: AppBarSafe = { hideStatusBar: null, isNative: false };

const AppBarSafeContext = createContext<AppBarSafe & { setAppBarSafe: (v: { hideStatusBar: boolean | null }) => void }>({
  ...defaultState,
  setAppBarSafe: () => {},
});

export function AppBarSafeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppBarSafe>(defaultState);

  useEffect(() => {
    const isNative = typeof window !== "undefined" && !!Capacitor?.isNativePlatform?.();
    setState((s) => ({ ...s, isNative }));
  }, []);

  const setAppBarSafe = useCallback((v: { hideStatusBar: boolean | null }) => {
    setState((s) => ({ ...s, hideStatusBar: v.hideStatusBar }));
  }, []);

  return (
    <AppBarSafeContext.Provider value={{ ...state, setAppBarSafe }}>
      {children}
    </AppBarSafeContext.Provider>
  );
}

export function useAppBarSafe(): AppBarSafe & { setAppBarSafe: (v: { hideStatusBar: boolean | null }) => void } {
  return useContext(AppBarSafeContext);
}
