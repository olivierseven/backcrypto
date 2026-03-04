/**
 * Lógica reutilizável da simulação Genesis (parâmetros podem vir do banco no futuro).
 * Exporta tipos, constantes, runGerarGenesis, runUmPasso e runSimulacaoN.
 */
import { computeIntervaloTaxa, clamp } from "@/lib/intervalo-taxa";

/** No servidor: se DEBUG_LOGS=0 (env), nenhum log é exibido. Default: logs ativos. */
const DEBUG_LOGS =
  typeof process !== "undefined" && process.env.DEBUG_LOGS === "0"
    ? false
    : true;

/** Ative o debug definindo um id (ex.: 1) ou em tempo de execução no console: window.__DEBUG_GENESIS_ID = 1 */
const DEBUG_GENESIS_ID: number | null = null;

declare global {
  interface Window {
    __DEBUG_GENESIS_ID?: number | null;
    __DEBUG_QTDE?: boolean;
  }
}

function sumQtde(arr: GenesisIndividual[]): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i]!.qtde;
  return s;
}

/** Máximo de um array (for-loop evita estouro de pilha e é mais rápido que reduce em arrays grandes). */
function maxOf(arr: number[]): number {
  if (arr.length === 0) return -Infinity;
  let m = arr[0]!;
  for (let i = 1; i < arr.length; i++) {
    const v = arr[i]!;
    if (v > m) m = v;
  }
  return m;
}

/** Mínimo de um array (for-loop evita estouro de pilha e é mais rápido que reduce). */
function minOf(arr: number[]): number {
  if (arr.length === 0) return Infinity;
  let m = arr[0]!;
  for (let i = 1; i < arr.length; i++) {
    const v = arr[i]!;
    if (v < m) m = v;
  }
  return m;
}

/** Máximo id entre dois vetores em um único passe, sem alocar array (path quente). */
function maxIdFromVetores(v1: GenesisIndividual[], v2: GenesisIndividual[]): number {
  let max = -Infinity;
  for (let i = 0; i < v1.length; i++) {
    const id = v1[i]!.id;
    if (id > max) max = id;
  }
  for (let i = 0; i < v2.length; i++) {
    const id = v2[i]!.id;
    if (id > max) max = id;
  }
  return max;
}

export type QtdeLogEntry = { etapa: string; total: number; nVetor1: number; nVetor2: number; sumV1: number; sumV2: number; extra?: Record<string, number> };

function logQtde(
  etapa: string,
  v1: GenesisIndividual[],
  v2: GenesisIndividual[],
  extra?: Record<string, number>,
  qtdeLog?: QtdeLogEntry[]
): void {
  const total = sumQtde(v1) + sumQtde(v2);
  const n1 = v1.length;
  const n2 = v2.length;
  const entry: QtdeLogEntry = { etapa, total, nVetor1: n1, nVetor2: n2, sumV1: sumQtde(v1), sumV2: sumQtde(v2), ...(extra && { extra }) };
  if (qtdeLog) qtdeLog.push(entry);
  if (typeof window !== "undefined" && window.__DEBUG_QTDE) {
    console.log("[QTDE]", etapa, { total, nVetor1: n1, nVetor2: n2, sumV1: entry.sumV1, sumV2: entry.sumV2, ...extra });
  }
}

function shouldDebugId(id: number): boolean {
  if (!DEBUG_LOGS) return false;
  if (typeof window !== "undefined" && window.__DEBUG_GENESIS_ID != null) {
    return window.__DEBUG_GENESIS_ID === id;
  }
  return DEBUG_GENESIS_ID != null && DEBUG_GENESIS_ID === id;
}

/** Quando a API recebe debugGenesisId do cliente, coleta logs aqui e devolve na resposta em vez de logar no terminal. */
export type DebugGenesisEntry = { msg: string; data?: unknown };
export type PerformanceLogEntry = { phase: string; ms: number };
export type DebugGenesisContext = {
  debugGenesisId: number;
  log: DebugGenesisEntry[];
  /** Quando debugGenesisGrupo: true, coleta log do grupo de menor id. */
  groupLog?: DebugGenesisEntry[];
  /** Quando debugQtde: true na API, coleta totais de qtde em cada etapa (devolvido como debugLogQtde para exibir no navegador). */
  qtdeLog?: QtdeLogEntry[];
  /** Quando debugPerformance: true, coleta tempo por fase (runUmPasso) para encontrar gargalos. */
  performanceLog?: PerformanceLogEntry[];
  /** Acumulador de ms por fase em todas as iterações (runSimulacaoN). Preenchido por runUmPasso; no fim convertido para performanceLog. */
  performanceLogAcc?: Record<string, number>;
};

function logGenesisDebug(
  id: number,
  msg: string,
  data: unknown,
  debugContext?: DebugGenesisContext | null
): void {
  if (!DEBUG_LOGS) return;
  if (debugContext && debugContext.debugGenesisId === id) {
    debugContext.log.push({ msg, data });
    return;
  }
  if (shouldDebugId(id)) {
    console.log(msg, data !== undefined ? data : "");
  }
}

function logGenesisGrupoDebug(
  msg: string,
  data: unknown,
  debugContext?: DebugGenesisContext | null
): void {
  if (!DEBUG_LOGS) return;
  if (debugContext?.groupLog) {
    debugContext.groupLog.push({ msg, data });
  }
}

// --- Tipos ---
export interface GenesisIndividual {
  id: number;
  especie: number;
  x: number;
  y: number;
  idade: number;
  epoca: number;
  geracao: number;
  dispersao: number;
  dispersao_regiao: number;
  regiao: number;
  decendentes: number;
  direcao: number;
  genero: number;
  ativo: number;
  qtde: number;
  /** 0 = vivo, 1 = morreu (p. ex. por velhice). No agrupamento, o campo é somado. */
  morte: number;
  /** 0 = não plotar no mapa (ex.: nascimento sem posição válida após 10 tentativas), 1 = plotar. Opcional: ausente trata como 1. */
  plotValido?: 0 | 1;
  /** Índice da cor do pixel onde o indivíduo nasceu/criado (0=preto, 1=branco, 2+=outros). Só plotar quando cor !== 1. */
  cor?: number;
}

/** Definição de vetor(es) de origem agendado(s): criados no ano indicado, no ponto (x0_km, y0_km), com a idade e quantidade de pares. */
export type OrigemAgendada = {
  ano: number;
  x0_km: number;
  y0_km: number;
  idade: number;
  quantidadePares: number;
};

export type ResultadoReproducaoPorId = Record<
  number,
  {
    prob_reproducao: number;
    evento_reproducao: 0 | 1;
    decendentes: number;
    generos_descendentes?: (0 | 1)[];
  }
>;

/** Objeto imutável reutilizado para resultado zerado (vetor2 / origens). Evita N alocações no loop. */
const RESULTADO_ZERO = Object.freeze({
  prob_reproducao: 0,
  evento_reproducao: 0 as 0 | 1,
  decendentes: 0,
});

export interface EspecieParams {
  periodo_simulado: number;
  faixa_fertilidade: [number, number];
  idade_fertil_pico: number;
  tx_decaimento_pos_pico: number;
  prob_anual_reproducao: number;
  dispersao_anual_media: number;
  fecundidade_max_parto: number;
  tx_mortalidade_inicial_1: number;
  per_de_mod_da_tx_mortalidade_1: number;
  tx_mortalidade_final_1: number;
  fator_mortalidade_anual_1: number;
  min_form_grupo: number;
}

/** Parâmetros de mortalidade resolvidos para um dado periodo (ano): variáveis sem sufixo = valores do período cuja faixa contém o periodo. */
export type MortalidadeResolvida = {
  tx_mortalidade_inicial: number;
  tx_mortalidade_final: number;
  fator_mortalidade_anual: number;
  /** Faixa (1, 2 ou 3) que contém o periodo. */
  faixa: 1 | 2 | 3;
};

/**
 * Determina qual faixa (período 1, 2 ou 3) contém o ano dado.
 * Faixas: [periodo_i1, periodo_f1], [periodo_i2, periodo_f2], [periodo_i3, periodo_f3].
 */
export function getFaixaForPeriodo(params: Record<string, number>, periodo: number): 1 | 2 | 3 {
  const pi1 = params.periodo_i1 ?? -100;
  const pf1 = params.periodo_f1 ?? 2026;
  const add2 = (params.adicionar_intervalo_2 ?? 0) === 1;
  const pi2 = params.periodo_i2 ?? pf1;
  const pf2 = params.periodo_f2 ?? 100;
  const add3 = (params.adicionar_intervalo_3 ?? 0) === 1;
  const pi3 = params.periodo_i3 ?? pf2;
  const pf3 = params.periodo_f3 ?? 100;

  if (periodo >= pi1 && periodo <= pf1) return 1;
  if (add2 && periodo >= pi2 && periodo <= pf2) return 2;
  if (add3 && periodo >= pi3 && periodo <= pf3) return 3;
  if (periodo < pi1) return 1;
  if (add3 && periodo > pf3) return 3;
  if (add2 && periodo > pf2) return 2;
  return 1;
}

/**
 * Resolve as variáveis de mortalidade sem sufixo para o periodo (ano) dado:
 * tx_mortalidade_inicial, tx_mortalidade_final e fator_mortalidade_anual
 * recebem os valores da faixa (1, 2 ou 3) que contém o periodo.
 */
export function getMortalidadeResolvida(params: Record<string, number>, periodo: number): MortalidadeResolvida {
  const faixa = getFaixaForPeriodo(params, periodo);
  const clampTx = (v: number) => clamp(0, v, 100);

  if (faixa === 1) {
    const txInicial = clampTx(params.tx_mortalidade_inicial_1 ?? 1);
    const txFinal = clampTx(params.tx_mortalidade_final_1 ?? 0.5);
    const pi1 = params.periodo_i1 ?? -100;
    const pf1 = params.periodo_f1 ?? 2026;
    const r = computeIntervaloTaxa({
      tx_inicial: txInicial,
      periodo_i: pi1,
      periodo_f: pf1,
      tx_final: txFinal,
    });
    return {
      tx_mortalidade_inicial: txInicial,
      tx_mortalidade_final: txFinal,
      fator_mortalidade_anual: r?.fator_anual ?? 1,
      faixa: 1,
    };
  }

  if (faixa === 2) {
    const txInicial = clampTx(params.tx_mortalidade_final_1 ?? 0.5);
    const txFinal = clampTx(params.tx_mortalidade_final_2 ?? 0.5);
    const pi2 = params.periodo_i2 ?? 101;
    const pf2 = params.periodo_f2 ?? 100;
    const r = computeIntervaloTaxa({
      tx_inicial: txInicial,
      periodo_i: pi2,
      periodo_f: pf2,
      tx_final: txFinal,
      periodoSeguinte: true,
    });
    return {
      tx_mortalidade_inicial: txInicial,
      tx_mortalidade_final: txFinal,
      fator_mortalidade_anual: r?.fator_anual ?? 1,
      faixa: 2,
    };
  }

  const txInicial = clampTx(params.tx_mortalidade_final_2 ?? 0.5);
  const txFinal = clampTx(params.tx_mortalidade_final_3 ?? 0.5);
  const pi3 = params.periodo_i3 ?? 201;
  const pf3 = params.periodo_f3 ?? 100;
  const r = computeIntervaloTaxa({
    tx_inicial: txInicial,
    periodo_i: pi3,
    periodo_f: pf3,
    tx_final: txFinal,
    periodoSeguinte: true,
  });
  return {
    tx_mortalidade_inicial: txInicial,
    tx_mortalidade_final: txFinal,
    fator_mortalidade_anual: r?.fator_anual ?? 1,
    faixa: 3,
  };
}

/**
 * Retorna o ano de fim do último período configurado (periodo_f1, periodo_f2 ou periodo_f3).
 * Garante número finito (evita NaN em inputs não preenchidos).
 */
export function getPeriodoFimUltimo(params: Record<string, number>): number {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 100);
  const pf1 = n(params.periodo_f1);
  const add2 = (params.adicionar_intervalo_2 ?? 0) === 1;
  const pf2 = n(params.periodo_f2);
  const add3 = (params.adicionar_intervalo_3 ?? 0) === 1;
  const pf3 = n(params.periodo_f3);
  if (add3) return pf3;
  if (add2) return pf2;
  return pf1;
}

