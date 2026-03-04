const AWESOME_API_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL";
const CACHE_HOURS = process.env.BG_USD_BRL_CACHE_HOURS ? Number(process.env.BG_USD_BRL_CACHE_HOURS) : 1;
const CACHE_MS = CACHE_HOURS * 60 * 60 * 1000;

let cached: { rate: number; at: number } | null = null;

export type UsdBrlResult = { rate: number; source: "api" | "env" | "default" };

export async function getUsdToBrlRate(): Promise<UsdBrlResult> {
  const envRate = process.env.BG_USD_TO_BRL_RATE;
  const fallback = envRate ? { rate: Number(envRate), source: "env" as const } : { rate: 5.5, source: "default" as const };
  if (!Number.isFinite(fallback.rate) || fallback.rate <= 0) return { rate: 5.5, source: "default" };

  if (cached && Date.now() - cached.at < CACHE_MS) return { rate: cached.rate, source: "api" };

  try {
    const res = await fetch(AWESOME_API_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) return fallback;
    const data = await res.json().catch(() => null);
    const bid = data?.USDBRL?.bid != null ? parseFloat(String(data.USDBRL.bid)) : NaN;
    if (!Number.isFinite(bid) || bid <= 0) return fallback;
    cached = { rate: bid, at: Date.now() };
    return { rate: bid, source: "api" };
  } catch {
    return fallback;
  }
}
