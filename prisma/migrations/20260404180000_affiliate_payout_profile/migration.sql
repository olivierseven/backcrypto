-- CreateTable
CREATE TABLE "backcrypto"."AffiliatePayoutProfile" (
    "id" TEXT NOT NULL,
    "affiliate_application_id" TEXT NOT NULL,
    "active_tab" VARCHAR(16) NOT NULL DEFAULT 'br',
    "br_razao_social" VARCHAR(512),
    "br_cnpj_digits" VARCHAR(14),
    "br_endereco_completo" TEXT,
    "br_email_fiscal" VARCHAR(320),
    "br_descricao_servico" TEXT,
    "int_legal_name" VARCHAR(512),
    "int_address" TEXT,
    "int_country" VARCHAR(120),
    "int_business_email" VARCHAR(320),
    "int_tax_id" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliatePayoutProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliatePayoutProfile_affiliate_application_id_key" ON "backcrypto"."AffiliatePayoutProfile"("affiliate_application_id");

-- AddForeignKey
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" ADD CONSTRAINT "AffiliatePayoutProfile_affiliate_application_id_fkey" FOREIGN KEY ("affiliate_application_id") REFERENCES "backcrypto"."AffiliateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
