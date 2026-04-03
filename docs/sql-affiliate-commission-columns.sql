-- backcrypto."AffiliateApplication" — comissões por plano (USD em centavos).
-- Executar no Postgres após alinhar com prisma/schema.prisma (sem criar migration automática).

ALTER TABLE backcrypto."AffiliateApplication"
  ADD COLUMN IF NOT EXISTS commission_annual_usd_cents INTEGER NOT NULL DEFAULT 800,
  ADD COLUMN IF NOT EXISTS commission_monthly_usd_cents INTEGER NOT NULL DEFAULT 120;

COMMENT ON COLUMN backcrypto."AffiliateApplication".commission_annual_usd_cents IS 'Comissão por venda plano anual (centavos USD); default 800 = US$ 8,00';
COMMENT ON COLUMN backcrypto."AffiliateApplication".commission_monthly_usd_cents IS 'Comissão por venda plano mensal (centavos USD); default 120 = US$ 1,20';
