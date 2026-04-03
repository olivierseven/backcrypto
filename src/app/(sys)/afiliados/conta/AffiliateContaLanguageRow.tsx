"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ASSET_PREFIX } from "@/app/constants";
import type { CryptoLang } from "@/app/lib/translations";

const LANG_COOKIE = "sevencoins-lang";

function setLangCookie(lang: CryptoLang) {
  if (typeof document !== "undefined") {
    document.cookie = `${LANG_COOKIE}=${lang};path=/;max-age=31536000;SameSite=Lax`;
  }
}

export default function AffiliateContaLanguageRow({
  currentLang,
  languageLabel,
}: {
  currentLang: CryptoLang;
  languageLabel: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  function select(target: CryptoLang) {
    if (target === currentLang || saving) return;
    setSaving(true);
    setLangCookie(target);
    router.refresh();
    window.setTimeout(() => setSaving(false), 400);
  }

  return (
    <div className="flex justify-between items-center gap-3">
      <dt className="text-zinc-700 shrink-0">{languageLabel}</dt>
      <dd className="flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => select("en")}
          disabled={saving}
          title="English"
          className={`crypto-btn flex items-center gap-2 rounded-lg border-2 transition-colors px-1.5 py-1 ${currentLang === "en" ? "border-purple-500 bg-purple-50" : "border-zinc-200 bg-white hover:border-zinc-300"} ${saving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <img src={`${ASSET_PREFIX}/assets/bio/usa.WEBP`} alt="" className="w-6 h-4 object-cover rounded-sm" />
          <span className="text-sm font-medium">EN</span>
        </button>
        <button
          type="button"
          onClick={() => select("pt")}
          disabled={saving}
          title="Português"
          className={`crypto-btn flex items-center gap-2 rounded-lg border-2 transition-colors px-1.5 py-1 ${currentLang === "pt" ? "border-purple-500 bg-purple-50" : "border-zinc-200 bg-white hover:border-zinc-300"} ${saving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <img src={`${ASSET_PREFIX}/assets/bio/brazil.WEBP`} alt="" className="w-6 h-4 object-cover rounded-sm" />
          <span className="text-sm font-medium">PT</span>
        </button>
      </dd>
    </div>
  );
}
