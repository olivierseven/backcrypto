function parseMs(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export type VpsStallWatchdog = {
  touch: () => void;
  stop: () => void;
};

export function startVpsStallWatchdog(label: string): VpsStallWatchdog {
  const stallMs = parseMs(process.env.VPS_STALL_EXIT_MS, 15 * 60 * 1000);
  if (stallMs <= 0) {
    return { touch: () => {}, stop: () => {} };
  }
  let lastProgressAt = Date.now();
  const checkMs = Math.min(60_000, Math.max(10_000, Math.floor(stallMs / 6)));
  const timer = setInterval(() => {
    const idleMs = Date.now() - lastProgressAt;
    if (idleMs < stallMs) return;
    console.error(
      `[${label}] sem progresso há ${Math.round(idleMs / 1000)}s (limite ${stallMs}ms) — exit 1 para PM2 reiniciar`
    );
    process.exit(1);
  }, checkMs);
  return {
    touch: () => {
      lastProgressAt = Date.now();
    },
    stop: () => clearInterval(timer),
  };
}
