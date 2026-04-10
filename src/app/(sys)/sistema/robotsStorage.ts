/** Persistência de robôs (Meus robôs) — partilhado entre RobotsPanel e KlinesTable. */

export const ROBOTS_STORAGE_KEY = "crypto_sistema_robots_v1";

/** Marca execução de compra por robô e openTime do candle (evita mais de uma compra no mesmo candle). */
export const ROBOT_BUY_EXEC_STORAGE_KEY = "crypto_sistema_robot_buy_exec_v1";

export const ROBOTS_CHANGED_EVENT = "crypto-sistema-robots-changed";

/** Percentual máximo do spot (1–100, passo 1%). */
export const ROBOT_MAX_SPOT_MIN = 1;
export const ROBOT_MAX_SPOT_MAX = 100;

/** Stop loss em % vs preço médio de compra: 0,1% a 5%, passo 0,1%. */
export const ROBOT_STOP_LOSS_PCT_MIN = 0.1;
export const ROBOT_STOP_LOSS_PCT_MAX = 5;

/** Em qual ocorrência (borda) do sinal de compra (sem posição) começa a acumulação em velas seguidas: 1–5. */
export const ROBOT_BUY_ACCUM_START_SIGNAL_MIN = 1;
export const ROBOT_BUY_ACCUM_START_SIGNAL_MAX = 5;

export type RobotSide = "buyer" | "seller";

export type RobotBuyOperationMode = "percent" | "fixed";

/** Stop loss: venda a mercado quando a perda não realizada atinge o limite (só se `stopLossEnabled`). */
export type RobotStopLossMode = "percent" | "fixed";

export interface SavedRobot {
  id: string;
  /** Nome amigável opcional (lista e backtest). */
  alias: string;
  side: RobotSide;
  buyCombinedStrategyIds: string[];
  sellCombinedStrategyIds: string[];
  /**
   * Opcional: “zerar” — comprador: o sinal arma alerta; a primeira vela com fecho ≤ médio de compra dispara venda a mercado.
   * Robô vendedor: reservado (live).
   */
  flattenCombinedStrategyIds: string[];
  /**
   * Comprador: enquanto o alerta de zerar estiver armado (mesmo sinal que o breakeven), venda a mercado quando
   * alguma destas estratégias combinadas for verdadeira na vela (em alternativa à venda automática por preço).
   */
  postFlattenSignalSellCombinedStrategyIds: string[];
  /**
   * Vendedor: enquanto o alerta de “zerar” estiver armado, compra a mercado quando alguma destas estratégias for
   * verdadeira (espelho da venda pós-sinal do comprador; live do vendedor ainda não ligado).
   */
  postFlattenSignalBuyCombinedStrategyIds: string[];
  createdAt: number;
  /** Se as estratégias deste robô estão aplicadas na tabela (só muda em Meus robôs). */
  isActive: boolean;
  /** Percentual máximo do spot (1–100). */
  maxSpotPercent: number;
  /** Modo da quantidade por operação: % do teto ou USDT fixo (≤ teto). */
  buyOperationMode: RobotBuyOperationMode;
  /** Se mode === "percent": % do máximo (0..maxSpotPercent). */
  buyOperationPercent: number;
  /** Se mode === "fixed": USDT por operação (≥ 0, ≤ teto quando aplicável). */
  buyOperationFixedUsdt: number;
  /**
   * Comprador: após o N-ésimo sinal de compra (transição para verdadeiro sem posição), o robô compra até ao teto,
   * no máximo uma compra por vela; se numa vela o preço não permitir compra (≤ última compra), para a sequência.
   */
  buyAccumulationStartOnSignalNumber: number;
  /** Ativa venda a mercado quando a perda ≥ limite (robô comprador). */
  stopLossEnabled: boolean;
  /** `percent`: perda vs preço médio de compra (%). `fixed`: perda em USDT (valor absoluto). */
  stopLossMode: RobotStopLossMode;
  /** Limite em % vs média de compra (0,1 a 5, passo 0,1). */
  stopLossPercent: number;
  /** Limite em USDT de perda não realizada (custo − valor atual). */
  stopLossFixedUsdt: number;
  /** Ativa venda a mercado quando o ganho não realizado ≥ limite (robô comprador). */
  stopGainEnabled: boolean;
  /** `percent`: ganho vs preço médio de compra (%). `fixed`: ganho em USDT (valor absoluto). */
  stopGainMode: RobotStopLossMode;
  /** Limite em % vs média de compra (0,1 a 5, passo 0,1). */
  stopGainPercent: number;
  /** Limite em USDT de ganho não realizado (valor atual − custo). */
  stopGainFixedUsdt: number;
  /**
   * USDT livre no spot no momento da ativação — referência fixa para o teto do robô enquanto `isActive`.
   * Não segue o saldo em tempo real após ativar.
   */
  referenceSpotUsdtFree: number | null;
}

