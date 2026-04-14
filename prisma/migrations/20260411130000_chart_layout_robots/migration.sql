-- Robôs do sistema por slot de layout (lista + mapa de execução B·).
ALTER TABLE "backcrypto"."ChartLayout" ADD COLUMN IF NOT EXISTS "robots" JSONB;
