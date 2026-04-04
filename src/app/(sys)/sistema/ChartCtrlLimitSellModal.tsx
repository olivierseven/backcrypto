"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/app/constants";
import { getCryptoT, type CryptoLang } from "@/app/lib/translations";
import { floorQuantityToLotStep } from "@/lib/binance-exchange-filters";

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

function formatQuantityForBinanceOrder(n: number): string {
  if (!Number.isFinite(n) || n <= 0) throw new Error("invalid_quantity");
  const s = n.toFixed(8).replace(/\.?0+$/, "").replace(/\.$/, "");
  return s.length > 0 ? s : "0";
}

type Props = {
  open: boolean;
  onClose: () => void;
  symbol: string;
  limitPrice: number;
  lang: CryptoLang;
  onOrdered?: () => void;
};

export default function ChartCtrlLimitSellModal({ open, onClose, symbol, limitPrice, lang, onOrdered }: Props) {
  const t = getCryptoT(lang).sistema.klines as Record<string, string>;
  const sym = symbol.trim().toUpperCase();
  const baseAsset = sym.endsWith("USDT") && sym.length > 4 ? sym.slice(0, -4) : sym;

  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "success">("loading");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState("");
  const [baseFreeMax, setBaseFreeMax] = useState<number | null>(null);
  /** USDT por operação (Conta), para texto de ajuda. */
  const [defaultUsdtHint, setDefaultUsdtHint] = useState<number | null>(null);
  const [lotFilter, setLotFilter] = useState<{ stepSize: string; minQty: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPhase("loading");
      setErrMsg(null);
      setQtyInput("");
      setBaseFreeMax(null);
      setDefaultUsdtHint(null);
      setLotFilter(null);
      return;
    }
    let cancelled = false;
    setPhase("loading");
    setErrMsg(null);
    setQtyInput("");
    setBaseFreeMax(null);
    setDefaultUsdtHint(null);
    setLotFilter(null);
    Promise.all([
      fetch(`${API_BASE}/user/binance-connection`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API_BASE}/user/binance-connection/balances`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API_BASE}/binance/symbol-filters?symbol=${encodeURIComponent(sym)}`)
        .then(async (r) => (r.ok ? ((await r.json()) as { lot?: { stepSize: string; minQty: string } | null }) : {}))
        .catch(() => ({} as { lot?: null })),
    ])
      .then(([conn, bal, filters]) => {
        if (cancelled) return;
        if (!conn.connected) {
          setErrMsg(t.tradingBalancesErrNotConnected);
          setPhase("error");
          return;
        }
        const defRaw = conn.defaultQuoteUsdtPerOrder;
        const def = defRaw != null ? parseFloat(String(defRaw)) : NaN;
        if (!Number.isFinite(def) || def <= 0) {
          setErrMsg(t.tradingCtrlLimitBuyNoDefault);
          setPhase("error");
          return;
        }
        if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
          setErrMsg(t.tradingError);
          setPhase("error");
          return;
        }
        const list = Array.isArray((bal as { balances?: { asset: string; free: string }[] }).balances)
          ? (bal as { balances: { asset: string; free: string }[] }).balances
          : [];
        const row = list.find((b) => String(b.asset).toUpperCase() === baseAsset.toUpperCase());
        const freeStr = row?.free != null ? String(row.free).trim() : "0";
        const freeNum = parseFloat(freeStr.replace(/\s/g, "").replace(",", "."));
        const free = Number.isFinite(freeNum) && freeNum > 0 ? freeNum : 0;
        if (free <= 0) {
          setErrMsg(t.tradingCtrlLimitSellNoBase.replace("{base}", baseAsset));
          setPhase("error");
          return;
        }
        const qtyFromDefault = def / limitPrice;
        const qtyInitial = Math.min(qtyFromDefault, free);
        if (!Number.isFinite(qtyInitial) || qtyInitial <= 0) {
          setErrMsg(t.tradingCtrlLimitSellNoBase.replace("{base}", baseAsset));
          setPhase("error");
          return;
        }
        let qtyStr = formatQuantityForBinanceOrder(qtyInitial);
        const lot =
          filters && typeof filters === "object" && filters.lot != null && typeof filters.lot.stepSize === "string"
            ? filters.lot
            : null;
        if (lot) {
          setLotFilter({ stepSize: lot.stepSize, minQty: lot.minQty });
          qtyStr = floorQuantityToLotStep(qtyStr, lot.stepSize);
          const adjN = parseFloat(qtyStr);
          const minN = parseFloat(lot.minQty);
          if (!Number.isFinite(adjN) || adjN <= 0) {
            setErrMsg(t.tradingCtrlLimitSellLotRoundsToZero.replace("{base}", baseAsset));
            setPhase("error");
            return;
          }
          if (Number.isFinite(minN) && adjN + 1e-12 < minN) {
            setErrMsg(
              t.tradingCtrlLimitSellBelowMinQty.replace("{minQty}", lot.minQty).replace("{base}", baseAsset)
            );
            setPhase("error");
            return;
          }
        } else {
          setLotFilter(null);
        }
        setBaseFreeMax(free);
        setDefaultUsdtHint(def);
        setQtyInput(qtyStr);
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
  }, [open, baseAsset, limitPrice]);

  const parsedQty = useMemo(() => parseDecimalInput(qtyInput), [qtyInput]);
  const estUsdt =
    parsedQty != null && parsedQty > 0 && limitPrice > 0 ? parsedQty * limitPrice : null;

  async function handleConfirm() {
    const q = parseDecimalInput(qtyInput);
    if (q == null || q <= 0 || submitting) {
      setErrMsg(t.tradingValidationQty);
      return;
    }
    if (baseFreeMax != null && q > baseFreeMax + 1e-12) {
      setErrMsg(t.tradingCtrlLimitSellQtyExceedsBalance.replace("{base}", baseAsset));
      return;
    }
    let qtyStr = formatQuantityForBinanceOrder(q);
    if (lotFilter) {
      qtyStr = floorQuantityToLotStep(qtyStr, lotFilter.stepSize);
      const adjN = parseFloat(qtyStr);
      const minN = parseFloat(lotFilter.minQty);
      if (!Number.isFinite(adjN) || adjN <= 0) {
        setErrMsg(t.tradingCtrlLimitSellLotRoundsToZero.replace("{base}", baseAsset));
        return;
      }
      if (Number.isFinite(minN) && adjN + 1e-12 < minN) {
        setErrMsg(
          t.tradingCtrlLimitSellBelowMinQty.replace("{minQty}", lotFilter.minQty).replace("{base}", baseAsset)
        );
        return;
      }
    }
    setSubmitting(true);
    setErrMsg(null);
    try {
      const priceStr = formatDecimalStr(limitPrice);
      const res = await fetch(`${API_BASE}/user/binance-connection/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          symbol: sym,
          side: "SELL",
          type: "LIMIT",
          price: priceStr,
          quantity: qtyStr,
          timeInForce: "GTC",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { msg?: string; error?: string };
      if (!res.ok) {
        const msg = typeof data.msg === "string" ? data.msg : data.error ?? "order_failed";
        throw new Error(msg);
      }
      setPhase("success");
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
      aria-labelledby="chart-ctrl-limit-sell-title"
      data-no-clear-crosshair
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "success" && !submitting) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-zinc-200 max-w-md w-full p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="chart-ctrl-limit-sell-title" className="text-lg font-semibold text-zinc-900">
          {t.tradingCtrlLimitSellConfirmTitle}
        </h3>
        {phase === "loading" && <p className="text-sm text-zinc-600">{t.tradingCtrlLimitBuyLoading}</p>}
        {((phase === "error" && errMsg) || (phase === "ready" && errMsg)) && (
          <p className="text-sm text-red-700">{errMsg}</p>
        )}
        {phase === "success" && <p className="text-sm text-emerald-700">{t.tradingSuccess}</p>}
        {(phase === "ready" || phase === "success") && qtyInput !== "" && (
          <div className="text-sm space-y-3 text-zinc-800">
            <p className="text-zinc-600">{t.tradingCtrlLimitSellConfirmIntro}</p>
            <p>
              <span className="font-medium">{t.tradingCtrlLimitSellConfirmPrice}:</span>{" "}
              <span className="font-mono">{formatDecimalStr(limitPrice)}</span>
            </p>
            <div>
              <label htmlFor="chart-ctrl-limit-sell-qty" className="block font-medium text-zinc-800 mb-1">
                {t.tradingCtrlLimitSellConfirmQty.replace("{base}", baseAsset)}
              </label>
              <input
                id="chart-ctrl-limit-sell-qty"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={qtyInput}
                onChange={(e) => {
                  setQtyInput(e.target.value);
                  if (errMsg) setErrMsg(null);
                }}
                disabled={submitting || phase === "success"}
                className="w-full font-mono text-sm text-zinc-900 border border-zinc-300 rounded-lg px-3 py-2 bg-white disabled:bg-zinc-100 disabled:text-zinc-600"
              />
              {baseFreeMax != null && defaultUsdtHint != null && phase === "ready" && (
                <p className="text-xs text-zinc-500 mt-1.5">
                  {t.tradingCtrlLimitSellQtyHint
                    .replace("{defaultUsdt}", formatDecimalStr(defaultUsdtHint))
                    .replace("{max}", formatDecimalStr(baseFreeMax))
                    .replace("{base}", baseAsset)}
                </p>
              )}
            </div>
            {estUsdt != null && (phase === "ready" || phase === "success") && (
              <p>
                <span className="font-medium">{t.tradingCtrlLimitSellConfirmEstQuote}:</span>{" "}
                <span className="font-mono tabular-nums">
                  {estUsdt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
              className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              onClick={() => void handleConfirm()}
              disabled={submitting}
            >
              {submitting ? t.tradingSubmitting : t.tradingCtrlLimitSellConfirm}
            </button>
          )}
          {phase === "success" && (
            <button
              type="button"
              className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-medium"
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
