"use client";

import { useEffect, useRef } from "react";

type FlushPayload = {
  type?: string;
  symbols?: string[];
};

/**
 * Liga opcionalmente ao WebSocket do serviço VPS (`WS_PORT`, ex. 3044).
 * Quando o VPS envia `{ type: "flush", symbols: [...] }` após gravar nas *Fast* + cache2,
 * dispara `onFlush` se o símbolo atual estiver na lista — o cliente refaz GET (ex. kline-cache2-bars).
 * Em dev local: `NEXT_PUBLIC_VPS_FLUSH_WS=ws://127.0.0.1:3044` com o VPS a correr na mesma máquina.
 */
export function useVpsFlushNotify(opts: {
  enabled: boolean;
  wsUrl: string | undefined;
  symbol: string;
  /** Recria o WebSocket ao mudar intervalo / vista do gráfico. */
  groupMinutes: number;
  onFlush: () => void;
}) {
  const { enabled, wsUrl, symbol, groupMinutes, onFlush } = opts;
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  useEffect(() => {
    if (!enabled || !wsUrl || typeof window === "undefined") return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (ev) => {
          try {
            const j = JSON.parse(String(ev.data)) as FlushPayload;
            if (j.type !== "flush" || !Array.isArray(j.symbols)) return;
            const sym = symbol.trim().toUpperCase();
            if (!j.symbols.includes(sym)) return;
            onFlushRef.current();
          } catch {
            /* ignore */
          }
        };
        ws.onclose = () => {
          if (closed) return;
          reconnectTimer = setTimeout(connect, 3000);
        };
        ws.onerror = () => {
          /* onclose reconecta */
        };
      } catch {
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [enabled, wsUrl, symbol, groupMinutes]);
}
