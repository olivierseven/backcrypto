"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { CryptoLangProvider } from "@/app/contexts/CryptoLangContext";
import { useAppBarSafe } from "@/app/AppBarSafeContext";
import { API_BASE, APP_PLAY_STORE_URL } from "@/app/constants";
import { applyNativeStatusBarHidden } from "@/app/lib/applyNativeStatusBar";
import { getCryptoT } from "@/app/lib/translations";
import type { CryptoLang } from "@/app/lib/translations";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { useChartHeader } from "./ChartHeaderContext";

const SistemaDebugPanel = dynamic(() => import("./SistemaDebugPanel"), { ssr: false });
import { KlinesIndicatorsProvider } from "./KlinesIndicatorsContext";
import { SistemaDebugProvider } from "./SistemaDebugContext";
import { ChartHeaderProvider } from "./ChartHeaderContext";
import { ChartSymbolProvider, useChartSymbol } from "./ChartSymbolContext";
import IndicatorsPanel from "./IndicatorsPanel";
import DrawingsPanel from "./DrawingsPanel";
import { StrategiesProvider, useStrategies } from "./strategies/StrategiesContext";
import StrategiesPanel from "./strategies/StrategiesPanel";
import { ChartLayoutSaveProvider } from "./ChartLayoutSaveContext";
import { ChartSaveLoadProvider, useChartSaveLoad } from "./ChartSaveLoadContext";
import SaveLoadPanel from "./SaveLoadPanel";
import { KLINE_LAST_LAYOUT_KEY } from "./KlinesChartConstants";
import SingleTabGuard from "./SingleTabGuard";
import TrialNotificationModal from "./TrialNotificationModal";

