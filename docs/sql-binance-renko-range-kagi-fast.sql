-- Tabelas alinhadas a prisma/schema.prisma (BinanceKlineFast).
-- Schema: backcrypto. Intervalo previsto nas linhas: "5ticks".
-- Executar manualmente no PostgreSQL (não há migração Prisma neste repo).

CREATE TABLE IF NOT EXISTS backcrypto."BinanceRenkoFast" (
  "corretora" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "interval" TEXT NOT NULL,
  "openTime" BIGINT NOT NULL,
  "open" DECIMAL(32, 8) NOT NULL,
  "high" DECIMAL(32, 8) NOT NULL,
  "low" DECIMAL(32, 8) NOT NULL,
  "close" DECIMAL(32, 8) NOT NULL,
  "volume" DECIMAL(32, 8) NOT NULL,
  "closeTime" BIGINT NOT NULL,
  "quoteAssetVolume" DECIMAL(32, 8) NOT NULL,
  "numberOfTrades" INTEGER NOT NULL,
  "takerBuyBaseAssetVolume" DECIMAL(32, 8) NOT NULL,
  "takerBuyQuoteAssetVolume" DECIMAL(32, 8) NOT NULL,
  CONSTRAINT "BinanceRenkoFast_pkey" PRIMARY KEY ("corretora", "symbol", "interval", "openTime")
);

CREATE INDEX IF NOT EXISTS "BinanceRenkoFast_corretora_symbol_interval_openTime_idx"
  ON backcrypto."BinanceRenkoFast" ("corretora", "symbol", "interval", "openTime");
CREATE INDEX IF NOT EXISTS "BinanceRenkoFast_symbol_interval_openTime_desc_idx"
  ON backcrypto."BinanceRenkoFast" ("corretora", "symbol", "interval", "openTime" DESC);

CREATE TABLE IF NOT EXISTS backcrypto."BinanceRangeFast" (
  "corretora" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "interval" TEXT NOT NULL,
  "openTime" BIGINT NOT NULL,
  "open" DECIMAL(32, 8) NOT NULL,
  "high" DECIMAL(32, 8) NOT NULL,
  "low" DECIMAL(32, 8) NOT NULL,
  "close" DECIMAL(32, 8) NOT NULL,
  "volume" DECIMAL(32, 8) NOT NULL,
  "closeTime" BIGINT NOT NULL,
  "quoteAssetVolume" DECIMAL(32, 8) NOT NULL,
  "numberOfTrades" INTEGER NOT NULL,
  "takerBuyBaseAssetVolume" DECIMAL(32, 8) NOT NULL,
  "takerBuyQuoteAssetVolume" DECIMAL(32, 8) NOT NULL,
  CONSTRAINT "BinanceRangeFast_pkey" PRIMARY KEY ("corretora", "symbol", "interval", "openTime")
);

CREATE INDEX IF NOT EXISTS "BinanceRangeFast_corretora_symbol_interval_openTime_idx"
  ON backcrypto."BinanceRangeFast" ("corretora", "symbol", "interval", "openTime");
CREATE INDEX IF NOT EXISTS "BinanceRangeFast_symbol_interval_openTime_desc_idx"
  ON backcrypto."BinanceRangeFast" ("corretora", "symbol", "interval", "openTime" DESC);

CREATE TABLE IF NOT EXISTS backcrypto."BinanceKagiFast" (
  "corretora" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "interval" TEXT NOT NULL,
  "openTime" BIGINT NOT NULL,
  "open" DECIMAL(32, 8) NOT NULL,
  "high" DECIMAL(32, 8) NOT NULL,
  "low" DECIMAL(32, 8) NOT NULL,
  "close" DECIMAL(32, 8) NOT NULL,
  "volume" DECIMAL(32, 8) NOT NULL,
  "closeTime" BIGINT NOT NULL,
  "quoteAssetVolume" DECIMAL(32, 8) NOT NULL,
  "numberOfTrades" INTEGER NOT NULL,
  "takerBuyBaseAssetVolume" DECIMAL(32, 8) NOT NULL,
  "takerBuyQuoteAssetVolume" DECIMAL(32, 8) NOT NULL,
  CONSTRAINT "BinanceKagiFast_pkey" PRIMARY KEY ("corretora", "symbol", "interval", "openTime")
);

