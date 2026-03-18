/**
 * Lista de símbolos para klines: lida do env (KLINE_SYMBOLS ou NEXT_PUBLIC_KLINE_SYMBOLS).
 * Em dev o backfill usa KLINE_SYMBOLS_DEV se estiver definido.
 * Sync (cron) e cache-refresh usam a lista do banco (tabela KlineSymbol) quando disponível.
 * Formato env: "BTCUSDT,ETHUSDT" (vírgula, sem espaços ou com).
 * Uso: cron, cache-refresh, backfill, APIs e UI (dropdown).
 */
import type { PrismaClient } from "@/lib/prisma-bio-client";

const DEFAULT_SYMBOLS = "BTCUSDT,ETHUSDT";

/**
 * Lista de símbolos a partir da tabela KlineSymbol (fonte de verdade para sync e cache-refresh).
 * Retorna array vazio se a tabela estiver vazia.
 */
export async function getKlineSymbolsFromDb(db: PrismaClient): Promise<string[]> {
  const rows = await db.klineSymbol.findMany({
    where: { ativo: true },
    orderBy: { symbol: "asc" },
    select: { symbol: true },
  });
  return rows.map((r) => r.symbol);
}

function getEnvSymbols(): string {
  if (typeof process === "undefined" || !process.env) return DEFAULT_SYMBOLS;
  return (
    process.env.NEXT_PUBLIC_KLINE_SYMBOLS ??
    process.env.KLINE_SYMBOLS ??
    DEFAULT_SYMBOLS
  );
}

function parseSymbolsRaw(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

let cached: string[] | null = null;

/**
 * Retorna a lista de símbolos configurada no env (trim, sem vazios).
 * Cache na primeira leitura. Uso: cron, cache-refresh.
 */
export function getKlineSymbols(): string[] {
  if (cached !== null) return cached;
  const raw = getEnvSymbols();
  cached = parseSymbolsRaw(raw);
  return cached;
}

/**
 * Lista de símbolos para backfill/painel em dev.
 * Em desenvolvimento usa KLINE_SYMBOLS_DEV (ou NEXT_PUBLIC_KLINE_SYMBOLS_DEV) se definido; senão KLINE_SYMBOLS.
 * Em produção usa getKlineSymbols(). Sem cache em dev para refletir .env.
 */
export function getKlineSymbolsForBackfill(): string[] {
  if (typeof process === "undefined" || !process.env) {
    return parseSymbolsRaw(DEFAULT_SYMBOLS);
  }
  if (process.env.NODE_ENV === "development") {
    const raw =
      process.env.KLINE_SYMBOLS_DEV ??
      process.env.NEXT_PUBLIC_KLINE_SYMBOLS_DEV ??
      process.env.KLINE_SYMBOLS ??
      process.env.NEXT_PUBLIC_KLINE_SYMBOLS ??
      DEFAULT_SYMBOLS;
    const list = parseSymbolsRaw(raw);
    return list.length > 0 ? list : parseSymbolsRaw(DEFAULT_SYMBOLS);
  }
  return getKlineSymbols();
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
