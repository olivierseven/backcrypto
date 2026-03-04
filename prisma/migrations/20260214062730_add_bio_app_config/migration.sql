-- CreateTable
CREATE TABLE "public"."BioAppConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BioAppConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "BioAppConfig_key_idx" ON "public"."BioAppConfig"("key");