/**
 * Número máximo de iterações: a simulação não deve ultrapassar o ano fim do último período.
 * periodo = periodo_i1 + iteracao => iteracao_max = periodo_f_ultimo - periodo_i1.
 * Garante que nunca retorna NaN (ex.: quando params vêm de input ainda não preenchido).
 */
export function getIteracaoMaxima(params: Record<string, number>): number {
  const pi1 = Number(params.periodo_i1);
  const pfUltimo = getPeriodoFimUltimo(params);
  const maxIter = Math.max(0, Math.floor(Number(pfUltimo) - (Number.isFinite(pi1) ? pi1 : -100)));
  return Number.isFinite(maxIter) ? maxIter : 200;
}

/** Áreas não brancas do mapa (notWhitePixels): nascimento e plot apenas nessas. Índice do pixel: 0–7 (8 cores). */
export type MapaAreasPretas = {
  notWhitePixels: [number, number][];
  isBlack(x: number, y: number): boolean;
  sorteiaPosicaoPreta(): { x: number; y: number };
  pixelPretoMaisProximo(x: number, y: number): { x: number; y: number };
  /** Índice da cor no pixel (x,y): 0–7. Usado para gravar cor no indivíduo ao nascer. */
  getIndiceAt(x: number, y: number): number;
  /** Índice da cor branca (inválida). Se definido, descendentes usam "getIndiceAt !== indiceBranco" (ponto diferente de branco) em vez de isBlack. */
  indiceBranco?: number;
  /** Grid plano [py*REGIAO_SIZE+px] = índice 0–7. Quando presente, loop de descendentes usa lookup direto (fast path). */
  indiceGrid?: number[] | Uint8Array;
};

// --- Constantes espaciais ---
export const REGIAO_SIZE = 1024;
const GRID_SIZE = REGIAO_SIZE * REGIAO_SIZE;
export const ESCALA_KM_POR_PX = 39.0625;
export const REGIAO_KM = REGIAO_SIZE * ESCALA_KM_POR_PX;
export const CENTRO_KM = REGIAO_KM / 2;

/** Parar a simulação quando o total de indivíduos atingir este limite. */
export const LIMITE_POPULACAO = 20_000_000_000; // 20 bilhões

const raio_regiao_max = 50;

export function kmToPx(km: number): number {
  return Math.round(clamp(0, km / ESCALA_KM_POR_PX, REGIAO_SIZE));
}

export function pxToKm(px: number): number {
  return px * ESCALA_KM_POR_PX;
}

// --- Helpers ---
function sorteiaGenero(): 0 | 1 {
  return Math.random() < 0.5 ? 1 : 0;
}

/** Direção aleatória no vetor: 0..(n-1), n entre 2 e 8 (não herda do pai). */
function sorteiaDirecao(n: number): number {
  const qtde = Math.min(8, Math.max(2, Math.floor(n)));
  return Math.floor(Math.random() * qtde);
}

function sampleNormal(mean: number, sd: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  if (u1 <= 0) return mean;
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sd;
}

function sampleDeslocamentoKm(raio_dispersao_km: number): { dx_km: number; dy_km: number } {
  const raio = Math.max(0, raio_dispersao_km);
  const r = raio * Math.sqrt(Math.random());
  const angle = 2 * Math.PI * Math.random();
  return {
    dx_km: r * Math.cos(angle),
    dy_km: r * Math.sin(angle),
  };
}

/** Deslocamento em pixels (mesma distribuição que em km); evita kmToPx no loop do mapa. */
function sampleDeslocamentoPx(raio_px: number): { dx_px: number; dy_px: number } {
  const raio = Math.max(0, raio_px);
  const r = raio * Math.sqrt(Math.random());
  const angle = 2 * Math.PI * Math.random();
  return {
    dx_px: r * Math.cos(angle),
    dy_px: r * Math.sin(angle),
  };
}

function atualizarDispersaoAnual(ind: GenesisIndividual, dispersao_anual_media_km: number): GenesisIndividual {
  const dispersao_dp = dispersao_anual_media_km / 3;
  const incremento = sampleNormal(0, dispersao_dp);
  const dispersaoCalculada = ind.dispersao + incremento;
  ind.dispersao = dispersaoCalculada < 0 ? ind.dispersao : dispersaoCalculada;
  const novaDispersaoRegiao = ind.dispersao_regiao + incremento;
  if (novaDispersaoRegiao < 0) {
    ind.dispersao_regiao = 0;
    if (ind.regiao > 1) ind.regiao = ind.regiao - 1;
  } else if (novaDispersaoRegiao > raio_regiao_max) {
    ind.regiao = ind.regiao + 1;
    ind.dispersao_regiao = 0;
  } else {
    ind.dispersao_regiao = novaDispersaoRegiao;
  }
  return ind;
}

/** Chave numérica única por (especie, idade, epoca, regiao, ativo, genero, cor, direcao). Evita alocação de string por indivíduo (gargalo). */
function chaveReagrupamentoNum(ind: GenesisIndividual): number {
  return (
    ind.especie
    + ind.idade * 1e2
    + ind.epoca * 1e5
    + ind.regiao * 1e8
    + (ind.ativo ? 1e11 : 0)
    + (ind.genero ? 2e11 : 0)
    + (ind.cor ?? 0) * 1e12
    + (ind.direcao ?? 0) * 1e13
  );
}

function reagruparVetores(
  vetor1: GenesisIndividual[],
  vetor2: GenesisIndividual[],
  minFormGrupo: number,
  qtdeLog?: QtdeLogEntry[],
  perfAcc?: Record<string, number>
): { vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; tempo?: number } {
  const inicio = performance.now();
  const totalEntrada = sumQtde(vetor1) + sumQtde(vetor2);
  const nTodos = vetor1.length + vetor2.length;
  if (qtdeLog) {
    qtdeLog.push({ etapa: "reagruparVetores entrada", total: totalEntrada, nVetor1: vetor1.length, nVetor2: vetor2.length, sumV1: sumQtde(vetor1), sumV2: sumQtde(vetor2), extra: { nTodos } });
  }
  if (typeof window !== "undefined" && window.__DEBUG_QTDE) {
    console.log("[QTDE] reagruparVetores entrada", { totalEntrada, nTodos, sumV1: sumQtde(vetor1), sumV2: sumQtde(vetor2) });
  }
  let tMap = 0;
  if (perfAcc) tMap = performance.now();
  const grupos = new Map<number, GenesisIndividual[]>();
  const nV1 = vetor1.length;
  const nV2 = vetor2.length;
  for (let i = 0; i < nV1 + nV2; i++) {
    const ind = i < nV1 ? vetor1[i]! : vetor2[i - nV1]!;
    const key =
      ind.especie
      + ind.idade * 1e2
      + ind.epoca * 1e5
      + ind.regiao * 1e8
      + (ind.ativo ? 1e11 : 0)
      + (ind.genero ? 2e11 : 0)
      + (ind.cor ?? 0) * 1e12
      + (ind.direcao ?? 0) * 1e13;
    let list = grupos.get(key);
    if (!list) {
      list = [];
      grupos.set(key, list);
    }
    list.push(ind);
  }
  if (perfAcc) {
    const dMap = performance.now() - tMap;
    perfAcc["  reagrupar_map"] = (perfAcc["  reagrupar_map"] ?? 0) + dMap;
  }
  let tAgregar = 0;
  if (perfAcc) tAgregar = performance.now();
  const agregados: GenesisIndividual[] = [];
  for (const [, grupo] of grupos) {
    if (grupo.length === 0) continue;
    const primeiro = grupo[0]!;
    let minX = primeiro.x, maxX = primeiro.x;
    let minY = primeiro.y, maxY = primeiro.y;
    let maxDispersao = primeiro.dispersao;
    let maxDispersaoRegiao = primeiro.dispersao_regiao;
    let minId = primeiro.id;
    let maxDecendentes = primeiro.decendentes;
    let minGeracao = primeiro.geracao;
    let somaQtde = primeiro.qtde;
    let somaMorte = (primeiro.morte ?? 0);
    let maxPlotValido = (primeiro.plotValido ?? 1) as 0 | 1;
    for (let i = 1; i < grupo.length; i++) {
      const ind = grupo[i]!;
      if ((ind.plotValido ?? 1) > maxPlotValido) maxPlotValido = 1;
      if (ind.x < minX) minX = ind.x;
      if (ind.x > maxX) maxX = ind.x;
      if (ind.y < minY) minY = ind.y;
      if (ind.y > maxY) maxY = ind.y;
      if (ind.dispersao > maxDispersao) maxDispersao = ind.dispersao;
      if (ind.dispersao_regiao > maxDispersaoRegiao) maxDispersaoRegiao = ind.dispersao_regiao;
      if (ind.id < minId) minId = ind.id;
      if (ind.decendentes > maxDecendentes) maxDecendentes = ind.decendentes;
      if (ind.geracao < minGeracao) minGeracao = ind.geracao;
      somaQtde += ind.qtde;
      somaMorte += (ind.morte ?? 0);
    }
    // Só substituir vários por um (exclusão dos demais ids) depois que o grupo for efetivamente formado.
    const grupoFormado = somaQtde >= minFormGrupo;
    if (grupoFormado) {
      // Usar posição de um indivíduo do grupo (garantidamente em área válida), não uma quina do bbox que pode cair em branco
      const indPos = grupo[Math.floor(Math.random() * grupo.length)]!;
      const agregado: GenesisIndividual = {
        ...primeiro,
        id: minId,
        geracao: minGeracao,
        x: indPos.x,
        y: indPos.y,
        dispersao: maxDispersao,
        dispersao_regiao: maxDispersaoRegiao,
        decendentes: maxDecendentes,
        direcao: primeiro.direcao,
        genero: primeiro.genero,
        qtde: somaQtde,
        morte: somaMorte,
        plotValido: maxPlotValido,
      };
      agregados.push(agregado);
    } else {
      for (let i = 0; i < grupo.length; i++) agregados.push(grupo[i]!);
    }
  }
  if (perfAcc) {
    const dAgregar = performance.now() - tAgregar;
    perfAcc["  reagrupar_agregar"] = (perfAcc["  reagrupar_agregar"] ?? 0) + dAgregar;
  }
  let tSplit = 0;
  if (perfAcc) tSplit = performance.now();
  const v1: GenesisIndividual[] = [];
  const v2: GenesisIndividual[] = [];
  for (const agregado of agregados) {
    if (agregado.genero === 0) v1.push(agregado);
    else v2.push(agregado);
  }
  if (perfAcc) {
    const dSplit = performance.now() - tSplit;
    perfAcc["  reagrupar_split"] = (perfAcc["  reagrupar_split"] ?? 0) + dSplit;
  }
  const totalSaida = sumQtde(v1) + sumQtde(v2);
  if (qtdeLog) {
    qtdeLog.push({ etapa: "reagruparVetores saída", total: totalSaida, nVetor1: v1.length, nVetor2: v2.length, sumV1: sumQtde(v1), sumV2: sumQtde(v2), extra: { nAgregados: agregados.length } });
    if (totalEntrada !== totalSaida) {
      qtdeLog.push({ etapa: "[QTDE] PERDA EM reagruparVetores", total: totalSaida, nVetor1: v1.length, nVetor2: v2.length, sumV1: sumQtde(v1), sumV2: sumQtde(v2), extra: { totalEntrada, totalSaida, diferenca: totalEntrada - totalSaida } });
    }
  }
  if (typeof window !== "undefined" && window.__DEBUG_QTDE) {
    console.log("[QTDE] reagruparVetores saída", { totalSaida, nAgregados: agregados.length, nV1: v1.length, nV2: v2.length });
    if (totalEntrada !== totalSaida) {
      console.error("[QTDE] PERDA EM reagruparVetores", { totalEntrada, totalSaida, diferenca: totalEntrada - totalSaida });
    }
  }
  const tempo = performance.now() - inicio;
  return { vetor1: v1, vetor2: v2, tempo };
}