CREATE INDEX IF NOT EXISTS "BinanceKagiFast_corretora_symbol_interval_openTime_idx"
  ON backcrypto."BinanceKagiFast" ("corretora", "symbol", "interval", "openTime");
CREATE INDEX IF NOT EXISTS "BinanceKagiFast_symbol_interval_openTime_desc_idx"
  ON backcrypto."BinanceKagiFast" ("corretora", "symbol", "interval", "openTime" DESC);

-- Renko 2× (clássico) e velas por contagem de trades (ex.: interval "500trades").
CREATE TABLE IF NOT EXISTS backcrypto."BinanceRenko2xFast" (
  "corretora" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "interval" TEXT NOT NULL,
  "openTime" BIGINT NOT NULL,
  "open" DECIMAL(32, 8) NOT NULL,
  "high" DECIMAL(32, 8) NOT NULL,
  "low" DECIMAL(32, 8) NOT NULL,
  "close" DECIMAL(32, 8) NOT NULL,
  "volume" DECIMAL(32, 8) NOT NULL,
  "closeTime" BIGINT NOT NULL,
  "quoteAssetVolume" DECIMAL(32, 8) NOT NULL,
  "numberOfTrades" INTEGER NOT NULL,
  "takerBuyBaseAssetVolume" DECIMAL(32, 8) NOT NULL,
  "takerBuyQuoteAssetVolume" DECIMAL(32, 8) NOT NULL,
  CONSTRAINT "BinanceRenko2xFast_pkey" PRIMARY KEY ("corretora", "symbol", "interval", "openTime")
);

CREATE INDEX IF NOT EXISTS "BinanceRenko2xFast_corretora_symbol_interval_openTime_idx"
  ON backcrypto."BinanceRenko2xFast" ("corretora", "symbol", "interval", "openTime");
CREATE INDEX IF NOT EXISTS "BinanceRenko2xFast_symbol_interval_openTime_desc_idx"
  ON backcrypto."BinanceRenko2xFast" ("corretora", "symbol", "interval", "openTime" DESC);

CREATE TABLE IF NOT EXISTS backcrypto."BinanceTradeCountFast" (
  "corretora" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "interval" TEXT NOT NULL,
  "openTime" BIGINT NOT NULL,
  "open" DECIMAL(32, 8) NOT NULL,
  "high" DECIMAL(32, 8) NOT NULL,
  "low" DECIMAL(32, 8) NOT NULL,
  "close" DECIMAL(32, 8) NOT NULL,
  "volume" DECIMAL(32, 8) NOT NULL,
  "closeTime" BIGINT NOT NULL,
  "quoteAssetVolume" DECIMAL(32, 8) NOT NULL,
  "numberOfTrades" INTEGER NOT NULL,
  "takerBuyBaseAssetVolume" DECIMAL(32, 8) NOT NULL,
  "takerBuyQuoteAssetVolume" DECIMAL(32, 8) NOT NULL,
  CONSTRAINT "BinanceTradeCountFast_pkey" PRIMARY KEY ("corretora", "symbol", "interval", "openTime")
);

CREATE INDEX IF NOT EXISTS "BinanceTradeCountFast_corretora_symbol_interval_openTime_idx"
  ON backcrypto."BinanceTradeCountFast" ("corretora", "symbol", "interval", "openTime");
CREATE INDEX IF NOT EXISTS "BinanceTradeCountFast_symbol_interval_openTime_desc_idx"
  ON backcrypto."BinanceTradeCountFast" ("corretora", "symbol", "interval", "openTime" DESC);
