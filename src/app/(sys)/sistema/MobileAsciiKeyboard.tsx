"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { ASSET_PREFIX } from "@/app/constants";
import { getCryptoT } from "@/app/lib/translations";
import {
  MOBILE_ASCII_KEYBOARD_PREF_EVENT,
  readMobileAsciiKeyboardDisabled,
} from "./mobileAsciiKeyboardPref";

function isEditableTextTarget(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  if (el instanceof HTMLInputElement) {
    if (el.disabled || el.readOnly) return false;
    const t = el.type;
    return t === "text" || t === "search" || t === "url" || t === "email" || t === "password" || t === "tel" || t === "number";
  }
  return false;
}

function isContentEditable(el: Element | null): el is HTMLElement {
  return el instanceof HTMLElement && el.isContentEditable;
}

function insertIntoInput(el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  if (el.type === "number") {
    const allowed = text.replace(/[^0-9eE+\-.]/g, "");
    if (!allowed && text.length > 0) return;
    text = allowed;
  }
  el.focus();
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const v = el.value;
  const next = v.slice(0, start) + text + v.slice(end);
  const native = Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value");
  if (native?.set) native.set.call(el, next);
  else el.value = next;
  const caret = start + text.length;
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function insertIntoContentEditable(el: HTMLElement, text: string): void {
  el.focus();
  if (typeof document.execCommand === "function") {
    document.execCommand("insertText", false, text);
    return;
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function applyBackspace(el: HTMLElement): void {
  if (isEditableTextTarget(el)) {
    el.focus();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const v = el.value;
    let next: string;
    let caret: number;
    if (start !== end) {
      next = v.slice(0, start) + v.slice(end);
      caret = start;
    } else if (start > 0) {
      next = v.slice(0, start - 1) + v.slice(start);
      caret = start - 1;
    } else return;
    const native = Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value");
    if (native?.set) native.set.call(el, next);
    else el.value = next;
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  if (isContentEditable(el)) {
    el.focus();
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace", bubbles: true, cancelable: true }),
    );
  }
}

function applyEnter(el: HTMLElement): void {
  if (el instanceof HTMLTextAreaElement) {
    insertIntoInput(el, "\n");
    return;
  }
  if (el instanceof HTMLInputElement) {
    el.focus();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
    return;
  }
  if (isContentEditable(el)) {
    insertIntoContentEditable(el, "\n");
  }
}

const ROW_NUM = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const ROW_Q = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const ROW_A = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const ROW_Z = ["z", "x", "c", "v", "b", "n", "m"];

/**
 * Snapshot (pointerdown capture no painel) diz qual campo tinha foco antes da tecla roubar o foco.
 * Sem snapshot persistente por focusin — evita escrever num input antigo quando o utilizador quer atalhos (letra/número) no gráfico.
 */
function getInsertTarget(snapshotRef: MutableRefObject<HTMLElement | null>): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    if (isEditableTextTarget(active) || isContentEditable(active)) return active;
    if (active.closest("[data-mobile-ascii-keyboard]")) {
      const snap = snapshotRef.current;
      if (snap?.isConnected && (isEditableTextTarget(snap) || isContentEditable(snap))) return snap;
    }
  }
  return null;
}

function keyboardCodeForChar(ch: string): string | null {
  if (/^[0-9]$/.test(ch)) return `Digit${ch}`;
  if (/^[a-zA-Z]$/.test(ch)) return `Key${ch.toUpperCase()}`;
  return null;
}

/** Replica atalhos do desktop: SymbolQuickSwitch / IntervalQuickSwitch ouvem keydown na window. */
function dispatchWindowKeydown(key: string, code: string): void {
  try {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        code,
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
  } catch {
    /* ignore */
  }
}

function dispatchShortcutChar(out: string): void {
  const code = keyboardCodeForChar(out);
  if (!code) return;
  dispatchWindowKeydown(out, code);
}

/** Teclado on-screen só ASCII (letras, números, Enter, Backspace) para mobile; envia para o campo focado. */
export default function MobileAsciiKeyboard() {
  const lang = useCryptoLang();
  const tk = getCryptoT(lang).sistema.klines as Record<string, string>;
  const [prefDisabled, setPrefDisabled] = useState(() => readMobileAsciiKeyboardDisabled());
  useEffect(() => {
    const sync = () => setPrefDisabled(readMobileAsciiKeyboardDisabled());
    window.addEventListener(MOBILE_ASCII_KEYBOARD_PREF_EVENT, sync);
    return () => window.removeEventListener(MOBILE_ASCII_KEYBOARD_PREF_EVENT, sync);
  }, []);
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(false);
  const shiftRef = useRef(shift);
  shiftRef.current = shift;
  const snapshotRef = useRef<HTMLElement | null>(null);
  const lastTapRef = useRef(0);

  /** Antes do botão receber o toque: grava campo focado ou limpa se o foco já não era editável (atalhos no chart). */
  const snapshotEditableBeforeKey = useCallback(() => {
    const a = document.activeElement;
    if (a instanceof HTMLElement && (isEditableTextTarget(a) || isContentEditable(a))) {
      snapshotRef.current = a;
      return;
    }
    if (!(a instanceof HTMLElement) || !a.closest("[data-mobile-ascii-keyboard]")) {
      snapshotRef.current = null;
    }
  }, []);

  const sendChar = useCallback((ch: string) => {
    const s = shiftRef.current;
    const out = s && ch.length === 1 && /[a-z]/.test(ch) ? ch.toUpperCase() : ch;
    if (s && /[a-z]/.test(ch)) setShift(false);
    const el = getInsertTarget(snapshotRef);
    if (el) {
      if (isEditableTextTarget(el)) insertIntoInput(el, out);
      else if (isContentEditable(el)) insertIntoContentEditable(el, out);
      return;
    }
    if (out.length === 1 && /^[a-zA-Z0-9]$/.test(out)) {
      dispatchShortcutChar(out);
    }
  }, []);

  const onBackspace = useCallback(() => {
    const el = getInsertTarget(snapshotRef);
    if (el) applyBackspace(el);
    else dispatchWindowKeydown("Backspace", "Backspace");
  }, []);

  const onEnter = useCallback(() => {
    const el = getInsertTarget(snapshotRef);
    if (el) applyEnter(el);
    else dispatchWindowKeydown("Enter", "Enter");
  }, []);

  const keyBtn =
    "min-h-[42px] min-w-[28px] flex-1 shrink-0 rounded-md bg-zinc-700 active:bg-zinc-600 text-sm font-medium text-zinc-100 px-1 select-none touch-manipulation";

  /** pointerup + click no mesmo toque (mobile): evita duplicar caractere. */
  const bumpAndSendChar = useCallback(
    (ch: string) => {
      const now = Date.now();
      if (now - lastTapRef.current < 45) return;
      lastTapRef.current = now;
      sendChar(ch);
    },
    [sendChar],
  );

  if (prefDisabled) return null;

  return (
    <div
      data-mobile-ascii-keyboard
      className="flex flex-col items-stretch pointer-events-none fixed bottom-0 left-0 right-0 z-[1320] 2xl:hidden"
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom, 0px))" }}
    >
      {open && (
        <div
          id="mobile-ascii-keyboard-panel"
          role="region"
          aria-label={tk.mobileAsciiKeyboardToggle ?? "Teclado"}
          className="pointer-events-auto border-t border-zinc-600/80 bg-zinc-900 text-zinc-100 px-1.5 pt-2 pb-1 opacity-50"
        >
          <p className="text-[10px] text-zinc-400 px-1 pb-1.5 leading-snug">{tk.mobileAsciiKeyboardHint}</p>
            <div className="flex flex-col gap-1">
              <div className="flex gap-1 justify-center">
                {ROW_NUM.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={keyBtn}
                    onPointerDownCapture={snapshotEditableBeforeKey}
                    onPointerUp={(e: ReactPointerEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      bumpAndSendChar(c);
                    }}
                    onClick={(e: ReactMouseEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      bumpAndSendChar(c);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 justify-center pl-3">
                {ROW_Q.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={keyBtn}
                    onPointerDownCapture={snapshotEditableBeforeKey}
                    onPointerUp={(e: ReactPointerEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      bumpAndSendChar(c);
                    }}
                    onClick={(e: ReactMouseEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      bumpAndSendChar(c);
                    }}
                  >
                    {shift ? c.toUpperCase() : c}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 justify-center pl-5">
                {ROW_A.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={keyBtn}
                    onPointerDownCapture={snapshotEditableBeforeKey}
                    onPointerUp={(e: ReactPointerEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      bumpAndSendChar(c);
                    }}
                    onClick={(e: ReactMouseEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      bumpAndSendChar(c);
                    }}
                  >
                    {shift ? c.toUpperCase() : c}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 items-stretch">
                <button
                  type="button"
                  className={`${keyBtn} flex-[1.1] ${shift ? "bg-emerald-800" : ""}`}
                  onPointerDownCapture={snapshotEditableBeforeKey}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShift((s) => !s);
                  }}
                  aria-pressed={shift}
                  aria-label={tk.mobileAsciiKeyboardShift ?? "Shift"}
                >
                  ⇧
                </button>
                {ROW_Z.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={keyBtn}
                    onPointerDownCapture={snapshotEditableBeforeKey}
                    onPointerUp={(e: ReactPointerEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      bumpAndSendChar(c);
                    }}
                    onClick={(e: ReactMouseEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      bumpAndSendChar(c);
                    }}
                  >
                    {shift ? c.toUpperCase() : c}
                  </button>
                ))}
                <button
                  type="button"
                  className={`${keyBtn} flex-[1.4] text-xs`}
                  onPointerDownCapture={snapshotEditableBeforeKey}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onBackspace();
                  }}
                  aria-label={tk.mobileAsciiKeyboardBackspace ?? "Backspace"}
                >
                  ⌫
                </button>
              </div>
              <div className="flex gap-1 pb-0.5">
                <button
                  type="button"
                  className="min-h-[44px] flex-[1] rounded-md bg-zinc-700 active:bg-zinc-600 text-sm font-medium touch-manipulation"
                  onPointerDownCapture={snapshotEditableBeforeKey}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                  }}
                >
                  {tk.mobileAsciiKeyboardCloseOverlay ?? "Fechar"}
                </button>
                <button
                  type="button"
                  className="min-h-[44px] flex-[2] rounded-md bg-emerald-800 active:bg-emerald-700 text-sm font-semibold touch-manipulation"
                  onPointerDownCapture={snapshotEditableBeforeKey}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEnter();
                  }}
                  aria-label={tk.mobileAsciiKeyboardEnter ?? "Enter"}
                >
                  {tk.mobileAsciiKeyboardEnter ?? "Enter"}
                </button>
              </div>
            </div>
        </div>
      )}
      <div className="flex justify-center px-2 pt-1 pointer-events-auto">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center border-0 bg-transparent p-1 opacity-50 active:opacity-70 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 rounded-sm"
          aria-expanded={open}
          aria-controls="mobile-ascii-keyboard-panel"
          aria-label={tk.mobileAsciiKeyboardToggle ?? "Teclado"}
          title={tk.mobileAsciiKeyboardToggle ?? "Teclado"}
        >
          <img
            src={`${ASSET_PREFIX}/assets/bio/keyboard.webp`}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 object-contain pointer-events-none select-none"
            draggable={false}
          />
        </button>
      </div>
    </div>
  );
}