function probReproducao(
  idade: number,
  idade_fertil_min: number,
  idade_fertil_max: number,
  idade_fertil_pico: number,
  prob_anual_reproducao: number,
  tx_decaimento_pos_pico: number
): number {
  if (idade < idade_fertil_min || idade > idade_fertil_max) return 0;
  if (idade <= idade_fertil_pico) return clamp(0, prob_anual_reproducao / 100, 1);
  const p = (prob_anual_reproducao / 100) * Math.exp(-tx_decaimento_pos_pico * (idade - idade_fertil_pico));
  return clamp(0, p, 1);
}

/** Sorteia um inteiro não negativo da distribuição de Poisson com média lambda. (Usado só para indivíduos, qtde === 1.) */
function samplePoisson(lambda: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 50) {
    const sd = Math.sqrt(lambda);
    return Math.max(0, Math.round(sampleNormal(lambda, sd)));
  }
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

/**
 * Média de filhos por parto na idade: constante na janela fértil (o decaimento com a idade
 * já está na probabilidade de reprodução probReproducao).
 */
function mediaFilhosPorParto(
  idade: number,
  idade_fertil_min: number,
  idade_fertil_max: number,
  fecundidade_media_parto: number
): number {
  if (idade < idade_fertil_min || idade > idade_fertil_max) return 0;
  return Math.max(0, fecundidade_media_parto);
}

export type RunGerarGenesisParams = {
  max_idade: number;
  idade_fertil_min: number;
  idade_fertil_max: number;
  idade_fertil_pico: number;
  tx_decaimento_pos_pico: number;
  fecundidade_media_parto?: number;
  prob_anual_reproducao: number;
  dispersao_anual_media: number;
  fecundidade_max_parto: number;
  periodo_simulado: number;
  tx_mortalidade_inicial_1: number;
  reducao_crescimento_habilitada: number;
  periodo_i1: number;
  periodo_f1: number;
  tx_mortalidade_final_1: number;
  min_form_grupo: number;
  x0?: number;
  y0?: number;
  x0_v2?: number;
  y0_v2?: number;
  /** 1 = habilitado (usa cor do mapa e fatores por cor); 0 = desabilitado (cor=0 e fator=1 para todos). */
  fator_continental_habilitado?: number;
  /** Número de direções (2..8). Default 4 → direcao em [0,1,2,3]. */
  qtde_direcoes?: number;
  tx_exp_inicial_grupo_1?: number;
  per_de_mod_da_tx_exp_i1?: number;
  per_de_mod_da_tx_exp_f1?: number;
  tx_exp_final_grupo_mod_1?: number;
};

const MAX_PARES_POR_ORIGEM_INDIVIDUAL = 7;
const MIN_PARES_AGRUPADO = 50;
const MAX_PARES_POR_ANO = 50_000;

/** Cria indivíduos para uma origem agendada. Menos de 50 pares: 1 vetor por género por par (máx 7 pares). 50+ pares: 2 vetores agrupados (1 fem + 1 masc com qtde = N). */
function criarIndividuosDeOrigem(
  origem: OrigemAgendada,
  mapa: MapaAreasPretas | undefined,
  nextId: number,
  especie: EspecieParams,
  paresRestantes: number,
  /** Quando true, força cor=0 em todos os indivíduos (fator continental desabilitado). */
  forceCorZero?: boolean,
  /** Número de direções (2..8) para sorteiaDirecao. */
  qtdeDirecoes: number = 8
): { vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; nextId: number; paresUsados: number } {
  let x_km = clamp(0, origem.x0_km, REGIAO_KM);
  let y_km = clamp(0, origem.y0_km, REGIAO_KM);
  if (mapa?.notWhitePixels.length) {
    const px = kmToPx(x_km);
    const py = kmToPx(y_km);
    if (!mapa.isBlack(px, py)) {
      const p = mapa.pixelPretoMaisProximo(px, py);
      x_km = pxToKm(p.x);
      y_km = pxToKm(p.y);
    }
  }
  const cor = forceCorZero ? 0 : (mapa?.getIndiceAt(kmToPx(x_km), kmToPx(y_km)) ?? 0);
  const idade = Math.max(0, Math.floor(origem.idade));
  const requested = Math.floor(origem.quantidadePares);
  const vetor1: GenesisIndividual[] = [];
  const vetor2: GenesisIndividual[] = [];
  let id = nextId;

  if (requested >= MIN_PARES_AGRUPADO) {
    // 50+ pares: 2 vetores agrupados (1 fem qtde=q, 1 masc qtde=q)
    const q = Math.max(0, Math.min(requested, paresRestantes));
    if (q > 0) {
      const base: Omit<GenesisIndividual, "id" | "genero" | "direcao"> = {
        especie: 1,
        x: x_km,
        y: y_km,
        idade,
        epoca: 0,
        geracao: 1,
        dispersao: 0,
        dispersao_regiao: 0,
        regiao: 1,
        decendentes: 0,
        ativo: 1,
        qtde: q,
        morte: 0,
        plotValido: 1,
        cor,
      };
      vetor1.push({ ...base, id: id++, genero: 0, direcao: sorteiaDirecao(qtdeDirecoes) });
      vetor2.push({ ...base, id: id++, genero: 1, direcao: sorteiaDirecao(qtdeDirecoes) });
    }
    return { vetor1, vetor2, nextId: id, paresUsados: q };
  }

  // &lt; 50 pares: 1 vetor por género por par (máx 7)
  const q = Math.max(0, Math.min(MAX_PARES_POR_ORIGEM_INDIVIDUAL, requested, paresRestantes));
  for (let i = 0; i < q; i++) {
    const base: Omit<GenesisIndividual, "id" | "genero" | "direcao"> = {
      especie: 1,
      x: x_km,
      y: y_km,
      idade,
      epoca: 0,
      geracao: 1,
      dispersao: 0,
      dispersao_regiao: 0,
      regiao: 1,
      decendentes: 0,
      ativo: 1,
      qtde: 1,
      morte: 0,
      plotValido: 1,
      cor,
    };
    vetor1.push({ ...base, id: id++, genero: 0, direcao: sorteiaDirecao(qtdeDirecoes) });
    vetor2.push({ ...base, id: id++, genero: 1, direcao: sorteiaDirecao(qtdeDirecoes) });
  }
  return { vetor1, vetor2, nextId: id, paresUsados: q };
}

export function runGerarGenesis(
  params: RunGerarGenesisParams,
  mapa?: MapaAreasPretas,
  debugContext?: DebugGenesisContext | null,
  origensAgendadas?: OrigemAgendada[]
): { vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; especie: EspecieParams; resultadoPorId: ResultadoReproducaoPorId } {
  const periodoI1 = params.periodo_i1 ?? -100;
  const idadeFertil = Math.max(1, params.idade_fertil_min ?? 22);
  const perDeMod = Math.max(1, (params.periodo_f1 ?? 2026) - periodoI1 + 1);
  const periodoReducao = params.reducao_crescimento_habilitada ? perDeMod : 2;
  const txModificada = clamp(0, params.tx_mortalidade_final_1 ?? 0.5, 100);
  const txInicial = clamp(0, params.tx_mortalidade_inicial_1 ?? 1, 100);
  const intervalo1 = computeIntervaloTaxa({
    tx_inicial: txInicial,
    periodo_i: periodoI1,
    periodo_f: params.periodo_f1 ?? 2026,
    tx_final: txModificada,
  });
  const fator_mortalidade_anual_1 = intervalo1?.fator_anual ?? 1;

  const especie: EspecieParams = {
    periodo_simulado: Math.max(0, params.periodo_simulado ?? 0),
    faixa_fertilidade: [params.idade_fertil_min ?? 22, params.idade_fertil_max],
    idade_fertil_pico: clamp(params.idade_fertil_min ?? 22, params.idade_fertil_pico ?? 25, params.idade_fertil_max),
    tx_decaimento_pos_pico: clamp(0, params.tx_decaimento_pos_pico ?? 0.25, 3),
    prob_anual_reproducao: clamp(0, params.prob_anual_reproducao, 100),
    dispersao_anual_media: Math.max(0, params.dispersao_anual_media ?? 50),
    fecundidade_max_parto: clamp(1, params.fecundidade_max_parto ?? 3, 100),
    tx_mortalidade_inicial_1: txInicial,
    per_de_mod_da_tx_mortalidade_1: periodoReducao,
    tx_mortalidade_final_1: txModificada,
    fator_mortalidade_anual_1,
    min_form_grupo: clamp(50, params.min_form_grupo ?? 50, 100),
  };

  const qtdeDirecoes = Math.min(8, Math.max(2, Math.floor(params.qtde_direcoes ?? 4)));
  const origensAnoInicial = origensAgendadas?.filter((o) => o.ano === periodoI1) ?? [];
  if (origensAnoInicial.length > 0) {
    let vetor1: GenesisIndividual[] = [];
    let vetor2: GenesisIndividual[] = [];
    let nextId = 1;
    let paresRestantes = MAX_PARES_POR_ANO;
    const resultadoPorId: ResultadoReproducaoPorId = {};
    for (const origem of origensAnoInicial) {
      const { vetor1: v1, vetor2: v2, nextId: nid, paresUsados } = criarIndividuosDeOrigem(origem, mapa, nextId, especie, paresRestantes, undefined, qtdeDirecoes);
      paresRestantes -= paresUsados;
      vetor1 = vetor1.concat(v1);
      vetor2 = vetor2.concat(v2);
      nextId = nid;
      for (const ind of [...v1, ...v2]) {
        resultadoPorId[ind.id] = RESULTADO_ZERO;
      }
    }
    return { vetor1, vetor2, especie, resultadoPorId };
  }

  const max_idade = Math.max(1, params.max_idade);
  const periodoSimulado = Math.max(0, params.periodo_simulado ?? 0);
  let x0_km = clamp(0, params.x0 ?? CENTRO_KM, REGIAO_KM);
  let y0_km = clamp(0, params.y0 ?? CENTRO_KM, REGIAO_KM);
  let x0_v2_km = clamp(0, params.x0_v2 ?? CENTRO_KM, REGIAO_KM);
  let y0_v2_km = clamp(0, params.y0_v2 ?? CENTRO_KM, REGIAO_KM);
  if (mapa?.notWhitePixels.length) {
    if (!mapa.isBlack(kmToPx(x0_km), kmToPx(y0_km))) {
      const p = mapa.pixelPretoMaisProximo(kmToPx(x0_km), kmToPx(y0_km));
      x0_km = pxToKm(p.x);
      y0_km = pxToKm(p.y);
    }
    if (!mapa.isBlack(kmToPx(x0_v2_km), kmToPx(y0_v2_km))) {
      const p = mapa.pixelPretoMaisProximo(kmToPx(x0_v2_km), kmToPx(y0_v2_km));
      x0_v2_km = pxToKm(p.x);
      y0_v2_km = pxToKm(p.y);
    }
  }

  const fatorContinentalHabilitado = (params.fator_continental_habilitado ?? 1) === 1;
  const cor1 = fatorContinentalHabilitado ? (mapa?.getIndiceAt(kmToPx(x0_km), kmToPx(y0_km)) ?? 0) : 0;
  const cor2 = fatorContinentalHabilitado ? (mapa?.getIndiceAt(kmToPx(x0_v2_km), kmToPx(y0_v2_km)) ?? 0) : 0;
  const ind1: GenesisIndividual = {
    id: 1,
    especie: 1,
    x: x0_km,
    y: y0_km,
    idade: Math.max(0, idadeFertil - 1),
    epoca: 0,
    geracao: 1,
    dispersao: 0,
    dispersao_regiao: 0,
    regiao: 1,
    decendentes: 0,
    direcao: sorteiaDirecao(qtdeDirecoes),
    genero: 0,
    ativo: 1,
    qtde: 1,
    morte: 0,
    plotValido: 1,
    cor: cor1,
  };

  const ind2: GenesisIndividual = {
    ...ind1,
    id: 2,
    x: x0_v2_km,
    y: y0_v2_km,
    idade: Math.max(0, idadeFertil - 1),
    genero: 1,
    qtde: 1,
    decendentes: 0,
    plotValido: 1,
    cor: cor2,
    direcao: sorteiaDirecao(qtdeDirecoes),
  };

  const resultadoPorId: ResultadoReproducaoPorId = {
    1: { prob_reproducao: 0, evento_reproducao: 0, decendentes: 0 },
    2: { prob_reproducao: 0, evento_reproducao: 0, decendentes: 0 },
  };

  logGenesisDebug(
    1,
    "[DEBUG id=1 Genesis] Iteração 0: vetores inicializados (sem cálculo).",
    {
      ind1: { id: ind1.id, idade: ind1.idade, x: ind1.x, y: ind1.y, dispersao: ind1.dispersao, dispersao_regiao: ind1.dispersao_regiao, cor: ind1.cor },
      ind2: { id: ind2.id, idade: ind2.idade, x: ind2.x, y: ind2.y, cor: ind2.cor },
    },
    debugContext
  );

  return {
    vetor1: [ind1],
    vetor2: [ind2],
    especie,
    resultadoPorId,
  };
}

