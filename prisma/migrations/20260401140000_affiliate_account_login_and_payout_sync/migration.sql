-- AlterTable
ALTER TABLE "backcrypto"."AffiliateAccount" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3);
ALTER TABLE "backcrypto"."AffiliateAccount" ADD COLUMN IF NOT EXISTS "last_plan_payment_payout_sync_at" TIMESTAMP(3);
