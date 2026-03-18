/**
 * Funções puras de formatação e datas para o gráfico de candles (UTC).
 */

export function parseNum(s: string): number {
  return Number(s) || 0;
}

export function formatUsdt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(8);
}

export function formatUsdtTwoDecimals(n: number): string {
  return n.toFixed(2);
}

/** Casas decimais em função da magnitude do preço (eixo Y). Mínimo 2, até 8 para valores muito pequenos (ex.: PEPE). */
export function priceAxisDecimals(priceOrStep: number): number {
  if (!Number.isFinite(priceOrStep) || priceOrStep <= 0) return 2;
  const d = Math.ceil(-Math.log10(priceOrStep));
  return Math.max(2, Math.min(8, d));
}

/** Formata preço com N casas decimais (eixo Y). Evita notação científica. */
export function formatUsdtWithDecimals(n: number, decimals: number): string {
  const d = Math.max(0, Math.min(20, Math.round(decimals)));
  if (n >= 1000 && d <= 1) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Step "bonito" para o eixo Y (1, 2 ou 5 × 10^n) a partir do intervalo desejado. */
export function niceTickStep(targetStep: number): number {
  if (!Number.isFinite(targetStep) || targetStep <= 0) return 0.01;
  const exp = Math.floor(Math.log10(targetStep));
  const base = 10 ** exp;
  const normalized = targetStep / base;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * base;
}

/** Formata número em modo abreviado: K, M, B (ex.: 1234 → 1.23K); decimal com ponto. */
export function formatAbbreviated(n: number, decimals = 2): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(decimals)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(decimals)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(decimals)}K`;
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** OBV no eixo Y: sempre /1000, 2 decimais, vírgula, sufixo "k" (ex.: -176326.71 → -176,33k). */
export function formatObvYAxis(value: number): string {
  const scaled = value / 1000;
  const s = scaled.toFixed(2).replace(".", ",");
  return s + "k";
}

export function formatTimeLabel(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString("en-CA", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDateLabel(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("en-CA", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/** Data em UTC no formato yyyy-mm-dd */
export function formatDateYyyyMmDd(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

export function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

export function yearKey(ms: number): string {
  const d = new Date(ms);
  return String(d.getUTCFullYear());
}

export function formatDayOnly(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("en-CA", { timeZone: "UTC", day: "2-digit" });
}

export function formatMonthOnly(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" });
}

export function formatYearOnly(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("en-CA", { timeZone: "UTC", year: "numeric" });
}

/** Formato mês/ano abreviado: mm/aa (ex.: 01/25) */
export function formatMonthYearShort(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const aa = String(d.getUTCFullYear() % 100).padStart(2, "0");
  return `${mm}/${aa}`;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isStartOfDay(openTime: number): boolean {
  return openTime % MS_PER_DAY === 0;
}
