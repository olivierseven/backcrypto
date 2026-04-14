"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { ASSET_PREFIX, API_BASE } from "./constants";
import { getCryptoT, type CryptoLang } from "@/app/lib/translations";

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

function PasswordField(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    showLabel: string;
    hideLabel: string;
  }
) {
  const [show, setShow] = React.useState(false);
  const { className = "", showLabel, hideLabel, ...rest } = props;
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
        aria-label={show ? hideLabel : showLabel}
      >
        {show ? hideLabel : showLabel}
      </button>
    </div>
  );
}

function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "dark" }
) {
  const { variant = "primary", className = "", ...rest } = props;
  const base =
    "inline-flex items-center justify-center gap-2 min-h-[2.75rem] rounded-xl px-5 py-3 text-sm font-medium transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";
  const styles =
    variant === "primary"
      ? "text-white shadow bg-[#D4AF37] hover:bg-[#C39E2F]"
      : "bg-zinc-900 text-white hover:bg-zinc-800 shadow";
  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}

function Card({ title, children, version }: { title: string; children: React.ReactNode; version?: string }) {
  return (
    <section className="crypto-login-card card-crypto-generator w-full rounded-2xl">
      <h2 className="crypto-login-title text-lg font-semibold tracking-tight text-zinc-800">{title}</h2>
      {children}
      {version && (
        <div className="mt-4 pt-2 text-center text-xs text-zinc-400" aria-hidden>
          {version}
        </div>
      )}
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

function useFormLock() {
  const [locked, setLocked] = React.useState(false);
  const searchParams = useSearchParams();
  const prevSearchRef = React.useRef(searchParams?.toString() || "");

  React.useEffect(() => {
    const now = searchParams?.toString() || "";
    if (locked && prevSearchRef.current !== now) setLocked(false);
    prevSearchRef.current = now;
  }, [searchParams, locked]);

  React.useEffect(() => {
    if (locked) {
      const t = setTimeout(() => setLocked(false), 10000);
      return () => clearTimeout(t);
    }
  }, [locked]);

  const onSubmit = React.useCallback((e: React.FormEvent<HTMLFormElement>) => {
    setLocked(true);
  }, []);
  return { locked, onSubmit };
}

export default function BioAffiliateLoginForm({
  lang,
  nextPath,
  loginPagePath,
}: {
  lang: CryptoLang;
  nextPath: string;
  loginPagePath: string;
}) {
  const searchParams = useSearchParams();
  const loginFail = searchParams?.get("login") ?? null;
  const t = getCryptoT(lang).landing.affiliatesLoginPage;
  const log = useFormLock();

  const action = `${API_BASE}/auth/afiliados/login`;

  const loginFailMessage =
    loginFail === "fail"
      ? t.loginFail
      : loginFail === "missing"
        ? t.loginMissing
        : loginFail === "server"
          ? t.loginServer
          : loginFail === "inactive"
            ? t.loginInactive
            : loginFail === "not_approved"
              ? t.loginNotApproved
              : loginFail === "no_application"
                ? t.loginNoApplication
                : null;

  return (
    <div className="crypto-login-page relative overflow-hidden min-h-screen flex flex-col items-center">
      <div className="crypto-login-wrap relative mx-auto w-full max-w-5xl flex-1 flex flex-col items-center justify-center px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-4xl w-full">
          <div className="mb-5 flex items-center justify-center">
            <div
              className="protected-logo-container drop-shadow-sm"
              style={{
                userSelect: "none",
                WebkitUserSelect: "none",
                MozUserSelect: "none",
                msUserSelect: "none",
                position: "relative",
                display: "inline-block",
              }}
            >
              <img
                src={`${ASSET_PREFIX}/icon.png`}
                alt="Crypto Strategy"
                width={80}
                height={80}
                className="protected-logo h-20 w-20 object-contain"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                draggable={false}
                style={
                  {
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    MozUserSelect: "none",
                    msUserSelect: "none",
                    pointerEvents: "none",
                    WebkitUserDrag: "none",
                    userDrag: "none",
                  } as React.CSSProperties
                }
              />
              <div
                className="absolute inset-0 z-10 cursor-default"
                style={{
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  MozUserSelect: "none",
                  msUserSelect: "none",
                }}
                aria-hidden
              />
            </div>
          </div>
          <header className="crypto-login-header w-full text-center">
            <div className="relative inline-block">
              <span
                className="absolute -top-1.5 right-0 rounded-sm border border-amber-200 bg-amber-100 px-1 py-0.4 text-[10px] font-semibold uppercase tracking-wider text-amber-800"
                aria-label={t.betaLabel}
              >
                {t.betaLabel}
              </span>
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-zinc-900 md:text-3xl">
                Crypto Strategy
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">{t.brandSubtitle}</p>
            </div>
          </header>
        </div>

        <div aria-live="polite" className="mx-auto mb-5 max-w-2xl space-y-2">
          {loginFailMessage && <Alert kind="error">{loginFailMessage}</Alert>}
        </div>

        <div className="mx-auto w-full max-w-md">
          <Card title={t.cardTitle} version={process.env.NEXT_PUBLIC_APP_VERSION}>
            <form
              className="crypto-login-form space-y-2"
              method="post"
              action={action}
              onSubmit={log.onSubmit}
            >
              <input type="hidden" name="next" value={nextPath} />
              <input type="hidden" name="loginPage" value={loginPagePath} />
              <input type="hidden" name="lang" value={lang} />
              <Field
                name="email"
                placeholder={t.emailPlaceholder}
                type="email"
                required
                autoComplete="email"
                spellCheck={false}
                onBlur={(e) => {
                  e.currentTarget.value = e.currentTarget.value.trim();
                }}
              />
              <PasswordField
                name="password"
                placeholder={t.passwordPlaceholder}
                required
                autoComplete="current-password"
                showLabel={t.showPassword}
                hideLabel={t.hidePassword}
              />
              <Button
                variant="dark"
                className="w-full"
                disabled={log.locked}
                aria-busy={log.locked}
                type="submit"
              >
                {log.locked ? t.signingIn : t.signIn}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
