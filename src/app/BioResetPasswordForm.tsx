"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ASSET_PREFIX, APP_BACKCRYPTO_ROUTE_PREFIX } from "./constants";
import { useCryptoLang } from "./contexts/CryptoLangContext";
import { bioTranslations } from "./lib/translations";

const FORGOT_ACTION = `${APP_BACKCRYPTO_ROUTE_PREFIX}/api/auth/forgot`;
const RESET_ACTION = `${APP_BACKCRYPTO_ROUTE_PREFIX}/api/auth/reset`;
const LOGIN_PATH = `${APP_BACKCRYPTO_ROUTE_PREFIX}/login`;
const RESET_PATH = `${APP_BACKCRYPTO_ROUTE_PREFIX}/reset-password`;

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={
        "w-full min-h-[2.75rem] rounded-xl border border-white/20 bg-white/70 px-4 py-3.5 text-zinc-800 shadow-inner outline-none ring-0 transition placeholder:text-zinc-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 " +
        className
      }
    />
  );
}

function PasswordField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = React.useState(false);
  const { className = "", ...rest } = props;
  return (
    <div className="relative">
      <input
        {...rest}
        type={show ? "text" : "password"}
        className={
          "w-full min-h-[2.75rem] rounded-xl border border-white/20 bg-white/70 px-4 py-3.5 pr-12 text-zinc-800 shadow-inner outline-none ring-0 transition placeholder:text-zinc-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 " +
          className
        }
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute inset-y-0 right-2 my-auto rounded-lg px-2 text-xs text-zinc-600 hover:bg-zinc-100"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      type="submit"
      className={
        "inline-flex items-center justify-center gap-2 min-h-[2.75rem] rounded-xl px-5 py-3 text-sm font-medium transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 text-white shadow bg-[#D4AF37] hover:bg-[#C39E2F] w-full " +
        className
      }
      {...rest}
    />
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bio-login-card card-bio-generator w-full rounded-2xl">
      <h2 className="bio-login-title text-lg font-semibold tracking-tight text-zinc-800">{title}</h2>
      {children}
    </section>
  );
}

function Alert({
  kind = "info",
  children,
}: {
  kind?: "info" | "error" | "success";
  children: React.ReactNode;
}) {
  const styles =
    kind === "error"
      ? "border-red-300/60 bg-red-50 text-red-800"
      : kind === "success"
        ? "border-emerald-300/60 bg-emerald-50 text-emerald-800"
        : "border-indigo-300/60 bg-indigo-50 text-indigo-800";
  const role = kind === "error" ? "alert" : undefined;
  return (
    <div role={role} className={`w-full rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export default function BioResetPasswordForm() {
  const searchParams = useSearchParams();
  const lang = useCryptoLang();
  const t = bioTranslations[lang].resetPassword;

  const token = searchParams?.get("token") ?? null;
  const sent = searchParams?.get("sent") ?? null;
  const err = searchParams?.get("err") ?? null;

  const errMessage =
    err === "missing"
      ? t.errMissing
      : err === "weak"
        ? t.errWeak
        : err === "invalid" || err === "expired"
          ? err === "expired"
            ? t.errExpired
            : t.errInvalid
          : err === "server"
            ? t.errServer
            : null;

  const isSetNewPasswordMode = !!token;

  return (
    <div className="bio-login-page relative overflow-hidden min-h-screen flex flex-col items-center">
      <div className="bio-login-wrap relative mx-auto w-full max-w-5xl flex-1 flex flex-col items-center justify-center px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-4xl w-full">
          <div className="mb-5 flex items-center justify-center">
            <img
              src={`${ASSET_PREFIX}/icon.png`}
              alt="Backtest Crypto"
              width={80}
              height={80}
              className="protected-logo h-20 w-20 object-contain"
              loading="eager"
              decoding="async"
            />
          </div>
          <header className="bio-login-header w-full text-center">
            <h1 className="block w-full text-2xl font-bold leading-tight tracking-tight text-zinc-900 md:text-3xl">
              Backtest Crypto
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">by SevenCoins</p>
          </header>
        </div>

        <div aria-live="polite" className="mx-auto mb-5 max-w-2xl space-y-2">
          {sent === "ok" && !isSetNewPasswordMode && (
            <Alert kind="success">{t.sentOk}</Alert>
          )}
          {errMessage && <Alert kind="error">{errMessage}</Alert>}
        </div>

        <div className="mx-auto w-full max-w-md">
          {isSetNewPasswordMode ? (
            <Card title={t.titleSetNew}>
              <form method="post" action={RESET_ACTION} className="space-y-2">
                <input type="hidden" name="token" value={token} />
                <PasswordField
                  name="password"
                  placeholder={t.newPasswordPlaceholder}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <Button>{t.setNewPassword}</Button>
              </form>
            </Card>
          ) : (
            <Card title={t.title}>
              <form method="post" action={FORGOT_ACTION} className="space-y-2">
                <Field
                  name="email"
                  type="email"
                  placeholder={t.emailPlaceholder}
                  required
                  autoComplete="email"
                />
                <Button>{t.sendLink}</Button>
              </form>
            </Card>
          )}

          <div className="mt-4 text-center">
            <Link
              href={LOGIN_PATH}
              className="text-sm text-zinc-600 underline-offset-4 hover:underline"
            >
              {t.backToLogin}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
