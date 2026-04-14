-- Data de expiração do fecho (month_start + 14 meses civis UTC).
ALTER TABLE "backcrypto"."AffiliatePlanPaymentMonthAgg"
ADD COLUMN "expires_at" DATE;

UPDATE "backcrypto"."AffiliatePlanPaymentMonthAgg"
SET "expires_at" = ("month_start"::timestamp + INTERVAL '14 months')::date
WHERE "expires_at" IS NULL;
