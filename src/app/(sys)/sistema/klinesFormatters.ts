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
const MS_PER_HOUR = 60 * 60 * 1000;

export function isStartOfDay(openTime: number): boolean {
  return openTime % MS_PER_DAY === 0;
}

/**
 * Meia-noite 00:00 no fuso `offsetHours` em relação à UTC (ex.: -3 → início do dia em Brasília).
 * `ms` é o open time UTC da vela (ms desde epoch).
 */
export function isMidnightInOffsetZone(ms: number, offsetHours: number): boolean {
  const t = Math.trunc(Number(ms));
  if (!Number.isFinite(t)) return false;
  const oh = Math.max(-12, Math.min(12, offsetHours));
  const shifted = t + oh * MS_PER_HOUR;
  const d = new Date(shifted);
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

/** Instant UTC em que é 00:00:00 no calendário local (offsetHours vs UTC). */
function utcMsAtLocalCalendarMidnight(y: number, month0: number, day: number, offsetHours: number): number {
  const oh = Math.max(-12, Math.min(12, offsetHours));
  const shifted = Date.UTC(y, month0, day, 0, 0, 0, 0);
  return shifted - oh * MS_PER_HOUR;
}

function localCalendarFromUtcMs(ms: number, offsetHours: number): { y: number; m0: number; d: number } {
  const oh = Math.max(-12, Math.min(12, offsetHours));
  const shifted = Math.trunc(Number(ms)) + oh * MS_PER_HOUR;
  const d = new Date(shifted);
  return { y: d.getUTCFullYear(), m0: d.getUTCMonth(), d: d.getUTCDate() };
}

/** `ms` = instante UTC real; dia 1 do mês no calendário local (`offsetHours`). Usado p.ex. em meia-noites de enumerateLocalMidnightUtcMs. */
export function isFirstDayOfMonthInOffsetZone(ms: number, offsetHours: number): boolean {
  const oh = Math.max(-12, Math.min(12, offsetHours));
  const t = Math.trunc(Number(ms));
  if (!Number.isFinite(t)) return false;
  return localCalendarFromUtcMs(t, oh).d === 1;
}

/** Primeira meia-noite local ≥ tMinUtc (ms). */
function firstLocalMidnightAtOrAfterUtc(tMinUtc: number, offsetHours: number): number {
  const oh = Math.max(-12, Math.min(12, offsetHours));
  const t = Math.trunc(Number(tMinUtc));
  if (!Number.isFinite(t)) return NaN;
  const { y, m0, d } = localCalendarFromUtcMs(t, oh);
  let M = utcMsAtLocalCalendarMidnight(y, m0, d, oh);
  if (M < t) M += MS_PER_DAY;
  while (M < t) M += MS_PER_DAY;
  return M;
}

/**
 * Todas as meia-noites locais (fuso `offsetHours`) com instante UTC em [tMinUtc, tMaxUtc).
 * `tMinUtc`/`tMaxUtc` devem ser tempos UTC reais (epoch), não openTime já deslocado pela API.
 */
export function enumerateLocalMidnightUtcMs(tMinUtc: number, tMaxUtc: number, offsetHours: number): number[] {
  const tMin = Math.trunc(Number(tMinUtc));
  const tMax = Math.trunc(Number(tMaxUtc));
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMax <= tMin) return [];
  let M = firstLocalMidnightAtOrAfterUtc(tMin, offsetHours);
  if (!Number.isFinite(M)) return [];
  const out: number[] = [];
  while (M < tMax) {
    out.push(M);
    M += MS_PER_DAY;
  }
  return out;
}
