"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { CryptoLang } from "../lib/translations";

interface CryptoLangContextValue {
  lang: CryptoLang;
  setLang: (lang: CryptoLang) => void;
}

const CryptoLangContext = createContext<CryptoLangContextValue>({ lang: "en", setLang: () => {} });

export function CryptoLangProvider({ lang: initialLang, children }: { lang: CryptoLang; children: ReactNode }) {
  const [lang, setLang] = useState<CryptoLang>(initialLang);
  useEffect(() => {
    setLang(initialLang);
  }, [initialLang]);
  return (
    <CryptoLangContext.Provider value={{ lang, setLang }}>
      {children}
    </CryptoLangContext.Provider>
  );
}

export function useCryptoLang(): CryptoLang {
  return useContext(CryptoLangContext).lang;
}

export function useCryptoLangContext(): CryptoLangContextValue {
  return useContext(CryptoLangContext);
}
