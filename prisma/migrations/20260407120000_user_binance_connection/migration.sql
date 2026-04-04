-- CreateTable
CREATE TABLE "backcrypto"."UserBinanceConnection" (
    "user_id" TEXT NOT NULL,
    "payload_enc" TEXT NOT NULL,
    "payload_iv" TEXT NOT NULL,
    "payload_tag" TEXT NOT NULL,
    "api_key_last4" VARCHAR(8) NOT NULL,
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBinanceConnection_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "backcrypto"."UserBinanceConnection" ADD CONSTRAINT "UserBinanceConnection_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
