-- CreateTable: gaps conhecidos (validacao ignora estes intervalos)
CREATE TABLE "backcrypto"."BinanceKlineGap" (
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "gapFrom" BIGINT NOT NULL,
    "gapTo" BIGINT NOT NULL,

    CONSTRAINT "BinanceKlineGap_pkey" PRIMARY KEY ("symbol","interval","gapFrom","gapTo")
);

-- CreateIndex
CREATE INDEX "BinanceKlineGap_symbol_interval_idx" ON "backcrypto"."BinanceKlineGap"("symbol", "interval");
