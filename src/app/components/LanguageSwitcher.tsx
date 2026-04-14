"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ASSET_PREFIX } from "../constants";
import type { CryptoLang } from "../lib/translations";

export type { CryptoLang };

const LANG_COOKIE = "sevencoins-lang";

function setLangCookie(lang: CryptoLang) {
  if (typeof document !== "undefined") {
    document.cookie = `${LANG_COOKIE}=${lang};path=/;max-age=31536000`;
  }
}

/** Troca só o segmento de idioma (pt|en), mantendo o restante do path. */
function pathWithLang(pathname: string, target: CryptoLang): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "en" || parts[0] === "pt") {
    parts[0] = target;
    return `/${parts.join("/")}`;
  }
  if (parts[0] === "funcionalidade" && parts.length === 1) {
    return `/${target}/funcionalidade`;
  }
  if (parts.length === 0) {
    return `/${target}`;
  }
  return null;
}

type Props = {
  currentLang: CryptoLang;
  onLangChange: (lang: CryptoLang) => void;
  className?: string;
};

const FLAG_EN = `${ASSET_PREFIX}/assets/bio/usa.WEBP`;
const FLAG_PT = `${ASSET_PREFIX}/assets/bio/brazil.WEBP`;

function FlagButton({
  lang,
  currentLang,
  onSelect,
  src,
  label,
  title,
  ariaLabel,
}: {
  lang: CryptoLang;
  currentLang: CryptoLang;
  onSelect: () => void;
  src: string;
  label: string;
  title: string;
  ariaLabel: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const isActive = currentLang === lang;
  return (
    <button
      type="button"
      onClick={onSelect}
      title={title}
      aria-label={ariaLabel}
      className={`rounded-md p-0.5 transition-opacity hover:opacity-90 flex items-center justify-center min-w-[28px] h-5 ${isActive ? "ring-2 ring-neutral-400 dark:ring-neutral-500 ring-offset-2 ring-offset-transparent" : "opacity-70 hover:opacity-100"}`}
    >
      {imgFailed ? (
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
      ) : (
        <img
          src={src}
          alt=""
          className="h-5 w-7 object-cover rounded max-w-none"
          width={28}
          height={20}
          onError={() => setImgFailed(true)}
        />
      )}
    </button>
  );
}

export default function LanguageSwitcher({ currentLang, onLangChange, className = "" }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const navigateToLang = (target: CryptoLang) => {
    setLangCookie(target);
    const next = pathWithLang(pathname, target);
    if (next) router.push(next);
    onLangChange(target);
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <FlagButton
        lang="en"
        currentLang={currentLang}
        onSelect={() => {
          navigateToLang("en");
        }}
        src={FLAG_EN}
        label="EN"
        title="English"
        ariaLabel="Switch to English"
      />
      <FlagButton
        lang="pt"
        currentLang={currentLang}
        onSelect={() => {
          navigateToLang("pt");
        }}
        src={FLAG_PT}
        label="PT"
        title="Português"
        ariaLabel="Mudar para português"
      />
    </div>
  );
}
