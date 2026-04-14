import { NextRequest, NextResponse } from "next/server";
import { TRADES_PER_CANDLE } from "@/app/lib/binanceAggRenkoCore";
import {
  refreshFastKlineCache2AfterFastInsert,
  type FastChartKind,
} from "@/app/lib/fastKlineCache2FromFast";
import { refreshTradeKlineCache2AfterFastInsert } from "@/app/lib/tradeKlineCache2FromFast";
import { isCryptoDevRoutesEnabled } from "@/lib/crypto-dev-routes";
import { getCryptoPrismaDev } from "@/lib/crypto-db";

export const dynamic = "force-dynamic";

type Kind = "renko" | "range" | "kagi" | "renko2x" | "trades500";

type RowIn = {
  symbol: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteAssetVolume: number;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: number;
  takerBuyQuoteAssetVolume: number;
};

const MAX_ROWS = 2000;
/** Renko/Range/Kagi/Renko2× a 5ticks → agregados *ticks em `BinanceKlineCache2`. */
const FAST_TICK_INTERVAL = "5ticks";
/** `BinanceTradeCountFast` + cache `chartKind` trades500 (500trades, 1000trades, …). */
const FAST_TRADE_INTERVAL = `${TRADES_PER_CANDLE}trades`;

function toDec8(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(8);
}

