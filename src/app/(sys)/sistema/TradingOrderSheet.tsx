"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "@/app/constants";
import { getCryptoT, type CryptoLang } from "@/app/lib/translations";
import { useChartHeader } from "./ChartHeaderContext";
import { isValidLimitBuyPriceVsLast, LIMIT_MIN_DISTANCE_FROM_MARKET } from "@/lib/binance-limit-buy-validation";
import { parseSpotOpenOrdersJson } from "@/lib/spot-open-orders-client";
import { DEFAULT_TAKER_COMMISSION_RATE } from "@/lib/binance-default-trade-fee";
import { formatBinanceOrderSubmitUserMessage, type BinanceOrderSubmitErrorJson } from "@/lib/binance-order-submit-error";
import { BINANCE_CONNECTION_CHANGED_EVENT } from "./KlinesChartConstants";

function canCancelBinanceOrder(status: string | null, canceledAt: string | null): boolean {
  if (canceledAt) return false;
  const s = (status ?? "").toUpperCase();
  return s === "NEW" || s === "PARTIALLY_FILLED";
}

function formatHistoryDate(iso: string, lang: CryptoLang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "pt" ? "pt-PT" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

type Side = "BUY" | "SELL";

/** Distância mínima do último preço: 0,1% (compra abaixo; venda acima) — ver `binance-limit-buy-validation`. */

function formatSpotBalance(s: string): string {
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return s;
  if (n === 0) return "0";
  const t = n.toLocaleString(undefined, { maximumFractionDigits: 8 });
  return t;
}

function parseDecimalInput(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  const normalized = s.includes(",") && !s.includes(".") ? s.replace(",", ".") : s.replace(/,/g, "");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatBaseCoinAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const max = n >= 1 ? 6 : 8;
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}

/** Valor em USDT correspondente a `percent` do saldo livre (0–100); 100% usa a string da API para evitar pó. */
function formatUsdtSpendFromPercent(freeStr: string | null, freeNum: number, percent: number): string {
  if (percent <= 0 || freeNum <= 0) return "";
  if (percent >= 100) {
    const s = (freeStr ?? "").trim().replace(/\s/g, "").replace(",", ".");
    return s.length > 0 ? s : String(freeNum);
  }
  const amt = (freeNum * percent) / 100;
  return amt
    .toFixed(8)
    .replace(/\.?0+$/, "")
    .replace(/\.$/, "");
}

/** Preço limite a partir do último valor numérico do gráfico (sem zeros à direita desnecessários). */
function formatPriceForLimitInput(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return n
    .toFixed(8)
    .replace(/\.?0+$/, "")
    .replace(/\.$/, "");
}

/** Formata USDT para os campos de compra (mercado/limite) quando há valor padrão guardado. */
function formatUsdtDefaultAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return n
    .toFixed(8)
    .replace(/\.?0+$/, "")
    .replace(/\.$/, "");
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.733 5.076A10.744 10.744 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M14.14 14.14a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    </svg>
  );
}

/** Quantidade em base para envio à Binance (limite compra: USDT / preço). */
function formatQuantityForBinanceOrder(n: number): string {
  if (!Number.isFinite(n) || n <= 0) throw new Error("invalid_quantity");
  const s = n.toFixed(8).replace(/\.?0+$/, "").replace(/\.$/, "");
  return s.length > 0 ? s : "0";
}

