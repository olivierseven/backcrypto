/**
 * Volume no preço: agrega volume por faixa de preço (fechamento) nos candles visíveis.
 */

import type { VolumeAtPriceData } from "./types";

/** Calcula volume por faixa de preço (fechamento) com intervalos simétricos entre min e max dos closes. */
export function computeVolumeAtPriceBuckets(
  klinesRaw: (string | number)[][],
  numBuckets: number
): VolumeAtPriceData | null {
  if (klinesRaw.length === 0 || numBuckets < 1) return null;
  const closes = klinesRaw.map((r) => parseFloat(String(r[4] ?? 0))).filter((c) => Number.isFinite(c));
  if (closes.length === 0) return null;
  const minC = Math.min(...closes);
  const maxC = Math.max(...closes);
  if (minC >= maxC) return null;
  const buckets: { priceLow: number; priceHigh: number; volume: number }[] = [];
  for (let i = 0; i < numBuckets; i++) {
    buckets.push({
      priceLow: minC + (maxC - minC) * (i / numBuckets),
      priceHigh: minC + (maxC - minC) * ((i + 1) / numBuckets),
      volume: 0,
    });
  }
  let maxVolume = 0;
  for (let j = 0; j < klinesRaw.length; j++) {
    const close = parseFloat(String(klinesRaw[j][4] ?? 0));
    const vol = parseFloat(String(klinesRaw[j][5] ?? 0));
    if (!Number.isFinite(close) || !Number.isFinite(vol) || vol < 0) continue;
    const idx =
      close >= maxC ? numBuckets - 1 : Math.min(numBuckets - 1, Math.floor(((close - minC) / (maxC - minC)) * numBuckets));
    if (idx >= 0 && idx < numBuckets) {
      buckets[idx].volume += vol;
      if (buckets[idx].volume > maxVolume) maxVolume = buckets[idx].volume;
    }
  }
  return { buckets, maxVolume };
}
