-- CreateTable: cache de klines agregados (3m até 1d), sem dia atual UTC
CREATE TABLE "backcrypto"."BinanceKlineCache" (
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "openTime" BIGINT NOT NULL,
    "open" DECIMAL(32,8) NOT NULL,
    "high" DECIMAL(32,8) NOT NULL,
    "low" DECIMAL(32,8) NOT NULL,
    "close" DECIMAL(32,8) NOT NULL,
    "volume" DECIMAL(32,8) NOT NULL,
    "closeTime" BIGINT NOT NULL,
    "quoteAssetVolume" DECIMAL(32,8) NOT NULL,
    "numberOfTrades" INTEGER NOT NULL,
    "takerBuyBaseAssetVolume" DECIMAL(32,8) NOT NULL,
    "takerBuyQuoteAssetVolume" DECIMAL(32,8) NOT NULL,

    CONSTRAINT "BinanceKlineCache_pkey" PRIMARY KEY ("symbol","interval","openTime")
);

-- CreateIndex
CREATE INDEX "BinanceKlineCache_symbol_interval_openTime_idx" ON "backcrypto"."BinanceKlineCache"("symbol", "interval", "openTime");

CREATE INDEX "BinanceKlineCache_symbol_interval_openTime_desc_idx"
  ON "backcrypto"."BinanceKlineCache"("symbol", "interval", "openTime" DESC);
