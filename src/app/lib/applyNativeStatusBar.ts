/**
 * Android WebView: esconde de verdade a status bar (ícones do sistema).
 * O @capacitor/status-bar com edge-to-edge (Android 15+) muitas vezes só altera overlay,
 * não remove os ícones — usamos bridge Java em MainActivity quando disponível.
 */
type AndroidStatusBarBridge = { setStatusBarHidden: (hidden: boolean) => void };

export async function applyNativeStatusBarHidden(hidden: boolean): Promise<void> {
  if (typeof window === "undefined") return;

  const bridge = (window as unknown as { AndroidStatusBar?: AndroidStatusBarBridge }).AndroidStatusBar;
  if (bridge?.setStatusBarHidden) {
    try {
      bridge.setStatusBarHidden(hidden);
    } catch {
      /* ignore */
    }
    return;
  }

  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;

  const { StatusBar } = await import("@capacitor/status-bar");
  if (hidden) await StatusBar.hide().catch(() => {});
  else await StatusBar.show().catch(() => {});
}
