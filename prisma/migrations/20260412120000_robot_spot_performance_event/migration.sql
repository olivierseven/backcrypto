-- Execuções spot por robô (relatório de performance).
CREATE TABLE "backcrypto"."RobotSpotPerformanceEvent" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "robot_id" VARCHAR(64) NOT NULL,
    "robot_alias_snapshot" VARCHAR(160),
    "symbol" VARCHAR(32) NOT NULL,
    "side" VARCHAR(8) NOT NULL,
    "execution_role" VARCHAR(32) NOT NULL,
    "binance_order_id" VARCHAR(32) NOT NULL,
    "executed_qty_base" VARCHAR(64),
    "quote_qty_usdt" VARCHAR(64),
    "avg_price" VARCHAR(64),
    "fee_usdt" VARCHAR(64),
    "realized_pnl_usdt" VARCHAR(64),
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RobotSpotPerformanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RobotSpotPerformanceEvent_user_id_binance_order_id_key" ON "backcrypto"."RobotSpotPerformanceEvent"("user_id", "binance_order_id");

CREATE INDEX "RobotSpotPerformanceEvent_user_id_robot_id_created_at_idx" ON "backcrypto"."RobotSpotPerformanceEvent"("user_id", "robot_id", "created_at" DESC);

CREATE INDEX "RobotSpotPerformanceEvent_user_id_created_at_idx" ON "backcrypto"."RobotSpotPerformanceEvent"("user_id", "created_at" DESC);

ALTER TABLE "backcrypto"."RobotSpotPerformanceEvent" ADD CONSTRAINT "RobotSpotPerformanceEvent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
