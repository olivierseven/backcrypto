-- CreateTable: cópia idêntica de BinanceKline
CREATE TABLE "backcrypto"."BinanceKlineFast" (
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

    CONSTRAINT "BinanceKlineFast_pkey" PRIMARY KEY ("symbol","interval","openTime")
);

-- CreateIndex
CREATE INDEX "BinanceKlineFast_symbol_interval_openTime_idx" ON "backcrypto"."BinanceKlineFast"("symbol", "interval", "openTime");

CREATE INDEX "BinanceKlineFast_symbol_interval_openTime_desc_idx"
  ON "backcrypto"."BinanceKlineFast"("symbol", "interval", "openTime" DESC);

-- Copiar dados de BinanceKline para BinanceKlineFast
INSERT INTO "backcrypto"."BinanceKlineFast" (
    "symbol", "interval", "openTime", "open", "high", "low", "close", "volume",
    "closeTime", "quoteAssetVolume", "numberOfTrades",
    "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
)
SELECT
    "symbol", "interval", "openTime", "open", "high", "low", "close", "volume",
    "closeTime", "quoteAssetVolume", "numberOfTrades",
    "takerBuyBaseAssetVolume", "takerBuyQuoteAssetVolume"
FROM "backcrypto"."BinanceKline";
