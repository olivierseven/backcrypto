-- Mesmo ficheiro que em crypto_vps/docs — seed para o serviço VPS (AppConfig).

INSERT INTO backcrypto."AppConfig" (key, value, description, "createdAt", "updatedAt")
VALUES
  (
    'FLUSH_INTERVAL_MS',
    '7000',
    'Intervalo em milissegundos entre flush ao Postgres e atualização do BinanceKlineCache2 (flags k2). Lido pelo VPS em arranque; fallback: env FLUSH_INTERVAL_MS.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'FAST_SOURCE_MAX_ROWS',
    '5000',
    'Teto de linhas por moeda e intervalo nas tabelas Binance*Fast (origem do cache2). 0 desliga o expurgo nas Fast. Fallback: env FAST_SOURCE_MAX_ROWS.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'FAST_SOURCE_PURGE_MIN_MS',
    '300000',
    'Expurgo nas tabelas Fast no máximo a cada N ms (300000 = 5 min). 0 = expurgo em cada ciclo de flush. Fallback: env FAST_SOURCE_PURGE_MIN_MS.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'BINANCE_API_BASE_URL',
    'https://api.binance.com',
    'Base URL da API REST Binance para o sync-klines (subpasta crypto_vps). Fallback: env BINANCE_API_BASE_URL.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'SYNC_INTERVAL_MS',
    '60000',
    'Intervalo em ms entre corridas do processo sync-klines (1m/5m/1h). Mínimo 5000. Fallback: env SYNC_INTERVAL_MS.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT (key) DO NOTHING;
