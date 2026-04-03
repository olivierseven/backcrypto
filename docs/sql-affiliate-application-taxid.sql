-- AffiliateApplication: coluna tax_id e CNPJ opcional (inscrições EN sem CNPJ brasileiro).
-- Executar no PostgreSQL (schema backcrypto).

ALTER TABLE "backcrypto"."AffiliateApplication"
  ALTER COLUMN "cnpj_digits" DROP NOT NULL;

ALTER TABLE "backcrypto"."AffiliateApplication"
  ADD COLUMN IF NOT EXISTS "tax_id" TEXT;
