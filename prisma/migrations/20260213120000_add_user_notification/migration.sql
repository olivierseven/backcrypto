-- CreateEnum
CREATE TYPE "public"."SenderType" AS ENUM ('system', 'user');

-- CreateTable
CREATE TABLE "public"."UserNotification" (
    "idNotification" TEXT NOT NULL,
    "senderType" "public"."SenderType" NOT NULL,
    "sender" TEXT,
    "userId" TEXT NOT NULL,
    "notification" TEXT NOT NULL,
    "keySystem" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiredDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("idNotification")
);

-- CreateIndex
CREATE INDEX "UserNotification_userId_idx" ON "public"."UserNotification"("userId");

-- CreateIndex
CREATE INDEX "UserNotification_ativo_idx" ON "public"."UserNotification"("ativo");

-- CreateIndex
CREATE INDEX "UserNotification_expiredDate_idx" ON "public"."UserNotification"("expiredDate");

-- AddForeignKey
ALTER TABLE "public"."UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
