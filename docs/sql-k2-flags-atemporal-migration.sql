-- Migração: flags na origem (como Renko 1×) + remoção de BinanceKlineCache2Watermark.
-- Executar no Postgres (schema backcrypto) após alinhar com prisma/schema.prisma.

-- Colunas k2 em tabelas *Fast* a 5ticks (Range, Kagi, Renko2×) — espelho de BinanceRenkoFast
ALTER TABLE backcrypto."BinanceRangeFast"
  ADD COLUMN IF NOT EXISTS "k2Incl5ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl15ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl25ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl50ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl100ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl150ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl200ticks" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE backcrypto."BinanceKagiFast"
  ADD COLUMN IF NOT EXISTS "k2Incl5ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl15ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl25ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl50ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl100ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl150ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl200ticks" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE backcrypto."BinanceRenko2xFast"
  ADD COLUMN IF NOT EXISTS "k2Incl5ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl15ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl25ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl50ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl100ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl150ticks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl200ticks" BOOLEAN NOT NULL DEFAULT false;

-- BinanceTradeCountFast (origem 500trades): tiers do cache trades500
ALTER TABLE backcrypto."BinanceTradeCountFast"
  ADD COLUMN IF NOT EXISTS "k2Incl500trades" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl1000trades" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl2500trades" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl5000trades" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl7500trades" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "k2Incl10000trades" BOOLEAN NOT NULL DEFAULT false;

-- Tabela de watermark substituída por flags nas origens
DROP TABLE IF EXISTS backcrypto."BinanceKlineCache2Watermark";
