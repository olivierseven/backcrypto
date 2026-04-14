-- DEPRECATED: progresso incremental passou a usar colunas k2* nas tabelas *Fast*;
-- remover a tabela com docs/sql-k2-flags-atemporal-migration.sql (DROP TABLE).
--
-- (Histórico) Watermarks para agregação incremental em `BinanceKlineCache2` (tiers > base).
-- Schema: backcrypto

CREATE TABLE IF NOT EXISTS backcrypto."BinanceKlineCache2Watermark" (
  "corretora" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "chartKind" VARCHAR(32) NOT NULL,
  "interval" TEXT NOT NULL,
  "lastClosedBaseOpenTime" BIGINT NOT NULL,
  CONSTRAINT "BinanceKlineCache2Watermark_pkey" PRIMARY KEY ("corretora", "symbol", "chartKind", "interval")
);

CREATE INDEX IF NOT EXISTS "BinanceKlineCache2Watermark_symbol_chartKind_idx"
  ON backcrypto."BinanceKlineCache2Watermark" ("symbol", "chartKind");
