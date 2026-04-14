"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { ASSET_PREFIX, API_BASE } from "./constants";

const AUTH_BASE =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_APP_URL || ""
    : process.env.NEXT_PUBLIC_APP_URL || "";

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

function shouldSendFromApp(): boolean {
  if (typeof Capacitor !== "undefined" && Capacitor.isNativePlatform?.()) return true;
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /; wv\)|WebView|Capacitor/i.test(ua);
}

export default function BioLoginForm({
  nextPath,
  loginPagePath,
}: {
  nextPath: string;
  loginPagePath: string;
}) {
  const searchParams = useSearchParams();
  const loginFail = searchParams?.get("login") ?? null;
  const verified = searchParams?.get("verified") ?? null;
  const passwordReset = searchParams?.get("password_reset") ?? null;

  const log = useFormLock();

  // Com basePath (ex: /crypto), a API fica em /crypto/api/auth/login
  const basePath = loginPagePath.replace(/\/login$/, "") || "";
  const action = basePath ? `${basePath}/api/auth/login` : (AUTH_BASE ? `${AUTH_BASE.replace(/\/$/, "")}/api/auth/login` : "/api/auth/login");
  // Paths sem basePath para Link — Next adiciona basePath automaticamente
  const registerPath = "/register";
  const resetPasswordPath = "/reset-password";

  const loginFailMessage =
    loginFail === "fail"
      ? "Incorrect email or password."
      : loginFail === "missing"
        ? "Please enter email and password."
        : loginFail === "server"
          ? "Connection failed. Try again in a few seconds."
          : loginFail === "verify_pending"
            ? "Check your email to activate your account."
            : loginFail === "expired"
              ? "Account expired."
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
                style={{
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  MozUserSelect: "none",
                  msUserSelect: "none",
                  pointerEvents: "none",
                  WebkitUserDrag: "none",
                  userDrag: "none",
                } as React.CSSProperties}
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
                aria-label="Versão beta"
              >
                Beta
              </span>
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-zinc-900 md:text-3xl">
                Crypto Strategy
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">by SevenCoins</p>
            </div>
          </header>
        </div>

        <div aria-live="polite" className="mx-auto mb-5 max-w-2xl space-y-2">
          {searchParams?.get("registered") === "ok" && (
            <Alert kind="success">Registration sent! Check your email to confirm.</Alert>
          )}
          {verified === "ok" && (
            <Alert kind="success">Email verified successfully. You can now sign in.</Alert>
          )}
          {passwordReset === "ok" && (
            <Alert kind="success">Password updated. You can now sign in.</Alert>
          )}
          {loginFailMessage && <Alert kind="error">{loginFailMessage}</Alert>}
        </div>

        <div className="mx-auto w-full max-w-md">
          <Card title="Sign in" version={process.env.NEXT_PUBLIC_APP_VERSION}>
            <form
              className="crypto-login-form space-y-2"
              method="post"
              action={action}
              onSubmit={log.onSubmit}
            >
              <input type="hidden" name="next" value={nextPath} />
              <input type="hidden" name="loginPage" value={loginPagePath} />
              <Field
                name="email"
                placeholder="email@example.com"
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
                placeholder="Password"
                required
                autoComplete="current-password"
              />
              <Button
                variant="dark"
                className="w-full"
                disabled={log.locked}
                aria-busy={log.locked}
                type="submit"
              >
                {log.locked ? "Signing in..." : "Sign in"}
              </Button>

              <div className="text-right">
                <Link
                  href={resetPasswordPath}
                  target="_self"
                  prefetch={false}
                  className="text-sm text-zinc-600 underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="my-1.5 flex items-center gap-2">
                <div className="h-px flex-1 bg-zinc-200" />
                <span className="text-xs text-zinc-400">or</span>
                <div className="h-px flex-1 bg-zinc-200" />
              </div>
              <div className="mb-3 flex justify-center">
                <a
                  href={`${API_BASE}/auth/google/start?next=${encodeURIComponent(nextPath)}${shouldSendFromApp() ? "&from_app=1" : ""}`}
                  aria-label="Sign in with Google"
                  className="inline-block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <img
                    src={`${ASSET_PREFIX}/assets/google-login.png`}
                    alt="Sign in with Google"
                    className="block h-12 w-auto select-none cursor-pointer"
                    draggable={false}
                  />
                </a>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-200 text-center">
                <Link
                  href={registerPath}
                  target="_self"
                  className="text-sm text-zinc-600 underline-offset-4 hover:underline"
                >
                  Don't have an account? Sign up
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
