import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getBalance, spendCoins } from "@/lib/spend-coins";
import {
  runGerarGenesis,
  runUmPasso,
  runSimulacaoN,
  getIteracaoMaxima,
  REGIAO_SIZE,
  LIMITE_POPULACAO,
  type MapaAreasPretas,
  type GenesisIndividual,
  type EspecieParams,
  type ResultadoReproducaoPorId,
  type OrigemAgendada,
} from "@/app/lib/simulacao-genesis";

// mapDisplayByYear: { "1": [births, deaths, groups, uniques, population], "2": [...], ... }
// Índices: 0=births, 1=deaths, 2=groups, 3=uniques, 4=population
type MapDisplayYearRow = [number, number, number, number, number];

function computeMapDisplayYearEntry(
  vetor1: GenesisIndividual[],
  vetor2: GenesisIndividual[],
  resultadoPorId: ResultadoReproducaoPorId
): MapDisplayYearRow {
  const todos = [...vetor1, ...vetor2];
  let population = 0;
  let deaths = 0;
  let groups = 0;
  let uniques = 0;
  for (let i = 0; i < todos.length; i++) {
    const q = todos[i]!.qtde ?? 0;
    population += q;
    deaths += todos[i]!.morte ?? 0;
    if (q > 1) groups++;
    else if (q === 1) uniques++;
  }
  let births = 0;
  for (const v of Object.values(resultadoPorId)) births += v?.decendentes ?? 0;
  return [births, deaths, groups, uniques, population];
}

const GRID_SIZE = REGIAO_SIZE * REGIAO_SIZE;

function buildMapaFromNotWhitePixels(
  notWhitePixels: [number, number][],
  indiceGrid?: number[],
  indiceBranco?: number
): MapaAreasPretas | undefined {
  if (!notWhitePixels?.length) return undefined;
  const grid = new Uint8Array(GRID_SIZE);
  const whiteIdx = indiceBranco ?? 1;
  for (const [x, y] of notWhitePixels) {
    const idx = (y | 0) * REGIAO_SIZE + (x | 0);
    if (idx >= 0 && idx < GRID_SIZE) grid[idx] = 1;
  }
  const getIndiceAt = (x: number, y: number): number => {
    const px = Math.round(x) | 0;
    const py = Math.round(y) | 0;
    const idx = py * REGIAO_SIZE + px;
    if (idx < 0 || idx >= GRID_SIZE) return Math.min(7, Math.max(0, whiteIdx));
    let raw: number;
    if (indiceGrid && indiceGrid.length === GRID_SIZE) raw = indiceGrid[idx] ?? whiteIdx;
    else raw = grid[idx] === 1 ? 0 : whiteIdx;
    return Math.min(7, Math.max(0, raw));
  };
  return {
    notWhitePixels,
    isBlack(x: number, y: number) {
      const px = Math.round(x) | 0;
      const py = Math.round(y) | 0;
      const idx = py * REGIAO_SIZE + px;
      return idx >= 0 && idx < GRID_SIZE && grid[idx] === 1;
    },
    sorteiaPosicaoPreta() {
      const [x, y] = notWhitePixels[Math.floor(Math.random() * notWhitePixels.length)]!;
      return { x, y };
    },
    pixelPretoMaisProximo(x0: number, y0: number) {
      if (notWhitePixels.length === 0) return { x: x0, y: y0 };
      let best = notWhitePixels[0]!;
      let bestD2 = (best[0] - x0) ** 2 + (best[1] - y0) ** 2;
      for (let i = 1; i < notWhitePixels.length; i++) {
        const [x, y] = notWhitePixels[i]!;
        const d2 = (x - x0) ** 2 + (y - y0) ** 2;
        if (d2 < bestD2) {
          best = [x, y];
          bestD2 = d2;
        }
      }
      return { x: best[0], y: best[1] };
    },
    getIndiceAt,
    indiceBranco: indiceBranco ?? whiteIdx,
    ...(indiceGrid && indiceGrid.length === GRID_SIZE && { indiceGrid }),
  };
}

