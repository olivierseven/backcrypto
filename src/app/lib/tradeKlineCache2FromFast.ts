import type { PrismaClient } from "@/lib/prisma-bio-client";
import { TRADE_CACHE_BASE_TRADES, TRADE_CACHE_TRADE_INTERVALS } from "@/app/lib/renkoKlineCache2Build";
import {
  processTradeKlineCacheWithSourceFlags,
  TRADE_CACHE_CHART_KIND,
} from "@/app/lib/tradeKlineCache2FromFastFlags";

export { TRADE_CACHE_CHART_KIND };

const SOURCE_INTERVAL = `${TRADE_CACHE_BASE_TRADES}trades`;

export function tradeKlineCache2GetJson(options?: { implicitRoute?: boolean }) {
  const implicit = options?.implicitRoute === true;
  return {
    source: "BinanceTradeCountFast",
    sourceInterval: SOURCE_INTERVAL,
    chartKind: TRADE_CACHE_CHART_KIND,
    implicitRoute: implicit,
    cacheIntervals: [...TRADE_CACHE_TRADE_INTERVALS],
    description:
      "500trades = 1:1 com a origem; 1000trades = 2 linhas; 2500 = 5; 5000 = 10; 7500 = 15; 10000 = 20 linhas de 500-trades agregadas (OHLC). Resto incompleto omitido. Expurgo: no máximo 5000 linhas por (symbol, chartKind, interval).",
    postBody: implicit
      ? {
          corretora: "opcional, padrão binance",
          symbol:
            "opcional (maiúsculas); omitido = todos os símbolos com dados na origem",
          incremental500trades:
            "opcional boolean, padrão true — só acrescenta novas velas 500trades; false refaz 500trades inteiro",
          incrementalAggregates:
            "opcional boolean, padrão true — flags k2Incl*trades em BinanceTradeCountFast; false rebuild completo dos tiers agregados",
        }
      : {
          corretora: "opcional, padrão binance",
          symbol:
            "opcional (maiúsculas); omitido = todos os símbolos com dados na origem",
          incremental500trades:
            "opcional boolean, padrão true — só acrescenta novas velas 500trades; false refaz 500trades inteiro",
          incrementalAggregates:
            "opcional boolean, padrão true — colunas na origem (k2Incl*trades); false rebuild completo por tier",
        },
  };
}

export async function tradeKlineCache2PostJson(
  db: PrismaClient,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const corretora =
    typeof body.corretora === "string" && body.corretora.trim()
      ? body.corretora.trim()
      : "binance";
  const symRaw =
    typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  if (symRaw && !/^[A-Z0-9]+$/.test(symRaw)) {
    return { error: "symbol inválido" };
  }
  const symbol = symRaw || null;
  const incremental500trades = body.incremental500trades !== false;
  const incrementalAggregates = body.incrementalAggregates !== false;

  const symbols: string[] = symbol
    ? [symbol]
    : (
        await db.binanceTradeCountFast.groupBy({
          by: ["symbol"],
          where: { corretora, interval: SOURCE_INTERVAL },
        })
      ).map((g) => g.symbol);

  if (symbols.length === 0) {
    return {
      ok: true,
      chartKind: TRADE_CACHE_CHART_KIND,
      symbols: 0,
      message: "nenhum símbolo com dados em BinanceTradeCountFast para esta corretora",
    };
  }

  const perSymbol: Record<string, string | number | Record<string, number>>[] =
    [];

  for (const sym of symbols) {
    const r = await processTradeKlineCacheWithSourceFlags(db, {
      corretora,
      symbol: sym,
      incremental500trades,
      incrementalAggregates,
    });
    perSymbol.push({
      symbol: r.symbol,
      intervals: r.intervals,
      purgeDeleted: r.purgeDeleted,
      purgeMaxRows: r.purgeMaxRows,
      tradeK2FlagsOnOrigin: "BinanceTradeCountFast.k2Incl*trades",
    });
  }

  return {
    ok: true,
    chartKind: TRADE_CACHE_CHART_KIND,
    corretora,
    symbolFilter: symbol ?? "all",
    incremental500trades,
    incrementalAggregates,
    symbolsProcessed: symbols.length,
    perSymbol,
  };
}

/** Após insert em `BinanceTradeCountFast` (500trades). */
export async function refreshTradeKlineCache2AfterFastInsert(
  db: PrismaClient,
  params: { corretora: string; symbols: string[] }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const uniq = [...new Set(params.symbols)];
  for (const sym of uniq) {
    const r = await tradeKlineCache2PostJson(db, {
      corretora: params.corretora,
      symbol: sym,
      incremental500trades: true,
      incrementalAggregates: true,
    });
    if ("error" in r) {
      return { ok: false, error: String(r.error) };
    }
  }
  return { ok: true };
}
