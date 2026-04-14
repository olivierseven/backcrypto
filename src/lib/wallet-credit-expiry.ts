/**
 * Expiração ao fim do dia UTC após somar meses de calendário.
 * Mantém o dia quando existe no mês destino; senão usa o último dia do mês
 * (ex.: 31 mar + 1 mês → 30 abr; 31 jan + 1 mês → 28/29 fev).
 */
export function computeExpiresAtUtcFromMonthDelta(base: Date, monthsToAdd: number): Date {
  const n = Math.max(1, Math.floor(monthsToAdd));
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const day = base.getUTCDate();
  const anchor = new Date(Date.UTC(y, m + n, 1));
  const ly = anchor.getUTCFullYear();
  const lm = anchor.getUTCMonth();
  const lastDay = new Date(Date.UTC(ly, lm + 1, 0)).getUTCDate();
  const d = Math.min(day, lastDay);
  return new Date(Date.UTC(ly, lm, d, 23, 59, 59, 999));
}
