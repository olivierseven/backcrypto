-- Dados de NF/invoice -> dados de pagamento (PIX/banco; PayPal/wire)
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" DROP COLUMN IF EXISTS "br_endereco_completo";
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" DROP COLUMN IF EXISTS "br_email_fiscal";
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" DROP COLUMN IF EXISTS "br_descricao_servico";
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" DROP COLUMN IF EXISTS "int_legal_name";
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" DROP COLUMN IF EXISTS "int_address";
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" DROP COLUMN IF EXISTS "int_business_email";
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" DROP COLUMN IF EXISTS "int_tax_id";

ALTER TABLE "backcrypto"."AffiliatePayoutProfile" ADD COLUMN IF NOT EXISTS "br_banco" VARCHAR(256);
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" ADD COLUMN IF NOT EXISTS "br_tipo_conta" VARCHAR(32);
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" ADD COLUMN IF NOT EXISTS "br_agencia" VARCHAR(32);
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" ADD COLUMN IF NOT EXISTS "br_numero_conta" VARCHAR(64);
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" ADD COLUMN IF NOT EXISTS "br_chave_pix" VARCHAR(512);
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" ADD COLUMN IF NOT EXISTS "int_payment_method" VARCHAR(16);
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" ADD COLUMN IF NOT EXISTS "int_paypal_email" VARCHAR(320);
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" ADD COLUMN IF NOT EXISTS "int_bank_name" VARCHAR(256);
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" ADD COLUMN IF NOT EXISTS "int_account_or_iban" VARCHAR(64);
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" ADD COLUMN IF NOT EXISTS "int_swift_bic" VARCHAR(32);
ALTER TABLE "backcrypto"."AffiliatePayoutProfile" ADD COLUMN IF NOT EXISTS "int_account_holder_name" VARCHAR(512);
