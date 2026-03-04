"use client";

import { useState } from "react";
import { ASSET_PREFIX } from "../constants";

export type BioLang = "en" | "pt";

const LANG_COOKIE = "sevencoins-lang";

function setLangCookie(lang: BioLang) {
  if (typeof document !== "undefined") {
    document.cookie = `${LANG_COOKIE}=${lang};path=/;max-age=31536000`;
  }
}

type Props = {
  currentLang: BioLang;
  onLangChange: (lang: BioLang) => void;
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
  lang: BioLang;
  currentLang: BioLang;
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
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <FlagButton
        lang="en"
        currentLang={currentLang}
        onSelect={() => {
          setLangCookie("en");
          onLangChange("en");
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
          setLangCookie("pt");
          onLangChange("pt");
        }}
        src={FLAG_PT}
        label="PT"
        title="Português"
        ariaLabel="Mudar para português"
      />
    </div>
  );
}
