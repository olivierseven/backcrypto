import { cryptoPrisma } from "@/lib/crypto-db";

/** Conta ativa (`AffiliateAccount.ativo`) — único critério de bloqueio de sessão / API para afiliado. */
export async function isAffiliateAccountAtivo(accountId: string): Promise<boolean> {
  const row = await cryptoPrisma.affiliateAccount.findUnique({
    where: { id: accountId },
    select: { ativo: true },
  });
  return row?.ativo === true;
}
