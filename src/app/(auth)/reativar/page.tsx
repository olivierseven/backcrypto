"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE } from "@/app/constants";

export default function ReativarPage() {
  const router = useRouter();
  const [reactivating, setReactivating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleReactivate() {
    if (reactivating) return;

    setReactivating(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/user/reactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? data.error ?? "Erro ao reativar conta");
      }

      const data = await res.json();
      setMessage({ type: "success", text: data.message ?? "Conta reativada com sucesso!" });

      setTimeout(() => {
        router.push("/sistema");
      }, 2000);
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Erro ao reativar conta",
      });
    } finally {
      setReactivating(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="card-crypto-generator rounded-2xl p-6 sm:p-8 shadow-lg bg-amber-50/80 border border-amber-200">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-3">
              Conta Desativada
            </h1>
            <p className="text-base text-zinc-700 leading-relaxed mb-4">
              Sua conta foi desativada e está aguardando exclusão permanente. Você tem 30 dias para reativar sua conta antes que ela seja excluída permanentemente.
            </p>
            <p className="text-sm text-zinc-600 mb-6">
              Clique no botão abaixo para reativar sua conta agora.
            </p>
          </div>

          {message && (
            <div
              className={`mb-4 p-3 rounded-lg ${
                message.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleReactivate}
              disabled={reactivating || message?.type === "success"}
              className="crypto-btn inline-flex items-center justify-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {reactivating ? "Reativando..." : message?.type === "success" ? "Reativado!" : "Reativar Conta"}
            </button>
            <Link
              href="/login"
              target="_self"
              className="inline-flex items-center justify-center px-6 py-3 bg-zinc-700 hover:bg-zinc-800 text-white font-semibold rounded-lg transition-colors"
            >
              Voltar ao login
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-zinc-600">
          Ao reativar, sua conta será restaurada imediatamente e você poderá continuar usando o Backtest Crypto normalmente.
        </p>
      </div>
    </main>
  );
}
