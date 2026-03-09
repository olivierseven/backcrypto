"use client";

/**
 * Página intermediária para devolver o fluxo OAuth ao app nativo.
 * Após autenticação no Google (Chrome), o callback redireciona aqui com token e next.
 * - No app (Capacitor): redireciona direto para completeUrl.
 * - No navegador: mostra botão para abrir no app (intent URL no Android; user gesture exigido).
 */
import React, { useEffect, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";

export default function OAuthReturnPage() {
  const [msg, setMsg] = useState<string>("Redirecionando…");
  const [showButton, setShowButton] = useState(false);
  const [completeUrl, setCompleteUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const next = params.get("next") || "/crypto/sistema";

    if (!token) {
      setMsg("Token ausente. Redirecionando para login…");
      setTimeout(() => {
        window.location.href = "/crypto/login?login=server";
      }, 1500);
      return;
    }

    const origin = window.location.origin;
    const url = `${origin}/crypto/api/auth/google/complete?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
    setCompleteUrl(url);

    if (Capacitor?.isNativePlatform?.()) {
      setMsg("Redirecionando para o app…");
      window.location.href = url;
      return;
    }

    setMsg("Toque no botão abaixo para abrir no app");
    setShowButton(true);
  }, []);

  const handleOpenApp = useCallback(() => {
    if (!completeUrl) return;
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) {
      const intentUrl = `intent://oauth#Intent;scheme=biogenerator;package=com.sevencoins.biogenerator;S.url=${encodeURIComponent(completeUrl)};S.browser_fallback_url=${encodeURIComponent(completeUrl)};end`;
      window.location.href = intentUrl;
    } else {
      const deepLink = `biogenerator://oauth?url=${encodeURIComponent(completeUrl)}`;
      window.location.href = deepLink;
    }
    setTimeout(() => {
      window.location.href = completeUrl;
    }, 2000);
  }, [completeUrl]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-50 text-zinc-700 p-4"
      data-app="crypto"
    >
      <p className="text-center">{msg}</p>
      {showButton && completeUrl && (
        <button
          type="button"
          onClick={handleOpenApp}
          className="rounded-xl bg-[#D4AF37] px-6 py-3 text-white font-semibold shadow hover:bg-[#C39E2F] transition-colors"
        >
          Abrir no app
        </button>
      )}
    </div>
  );
}
