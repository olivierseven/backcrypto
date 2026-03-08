"use client";

import { useCryptoLang } from "../contexts/CryptoLangContext";
import { getCryptoT } from "../lib/translations";

const iconClass = "flex items-center justify-center w-12 h-12 rounded-lg border-2 border-neutral-300 bg-white transition-colors text-3xl hover:bg-neutral-50 hover:border-neutral-400 text-neutral-800 hover:text-black";

export default function BioSaveToCloudButton() {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema;

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("bio-open-save-config"));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={iconClass}
      title={t.saveToCloud}
      aria-label={t.saveToCloud}
    >
      <span className="text-[2rem] leading-none block" role="img" aria-hidden>💾</span>
    </button>
  );
}
