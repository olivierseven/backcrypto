"use client";

import { useState, useMemo } from "react";
import { API_BASE } from "@/app/constants";

const LABELS = {
  pt: {
    password: "Senha de acesso",
    submit: "Entrar",
    error: "Senha incorreta.",
    sending: "Verificando…",
  },
  en: {
    password: "Access password",
    submit: "Enter",
    error: "Incorrect password.",
    sending: "Checking…",
  },
};

function getLang(): "pt" | "en" {
  if (typeof document === "undefined") return "pt";
  const m = document.cookie.match(/sevencoins-lang=([^;]+)/);
  return m?.[1] === "en" ? "en" : "pt";
}

export default function BioMaintenanceBypassForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const t = useMemo(() => LABELS[getLang()], []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!password.trim()) return;
    setLoading(true);
    const lang = getLang();
    try {
      const res = await fetch(`${API_BASE}/maintenance-bypass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
        credentials: "include",
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      setError(LABELS[lang].error);
      setPassword("");
    } catch {
      setError(LABELS[lang].error);
    } finally {
      setLoading(false);
    }
  }
  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 border-t border-zinc-200 pt-4">
      <label htmlFor="maint-password" className="text-left text-sm font-medium text-zinc-700">
        {t.password}
      </label>
      <input
        id="maint-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-70"
        placeholder="••••••••"
        autoComplete="current-password"
      />
      {error && <p className="text-left text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-70"
      >
        {loading ? t.sending : t.submit}
      </button>
    </form>
  );
}