export function runUmPasso(
  vetor1: GenesisIndividual[],
  vetor2: GenesisIndividual[],
  especie: EspecieParams,
  params: Record<string, number>,
  mapa?: MapaAreasPretas,
  debugContext?: DebugGenesisContext | null,
  /** Se definido, as variáveis de mortalidade (tx_*, fator) são resolvidas para esta faixa: tx_mortalidade_inicial = tx_mortalidade_inicial_N do período que contém periodo. */
  periodo?: number,
  /** Origens agendadas: no ano igual a periodo, injeta os pares antes do passo. */
  origensAgendadas?: OrigemAgendada[]
): { vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; especie: EspecieParams; resultadoPorId: ResultadoReproducaoPorId } {
  let especieAtual = especie;
  if (periodo !== undefined && Number.isFinite(periodo)) {
    const resolved = getMortalidadeResolvida(params, periodo);
    especieAtual = {
      ...especie,
      tx_mortalidade_inicial_1: resolved.tx_mortalidade_inicial,
      tx_mortalidade_final_1: resolved.tx_mortalidade_final,
      fator_mortalidade_anual_1: resolved.fator_mortalidade_anual,
    };
  }

  const qtdeDirecoesPasso = Math.min(8, Math.max(2, Math.floor(params.qtde_direcoes ?? 4)));

  let vetor1Entrada = vetor1;
  let vetor2Entrada = vetor2;
  if (origensAgendadas?.length && periodo !== undefined && Number.isFinite(periodo)) {
    const origensEsteAno = origensAgendadas.filter((o) => o.ano === periodo);
    if (origensEsteAno.length > 0) {
      let nextId = maxIdFromVetores(vetor1, vetor2);
      nextId = nextId > -Infinity ? nextId + 1 : 1;
      let paresRestantes = MAX_PARES_POR_ANO;
      const inj1: GenesisIndividual[] = [];
      const inj2: GenesisIndividual[] = [];
      const forceCorZero = (params.fator_continental_habilitado ?? 1) !== 1;
      for (const origem of origensEsteAno) {
        const { vetor1: v1, vetor2: v2, nextId: nid, paresUsados } = criarIndividuosDeOrigem(origem, mapa, nextId, especieAtual, paresRestantes, forceCorZero, qtdeDirecoesPasso);
        paresRestantes -= paresUsados;
        inj1.push(...v1);
        inj2.push(...v2);
        nextId = nid;
      }
      vetor1Entrada = [...vetor1, ...inj1];
      vetor2Entrada = [...vetor2, ...inj2];
    }
  }

  const idadeFerMin = params.idade_fertil_min ?? 22;
  const idadeFerMax = params.idade_fertil_max ?? 50;
  const idadeFerPico = clamp(idadeFerMin, params.idade_fertil_pico ?? 25, idadeFerMax);
  const probPct = clamp(0, params.prob_anual_reproducao ?? 90, 100);
  const kDec = clamp(0, params.tx_decaimento_pos_pico ?? 0.25, 3);
  const fecundidadeMediaParto = Math.max(0, params.fecundidade_media_parto ?? 1.05);
  const fecundidadeMaxPartoCap = clamp(1, params.fecundidade_max_parto ?? 3, 100);

  const resultadoPorId: ResultadoReproducaoPorId = {};
  const perfLog = debugContext?.performanceLog;
  const perfAcc = debugContext?.performanceLogAcc;
  function addPerf(phase: string, ms: number): void {
    if (perfLog) perfLog.push({ phase, ms });
    if (perfAcc) perfAcc[phase] = (perfAcc[phase] ?? 0) + ms;
  }

  // Antes de somar idade: aplicar mortes (qtde = qtde - morte) e excluir entradas com qtde <= 0 (um passe, sem map+filter)
  const t0Mortes = performance.now();
  const vetor1AposMortes: GenesisIndividual[] = [];
  for (let i = 0; i < vetor1Entrada.length; i++) {
    const ind = vetor1Entrada[i]!;
    const qtde = Math.max(0, ind.qtde - (ind.morte ?? 0));
    if (qtde > 0) vetor1AposMortes.push({ ...ind, qtde });
  }
  const vetor2AposMortes: GenesisIndividual[] = [];
  for (let i = 0; i < vetor2Entrada.length; i++) {
    const ind = vetor2Entrada[i]!;
    const qtde = Math.max(0, ind.qtde - (ind.morte ?? 0));
    if (qtde > 0) vetor2AposMortes.push({ ...ind, qtde });
  }
  addPerf("aplicar_mortes", performance.now() - t0Mortes);

  const maxId = maxIdFromVetores(vetor1AposMortes, vetor2AposMortes);
  let nextId = maxId > -Infinity ? maxId + 1 : 1;

  logQtde("runUmPasso entrada (após aplicar mortes)", vetor1AposMortes, vetor2AposMortes, undefined, debugContext?.qtdeLog);

  const t0Idade = performance.now();
  const newVetor1: GenesisIndividual[] = [];
  for (let i = 0; i < vetor1AposMortes.length; i++) {
    const ind = vetor1AposMortes[i]!;
    ind.idade = ind.idade + 1;
    ind.decendentes = 0;
    newVetor1.push(ind);
  }
  const newVetor2: GenesisIndividual[] = [];
  for (let i = 0; i < vetor2AposMortes.length; i++) {
    const ind = vetor2AposMortes[i]!;
    ind.idade = ind.idade + 1;
    ind.decendentes = 0;
    newVetor2.push(ind);
  }
  addPerf("incremento_idade", performance.now() - t0Idade);
  logQtde("após incremento idade", newVetor1, newVetor2, undefined, debugContext?.qtdeLog);

  const idadeInicioVelhice = (params.idade_fertil_max ?? 50) + 1;
  const fragilidadeInicial = clamp(0.0001, params.fragilidade_inicial ?? 0.005, 0.10);
  const taxaEnvelhecimento = clamp(0.01, params.taxa_envelhecimento ?? 0.09, 0.30);

  function pMorteVelhice(idade: number): number {
    const x = idade - idadeInicioVelhice;
    if (x < 0) return 0;
    return 1 - Math.exp(-fragilidadeInicial * Math.exp(taxaEnvelhecimento * x));
  }

  // Taxa de mortalidade residual acumulada (fração 0..1) para o periodo atual; composta com velhice para evitar dependência de eventos.
  const periodoI1 = params.periodo_i1 ?? -100;
  const iteracaoMortalidade = periodo !== undefined && Number.isFinite(periodo) ? periodo - periodoI1 : 0;
  const txInicialPct = especieAtual.tx_mortalidade_inicial_1 ?? 1;
  const fatorMortalidade = especieAtual.fator_mortalidade_anual_1 ?? 1;
  const txAcumuladaPct = iteracaoMortalidade >= 1 ? txInicialPct * Math.pow(fatorMortalidade, iteracaoMortalidade - 1) : txInicialPct;
  const txAcumuladaFrac = clamp(0, txAcumuladaPct / 100, 1);

  const periodoParaFaixa = periodo !== undefined && Number.isFinite(periodo) ? periodo : periodoI1;
  const faixaMortalidade = getFaixaForPeriodo(params, periodoParaFaixa);

  /** Fator continental de mortalidade por cor (0–6). Pré-computado para evitar lookup por indivíduo (gargalo). Quando desabilitado, sempre 1. */
  const fatorContinentalHabilitado = (params.fator_continental_habilitado ?? 1) === 1;
  const fatorCorPorCor: number[] = [];
  for (let c = 0; c <= 7; c++) {
    const key = faixaMortalidade === 1 ? `fator_mortalidade_cor${c}` : faixaMortalidade === 2 ? `fator_mortalidade_cor${c}_2` : `fator_mortalidade_cor${c}_3`;
    const v = params[key];
    fatorCorPorCor[c] = Number.isFinite(v) && v >= 0 ? v : 1;
  }
  const getFatorCor = (cor: number) => (fatorContinentalHabilitado ? (fatorCorPorCor[Math.min(7, Math.max(0, cor | 0))] ?? 1) : 1);

  /** Probabilidade total de morte no ano: composição (independente) residual + velhice */
  function pMorteTotal(txResidualFrac: number, pVelhice: number): number {
    return clamp(0, txResidualFrac + pVelhice - txResidualFrac * pVelhice, 1);
  }

  /** Probabilidade de morte no ano para um indivíduo */
  function pMorteIndividuo(idade: number, cor: number): number {
    const fatorCor = getFatorCor(cor);
    const txResidualFracCor = clamp(0, txAcumuladaFrac * fatorCor, 1);
    if (idade < idadeInicioVelhice) return txResidualFracCor;
    return pMorteTotal(txResidualFracCor, pMorteVelhice(idade));
  }

  const t0Velhice = performance.now();
  const vetor1AposVelhice: GenesisIndividual[] = [];
  let tVelhiceV1 = 0;
  let tVelhiceV2 = 0;
  if (perfAcc) tVelhiceV1 = performance.now();
  for (let i = 0; i < newVetor1.length; i++) {
    const ind = newVetor1[i]!;
    const p = pMorteIndividuo(ind.idade, ind.cor ?? 0);
    if (ind.qtde === 1) {
      ind.morte = Math.random() < p ? 1 : (ind.morte ?? 0);
    } else {
      const n = ind.qtde;
      const media = n * p;
      const variancia = n * p * (1 - p);
      const desvio = variancia > 0 ? Math.sqrt(variancia) : 0;
      const x = desvio > 0 ? sampleNormal(media, desvio) : media;
      ind.morte = Math.round(clamp(0, x, n));
    }
    vetor1AposVelhice.push(ind);
  }
  if (perfAcc) {
    const d1 = performance.now() - tVelhiceV1;
    perfAcc["  mort_velhice_v1"] = (perfAcc["  mort_velhice_v1"] ?? 0) + d1;
    tVelhiceV2 = performance.now();
  }
  const vetor2AposVelhice: GenesisIndividual[] = [];
  for (let i = 0; i < newVetor2.length; i++) {
    const ind = newVetor2[i]!;
    const p = pMorteIndividuo(ind.idade, ind.cor ?? 0);
    if (ind.qtde === 1) {
      ind.morte = Math.random() < p ? 1 : (ind.morte ?? 0);
    } else {
      const n = ind.qtde;
      const media = n * p;
      const variancia = n * p * (1 - p);
      const desvio = variancia > 0 ? Math.sqrt(variancia) : 0;
      const x = desvio > 0 ? sampleNormal(media, desvio) : media;
      ind.morte = Math.round(clamp(0, x, n));
    }
    vetor2AposVelhice.push(ind);
  }
  if (perfAcc) {
    const d2 = performance.now() - tVelhiceV2;
    perfAcc["  mort_velhice_v2"] = (perfAcc["  mort_velhice_v2"] ?? 0) + d2;
  }
  addPerf("mortalidade_velhice", performance.now() - t0Velhice);
  logQtde("após mortalidade velhice", vetor1AposVelhice, vetor2AposVelhice, undefined, debugContext?.qtdeLog);

  // Debug: id=1 no runUmPasso (ative com DEBUG_GENESIS_ID=1 no código ou window.__DEBUG_GENESIS_ID=1 no console)
  const ind1Passo = vetor1AposVelhice.find((ind) => ind.id === 1);
  if (ind1Passo == null) {
    logGenesisDebug(1, "[DEBUG id=1 runUmPasso] id=1 não encontrado no vetor (pode ter sido agregado ou ainda não existir).", undefined, debugContext);
  } else {
    const x1 = ind1Passo.idade - idadeInicioVelhice;
    const pMorteVelhice1 = pMorteVelhice(ind1Passo.idade);
    logGenesisDebug(1, "[DEBUG id=1 runUmPasso] Parâmetros do vetor após incremento de idade:", {
      id: ind1Passo.id,
      especie: ind1Passo.especie,
      x: ind1Passo.x,
      y: ind1Passo.y,
      idade: ind1Passo.idade,
      epoca: ind1Passo.epoca,
      geracao: ind1Passo.geracao,
      dispersao: ind1Passo.dispersao,
      dispersao_regiao: ind1Passo.dispersao_regiao,
      regiao: ind1Passo.regiao,
      decendentes: ind1Passo.decendentes,
      direcao: ind1Passo.direcao,
      genero: ind1Passo.genero,
      ativo: ind1Passo.ativo,
      qtde: ind1Passo.qtde,
      morte: ind1Passo.morte ?? 0,
      plotValido: ind1Passo.plotValido,
      cor: ind1Passo.cor,
    }, debugContext);
    logGenesisDebug(1, "[DEBUG id=1 runUmPasso] Mortalidade (abaixo velhice: só residual; senão residual+velhice):", {
      idade_inicio_velhice: idadeInicioVelhice,
      fragilidade_inicial: fragilidadeInicial,
      taxa_envelhecimento: taxaEnvelhecimento,
      x: x1,
      tx_acumulada_frac: txAcumuladaFrac,
      cor: ind1Passo.cor ?? 0,
      fator_mortalidade_cor: getFatorCor(ind1Passo.cor ?? 0),
      p_morte_velhice: pMorteVelhice1,
      p_morte_aplicada: pMorteIndividuo(ind1Passo.idade, ind1Passo.cor ?? 0),
    }, debugContext);
    logGenesisDebug(1, "[DEBUG id=1 runUmPasso] Parâmetros aplicados para cálculos:", {
      idade_fertil_min: idadeFerMin,
      idade_fertil_max: idadeFerMax,
      idade_fertil_pico: idadeFerPico,
      prob_anual_reproducao: probPct,
      tx_decaimento_pos_pico: kDec,
      fecundidade_media_parto: fecundidadeMediaParto,
      dispersao_anual_media: params.dispersao_anual_media ?? 50,
    }, debugContext);
  }

  let minGrupoId = Infinity;
  for (let i = 0; i < vetor1AposVelhice.length; i++) {
    const ind = vetor1AposVelhice[i]!;
    if (ind.qtde > 1 && ind.genero === 0 && ind.id < minGrupoId) minGrupoId = ind.id;
  }
  for (let i = 0; i < vetor2AposVelhice.length; i++) {
    const ind = vetor2AposVelhice[i]!;
    if (ind.qtde > 1 && ind.genero === 0 && ind.id < minGrupoId) minGrupoId = ind.id;
  }

  let grupoPasso: GenesisIndividual | null = null;
  if (minGrupoId !== Infinity) {
    for (let i = 0; i < vetor1AposVelhice.length; i++) {
      const ind = vetor1AposVelhice[i]!;
      if (ind.qtde > 1 && ind.genero === 0 && ind.id === minGrupoId) {
        grupoPasso = ind;
        break;
      }
    }
    if (grupoPasso === null) {
      for (let i = 0; i < vetor2AposVelhice.length; i++) {
        const ind = vetor2AposVelhice[i]!;
        if (ind.qtde > 1 && ind.genero === 0 && ind.id === minGrupoId) {
          grupoPasso = ind;
          break;
        }
      }
    }
  }
  if (grupoPasso && debugContext?.groupLog) {
    const xGrupo = grupoPasso.idade - idadeInicioVelhice;
    const pMorteVelhiceGrupo = pMorteVelhice(grupoPasso.idade);
    logGenesisGrupoDebug("[DEBUG grupo (menor id) runUmPasso] Parâmetros do vetor após incremento de idade:", {
      id: grupoPasso.id,
      especie: grupoPasso.especie,
      x: grupoPasso.x,
      y: grupoPasso.y,
      idade: grupoPasso.idade,
      epoca: grupoPasso.epoca,
      geracao: grupoPasso.geracao,
      dispersao: grupoPasso.dispersao,
      dispersao_regiao: grupoPasso.dispersao_regiao,
      regiao: grupoPasso.regiao,
      decendentes: grupoPasso.decendentes,
      direcao: grupoPasso.direcao,
      genero: grupoPasso.genero,
      ativo: grupoPasso.ativo,
      qtde: grupoPasso.qtde,
      morte: grupoPasso.morte ?? 0,
      plotValido: grupoPasso.plotValido,
      cor: grupoPasso.cor,
    }, debugContext);
    logGenesisGrupoDebug("[DEBUG grupo (menor id) runUmPasso] Mortalidade (abaixo velhice: só residual; senão residual+velhice):", {
      idade_inicio_velhice: idadeInicioVelhice,
      fragilidade_inicial: fragilidadeInicial,
      taxa_envelhecimento: taxaEnvelhecimento,
      x: xGrupo,
      tx_acumulada_frac: txAcumuladaFrac,
      cor: grupoPasso.cor ?? 0,
      fator_mortalidade_cor: getFatorCor(grupoPasso.cor ?? 0),
      p_morte_velhice: pMorteVelhiceGrupo,
      p_morte_aplicada: pMorteIndividuo(grupoPasso.idade, grupoPasso.cor ?? 0),
      mortesGrupo: grupoPasso.morte ?? 0,
    }, debugContext);
    logGenesisGrupoDebug("[DEBUG grupo (menor id) runUmPasso] Parâmetros aplicados para cálculos:", {
      idade_fertil_min: idadeFerMin,
      idade_fertil_max: idadeFerMax,
      idade_fertil_pico: idadeFerPico,
      prob_anual_reproducao: probPct,
      tx_decaimento_pos_pico: kDec,
      fecundidade_media_parto: fecundidadeMediaParto,
      dispersao_anual_media: params.dispersao_anual_media ?? 50,
    }, debugContext);
  }

  const t0Repro = performance.now();
  let reproMsProb = 0;
  let reproMsGrupos = 0;
  let reproGruposMedia = 0;
  let reproGruposQtdeGenero = 0;
  let reproGruposArray = 0;
  let reproGruposOutros = 0;
  let reproMsIndividuos = 0;
  let reproIndPoisson = 0;
  let reproIndGeneros = 0;
  let reproIndOutros = 0;
  let reproMsDebug = 0;
  let reproMsDescendentes = 0;
  let reproDescDeslocamento = 0;
  let reproDescMapa = 0;
  let reproDescMapa_kmToPx = 0;
  let reproDescMapa_init = 0;
  let reproDescMapa_isBlack = 0;
  let reproDescMapa_loopCorpo = 0;
  let reproDescMapa_fim = 0;
  let reproDescSetup = 0;
  let reproDescCriarPush = 0;
  let reproVetor2Resultado = 0;
  const minFormGrupo = clamp(50, params.min_form_grupo ?? 50, 100);
  for (const ind of vetor1AposVelhice) {
    const tLoopInicio = perfAcc ? performance.now() : 0;
    let t = performance.now();
    if (perfAcc) perfAcc["  repro_loop_inicio"] = (perfAcc["  repro_loop_inicio"] ?? 0) + (t - tLoopInicio);
    const prob = probReproducao(ind.idade, idadeFerMin, idadeFerMax, idadeFerPico, probPct, kDec);
    const estaNoPeriodoFertil = prob > 0;
    { const d = performance.now() - t; if (perfLog) reproMsProb += d; if (perfAcc) perfAcc["  repro_prob"] = (perfAcc["  repro_prob"] ?? 0) + d; }
    let evento: 0 | 1;
    let numFilhos = 0;
    let numFeminino = 0;
    let numMasculino = 0;
    let generosDescendentes: (0 | 1)[] = [];
    let media: number | undefined;
    let xNormal: number | undefined;
    let valorUsadoNormal: number | undefined;

    if (ind.qtde > 1 && estaNoPeriodoFertil) {
      t = performance.now();
      // Grupos: sempre reproduzem se estiverem no período fértil (com subfases quando perfLog ou perfAcc)
      evento = 1;
      if (perfLog || perfAcc) {
        let t0 = performance.now();
        { const d = t0 - t; if (perfLog) reproGruposOutros += d; if (perfAcc) perfAcc["    repro_grupos_outros"] = (perfAcc["    repro_grupos_outros"] ?? 0) + d; }
        const mediaParto = mediaFilhosPorParto(
          ind.idade,
          idadeFerMin,
          idadeFerMax,
          fecundidadeMediaParto
        );
        media = ind.qtde >= minFormGrupo ? mediaParto : fecundidadeMediaParto;
        if (media > 0) {
          const desvio = Math.sqrt(media);
          xNormal = sampleNormal(media, desvio);
          valorUsadoNormal = Math.max(0, xNormal);
        } else {
          valorUsadoNormal = 0;
        }
        { const d = performance.now() - t0; if (perfLog) reproGruposMedia += d; if (perfAcc) perfAcc["    repro_grupos_media"] = (perfAcc["    repro_grupos_media"] ?? 0) + d; }
        t0 = performance.now();
        const qtdeFilhosGrupo = Math.ceil((valorUsadoNormal ?? 0) * ind.qtde * prob);
        const mediaGenero = qtdeFilhosGrupo * 0.5;
        const desvioGenero = Math.sqrt(qtdeFilhosGrupo * 0.5 * 0.5);
        let qtdeGenero1 = Math.round(Math.max(0, sampleNormal(mediaGenero, desvioGenero)));
        qtdeGenero1 = Math.min(qtdeGenero1, qtdeFilhosGrupo);
        const qtdeGenero0 = qtdeFilhosGrupo - qtdeGenero1;
        { const d = performance.now() - t0; if (perfLog) reproGruposQtdeGenero += d; if (perfAcc) perfAcc["    repro_grupos_qtde_genero"] = (perfAcc["    repro_grupos_qtde_genero"] ?? 0) + d; }
        t0 = performance.now();
        numFeminino = qtdeGenero0;
        numMasculino = qtdeGenero1;
        numFilhos = qtdeFilhosGrupo;
        generosDescendentes = [];
        { const d = performance.now() - t0; if (perfLog) reproGruposOutros += d; if (perfAcc) perfAcc["    repro_grupos_outros"] = (perfAcc["    repro_grupos_outros"] ?? 0) + d; }
      } else {
        const mediaParto = mediaFilhosPorParto(
          ind.idade,
          idadeFerMin,
          idadeFerMax,
          fecundidadeMediaParto
        );
        media = ind.qtde >= minFormGrupo ? mediaParto : fecundidadeMediaParto;
        if (media > 0) {
          const desvio = Math.sqrt(media);
          xNormal = sampleNormal(media, desvio);
          valorUsadoNormal = Math.max(0, xNormal);
        } else {
          valorUsadoNormal = 0;
        }
        const qtdeFilhosGrupo = Math.ceil((valorUsadoNormal ?? 0) * ind.qtde * prob);
        const mediaGenero = qtdeFilhosGrupo * 0.5;
        const desvioGenero = Math.sqrt(qtdeFilhosGrupo * 0.5 * 0.5);
        let qtdeGenero1 = Math.round(Math.max(0, sampleNormal(mediaGenero, desvioGenero)));
        qtdeGenero1 = Math.min(qtdeGenero1, qtdeFilhosGrupo);
        const qtdeGenero0 = qtdeFilhosGrupo - qtdeGenero1;
        numFeminino = qtdeGenero0;
        numMasculino = qtdeGenero1;
        numFilhos = qtdeFilhosGrupo;
        generosDescendentes = [];
      }
      { const d = performance.now() - t; if (perfLog) reproMsGrupos += d; if (perfAcc) perfAcc["  repro_grupos"] = (perfAcc["  repro_grupos"] ?? 0) + d; }
    } else {
      t = performance.now();
      let tIndFim = 0;
      // Indivíduos (qtde === 1): lógica original (com subfases quando perfLog ou perfAcc)
      if (perfLog || perfAcc) {
        let t0 = performance.now();
        { const d = t0 - t; if (perfLog) reproIndOutros += d; if (perfAcc) perfAcc["    repro_ind_outros"] = (perfAcc["    repro_ind_outros"] ?? 0) + d; }
        evento = Math.random() < prob ? 1 : 0;
        if (evento === 1) {
          const mediaParto = mediaFilhosPorParto(
            ind.idade,
            idadeFerMin,
            idadeFerMax,
            fecundidadeMediaParto
          );
          media = mediaParto;
          numFilhos = Math.min(samplePoisson(media), fecundidadeMaxPartoCap);
          if (media > 0) {
            xNormal = media;
            valorUsadoNormal = media;
          }
        }
        { const d = performance.now() - t0; if (perfLog) reproIndPoisson += d; if (perfAcc) perfAcc["    repro_ind_poisson"] = (perfAcc["    repro_ind_poisson"] ?? 0) + d; }
        if (evento === 1) {
          t0 = performance.now();
          const arr = new Array(numFilhos) as (0 | 1)[];
          let nF = 0;
          let nM = 0;
          for (let i = 0; i < numFilhos; i++) {
            const g = sorteiaGenero();
            arr[i] = g;
            if (g === 0) nF++;
            else nM++;
          }
          generosDescendentes = arr;
          numFeminino = nF;
          numMasculino = nM;
          { const d = performance.now() - t0; if (perfLog) reproIndGeneros += d; if (perfAcc) perfAcc["    repro_ind_generos"] = (perfAcc["    repro_ind_generos"] ?? 0) + d; }
        }
        tIndFim = performance.now();
      } else {
        evento = Math.random() < prob ? 1 : 0;
        if (evento === 1) {
          const mediaParto = mediaFilhosPorParto(
            ind.idade,
            idadeFerMin,
            idadeFerMax,
            fecundidadeMediaParto
          );
          media = mediaParto;
          numFilhos = Math.min(samplePoisson(media), fecundidadeMaxPartoCap);
          if (media > 0) {
            xNormal = media;
            valorUsadoNormal = media;
          }
          const arr = new Array(numFilhos) as (0 | 1)[];
          let nF = 0;
          let nM = 0;
          for (let i = 0; i < numFilhos; i++) {
            const g = sorteiaGenero();
            arr[i] = g;
            if (g === 0) nF++;
            else nM++;
          }
          generosDescendentes = arr;
          numFeminino = nF;
          numMasculino = nM;
        }
      }
      if (perfLog || perfAcc) { const d = performance.now() - tIndFim; if (perfLog) reproIndOutros += d; if (perfAcc) perfAcc["    repro_ind_outros"] = (perfAcc["    repro_ind_outros"] ?? 0) + d; }
      { const d = performance.now() - t; if (perfLog) reproMsIndividuos += d; if (perfAcc) perfAcc["  repro_individuos"] = (perfAcc["  repro_individuos"] ?? 0) + d; }
    }
    const decendentes = numFilhos;
    ind.decendentes = decendentes;

    t = performance.now();
    if (ind.id === 1) {
      const debugData: Record<string, unknown> = {
        prob_reproducao: prob,
        evento_reproducao: evento,
        decendentes: decendentes,
        filhos_gerados: numFilhos,
        generos_descendentes: generosDescendentes,
        idade: ind.idade,
        qtde: ind.qtde,
        pode_reproduzir: ind.qtde === 1,
      };
      if (media !== undefined) {
        debugData.fecundidade_media_parto = media;
        debugData.desvio = Math.sqrt(media);
        if (xNormal !== undefined) debugData.normal_x = xNormal;
        if (valorUsadoNormal !== undefined) debugData.normal_valor_usado = valorUsadoNormal;
      }
      logGenesisDebug(1, "[DEBUG id=1 runUmPasso] Cálculo de reprodução:", debugData, debugContext);
    }

    if (ind.qtde > 1 && ind.id === minGrupoId) {
      const debugData: Record<string, unknown> = {
        id_grupo: ind.id,
        prob_reproducao: prob,
        evento_reproducao: evento,
        decendentes: decendentes,
        filhos_gerados: numFilhos,
        generos_descendentes: generosDescendentes,
        idade: ind.idade,
        qtde: ind.qtde,
      };
      if (media !== undefined) {
        debugData.fecundidade_media_parto = media;
        debugData.desvio = Math.sqrt(media);
        if (xNormal !== undefined) debugData.normal_x = xNormal;
        if (valorUsadoNormal !== undefined) {
          debugData.normal_valor_usado = valorUsadoNormal;
          if (ind.qtde > 1 && estaNoPeriodoFertil) {
            const qtdeFilhosGrupo = Math.ceil((valorUsadoNormal ?? 0) * ind.qtde * prob);
            const mediaGenero = qtdeFilhosGrupo * 0.5;
            const desvioGenero = Math.sqrt(qtdeFilhosGrupo * 0.5 * 0.5);
            debugData.qtde_filhos_grupo = qtdeFilhosGrupo;
            debugData.media_genero = mediaGenero;
            debugData.desvio_genero = desvioGenero;
            debugData.qtde_genero_0 = numFeminino;
            debugData.qtde_genero_1 = numMasculino;
          }
        }
      }
      logGenesisGrupoDebug("[DEBUG grupo (menor id) runUmPasso] Cálculo de reprodução:", debugData, debugContext);
    }
    { const d = performance.now() - t; if (perfLog) reproMsDebug += d; if (perfAcc) perfAcc["  repro_debug"] = (perfAcc["  repro_debug"] ?? 0) + d; }

    t = perfLog || perfAcc ? performance.now() : 0;
    resultadoPorId[ind.id] =
      evento === 1
        ? {
            prob_reproducao: prob,
            evento_reproducao: 1,
            decendentes,
            generos_descendentes: generosDescendentes.length > 0 ? generosDescendentes : undefined,
          }
        : { prob_reproducao: prob, evento_reproducao: 0, decendentes: 0 };
    if (perfLog || perfAcc) {
      const d = performance.now() - t;
      if (perfAcc) perfAcc["  repro_resultado_por_id"] = (perfAcc["  repro_resultado_por_id"] ?? 0) + d;
    }

    if (evento === 1 && numFilhos > 0) {
      t = performance.now();
      let tSetup = perfLog || perfAcc ? performance.now() : 0;
      const raioDispersao = Math.max(0, ind.dispersao);
      const raioPx = raioDispersao / ESCALA_KM_POR_PX;
      const parent_px = kmToPx(ind.x);
      const parent_py = kmToPx(ind.y);
      const maxTentativas = 10;

      const amostrarPosicao = (): { px: number; py: number; cx_km: number; cy_km: number; posicaoValida: boolean } => {
        let dx_px = 0;
        let dy_px = 0;
        let px = (clamp(0, parent_px + dx_px, REGIAO_SIZE) | 0);
        let py = (clamp(0, parent_py + dy_px, REGIAO_SIZE) | 0);
        if (perfLog || perfAcc) {
          const tD = performance.now();
          ({ dx_px, dy_px } = sampleDeslocamentoPx(raioPx));
          px = (clamp(0, parent_px + dx_px, REGIAO_SIZE) | 0);
          py = (clamp(0, parent_py + dy_px, REGIAO_SIZE) | 0);
          const dD = performance.now() - tD;
          if (perfLog) reproDescDeslocamento += dD;
          if (perfAcc) perfAcc["    desc_deslocamento"] = (perfAcc["    desc_deslocamento"] ?? 0) + dD;
        } else {
          ({ dx_px, dy_px } = sampleDeslocamentoPx(raioPx));
          px = (clamp(0, parent_px + dx_px, REGIAO_SIZE) | 0);
          py = (clamp(0, parent_py + dy_px, REGIAO_SIZE) | 0);
        }
        let cx_km = pxToKm(px);
        let cy_km = pxToKm(py);
        let posicaoValida = true;
        if (mapa?.notWhitePixels.length) {
          let tentativas = 0;
          const grid = mapa.indiceGrid;
          const whiteIdx = mapa.indiceBranco ?? 1;
          const pixelNaoBranco = (qx: number, qy: number): boolean => {
            if (grid && grid.length === GRID_SIZE) {
              const idx = ((qy | 0) * REGIAO_SIZE + (qx | 0)) | 0;
              return idx >= 0 && idx < GRID_SIZE && grid[idx] !== whiteIdx;
            }
            return mapa!.indiceBranco != null ? mapa!.getIndiceAt(qx, qy) !== mapa!.indiceBranco : mapa!.isBlack(qx, qy);
          };
          if (perfLog || perfAcc) {
            const tInner = performance.now();
            let t0 = performance.now();
            { const d = t0 - tInner; if (perfLog) reproDescMapa_init += d; if (perfAcc) perfAcc["      desc_mapa_init"] = (perfAcc["      desc_mapa_init"] ?? 0) + d; }
            let naoBranco = pixelNaoBranco(px, py);
            { const d = performance.now() - t0; if (perfLog) reproDescMapa_isBlack += d; if (perfAcc) perfAcc["      desc_mapa_isBlack"] = (perfAcc["      desc_mapa_isBlack"] ?? 0) + d; }
            t0 = performance.now();
            while (!naoBranco && tentativas < maxTentativas) {
              ({ dx_px, dy_px } = sampleDeslocamentoPx(raioPx));
              px = (clamp(0, parent_px + dx_px, REGIAO_SIZE) | 0);
              py = (clamp(0, parent_py + dy_px, REGIAO_SIZE) | 0);
              naoBranco = pixelNaoBranco(px, py);
              tentativas++;
            }
            { const d = performance.now() - t0; if (perfLog) reproDescMapa_loopCorpo += d; if (perfAcc) perfAcc["      desc_mapa_loop_corpo"] = (perfAcc["      desc_mapa_loop_corpo"] ?? 0) + d; }
            t0 = performance.now();
            if (!naoBranco) posicaoValida = false;
            cx_km = pxToKm(px);
            cy_km = pxToKm(py);
            { const d = performance.now() - t0; if (perfLog) reproDescMapa_fim += d; if (perfAcc) perfAcc["      desc_mapa_fim"] = (perfAcc["      desc_mapa_fim"] ?? 0) + d; }
            { const d = performance.now() - tInner; if (perfLog) reproDescMapa += d; if (perfAcc) perfAcc["    desc_mapa_loop"] = (perfAcc["    desc_mapa_loop"] ?? 0) + d; }
          } else {
            while (!pixelNaoBranco(px, py) && tentativas < maxTentativas) {
              ({ dx_px, dy_px } = sampleDeslocamentoPx(raioPx));
              px = (clamp(0, parent_px + dx_px, REGIAO_SIZE) | 0);
              py = (clamp(0, parent_py + dy_px, REGIAO_SIZE) | 0);
              tentativas++;
            }
            if (!pixelNaoBranco(px, py)) posicaoValida = false;
            cx_km = pxToKm(px);
            cy_km = pxToKm(py);
          }
        }
        return { px, py, cx_km, cy_km, posicaoValida };
      };
      { const d = performance.now() - tSetup; if (perfLog) reproDescSetup += d; if (perfAcc) perfAcc["    desc_setup"] = (perfAcc["    desc_setup"] ?? 0) + d; }

      if (numFeminino > 0) {
        const { px, py, cx_km, cy_km, posicaoValida } = amostrarPosicao();
        let tInner = perfLog || perfAcc ? performance.now() : 0;
        const xNasc = posicaoValida ? cx_km : ind.x;
        const yNasc = posicaoValida ? cy_km : ind.y;
        const corNascRaw =
          mapa?.indiceGrid && mapa.indiceGrid.length === GRID_SIZE
            ? Math.min(7, Math.max(0, mapa.indiceGrid[(py | 0) * REGIAO_SIZE + (px | 0)] ?? mapa.indiceBranco ?? 0))
            : (mapa?.getIndiceAt(px, py) ?? 0);
        const corNasc = (params.fator_continental_habilitado ?? 1) === 1 ? corNascRaw : 0;
        const descendente: GenesisIndividual = {
          ...ind,
          id: nextId++,
          idade: 0,
          genero: 0,
          geracao: ind.geracao + 1,
          x: xNasc,
          y: yNasc,
          dispersao: ind.dispersao,
          dispersao_regiao: ind.dispersao_regiao,
          decendentes: 0,
          qtde: numFeminino,
          morte: 0,
          plotValido: posicaoValida ? 1 : 0,
          cor: corNasc,
          direcao: sorteiaDirecao(qtdeDirecoesPasso),
        };
        vetor1AposVelhice.push(descendente);
        { const d = performance.now() - tInner; if (perfLog) reproDescCriarPush += d; if (perfAcc) perfAcc["    desc_criar_push"] = (perfAcc["    desc_criar_push"] ?? 0) + d; }
      }
      if (numMasculino > 0) {
        const { px, py, cx_km, cy_km, posicaoValida } = amostrarPosicao();
        let tInner = perfLog || perfAcc ? performance.now() : 0;
        const xNasc = posicaoValida ? cx_km : ind.x;
        const yNasc = posicaoValida ? cy_km : ind.y;
        const corNascRaw =
          mapa?.indiceGrid && mapa.indiceGrid.length === GRID_SIZE
            ? Math.min(7, Math.max(0, mapa.indiceGrid[(py | 0) * REGIAO_SIZE + (px | 0)] ?? mapa.indiceBranco ?? 0))
            : (mapa?.getIndiceAt(px, py) ?? 0);
        const corNasc = (params.fator_continental_habilitado ?? 1) === 1 ? corNascRaw : 0;
        const descendente: GenesisIndividual = {
          ...ind,
          id: nextId++,
          idade: 0,
          genero: 1,
          geracao: ind.geracao + 1,
          x: xNasc,
          y: yNasc,
          dispersao: ind.dispersao,
          dispersao_regiao: ind.dispersao_regiao,
          decendentes: 0,
          qtde: numMasculino,
          morte: 0,
          plotValido: posicaoValida ? 1 : 0,
          cor: corNasc,
          direcao: sorteiaDirecao(qtdeDirecoesPasso),
        };
        vetor2AposVelhice.push(descendente);
        { const d = performance.now() - tInner; if (perfLog) reproDescCriarPush += d; if (perfAcc) perfAcc["    desc_criar_push"] = (perfAcc["    desc_criar_push"] ?? 0) + d; }
      }
      { const d = performance.now() - t; if (perfLog) reproMsDescendentes += d; if (perfAcc) perfAcc["  repro_descendentes"] = (perfAcc["  repro_descendentes"] ?? 0) + d; }
    }
  }

  const tV2 = perfLog || perfAcc ? performance.now() : 0;
  for (let i = 0; i < vetor2AposVelhice.length; i++) {
    resultadoPorId[vetor2AposVelhice[i]!.id] = RESULTADO_ZERO;
  }
  if (perfLog || perfAcc) { const d = performance.now() - tV2; if (perfLog) reproVetor2Resultado += d; if (perfAcc) perfAcc["  repro_vetor2_resultado"] = (perfAcc["  repro_vetor2_resultado"] ?? 0) + d; }
  addPerf("reproducao", performance.now() - t0Repro);
  // Sub-fases já acumuladas em perfAcc no loop; só escrever via addPerf quando não há acumulador (evita duplicar última iteração)
  if (!perfAcc && (reproMsProb > 0 || reproMsGrupos > 0 || reproMsIndividuos > 0 || reproMsDebug > 0 || reproMsDescendentes > 0 || reproVetor2Resultado > 0)) {
    addPerf("  repro_prob", reproMsProb);
    addPerf("  repro_grupos", reproMsGrupos);
    if (reproMsGrupos > 0 && (reproGruposMedia > 0 || reproGruposQtdeGenero > 0 || reproGruposArray > 0 || reproGruposOutros > 0)) {
      addPerf("    repro_grupos_media", reproGruposMedia);
      addPerf("    repro_grupos_qtde_genero", reproGruposQtdeGenero);
      addPerf("    repro_grupos_array", reproGruposArray);
      addPerf("    repro_grupos_outros", reproGruposOutros);
    }
    addPerf("  repro_individuos", reproMsIndividuos);
    if (reproMsIndividuos > 0 && (reproIndPoisson > 0 || reproIndGeneros > 0 || reproIndOutros > 0)) {
      addPerf("    repro_ind_poisson", reproIndPoisson);
      addPerf("    repro_ind_generos", reproIndGeneros);
      addPerf("    repro_ind_outros", reproIndOutros);
    }
    addPerf("  repro_debug", reproMsDebug);
    addPerf("  repro_descendentes", reproMsDescendentes);
    if (reproMsDescendentes > 0 && (reproDescSetup > 0 || reproDescDeslocamento > 0 || reproDescMapa > 0 || reproDescCriarPush > 0)) {
      addPerf("    desc_setup", reproDescSetup);
      addPerf("    desc_deslocamento", reproDescDeslocamento);
      addPerf("    desc_mapa_loop", reproDescMapa);
      if (reproDescMapa > 0 && (reproDescMapa_kmToPx > 0 || reproDescMapa_init > 0 || reproDescMapa_isBlack > 0 || reproDescMapa_loopCorpo > 0 || reproDescMapa_fim > 0)) {
        addPerf("      desc_mapa_kmToPx", reproDescMapa_kmToPx);
        addPerf("      desc_mapa_init", reproDescMapa_init);
        addPerf("      desc_mapa_isBlack", reproDescMapa_isBlack);
        addPerf("      desc_mapa_loop_corpo", reproDescMapa_loopCorpo);
        addPerf("      desc_mapa_fim", reproDescMapa_fim);
      }
      addPerf("    desc_criar_push", reproDescCriarPush);
    }
    addPerf("  repro_vetor2_resultado", reproVetor2Resultado);
  }
  logQtde("após reprodução (antes dispersão)", vetor1AposVelhice, vetor2AposVelhice, undefined, debugContext?.qtdeLog);

  const t0Dispersao = performance.now();
  const dispersaoAnualKm = Math.max(0, params.dispersao_anual_media ?? 50);
  const vetor1ComDispersao: GenesisIndividual[] = [];
  let tDispV1 = 0;
  let tDispV2 = 0;
  if (perfAcc) tDispV1 = performance.now();
  for (let i = 0; i < vetor1AposVelhice.length; i++) {
    vetor1ComDispersao.push(atualizarDispersaoAnual(vetor1AposVelhice[i]!, dispersaoAnualKm));
  }
  if (perfAcc) {
    const d1 = performance.now() - tDispV1;
    perfAcc["  dispersao_v1"] = (perfAcc["  dispersao_v1"] ?? 0) + d1;
    tDispV2 = performance.now();
  }
  const vetor2ComDispersao: GenesisIndividual[] = [];
  for (let i = 0; i < vetor2AposVelhice.length; i++) {
    vetor2ComDispersao.push(atualizarDispersaoAnual(vetor2AposVelhice[i]!, dispersaoAnualKm));
  }
  if (perfAcc) {
    const d2 = performance.now() - tDispV2;
    perfAcc["  dispersao_v2"] = (perfAcc["  dispersao_v2"] ?? 0) + d2;
  }
  addPerf("dispersao", performance.now() - t0Dispersao);
  logQtde("após dispersão (antes reagrupar)", vetor1ComDispersao, vetor2ComDispersao, undefined, debugContext?.qtdeLog);

  const ind1AposDispersaoPasso = vetor1ComDispersao.find((ind) => ind.id === 1);
  if (ind1AposDispersaoPasso == null) {
    logGenesisDebug(1, "[DEBUG id=1 runUmPasso] id=1 não encontrado após dispersão (vetor pode ter sido agregado).", undefined, debugContext);
  } else {
    logGenesisDebug(1, "[DEBUG id=1 runUmPasso] Após atualização de dispersão:", {
      id: ind1AposDispersaoPasso.id,
      dispersao: ind1AposDispersaoPasso.dispersao,
      dispersao_regiao: ind1AposDispersaoPasso.dispersao_regiao,
      regiao: ind1AposDispersaoPasso.regiao,
      idade: ind1AposDispersaoPasso.idade,
      qtde: ind1AposDispersaoPasso.qtde,
      cor: ind1AposDispersaoPasso.cor,
    }, debugContext);
  }

  let grupoAposDispersao: GenesisIndividual | null = null;
  if (minGrupoId !== Infinity) {
    for (let i = 0; i < vetor1ComDispersao.length; i++) {
      const ind = vetor1ComDispersao[i]!;
      if (ind.qtde > 1 && ind.genero === 0 && ind.id === minGrupoId) {
        grupoAposDispersao = ind;
        break;
      }
    }
    if (grupoAposDispersao === null) {
      for (let i = 0; i < vetor2ComDispersao.length; i++) {
        const ind = vetor2ComDispersao[i]!;
        if (ind.qtde > 1 && ind.genero === 0 && ind.id === minGrupoId) {
          grupoAposDispersao = ind;
          break;
        }
      }
    }
  }
  if (grupoAposDispersao && debugContext?.groupLog) {
    logGenesisGrupoDebug("[DEBUG grupo (menor id) runUmPasso] Após atualização de dispersão:", {
      id: grupoAposDispersao.id,
      dispersao: grupoAposDispersao.dispersao,
      dispersao_regiao: grupoAposDispersao.dispersao_regiao,
      regiao: grupoAposDispersao.regiao,
      idade: grupoAposDispersao.idade,
      qtde: grupoAposDispersao.qtde,
      cor: grupoAposDispersao.cor,
    }, debugContext);
  }
  
  const minFormGrupoReagrupar = clamp(50, params.min_form_grupo ?? 50, 100);
  const t0Reagrupar = performance.now();
  const resultadoReagrupamento = reagruparVetores(vetor1ComDispersao, vetor2ComDispersao, minFormGrupoReagrupar, debugContext?.qtdeLog, perfAcc);
  addPerf("reagrupar", performance.now() - t0Reagrupar);
  logQtde("após reagrupar (saída runUmPasso)", resultadoReagrupamento.vetor1, resultadoReagrupamento.vetor2, undefined, debugContext?.qtdeLog);

  return { vetor1: resultadoReagrupamento.vetor1, vetor2: resultadoReagrupamento.vetor2, especie: especieAtual, resultadoPorId };
}

