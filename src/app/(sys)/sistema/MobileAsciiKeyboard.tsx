"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
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

function insertIntoInput(
  el: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  onBeforeFocus?: (target: HTMLElement) => void
): void {
  if (el.type === "number") {
    const allowed = text.replace(/[^0-9eE+\-.]/g, "");
    if (!allowed && text.length > 0) return;
    text = allowed;
  }
  onBeforeFocus?.(el);
  el.focus();
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const v = el.value;
  const next = v.slice(0, start) + text + v.slice(end);
  const native = Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value");
  if (native?.set) native.set.call(el, next);
  else el.value = next;
  const caret = start + text.length;
  try {
    el.setSelectionRange(caret, caret);
  } catch {
    /* iOS / number: alguns estados não permitem seleção */
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function insertIntoContentEditable(
  el: HTMLElement,
  text: string,
  onBeforeFocus?: (target: HTMLElement) => void
): void {
  onBeforeFocus?.(el);
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

function applyBackspace(el: HTMLElement, onBeforeFocus?: (target: HTMLElement) => void): void {
  if (isEditableTextTarget(el)) {
    onBeforeFocus?.(el);
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
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      /* ignore */
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  if (isContentEditable(el)) {
    onBeforeFocus?.(el);
    el.focus();
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace", bubbles: true, cancelable: true }),
    );
  }
}

function applyEnter(el: HTMLElement, onBeforeFocus?: (target: HTMLElement) => void): void {
  if (el instanceof HTMLTextAreaElement) {
    insertIntoInput(el, "\n", onBeforeFocus);
    return;
  }
  if (el instanceof HTMLInputElement) {
    onBeforeFocus?.(el);
    el.focus();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
    return;
  }
  if (isContentEditable(el)) {
    insertIntoContentEditable(el, "\n", onBeforeFocus);
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
  if (!(active instanceof HTMLElement)) return null;
  /** Não usar `isContentEditable()` aqui: o predicate `el is HTMLElement` no false estreita `active` a `never` depois do `||`. */
  if (isEditableTextTarget(active) || active.isContentEditable) return active;
  if (!active.closest("[data-mobile-ascii-keyboard]")) return null;
  const snap = snapshotRef.current;
  if (snap?.isConnected && (isEditableTextTarget(snap) || isContentEditable(snap))) return snap;
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
  /** Campos onde aplicámos `inputmode="none"` para não abrir o teclado nativo — restaurar ao fechar o painel. */
  const suppressedInputModeElsRef = useRef(new Set<HTMLElement>());

  const suppressNativeKeyboard = useCallback((el: HTMLElement) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (!suppressedInputModeElsRef.current.has(el)) {
        el.dataset.mobileAsciiPrevInputmode = el.inputMode;
        suppressedInputModeElsRef.current.add(el);
      }
      el.inputMode = "none";
    } else if (el.isContentEditable) {
      if (!suppressedInputModeElsRef.current.has(el)) {
        el.dataset.mobileAsciiPrevInputmode = el.getAttribute("inputmode") ?? "";
        suppressedInputModeElsRef.current.add(el);
      }
      el.setAttribute("inputmode", "none");
    }
  }, []);

  const restoreSuppressedInputModes = useCallback(() => {
    for (const el of suppressedInputModeElsRef.current) {
      if (!el.isConnected) continue;
      const prev = el.dataset.mobileAsciiPrevInputmode;
      delete el.dataset.mobileAsciiPrevInputmode;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.inputMode = prev ?? "";
      } else {
        if (prev) el.setAttribute("inputmode", prev);
        else el.removeAttribute("inputmode");
      }
    }
    suppressedInputModeElsRef.current.clear();
  }, []);

  /** Último campo de texto focado — mais fiável no mobile do que snapshot só no pointer capture (o botão rouba foco). */
  useEffect(() => {
    const onFocusIn = (ev: FocusEvent) => {
      const t = ev.target;
      if (t instanceof HTMLElement && (isEditableTextTarget(t) || isContentEditable(t))) {
        snapshotRef.current = t;
      }
    };
    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
  }, []);

  /** Com o painel aberto: não deixar o SO abrir o teclado nativo em inputs ao focar. */
  useEffect(() => {
    if (!open) return;
    const onFocusIn = (ev: FocusEvent) => {
      const t = ev.target;
      if (t instanceof HTMLElement && (isEditableTextTarget(t) || isContentEditable(t))) {
        suppressNativeKeyboard(t);
      }
    };
    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
  }, [open, suppressNativeKeyboard]);

  /** Ao fechar o overlay: repor `inputmode` para o utilizador poder usar o teclado nativo outra vez. */
  useEffect(() => {
    if (!open) restoreSuppressedInputModes();
  }, [open, restoreSuppressedInputModes]);

  /** Desmontagem / desativar pref: não deixar `inputmode` preso em `none`. */
  useEffect(() => {
    return () => restoreSuppressedInputModes();
  }, [restoreSuppressedInputModes]);

  /** Ao abrir o overlay: se já houver campo focado, suprimir teclado nativo de imediato. */
  useEffect(() => {
    if (!open) return;
    const a = document.activeElement;
    if (a instanceof HTMLElement && (isEditableTextTarget(a) || isContentEditable(a))) {
      suppressNativeKeyboard(a);
    }
  }, [open, suppressNativeKeyboard]);

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

  const sendChar = useCallback(
    (ch: string) => {
      const s = shiftRef.current;
      const out = s && ch.length === 1 && /[a-z]/.test(ch) ? ch.toUpperCase() : ch;
      if (s && /[a-z]/.test(ch)) setShift(false);
      const el = getInsertTarget(snapshotRef);
      if (el) {
        if (isEditableTextTarget(el)) insertIntoInput(el, out, suppressNativeKeyboard);
        else if (isContentEditable(el)) insertIntoContentEditable(el, out, suppressNativeKeyboard);
        /** Mobile: o botão pode roubar foco depois do handler — voltar ao campo para a próxima tecla. */
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              if (el.isConnected) {
                suppressNativeKeyboard(el);
                el.focus();
              }
            } catch {
              /* ignore */
            }
          });
        });
        return;
      }
      if (out.length === 1 && /^[a-zA-Z0-9]$/.test(out)) {
        dispatchShortcutChar(out);
      }
    },
    [suppressNativeKeyboard]
  );

  const onBackspace = useCallback(() => {
    const el = getInsertTarget(snapshotRef);
    if (el) applyBackspace(el, suppressNativeKeyboard);
    else dispatchWindowKeydown("Backspace", "Backspace");
  }, [suppressNativeKeyboard]);

  const onEnter = useCallback(() => {
    const el = getInsertTarget(snapshotRef);
    if (el) applyEnter(el, suppressNativeKeyboard);
    else dispatchWindowKeydown("Enter", "Enter");
  }, [suppressNativeKeyboard]);

  const keyBtn =
    "min-h-[42px] min-w-[28px] flex-1 shrink-0 rounded-md bg-zinc-700 active:bg-zinc-600 text-sm font-medium text-zinc-100 px-1 select-none touch-manipulation [-webkit-tap-highlight-color:transparent]";

  const onKeyPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, ch: string) => {
      e.preventDefault();
      e.stopPropagation();
      snapshotEditableBeforeKey();
      sendChar(ch);
    },
    [sendChar, snapshotEditableBeforeKey],
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
          className="pointer-events-auto border-t border-zinc-600/80 bg-zinc-900 text-zinc-100 px-1.5 pt-2 pb-1 opacity-50 select-none"
          style={{
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
            touchAction: "manipulation",
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <p className="text-[10px] text-zinc-400 px-1 pb-1.5 leading-snug">{tk.mobileAsciiKeyboardHint}</p>
            <div className="flex flex-col gap-1">
              <div className="flex gap-1 justify-center">
                {ROW_NUM.map((c) => (
                  <button
                    key={c}
                    type="button"
                    tabIndex={-1}
                    className={keyBtn}
                    style={{ WebkitTouchCallout: "none", touchAction: "manipulation" }}
                    onPointerDownCapture={snapshotEditableBeforeKey}
                    onPointerDown={(e) => onKeyPointerDown(e, c)}
                    onContextMenu={(e) => e.preventDefault()}
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
                    tabIndex={-1}
                    className={keyBtn}
                    style={{ WebkitTouchCallout: "none", touchAction: "manipulation" }}
                    onPointerDownCapture={snapshotEditableBeforeKey}
                    onPointerDown={(e) => onKeyPointerDown(e, c)}
                    onContextMenu={(e) => e.preventDefault()}
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
                    tabIndex={-1}
                    className={keyBtn}
                    style={{ WebkitTouchCallout: "none", touchAction: "manipulation" }}
                    onPointerDownCapture={snapshotEditableBeforeKey}
                    onPointerDown={(e) => onKeyPointerDown(e, c)}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {shift ? c.toUpperCase() : c}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 items-stretch">
                <button
                  type="button"
                  tabIndex={-1}
                  className={`${keyBtn} flex-[1.1] ${shift ? "bg-emerald-800" : ""}`}
                  style={{ WebkitTouchCallout: "none", touchAction: "manipulation" }}
                  onPointerDownCapture={snapshotEditableBeforeKey}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    snapshotEditableBeforeKey();
                    setShift((s) => !s);
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-pressed={shift}
                  aria-label={tk.mobileAsciiKeyboardShift ?? "Shift"}
                >
                  ⇧
                </button>
                {ROW_Z.map((c) => (
                  <button
                    key={c}
                    type="button"
                    tabIndex={-1}
                    className={keyBtn}
                    style={{ WebkitTouchCallout: "none", touchAction: "manipulation" }}
                    onPointerDownCapture={snapshotEditableBeforeKey}
                    onPointerDown={(e) => onKeyPointerDown(e, c)}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {shift ? c.toUpperCase() : c}
                  </button>
                ))}
                <button
                  type="button"
                  tabIndex={-1}
                  className={`${keyBtn} flex-[1.4] text-xs`}
                  style={{ WebkitTouchCallout: "none", touchAction: "manipulation" }}
                  onPointerDownCapture={snapshotEditableBeforeKey}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    snapshotEditableBeforeKey();
                    onBackspace();
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label={tk.mobileAsciiKeyboardBackspace ?? "Backspace"}
                >
                  ⌫
                </button>
              </div>
              <div className="flex gap-1 pb-0.5">
                <button
                  type="button"
                  tabIndex={-1}
                  className="min-h-[44px] flex-[1] rounded-md bg-zinc-700 active:bg-zinc-600 text-sm font-medium touch-manipulation [-webkit-tap-highlight-color:transparent]"
                  style={{ WebkitTouchCallout: "none", touchAction: "manipulation" }}
                  onPointerDownCapture={snapshotEditableBeforeKey}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {tk.mobileAsciiKeyboardCloseOverlay ?? "Fechar"}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  className="min-h-[44px] flex-[2] rounded-md bg-emerald-800 active:bg-emerald-700 text-sm font-semibold touch-manipulation [-webkit-tap-highlight-color:transparent]"
                  style={{ WebkitTouchCallout: "none", touchAction: "manipulation" }}
                  onPointerDownCapture={snapshotEditableBeforeKey}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    snapshotEditableBeforeKey();
                    onEnter();
                  }}
                  onContextMenu={(e) => e.preventDefault()}
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
          tabIndex={-1}
          onClick={() => setOpen((v) => !v)}
          style={{ WebkitTouchCallout: "none", touchAction: "manipulation" }}
          onContextMenu={(e) => e.preventDefault()}
          className="flex items-center justify-center border-0 bg-transparent p-1 opacity-50 active:opacity-70 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 rounded-sm [-webkit-tap-highlight-color:transparent] select-none"
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
