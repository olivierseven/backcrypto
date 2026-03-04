-- CreateTable
CREATE TABLE "backcrypto"."ChartLayout" (
    "user_id" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartLayout_pkey" PRIMARY KEY ("user_id","slot")
);

-- AddForeignKey
ALTER TABLE "backcrypto"."ChartLayout" ADD CONSTRAINT "ChartLayout_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
