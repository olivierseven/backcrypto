/**
 * Lista de símbolos: só do banco (KlineSymbol). Fallback BTCUSDT, ETHUSDT.
 * Sync, cache-refresh, backfill e APIs usam getKlineSymbolsFromDb; dropdown usa GET /api/klines/symbols.
 */
import type { PrismaClient } from "@/lib/prisma-bio-client";

/** Fallback quando o banco está vazio ou indisponível. */
export const DEFAULT_SYMBOLS_LIST: readonly string[] = ["BTCUSDT", "ETHUSDT"];

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
