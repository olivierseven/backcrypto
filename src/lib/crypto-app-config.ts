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
