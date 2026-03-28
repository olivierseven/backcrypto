import type { AggFastBarRowPayload } from "@/app/lib/binanceAggRenkoCore";

/**
 * Mesmo formato que GET /api/binance/agg-fast-bars (rowToKline + applyTimezoneOffset).
 */
export function aggPayloadToDisplayKline(p: AggFastBarRowPayload, timezoneOffsetHours: number): (string | number)[] {
  const row: (string | number)[] = [
    Number(p.openTime),
    String(p.open),
    String(p.high),
    String(p.low),
    String(p.close),
    String(p.volume),
    Number(p.closeTime),
    String(p.quoteAssetVolume),
    p.numberOfTrades,
    String(p.takerBuyBaseAssetVolume),
    String(p.takerBuyQuoteAssetVolume),
    0,
  ];
  if (timezoneOffsetHours === 0) return row;
  const offsetMs = timezoneOffsetHours * 60 * 60 * 1000;
  return [
    Number(row[0]) + offsetMs,
    row[1],
    row[2],
    row[3],
    row[4],
    row[5],
    Number(row[6]) + offsetMs,
    row[7],
    row[8],
    row[9],
    row[10],
    row[11],
  ];
}

/**
 * Junta cache do servidor (GET) com barras calculadas em cliente a partir de aggTrade (sem persistir).
 * Chave = openTime em exibição (após fuso); barras ao vivo sobrescrevem a mesma chave.
 */
export function mergeAggFastServerAndLive(
  serverKlines: readonly (readonly (string | number | null)[])[],
  liveRows: Iterable<AggFastBarRowPayload>,
  timezoneOffsetHours: number,
  maxBars = 1000
): (string | number | null)[][] {
  const m = new Map<number, (string | number | null)[]>();
  for (const row of serverKlines) {
    const ot = Number(row[0]);
    if (Number.isFinite(ot)) m.set(ot, [...row]);
  }
  for (const p of liveRows) {
    const k = aggPayloadToDisplayKline(p, timezoneOffsetHours);
    m.set(Number(k[0]), k);
  }
  const sorted = [...m.values()].sort((a, b) => Number(b[0]) - Number(a[0]));
  const out: (string | number | null)[][] = [];
  const eps = 1e-12;

  const num = (v: string | number | null | undefined): number => Number(v);
  const eq = (a: string | number | null | undefined, b: string | number | null | undefined): boolean => {
    const na = num(a);
    const nb = num(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
    return Math.abs(na - nb) <= eps;
  };

  for (const row of sorted) {
    const prev = out[out.length - 1];
    if (prev != null && eq(prev[1], row[1]) && eq(prev[4], row[4])) {
      // Duplicata estrutural (mesmo open/close em timestamps diferentes):
      // mantém o candle mais novo e incorpora extremos de pavio/volume.
      const prevHigh = num(prev[2]);
      const prevLow = num(prev[3]);
      const rowHigh = num(row[2]);
      const rowLow = num(row[3]);
      if (Number.isFinite(prevHigh) && Number.isFinite(rowHigh)) prev[2] = String(Math.max(prevHigh, rowHigh));
      if (Number.isFinite(prevLow) && Number.isFinite(rowLow)) prev[3] = String(Math.min(prevLow, rowLow));

      const prevVol = num(prev[5]);
      const rowVol = num(row[5]);
      if (Number.isFinite(prevVol) && Number.isFinite(rowVol)) prev[5] = String(Math.max(prevVol, rowVol));

      const prevQVol = num(prev[7]);
      const rowQVol = num(row[7]);
      if (Number.isFinite(prevQVol) && Number.isFinite(rowQVol)) prev[7] = String(Math.max(prevQVol, rowQVol));

      const prevTrades = num(prev[8]);
      const rowTrades = num(row[8]);
      if (Number.isFinite(prevTrades) && Number.isFinite(rowTrades)) prev[8] = Math.max(prevTrades, rowTrades);
      continue;
    }
    out.push([...row]);
    if (out.length >= maxBars) break;
  }

  return out;
}
