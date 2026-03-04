"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { BioLang } from "../lib/translations";

const BioLangContext = createContext<BioLang>("en");

export function BioLangProvider({ lang, children }: { lang: BioLang; children: ReactNode }) {
  return <BioLangContext.Provider value={lang}>{children}</BioLangContext.Provider>;
}

export function useBioLang(): BioLang {
  return useContext(BioLangContext);
}
