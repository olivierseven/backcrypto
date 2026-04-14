import { cryptoPrisma } from "@/lib/crypto-db";

/**
 * Libera «Dados da empresa para cobrança» e «Dados de pagamento» no mesmo critério:
 * existe pelo menos um `AffiliatePlanPaymentMonthAgg` para o `idAfiliado` (há fecho em Estatísticas).
 */
export async function isAffiliateBillingSectionUnlocked(idAfiliado: string | null | undefined): Promise<boolean> {
  const id = typeof idAfiliado === "string" ? idAfiliado.trim() : "";
  if (!id) return false;
  const row = await cryptoPrisma.affiliatePlanPaymentMonthAgg.findFirst({
    where: { idAfiliado: id },
    select: { id: true },
  });
  return row != null;
}
