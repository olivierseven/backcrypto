/** Alinhado a src/app/lib/kline-symbols.ts (só o que o refresh usa). */
import type { PrismaClient } from "@prisma/client";

export const DEFAULT_REQUIRED_DAYS_1M = 9;
export const DEFAULT_REQUIRED_DAYS_5M = 90;
export const DEFAULT_REQUIRED_DAYS_1H = 730;

export type KlineSymbolWithPeriods = {
  symbol: string;
  requiredDays1m: number;
  requiredDays5m: number;
  requiredDays1h: number;
};

export async function getKlineSymbolsFromDb(db: PrismaClient): Promise<string[]> {
  const rows = await db.klineSymbol.findMany({
    where: { ativo: true },
    orderBy: { symbol: "asc" },
    select: { symbol: true },
  });
  return rows.map((r) => r.symbol);
}

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
