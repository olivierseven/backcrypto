-- CreateTable
CREATE TABLE "backcrypto"."UserBinanceSpotOrder" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" VARCHAR(32) NOT NULL,
    "binance_order_id" VARCHAR(32) NOT NULL,
    "side" VARCHAR(8) NOT NULL,
    "order_type" VARCHAR(16) NOT NULL,
    "status" VARCHAR(32),
    "price" VARCHAR(64),
    "orig_qty" VARCHAR(64),
    "executed_qty" VARCHAR(64),
    "raw_json" JSONB,
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBinanceSpotOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBinanceSpotOrder_user_id_created_at_idx" ON "backcrypto"."UserBinanceSpotOrder"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UserBinanceSpotOrder_user_id_symbol_binance_order_id_key" ON "backcrypto"."UserBinanceSpotOrder"("user_id", "symbol", "binance_order_id");

-- AddForeignKey
ALTER TABLE "backcrypto"."UserBinanceSpotOrder" ADD CONSTRAINT "UserBinanceSpotOrder_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
