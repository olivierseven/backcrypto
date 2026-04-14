-- CreateTable
CREATE TABLE "backcrypto"."LogErro" (
    "id" TEXT NOT NULL,
    "data_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origem" VARCHAR(512) NOT NULL,
    "msg_erro" TEXT NOT NULL,

    CONSTRAINT "LogErro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogErro_data_hora_idx" ON "backcrypto"."LogErro"("data_hora");

-- CreateIndex
CREATE INDEX "LogErro_origem_idx" ON "backcrypto"."LogErro"("origem");
