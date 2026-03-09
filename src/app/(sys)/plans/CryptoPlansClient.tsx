"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { API_BASE, APP_BACKCRYPTO_ROUTE_PREFIX, ASSET_PREFIX, SISTEMA_PATH } from "@/app/constants";
import { getCryptoT, type CryptoLang } from "@/app/lib/translations";

type PlanKey = "7" | "49";

/** Valida CPF pelos dígitos verificadores (algoritmo oficial). */
function isValidCpf(digits: string): boolean {
  if (typeof digits !== "string" || digits.length !== 11) return false;
  const d = digits.split("").map(Number);
  if (d.some((n) => !Number.isFinite(n))) return false;
  if (new Set(d).size === 1) return false; // 11111111111, 00000000000, etc.
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += d[i]! * (10 - i);
  let first = (sum * 10) % 11;
  if (first === 10) first = 0;
  if (first !== d[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += d[i]! * (11 - i);
  let second = (sum * 10) % 11;
  if (second === 10) second = 0;
  return second === d[10];
}

function validateCpfForPix(cpf: string, p: { cpfInvalidDigits: string; cpfInvalidCheck: string }): string | null {
  const v = cpf.trim().replace(/\D/g, "");
  if (v.length === 0) return null;
  if (v.length !== 11) return p.cpfInvalidDigits;
  if (!isValidCpf(v)) return p.cpfInvalidCheck;
  return null;
}

export default function CryptoPlansClient({ lang = "pt" }: { lang?: CryptoLang }) {
  const t = getCryptoT(lang);
  const p = t.plans;
  const locale = lang === "en" ? "en-US" : "pt-BR";

  const PLANS: Record<PlanKey, { label: string; coins: number; priceUsd: number; duration: string; img: string; badge?: string }> = {
    "7": {
      label: `$7 → ${(49_000).toLocaleString(locale)} ${p.coins}`,
      coins: 49_000,
      priceUsd: 7,
      duration: `${p.validFor} 1 ${p.month}`,
      img: `${ASSET_PREFIX}/coins/sevencoin_49K.svg`,
    },
    "49": {
      label: `$49 → ${(490_000).toLocaleString(locale)} ${p.coins}`,
      coins: 490_000,
      priceUsd: 49,
      duration: `${p.validFor} 12 ${p.months}`,
      img: `${ASSET_PREFIX}/coins/sevencoin_490K.svg`,
      badge: p.badgeRecommended,
    },
  };
  const sp = useSearchParams();
  const next = useMemo(() => sp.get("next") || SISTEMA_PATH, [sp]);
  /** Path completo para redirect (Stripe/PIX); inclui basePath para location.href */
  const fullReturnTo = useMemo(
    () => (next.startsWith(APP_BACKCRYPTO_ROUTE_PREFIX) ? next : `${APP_BACKCRYPTO_ROUTE_PREFIX}${next}`),
    [next]
  );
  const [accepted, setAccepted] = useState(false);
  type PoliciesTabKey = "terms" | "privacy" | "refund-policy" | "contato";
  const [policiesTab, setPoliciesTab] = useState<PoliciesTabKey | null>(null);
  const [policiesCache, setPoliciesCache] = useState<Record<PoliciesTabKey, string | null>>({
    terms: null,
    privacy: null,
    "refund-policy": null,
    contato: null,
  });
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policiesError, setPoliciesError] = useState(false);
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const [loadingMethod, setLoadingMethod] = useState<"card" | "pix" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [pixCpfPlan, setPixCpfPlan] = useState<PlanKey | null>(null);
  const [pixCpfError, setPixCpfError] = useState<string | null>(null);
  const [cardTaxIdPlan, setCardTaxIdPlan] = useState<PlanKey | null>(null);
  const [cardTaxId, setCardTaxId] = useState("");
  const [cardTaxIdError, setCardTaxIdError] = useState<string | null>(null);
  const [pixOrder, setPixOrder] = useState<{
    orderId: string;
    qrCode: string | null;
    qrCodeUrl: string | null;
    pixCopyPaste: string | null;
    amountCents: number;
    amountUsd?: number;
    coins: number;
    returnTo: string;
  } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const MAX_COINS_BEFORE_PURCHASE = 700_000_000;
  const canPurchase = balance === null || balance < MAX_COINS_BEFORE_PURCHASE;

  useEffect(() => {
    setPoliciesCache({ terms: null, privacy: null, "refund-policy": null, contato: null });
  }, [lang]);

  useEffect(() => {
    fetch(`${API_BASE}/wallet/balance`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { balance?: number }) => {
        if (typeof d?.balance === "number") setBalance(d.balance);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!accepted || policiesTab === null) return;
    const cached = policiesCache[policiesTab];
    if (cached !== null) return;
    setPoliciesLoading(true);
    setPoliciesError(false);
    const type = policiesTab;
    fetch(`${API_BASE}/crypto-policies?type=${type}&lang=${lang}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { html?: string; error?: string }) => {
        if (typeof d?.html === "string") {
          setPoliciesCache((c) => ({ ...c, [type]: d.html }));
          setPoliciesError(false);
        } else {
          setPoliciesError(true);
        }
      })
      .catch(() => setPoliciesError(true))
      .finally(() => setPoliciesLoading(false));
  }, [accepted, policiesTab, policiesCache.terms, policiesCache.privacy, policiesCache["refund-policy"], policiesCache.contato, lang]);

  async function beginCheckout(plan: PlanKey, taxId?: string) {
    if (!accepted || loading || !canPurchase) return;
    setErr(null);
    setLoading(plan);
    setLoadingMethod("card");
    try {
      const res = await fetch(`${API_BASE}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, returnTo: next, taxId: taxId?.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        setErr(data?.error === "balance_limit_reached" ? p.balanceLimitReached : (data?.message ?? data?.error ?? p.errorCheckout));
        setLoading(null);
        setLoadingMethod(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setErr(p.errorNetwork);
      setLoading(null);
      setLoadingMethod(null);
    }
  }

  async function beginCheckoutPix(plan: PlanKey, cpfForRequest?: string) {
    if (!accepted || loading || !canPurchase) return;
    setErr(null);
    setPixCpfError(null);
    setPixCpfPlan(null);
    setPixOrder(null);
    setLoading(plan);
    setLoadingMethod("pix");
    try {
      const res = await fetch(`${API_BASE}/checkout-pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, returnTo: next, cpf: cpfForRequest?.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      setLoading(null);
      setLoadingMethod(null);

      if (!res.ok || !data?.orderId) {
        setErr(data?.error === "balance_limit_reached" ? p.balanceLimitReached : (data?.message ?? data?.error ?? p.errorPix));
        return;
      }
      setPixOrder({
        orderId: data.orderId,
        qrCode: data.qrCode ?? null,
        qrCodeUrl: data.qrCodeUrl ?? null,
        pixCopyPaste: data.pixCopyPaste ?? null,
        amountCents: data.amountCents ?? (plan === "49" ? 26950 : 3850),
        amountUsd: data.amountUsd ?? (plan === "49" ? 49 : 7),
        coins: data.coins ?? (plan === "49" ? 490_000 : 49_000),
        returnTo: fullReturnTo,
      });
    } catch {
      setErr(p.errorNetwork);
      setLoading(null);
      setLoadingMethod(null);
    }
  }

  useEffect(() => {
    if (!pixOrder?.orderId) return;
    const orderId = pixOrder.orderId;
    const returnToUrl = pixOrder.returnTo;
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/checkout-pix/status?orderId=${encodeURIComponent(orderId)}`);
        const data = await res.json().catch(() => null);
        if (data?.status === "COMPLETED") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setPixOrder(null);
          const sep = returnToUrl.includes("?") ? "&" : "?";
          window.location.href = `${returnToUrl}${sep}status=success`;
        }
      } catch {
        // ignore
      }
    };
    pollIntervalRef.current = setInterval(check, 2000);
    check();
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [pixOrder?.orderId, pixOrder?.returnTo]);

  const copyPix = useCallback(() => {
    const text = pixOrder?.pixCopyPaste ?? "";
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          setPixCopied(true);
          setTimeout(() => setPixCopied(false), 2000);
        });
      } else {
        const el = document.getElementById("crypto-pix-copy-input") as HTMLInputElement | null;
        if (el) {
          el.select();
          el.setSelectionRange(0, 99999);
          document.execCommand("copy");
          setPixCopied(true);
          setTimeout(() => setPixCopied(false), 2000);
        }
      }
    } catch {
      const el = document.getElementById("crypto-pix-copy-input") as HTMLInputElement | null;
      if (el) {
        el.select();
        el.setSelectionRange(0, 99999);
        document.execCommand("copy");
        setPixCopied(true);
        setTimeout(() => setPixCopied(false), 2000);
      }
    }
  }, [pixOrder?.pixCopyPaste]);

  return (
    <>
    <div className="card-crypto-generator crypto-card shadow-lg">
      <div className="relative z-10">
                  <p className="text-sm text-zinc-700 mb-4">
                    {p.choosePlan}
                  </p>

                  <label className="mt-4 flex items-start gap-3 rounded-xl border border-purple-300 bg-white/50 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                      className="mt-1 size-4 accent-purple-600"
                    />
                    <span className="text-sm leading-5 text-zinc-700 ">
                      {p.iAgree}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setAccepted(true);
                          setPoliciesTab("terms");
                        }}
                        className="underline hover:no-underline text-purple-700 cursor-pointer bg-transparent border-0 p-0"
                      >
                        {p.terms}
                      </button>
                      {" "}{p.and}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setAccepted(true);
                          setPoliciesTab("privacy");
                        }}
                        className="underline hover:no-underline text-purple-700 cursor-pointer bg-transparent border-0 p-0"
                      >
                        {p.privacyPolicy}
                      </button>.
                    </span>
                  </label>

                  {!canPurchase && balance !== null && (
                    <div className="mt-3 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {p.balanceLimitReached}
                    </div>
                  )}
                  {err && (
                    <div className="mt-3 rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {err}
                    </div>
                  )}

                  {/* Painel PIX — mesmo estilo da labs */}
                  {pixOrder && (
                    <div className="mt-4 rounded-2xl border-2 border-green-600/30 bg-green-50 p-4 md:p-5">
                      <h4 className="text-base font-semibold text-zinc-900 mb-3">{p.payWithPix}</h4>
                      <p className="text-sm text-zinc-700  mb-3">
                        {p.amount}: <strong>R$ {(pixOrder.amountCents / 100).toFixed(2).replace(".", ",")}</strong>
                        {pixOrder.amountUsd != null && (
                          <> <span className="text-zinc-500">(equiv. a ${pixOrder.amountUsd})</span></>
                        )}
                        {" "}— {pixOrder.coins.toLocaleString(locale)} {p.coins}
                      </p>
                      <div className="flex flex-col gap-4">
                        {(pixOrder.qrCodeUrl || pixOrder.qrCode) && (
                          <div className="flex-shrink-0 rounded-xl overflow-hidden bg-white p-2 w-fit">
                            <img
                              src={pixOrder.qrCodeUrl || pixOrder.qrCode || ""}
                              alt="QR Code PIX"
                              width={200}
                              height={200}
                              className="w-[200px] h-[200px] object-contain"
                            />
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-zinc-600  mb-1">{p.orCopyPix}</p>
                          {pixOrder.pixCopyPaste ? (
                            <div className="flex gap-2">
                              <input
                                id="crypto-pix-copy-input"
                                type="text"
                                readOnly
                                value={pixOrder.pixCopyPaste}
                                className="flex-1 min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-mono"
                              />
                              <button
                                type="button"
                                onClick={copyPix}
                                className="crypto-btn rounded-lg bg-green-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-green-700 disabled:opacity-70 min-w-[72px]"
                              >
                                {pixCopied ? p.copied : p.copy}
                              </button>
                            </div>
                          ) : (
                            <p className="text-sm text-zinc-500 ">{p.codeNotAvailable}</p>
                          )}
                        </div>
                        {!(pixOrder.qrCodeUrl || pixOrder.qrCode || pixOrder.pixCopyPaste) && (
                          <p className="text-sm text-amber-700 ">
                            {p.qrNotReturned} <span className="font-mono text-xs">{pixOrder.orderId}</span>
                          </p>
                        )}
                        <p className="text-sm text-green-700  flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          {p.awaitingPayment}
                        </p>
                        <p className="text-xs text-zinc-500 ">{p.pageAutoRefresh}</p>
                      </div>
                    </div>
                  )}

                  {/* Cards dos planos — mesmo formato e cores da labs */}
                  <div className="crypto-plans-grid px-2 py-2 sm:px-3 sm:py-3 grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                    {(Object.entries(PLANS) as [PlanKey, (typeof PLANS)[PlanKey]][]).map(([planKey, plan]) => {
                      const isLoadingCard = loading === planKey && loadingMethod === "card";
                      const isLoadingPix = loading === planKey && loadingMethod === "pix";
                      const anyLoading = loading === planKey;
                      return (
                        <div
                          key={planKey}
                          className="group rounded-3xl p-[1px] bg-gradient-to-br from-white/40 to-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.25)]"
                        >
                          <div
                            className="crypto-plan-value-card relative w-full rounded-3xl shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl focus-within:ring-2 focus-within:ring-purple-300/70"
                            style={{ background: "rgb(255 255 255 / 0.8)" }}
                          >
                            {plan.badge && (
                              <span className="absolute -top-2 -right-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1 text-xs font-semibold text-white shadow">
                                {plan.badge}
                              </span>
                            )}
                            <div className="flex items-center gap-4 text-neutral-900">
                              <div className="relative">
                                <Image
                                  src={plan.img}
                                  alt={`${plan.coins} coins`}
                                  width={72}
                                  height={72}
                                  className="rounded-xl"
                                  unoptimized
                                />
                                <span
                                  className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition
                                     bg-[radial-gradient(120%_90%_at_20%_15%,rgba(0,0,0,0.05),transparent_60%)]"
                                />
                              </div>
                              <div>
                                <div className="text-lg font-semibold tracking-tight">{plan.label}</div>
                                <div className="text-xs text-neutral-600">{plan.duration}</div>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-col gap-2">
                              {pixCpfPlan === planKey ? (
                                <>
                                  <label className="block text-xs font-medium text-neutral-700">{p.cpfForInvoice}</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    placeholder={p.cpfPlaceholder}
                                    value={cpf}
                                    onChange={(e) => {
                                      setCpf(e.target.value.replace(/\D/g, "").slice(0, 11));
                                      setPixCpfError(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        const v = cpf.trim().replace(/\D/g, "");
                                        if (v.length === 0) {
                                          setPixCpfError(p.informCpfOrSkip);
                                          return;
                                        }
                                        const err = validateCpfForPix(cpf, p);
                                        if (err) {
                                          setPixCpfError(err);
                                          return;
                                        }
                                        beginCheckoutPix(planKey, v);
                                      }
                                    }}
                                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                  />
                                  {pixCpfError && <p className="text-xs text-red-600">{pixCpfError}</p>}
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const v = cpf.trim().replace(/\D/g, "");
                                        if (v.length === 0) {
                                          setPixCpfError(p.informCpfOrSkip);
                                          return;
                                        }
                                        const err = validateCpfForPix(cpf, p);
                                        if (err) {
                                          setPixCpfError(err);
                                          return;
                                        }
                                        beginCheckoutPix(planKey, v);
                                      }}
                                      disabled={!accepted || anyLoading || !canPurchase}
                                      className="crypto-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:scale-[.99] disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                      {isLoadingPix ? (
                                        <>
                                          <svg className="size-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                          </svg>
                                          {p.generating}
                                        </>
                                      ) : (
                                        <>{p.generatePix}</>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPixCpfError(p.cpfRequiredForInvoice)}
                                      className="rounded-xl px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 active:scale-[.99]"
                                    >
                                      {p.dontInform}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setPixCpfPlan(null); setPixCpfError(null); }}
                                      className="rounded-xl p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 active:scale-[.99]"
                                      aria-label={p.back}
                                    >
                                      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M19 12H5M12 19l-7-7 7-7" />
                                      </svg>
                                    </button>
                                  </div>
                                </>
                              ) : cardTaxIdPlan === planKey ? (
                                <>
                                  <label className="block text-xs font-medium text-neutral-700">{p.taxIdForCard}</label>
                                  <input
                                    type="text"
                                    inputMode="text"
                                    autoComplete="off"
                                    placeholder={p.taxIdPlaceholder}
                                    value={cardTaxId}
                                    onChange={(e) => {
                                      setCardTaxId(e.target.value.slice(0, 30));
                                      setCardTaxIdError(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        const v = cardTaxId.trim();
                                        if (v.length > 0 && v.length < 3) {
                                          setCardTaxIdError(p.taxIdMinLength ?? "TAX ID deve ter ao menos 3 caracteres");
                                          return;
                                        }
                                        beginCheckout(planKey, v || undefined);
                                      }
                                    }}
                                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  />
                                  {cardTaxIdError && <p className="text-xs text-red-600">{cardTaxIdError}</p>}
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const v = cardTaxId.trim();
                                        if (v.length > 0 && v.length < 3) {
                                          setCardTaxIdError(p.taxIdMinLength ?? "TAX ID deve ter ao menos 3 caracteres");
                                          return;
                                        }
                                        setCardTaxIdError(null);
                                        beginCheckout(planKey, v || undefined);
                                      }}
                                      disabled={!accepted || anyLoading || !canPurchase}
                                      className="crypto-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 active:scale-[.99] disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                      {isLoadingCard ? (
                                        <>
                                          <svg className="size-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                          </svg>
                                          {p.processing}
                                        </>
                                      ) : (
                                        <>{p.payWithCard}</>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setCardTaxIdPlan(null); setCardTaxIdError(null); }}
                                      className="rounded-xl p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 active:scale-[.99]"
                                      aria-label={p.back}
                                    >
                                      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M19 12H5M12 19l-7-7 7-7" />
                                      </svg>
                                    </button>
                                  </div>
                                  <div className="text-xs text-neutral-500">{p.immediateDelivery}</div>
                                </>
                              ) : (
                                <>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => { setCardTaxIdPlan(planKey); setCardTaxIdError(null); setPixCpfPlan(null); }}
                                      disabled={!accepted || anyLoading || !canPurchase}
                                      className="crypto-btn inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 active:scale-[.99] disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                      {isLoadingCard ? (
                                        <>
                                          <svg className="size-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                          </svg>
                                          {p.processing}
                                        </>
                                      ) : (
                                        <>{p.card}</>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setPixCpfPlan(planKey); setPixCpfError(null); setCardTaxIdPlan(null); }}
                                      disabled={!accepted || anyLoading || !canPurchase}
                                      className="crypto-btn inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:scale-[.99] disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                      {isLoadingPix ? (
                                        <>
                                          <svg className="size-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                          </svg>
                                          {p.generating}
                                        </>
                                      ) : (
                                        <>{p.pix}</>
                                      )}
                                    </button>
                                  </div>
                                  <div className="text-xs text-neutral-500">{p.immediateDelivery}</div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
      </div>
    </div>

    {accepted && (
      <div className="card-crypto-generator crypto-card shadow-lg mt-6 overflow-hidden">
        <div className="flex flex-wrap border-b border-purple-100">
          {(["terms", "privacy", "refund-policy", "contato"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setPoliciesTab(tab)}
              className={`flex-1 min-w-[100px] px-3 py-2.5 text-sm font-medium transition-colors ${
                policiesTab === tab
                  ? "bg-purple-50 text-purple-800 border-b-2 border-purple-600 -mb-px"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {tab === "terms" ? p.terms : tab === "privacy" ? p.privacyPolicy : tab === "refund-policy" ? p.refundPolicy : p.contact}
            </button>
          ))}
        </div>
        <div className="h-[min(70vh,420px)] min-h-[280px] bg-white overflow-auto">
          {policiesTab === null && (
            <div className="flex items-center justify-center h-full text-zinc-500 text-sm px-4 text-center">
              {p.policiesClickTab}
            </div>
          )}
          {policiesTab !== null && policiesLoading && (
            <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
              {p.policiesLoading}
            </div>
          )}
          {policiesTab !== null && !policiesLoading && policiesError && (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-center text-sm text-zinc-600">
              <p>{p.policiesError}</p>
              <a
                href={`https://sevencoins.com.br${policiesTab === "terms" ? "/terms" : policiesTab === "privacy" ? "/privacy" : policiesTab === "refund-policy" ? "/refund-policy" : "/contato"}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline font-medium"
              >
                {p.policiesOpenNewTab}
              </a>
            </div>
          )}
          {policiesTab !== null && !policiesLoading && !policiesError && policiesCache[policiesTab] && (
            <div
              className="crypto-policies-content p-4 prose prose-sm max-w-none prose-headings:text-zinc-900 prose-p:text-zinc-700 text-zinc-700"
              dangerouslySetInnerHTML={{ __html: policiesCache[policiesTab]! }}
            />
          )}
        </div>
      </div>
    )}
    </>
  );
}
