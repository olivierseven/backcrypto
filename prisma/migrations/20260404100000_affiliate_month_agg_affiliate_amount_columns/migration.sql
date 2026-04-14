-- Totais na moeda do afiliado (amount_affiliate_cents agregado; nulo = 0 na aplicação).
ALTER TABLE "backcrypto"."AffiliatePlanPaymentMonthAgg"
ADD COLUMN "total_affiliate_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "total_reembolsado_affiliate_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "total_aprovado_affiliate_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "currency_affiliate" VARCHAR(8);

-- Colunas legadas de comissão USD: passam a default 0 (novas linhas); valores antigos podem permanecer até refresh.
ALTER TABLE "backcrypto"."AffiliatePlanPaymentMonthAgg"
ALTER COLUMN "total_amount_cents" SET DEFAULT 0,
ALTER COLUMN "total_reembolsado_cents" SET DEFAULT 0,
ALTER COLUMN "total_aprovado_cents" SET DEFAULT 0;
