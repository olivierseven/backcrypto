-- Índice para consultas ORDER BY openTime DESC LIMIT N (velas mais recentes primeiro)
CREATE INDEX "BinanceKline_symbol_interval_openTime_desc_idx"
  ON "backcrypto"."BinanceKline"("symbol", "interval", "openTime" DESC);
