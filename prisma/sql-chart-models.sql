-- Tabela ChartModels (igual à ChartLayout). Rodar manualmente em dev; migração única quando houver prod.
-- Schema: backcrypto

-- 1) Criar a tabela ChartModels
CREATE TABLE IF NOT EXISTS "backcrypto"."ChartModels" (
    "user_id" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "name" VARCHAR(24),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChartModels_pkey" PRIMARY KEY ("user_id", "slot")
);

-- 2) FK para User
ALTER TABLE "backcrypto"."ChartModels"
    ADD CONSTRAINT "ChartModels_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Copiar o layout Default (slot 0) de ChartLayout para ChartModels (name fixo 'Default')
INSERT INTO "backcrypto"."ChartModels" ("user_id", "slot", "config", "name", "updatedAt")
SELECT "user_id", "slot", "config", 'Default', "updatedAt"
FROM "backcrypto"."ChartLayout"
WHERE "slot" = 0
ON CONFLICT ("user_id", "slot") DO NOTHING;
