/**
 * Lista de símbolos para klines: lida do env (KLINE_SYMBOLS ou NEXT_PUBLIC_KLINE_SYMBOLS).
 * Formato: "BTCUSDT,ETHUSDT" (vírgula, sem espaços ou com).
 * Símbolos inválidos ou vazios são ignorados.
 * Uso: cron, cache-refresh, backfill, APIs e UI (dropdown).
 */
const DEFAULT_SYMBOLS = "BTCUSDT,ETHUSDT";

function getEnvSymbols(): string {
  if (typeof process === "undefined" || !process.env) return DEFAULT_SYMBOLS;
  return (
    process.env.NEXT_PUBLIC_KLINE_SYMBOLS ??
    process.env.KLINE_SYMBOLS ??
    DEFAULT_SYMBOLS
  );
}

let cached: string[] | null = null;

/**
 * Retorna a lista de símbolos configurada no env (trim, sem vazios).
 * Cache na primeira leitura.
 */
export function getKlineSymbols(): string[] {
  if (cached !== null) return cached;
  const raw = getEnvSymbols();
  cached = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return cached;
}

/**
 * Verifica se o símbolo está na lista permitida. Case-insensitive.
 * Se a lista estiver vazia após parse, considera apenas DEFAULT_SYMBOLS.
 */
export function isAllowedSymbol(symbol: string | null | undefined): boolean {
  if (!symbol || typeof symbol !== "string") return false;
  const list = getKlineSymbols();
  if (list.length === 0) return ["BTCUSDT", "ETHUSDT"].includes(symbol.toUpperCase());
  return list.includes(symbol.trim().toUpperCase());
}

/**
 * Retorna o símbolo se válido, senão o primeiro da lista.
 */
export function resolveSymbol(symbol: string | null | undefined): string {
  const list = getKlineSymbols();
  const first = list[0] ?? "BTCUSDT";
  if (!symbol || typeof symbol !== "string") return first;
  const s = symbol.trim().toUpperCase();
  return list.includes(s) ? s : first;
}

/** Verifica se o erro da Binance é "símbolo inválido" (-1121). Assim podemos ignorar o símbolo em vez de falhar. */
export function isBinanceInvalidSymbolError(e: unknown): boolean {
  if (!e || typeof (e as Error).message !== "string") return false;
  const msg = (e as Error).message;
  return msg.includes("-1121") || msg.toLowerCase().includes("invalid symbol");
}
