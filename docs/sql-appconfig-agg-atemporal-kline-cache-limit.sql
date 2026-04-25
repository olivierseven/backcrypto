-- backcrypto.AppConfig — máximo de barras a carregar nos gráficos atemporais (Renko/Range/Kagi/Renko2×/trades500).
-- Lido em runtime por resolveAggAtemporalKlineCacheLimit() (src/lib/crypto-app-config.ts).
-- Usado em GET /api/binance/kline-cache2-bars (take + campo JSON `maxBars`).
-- Fallback: env AGG_ATEMPORAL_KLINE_CACHE_LIMIT; depois default 5000. Valores efetivos: 100–50000.

INSERT INTO backcrypto."AppConfig" (key, value, description, "createdAt", "updatedAt")
VALUES (
  'AGG_ATEMPORAL_KLINE_CACHE_LIMIT',
  '5000',
  'Máximo de barras BinanceKlineCache2 por pedido (gráficos atemporais). 100–50000.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (key) DO NOTHING;
