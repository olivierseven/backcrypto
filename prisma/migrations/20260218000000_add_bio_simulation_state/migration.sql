-- CreateTable: uma linha por usuário (userId unique), sem histórico
CREATE TABLE "public"."BioSimulationState" (
    "userId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BioSimulationState_pkey" PRIMARY KEY ("userId")
);

-- ForeignKey
ALTER TABLE "public"."BioSimulationState" ADD CONSTRAINT "BioSimulationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
