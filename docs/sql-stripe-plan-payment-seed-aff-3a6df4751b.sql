-- Dev/staging only: insere >=100 linhas em backcrypto."StripePlanPayment" espelhando
-- uma linha existente com id_afiliado = 'AFF-4B1C3E0E10', mas com id_afiliado fixo
-- 'AFF-3A6DF4751B'. paid_at = created_at, aleatório entre dez/2025 e jan/2026 (UTC).
-- amount_affiliate_cents = 31972, commission_affiliate_cents = 4641, currency_affiliate = 'brl'.
--
-- Pré-requisito: existe pelo menos um registro com id_afiliado = 'AFF-4B1C3E0E10'.
-- Nota: `random()` deve estar no SELECT do join com `generate_series`; um LATERAL que
-- não referencia `gs` pode ser avaliado uma vez só e repetir a mesma data em todas as linhas.

INSERT INTO backcrypto."StripePlanPayment" (
  id,
  provider,
  "userId",
  invoice_id,
  checkout_session_id,
  pagarme_order_id,
  subscription_id,
  payment_intent_id,
  charge_id,
  cupom_id,
  id_afiliado,
  plan_key,
  amount_total_cents,
  currency,
  amount_affiliate_cents,
  currency_affiliate,
  commission_affiliate_cents,
  coins_credited,
  pricing_label,
  paid_at,
  created_at,
  situacao,
  stripe_payout_id,
  pagarme_payout_id,
  payout_status,
  payout_arrival_date,
  payout_updated_at
)
SELECT
  replace(gen_random_uuid()::text, '-', ''),
  r.provider,
  r."userId",
  'aff3a6d_inv_' || r.i::text,
  'aff3a6d_cs_' || r.i::text,
  NULL,
  r.subscription_id,
  r.payment_intent_id,
  r.charge_id,
  'DXXFSDQ',
  'AFF-3A6DF4751B',
  r.plan_key,
  r.amount_total_cents,
  r.currency,
  31972,
  'brl',
  4641,
  r.coins_credited,
  r.pricing_label,
  r.ts,
  r.ts,
  r.situacao,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
FROM (
  SELECT
    ref.provider,
    ref."userId",
    ref.subscription_id,
    ref.payment_intent_id,
    ref.charge_id,
    ref.cupom_id,
    ref.plan_key,
    ref.amount_total_cents,
    ref.currency,
    ref.coins_credited,
    ref.pricing_label,
    ref.situacao,
    gs.i,
    (
      timestamp '2025-12-01 00:00:00'
      + random()
      * (timestamp '2026-01-31 23:59:59' - timestamp '2025-12-01 00:00:00')
    )::timestamp(3) AS ts
  FROM (
    SELECT
      provider,
      "userId",
      subscription_id,
      payment_intent_id,
      charge_id,
      cupom_id,
      plan_key,
      amount_total_cents,
      currency,
      coins_credited,
      pricing_label,
      situacao
    FROM backcrypto."StripePlanPayment"
    WHERE id_afiliado = 'AFF-4B1C3E0E10'
    LIMIT 1
  ) AS ref
  CROSS JOIN generate_series(1, 10) AS gs(i)
) AS r;
