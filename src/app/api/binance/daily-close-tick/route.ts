import { NextRequest, NextResponse } from "next/server";
import { defaultTickFromDailyClose, parseBinanceCloseString } from "@/app/lib/binanceDefaultTick";

export const dynamic = "force-dynamic";

const BINANCE_BASE = (process.env.BINANCE_API_BASE_URL || "https://api.binance.com").replace(/\/$/, "");

/**
 * Último fecho diário **completo** (UTC) + tick padrão (0,01 % do fecho, arredondado).
 * GET /crypto/api/binance/daily-close-tick?symbol=BTCUSDT
 *
 * Com `limit=2` no 1d, a Binance devolve [mais antigo, mais recente]: o último candle pode ser o dia corrente (ainda aberto).
 * Usamos o fecho do penúltimo candle quando existem dois — é o último dia já fechado.
 */
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol || !/^[A-Z0-9]+$/.test(symbol)) {
    return NextResponse.json({ error: "symbol inválido (ex.: BTCUSDT)" }, { status: 400 });
  }

  const url = new URL(`${BINANCE_BASE}/api/v3/klines`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("limit", "2");

  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 451) {
      return NextResponse.json(
        { error: "Binance 451: use BINANCE_API_BASE_URL com proxy se necessário." },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: `Binance ${res.status}`, detail: text.slice(0, 200) }, { status: 502 });
  }

  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json({ error: "Resposta inválida da Binance" }, { status: 502 });
  }

  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ error: "Sem candles diários" }, { status: 404 });
  }

  const rows = data as unknown[][];
  /** Com 2 linhas: [0] = dia anterior fechado, [1] = hoje (pode aberto). Fecho “último dia completo” = [0][4]. */
  const useRow = rows.length >= 2 ? rows[0] : rows[rows.length - 1];
  const closeStr = typeof useRow?.[4] === "string" ? useRow[4] : String(useRow?.[4] ?? "");
  const lastCompletedDailyClose = parseBinanceCloseString(closeStr);
  const tick = defaultTickFromDailyClose(lastCompletedDailyClose);
  const singleCandleOnly = rows.length < 2;

  return NextResponse.json({
    symbol,
    lastCompletedDailyClose: closeStr,
    lastCompletedDailyCloseNum: lastCompletedDailyClose,
    tick,
    formula: "lastCompletedDailyClose * 0.01% (fracionário)",
    /** Se só há 1 candle 1d, o “fecho” ainda pode ser intraday. */
    incomplete: singleCandleOnly,
  });
}
