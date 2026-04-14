import type { PrismaClient } from "@/lib/prisma-bio-client";
import {
  RENKO_CACHE2_MAX_ROWS,
  RENKO_CACHE_TICK_INTERVALS,
} from "@/app/lib/renkoKlineCache2Build";
import { processTickChartKlineCacheWithSourceFlags } from "@/app/lib/tickChartKlineCache2FromFastFlags";
import {
  FAST_CHART_KINDS,
  isFastChartKind,
  type FastChartKind,
} from "@/app/lib/fastChartKind";

export { FAST_CHART_KINDS, isFastChartKind, type FastChartKind } from "@/app/lib/fastChartKind";

export const FAST_SOURCE_TABLE: Record<FastChartKind, string> = {
  renko: "BinanceRenkoFast",
  renko2x: "BinanceRenko2xFast",
  range: "BinanceRangeFast",
  kagi: "BinanceKagiFast",
};

const SOURCE_INTERVAL = "5ticks";

export function fastKlineCache2GetJson(
  chartKind: FastChartKind,
  options?: { implicitChartKind?: boolean }
) {
  const implicit = options?.implicitChartKind === true;
  return {
    source: FAST_SOURCE_TABLE[chartKind],
    sourceInterval: SOURCE_INTERVAL,
    chartKind,
    implicitChartKindInUrl: implicit,
    cacheIntervals: [...RENKO_CACHE_TICK_INTERVALS],
    description:
      "5ticks = 1:1 com a origem; 15ticks = 3 linhas; 25=5; 50=10; 100=20; 150=30; 200=40 linhas de 5ticks agregadas (OHLC). Resto incompleto no fim é omitido. Depois do agrupamento, expurgo: no máximo 5000 linhas por combinação (symbol, chartKind, interval), mantendo os tijolos mais recentes.",
    postBody: implicit
      ? {
          corretora: "opcional, padrão binance",
          symbol:
            "opcional (maiúsculas); omitido = todos os símbolos com dados 5ticks na tabela de origem",
          incremental5ticks:
            "opcional boolean, padrão true — só acrescenta novos tijolos 5ticks no cache; false refaz 5ticks inteiro",
          incrementalAggregates:
            "opcional boolean, padrão true — flags k2Incl*ticks na tabela *Fast* de origem; false refaz tiers agregados do zero",
        }
      : {
          chartKind: "obrigatório: renko | renko2x | range | kagi",
          corretora: "opcional, padrão binance",
          symbol:
            "opcional (maiúsculas); omitido = todos os símbolos com dados 5ticks na tabela de origem",
          incremental5ticks:
            "opcional boolean, padrão true — só acrescenta novos tijolos 5ticks no cache; false refaz 5ticks inteiro",
          incrementalAggregates:
            "opcional boolean, padrão true — colunas k2Incl*ticks na origem; false rebuild completo dos tiers agregados",
        },
  };
}

export function fastKlineCache2GetAllKindsJson() {
  return {
    chartKinds: [...FAST_CHART_KINDS],
    sourceByKind: { ...FAST_SOURCE_TABLE },
    shared: {
      sourceInterval: SOURCE_INTERVAL,
      cacheIntervals: [...RENKO_CACHE_TICK_INTERVALS],
      purgeMaxRowsPerSeries: RENKO_CACHE2_MAX_ROWS,
      incrementalAggregatesDefault: true,
    },
    routes:
      "POST tick: /crypto/api/dev/fast-kline-cache2 ou renko-kline-cache2, renko2x-kline-cache2, range-kline-cache2, kagi-kline-cache2 · trades: /crypto/api/dev/trade-kline-cache2",
  };
}

async function groupSymbolsForKind(
  db: PrismaClient,
  chartKind: FastChartKind,
  corretora: string,
  sourceInterval: string
): Promise<string[]> {
  const where = { corretora, interval: sourceInterval };
  switch (chartKind) {
    case "renko":
      return (
        await db.binanceRenkoFast.groupBy({
          by: ["symbol"],
          where,
        })
      ).map((g) => g.symbol);
    case "renko2x":
      return (
        await db.binanceRenko2xFast.groupBy({
          by: ["symbol"],
          where,
        })
      ).map((g) => g.symbol);
    case "range":
      return (
        await db.binanceRangeFast.groupBy({
          by: ["symbol"],
          where,
        })
      ).map((g) => g.symbol);
    case "kagi":
      return (
        await db.binanceKagiFast.groupBy({
          by: ["symbol"],
          where,
        })
      ).map((g) => g.symbol);
    default: {
      const _exhaustive: never = chartKind;
      return _exhaustive;
    }
  }
}

export async function fastKlineCache2PostJson(
  db: PrismaClient,
  body: Record<string, unknown>,
  chartKindFixed?: FastChartKind
): Promise<Record<string, unknown>> {
  if (chartKindFixed) {
    const bodyKind =
      typeof body.chartKind === "string" ? body.chartKind.trim() : "";
    if (bodyKind && bodyKind !== chartKindFixed) {
      return {
        error: `nesta rota omita chartKind ou use "${chartKindFixed}"`,
      };
    }
  }
  const rawKind =
    chartKindFixed ??
    (typeof body.chartKind === "string" ? body.chartKind.trim() : "");
  if (!rawKind || !isFastChartKind(rawKind)) {
    return {
      error: chartKindFixed
        ? "rota inválida"
        : "chartKind obrigatório: renko | renko2x | range | kagi",
    };
  }
  const chartKind = rawKind;

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
  const incremental5ticks = body.incremental5ticks !== false;
  const incrementalAggregates = body.incrementalAggregates !== false;

  const symbols: string[] = symbol
    ? [symbol]
    : await groupSymbolsForKind(db, chartKind, corretora, SOURCE_INTERVAL);

  if (symbols.length === 0) {
    return {
      ok: true,
      chartKind,
      symbols: 0,
      message: `nenhum símbolo com dados 5ticks em ${FAST_SOURCE_TABLE[chartKind]} para esta corretora`,
    };
  }

  const perSymbol: Record<string, string | number | Record<string, number>>[] =
    [];

  for (const sym of symbols) {
    const r = await processTickChartKlineCacheWithSourceFlags(db, {
      chartKind,
      corretora,
      symbol: sym,
      incremental5ticks,
      incrementalAggregates,
    });
    perSymbol.push({
      symbol: r.symbol,
      intervals: r.intervals,
      purgeDeleted: r.purgeDeleted,
      purgeMaxRows: r.purgeMaxRows,
      tickK2FlagsOnOrigin: `${FAST_SOURCE_TABLE[chartKind]}.k2Incl*ticks`,
    });
  }

  return {
    ok: true,
    chartKind,
    corretora,
    symbolFilter: symbol ?? "all",
    incremental5ticks,
    incrementalAggregates,
    symbolsProcessed: symbols.length,
    perSymbol,
  };
}

/** Após `createMany` em tabelas *Fast* a 5ticks — mantém `BinanceKlineCache2` alinhado (usado por `/api/dev/agg-fast-bars`). */
export async function refreshFastKlineCache2AfterFastInsert(
  db: PrismaClient,
  params: {
    corretora: string;
    symbols: string[];
    chartKind: FastChartKind;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const uniq = [...new Set(params.symbols)];
  for (const sym of uniq) {
    const r = await fastKlineCache2PostJson(
      db,
      {
        corretora: params.corretora,
        symbol: sym,
        incremental5ticks: true,
        incrementalAggregates: true,
      },
      params.chartKind
    );
    if ("error" in r) {
      return { ok: false, error: String(r.error) };
    }
  }
  return { ok: true };
}
