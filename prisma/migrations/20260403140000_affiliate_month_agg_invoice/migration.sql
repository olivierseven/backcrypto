-- CreateTable
CREATE TABLE "backcrypto"."AffiliateMonthAggInvoice" (
    "id" TEXT NOT NULL,
    "month_agg_id" TEXT NOT NULL,
    "pdf_bytes" BYTEA NOT NULL,
    "file_name" VARCHAR(512),
    "content_type" TEXT NOT NULL DEFAULT 'application/pdf',
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateMonthAggInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateMonthAggInvoice_month_agg_id_key" ON "backcrypto"."AffiliateMonthAggInvoice"("month_agg_id");

-- AddForeignKey
ALTER TABLE "backcrypto"."AffiliateMonthAggInvoice" ADD CONSTRAINT "AffiliateMonthAggInvoice_month_agg_id_fkey" FOREIGN KEY ("month_agg_id") REFERENCES "backcrypto"."AffiliatePlanPaymentMonthAgg"("id") ON DELETE CASCADE ON UPDATE CASCADE;
