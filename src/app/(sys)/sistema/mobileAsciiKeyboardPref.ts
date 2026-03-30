/** Preferência: teclado ASCII no ecrã (mobile). Por omissão ativo; `localStorage === "1"` = desativado. */

export const MOBILE_ASCII_KEYBOARD_DISABLED_KEY = "crypto_mobile_ascii_keyboard_disabled";

export const MOBILE_ASCII_KEYBOARD_PREF_EVENT = "crypto-mobile-ascii-keyboard-pref";

export function readMobileAsciiKeyboardDisabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MOBILE_ASCII_KEYBOARD_DISABLED_KEY) === "1";
}

export function writeMobileAsciiKeyboardDisabled(disabled: boolean): void {
  if (typeof window === "undefined") return;
  if (disabled) {
    window.localStorage.setItem(MOBILE_ASCII_KEYBOARD_DISABLED_KEY, "1");
  } else {
    window.localStorage.removeItem(MOBILE_ASCII_KEYBOARD_DISABLED_KEY);
  }
  window.dispatchEvent(new Event(MOBILE_ASCII_KEYBOARD_PREF_EVENT));
}
