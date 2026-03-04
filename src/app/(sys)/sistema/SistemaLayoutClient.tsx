"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { BioLangProvider } from "@/app/contexts/BioLangContext";
import { useAppBarSafe } from "@/app/AppBarSafeContext";
import { getBioT } from "@/app/lib/translations";
import type { BioLang } from "@/app/lib/translations";
import { useBioLang } from "@/app/contexts/BioLangContext";
import SistemaDebugPanel from "./SistemaDebugPanel";
import { KlinesIndicatorsProvider } from "./KlinesIndicatorsContext";
import IndicatorsPanel from "./IndicatorsPanel";

function SistemaHeader({
  menuOpen,
  onMenuToggle,
  onIndicatorsClick,
}: {
  menuOpen: boolean;
  onMenuToggle: (open: boolean) => void;
  onIndicatorsClick: () => void;
}) {
  const lang = useBioLang();
  const t = getBioT(lang).sistema.klines;

  return (
    <header
      className="shrink-0 min-h-[36px] border-b border-neutral-200 bg-white/80 backdrop-blur w-full flex items-center relative"
      aria-label="Menu"
    >
      <button
        type="button"
        onClick={() => onMenuToggle(!menuOpen)}
        className="p-2 text-zinc-700 hover:bg-zinc-100 rounded-none"
        aria-expanded={menuOpen}
        aria-label="Menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            aria-hidden
            onClick={() => onMenuToggle(false)}
          />
          <nav
            className="absolute left-0 top-full z-40 mt-0 min-w-[160px] rounded-b-lg border border-t-0 border-zinc-200 bg-white shadow-lg py-1"
            aria-label="Main"
          >
            <button
              type="button"
              onClick={onIndicatorsClick}
              className="w-full text-left px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {t.menuIndicators}
            </button>
          </nav>
        </>
      )}
    </header>
  );
}

export default function SistemaLayoutClient({
  children,
  lang = "en",
  hideStatusBar = true,
  isAdmin = false,
}: {
  children: React.ReactNode;
  lang?: BioLang;
  hideStatusBar?: boolean;
  isAdmin?: boolean;
}) {
  const { hideStatusBar: prefHide } = useAppBarSafe();
  const topBarGapClass = prefHide !== true ? "bio-status-bar-reserve" : "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [indicatorsPanelOpen, setIndicatorsPanelOpen] = useState(false);

  useEffect(() => {
    if (Capacitor?.isNativePlatform?.()) {
      import("@capacitor/status-bar").then(({ StatusBar }) => {
        if (hideStatusBar) StatusBar.hide().catch(() => {});
        else StatusBar.show().catch(() => {});
      });
    }
  }, [hideStatusBar]);

  useEffect(() => {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    return () => {};
  }, []);

  const openIndicators = () => {
    setIndicatorsPanelOpen(true);
    setMenuOpen(false);
  };

  return (
    <BioLangProvider lang={lang}>
      <KlinesIndicatorsProvider>
        <div className={`h-full w-full flex flex-col overflow-hidden bg-transparent relative ${topBarGapClass}`}>
          <SistemaHeader
            menuOpen={menuOpen}
            onMenuToggle={setMenuOpen}
            onIndicatorsClick={openIndicators}
          />
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-auto">
            {children}
          </div>
          {indicatorsPanelOpen && (
            <IndicatorsPanel onClose={() => setIndicatorsPanelOpen(false)} />
          )}
        </div>
        {isAdmin && <SistemaDebugPanel />}
      </KlinesIndicatorsProvider>
    </BioLangProvider>
  );
}
