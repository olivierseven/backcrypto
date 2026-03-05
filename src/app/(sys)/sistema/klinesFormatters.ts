/**
 * Funções puras de formatação e datas para o gráfico de candles (UTC).
 */

export function parseNum(s: string): number {
  return Number(s) || 0;
}

export function formatUsdt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

export function formatUsdtTwoDecimals(n: number): string {
  return n.toFixed(2);
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