function parseRow(x: unknown): RowIn | null {
  if (x == null || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const symbol = typeof o.symbol === "string" ? o.symbol.trim().toUpperCase() : "";
  if (!symbol || !/^[A-Z0-9]+$/.test(symbol)) return null;
  const openTime = Number(o.openTime);
  const closeTime = Number(o.closeTime);
  if (!Number.isFinite(openTime) || !Number.isFinite(closeTime)) return null;
  const open = Number(o.open);
  const high = Number(o.high);
  const low = Number(o.low);
  const close = Number(o.close);
  const volume = Number(o.volume);
  const quoteAssetVolume = Number(o.quoteAssetVolume);
  const numberOfTrades = Number(o.numberOfTrades);
  const takerBuyBaseAssetVolume = Number(o.takerBuyBaseAssetVolume);
  const takerBuyQuoteAssetVolume = Number(o.takerBuyQuoteAssetVolume);
  if (![open, high, low, close, volume, quoteAssetVolume, takerBuyBaseAssetVolume, takerBuyQuoteAssetVolume].every(Number.isFinite)) {
    return null;
  }
  if (!Number.isFinite(numberOfTrades)) return null;
  return {
    symbol,
    openTime,
    closeTime,
    open,
    high,
    low,
    close,
    volume,
    quoteAssetVolume,
    numberOfTrades,
    takerBuyBaseAssetVolume,
    takerBuyQuoteAssetVolume,
  };
}

/**
 * Grava lotes de barras agregadas (Renko / Range / Kagi / Renko2× / trades) nas tabelas *Fast.
 * Com linhas novas: `interval` 5ticks → atualiza cache tick (POST /api/dev/fast-kline-cache2);
 * `interval` 500trades e kind trades500 → cache por contagem de trades (POST /api/dev/trade-kline-cache2).
 * Só ativo quando rotas dev estão habilitadas (middleware + isCryptoDevRoutesEnabled).
 * Usa `getCryptoPrismaDev()`: `URL_DEV` se definido, senão `DATABASE_URL` (igual a `crypto-db`).
 */
export async function POST(request: NextRequest) {
  if (!isCryptoDevRoutesEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const kind = b.kind as Kind;
  if (kind !== "renko" && kind !== "range" && kind !== "kagi" && kind !== "renko2x" && kind !== "trades500") {
    return NextResponse.json({ error: "kind inválido (renko | range | kagi | renko2x | trades500)" }, { status: 400 });
  }

  const corretora = typeof b.corretora === "string" && b.corretora.trim() ? b.corretora.trim() : "binance";
  const interval = typeof b.interval === "string" && b.interval.trim() ? b.interval.trim() : "5ticks";

  if (!Array.isArray(b.rows)) {
    return NextResponse.json({ error: "rows deve ser array" }, { status: 400 });
  }
  if (b.rows.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }
  if (b.rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `máx. ${MAX_ROWS} linhas por request` }, { status: 400 });
  }

  const parsed: RowIn[] = [];
  for (const item of b.rows) {
    const r = parseRow(item);
    if (!r) return NextResponse.json({ error: "linha inválida em rows" }, { status: 400 });
    parsed.push(r);
  }

  const data = parsed.map((r) => ({
    corretora,
    symbol: r.symbol,
    interval,
    openTime: BigInt(Math.trunc(r.openTime)),
    closeTime: BigInt(Math.trunc(r.closeTime)),
    open: toDec8(r.open),
    high: toDec8(r.high),
    low: toDec8(r.low),
    close: toDec8(r.close),
    volume: toDec8(r.volume),
    quoteAssetVolume: toDec8(r.quoteAssetVolume),
    numberOfTrades: Math.max(0, Math.trunc(r.numberOfTrades)),
    takerBuyBaseAssetVolume: toDec8(r.takerBuyBaseAssetVolume),
    takerBuyQuoteAssetVolume: toDec8(r.takerBuyQuoteAssetVolume),
  }));

  const db = getCryptoPrismaDev();
  const symbolsUnique = [...new Set(parsed.map((r) => r.symbol))];
  const chartKindForCache: FastChartKind | null =
    kind === "trades500" ? null : (kind as FastChartKind);

  try {
    const json =
      kind === "renko"
        ? await db.binanceRenkoFast.createMany({ data, skipDuplicates: true })
        : kind === "range"
          ? await db.binanceRangeFast.createMany({ data, skipDuplicates: true })
          : kind === "kagi"
            ? await db.binanceKagiFast.createMany({ data, skipDuplicates: true })
            : kind === "renko2x"
              ? await db.binanceRenko2xFast.createMany({ data, skipDuplicates: true })
              : await db.binanceTradeCountFast.createMany({ data, skipDuplicates: true });

    const { count } = json;

    let cache2:
      | { ok: true; symbolsRefreshed: number }
      | { ok: false; error: string }
      | undefined;

    /** Mesmo com `skipDuplicates` (count=0), o cache pode estar vazio ou desatualizado — refrescar sempre que houver payload. */
    if (
      parsed.length > 0 &&
      interval === FAST_TICK_INTERVAL &&
      chartKindForCache != null
    ) {
      const c2 = await refreshFastKlineCache2AfterFastInsert(db, {
        corretora,
        symbols: symbolsUnique,
        chartKind: chartKindForCache,
      });
      cache2 = c2.ok
        ? { ok: true, symbolsRefreshed: symbolsUnique.length }
        : c2;
    }

    let cache2Trades:
      | { ok: true; symbolsRefreshed: number }
      | { ok: false; error: string }
      | undefined;

    if (parsed.length > 0 && kind === "trades500" && interval === FAST_TRADE_INTERVAL) {
      const c2t = await refreshTradeKlineCache2AfterFastInsert(db, {
        corretora,
        symbols: symbolsUnique,
      });
      cache2Trades = c2t.ok
        ? { ok: true, symbolsRefreshed: symbolsUnique.length }
        : c2t;
    }

    const urlDev = process.env.URL_DEV?.trim();
    return NextResponse.json({
      inserted: count,
      kind,
      ...(urlDev
        ? {
            readVersusWriteHint:
              "POST grava em URL_DEV; GET /api/binance/agg-fast-bars (sistema) lê DATABASE_URL. Para ver as mesmas linhas no gráfico, alinhe as duas URLs ou remova URL_DEV em local.",
          }
        : {}),
      ...(cache2 ? { cache2 } : {}),
      ...(cache2Trades ? { cache2Trades } : {}),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
