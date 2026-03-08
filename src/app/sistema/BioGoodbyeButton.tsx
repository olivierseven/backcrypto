"use client";

import { useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useCryptoLang } from "../contexts/CryptoLangContext";
import { getCryptoT } from "../lib/translations";
import { ASSET_PREFIX, API_BASE } from "../constants";

const iconClass = "flex items-center justify-center w-12 h-12 rounded-lg border-2 border-neutral-300 bg-white transition-colors hover:bg-neutral-50 hover:border-neutral-400 text-neutral-800 hover:text-black";

export default function BioGoodbyeButton() {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema;
  const [showModal, setShowModal] = useState(false);

  const handleConfirm = () => {
    window.location.href = `${API_BASE}/auth/logout`;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={iconClass}
        title={t.goodbyeTitle}
        aria-label={t.goodbyeTitle}
      >
        <Image src={`${ASSET_PREFIX}/assets/bio/goodbye.WEBP`} alt="" width={28} height={28} className="object-contain" />
      </button>
      {showModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="goodbye-modal-title"
          >
            <div
              className="bg-white/90 backdrop-blur-sm rounded-xl shadow-xl max-w-sm w-full border border-neutral-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              style={{ padding: "1rem 1.25rem" }}
            >
              <h2 id="goodbye-modal-title" className="text-lg font-bold text-zinc-900 mb-2">
                {t.goodbyeTitle}
              </h2>
              <p className="text-sm text-zinc-600 mb-4">{t.goodbyeConfirm}</p>
              <div className="flex justify-end" style={{ gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-neutral-300 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors"
                  style={{ padding: "0.25rem 0.625rem" }}
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="rounded-lg bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 transition-colors"
                  style={{ padding: "0.25rem 0.625rem" }}
                >
                  {t.goodbyeConfirmButton}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
