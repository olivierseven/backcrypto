-- Coluna de estado do fecho mensal (chaves: em_aberto | aguardando_nota_fiscal).
-- Idempotente: só adiciona se a coluna ainda não existir.
ALTER TABLE "backcrypto"."AffiliatePlanPaymentMonthAgg"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'em_aberto';