type Body = {
  mode: "one" | "n";
  params: Record<string, number>;
  state?: { vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; especie: EspecieParams; mortesAcumuladas?: number };
  N?: number;
  currentIteration?: number;
  notWhitePixels?: [number, number][];
  indiceGrid?: number[];
  indiceBranco?: number;
  debugGenesisId?: number | null;
  debugGenesisGrupo?: boolean;
  debugQtde?: boolean;
  debugPerformance?: boolean;
  origensAgendadas?: OrigemAgendada[];
};

type DebugContext = {
  debugGenesisId: number;
  log: { msg: string; data?: unknown }[];
  groupLog?: { msg: string; data?: unknown }[];
  qtdeLog?: { etapa: string; total: number; nVetor1: number; nVetor2: number; sumV1: number; sumV2: number; extra?: Record<string, number> }[];
  performanceLog?: { phase: string; ms: number }[];
};

/** Soma qtde de vetor1 + vetor2. Usado para decisões de parada e, no genesis, para cobrar 1 coin só se houve população resultante. */
function totalPopulation(vetor1: { qtde: number }[], vetor2: { qtde: number }[]): number {
  return (vetor1?.reduce((s, i) => s + (i?.qtde ?? 0), 0) ?? 0) + (vetor2?.reduce((s, i) => s + (i?.qtde ?? 0), 0) ?? 0);
}

/** Resultado de executeSimulationOne (1 iteração ou genesis). Usado pela fila para devolver ao cliente. */
type SimulationOneResult = {
  vetor1: GenesisIndividual[];
  vetor2: GenesisIndividual[];
  especie: EspecieParams;
  resultadoPorId: ResultadoReproducaoPorId;
  iteracao: number;
  periodo: number;
  mortesAcumuladas: number;
};

/** Executa simulação em modo "one" (1 iteração ou genesis). Usado pelo run POST e pelo processador da fila (fila_1x). */
function executeSimulationOne(body: Body, _debugContext?: DebugContext | null): SimulationOneResult {
  const { params, state, currentIteration, notWhitePixels, indiceGrid, indiceBranco, origensAgendadas } = body;
  const mapa = buildMapaFromNotWhitePixels(notWhitePixels ?? [], indiceGrid, indiceBranco);
  const periodoGenesis = params.periodo_i1 ?? -100;

  if (state == null) {
    const result = runGerarGenesis(
      {
        max_idade: params.max_idade ?? 100,
        periodo_simulado: params.periodo_simulado ?? 0,
        idade_fertil_min: params.idade_fertil_min ?? 1,
        idade_fertil_max: params.idade_fertil_max ?? 50,
        idade_fertil_pico: params.idade_fertil_pico ?? 25,
        tx_decaimento_pos_pico: params.tx_decaimento_pos_pico ?? 0.25,
        fecundidade_media_parto: params.fecundidade_media_parto ?? 1.05,
        prob_anual_reproducao: params.prob_anual_reproducao ?? 90,
        dispersao_anual_media: params.dispersao_anual_media ?? 2,
        fecundidade_max_parto: params.fecundidade_max_parto ?? 3,
        tx_mortalidade_inicial_1: params.tx_exp_inicial_grupo_1 ?? params.tx_mortalidade_inicial_1 ?? 5,
        reducao_crescimento_habilitada: params.reducao_crescimento_habilitada ?? 0,
        periodo_i1: params.periodo_i1 ?? -100,
        periodo_f1: params.periodo_f1 ?? 2026,
        tx_mortalidade_final_1: params.tx_exp_final_grupo_mod_1 ?? params.tx_mortalidade_final_1 ?? 2.5,
        tx_exp_inicial_grupo_1: params.tx_exp_inicial_grupo_1 ?? 5,
        per_de_mod_da_tx_exp_i1: params.per_de_mod_da_tx_exp_i1 ?? 2,
        per_de_mod_da_tx_exp_f1: params.per_de_mod_da_tx_exp_f1 ?? 100,
        tx_exp_final_grupo_mod_1: params.tx_exp_final_grupo_mod_1 ?? 2.5,
        min_form_grupo: params.min_form_grupo ?? 50,
        x0: params.x0,
        y0: params.y0,
        x0_v2: params.x0_v2,
        y0_v2: params.y0_v2,
        fator_continental_habilitado: params.fator_continental_habilitado ?? 1,
        qtde_direcoes: params.qtde_direcoes ?? 4,
      },
      mapa,
      undefined,
      origensAgendadas
    );
    return {
      vetor1: result.vetor1,
      vetor2: result.vetor2,
      especie: result.especie,
      resultadoPorId: result.resultadoPorId ?? {},
      iteracao: 0,
      periodo: periodoGenesis,
      mortesAcumuladas: 0,
    };
  }

  const iterAtual = currentIteration ?? 0;
  const iteracaoMaxima = getIteracaoMaxima(params);
  const totalIndividuos = state.vetor1.reduce((s, i) => s + i.qtde, 0) + state.vetor2.reduce((s, i) => s + i.qtde, 0);
  const populacaoZero = totalIndividuos === 0;
  const populacaoMaximaAtingida = totalIndividuos >= LIMITE_POPULACAO;
  const periodoOne = (params.periodo_i1 ?? -100) + iterAtual;

  if (populacaoMaximaAtingida || iterAtual >= iteracaoMaxima || populacaoZero) {
    return {
      vetor1: state.vetor1,
      vetor2: state.vetor2,
      especie: state.especie,
      resultadoPorId: {},
      iteracao: iterAtual,
      periodo: periodoOne,
      mortesAcumuladas: state.mortesAcumuladas ?? 0,
    };
  }

  const iteracaoOne = iterAtual + 1;
  const periodoOneStep = (params.periodo_i1 ?? -100) + iteracaoOne;
  const result = runUmPasso(state.vetor1, state.vetor2, state.especie, params, mapa, undefined, periodoOneStep, origensAgendadas);
  const mortesEstePasso = result.vetor1.reduce((s, i) => s + (i.morte ?? 0), 0) + result.vetor2.reduce((s, i) => s + (i.morte ?? 0), 0);
  const mortesAcumuladas = (state.mortesAcumuladas ?? 0) + mortesEstePasso;
  return {
    vetor1: result.vetor1,
    vetor2: result.vetor2,
    especie: result.especie,
    resultadoPorId: result.resultadoPorId,
    iteracao: iteracaoOne,
    periodo: periodoOneStep,
    mortesAcumuladas,
  };
}

