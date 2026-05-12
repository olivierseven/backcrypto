/**
 * Snapshot para o painel de debug: aggTrade (WS) → tijolos fechados tier base → tier do gráfico (só a partir do tier base).
 */
import type { AggChartKind } from "./KlinesChartConstants";
import type { AggFastBarRowPayload } from "@/app/lib/binanceAggRenkoCore";
import { BRICK_TICK_UNITS, TRADES_PER_CANDLE } from "@/app/lib/binanceAggRenkoCore";
import {
  aggregateFastBarsFrom5TickBricksToTier,
  aggregateFastBarsFromTradeCountRows,
  RENKO_BASE_TICKS,
  RENKO_CACHE_TICK_INTERVALS,
  TRADE_CACHE_TRADE_INTERVALS,
  type RenkoCacheTickInterval,
  type TradeCacheTradeInterval,
} from "@/app/lib/renkoKlineCache2Build";
import {
  aggFastLiveBrickLogicalKey,
  aggPayloadToFastSourceRow,
  ohlcChunkToAggPayload,
} from "./aggFastKlineMerge";

/** Um print aggTrade (após parse), para a tabela “buffer WS”. */
export type AggFastLiveWsTradeRow = {
  t: number;
  p: number;
  q: number;
  m?: boolean;
};

/** Estado do tick para o painel (origem API vs fallback + erro). */
export type AggFastLivePriceTickDiagnostics = {
  tick: number | null;
  source: "api" | "fallback" | null;
  /** Mensagem do JSON ou rede quando GET daily-close-tick falha. */
  apiError: string | null;
  /** Situação extra (traduzida no painel por código). */
  hintKey: "loading" | "no_valid_close" | "tick_zero" | null;
};

/** Itens traduzidos no painel (código → chave em translations). */
export type AggFastLiveDiagItem =
  | { k: "tickApiError"; error: string }
  | { k: "tickFallbackActive" }
  | { k: "tickStillMissing" }
  | { k: "wsNeedsTick" }
  | { k: "bufferEmpty" }
  | { k: "noBrickYet" }
  | { k: "hintLoading" }
  | { k: "hintNoValidClose" }
  | { k: "hintTickZero" };

export type AggFastLiveDebugSnapshot = {
  at: number;
  symbol: string;
  chartKind: AggChartKind;
  interval: string;
  /** Rótulo curto do tier (ex. P25, 1kT). */
  tierShortLabel: string;
  /** Rótulo do tier base (5ticks ou 500trades). */
  baseTierLabel: string;
  /** Linhas do tier base por vela do gráfico (ex. 5 tijolos P5 → 1 vela P25). */
  groupSize: number;
  /** Linhas do tier base que não fecham um bloco completo no tier do gráfico. */
  remainderIncomplete: number;
  /** Número de aggTrades no anel (WS) usado no debug. */
  rawWsTradeCount: number;
  /** Contagem de tijolos fechados no mapa live (tier base). */
  baseTierTotalCount: number;
  /** Tick de preço = GET daily-close-tick (0,01% do último fecho diário completo), não % do tijolo anterior. */
  priceTick: number | null;
  /** Altura Renko intervalo «5ticks»: BRICK_TICK_UNITS × priceTick (ex.: 5 × tick). */
  brickHeight: number | null;
  /** Mais recentes primeiro — negócios individuais do stream (não são tijolos). */
  rawWsTradesNewestFirst: AggFastLiveWsTradeRow[];
  /** Mais recentes primeiro — mesmo canon que o VPS em `aggregateFastBarsFrom5TickBricksToTier` / `aggregateFastBarsFromTradeCountRows` sobre a origem. */
  baseTierRowsNewestFirst: AggFastBarRowPayload[];
  /** Mais recentes primeiro — tier do gráfico, agregado só a partir dos tijolos base. */
  chartTierRowsNewestFirst: AggFastBarRowPayload[];
  /** Último estado do hook (tick / API / fallback). */
  priceTickDiagnostics: AggFastLivePriceTickDiagnostics | null;
  /** Sugestões quando tudo vazio ou inconsistente. */
  diagnostics: AggFastLiveDiagItem[];
  /** Último GET kline-cache2 periódico (atemporais) que terminou com sucesso; null se nunca correu ou falhou sempre. */
  lastPeriodicCacheRefreshOkAt: number | null;
};

