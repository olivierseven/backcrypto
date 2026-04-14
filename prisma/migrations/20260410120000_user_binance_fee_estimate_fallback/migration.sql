-- Taxa taker de fallback (decimal, ex. 0.001 = 0,1%) para estimativas quando a API não devolve ou como valor inicial.
ALTER TABLE "backcrypto"."UserBinanceConnection" ADD COLUMN "fee_estimate_taker_fallback" DECIMAL(20,8);
