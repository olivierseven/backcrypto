-- Colunas ativo / expires_at em AffiliateCoupon (tabela já existente).
-- Executar manualmente no PostgreSQL.

ALTER TABLE "backcrypto"."AffiliateCoupon"
  ADD COLUMN IF NOT EXISTS "ativo" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "backcrypto"."AffiliateCoupon"
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3) NULL;
