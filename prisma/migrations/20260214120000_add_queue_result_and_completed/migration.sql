-- COMPLETED may already exist in BioQueueStatus; only add result column.
-- (If COMPLETED is missing, add it manually: ALTER TYPE "public"."BioQueueStatus" ADD VALUE 'COMPLETED';)
ALTER TABLE "public"."BioSimulationQueue" ADD COLUMN IF NOT EXISTS "result" JSONB;