/** Executa simulação em modo "n" (batch). Usado pelo run POST e pelo processador da fila. */
function executeSimulationN(
  body: Body,
  debugContext?: DebugContext | null
): {
  vetor1: GenesisIndividual[];
  vetor2: GenesisIndividual[];
  especie: EspecieParams;
  resultadoPorId: ResultadoReproducaoPorId;
  iteracao: number;
  periodo: number;
  mortesAcumuladas: number;
  serverDurationMs: number;
  populacaoZero?: boolean;
  populacaoMaximaAtingida?: boolean;
  limiteAtingido?: boolean;
  debugLog?: { msg: string; data?: unknown }[];
  debugLogGrupo?: { msg: string; data?: unknown }[];
  debugLogQtde?: { etapa: string; total: number; nVetor1: number; nVetor2: number; sumV1: number; sumV2: number; extra?: Record<string, number> }[];
  performanceLog?: { phase: string; ms: number }[];
} {
  const { params, state, N, currentIteration, notWhitePixels, indiceGrid, indiceBranco, origensAgendadas } = body;
  const mapa = buildMapaFromNotWhitePixels(notWhitePixels ?? [], indiceGrid, indiceBranco);
  const stateOrNull = state ?? null;
  const iter = currentIteration ?? 0;
  const inicioServidor = performance.now();

  const populacaoZero =
    stateOrNull !== null
      ? stateOrNull.vetor1.reduce((s, i) => s + i.qtde, 0) + stateOrNull.vetor2.reduce((s, i) => s + i.qtde, 0) === 0
      : false;
  if (populacaoZero && stateOrNull !== null) {
    const periodoN = (params.periodo_i1 ?? -100) + iter;
    return {
      vetor1: stateOrNull.vetor1,
      vetor2: stateOrNull.vetor2,
      especie: stateOrNull.especie,
      resultadoPorId: {},
      iteracao: iter,
      periodo: periodoN,
      mortesAcumuladas: stateOrNull.mortesAcumuladas ?? 0,
      serverDurationMs: performance.now() - inicioServidor,
      populacaoZero: true,
      ...(debugContext && { debugLog: debugContext.log }),
      ...(debugContext?.groupLog && { debugLogGrupo: debugContext.groupLog }),
      ...(debugContext?.qtdeLog && debugContext.qtdeLog.length > 0 && { debugLogQtde: debugContext.qtdeLog }),
      ...(debugContext?.performanceLog && debugContext.performanceLog.length > 0 && { performanceLog: debugContext.performanceLog }),
    };
  }

  const mapDisplayByYear: Record<string, MapDisplayYearRow> = {};
  const onEachIteration =
    N! >= 2
      ? (iteracao: number, r: { vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; resultadoPorId: ResultadoReproducaoPorId }) => {
          mapDisplayByYear[String(iteracao)] = computeMapDisplayYearEntry(r.vetor1, r.vetor2, r.resultadoPorId);
        }
      : undefined;

  const { vetor1, vetor2, especie, resultadoPorId, iteracao, periodo, mortesAcumuladas } = runSimulacaoN(
    stateOrNull,
    params,
    N!,
    mapa,
    iter,
    debugContext ?? undefined,
    origensAgendadas,
    onEachIteration
  );
  const serverDurationMs = performance.now() - inicioServidor;
  const totalAposN = vetor1.reduce((s, i) => s + i.qtde, 0) + vetor2.reduce((s, i) => s + i.qtde, 0);
  return {
    vetor1,
    vetor2,
    especie,
    resultadoPorId,
    iteracao,
    periodo,
    mortesAcumuladas,
    serverDurationMs,
    ...(Object.keys(mapDisplayByYear).length > 0 && { mapDisplayByYear }),
    ...(totalAposN >= LIMITE_POPULACAO && { populacaoMaximaAtingida: true }),
    ...(debugContext && { debugLog: debugContext.log }),
    ...(debugContext?.groupLog && { debugLogGrupo: debugContext.groupLog }),
    ...(debugContext?.qtdeLog && debugContext.qtdeLog.length > 0 && { debugLogQtde: debugContext.qtdeLog }),
    ...(debugContext?.performanceLog && debugContext.performanceLog.length > 0 && { performanceLog: debugContext.performanceLog }),
  };
}

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

