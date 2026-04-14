/**
 * Helpers para o esquema de colunas: layout, indicators, strategies, regressions, others.
 * others = configs rápidas (visibleCount, chartStyle, candleBodyStyle, drawingsVisible, chartSizePercent, yPadOffset).
 * Regressões do utilizador ficam na coluna `regressions` (array), não no JSON `layout`.
 * Desenhos (draw-segments) ficam só no localStorage, não vão no layout.
 */

/** Compatible with Prisma JsonValue (string | number | boolean | object | array | null). */
type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

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
  others?: JsonValue,
  regressions?: JsonValue,
  robots?: JsonValue
): Record<string, unknown> {
  const layoutObj = layout != null && typeof layout === "object" && !Array.isArray(layout) ? (layout as Record<string, unknown>) : {};
  const { userRegressions: legacyRegressions, ...layoutRest } = layoutObj;
  const fromRegressionsCol = regressions != null && Array.isArray(regressions) ? regressions : null;
  const userRegressions =
    fromRegressionsCol != null ? fromRegressionsCol : Array.isArray(legacyRegressions) ? legacyRegressions : [];

  const indicatorsArr = Array.isArray(indicators) ? indicators : [];
  const strategiesObj = strategies != null && typeof strategies === "object" && !Array.isArray(strategies) ? (strategies as Record<string, unknown>) : {};
  const strategiesList = Array.isArray(strategiesObj.strategies) ? strategiesObj.strategies : [];
  const appliedIds = Array.isArray(strategiesObj.appliedStrategyIds) ? strategiesObj.appliedStrategyIds : [];
  const othersObj = others != null && typeof others === "object" && !Array.isArray(others) ? (others as Record<string, unknown>) : {};
  const base: Record<string, unknown> = {
    ...layoutRest,
    userIndicators: indicatorsArr,
    userRegressions,
    strategies: strategiesList,
    appliedStrategyIds: appliedIds,
    ...othersObj,
  };
  /**
   * `robots === undefined`: não enviar (ex.: modelo default em ChartModels — não sobrescrever localStorage).
   * `robots === null` ou objeto: vindo de ChartLayout; `null` = ainda sem dados → lista/exec vazios.
   */
  if (robots !== undefined) {
    const robotsObj =
      robots != null && typeof robots === "object" && !Array.isArray(robots) ? (robots as Record<string, unknown>) : {};
    base.savedRobots = Array.isArray(robotsObj.savedRobots) ? robotsObj.savedRobots : [];
    base.robotBuyExecMap =
      robotsObj.buyExecMap != null && typeof robotsObj.buyExecMap === "object" && !Array.isArray(robotsObj.buyExecMap)
        ? robotsObj.buyExecMap
        : {};
  }
  return base;
}

/** Extrai colunas a partir do config único (POST legado com `config` único). */
export function splitConfigToColumns(config: Record<string, unknown>): {
  layout: Record<string, unknown>;
  indicators: unknown[];
  strategies: { strategies: unknown[]; appliedStrategyIds: string[] };
  regressions: unknown[];
  others: Record<string, unknown>;
  robots: Record<string, unknown> | null;
} {
  const { userIndicators, userRegressions, strategies: strategiesList, appliedStrategyIds, savedRobots, robotBuyExecMap, ...rest } = config;
  const others: Record<string, unknown> = {};
  const layout: Record<string, unknown> = {};
  for (const key of Object.keys(rest)) {
    if (OTHERS_KEYS.includes(key as (typeof OTHERS_KEYS)[number]) && rest[key] !== undefined) {
      others[key] = rest[key];
    } else {
      layout[key] = rest[key];
    }
  }
  const hasRobots = Array.isArray(savedRobots) || (robotBuyExecMap != null && typeof robotBuyExecMap === "object" && !Array.isArray(robotBuyExecMap));
  const robots: Record<string, unknown> | null = hasRobots
    ? {
        savedRobots: Array.isArray(savedRobots) ? savedRobots : [],
        buyExecMap:
          robotBuyExecMap != null && typeof robotBuyExecMap === "object" && !Array.isArray(robotBuyExecMap)
            ? robotBuyExecMap
            : {},
      }
    : null;
  return {
    layout,
    indicators: Array.isArray(userIndicators) ? userIndicators : [],
    strategies: {
      strategies: Array.isArray(strategiesList) ? strategiesList : [],
      appliedStrategyIds: Array.isArray(appliedStrategyIds) ? appliedStrategyIds.filter((id): id is string => typeof id === "string") : [],
    },
    regressions: Array.isArray(userRegressions) ? userRegressions : [],
    others,
    robots,
  };
}
