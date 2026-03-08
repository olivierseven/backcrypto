"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { getCryptoT } from "@/app/lib/translations";
import { API_BASE } from "@/app/constants";

interface Notification {
  idNotification: string;
  senderType: "system" | "user";
  sender: string | null;
  notification: string;
  createdAt: string;
  keySystem: string | null;
  ativo: boolean;
}

const API = `${API_BASE}/notifications`;

export default function BioNotificationBell() {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).notifications;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch(API);
      if (res.ok) {
        const text = await res.text();
        const data = text ? (JSON.parse(text) as { notifications?: Notification[] }) : {};
        if (data.notifications) setNotifications(data.notifications);
        else setNotifications([]);
      } else setNotifications([]);
    } catch {
      setNotifications([]);
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`${API}/mark-read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      setNotifications((prev) => prev.filter((n) => n.idNotification !== notificationId));
    } catch {
      setNotifications((prev) => prev.filter((n) => n.idNotification !== notificationId));
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await fetch(`${API}/delete?id=${encodeURIComponent(notificationId)}`, { method: "DELETE" });
      setNotifications((prev) => {
        const next = prev.filter((n) => n.idNotification !== notificationId);
        if (next.length === 0) setShowDropdown(false);
        return next;
      });
    } catch {
      setNotifications((prev) => prev.filter((n) => n.idNotification !== notificationId));
    }
  };

  const handleMarkAllAsRead = async () => {
    const toMark = notifications.filter((n) => n.ativo).map((n) => n.idNotification);
    for (const id of toMark) {
      await fetch(`${API}/mark-read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
    }
    await loadNotifications();
    setShowDropdown(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return t.now;
    if (diffInHours < 24) return t.hoursAgo.replace("{n}", String(diffInHours));
    const diffInDays = Math.floor(diffInHours / 24);
    return t.daysAgo.replace("{n}", String(diffInDays));
  };

  useEffect(() => {
    mounted.current = true;
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, []);

  const unreadCount = notifications.filter((n) => n.ativo).length;

  const DROPDOWN_WIDTH = 320;
  const toggleDropdown = () => {
    if (!showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const preferredLeft = rect.right - DROPDOWN_WIDTH;
      setDropdownPosition({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(preferredLeft, window.innerWidth - DROPDOWN_WIDTH - 8)),
      });
    }
    setShowDropdown(!showDropdown);
  };

  return (
    <div className="relative flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        className="relative p-2 text-neutral-600 hover:text-neutral-900 transition-colors"
        title={t.title}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold min-w-[1.25rem]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {showDropdown &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setShowDropdown(false)} aria-hidden />
            <div
              className="fixed w-80 bg-white border border-zinc-200 rounded-lg shadow-xl z-[9999] max-h-96 overflow-hidden"
              style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
            >
              <div className="p-4 border-b border-zinc-200">
                <h3 className="text-lg font-semibold text-zinc-900">🔔 {t.title}</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-zinc-300 border-t-purple-500 mx-auto" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-center text-zinc-500">{t.empty}</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.idNotification}
                      className={`p-4 border-b border-zinc-100 hover:bg-zinc-50 ${n.ativo ? "bg-blue-50/50" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg shrink-0">{n.senderType === "system" ? "🤖" : "👤"}</span>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm text-zinc-900 leading-relaxed cursor-pointer"
                            onClick={() => n.ativo && markAsRead(n.idNotification)}
                          >
                            {n.notification}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-zinc-500">{formatDate(n.createdAt)}</span>
                            {n.ativo && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{t.new}</span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(n.idNotification); }}
                                  className="text-red-500 hover:text-red-700"
                                  title={t.delete}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {notifications.length > 0 && unreadCount > 0 && (
                <div className="p-3 border-t border-zinc-200 bg-zinc-50">
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="w-full text-sm text-zinc-600 hover:text-zinc-900"
                  >
                    {t.markAllAsRead}
                  </button>
                </div>
              )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
