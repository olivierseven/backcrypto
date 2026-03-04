export interface IntervaloTaxaParams {
  tx_inicial: number;
  periodo_i: number;
  periodo_f: number;
  tx_final: number;
  periodoSeguinte?: boolean;
}

export interface IntervaloTaxaResult {
  per_de_mod: number;
  fator_anual: number;
  tx_anual_fim: number;
}

export function computeIntervaloTaxa(params: IntervaloTaxaParams): IntervaloTaxaResult | null {
  const { tx_inicial, periodo_i, periodo_f, tx_final, periodoSeguinte } = params;
  const per_de_mod = Math.max(1, Math.floor(periodo_f - periodo_i));
  const per_menos_1 = per_de_mod - 1;
  const expoente = periodoSeguinte ? 1 / per_de_mod : 1 / per_menos_1;
  const divisor = periodoSeguinte ? per_de_mod : per_menos_1;

  if (tx_inicial <= 0 || divisor <= 0) {
    return { per_de_mod, fator_anual: 1, tx_anual_fim: tx_inicial };
  }
  const fator_anual = Math.pow(tx_final / tx_inicial, expoente);
  return { per_de_mod, fator_anual, tx_anual_fim: tx_final };
}

export function clamp(min: number, val: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
