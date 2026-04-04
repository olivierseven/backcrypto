"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { API_BASE } from "@/app/constants";
import { getCryptoT, type CryptoLang } from "@/app/lib/translations";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { useChartSymbol } from "./ChartSymbolContext";
import { useChartHeader } from "./ChartHeaderContext";
import TradingOrderSheet from "./TradingOrderSheet";

export default function SistemaTradingFooter() {
  const pathname = usePathname();
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines as Record<string, string>;
  const { symbol } = useChartSymbol();
  const { data: headerData } = useChartHeader();
  const cardMaxWidth = headerData.chartContainerWidth ?? 663;
  const [connected, setConnected] = useState<boolean | null>(null);
  const [sheet, setSheet] = useState<"BUY" | "SELL" | null>(null);

  const isSistema = pathname === "/sistema" || pathname?.endsWith("/sistema") === true;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/user/binance-connection`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setConnected(res.ok && data.connected === true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!isSistema) return;
    void load();
  }, [isSistema, load]);

  useEffect(() => {
    if (!isSistema) return;
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isSistema, load]);

  if (!isSistema) return null;
  /** Rodapé de trading só com Binance ligada (GET /user/binance-connection). */
  if (connected !== true) return null;

  const symOk = symbol.trim().toUpperCase().endsWith("USDT") && symbol.trim().length > 4;

  return (
    <>
      <div
        data-no-clear-crosshair
        className="shrink-0 z-[1200] border-t border-zinc-200 bg-white/95 backdrop-blur w-full max-w-full px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
        style={{ maxWidth: `min(${cardMaxWidth}px, 100%)` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <span className="text-[10px] text-zinc-500 truncate max-w-[40%]">{t.tradingFooterHint}</span>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-mono text-zinc-700 hidden sm:inline max-w-[120px] truncate" title={symbol}>
              {symbol}
            </span>
            <button
              type="button"
              onClick={() => setSheet("BUY")}
              disabled={!symOk}
              title={!symOk ? t.tradingPairUnsupported : undefined}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 min-w-[5rem]"
            >
              {t.tradingBuy}
            </button>
            <button
              type="button"
              onClick={() => setSheet("SELL")}
              disabled={!symOk}
              title={!symOk ? t.tradingPairUnsupported : undefined}
              className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 min-w-[5rem]"
            >
              {t.tradingSell}
            </button>
          </div>
        </div>
      </div>

      {sheet && (
        <TradingOrderSheet side={sheet} symbol={symbol} lang={lang as CryptoLang} onClose={() => setSheet(null)} />
      )}
    </>
  );
}
