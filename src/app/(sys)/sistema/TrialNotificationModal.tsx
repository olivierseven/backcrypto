"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { API_BASE } from "@/app/constants";

const TRIAL_KEYS = ["lite_trial_first_login", "admin_access"];

interface Notification {
  idNotification: string;
  notification: string;
  keySystem: string | null;
}

export default function TrialNotificationModal() {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).notifications;
  const [trialNotification, setTrialNotification] = useState<Notification | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/notifications`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : { notifications: [] })
      .then((data: { notifications?: Notification[] }) => {
        if (cancelled) return;
        const list = data.notifications ?? [];
        const trial = list.find((n) => n.keySystem && TRIAL_KEYS.includes(n.keySystem));
        if (trial) setTrialNotification(trial);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleClose = async () => {
    if (!trialNotification) return;
    try {
      await fetch(`${API_BASE}/notifications/mark-read`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: trialNotification.idNotification }),
      });
    } catch {
      // ignore
    }
    setTrialNotification(null);
  };

  if (!trialNotification || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="trial-modal-title">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-zinc-200">
        <h2 id="trial-modal-title" className="text-lg font-semibold text-zinc-900 mb-3">
          {(t as Record<string, string>).trialModalTitle ?? "Bem-vindo(a) — Trial"}
        </h2>
        <p className="text-sm text-zinc-700 leading-relaxed mb-6 whitespace-pre-wrap">
          {trialNotification.notification}
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-zinc-800 text-white text-sm font-medium rounded-lg hover:bg-zinc-700"
          >
            {(t as Record<string, string>).trialModalOk ?? "OK"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
