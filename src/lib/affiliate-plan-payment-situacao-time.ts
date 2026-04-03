import { cryptoPrisma } from "@/lib/crypto-db";
import { SITUACAO_REEMBOLSO } from "@/lib/sync-affiliate-plan-payment-refund-status";

/** Após 7 dias corridos em pendente; a partir do 8.º dia (UTC) → em análise. */
export const SITUACAO_EM_ANALISE = "em_analise";
/** Após 53 dias da criação (UTC) → aprovado (comissão). */
export const SITUACAO_APROVADO = "aprovado";
/** Fecho mensal expirado: comissão aprovada que deixou de poder ser paga (alinhado a `AffiliatePlanPaymentMonthAgg` expirado). */
export const SITUACAO_EXPIRADO = "expirado";

function subDaysUtc(now: Date, days: number): Date {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/**
 * Atualiza `situacao` por tempo (StripePlanPayment do afiliado).
 * Não altera linhas `reembolsado` nem `expirado`. Ordem: aprovado (≥53d) → em_analise (≥8d e <53d).
 *
 * `idAfiliado` = valor de `StripePlanPayment.id_afiliado` (`AffiliateApplication.id_afiliado`), não o id da conta.
 */
export async function applyAffiliatePlanPaymentSituacaoByAge(idAfiliado: string): Promise<{
  toAprovado: number;
  toEmAnalise: number;
}> {
  const idTrim = idAfiliado.trim();
  if (!idTrim) return { toAprovado: 0, toEmAnalise: 0 };

  const now = new Date();
  const cut53 = subDaysUtc(now, 53);
  const cut8 = subDaysUtc(now, 8);

  const aprovado = await cryptoPrisma.stripePlanPayment.updateMany({
    where: {
      idAfiliado: idTrim,
      situacao: { notIn: [SITUACAO_REEMBOLSO, SITUACAO_APROVADO, SITUACAO_EXPIRADO] },
      createdAt: { lte: cut53 },
    },
    data: { situacao: SITUACAO_APROVADO },
  });

  const emAnalise = await cryptoPrisma.stripePlanPayment.updateMany({
    where: {
      idAfiliado: idTrim,
      situacao: { notIn: [SITUACAO_REEMBOLSO, SITUACAO_APROVADO, SITUACAO_EXPIRADO] },
      createdAt: { lte: cut8, gt: cut53 },
    },
    data: { situacao: SITUACAO_EM_ANALISE },
  });

  return { toAprovado: aprovado.count, toEmAnalise: emAnalise.count };
}
