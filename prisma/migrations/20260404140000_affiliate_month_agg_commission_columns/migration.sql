ALTER TABLE "backcrypto"."AffiliatePlanPaymentMonthAgg"
ADD COLUMN "total_commission_affiliate_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "total_reembolsado_commission_affiliate_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "total_aprovado_commission_affiliate_cents" INTEGER NOT NULL DEFAULT 0;