/** robotId → openTime (string) → 1 */
export type RobotBuyExecMap = Record<string, Record<string, 1>>;

export function normalizeRobot(raw: unknown): SavedRobot | null {
  if (raw == null || typeof raw !== "object") return null;
  const x = raw as Record<string, unknown>;
  if (typeof x.id !== "string") return null;
  if (x.side !== "buyer" && x.side !== "seller") return null;
  const legacyCombinedRaw = x.combinedStrategyIds;
  const buyCombinedRaw = x.buyCombinedStrategyIds;
  const sellCombinedRaw = x.sellCombinedStrategyIds;
  if (!Array.isArray(legacyCombinedRaw) && !Array.isArray(buyCombinedRaw)) return null;
  if (typeof x.createdAt !== "number") return null;
  const buyIdsSource = Array.isArray(buyCombinedRaw) ? buyCombinedRaw : (legacyCombinedRaw as unknown[]);
  const buyIds = buyIdsSource.filter((id): id is string => typeof id === "string");
  const sellIds = Array.isArray(sellCombinedRaw)
    ? sellCombinedRaw.filter((id): id is string => typeof id === "string")
    : [];
  const flattenCombinedRaw = x.flattenCombinedStrategyIds;
  const flattenIds = Array.isArray(flattenCombinedRaw)
    ? flattenCombinedRaw.filter((id): id is string => typeof id === "string")
    : [];
  const postSellRaw = x.postFlattenSignalSellCombinedStrategyIds;
  const postSellIds = Array.isArray(postSellRaw)
    ? postSellRaw.filter((id): id is string => typeof id === "string")
    : [];
  const postBuyRaw = x.postFlattenSignalBuyCombinedStrategyIds;
  const postBuyIds = Array.isArray(postBuyRaw)
    ? postBuyRaw.filter((id): id is string => typeof id === "string")
    : [];
  const isActive = typeof x.isActive === "boolean" ? x.isActive : false;
  const maxSpotPercent =
    typeof x.maxSpotPercent === "number" && Number.isFinite(x.maxSpotPercent)
      ? Math.min(ROBOT_MAX_SPOT_MAX, Math.max(ROBOT_MAX_SPOT_MIN, Math.round(x.maxSpotPercent)))
      : ROBOT_MAX_SPOT_MAX;
  const buyRaw =
    typeof x.buyOperationPercent === "number" && Number.isFinite(x.buyOperationPercent)
      ? Math.round(x.buyOperationPercent)
      : 0;
  const buyOperationPercent = Math.min(Math.max(0, buyRaw), maxSpotPercent);
  const buyOperationMode: RobotBuyOperationMode = x.buyOperationMode === "fixed" ? "fixed" : "percent";
  const fixedRaw =
    typeof x.buyOperationFixedUsdt === "number" && Number.isFinite(x.buyOperationFixedUsdt)
      ? x.buyOperationFixedUsdt
      : 0;
  const buyOperationFixedUsdt = Math.max(0, fixedRaw);
  const startSigRaw =
    typeof x.buyAccumulationStartOnSignalNumber === "number" && Number.isFinite(x.buyAccumulationStartOnSignalNumber)
      ? Math.floor(x.buyAccumulationStartOnSignalNumber)
      : 1;
  const buyAccumulationStartOnSignalNumber = Math.min(
    ROBOT_BUY_ACCUM_START_SIGNAL_MAX,
    Math.max(ROBOT_BUY_ACCUM_START_SIGNAL_MIN, startSigRaw)
  );
  const stopLossEnabled = typeof x.stopLossEnabled === "boolean" ? x.stopLossEnabled : false;
  const stopLossMode: RobotStopLossMode = x.stopLossMode === "fixed" ? "fixed" : "percent";
  const slPctRaw =
    typeof x.stopLossPercent === "number" && Number.isFinite(x.stopLossPercent) ? x.stopLossPercent : 2;
  const stopLossPercent = Math.min(
    ROBOT_STOP_LOSS_PCT_MAX,
    Math.max(ROBOT_STOP_LOSS_PCT_MIN, Math.round(slPctRaw * 10) / 10)
  );
  const slFixRaw =
    typeof x.stopLossFixedUsdt === "number" && Number.isFinite(x.stopLossFixedUsdt) ? x.stopLossFixedUsdt : 25;
  const stopLossFixedUsdt = Math.max(0, slFixRaw);
  const stopGainEnabled = typeof x.stopGainEnabled === "boolean" ? x.stopGainEnabled : false;
  const stopGainMode: RobotStopLossMode = x.stopGainMode === "fixed" ? "fixed" : "percent";
  const sgPctRaw =
    typeof x.stopGainPercent === "number" && Number.isFinite(x.stopGainPercent) ? x.stopGainPercent : 2;
  const stopGainPercent = Math.min(
    ROBOT_STOP_LOSS_PCT_MAX,
    Math.max(ROBOT_STOP_LOSS_PCT_MIN, Math.round(sgPctRaw * 10) / 10)
  );
  const sgFixRaw =
    typeof x.stopGainFixedUsdt === "number" && Number.isFinite(x.stopGainFixedUsdt) ? x.stopGainFixedUsdt : 25;
  const stopGainFixedUsdt = Math.max(0, sgFixRaw);
  const refRaw = x.referenceSpotUsdtFree;
  const referenceSpotUsdtFree =
    typeof refRaw === "number" && Number.isFinite(refRaw) && refRaw >= 0 ? refRaw : null;
  const aliasRaw = x.alias;
  const alias =
    typeof aliasRaw === "string" ? aliasRaw.trim().slice(0, 80) : "";
  return {
    id: x.id,
    alias,
    side: x.side,
    buyCombinedStrategyIds: [...new Set(buyIds)],
    sellCombinedStrategyIds: [...new Set(sellIds)],
    flattenCombinedStrategyIds: [...new Set(flattenIds)],
    postFlattenSignalSellCombinedStrategyIds: [...new Set(postSellIds)],
    postFlattenSignalBuyCombinedStrategyIds: [...new Set(postBuyIds)],
    createdAt: x.createdAt,
    isActive,
    maxSpotPercent,
    buyOperationMode,
    buyOperationPercent,
    buyOperationFixedUsdt,
    buyAccumulationStartOnSignalNumber,
    stopLossEnabled,
    stopLossMode,
    stopLossPercent,
    stopLossFixedUsdt,
    stopGainEnabled,
    stopGainMode,
    stopGainPercent,
    stopGainFixedUsdt,
    referenceSpotUsdtFree: isActive ? referenceSpotUsdtFree : null,
  };
}

export function loadSavedRobots(): SavedRobot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ROBOTS_STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.map(normalizeRobot).filter((x): x is SavedRobot => x != null);
  } catch {
    return [];
  }
}

export function persistSavedRobots(list: SavedRobot[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROBOTS_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(ROBOTS_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

export function loadRobotBuyExecMap(): RobotBuyExecMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ROBOT_BUY_EXEC_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (p == null || typeof p !== "object") return {};
    return p as RobotBuyExecMap;
  } catch {
    return {};
  }
}

export function persistRobotBuyExecMap(map: RobotBuyExecMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROBOT_BUY_EXEC_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
