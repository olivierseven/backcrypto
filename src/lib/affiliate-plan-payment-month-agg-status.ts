/** Valores persistidos em `AffiliatePlanPaymentMonthAgg.status` (chaves estáveis; UI usa traduções). */
export const MONTH_AGG_STATUS_EM_ABERTO = "em_aberto";
export const MONTH_AGG_STATUS_AGUARDANDO_NOTA_FISCAL = "aguardando_nota_fiscal";
export const MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE = "nota_fiscal_em_analise";
export const MONTH_AGG_STATUS_PAGO = "pago";
export const MONTH_AGG_STATUS_REJEITADO_VALOR_INCORRETO = "rejeitado_valor_incorreto";
export const MONTH_AGG_STATUS_REJEITADO_NF_INVALIDA = "rejeitado_nf_invalida";
export const MONTH_AGG_STATUS_EXPIRADO = "expirado";

function utcDateOnlyMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** `monthStart` + 1 mês civil (UTC) + 53 dias — a partir desta data o período exige nota fiscal. */
function thresholdAfterMonthPlus53Days(monthStart: Date): Date {
  const x = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), monthStart.getUTCDate()));
  x.setUTCMonth(x.getUTCMonth() + 1);
  x.setUTCDate(x.getUTCDate() + 53);
  return x;
}

/**
 * Primeiro dia (UTC) em que o envio de NF pode ser exigido — alinhado a `computeMonthAggStatus`
 * (comparação por data civil UTC em `utcDateOnlyMs`).
 */
export function getMonthAggInvoiceAvailableFromUtc(monthStart: Date): Date {
  return thresholdAfterMonthPlus53Days(monthStart);
}

/** `monthStart` (1.º dia UTC do mês) + 14 meses civis — data limite exibida (expiração). */
export function getMonthAggExpiresAtUtc(monthStart: Date): Date {
  const x = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), monthStart.getUTCDate()));
  x.setUTCMonth(x.getUTCMonth() + 14);
  return x;
}

/** Após `monthStart` + 12 meses + 7 dias (UTC) pode aplicar-se `expirado` (não pago, não em aberto). */
export function getMonthAggStaleAfterUtc(monthStart: Date): Date {
  const x = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), monthStart.getUTCDate()));
  x.setUTCMonth(x.getUTCMonth() + 12);
  x.setUTCDate(x.getUTCDate() + 7);
  return x;
}

/**
 * Transição para `expirado`: envio de NF bloqueado; totais de comissão mantêm-se no agregado (recalculados).
 * Nunca se aplica se o fecho mensal já estiver **`pago`** (nem `StripePlanPayment` deve ir para `expirado`).
 * Também não aplica a `em_aberto` (período ainda em acumulação) nem se já for `expirado`.
 */
export function shouldTransitionToExpirado(monthStart: Date, now: Date, prevStatus: string): boolean {
  const s = prevStatus.trim().toLowerCase();
  if (
    s === MONTH_AGG_STATUS_PAGO ||
    s === MONTH_AGG_STATUS_EM_ABERTO ||
    s === MONTH_AGG_STATUS_EXPIRADO
  ) {
    return false;
  }
  return utcDateOnlyMs(now) >= utcDateOnlyMs(getMonthAggStaleAfterUtc(monthStart));
}

/**
 * Estado do fecho mensal: até ao dia anterior ao limite → em aberto; a partir do limite → aguardando nota fiscal.
 */
export function computeMonthAggStatus(monthStart: Date, now: Date = new Date()): string {
  const thr = thresholdAfterMonthPlus53Days(monthStart);
  return utcDateOnlyMs(now) >= utcDateOnlyMs(thr)
    ? MONTH_AGG_STATUS_AGUARDANDO_NOTA_FISCAL
    : MONTH_AGG_STATUS_EM_ABERTO;
}

/** Rótulo PT/EN a partir da chave em `AffiliatePlanPaymentMonthAgg.status`. */
export function monthAggStatusLabel(
  status: string,
  labels: {
    monthAggStatusEmAberto: string;
    monthAggStatusAguardandoNotaFiscal: string;
    monthAggStatusNotaFiscalEmAnalise: string;
    monthAggStatusPago: string;
    monthAggStatusRejeitadoValorIncorreto: string;
    monthAggStatusRejeitadoNfInvalida: string;
    monthAggStatusExpirado: string;
  },
): string {
  if (status === MONTH_AGG_STATUS_PAGO) return labels.monthAggStatusPago;
  if (status === MONTH_AGG_STATUS_REJEITADO_VALOR_INCORRETO) {
    return labels.monthAggStatusRejeitadoValorIncorreto;
  }
  if (status === MONTH_AGG_STATUS_REJEITADO_NF_INVALIDA) {
    return labels.monthAggStatusRejeitadoNfInvalida;
  }
  if (status === MONTH_AGG_STATUS_EXPIRADO) return labels.monthAggStatusExpirado;
  if (status === MONTH_AGG_STATUS_AGUARDANDO_NOTA_FISCAL) return labels.monthAggStatusAguardandoNotaFiscal;
  if (status === MONTH_AGG_STATUS_NOTA_FISCAL_EM_ANALISE) return labels.monthAggStatusNotaFiscalEmAnalise;
  return labels.monthAggStatusEmAberto;
}
