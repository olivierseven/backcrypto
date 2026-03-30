/** Integração CoinGecko API v3 (resolve símbolo Binance → id, helpers). */

const CG = "https://api.coingecko.com/api/v3";

const QUOTE_SUFFIXES = [
  "USDT",
  "USDC",
  "BUSD",
  "FDUSD",
  "TUSD",
  "USDD",
  "BTC",
  "ETH",
  "BNB",
  "EUR",
  "TRY",
  "BRL",
  "GBP",
  "AUD",
  "DAI",
  "USDP",
  "PAX",
  "NGN",
  "RUB",
  "UAH",
  "ZAR",
  "IDRT",
].sort((a, b) => b.length - a.length);

export function normalizeBinanceSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Base asset a partir do par (ex.: BTCUSDT → BTC). */
export function baseAssetFromBinanceSymbol(symbol: string): string | null {
  const u = symbol.toUpperCase();
  for (const q of QUOTE_SUFFIXES) {
    if (u.endsWith(q) && u.length > q.length) {
      const b = u.slice(0, -q.length);
      return b.length > 0 ? b : null;
    }
  }
  return u.length > 0 ? u : null;
}

export function htmlDescriptionToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

type SearchCoin = {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
};

type SearchResponse = { coins?: SearchCoin[] };

/** Resolve o `id` CoinGecko (ex.: bitcoin) a partir da base (ex.: BTC). */
export async function resolveCoinGeckoId(base: string): Promise<string | null> {
  const q = encodeURIComponent(base.trim());
  const res = await fetch(`${CG}/search?query=${q}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as SearchResponse;
  const coins = data.coins ?? [];
  const sym = base.toLowerCase();
  const matches = coins.filter((c) => c.symbol.toLowerCase() === sym);
  const pool = matches.length > 0 ? matches : coins;
  const sorted = [...pool].sort((a, b) => {
    const ra = a.market_cap_rank ?? 999999;
    const rb = b.market_cap_rank ?? 999999;
    return ra - rb;
  });
  return sorted[0]?.id ?? null;
}

/** Todos os `id` na lista CoinGecko cujo `symbol` coincide com a base (pode haver vários — ex. BTC). */
export function coinIdsForBaseFromList(
  list: readonly { id: string; symbol: string }[],
  base: string,
): string[] {
  const b = base.trim().toLowerCase();
  return list.filter((c) => c.symbol.toLowerCase() === b).map((c) => c.id);
}
