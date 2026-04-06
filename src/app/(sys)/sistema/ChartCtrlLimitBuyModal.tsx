"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/app/constants";
import { getCryptoT, type CryptoLang } from "@/app/lib/translations";
import { floorPriceToTick, floorQuantityToLotStep } from "@/lib/binance-exchange-filters";
import { formatBinanceOrderSubmitUserMessage, type BinanceOrderSubmitErrorJson } from "@/lib/binance-order-submit-error";

function formatDecimalStr(n: number): string {
  return n
    .toFixed(8)
    .replace(/\.?0+$/, "")
    .replace(/\.$/, "");
}

function parseDecimalInput(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  const normalized = s.includes(",") && !s.includes(".") ? s.replace(",", ".") : s.replace(/,/g, "");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatQtyBinance(n: number): string {
  if (!Number.isFinite(n) || n <= 0) throw new Error("invalid_quantity");
  return formatDecimalStr(n);
}

type Props = {
  open: boolean;
  onClose: () => void;
  symbol: string;
  limitPrice: number;
  lang: CryptoLang;
  onOrdered?: () => void;
};

export default function ChartCtrlLimitBuyModal({ open, onClose, symbol, limitPrice, lang, onOrdered }: Props) {
  const t = getCryptoT(lang).sistema.klines as Record<string, string>;
  const sym = symbol.trim().toUpperCase();
  const baseAsset = sym.endsWith("USDT") && sym.length > 4 ? sym.slice(0, -4) : sym;

  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "success">("loading");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [usdtInput, setUsdtInput] = useState("");
  const [usdtFreeMax, setUsdtFreeMax] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPhase("loading");
      setErrMsg(null);
      setUsdtInput("");
      setUsdtFreeMax(null);
      return;
    }
    let cancelled = false;
    setPhase("loading");
    setErrMsg(null);
    setUsdtInput("");
    setUsdtFreeMax(null);
    Promise.all([
      fetch(`${API_BASE}/user/binance-connection`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API_BASE}/user/binance-connection/balances`, { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([conn, bal]) => {
        if (cancelled) return;
        if (!conn.connected) {
          setErrMsg(t.tradingBalancesErrNotConnected);
          setPhase("error");
          return;
        }
        const def =
          conn.defaultQuoteUsdtPerOrder != null ? parseFloat(String(conn.defaultQuoteUsdtPerOrder)) : NaN;
        if (!Number.isFinite(def) || def <= 0) {
          setErrMsg(t.tradingCtrlLimitBuyNoDefault);
          setPhase("error");
          return;
        }
        const list = Array.isArray(bal.balances) ? bal.balances : [];
        const usdtFromList = list.find((b: { asset: string }) => b.asset === "USDT");
        const usdtStr =
          typeof bal.usdtSpotFree === "string" && bal.usdtSpotFree.length > 0
            ? bal.usdtSpotFree
            : (usdtFromList?.free ?? "0");
        const freeNum = parseFloat(String(usdtStr).trim().replace(/\s/g, "").replace(",", "."));
        const free = Number.isFinite(freeNum) && freeNum > 0 ? freeNum : 0;
        const spend = Math.min(def, free);
        if (spend <= 0) {
          setErrMsg(t.tradingCtrlLimitBuyNoUsdt);
          setPhase("error");
          return;
        }
        setUsdtFreeMax(free);
        setUsdtInput(formatDecimalStr(spend));
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setErrMsg(t.tradingError);
          setPhase("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const parsedUsdt = useMemo(() => parseDecimalInput(usdtInput), [usdtInput]);
  const estBase =
    parsedUsdt != null && parsedUsdt > 0 && limitPrice > 0 ? parsedUsdt / limitPrice : null;

  async function handleConfirm() {
    const n = parseDecimalInput(usdtInput);
    if (n == null || n <= 0 || submitting) {
      setErrMsg(t.tradingValidationBuyUsdt);
      return;
    }
    if (usdtFreeMax != null && n > usdtFreeMax + 1e-10) {
      setErrMsg(t.tradingCtrlLimitBuyUsdtExceedsBalance);
      return;
    }
    setSubmitting(true);
    setErrMsg(null);
    try {
      const filtersRes = await fetch(`${API_BASE}/binance/symbol-filters?symbol=${encodeURIComponent(sym)}`);
      const filters = filtersRes.ok
        ? ((await filtersRes.json()) as {
            lot?: { stepSize: string; minQty: string } | null;
            price?: { tickSize: string } | null;
          })
        : {};
      const priceTick = filters?.price?.tickSize;
      let priceStr = formatDecimalStr(limitPrice);
      if (priceTick) {
        priceStr = floorPriceToTick(priceStr, priceTick);
      }
      const px = parseFloat(priceStr);
      if (!Number.isFinite(px) || px <= 0) {
        setErrMsg(t.tradingError);
        return;
      }
      let qtyStr = formatQtyBinance(n / px);
      if (filters?.lot?.stepSize) {
        qtyStr = floorQuantityToLotStep(qtyStr, filters.lot.stepSize);
      }
      const qtyN = parseFloat(qtyStr);
      if (!Number.isFinite(qtyN) || qtyN <= 0) {
        setErrMsg((t as Record<string, string>).tradingOrderLotSizeInvalid ?? t.tradingError);
        return;
      }
      const res = await fetch(`${API_BASE}/user/binance-connection/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          symbol: sym,
          side: "BUY",
          type: "LIMIT",
          price: priceStr,
          quantity: qtyStr,
          timeInForce: "GTC",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as BinanceOrderSubmitErrorJson;
      if (!res.ok) {
        throw new Error(
          formatBinanceOrderSubmitUserMessage(data, {
            tradingBinanceMinNotional: t.tradingBinanceMinNotional,
            tradingBinanceNotionalGeneric: t.tradingBinanceNotionalGeneric,
          }),
        );
      }
      setPhase("success");
      try {
        window.dispatchEvent(new CustomEvent("backcrypto-spot-order-placed"));
      } catch {
        /* ignore */
      }
      onOrdered?.();
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : t.tradingError);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal
      aria-labelledby="chart-ctrl-limit-buy-title"
      data-no-clear-crosshair
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "success" && !submitting) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-zinc-200 max-w-md w-full p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="chart-ctrl-limit-buy-title" className="text-lg font-semibold text-zinc-900">
          {t.tradingCtrlLimitBuyConfirmTitle}
        </h3>
        {phase === "loading" && <p className="text-sm text-zinc-600">{t.tradingCtrlLimitBuyLoading}</p>}
        {((phase === "error" && errMsg) || (phase === "ready" && errMsg)) && (
          <p className="text-sm text-red-700">{errMsg}</p>
        )}
        {phase === "success" && <p className="text-sm text-emerald-700">{t.tradingSuccess}</p>}
        {(phase === "ready" || phase === "success") && usdtInput !== "" && (
          <div className="text-sm space-y-3 text-zinc-800">
            <p className="text-zinc-600">{t.tradingCtrlLimitBuyConfirmIntro}</p>
            <p>
              <span className="font-medium">{t.tradingCtrlLimitBuyConfirmPrice}:</span>{" "}
              <span className="font-mono">{formatDecimalStr(limitPrice)}</span>
            </p>
            <div>
              <label htmlFor="chart-ctrl-limit-usdt" className="block font-medium text-zinc-800 mb-1">
                {t.tradingCtrlLimitBuyConfirmUsdt}
              </label>
              <input
                id="chart-ctrl-limit-usdt"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={usdtInput}
                onChange={(e) => {
                  setUsdtInput(e.target.value);
                  if (errMsg) setErrMsg(null);
                }}
                disabled={submitting || phase === "success"}
                className="w-full font-mono text-sm text-zinc-900 border border-zinc-300 rounded-lg px-3 py-2 bg-white disabled:bg-zinc-100 disabled:text-zinc-600"
              />
              {usdtFreeMax != null && phase === "ready" && (
                <p className="text-xs text-zinc-500 mt-1.5">
                  {t.tradingCtrlLimitBuyUsdtHint.replace("{max}", formatDecimalStr(usdtFreeMax))}
                </p>
              )}
            </div>
            {estBase != null && (phase === "ready" || phase === "success") && (
              <p>
                <span className="font-medium">
                  {t.tradingCtrlLimitBuyConfirmEstBase.replace("{base}", baseAsset)}:
                </span>{" "}
                <span className="font-mono tabular-nums">
                  {estBase.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                </span>
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2 justify-end pt-2">
          {phase !== "success" && (
            <button
              type="button"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
              onClick={onClose}
              disabled={submitting}
            >
              {t.tradingCtrlLimitBuyCancel}
            </button>
          )}
          {phase === "ready" && (
            <button
              type="button"
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              onClick={() => void handleConfirm()}
              disabled={submitting}
            >
              {submitting ? t.tradingSubmitting : t.tradingCtrlLimitBuyConfirm}
            </button>
          )}
          {phase === "success" && (
            <button
              type="button"
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium"
              onClick={onClose}
            >
              {t.tradingClose}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