const MAX_RAW_WS_TRADES = 120;
const MAX_BASE_ROWS = 80;
const MAX_CHART_ROWS = 50;

function buildAggLiveDiagnostics(
  cache2: { chartKind: AggChartKind; interval: string },
  priceTick: number | null,
  rawWsCount: number,
  baseTierRowCount: number,
  tickDiag: AggFastLivePriceTickDiagnostics | null
): AggFastLiveDiagItem[] {
  const out: AggFastLiveDiagItem[] = [];
  const tickOk = priceTick != null && priceTick > 0;
  if (tickDiag?.hintKey === "no_valid_close") {
    out.push({ k: "hintNoValidClose" });
  }
  if (tickDiag?.hintKey === "tick_zero") {
    out.push({ k: "hintTickZero" });
  }
  if (tickDiag?.apiError && tickDiag.source === "fallback") {
    out.push({ k: "tickApiError", error: tickDiag.apiError });
  }
  if (tickDiag?.source === "fallback" && tickOk) {
    out.push({ k: "tickFallbackActive" });
  }
  if (tickDiag?.hintKey === "loading") {
    out.push({ k: "hintLoading" });
  } else if (!tickOk) {
    out.push({ k: "tickStillMissing" });
    out.push({ k: "wsNeedsTick" });
  }
  if (rawWsCount === 0) {
    out.push({ k: "bufferEmpty" });
  } else if (baseTierRowCount === 0) {
    out.push({ k: "noBrickYet" });
  }

  const seen = new Set<string>();
  return out.filter((d) => {
    const key = d.k === "tickApiError" ? `${d.k}:${d.error}` : d.k;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Mesmo tijolo com openTime/closeTime diferentes → uma linha (última ocorrência por ordem temporal). */
function dedupeBricksByLogicalKey(rowsAsc: AggFastBarRowPayload[]): AggFastBarRowPayload[] {
  const m = new Map<string, AggFastBarRowPayload>();
  for (const r of rowsAsc) {
    m.set(aggFastLiveBrickLogicalKey(r), r);
  }
  return [...m.values()].sort(
    (a, b) => a.openTime - b.openTime || a.closeTime - b.closeTime || a.open - b.open
  );
}

function tierGroupSize(
  cache2: { chartKind: AggChartKind; interval: string }
): { groupSize: number; baseTierLabel: string } {
  if (cache2.chartKind === "trades500") {
    const m = /^(\d+)trades$/.exec(cache2.interval.trim());
    const tr = m ? Number(m[1]) : TRADE_CACHE_TRADE_INTERVALS[0];
    const gs = Math.max(1, tr / TRADES_PER_CANDLE);
    return { groupSize: gs, baseTierLabel: `${TRADES_PER_CANDLE}trades` };
  }
  const tm = /^(\d+)ticks$/.exec(cache2.interval.trim());
  const ticks = tm ? Number(tm[1]) : RENKO_BASE_TICKS;
  if (ticks <= RENKO_BASE_TICKS) {
    return { groupSize: 1, baseTierLabel: "5ticks" };
  }
  return {
    groupSize: Math.max(1, ticks / RENKO_BASE_TICKS),
    baseTierLabel: "5ticks",
  };
}

/**
 * @param closedBricksFromEngine Uma linha por tijolo **fechado**: só o que o `step*` emitiu (append-only no KlinesTable). Não substitui linhas — evita parecer “tempo real” por reprocessar Map/estado intermédio.
 * @param rawWsTradesAsc Negócios aggTrade (mesmo filtro de tempo que o gráfico), ordem cronológica.
 */
export function buildAggFastLiveDebugSnapshot(
  closedBricksFromEngine: Iterable<AggFastBarRowPayload>,
  rawWsTradesAsc: readonly AggFastLiveWsTradeRow[],
  cache2: { chartKind: AggChartKind; interval: string },
  symbol: string,
  tierShortLabel: string,
  priceTick: number | null,
  priceTickDiagnostics: AggFastLivePriceTickDiagnostics | null,
  lastPeriodicCacheRefreshOkAt: number | null = null
): AggFastLiveDebugSnapshot {
  const rowsSorted = [...closedBricksFromEngine].sort(
    (a, b) => a.openTime - b.openTime || a.closeTime - b.closeTime || a.open - b.open
  );
  const rowsAsc = dedupeBricksByLogicalKey(rowsSorted);
  const src = rowsAsc.map(aggPayloadToFastSourceRow);

  /** Alinhado a `crypto_vps` `tickChartKlineCache2FromFastFlags` / `tradeKlineCache2FromFastFlags`: tier fonte = agregação gs=1 (ticks) ou 500tr. */
  let baseAsc: AggFastBarRowPayload[];
  if (cache2.chartKind === "trades500") {
    baseAsc = aggregateFastBarsFromTradeCountRows(
      src,
      TRADES_PER_CANDLE as TradeCacheTradeInterval,
      "trades500"
    ).map(ohlcChunkToAggPayload);
  } else {
    baseAsc = aggregateFastBarsFrom5TickBricksToTier(
      src,
      RENKO_BASE_TICKS as RenkoCacheTickInterval,
      cache2.chartKind
    ).map(ohlcChunkToAggPayload);
  }

  /** Full rebuild no VPS: cada intervalo a partir de `allSrc` (não encadeado). */
  let chartAsc: AggFastBarRowPayload[];
  if (cache2.chartKind === "trades500") {
    const m = /^(\d+)trades$/.exec(cache2.interval.trim());
    const tr = m ? Number(m[1]) : TRADE_CACHE_TRADE_INTERVALS[0];
    if (!Number.isFinite(tr) || !(TRADE_CACHE_TRADE_INTERVALS as readonly number[]).includes(tr)) {
      chartAsc = baseAsc;
    } else if (tr === TRADE_CACHE_TRADE_INTERVALS[0]) {
      chartAsc = baseAsc;
    } else {
      chartAsc = aggregateFastBarsFromTradeCountRows(
        src,
        tr as TradeCacheTradeInterval,
        "trades500"
      ).map(ohlcChunkToAggPayload);
    }
  } else {
    const tm = /^(\d+)ticks$/.exec(cache2.interval.trim());
    const ticks = tm ? Number(tm[1]) : RENKO_BASE_TICKS;
    if (!Number.isFinite(ticks) || !(RENKO_CACHE_TICK_INTERVALS as readonly number[]).includes(ticks)) {
      chartAsc = baseAsc;
    } else if (ticks === RENKO_BASE_TICKS) {
      chartAsc = baseAsc;
    } else {
      chartAsc = aggregateFastBarsFrom5TickBricksToTier(
        src,
        ticks as RenkoCacheTickInterval,
        cache2.chartKind
      ).map(ohlcChunkToAggPayload);
    }
  }

  const { groupSize, baseTierLabel } = tierGroupSize(cache2);
  /** Após merge/Decimal→number podem sobrar duplicatas lógicas; mesma regra de chave que o Map live. */
  const baseForTable = dedupeBricksByLogicalKey(baseAsc);
  const chartForTable = dedupeBricksByLogicalKey(chartAsc);
  const remainderIncomplete =
    groupSize > 1 && baseForTable.length > 0 ? baseForTable.length % groupSize : 0;

  const rawTrim = rawWsTradesAsc.length > MAX_RAW_WS_TRADES ? rawWsTradesAsc.slice(-MAX_RAW_WS_TRADES) : rawWsTradesAsc;
  const rawNewest = [...rawTrim].reverse();

  const brickH =
    cache2.chartKind !== "trades500" && priceTick != null && priceTick > 0
      ? BRICK_TICK_UNITS * priceTick
      : null;

  const diagnostics = buildAggLiveDiagnostics(
    cache2,
    priceTick,
    rawWsTradesAsc.length,
    baseForTable.length,
    priceTickDiagnostics
  );

  return {
    at: Date.now(),
    symbol: symbol.trim().toUpperCase(),
    chartKind: cache2.chartKind,
    interval: cache2.interval,
    tierShortLabel,
    baseTierLabel,
    groupSize,
    remainderIncomplete,
    rawWsTradeCount: rawWsTradesAsc.length,
    baseTierTotalCount: baseForTable.length,
    priceTick,
    brickHeight: brickH,
    rawWsTradesNewestFirst: rawNewest,
    baseTierRowsNewestFirst: baseForTable.slice(-MAX_BASE_ROWS).reverse(),
    chartTierRowsNewestFirst: chartForTable.slice(-MAX_CHART_ROWS).reverse(),
    priceTickDiagnostics,
    diagnostics,
    lastPeriodicCacheRefreshOkAt,
  };
}