export type EstadoSimulacao = {
  vetor1: GenesisIndividual[];
  vetor2: GenesisIndividual[];
  especie: EspecieParams;
  /** Mortes acumuladas desde o início da simulação (soma das mortes anuais de cada iteração). */
  mortesAcumuladas?: number;
};

function sumMortes(vetor1: GenesisIndividual[], vetor2: GenesisIndividual[]): number {
  let s = 0;
  for (let i = 0; i < vetor1.length; i++) s += vetor1[i]!.morte ?? 0;
  for (let i = 0; i < vetor2.length; i++) s += vetor2[i]!.morte ?? 0;
  return s;
}

/**
 * Executa N iterações da simulação sem atualizar UI entre passos.
 * Se state é null: executa 1 genesis + (N-1) passos, retorna iteracao = N.
 * Se state existe: executa N passos a partir do state, retorna iteracao = currentIteration + N.
 */
/** Callback opcional: chamado após cada iteração com (iteracao, { vetor1, vetor2, resultadoPorId }) para acumular mapDisplayByYear. */
export type OnEachIterationCallback = (
  iteracao: number,
  r: { vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; resultadoPorId: ResultadoReproducaoPorId }
) => void;

export function runSimulacaoN(
  state: EstadoSimulacao | null,
  params: Record<string, number>,
  N: number,
  mapa: MapaAreasPretas | undefined,
  currentIteration: number,
  debugContext?: DebugGenesisContext | null,
  origensAgendadas?: OrigemAgendada[],
  onEachIteration?: OnEachIterationCallback
): { vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; especie: EspecieParams; resultadoPorId: ResultadoReproducaoPorId; iteracao: number; periodo: number; mortesAcumuladas: number } {
  const periodoI1 = params.periodo_i1 ?? -100;
  const iteracaoMaxima = getIteracaoMaxima(params);
  const stepsRemaining = state === null ? iteracaoMaxima + 1 : Math.max(0, iteracaoMaxima - currentIteration);
  const Nclamped = Math.min(N, stepsRemaining);
  let mortesAcumuladas = state?.mortesAcumuladas ?? 0;

  const genesisParams: RunGerarGenesisParams = {
    max_idade: params.max_idade ?? 100,
    periodo_simulado: params.periodo_simulado ?? 0,
    idade_fertil_min: params.idade_fertil_min ?? 22,
    idade_fertil_max: params.idade_fertil_max ?? 50,
    idade_fertil_pico: params.idade_fertil_pico ?? 25,
    tx_decaimento_pos_pico: params.tx_decaimento_pos_pico ?? 0.25,
    prob_anual_reproducao: params.prob_anual_reproducao ?? 90,
    dispersao_anual_media: params.dispersao_anual_media ?? 50,
    fecundidade_max_parto: clamp(1, params.fecundidade_max_parto ?? 3, 100),
    tx_mortalidade_inicial_1: params.tx_mortalidade_inicial_1 ?? 1,
    reducao_crescimento_habilitada: params.reducao_crescimento_habilitada ?? 0,
    periodo_i1: params.periodo_i1 ?? -100,
    periodo_f1: params.periodo_f1 ?? 2026,
    tx_mortalidade_final_1: params.tx_mortalidade_final_1 ?? 0.5,
    min_form_grupo: clamp(50, params.min_form_grupo ?? 50, 100),
    x0: params.x0,
    y0: params.y0,
    x0_v2: params.x0_v2,
    y0_v2: params.y0_v2,
  };

  let result: { vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; especie: EspecieParams; resultadoPorId: ResultadoReproducaoPorId };
  let iteracao: number;

  if (state !== null && Nclamped === 0) {
    const periodo = periodoI1 + currentIteration;
    return { vetor1: state.vetor1, vetor2: state.vetor2, especie: state.especie, resultadoPorId: {}, iteracao: currentIteration, periodo, mortesAcumuladas };
  }

  const t0RunSimN = performance.now();

  function totalIndividuos(v1: GenesisIndividual[], v2: GenesisIndividual[]): number {
    return sumQtde(v1) + sumQtde(v2);
  }

  // Acumular tempo por fase em TODAS as iterações (não só na última) para "Soma fases" cobrir 100% do servidor
  const perfAcc: Record<string, number> = {};
  const ctxPerfAcc: DebugGenesisContext | undefined =
    debugContext?.performanceLog != null
      ? { debugGenesisId: 0, log: [], performanceLogAcc: perfAcc }
      : undefined;
  if (debugContext?.performanceLog) debugContext.performanceLogAcc = perfAcc;

  // Estatísticas e logs (logQtde, debugLog, etc.) só são calculados no último i
  if (state === null) {
    result = runGerarGenesis(genesisParams, mapa, Nclamped === 1 ? debugContext : undefined, origensAgendadas);
    iteracao = 0; // iteração 0 = apenas inicialização (genesis)
    // Executar Nclamped passos (i=1..Nclamped) para terminar em iteracao = Nclamped
    for (let i = 1; i <= Nclamped; i++) {
      if (totalIndividuos(result.vetor1, result.vetor2) >= LIMITE_POPULACAO) break;
      const isLast = i === Nclamped;
      const periodo = periodoI1 + i;
      const ctx = isLast ? debugContext : ctxPerfAcc;
      result = runUmPasso(result.vetor1, result.vetor2, result.especie, params, mapa, ctx ?? undefined, periodo, origensAgendadas);
      mortesAcumuladas += sumMortes(result.vetor1, result.vetor2);
      iteracao = i;
      if (onEachIteration) {
        const t0 = debugContext?.performanceLogAcc ? performance.now() : 0;
        onEachIteration(iteracao, { vetor1: result.vetor1, vetor2: result.vetor2, resultadoPorId: result.resultadoPorId });
        if (debugContext?.performanceLogAcc && t0 > 0) {
          debugContext.performanceLogAcc["mapDisplayByYear"] = (debugContext.performanceLogAcc["mapDisplayByYear"] ?? 0) + (performance.now() - t0);
        }
      }
    }
  } else {
    const periodoPrimeiro = periodoI1 + (currentIteration + 1);
    result = runUmPasso(state.vetor1, state.vetor2, state.especie, params, mapa, Nclamped === 1 ? debugContext : ctxPerfAcc ?? undefined, periodoPrimeiro, origensAgendadas);
    mortesAcumuladas += sumMortes(result.vetor1, result.vetor2);
    iteracao = currentIteration + 1;
    if (onEachIteration) {
      const t0 = debugContext?.performanceLogAcc ? performance.now() : 0;
      onEachIteration(iteracao, { vetor1: result.vetor1, vetor2: result.vetor2, resultadoPorId: result.resultadoPorId });
      if (debugContext?.performanceLogAcc && t0 > 0) {
        debugContext.performanceLogAcc["mapDisplayByYear"] = (debugContext.performanceLogAcc["mapDisplayByYear"] ?? 0) + (performance.now() - t0);
      }
    }
    for (let i = 1; i < Nclamped; i++) {
      if (totalIndividuos(result.vetor1, result.vetor2) >= LIMITE_POPULACAO) break;
      const isLast = i === Nclamped - 1;
      const periodo = periodoI1 + (currentIteration + 1 + i);
      const ctx = isLast ? debugContext : ctxPerfAcc;
      result = runUmPasso(result.vetor1, result.vetor2, result.especie, params, mapa, ctx ?? undefined, periodo, origensAgendadas);
      mortesAcumuladas += sumMortes(result.vetor1, result.vetor2);
      iteracao++;
      if (onEachIteration) {
        const t0 = debugContext?.performanceLogAcc ? performance.now() : 0;
        onEachIteration(iteracao, { vetor1: result.vetor1, vetor2: result.vetor2, resultadoPorId: result.resultadoPorId });
        if (debugContext?.performanceLogAcc && t0 > 0) {
          debugContext.performanceLogAcc["mapDisplayByYear"] = (debugContext.performanceLogAcc["mapDisplayByYear"] ?? 0) + (performance.now() - t0);
        }
      }
    }
  }

  // Preencher performanceLog com totais acumulados (do início ao fim) para o cliente
  if (debugContext?.performanceLog && Object.keys(perfAcc).length > 0) {
    // Forçar subfases "outros/rest" para que a soma dos filhos bata com o total do pai
    const reproGruposTotal = perfAcc["  repro_grupos"] ?? 0;
    const reproGruposSum =
      (perfAcc["    repro_grupos_media"] ?? 0) +
      (perfAcc["    repro_grupos_qtde_genero"] ?? 0) +
      (perfAcc["    repro_grupos_array"] ?? 0);
    perfAcc["    repro_grupos_outros"] = Math.max(0, reproGruposTotal - reproGruposSum);

    const reproIndTotal = perfAcc["  repro_individuos"] ?? 0;
    const reproIndSum = (perfAcc["    repro_ind_poisson"] ?? 0) + (perfAcc["    repro_ind_generos"] ?? 0);
    perfAcc["    repro_ind_outros"] = Math.max(0, reproIndTotal - reproIndSum);

    const descMapaTotal = perfAcc["    desc_mapa_loop"] ?? 0;
    const descMapaSum =
      (perfAcc["      desc_mapa_init"] ?? 0) +
      (perfAcc["      desc_mapa_isBlack"] ?? 0) +
      (perfAcc["      desc_mapa_loop_corpo"] ?? 0) +
      (perfAcc["      desc_mapa_fim"] ?? 0);
    perfAcc["      desc_mapa_rest"] = Math.max(0, descMapaTotal - descMapaSum);

    const reproDescTotal = perfAcc["  repro_descendentes"] ?? 0;
    const reproDescSum =
      (perfAcc["    desc_setup"] ?? 0) +
      (perfAcc["    desc_deslocamento"] ?? 0) +
      (perfAcc["    desc_mapa_loop"] ?? 0) +
      (perfAcc["    desc_criar_push"] ?? 0);
    perfAcc["    desc_rest"] = Math.max(0, reproDescTotal - reproDescSum);

    const reproTotal = perfAcc["reproducao"] ?? 0;
    const reproSum =
      (perfAcc["  repro_loop_inicio"] ?? 0) +
      (perfAcc["  repro_prob"] ?? 0) +
      (perfAcc["  repro_grupos"] ?? 0) +
      (perfAcc["  repro_individuos"] ?? 0) +
      (perfAcc["  repro_debug"] ?? 0) +
      (perfAcc["  repro_resultado_por_id"] ?? 0) +
      (perfAcc["  repro_descendentes"] ?? 0) +
      (perfAcc["  repro_vetor2_resultado"] ?? 0);
    perfAcc["  repro_outros"] = Math.max(0, reproTotal - reproSum);

    const totalRunSimN = performance.now() - t0RunSimN;
    const topLevelPhases = [
      "aplicar_mortes", "incremento_idade", "mortalidade_velhice", "reproducao",
      "dispersao", "reagrupar",
    ] as const;
    let sumTopLevel = 0;
    for (const p of topLevelPhases) sumTopLevel += perfAcc[p] ?? 0;
    const mapDisplayMs = perfAcc["mapDisplayByYear"] ?? 0;
    const outrosMs = Math.max(0, totalRunSimN - sumTopLevel - mapDisplayMs);
    perfAcc["outros (loop + instrumentação)"] = outrosMs;

    const reagruparTotal = perfAcc["reagrupar"] ?? 0;
    const reagruparSum =
      (perfAcc["  reagrupar_map"] ?? 0) +
      (perfAcc["  reagrupar_agregar"] ?? 0) +
      (perfAcc["  reagrupar_split"] ?? 0);
    perfAcc["  reagrupar_rest"] = Math.max(0, reagruparTotal - reagruparSum);

    const order = [
      "aplicar_mortes", "incremento_idade", "mortalidade_velhice", "  mort_velhice_v1", "  mort_velhice_v2", "reproducao",
      "  repro_loop_inicio", "  repro_prob", "  repro_grupos", "    repro_grupos_media", "    repro_grupos_qtde_genero", "    repro_grupos_array", "    repro_grupos_outros",
      "  repro_individuos", "    repro_ind_poisson", "    repro_ind_generos", "    repro_ind_outros",
      "  repro_debug", "  repro_resultado_por_id", "  repro_descendentes",
      "    desc_setup", "    desc_deslocamento", "    desc_mapa_loop", "      desc_mapa_kmToPx", "      desc_mapa_init", "      desc_mapa_isBlack", "      desc_mapa_loop_corpo", "      desc_mapa_fim", "      desc_mapa_rest",
      "    desc_criar_push", "    desc_rest",
      "  repro_vetor2_resultado",
      "  repro_outros",
      "dispersao", "  dispersao_v1", "  dispersao_v2",
      "reagrupar", "  reagrupar_map", "  reagrupar_agregar", "  reagrupar_split", "  reagrupar_rest",
      "mapDisplayByYear",
      "outros (loop + instrumentação)",
    ];
    debugContext.performanceLog.length = 0;
    for (const phase of order) {
      const ms = perfAcc[phase];
      if (ms != null && ms > 0) debugContext.performanceLog.push({ phase, ms });
    }
  }

  const periodo = periodoI1 + iteracao;
  const mortesAntes = state?.mortesAcumuladas ?? 0;
  if (DEBUG_LOGS && typeof process !== "undefined") {
    const origem = state === null ? "genesis" : `iter ${currentIteration}`;
    console.log(
      `[runSimulacaoN] N=${N} Nclamped=${Nclamped} origem=${origem} → iteracao=${iteracao} mortesAntes=${mortesAntes} mortesAcumuladas=${mortesAcumuladas}`
    );
  }
  if (mortesAcumuladas < mortesAntes) {
    console.error(
      `[runSimulacaoN] BUG: mortesAcumuladas regrediu ${mortesAntes} → ${mortesAcumuladas} (iteracao=${iteracao}). Corrija a origem.`
    );
  }
  return { ...result, iteracao, periodo, mortesAcumuladas };
}
