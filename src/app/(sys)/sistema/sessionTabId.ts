const SESSION_DEBUG_STORAGE_KEY = "backcrypto-session-debug";

export type SessionDebugInfo = {
  tabIdShort: string;
  tabIdFull: string;
  status: number;
  resultado: string;
  lastAt: number;
  erro?: string;
};

declare global {
  interface Window {
    __backcryptoSessionDebugInfo?: SessionDebugInfo;
  }
}

/** Lê se o debug de sessão/aba está habilitado (checkbox no painel Debug). */
export function getSessionDebugEnabled(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(SESSION_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSessionDebugEnabled(enabled: boolean): void {
  try {
    if (typeof window !== "undefined")
      window.localStorage.setItem(SESSION_DEBUG_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Atualiza o objeto de debug no window e dispara evento para o painel atualizar. */
export function setSessionDebugInfo(info: SessionDebugInfo): void {
  if (typeof window === "undefined") return;
  window.__backcryptoSessionDebugInfo = info;
  try {
    window.dispatchEvent(new CustomEvent("backcrypto-session-debug-update", { detail: info }));
  } catch {
    /* ignore */
  }
}

/**
 * ID único desta instância da página (uma por aba/janela).
 * Usado no header X-Tab-Id. Gerado uma vez por carregamento do documento:
 * aba duplicada = novo documento = novo id (sessionStorage é copiado na duplicata).
 */
let tabIdForThisPage: string | null = null;

export function getSessionTabId(): string {
  if (typeof window === "undefined") return "";
  if (tabIdForThisPage) return tabIdForThisPage;
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  tabIdForThisPage = id;
  try {
    window.sessionStorage?.setItem("backcrypto_tab_id", id);
  } catch {
    /* ignore */
  }
  return id;
}
