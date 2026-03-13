/**
 * Helpers para o esquema de 3 colunas (layout, indicators, strategies).
 * Usado por chart-layouts e chart-models.
 */

type JsonValue = Record<string, unknown> | unknown[] | null;

/** Monta o config único a partir das 3 colunas (para resposta GET compatível com o cliente). */
export function mergeColumnsToConfig(
  layout: JsonValue,
  indicators: JsonValue,
  strategies: JsonValue
): Record<string, unknown> {
  const layoutObj = layout != null && typeof layout === "object" && !Array.isArray(layout) ? (layout as Record<string, unknown>) : {};
  const indicatorsArr = Array.isArray(indicators) ? indicators : [];
  const strategiesObj = strategies != null && typeof strategies === "object" && !Array.isArray(strategies) ? (strategies as Record<string, unknown>) : {};
  const strategiesList = Array.isArray(strategiesObj.strategies) ? strategiesObj.strategies : [];
  const appliedIds = Array.isArray(strategiesObj.appliedStrategyIds) ? strategiesObj.appliedStrategyIds : [];
  return {
    ...layoutObj,
    userIndicators: indicatorsArr,
    strategies: strategiesList,
    appliedStrategyIds: appliedIds,
  };
}

/** Extrai layout, indicators e strategies a partir do config único (legado). */
export function splitConfigToColumns(config: Record<string, unknown>): {
  layout: Record<string, unknown>;
  indicators: unknown[];
  strategies: { strategies: unknown[]; appliedStrategyIds: string[] };
} {
  const { userIndicators, strategies: strategiesList, appliedStrategyIds, ...layout } = config;
  return {
    layout,
    indicators: Array.isArray(userIndicators) ? userIndicators : [],
    strategies: {
      strategies: Array.isArray(strategiesList) ? strategiesList : [],
      appliedStrategyIds: Array.isArray(appliedStrategyIds) ? appliedStrategyIds.filter((id): id is string => typeof id === "string") : [],
    },
  };
}
