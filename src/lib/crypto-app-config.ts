import { cryptoPrisma } from "@/lib/crypto-db";

/** Chave em `backcrypto.AppConfig` — quantidade máxima de barras a carregar nos gráficos atemporais (GET kline-cache2-bars / merge agg). */
export const APP_CONFIG_KEY_AGG_ATEMPORAL_KLINE_CACHE_LIMIT = "AGG_ATEMPORAL_KLINE_CACHE_LIMIT";

/** Chave em `backcrypto.AppConfig` — limite de linhas no sync de reembolso (login afiliado). */
export const APP_CONFIG_KEY_AFFILIATE_REFUND_SYNC_ROW_LIMIT = "AFFILIATE_REFUND_SYNC_ROW_LIMIT";

const DEFAULT_AGG_ATEMPORAL_KLINE_CACHE_LIMIT = 5000;
const MIN_AGG_ATEMPORAL_KLINE_CACHE_LIMIT = 100;
const MAX_AGG_ATEMPORAL_KLINE_CACHE_LIMIT = 50_000;

const DEFAULT_AFFILIATE_REFUND_SYNC_ROW_LIMIT = 500;
const MAX_AFFILIATE_REFUND_SYNC_ROW_LIMIT = 2000;

function clampAggAtemporalKlineCacheLimit(n: number): number {
  return Math.max(
    MIN_AGG_ATEMPORAL_KLINE_CACHE_LIMIT,
    Math.min(MAX_AGG_ATEMPORAL_KLINE_CACHE_LIMIT, Math.floor(n))
  );
}

/**
 * Ordem: `AppConfig` AGG_ATEMPORAL_KLINE_CACHE_LIMIT → env `AGG_ATEMPORAL_KLINE_CACHE_LIMIT` → default 5000 (100–50000).
 * Usado pelo GET `/api/binance/kline-cache2-bars` e pelo cliente (merge / refetch).
 */
export async function resolveAggAtemporalKlineCacheLimit(): Promise<number> {
  try {
    const row = await cryptoPrisma.appConfig.findUnique({
      where: { key: APP_CONFIG_KEY_AGG_ATEMPORAL_KLINE_CACHE_LIMIT },
      select: { value: true },
    });
    if (row?.value) {
      const n = parseInt(String(row.value).trim(), 10);
      if (Number.isFinite(n)) return clampAggAtemporalKlineCacheLimit(n);
    }
  } catch {
    /* tabela ausente ou erro transitório */
  }
  const raw = process.env.AGG_ATEMPORAL_KLINE_CACHE_LIMIT;
  if (raw != null && raw !== "") {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return clampAggAtemporalKlineCacheLimit(n);
  }
  return DEFAULT_AGG_ATEMPORAL_KLINE_CACHE_LIMIT;
}

function clampAffiliateRefundSyncRowLimit(n: number): number {
  return Math.max(1, Math.min(MAX_AFFILIATE_REFUND_SYNC_ROW_LIMIT, n));
}

/**
 * Ordem: `AppConfig` → env `AFFILIATE_REFUND_SYNC_ROW_LIMIT` → default 500 (1–2000).
 */
export async function resolveAffiliateRefundSyncRowLimit(): Promise<number> {
  try {
    const row = await cryptoPrisma.appConfig.findUnique({
      where: { key: APP_CONFIG_KEY_AFFILIATE_REFUND_SYNC_ROW_LIMIT },
      select: { value: true },
    });
    if (row?.value) {
      const n = parseInt(String(row.value).trim(), 10);
      if (Number.isFinite(n)) return clampAffiliateRefundSyncRowLimit(n);
    }
  } catch {
    /* tabela ausente ou erro transitório */
  }
  const raw = process.env.AFFILIATE_REFUND_SYNC_ROW_LIMIT;
  if (raw != null && raw !== "") {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return clampAffiliateRefundSyncRowLimit(n);
  }
  return DEFAULT_AFFILIATE_REFUND_SYNC_ROW_LIMIT;
}

// Tabelas Bio removidas; retorna apenas defaults (sem BioAppConfig).
const BIO_QUEUE_KEYS = [
  "bio_queue_max_fila_1x", "bio_queue_max_fila_20x", "bio_queue_max_fila_100x", "bio_queue_max_fila_1000x",
  "bio_queue_poll_interval_ms", "bio_queue_max_wait_ms",
  "bio_queue_use_queue_fila_1x", "bio_queue_use_queue_fila_20x", "bio_queue_use_queue_fila_100x", "bio_queue_use_queue_fila_1000x",
] as const;

export type CryptoQueueConfigKey = (typeof BIO_QUEUE_KEYS)[number];

const DEFAULTS: Record<string, string> = {
  bio_queue_max_fila_1x: "6", bio_queue_max_fila_20x: "4", bio_queue_max_fila_100x: "3", bio_queue_max_fila_1000x: "2",
  bio_queue_poll_interval_ms: "1500", bio_queue_max_wait_ms: "180000",
  bio_queue_use_queue_fila_1x: "0", bio_queue_use_queue_fila_20x: "1", bio_queue_use_queue_fila_100x: "1", bio_queue_use_queue_fila_1000x: "1",
};

export async function getCryptoQueueConfigMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const k of BIO_QUEUE_KEYS) {
    map.set(k, DEFAULTS[k] ?? "");
  }
  return map;
}

export function getCryptoQueueConfigNumber(map: Map<string, string>, key: string, defaultNum: number): number {
  const raw = map.get(key) ?? DEFAULTS[key] ?? "";
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : defaultNum;
}

export function getMaxConcurrentFromMap(map: Map<string, string>, queueName: string): number {
  const key = `bio_queue_max_${queueName}` as CryptoQueueConfigKey;
  const defaults: Record<string, number> = { fila_1x: 6, fila_20x: 4, fila_100x: 3, fila_1000x: 2 };
  return getCryptoQueueConfigNumber(map, key, defaults[queueName] ?? 3);
}

export function getUseQueueFromMap(map: Map<string, string>, queueName: string): boolean {
  const key = `bio_queue_use_queue_${queueName}` as CryptoQueueConfigKey;
  const raw = map.get(key) ?? DEFAULTS[key] ?? "";
  return raw === "1" || raw === "true" || raw === "yes";
}
