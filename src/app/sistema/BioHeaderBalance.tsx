"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useCryptoLang } from "../contexts/CryptoLangContext";
import { getCryptoT } from "../lib/translations";
import { API_BASE } from "../constants";

const PAYMENT_RETURN_POLL_INTERVAL_MS = 2000;
const PAYMENT_RETURN_POLL_COUNT = 2;

export default function BioHeaderBalance() {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema;
  const locale = lang === "en" ? "en-US" : "pt-BR";
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(true);
  const paymentReturnPollDone = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/wallet/balance`, { credentials: "include" });
      if (res.ok) {
        const text = await res.text();
        const data = text ? (JSON.parse(text) as { authenticated?: boolean; balance?: number }) : {};
        if (data.authenticated) setBalance(data.balance ?? null);
        else setBalance(null);
      } else setBalance(null);
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Após voltar do pagamento (status=success), refaz o saldo algumas vezes em silêncio até o webhook creditar
  useEffect(() => {
    if (searchParams.get("status") !== "success" || paymentReturnPollDone.current) return;
    paymentReturnPollDone.current = true;
    const t1 = setTimeout(() => refresh(), PAYMENT_RETURN_POLL_INTERVAL_MS);
    const t2 = setTimeout(() => refresh(), PAYMENT_RETURN_POLL_INTERVAL_MS * PAYMENT_RETURN_POLL_COUNT);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [searchParams, refresh]);

  useEffect(() => {
    const onBalanceChanged = () => refresh();
    window.addEventListener("bio-balance-changed", onBalanceChanged);
    return () => window.removeEventListener("bio-balance-changed", onBalanceChanged);
  }, [refresh]);

  if (balance === null && !loading) return null;

  if (loading) {
    return (
      <div className="crypto-header-balance flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/20">
        <div className="w-3 h-3 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
        <span className="text-xs font-medium text-blue-700">...</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setHidden((h) => !h)}
      className="crypto-header-balance flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-colors text-sm font-semibold text-blue-700"
      title={hidden ? t.showBalance : t.hideBalance}
    >
      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
      </svg>
      <span>
        {hidden ? "•••" : (balance ?? 0).toLocaleString(locale)}
      </span>
    </button>
  );
}
