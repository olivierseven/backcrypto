-- Comissão aprovada não paga, preservada ao passar o mês a `expirado` (separado de estorno).
ALTER TABLE "backcrypto"."AffiliatePlanPaymentMonthAgg"
ADD COLUMN "total_expirado_commission_affiliate_cents" INTEGER NOT NULL DEFAULT 0;
