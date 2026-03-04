"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ASSET_PREFIX } from "./constants";

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
    <section className="bio-login-card card-bio-generator w-full rounded-2xl">
      <h2 className="bio-login-title text-lg font-semibold tracking-tight text-zinc-800">{title}</h2>
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
  return (
    <div role={kind === "error" ? "alert" : undefined} className={`w-full rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

function validateName(v: string) {
  if (!/^[A-Za-z0-9._-]*$/.test(v)) return "Allowed: letters, numbers, . _ -";
  const dot = (v.match(/\./g) || []).length;
  const und = (v.match(/_/g) || []).length;
  const hyf = (v.match(/-/g) || []).length;
  if (dot > 1) return "At most 1 dot (.)";
  if (und > 1) return "At most 1 underscore (_)";
  if (hyf > 1) return "At most 1 hyphen (-)";
  const kinds = Number(dot > 0) + Number(und > 0) + Number(hyf > 0);
  if (kinds > 1) return "Use only one symbol type (. or _ or -)";
  if (/^[._-]/.test(v)) return "Cannot start with . _ -";
  if (/[._-]$/.test(v)) return "Cannot end with . _ -";
  if (v.length < 3) return "At least 3 characters";
  if (v.length > 30) return "At most 30 characters";
  return null;
}

function validatePassword(v: string) {
  if (!v || v.length < 6) return "At least 6 characters";
  return null;
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

export default function BioRegisterForm({ registerPagePath }: { registerPagePath: string }) {
  const searchParams = useSearchParams();
  const registered = searchParams?.get("registered") ?? null;
  const registeredReason = searchParams?.get("reason") ?? null;

  const reg = useFormLock();
  const [regName, setRegName] = React.useState("");
  const [nameErr, setNameErr] = React.useState<string | null>(null);
  const [regPwd, setRegPwd] = React.useState("");
  const [pwdErr, setPwdErr] = React.useState<string | null>(null);

  const basePath = registerPagePath.replace(/\/register$/, "") || "";
  const registerAction = basePath ? `${basePath}/api/auth/register` : "/api/auth/register";
  const loginPath = "/login";

  return (
    <div className="bio-login-page relative overflow-hidden min-h-screen flex flex-col items-center">
      <div className="bio-login-wrap relative mx-auto w-full max-w-5xl flex-1 flex flex-col items-center justify-center px-4 py-6 sm:px-8 sm:py-8">
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
                alt="Backtest Crypto"
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
          <header className="bio-login-header w-full text-center">
            <h1 className="block w-full text-2xl font-bold leading-tight tracking-tight text-zinc-900 md:text-3xl">
              Backtest Crypto
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">by SevenCoins</p>
          </header>
        </div>

        <div aria-live="polite" className="mx-auto mb-5 max-w-2xl space-y-2">
          {registered === "ok" && (
            <Alert kind="success">Registration sent! Check your email to confirm.</Alert>
          )}
          {registered === "fail" && registeredReason === "password" && (
            <Alert kind="error">Invalid password. Use at least 6 characters.</Alert>
          )}
          {registered === "fail" && registeredReason === "email" && (
            <Alert kind="error">Invalid email or already in use.</Alert>
          )}
          {registered === "fail" && registeredReason === "name" && (
            <Alert kind="error">Invalid name. Use letters, numbers and at most one symbol (. _ -).</Alert>
          )}
        </div>

        <div className="mx-auto w-full max-w-md">
          <Card title="Create account" version={process.env.NEXT_PUBLIC_APP_VERSION}>
            <form
              className="bio-login-form space-y-2"
              method="post"
              action={registerAction}
              noValidate
              onSubmit={(e) => {
                reg.onSubmit(e);
                const nErr = validateName(regName);
                const pErr = validatePassword(regPwd);
                setNameErr(nErr);
                setPwdErr(pErr);
                if (nErr || pErr) e.preventDefault();
              }}
            >
              <Field
                name="name"
                placeholder="Your name"
                required
                minLength={3}
                maxLength={30}
                value={regName}
                aria-invalid={!!nameErr}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^A-Za-z0-9._-]/g, "");
                  setRegName(v);
                  if (nameErr) setNameErr(validateName(v));
                }}
                onBlur={(e) => setNameErr(validateName(e.target.value))}
                title="Letters, numbers, . _ - only"
              />
              {nameErr && <div className="text-sm text-red-600">{nameErr}</div>}

              <Field
                name="email"
                placeholder="email@example.com"
                type="email"
                required
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                onBlur={(e) => {
                  e.currentTarget.value = e.currentTarget.value.trim();
                }}
                title="Enter a valid email"
              />

              <PasswordField
                name="password"
                placeholder="Password"
                required
                autoComplete="new-password"
                value={regPwd}
                onChange={(e) => {
                  const v = e.target.value;
                  setRegPwd(v);
                  if (pwdErr) setPwdErr(validatePassword(v));
                }}
                onBlur={(e) => setPwdErr(validatePassword(e.target.value))}
              />
              {pwdErr && <div className="text-sm text-red-600">{pwdErr}</div>}

              <Button
                className="w-full"
                disabled={reg.locked || !!nameErr || !!pwdErr}
                aria-busy={reg.locked}
                type="submit"
              >
                {reg.locked ? "Submitting..." : "Register"}
              </Button>
              <p className="mt-1 text-xs text-zinc-700">
                (password: min 6 characters; uppercase, number and symbol are optional.)
              </p>
            </form>

            <div className="mt-4 pt-3 border-t border-zinc-200 text-center">
              <Link
                href={loginPath}
                target="_self"
                className="text-sm text-zinc-600 underline-offset-4 hover:underline"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
