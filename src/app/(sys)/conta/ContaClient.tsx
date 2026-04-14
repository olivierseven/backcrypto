"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { validateNickname } from "@/lib/validate-nickname";
import { APP_CRYPTO_ROUTE_PREFIX, ASSET_PREFIX, API_BASE } from "@/app/constants";
import { getCryptoT, translateValidationError, type CryptoLang } from "@/app/lib/translations";
import { Capacitor } from "@capacitor/core";
import { applyNativeStatusBarHidden } from "@/app/lib/applyNativeStatusBar";
import { useAppBarSafe } from "@/app/AppBarSafeContext";
import BinanceConnectionCard from "./BinanceConnectionCard";

interface UserData {
  id: string;
  name: string | null;
  nickname: string | null;
  nicknameChanges: number;
  avatarId: number;
  emailEnc: string;
  emailVerifiedAt: Date | null;
  role: string;
  tier: string;
  createdAt: Date;
  language?: "en" | "pt";
}

interface Props {
  user: UserData;
  email: string | null;
  coinsBalance: number;
  hideStatusBar: boolean;
  language?: "en" | "pt";
  timezoneOffset?: number;
}

const API_PREFIX = `${API_BASE}/user`;

export default function BioContaClient({
  user,
  email,
  coinsBalance,
  hideStatusBar: initialHideStatusBar,
  language: initialLanguage = "en",
  timezoneOffset: initialTimezoneOffset = 0,
}: Props) {
  const router = useRouter();
  const { setAppBarSafe } = useAppBarSafe();
  const [nickname, setNickname] = useState(user.nickname || "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showActiveSubscriptionModal, setShowActiveSubscriptionModal] = useState(false);
  const [checkingDeactivate, setCheckingDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [hideStatusBar, setHideStatusBar] = useState(initialHideStatusBar);
  const [language, setLanguage] = useState<"en" | "pt">(initialLanguage);
  const [timezoneOffset, setTimezoneOffset] = useState(Math.max(-12, Math.min(12, initialTimezoneOffset)));
  const [savingPref, setSavingPref] = useState(false);
  const [savingLang, setSavingLang] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
    void applyNativeStatusBarHidden(hideStatusBar);
  }, [hideStatusBar]);

  function handleNicknameChange(value: string) {
    setNickname(value);
    setValidationError(validateNickname(value));
    if (message) setMessage(null);
  }

  async function handleSaveNickname() {
    if (saving) return;
    const error = validateNickname(nickname);
    if (error) {
      setValidationError(error);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_PREFIX}/update-nickname`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "nickname_already_exists") throw new Error(t.conta.nicknameInUse);
        if (data.error === "nickname_change_limit_reached") throw new Error(data.message || t.conta.nicknameLimitError);
        throw new Error(data.error || t.conta.errorSave);
      }
      setMessage({ type: "success", text: t.conta.nicknameSavedSuccess });
      router.refresh();
      setTimeout(() => setMessage(null), 3000);
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || t.conta.errorSave });
    } finally {
      setSaving(false);
    }
  }

  async function handleTimezoneChange(delta: number) {
    if (savingTimezone) return;
    const next = Math.max(-12, Math.min(12, timezoneOffset + delta));
    if (next === timezoneOffset) return;
    setSavingTimezone(true);
    setTimezoneOffset(next);
    try {
      const res = await fetch(`${API_PREFIX}/notification-preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ timezoneOffset: next }),
      });
      if (!res.ok) throw new Error(t.conta.errorUpdate);
      router.refresh();
    } catch {
      setTimezoneOffset(timezoneOffset);
    } finally {
      setSavingTimezone(false);
    }
  }

  async function handleLanguageSelect(value: "en" | "pt") {
    if (savingLang || value === language) return;
    setSavingLang(true);
    const prev = language;
    setLanguage(value);
    try {
      const res = await fetch(`${API_PREFIX}/notification-preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ language: value }),
      });
      if (!res.ok) {
        setLanguage(prev);
        throw new Error(t.conta.errorUpdate);
      }
      router.refresh();
    } catch {
      setLanguage(prev);
    } finally {
      setSavingLang(false);
    }
  }

  async function handleHideStatusBarToggle(value: boolean) {
    if (savingPref) return;
    setSavingPref(true);
    const prev = hideStatusBar;
    try {
      const res = await fetch(`${API_PREFIX}/notification-preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hideStatusBar: value }),
      });
      if (!res.ok) {
        throw new Error(t.conta.errorUpdate);
      }
      setHideStatusBar(value);
      setAppBarSafe({ hideStatusBar: value });

      if (Capacitor.isNativePlatform()) {
        try {
          await applyNativeStatusBarHidden(value);
        } catch {
          /* bridge opcional; reload ainda aplica layout */
        }
        setTimeout(() => {
          window.location.reload();
        }, 0);
        return;
      }
      router.refresh();
    } catch {
      setHideStatusBar(prev);
    } finally {
      setSavingPref(false);
    }
  }

  async function handleDeactivateAccount() {
    if (deactivating) return;
    setDeactivating(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_PREFIX}/deactivate`, { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = data.error === "active_subscription" ? t.conta.deactivateActiveSubscription : (data.error || t.conta.errorDeactivate);
        throw new Error(message);
      }
      setShowDeactivateModal(false);
      setMessage({ type: "success", text: t.conta.deactivatedSuccess });
      setTimeout(() => router.push("/login?deactivated=true"), 3000);
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || t.conta.errorDeactivate });
    } finally {
      setDeactivating(false);
    }
  }

  const canChangeNickname = user.role !== "user" || user.nicknameChanges < 2;
  const remainingChanges = user.role === "user" ? Math.max(0, 2 - user.nicknameChanges) : null;
  const t = getCryptoT(language as CryptoLang);

  return (
    <>
    <div className="space-y-6">
      {/* Card: Informações de Perfil */}
      <div className="card-crypto-generator crypto-card hidden">
        <h2 className="text-base font-semibold mb-3 text-zinc-900">{t.conta.profileInfo}</h2>
        <div className="crypto-form">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">{t.conta.fullName}</label>
            <input
              type="text"
              value={user.name || t.conta.notDefined}
              disabled
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 bg-zinc-100 text-zinc-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">{t.conta.nickname} <span className="text-red-500">*</span></label>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <input
                type="text"
                value={nickname}
                onChange={(e) => handleNicknameChange(e.target.value)}
                placeholder={t.conta.nicknamePlaceholder}
                maxLength={30}
                required
                disabled={!canChangeNickname}
                className={`flex-1 min-w-0 px-4 py-2 rounded-lg border bg-white text-zinc-900 focus:ring-2 outline-none ${
                  !canChangeNickname ? "border-zinc-300 bg-zinc-100 text-zinc-500 cursor-not-allowed" :
                  validationError ? "border-red-500 focus:ring-red-500" : "border-zinc-300 focus:ring-purple-500"
                }`}
              />
              <button
                onClick={handleSaveNickname}
                disabled={saving || !nickname.trim() || nickname === (user.nickname || "") || !!validationError || !canChangeNickname}
                className="crypto-btn shrink-0 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap px-3 py-2"
              >
                {saving ? t.conta.saving : t.conta.save}
              </button>
            </div>
            {!canChangeNickname && (
              <p className="mt-2 text-sm text-amber-800">⚠️ {t.conta.nicknameLimitReached}</p>
            )}
            {canChangeNickname && remainingChanges !== null && (
              <p className="mt-1 text-xs text-zinc-500">{t.conta.changesRemaining} {remainingChanges} {t.conta.of} 2.</p>
            )}
            {validationError && canChangeNickname && <p className="mt-1 text-xs text-red-600">⚠️ {translateValidationError(validationError, language as CryptoLang) ?? validationError}</p>}
        {message && (
          <div className={`p-3 rounded-lg ${message.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
            {message.text}
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Card: Informações da Conta */}
      <div className="card-crypto-generator crypto-card">
        <h2 className="text-base font-semibold text-zinc-900 mb-3">{t.conta.accountInfo}</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-zinc-700">{t.conta.plan}</dt><dd className="font-semibold uppercase">{user.tier}</dd></div>
          <div className="flex justify-between"><dt className="text-zinc-700">{t.conta.role}</dt><dd>{user.role}</dd></div>
          <div className="flex justify-between"><dt className="text-zinc-700">{t.conta.verification}</dt><dd className={user.emailVerifiedAt ? "text-emerald-600" : "text-amber-600"}>{user.emailVerifiedAt ? t.conta.verified : t.conta.pending}</dd></div>
          <div className="flex justify-between"><dt className="text-zinc-700">{t.conta.memberSince}</dt><dd>{new Date(user.createdAt).toLocaleDateString(language === "en" ? "en-US" : "pt-BR")}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-zinc-700">{t.conta.userId}</dt><dd className="font-mono text-xs text-right break-all">{user.id}</dd></div>
          <div className="flex justify-between"><dt className="text-zinc-700">{t.conta.email}</dt><dd>{email || "—"}</dd></div>
          <div className="flex justify-between items-center">
            <dt className="text-zinc-700">{t.conta.coinBalance}</dt>
            <dd className="font-semibold">{coinsBalance.toLocaleString(language === "en" ? "en-US" : "pt-BR")} coins</dd>
          </div>
          <div className="flex justify-between items-center gap-3">
            <dt className="text-zinc-700 shrink-0">{t.conta.timezone}</dt>
            <dd className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTimezoneChange(-1)}
                disabled={savingTimezone || timezoneOffset <= -12}
                className="crypto-btn flex items-center justify-center w-8 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t.conta.timezoneDecrease}
              >
                −
              </button>
              <span className="min-w-[4rem] text-center font-mono text-sm font-medium">
                UTC{timezoneOffset >= 0 ? "+" : ""}{timezoneOffset}
              </span>
              <button
                type="button"
                onClick={() => handleTimezoneChange(1)}
                disabled={savingTimezone || timezoneOffset >= 12}
                className="crypto-btn flex items-center justify-center w-8 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t.conta.timezoneIncrease}
              >
                +
              </button>
            </dd>
          </div>
          <div className="flex justify-between items-center gap-3">
            <dt className="text-zinc-700 shrink-0">{t.conta.language}</dt>
            <dd className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => handleLanguageSelect("en")}
                disabled={savingLang}
                title="English"
                className={`crypto-btn flex items-center gap-2 rounded-lg border-2 transition-colors px-1.5 py-1 ${language === "en" ? "border-purple-500 bg-purple-50" : "border-zinc-200 bg-white hover:border-zinc-300"} ${savingLang ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <img src={`${ASSET_PREFIX}/assets/bio/usa.WEBP`} alt="" className="w-6 h-4 object-cover rounded-sm" />
                <span className="text-sm font-medium">EN</span>
              </button>
              <button
                type="button"
                onClick={() => handleLanguageSelect("pt")}
                disabled={savingLang}
                title="Português"
                className={`crypto-btn flex items-center gap-2 rounded-lg border-2 transition-colors px-1.5 py-1 ${language === "pt" ? "border-purple-500 bg-purple-50" : "border-zinc-200 bg-white hover:border-zinc-300"} ${savingLang ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <img src={`${ASSET_PREFIX}/assets/bio/brazil.WEBP`} alt="" className="w-6 h-4 object-cover rounded-sm" />
                <span className="text-sm font-medium">PT</span>
              </button>
            </dd>
          </div>
        </dl>
        <div className="mt-2.5">
          <Link href="/historico" className="inline-block rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-sm font-medium text-zinc-900 px-3 py-2">
            {t.conta.viewTransactionHistory}
          </Link>
        </div>
      </div>

      <BinanceConnectionCard language={language as CryptoLang} />

      {/* Card: Preferências do app */}
      <div className="card-crypto-generator crypto-card">
        <h2 className="text-base font-semibold text-zinc-900 mb-3">📱 {t.conta.appPreferences}</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900">{t.conta.hideStatusBar}</p>
            <p className="text-xs text-zinc-600">{t.conta.hideStatusBarDesc}</p>
          </div>
          <button
            onClick={() => handleHideStatusBarToggle(!hideStatusBar)}
            disabled={savingPref}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${hideStatusBar ? "bg-purple-600" : "bg-zinc-300"} ${savingPref ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${hideStatusBar ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </div>

      {/* Card: Desativar/Excluir */}
      <div className="card-crypto-generator crypto-card">
        <h2 className="text-base font-semibold text-zinc-900 mb-3">{t.conta.deactivateSection}</h2>
        <p className="text-sm text-zinc-700 mb-4">{t.conta.deactivateDesc}</p>
        <button
          onClick={async () => {
            if (checkingDeactivate) return;
            setCheckingDeactivate(true);
            setMessage(null);
            try {
              const res = await fetch(`${API_PREFIX}/deactivate`, { method: "GET" });
              const data = await res.json().catch(() => ({}));
              if (data.canDeactivate === false && data.reason === "active_subscription") {
                setShowActiveSubscriptionModal(true);
              } else {
                setShowDeactivateModal(true);
              }
            } catch {
              setMessage({ type: "error", text: t.conta.errorDeactivate });
            } finally {
              setCheckingDeactivate(false);
            }
          }}
          disabled={checkingDeactivate}
          className="crypto-btn crypto-btn-top-spaced rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium px-3 py-2 disabled:opacity-50"
        >
          {checkingDeactivate ? "…" : t.conta.deactivateAccount}
        </button>
      </div>

    </div>

      {showActiveSubscriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <p className="text-sm text-zinc-700 mb-4">{t.conta.deactivateActiveSubscription}</p>
            <div className="flex flex-wrap gap-3 justify-end">
              <button onClick={() => setShowActiveSubscriptionModal(false)} className="crypto-btn rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 font-medium">
                {t.conta.understood}
              </button>
              <Link href="/historico" onClick={() => setShowActiveSubscriptionModal(false)} className="crypto-btn rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2">
                {t.conta.goToHistory}
              </Link>
            </div>
          </div>
        </div>
      )}

      {showDeactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">{t.conta.confirmDeactivation}</h3>
            <p className="text-sm text-zinc-700 mb-4">{t.conta.confirmDeactivationDesc}</p>
            <div className="flex flex-wrap gap-4 justify-end">
              <button onClick={() => setShowDeactivateModal(false)} disabled={deactivating} className="crypto-btn rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 font-medium disabled:opacity-50">
                {t.conta.cancel}
              </button>
              <button onClick={handleDeactivateAccount} disabled={deactivating} className="crypto-btn rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50">
                {deactivating ? t.conta.deactivating : t.conta.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
