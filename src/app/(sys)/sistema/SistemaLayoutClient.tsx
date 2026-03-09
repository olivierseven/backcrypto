"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { CryptoLangProvider } from "@/app/contexts/CryptoLangContext";
import { useAppBarSafe } from "@/app/AppBarSafeContext";
import { getCryptoT } from "@/app/lib/translations";
import type { CryptoLang } from "@/app/lib/translations";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { useChartHeader } from "./ChartHeaderContext";
import SistemaDebugPanel from "./SistemaDebugPanel";
import { KlinesIndicatorsProvider } from "./KlinesIndicatorsContext";
import { SistemaDebugProvider } from "./SistemaDebugContext";
import { ChartHeaderProvider } from "./ChartHeaderContext";
import { ChartSymbolProvider, useChartSymbol } from "./ChartSymbolContext";
import IndicatorsPanel from "./IndicatorsPanel";
import DrawingsPanel from "./DrawingsPanel";
import { StrategiesProvider } from "./strategies/StrategiesContext";
import StrategiesPanel from "./strategies/StrategiesPanel";

function SistemaHeader({
  menuOpen,
  onMenuToggle,
  onMyIndicatorsClick,
  onAddIndicatorClick,
  onMyStrategiesClick,
  onAddStrategyClick,
  onDrawingsClick,
}: {
  menuOpen: boolean;
  onMenuToggle: (open: boolean) => void;
  onMyIndicatorsClick: () => void;
  onAddIndicatorClick: () => void;
  onMyStrategiesClick: () => void;
  onAddStrategyClick: () => void;
  onDrawingsClick: () => void;
}) {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines;
  const { data: headerData } = useChartHeader();
  const { symbol, setSymbol, symbolOptions, symbolPanelOpen, openSymbolPanel, closeSymbolPanel } = useChartSymbol();
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointer = (e: MouseEvent | TouchEvent) => {
      const target = (e.target as Node) ?? null;
      if (!target) return;
      if (menuTriggerRef.current?.contains(target) || menuPanelRef.current?.contains(target)) return;
      onMenuToggle(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
    };
  }, [menuOpen, onMenuToggle]);

  const innerStyle = headerData.chartContainerWidth != null
    ? { maxWidth: headerData.chartContainerWidth }
    : undefined;

  return (
    <header
      className="shrink-0 min-h-0 border-b border-neutral-200 bg-white/80 backdrop-blur w-full flex items-center justify-start relative z-[1000]"
      aria-label="Menu"
    >
      <div
        className="w-full min-w-0 flex items-center gap-1.5 sm:gap-3 px-0 py-1 min-h-[32px]"
        style={innerStyle}
      >
        <button
          ref={menuTriggerRef}
          type="button"
          onClick={() => onMenuToggle(!menuOpen)}
          className="p-1.5 sm:p-2 text-zinc-700 hover:bg-zinc-100 rounded-none shrink-0"
          aria-expanded={menuOpen}
          aria-label="Menu"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 shrink">
          <button
            type="button"
            onClick={openSymbolPanel}
            className="text-xs sm:text-sm font-semibold text-zinc-900 shrink-0 hover:bg-zinc-100 rounded px-0.5 -mx-0.5"
            aria-expanded={symbolPanelOpen}
            aria-haspopup="listbox"
            aria-label={t.symbolAria ?? "Select symbol"}
          >
            {symbol}
          </button>
          {headerData.priceText != null && (
            <div className="flex flex-col text-[10px] sm:text-xs font-medium font-mono shrink-0 leading-tight">
              <span className="text-zinc-600">{headerData.priceText}</span>
              {headerData.pctText != null && (
                <span className={`shrink-0 ${headerData.pctText.startsWith("+") ? "text-emerald-600" : "text-red-600"}`}>
                  ({headerData.pctText})
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex items-center justify-center gap-0">
          <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
            <div className="flex flex-col text-[10px] sm:text-[11px] font-mono text-zinc-600 whitespace-nowrap text-left">
              {headerData.max24h != null && (
                <span><span className="text-zinc-500">{t.max24h}</span> {headerData.max24h}</span>
              )}
              {headerData.min24h != null && (
                <span><span className="text-zinc-500">{t.min24h}</span>{headerData.min24h}</span>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
            <div className="flex flex-col text-[10px] sm:text-[11px] font-mono text-zinc-600 whitespace-nowrap text-left">
              {headerData.vol24hBtc != null && (
                <span><span className="text-zinc-500">{t.vol24hBtc}</span> {headerData.vol24hBtc}</span>
              )}
              {headerData.vol24hUsd != null && (
                <span><span className="text-zinc-500">{t.vol24hUsd}</span> {headerData.vol24hUsd}</span>
              )}
            </div>
          </div>
        </div>
      </div>
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-[1100] bg-black/10"
            aria-hidden
            onClick={() => onMenuToggle(false)}
          />
          <nav
            ref={menuPanelRef}
            className="absolute left-0 top-full z-[1100] mt-0 w-[160px] rounded-b-lg border border-t-0 border-zinc-200 bg-white shadow-lg py-1"
            aria-label="Main"
          >
            <button
              type="button"
              onClick={onMyIndicatorsClick}
              className="w-full text-left px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {(t as Record<string, string>).menuMyIndicators ?? "My indicators"}
            </button>
            <button
              type="button"
              onClick={onAddIndicatorClick}
              className="w-full text-left px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {(t as Record<string, string>).menuAddIndicator ?? "Add indicator"}
            </button>
            <button
              type="button"
              onClick={onMyStrategiesClick}
              className="w-full text-left px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {(t as Record<string, string>).menuMyStrategies ?? "My strategies"}
            </button>
            <button
              type="button"
              onClick={onAddStrategyClick}
              className="w-full text-left px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {(t as Record<string, string>).menuAddStrategy ?? "Create strategy"}
            </button>
            <button
              type="button"
              onClick={onDrawingsClick}
              className="w-full text-left px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {(t as Record<string, string>).menuDrawings ?? "Drawings"}
            </button>
            <Link
              href="/conta"
              onClick={() => onMenuToggle(false)}
              className="block w-full text-left px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {(t as Record<string, string>).menuConta ?? "Conta"}
            </Link>
          </nav>
        </>
      )}
      {symbolPanelOpen && (
        <>
          <div
            className="fixed inset-0 z-[1100]"
            aria-hidden
            onClick={closeSymbolPanel}
          />
          <div
            className="absolute left-0 top-full z-[1100] mt-0 min-w-[140px] rounded-b-lg border border-t-0 border-zinc-200 bg-white shadow-lg py-1"
            role="listbox"
            aria-label={t.symbolAria ?? "Select symbol"}
          >
            {symbolOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={symbol === opt}
                onClick={() => {
                  setSymbol(opt);
                  closeSymbolPanel();
                }}
                className={`w-full text-left px-4 py-2 text-sm font-medium ${symbol === opt ? "bg-zinc-100 text-zinc-900" : "text-zinc-700 hover:bg-zinc-100"}`}
              >
                {opt}
              </button>
            ))}
          </div>
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
  lang?: CryptoLang;
  hideStatusBar?: boolean;
  isAdmin?: boolean;
}) {
  const { hideStatusBar: prefHide } = useAppBarSafe();
  const topBarGapClass = prefHide !== true ? "crypto-status-bar-reserve" : "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [indicatorsPanelOpen, setIndicatorsPanelOpen] = useState(false);
  const [indicatorsPanelInitialView, setIndicatorsPanelInitialView] = useState<"list" | "add">("list");
  const [strategiesPanelOpen, setStrategiesPanelOpen] = useState(false);
  const [strategiesPanelInitialView, setStrategiesPanelInitialView] = useState<"list" | "add">("list");
  const [drawingsPanelOpen, setDrawingsPanelOpen] = useState(false);

  useEffect(() => {
    if (Capacitor?.isNativePlatform?.()) {
      import("@capacitor/status-bar").then(({ StatusBar }) => {
        if (hideStatusBar) StatusBar.hide().catch(() => { });
        else StatusBar.show().catch(() => { });
      });
    }
  }, [hideStatusBar]);

  useEffect(() => {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    return () => { };
  }, []);

  const openMyIndicators = () => {
    setIndicatorsPanelInitialView("list");
    setIndicatorsPanelOpen(true);
    setMenuOpen(false);
  };
  const openAddIndicator = () => {
    setIndicatorsPanelInitialView("add");
    setIndicatorsPanelOpen(true);
    setMenuOpen(false);
  };
  const openMyStrategies = () => {
    setStrategiesPanelInitialView("list");
    setStrategiesPanelOpen(true);
    setMenuOpen(false);
  };
  const openAddStrategy = () => {
    setStrategiesPanelInitialView("add");
    setStrategiesPanelOpen(true);
    setMenuOpen(false);
  };

  const openDrawings = () => {
    setDrawingsPanelOpen(true);
    setMenuOpen(false);
  };

  const handleMenuToggle = (open: boolean) => {
    setIndicatorsPanelOpen(false);
    setStrategiesPanelOpen(false);
    setDrawingsPanelOpen(false);
    setMenuOpen(open);
  };

  return (
    <CryptoLangProvider lang={lang}>
      <KlinesIndicatorsProvider>
        <StrategiesProvider>
          <SistemaDebugProvider>
            <ChartHeaderProvider>
              <ChartSymbolProvider>
                <div className={`h-full w-full flex flex-col overflow-hidden bg-transparent relative ${topBarGapClass}`}>
                  <SistemaHeader
                    menuOpen={menuOpen}
                    onMenuToggle={handleMenuToggle}
                    onMyIndicatorsClick={openMyIndicators}
                    onAddIndicatorClick={openAddIndicator}
                    onMyStrategiesClick={openMyStrategies}
                    onAddStrategyClick={openAddStrategy}
                    onDrawingsClick={openDrawings}
                  />
                  <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-auto">
                    {children}
                  </div>
                  {indicatorsPanelOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-[39]"
                        aria-hidden
                        onClick={() => setIndicatorsPanelOpen(false)}
                      />
                      <IndicatorsPanel initialView={indicatorsPanelInitialView} onClose={() => setIndicatorsPanelOpen(false)} />
                    </>
                  )}
                  {strategiesPanelOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-[39]"
                        aria-hidden
                        onClick={() => setStrategiesPanelOpen(false)}
                      />
                      <StrategiesPanel initialView={strategiesPanelInitialView} onClose={() => setStrategiesPanelOpen(false)} />
                    </>
                  )}
                  {drawingsPanelOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-[39]"
                        aria-hidden
                        onClick={() => setDrawingsPanelOpen(false)}
                      />
                      <DrawingsPanel onClose={() => setDrawingsPanelOpen(false)} />
                    </>
                  )}
                </div>
                {isAdmin && <SistemaDebugPanel />}
              </ChartSymbolProvider>
            </ChartHeaderProvider>
          </SistemaDebugProvider>
        </StrategiesProvider>
      </KlinesIndicatorsProvider>
    </CryptoLangProvider>
  );
}
