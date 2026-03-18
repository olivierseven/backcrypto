-- AlterTable
ALTER TABLE backcrypto."KlineSymbol" ADD COLUMN IF NOT EXISTS "ativo" BOOLEAN NOT NULL DEFAULT true;
