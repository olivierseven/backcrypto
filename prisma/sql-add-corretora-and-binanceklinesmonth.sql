-- Comandos SQL para aplicar no banco (schema backcrypto).
-- Não criar migrações; rodar manualmente conforme regra prisma-dev.
-- 1) Adicionar corretora em BinanceKlineFast e BinanceKline
-- 2) Ajustar PK e índices
-- 3) Criar tabela BinanceKlineMonth

-- ---------- BinanceKlineFast ----------
ALTER TABLE backcrypto."BinanceKlineFast"
  ADD COLUMN IF NOT EXISTS corretora TEXT NOT NULL DEFAULT 'binance';

ALTER TABLE backcrypto."BinanceKlineFast" DROP CONSTRAINT IF EXISTS "BinanceKlineFast_pkey";
ALTER TABLE backcrypto."BinanceKlineFast"
  ADD PRIMARY KEY (corretora, symbol, "interval", "openTime");

DROP INDEX IF EXISTS backcrypto."BinanceKlineFast_symbol_interval_openTime_idx";
DROP INDEX IF EXISTS backcrypto."BinanceKlineFast_symbol_interval_openTime_desc_idx";
CREATE INDEX "BinanceKlineFast_symbol_interval_openTime_idx"
  ON backcrypto."BinanceKlineFast"(corretora, symbol, "interval", "openTime");
CREATE INDEX "BinanceKlineFast_symbol_interval_openTime_desc_idx"
  ON backcrypto."BinanceKlineFast"(corretora, symbol, "interval", "openTime" DESC);

-- ---------- BinanceKline ----------
ALTER TABLE backcrypto."BinanceKline"
  ADD COLUMN IF NOT EXISTS corretora TEXT NOT NULL DEFAULT 'binance';

ALTER TABLE backcrypto."BinanceKline" DROP CONSTRAINT IF EXISTS "BinanceKline_pkey";
ALTER TABLE backcrypto."BinanceKline"
  ADD PRIMARY KEY (corretora, symbol, "interval", "openTime");

DROP INDEX IF EXISTS backcrypto."BinanceKline_symbol_interval_openTime_idx";
DROP INDEX IF EXISTS backcrypto."BinanceKline_symbol_interval_openTime_desc_idx";
CREATE INDEX "BinanceKline_symbol_interval_openTime_idx"
  ON backcrypto."BinanceKline"(corretora, symbol, "interval", "openTime");
CREATE INDEX "BinanceKline_symbol_interval_openTime_desc_idx"
  ON backcrypto."BinanceKline"(corretora, symbol, "interval", "openTime" DESC);

-- ---------- BinanceKlineMonth (mesma estrutura que BinanceKline) ----------
CREATE TABLE IF NOT EXISTS backcrypto."BinanceKlineMonth" (
  corretora                TEXT NOT NULL,
  symbol                   TEXT NOT NULL,
  "interval"               TEXT NOT NULL,
  "openTime"               BIGINT NOT NULL,
  "open"                   DECIMAL(32,8) NOT NULL,
  "high"                   DECIMAL(32,8) NOT NULL,
  "low"                    DECIMAL(32,8) NOT NULL,
  "close"                  DECIMAL(32,8) NOT NULL,
  "volume"                 DECIMAL(32,8) NOT NULL,
  "closeTime"              BIGINT NOT NULL,
  "quoteAssetVolume"       DECIMAL(32,8) NOT NULL,
  "numberOfTrades"         INTEGER NOT NULL,
  "takerBuyBaseAssetVolume"  DECIMAL(32,8) NOT NULL,
  "takerBuyQuoteAssetVolume" DECIMAL(32,8) NOT NULL,
  CONSTRAINT "BinanceKlineMonth_pkey" PRIMARY KEY (corretora, symbol, "interval", "openTime")
);

CREATE INDEX IF NOT EXISTS "BinanceKlineMonth_symbol_interval_openTime_idx"
  ON backcrypto."BinanceKlineMonth"(corretora, symbol, "interval", "openTime");
CREATE INDEX IF NOT EXISTS "BinanceKlineMonth_symbol_interval_openTime_desc_idx"
  ON backcrypto."BinanceKlineMonth"(corretora, symbol, "interval", "openTime" DESC);
