-- Flags de inclusão no BinanceKlineCache2 (Renko 1×) por linha de origem em BinanceRenkoFast.
-- Schema: backcrypto

ALTER TABLE backcrypto."BinanceRenkoFast"
  ADD COLUMN IF NOT EXISTS "k2Incl5ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl15ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl25ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl50ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl100ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl150ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl200ticks" BOOLEAN NOT NULL DEFAULT false;
