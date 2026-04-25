import type { UserIndicatorConfig } from "../KlinesIndicatorsContext";

/**
 * Quantas colunas extra (após índices 0–11) este indicador ocupa na linha estendida — alinhado a `extendedKlines` em KlinesTable.
 */
export function indicatorColumnSpan(ind: UserIndicatorConfig): number {
  if (ind.type === "Volume") return 0;
  if (ind.type === "MACD" || ind.type === "DIFF") {
    return (
      1 +
      (ind.type === "MACD" ? (ind.macdSignalLine ? 1 : 0) : ind.diffSignalLine ? 1 : 0) +
      (ind.type === "MACD" ? (ind.macdHistogram ? 1 : 0) : ind.diffHistogram ? 1 : 0)
    );
  }
  if (ind.type === "Stochastic") return 1 + (ind.stochDLine ? 1 : 0);
  if (ind.type === "WilliamsR") return 1;
  if (ind.type === "Bollinger" || ind.type === "Keltner" || ind.type === "Donchian") return 3;
  if (ind.type === "Ichimoku") return 5;
  if (ind.type === "ADX") return 3;
  if (
    ind.type === "OBV" ||
    ind.type === "AD" ||
    ind.type === "SAR" ||
    ind.type === "ATR" ||
    ind.type === "VWAP" ||
    ind.type === "CCI" ||
    ind.type === "CMF" ||
    ind.type === "MFI"
  ) {
    return 1;
  }
  return 1;
}

/** Primeira coluna (índice 12+) do indicador na posição `indicatorIndex` — mesma regra que KlinesTable / getFieldIndex. */
export function indicatorColumnStart(userIndicators: UserIndicatorConfig[], indicatorIndex: number): number {
  let col = 12;
  for (let i = 0; i < indicatorIndex; i++) {
    col += indicatorColumnSpan(userIndicators[i]!);
  }
  return col;
}

/** Alias histórico — mesmo que `indicatorColumnStart`. */
export function getIndicatorColumnStart(userIndicators: UserIndicatorConfig[], indicatorIndex: number): number {
  return indicatorColumnStart(userIndicators, indicatorIndex);
}
