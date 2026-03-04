"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { API_BASE } from "@/app/constants";

export type BioDebugFlags = {
  genesisId: number | null;
  genesisGrupo: boolean;
  performance: boolean;
  execLog: boolean;
  dados: boolean;
  mortesAcum: boolean;
  mapa: boolean;
};

const DEFAULT_FLAGS: BioDebugFlags = {
  genesisId: null,
  genesisGrupo: false,
  performance: false,
  execLog: false,
  dados: false,
  mortesAcum: false,
  mapa: false,
};

type BioDebugContextValue = {
  isAdmin: boolean;
  flags: BioDebugFlags;
  setGenesisId: (id: number | null) => void;
  setGenesisGrupo: (v: boolean) => void;
  setPerformance: (v: boolean) => void;
  setExecLog: (v: boolean) => void;
  setDados: (v: boolean) => void;
  setMortesAcum: (v: boolean) => void;
  setMapa: (v: boolean) => void;
};

const BioDebugContext = createContext<BioDebugContextValue | null>(null);

export function useBioDebug() {
  return useContext(BioDebugContext);
}

export function BioDebugProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [flags, setFlags] = useState<BioDebugFlags>(DEFAULT_FLAGS);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/check`);
        if (res.ok) {
          const text = await res.text();
          const data = text ? (JSON.parse(text) as { role?: string }) : {};
          setIsAdmin(data.role === "admin");
        }
      } catch {
        setIsAdmin(false);
      }
    };
    check();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__DEBUG_GENESIS_ID = flags.genesisId;
  }, [flags.genesisId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__DEBUG_GENESIS_GRUPO = flags.genesisGrupo;
  }, [flags.genesisGrupo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__DEBUG_PERFORMANCE_SCRIPT = flags.performance;
  }, [flags.performance]);

  const setGenesisId = useCallback((id: number | null) => {
    setFlags((f) => ({ ...f, genesisId: id }));
  }, []);

  const setGenesisGrupo = useCallback((v: boolean) => {
    setFlags((f) => ({ ...f, genesisGrupo: v }));
  }, []);

  const setPerformance = useCallback((v: boolean) => {
    setFlags((f) => ({ ...f, performance: v }));
  }, []);

  const setExecLog = useCallback((v: boolean) => {
    setFlags((f) => ({ ...f, execLog: v }));
  }, []);

  const setDados = useCallback((v: boolean) => {
    setFlags((f) => ({ ...f, dados: v }));
  }, []);

  const setMortesAcum = useCallback((v: boolean) => {
    setFlags((f) => ({ ...f, mortesAcum: v }));
  }, []);

  const setMapa = useCallback((v: boolean) => {
    setFlags((f) => ({ ...f, mapa: v }));
  }, []);

  return (
    <BioDebugContext.Provider
      value={{
        isAdmin,
        flags,
        setGenesisId,
        setGenesisGrupo,
        setPerformance,
        setExecLog,
        setDados,
        setMortesAcum,
        setMapa,
      }}
    >
      {children}
    </BioDebugContext.Provider>
  );
}
