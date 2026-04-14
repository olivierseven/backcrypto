-- CreateTable
CREATE TABLE "backcrypto"."AffiliatePlanPaymentMonthAgg" (
    "id" TEXT NOT NULL,
    "id_afiliado" TEXT NOT NULL,
    "month_start" DATE NOT NULL,
    "total_amount_cents" INTEGER NOT NULL,
    "total_reembolsado_cents" INTEGER NOT NULL,
    "total_aprovado_cents" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliatePlanPaymentMonthAgg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliatePlanPaymentMonthAgg_id_afiliado_month_start_key" ON "backcrypto"."AffiliatePlanPaymentMonthAgg"("id_afiliado", "month_start");

-- CreateIndex
CREATE INDEX "AffiliatePlanPaymentMonthAgg_id_afiliado_idx" ON "backcrypto"."AffiliatePlanPaymentMonthAgg"("id_afiliado");
