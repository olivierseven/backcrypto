-- Tabela 1:1 com AffiliatePlanPaymentMonthAgg — PDF da NF (BYTEA, típ. < 5 MB).
-- Aplicar após migrações Prisma ou manualmente em ambientes sem migrate.

CREATE TABLE IF NOT EXISTS "backcrypto"."AffiliateMonthAggInvoice" (
    "id" TEXT NOT NULL,
    "month_agg_id" TEXT NOT NULL,
    "pdf_bytes" BYTEA NOT NULL,
    "file_name" VARCHAR(512),
    "content_type" TEXT NOT NULL DEFAULT 'application/pdf',
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateMonthAggInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateMonthAggInvoice_month_agg_id_key"
  ON "backcrypto"."AffiliateMonthAggInvoice"("month_agg_id");

ALTER TABLE "backcrypto"."AffiliateMonthAggInvoice"
  DROP CONSTRAINT IF EXISTS "AffiliateMonthAggInvoice_month_agg_id_fkey";

ALTER TABLE "backcrypto"."AffiliateMonthAggInvoice"
  ADD CONSTRAINT "AffiliateMonthAggInvoice_month_agg_id_fkey"
  FOREIGN KEY ("month_agg_id") REFERENCES "backcrypto"."AffiliatePlanPaymentMonthAgg"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
