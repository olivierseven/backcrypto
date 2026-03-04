"use client";

import { createContext, useContext, type ReactNode } from "react";

type ExecHeaderContextValue = {
  setContent: (content: ReactNode) => void;
};

const ExecHeaderContext = createContext<ExecHeaderContextValue | null>(null);

export function useExecHeader() {
  return useContext(ExecHeaderContext);
}

export function ExecHeaderProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: ExecHeaderContextValue;
}) {
  return (
    <ExecHeaderContext.Provider value={value}>
      {children}
    </ExecHeaderContext.Provider>
  );
}
