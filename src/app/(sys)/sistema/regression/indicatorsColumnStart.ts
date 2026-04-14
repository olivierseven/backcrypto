import type { UserIndicatorConfig } from "../KlinesIndicatorsContext";

/** Primeira coluna (índice 12+) de cada indicador na linha estendida — espelha KlinesTable. */
export function getIndicatorColumnStart(userIndicators: UserIndicatorConfig[], indicatorIndex: number): number {
  let col = 12;
  for (let i = 0; i < indicatorIndex; i++) {
    const ind = userIndicators[i];
    if (ind.type === "MACD") {
      col += 1 + (ind.macdSignalLine ? 1 : 0) + (ind.macdHistogram ? 1 : 0);
    } else if (ind.type === "DIFF") {
      col += 1 + (ind.diffSignalLine ? 1 : 0) + (ind.diffHistogram ? 1 : 0);
    } else if (ind.type === "Stochastic") {
      col += 1 + (ind.stochDLine ? 1 : 0);
    } else if (ind.type === "WilliamsR") {
      col += 1;
    } else if (ind.type === "Bollinger" || ind.type === "Keltner" || ind.type === "Donchian") {
      col += 3;
    } else if (ind.type === "Ichimoku") {
      col += 5;
    } else if (ind.type === "ADX") {
      col += 3;
    } else if (ind.type === "Volume") {
      /* não consome slot */
    } else if (
      ind.type === "OBV" ||
      ind.type === "SAR" ||
      ind.type === "ATR" ||
      ind.type === "VWAP" ||
      ind.type === "CCI" ||
      ind.type === "CMF" ||
      ind.type === "MFI"
    ) {
      col += 1;
    } else {
      col += 1;
    }
  }
  return col;
}
