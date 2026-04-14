-- Cache atemporal (gráficos Renko 1×, Range, Kagi, Renko 2×, trades500).
-- Espelha a ideia de backcrypto."BinanceKlineCache" (OHLC por intervalo), com chartKind na chave.
-- Schema: backcrypto

CREATE TABLE IF NOT EXISTS backcrypto."BinanceKlineCache2" (
  "symbol" TEXT NOT NULL,
  "chartKind" VARCHAR(32) NOT NULL,
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
  CONSTRAINT "BinanceKlineCache2_pkey" PRIMARY KEY ("symbol", "chartKind", "interval", "openTime")
);

CREATE INDEX IF NOT EXISTS "BinanceKlineCache2_symbol_chartKind_interval_openTime_idx"
  ON backcrypto."BinanceKlineCache2" ("symbol", "chartKind", "interval", "openTime");

CREATE INDEX IF NOT EXISTS "BinanceKlineCache2_symbol_chartKind_interval_openTime_desc_idx"
  ON backcrypto."BinanceKlineCache2" ("symbol", "chartKind", "interval", "openTime" DESC);
