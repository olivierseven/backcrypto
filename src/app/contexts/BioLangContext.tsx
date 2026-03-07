"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { BioLang } from "../lib/translations";

interface BioLangContextValue {
  lang: BioLang;
  setLang: (lang: BioLang) => void;
}

const BioLangContext = createContext<BioLangContextValue>({ lang: "en", setLang: () => {} });

export function BioLangProvider({ lang: initialLang, children }: { lang: BioLang; children: ReactNode }) {
  const [lang, setLang] = useState<BioLang>(initialLang);
  useEffect(() => {
    setLang(initialLang);
  }, [initialLang]);
  return (
    <BioLangContext.Provider value={{ lang, setLang }}>
      {children}
    </BioLangContext.Provider>
  );
}

export function useBioLang(): BioLang {
  return useContext(BioLangContext).lang;
}

export function useBioLangContext(): BioLangContextValue {
  return useContext(BioLangContext);
}
