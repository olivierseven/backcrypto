-- AlterEnum
ALTER TYPE "public"."BioQueueStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "public"."BioSimulationQueue" ADD COLUMN     "result" JSONB;