function SistemaHeaderCard() {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines;
  const { data: headerData } = useChartHeader();
  const { symbol, openSymbolPanel, symbolPanelOpen } = useChartSymbol();
  const hasAny = headerData.priceText != null || headerData.max24h != null || headerData.min24h != null || headerData.vol24hBtc != null || headerData.vol24hUsd != null;
  if (!hasAny) return null;
  const cardMaxWidth = headerData.chartContainerWidth ?? 663;
  return (
    <div
      className="w-full max-w-full px-1 py-1 shrink-0 text-left"
      style={{ maxWidth: `min(${cardMaxWidth}px, 100%)` }}
    >
      <div
        className="rounded-lg border border-zinc-200 bg-white/90 shadow-sm px-1.5 py-1 text-left grid gap-x-3 gap-y-0"
        style={{ gridTemplateColumns: "1.3fr 1fr 1fr" }}
      >
        {/* Coluna 1: símbolo (clicável = abre lista como no header) ao lado do valor; % embaixo do valor */}
        <div className="min-w-0 flex items-center gap-x-3">
          <button
            type="button"
            onClick={openSymbolPanel}
            className="text-xs font-semibold text-zinc-900 shrink-0 hover:bg-zinc-100 rounded px-0.5 -mx-0.5 text-left"
            aria-expanded={symbolPanelOpen}
            aria-haspopup="listbox"
            aria-label={t.symbolAria ?? "Select symbol"}
          >
            {symbol}
          </button>
          {(headerData.priceText != null || headerData.pctText != null) && (
            <div className="flex flex-col gap-y-0 leading-tight min-w-0">
              {headerData.priceText != null && (
                <span className="font-mono text-xs text-zinc-700">{headerData.priceText}</span>
              )}
              {headerData.pctText != null && (
                <span className={`font-mono text-xs ${headerData.pctText.startsWith("+") ? "text-emerald-600" : "text-red-600"}`}>
                  ({headerData.pctText})
                </span>
              )}
            </div>
          )}
        </div>
        {/* Coluna 2: mín e máx 24h — centralizado na coluna, texto à esquerda */}
        <div className="min-w-0 flex flex-col items-start justify-center gap-y-0 leading-tight text-[10px] sm:text-[11px] font-mono text-zinc-600 text-left">
          {headerData.max24h != null && (
            <span className="truncate w-full"><span className="text-zinc-500">{t.max24h}</span> {headerData.max24h}</span>
          )}
          {headerData.min24h != null && (
            <span className="truncate w-full"><span className="text-zinc-500">{t.min24h}</span> {headerData.min24h}</span>
          )}
        </div>
        {/* Coluna 3: volumes — centralizado na coluna, texto à esquerda */}
        <div className="min-w-0 flex flex-col items-start justify-center gap-y-0 leading-tight text-[10px] sm:text-[11px] font-mono text-zinc-600 text-left">
          {headerData.vol24hBtc != null && (
            <span className="truncate w-full"><span className="text-zinc-500">{t.vol24hBtc}</span> {headerData.vol24hBtc}</span>
          )}
          {headerData.vol24hUsd != null && (
            <span className="truncate w-full"><span className="text-zinc-500">{t.vol24hUsd}</span> {headerData.vol24hUsd}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SistemaHeader({
  menuOpen,
  onMenuToggle,
  onMyIndicatorsClick,
  onAddIndicatorClick,
  onMyStrategiesClick,
  onAddStrategyClick,
  onDrawingsClick,
  addStrategyDisabled = false,
  topBarGapClass = "",
}: {
  menuOpen: boolean;
  onMenuToggle: (open: boolean) => void;
  onMyIndicatorsClick: () => void;
  onAddIndicatorClick: () => void;
  onMyStrategiesClick: () => void;
  onAddStrategyClick: () => void;
  onDrawingsClick: () => void;
  addStrategyDisabled?: boolean;
  topBarGapClass?: string;
}) {
  const pathname = usePathname();
  const isContaPage = pathname === "/conta" || pathname?.endsWith("/conta") === true;
  const isPlansPage = pathname === "/plans" || pathname?.endsWith("/plans") === true;
  const isSistemaChartPage = pathname === "/sistema" || pathname?.endsWith("/sistema") === true;
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines;
  const { data: headerData } = useChartHeader();
  const { symbol, setSymbol, symbolOptions, symbolPanelOpen, openSymbolPanel, closeSymbolPanel } = useChartSymbol();
  const { openSavePanel, openLoadPanel } = useChartSaveLoad();
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);
  const [generalSubmenuOpen, setGeneralSubmenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) setGeneralSubmenuOpen(false);
  }, [menuOpen]);

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
      className={`shrink-0 min-h-0 border-b border-neutral-200 bg-white/80 backdrop-blur w-full flex items-center justify-start relative z-[1000] ${topBarGapClass}`}
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
        <button
          type="button"
          onClick={openSymbolPanel}
          className="text-xs sm:text-sm font-semibold text-zinc-900 shrink-0 hover:bg-zinc-100 rounded px-0.5 -mx-0.5"
          aria-expanded={symbolPanelOpen}
          aria-haspopup="listbox"
          aria-label={t.symbolAria ?? "Select symbol"}
        >
          {symbol}
          {headerData.intervalLabel != null && headerData.intervalLabel !== "" && (
            <span className="font-normal text-zinc-600"> ({headerData.intervalLabel})</span>
          )}
        </button>
        <Link
          href="/sistema"
          className="p-1.5 sm:p-2 text-zinc-700 hover:bg-zinc-100 rounded shrink-0"
          aria-label={(t as Record<string, string>).menuChart ?? "Chart"}
          title={(t as Record<string, string>).menuChart ?? "Chart"}
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </Link>
        <Link
          href="/conta"
          className={`p-1.5 sm:p-2 rounded shrink-0 ${isContaPage ? "bg-zinc-200 text-zinc-900" : "text-zinc-700 hover:bg-zinc-100"}`}
          aria-label={(t as Record<string, string>).menuConta ?? "Account"}
          title={(t as Record<string, string>).menuConta ?? "Account"}
          aria-current={isContaPage ? "page" : undefined}
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </Link>
        <Link
          href="/plans"
          className={`p-1.5 sm:p-2 rounded shrink-0 ${isPlansPage ? "bg-zinc-200 text-zinc-900" : "text-zinc-700 hover:bg-zinc-100"}`}
          aria-label={(t as Record<string, string>).menuPlans ?? "Plans"}
          title={(t as Record<string, string>).menuPlans ?? "Plans"}
          aria-current={isPlansPage ? "page" : undefined}
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </Link>
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
            className="absolute left-0 top-full z-[1200] mt-0 min-w-[200px] max-w-[min(100vw-1rem,260px)] w-max rounded-b-lg border border-t-0 border-zinc-200 bg-white shadow-lg py-1"
            aria-label="Main"
          >
            <div className="border-b border-zinc-100 mb-1 pb-1">
              <button
                type="button"
                onClick={() => setGeneralSubmenuOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 text-left px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                aria-expanded={generalSubmenuOpen}
                aria-controls="sistema-menu-general-sub"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 shrink-0 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="truncate">{(t as Record<string, string>).menuGeneralSection ?? "General"}</span>
                </span>
                <svg
                  className={`w-4 h-4 shrink-0 text-zinc-400 transition-transform ${generalSubmenuOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {generalSubmenuOpen && (
                <div id="sistema-menu-general-sub" className="border-l-2 border-violet-200 ml-4 mr-2 mb-1 pl-2 space-y-0.5">
                  <Link
                    href="/conta"
                    onClick={() => onMenuToggle(false)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 rounded"
                  >
                    <svg className="w-4 h-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {(t as Record<string, string>).menuConta ?? "Account"}
                  </Link>
                  <Link
                    href="/plans"
                    onClick={() => onMenuToggle(false)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 rounded"
                  >
                    <svg className="w-4 h-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    {(t as Record<string, string>).menuPlans ?? "Plans"}
                  </Link>
                  <Link
                    href="/historico"
                    onClick={() => onMenuToggle(false)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 rounded"
                  >
                    <svg className="w-4 h-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {(t as Record<string, string>).menuNavHistorico ?? "History"}
                  </Link>
                  <a
                    href={APP_PLAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onMenuToggle(false)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 rounded"
                  >
                    <svg className="w-4 h-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    {(t as Record<string, string>).menuPlayStore ?? "Rate on Google Play"}
                  </a>
                  <Link
                    href="/comunidade"
                    onClick={() => onMenuToggle(false)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 rounded"
                  >
                    <svg className="w-4 h-4 shrink-0 text-zinc-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.077.077 0 00-.041-.106 13.107 13.107 0 00-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01 19.876 19.876 0 006.127 0 .074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 00-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    {(t as Record<string, string>).menuNavCommunity ?? "Community"}
                  </Link>
                </div>
              )}
            </div>
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
              onClick={addStrategyDisabled ? undefined : onAddStrategyClick}
              disabled={addStrategyDisabled}
              className={`w-full text-left px-4 py-2 text-sm font-medium ${addStrategyDisabled ? "text-zinc-400 cursor-not-allowed" : "text-zinc-700 hover:bg-zinc-100"}`}
              title={addStrategyDisabled ? ((t as Record<string, string>).defaultModelMaxStrategies ?? "") : undefined}
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
            {isSistemaChartPage && (
              <>
                <button
                  type="button"
                  onClick={() => { openSavePanel(); onMenuToggle(false); }}
                  className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  <svg className="w-4 h-4 shrink-0 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  <span>{t.saveLayout}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { openLoadPanel(); onMenuToggle(false); }}
                  className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  <svg className="w-4 h-4 shrink-0 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span>{t.loadLayout}</span>
                </button>
              </>
            )}
            <a
              href={`${API_BASE}/auth/logout`}
              onClick={() => onMenuToggle(false)}
              className="block w-full text-left px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 border-t border-zinc-200 mt-1 pt-2"
            >
              {(t as Record<string, string>).menuLogout ?? "Sair"}
            </a>
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
            className="absolute left-0 top-full z-[1100] mt-0 w-[140px] max-w-[140px] max-h-[400px] overflow-y-auto rounded-b-lg border border-t-0 border-zinc-200 bg-white shadow-lg py-1"
            role="listbox"
            aria-label={t.symbolAria ?? "Select symbol"}
          >
            {symbolOptions.map((opt, idx) => (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={symbol === opt}
                onClick={() => {
                  setSymbol(opt);
                  closeSymbolPanel();
                }}
                className={`w-full text-left px-3 py-2 text-sm font-medium truncate ${symbol === opt ? "bg-zinc-100 text-zinc-900" : "text-zinc-700 hover:bg-zinc-100"}`}
                title={opt}
              >
                <span className="inline-block w-4 text-xs font-mono text-zinc-500 mr-2 align-middle" aria-hidden>
                  {idx + 1}
                </span>
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
  isFreeUser = false,
}: {
  children: React.ReactNode;
  lang?: CryptoLang;
  hideStatusBar?: boolean;
  isAdmin?: boolean;
  isFreeUser?: boolean;
}) {
  const { hideStatusBar: prefHide } = useAppBarSafe();
  /** Só reserva espaço quando a preferência é explicitamente false (barra visível). true ou null = não reservar. */
  const topBarGapClass = prefHide === false ? "crypto-status-bar-reserve" : "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [indicatorsPanelOpen, setIndicatorsPanelOpen] = useState(false);
  const [indicatorsPanelInitialView, setIndicatorsPanelInitialView] = useState<"list" | "add">("list");
  const [strategiesPanelOpen, setStrategiesPanelOpen] = useState(false);
  const [strategiesPanelInitialView, setStrategiesPanelInitialView] = useState<"list" | "add">("list");
  const [drawingsPanelOpen, setDrawingsPanelOpen] = useState(false);

  useEffect(() => {
    if (Capacitor?.isNativePlatform?.()) {
      void applyNativeStatusBarHidden(hideStatusBar);
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

  const pathname = usePathname();
  const isSistemaChartPage = pathname === "/sistema" || pathname?.endsWith("/sistema") === true;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  return (
    <CryptoLangProvider lang={lang}>
      <TrialNotificationModal />
      <SingleTabGuard>
        <KlinesIndicatorsProvider>
          <StrategiesProvider>
            <SistemaLayoutInner
            menuOpen={menuOpen}
            onMenuToggle={handleMenuToggle}
            onMyIndicatorsClick={openMyIndicators}
            onAddIndicatorClick={openAddIndicator}
            onMyStrategiesClick={openMyStrategies}
            onAddStrategyClick={openAddStrategy}
            onDrawingsClick={openDrawings}
            indicatorsPanelOpen={indicatorsPanelOpen}
            setIndicatorsPanelOpen={setIndicatorsPanelOpen}
            strategiesPanelOpen={strategiesPanelOpen}
            setStrategiesPanelOpen={setStrategiesPanelOpen}
            drawingsPanelOpen={drawingsPanelOpen}
            setDrawingsPanelOpen={setDrawingsPanelOpen}
            indicatorsPanelInitialView={indicatorsPanelInitialView}
            strategiesPanelInitialView={strategiesPanelInitialView}
            isSistemaChartPage={isSistemaChartPage}
            scrollContainerRef={scrollContainerRef}
            topBarGapClass={topBarGapClass}
            isAdmin={isAdmin}
            isFreeUser={isFreeUser}
          >
            {children}
          </SistemaLayoutInner>
          </StrategiesProvider>
        </KlinesIndicatorsProvider>
      </SingleTabGuard>
    </CryptoLangProvider>
  );
}

function SistemaLayoutInner({
  menuOpen,
  onMenuToggle,
  onMyIndicatorsClick,
  onAddIndicatorClick,
  onMyStrategiesClick,
  onAddStrategyClick,
  onDrawingsClick,
  indicatorsPanelOpen,
  setIndicatorsPanelOpen,
  strategiesPanelOpen,
  setStrategiesPanelOpen,
  drawingsPanelOpen,
  setDrawingsPanelOpen,
  indicatorsPanelInitialView,
  strategiesPanelInitialView,
  isSistemaChartPage,
  scrollContainerRef,
  topBarGapClass,
  isAdmin,
  isFreeUser,
  children,
}: {
  menuOpen: boolean;
  onMenuToggle: (open: boolean) => void;
  onMyIndicatorsClick: () => void;
  onAddIndicatorClick: () => void;
  onMyStrategiesClick: () => void;
  onAddStrategyClick: () => void;
  onDrawingsClick: () => void;
  indicatorsPanelOpen: boolean;
  setIndicatorsPanelOpen: (v: boolean) => void;
  strategiesPanelOpen: boolean;
  setStrategiesPanelOpen: (v: boolean) => void;
  drawingsPanelOpen: boolean;
  setDrawingsPanelOpen: (v: boolean) => void;
  indicatorsPanelInitialView: "list" | "add";
  strategiesPanelInitialView: "list" | "add";
  isSistemaChartPage: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  topBarGapClass: string;
  isAdmin: boolean;
  isFreeUser: boolean;
  children: React.ReactNode;
}) {
  const { strategies } = useStrategies();
  const rawLayout = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_LAST_LAYOUT_KEY) : null;
  const isDefaultModel = rawLayout === "default" || rawLayout === "0";
  const addStrategyDisabled = isDefaultModel && strategies.length >= 1;

  return (
    <SistemaDebugProvider>
      <ChartHeaderProvider>
        <ChartSymbolProvider>
          <ChartLayoutSaveProvider>
            <ChartSaveLoadProvider>
            <SistemaLayoutContent
              menuOpen={menuOpen}
              onMenuToggle={onMenuToggle}
              onMyIndicatorsClick={onMyIndicatorsClick}
              onAddIndicatorClick={onAddIndicatorClick}
              onMyStrategiesClick={onMyStrategiesClick}
              onAddStrategyClick={onAddStrategyClick}
              onDrawingsClick={onDrawingsClick}
              addStrategyDisabled={addStrategyDisabled}
              topBarGapClass={topBarGapClass}
              indicatorsPanelOpen={indicatorsPanelOpen}
              setIndicatorsPanelOpen={setIndicatorsPanelOpen}
              strategiesPanelOpen={strategiesPanelOpen}
              setStrategiesPanelOpen={setStrategiesPanelOpen}
              drawingsPanelOpen={drawingsPanelOpen}
              setDrawingsPanelOpen={setDrawingsPanelOpen}
              indicatorsPanelInitialView={indicatorsPanelInitialView}
              strategiesPanelInitialView={strategiesPanelInitialView}
              isSistemaChartPage={isSistemaChartPage}
              scrollContainerRef={scrollContainerRef}
              isAdmin={isAdmin}
              isFreeUser={isFreeUser}
              children={children}
            />
            </ChartSaveLoadProvider>
          </ChartLayoutSaveProvider>
        </ChartSymbolProvider>
      </ChartHeaderProvider>
    </SistemaDebugProvider>
  );
}

function SistemaLayoutContent({
  menuOpen,
  onMenuToggle,
  onMyIndicatorsClick,
  onAddIndicatorClick,
  onMyStrategiesClick,
  onAddStrategyClick,
  onDrawingsClick,
  addStrategyDisabled,
  topBarGapClass,
  indicatorsPanelOpen,
  setIndicatorsPanelOpen,
  strategiesPanelOpen,
  setStrategiesPanelOpen,
  drawingsPanelOpen,
  setDrawingsPanelOpen,
  indicatorsPanelInitialView,
  strategiesPanelInitialView,
  isSistemaChartPage,
  scrollContainerRef,
  isAdmin,
  isFreeUser,
  children,
}: {
  menuOpen: boolean;
  onMenuToggle: (open: boolean) => void;
  onMyIndicatorsClick: () => void;
  onAddIndicatorClick: () => void;
  onMyStrategiesClick: () => void;
  onAddStrategyClick: () => void;
  onDrawingsClick: () => void;
  addStrategyDisabled: boolean;
  topBarGapClass: string;
  indicatorsPanelOpen: boolean;
  setIndicatorsPanelOpen: (v: boolean) => void;
  strategiesPanelOpen: boolean;
  setStrategiesPanelOpen: (v: boolean) => void;
  drawingsPanelOpen: boolean;
  setDrawingsPanelOpen: (v: boolean) => void;
  indicatorsPanelInitialView: "list" | "add";
  strategiesPanelInitialView: "list" | "add";
  isSistemaChartPage: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isAdmin: boolean;
  isFreeUser: boolean;
  children: React.ReactNode;
}) {
  const { panelView, closePanel } = useChartSaveLoad();

  return (
    <>
            <div className="h-full w-full flex flex-col overflow-hidden bg-transparent relative">
              <SistemaHeader
                menuOpen={menuOpen}
                onMenuToggle={onMenuToggle}
                onMyIndicatorsClick={onMyIndicatorsClick}
                onAddIndicatorClick={onAddIndicatorClick}
                onMyStrategiesClick={onMyStrategiesClick}
                onAddStrategyClick={onAddStrategyClick}
                onDrawingsClick={onDrawingsClick}
                addStrategyDisabled={addStrategyDisabled}
                topBarGapClass={topBarGapClass}
              />
              <div className="flex-1 flex flex-col min-w-0 min-h-0 relative" style={{ minWidth: "100vw" }}>
                <div
                  ref={scrollContainerRef}
                  className="flex-1 min-h-0 min-w-0 overflow-auto"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {isSistemaChartPage && <SistemaHeaderCard />}
                  {children}
                </div>
              </div>
              {indicatorsPanelOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[1300]"
                    aria-hidden
                    onClick={() => setIndicatorsPanelOpen(false)}
                  />
                  <IndicatorsPanel initialView={indicatorsPanelInitialView} onClose={() => setIndicatorsPanelOpen(false)} isFreeUser={isFreeUser} />
                </>
              )}
              {strategiesPanelOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[1300]"
                    aria-hidden
                    onClick={() => setStrategiesPanelOpen(false)}
                  />
                  <StrategiesPanel initialView={strategiesPanelInitialView} onClose={() => setStrategiesPanelOpen(false)} />
                </>
              )}
              {drawingsPanelOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[1300]"
                    aria-hidden
                    onClick={() => setDrawingsPanelOpen(false)}
                  />
                  <DrawingsPanel onClose={() => setDrawingsPanelOpen(false)} />
                </>
              )}
              {panelView && (
                <>
                  <div
                    className="fixed inset-0 z-[1300]"
                    aria-hidden
                    onClick={() => closePanel()}
                  />
                  <SaveLoadPanel initialView={panelView} onClose={() => closePanel()} />
                </>
              )}
            </div>
            {isAdmin && <SistemaDebugPanel />}
    </>
  );
}
