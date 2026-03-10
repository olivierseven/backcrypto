"use client";

import { getCryptoT } from "@/app/lib/translations";

type Lang = "en" | "pt";

export default function ConnectionErrorView({ lang = "pt" }: { lang?: Lang }) {
  const t = getCryptoT(lang).sistema;
  const title = (t as { connectionErrorTitle?: string }).connectionErrorTitle ?? "Erro de conexão";
  const message = (t as { connectionErrorMessage?: string }).connectionErrorMessage ?? "Não foi possível conectar ao servidor. O banco pode estar iniciando. Tente novamente.";
  const refreshLabel = (t as { connectionErrorRefresh?: string }).connectionErrorRefresh ?? "Atualizar página";

  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-4 p-6 bg-zinc-50">
      <p className="text-lg font-medium text-zinc-800">{title}</p>
      <p className="text-sm text-zinc-600 text-center max-w-md">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-4 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700"
      >
        {refreshLabel}
      </button>
    </div>
  );
}
