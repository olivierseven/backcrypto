-- Cupons de afiliado (código 7 caracteres único). Schema backcrypto.
-- Executar manualmente no PostgreSQL após alinhar com prisma/schema.prisma.

CREATE TABLE IF NOT EXISTS "backcrypto"."AffiliateCoupon" (
  "id" TEXT NOT NULL,
  "affiliate_account_id" TEXT NOT NULL,
  "code" VARCHAR(7) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ativo" BOOLEAN NOT NULL DEFAULT false,
  "expires_at" TIMESTAMP(3) NULL,

  CONSTRAINT "AffiliateCoupon_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AffiliateCoupon_affiliate_account_id_fkey"
    FOREIGN KEY ("affiliate_account_id") REFERENCES "backcrypto"."AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateCoupon_code_key"
  ON "backcrypto"."AffiliateCoupon" ("code");

CREATE INDEX IF NOT EXISTS "AffiliateCoupon_affiliate_account_id_idx"
  ON "backcrypto"."AffiliateCoupon" ("affiliate_account_id");
