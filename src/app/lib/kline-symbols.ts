/**
 * Lista de símbolos: só do banco (KlineSymbol). Fallback BTCUSDT, ETHUSDT.
 * Sync, cache-refresh, backfill e APIs usam getKlineSymbolsFromDb; dropdown usa GET /api/klines/symbols.
 */
import type { PrismaClient } from "@/lib/prisma-bio-client";

/** Fallback quando o banco está vazio ou indisponível. */
export const DEFAULT_SYMBOLS_LIST: readonly string[] = ["BTCUSDT", "ETHUSDT"];

/** Defaults de janela (dias) quando KlineSymbol.requiredDays* é null. */
export const DEFAULT_REQUIRED_DAYS_1M = 9;
export const DEFAULT_REQUIRED_DAYS_5M = 90;
export const DEFAULT_REQUIRED_DAYS_1H = 730;

export type KlineSymbolWithPeriods = {
  symbol: string;
  requiredDays1m: number;
  requiredDays5m: number;
  requiredDays1h: number;
};

/**
 * Lista de símbolos a partir da tabela KlineSymbol (ativo = true).
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

/**
 * Lista de símbolos com períodos (requiredDays 1m, 5m, 1h) para validador e backfill.
 * Null no banco => default (9, 90, 730).
 */
export async function getKlineSymbolsWithPeriods(db: PrismaClient): Promise<KlineSymbolWithPeriods[]> {
  const rows = await db.klineSymbol.findMany({
    where: { ativo: true },
    orderBy: { symbol: "asc" },
    select: { symbol: true, requiredDays1m: true, requiredDays5m: true, requiredDays1h: true },
  });
  return rows.map((r) => ({
    symbol: r.symbol,
    requiredDays1m: r.requiredDays1m ?? DEFAULT_REQUIRED_DAYS_1M,
    requiredDays5m: r.requiredDays5m ?? DEFAULT_REQUIRED_DAYS_5M,
    requiredDays1h: r.requiredDays1h ?? DEFAULT_REQUIRED_DAYS_1H,
  }));
}

/** Fallback: lista fixa (não usa mais env). */
export function getKlineSymbols(): string[] {
  return [...DEFAULT_SYMBOLS_LIST];
}

/**
 * Verifica se o símbolo está na lista. Opcional: passar lista do banco; senão usa fallback.
 */
export function isAllowedSymbol(symbol: string | null | undefined, list?: string[]): boolean {
  if (!symbol || typeof symbol !== "string") return false;
  const L = list ?? DEFAULT_SYMBOLS_LIST;
  return L.length === 0
    ? DEFAULT_SYMBOLS_LIST.includes(symbol.trim().toUpperCase())
    : L.includes(symbol.trim().toUpperCase());
}

/**
 * Retorna o símbolo se válido na lista, senão o primeiro da lista. Opcional: passar lista do banco.
 */
export function resolveSymbol(symbol: string | null | undefined, list?: string[]): string {
  const L = list ?? DEFAULT_SYMBOLS_LIST;
  const first = L[0] ?? "BTCUSDT";
  if (!symbol || typeof symbol !== "string") return first;
  const s = symbol.trim().toUpperCase();
  return L.includes(s) ? s : first;
}

/** Verifica se o erro da Binance é "símbolo inválido" (-1121). Assim podemos ignorar o símbolo em vez de falhar. */
export function isBinanceInvalidSymbolError(e: unknown): boolean {
  if (!e || typeof (e as Error).message !== "string") return false;
  const msg = (e as Error).message;
  return msg.includes("-1121") || msg.toLowerCase().includes("invalid symbol");
}
