-- backcrypto.AppConfig — limite de linhas no sync de reembolso (Stripe/Pagar.me) após login do afiliado.
-- Lido em runtime por resolveAffiliateRefundSyncRowLimit() (src/lib/crypto-app-config.ts).
-- Fallback: env AFFILIATE_REFUND_SYNC_ROW_LIMIT; depois default 500. Valores efetivos: 1–2000.

INSERT INTO backcrypto."AppConfig" (key, value, description, "createdAt", "updatedAt")
VALUES (
  'AFFILIATE_REFUND_SYNC_ROW_LIMIT',
  '500',
  'Máximo de linhas StripePlanPayment (por afiliado) por execução do sync de reembolso no login. 1–2000.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (key) DO NOTHING;
