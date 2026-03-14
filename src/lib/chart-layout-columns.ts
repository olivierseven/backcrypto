/**
 * Helpers para o esquema de 4 colunas (layout, indicators, strategies, others).
 * others = configs rápidas (visibleCount, chartStyle, candleBodyStyle, drawingsVisible, chartSizePercent, yPadOffset).
 * Desenhos (draw-segments) ficam só no localStorage, não vão no layout.
 */

type JsonValue = Record<string, unknown> | unknown[] | null;

/** Chaves que vão na coluna others (configs rápidas). Símbolo fica só em localStorage (KLINE_SYMBOL_KEY), fallback BTCUSDT. */
export const OTHERS_KEYS = [
  "visibleCount",
  "chartStyle",
  "candleBodyStyle",
  "drawingsVisible",
  "chartSizePercent",
  "yPadOffset",
] as const;

/** Monta o config único a partir das colunas (para resposta GET). others sobrepõe layout para as chaves rápidas. */
export function mergeColumnsToConfig(
  layout: JsonValue,
  indicators: JsonValue,
  strategies: JsonValue,
  others?: JsonValue
): Record<string, unknown> {
  const layoutObj = layout != null && typeof layout === "object" && !Array.isArray(layout) ? (layout as Record<string, unknown>) : {};
  const indicatorsArr = Array.isArray(indicators) ? indicators : [];
  const strategiesObj = strategies != null && typeof strategies === "object" && !Array.isArray(strategies) ? (strategies as Record<string, unknown>) : {};
  const strategiesList = Array.isArray(strategiesObj.strategies) ? strategiesObj.strategies : [];
  const appliedIds = Array.isArray(strategiesObj.appliedStrategyIds) ? strategiesObj.appliedStrategyIds : [];
  const othersObj = others != null && typeof others === "object" && !Array.isArray(others) ? (others as Record<string, unknown>) : {};
  return {
    ...layoutObj,
    userIndicators: indicatorsArr,
    strategies: strategiesList,
    appliedStrategyIds: appliedIds,
    ...othersObj,
  };
}

/** Extrai layout, indicators, strategies e others a partir do config único. */
export function splitConfigToColumns(config: Record<string, unknown>): {
  layout: Record<string, unknown>;
  indicators: unknown[];
  strategies: { strategies: unknown[]; appliedStrategyIds: string[] };
  others: Record<string, unknown>;
} {
  const { userIndicators, strategies: strategiesList, appliedStrategyIds, ...rest } = config;
  const others: Record<string, unknown> = {};
  const layout: Record<string, unknown> = {};
  for (const key of Object.keys(rest)) {
    if (OTHERS_KEYS.includes(key as (typeof OTHERS_KEYS)[number]) && rest[key] !== undefined) {
      others[key] = rest[key];
    } else {
      layout[key] = rest[key];
    }
  }
  return {
    layout,
    indicators: Array.isArray(userIndicators) ? userIndicators : [],
    strategies: {
      strategies: Array.isArray(strategiesList) ? strategiesList : [],
      appliedStrategyIds: Array.isArray(appliedStrategyIds) ? appliedStrategyIds.filter((id): id is string => typeof id === "string") : [],
    },
    others,
  };
}
