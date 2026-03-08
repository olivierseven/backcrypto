"use client";

import { useCryptoLang } from "../contexts/CryptoLangContext";
import { getCryptoT } from "../lib/translations";

const iconClass =
  "flex items-center justify-center w-12 h-12 rounded-lg border-2 border-neutral-300 bg-white transition-colors text-3xl hover:bg-neutral-50 hover:border-neutral-400 text-neutral-800 hover:text-black";

export default function BioPlayStoreLink() {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema;
  return (
    <a
      href="https://play.google.com/store/apps/details?id=com.sevencoins.biogenerator"
      target="_blank"
      rel="noopener noreferrer"
      className={iconClass}
      title={t.playStoreTitle}
    >
      ⭐
    </a>
  );
}
