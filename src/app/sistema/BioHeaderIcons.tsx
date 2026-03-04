"use client";

import Image from "next/image";
import Link from "next/link";
import { useBioLang } from "../contexts/BioLangContext";
import { useBioDebug } from "./BioDebugContext";
import { getBioT } from "../lib/translations";
import { ASSET_PREFIX } from "../constants";
import BioChartMenu from "./BioChartMenu";

const iconClass = "flex items-center justify-center w-12 h-12 rounded-lg border-2 border-neutral-300 bg-white transition-colors text-3xl hover:bg-neutral-50 hover:border-neutral-400 text-neutral-800 hover:text-black";

export default function BioHeaderIcons() {
  const lang = useBioLang();
  const debug = useBioDebug();
  const t = getBioT(lang).sistema;
  return (
    <div className="flex items-center gap-1.5 flex-nowrap flex-shrink-0">
      <BioChartMenu />
      {debug?.isAdmin && (
        <Link href="/admin" className={iconClass} title="Admin">
          🔑
        </Link>
      )}
      <Link href="/conta" className={iconClass} title={t.accountTitle}>
        👤
      </Link>
      <Link href="/historico" className={iconClass} title={t.historyTitle}>
        📒
      </Link>
      <Link href="/plans" className={iconClass} title={t.plansTitle}>
        <Image src={`${ASSET_PREFIX}/assets/bio/getcoins.WEBP`} alt={t.plansTitle} width={28} height={28} className="object-contain" />
      </Link>
    </div>
  );
}
