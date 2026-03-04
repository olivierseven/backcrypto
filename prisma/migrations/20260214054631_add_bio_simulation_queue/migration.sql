-- CreateEnum
CREATE TYPE "public"."BioQueueStatus" AS ENUM ('PENDING', 'RUNNING');

-- CreateTable
CREATE TABLE "public"."BioSimulationQueue" (
    "id" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."BioQueueStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BioSimulationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BioSimulationQueue_queueName_status_idx" ON "public"."BioSimulationQueue"("queueName", "status");

-- CreateIndex
CREATE INDEX "BioSimulationQueue_userId_createdAt_idx" ON "public"."BioSimulationQueue"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."BioSimulationQueue" ADD CONSTRAINT "BioSimulationQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