async function getUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = (await request.json()) as Body;
    const { mode, params, state, N, currentIteration, notWhitePixels, indiceGrid, indiceBranco, origensAgendadas, debugGenesisId, debugGenesisGrupo, debugQtde, debugPerformance } = body;

    /** Custo máximo (reserva): mode one = 1; mode n = N (cobramos depois só pelas iterações reais). */
    const coinsCost = mode === "one" ? 1 : mode === "n" && N != null ? N : 1;
    const balance = await getBalance(userId);
    if (balance < coinsCost) {
      return NextResponse.json(
        { error: "insufficient_coins", message: "Saldo insuficiente de coins" },
        { status: 400 }
      );
    }

    const refId = `run-${userId.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const mapa = buildMapaFromNotWhitePixels(notWhitePixels ?? [], indiceGrid, indiceBranco);
    const debugEnabled = process.env.DEBUG_LOGS !== "0";
    const debugContext =
      debugEnabled && (debugGenesisId != null && Number.isFinite(debugGenesisId) || debugGenesisGrupo === true || debugQtde === true || debugPerformance === true)
        ? {
            debugGenesisId: debugGenesisId ?? 0,
            log: [] as { msg: string; data?: unknown }[],
            ...(debugGenesisGrupo === true && { groupLog: [] as { msg: string; data?: unknown }[] }),
            ...(debugQtde === true && { qtdeLog: [] as { etapa: string; total: number; nVetor1: number; nVetor2: number; sumV1: number; sumV2: number; extra?: Record<string, number> }[] }),
            ...(debugPerformance === true && { performanceLog: [] as { phase: string; ms: number }[] }),
          }
        : null;

    if (mode === "one") {
      if (state == null) {
        const inicioServidor = performance.now();
        const result = runGerarGenesis(
          {
            max_idade: params.max_idade ?? 100,
            periodo_simulado: params.periodo_simulado ?? 0,
            idade_fertil_min: params.idade_fertil_min ?? 1,
            idade_fertil_max: params.idade_fertil_max ?? 50,
            idade_fertil_pico: params.idade_fertil_pico ?? 25,
            tx_decaimento_pos_pico: params.tx_decaimento_pos_pico ?? 0.25,
            fecundidade_media_parto: params.fecundidade_media_parto ?? 1.05,
            prob_anual_reproducao: params.prob_anual_reproducao ?? 90,
            dispersao_anual_media: params.dispersao_anual_media ?? 2,
            fecundidade_max_parto: params.fecundidade_max_parto ?? 3,
            tx_mortalidade_inicial_1: params.tx_exp_inicial_grupo_1 ?? params.tx_mortalidade_inicial_1 ?? 5,
            reducao_crescimento_habilitada: params.reducao_crescimento_habilitada ?? 0,
            periodo_i1: params.periodo_i1 ?? -100,
            periodo_f1: params.periodo_f1 ?? 2026,
            tx_mortalidade_final_1: params.tx_exp_final_grupo_mod_1 ?? params.tx_mortalidade_final_1 ?? 2.5,
            tx_exp_inicial_grupo_1: params.tx_exp_inicial_grupo_1 ?? 5,
            per_de_mod_da_tx_exp_i1: params.per_de_mod_da_tx_exp_i1 ?? 2,
            per_de_mod_da_tx_exp_f1: params.per_de_mod_da_tx_exp_f1 ?? 100,
            tx_exp_final_grupo_mod_1: params.tx_exp_final_grupo_mod_1 ?? 2.5,
            min_form_grupo: params.min_form_grupo ?? 50,
            x0: params.x0,
            y0: params.y0,
            x0_v2: params.x0_v2,
            y0_v2: params.y0_v2,
            fator_continental_habilitado: params.fator_continental_habilitado ?? 1,
            qtde_direcoes: params.qtde_direcoes ?? 4,
          },
          mapa,
          debugContext ?? undefined,
          origensAgendadas
        );
        const serverDurationMs = performance.now() - inicioServidor;
        const periodoGenesis = params.periodo_i1 ?? -100;
        /** Cobra 1 coin pelo genesis (1 “iteração”); se população ficou 0, não cobra. */
        const ranOne = totalPopulation(result.vetor1, result.vetor2) > 0;
        if (ranOne) await spendCoins(userId, 1, refId, { N: 1 });
        return NextResponse.json({
          vetor1: result.vetor1,
          vetor2: result.vetor2,
          especie: result.especie,
          resultadoPorId: result.resultadoPorId,
          iteracao: 0,
          periodo: periodoGenesis,
          mortesAcumuladas: 0,
          serverDurationMs,
          ...(debugContext && { debugLog: debugContext.log }),
          ...(debugContext?.groupLog && { debugLogGrupo: debugContext.groupLog }),
          ...(debugContext?.qtdeLog && debugContext.qtdeLog.length > 0 && { debugLogQtde: debugContext.qtdeLog }),
        });
      }
      const inicioServidor = performance.now();
      const iterAtual = currentIteration ?? 0;
      const iteracaoMaxima = getIteracaoMaxima(params);
      const totalIndividuos = state.vetor1.reduce((s, i) => s + i.qtde, 0) + state.vetor2.reduce((s, i) => s + i.qtde, 0);
      const populacaoZero = totalIndividuos === 0;
      const populacaoMaximaAtingida = totalIndividuos >= LIMITE_POPULACAO;
      if (populacaoMaximaAtingida) {
        const periodoOne = (params.periodo_i1 ?? -100) + iterAtual;
        await spendCoins(userId, 1, refId, { N: 1 });
        return NextResponse.json({
          vetor1: state.vetor1,
          vetor2: state.vetor2,
          especie: state.especie,
          resultadoPorId: {},
          iteracao: iterAtual,
          periodo: periodoOne,
          mortesAcumuladas: state.mortesAcumuladas ?? 0,
          serverDurationMs: performance.now() - inicioServidor,
          populacaoMaximaAtingida: true,
          ...(debugContext && { debugLog: debugContext.log }),
          ...(debugContext?.groupLog && { debugLogGrupo: debugContext.groupLog }),
          ...(debugContext?.qtdeLog && debugContext.qtdeLog.length > 0 && { debugLogQtde: debugContext.qtdeLog }),
        });
      }
      if (iterAtual >= iteracaoMaxima) {
        const periodoOne = (params.periodo_i1 ?? -100) + iterAtual;
        await spendCoins(userId, 1, refId, { N: 1 });
        return NextResponse.json({
          vetor1: state.vetor1,
          vetor2: state.vetor2,
          especie: state.especie,
          resultadoPorId: {},
          iteracao: iterAtual,
          periodo: periodoOne,
          mortesAcumuladas: state.mortesAcumuladas ?? 0,
          serverDurationMs: performance.now() - inicioServidor,
          limiteAtingido: true,
          ...(debugContext?.performanceLog && debugContext.performanceLog.length > 0 && { performanceLog: debugContext.performanceLog }),
          ...(debugContext && { debugLog: debugContext.log }),
          ...(debugContext?.groupLog && { debugLogGrupo: debugContext.groupLog }),
          ...(debugContext?.qtdeLog && debugContext.qtdeLog.length > 0 && { debugLogQtde: debugContext.qtdeLog }),
        });
      }
      /** População zerada: 0 iterações executadas → não cobra. */
      if (populacaoZero) {
        const periodoOne = (params.periodo_i1 ?? -100) + iterAtual;
        return NextResponse.json({
          vetor1: state.vetor1,
          vetor2: state.vetor2,
          especie: state.especie,
          resultadoPorId: {},
          iteracao: iterAtual,
          periodo: periodoOne,
          mortesAcumuladas: state.mortesAcumuladas ?? 0,
          serverDurationMs: performance.now() - inicioServidor,
          populacaoZero: true,
          ...(debugContext && { debugLog: debugContext.log }),
          ...(debugContext?.groupLog && { debugLogGrupo: debugContext.groupLog }),
          ...(debugContext?.qtdeLog && debugContext.qtdeLog.length > 0 && { debugLogQtde: debugContext.qtdeLog }),
        });
      }
      const iteracaoOne = iterAtual + 1;
      const periodoOne = (params.periodo_i1 ?? -100) + iteracaoOne;
      const result = runUmPasso(state.vetor1, state.vetor2, state.especie, params, mapa, debugContext ?? undefined, periodoOne, origensAgendadas);
      const serverDurationMs = performance.now() - inicioServidor;
      const mortesEstePasso = result.vetor1.reduce((s, i) => s + (i.morte ?? 0), 0) + result.vetor2.reduce((s, i) => s + (i.morte ?? 0), 0);
      const mortesAcumuladas = (state.mortesAcumuladas ?? 0) + mortesEstePasso;
      const totalAposPasso = result.vetor1.reduce((s, i) => s + i.qtde, 0) + result.vetor2.reduce((s, i) => s + i.qtde, 0);
      if (totalAposPasso > 0) await spendCoins(userId, 1, refId, { N: 1 });
      return NextResponse.json({
        vetor1: result.vetor1,
        vetor2: result.vetor2,
        especie: result.especie,
        resultadoPorId: result.resultadoPorId,
        iteracao: iteracaoOne,
        periodo: periodoOne,
        mortesAcumuladas,
        serverDurationMs,
        ...(totalAposPasso >= LIMITE_POPULACAO && { populacaoMaximaAtingida: true }),
        ...(debugContext?.performanceLog && debugContext.performanceLog.length > 0 && { performanceLog: debugContext.performanceLog }),
        ...(debugContext && { debugLog: debugContext.log }),
        ...(debugContext?.groupLog && { debugLogGrupo: debugContext.groupLog }),
        ...(debugContext?.qtdeLog && debugContext.qtdeLog.length > 0 && { debugLogQtde: debugContext.qtdeLog }),
      });
    }

    if (mode === "n" && N != null && N >= 1) {
      const result = executeSimulationN(body, debugContext);
      const startIter = body.currentIteration ?? 0;
      const actualIterations = Math.max(0, result.iteracao - startIter);
      if (actualIterations > 0) await spendCoins(userId, actualIterations, refId, { N: actualIterations });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Body inválido: mode 'n' exige N" },
      { status: 400 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao executar simulação";
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[api/crypto/simulacao/run]", e);
    return NextResponse.json(
      {
        error: message,
        ...(process.env.NODE_ENV === "development" && stack && { stack: stack.slice(0, 1000) }),
      },
      { status: 500 }
    );
  }
}