export default function TradingOrderSheet({
  onClose,
  side,
  symbol,
  lang,
}: {
  onClose: () => void;
  side: Side;
  symbol: string;
  lang: CryptoLang;
}) {
  const t = getCryptoT(lang).sistema.klines as Record<string, string>;
  const {
    data: headerData,
    setLimitBuyOrderPriceUsdt,
    setOpenLimitBuyPricesUsdt,
    setOpenLimitBuyOrdersUsdt,
    setOpenLimitSellPricesUsdt,
    setOpenLimitSellOrdersUsdt,
  } = useChartHeader();
  const livePriceText = headerData.priceText;
  const lastPriceUsdt = headerData.lastPriceUsdt;
  const [orderKind, setOrderKind] = useState<"market" | "limit" | "history">("market");
  const [marketBuyUsdt, setMarketBuyUsdt] = useState("");
  /** 0–100: percentagem do USDT spot livre para compra a mercado. */
  const [marketBuyUsdtPercent, setMarketBuyUsdtPercent] = useState(0);
  const [marketQty, setMarketQty] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  /** Compra limite: valor em USDT (como mercado); venda limite: quantidade em base. */
  const [limitBuyUsdt, setLimitBuyUsdt] = useState("");
  const [limitBuyUsdtPercent, setLimitBuyUsdtPercent] = useState(0);
  const [limitQty, setLimitQty] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [spotUsdtFree, setSpotUsdtFree] = useState<string | null>(null);
  const [spotBaseFree, setSpotBaseFree] = useState<string | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState(false);
  const [balancesErrorDetail, setBalancesErrorDetail] = useState<string | null>(null);
  const [takerCommission, setTakerCommission] = useState(DEFAULT_TAKER_COMMISSION_RATE);
  const [sheetOpaque, setSheetOpaque] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<
    {
      binanceOrderId: string;
      side: string;
      orderType: string;
      status: string | null;
      price: string | null;
      origQty: string | null;
      executedQty: string | null;
      canceledAt: string | null;
      createdAt: string;
    }[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  /** Incrementa após cancelar para voltar a pedir a lista ao servidor. */
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const limitPriceSeededRef = useRef(false);
  const marketBuyUsdtPercentRef = useRef(0);
  const limitBuyUsdtPercentRef = useRef(0);
  const [savedDefaultQuoteUsdt, setSavedDefaultQuoteUsdt] = useState<string | null>(null);
  const defaultUsdtAppliedRef = useRef(false);

  const sheetUi = useMemo(() => {
    if (sheetOpaque) {
      return {
        card: "relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl bg-white/70 shadow-xl border border-zinc-200/70",
        header: "sticky top-0 z-10 flex items-center justify-between gap-1.5 px-3 py-2 border-b border-zinc-200/70 bg-zinc-100/70 rounded-t-xl",
        eyeBtn: "rounded-md border border-zinc-300/70 bg-zinc-200/70 p-1 text-zinc-800 hover:bg-zinc-300/70",
        closeBtn: "text-xs font-medium text-zinc-800 rounded-md border border-zinc-300/70 bg-zinc-200/70 px-2 py-1 hover:bg-zinc-300/70",
        unsupported: "text-xs text-amber-800 bg-amber-50/70 border border-amber-200/70 rounded-md px-2 py-1.5",
        toggleWrap: "flex rounded-lg border border-zinc-200/70 p-0.5 bg-zinc-50/70",
        toggleWrapGrid: "grid grid-cols-3 gap-0.5 rounded-md border border-zinc-200/70 p-0.5 bg-zinc-50/70",
        toggleActive: "bg-white/70 shadow-sm border-zinc-200/70 text-zinc-900",
        toggleInactiveHover: "hover:bg-zinc-100/70",
        balanceErr: "border-amber-200/70 bg-amber-50/70",
        balanceOk: "border-zinc-100/70 bg-zinc-50/70",
        lastPrice: "border-zinc-100/70 bg-zinc-50/70",
        input: "w-full font-mono text-sm text-zinc-900 bg-white/70 border border-zinc-300/70 rounded-md px-2.5 py-1.5",
        emeraldBox: "mt-1.5 space-y-1 rounded-md border border-emerald-200/70 bg-emerald-50/70 px-2 py-1.5",
        emeraldBoxSpace: "space-y-1 rounded-md border border-emerald-200/70 bg-emerald-50/70 px-2 py-1.5",
        msgOk: "bg-emerald-50/70 text-emerald-800 border border-emerald-200/70",
        msgErr: "bg-red-50/70 text-red-800 border border-red-200/70",
        submitBuy: "bg-emerald-600/70 hover:bg-emerald-700/70",
        submitSell: "bg-red-600/70 hover:bg-red-700/70",
      };
    }
    return {
      card: "relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl bg-white shadow-xl border border-zinc-200",
      header: "sticky top-0 z-10 flex items-center justify-between gap-1.5 px-3 py-2 border-b border-zinc-200 bg-zinc-100 rounded-t-xl",
      eyeBtn: "rounded-md border border-zinc-300 bg-zinc-200 p-1 text-zinc-800 hover:bg-zinc-300",
      closeBtn: "text-xs font-medium text-zinc-800 rounded-md border border-zinc-300 bg-zinc-200 px-2 py-1 hover:bg-zinc-300",
      unsupported: "text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5",
      toggleWrap: "flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50",
      toggleWrapGrid: "grid grid-cols-3 gap-0.5 rounded-md border border-zinc-200 p-0.5 bg-zinc-50",
      toggleActive: "bg-white shadow-sm border-zinc-200 text-zinc-900",
      toggleInactiveHover: "hover:bg-zinc-100",
      balanceErr: "border-amber-200 bg-amber-50",
      balanceOk: "border-zinc-100 bg-zinc-50",
      lastPrice: "border-zinc-100 bg-zinc-50",
      input: "w-full font-mono text-sm text-zinc-900 bg-white border border-zinc-300 rounded-md px-2.5 py-1.5",
      emeraldBox: "mt-1.5 space-y-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5",
      emeraldBoxSpace: "space-y-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5",
      msgOk: "bg-emerald-50 text-emerald-800 border border-emerald-200",
      msgErr: "bg-red-50 text-red-800 border border-red-200",
      submitBuy: "bg-emerald-600 hover:bg-emerald-700",
      submitSell: "bg-red-600 hover:bg-red-700",
    };
  }, [sheetOpaque]);

  const sym = symbol.trim().toUpperCase();
  const baseAsset = sym.endsWith("USDT") && sym.length > 4 ? sym.slice(0, -4) : sym;
  const isUsdtPair = sym.endsWith("USDT") && sym.length > 4;

  const refreshSpotOpenOrdersForChart = useCallback(async () => {
    if (!isUsdtPair) return;
    try {
      const r = await fetch(`${API_BASE}/user/binance-connection/spot-open-orders?symbol=${encodeURIComponent(sym)}`, {
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      const { prices, orders, sellPrices, sellOrders } = parseSpotOpenOrdersJson(j);
      setOpenLimitBuyPricesUsdt(prices);
      setOpenLimitBuyOrdersUsdt(orders);
      setOpenLimitSellPricesUsdt(sellPrices);
      setOpenLimitSellOrdersUsdt(sellOrders);
    } catch {
      /* ignore */
    }
  }, [
    isUsdtPair,
    sym,
    setOpenLimitBuyPricesUsdt,
    setOpenLimitBuyOrdersUsdt,
    setOpenLimitSellPricesUsdt,
    setOpenLimitSellOrdersUsdt,
  ]);

  useEffect(() => {
    const onConn = () => {
      void refreshSpotOpenOrdersForChart();
    };
    window.addEventListener(BINANCE_CONNECTION_CHANGED_EVENT, onConn);
    return () => window.removeEventListener(BINANCE_CONNECTION_CHANGED_EVENT, onConn);
  }, [refreshSpotOpenOrdersForChart]);

  useEffect(() => {
    if (!isUsdtPair || side !== "BUY" || orderKind !== "limit") {
      setLimitBuyOrderPriceUsdt(null);
      return;
    }
    const p = parseDecimalInput(limitPrice);
    if (p == null || p <= 0) {
      setLimitBuyOrderPriceUsdt(null);
      return;
    }
    setLimitBuyOrderPriceUsdt(p);
  }, [isUsdtPair, side, orderKind, limitPrice, setLimitBuyOrderPriceUsdt]);

  useEffect(() => {
    return () => setLimitBuyOrderPriceUsdt(null);
  }, [setLimitBuyOrderPriceUsdt]);

  const usdtFreeNum = useMemo(() => {
    const n = parseFloat((spotUsdtFree ?? "").trim().replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [spotUsdtFree]);

  marketBuyUsdtPercentRef.current = marketBuyUsdtPercent;
  limitBuyUsdtPercentRef.current = limitBuyUsdtPercent;

  useEffect(() => {
    defaultUsdtAppliedRef.current = false;
  }, [sym, side]);

  useEffect(() => {
    if (!isUsdtPair) return;
    let cancelled = false;
    fetch(`${API_BASE}/user/binance-connection`, { credentials: "include" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          connected?: boolean;
          defaultQuoteUsdtPerOrder?: unknown;
        };
        if (cancelled || !res.ok) return;
        if (!data.connected) {
          setSavedDefaultQuoteUsdt(null);
          return;
        }
        const v = data.defaultQuoteUsdtPerOrder;
        if (v == null) {
          setSavedDefaultQuoteUsdt(null);
          return;
        }
        const s = typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
        setSavedDefaultQuoteUsdt(s.length > 0 ? s : null);
      })
      .catch(() => {
        if (!cancelled) setSavedDefaultQuoteUsdt(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isUsdtPair]);

  useEffect(() => {
    if (!isUsdtPair) return;
    const tk = getCryptoT(lang).sistema.klines as Record<string, string>;
    let cancelled = false;
    setBalancesLoading(true);
    setBalancesError(false);
    setBalancesErrorDetail(null);
    fetch(`${API_BASE}/user/binance-connection/balances`, { credentials: "include" })
      .then(async (res) => {
        const raw: unknown = await res.json().catch(() => ({}));
        const data = raw as {
          balances?: { asset: string; free: string }[];
          usdtSpotFree?: string;
          error?: string;
          msg?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          let detail: string | null = null;
          if (typeof data.msg === "string" && data.msg.trim() !== "") {
            detail = data.msg.trim();
          } else if (data.error === "unauthorized") {
            detail = tk.tradingBalancesErrUnauthorized ?? null;
          } else if (data.error === "not_connected") {
            detail = tk.tradingBalancesErrNotConnected ?? null;
          } else if (data.error === "binance_network") {
            detail = tk.tradingBalancesErrNetwork ?? null;
          } else if (typeof data.error === "string") {
            detail = data.error;
          }
          setBalancesError(true);
          setBalancesErrorDetail(detail);
          setSpotUsdtFree(null);
          setSpotBaseFree(null);
          return;
        }
        const list = Array.isArray(data.balances) ? data.balances : [];
        const usdtFromList = list.find((b) => b.asset === "USDT");
        const usdt =
          typeof data.usdtSpotFree === "string" && data.usdtSpotFree.length > 0
            ? data.usdtSpotFree
            : (usdtFromList?.free ?? "0");
        const base = list.find((b) => b.asset === baseAsset);
        setSpotUsdtFree(usdt);
        setSpotBaseFree(base?.free ?? "0");
      })
      .catch(() => {
        if (!cancelled) {
          setBalancesError(true);
          setBalancesErrorDetail(null);
          setSpotUsdtFree(null);
          setSpotBaseFree(null);
        }
      })
      .finally(() => {
        if (!cancelled) setBalancesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isUsdtPair, baseAsset, lang]);

  useEffect(() => {
    if (!isUsdtPair) return;
    let cancelled = false;
    (async () => {
      let base = DEFAULT_TAKER_COMMISSION_RATE;
      try {
        const cr = await fetch(`${API_BASE}/user/binance-connection`, { credentials: "include" });
        const cj = (await cr.json().catch(() => ({}))) as {
          connected?: boolean;
          feeEstimateTakerFallback?: string | null;
        };
        if (!cancelled && cr.ok && cj.connected && cj.feeEstimateTakerFallback != null && String(cj.feeEstimateTakerFallback).trim() !== "") {
          const x = parseFloat(String(cj.feeEstimateTakerFallback));
          if (Number.isFinite(x) && x >= 0 && x < 1) base = x;
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setTakerCommission(base);
      try {
        const res = await fetch(`${API_BASE}/user/binance-connection/trade-fee?symbol=${encodeURIComponent(sym)}`, {
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { takerCommission?: string };
        if (cancelled || !res.ok) return;
        const t = parseFloat(String(data.takerCommission ?? DEFAULT_TAKER_COMMISSION_RATE));
        if (Number.isFinite(t) && t >= 0 && t < 1) setTakerCommission(t);
      } catch {
        /* mantém base (defeito ou preferência Conta) */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isUsdtPair, sym]);

  useEffect(() => {
    limitPriceSeededRef.current = false;
  }, [sym]);

  /** Ao abrir / ao mudar para Limite: preço da mira no mapa (compra) ou último preço (só uma vez por abertura até mudar símbolo). */
  useEffect(() => {
    if (!isUsdtPair || orderKind !== "limit") return;
    if (limitPriceSeededRef.current) return;
    const fromMira = headerData.crosshairMainPriceUsdt;
    const p =
      side === "BUY" && fromMira != null && Number.isFinite(fromMira) && fromMira > 0
        ? fromMira
        : lastPriceUsdt;
    if (p == null || !Number.isFinite(p) || p <= 0) return;
    setLimitPrice(formatPriceForLimitInput(p));
    limitPriceSeededRef.current = true;
  }, [isUsdtPair, orderKind, lastPriceUsdt, side, headerData.crosshairMainPriceUsdt]);

  const marketBuyEstimate = useMemo(() => {
    if (orderKind !== "market" || side !== "BUY") return null;
    const usdt = parseDecimalInput(marketBuyUsdt);
    const price = lastPriceUsdt;
    if (usdt == null || usdt <= 0 || price == null || !Number.isFinite(price) || price <= 0) return null;
    const baseQty = usdt / price;
    const feeBase = baseQty * takerCommission;
    const takerPct = takerCommission * 100;
    return { baseQty, feeBase, takerPct };
  }, [orderKind, side, marketBuyUsdt, lastPriceUsdt, takerCommission]);

  const limitBuyEstimate = useMemo(() => {
    if (orderKind !== "limit" || side !== "BUY") return null;
    const usdt = parseDecimalInput(limitBuyUsdt);
    const lp = parseDecimalInput(limitPrice);
    if (usdt == null || usdt <= 0 || lp == null || lp <= 0) return null;
    const baseQty = usdt / lp;
    const feeBase = baseQty * takerCommission;
    const takerPct = takerCommission * 100;
    return { baseQty, feeBase, takerPct };
  }, [orderKind, side, limitBuyUsdt, limitPrice, takerCommission]);

  /** Ao atualizar o saldo USDT, mantém o valor do campo alinhado à percentagem escolhida. */
  useEffect(() => {
    if (!spotUsdtFree) return;
    const freeNum = parseFloat(spotUsdtFree.trim().replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(freeNum) || freeNum <= 0) return;
    const mp = marketBuyUsdtPercentRef.current;
    const lp = limitBuyUsdtPercentRef.current;
    if (mp > 0) setMarketBuyUsdt(formatUsdtSpendFromPercent(spotUsdtFree, freeNum, mp));
    if (lp > 0) setLimitBuyUsdt(formatUsdtSpendFromPercent(spotUsdtFree, freeNum, lp));
  }, [spotUsdtFree]);

  /** Pré-preenche USDT nas compras (mercado + limite) com o valor guardado em Conta, até ao saldo livre. */
  useEffect(() => {
    if (!isUsdtPair || side !== "BUY") return;
    if (defaultUsdtAppliedRef.current) return;
    if (spotUsdtFree == null || savedDefaultQuoteUsdt == null) return;
    const d = parseDecimalInput(savedDefaultQuoteUsdt);
    if (d == null || d <= 0) return;
    if (usdtFreeNum <= 0) return;
    const capped = Math.min(d, usdtFreeNum);
    const formatted = formatUsdtDefaultAmount(capped);
    setMarketBuyUsdt(formatted);
    setLimitBuyUsdt(formatted);
    setMarketBuyUsdtPercent(0);
    setLimitBuyUsdtPercent(0);
    defaultUsdtAppliedRef.current = true;
  }, [isUsdtPair, side, spotUsdtFree, savedDefaultQuoteUsdt, usdtFreeNum]);

  useEffect(() => {
    if (!isUsdtPair || orderKind !== "history") return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(false);
    fetch(`${API_BASE}/user/binance-connection/orders?symbol=${encodeURIComponent(sym)}`, { credentials: "include" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          orders?: {
            binanceOrderId: string;
            side: string;
            orderType: string;
            status: string | null;
            price: string | null;
            origQty: string | null;
            executedQty: string | null;
            canceledAt: string | null;
            createdAt: string;
          }[];
        };
        if (cancelled) return;
        if (!res.ok) {
          setHistoryError(true);
          setHistoryOrders([]);
          return;
        }
        setHistoryOrders(Array.isArray(data.orders) ? data.orders : []);
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryError(true);
          setHistoryOrders([]);
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isUsdtPair, orderKind, sym, historyRefreshKey]);

  async function cancelOrder(orderId: string) {
    setMessage(null);
    setCancelingOrderId(orderId);
    try {
      const res = await fetch(`${API_BASE}/user/binance-connection/order/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ symbol: sym, orderId }),
      });
      const data = (await res.json().catch(() => ({}))) as { msg?: string; error?: string };
      if (!res.ok) {
        const msg = typeof data.msg === "string" ? data.msg : data.error ?? "cancel_failed";
        throw new Error(msg);
      }
      setHistoryRefreshKey((k) => k + 1);
      void fetch(`${API_BASE}/user/binance-connection/spot-open-orders?symbol=${encodeURIComponent(sym)}`, { credentials: "include" })
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          const { prices, orders, sellPrices, sellOrders } = parseSpotOpenOrdersJson(j);
          setOpenLimitBuyPricesUsdt(prices);
          setOpenLimitBuyOrdersUsdt(orders);
          setOpenLimitSellPricesUsdt(sellPrices);
          setOpenLimitSellOrdersUsdt(sellOrders);
        })
        .catch(() => {});
    } catch (e: unknown) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : t.tradingError });
    } finally {
      setCancelingOrderId(null);
    }
  }

  async function submit() {
    if (!isUsdtPair || orderKind === "history") return;
    setMessage(null);
    setSubmitting(true);
    try {
      const type = orderKind === "market" ? "MARKET" : "LIMIT";
      const body: Record<string, string> = {
        symbol: sym,
        side,
        type,
      };
      if (type === "MARKET") {
        if (side === "BUY") {
          const q = marketBuyUsdt.trim();
          if (!q) throw new Error(t.tradingValidationBuyUsdt);
          body.quoteOrderQty = q;
        } else {
          const q = marketQty.trim();
          if (!q) throw new Error(t.tradingValidationQty);
          body.quantity = q;
        }
      } else {
        const p = limitPrice.trim();
        if (!p) throw new Error(t.tradingValidationLimit);
        const lp = parseDecimalInput(p);
        if (lp == null || lp <= 0) throw new Error(t.tradingValidationLimit);
        const cur = lastPriceUsdt;
        if (cur == null || !Number.isFinite(cur) || cur <= 0) {
          throw new Error(t.tradingValidationLimitNoLastPrice);
        }
        if (side === "BUY") {
          const u = limitBuyUsdt.trim();
          if (!u) throw new Error(t.tradingValidationBuyUsdt);
          const usdtNum = parseDecimalInput(u);
          if (usdtNum == null || usdtNum <= 0) throw new Error(t.tradingValidationBuyUsdt);
          if (!isValidLimitBuyPriceVsLast(lp, cur)) {
            if (lp >= cur) throw new Error(t.tradingValidationLimitBuyBelow);
            throw new Error(t.tradingValidationLimitBuyMinBelow);
          }
          const qtyNum = usdtNum / lp;
          if (!Number.isFinite(qtyNum) || qtyNum <= 0) throw new Error(t.tradingValidationLimit);
          let qtyStr: string;
          try {
            qtyStr = formatQuantityForBinanceOrder(qtyNum);
          } catch {
            throw new Error(t.tradingValidationLimit);
          }
          body.price = p;
          body.quantity = qtyStr;
          body.timeInForce = "GTC";
        } else {
          const q = limitQty.trim();
          if (!q) throw new Error(t.tradingValidationLimit);
          if (lp <= cur) throw new Error(t.tradingValidationLimitSellAbove);
          if (lp < cur * (1 + LIMIT_MIN_DISTANCE_FROM_MARKET)) {
            throw new Error(t.tradingValidationLimitSellMinAbove);
          }
          body.price = p;
          body.quantity = q;
          body.timeInForce = "GTC";
        }
      }

      const res = await fetch(`${API_BASE}/user/binance-connection/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
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
      void fetch(`${API_BASE}/user/binance-connection/spot-open-orders?symbol=${encodeURIComponent(sym)}`, { credentials: "include" })
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          const { prices, orders, sellPrices, sellOrders } = parseSpotOpenOrdersJson(j);
          setOpenLimitBuyPricesUsdt(prices);
          setOpenLimitBuyOrdersUsdt(orders);
          setOpenLimitSellPricesUsdt(sellPrices);
          setOpenLimitSellOrdersUsdt(sellOrders);
        })
        .catch(() => {});
      setMessage({ type: "ok", text: t.tradingSuccess });
      try {
        window.dispatchEvent(new CustomEvent("backcrypto-spot-order-placed"));
      } catch {
        /* ignore */
      }
      setTimeout(() => onClose(), 1500);
    } catch (e: unknown) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : t.tradingError });
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    side === "BUY"
      ? t.tradingSheetTitleBuy.replace("{symbol}", sym)
      : t.tradingSheetTitleSell.replace("{symbol}", sym);

  return (
    <div
      data-no-clear-crosshair
      className="fixed inset-0 z-[1250] flex items-end sm:items-center justify-start pl-2 pr-2 pt-1.5 pb-[max(3.5rem,calc(env(safe-area-inset-bottom,0px)+2.75rem))] sm:px-3 sm:py-3 bg-transparent"
      role="dialog"
      aria-modal
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label={t.tradingClose} onClick={onClose} />
      <div className={sheetUi.card}>
        <div className={sheetUi.header}>
          <h2 className={`text-sm font-semibold leading-tight min-w-0 flex-1 ${side === "BUY" ? "text-emerald-700" : "text-red-700"}`}>{title}</h2>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-pressed={sheetOpaque}
              aria-label={
                sheetOpaque ? (t.tradingSheetAriaOpaqueDisable ?? "") : (t.tradingSheetAriaOpaqueEnable ?? "")
              }
              onClick={() => setSheetOpaque((v) => !v)}
              className={sheetUi.eyeBtn}
            >
              {sheetOpaque ? <IconEyeOff /> : <IconEye />}
            </button>
            <button type="button" onClick={onClose} className={sheetUi.closeBtn}>
              {t.tradingClose}
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3">
          {!isUsdtPair ? (
            <p className={sheetUi.unsupported}>{t.tradingPairUnsupported}</p>
          ) : (
            <>
              <div className={sheetUi.toggleWrapGrid}>
                <button
                  type="button"
                  onClick={() => setOrderKind("market")}
                  className={`min-w-0 py-1.5 px-0.5 sm:px-1 text-xs font-medium rounded-md transition-colors border border-transparent ${
                    orderKind === "market"
                      ? sheetUi.toggleActive
                      : `text-zinc-600 ${sheetUi.toggleInactiveHover}`
                  }`}
                >
                  {t.tradingMarket}
                </button>
                <button
                  type="button"
                  onClick={() => setOrderKind("limit")}
                  className={`min-w-0 py-1.5 px-0.5 sm:px-1 text-xs font-medium rounded-md transition-colors border border-transparent ${
                    orderKind === "limit"
                      ? sheetUi.toggleActive
                      : `text-zinc-600 ${sheetUi.toggleInactiveHover}`
                  }`}
                >
                  {t.tradingLimit}
                </button>
                <button
                  type="button"
                  onClick={() => setOrderKind("history")}
                  className={`min-w-0 py-1.5 px-0.5 sm:px-1 text-xs font-medium rounded-md transition-colors border border-transparent ${
                    orderKind === "history"
                      ? sheetUi.toggleActive
                      : `text-zinc-600 ${sheetUi.toggleInactiveHover}`
                  }`}
                >
                  {t.tradingHistory}
                </button>
              </div>

              <div
                className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 ${
                  balancesError ? sheetUi.balanceErr : sheetUi.balanceOk
                }`}
              >
                <span className="text-xs font-medium text-zinc-600">
                  {t.tradingSpotAvailable.replace("{asset}", side === "BUY" ? "USDT" : baseAsset)}
                </span>
                <span className="font-mono text-xs text-zinc-900 tabular-nums shrink-0 text-right max-w-[58%] break-words">
                  {balancesLoading
                    ? t.tradingBalancesLoading
                    : balancesError
                      ? balancesErrorDetail ?? t.tradingBalancesError
                      : formatSpotBalance(side === "BUY" ? (spotUsdtFree ?? "0") : (spotBaseFree ?? "0"))}
                </span>
              </div>

              {(orderKind === "market" || orderKind === "limit") && (
                <div className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 ${sheetUi.lastPrice}`}>
                  <span className="text-xs font-medium text-zinc-600">{t.tradingMarketLastPriceLabel}</span>
                  <span className="font-mono text-xs text-zinc-900 tabular-nums shrink-0">{livePriceText ?? "—"}</span>
                </div>
              )}

              {orderKind === "history" && (
                <div className="space-y-1.5">
                  {historyLoading && <p className="text-xs text-zinc-600">{t.tradingHistoryLoading}</p>}
                  {historyError && !historyLoading && (
                    <p className={`text-xs rounded-md px-2 py-1.5 ${sheetUi.msgErr}`}>{t.tradingHistoryErr}</p>
                  )}
                  {!historyLoading && !historyError && historyOrders.length === 0 && (
                    <p className="text-xs text-zinc-600">{t.tradingHistoryEmpty}</p>
                  )}
                  <ul className="max-h-[min(36vh,280px)] space-y-1.5 overflow-y-auto pr-0.5">
                    {historyOrders.map((o) => (
                      <li
                        key={o.binanceOrderId}
                        className={`rounded-md border px-2 py-1.5 ${sheetUi.balanceOk}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium">
                              <span className={o.side === "BUY" ? "text-emerald-700" : "text-red-700"}>
                                {o.side === "BUY" ? t.tradingBuy : t.tradingSell}
                              </span>
                              <span className="text-zinc-700">
                                {o.orderType === "MARKET" ? t.tradingMarket : t.tradingLimit}
                              </span>
                              {o.status ? (
                                <span className="font-mono text-[10px] font-normal text-zinc-500">{o.status}</span>
                              ) : null}
                            </div>
                            <div className="break-all font-mono text-[11px] text-zinc-700 tabular-nums">
                              {o.price != null && o.price !== "" && Number.parseFloat(o.price) > 0
                                ? `@ ${o.price} `
                                : ""}
                              {o.origQty ? `× ${o.origQty}` : ""}
                              {o.executedQty && o.executedQty !== "0" ? ` · ${o.executedQty}` : ""}
                            </div>
                            <div className="text-[10px] text-zinc-500">{formatHistoryDate(o.createdAt, lang)}</div>
                          </div>
                          {canCancelBinanceOrder(o.status, o.canceledAt) ? (
                            <button
                              type="button"
                              disabled={cancelingOrderId === o.binanceOrderId}
                              onClick={() => void cancelOrder(o.binanceOrderId)}
                              className="shrink-0 rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-200 disabled:opacity-50"
                            >
                              {cancelingOrderId === o.binanceOrderId
                                ? t.tradingHistoryCanceling
                                : t.tradingHistoryCancel}
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {orderKind === "market" && side === "BUY" && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <label className="text-xs font-medium text-zinc-600" htmlFor="market-buy-usdt">
                      {t.tradingQuoteAmount}
                    </label>
                    <span className="text-xs font-mono text-zinc-600 tabular-nums shrink-0">{marketBuyUsdtPercent}%</span>
                  </div>
                  <input
                    id="market-buy-usdt-pct"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={marketBuyUsdtPercent}
                    onChange={(e) => {
                      const p = Number(e.target.value);
                      setMarketBuyUsdtPercent(p);
                      if (!spotUsdtFree || usdtFreeNum <= 0) {
                        setMarketBuyUsdt("");
                        return;
                      }
                      setMarketBuyUsdt(formatUsdtSpendFromPercent(spotUsdtFree, usdtFreeNum, p));
                    }}
                    disabled={balancesLoading || balancesError || usdtFreeNum <= 0}
                    aria-label={t.tradingUsdtSpendSliderAria}
                    className="w-full h-1.5 mb-1.5 rounded-md accent-emerald-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <input
                    id="market-buy-usdt"
                    type="text"
                    inputMode="decimal"
                    value={marketBuyUsdt}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setMarketBuyUsdt(raw);
                      if (raw.trim() === "") {
                        setMarketBuyUsdtPercent(0);
                        return;
                      }
                      const n = parseDecimalInput(raw);
                      if (n == null || usdtFreeNum <= 0) return;
                      setMarketBuyUsdtPercent(Math.min(100, Math.max(0, Math.round((n / usdtFreeNum) * 100))));
                    }}
                    placeholder="0.00"
                    className={sheetUi.input}
                  />
                  <p className="text-[10px] leading-snug text-zinc-500 mt-0.5">{t.tradingHintBuyMarketUsdt}</p>
                  {marketBuyEstimate != null && (
                    <div className={sheetUi.emeraldBox}>
                      <div className="flex items-start justify-between gap-2 text-[11px] text-zinc-700">
                        <span className="shrink pt-0.5">{t.tradingMarketBuyEstQtyLabel.replace("{base}", baseAsset)}</span>
                        <span className="font-mono text-right text-zinc-900 tabular-nums">
                          ≈ {formatBaseCoinAmount(marketBuyEstimate.baseQty)} {baseAsset}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-2 text-[11px] text-zinc-700">
                        <span className="shrink pt-0.5">
                          {t.tradingMarketBuyEstFeeLabel
                            .replace("{base}", baseAsset)
                            .replace(
                              "{pct}",
                              marketBuyEstimate.takerPct % 1 === 0
                                ? String(Math.round(marketBuyEstimate.takerPct))
                                : marketBuyEstimate.takerPct.toFixed(3).replace(/\.?0+$/, ""),
                            )}
                        </span>
                        <span className="font-mono text-right text-zinc-900 tabular-nums">
                          ≈ {formatBaseCoinAmount(marketBuyEstimate.feeBase)} {baseAsset}
                        </span>
                      </div>
                      <p className="text-[10px] leading-snug text-zinc-500">{t.tradingMarketBuyEstDisclaimer}</p>
                    </div>
                  )}
                </div>
              )}

              {orderKind === "market" && side === "SELL" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-0.5">
                    {t.tradingQuantity.replace("{base}", baseAsset)}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={marketQty}
                    onChange={(e) => setMarketQty(e.target.value)}
                    placeholder="0.00000000"
                    className={sheetUi.input}
                  />
                  <p className="text-[10px] leading-snug text-zinc-500 mt-0.5">{t.tradingHintSellMarketBase}</p>
                </div>
              )}

              {orderKind === "limit" && side === "BUY" && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-0.5">{t.tradingPrice}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      placeholder="0.00"
                      className={sheetUi.input}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <label className="text-xs font-medium text-zinc-600" htmlFor="limit-buy-usdt">
                        {t.tradingQuoteAmount}
                      </label>
                      <span className="text-xs font-mono text-zinc-600 tabular-nums shrink-0">{limitBuyUsdtPercent}%</span>
                    </div>
                    <input
                      id="limit-buy-usdt-pct"
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={limitBuyUsdtPercent}
                      onChange={(e) => {
                        const p = Number(e.target.value);
                        setLimitBuyUsdtPercent(p);
                        if (!spotUsdtFree || usdtFreeNum <= 0) {
                          setLimitBuyUsdt("");
                          return;
                        }
                        setLimitBuyUsdt(formatUsdtSpendFromPercent(spotUsdtFree, usdtFreeNum, p));
                      }}
                      disabled={balancesLoading || balancesError || usdtFreeNum <= 0}
                      aria-label={t.tradingUsdtSpendSliderAria}
                      className="w-full h-1.5 mb-1.5 rounded-md accent-emerald-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    />
                    <input
                      id="limit-buy-usdt"
                      type="text"
                      inputMode="decimal"
                      value={limitBuyUsdt}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setLimitBuyUsdt(raw);
                        if (raw.trim() === "") {
                          setLimitBuyUsdtPercent(0);
                          return;
                        }
                        const n = parseDecimalInput(raw);
                        if (n == null || usdtFreeNum <= 0) return;
                        setLimitBuyUsdtPercent(Math.min(100, Math.max(0, Math.round((n / usdtFreeNum) * 100))));
                      }}
                      placeholder="0.00"
                      className={sheetUi.input}
                    />
                    <p className="text-[10px] leading-snug text-zinc-500 mt-0.5">
                      {t.tradingHintLimitBuyUsdt.replace("{base}", baseAsset)}
                    </p>
                  </div>
                  {limitBuyEstimate != null && (
                    <div className={sheetUi.emeraldBoxSpace}>
                      <div className="flex items-start justify-between gap-2 text-[11px] text-zinc-700">
                        <span className="shrink pt-0.5">{t.tradingMarketBuyEstQtyLabel.replace("{base}", baseAsset)}</span>
                        <span className="font-mono text-right text-zinc-900 tabular-nums">
                          ≈ {formatBaseCoinAmount(limitBuyEstimate.baseQty)} {baseAsset}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-2 text-[11px] text-zinc-700">
                        <span className="shrink pt-0.5">
                          {t.tradingMarketBuyEstFeeLabel
                            .replace("{base}", baseAsset)
                            .replace(
                              "{pct}",
                              limitBuyEstimate.takerPct % 1 === 0
                                ? String(Math.round(limitBuyEstimate.takerPct))
                                : limitBuyEstimate.takerPct.toFixed(3).replace(/\.?0+$/, ""),
                            )}
                        </span>
                        <span className="font-mono text-right text-zinc-900 tabular-nums">
                          ≈ {formatBaseCoinAmount(limitBuyEstimate.feeBase)} {baseAsset}
                        </span>
                      </div>
                      <p className="text-[10px] leading-snug text-zinc-500">{t.tradingMarketBuyEstDisclaimer}</p>
                    </div>
                  )}
                  <p className="text-[10px] leading-snug text-zinc-500">{t.tradingHintLimitGtc}</p>
                  <p className="text-[10px] leading-snug text-zinc-500">{t.tradingHintLimitPriceBandBuy}</p>
                </div>
              )}

              {orderKind === "limit" && side === "SELL" && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-0.5">{t.tradingPrice}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      placeholder="0.00"
                      className={sheetUi.input}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-0.5">
                      {t.tradingQuantity.replace("{base}", baseAsset)}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={limitQty}
                      onChange={(e) => setLimitQty(e.target.value)}
                      placeholder="0.00000000"
                      className={sheetUi.input}
                    />
                  </div>
                  <p className="text-[10px] leading-snug text-zinc-500">{t.tradingHintLimitGtc}</p>
                  <p className="text-[10px] leading-snug text-zinc-500">{t.tradingHintLimitPriceBandSell}</p>
                </div>
              )}

              {message && (
                <p
                  className={`text-xs rounded-md px-2.5 py-1.5 ${
                    message.type === "ok" ? sheetUi.msgOk : sheetUi.msgErr
                  }`}
                >
                  {message.text}
                </p>
              )}

              {orderKind !== "history" && (
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting || !isUsdtPair}
                  className={`w-full py-2 rounded-md text-sm font-medium text-white disabled:opacity-50 ${
                    side === "BUY" ? sheetUi.submitBuy : sheetUi.submitSell
                  }`}
                >
                  {submitting ? t.tradingSubmitting : t.tradingSubmit}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
