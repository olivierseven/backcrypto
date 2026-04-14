import type { CryptoLang } from "@/app/lib/translations";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Datas dos cupons no painel / histórico:
 * - pt: dd/MM/yyyy HH:mm:ss (hora local)
 * - en: MM/dd/yyyy HH:mm:ss (hora local)
 */
export function formatAffiliateCouponDateTime(iso: string, lang: CryptoLang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  const time = `${hh}:${mi}:${ss}`;
  if (lang === "pt") {
    return `${dd}/${mm}/${yyyy} ${time}`;
  }
  return `${mm}/${dd}/${yyyy} ${time}`;
}
