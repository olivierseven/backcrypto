"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/app/constants";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { getSessionTabId, getSessionDebugEnabled, setSessionDebugInfo } from "./sessionTabId";

const HEARTBEAT_MS = 30 * 1000; // 30s — mantém a sessão ativa enquanto esta aba estiver aberta

interface SingleTabGuardProps {
  children: React.ReactNode;
}

/**
 * Garante no máximo N abas ativas por utilizador (default 2, controle via banco).
 * Abas expulsas por LRU recebem 409 até ao cooldown ou "Usar esta aba".
 */
export default function SingleTabGuard({ children }: SingleTabGuardProps) {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines as Record<string, string>;
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const claim = useCallback(async (forceTakeOver = false) => {
    let tabId = getSessionTabId();
    if (!tabId) {
      await new Promise((r) => setTimeout(r, 50));
      tabId = getSessionTabId();
    }
    if (!tabId) {
      if (getSessionDebugEnabled()) {
        setSessionDebugInfo({
          tabIdShort: "-",
          tabIdFull: "",
          status: 0,
          resultado: "Abortado (sem tabId)",
          lastAt: Date.now(),
          erro: "sessionStorage indisponível?",
        });
      }
      setAllowed(false);
      setLoading(false);
      return;
    }
    const headers: Record<string, string> = { "X-Tab-Id": tabId };
    if (forceTakeOver) headers["X-Force-Claim"] = "true";
    try {
      const res = await fetch(`${API_BASE}/session/claim`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers,
      });
      const body = await res.json().catch(() => ({}));
      const resultado =
        res.status === 409 ? "BLOQUEADO (outra aba ativa)" : res.ok ? "OK (esta aba ativa)" : "ERRO";
      if (getSessionDebugEnabled()) {
        setSessionDebugInfo({
          tabIdShort: tabId.slice(0, 8),
          tabIdFull: tabId,
          status: res.status,
          resultado,
          lastAt: Date.now(),
          erro: body?.code ?? (res.ok ? undefined : String(body?.error ?? res.status)),
        });
      }
      if (res.status === 409) {
        setAllowed(false);
      } else if (res.ok) {
        setAllowed(true);
      } else {
        setAllowed(false);
      }
    } catch (err) {
      if (getSessionDebugEnabled()) {
        setSessionDebugInfo({
          tabIdShort: tabId.slice(0, 8),
          tabIdFull: tabId,
          status: 0,
          resultado: "Erro de rede",
          lastAt: Date.now(),
          erro: err instanceof Error ? err.message : String(err),
        });
      }
      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    claim();
  }, [claim]);

  useEffect(() => {
    if (!allowed) return;
    const tabId = getSessionTabId();
    if (!tabId) return;
    const id = setInterval(() => {
      fetch(`${API_BASE}/session/claim`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { "X-Tab-Id": tabId },
      }).then((res) => {
        if (res.status === 409) setAllowed(false);
      }).catch(() => {});
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [allowed]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-zinc-100">
        <p className="text-zinc-600 text-sm">{(t as Record<string, string>).loading?.replace("{interval}", "") ?? "Loading…"}</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 p-6 bg-zinc-100">
        <p className="text-zinc-700 text-center text-sm max-w-sm">
          {t.anotherSessionActive ?? "The app is already open in another tab or window."}
        </p>
        <p className="text-zinc-500 text-xs text-center max-w-sm">
          {t.anotherSessionActiveHint ?? "Close the other tab or click below to use this tab instead."}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setAllowed(null);
            claim(true);
          }}
          className="px-4 py-2 rounded-lg bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700"
        >
          {t.anotherSessionActiveRetry ?? "Use this tab"}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
