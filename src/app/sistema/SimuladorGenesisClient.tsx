"use client";

import { useState, Fragment, useEffect, useRef, useMemo, memo, useCallback, startTransition } from "react";
import { createPortal } from "react-dom";
import { computeIntervaloTaxa, clamp } from "@/lib/intervalo-taxa";
import {
  REGIAO_SIZE,
  REGIAO_KM,
  CENTRO_KM,
  kmToPx,
  getFaixaForPeriodo,
  getMortalidadeResolvida,
  getIteracaoMaxima,
  getPeriodoFimUltimo,
  LIMITE_POPULACAO,
  type GenesisIndividual,
  type EspecieParams,
  type ResultadoReproducaoPorId,
  type MapaAreasPretas,
} from "@/app/lib/simulacao-genesis";
import { useExecHeader } from "@/app/sistema/ExecHeaderContext";
import { useMapOverlay } from "@/app/sistema/MapOverlayContext";

const DEFAULT_API_RUN = `${API_BASE}/simulacao/run`;
const API_SAVED_CONFIG = `${API_BASE}/saved-config`;
const API_QUEUE = `${API_BASE}/simulacao/queue`;
const API_QUEUE_STATUS = `${API_BASE}/simulacao/queue/status`;
const API_QUEUE_CONFIG = `${API_BASE}/simulacao/queue/config`;
const API_WALLET_BALANCE = `${API_BASE}/wallet/balance`;
const API_SIMULATION_STATE = `${API_BASE}/simulacao/state`;

/** Custo máximo para exibir ao usuário: 1 coin por iteração (o servidor cobra só pelas iterações reais). */
function getCoinsForRun(N: number): number {
  return N >= 1 ? N : 1;
}
const QUEUE_POLL_INTERVAL_MS_DEFAULT = 1500;
const QUEUE_MAX_WAIT_MS_DEFAULT = 180000; // 3 min

/** Limite Vercel ~4.5 MB. Só comprimimos quando passar deste threshold (4 MB) para evitar 413. */
const QUEUE_BODY_COMPRESS_THRESHOLD_BYTES = 4 * 1024 * 1024;

/** Tamanho em bytes da string em UTF-8 (aprox.). */
function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Em dev (localhost) evita body em stream para não disparar ERR_ALPN_NEGOTIATION_FAILED. */
function isLikelyDev(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location?.hostname ?? "";
  return h === "localhost" || h === "127.0.0.1";
}

/** Prepara body e headers para POST na fila. Usa gzip só quando o payload se aproxima do limite (4.5 MB na Vercel). Em dev usa sempre JSON para evitar ALPN. */
function getQueueRequestInit(
  queueName: string,
  payload: object
): { body: ReadableStream<Uint8Array> | string; headers: Record<string, string>; duplex?: "half" } {
  const json = JSON.stringify({ queueName, payload });
  const sizeBytes = utf8ByteLength(json);
  const shouldCompress =
    !isLikelyDev() &&
    sizeBytes >= QUEUE_BODY_COMPRESS_THRESHOLD_BYTES &&
    typeof CompressionStream !== "undefined";

  if (shouldCompress) {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
    return {
      body: stream as ReadableStream<Uint8Array>,
      headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
      duplex: "half", // obrigatório para request body em stream
    };
  }
  return { body: json, headers: { "Content-Type": "application/json" } };
}
const GENESIS_STATE_STORAGE_KEY = "bio-genesis-sim-state";

// mapDisplayByYear: { "1": [births, deaths, groups, uniques, population], "2": [...], ... }
// Índices: 0=births, 1=deaths, 2=groups, 3=uniques, 4=population
type MapDisplayYearRow = [number, number, number, number, number];

function computeMapDisplayYear(
  vetor1: GenesisIndividual[],
  vetor2: GenesisIndividual[],
  resultadoPorId: ResultadoReproducaoPorId
): MapDisplayYearRow {
  const todos = [...vetor1, ...vetor2];
  return [
    Object.values(resultadoPorId).reduce((s, r) => s + (r.decendentes ?? 0), 0),
    todos.reduce((s, i) => s + (i.morte ?? 0), 0),
    todos.filter((i) => i.qtde > 1).length,
    todos.filter((i) => i.qtde === 1).length,
    todos.reduce((s, i) => s + i.qtde, 0),
  ];
}
const GENESIS_LAST_LOADED_CONFIG_ID_KEY = "bio-genesis-last-loaded-config-id";
const GENESIS_LAST_SAVED_CONFIG_NAME_KEY = "bio-genesis-last-saved-config-name";
const GENESIS_STATE_MAX_BYTES = 4 * 1024 * 1024; // 4MB - evita estourar localStorage

/** Debug de performance do script: desativado por enquanto para não interferir nos logs [QTDE]/debug. Ative com true ou no console: window.__DEBUG_PERFORMANCE_SCRIPT = true */
const DEBUG_PERFORMANCE_SCRIPT = false;

declare global {
  interface Window {
    __DEBUG_PERFORMANCE_SCRIPT?: boolean;
    /** Ativa debug do indivíduo id=1: API devolve debugLog na resposta e o cliente exibe no console. Desative com null. */
    __DEBUG_GENESIS_ID?: number | null;
    /** Ativa debug do grupo de maior id: API devolve debugLogGrupo na resposta. Desative com false. */
    __DEBUG_GENESIS_GRUPO?: boolean;
  }
}

function shouldLogPerformance(): boolean {
  if (typeof window !== "undefined" && window.__DEBUG_PERFORMANCE_SCRIPT !== undefined) {
    return window.__DEBUG_PERFORMANCE_SCRIPT;
  }
  return DEBUG_PERFORMANCE_SCRIPT;
}

import { GenesisPlot } from "./components/GenesisPlot";
import { PlayBIcon } from "./components/PlayBIcon";
import { useBioDebug } from "@/app/sistema/BioDebugContext";
import { useBioLang } from "@/app/contexts/BioLangContext";
import { getBioT } from "@/app/lib/translations";
import { containsBlockedWord } from "@/lib/blocked-words";
import { ASSET_PREFIX, API_BASE } from "@/app/constants";

/** mapa=1 → mapa.WEBP / mapa_masc.png; mapa=2 → mapa2.WEBP / mapa2_masc.png; etc. Máscara em PNG (8 cores). */
function getMapaUrls(mapNum: number): { displayUrl: string; mascUrl: string } {
  const n = Math.max(1, Math.floor(mapNum));
  if (n === 1) {
    return { displayUrl: `${ASSET_PREFIX}/Mapa/mapa.WEBP`, mascUrl: `${ASSET_PREFIX}/Mapa/mapa_masc.png` };
  }
  return {
    displayUrl: `${ASSET_PREFIX}/Mapa/mapa${n}.WEBP`,
    mascUrl: `${ASSET_PREFIX}/Mapa/mapa${n}_masc.png`,
  };
}

type InputDef = {
  key: string;
  label: string;
  default: number;
  type?: "number" | "checkbox" | "slider";
  /** step do input number (ex.: 0.1 para % com décimos) */
  step?: number;
  /** min para input number */
  min?: number;
  /** max para input number */
  max?: number;
  /** Para type "slider": min do range */
  sliderMin?: number;
  /** Para type "slider": max fixo do range (usa este se não tiver sliderMaxKey) */
  sliderMax?: number;
  /** Para type "slider": key do input que define o max */
  sliderMaxKey?: string;
};

type ScriptDef = {
  id: string;
  name: string;
  inputs: InputDef[];
  run: (params: Record<string, number>) => unknown;
};

const SCRIPTS: ScriptDef[] = [
  {
    id: "gerar-genesis",
    name: "GerarGenesis",
    inputs: [
      { key: "max_idade", label: "max_age", default: 140, min: 1, max: 200 },
      { key: "fragilidade_inicial", label: "initial_fragility", default: 0.005, step: 0.001, min: 0.0001, max: 0.10 },
      { key: "taxa_envelhecimento", label: "aging_rate", default: 0.09, step: 0.01, min: 0.01, max: 0.30 },
      { key: "idade_fertil_min", label: "min_fertile_age", default: 22, min: 1, max: 120 },
      { key: "idade_fertil_max", label: "max_fertile_age", default: 50, min: 1, max: 120 },
      { key: "idade_fertil_pico", label: "peak_fertile_age", default: 25, min: 1, max: 120 },
      { key: "tx_decaimento_pos_pico", label: "post_peak_decay_rate", default: 0.25, step: 0.01 },
      { key: "fecundidade_media_parto", label: "mean_fertility_per_birth", default: 1.05, step: 0.01 },
      { key: "fecundidade_max_parto", label: "max_fertility_per_birth", default: 3, min: 1, max: 100 },
      { key: "prob_anual_reproducao", label: "annual_reproduction_prob (%)", default: 50, step: 0.01, min: 0, max: 100 },
      { key: "idade_fertil_min_2", label: "min_fertile_age_2", default: 22, min: 1, max: 120 },
      { key: "idade_fertil_max_2", label: "max_fertile_age_2", default: 50, min: 1, max: 120 },
      { key: "idade_fertil_pico_2", label: "peak_fertile_age_2", default: 25, min: 1, max: 120 },
      { key: "prob_anual_reproducao_2", label: "annual_reproduction_prob_2 (%)", default: 50, step: 0.01, min: 0, max: 100 },
      { key: "tx_decaimento_pos_pico_2", label: "post_peak_decay_rate_2", default: 0.25, step: 0.01 },
      { key: "fecundidade_media_parto_2", label: "mean_fertility_per_birth_2", default: 1.05, step: 0.01 },
      { key: "fecundidade_max_parto_2", label: "max_fertility_per_birth_2", default: 3, min: 1, max: 100 },
      { key: "idade_fertil_min_3", label: "min_fertile_age_3", default: 22, min: 1, max: 120 },
      { key: "idade_fertil_max_3", label: "max_fertile_age_3", default: 50, min: 1, max: 120 },
      { key: "idade_fertil_pico_3", label: "peak_fertile_age_3", default: 25, min: 1, max: 120 },
      { key: "prob_anual_reproducao_3", label: "annual_reproduction_prob_3 (%)", default: 50, step: 0.01, min: 0, max: 100 },
      { key: "tx_decaimento_pos_pico_3", label: "post_peak_decay_rate_3", default: 0.25, step: 0.01 },
      { key: "fecundidade_media_parto_3", label: "mean_fertility_per_birth_3", default: 1.05, step: 0.01 },
      { key: "fecundidade_max_parto_3", label: "max_fertility_per_birth_3", default: 3, min: 1, max: 100 },
      { key: "qtde_direcoes", label: "Number of directions", default: 4, min: 2, max: 8, step: 1 },
      { key: "dispersao_anual_media", label: "annual_mean_dispersal (km)", default: 100, step: 0.01, min: 2, max: 500 },
      { key: "dispersao_anual_media_2", label: "annual_mean_dispersal_2 (km)", default: 50, step: 0.01, min: 2, max: 500 },
      { key: "dispersao_anual_media_3", label: "annual_mean_dispersal_3 (km)", default: 50, step: 0.01, min: 2, max: 500 },
      { key: "tx_mortalidade_inicial_1", label: "initial_mortality_rate_1 (%)", default: 1, step: 0.1, min: 0, max: 50 },
      { key: "reducao_crescimento_habilitada", label: "Mortality rate can change over time", default: 1, type: "checkbox" },
      { key: "periodo_i1", label: "Period 1 start", default: -100 },
      { key: "periodo_f1", label: "Period 1 end", default: 2026 },
      { key: "tx_mortalidade_final_1", label: "final_mortality_rate_1 (%)", default: 2, step: 0.1, min: 0, max: 50 },
      { key: "adicionar_intervalo_2", label: "Add period 2", default: 0, type: "checkbox" },
      { key: "periodo_i2", label: "Period 2 start", default: 101 },
      { key: "periodo_f2", label: "Period 2 end", default: 20000 },
      { key: "tx_mortalidade_final_2", label: "final_mortality_rate_2 (%)", default: 2, step: 0.1, min: 0, max: 50 },
      { key: "adicionar_intervalo_3", label: "Add period 3", default: 0, type: "checkbox" },
      { key: "periodo_i3", label: "Period 3 start", default: 201 },
      { key: "periodo_f3", label: "Period 3 end", default: 20000 },
      { key: "tx_mortalidade_final_3", label: "final_mortality_rate_3 (%)", default: 2, step: 0.1, min: 0, max: 50 },
      { key: "fator_continental_habilitado", label: "Continental factor enabled", default: 0, type: "checkbox" },
      { key: "fator_mortalidade_cor0", label: "Antarctica", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor1", label: "North America", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor2", label: "South America", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor3", label: "Oceania", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor4", label: "Asia", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor5", label: "Europe", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor6", label: "Africa", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor0_2", label: "Antarctica", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor1_2", label: "North America", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor2_2", label: "South America", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor3_2", label: "Oceania", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor4_2", label: "Asia", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor5_2", label: "Europe", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor6_2", label: "Africa", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor0_3", label: "Antarctica", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor1_3", label: "North America", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor2_3", label: "South America", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor3_3", label: "Oceania", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor4_3", label: "Asia", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor5_3", label: "Europe", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "fator_mortalidade_cor6_3", label: "Africa", default: 1, step: 0.0001, min: 0, max: 2 },
      { key: "max_idade_2", label: "max_age_2", default: 140, min: 1, max: 200 },
      { key: "fragilidade_inicial_2", label: "initial_fragility_2", default: 0.005, step: 0.001, min: 0.0001, max: 0.10 },
      { key: "taxa_envelhecimento_2", label: "aging_rate_2", default: 0.09, step: 0.01, min: 0.01, max: 0.30 },
      { key: "max_idade_3", label: "max_age_3", default: 140, min: 1, max: 200 },
      { key: "fragilidade_inicial_3", label: "initial_fragility_3", default: 0.005, step: 0.001, min: 0.0001, max: 0.10 },
      { key: "taxa_envelhecimento_3", label: "aging_rate_3", default: 0.09, step: 0.01, min: 0.01, max: 0.30 },
      { key: "min_form_grupo", label: "min_form_group", default: 50, min: 50, max: 100 },
      { key: "x0", label: `x vector1 (0–${REGIAO_KM} km)`, default: 23440, step: 0.01 },
      { key: "y0", label: `y vector1 (0–${REGIAO_KM} km)`, default: 14970, step: 0.01 },
      { key: "x0_v2", label: `x vector2 (0–${REGIAO_KM} km)`, default: 23440, step: 0.01 },
      { key: "y0_v2", label: `y vector2 (0–${REGIAO_KM} km)`, default: 14970, step: 0.01 },
    ],
    run: () => undefined, // Execução via API POST /api/biogenerator/simulacao/run
  },
];

function BioDebugMenuContent() {
  const ctx = useBioDebug();
  const lang = useBioLang();
  const tSistema = getBioT(lang).sistema;
  if (!ctx) return null;
  const { flags, setGenesisId, setGenesisGrupo, setPerformance, setExecLog, setDados, setMortesAcum, setMapa } = ctx;
  return (
    <div className="space-y-2 pt-2">
      <p className="text-xs font-semibold text-amber-800">Debug (admin)</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={flags.genesisId != null} onChange={(e) => setGenesisId(e.target.checked ? 1 : null)} />
        <span>__DEBUG_GENESIS_ID (menor id genero=0, qtde=1)</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={flags.genesisGrupo} onChange={(e) => setGenesisGrupo(e.target.checked)} />
        <span>__DEBUG_GENESIS_GRUPO</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={flags.performance} onChange={(e) => setPerformance(e.target.checked)} />
        <span>Performance</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={flags.execLog} onChange={(e) => setExecLog(e.target.checked)} />
        <span>{tSistema.run}</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={flags.dados} onChange={(e) => setDados(e.target.checked)} />
        <span>Dados (JSON)</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={flags.mortesAcum} onChange={(e) => setMortesAcum(e.target.checked)} />
        <span>Mortes acumuladas</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={flags.mapa} onChange={(e) => setMapa(e.target.checked)} />
        <span>Mapa</span>
      </label>
    </div>
  );
}

const EstatisticasDisplay = memo(function EstatisticasDisplay({
  vetor1,
  vetor2,
  ano,
  mortesAcumuladas = 0,
  nascimentos = 0,
  atualizando = false,
}: {
  vetor1: GenesisIndividual[];
  vetor2: GenesisIndividual[];
  /** Ano = período calculado na execução (periodo_i1 + iteração). */
  ano: number;
  mortesAcumuladas?: number;
  /** Total de nascimentos nesta iteração (soma de decendentes em resultadoPorId). */
  nascimentos?: number;
  atualizando?: boolean;
}) {
  const lang = useBioLang();
  const t = getBioT(lang).sistema;
  const locale = lang === "en" ? "en-US" : "de-DE";
  const stats = useMemo(() => {
    const todos = [...vetor1, ...vetor2];
    return {
      grupos: todos.filter((ind) => ind.qtde > 1).length,
      unicos: todos.filter((ind) => ind.qtde === 1).length,
      totalIndividuos: todos.reduce((s, i) => s + i.qtde, 0),
      totalMortos: todos.reduce((s, i) => s + (i.morte ?? 0), 0),
    };
  }, [vetor1, vetor2]);

  const valor = (v: number) =>
    atualizando ? "—" : Math.round(v).toLocaleString(locale, { maximumFractionDigits: 0 });

  return (
    <div className="card-bio-generator mt-4 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-neutral-800 mb-3">
        {t.dataTitle} {atualizando && <span className="text-neutral-500 font-normal">({t.updating})</span>}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        <div className="text-center">
          <div className="text-sm font-semibold text-neutral-900 tabular-nums">{valor(ano)}</div>
          <div className="text-xs text-neutral-600">{t.year}</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-neutral-900 tabular-nums">{valor(stats.grupos)}</div>
          <div className="text-xs text-neutral-600">{t.groups}</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-neutral-900 tabular-nums">{valor(stats.unicos)}</div>
          <div className="text-xs text-neutral-600">{t.uniques}</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-neutral-900 tabular-nums">{valor(stats.totalIndividuos)}</div>
          <div className="text-xs text-neutral-600">{t.totalIndividuals}</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-neutral-900 tabular-nums">{valor(nascimentos)}</div>
          <div className="text-xs text-neutral-600">{t.births}</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-neutral-900 tabular-nums">{valor(stats.totalMortos)}</div>
          <div className="text-xs text-neutral-600">{t.totalDeathsAnnual}</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-neutral-900 tabular-nums">{valor(mortesAcumuladas)}</div>
          <div className="text-xs text-neutral-600">{t.totalDeathsAccum}</div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.vetor1 === nextProps.vetor1 &&
    prevProps.vetor2 === nextProps.vetor2 &&
    prevProps.ano === nextProps.ano &&
    prevProps.mortesAcumuladas === nextProps.mortesAcumuladas &&
    prevProps.nascimentos === nextProps.nascimentos &&
    prevProps.atualizando === nextProps.atualizando
  );
});

const ResultadoJSON = memo(function ResultadoJSON({
  genesisResult,
}: {
  genesisResult: { vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; especie: EspecieParams; resultadoPorId: ResultadoReproducaoPorId };
}) {
  const t = getBioT(useBioLang()).sistema;
  const jsonFormatado = useMemo(() => {
    const inicioFormatacao = performance.now();
    const vetor1Formatado = genesisResult.vetor1.map((ind) => ({
      ...ind,
      x: Number(ind.x.toFixed(1)),
      y: Number(ind.y.toFixed(1)),
      dispersao: Number(ind.dispersao.toFixed(1)),
      dispersao_regiao: Number(ind.dispersao_regiao.toFixed(1)),
    }));
    const vetor2Formatado = genesisResult.vetor2.map((ind) => ({
      ...ind,
      x: Number(ind.x.toFixed(1)),
      y: Number(ind.y.toFixed(1)),
      dispersao: Number(ind.dispersao.toFixed(1)),
      dispersao_regiao: Number(ind.dispersao_regiao.toFixed(1)),
    }));
    const especieFormatada = {
      ...genesisResult.especie,
      dispersao_anual_media: Number(genesisResult.especie.dispersao_anual_media.toFixed(1)),
    };
    const tempoFormatacao = performance.now() - inicioFormatacao;

    const inicioJSON = performance.now();
    const jsonVetor1 = JSON.stringify(vetor1Formatado, null, 2);
    const jsonVetor2 = JSON.stringify(vetor2Formatado, null, 2);
    const jsonResultadoPorId = JSON.stringify(genesisResult.resultadoPorId, null, 2);
    const jsonEspecie = JSON.stringify(especieFormatada, null, 2);
    const tempoJSON = performance.now() - inicioJSON;

    if (tempoFormatacao + tempoJSON > 5) {
      console.log(`[UI] Formatação: ${tempoFormatacao.toFixed(2)}ms | JSON.stringify: ${tempoJSON.toFixed(2)}ms | Total: ${(tempoFormatacao + tempoJSON).toFixed(2)}ms`);
    }

    return { jsonVetor1, jsonVetor2, jsonResultadoPorId, jsonEspecie };
  }, [genesisResult.vetor1, genesisResult.vetor2, genesisResult.especie, genesisResult.resultadoPorId]);

  return (
    <>
      <div className="card-bio-generator mt-4 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-neutral-800 mb-3">{t.responseValidate}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-2">{t.vector1Label}</p>
            <pre className="text-xs font-mono text-neutral-700 bg-neutral-50 p-3 rounded-lg overflow-auto max-h-48">
              {jsonFormatado.jsonVetor1}
            </pre>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-2">{t.vector2Label}</p>
            <pre className="text-xs font-mono text-neutral-700 bg-neutral-50 p-3 rounded-lg overflow-auto max-h-48">
              {jsonFormatado.jsonVetor2}
            </pre>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-neutral-500 uppercase mb-2">{t.resultById}</p>
          <p className="text-[11px] text-neutral-500 mb-2">{t.resultByIdNote}</p>
          <pre className="text-xs font-mono text-neutral-700 bg-neutral-50 p-3 rounded-lg overflow-auto max-h-32">
            {jsonFormatado.jsonResultadoPorId}
          </pre>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-neutral-500 uppercase mb-2">{t.speciesParams}</p>
          <pre className="text-xs font-mono text-neutral-700 bg-neutral-50 p-3 rounded-lg overflow-auto max-h-64">
            {jsonFormatado.jsonEspecie}
          </pre>
        </div>
      </div>
    </>
  );
}, (prevProps, nextProps) => {
  // Comparação customizada: só re-renderiza se genesisResult mudar
  return (
    prevProps.genesisResult.vetor1 === nextProps.genesisResult.vetor1 &&
    prevProps.genesisResult.vetor2 === nextProps.genesisResult.vetor2 &&
    prevProps.genesisResult.especie === nextProps.genesisResult.especie &&
    prevProps.genesisResult.resultadoPorId === nextProps.genesisResult.resultadoPorId
  );
});

const SCRIPT_GENESIS_ID = "gerar-genesis";

/** Formata valor numérico do Quadro 5 para exibição (sempre com ponto decimal). */
function formatQuadro5Val(val: number): string {
  if (val === undefined || val === null || Number.isNaN(val)) return "";
  return String(val);
}

/** Filtra entrada do Quadro 5: só números e ponto; vírgula vira ponto. */
function filterQuadro5Input(s: string): string {
  s = s.replace(/,/g, ".");
  s = s.replace(/[^\d.]/g, "");
  const parts = s.split(".");
  if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("");
  return s;
}

/** Conteúdo expandível do Quadro 0 (Períodos). */
function Quadro0ConteudoInline({
  script,
  inputValues,
  setInputValues,
  vals,
  setShowQuadro0PeriodosHelp,
}: {
  script: ScriptDef;
  inputValues: Record<string, Record<string, number>>;
  setInputValues: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  vals: Record<string, number>;
  setShowQuadro0PeriodosHelp: (v: boolean) => void;
}) {
  const t = getBioT(useBioLang()).sistema;
  const minR = -20000;
  const maxR = 20000;
  const getCurrent = () =>
    script.inputs.reduce(
      (acc, { key: k, default: def }) => ({ ...acc, [k]: inputValues[script.id]?.[k] ?? def }),
      {} as Record<string, number>
    );
  const numPeriodos = 1 + ((vals.adicionar_intervalo_2 ?? 0) === 1 ? 1 : 0) + ((vals.adicionar_intervalo_3 ?? 0) === 1 ? 1 : 0);
  const rawI1 = vals.periodo_i1 ?? minR;
  const i1 = Number.isFinite(rawI1) ? clamp(minR, rawI1, maxR) : minR;
  const rawF1 = vals.periodo_f1 ?? maxR;
  const f1 = Number.isFinite(rawF1) ? clamp(i1, rawF1, maxR) : maxR;
  const i2 = f1;
  const rawF2 = vals.periodo_f2 ?? maxR;
  const f2 = numPeriodos >= 2 && Number.isFinite(rawF2) ? clamp(i2, rawF2, maxR) : maxR;
  const i3 = numPeriodos >= 3 ? f2 : maxR;
  const applyVal = (key: "periodo_i1" | "periodo_f1" | "periodo_f2" | "periodo_f3", min: number, max: number, v: number, extraUpdate?: (current: Record<string, number>, val: number) => Partial<Record<string, number>>) => {
    const clamped = Math.round(Math.max(min, Math.min(max, v)));
    setInputValues((prev) => {
      const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
      const extra = extraUpdate?.(current, clamped) ?? {};
      return { ...prev, [script.id]: { ...current, [key]: clamped, ...extra } as Record<string, number> } as Record<string, Record<string, number>>;
    });
  };
  const numInput = (key: "periodo_i1" | "periodo_f1" | "periodo_f2" | "periodo_f3", min: number, max: number, extraUpdate?: (current: Record<string, number>, v: number) => Partial<Record<string, number>>, showArrows = true) => {
    const val = inputValues[script.id]?.[key] ?? script.inputs.find((i) => i.key === key)?.default ?? min;
    const numVal = Number.isNaN(val) ? min : Math.round(Number(val));
    const displayVal = Number.isNaN(val) ? "" : String(Math.round(Number(val)));
    const safeMin = Number.isFinite(min) ? min : minR;
    const safeMax = Number.isFinite(max) ? max : maxR;
    const inputEl = (
      <input
        type="number"
        step={1}
        min={safeMin}
        max={safeMax}
        value={displayVal}
        onChange={(e) => {
          const raw = e.target.value;
          const current = getCurrent();
          if (raw === "") {
            const extra = extraUpdate?.(current, NaN) ?? {};
            setInputValues((prev) => ({ ...prev, [script.id]: { ...current, [key]: NaN, ...extra } as Record<string, number> }));
            return;
          }
          const parsed = Number(raw);
          if (!Number.isFinite(parsed)) return;
          const v = Math.round(Math.max(safeMin, Math.min(safeMax, parsed)));
          const extra = extraUpdate?.(current, v) ?? {};
          setInputValues((prev) => ({ ...prev, [script.id]: { ...current, [key]: v, ...extra } as Record<string, number> }));
        }}
        className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm font-mono"
      />
    );
    if (!showArrows) return inputEl;
    return (
      <div className="flex items-center gap-1">
        <button type="button" aria-label={t.decrease} onClick={() => applyVal(key, safeMin, safeMax, numVal - 1, extraUpdate)} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 active:bg-neutral-100 text-sm font-medium">←</button>
        {inputEl}
        <button type="button" aria-label={t.increase} onClick={() => applyVal(key, safeMin, safeMax, numVal + 1, extraUpdate)} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 active:bg-neutral-100 text-sm font-medium">→</button>
      </div>
    );
  };
  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
        <span>{t.periods}:</span>
        <span className="font-mono font-semibold min-w-[1.5rem] text-center">{numPeriodos}</span>
        <button type="button" aria-label={t.removeLastPeriod} disabled={numPeriodos <= 1} onClick={() => { if (numPeriodos <= 1) return; setInputValues((prev) => { const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>); if (numPeriodos === 3) return { ...prev, [script.id]: { ...current, adicionar_intervalo_3: 0 } }; return { ...prev, [script.id]: { ...current, adicionar_intervalo_2: 0, adicionar_intervalo_3: 0 } }; }); }} className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed text-lg font-medium">−</button>
        <button type="button" aria-label={t.addPeriod} disabled={numPeriodos >= 3} onClick={() => { if (numPeriodos >= 3) return; setInputValues((prev) => { const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>); if (numPeriodos === 1) { const novoInicio2 = current.periodo_f1 ?? maxR; return { ...prev, [script.id]: { ...current, adicionar_intervalo_2: 1, periodo_i2: novoInicio2, periodo_f2: novoInicio2 } }; } const novoInicio3 = current.periodo_f2 ?? maxR; return { ...prev, [script.id]: { ...current, adicionar_intervalo_3: 1, periodo_i3: novoInicio3, periodo_f3: novoInicio3 } }; }); }} className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed text-lg font-medium">+</button>
        <span className="text-zinc-500 text-xs">{t.max3}</span>
      </div>
      <div className="w-full min-w-0 space-y-3">
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-wrap items-center gap-2 text-zinc-700"><span className="w-10 shrink-0">{t.start}:</span>{numInput("periodo_i1", minR, maxR, undefined, false)}</label>
          <label className="flex flex-wrap items-center gap-2 text-zinc-700"><span className="w-10 shrink-0">{t.end}:</span>{numInput("periodo_f1", i1, maxR, (cur, v) => { if (numPeriodos < 2) return {}; const novoI2 = v; const f2Atual = cur.periodo_f2 ?? maxR; return { periodo_i2: novoI2, periodo_f2: Math.max(f2Atual, novoI2) }; })}<span className="text-zinc-500 font-mono text-xs">[{minR}, {maxR}]</span></label>
        </div>
        {numPeriodos >= 2 && (
          <div className="flex flex-col gap-3 text-sm border-t border-neutral-200 pt-3">
            <label className="flex flex-wrap items-center gap-2 text-zinc-700"><span className="w-10 shrink-0">{t.start}:</span><input type="number" step={1} readOnly value={i2} className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm font-mono bg-neutral-200 text-neutral-600 cursor-default" aria-label={t.period2StartFixed} /></label>
            <label className="flex flex-wrap items-center gap-2 text-zinc-700"><span className="w-10 shrink-0">{t.end}:</span>{numInput("periodo_f2", i2, maxR, (cur, v) => { if (numPeriodos < 3) return {}; const novoI3 = v; const f3Atual = cur.periodo_f3 ?? maxR; return { periodo_i3: novoI3, periodo_f3: Math.max(f3Atual, novoI3) }; })}</label>
          </div>
        )}
        {numPeriodos >= 3 && (
          <div className="flex flex-col gap-3 text-sm border-t border-neutral-200 pt-3">
            <label className="flex flex-wrap items-center gap-2 text-zinc-700"><span className="w-10 shrink-0">{t.start}:</span><input type="number" step={1} readOnly value={i3} className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm font-mono bg-neutral-200 text-neutral-600 cursor-default" aria-label={t.period3StartFixed} /></label>
            <label className="flex flex-wrap items-center gap-2 text-zinc-700"><span className="w-10 shrink-0">{t.end}:</span>{numInput("periodo_f3", i3, maxR)}</label>
          </div>
        )}
      </div>
    </div>
  );
}

/** Conteúdo expandível do Quadro 1 (Mortalidade residual). */
function Quadro1ConteudoInline({
  script,
  inputValues,
  setInputValues,
  vals,
  quadro1Edit,
  setQuadro1Edit,
  expandPeriodo2Quadro1,
  setExpandPeriodo2Quadro1,
  expandPeriodo3Quadro1,
  setExpandPeriodo3Quadro1,
  setShowQuadro1MortalidadeHelp,
}: {
  script: ScriptDef;
  inputValues: Record<string, Record<string, number>>;
  setInputValues: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  vals: Record<string, number>;
  quadro1Edit: Record<string, string>;
  setQuadro1Edit: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  expandPeriodo2Quadro1: boolean;
  setExpandPeriodo2Quadro1: React.Dispatch<React.SetStateAction<boolean>>;
  expandPeriodo3Quadro1: boolean;
  setExpandPeriodo3Quadro1: React.Dispatch<React.SetStateAction<boolean>>;
  setShowQuadro1MortalidadeHelp: (v: boolean) => void;
}) {
  const iteracaoMax = getIteracaoMaxima(vals);
  const txInicialVal = vals.tx_mortalidade_inicial_1 ?? 1;
  const reducaoHabilitada = (vals.reducao_crescimento_habilitada ?? 0) === 1;
  const periodoInicialVal = vals.periodo_i1 ?? -100;
  const periodoFinalVal = vals.periodo_f1 ?? 2026;
  const intervalo1Result = reducaoHabilitada
    ? computeIntervaloTaxa({
      tx_inicial: txInicialVal,
      periodo_i: periodoInicialVal,
      periodo_f: periodoFinalVal,
      tx_final: vals.tx_mortalidade_final_1 ?? 0.5,
    })
    : null;
  const perModVal = reducaoHabilitada && intervalo1Result ? intervalo1Result.per_de_mod : 2;
  const txFinalVal = vals.tx_mortalidade_final_1 ?? 0.5;
  const expoenteTxExpAnual = Math.min(0, perModVal) - 1;
  const txExpAnualCalculado =
    txInicialVal <= 0 && reducaoHabilitada
      ? null
      : intervalo1Result
        ? intervalo1Result.fator_anual
        : 1;

  return (
    <div className="flex flex-col gap-2">
      {(() => {
        const keyQ1Inicial = "tx_mortalidade_inicial_1";
        const inputInicial = script.inputs.find((i) => i.key === keyQ1Inicial)!;
        const dInicial = inputInicial.default;
        const rawInicial = inputValues[script.id]?.[keyQ1Inicial];
        const storedInicial = (rawInicial !== undefined && rawInicial !== null) ? rawInicial : dInicial;
        const stepInicial = inputInicial.step ?? 1;
        const decimalsInicial = stepInicial < 1 ? 4 : 0;
        const displayInicial = keyQ1Inicial in quadro1Edit ? quadro1Edit[keyQ1Inicial] : formatQuadro5Val(storedInicial);
        const applyQ1Inicial = () => {
          const s = quadro1Edit[keyQ1Inicial];
          setQuadro1Edit((prev) => { const next = { ...prev }; delete next[keyQ1Inicial]; return next; });
          if (s === "" || s === ".") return;
          const num = Number(s);
          if (!Number.isFinite(num)) return;
          const v = stepInicial < 1 ? Math.round(num * 10 ** decimalsInicial) / 10 ** decimalsInicial : Math.round(num);
          const clamped = inputInicial.min != null && v < inputInicial.min ? inputInicial.min : inputInicial.max != null && v > inputInicial.max ? inputInicial.max : v;
          setInputValues((prev) => {
            const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
            return { ...prev, [script.id]: { ...current, [keyQ1Inicial]: clamped } };
          });
        };
        return (
          <label key={keyQ1Inicial} className="flex items-center gap-2 text-sm text-neutral-700">
            <span>initial_mortality_rate (%):</span>
            <input type="text" inputMode="decimal" value={displayInicial} onFocus={() => setQuadro1Edit((prev) => ({ ...prev, [keyQ1Inicial]: formatQuadro5Val(storedInicial) }))} onChange={(e) => setQuadro1Edit((prev) => ({ ...prev, [keyQ1Inicial]: filterQuadro5Input(e.target.value) }))} onBlur={applyQ1Inicial} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQ1Inicial(); (e.target as HTMLInputElement).blur(); } }} className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0" />
            {inputInicial.min != null && inputInicial.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{inputInicial.min}, {inputInicial.max}]</span>}
          </label>
        );
      })()}
      {(() => {
        const keyQ1Final = "tx_mortalidade_final_1";
        const inputFinal = script.inputs.find((i) => i.key === keyQ1Final)!;
        const dFinal = inputFinal.default;
        const rawFinal = inputValues[script.id]?.[keyQ1Final];
        const storedFinal = (rawFinal !== undefined && rawFinal !== null) ? rawFinal : dFinal;
        const stepFinal = inputFinal.step ?? 1;
        const decimalsFinal = stepFinal < 1 ? 4 : 0;
        const displayFinal = keyQ1Final in quadro1Edit ? quadro1Edit[keyQ1Final] : formatQuadro5Val(storedFinal);
        const applyQ1Final = () => {
          const s = quadro1Edit[keyQ1Final];
          setQuadro1Edit((prev) => { const next = { ...prev }; delete next[keyQ1Final]; return next; });
          if (s === "" || s === ".") return;
          const num = Number(s);
          if (!Number.isFinite(num)) return;
          const v = stepFinal < 1 ? Math.round(num * 10 ** decimalsFinal) / 10 ** decimalsFinal : Math.round(num);
          const clamped = inputFinal.min != null && v < inputFinal.min ? inputFinal.min : inputFinal.max != null && v > inputFinal.max ? inputFinal.max : v;
          setInputValues((prev) => {
            const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
            return { ...prev, [script.id]: { ...current, [keyQ1Final]: clamped } };
          });
        };
        return (
          <label key={keyQ1Final} className="flex items-center gap-2 text-sm text-neutral-700">
            <span>final_mortality_rate (%):</span>
            <input type="text" inputMode="decimal" value={displayFinal} onFocus={() => setQuadro1Edit((prev) => ({ ...prev, [keyQ1Final]: formatQuadro5Val(storedFinal) }))} onChange={(e) => setQuadro1Edit((prev) => ({ ...prev, [keyQ1Final]: filterQuadro5Input(e.target.value) }))} onBlur={applyQ1Final} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQ1Final(); (e.target as HTMLInputElement).blur(); } }} className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0" />
            {inputFinal.min != null && inputFinal.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{inputFinal.min}, {inputFinal.max}]</span>}
          </label>
        );
      })()}
      <div className="w-full space-y-1 text-sm font-mono text-neutral-700 border-t border-neutral-300 pt-2 mt-1">
        <p>Interval = <span className="font-semibold">{Number.isFinite(periodoFinalVal) && Number.isFinite(periodoInicialVal) ? Math.max(1, Math.floor(periodoFinalVal - periodoInicialVal)) : 1}</span> (years)</p>
        <p>annual_mortality_factor = <span className="font-semibold">{(Math.floor((txExpAnualCalculado ?? intervalo1Result?.fator_anual ?? 1) * 10000) / 10000).toFixed(4)}…</span><span className="ml-1 font-sans normal-case text-neutral-500">(annual factor)</span></p>
        <p className="font-sans normal-case text-neutral-600 pt-1">The rate went from <strong>{Number.isFinite(txInicialVal) ? txInicialVal : "—"}%</strong> to <strong>{Number.isFinite(txFinalVal) ? txFinalVal : "—"}%</strong> in the interval between <strong>{Number.isFinite(periodoInicialVal) ? periodoInicialVal : "—"}</strong> and <strong>{Number.isFinite(periodoFinalVal) ? periodoFinalVal : "—"}</strong> years.</p>
      </div>
      {(vals.adicionar_intervalo_2 ?? 0) === 1 && (() => {
        const txInicialGrupo2 = vals.tx_mortalidade_final_1 ?? 0.5;
        const txExpInicialGrupo2 = txExpAnualCalculado != null ? Math.pow(txExpAnualCalculado, expoenteTxExpAnual) * txInicialVal : txInicialVal;
        const minI2 = periodoFinalVal;
        const maxR = 20000;
        const pi2 = clamp(minI2, vals.periodo_i2 ?? 101, maxR);
        const pf2 = clamp(pi2, vals.periodo_f2 ?? 200, maxR);
        const txFinalVal2 = vals.tx_mortalidade_final_2 ?? 0.5;
        const intervalo2Result = computeIntervaloTaxa({ tx_inicial: txInicialGrupo2, periodo_i: pi2, periodo_f: pf2, tx_final: txFinalVal2, periodoSeguinte: true });
        const perDerivado2 = intervalo2Result?.per_de_mod ?? Math.max(1, Math.floor(pf2 - pi2));
        const fatorExpAnual2 = intervalo2Result?.fator_anual ?? 1;
        const txExpAnual2 = intervalo2Result?.tx_anual_fim ?? txFinalVal2;
        return (
          <div className="mt-3 pt-3 border-t border-neutral-300">
            <button type="button" onClick={() => setExpandPeriodo2Quadro1((b) => !b)} className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800">
              <span className="shrink-0">{expandPeriodo2Quadro1 ? "▼" : "▶"}</span><span>Period 2</span>
            </button>
            {expandPeriodo2Quadro1 && (
              <div className="flex flex-col gap-2 mt-2 pl-4">
                <p className="text-sm font-mono text-neutral-700">initial_mortality_rate_2 (%) = <span className="font-semibold">{formatQuadro5Val(vals.tx_mortalidade_final_1 ?? 0.5)}</span></p>
                {(() => {
                  const keyQ12 = "tx_mortalidade_final_2";
                  const storedVal2 = Number.isNaN(txFinalVal2) ? 2.5 : txFinalVal2;
                  const displayStr2 = keyQ12 in quadro1Edit ? quadro1Edit[keyQ12] : formatQuadro5Val(storedVal2);
                  const applyQ12 = () => {
                    const s = quadro1Edit[keyQ12];
                    setQuadro1Edit((prev) => { const next = { ...prev }; delete next[keyQ12]; return next; });
                    if (s === "" || s === ".") return;
                    const num = Number(s);
                    if (!Number.isFinite(num)) return;
                    const v = Math.round(Math.max(0, Math.min(50, num)) * 10) / 10;
                    setInputValues((prev) => { const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>); return { ...prev, [script.id]: { ...current, [keyQ12]: v } }; });
                  };
                  return (
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                      <span>final_mortality_rate_2 (%):</span>
                      <input type="text" inputMode="decimal" value={displayStr2} onFocus={() => setQuadro1Edit((prev) => ({ ...prev, [keyQ12]: formatQuadro5Val(storedVal2) }))} onChange={(e) => setQuadro1Edit((prev) => ({ ...prev, [keyQ12]: filterQuadro5Input(e.target.value) }))} onBlur={applyQ12} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQ12(); (e.target as HTMLInputElement).blur(); } }} className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0" />
                      <span className="text-neutral-500 font-mono text-xs shrink-0">[0, 50]</span>
                    </label>
                  );
                })()}
                <div className="w-full space-y-1 text-sm font-mono text-neutral-700 border-t border-neutral-300 pt-2 mt-1">
                  <p>annual_mortality_factor_2 = <span className="font-semibold">{(Math.floor(fatorExpAnual2 * 10000) / 10000).toFixed(4)}…</span> <span className="font-sans normal-case text-neutral-500">(annual factor)</span></p>
                  <p className="text-xs text-neutral-600">Interval = <strong>{perDerivado2}</strong> (years)</p>
                  <p className="font-sans normal-case text-neutral-600 pt-1">The rate went from <strong>{txInicialGrupo2.toFixed(1)}%</strong> to <strong>{txExpAnual2.toFixed(1)}%</strong> in the interval between <strong>{pi2}</strong> and <strong>{pf2}</strong> years.</p>
                </div>
              </div>
            )}
          </div>
        );
      })()}
      {(vals.adicionar_intervalo_3 ?? 0) === 1 && (() => {
        const txInicialGrupo2Q3 = vals.tx_mortalidade_final_1 ?? 0.5;
        const txExpInicialGrupo2 = txExpAnualCalculado != null ? Math.pow(txExpAnualCalculado, expoenteTxExpAnual) * txInicialVal : txInicialVal;
        const minI2 = periodoFinalVal;
        const maxR = 20000;
        const pi2 = clamp(minI2, vals.periodo_i2 ?? 101, maxR);
        const pf2 = clamp(pi2, vals.periodo_f2 ?? 200, maxR);
        const txFinalVal2 = vals.tx_mortalidade_final_2 ?? 0.5;
        const intervalo2ResultQ3 = computeIntervaloTaxa({ tx_inicial: txInicialGrupo2Q3, periodo_i: pi2, periodo_f: pf2, tx_final: txFinalVal2, periodoSeguinte: true });
        const txExpAnual2 = intervalo2ResultQ3?.tx_anual_fim ?? txFinalVal2;
        const txInicialGrupo3 = vals.tx_mortalidade_final_2 ?? 0.5;
        const minI3 = vals.periodo_f2 ?? 200;
        const pi3 = clamp(minI3, vals.periodo_i3 ?? 200, maxR);
        const pf3 = clamp(pi3, vals.periodo_f3 ?? 300, maxR);
        const txFinalVal3 = vals.tx_mortalidade_final_3 ?? 0.5;
        const intervalo3Result = computeIntervaloTaxa({ tx_inicial: txInicialGrupo3, periodo_i: pi3, periodo_f: pf3, tx_final: txFinalVal3, periodoSeguinte: true });
        const perDerivado3 = intervalo3Result?.per_de_mod ?? Math.max(1, Math.floor(pf3 - pi3));
        const fatorExpAnual3 = intervalo3Result?.fator_anual ?? 1;
        const txExpAnual3 = intervalo3Result?.tx_anual_fim ?? txFinalVal3;
        return (
          <div className="mt-3 pt-3 border-t border-neutral-300">
            <button type="button" onClick={() => setExpandPeriodo3Quadro1((b) => !b)} className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800">
              <span className="shrink-0">{expandPeriodo3Quadro1 ? "▼" : "▶"}</span><span>Period 3</span>
            </button>
            {expandPeriodo3Quadro1 && (
              <div className="flex flex-col gap-2 mt-2 pl-4">
                <p className="text-sm font-mono text-neutral-700">initial_mortality_rate_3 (%) = <span className="font-semibold">{formatQuadro5Val(vals.tx_mortalidade_final_2 ?? 0.5)}</span></p>
                {(() => {
                  const keyQ13 = "tx_mortalidade_final_3";
                  const storedVal3 = Number.isNaN(txFinalVal3) ? 2.5 : txFinalVal3;
                  const displayStr3 = keyQ13 in quadro1Edit ? quadro1Edit[keyQ13] : formatQuadro5Val(storedVal3);
                  const applyQ13 = () => {
                    const s = quadro1Edit[keyQ13];
                    setQuadro1Edit((prev) => { const next = { ...prev }; delete next[keyQ13]; return next; });
                    if (s === "" || s === ".") return;
                    const num = Number(s);
                    if (!Number.isFinite(num)) return;
                    const v = Math.round(Math.max(0, Math.min(50, num)) * 10) / 10;
                    setInputValues((prev) => { const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>); return { ...prev, [script.id]: { ...current, [keyQ13]: v } }; });
                  };
                  return (
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                      <span>final_mortality_rate_3 (%):</span>
                      <input type="text" inputMode="decimal" value={displayStr3} onFocus={() => setQuadro1Edit((prev) => ({ ...prev, [keyQ13]: formatQuadro5Val(storedVal3) }))} onChange={(e) => setQuadro1Edit((prev) => ({ ...prev, [keyQ13]: filterQuadro5Input(e.target.value) }))} onBlur={applyQ13} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQ13(); (e.target as HTMLInputElement).blur(); } }} className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0" />
                      <span className="text-neutral-500 font-mono text-xs shrink-0">[0, 50]</span>
                    </label>
                  );
                })()}
                <div className="w-full space-y-1 text-sm font-mono text-neutral-700 border-t border-neutral-300 pt-2 mt-1">
                  <p>annual_mortality_factor_3 = <span className="font-semibold">{(Math.floor(fatorExpAnual3 * 10000) / 10000).toFixed(4)}…</span> <span className="font-sans normal-case text-neutral-500">(annual factor)</span></p>
                  <p className="text-xs text-neutral-600">Interval = <strong>{perDerivado3}</strong> (years)</p>
                  <p className="font-sans normal-case text-neutral-600 pt-1">The rate went from <strong>{txInicialGrupo3.toFixed(1)}%</strong> to <strong>{txExpAnual3.toFixed(1)}%</strong> in the interval between <strong>{pi3}</strong> and <strong>{pf3}</strong> years.</p>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/** Conteúdo expandível do Quadro 5 (Mortalidade por velhice). */
function Quadro5ConteudoInline({
  script,
  inputValues,
  setInputValues,
  vals,
  quadro5Edit,
  setQuadro5Edit,
  expandPeriodo2Quadro5,
  setExpandPeriodo2Quadro5,
  expandPeriodo3Quadro5,
  setExpandPeriodo3Quadro5,
  setShowMortalidadeVelhiceHelp,
}: {
  script: ScriptDef;
  inputValues: Record<string, Record<string, number>>;
  setInputValues: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  vals: Record<string, number>;
  quadro5Edit: Record<string, string>;
  setQuadro5Edit: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  expandPeriodo2Quadro5: boolean;
  setExpandPeriodo2Quadro5: React.Dispatch<React.SetStateAction<boolean>>;
  expandPeriodo3Quadro5: boolean;
  setExpandPeriodo3Quadro5: React.Dispatch<React.SetStateAction<boolean>>;
  setShowMortalidadeVelhiceHelp: (v: boolean) => void;
}) {
  const idadeFertilMaxVal = Number(inputValues[script.id]?.idade_fertil_max ?? script.inputs.find((i) => i.key === "idade_fertil_max")?.default ?? 50);
  const idadeInicioVelhice = idadeFertilMaxVal + 1;
  const renderInput = (key: "max_idade" | "fragilidade_inicial" | "taxa_envelhecimento" | "max_idade_2" | "fragilidade_inicial_2" | "taxa_envelhecimento_2" | "max_idade_3" | "fragilidade_inicial_3" | "taxa_envelhecimento_3") => {
    const input = script.inputs.find((i) => i.key === key)!;
    const d = input.default;
    const rawVal = inputValues[script.id]?.[key];
    const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
    const step = input.step ?? 1;
    const decimals = step < 1 ? 4 : 0;
    const isEditing = key in quadro5Edit;
    const displayStr = isEditing ? quadro5Edit[key] : formatQuadro5Val(storedVal);
    const applyQuadro5 = () => {
      const s = quadro5Edit[key];
      setQuadro5Edit((prev) => { const next = { ...prev }; delete next[key]; return next; });
      if (s === "" || s === ".") return;
      const num = Number(s);
      if (!Number.isFinite(num)) return;
      const v = step < 1 ? Math.round(num * 10 ** decimals) / 10 ** decimals : Math.round(num);
      const clamped = input.min != null && v < input.min ? input.min : input.max != null && v > input.max ? input.max : v;
      setInputValues((prev) => {
        const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
        return { ...prev, [script.id]: { ...current, [key]: clamped } };
      });
    };
    return (
      <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
        <span>{input.label}:</span>
        <input type="text" inputMode="decimal" value={displayStr} onFocus={() => setQuadro5Edit((prev) => ({ ...prev, [key]: formatQuadro5Val(storedVal) }))} onChange={(e) => setQuadro5Edit((prev) => ({ ...prev, [key]: filterQuadro5Input(e.target.value) }))} onBlur={applyQuadro5} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuadro5(); (e.target as HTMLInputElement).blur(); } }} className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0" />
        {input.min != null && input.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input.min}, {input.max}]</span>}
      </label>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium text-neutral-700">idade_inicio_velhice = <span className="font-mono font-semibold">{idadeInicioVelhice}</span></div>
      {(["max_idade", "fragilidade_inicial", "taxa_envelhecimento"] as const).map(renderInput)}
      {(vals.adicionar_intervalo_2 ?? 0) === 1 && (
        <div className="mt-3 pt-3 border-t border-neutral-300">
          <button type="button" onClick={() => setExpandPeriodo2Quadro5((b) => !b)} className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800">
            <span className="shrink-0">{expandPeriodo2Quadro5 ? "▼" : "▶"}</span><span>Period 2</span>
          </button>
          {expandPeriodo2Quadro5 && <div className="flex flex-col gap-2 mt-2 pl-4">{(["max_idade_2", "fragilidade_inicial_2", "taxa_envelhecimento_2"] as const).map(renderInput)}</div>}
        </div>
      )}
      {(vals.adicionar_intervalo_3 ?? 0) === 1 && (
        <div className="mt-3 pt-3 border-t border-neutral-300">
          <button type="button" onClick={() => setExpandPeriodo3Quadro5((b) => !b)} className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800">
            <span className="shrink-0">{expandPeriodo3Quadro5 ? "▼" : "▶"}</span><span>Period 3</span>
          </button>
          {expandPeriodo3Quadro5 && <div className="flex flex-col gap-2 mt-2 pl-4">{(["max_idade_3", "fragilidade_inicial_3", "taxa_envelhecimento_3"] as const).map(renderInput)}</div>}
        </div>
      )}
    </div>
  );
}

/** Conteúdo expandível do Quadro 2 (Reprodução). */
function Quadro2ConteudoInline({
  script,
  inputValues,
  setInputValues,
  vals,
  quadro2Edit,
  setQuadro2Edit,
  expandPeriodo2Quadro2,
  setExpandPeriodo2Quadro2,
  expandPeriodo3Quadro2,
  setExpandPeriodo3Quadro2,
  setShowReproHelp,
}: {
  script: ScriptDef;
  inputValues: Record<string, Record<string, number>>;
  setInputValues: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  vals: Record<string, number>;
  quadro2Edit: Record<string, string>;
  setQuadro2Edit: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  expandPeriodo2Quadro2: boolean;
  setExpandPeriodo2Quadro2: React.Dispatch<React.SetStateAction<boolean>>;
  expandPeriodo3Quadro2: boolean;
  setExpandPeriodo3Quadro2: React.Dispatch<React.SetStateAction<boolean>>;
  setShowReproHelp: (v: boolean) => void;
}) {
  const renderInput = (key: string) => {
    const input = script.inputs.find((i) => i.key === key)!;
    const d = input.default;
    const rawVal = inputValues[script.id]?.[key];
    const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
    const step = input.step ?? 1;
    const decimals = step < 1 ? 4 : 0;
    const displayStr = key in quadro2Edit ? quadro2Edit[key] : formatQuadro5Val(storedVal);
    const applyQuadro2 = () => {
      const s = quadro2Edit[key];
      setQuadro2Edit((prev) => { const next = { ...prev }; delete next[key]; return next; });
      if (s === "" || s === ".") return;
      const num = Number(s);
      if (!Number.isFinite(num)) return;
      const v = step < 1 ? Math.round(num * 10 ** decimals) / 10 ** decimals : Math.round(num);
      const clamped = input.min != null && v < input.min ? input.min : input.max != null && v > input.max ? input.max : v;
      setInputValues((prev) => {
        const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
        return { ...prev, [script.id]: { ...current, [key]: clamped } };
      });
    };
    return (
      <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
        <span>{input.label}:</span>
        <input type="text" inputMode="decimal" value={displayStr} onFocus={() => setQuadro2Edit((prev) => ({ ...prev, [key]: formatQuadro5Val(storedVal) }))} onChange={(e) => setQuadro2Edit((prev) => ({ ...prev, [key]: filterQuadro5Input(e.target.value) }))} onBlur={applyQuadro2} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuadro2(); (e.target as HTMLInputElement).blur(); } }} className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0" />
        {input.min != null && input.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input.min}, {input.max}]</span>}
      </label>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      {(["idade_fertil_min", "idade_fertil_max", "idade_fertil_pico", "prob_anual_reproducao"] as const).map(renderInput)}
      {(vals.adicionar_intervalo_2 ?? 0) === 1 && (
        <div className="mt-3 pt-3 border-t border-neutral-300">
          <button type="button" onClick={() => setExpandPeriodo2Quadro2((b) => !b)} className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800">
            <span className="shrink-0">{expandPeriodo2Quadro2 ? "▼" : "▶"}</span><span>Period 2</span>
          </button>
          {expandPeriodo2Quadro2 && <div className="flex flex-col gap-2 mt-2 pl-4">{(["idade_fertil_min_2", "idade_fertil_max_2", "idade_fertil_pico_2", "prob_anual_reproducao_2"] as const).map(renderInput)}</div>}
        </div>
      )}
      {(vals.adicionar_intervalo_3 ?? 0) === 1 && (
        <div className="mt-3 pt-3 border-t border-neutral-300">
          <button type="button" onClick={() => setExpandPeriodo3Quadro2((b) => !b)} className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800">
            <span className="shrink-0">{expandPeriodo3Quadro2 ? "▼" : "▶"}</span><span>Period 3</span>
          </button>
          {expandPeriodo3Quadro2 && <div className="flex flex-col gap-2 mt-2 pl-4">{(["idade_fertil_min_3", "idade_fertil_max_3", "idade_fertil_pico_3", "prob_anual_reproducao_3"] as const).map(renderInput)}</div>}
        </div>
      )}
    </div>
  );
}

/** Conteúdo expandível do Quadro 6 (Fator continental de mortalidade). */
function Quadro6ConteudoInline({
  script,
  inputValues,
  setInputValues,
  vals,
  expandPeriodo2Quadro6,
  setExpandPeriodo2Quadro6,
  expandPeriodo3Quadro6,
  setExpandPeriodo3Quadro6,
  setShowQuadro6Help,
}: {
  script: ScriptDef;
  inputValues: Record<string, Record<string, number>>;
  setInputValues: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  vals: Record<string, number>;
  expandPeriodo2Quadro6: boolean;
  setExpandPeriodo2Quadro6: React.Dispatch<React.SetStateAction<boolean>>;
  expandPeriodo3Quadro6: boolean;
  setExpandPeriodo3Quadro6: React.Dispatch<React.SetStateAction<boolean>>;
  setShowQuadro6Help: (v: boolean) => void;
}) {
  const t = getBioT(useBioLang()).sistema;
  const habilitado = (vals.fator_continental_habilitado ?? 0) === 1;
  const keysPer1 = ["fator_mortalidade_cor0", "fator_mortalidade_cor1", "fator_mortalidade_cor2", "fator_mortalidade_cor3", "fator_mortalidade_cor4", "fator_mortalidade_cor5", "fator_mortalidade_cor6"] as const;
  const keysPer2 = ["fator_mortalidade_cor0_2", "fator_mortalidade_cor1_2", "fator_mortalidade_cor2_2", "fator_mortalidade_cor3_2", "fator_mortalidade_cor4_2", "fator_mortalidade_cor5_2", "fator_mortalidade_cor6_2"] as const;
  const keysPer3 = ["fator_mortalidade_cor0_3", "fator_mortalidade_cor1_3", "fator_mortalidade_cor2_3", "fator_mortalidade_cor3_3", "fator_mortalidade_cor4_3", "fator_mortalidade_cor5_3", "fator_mortalidade_cor6_3"] as const;
  const renderInput = (key: string) => {
    const input = script.inputs.find((i) => i.key === key)!;
    const d = input.default;
    const rawVal = inputValues[script.id]?.[key];
    const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
    return (
      <label key={key} className={`flex items-center gap-2 text-sm ${habilitado ? "text-neutral-700" : "text-neutral-500"}`}>
        <span className="w-32 shrink-0">{input.label}:</span>
        <input
          type="number"
          step={0.0001}
          min={0}
          max={2}
          value={storedVal}
          disabled={!habilitado}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            const clamped = clamp(0, v, 2);
            setInputValues((prev) => {
              const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
              return { ...prev, [script.id]: { ...current, [key]: clamped } };
            });
          }}
          className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm font-mono disabled:bg-neutral-200 disabled:cursor-not-allowed"
        />
        <span className="text-neutral-500 font-mono text-xs shrink-0">[0, 2.0000]</span>
      </label>
    );
  };
  const toggleKey = "fator_continental_habilitado";
  const defaultFatorContinental = script.inputs.find((i) => i.key === toggleKey)?.default ?? 0;
  const toggleVal = (inputValues[script.id]?.[toggleKey] ?? defaultFatorContinental) === 1;
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer select-none">
        <span className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${toggleVal ? "bg-emerald-500" : "bg-neutral-300"}`} aria-hidden>
          <input
            type="checkbox"
            checked={toggleVal}
            onChange={(e) => {
              const v = e.target.checked ? 1 : 0;
              setInputValues((prev) => {
                const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                return { ...prev, [script.id]: { ...current, [toggleKey]: v } };
              });
            }}
            className="sr-only peer"
            aria-label={t.continentalEnableToggle}
          />
          <span className={`pointer-events-none absolute left-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${toggleVal ? "translate-x-4" : "translate-x-0"}`} />
        </span>
        <span>{t.continentalFactorLabel} <strong>{toggleVal ? t.continentalEnabled : t.continentalDisabled}</strong></span>
      </label>
      {!habilitado && (
        <p className="text-xs text-neutral-500 italic">{t.continentalDisabledNote}</p>
      )}
      {keysPer1.map(renderInput)}
      {(vals.adicionar_intervalo_2 ?? 0) === 1 && (
        <div className="mt-3 pt-3 border-t border-neutral-300">
          <button type="button" onClick={() => setExpandPeriodo2Quadro6((b) => !b)} className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800">
            <span className="shrink-0">{expandPeriodo2Quadro6 ? "▼" : "▶"}</span><span>Period 2</span>
          </button>
          {expandPeriodo2Quadro6 && <div className="flex flex-col gap-2 mt-2 pl-4">{keysPer2.map(renderInput)}</div>}
        </div>
      )}
      {(vals.adicionar_intervalo_3 ?? 0) === 1 && (
        <div className="mt-3 pt-3 border-t border-neutral-300">
          <button type="button" onClick={() => setExpandPeriodo3Quadro6((b) => !b)} className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800">
            <span className="shrink-0">{expandPeriodo3Quadro6 ? "▼" : "▶"}</span><span>Period 3</span>
          </button>
          {expandPeriodo3Quadro6 && <div className="flex flex-col gap-2 mt-2 pl-4">{keysPer3.map(renderInput)}</div>}
        </div>
      )}
    </div>
  );
}

/** Conteúdo expandível do Quadro 3 (Deslocamento). */
function Quadro3ConteudoInline({
  script,
  inputValues,
  setInputValues,
  vals,
  quadro3Edit,
  setQuadro3Edit,
  expandPeriodo2Quadro3,
  setExpandPeriodo2Quadro3,
  expandPeriodo3Quadro3,
  setExpandPeriodo3Quadro3,
  setShowDeslocamentoHelp,
}: {
  script: ScriptDef;
  inputValues: Record<string, Record<string, number>>;
  setInputValues: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  vals: Record<string, number>;
  quadro3Edit: Record<string, string>;
  setQuadro3Edit: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  expandPeriodo2Quadro3: boolean;
  setExpandPeriodo2Quadro3: React.Dispatch<React.SetStateAction<boolean>>;
  expandPeriodo3Quadro3: boolean;
  setExpandPeriodo3Quadro3: React.Dispatch<React.SetStateAction<boolean>>;
  setShowDeslocamentoHelp: (v: boolean) => void;
}) {
  const renderInput = (key: string) => {
    const input = script.inputs.find((i) => i.key === key)!;
    const d = input.default;
    const rawVal = inputValues[script.id]?.[key];
    const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
    const step = input.step ?? 1;
    const decimals = step < 1 ? 4 : 0;
    const displayStr = key in quadro3Edit ? quadro3Edit[key] : formatQuadro5Val(storedVal);
    const applyQuadro3 = () => {
      const s = quadro3Edit[key];
      setQuadro3Edit((prev) => { const next = { ...prev }; delete next[key]; return next; });
      if (s === "" || s === ".") return;
      const num = Number(s);
      if (!Number.isFinite(num)) return;
      const v = step < 1 ? Math.round(num * 10 ** decimals) / 10 ** decimals : Math.round(num);
      const clamped = input.min != null && v < input.min ? input.min : input.max != null && v > input.max ? input.max : v;
      setInputValues((prev) => {
        const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
        return { ...prev, [script.id]: { ...current, [key]: clamped } };
      });
    };
    return (
      <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
        <span>{input.label}:</span>
        <input type="text" inputMode="decimal" value={displayStr} onFocus={() => setQuadro3Edit((prev) => ({ ...prev, [key]: formatQuadro5Val(storedVal) }))} onChange={(e) => setQuadro3Edit((prev) => ({ ...prev, [key]: filterQuadro5Input(e.target.value) }))} onBlur={applyQuadro3} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuadro3(); (e.target as HTMLInputElement).blur(); } }} className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0" />
        {input.min != null && input.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input.min}, {input.max}]</span>}
      </label>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      {["dispersao_anual_media", "qtde_direcoes"].map(renderInput)}
      {(vals.adicionar_intervalo_2 ?? 0) === 1 && (
        <div className="mt-3 pt-3 border-t border-neutral-300">
          <button type="button" onClick={() => setExpandPeriodo2Quadro3((b) => !b)} className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800">
            <span className="shrink-0">{expandPeriodo2Quadro3 ? "▼" : "▶"}</span><span>Period 2</span>
          </button>
          {expandPeriodo2Quadro3 && <div className="flex flex-col gap-2 mt-2 pl-4">{["dispersao_anual_media_2"].map(renderInput)}</div>}
        </div>
      )}
      {(vals.adicionar_intervalo_3 ?? 0) === 1 && (
        <div className="mt-3 pt-3 border-t border-neutral-300">
          <button type="button" onClick={() => setExpandPeriodo3Quadro3((b) => !b)} className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800">
            <span className="shrink-0">{expandPeriodo3Quadro3 ? "▼" : "▶"}</span><span>Period 3</span>
          </button>
          {expandPeriodo3Quadro3 && <div className="flex flex-col gap-2 mt-2 pl-4">{["dispersao_anual_media_3"].map(renderInput)}</div>}
        </div>
      )}
    </div>
  );
}

/** Conteúdo expandível do Quadro 4 (Fecundidade do parto). */
function Quadro4ConteudoInline({
  script,
  inputValues,
  setInputValues,
  vals,
  quadro4Edit,
  setQuadro4Edit,
  expandPeriodo2Quadro4,
  setExpandPeriodo2Quadro4,
  expandPeriodo3Quadro4,
  setExpandPeriodo3Quadro4,
  setShowFecundidadePartoHelp,
}: {
  script: ScriptDef;
  inputValues: Record<string, Record<string, number>>;
  setInputValues: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  vals: Record<string, number>;
  quadro4Edit: Record<string, string>;
  setQuadro4Edit: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  expandPeriodo2Quadro4: boolean;
  setExpandPeriodo2Quadro4: React.Dispatch<React.SetStateAction<boolean>>;
  expandPeriodo3Quadro4: boolean;
  setExpandPeriodo3Quadro4: React.Dispatch<React.SetStateAction<boolean>>;
  setShowFecundidadePartoHelp: (v: boolean) => void;
}) {
  const renderInput = (key: string) => {
    const input = script.inputs.find((i) => i.key === key)!;
    const d = input.default;
    const rawVal = inputValues[script.id]?.[key];
    const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
    const step = input.step ?? 1;
    const decimals = step < 1 ? 4 : 0;
    const displayStr = key in quadro4Edit ? quadro4Edit[key] : formatQuadro5Val(storedVal);
    const applyQuadro4 = () => {
      const s = quadro4Edit[key];
      setQuadro4Edit((prev) => { const next = { ...prev }; delete next[key]; return next; });
      if (s === "" || s === ".") return;
      const num = Number(s);
      if (!Number.isFinite(num)) return;
      const v = step < 1 ? Math.round(num * 10 ** decimals) / 10 ** decimals : Math.round(num);
      const clamped = input.min != null && v < input.min ? input.min : input.max != null && v > input.max ? input.max : v;
      setInputValues((prev) => {
        const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
        return { ...prev, [script.id]: { ...current, [key]: clamped } };
      });
    };
    return (
      <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
        <span>{input.label}:</span>
        <input type="text" inputMode="decimal" value={displayStr} onFocus={() => setQuadro4Edit((prev) => ({ ...prev, [key]: formatQuadro5Val(storedVal) }))} onChange={(e) => setQuadro4Edit((prev) => ({ ...prev, [key]: filterQuadro5Input(e.target.value) }))} onBlur={applyQuadro4} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuadro4(); (e.target as HTMLInputElement).blur(); } }} className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0" />
        {input.min != null && input.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input.min}, {input.max}]</span>}
      </label>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      {(["tx_decaimento_pos_pico", "fecundidade_media_parto", "fecundidade_max_parto"] as const).map(renderInput)}
      {(vals.adicionar_intervalo_2 ?? 0) === 1 && (
        <div className="mt-3 pt-3 border-t border-neutral-300">
          <button type="button" onClick={() => setExpandPeriodo2Quadro4((b) => !b)} className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800">
            <span className="shrink-0">{expandPeriodo2Quadro4 ? "▼" : "▶"}</span><span>Period 2</span>
          </button>
          {expandPeriodo2Quadro4 && <div className="flex flex-col gap-2 mt-2 pl-4">{(["tx_decaimento_pos_pico_2", "fecundidade_media_parto_2", "fecundidade_max_parto_2"] as const).map(renderInput)}</div>}
        </div>
      )}
      {(vals.adicionar_intervalo_3 ?? 0) === 1 && (
        <div className="mt-3 pt-3 border-t border-neutral-300">
          <button type="button" onClick={() => setExpandPeriodo3Quadro4((b) => !b)} className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800">
            <span className="shrink-0">{expandPeriodo3Quadro4 ? "▼" : "▶"}</span><span>Period 3</span>
          </button>
          {expandPeriodo3Quadro4 && <div className="flex flex-col gap-2 mt-2 pl-4">{(["tx_decaimento_pos_pico_3", "fecundidade_media_parto_3", "fecundidade_max_parto_3"] as const).map(renderInput)}</div>}
        </div>
      )}
    </div>
  );
}

export default function SimuladorGenesisClient(props: { apiRun?: string; embedMode?: boolean; configSidebarId?: string; configPanelId?: string; mapBottomRightOverlay?: React.ReactNode } = {}) {
  const lang = useBioLang();
  const tSistema = getBioT(lang).sistema;
  const apiRun = props.apiRun ?? DEFAULT_API_RUN;
  const embedMode = props.embedMode ?? false;
  const configSidebarId = props.configSidebarId;
  const configPanelId = props.configPanelId;
  const mapBottomRightOverlay = props.mapBottomRightOverlay;
  const [inputValues, setInputValues] = useState<Record<string, Record<string, number>>>({});
  /** Valores em edição nos inputs do Quadro 5 (aplicados só em blur/Enter). Chave = key do input. */
  const [quadro5Edit, setQuadro5Edit] = useState<Record<string, string>>({});
  const [quadro2Edit, setQuadro2Edit] = useState<Record<string, string>>({});
  const [quadro3Edit, setQuadro3Edit] = useState<Record<string, string>>({});
  const [quadro4Edit, setQuadro4Edit] = useState<Record<string, string>>({});
  const [quadro1Edit, setQuadro1Edit] = useState<Record<string, string>>({});
  const [expandExecButtonsOverlay, setExpandExecButtonsOverlay] = useState(true);
  const [expandPeriodo2Quadro1, setExpandPeriodo2Quadro1] = useState(false);
  const [expandPeriodo3Quadro1, setExpandPeriodo3Quadro1] = useState(false);
  const [expandPeriodo2Quadro2, setExpandPeriodo2Quadro2] = useState(false);
  const [expandPeriodo3Quadro2, setExpandPeriodo3Quadro2] = useState(false);
  const [expandPeriodo2Quadro3, setExpandPeriodo2Quadro3] = useState(false);
  const [expandPeriodo3Quadro3, setExpandPeriodo3Quadro3] = useState(false);
  const [expandPeriodo2Quadro4, setExpandPeriodo2Quadro4] = useState(false);
  const [expandPeriodo3Quadro4, setExpandPeriodo3Quadro4] = useState(false);
  /** Resultado final da última execução apenas. As estatísticas usam só este valor: não guardamos histórico nem resultados intermediários, pois o reagruparVetores agrega/remove entradas e não dá para recalcular estados anteriores. */
  const [genesisResult, setGenesisResult] = useState<{ vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; especie: EspecieParams; resultadoPorId: ResultadoReproducaoPorId; mortesAcumuladas?: number } | null>(null);
  const [mapaNumero, setMapaNumero] = useState(1);
  const [mapaPretas, setMapaPretas] = useState<MapaAreasPretas | null>(null);
  const [indiceGrid, setIndiceGrid] = useState<number[] | null>(null);
  const [indiceBranco, setIndiceBranco] = useState<number>(1);
  const [showMask, setShowMask] = useState(false);
  const [iteracao, setIteracao] = useState(0);
  const [getStartMode, setGetStartMode] = useState(false);
  const [mapMessage, setMapMessage] = useState<string | null>(null);
  const ID_ORIGEM_INICIAL = "origem-inicial";
  type OrigemAgendadaItem = { id: string; ano: number; x0_km: number; y0_km: number; idade: number; quantidadePares: number };
  const [origensAgendadas, setOrigensAgendadas] = useState<OrigemAgendadaItem[]>(() => {
    const sc = SCRIPTS.find((s) => s.id === SCRIPT_GENESIS_ID);
    const ano = (sc?.inputs.find((i) => i.key === "periodo_i1")?.default ?? -100) as number;
    const idade = Math.max(0, ((sc?.inputs.find((i) => i.key === "idade_fertil_min")?.default ?? 22) as number) - 1);
    const x0 = (sc?.inputs.find((i) => i.key === "x0")?.default ?? 23440) as number;
    const y0 = (sc?.inputs.find((i) => i.key === "y0")?.default ?? 14970) as number;
    return [{ id: ID_ORIGEM_INICIAL, ano, x0_km: x0, y0_km: y0, idade, quantidadePares: 1 }];
  });
  const [pendingOrigem, setPendingOrigem] = useState<{ x_km: number; y_km: number } | null>(null);
  const [editingOrigemId, setEditingOrigemId] = useState<string | null>(null);
  const [repositioningOrigemId, setRepositioningOrigemId] = useState<string | null>(null);
  const [formOrigemAno, setFormOrigemAno] = useState(0);
  const [formOrigemIdade, setFormOrigemIdade] = useState(21);
  const [formOrigemQuantidadePares, setFormOrigemQuantidadePares] = useState(1);
  const [ultimoResultadoMapa, setUltimoResultadoMapa] = useState<{ vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[] } | null>(null);
  const [mapDisplayByYear, setMapDisplayByYear] = useState<Record<string, MapDisplayYearRow> | null>(null);
  const [showReproHelp, setShowReproHelp] = useState(false);
  const [showDeslocamentoHelp, setShowDeslocamentoHelp] = useState(false);
  const [showFecundidadePartoHelp, setShowFecundidadePartoHelp] = useState(false);
  const [showMortalidadeVelhiceHelp, setShowMortalidadeVelhiceHelp] = useState(false);
  const [showQuadro1MortalidadeHelp, setShowQuadro1MortalidadeHelp] = useState(false);
  const [showQuadro0PeriodosHelp, setShowQuadro0PeriodosHelp] = useState(false);
  const [showConfigLockedModal, setShowConfigLockedModal] = useState(false);
  const [debugGenesisAtivo, setDebugGenesisAtivo] = useState(false);
  const [expandPeriodo2Quadro5, setExpandPeriodo2Quadro5] = useState(false);
  const [expandPeriodo3Quadro5, setExpandPeriodo3Quadro5] = useState(false);
  const [expandPeriodo2Quadro6, setExpandPeriodo2Quadro6] = useState(false);
  const [expandPeriodo3Quadro6, setExpandPeriodo3Quadro6] = useState(false);
  const [showQuadro6Help, setShowQuadro6Help] = useState(false);
  const [expandQuadro0, setExpandQuadro0] = useState(false);
  const [expandQuadro1, setExpandQuadro1] = useState(false);
  const [expandQuadro2, setExpandQuadro2] = useState(false);
  const [expandQuadro3, setExpandQuadro3] = useState(false);
  const [expandQuadro4, setExpandQuadro4] = useState(false);
  const [expandQuadro5, setExpandQuadro5] = useState(false);
  const [expandQuadro6, setExpandQuadro6] = useState(false);
  const [expandOrigemMenu, setExpandOrigemMenu] = useState(false);
  const [expandConfigSaved, setExpandConfigSaved] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadConfigLoading, setLoadConfigLoading] = useState(false);
  const [showSaveConfigModal, setShowSaveConfigModal] = useState(false);
  const [saveConfigName, setSaveConfigName] = useState("");
  const [saveConfigPrivate, setSaveConfigPrivate] = useState(true);
  const [saveConfigError, setSaveConfigError] = useState<string | null>(null);
  const [saveConfigLoading, setSaveConfigLoading] = useState(false);
  const [savedConfigsList, setSavedConfigsList] = useState<{ id: string; name: string; private: boolean; likes: number; createdAt: string; updatedAt: string; isOwner: boolean }[]>([]);
  const [savedConfigsLoading, setSavedConfigsLoading] = useState(false);
  const [deleteConfigPending, setDeleteConfigPending] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfigLoading, setDeleteConfigLoading] = useState(false);
  const [showGlobalConfigModal, setShowGlobalConfigModal] = useState(false);
  const [globalConfigsList, setGlobalConfigsList] = useState<{ id: string; name: string; likes: number; ownerNickname: string | null }[]>([]);
  const [globalConfigsLoading, setGlobalConfigsLoading] = useState(false);
  const [globalConfigSearch, setGlobalConfigSearch] = useState("");
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  /** Quando true, não exibe o modal de Enviando…/Executado com sucesso (execução direta, sem fila). */
  const [skipExecModalForDirect, setSkipExecModalForDirect] = useState(false);
  const [showInsufficientCoinsModal, setShowInsufficientCoinsModal] = useState(false);
  const [insufficientCoinsAmount, setInsufficientCoinsAmount] = useState(1);
  const [execDebugLog, setExecDebugLog] = useState<string[]>([]);
  const [genesisDebugLog, setGenesisDebugLog] = useState<string[]>([]);
  const [genesisGrupoDebugLog, setGenesisGrupoDebugLog] = useState<string[]>([]);
  const [performanceDebugLog, setPerformanceDebugLog] = useState<string[]>([]);
  const [mortesAcumLog, setMortesAcumLog] = useState<{ iteracao: number; mortesAcumuladas: number; anterior: number; regressao: boolean; origem: string; iterEnviada: number }[]>([]);
  const [mapaDebugInfo, setMapaDebugInfo] = useState<{
    mapaNumero: number;
    pixelsValidos: number;
    indiceBranco: number;
    regiaoSize: number;
    coresUnicas: number;
  } | null>(null);
  const bioDebug = useBioDebug();
  const { setPanelHasContent, configClickExtraRef } = useMapOverlay();
  /** Menor id entre indivíduos com genero=0 e qtde=1 (para debug); null se não houver estado ou nenhum candidato. */
  const debugGenesisIdMinGenero0Qtde1 = useMemo(() => {
    if (!genesisResult) return null;
    let minId = Infinity;
    const v1 = genesisResult.vetor1;
    const v2 = genesisResult.vetor2;
    for (let i = 0; i < v1.length; i++) {
      const ind = v1[i]!;
      if (ind.genero === 0 && ind.qtde === 1 && ind.id < minId) minId = ind.id;
    }
    for (let i = 0; i < v2.length; i++) {
      const ind = v2[i]!;
      if (ind.genero === 0 && ind.qtde === 1 && ind.id < minId) minId = ind.id;
    }
    return minId === Infinity ? null : minId;
  }, [genesisResult]);
  const addExecLog = useCallback((msg: string) => {
    if (!bioDebug?.flags.execLog) return;
    const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
    setExecDebugLog((prev) => [line, ...prev].slice(0, 30));
  }, [bioDebug?.flags.execLog]);
  const execContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!bioDebug?.flags.execLog) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const inExec = execContainerRef.current?.contains(t);
      const refExists = !!execContainerRef.current;
      const desc = t ? `${t.tagName}${t.id ? "#" + t.id : ""}${t.className ? "." + String(t.className).split(" ")[0] : ""}` : "?";
      if (inExec) {
        addExecLog(`DOC click DENTRO exec → ${desc} (ref=${refExists})`);
      } else if (refExists && e.clientY < 80) {
        addExecLog(`DOC click TOPO mas FORA exec → ${desc} (y=${e.clientY})`);
      }
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [addExecLog, bioDebug?.flags.execLog]);
  const executingRef = useRef(false); // Bloqueia cliques duplos antes do re-render
  /** Último estado aplicado, atualizado ao processar resposta (antes do setState). Assim o próximo clique usa iter/mortes corretos mesmo antes do re-render. */
  const latestIteracaoRef = useRef(0);
  const latestGenesisResultRef = useRef<typeof genesisResult>(null);

  /** Aplica resultado vindo da fila (job COMPLETED) ao estado e refs para atualizar o mapa. */
  const applyQueueResult = useCallback(
    (result: {
      vetor1: GenesisIndividual[];
      vetor2: GenesisIndividual[];
      especie: EspecieParams;
      resultadoPorId?: ResultadoReproducaoPorId;
      iteracao: number;
      mortesAcumuladas?: number;
      /** Para 20x/100x/1000x: servidor envia mapDisplayByYear completo (acumulado em memória). Merge com estado. */
      mapDisplayByYear?: Record<string, MapDisplayYearRow>;
    }) => {
      const res = {
        vetor1: result.vetor1,
        vetor2: result.vetor2,
        especie: result.especie,
        resultadoPorId: result.resultadoPorId ?? {},
        mortesAcumuladas: result.mortesAcumuladas ?? 0,
      };
      setGenesisResult(res);
      setUltimoResultadoMapa({ vetor1: result.vetor1, vetor2: result.vetor2 });
      setIteracao(result.iteracao);
      latestIteracaoRef.current = result.iteracao;
      latestGenesisResultRef.current = res;
      if (result.mapDisplayByYear != null && typeof result.mapDisplayByYear === "object" && Object.keys(result.mapDisplayByYear).length > 0) {
        setMapDisplayByYear((prev) => ({ ...prev, ...result.mapDisplayByYear }));
      } else {
        const yearEntry = computeMapDisplayYear(result.vetor1, result.vetor2, res.resultadoPorId);
        setMapDisplayByYear((prev) => ({ ...prev, [String(result.iteracao)]: yearEntry }));
      }
    },
    []
  );
  const medicaoRenderizacaoRef = useRef<{ iteracao: number; inicio: number } | null>(null);
  /** Após mount, os alvos do portal (sidebar/panel) existem no DOM; usamos isso para portar o Quadro 0. */
  const [configTargetsReady, setConfigTargetsReady] = useState(false);
  const isAdmin = bioDebug?.isAdmin ?? false;
  useEffect(() => {
    if (configSidebarId) setConfigTargetsReady(true);
  }, [configSidebarId]);

  const hasPanelContent = Boolean(
    configPanelId && (expandQuadro0 || expandQuadro1 || expandQuadro2 || expandQuadro3 || expandQuadro4 || expandQuadro5 || expandQuadro6 || expandOrigemMenu || expandConfigSaved)
  );

  const isAppBusy = isLoadingData || loadConfigLoading || isExecuting;

  const closeAllSidebarPanels = useCallback(() => {
    setExpandQuadro0(false);
    setExpandQuadro1(false);
    setExpandQuadro2(false);
    setExpandQuadro3(false);
    setExpandQuadro4(false);
    setExpandQuadro5(false);
    setExpandQuadro6(false);
    setExpandOrigemMenu(false);
    setExpandConfigSaved(false);
  }, []);

  useEffect(() => {
    if (isAppBusy) closeAllSidebarPanels();
  }, [isAppBusy, closeAllSidebarPanels]);

  const sidebarAsideRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!target) return;
      const sidebarEl = configSidebarId ? document.getElementById(configSidebarId) : sidebarAsideRef.current;
      const panelEl = configPanelId ? document.getElementById(configPanelId) : null;
      const insideSidebar = sidebarEl?.contains(target);
      const insidePanel = panelEl?.contains(target);
      if (insideSidebar || insidePanel) return;
      const anyOpen = expandQuadro0 || expandQuadro1 || expandQuadro2 || expandQuadro3 || expandQuadro4 || expandQuadro5 || expandQuadro6 || expandOrigemMenu || expandConfigSaved;
      if (anyOpen) closeAllSidebarPanels();
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [configSidebarId, configPanelId, expandQuadro0, expandQuadro1, expandQuadro2, expandQuadro3, expandQuadro4, expandQuadro5, expandQuadro6, expandOrigemMenu, expandConfigSaved, closeAllSidebarPanels]);

  useEffect(() => {
    setPanelHasContent?.(hasPanelContent);
    return () => setPanelHasContent?.(false);
  }, [hasPanelContent, setPanelHasContent]);

  /** Restaura estado da API (última atualização do usuário no BD). Sempre chama a API; se lastId estiver setado, loadConfigById pode sobrescrever depois. */
  useEffect(() => {
    type StatePayload = {
      genesisResult?: { vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; especie: EspecieParams; resultadoPorId: ResultadoReproducaoPorId; mortesAcumuladas?: number };
      inputValues?: Record<string, number>;
      origensAgendadas?: { id: string; ano: number; x0_km: number; y0_km: number; idade: number; quantidadePares: number }[];
      mapaNumero?: number;
      iteracao?: number;
    };

    const applyState = (data: StatePayload) => {
      if (!data.genesisResult?.vetor1 || !data.genesisResult?.vetor2 || !data.genesisResult?.especie) return;
      const res = data.genesisResult;
      setGenesisResult({ ...res, resultadoPorId: res.resultadoPorId ?? {} });
      if (data.inputValues) setInputValues((prev) => ({ ...prev, [SCRIPT_GENESIS_ID]: data.inputValues! }));
      if (data.origensAgendadas?.length) setOrigensAgendadas(data.origensAgendadas);
      if (typeof data.mapaNumero === "number" && data.mapaNumero >= 1) setMapaNumero(data.mapaNumero);
      if (typeof data.iteracao === "number" && data.iteracao >= 0) {
        setIteracao(data.iteracao);
        latestIteracaoRef.current = data.iteracao;
      }
      latestGenesisResultRef.current = { ...res, resultadoPorId: res.resultadoPorId ?? {} };
      setUltimoResultadoMapa({ vetor1: res.vetor1, vetor2: res.vetor2 });
    };

    const loadState = () => {
      fetch(API_SIMULATION_STATE, { credentials: "include" })
        .then((r) => {
          if (!r.ok) return null;
          return r.json() as Promise<{
            state?: StatePayload | null | string;
            mapDisplayByYear?: Record<string, MapDisplayYearRow> | null;
          }>;
        })
        .then((body) => {
          if (body?.state == null) return;
          let state = body.state;
          if (typeof state === "string") {
            try {
              state = JSON.parse(state) as StatePayload;
            } catch {
              return;
            }
          }
          if (typeof state === "object" && state !== null) applyState(state as StatePayload);
          if (body?.mapDisplayByYear != null && typeof body.mapDisplayByYear === "object" && !Array.isArray(body.mapDisplayByYear)) {
            setMapDisplayByYear(body.mapDisplayByYear as Record<string, MapDisplayYearRow>);
          }
        })
        .catch(() => { /* sem estado: ignora erro de rede */ })
        .finally(() => setIsLoadingData(false));
    };

    const t = window.setTimeout(loadState, 50);
    return () => window.clearTimeout(t);
  }, []);

  /** Persiste estado no BD (uma linha por usuário, sempre última atualização). Não usa mais localStorage para evitar bugs no mapa. */
  useEffect(() => {
    if (!genesisResult || typeof window === "undefined") return;
    const vals = inputValues[SCRIPT_GENESIS_ID];
    const payload = {
      genesisResult: { vetor1: genesisResult.vetor1, vetor2: genesisResult.vetor2, especie: genesisResult.especie, resultadoPorId: genesisResult.resultadoPorId, mortesAcumuladas: genesisResult.mortesAcumuladas },
      inputValues: vals ?? {},
      origensAgendadas,
      mapaNumero,
      iteracao,
      savedAt: new Date().toISOString(),
      ...(mapDisplayByYear != null && Object.keys(mapDisplayByYear).length > 0 && { mapDisplayByYear }),
    };
    fetch(API_SIMULATION_STATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    }).catch(() => { /* ignora erro de rede; usuário pode continuar e estado será salvo na próxima vez */ });
  }, [genesisResult, inputValues, origensAgendadas, mapaNumero, iteracao, mapDisplayByYear]);

  const handleMapClick = useCallback((x_km: number, y_km: number) => {
    if (!mapaPretas?.notWhitePixels.length) return;
    if (!mapaPretas.isBlack(kmToPx(x_km), kmToPx(y_km))) {
      setMapMessage("Escolha um ponto válido (qualquer cor que não seja branca).");
      setTimeout(() => setMapMessage(null), 4000);
      return;
    }
    const kmX = Math.round(x_km * 100) / 100;
    const kmY = Math.round(y_km * 100) / 100;
    if (repositioningOrigemId) {
      setOrigensAgendadas((prev) => prev.map((o) => o.id === repositioningOrigemId ? { ...o, x0_km: kmX, y0_km: kmY } : o));
      setRepositioningOrigemId(null);
      setGetStartMode(false);
      setMapMessage("Ponto da origem atualizado.");
      setTimeout(() => setMapMessage(null), 3000);
      return;
    }
    setPendingOrigem({ x_km: kmX, y_km: kmY });
  }, [mapaPretas, repositioningOrigemId]);

  useEffect(() => {
    if (!pendingOrigem) return;
    const sc = SCRIPTS.find((s) => s.id === SCRIPT_GENESIS_ID);
    if (!sc) return;
    const cur = inputValues[SCRIPT_GENESIS_ID];
    const periodo_i1 = cur?.periodo_i1 ?? sc.inputs.find((i) => i.key === "periodo_i1")?.default ?? -100;
    const idade_fertil_min = cur?.idade_fertil_min ?? sc.inputs.find((i) => i.key === "idade_fertil_min")?.default ?? 22;
    const max_idade = Math.max(1, Number(cur?.max_idade ?? sc.inputs.find((i) => i.key === "max_idade")?.default ?? 140));
    setFormOrigemAno(periodo_i1);
    setFormOrigemIdade(Math.min(max_idade, Math.max(0, Number(idade_fertil_min) - 1)));
    setFormOrigemQuantidadePares(1);
  }, [pendingOrigem, inputValues]);

  useEffect(() => {
    if (!editingOrigemId) return;
    const o = origensAgendadas.find((item) => item.id === editingOrigemId);
    if (!o) return;
    setFormOrigemAno(o.ano);
    setFormOrigemIdade(o.idade);
    setFormOrigemQuantidadePares(o.quantidadePares);
  }, [editingOrigemId, origensAgendadas]);

  const { mascUrl: mapaMascUrl } = getMapaUrls(mapaNumero);

  useEffect(() => {
    setMapaPretas(null);
    setIndiceGrid(null);
    setMapaDebugInfo(null);
    setIndiceBranco(1);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = REGIAO_SIZE;
      canvas.height = REGIAO_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, REGIAO_SIZE, REGIAO_SIZE);
      const data = ctx.getImageData(0, 0, REGIAO_SIZE, REGIAO_SIZE).data;
      const notWhitePixels: [number, number][] = [];
      const grid = new Uint8Array(REGIAO_SIZE * REGIAO_SIZE);
      const indiceGrid: number[] = [];

      const bin = (v: number) => (v >= 128 ? 255 : 0);

      const colorSet = new Set<string>();
      for (let y = 0; y < REGIAO_SIZE; y++) {
        for (let x = 0; x < REGIAO_SIZE; x++) {
          const i = (y * REGIAO_SIZE + x) * 4;
          const r = bin(data[i]!);
          const g = bin(data[i + 1]!);
          const b = bin(data[i + 2]!);
          colorSet.add(`${r},${g},${b}`);
        }
      }
      const palette = Array.from(colorSet)
        .map((s) => {
          const [r, g, b] = s.split(",").map(Number);
          return { r, g, b };
        })
        .sort((a, b) => (a.r << 16) + (a.g << 8) + a.b - ((b.r << 16) + (b.g << 8) + b.b));
      const colorToIndex = new Map<string, number>();
      palette.forEach((c, idx) => colorToIndex.set(`${c.r},${c.g},${c.b}`, idx));

      let whiteIndex = palette.findIndex((c) => c.r >= 128 && c.g >= 128 && c.b >= 128);
      if (whiteIndex < 0) {
        whiteIndex = palette.reduce((best, c, i) => (c.r + c.g + c.b > (palette[best]?.r ?? 0) + (palette[best]?.g ?? 0) + (palette[best]?.b ?? 0) ? i : best), 0);
      }

      for (let y = 0; y < REGIAO_SIZE; y++) {
        for (let x = 0; x < REGIAO_SIZE; x++) {
          const i = (y * REGIAO_SIZE + x) * 4;
          const r = bin(data[i]!);
          const g = bin(data[i + 1]!);
          const b = bin(data[i + 2]!);
          const key = `${r},${g},${b}`;
          const indice = colorToIndex.get(key) ?? 0;
          const idx = y * REGIAO_SIZE + x;
          indiceGrid[idx] = indice;
          if (indice !== whiteIndex) {
            notWhitePixels.push([x, y]);
            grid[idx] = 1;
          }
        }
      }
      const isBlack = (x: number, y: number) => {
        const px = Math.round(x) | 0;
        const py = Math.round(y) | 0;
        const idx = py * REGIAO_SIZE + px;
        return idx >= 0 && idx < grid.length && grid[idx] === 1;
      };
      const sorteiaPosicaoPreta = () => {
        const [x, y] = notWhitePixels[Math.floor(Math.random() * notWhitePixels.length)]!;
        return { x, y };
      };
      const pixelPretoMaisProximo = (x0: number, y0: number) => {
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
      };
      const getIndiceAt = (x: number, y: number) => {
        const px = Math.round(x) | 0;
        const py = Math.round(y) | 0;
        const idx = py * REGIAO_SIZE + px;
        if (idx < 0 || idx >= indiceGrid.length) return Math.min(7, Math.max(0, whiteIndex));
        const raw = indiceGrid[idx] ?? whiteIndex;
        return Math.min(7, Math.max(0, raw));
      };
      setMapaPretas({ notWhitePixels, isBlack, sorteiaPosicaoPreta, pixelPretoMaisProximo, getIndiceAt });
      setIndiceGrid(indiceGrid);
      setIndiceBranco(whiteIndex);
      setMapaDebugInfo({
        mapaNumero,
        pixelsValidos: notWhitePixels.length,
        indiceBranco: whiteIndex,
        regiaoSize: REGIAO_SIZE,
        coresUnicas: palette.length,
      });
    };
    img.onerror = () => {
      setMapaDebugInfo(null);
    };
    img.src = mapaMascUrl;
  }, [mapaNumero, mapaMascUrl]);

  function getInputValues(script: ScriptDef): Record<string, number> {
    const current = inputValues[script.id];
    return script.inputs.reduce(
      (acc, { key, default: d }) => ({ ...acc, [key]: current?.[key] ?? d }),
      {} as Record<string, number>
    );
  }

  async function runScript(id: string) {
    addExecLog(`runScript chamado, guard=${executingRef.current}`);
    if (executingRef.current) {
      addExecLog("runScript BLOQUEADO pelo guard");
      return;
    }
    try {
      const balRes = await fetch(API_WALLET_BALANCE, { credentials: "include" });
      const balData = await balRes.json().catch(() => ({}));
      const balance = balData?.authenticated ? (balData?.balance ?? 0) : 0;
      if (balance < 1) {
        setInsufficientCoinsAmount(1);
        setShowInsufficientCoinsModal(true);
        return;
      }
    } catch {
      /* ignora erro ao verificar saldo */
    }
    executingRef.current = true;
    const inicioScript = performance.now();
    const script = SCRIPTS.find((s) => s.id === id);
    if (!script) {
      executingRef.current = false;
      return;
    }
    const params = getInputValues(script);
    const stateSnapshot1x = latestGenesisResultRef.current;
    const body = {
      mode: "one" as const,
      params,
      state: stateSnapshot1x
        ? { vetor1: stateSnapshot1x.vetor1, vetor2: stateSnapshot1x.vetor2, especie: stateSnapshot1x.especie, mortesAcumuladas: stateSnapshot1x.mortesAcumuladas ?? 0 }
        : undefined,
      currentIteration: latestIteracaoRef.current,
      notWhitePixels: mapaPretas?.notWhitePixels,
      indiceGrid: indiceGrid ?? undefined,
      indiceBranco: indiceBranco ?? undefined,
      origensAgendadas: origensAgendadas.length > 0 ? origensAgendadas.map(({ ano, x0_km, y0_km, idade, quantidadePares }) => ({ ano, x0_km, y0_km, idade, quantidadePares })) : undefined,
      ...(bioDebug?.flags.genesisId != null && { debugGenesisId: debugGenesisIdMinGenero0Qtde1 ?? 1 }),
      ...(typeof window !== "undefined" && window.__DEBUG_GENESIS_GRUPO === true && { debugGenesisGrupo: true }),
      ...(typeof window !== "undefined" && window.__DEBUG_QTDE === true && { debugQtde: true }),
      ...(bioDebug?.flags.performance && { debugPerformance: true }),
    };
    setFetchError(null);
    setQueueMessage(null);
    setGenesisDebugLog([]);
    setGenesisGrupoDebugLog([]);
    setPerformanceDebugLog([]);
    setExecDebugLog([]);
    setMortesAcumLog([]);
    try {
      const configRes = await fetch(API_QUEUE_CONFIG);
      const config = await configRes.json().catch(() => ({}));
      const useQueue1x = config?.useQueueForFila1x === true;
      setIsExecuting(true);
      if (!useQueue1x) setSkipExecModalForDirect(true);
      if (useQueue1x) {
        const queueInit = getQueueRequestInit("fila_1x", body);
        const res = await fetch(API_QUEUE, {
          method: "POST",
          ...queueInit,
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        const pollIntervalMs = QUEUE_POLL_INTERVAL_MS_DEFAULT;
        const maxWaitMs = QUEUE_MAX_WAIT_MS_DEFAULT;
        if (!res.ok) {
          if (data?.error === "insufficient_coins") {
            setInsufficientCoinsAmount(1);
            setShowInsufficientCoinsModal(true);
          } else {
            setFetchError((data?.error as string) || data?.message || `Erro ${res.status} ao enfileirar`);
          }
          executingRef.current = false;
          setIsExecuting(false);
          addExecLog("runScript enqueue falhou");
          return;
        }
        const jobId = data?.id as string | undefined;
        setQueueMessage(tSistema.queueEnqueuedShort ?? "Adicionado à fila.");
        if (!jobId) {
          setTimeout(() => setQueueMessage(null), 4000);
          executingRef.current = false;
          setIsExecuting(false);
          addExecLog("runScript sem jobId");
          return;
        }
        const startTime = Date.now();
        const poll = async () => {
          if (Date.now() - startTime > maxWaitMs) {
            setFetchError(tSistema.queueTimeout ?? "Não foi possível executar no momento. Há muitas requisições na fila. Tente em poucos segundos ou mais tarde.");
            setQueueMessage(null);
            executingRef.current = false;
            setIsExecuting(false);
            addExecLog("runScript poll timeout");
            return;
          }
          try {
            const statusRes = await fetch(API_QUEUE_STATUS, { credentials: "include" });
            const statusData = await statusRes.json().catch(() => ({}));
            const jobs = (statusData?.jobs ?? []) as { id: string; status?: string; result?: { vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; especie: EspecieParams; resultadoPorId?: ResultadoReproducaoPorId; iteracao: number; mortesAcumuladas?: number } }[];
            const myJob = jobs.find((j) => j.id === jobId);
          if (myJob?.status === "COMPLETED" && myJob.result) {
            const res = myJob.result as { error?: string; vetor1?: unknown };
            if (res?.error === "insufficient_coins") {
              setInsufficientCoinsAmount(1);
              setShowInsufficientCoinsModal(true);
            } else {
              applyQueueResult(myJob.result);
              if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("bio-balance-changed"));
            }
            setQueueMessage(null);
            executingRef.current = false;
            setIsExecuting(false);
            addExecLog("runScript job concluído com result");
            return;
          }
          if (!myJob) {
            setQueueMessage(null);
            executingRef.current = false;
            setIsExecuting(false);
            addExecLog("runScript job concluído (sem result)");
            return;
          }
          if (myJob.status === "RUNNING") {
            setQueueMessage(tSistema.queueProcessing ?? "Em processamento…");
          }
          } catch {
            // ignora erro de rede no poll
          }
          if (executingRef.current) setTimeout(poll, pollIntervalMs);
        };
        setTimeout(poll, pollIntervalMs);
      } else {
        setSkipExecModalForDirect(true);
        try {
          const res = await fetch(apiRun, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setFetchError((data?.error as string) || `Erro ${res.status}`);
            executingRef.current = false;
            setIsExecuting(false);
            addExecLog("runScript API falhou");
            return;
          }
          if (data?.error === "insufficient_coins") {
            setInsufficientCoinsAmount(1);
            setShowInsufficientCoinsModal(true);
            return;
          }
          if (data?.vetor1 && data?.vetor2 && data?.especie != null) {
            applyQueueResult({
              vetor1: data.vetor1,
              vetor2: data.vetor2,
              especie: data.especie,
              resultadoPorId: data.resultadoPorId,
              iteracao: data.iteracao ?? 0,
              mortesAcumuladas: data.mortesAcumuladas,
            });
            if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("bio-balance-changed"));
          }
          if (data?.debugLog?.length && bioDebug?.flags.genesisId != null) {
            const lines = data.debugLog.map((e: { msg: string; data?: unknown }) => (e.data !== undefined ? `${e.msg}\n${JSON.stringify(e.data, null, 2)}` : e.msg));
            setGenesisDebugLog((prev) => [...lines, ...prev].slice(0, 50));
          }
          if (data?.debugLogGrupo?.length && bioDebug?.flags.genesisGrupo) {
            const lines = data.debugLogGrupo.map((e: { msg: string; data?: unknown }) => (e.data !== undefined ? `${e.msg}\n${JSON.stringify(e.data, null, 2)}` : e.msg));
            setGenesisGrupoDebugLog((prev) => [...lines, ...prev].slice(0, 50));
          }
          executingRef.current = false;
          setIsExecuting(false);
        } finally {
          setSkipExecModalForDirect(false);
        }
      }
    } catch (e) {
      console.error("[runScript]", e);
      const msg =
        e instanceof TypeError && e.message === "Failed to fetch"
          ? "Não foi possível conectar ao servidor. Verifique se a aplicação está rodando (npm run dev) e tente novamente."
          : e instanceof Error
            ? e.message
            : "Erro ao executar a simulação.";
      setFetchError(msg);
      executingRef.current = false;
      setIsExecuting(false);
      addExecLog("runScript erro");
    }
  }

  function reiniciar() {
    console.clear(); // Limpa o console do navegador
    setFetchError(null);
    setGenesisResult(null);
    setIteracao(0);
    setUltimoResultadoMapa(null);
    setMapDisplayByYear(null);
    latestIteracaoRef.current = 0;
    latestGenesisResultRef.current = null;
    try {
      if (typeof window !== "undefined") localStorage.removeItem(GENESIS_STATE_STORAGE_KEY);
    } catch {
      /* ignorar */
    }
  }

  const saveConfigToCloud = useCallback(async () => {
    const name = saveConfigName.trim();
    if (!name || name.length < 3) {
      setSaveConfigError(tSistema.configNameMinLength ?? "Minimum 3 characters");
      return;
    }
    if (containsBlockedWord(name)) {
      setSaveConfigError(tSistema.configNameBlocked ?? "Name contains inappropriate word");
      return;
    }
    setSaveConfigError(null);
    setSaveConfigLoading(true);
    const vals = inputValues[SCRIPT_GENESIS_ID];
    const config = {
      genesisResult: genesisResult ? { vetor1: genesisResult.vetor1, vetor2: genesisResult.vetor2, especie: genesisResult.especie, resultadoPorId: genesisResult.resultadoPorId, mortesAcumuladas: genesisResult.mortesAcumuladas } : undefined,
      inputValues: vals ?? {},
      origensAgendadas,
      mapaNumero,
      iteracao,
    };
    const body: { name: string; config: typeof config; mapDisplayByYear?: Record<string, MapDisplayYearRow>; private: boolean } = {
      name,
      config,
      private: saveConfigPrivate,
    };
    if (mapDisplayByYear != null && Object.keys(mapDisplayByYear).length > 0) {
      body.mapDisplayByYear = mapDisplayByYear;
    }
    try {
      const res = await fetch(API_SAVED_CONFIG, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error === "name_already_in_use"
          ? (tSistema.configNameAlreadyInUse ?? (data?.message as string))
          : data?.error === "blocked_word"
            ? (tSistema.configNameBlocked ?? (data?.message as string))
            : data?.error === "max_configs_reached"
              ? (tSistema.configMaxSavesReached ?? (data?.message as string))
              : ((data?.message as string) || (data?.error as string) || "Erro ao salvar");
        setSaveConfigError(msg);
        return;
      }
      setShowSaveConfigModal(false);
      setSaveConfigName("");
      const newId = data.id ?? "";
      if (newId && typeof window !== "undefined") {
        localStorage.setItem(GENESIS_LAST_LOADED_CONFIG_ID_KEY, newId);
      }
      if (typeof window !== "undefined") localStorage.setItem(GENESIS_LAST_SAVED_CONFIG_NAME_KEY, name);
      setSavedConfigsList((prev) => {
        const exists = prev.find((x) => x.name === name);
        if (exists) return prev.map((x) => (x.name === name ? { ...x, id: newId || x.id, updatedAt: new Date().toISOString() } : x));
        return [{ id: newId, name, private: saveConfigPrivate, likes: 0, createdAt: data.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(), isOwner: true }, ...prev];
      });
    } finally {
      setSaveConfigLoading(false);
    }
  }, [saveConfigName, saveConfigPrivate, genesisResult, inputValues, origensAgendadas, mapaNumero, iteracao, mapDisplayByYear, tSistema]);

  const fetchGlobalConfigs = useCallback(async () => {
    setGlobalConfigsLoading(true);
    try {
      const res = await fetch(`${API_SAVED_CONFIG}?public=1`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.items)) {
        const sorted = [...data.items].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
        setGlobalConfigsList(sorted.map((r) => ({ id: r.id, name: r.name, likes: r.likes ?? 0, ownerNickname: r.ownerNickname ?? null })));
      }
    } finally {
      setGlobalConfigsLoading(false);
    }
  }, []);

  const fetchSavedConfigs = useCallback(async () => {
    setSavedConfigsLoading(true);
    try {
      const res = await fetch(API_SAVED_CONFIG, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.items)) {
        setSavedConfigsList(data.items);
      }
    } finally {
      setSavedConfigsLoading(false);
    }
  }, []);

  const openDeleteConfigModal = useCallback((id: string, name: string) => {
    setDeleteConfigPending({ id, name });
  }, []);

  const confirmDeleteConfig = useCallback(async () => {
    if (!deleteConfigPending) return;
    const { id } = deleteConfigPending;
    setDeleteConfigLoading(true);
    try {
      const res = await fetch(`${API_SAVED_CONFIG}/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setSavedConfigsList((prev) => prev.filter((x) => x.id !== id));
        setDeleteConfigPending(null);
        if (typeof window !== "undefined") {
          const lastId = localStorage.getItem(GENESIS_LAST_LOADED_CONFIG_ID_KEY);
          if (lastId === id) localStorage.removeItem(GENESIS_LAST_LOADED_CONFIG_ID_KEY);
        }
      }
    } catch {
      /* ignorar */
    } finally {
      setDeleteConfigLoading(false);
    }
  }, [deleteConfigPending]);

  const cancelDeleteConfig = useCallback(() => {
    if (!deleteConfigLoading) setDeleteConfigPending(null);
  }, [deleteConfigLoading]);

  const loadConfigById = useCallback(async (id: string) => {
    setLoadConfigLoading(true);
    try {
      const res = await fetch(`${API_SAVED_CONFIG}/${id}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if ((res.status === 404 || res.status === 403) && typeof window !== "undefined") localStorage.removeItem(GENESIS_LAST_LOADED_CONFIG_ID_KEY);
        return;
      }
      const c = data.config as {
        genesisResult?: { vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; especie: EspecieParams; resultadoPorId: ResultadoReproducaoPorId; mortesAcumuladas?: number };
        inputValues?: Record<string, number>;
        origensAgendadas?: { id: string; ano: number; x0_km: number; y0_km: number; idade: number; quantidadePares: number }[];
        mapaNumero?: number;
        iteracao?: number;
      } | undefined;
      if (!c || typeof c !== "object") return;
      if (c.genesisResult?.vetor1 && c.genesisResult?.vetor2 && c.genesisResult?.especie) {
        const res2 = c.genesisResult;
        setGenesisResult({ ...res2, resultadoPorId: res2.resultadoPorId ?? {} });
        latestGenesisResultRef.current = { ...res2, resultadoPorId: res2.resultadoPorId ?? {} };
        setUltimoResultadoMapa({ vetor1: res2.vetor1, vetor2: res2.vetor2 });
      } else {
        setGenesisResult(null);
        latestGenesisResultRef.current = null;
        setUltimoResultadoMapa(null);
      }
      if (c.inputValues) setInputValues((prev) => ({ ...prev, [SCRIPT_GENESIS_ID]: c.inputValues! }));
      if (c.origensAgendadas?.length) setOrigensAgendadas(c.origensAgendadas);
      if (typeof c.mapaNumero === "number" && c.mapaNumero >= 1) setMapaNumero(c.mapaNumero);
      if (typeof c.iteracao === "number" && c.iteracao >= 0) {
        setIteracao(c.iteracao);
        latestIteracaoRef.current = c.iteracao;
      }
      const mapData = data.mapDisplayByYear;
      if (mapData != null && typeof mapData === "object" && !Array.isArray(mapData)) {
        setMapDisplayByYear(mapData as Record<string, MapDisplayYearRow>);
      } else {
        setMapDisplayByYear(null);
      }
      setExpandConfigSaved(false);
      if (typeof window !== "undefined") {
        localStorage.setItem(GENESIS_LAST_LOADED_CONFIG_ID_KEY, id);
        const cfgName = (data as { name?: string }).name;
        if (typeof cfgName === "string" && cfgName.trim()) localStorage.setItem(GENESIS_LAST_SAVED_CONFIG_NAME_KEY, cfgName.trim());
      }
    } catch {
      /* ignorar */
    } finally {
      setLoadConfigLoading(false);
    }
  }, []);

  /** Default: só carregamos o último estado da tabela state (useEffect acima). Não auto-carregamos mais o último config (lastId) ao abrir a página. */

  /** Executa N iterações em batch no servidor e depois atualiza estado e plota uma vez. */
  async function runScriptN(id: string, N: number) {
    if (executingRef.current) return;
    const coinsNeed = getCoinsForRun(N);
    try {
      const balRes = await fetch(API_WALLET_BALANCE, { credentials: "include" });
      const balData = await balRes.json().catch(() => ({}));
      const balance = balData?.authenticated ? (balData?.balance ?? 0) : 0;
      if (balance < coinsNeed) {
        setInsufficientCoinsAmount(coinsNeed);
        setShowInsufficientCoinsModal(true);
        return;
      }
    } catch {
      /* ignora erro ao verificar saldo */
    }
    executingRef.current = true;
    const script = SCRIPTS.find((s) => s.id === id);
    if (!script) {
      executingRef.current = false;
      return;
    }
    const params = getInputValues(script);
    const stateSnapshot = latestGenesisResultRef.current;
    const state = stateSnapshot
      ? { vetor1: stateSnapshot.vetor1, vetor2: stateSnapshot.vetor2, especie: stateSnapshot.especie, mortesAcumuladas: stateSnapshot.mortesAcumuladas ?? 0 }
      : undefined;
    const iteracaoEnviar = latestIteracaoRef.current;
    const body = {
      mode: "n" as const,
      params,
      state,
      N,
      currentIteration: iteracaoEnviar,
      notWhitePixels: mapaPretas?.notWhitePixels,
      indiceGrid: indiceGrid ?? undefined,
      indiceBranco: indiceBranco ?? undefined,
      origensAgendadas: origensAgendadas.length > 0 ? origensAgendadas.map(({ ano, x0_km, y0_km, idade, quantidadePares }) => ({ ano, x0_km, y0_km, idade, quantidadePares })) : undefined,
      ...(bioDebug?.flags.genesisId != null && { debugGenesisId: debugGenesisIdMinGenero0Qtde1 ?? 1 }),
      ...(typeof window !== "undefined" && window.__DEBUG_GENESIS_GRUPO === true && { debugGenesisGrupo: true }),
      ...(typeof window !== "undefined" && window.__DEBUG_QTDE === true && { debugQtde: true }),
      ...(bioDebug?.flags.performance && { debugPerformance: true }),
    };
    setFetchError(null);
    setQueueMessage(null);
    setGenesisDebugLog([]);
    setGenesisGrupoDebugLog([]);
    setPerformanceDebugLog([]);
    setExecDebugLog([]);
    const iterEnviada = iteracaoEnviar;
    const mortesEnviadas = stateSnapshot?.mortesAcumuladas ?? 0;
    if (bioDebug?.flags.mortesAcum) {
      console.log(`[runScriptN] enviado: iter=${iterEnviada} mortes=${mortesEnviadas} N=${N} state=${state ? "ok" : "null"}`);
    }

    if (N === 20 || N === 100 || N === 1000) {
      const queueName = N === 20 ? "fila_20x" : N === 100 ? "fila_100x" : "fila_1000x";
      const configRes = await fetch(API_QUEUE_CONFIG);
      const config = await configRes.json().catch(() => ({}));
      const useQueueN =
        N === 20 ? config?.useQueueForFila20x === true : N === 100 ? config?.useQueueForFila100x === true : config?.useQueueForFila1000x === true;
      setIsExecuting(true);
      if (!useQueueN) setSkipExecModalForDirect(true);
      if (useQueueN) {
        try {
          const queueInit = getQueueRequestInit(queueName, body);
          const res = await fetch(API_QUEUE, {
            method: "POST",
            ...queueInit,
            credentials: "include",
          });
          const data = await res.json().catch(() => ({}));
          const pollIntervalMs = QUEUE_POLL_INTERVAL_MS_DEFAULT;
          const maxWaitMs = QUEUE_MAX_WAIT_MS_DEFAULT;
          if (!res.ok) {
            if (data?.error === "insufficient_coins") {
              setInsufficientCoinsAmount(coinsNeed);
              setShowInsufficientCoinsModal(true);
            } else {
              setFetchError((data?.error as string) || data?.message || `Erro ${res.status} ao enfileirar`);
            }
            executingRef.current = false;
            setIsExecuting(false);
            return;
          }
          const jobId = data?.id as string | undefined;
          setQueueMessage(
          tSistema.queueEnqueuedShort ?? "Adicionado à fila."
        );
        if (!jobId) {
          setTimeout(() => setQueueMessage(null), 4000);
          executingRef.current = false;
          setIsExecuting(false);
          return;
        }
        const startTime = Date.now();
        const poll = async () => {
          if (Date.now() - startTime > maxWaitMs) {
            setFetchError(tSistema.queueTimeout ?? "Não foi possível executar no momento. Há muitas requisições na fila. Tente em poucos segundos ou mais tarde.");
            setQueueMessage(null);
            executingRef.current = false;
            setIsExecuting(false);
            return;
          }
          try {
            const statusRes = await fetch(API_QUEUE_STATUS, { credentials: "include" });
            const statusData = await statusRes.json().catch(() => ({}));
            const jobs = (statusData?.jobs ?? []) as { id: string; status?: string; result?: { vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; especie: EspecieParams; resultadoPorId?: ResultadoReproducaoPorId; iteracao: number; mortesAcumuladas?: number } }[];
            const myJob = jobs.find((j) => j.id === jobId);
            if (myJob?.status === "COMPLETED" && myJob.result) {
              const res = myJob.result as { error?: string };
              if (res?.error === "insufficient_coins") {
                setInsufficientCoinsAmount(coinsNeed);
                setShowInsufficientCoinsModal(true);
              } else {
                applyQueueResult(myJob.result);
                if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("bio-balance-changed"));
              }
              setQueueMessage(null);
              executingRef.current = false;
              setIsExecuting(false);
              return;
            }
            if (!myJob) {
              setQueueMessage(null);
              executingRef.current = false;
              setIsExecuting(false);
              return;
            }
            if (myJob.status === "RUNNING") {
              setQueueMessage(tSistema.queueProcessing ?? "Em processamento…");
            }
          } catch {
            // ignora erro de rede no poll; tenta de novo no próximo intervalo
          }
          if (executingRef.current) {
            setTimeout(poll, pollIntervalMs);
          }
        };
        setTimeout(poll, pollIntervalMs);
        } catch (e) {
          setFetchError(e instanceof Error ? e.message : "Erro ao enfileirar");
          executingRef.current = false;
          setIsExecuting(false);
        }
        return;
      }
    }

    setIsExecuting(true);
    setSkipExecModalForDirect(true);
    try {
      const inicio = performance.now();
      const res = await fetch(apiRun, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        let err: unknown = {};
        try {
          err = JSON.parse(text);
        } catch {
          const msg = `API ${res.status}: resposta não é JSON. Verifique o terminal do servidor.`;
          console.error("[runScriptN]", msg, text.slice(0, 500));
          setFetchError(msg);
          return;
        }
        const msg = typeof err === "object" && err !== null && "error" in err ? (err as { error?: string }).error : undefined;
        if (msg === "insufficient_coins") {
          setInsufficientCoinsAmount(getCoinsForRun(N));
          setShowInsufficientCoinsModal(true);
        } else {
          const displayMsg = msg ?? (typeof text === "string" && text.length < 200 ? text : `Erro ${res.status}. Verifique o console e o terminal do servidor.`);
          console.error("[runScriptN] API error:", res.status, msg ?? err);
          setFetchError(displayMsg);
        }
        return;
      }
      type ApiResultN = { iteracao: number; periodo?: number; mortesAcumuladas?: number; vetor1: GenesisIndividual[]; vetor2: GenesisIndividual[]; especie: EspecieParams; resultadoPorId: ResultadoReproducaoPorId; serverDurationMs?: number; performanceLog?: { phase: string; ms: number }[]; debugLog?: { msg: string; data?: unknown }[]; debugLogGrupo?: { msg: string; data?: unknown }[]; debugLogQtde?: { etapa: string; total: number; nVetor1: number; nVetor2: number; sumV1: number; sumV2: number; extra?: Record<string, number> }[] };
      const inicioParse = performance.now();
      let result: ApiResultN;
      try {
        result = JSON.parse(text) as ApiResultN;
      } catch {
        console.error("[runScriptN] Resposta não é JSON (pode ser página de erro):", text.slice(0, 200));
        return;
      }
      const parseDurationMs = performance.now() - inicioParse;
      if (result.debugLog?.length && bioDebug?.flags.genesisId != null) {
        const lines = result.debugLog.map((e) => (e.data !== undefined ? `${e.msg}\n${JSON.stringify(e.data, null, 2)}` : e.msg));
        setGenesisDebugLog((prev) => [...lines, ...prev].slice(0, 50));
      }
      if (result.debugLogGrupo?.length && bioDebug?.flags.genesisGrupo) {
        const lines = result.debugLogGrupo.map((e) => (e.data !== undefined ? `${e.msg}\n${JSON.stringify(e.data, null, 2)}` : e.msg));
        setGenesisGrupoDebugLog((prev) => [...lines, ...prev].slice(0, 50));
      }
      if (result.debugLog?.length || result.debugLogGrupo?.length) setDebugGenesisAtivo(true);
      const tempoTotalMs = performance.now() - inicio;
      if (bioDebug?.flags.performance) {
        const servidorMs = result.serverDurationMs ?? 0;
        const redeEstimadaMs = Math.max(0, tempoTotalMs - servidorMs - parseDurationMs);
        const perfLines = [
          `[runScriptN] Iterações: ${N} | Iteração final: ${result.iteracao}`,
          `Total (cliente): ${tempoTotalMs.toFixed(2)} ms`,
          `Servidor (simulação): ${servidorMs.toFixed(2)} ms`,
          `Rede (estim.): ${redeEstimadaMs.toFixed(2)} ms`,
          `Parse JSON: ${parseDurationMs.toFixed(2)} ms`,
          `ms/iteração (servidor): ${N > 0 ? (servidorMs / N).toFixed(2) : "—"} ms`,
        ];
        if (result.performanceLog?.length) {
          const totalFases = result.performanceLog
            .filter((e) => e.phase.trimStart() === e.phase)
            .reduce((s, e) => s + e.ms, 0);
          perfLines.push(`Soma fases: ${totalFases.toFixed(2)} ms`, ...result.performanceLog.map((e) => `  ${e.phase}: ${Number(e.ms.toFixed(2))} ms`));
        }
        setPerformanceDebugLog((prev) => [...perfLines, ...prev].slice(0, 80));
      }
      const mortesNovoN = result.mortesAcumuladas ?? 0;
      const mortesAnteriorN = stateSnapshot?.mortesAcumuladas ?? 0;
      const regressaoN = mortesNovoN < mortesAnteriorN;
      if (regressaoN) {
        console.error(
          `[runScriptN] ⚠️ REGRESSÃO DE mortesAcumuladas: ${mortesAnteriorN} → ${mortesNovoN} (iteração ${result.iteracao}, N=${N}). Encontre e corrija o bug na origem.`
        );
      }
      if (bioDebug?.flags.mortesAcum) {
        console.log(
          `[runScriptN] recebido: iter ${iterEnviada}→${result.iteracao} mortes ${mortesEnviadas}→${mortesNovoN} (estado anterior no cliente: mortes=${mortesAnteriorN})`
        );
        setMortesAcumLog((prev) =>
          [{ iteracao: result.iteracao, mortesAcumuladas: mortesNovoN, anterior: mortesAnteriorN, regressao: regressaoN, origem: `N=${N}`, iterEnviada: iterEnviada }, ...prev].slice(0, 30)
        );
      }
      const nextResult = {
        vetor1: result.vetor1,
        vetor2: result.vetor2,
        especie: result.especie,
        resultadoPorId: result.resultadoPorId,
        mortesAcumuladas: mortesNovoN,
      };
      latestIteracaoRef.current = result.iteracao;
      latestGenesisResultRef.current = nextResult;
      const mapData = (result as { mapDisplayByYear?: Record<string, MapDisplayYearRow> }).mapDisplayByYear;
      startTransition(() => {
        setIteracao(result.iteracao);
        setGenesisResult(nextResult);
        setUltimoResultadoMapa({ vetor1: result.vetor1, vetor2: result.vetor2 });
        if (mapData != null && typeof mapData === "object" && Object.keys(mapData).length > 0) {
          setMapDisplayByYear((prev) => ({ ...prev, ...mapData }));
        } else {
          const yearEntry = computeMapDisplayYear(result.vetor1, result.vetor2, result.resultadoPorId ?? {});
          setMapDisplayByYear((prev) => ({ ...prev, [String(result.iteracao)]: yearEntry }));
        }
      });
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("bio-balance-changed"));
    } catch (e) {
      console.error("[runScriptN]", e);
      const msg =
        e instanceof TypeError && e.message === "Failed to fetch"
          ? "Não foi possível conectar ao servidor. Verifique se a aplicação está rodando (npm run dev) e tente novamente."
          : e instanceof Error
            ? e.message
            : "Erro ao executar a simulação.";
      setFetchError(msg);
    } finally {
      setSkipExecModalForDirect(false);
      executingRef.current = false;
      setIsExecuting(false);
    }
  }

  const script = SCRIPTS[0]!;

  const vals = getInputValues(script);
  const iteracaoMax = getIteracaoMaxima(vals);
  const limiteAtingido = iteracao >= iteracaoMax;
  const totalIndividuosAtual =
    genesisResult != null
      ? [...genesisResult.vetor1, ...genesisResult.vetor2].reduce((s, i) => s + i.qtde, 0)
      : 0;
  /** Só considera população zerada quando já existe simulação e o total é 0 (senão bloqueia o primeiro Executar). */
  const populacaoZero = genesisResult != null && totalIndividuosAtual === 0;
  /** Parar quando total ≥ 20 bilhões. */
  const populacaoMaximaAtingida = genesisResult != null && totalIndividuosAtual >= LIMITE_POPULACAO;
  const parada = limiteAtingido || populacaoZero || populacaoMaximaAtingida;
  const txInicialVal = vals.tx_mortalidade_inicial_1 ?? 1;
  const reducaoHabilitada = (vals.reducao_crescimento_habilitada ?? 0) === 1;
  const periodoInicialVal = vals.periodo_i1 ?? -100;
  const periodoFinalVal = vals.periodo_f1 ?? 2026;
  const intervalo1Result = reducaoHabilitada
    ? computeIntervaloTaxa({
      tx_inicial: txInicialVal,
      periodo_i: periodoInicialVal,
      periodo_f: periodoFinalVal,
      tx_final: vals.tx_mortalidade_final_1 ?? 0.5,
    })
    : null;
  const perModVal = reducaoHabilitada && intervalo1Result ? intervalo1Result.per_de_mod : 2;
  const txFinalVal = vals.tx_mortalidade_final_1 ?? 0.5;
  const expoenteTxExpAnual = Math.min(0, perModVal) - 1;
  const txExpAnualCalculado =
    txInicialVal <= 0 && reducaoHabilitada
      ? null
      : intervalo1Result
        ? intervalo1Result.fator_anual
        : 1;

  useEffect(() => {
    if ((vals.adicionar_intervalo_2 ?? 0) !== 1) return;
    const i2 = vals.periodo_i2 ?? 100;
    const minI2 = periodoFinalVal;
    if (i2 >= minI2) return;
    setInputValues((prev) => {
      const current = script.inputs.reduce(
        (acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }),
        {} as Record<string, number>
      );
      const f2 = current.periodo_f2 ?? 200;
      return {
        ...prev,
        [script.id]: {
          ...current,
          periodo_i2: minI2,
          periodo_f2: Math.max(minI2, f2),
        },
      };
    });
  }, [vals.adicionar_intervalo_2, vals.periodo_i2, periodoFinalVal, script.id]);

  const minI2 = periodoFinalVal;
  const pi2 = clamp(minI2, vals.periodo_i2 ?? 100, 20000);
  const periodoFinalVal2 = clamp(pi2, vals.periodo_f2 ?? 200, 20000);

  useEffect(() => {
    if ((vals.adicionar_intervalo_3 ?? 0) !== 1) return;
    const i3 = vals.periodo_i3 ?? 200;
    if (i3 >= periodoFinalVal2) return;
    setInputValues((prev) => {
      const current = script.inputs.reduce(
        (acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }),
        {} as Record<string, number>
      );
      const f3 = current.periodo_f3 ?? 300;
      return {
        ...prev,
        [script.id]: {
          ...current,
          periodo_i3: periodoFinalVal2,
          periodo_f3: Math.max(periodoFinalVal2, f3),
        },
      };
    });
  }, [vals.adicionar_intervalo_3, vals.periodo_i3, periodoFinalVal2, script.id]);

  const execHeaderCtx = useExecHeader();
  const execHandlersRef = useRef({ runScript, addExecLog, isExecuting: false, parada: false, scriptId: "" });
  execHandlersRef.current = { runScript, addExecLog, isExecuting, parada, scriptId: script.id };
  const handleExecCapture = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const btn = target.closest?.('button[data-exec="1x"]');
    if (!btn) return;
    const { runScript: run, isExecuting: exec, parada: p, scriptId } = execHandlersRef.current;
    execHandlersRef.current.addExecLog("CLIQUE Executar 1x (ref)");
    e.preventDefault();
    e.stopPropagation();
    if (!exec && !p) run(scriptId);
  }, []);
  const execButtons = useMemo(() => (
    <div
      ref={(el) => { execContainerRef.current = el; }}
      className="flex items-center gap-1.5 flex-shrink-0 flex-nowrap"
      onClickCapture={handleExecCapture}
    >
      <button
        type="button"
        data-exec="1x"
        aria-disabled={isExecuting || parada}
        tabIndex={isExecuting || parada ? -1 : 0}
        style={{ cursor: isExecuting || parada ? "not-allowed" : "pointer" }}
        className="shrink-0 flex items-center justify-center w-12 h-12 rounded-lg border-2 border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 active:scale-[0.98] transition-colors disabled:cursor-not-allowed"
        title={parada ? (populacaoZero ? tSistema.titleParadaPopulationZero : populacaoMaximaAtingida ? tSistema.titleParadaPopulationMax : tSistema.titleParadaIterationLimit) : tSistema.titleExecute1x}
      >
        <PlayBIcon label="1x" alt={tSistema.execute1x} />
      </button>
      <button
        type="button"
        disabled={isExecuting || parada}
        onClick={() => runScriptN(script.id, Math.min(20, iteracaoMax))}
        className="shrink-0 flex items-center justify-center w-12 h-12 rounded-lg border-2 border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 active:scale-[0.98] transition-colors disabled:cursor-not-allowed"
        title={parada ? (populacaoZero ? tSistema.titleParadaPopulationZero : populacaoMaximaAtingida ? tSistema.titleParadaPopulationMax : tSistema.titleParadaIterationLimit) : tSistema.titleExecuteN.replace("{n}", "20").replace("{max}", String(iteracaoMax))}
      >
        <PlayBIcon label="20x" alt={tSistema.execute2x} />
      </button>
      <button
        type="button"
        disabled={isExecuting || parada}
        onClick={() => runScriptN(script.id, Math.min(100, iteracaoMax))}
        className="shrink-0 flex items-center justify-center w-12 h-12 rounded-lg border-2 border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 active:scale-[0.98] transition-colors disabled:cursor-not-allowed"
        title={parada ? (populacaoZero ? tSistema.titleParadaPopulationZero : populacaoMaximaAtingida ? tSistema.titleParadaPopulationMax : tSistema.titleParadaIterationLimit) : tSistema.titleExecuteN.replace("{n}", "100").replace("{max}", String(iteracaoMax))}
      >
        <PlayBIcon label="100x" alt={tSistema.executeC} />
      </button>
      <button
        type="button"
        disabled={isExecuting || parada}
        onClick={() => runScriptN(script.id, Math.min(1000, iteracaoMax))}
        className="shrink-0 flex items-center justify-center w-12 h-12 rounded-lg border-2 border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 active:scale-[0.98] transition-colors disabled:cursor-not-allowed"
        title={parada ? (populacaoZero ? tSistema.titleParadaPopulationZero : populacaoMaximaAtingida ? tSistema.titleParadaPopulationMax : tSistema.titleParadaIterationLimit) : tSistema.titleExecuteN.replace("{n}", "1000").replace("{max}", String(iteracaoMax))}
      >
        <PlayBIcon label="1000x" alt={tSistema.executeM} />
      </button>
      <button
        type="button"
        onClick={reiniciar}
        className="shrink-0 flex items-center justify-center w-12 h-12 rounded-lg border-2 border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 active:scale-[0.98] transition-colors"
        title={tSistema.restart}
        aria-label={tSistema.restart}
      >
        <img src={`${ASSET_PREFIX}/assets/bio/restart.WEBP`} alt="" className="w-6 h-6 object-contain" role="img" aria-hidden />
      </button>
    </div>
  ), [isExecuting, parada, iteracaoMax, populacaoZero, populacaoMaximaAtingida, script.id, genesisResult, tSistema]);
  /** Ao clicar no botão de configuração, expandir também o menu de execução. */
  useEffect(() => {
    if (!configClickExtraRef || !configSidebarId) return;
    configClickExtraRef.current = () => setExpandExecButtonsOverlay(true);
    return () => { configClickExtraRef.current = null; };
  }, [configClickExtraRef, configSidebarId]);

  /** Ao clicar em Save to Cloud no topbar, abrir modal de salvar configuração. */
  useEffect(() => {
    const handler = () => {
      setShowSaveConfigModal(true);
      setSaveConfigError(null);
      setSaveConfigName(typeof window !== "undefined" ? (localStorage.getItem(GENESIS_LAST_SAVED_CONFIG_NAME_KEY) ?? "") : "");
    };
    window.addEventListener("bio-open-save-config", handler);
    return () => window.removeEventListener("bio-open-save-config", handler);
  }, []);

  /** Aviso ao sair durante execução: evitar perda de coins. */
  useEffect(() => {
    if (!isExecuting) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isExecuting]);

  /** Ao sair da página ou desmontar: remove da fila todos os jobs do usuário. */
  useEffect(() => {
    const cancelMine = () => {
      fetch(`${API_BASE}/simulacao/queue/cancel-mine`, {
        method: "POST",
        keepalive: true,
        credentials: "include",
      });
    };
    window.addEventListener("beforeunload", cancelMine);
    window.addEventListener("pagehide", cancelMine);
    return () => {
      window.removeEventListener("beforeunload", cancelMine);
      window.removeEventListener("pagehide", cancelMine);
      cancelMine();
    };
  }, []);

  const showExecModal = (isExecuting || !!queueMessage) && !skipExecModalForDirect;

  const showBusyOverlay = isAppBusy && !showExecModal;

  return (
    <>
      {showBusyOverlay && (
        <div className="fixed inset-0 z-[110] pointer-events-auto flex items-center justify-center bg-white/60" aria-busy="true" aria-label={tSistema.queueProcessing ?? "Carregando…"}>
          <div className="w-10 h-10 rounded-full border-4 border-neutral-200 border-t-neutral-600 animate-spin" aria-hidden />
        </div>
      )}
      {showExecModal && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="exec-modal-title">
            <div className="bg-white/70 backdrop-blur-sm rounded-lg shadow-xl w-[300px] h-[220px] p-4 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="shrink-0 flex items-center justify-between mb-3">
                <h2 id="exec-modal-title" className="text-base font-bold text-zinc-900 line-clamp-2 pr-2">
                  {queueMessage || (tSistema.queueSending ?? "Enviando…")}
                </h2>
              </div>
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin mb-3 shrink-0" aria-hidden />
                <p className={`text-xs line-clamp-2 min-h-[2.5rem] text-center ${queueMessage ? "text-zinc-600" : "invisible"}`}>
                  {tSistema.leaveWarning}
                </p>
              </div>
              <div className="shrink-0 flex justify-end pt-2">
                <button
                  type="button"
                  disabled={!queueMessage}
                  onClick={() => {
                    if (!queueMessage) return;
                    fetch(`${API_BASE}/simulacao/queue/cancel-mine`, { method: "POST", credentials: "include" });
                    setQueueMessage(null);
                    executingRef.current = false;
                    setIsExecuting(false);
                  }}
                  className="w-full px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors bg-zinc-200 hover:bg-zinc-300 text-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-zinc-200"
                >
                  {tSistema.cancel}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      {showInsufficientCoinsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowInsufficientCoinsModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="insufficient-coins-title"
        >
          <div
            className="bg-white/90 backdrop-blur-sm rounded-xl shadow-xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: "0.625rem 0.75rem" }}
          >
            <h2 id="insufficient-coins-title" className="text-lg font-bold text-zinc-900 mb-2">{tSistema.insufficientCoins}</h2>
            <p className="text-sm text-zinc-600 mb-4">
              {(tSistema.insufficientCoinsMessage ?? "You need {n} coin(s).").replace("{n}", String(insufficientCoinsAmount))}
            </p>
            <div className="flex justify-end" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => setShowInsufficientCoinsModal(false)}
                className="text-sm font-semibold rounded-lg border border-neutral-300 bg-white text-zinc-800 hover:bg-zinc-50 transition-colors"
                style={{ padding: "0.25rem 0.625rem" }}
              >
                {tSistema.close}
              </button>
            </div>
          </div>
        </div>
      )}
      {showConfigLockedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowConfigLockedModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="config-locked-title"
        >
          <div
            className="bg-white/70 backdrop-blur-sm rounded-lg shadow-xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: "0.625rem 0.75rem" }}
          >
            <h2 id="config-locked-title" className="text-lg font-bold text-zinc-900 mb-3">
              {tSistema.configLockedTitle}
            </h2>
            <p className="text-sm text-zinc-600 mb-4">
              {tSistema.configLockedMessage}
            </p>
            <div className="flex justify-end" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => setShowConfigLockedModal(false)}
                className="text-sm font-semibold rounded-lg bg-zinc-200 hover:bg-zinc-300 text-zinc-800 transition-colors"
                style={{ padding: "0.25rem 0.625rem" }}
              >
                {tSistema.close}
              </button>
            </div>
          </div>
        </div>
      )}
      {showReproHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowReproHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="repro-help-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bio-help-header flex items-center justify-between shrink-0 px-4 py-3 border-b border-neutral-200">
              <h2 id="repro-help-title" className="text-base font-semibold text-neutral-800">
                🧬 {tSistema.helpReproduction}
              </h2>
              <button
                type="button"
                onClick={() => setShowReproHelp(false)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label={tSistema.close}
              >
                ✕
              </button>
            </div>
            <div className="bio-help-content overflow-y-auto p-4 space-y-4 text-sm text-neutral-700">
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">min_fertile_age</dt>
                <dd className="mt-1 pl-0">{tSistema.helpRepro.idade_fertil_min}</dd>
              </section>
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">max_fertile_age</dt>
                <dd className="mt-1 pl-0">{tSistema.helpRepro.idade_fertil_max}</dd>
              </section>
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">peak_fertile_age</dt>
                <dd className="mt-1 pl-0">{tSistema.helpRepro.idade_fertil_pico}</dd>
              </section>
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">post_peak_decay_rate</dt>
                <dd className="mt-1 pl-0">{tSistema.helpRepro.tx_decaimento_pos_pico}</dd>
              </section>
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">annual_reproduction_prob (%)</dt>
                <dd className="mt-1 pl-0">{tSistema.helpRepro.prob_anual_reproducao}</dd>
              </section>
              <hr className="border-neutral-200" />
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-neutral-800">📈 {tSistema.helpRepro.fertilityModelTitle}</h3>
                <p className="text-neutral-600">
                  {tSistema.helpRepro.fertilityModelP1}
                </p>
                <ul className="list-disc pl-5 space-y-2 text-neutral-600">
                  <li>{tSistema.helpRepro.fertilityModelL1}</li>
                  <li>{tSistema.helpRepro.fertilityModelL2}</li>
                  <li>{tSistema.helpRepro.fertilityModelL3}</li>
                </ul>
                <p className="text-neutral-600">
                  {tSistema.helpRepro.fertilityModelP2}
                </p>
                <p className="text-neutral-500 text-xs italic">
                  {tSistema.helpRepro.fertilityModelNote}
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
      {showDeslocamentoHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowDeslocamentoHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="deslocamento-help-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bio-help-header flex items-center justify-between shrink-0 px-4 py-3 border-b border-neutral-200">
              <h2 id="deslocamento-help-title" className="text-base font-semibold text-neutral-800">
                🚶 {tSistema.helpDisplacement}
              </h2>
              <button
                type="button"
                onClick={() => setShowDeslocamentoHelp(false)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label={tSistema.close}
              >
                ✕
              </button>
            </div>
            <div className="bio-help-content overflow-y-auto p-4 space-y-4 text-sm text-neutral-700">
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">annual_mean_dispersal (km)</dt>
                <dd className="mt-1 pl-0">{tSistema.helpDisplacementContent.dispersaoDesc}</dd>
              </section>
              <hr className="border-neutral-200" />
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-800">📈 {tSistema.helpDisplacementContent.displacementModelTitle}</h3>
                <p className="text-neutral-600">{tSistema.helpDisplacementContent.displacementModelP}</p>
              </section>
            </div>
          </div>
        </div>
      )}
      {showFecundidadePartoHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowFecundidadePartoHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="fecundidade-parto-help-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bio-help-header flex items-center justify-between shrink-0 px-4 py-3 border-b border-neutral-200">
              <h2 id="fecundidade-parto-help-title" className="text-base font-semibold text-neutral-800">
                🧬 {tSistema.helpBirthFecundity}
              </h2>
              <button
                type="button"
                onClick={() => setShowFecundidadePartoHelp(false)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label={tSistema.close}
              >
                ✕
              </button>
            </div>
            <div className="bio-help-content overflow-y-auto p-4 space-y-4 text-sm text-neutral-700">
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">mean_fertility_per_birth (mean children per birth)</dt>
                <dd className="mt-1 pl-0">{tSistema.helpBirthFecundityContent.fecundidade_media}</dd>
              </section>
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">max_fertility_per_birth</dt>
                <dd className="mt-1 pl-0">{tSistema.helpBirthFecundityContent.fecundidade_max}</dd>
              </section>
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">peak_fertile_age</dt>
                <dd className="mt-1 pl-0">{tSistema.helpBirthFecundityContent.idade_fertil_pico}</dd>
              </section>
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">post_peak_decay_rate</dt>
                <dd className="mt-1 pl-0">{tSistema.helpBirthFecundityContent.tx_decaimento}</dd>
              </section>
              <hr className="border-neutral-200" />
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-neutral-800">📈 {tSistema.helpBirthFecundityContent.birthModelTitle}</h3>
                <p className="text-neutral-600">{tSistema.helpBirthFecundityContent.birthModelP1}</p>
                <p className="text-neutral-600">{tSistema.helpBirthFecundityContent.birthModelP2}</p>
                <ul className="list-disc pl-5 space-y-1 text-neutral-600">
                  <li>{tSistema.helpBirthFecundityContent.birthModelL1}</li>
                  <li>{tSistema.helpBirthFecundityContent.birthModelL2}</li>
                  <li>{tSistema.helpBirthFecundityContent.birthModelL3}</li>
                  <li>{tSistema.helpBirthFecundityContent.birthModelL4}</li>
                </ul>
                <p className="text-neutral-500 text-xs italic">{tSistema.helpBirthFecundityContent.birthModelNote}</p>
              </section>
            </div>
          </div>
        </div>
      )}
      {showQuadro0PeriodosHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowQuadro0PeriodosHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="quadro0-periodos-help-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bio-help-header flex items-center justify-between shrink-0 px-4 py-3 border-b border-neutral-200">
              <h2 id="quadro0-periodos-help-title" className="text-base font-semibold text-neutral-800">
                {tSistema.helpPeriods}
              </h2>
              <button
                type="button"
                onClick={() => setShowQuadro0PeriodosHelp(false)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label={tSistema.close}
              >
                ✕
              </button>
            </div>
            <div className="bio-help-content overflow-y-auto p-4 space-y-4 text-sm text-neutral-700">
              <p className="text-neutral-600">{tSistema.helpPeriodos.p1}</p>
              <p className="text-neutral-600">{tSistema.helpPeriodos.p2}</p>
              <p className="text-neutral-600">{tSistema.helpPeriodos.p3}</p>
            </div>
          </div>
        </div>
      )}
      {showQuadro1MortalidadeHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowQuadro1MortalidadeHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="quadro1-mortalidade-help-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bio-help-header flex items-center justify-between shrink-0 px-4 py-3 border-b border-neutral-200">
              <h2 id="quadro1-mortalidade-help-title" className="text-base font-semibold text-neutral-800">
                ☠️ {tSistema.helpMortalityResidual}
              </h2>
              <button
                type="button"
                onClick={() => setShowQuadro1MortalidadeHelp(false)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label={tSistema.close}
              >
                ✕
              </button>
            </div>
            <div className="bio-help-content overflow-y-auto p-4 space-y-4 text-sm text-neutral-700">
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">initial_mortality_rate (%)</dt>
                <dd className="mt-1 pl-0">{tSistema.helpMortalidade1.tx_inicial}</dd>
              </section>
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">final_mortality_rate (%)</dt>
                <dd className="mt-1 pl-0">{tSistema.helpMortalidade1.tx_final}</dd>
              </section>
              <section>
                <dt className="font-semibold text-neutral-800">{tSistema.helpMortalidade1.intervalo}</dt>
                <dd className="mt-1 pl-0">{tSistema.helpMortalidade1.intervaloDesc}</dd>
              </section>
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">{tSistema.helpMortalidade1.fator}</dt>
                <dd className="mt-1 pl-0">{tSistema.helpMortalidade1.fatorDesc}</dd>
                <div className="mt-2 pl-0">
                  <p className="font-medium text-neutral-800">{tSistema.helpMortalidade1.fatorInterpretTitle}</p>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5 text-neutral-600">
                    <li>{tSistema.helpMortalidade1.fatorL1}</li>
                    <li>{tSistema.helpMortalidade1.fatorL2}</li>
                    <li>{tSistema.helpMortalidade1.fatorL3}</li>
                  </ul>
                  <p className="mt-2 text-neutral-600">{tSistema.helpMortalidade1.fatorNote}</p>
                </div>
              </section>
              <hr className="border-neutral-200" />
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-neutral-800">📉 {tSistema.helpMortalidade1.evolutionTitle}</h3>
                <p className="text-neutral-600">{tSistema.helpMortalidade1.evolutionP1}</p>
                <p className="text-neutral-600">{tSistema.helpMortalidade1.evolutionP2}</p>
                <ul className="list-disc pl-5 text-neutral-600">
                  <li>{tSistema.helpMortalidade1.evolutionL1}</li>
                  <li>{tSistema.helpMortalidade1.evolutionL2}</li>
                  <li>{tSistema.helpMortalidade1.evolutionL3}</li>
                  <li>{tSistema.helpMortalidade1.evolutionL4}</li>
                  <li>{tSistema.helpMortalidade1.evolutionL5}</li>
                  <li>{tSistema.helpMortalidade1.evolutionL6}</li>
                  <li>{tSistema.helpMortalidade1.evolutionL7}</li>
                </ul>
                <p className="text-neutral-600">{tSistema.helpMortalidade1.evolutionP3}</p>
              </section>
              <hr className="border-neutral-200" />
              <section className="space-y-2">
                <p className="text-neutral-500 text-xs italic">{tSistema.helpMortalidade1.note1}</p>
                <p className="text-neutral-500 text-xs italic">{tSistema.helpMortalidade1.note2}</p>
                <p className="text-neutral-500 text-xs italic">{tSistema.helpMortalidade1.note3}</p>
                <p className="text-neutral-500 text-xs italic">{tSistema.helpMortalidade1.note4}</p>
              </section>
            </div>
          </div>
        </div>
      )}
      {showMortalidadeVelhiceHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowMortalidadeVelhiceHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mortalidade-velhice-help-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bio-help-header flex items-center justify-between shrink-0 px-4 py-3 border-b border-neutral-200">
              <h2 id="mortalidade-velhice-help-title" className="text-base font-semibold text-neutral-800">
                🧬 {tSistema.helpOldAgeMortality}
              </h2>
              <button
                type="button"
                onClick={() => setShowMortalidadeVelhiceHelp(false)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label={tSistema.close}
              >
                ✕
              </button>
            </div>
            <div className="bio-help-content overflow-y-auto p-4 space-y-4 text-sm text-neutral-700">
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">old_age_start</dt>
                <dd className="mt-1 pl-0">{tSistema.helpVelhice.idade_inicio}</dd>
              </section>
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">initial_fragility (a)</dt>
                <dd className="mt-1 pl-0">{tSistema.helpVelhice.fragilidade}</dd>
              </section>
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">aging_rate (b)</dt>
                <dd className="mt-1 pl-0">{tSistema.helpVelhice.taxa_envelhecimento}</dd>
              </section>
              <section>
                <dt className="font-semibold text-neutral-800 font-mono">max_age</dt>
                <dd className="mt-1 pl-0">{tSistema.helpVelhice.max_idade}</dd>
              </section>
              <hr className="border-neutral-200" />
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-neutral-800">📉 {tSistema.helpVelhice.modelTitle}</h3>
                <p className="text-neutral-600">{tSistema.helpVelhice.modelP}</p>
                <ul className="list-disc pl-5 space-y-2 text-neutral-600">
                  <li>{tSistema.helpVelhice.modelL1}</li>
                  <li>{tSistema.helpVelhice.modelL2}</li>
                  <li>{tSistema.helpVelhice.modelL3}</li>
                </ul>
              </section>
              <hr className="border-neutral-200" />
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-800">🧠 {tSistema.helpVelhice.obsTitle}</h3>
                <p className="text-neutral-600">{tSistema.helpVelhice.obsP1}</p>
                <p className="text-neutral-600">{tSistema.helpVelhice.obsP2}</p>
                <p className="text-neutral-600">{tSistema.helpVelhice.obsP3}</p>
              </section>
            </div>
          </div>
        </div>
      )}
      {showQuadro6Help && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowQuadro6Help(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="quadro6-help-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bio-help-header flex items-center justify-between shrink-0 px-4 py-3 border-b border-neutral-200">
              <h2 id="quadro6-help-title" className="text-base font-semibold text-neutral-800">
                {tSistema.helpContinental}
              </h2>
              <button
                type="button"
                onClick={() => setShowQuadro6Help(false)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label={tSistema.close}
              >
                ✕
              </button>
            </div>
            <div className="bio-help-content overflow-y-auto p-4 space-y-4 text-sm text-neutral-700">
              <p>{tSistema.helpContinentalContent.p1}</p>
              <p>{tSistema.helpContinentalContent.p2}</p>
              <p>{tSistema.helpContinentalContent.p3}</p>
            </div>
          </div>
        </div>
      )}
      {/* Portal: triggers no sidebar; conteúdo expandido no painel à direita (para fora do sidebar) */}
      {configSidebarId && configTargetsReady && typeof document !== "undefined" && (() => {
        const sidebarEl = document.getElementById(configSidebarId);
        if (!sidebarEl) return null;
        const configLocked = genesisResult != null;
        const numPeriodosResumo = 1 + ((vals.adicionar_intervalo_2 ?? 0) === 1 ? 1 : 0) + ((vals.adicionar_intervalo_3 ?? 0) === 1 ? 1 : 0);
        const i1Resumo = vals.periodo_i1 ?? -100;
        const f1Resumo = vals.periodo_f1 ?? 2026;
        const expandeParaFora = Boolean(configPanelId);
        return createPortal(
          (
            <div className="relative flex flex-col items-center w-full">
              <div className={`flex flex-col gap-1 items-center ${configLocked ? "pointer-events-none select-none opacity-75" : ""}`}>
              <div className="w-12 min-h-12 shrink-0 rounded-lg border-2 border-neutral-300 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setExpandQuadro0((b) => !b); if (!expandQuadro0) { setExpandQuadro1(false); setExpandQuadro2(false); setExpandQuadro3(false); setExpandQuadro4(false); setExpandQuadro5(false); setExpandQuadro6(false); setExpandOrigemMenu(false); setExpandConfigSaved(false); } }}
                  className="w-full h-12 shrink-0 flex items-center justify-center p-1 hover:bg-neutral-50 transition-colors"
                  aria-expanded={expandQuadro0}
                  aria-label={expandQuadro0 ? `${tSistema.collapsePanel} — ${tSistema.panelPeriods}` : `${tSistema.expandPanel} — ${tSistema.panelPeriods}`}
                >
                  <span className="text-3xl leading-none block" role="img" aria-hidden>⏳</span>
                </button>
                {!expandeParaFora && expandQuadro0 && (
                  <div className="px-3 pb-3 pt-0 border-t border-neutral-200">
                    <p className="text-xs text-neutral-500 font-mono mt-1 mb-2">
                      {numPeriodosResumo} período(s): {i1Resumo} .. {f1Resumo}
                    </p>
                    <Quadro0ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} setShowQuadro0PeriodosHelp={setShowQuadro0PeriodosHelp} />
                  </div>
                )}
              </div>
              <div className="w-12 min-h-12 shrink-0 rounded-lg border-2 border-neutral-300 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setExpandQuadro1((b) => !b); if (!expandQuadro1) { setExpandQuadro0(false); setExpandQuadro2(false); setExpandQuadro3(false); setExpandQuadro4(false); setExpandQuadro5(false); setExpandQuadro6(false); setExpandOrigemMenu(false); setExpandConfigSaved(false); } }}
                  className="w-full h-12 shrink-0 flex items-center justify-center p-1 hover:bg-neutral-50 transition-colors"
                  aria-expanded={expandQuadro1}
                  aria-label={expandQuadro1 ? `${tSistema.collapsePanel} — ${tSistema.panelMortalityResidual}` : `${tSistema.expandPanel} — ${tSistema.panelMortalityResidual}`}
                >
                  <span className="text-3xl leading-none block" role="img" aria-hidden>☠️</span>
                </button>
                {!expandeParaFora && expandQuadro1 && (
                  <div className="px-3 pb-3 pt-0 border-t border-neutral-200">
                    <Quadro1ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} quadro1Edit={quadro1Edit} setQuadro1Edit={setQuadro1Edit} expandPeriodo2Quadro1={expandPeriodo2Quadro1} setExpandPeriodo2Quadro1={setExpandPeriodo2Quadro1} expandPeriodo3Quadro1={expandPeriodo3Quadro1} setExpandPeriodo3Quadro1={setExpandPeriodo3Quadro1} setShowQuadro1MortalidadeHelp={setShowQuadro1MortalidadeHelp} />
                  </div>
                )}
              </div>
              <div className="w-12 min-h-12 shrink-0 rounded-lg border-2 border-neutral-300 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setExpandQuadro2((b) => !b); if (!expandQuadro2) { setExpandQuadro0(false); setExpandQuadro1(false); setExpandQuadro3(false); setExpandQuadro4(false); setExpandQuadro5(false); setExpandQuadro6(false); setExpandOrigemMenu(false); setExpandConfigSaved(false); } }}
                  className="w-full h-12 shrink-0 flex items-center justify-center p-1 hover:bg-neutral-50 transition-colors"
                  aria-expanded={expandQuadro2}
                  aria-label={expandQuadro2 ? `${tSistema.collapsePanel} — ${tSistema.panelReproduction}` : `${tSistema.expandPanel} — ${tSistema.panelReproduction}`}
                >
                  <img src={`${ASSET_PREFIX}/assets/bio/reproducao.WEBP`} alt={tSistema.panelReproduction} className="w-7 h-7 object-contain" role="img" aria-hidden />
                </button>
                {!expandeParaFora && expandQuadro2 && (
                  <div className="px-3 pb-3 pt-0 border-t border-neutral-200">
                    <Quadro2ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} quadro2Edit={quadro2Edit} setQuadro2Edit={setQuadro2Edit} expandPeriodo2Quadro2={expandPeriodo2Quadro2} setExpandPeriodo2Quadro2={setExpandPeriodo2Quadro2} expandPeriodo3Quadro2={expandPeriodo3Quadro2} setExpandPeriodo3Quadro2={setExpandPeriodo3Quadro2} setShowReproHelp={setShowReproHelp} />
                  </div>
                )}
              </div>
              <div className="w-12 min-h-12 shrink-0 rounded-lg border-2 border-neutral-300 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setExpandQuadro3((b) => !b); if (!expandQuadro3) { setExpandQuadro0(false); setExpandQuadro1(false); setExpandQuadro2(false); setExpandQuadro4(false); setExpandQuadro5(false); setExpandQuadro6(false); setExpandOrigemMenu(false); setExpandConfigSaved(false); } }}
                  className="w-full h-12 shrink-0 flex items-center justify-center p-1 hover:bg-neutral-50 transition-colors"
                  aria-expanded={expandQuadro3}
                  aria-label={expandQuadro3 ? `${tSistema.collapsePanel} — ${tSistema.panelDisplacement}` : `${tSistema.expandPanel} — ${tSistema.panelDisplacement}`}
                >
                  <img src={`${ASSET_PREFIX}/assets/bio/dispersao.WEBP`} alt={tSistema.panelDisplacement} className="w-7 h-7 object-contain" role="img" aria-hidden />
                </button>
                {!expandeParaFora && expandQuadro3 && (
                  <div className="px-3 pb-3 pt-0 border-t border-neutral-200">
                    <Quadro3ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} quadro3Edit={quadro3Edit} setQuadro3Edit={setQuadro3Edit} expandPeriodo2Quadro3={expandPeriodo2Quadro3} setExpandPeriodo2Quadro3={setExpandPeriodo2Quadro3} expandPeriodo3Quadro3={expandPeriodo3Quadro3} setExpandPeriodo3Quadro3={setExpandPeriodo3Quadro3} setShowDeslocamentoHelp={setShowDeslocamentoHelp} />
                  </div>
                )}
              </div>
              <div className="w-12 min-h-12 shrink-0 rounded-lg border-2 border-neutral-300 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setExpandQuadro4((b) => !b); if (!expandQuadro4) { setExpandQuadro0(false); setExpandQuadro1(false); setExpandQuadro2(false); setExpandQuadro3(false); setExpandQuadro5(false); setExpandQuadro6(false); setExpandOrigemMenu(false); setExpandConfigSaved(false); } }}
                  className="w-full h-12 shrink-0 flex items-center justify-center p-1 hover:bg-neutral-50 transition-colors"
                  aria-expanded={expandQuadro4}
                  aria-label={expandQuadro4 ? `${tSistema.collapsePanel} — ${tSistema.panelBirthFecundity}` : `${tSistema.expandPanel} — ${tSistema.panelBirthFecundity}`}
                >
                  <img src={`${ASSET_PREFIX}/assets/bio/nascimentos.WEBP`} alt={tSistema.panelBirthFecundity} className="w-7 h-7 object-contain" role="img" aria-hidden />
                </button>
                {!expandeParaFora && expandQuadro4 && (
                  <div className="px-3 pb-3 pt-0 border-t border-neutral-200">
                    <Quadro4ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} quadro4Edit={quadro4Edit} setQuadro4Edit={setQuadro4Edit} expandPeriodo2Quadro4={expandPeriodo2Quadro4} setExpandPeriodo2Quadro4={setExpandPeriodo2Quadro4} expandPeriodo3Quadro4={expandPeriodo3Quadro4} setExpandPeriodo3Quadro4={setExpandPeriodo3Quadro4} setShowFecundidadePartoHelp={setShowFecundidadePartoHelp} />
                  </div>
                )}
              </div>
              <div className="w-12 min-h-12 shrink-0 rounded-lg border-2 border-neutral-300 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setExpandQuadro5((b) => !b); if (!expandQuadro5) { setExpandQuadro0(false); setExpandQuadro1(false); setExpandQuadro2(false); setExpandQuadro3(false); setExpandQuadro4(false); setExpandQuadro6(false); setExpandOrigemMenu(false); setExpandConfigSaved(false); } }}
                  className="w-full h-12 shrink-0 flex items-center justify-center p-1 hover:bg-neutral-50 transition-colors"
                  aria-expanded={expandQuadro5}
                  aria-label={expandQuadro5 ? `${tSistema.collapsePanel} — ${tSistema.panelOldAgeMortality}` : `${tSistema.expandPanel} — ${tSistema.panelOldAgeMortality}`}
                >
                  <img src={`${ASSET_PREFIX}/assets/bio/velhice.WEBP`} alt={tSistema.panelOldAgeMortality} className="w-7 h-7 object-contain" role="img" aria-hidden />
                </button>
                {!expandeParaFora && expandQuadro5 && (
                  <div className="px-3 pb-3 pt-0 border-t border-neutral-200">
                    <Quadro5ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} quadro5Edit={quadro5Edit} setQuadro5Edit={setQuadro5Edit} expandPeriodo2Quadro5={expandPeriodo2Quadro5} setExpandPeriodo2Quadro5={setExpandPeriodo2Quadro5} expandPeriodo3Quadro5={expandPeriodo3Quadro5} setExpandPeriodo3Quadro5={setExpandPeriodo3Quadro5} setShowMortalidadeVelhiceHelp={setShowMortalidadeVelhiceHelp} />
                  </div>
                )}
              </div>
              <div className="w-12 min-h-12 shrink-0 rounded-lg border-2 border-neutral-300 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setExpandQuadro6((b) => !b); if (!expandQuadro6) { setExpandQuadro0(false); setExpandQuadro1(false); setExpandQuadro2(false); setExpandQuadro3(false); setExpandQuadro4(false); setExpandQuadro5(false); setExpandOrigemMenu(false); setExpandConfigSaved(false); } }}
                  className="w-full h-12 shrink-0 flex items-center justify-center p-1 hover:bg-neutral-50 transition-colors"
                  aria-expanded={expandQuadro6}
                  aria-label={expandQuadro6 ? `${tSistema.collapsePanel} — ${tSistema.panelContinentalFactor}` : `${tSistema.expandPanel} — ${tSistema.panelContinentalFactor}`}
                >
                  <span className="text-3xl leading-none block" role="img" aria-hidden>🗺️</span>
                </button>
                {!expandeParaFora && expandQuadro6 && (
                  <div className="px-3 pb-3 pt-0 border-t border-neutral-200">
                    <Quadro6ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} expandPeriodo2Quadro6={expandPeriodo2Quadro6} setExpandPeriodo2Quadro6={setExpandPeriodo2Quadro6} expandPeriodo3Quadro6={expandPeriodo3Quadro6} setExpandPeriodo3Quadro6={setExpandPeriodo3Quadro6} setShowQuadro6Help={setShowQuadro6Help} />
                  </div>
                )}
              </div>
              <div className="w-12 min-h-12 shrink-0 rounded-lg border-2 border-neutral-300 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setExpandOrigemMenu((b) => !b); if (!expandOrigemMenu) { setExpandQuadro0(false); setExpandQuadro1(false); setExpandQuadro2(false); setExpandQuadro3(false); setExpandQuadro4(false); setExpandQuadro5(false); setExpandQuadro6(false); setExpandConfigSaved(false); } }}
                  className="w-full h-12 shrink-0 flex items-center justify-center p-1 hover:bg-neutral-50 transition-colors relative"
                  aria-expanded={expandOrigemMenu}
                  aria-label={expandOrigemMenu ? tSistema.collapseOriginLabel : tSistema.expandOriginLabel}
                >
                  <span className="text-3xl leading-none block" role="img" aria-hidden>📌</span>
                  {origensAgendadas.length > 0 && <span className="absolute bottom-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{origensAgendadas.length}</span>}
                </button>
                {!expandeParaFora && expandOrigemMenu && (
                  <div className="px-3 pb-3 pt-0 border-t border-neutral-200 space-y-2">
                    <button
                      type="button"
                      onClick={() => { if (!mapaPretas?.notWhitePixels.length) { setMapMessage("Aguarde o mapa carregar."); return; } setGetStartMode(true); setMapMessage("Clique no mapa para escolher o ponto."); setExpandOrigemMenu(false); }}
                      className="w-full rounded-lg border border-amber-500 bg-amber-50 px-2 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
                    >
                      Definir ponto no mapa
                    </button>
                    {origensAgendadas.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-neutral-700 mb-1">Origens ({origensAgendadas.length}/7)</p>
                        <ul className="text-xs space-y-1 max-h-32 overflow-auto">
                          {origensAgendadas.map((o) => (
                            <li key={o.id} className="flex items-center justify-between gap-2 py-0.5">
                              <span className="font-mono truncate">{o.id === ID_ORIGEM_INICIAL ? "Origem inicial" : ""} ano {o.ano}, {o.quantidadePares} par(es)</span>
                              <span className="flex gap-1 shrink-0">
                                <button type="button" onClick={() => { setFormOrigemAno(o.ano); setFormOrigemIdade(o.idade); setFormOrigemQuantidadePares(o.quantidadePares); setEditingOrigemId(o.id); }} className="text-amber-700 hover:underline" title="Editar">Editar</button>
                                {o.id !== ID_ORIGEM_INICIAL && <button type="button" onClick={() => setOrigensAgendadas((prev) => prev.filter((x) => x.id !== o.id))} className="text-rose-600 hover:underline" title="Remover">✕</button>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="w-12 min-h-12 shrink-0 rounded-lg border-2 border-neutral-300 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setExpandConfigSaved((b) => !b); if (!expandConfigSaved) { setExpandQuadro0(false); setExpandQuadro1(false); setExpandQuadro2(false); setExpandQuadro3(false); setExpandQuadro4(false); setExpandQuadro5(false); setExpandQuadro6(false); setExpandOrigemMenu(false); fetchSavedConfigs(); } }}
                  className="w-full h-12 shrink-0 flex items-center justify-center p-1 hover:bg-neutral-50 transition-colors"
                  aria-expanded={expandConfigSaved}
                  aria-label={expandConfigSaved ? tSistema.collapseSavedConfigsLabel : tSistema.expandSavedConfigsLabel}
                >
                  <span className="text-3xl leading-none block" role="img" aria-hidden>☁️</span>
                </button>
                {!expandeParaFora && expandConfigSaved && (
                  <div className="px-2 pb-3 pt-0 border-t border-neutral-200 space-y-2">
                    <div style={{ padding: "0 0.125rem" }}>
                      <button type="button" onClick={() => { setShowGlobalConfigModal(true); setGlobalConfigSearch(""); fetchGlobalConfigs(); }} className="w-full rounded-lg border border-sky-500 bg-sky-50 px-2 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 mb-2 flex items-center justify-center gap-1">
                        <span role="img" aria-hidden>🌎</span> {tSistema.configSearchGlobal}
                      </button>
                      <p className="text-xs font-semibold text-neutral-700 mb-1">{tSistema.loadConfigList}</p>
                      {savedConfigsLoading ? (
                        <p className="text-xs text-neutral-500 py-2">{tSistema.updating ?? "…"}</p>
                      ) : savedConfigsList.length === 0 ? (
                        <p className="text-xs text-neutral-500 py-2">{tSistema.noSavedConfigs}</p>
                      ) : (
                        <ul className="text-xs space-y-1 max-h-40 overflow-auto">
                          {savedConfigsList.map((c) => (
                            <li key={c.id} className="flex flex-col gap-0.5 py-1 border-b border-neutral-100 last:border-0">
                              <div className="flex items-center justify-between gap-1 min-w-0">
                                <span className="font-medium truncate" title={c.name}>{c.name}</span>
                                {c.private && <span className="text-neutral-400 shrink-0" title={tSistema.configPrivate}>🔒</span>}
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                {c.likes > 0 && <span className="text-neutral-500 text-[10px]">{(tSistema.likesCount ?? "{n} like(s)").replace("{n}", String(c.likes))}</span>}
                                <span className="flex gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => loadConfigById(c.id)}
                                    className="rounded-lg border border-emerald-500 bg-emerald-50 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                                    style={{ padding: "0.2rem 0.4rem" }}
                                  >
                                    {tSistema.loadConfig}
                                  </button>
                                  {c.isOwner && (
                                    <button
                                      type="button"
                                      onClick={() => openDeleteConfigModal(c.id, c.name)}
                                      className="rounded-lg border border-rose-500 bg-rose-50 text-xs font-medium text-rose-800 hover:bg-rose-100"
                                      style={{ padding: "0.2rem 0.4rem" }}
                                      title={tSistema.configDelete}
                                      aria-label={`${tSistema.configDelete} ${c.name}`}
                                    >
                                      {tSistema.configDelete}
                                    </button>
                                  )}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
              </div>
              {configLocked && (
                <div
                  className="absolute inset-0 cursor-pointer z-10"
                  onClick={() => setShowConfigLockedModal(true)}
                  aria-label={tSistema.configLockedTitle}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowConfigLockedModal(true); } }}
                />
              )}
            </div>
          ),
          sidebarEl
        );
      })()}
      {/* Painel expandido para fora do sidebar (à direita do sidebar) */}
      {configPanelId && configTargetsReady && (expandQuadro0 || expandQuadro1 || expandQuadro2 || expandQuadro3 || expandQuadro4 || expandQuadro5 || expandQuadro6 || expandOrigemMenu || expandConfigSaved) && typeof document !== "undefined" && (() => {
        const panelEl = document.getElementById(configPanelId);
        if (!panelEl) return null;
        const configLocked = genesisResult != null;
        const numPeriodosResumo = 1 + ((vals.adicionar_intervalo_2 ?? 0) === 1 ? 1 : 0) + ((vals.adicionar_intervalo_3 ?? 0) === 1 ? 1 : 0);
        const i1Resumo = vals.periodo_i1 ?? -100;
        const f1Resumo = vals.periodo_f1 ?? 2026;
        return createPortal(
          (
            <div className={`bio-panel-prose w-full min-w-0 h-full overflow-y-auto overflow-x-hidden box-border bg-white ${configLocked ? "pointer-events-none select-none opacity-75" : ""}`}>
              {expandQuadro0 && (
                <section className="bio-panel-section">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="bio-panel-title">{tSistema.panelPeriods}</h2>
                      <button type="button" onClick={() => setShowQuadro0PeriodosHelp(true)} className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-neutral-400 bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300 text-xs font-bold leading-none" title={tSistema.helpPeriods} aria-label={`${tSistema.help}: ${tSistema.panelPeriods}`}>?</button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandQuadro0(false)}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                      aria-label={`${tSistema.collapsePanel} ${tSistema.panelPeriods}`}
                    >
                      ✕
                    </button>
                  </div>
                  <p className="bio-panel-subtitle font-mono">
                    {numPeriodosResumo} período(s): {i1Resumo} .. {f1Resumo}
                  </p>
                  <Quadro0ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} setShowQuadro0PeriodosHelp={setShowQuadro0PeriodosHelp} />
                </section>
              )}
              {expandQuadro1 && (
                <section className="bio-panel-section">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="bio-panel-title">{tSistema.panelMortalityResidual}</h2>
                      <button type="button" onClick={() => setShowQuadro1MortalidadeHelp(true)} className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-neutral-400 bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300 text-xs font-bold leading-none" title={tSistema.helpMortalityResidual} aria-label={`${tSistema.help}: ${tSistema.panelMortalityResidual}`}>?</button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandQuadro1(false)}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                      aria-label={`${tSistema.collapsePanel} ${tSistema.panelMortalityResidual}`}
                    >
                      ✕
                    </button>
                  </div>
                  <Quadro1ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} quadro1Edit={quadro1Edit} setQuadro1Edit={setQuadro1Edit} expandPeriodo2Quadro1={expandPeriodo2Quadro1} setExpandPeriodo2Quadro1={setExpandPeriodo2Quadro1} expandPeriodo3Quadro1={expandPeriodo3Quadro1} setExpandPeriodo3Quadro1={setExpandPeriodo3Quadro1} setShowQuadro1MortalidadeHelp={setShowQuadro1MortalidadeHelp} />
                </section>
              )}
              {expandQuadro2 && (
                <section className="bio-panel-section">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="bio-panel-title">{tSistema.panelReproduction}</h2>
                      <button type="button" onClick={() => setShowReproHelp(true)} className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-neutral-400 bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300 text-xs font-bold leading-none" title={tSistema.helpReproduction} aria-label={`${tSistema.help}: ${tSistema.panelReproduction}`}>?</button>
                    </div>
                    <button type="button" onClick={() => setExpandQuadro2(false)} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100" aria-label={`${tSistema.collapsePanel} ${tSistema.panelReproduction}`}>✕</button>
                  </div>
                  <Quadro2ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} quadro2Edit={quadro2Edit} setQuadro2Edit={setQuadro2Edit} expandPeriodo2Quadro2={expandPeriodo2Quadro2} setExpandPeriodo2Quadro2={setExpandPeriodo2Quadro2} expandPeriodo3Quadro2={expandPeriodo3Quadro2} setExpandPeriodo3Quadro2={setExpandPeriodo3Quadro2} setShowReproHelp={setShowReproHelp} />
                </section>
              )}
              {expandQuadro3 && (
                <section className="bio-panel-section">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="bio-panel-title">{tSistema.panelDisplacement}</h2>
                      <button type="button" onClick={() => setShowDeslocamentoHelp(true)} className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-neutral-400 bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300 text-xs font-bold leading-none" title={tSistema.helpDisplacement} aria-label={`${tSistema.help}: ${tSistema.panelDisplacement}`}>?</button>
                    </div>
                    <button type="button" onClick={() => setExpandQuadro3(false)} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100" aria-label={`${tSistema.collapsePanel} ${tSistema.panelDisplacement}`}>✕</button>
                  </div>
                  <Quadro3ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} quadro3Edit={quadro3Edit} setQuadro3Edit={setQuadro3Edit} expandPeriodo2Quadro3={expandPeriodo2Quadro3} setExpandPeriodo2Quadro3={setExpandPeriodo2Quadro3} expandPeriodo3Quadro3={expandPeriodo3Quadro3} setExpandPeriodo3Quadro3={setExpandPeriodo3Quadro3} setShowDeslocamentoHelp={setShowDeslocamentoHelp} />
                </section>
              )}
              {expandQuadro4 && (
                <section className="bio-panel-section">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="bio-panel-title">{tSistema.panelBirthFecundity}</h2>
                      <button type="button" onClick={() => setShowFecundidadePartoHelp(true)} className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-neutral-400 bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300 text-xs font-bold leading-none" title={tSistema.helpBirthFecundity} aria-label={`${tSistema.help}: ${tSistema.panelBirthFecundity}`}>?</button>
                    </div>
                    <button type="button" onClick={() => setExpandQuadro4(false)} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100" aria-label={`${tSistema.collapsePanel} ${tSistema.panelBirthFecundity}`}>✕</button>
                  </div>
                  <Quadro4ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} quadro4Edit={quadro4Edit} setQuadro4Edit={setQuadro4Edit} expandPeriodo2Quadro4={expandPeriodo2Quadro4} setExpandPeriodo2Quadro4={setExpandPeriodo2Quadro4} expandPeriodo3Quadro4={expandPeriodo3Quadro4} setExpandPeriodo3Quadro4={setExpandPeriodo3Quadro4} setShowFecundidadePartoHelp={setShowFecundidadePartoHelp} />
                </section>
              )}
              {expandQuadro5 && (
                <section className="bio-panel-section">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="bio-panel-title">{tSistema.panelOldAgeMortality}</h2>
                      <button type="button" onClick={() => setShowMortalidadeVelhiceHelp(true)} className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-neutral-400 bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300 text-xs font-bold leading-none" title={tSistema.helpOldAgeMortality} aria-label={`${tSistema.help}: ${tSistema.panelOldAgeMortality}`}>?</button>
                    </div>
                    <button type="button" onClick={() => setExpandQuadro5(false)} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100" aria-label={`${tSistema.collapsePanel} ${tSistema.panelOldAgeMortality}`}>✕</button>
                  </div>
                  <Quadro5ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} quadro5Edit={quadro5Edit} setQuadro5Edit={setQuadro5Edit} expandPeriodo2Quadro5={expandPeriodo2Quadro5} setExpandPeriodo2Quadro5={setExpandPeriodo2Quadro5} expandPeriodo3Quadro5={expandPeriodo3Quadro5} setExpandPeriodo3Quadro5={setExpandPeriodo3Quadro5} setShowMortalidadeVelhiceHelp={setShowMortalidadeVelhiceHelp} />
                </section>
              )}
              {expandQuadro6 && (
                <section className="bio-panel-section">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="bio-panel-title">{tSistema.panelContinentalFactor}</h2>
                      <button type="button" onClick={() => setShowQuadro6Help(true)} className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-neutral-400 bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300 text-xs font-bold leading-none" title={tSistema.helpContinental} aria-label={`${tSistema.help}: ${tSistema.panelContinentalFactor}`}>?</button>
                    </div>
                    <button type="button" onClick={() => setExpandQuadro6(false)} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100" aria-label={`${tSistema.collapsePanel} ${tSistema.panelContinentalFactor}`}>✕</button>
                  </div>
                  <Quadro6ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} expandPeriodo2Quadro6={expandPeriodo2Quadro6} setExpandPeriodo2Quadro6={setExpandPeriodo2Quadro6} expandPeriodo3Quadro6={expandPeriodo3Quadro6} setExpandPeriodo3Quadro6={setExpandPeriodo3Quadro6} setShowQuadro6Help={setShowQuadro6Help} />
                </section>
              )}
              {expandOrigemMenu && (
                <section className="bio-panel-section">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h2 className="bio-panel-title">📌 {tSistema.panelDefineOrigin}</h2>
                    <button type="button" onClick={() => setExpandOrigemMenu(false)} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100" aria-label={`${tSistema.collapsePanel} ${tSistema.origins}`}>✕</button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (!mapaPretas?.notWhitePixels.length) { setMapMessage(tSistema.waitForMap); return; } setGetStartMode(true); setMapMessage(tSistema.clickMapToChoose); setExpandOrigemMenu(false); }}
                    className="w-full rounded-lg border border-amber-500 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 mb-3"
                  >
                    {tSistema.definePointOnMap}
                  </button>
                  {origensAgendadas.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-neutral-700 mb-1">{tSistema.scheduledOrigins} ({origensAgendadas.length}/7)</p>
                      <ul className="text-xs space-y-1 max-h-48 overflow-auto">
                        {origensAgendadas.map((o) => (
                          <li key={o.id} className="flex items-center justify-between gap-2 py-1 border-b border-neutral-100">
                            <span className="font-mono">{o.id === ID_ORIGEM_INICIAL ? tSistema.initialOrigin + " — " : ""}{tSistema.yearLabel} {o.ano}, {o.quantidadePares} {o.quantidadePares === 1 ? tSistema.pair : tSistema.pairs}</span>
                            <span className="flex gap-2 shrink-0">
                              <button type="button" onClick={() => { setFormOrigemAno(o.ano); setFormOrigemIdade(o.idade); setFormOrigemQuantidadePares(o.quantidadePares); setEditingOrigemId(o.id); }} className="text-amber-700 hover:underline" title={tSistema.edit}>{tSistema.edit}</button>
                              {o.id !== ID_ORIGEM_INICIAL && <button type="button" onClick={() => setOrigensAgendadas((prev) => prev.filter((x) => x.id !== o.id))} className="text-rose-600 hover:underline" title={tSistema.remove}>✕</button>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}
              {expandConfigSaved && (
                <section className="bio-panel-section" style={{ paddingLeft: "0.5rem", paddingRight: "0.5rem" }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h2 className="bio-panel-title">☁️ {tSistema.panelSavedConfigs}</h2>
                    <button type="button" onClick={() => setExpandConfigSaved(false)} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100" aria-label={`${tSistema.collapsePanel} ${tSistema.panelSavedConfigs}`}>✕</button>
                  </div>
                  <div style={{ paddingLeft: "0.125rem", paddingRight: "0.125rem" }}>
                    <button type="button" onClick={() => { setShowGlobalConfigModal(true); setGlobalConfigSearch(""); fetchGlobalConfigs(); }} className="w-full rounded-lg border border-sky-500 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 mb-3 flex items-center justify-center gap-2">
                      <span role="img" aria-hidden>🌎</span> {tSistema.configSearchGlobal}
                    </button>
                    <p className="text-xs font-semibold text-neutral-700 mb-1">{tSistema.loadConfigList}</p>
                    {savedConfigsLoading ? (
                      <p className="text-xs text-neutral-500 py-2">{tSistema.updating ?? "…"}</p>
                    ) : savedConfigsList.length === 0 ? (
                      <p className="text-xs text-neutral-500 py-2">{tSistema.noSavedConfigs}</p>
                    ) : (
                      <ul className="text-xs space-y-2 max-h-64 overflow-auto">
                        {savedConfigsList.map((c) => (
                          <li key={c.id} className="flex flex-col gap-1 py-2 border-b border-neutral-100 last:border-0">
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <span className="font-medium truncate" title={c.name}>{c.name}</span>
                              {c.private && <span className="text-neutral-400 shrink-0" title={tSistema.configPrivate}>🔒</span>}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              {c.likes > 0 && <span className="text-neutral-500 text-[10px]">{(tSistema.likesCount ?? "{n} like(s)").replace("{n}", String(c.likes))}</span>}
                              <span className="flex gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => loadConfigById(c.id)}
                                  className="rounded-lg border border-emerald-500 bg-emerald-50 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                                  style={{ padding: "0.2rem 0.4rem" }}
                                >
                                  {tSistema.loadConfig}
                                </button>
                                {c.isOwner && (
                                  <button
                                    type="button"
                                    onClick={() => openDeleteConfigModal(c.id, c.name)}
                                    className="rounded-lg border border-rose-500 bg-rose-50 text-xs font-medium text-rose-800 hover:bg-rose-100"
                                    style={{ padding: "0.2rem 0.4rem" }}
                                    title={tSistema.configDelete}
                                    aria-label={`${tSistema.configDelete} ${c.name}`}
                                  >
                                    {tSistema.configDelete}
                                  </button>
                                )}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              )}
            </div>
          ),
          panelEl
        );
      })()}
      {(!configSidebarId || !execHeaderCtx) && (
        <header className="bio-header shrink-0">
          <div className="bio-header-inner">
            {execButtons}
          </div>
        </header>
      )}
      <div className={`flex flex-1 min-h-0 overflow-hidden ${!configSidebarId ? "flex-row" : ""}`}>
        {!configSidebarId && (
          <aside ref={sidebarAsideRef} className={`shrink-0 border-r border-neutral-200 bg-white flex flex-col items-stretch py-2 gap-1 transition-[width] z-[100] relative min-w-[3.5rem] ${expandOrigemMenu ? "w-56" : "w-14"}`} aria-label="Menu origem" style={{ pointerEvents: "auto" }}>
            <div className="card-bio-generator rounded-md shadow-sm overflow-visible">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandOrigemMenu((b) => !b)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandOrigemMenu((b) => !b); } }}
                className="w-full aspect-square flex items-center justify-center p-1 hover:bg-neutral-50 transition-colors relative min-h-[3.5rem] cursor-pointer select-none"
                aria-expanded={expandOrigemMenu}
                aria-label={expandOrigemMenu ? tSistema.collapseOriginLabel : tSistema.expandOriginLabel}
              >
                <span className="text-3xl leading-none block" role="img" aria-hidden>📌</span>
                {origensAgendadas.length > 0 && <span className="absolute bottom-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{origensAgendadas.length}</span>}
              </div>
              {expandOrigemMenu && (
                <div className="px-2 pb-2 pt-0 border-t border-neutral-200 space-y-2">
                  <button
                    type="button"
                    onClick={() => { if (!mapaPretas?.notWhitePixels.length) { setMapMessage(tSistema.waitForMap); return; } setGetStartMode(true); setMapMessage(tSistema.clickMapToChoose); setExpandOrigemMenu(false); }}
                    className="w-full rounded-lg border border-amber-500 bg-amber-50 px-2 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
                  >
                    {tSistema.definePointOnMap}
                  </button>
                  {origensAgendadas.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-neutral-700 mb-1">{tSistema.origins} ({origensAgendadas.length}/7)</p>
                      <ul className="text-xs space-y-1 max-h-32 overflow-auto">
                        {origensAgendadas.map((o) => (
                          <li key={o.id} className="flex items-center justify-between gap-2 py-0.5">
                            <span className="font-mono truncate">{o.id === ID_ORIGEM_INICIAL ? tSistema.initialOrigin + " " : ""}{tSistema.yearLabel} {o.ano}, {o.quantidadePares} {o.quantidadePares === 1 ? tSistema.pair : tSistema.pairs}</span>
                            <span className="flex gap-1 shrink-0">
                              <button type="button" onClick={() => { setFormOrigemAno(o.ano); setFormOrigemIdade(o.idade); setFormOrigemQuantidadePares(o.quantidadePares); setEditingOrigemId(o.id); }} className="text-amber-700 hover:underline" title={tSistema.edit}>{tSistema.edit}</button>
                              {o.id !== ID_ORIGEM_INICIAL && <button type="button" onClick={() => setOrigensAgendadas((prev) => prev.filter((x) => x.id !== o.id))} className="text-rose-600 hover:underline" title={tSistema.remove}>✕</button>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-transparent">
          <div className="flex-1 min-h-[200px] w-full flex flex-col relative">
            <GenesisPlot
              vetor1={ultimoResultadoMapa?.vetor1 ?? genesisResult?.vetor1 ?? []}
              vetor2={ultimoResultadoMapa?.vetor2 ?? genesisResult?.vetor2 ?? []}
              imageUrl={showMask ? getMapaUrls(mapaNumero).mascUrl : getMapaUrls(mapaNumero).displayUrl}
              mapNumber={mapaNumero}
              indiceBranco={indiceBranco}
              indiceGrid={indiceGrid ?? undefined}
              getStartMode={getStartMode || !!repositioningOrigemId}
              onMapClick={handleMapClick}
              originMarkers={origensAgendadas.map((o) => ({ x0_km: o.x0_km, y0_km: o.y0_km }))}
              originMarkerIconUrl={`${ASSET_PREFIX}/assets/bio/tachinha.svg`}
              className="flex-1 min-h-0 w-full"
              qtdeDirecoes={Math.min(8, Math.max(2, Math.floor(vals.qtde_direcoes ?? 8)))}
              topMessage={
                parada && populacaoZero
                  ? <>{tSistema.populationZeroBefore}<strong>{tSistema.restart}</strong>{tSistema.populationZeroAfter}</>
                  : parada && populacaoMaximaAtingida
                    ? <>{tSistema.populationMaxBefore}<strong>{tSistema.restart}</strong>{tSistema.populationMaxAfter}</>
                    : parada
                      ? <>{tSistema.iterationLimitBefore}<strong>{tSistema.restart}</strong>{tSistema.iterationLimitAfter}</>
                      : undefined
              }
              statsOverlay={
                genesisResult || isExecuting
                  ? {
                    ano: periodoInicialVal + iteracao,
                    populacao: (genesisResult ? [...genesisResult.vetor1, ...genesisResult.vetor2].reduce((s, i) => s + i.qtde, 0) : 0),
                    nascimentos: genesisResult?.resultadoPorId
                      ? Object.values(genesisResult.resultadoPorId).reduce((s, r) => s + (r.decendentes ?? 0), 0)
                      : 0,
                    mortesAnuais: (genesisResult ? [...genesisResult.vetor1, ...genesisResult.vetor2].reduce((s, i) => s + (i.morte ?? 0), 0) : 0),
                    mortesAcumuladas: genesisResult?.mortesAcumuladas ?? 0,
                    totalIterations: iteracao,
                  }
                  : null
              }
              bottomRightOverlay={
                configSidebarId && mapBottomRightOverlay && execButtons
                  ? (
                    <div className="flex items-center gap-2 flex-wrap pointer-events-auto" style={{ opacity: 0.8 }}>
                      {mapBottomRightOverlay}
                      <div className="flex items-center gap-2">
                        {expandExecButtonsOverlay ? (
                          <>
                            {execButtons}
                            <button
                              type="button"
                              onClick={() => setExpandExecButtonsOverlay(false)}
                              className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border-2 border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 hover:border-neutral-400 transition-colors"
                              title={tSistema.collapseExecControls}
                              aria-label={tSistema.collapseExecControls}
                            >
                              <span className="text-lg" aria-hidden>◀</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandExecButtonsOverlay(true)}
                            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border-2 border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 hover:border-neutral-400 transition-colors"
                            title={tSistema.expandExecControls}
                            aria-label={tSistema.expandExecControls}
                          >
                            <span className="text-lg" aria-hidden>▶</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                  : mapBottomRightOverlay
              }
            />
            {deleteConfigPending && typeof document !== "undefined" && createPortal(
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={cancelDeleteConfig} role="dialog" aria-modal="true" aria-labelledby="delete-config-modal-title">
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-xl max-w-sm w-full border border-neutral-200 overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ padding: "1rem 1.25rem" }}>
                  <h2 id="delete-config-modal-title" className="text-lg font-bold text-zinc-900 mb-2">{tSistema.configDelete}</h2>
                  <p className="text-sm text-zinc-600 mb-4">
                    {(tSistema.configDeleteConfirm ?? 'Delete config "{name}"?').replace("{name}", deleteConfigPending.name)}
                  </p>
                  <div className="flex justify-end" style={{ marginTop: "1rem", gap: "0.75rem" }}>
                    <button type="button" onClick={cancelDeleteConfig} disabled={deleteConfigLoading} className="rounded-lg border border-neutral-300 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 transition-colors" style={{ padding: "0.25rem 0.625rem" }}>{tSistema.cancel}</button>
                    <button type="button" onClick={confirmDeleteConfig} disabled={deleteConfigLoading} className="rounded-lg bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60 transition-colors" style={{ padding: "0.25rem 0.625rem" }}>{deleteConfigLoading ? (tSistema.configDeleting ?? "...") : (tSistema.configConfirmDelete ?? "Confirm")}</button>
                  </div>
                </div>
              </div>,
              document.body
            )}
            {showGlobalConfigModal && typeof document !== "undefined" && createPortal(
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowGlobalConfigModal(false)} role="dialog" aria-modal="true" aria-labelledby="global-config-modal-title">
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-xl max-w-sm w-full border border-neutral-200 overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ padding: "1rem 1.25rem" }}>
                  <h2 id="global-config-modal-title" className="text-lg font-bold text-zinc-900 mb-3">{tSistema.configSearchGlobal}</h2>
                  {globalConfigsLoading ? (
                    <p className="text-sm text-zinc-600 py-4">{tSistema.configLoadingList}</p>
                  ) : (
                    <>
                      <div className="mb-3 max-h-[280px] overflow-y-auto border border-neutral-200 rounded-lg" style={{ minHeight: "80px" }}>
                        {(() => {
                          const q = globalConfigSearch.trim().toLowerCase();
                          const filtered = q
                            ? globalConfigsList.filter((r) => (r.name ?? "").toLowerCase().includes(q))
                            : globalConfigsList;
                          if (filtered.length === 0) {
                            return <p className="text-sm text-zinc-500 px-3 py-4 text-center">{tSistema.noPublicConfigs}</p>;
                          }
                          return (
                            <>
                              <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 text-xs font-semibold text-zinc-500 border-b border-neutral-200 shrink-0">
                                <span>{tSistema.configName}</span>
                                <span className="max-w-[100px] truncate">{tSistema.configOwnerColumn ?? "User"}</span>
                                <span aria-hidden />
                              </div>
                              <ul className="divide-y divide-neutral-100">
                              {filtered.map((r) => (
                                <li key={r.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2 hover:bg-neutral-50">
                                  <span className="text-sm text-zinc-800 truncate min-w-0" title={r.name}>{r.name}</span>
                                  <span className="text-xs text-zinc-500 max-w-[100px] truncate" title={r.ownerNickname ?? undefined}>{r.ownerNickname ?? "—"}</span>
                                  <button type="button" onClick={() => { loadConfigById(r.id); setShowGlobalConfigModal(false); }} className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700 transition-colors shrink-0">{tSistema.loadConfig}</button>
                                </li>
                              ))}
                            </ul>
                            </>
                          );
                        })()}
                      </div>
                      <label className="block mb-3">
                        <input
                          type="text"
                          value={globalConfigSearch}
                          onChange={(e) => setGlobalConfigSearch(e.target.value)}
                          placeholder={tSistema.configSearchPlaceholder}
                          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        />
                      </label>
                    </>
                  )}
                  <div className="flex justify-end pt-2">
                    <button type="button" onClick={() => setShowGlobalConfigModal(false)} className="rounded-lg border border-neutral-300 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors" style={{ padding: "0.25rem 0.625rem" }}>{tSistema.close}</button>
                  </div>
                </div>
              </div>,
              document.body
            )}
            {showSaveConfigModal && typeof document !== "undefined" && createPortal(
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { if (!saveConfigLoading) { setShowSaveConfigModal(false); setSaveConfigError(null); } }} role="dialog" aria-modal="true" aria-labelledby="save-config-modal-title">
                <div className="bg-white/70 backdrop-blur-sm rounded-lg shadow-xl max-w-sm w-full border border-neutral-200 overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ padding: "0.75rem 0.875rem" }}>
                  <h2 id="save-config-modal-title" className="text-lg font-bold text-zinc-900 mb-3">{tSistema.saveToCloud}</h2>
                  <label className="block mb-3">
                    <span className="block text-sm font-medium text-zinc-700 mb-1">{tSistema.configName} (3–64)</span>
                    <input
                      type="text"
                      maxLength={64}
                      value={saveConfigName}
                      onChange={(e) => setSaveConfigName(e.target.value)}
                      placeholder={tSistema.configNamePlaceholder}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      autoFocus
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer mb-4">
                    <input type="checkbox" checked={saveConfigPrivate} onChange={(e) => setSaveConfigPrivate(e.target.checked)} className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500" />
                    <span>{tSistema.configPrivate}</span>
                  </label>
                  {saveConfigError && <p className="text-sm text-rose-600 mb-4">{saveConfigError}</p>}
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={saveConfigToCloud} disabled={saveConfigLoading} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">{saveConfigLoading ? tSistema.savingConfig : tSistema.saveConfig}</button>
                    <button type="button" onClick={() => { if (!saveConfigLoading) { setShowSaveConfigModal(false); setSaveConfigError(null); } }} disabled={saveConfigLoading} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 transition-colors">{tSistema.cancel}</button>
                  </div>
                </div>
              </div>,
              document.body
            )}
            {(() => {
              const editando = editingOrigemId != null ? origensAgendadas.find((o) => o.id === editingOrigemId) : null;
              const overlayCoords = pendingOrigem ?? (editando ? { x_km: editando.x0_km, y_km: editando.y0_km } : null);
              if (!overlayCoords) return null;
              const isEdit = !!editingOrigemId;
              const handleOk = () => {
                const anoClamped = Math.round(clamp(periodoInicialVal, formOrigemAno, getPeriodoFimUltimo(vals)));
                const maxIdade = Math.max(1, Number(vals.max_idade ?? 140));
                const idadeClamped = Math.round(clamp(0, formOrigemIdade, maxIdade));
                const qPares = Math.min(50000, Math.max(1, formOrigemQuantidadePares));
                if (isEdit && editando) {
                  setOrigensAgendadas((prev) => prev.map((o) => o.id === editingOrigemId ? { ...o, ano: anoClamped, idade: idadeClamped, quantidadePares: qPares } : o));
                  setMapMessage(tSistema.originUpdatedFull.replace("{year}", String(anoClamped)).replace("{n}", String(qPares)));
                } else {
                  if (origensAgendadas.length >= 7) { setMapMessage(tSistema.maxOrigins); setTimeout(() => setMapMessage(null), 3000); return; }
                  setOrigensAgendadas((prev) => [...prev, { id: crypto.randomUUID(), ano: anoClamped, x0_km: overlayCoords.x_km, y0_km: overlayCoords.y_km, idade: idadeClamped, quantidadePares: qPares }]);
                  setMapMessage(tSistema.originScheduledFull.replace("{year}", String(anoClamped)).replace("{n}", String(qPares)));
                }
                setPendingOrigem(null); setEditingOrigemId(null); setGetStartMode(false); setTimeout(() => setMapMessage(null), 3000);
              };
              const handleCancel = () => { setPendingOrigem(null); setEditingOrigemId(null); setGetStartMode(false); };
              return (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 p-4" onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}>
                  <div className="bg-white rounded-xl border border-amber-300 shadow-xl p-4 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
                    <p className="text-sm font-semibold text-amber-900">{isEdit ? tSistema.editOrigin : tSistema.newOrigin} ({overlayCoords.x_km.toFixed(0)}, {overlayCoords.y_km.toFixed(0)} km)</p>
                    <label className="block">
                      <span className="text-xs text-amber-800">{tSistema.birthYear}</span>
                      <input type="number" min={periodoInicialVal} max={getPeriodoFimUltimo(vals)} value={formOrigemAno} onChange={(e) => { const v = Number(e.target.value); if (!Number.isFinite(v)) return; setFormOrigemAno(Math.round(clamp(periodoInicialVal, v, getPeriodoFimUltimo(vals)))); }} className="w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-sm font-mono mt-1" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-amber-800">{tSistema.pairAge}</span>
                      <input type="number" min={0} max={Math.max(1, Number(vals.max_idade ?? 140))} value={formOrigemIdade} onChange={(e) => { const v = Number(e.target.value); if (!Number.isFinite(v)) return; setFormOrigemIdade(Math.round(clamp(0, v, Math.max(1, Number(vals.max_idade ?? 140))))); }} className="w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-sm font-mono mt-1" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-amber-800">{tSistema.pairQty}</span>
                      <input type="number" min={1} max={50000} value={formOrigemQuantidadePares} onChange={(e) => setFormOrigemQuantidadePares(Math.min(50000, Math.max(1, Number(e.target.value))))} className="w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-sm font-mono mt-1" />
                    </label>
                    {isEdit && (
                      <button type="button" onClick={() => { setEditingOrigemId(null); setPendingOrigem(null); setRepositioningOrigemId(editingOrigemId!); setGetStartMode(true); setMapMessage(tSistema.clickMapForNewPoint); setExpandOrigemMenu(false); }} className="w-full rounded-lg border border-amber-400 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50">{tSistema.resetPointOnMap}</button>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={handleOk} className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">{tSistema.ok}</button>
                      <button type="button" onClick={handleCancel} className="rounded-lg border border-amber-400 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100">{tSistema.cancel}</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="shrink-0 overflow-y-auto max-h-[40vh] px-4 py-4">
            {!embedMode && (
              <>
                <h1 className="text-xl font-semibold text-neutral-900">
                  Teste Bio
                </h1>
                <p className="text-sm text-neutral-600 mt-1">
                  GerarGenesis — vetores iniciais e plot na região 0..{REGIAO_KM} km × 0..{REGIAO_KM} km.
                </p>
              </>
            )}

            {/* Quadro 0 — Períodos: inline no conteúdo quando sem sidebar */}
            {!configSidebarId && (
              <div className="mt-3 rounded-lg border border-neutral-300 bg-neutral-100/80 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandQuadro0((b) => !b)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-neutral-100 transition-colors"
                  aria-expanded={expandQuadro0}
                  aria-label={expandQuadro0 ? `${tSistema.collapsePanel} — ${tSistema.panelPeriods}` : `${tSistema.expandPanel} — ${tSistema.panelPeriods}`}
                >
                  <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">{tSistema.section0Periods}</span>
                  <span className="text-sm text-neutral-500 font-mono truncate">
                    {1 + ((vals.adicionar_intervalo_2 ?? 0) === 1 ? 1 : 0) + ((vals.adicionar_intervalo_3 ?? 0) === 1 ? 1 : 0)} período(s): {vals.periodo_i1 ?? -100} .. {vals.periodo_f1 ?? 2026}
                  </span>
                  <span className="text-neutral-500 shrink-0" aria-hidden>{expandQuadro0 ? "▼" : "▶"}</span>
                </button>
                {expandQuadro0 && (
                  <div className="px-3 pb-3 pt-0 border-t border-neutral-200">
                    <Quadro0ConteudoInline script={script} inputValues={inputValues} setInputValues={setInputValues} vals={vals} setShowQuadro0PeriodosHelp={setShowQuadro0PeriodosHelp} />
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {(() => {
                  const reproStartIdx = script.inputs.findIndex((i) => i.key === "idade_fertil_min");
                  const reproEndIdx = script.inputs.findIndex((i) => i.key === "prob_anual_reproducao");
                  const fecundidadeQuadroStartIdx = script.inputs.findIndex((i) => i.key === "tx_decaimento_pos_pico");
                  const fecundidadeQuadroEndIdx = script.inputs.findIndex((i) => i.key === "fecundidade_max_parto");
                  const expansionStartIdx = script.inputs.findIndex((i) => i.key === "tx_mortalidade_inicial_1");
                  const expansionEndIdx = script.inputs.findIndex((i) => i.key === "tx_mortalidade_final_1");
                  const mortalidadeQuadroStartIdx = script.inputs.findIndex((i) => i.key === "max_idade");
                  const mortalidadeQuadroEndIdx = script.inputs.findIndex((i) => i.key === "taxa_envelhecimento");
                  const renderedInputs = script.inputs.map((input) => {
                    const { key, label, default: d, type = "number" } = input;
                    const val = inputValues[script.id]?.[key] ?? d;
                    const reducaoHabilitada = (inputValues[script.id]?.reducao_crescimento_habilitada ?? 0) === 1;
                    if (key === "periodo_f1") return null;
                    if (key === "adicionar_intervalo_2" || key === "periodo_i2" || key === "periodo_f2" || key === "tx_mortalidade_final_2") return null;
                    if (key === "adicionar_intervalo_3" || key === "periodo_i3" || key === "periodo_f3" || key === "tx_mortalidade_final_3") return null;
                    if (key === "max_idade" || key === "fragilidade_inicial" || key === "taxa_envelhecimento") return null;
                    if (key === "max_idade_2" || key === "fragilidade_inicial_2" || key === "taxa_envelhecimento_2" || key === "max_idade_3" || key === "fragilidade_inicial_3" || key === "taxa_envelhecimento_3") return null;
                    if (key === "fator_continental_habilitado" || key.startsWith("fator_mortalidade_cor")) return null;
                    if (key === "idade_fertil_min" || key === "idade_fertil_max" || key === "idade_fertil_pico" || key === "prob_anual_reproducao") return null;
                    if (key === "idade_fertil_min_2" || key === "idade_fertil_max_2" || key === "idade_fertil_pico_2" || key === "prob_anual_reproducao_2" || key === "idade_fertil_min_3" || key === "idade_fertil_max_3" || key === "idade_fertil_pico_3" || key === "prob_anual_reproducao_3") return null;
                    if (key === "tx_decaimento_pos_pico" || key === "fecundidade_media_parto" || key === "fecundidade_max_parto") return null;
                    if (key === "tx_decaimento_pos_pico_2" || key === "fecundidade_media_parto_2" || key === "fecundidade_max_parto_2" || key === "tx_decaimento_pos_pico_3" || key === "fecundidade_media_parto_3" || key === "fecundidade_max_parto_3") return null;
                    if (key === "qtde_direcoes" || key === "dispersao_anual_media_2" || key === "dispersao_anual_media_3") return null;
                    if (key === "x0" || key === "y0" || key === "x0_v2" || key === "y0_v2") return null;
                    if (key === "min_form_grupo") return null;
                    if ((key === "periodo_i1" || key === "tx_mortalidade_final_1") && !reducaoHabilitada) return null;
                    if (key === "tx_mortalidade_inicial_1") return null;
                    if (key === "reducao_crescimento_habilitada") return null;
                    if (type === "checkbox") {
                      return (
                        <Fragment key={key}>
                          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={val === 1}
                              onChange={(e) => {
                                const v = e.target.checked ? 1 : 0;
                                setInputValues((prev) => {
                                  const current = script.inputs.reduce(
                                    (acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }),
                                    {} as Record<string, number>
                                  );
                                  return { ...prev, [script.id]: { ...current, [key]: v } };
                                });
                              }}
                              className="rounded border-neutral-300"
                            />
                            <span>{label}</span>
                          </label>
                          {key === "reducao_crescimento_habilitada" && !reducaoHabilitada && (
                            <div className="w-full border-b border-neutral-300 pb-3 mb-2" aria-hidden />
                          )}
                        </Fragment>
                      );
                    }
                    if (key === "periodo_i1") return null;
                    if (type === "slider" && "sliderMin" in input && (input.sliderMaxKey != null || input.sliderMax != null)) {
                      const min = input.sliderMin ?? 0;
                      const max = input.sliderMax != null
                        ? Math.max(min, input.sliderMax)
                        : Math.max(min, inputValues[script.id]?.[input.sliderMaxKey!] ?? script.inputs.find((i) => i.key === input.sliderMaxKey!)?.default ?? 2000);
                      const sliderVal = clamp(min, val, max);
                      return (
                        <div key={key} className="w-full max-w-sm space-y-1">
                          <div className="flex justify-between text-sm text-neutral-700">
                            <span>{label}</span>
                            <span className="font-mono">{sliderVal}</span>
                          </div>
                          <input
                            type="range"
                            min={min}
                            max={max}
                            value={sliderVal}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setInputValues((prev) => {
                                const current = script.inputs.reduce(
                                  (acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }),
                                  {} as Record<string, number>
                                );
                                return { ...prev, [script.id]: { ...current, [key]: v } };
                              });
                            }}
                            className="w-full h-2 rounded-lg appearance-none bg-neutral-200 accent-neutral-800"
                          />
                        </div>
                      );
                    }
                    const step = input.step ?? 1;
                    const displayValue = Number.isNaN(val) ? "" : String(val);
                    const numInput = (
                      <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                        <span>{label}:</span>
                        <input
                          type="number"
                          min={input.min}
                          max={input.max}
                          step={step}
                          value={displayValue}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              // Permite campo vazio temporariamente
                              setInputValues((prev) => {
                                const current = script.inputs.reduce(
                                  (acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }),
                                  {} as Record<string, number>
                                );
                                return { ...prev, [script.id]: { ...current, [key]: NaN } };
                              });
                              return;
                            }
                            let num = Number(raw);
                            if (Number.isNaN(num)) return;
                            let v = step < 1 ? Math.round(num * 10) / 10 : num;
                            if (input.min != null && v < input.min) v = input.min;
                            if (input.max != null && v > input.max) v = input.max;
                            setInputValues((prev) => {
                              const current = script.inputs.reduce(
                                (acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }),
                                {} as Record<string, number>
                              );
                              return { ...prev, [script.id]: { ...current, [key]: v } };
                            });
                          }}
                          onBlur={(e) => {
                            // Aplica valor padrão se campo estiver vazio ao perder foco
                            if (e.target.value === "" || Number.isNaN(val)) {
                              setInputValues((prev) => {
                                const current = script.inputs.reduce(
                                  (acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }),
                                  {} as Record<string, number>
                                );
                                return { ...prev, [script.id]: { ...current, [key]: d } };
                              });
                            }
                          }}
                          className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm"
                        />
                      </label>
                    );
                    if (key === "tx_mortalidade_final_1") return null;
                    if (key === "qtde_direcoes") return null;
                    if (key === "dispersao_anual_media") {
                      const inputQtdeDir = script.inputs.find((i) => i.key === "qtde_direcoes")!;
                      const storedQtdeDir = (inputValues[script.id]?.["qtde_direcoes"] ?? inputQtdeDir.default) as number;
                      const keyQ3 = "dispersao_anual_media";
                      const storedVal = (val !== undefined && val !== null) ? val : d;
                      const stepQ3 = input.step ?? 1;
                      const decimals = stepQ3 < 1 ? 4 : 0;
                      const displayStr = keyQ3 in quadro3Edit ? quadro3Edit[keyQ3] : formatQuadro5Val(storedVal);
                      const applyQuadro3 = () => {
                        const s = quadro3Edit[keyQ3];
                        setQuadro3Edit((prev) => { const next = { ...prev }; delete next[keyQ3]; return next; });
                        if (s === "" || s === ".") return;
                        const num = Number(s);
                        if (!Number.isFinite(num)) return;
                        const v = stepQ3 < 1 ? Math.round(num * 10 ** decimals) / 10 ** decimals : Math.round(num);
                        const clamped = input.min != null && v < input.min ? input.min : input.max != null && v > input.max ? input.max : v;
                        setInputValues((prev) => {
                          const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                          return { ...prev, [script.id]: { ...current, [keyQ3]: clamped } };
                        });
                      };
                      if (configSidebarId) return null;
                      return (
                        <div key="quadro-3" className="w-full rounded-lg border border-neutral-300 bg-neutral-100/80 px-3 py-2 mt-2">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                              {tSistema.section3Displacement}
                            </p>
                            <button
                              type="button"
                              onClick={() => setShowDeslocamentoHelp(true)}
                              className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-neutral-400 bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300 text-xs font-bold leading-none"
                              title={tSistema.helpDisplacement}
                              aria-label="Ajuda: deslocamento e dispersão"
                            >
                              ?
                            </button>
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 text-sm text-neutral-700">
                              <span>{input.label}:</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={displayStr}
                                onFocus={() => setQuadro3Edit((prev) => ({ ...prev, [keyQ3]: formatQuadro5Val(storedVal) }))}
                                onChange={(e) => setQuadro3Edit((prev) => ({ ...prev, [keyQ3]: filterQuadro5Input(e.target.value) }))}
                                onBlur={applyQuadro3}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuadro3(); (e.target as HTMLInputElement).blur(); } }}
                                className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                              />
                              {input.min != null && input.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input.min}, {input.max}]</span>}
                            </label>
                            <label className="flex items-center gap-2 text-sm text-neutral-700">
                              <span>{inputQtdeDir.label}:</span>
                              <input
                                type="number"
                                min={inputQtdeDir.min ?? 2}
                                max={inputQtdeDir.max ?? 8}
                                step={1}
                                value={storedQtdeDir}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  if (!Number.isFinite(v)) return;
                                  const clamped = Math.round(clamp(2, v, 8));
                                  setInputValues((prev) => {
                                    const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                    return { ...prev, [script.id]: { ...current, qtde_direcoes: clamped } };
                                  });
                                }}
                                className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                              />
                              <span className="text-neutral-500 font-mono text-xs shrink-0">[2, 8]</span>
                            </label>
                          </div>
                          {(vals.adicionar_intervalo_2 ?? 0) === 1 && (() => {
                            const keyQ3_2 = "dispersao_anual_media_2";
                            const input2 = script.inputs.find((i) => i.key === keyQ3_2)!;
                            const d2 = input2.default;
                            const rawVal2 = inputValues[script.id]?.[keyQ3_2];
                            const storedVal2 = (rawVal2 !== undefined && rawVal2 !== null) ? rawVal2 : d2;
                            const step2 = input2.step ?? 1;
                            const decimals2 = step2 < 1 ? 4 : 0;
                            const displayStr2 = keyQ3_2 in quadro3Edit ? quadro3Edit[keyQ3_2] : formatQuadro5Val(storedVal2);
                            const applyQ3_2 = () => {
                              const s = quadro3Edit[keyQ3_2];
                              setQuadro3Edit((prev) => { const next = { ...prev }; delete next[keyQ3_2]; return next; });
                              if (s === "" || s === ".") return;
                              const num = Number(s);
                              if (!Number.isFinite(num)) return;
                              const v = step2 < 1 ? Math.round(num * 10 ** decimals2) / 10 ** decimals2 : Math.round(num);
                              const clamped = input2.min != null && v < input2.min ? input2.min : input2.max != null && v > input2.max ? input2.max : v;
                              setInputValues((prev) => {
                                const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                return { ...prev, [script.id]: { ...current, [keyQ3_2]: clamped } };
                              });
                            };
                            return (
                              <div key="quadro3-per2" className="mt-3 pt-3 border-t border-neutral-300">
                                <button type="button" onClick={() => setExpandPeriodo2Quadro3((b) => !b)} className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800">
                                  <span className="shrink-0">{expandPeriodo2Quadro3 ? "▼" : "▶"}</span>
                                  <span>Period 2</span>
                                </button>
                                {expandPeriodo2Quadro3 && (
                                  <div className="flex flex-col gap-2 mt-2 pl-4">
                                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                                      <span>{input2.label}:</span>
                                      <input type="text" inputMode="decimal" value={displayStr2}
                                        onFocus={() => setQuadro3Edit((prev) => ({ ...prev, [keyQ3_2]: formatQuadro5Val(storedVal2) }))}
                                        onChange={(e) => setQuadro3Edit((prev) => ({ ...prev, [keyQ3_2]: filterQuadro5Input(e.target.value) }))}
                                        onBlur={applyQ3_2}
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQ3_2(); (e.target as HTMLInputElement).blur(); } }}
                                        className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                      />
                                      {input2.min != null && input2.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input2.min}, {input2.max}]</span>}
                                    </label>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {(vals.adicionar_intervalo_3 ?? 0) === 1 && (() => {
                            const keyQ3_3 = "dispersao_anual_media_3";
                            const input3 = script.inputs.find((i) => i.key === keyQ3_3)!;
                            const d3 = input3.default;
                            const rawVal3 = inputValues[script.id]?.[keyQ3_3];
                            const storedVal3 = (rawVal3 !== undefined && rawVal3 !== null) ? rawVal3 : d3;
                            const step3 = input3.step ?? 1;
                            const decimals3 = step3 < 1 ? 4 : 0;
                            const displayStr3 = keyQ3_3 in quadro3Edit ? quadro3Edit[keyQ3_3] : formatQuadro5Val(storedVal3);
                            const applyQ3_3 = () => {
                              const s = quadro3Edit[keyQ3_3];
                              setQuadro3Edit((prev) => { const next = { ...prev }; delete next[keyQ3_3]; return next; });
                              if (s === "" || s === ".") return;
                              const num = Number(s);
                              if (!Number.isFinite(num)) return;
                              const v = step3 < 1 ? Math.round(num * 10 ** decimals3) / 10 ** decimals3 : Math.round(num);
                              const clamped = input3.min != null && v < input3.min ? input3.min : input3.max != null && v > input3.max ? input3.max : v;
                              setInputValues((prev) => {
                                const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                return { ...prev, [script.id]: { ...current, [keyQ3_3]: clamped } };
                              });
                            };
                            return (
                              <div key="quadro3-per3" className="mt-3 pt-3 border-t border-neutral-300">
                                <button type="button" onClick={() => setExpandPeriodo3Quadro3((b) => !b)} className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800">
                                  <span className="shrink-0">{expandPeriodo3Quadro3 ? "▼" : "▶"}</span>
                                  <span>Period 3</span>
                                </button>
                                {expandPeriodo3Quadro3 && (
                                  <div className="flex flex-col gap-2 mt-2 pl-4">
                                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                                      <span>{input3.label}:</span>
                                      <input type="text" inputMode="decimal" value={displayStr3}
                                        onFocus={() => setQuadro3Edit((prev) => ({ ...prev, [keyQ3_3]: formatQuadro5Val(storedVal3) }))}
                                        onChange={(e) => setQuadro3Edit((prev) => ({ ...prev, [keyQ3_3]: filterQuadro5Input(e.target.value) }))}
                                        onBlur={applyQ3_3}
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQ3_3(); (e.target as HTMLInputElement).blur(); } }}
                                        className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                      />
                                      {input3.min != null && input3.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input3.min}, {input3.max}]</span>}
                                    </label>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    }
                    return numInput;
                  });
                  const idadeFertilMaxVal = Number(inputValues[script.id]?.idade_fertil_max ?? script.inputs.find((i) => i.key === "idade_fertil_max")?.default ?? 50);
                  const idadeInicioVelhice = idadeFertilMaxVal + 1;
                  return (
                    <>
                      {renderedInputs.slice(0, mortalidadeQuadroStartIdx)}
                      {!configSidebarId && (
                        <div key="config-mortalidade-velhice" className="w-full rounded-lg border border-neutral-300 bg-neutral-100/80 px-3 py-2 mt-2">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                              {tSistema.section5OldAge}
                            </p>
                            <button
                              type="button"
                              onClick={() => setShowMortalidadeVelhiceHelp(true)}
                              className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-neutral-400 bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300 text-xs font-bold leading-none"
                              title={tSistema.helpOldAgeMortality}
                              aria-label={`${tSistema.help}: ${tSistema.panelOldAgeMortality}`}
                            >
                              ?
                            </button>
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="text-sm font-medium text-neutral-700">
                              idade_inicio_velhice = <span className="font-mono font-semibold">{idadeInicioVelhice}</span>
                            </div>
                            {(["max_idade", "fragilidade_inicial", "taxa_envelhecimento"] as const).map((key) => {
                              const input = script.inputs.find((i) => i.key === key)!;
                              const d = input.default;
                              const rawVal = inputValues[script.id]?.[key];
                              const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
                              const step = input.step ?? 1;
                              const decimals = step < 1 ? 4 : 0;
                              const isEditing = key in quadro5Edit;
                              const displayStr = isEditing ? quadro5Edit[key] : formatQuadro5Val(storedVal);
                              const applyQuadro5 = () => {
                                const s = quadro5Edit[key];
                                setQuadro5Edit((prev) => { const next = { ...prev }; delete next[key]; return next; });
                                if (s === "" || s === ".") return;
                                const num = Number(s);
                                if (!Number.isFinite(num)) return;
                                const v = step < 1 ? Math.round(num * 10 ** decimals) / 10 ** decimals : Math.round(num);
                                const clamped = input.min != null && v < input.min ? input.min : input.max != null && v > input.max ? input.max : v;
                                setInputValues((prev) => {
                                  const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                  return { ...prev, [script.id]: { ...current, [key]: clamped } };
                                });
                              };
                              return (
                                <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                                  <span>{input.label}:</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={displayStr}
                                    onFocus={() => setQuadro5Edit((prev) => ({ ...prev, [key]: formatQuadro5Val(storedVal) }))}
                                    onChange={(e) => setQuadro5Edit((prev) => ({ ...prev, [key]: filterQuadro5Input(e.target.value) }))}
                                    onBlur={applyQuadro5}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuadro5(); (e.target as HTMLInputElement).blur(); } }}
                                    className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                  />
                                  {input.min != null && input.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input.min}, {input.max}]</span>}
                                </label>
                              );
                            })}
                          </div>
                          {(vals.adicionar_intervalo_2 ?? 0) === 1 && (() => {
                            const keysPer2 = ["max_idade_2", "fragilidade_inicial_2", "taxa_envelhecimento_2"] as const;
                            return (
                              <div className="mt-3 pt-3 border-t border-neutral-300">
                                <button
                                  type="button"
                                  onClick={() => setExpandPeriodo2Quadro5((b) => !b)}
                                  className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800"
                                >
                                  <span className="shrink-0">{expandPeriodo2Quadro5 ? "▼" : "▶"}</span>
                                  <span>Period 2</span>
                                </button>
                                {expandPeriodo2Quadro5 && (
                                  <div className="flex flex-col gap-2 mt-2 pl-4">
                                    {keysPer2.map((key) => {
                                      const input = script.inputs.find((i) => i.key === key)!;
                                      const d = input.default;
                                      const rawVal = inputValues[script.id]?.[key];
                                      const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
                                      const step = input.step ?? 1;
                                      const decimals = step < 1 ? 4 : 0;
                                      const isEditing = key in quadro5Edit;
                                      const displayStr = isEditing ? quadro5Edit[key] : formatQuadro5Val(storedVal);
                                      const applyQuadro5 = () => {
                                        const s = quadro5Edit[key];
                                        setQuadro5Edit((prev) => { const next = { ...prev }; delete next[key]; return next; });
                                        if (s === "" || s === ".") return;
                                        const num = Number(s);
                                        if (!Number.isFinite(num)) return;
                                        const v = step < 1 ? Math.round(num * 10 ** decimals) / 10 ** decimals : Math.round(num);
                                        const clamped = input.min != null && v < input.min ? input.min : input.max != null && v > input.max ? input.max : v;
                                        setInputValues((prev) => {
                                          const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                          return { ...prev, [script.id]: { ...current, [key]: clamped } };
                                        });
                                      };
                                      return (
                                        <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                                          <span>{input.label}:</span>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={displayStr}
                                            onFocus={() => setQuadro5Edit((prev) => ({ ...prev, [key]: formatQuadro5Val(storedVal) }))}
                                            onChange={(e) => setQuadro5Edit((prev) => ({ ...prev, [key]: filterQuadro5Input(e.target.value) }))}
                                            onBlur={applyQuadro5}
                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuadro5(); (e.target as HTMLInputElement).blur(); } }}
                                            className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                          />
                                          {input.min != null && input.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input.min}, {input.max}]</span>}
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {(vals.adicionar_intervalo_3 ?? 0) === 1 && (() => {
                            const keysPer3 = ["max_idade_3", "fragilidade_inicial_3", "taxa_envelhecimento_3"] as const;
                            return (
                              <div className="mt-3 pt-3 border-t border-neutral-300">
                                <button
                                  type="button"
                                  onClick={() => setExpandPeriodo3Quadro5((b) => !b)}
                                  className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800"
                                >
                                  <span className="shrink-0">{expandPeriodo3Quadro5 ? "▼" : "▶"}</span>
                                  <span>Period 3</span>
                                </button>
                                {expandPeriodo3Quadro5 && (
                                  <div className="flex flex-col gap-2 mt-2 pl-4">
                                    {keysPer3.map((key) => {
                                      const input = script.inputs.find((i) => i.key === key)!;
                                      const d = input.default;
                                      const rawVal = inputValues[script.id]?.[key];
                                      const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
                                      const step = input.step ?? 1;
                                      const decimals = step < 1 ? 4 : 0;
                                      const isEditing = key in quadro5Edit;
                                      const displayStr = isEditing ? quadro5Edit[key] : formatQuadro5Val(storedVal);
                                      const applyQuadro5 = () => {
                                        const s = quadro5Edit[key];
                                        setQuadro5Edit((prev) => { const next = { ...prev }; delete next[key]; return next; });
                                        if (s === "" || s === ".") return;
                                        const num = Number(s);
                                        if (!Number.isFinite(num)) return;
                                        const v = step < 1 ? Math.round(num * 10 ** decimals) / 10 ** decimals : Math.round(num);
                                        const clamped = input.min != null && v < input.min ? input.min : input.max != null && v > input.max ? input.max : v;
                                        setInputValues((prev) => {
                                          const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                          return { ...prev, [script.id]: { ...current, [key]: clamped } };
                                        });
                                      };
                                      return (
                                        <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                                          <span>{input.label}:</span>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={displayStr}
                                            onFocus={() => setQuadro5Edit((prev) => ({ ...prev, [key]: formatQuadro5Val(storedVal) }))}
                                            onChange={(e) => setQuadro5Edit((prev) => ({ ...prev, [key]: filterQuadro5Input(e.target.value) }))}
                                            onBlur={applyQuadro5}
                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuadro5(); (e.target as HTMLInputElement).blur(); } }}
                                            className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                          />
                                          {input.min != null && input.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input.min}, {input.max}]</span>}
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      {!configSidebarId && (() => {
                        const defaultFatorContinentalQ6 = script.inputs.find((i) => i.key === "fator_continental_habilitado")?.default ?? 0;
                        const fatorContinentalHabilitado = (vals.fator_continental_habilitado ?? defaultFatorContinentalQ6) === 1;
                        const toggleKeyQ6 = "fator_continental_habilitado";
                        const toggleValQ6 = (inputValues[script.id]?.[toggleKeyQ6] ?? defaultFatorContinentalQ6) === 1;
                        return (
                          <div key="config-fator-continental" className="w-full rounded-lg border border-neutral-300 bg-neutral-100/80 px-3 py-2 mt-2">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                                {tSistema.section6Continental}
                              </p>
                              <button
                                type="button"
                                onClick={() => setShowQuadro6Help(true)}
                                className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-neutral-400 bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300 text-xs font-bold leading-none"
                                title={tSistema.helpContinental}
                                aria-label="Ajuda: fator continental de mortalidade"
                              >
                                ?
                              </button>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer select-none mb-2">
                              <span className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${toggleValQ6 ? "bg-emerald-500" : "bg-neutral-300"}`} aria-hidden>
                                <input
                                  type="checkbox"
                                  checked={toggleValQ6}
                                  onChange={(e) => {
                                    const v = e.target.checked ? 1 : 0;
                                    setInputValues((prev) => {
                                      const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                      return { ...prev, [script.id]: { ...current, [toggleKeyQ6]: v } };
                                    });
                                  }}
                                  className="sr-only peer"
                                  aria-label="Habilitar ou desabilitar fator continental"
                                />
                                <span className={`pointer-events-none absolute left-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${toggleValQ6 ? "translate-x-4" : "translate-x-0"}`} />
                              </span>
                              <span>Fator continental <strong>{toggleValQ6 ? "habilitado" : "desabilitado"}</strong></span>
                            </label>
                            {!fatorContinentalHabilitado && (
                              <p className="text-xs text-neutral-500 italic mb-2">Desabilitado: cor = 0 e fator = 1 para todos os vetores.</p>
                            )}
                            <div className="bio-continental-rows flex flex-col gap-y-2">
                              {(["fator_mortalidade_cor0", "fator_mortalidade_cor1", "fator_mortalidade_cor2", "fator_mortalidade_cor3", "fator_mortalidade_cor4", "fator_mortalidade_cor5", "fator_mortalidade_cor6"] as const).map((key) => {
                                const input = script.inputs.find((i) => i.key === key)!;
                                const d = input.default;
                                const rawVal = inputValues[script.id]?.[key];
                                const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
                                const inputId = `q6-${key}`;
                                return (
                                  <div key={key} className="bio-continental-row grid grid-cols-[minmax(8rem,1fr)_7rem_auto] gap-x-3 items-center">
                                    <label htmlFor={inputId} className={`text-sm truncate cursor-pointer ${fatorContinentalHabilitado ? "text-neutral-700" : "text-neutral-500"}`}>
                                      {input.label}:
                                    </label>
                                    <input
                                      id={inputId}
                                      type="number"
                                      step={0.0001}
                                      min={0}
                                      max={2}
                                      value={storedVal}
                                      disabled={!fatorContinentalHabilitado}
                                      onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (!Number.isFinite(v)) return;
                                        const clamped = clamp(0, v, 2);
                                        setInputValues((prev) => {
                                          const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                          return { ...prev, [script.id]: { ...current, [key]: clamped } };
                                        });
                                      }}
                                      className="w-full min-w-0 rounded border border-neutral-300 px-2 py-1 text-sm font-mono disabled:bg-neutral-200 disabled:cursor-not-allowed box-border"
                                    />
                                    <span className="text-neutral-500 font-mono text-xs shrink-0">[0, 2.0000]</span>
                                  </div>
                                );
                              })}
                            </div>
                            {(vals.adicionar_intervalo_2 ?? 0) === 1 && (() => {
                              const keysPer2 = ["fator_mortalidade_cor0_2", "fator_mortalidade_cor1_2", "fator_mortalidade_cor2_2", "fator_mortalidade_cor3_2", "fator_mortalidade_cor4_2", "fator_mortalidade_cor5_2", "fator_mortalidade_cor6_2"] as const;
                              return (
                                <div className="mt-3 pt-3 border-t border-neutral-300">
                                  <button
                                    type="button"
                                    onClick={() => setExpandPeriodo2Quadro6((b) => !b)}
                                    className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800"
                                  >
                                    <span className="shrink-0">{expandPeriodo2Quadro6 ? "▼" : "▶"}</span>
                                    <span>Period 2</span>
                                  </button>
                                  {expandPeriodo2Quadro6 && (
                                    <div className="bio-continental-rows flex flex-col gap-y-2 mt-2 pl-4">
                                      {keysPer2.map((key) => {
                                        const input = script.inputs.find((i) => i.key === key)!;
                                        const d = input.default;
                                        const rawVal = inputValues[script.id]?.[key];
                                        const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
                                        const inputId = `q6-p2-${key}`;
                                        return (
                                          <div key={key} className="bio-continental-row grid grid-cols-[minmax(8rem,1fr)_7rem_auto] gap-x-3 items-center">
                                            <label htmlFor={inputId} className={`text-sm truncate cursor-pointer ${fatorContinentalHabilitado ? "text-neutral-700" : "text-neutral-500"}`}>
                                              {input.label}:
                                            </label>
                                            <input
                                              id={inputId}
                                              type="number"
                                              step={0.0001}
                                              min={0}
                                              max={2}
                                              value={storedVal}
                                              disabled={!fatorContinentalHabilitado}
                                              onChange={(e) => {
                                                const v = Number(e.target.value);
                                                if (!Number.isFinite(v)) return;
                                                const clamped = clamp(0, v, 2);
                                                setInputValues((prev) => {
                                                  const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                                  return { ...prev, [script.id]: { ...current, [key]: clamped } };
                                                });
                                              }}
                                              className="w-full min-w-0 rounded border border-neutral-300 px-2 py-1 text-sm font-mono disabled:bg-neutral-200 disabled:cursor-not-allowed box-border"
                                            />
                                            <span className="text-neutral-500 font-mono text-xs shrink-0">[0, 2.0000]</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            {(vals.adicionar_intervalo_3 ?? 0) === 1 && (() => {
                              const keysPer3 = ["fator_mortalidade_cor0_3", "fator_mortalidade_cor1_3", "fator_mortalidade_cor2_3", "fator_mortalidade_cor3_3", "fator_mortalidade_cor4_3", "fator_mortalidade_cor5_3", "fator_mortalidade_cor6_3"] as const;
                              return (
                                <div className="mt-3 pt-3 border-t border-neutral-300">
                                  <button
                                    type="button"
                                    onClick={() => setExpandPeriodo3Quadro6((b) => !b)}
                                    className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800"
                                  >
                                    <span className="shrink-0">{expandPeriodo3Quadro6 ? "▼" : "▶"}</span>
                                    <span>Period 3</span>
                                  </button>
                                  {expandPeriodo3Quadro6 && (
                                    <div className="bio-continental-rows flex flex-col gap-y-2 mt-2 pl-4">
                                      {keysPer3.map((key) => {
                                        const input = script.inputs.find((i) => i.key === key)!;
                                        const d = input.default;
                                        const rawVal = inputValues[script.id]?.[key];
                                        const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
                                        const inputId = `q6-p3-${key}`;
                                        return (
                                          <div key={key} className="bio-continental-row grid grid-cols-[minmax(8rem,1fr)_7rem_auto] gap-x-3 items-center">
                                            <label htmlFor={inputId} className={`text-sm truncate cursor-pointer ${fatorContinentalHabilitado ? "text-neutral-700" : "text-neutral-500"}`}>
                                              {input.label}:
                                            </label>
                                            <input
                                              id={inputId}
                                              type="number"
                                              step={0.0001}
                                              min={0}
                                              max={2}
                                              value={storedVal}
                                              disabled={!fatorContinentalHabilitado}
                                              onChange={(e) => {
                                                const v = Number(e.target.value);
                                                if (!Number.isFinite(v)) return;
                                                const clamped = clamp(0, v, 2);
                                                setInputValues((prev) => {
                                                  const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                                  return { ...prev, [script.id]: { ...current, [key]: clamped } };
                                                });
                                              }}
                                              className="w-full min-w-0 rounded border border-neutral-300 px-2 py-1 text-sm font-mono disabled:bg-neutral-200 disabled:cursor-not-allowed box-border"
                                            />
                                            <span className="text-neutral-500 font-mono text-xs shrink-0">[0, 2.0000]</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                      {renderedInputs.slice(mortalidadeQuadroEndIdx + 1, reproStartIdx)}
                      {!configSidebarId && (
                        <div key="config-reproducao" className="w-full rounded-lg border border-neutral-300 bg-neutral-100/80 px-3 py-2 mt-2">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                              {tSistema.section2Reproduction}
                            </p>
                            <button
                              type="button"
                              onClick={() => setShowReproHelp(true)}
                              className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-neutral-400 bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300 text-xs font-bold leading-none"
                              title={tSistema.helpReproduction}
                              aria-label="Ajuda: parâmetros de reprodução"
                            >
                              ?
                            </button>
                          </div>
                          <div className="flex flex-col gap-2">
                            {(["idade_fertil_min", "idade_fertil_max", "idade_fertil_pico", "prob_anual_reproducao"] as const).map((key) => {
                              const input = script.inputs.find((i) => i.key === key)!;
                              const d = input.default;
                              const rawVal = inputValues[script.id]?.[key];
                              const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
                              const step = input.step ?? 1;
                              const decimals = step < 1 ? 4 : 0;
                              const displayStr = key in quadro2Edit ? quadro2Edit[key] : formatQuadro5Val(storedVal);
                              const applyQuadro2 = () => {
                                const s = quadro2Edit[key];
                                setQuadro2Edit((prev) => { const next = { ...prev }; delete next[key]; return next; });
                                if (s === "" || s === ".") return;
                                const num = Number(s);
                                if (!Number.isFinite(num)) return;
                                const v = step < 1 ? Math.round(num * 10 ** decimals) / 10 ** decimals : Math.round(num);
                                const clamped = input.min != null && v < input.min ? input.min : input.max != null && v > input.max ? input.max : v;
                                setInputValues((prev) => {
                                  const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                  return { ...prev, [script.id]: { ...current, [key]: clamped } };
                                });
                              };
                              return (
                                <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                                  <span>{input.label}:</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={displayStr}
                                    onFocus={() => setQuadro2Edit((prev) => ({ ...prev, [key]: formatQuadro5Val(storedVal) }))}
                                    onChange={(e) => setQuadro2Edit((prev) => ({ ...prev, [key]: filterQuadro5Input(e.target.value) }))}
                                    onBlur={applyQuadro2}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuadro2(); (e.target as HTMLInputElement).blur(); } }}
                                    className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                  />
                                  {input.min != null && input.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input.min}, {input.max}]</span>}
                                </label>
                              );
                            })}
                          </div>
                          {(vals.adicionar_intervalo_2 ?? 0) === 1 && (() => {
                            const keysPer2 = ["idade_fertil_min_2", "idade_fertil_max_2", "idade_fertil_pico_2", "prob_anual_reproducao_2"] as const;
                            return (
                              <div className="mt-3 pt-3 border-t border-neutral-300">
                                <button
                                  type="button"
                                  onClick={() => setExpandPeriodo2Quadro2((b) => !b)}
                                  className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800"
                                >
                                  <span className="shrink-0">{expandPeriodo2Quadro2 ? "▼" : "▶"}</span>
                                  <span>Period 2</span>
                                </button>
                                {expandPeriodo2Quadro2 && (
                                  <div className="flex flex-col gap-2 mt-2 pl-4">
                                    {keysPer2.map((key) => {
                                      const input = script.inputs.find((i) => i.key === key)!;
                                      const d = input.default;
                                      const rawVal = inputValues[script.id]?.[key];
                                      const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
                                      const step = input.step ?? 1;
                                      const decimals = step < 1 ? 4 : 0;
                                      const displayStr = key in quadro2Edit ? quadro2Edit[key] : formatQuadro5Val(storedVal);
                                      const applyQuadro2 = () => {
                                        const s = quadro2Edit[key];
                                        setQuadro2Edit((prev) => { const next = { ...prev }; delete next[key]; return next; });
                                        if (s === "" || s === ".") return;
                                        const num = Number(s);
                                        if (!Number.isFinite(num)) return;
                                        const v = step < 1 ? Math.round(num * 10 ** decimals) / 10 ** decimals : Math.round(num);
                                        const clamped = input.min != null && v < input.min ? input.min : input.max != null && v > input.max ? input.max : v;
                                        setInputValues((prev) => {
                                          const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                          return { ...prev, [script.id]: { ...current, [key]: clamped } };
                                        });
                                      };
                                      return (
                                        <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                                          <span>{input.label}:</span>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={displayStr}
                                            onFocus={() => setQuadro2Edit((prev) => ({ ...prev, [key]: formatQuadro5Val(storedVal) }))}
                                            onChange={(e) => setQuadro2Edit((prev) => ({ ...prev, [key]: filterQuadro5Input(e.target.value) }))}
                                            onBlur={applyQuadro2}
                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuadro2(); (e.target as HTMLInputElement).blur(); } }}
                                            className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                          />
                                          {input.min != null && input.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input.min}, {input.max}]</span>}
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {(vals.adicionar_intervalo_3 ?? 0) === 1 && (() => {
                            const keysPer3 = ["idade_fertil_min_3", "idade_fertil_max_3", "idade_fertil_pico_3", "prob_anual_reproducao_3"] as const;
                            return (
                              <div className="mt-3 pt-3 border-t border-neutral-300">
                                <button
                                  type="button"
                                  onClick={() => setExpandPeriodo3Quadro2((b) => !b)}
                                  className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800"
                                >
                                  <span className="shrink-0">{expandPeriodo3Quadro2 ? "▼" : "▶"}</span>
                                  <span>Period 3</span>
                                </button>
                                {expandPeriodo3Quadro2 && (
                                  <div className="flex flex-col gap-2 mt-2 pl-4">
                                    {keysPer3.map((key) => {
                                      const input = script.inputs.find((i) => i.key === key)!;
                                      const d = input.default;
                                      const rawVal = inputValues[script.id]?.[key];
                                      const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
                                      const step = input.step ?? 1;
                                      const decimals = step < 1 ? 4 : 0;
                                      const displayStr = key in quadro2Edit ? quadro2Edit[key] : formatQuadro5Val(storedVal);
                                      const applyQuadro2 = () => {
                                        const s = quadro2Edit[key];
                                        setQuadro2Edit((prev) => { const next = { ...prev }; delete next[key]; return next; });
                                        if (s === "" || s === ".") return;
                                        const num = Number(s);
                                        if (!Number.isFinite(num)) return;
                                        const v = step < 1 ? Math.round(num * 10 ** decimals) / 10 ** decimals : Math.round(num);
                                        const clamped = input.min != null && v < input.min ? input.min : input.max != null && v > input.max ? input.max : v;
                                        setInputValues((prev) => {
                                          const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                          return { ...prev, [script.id]: { ...current, [key]: clamped } };
                                        });
                                      };
                                      return (
                                        <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                                          <span>{input.label}:</span>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={displayStr}
                                            onFocus={() => setQuadro2Edit((prev) => ({ ...prev, [key]: formatQuadro5Val(storedVal) }))}
                                            onChange={(e) => setQuadro2Edit((prev) => ({ ...prev, [key]: filterQuadro5Input(e.target.value) }))}
                                            onBlur={applyQuadro2}
                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuadro2(); (e.target as HTMLInputElement).blur(); } }}
                                            className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                          />
                                          {input.min != null && input.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input.min}, {input.max}]</span>}
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      {!configSidebarId && (
                        <div key="config-fecundidade-parto" className="w-full rounded-lg border border-neutral-300 bg-neutral-100/80 px-3 py-2 mt-2">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                              {tSistema.section4BirthFecundity}
                            </p>
                            <button
                              type="button"
                              onClick={() => setShowFecundidadePartoHelp(true)}
                              className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-neutral-400 bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300 text-xs font-bold leading-none"
                              title={tSistema.helpBirthFecundity}
                              aria-label="Ajuda: fecundidade do parto"
                            >
                              ?
                            </button>
                          </div>
                          <div className="flex flex-col gap-2">
                            {(["tx_decaimento_pos_pico", "fecundidade_media_parto", "fecundidade_max_parto"] as const).map((key) => {
                              const input = script.inputs.find((i) => i.key === key)!;
                              const d = input.default;
                              const rawVal = inputValues[script.id]?.[key];
                              const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
                              const step = input.step ?? 1;
                              const decimals = step < 1 ? 4 : 0;
                              const displayStr = key in quadro4Edit ? quadro4Edit[key] : formatQuadro5Val(storedVal);
                              const applyQuadro4 = () => {
                                const s = quadro4Edit[key];
                                setQuadro4Edit((prev) => { const next = { ...prev }; delete next[key]; return next; });
                                if (s === "" || s === ".") return;
                                const num = Number(s);
                                if (!Number.isFinite(num)) return;
                                const v = step < 1 ? Math.round(num * 10 ** decimals) / 10 ** decimals : Math.round(num);
                                const clamped = input.min != null && v < input.min ? input.min : input.max != null && v > input.max ? input.max : v;
                                setInputValues((prev) => {
                                  const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                  return { ...prev, [script.id]: { ...current, [key]: clamped } };
                                });
                              };
                              return (
                                <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                                  <span>{input.label}:</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={displayStr}
                                    onFocus={() => setQuadro4Edit((prev) => ({ ...prev, [key]: formatQuadro5Val(storedVal) }))}
                                    onChange={(e) => setQuadro4Edit((prev) => ({ ...prev, [key]: filterQuadro5Input(e.target.value) }))}
                                    onBlur={applyQuadro4}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuadro4(); (e.target as HTMLInputElement).blur(); } }}
                                    className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                  />
                                  {input.min != null && input.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input.min}, {input.max}]</span>}
                                </label>
                              );
                            })}
                          </div>
                          {(vals.adicionar_intervalo_2 ?? 0) === 1 && (() => {
                            const keysPer2 = ["tx_decaimento_pos_pico_2", "fecundidade_media_parto_2", "fecundidade_max_parto_2"] as const;
                            return (
                              <div className="mt-3 pt-3 border-t border-neutral-300">
                                <button
                                  type="button"
                                  onClick={() => setExpandPeriodo2Quadro4((b) => !b)}
                                  className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800"
                                >
                                  <span className="shrink-0">{expandPeriodo2Quadro4 ? "▼" : "▶"}</span>
                                  <span>Period 2</span>
                                </button>
                                {expandPeriodo2Quadro4 && (
                                  <div className="flex flex-col gap-2 mt-2 pl-4">
                                    {keysPer2.map((key) => {
                                      const input = script.inputs.find((i) => i.key === key)!;
                                      const d = input.default;
                                      const rawVal = inputValues[script.id]?.[key];
                                      const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
                                      const step = input.step ?? 1;
                                      const decimals = step < 1 ? 4 : 0;
                                      const displayStr = key in quadro4Edit ? quadro4Edit[key] : formatQuadro5Val(storedVal);
                                      const applyQuadro4 = () => {
                                        const s = quadro4Edit[key];
                                        setQuadro4Edit((prev) => { const next = { ...prev }; delete next[key]; return next; });
                                        if (s === "" || s === ".") return;
                                        const num = Number(s);
                                        if (!Number.isFinite(num)) return;
                                        const v = step < 1 ? Math.round(num * 10 ** decimals) / 10 ** decimals : Math.round(num);
                                        const clamped = input.min != null && v < input.min ? input.min : input.max != null && v > input.max ? input.max : v;
                                        setInputValues((prev) => {
                                          const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                          return { ...prev, [script.id]: { ...current, [key]: clamped } };
                                        });
                                      };
                                      return (
                                        <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                                          <span>{input.label}:</span>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={displayStr}
                                            onFocus={() => setQuadro4Edit((prev) => ({ ...prev, [key]: formatQuadro5Val(storedVal) }))}
                                            onChange={(e) => setQuadro4Edit((prev) => ({ ...prev, [key]: filterQuadro5Input(e.target.value) }))}
                                            onBlur={applyQuadro4}
                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuadro4(); (e.target as HTMLInputElement).blur(); } }}
                                            className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                          />
                                          {input.min != null && input.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input.min}, {input.max}]</span>}
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {(vals.adicionar_intervalo_3 ?? 0) === 1 && (() => {
                            const keysPer3 = ["tx_decaimento_pos_pico_3", "fecundidade_media_parto_3", "fecundidade_max_parto_3"] as const;
                            return (
                              <div className="mt-3 pt-3 border-t border-neutral-300">
                                <button
                                  type="button"
                                  onClick={() => setExpandPeriodo3Quadro4((b) => !b)}
                                  className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800"
                                >
                                  <span className="shrink-0">{expandPeriodo3Quadro4 ? "▼" : "▶"}</span>
                                  <span>Period 3</span>
                                </button>
                                {expandPeriodo3Quadro4 && (
                                  <div className="flex flex-col gap-2 mt-2 pl-4">
                                    {keysPer3.map((key) => {
                                      const input = script.inputs.find((i) => i.key === key)!;
                                      const d = input.default;
                                      const rawVal = inputValues[script.id]?.[key];
                                      const storedVal = (rawVal !== undefined && rawVal !== null) ? rawVal : d;
                                      const step = input.step ?? 1;
                                      const decimals = step < 1 ? 4 : 0;
                                      const displayStr = key in quadro4Edit ? quadro4Edit[key] : formatQuadro5Val(storedVal);
                                      const applyQuadro4 = () => {
                                        const s = quadro4Edit[key];
                                        setQuadro4Edit((prev) => { const next = { ...prev }; delete next[key]; return next; });
                                        if (s === "" || s === ".") return;
                                        const num = Number(s);
                                        if (!Number.isFinite(num)) return;
                                        const v = step < 1 ? Math.round(num * 10 ** decimals) / 10 ** decimals : Math.round(num);
                                        const clamped = input.min != null && v < input.min ? input.min : input.max != null && v > input.max ? input.max : v;
                                        setInputValues((prev) => {
                                          const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                          return { ...prev, [script.id]: { ...current, [key]: clamped } };
                                        });
                                      };
                                      return (
                                        <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                                          <span>{input.label}:</span>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={displayStr}
                                            onFocus={() => setQuadro4Edit((prev) => ({ ...prev, [key]: formatQuadro5Val(storedVal) }))}
                                            onChange={(e) => setQuadro4Edit((prev) => ({ ...prev, [key]: filterQuadro5Input(e.target.value) }))}
                                            onBlur={applyQuadro4}
                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQuadro4(); (e.target as HTMLInputElement).blur(); } }}
                                            className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                          />
                                          {input.min != null && input.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{input.min}, {input.max}]</span>}
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      {renderedInputs.slice(reproEndIdx + 1, expansionStartIdx)}
                      {!configSidebarId && (
                        <div key="taxa-mortalidade" className="w-full rounded-lg border border-neutral-300 bg-neutral-100/80 px-3 py-2 mt-2">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                              {tSistema.section1Mortality}
                            </p>
                            <button
                              type="button"
                              onClick={() => setShowQuadro1MortalidadeHelp(true)}
                              className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-neutral-400 bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300 text-xs font-bold leading-none"
                              title={tSistema.helpMortalityResidual}
                              aria-label="Ajuda: taxa de mortalidade residual anual (quadro 1)"
                            >
                              ?
                            </button>
                          </div>
                          <div className="flex flex-col gap-2">
                            {(() => {
                              const keyQ1Inicial = "tx_mortalidade_inicial_1";
                              const inputInicial = script.inputs.find((i) => i.key === keyQ1Inicial)!;
                              const dInicial = inputInicial.default;
                              const rawInicial = inputValues[script.id]?.[keyQ1Inicial];
                              const storedInicial = (rawInicial !== undefined && rawInicial !== null) ? rawInicial : dInicial;
                              const stepInicial = inputInicial.step ?? 1;
                              const decimalsInicial = stepInicial < 1 ? 4 : 0;
                              const displayInicial = keyQ1Inicial in quadro1Edit ? quadro1Edit[keyQ1Inicial] : formatQuadro5Val(storedInicial);
                              const applyQ1Inicial = () => {
                                const s = quadro1Edit[keyQ1Inicial];
                                setQuadro1Edit((prev) => { const next = { ...prev }; delete next[keyQ1Inicial]; return next; });
                                if (s === "" || s === ".") return;
                                const num = Number(s);
                                if (!Number.isFinite(num)) return;
                                const v = stepInicial < 1 ? Math.round(num * 10 ** decimalsInicial) / 10 ** decimalsInicial : Math.round(num);
                                const clamped = inputInicial.min != null && v < inputInicial.min ? inputInicial.min : inputInicial.max != null && v > inputInicial.max ? inputInicial.max : v;
                                setInputValues((prev) => {
                                  const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                  return { ...prev, [script.id]: { ...current, [keyQ1Inicial]: clamped } };
                                });
                              };
                              return (
                                <label key={keyQ1Inicial} className="flex items-center gap-2 text-sm text-neutral-700">
                                  <span>initial_mortality_rate (%):</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={displayInicial}
                                    onFocus={() => setQuadro1Edit((prev) => ({ ...prev, [keyQ1Inicial]: formatQuadro5Val(storedInicial) }))}
                                    onChange={(e) => setQuadro1Edit((prev) => ({ ...prev, [keyQ1Inicial]: filterQuadro5Input(e.target.value) }))}
                                    onBlur={applyQ1Inicial}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQ1Inicial(); (e.target as HTMLInputElement).blur(); } }}
                                    className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                  />
                                  {inputInicial.min != null && inputInicial.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{inputInicial.min}, {inputInicial.max}]</span>}
                                </label>
                              );
                            })()}
                            {(() => {
                              const keyQ1Final = "tx_mortalidade_final_1";
                              const inputFinal = script.inputs.find((i) => i.key === keyQ1Final)!;
                              const dFinal = inputFinal.default;
                              const rawFinal = inputValues[script.id]?.[keyQ1Final];
                              const storedFinal = (rawFinal !== undefined && rawFinal !== null) ? rawFinal : dFinal;
                              const stepFinal = inputFinal.step ?? 1;
                              const decimalsFinal = stepFinal < 1 ? 4 : 0;
                              const displayFinal = keyQ1Final in quadro1Edit ? quadro1Edit[keyQ1Final] : formatQuadro5Val(storedFinal);
                              const applyQ1Final = () => {
                                const s = quadro1Edit[keyQ1Final];
                                setQuadro1Edit((prev) => { const next = { ...prev }; delete next[keyQ1Final]; return next; });
                                if (s === "" || s === ".") return;
                                const num = Number(s);
                                if (!Number.isFinite(num)) return;
                                const v = stepFinal < 1 ? Math.round(num * 10 ** decimalsFinal) / 10 ** decimalsFinal : Math.round(num);
                                const clamped = inputFinal.min != null && v < inputFinal.min ? inputFinal.min : inputFinal.max != null && v > inputFinal.max ? inputFinal.max : v;
                                setInputValues((prev) => {
                                  const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                  return { ...prev, [script.id]: { ...current, [keyQ1Final]: clamped } };
                                });
                              };
                              return (
                                <label key={keyQ1Final} className="flex items-center gap-2 text-sm text-neutral-700">
                                  <span>final_mortality_rate (%):</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={displayFinal}
                                    onFocus={() => setQuadro1Edit((prev) => ({ ...prev, [keyQ1Final]: formatQuadro5Val(storedFinal) }))}
                                    onChange={(e) => setQuadro1Edit((prev) => ({ ...prev, [keyQ1Final]: filterQuadro5Input(e.target.value) }))}
                                    onBlur={applyQ1Final}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQ1Final(); (e.target as HTMLInputElement).blur(); } }}
                                    className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                  />
                                  {inputFinal.min != null && inputFinal.max != null && <span className="text-neutral-500 font-mono text-xs shrink-0">[{inputFinal.min}, {inputFinal.max}]</span>}
                                </label>
                              );
                            })()}
                            <div className="w-full space-y-1 text-sm font-mono text-neutral-700 border-t border-neutral-300 pt-2 mt-1">
                              <p>
                                Interval = <span className="font-semibold">{Number.isFinite(periodoFinalVal) && Number.isFinite(periodoInicialVal) ? Math.max(1, Math.floor(periodoFinalVal - periodoInicialVal)) : 1}</span> (years)
                              </p>
                              <p>
                                annual_mortality_factor = <span className="font-semibold">{(Math.floor((txExpAnualCalculado ?? intervalo1Result?.fator_anual ?? 1) * 10000) / 10000).toFixed(4)}…</span>
                                <span className="ml-1 font-sans normal-case text-neutral-500">(annual factor)</span>
                              </p>
                              <p className="font-sans normal-case text-neutral-600 pt-1">
                                The rate went from <strong>{Number.isFinite(txInicialVal) ? txInicialVal : "—"}%</strong> to <strong>{Number.isFinite(txFinalVal) ? txFinalVal : "—"}%</strong> in the interval between <strong>{Number.isFinite(periodoInicialVal) ? periodoInicialVal : "—"}</strong> and <strong>{Number.isFinite(periodoFinalVal) ? periodoFinalVal : "—"}</strong> years.
                              </p>
                            </div>
                            {(vals.adicionar_intervalo_2 ?? 0) === 1 && (() => {
                              const txInicialGrupo2 = vals.tx_mortalidade_final_1 ?? 0.5;
                              const txExpInicialGrupo2 = txExpAnualCalculado != null ? Math.pow(txExpAnualCalculado, expoenteTxExpAnual) * txInicialVal : txInicialVal;
                              const minI2 = periodoFinalVal;
                              const maxR = 20000;
                              const pi2 = clamp(minI2, vals.periodo_i2 ?? 101, maxR);
                              const pf2 = clamp(pi2, vals.periodo_f2 ?? 200, maxR);
                              const txFinalVal2 = vals.tx_mortalidade_final_2 ?? 0.5;
                              const intervalo2Result = computeIntervaloTaxa({
                                tx_inicial: txInicialGrupo2,
                                periodo_i: pi2,
                                periodo_f: pf2,
                                tx_final: txFinalVal2,
                                periodoSeguinte: true,
                              });
                              const perDerivado2 = intervalo2Result?.per_de_mod ?? Math.max(1, Math.floor(pf2 - pi2));
                              const fatorExpAnual2 = intervalo2Result?.fator_anual ?? 1;
                              const txExpAnual2 = intervalo2Result?.tx_anual_fim ?? txFinalVal2;
                              return (
                                <div className="mt-3 pt-3 border-t border-neutral-300">
                                  <button
                                    type="button"
                                    onClick={() => setExpandPeriodo2Quadro1((b) => !b)}
                                    className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800"
                                  >
                                    <span className="shrink-0">{expandPeriodo2Quadro1 ? "▼" : "▶"}</span>
                                    <span>Period 2</span>
                                  </button>
                                  {expandPeriodo2Quadro1 && (
                                    <div className="flex flex-col gap-2 mt-2 pl-4">
                                      <p className="text-sm font-mono text-neutral-700">
                                        initial_mortality_rate_2 (%) = <span className="font-semibold">{formatQuadro5Val(vals.tx_mortalidade_final_1 ?? 0.5)}</span>
                                      </p>
                                      {(() => {
                                        const keyQ12 = "tx_mortalidade_final_2";
                                        const storedVal2 = Number.isNaN(txFinalVal2) ? 2.5 : txFinalVal2;
                                        const displayStr2 = keyQ12 in quadro1Edit ? quadro1Edit[keyQ12] : formatQuadro5Val(storedVal2);
                                        const applyQ12 = () => {
                                          const s = quadro1Edit[keyQ12];
                                          setQuadro1Edit((prev) => { const next = { ...prev }; delete next[keyQ12]; return next; });
                                          if (s === "" || s === ".") return;
                                          const num = Number(s);
                                          if (!Number.isFinite(num)) return;
                                          const v = Math.round(Math.max(0, Math.min(50, num)) * 10) / 10;
                                          setInputValues((prev) => {
                                            const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                            return { ...prev, [script.id]: { ...current, [keyQ12]: v } };
                                          });
                                        };
                                        return (
                                          <label className="flex items-center gap-2 text-sm text-neutral-700">
                                            <span>final_mortality_rate_2 (%):</span>
                                            <input
                                              type="text"
                                              inputMode="decimal"
                                              value={displayStr2}
                                              onFocus={() => setQuadro1Edit((prev) => ({ ...prev, [keyQ12]: formatQuadro5Val(storedVal2) }))}
                                              onChange={(e) => setQuadro1Edit((prev) => ({ ...prev, [keyQ12]: filterQuadro5Input(e.target.value) }))}
                                              onBlur={applyQ12}
                                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQ12(); (e.target as HTMLInputElement).blur(); } }}
                                              className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                            />
                                            <span className="text-neutral-500 font-mono text-xs shrink-0">[0, 50]</span>
                                          </label>
                                        );
                                      })()}
                                      <div className="w-full space-y-1 text-sm font-mono text-neutral-700 border-t border-neutral-300 pt-2 mt-1">
                                        <p>annual_mortality_factor_2 = <span className="font-semibold">{(Math.floor(fatorExpAnual2 * 10000) / 10000).toFixed(4)}…</span> <span className="font-sans normal-case text-neutral-500">(annual factor)</span></p>
                                        <p className="text-xs text-neutral-600">Interval = <strong>{perDerivado2}</strong> (years)</p>
                                        <p className="font-sans normal-case text-neutral-600 pt-1">The rate went from <strong>{txInicialGrupo2.toFixed(1)}%</strong> to <strong>{txExpAnual2.toFixed(1)}%</strong> in the interval between <strong>{pi2}</strong> and <strong>{pf2}</strong> years.</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            {(vals.adicionar_intervalo_3 ?? 0) === 1 && (() => {
                              const txInicialGrupo2Q3 = vals.tx_mortalidade_final_1 ?? 0.5;
                              const txExpInicialGrupo2 = txExpAnualCalculado != null ? Math.pow(txExpAnualCalculado, expoenteTxExpAnual) * txInicialVal : txInicialVal;
                              const minI2 = periodoFinalVal;
                              const maxR = 20000;
                              const pi2 = clamp(minI2, vals.periodo_i2 ?? 101, maxR);
                              const pf2 = clamp(pi2, vals.periodo_f2 ?? 200, maxR);
                              const txFinalVal2 = vals.tx_mortalidade_final_2 ?? 0.5;
                              const intervalo2ResultQ3 = computeIntervaloTaxa({
                                tx_inicial: txInicialGrupo2Q3,
                                periodo_i: pi2,
                                periodo_f: pf2,
                                tx_final: txFinalVal2,
                                periodoSeguinte: true,
                              });
                              const txExpAnual2 = intervalo2ResultQ3?.tx_anual_fim ?? txFinalVal2;
                              const txInicialGrupo3 = vals.tx_mortalidade_final_2 ?? 0.5;
                              const minI3 = vals.periodo_f2 ?? 200;
                              const pi3 = clamp(minI3, vals.periodo_i3 ?? 200, maxR);
                              const pf3 = clamp(pi3, vals.periodo_f3 ?? 300, maxR);
                              const txFinalVal3 = vals.tx_mortalidade_final_3 ?? 0.5;
                              const intervalo3Result = computeIntervaloTaxa({
                                tx_inicial: txInicialGrupo3,
                                periodo_i: pi3,
                                periodo_f: pf3,
                                tx_final: txFinalVal3,
                                periodoSeguinte: true,
                              });
                              const perDerivado3 = intervalo3Result?.per_de_mod ?? Math.max(1, Math.floor(pf3 - pi3));
                              const fatorExpAnual3 = intervalo3Result?.fator_anual ?? 1;
                              const txExpAnual3 = intervalo3Result?.tx_anual_fim ?? txFinalVal3;
                              return (
                                <div className="mt-3 pt-3 border-t border-neutral-300">
                                  <button
                                    type="button"
                                    onClick={() => setExpandPeriodo3Quadro1((b) => !b)}
                                    className="w-full flex items-center gap-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800"
                                  >
                                    <span className="shrink-0">{expandPeriodo3Quadro1 ? "▼" : "▶"}</span>
                                    <span>Period 3</span>
                                  </button>
                                  {expandPeriodo3Quadro1 && (
                                    <div className="flex flex-col gap-2 mt-2 pl-4">
                                      <p className="text-sm font-mono text-neutral-700">
                                        initial_mortality_rate_3 (%) = <span className="font-semibold">{formatQuadro5Val(vals.tx_mortalidade_final_2 ?? 0.5)}</span>
                                      </p>
                                      {(() => {
                                        const keyQ13 = "tx_mortalidade_final_3";
                                        const storedVal3 = Number.isNaN(txFinalVal3) ? 2.5 : txFinalVal3;
                                        const displayStr3 = keyQ13 in quadro1Edit ? quadro1Edit[keyQ13] : formatQuadro5Val(storedVal3);
                                        const applyQ13 = () => {
                                          const s = quadro1Edit[keyQ13];
                                          setQuadro1Edit((prev) => { const next = { ...prev }; delete next[keyQ13]; return next; });
                                          if (s === "" || s === ".") return;
                                          const num = Number(s);
                                          if (!Number.isFinite(num)) return;
                                          const v = Math.round(Math.max(0, Math.min(50, num)) * 10) / 10;
                                          setInputValues((prev) => {
                                            const current = script.inputs.reduce((acc, { key: k, default: def }) => ({ ...acc, [k]: prev[script.id]?.[k] ?? def }), {} as Record<string, number>);
                                            return { ...prev, [script.id]: { ...current, [keyQ13]: v } };
                                          });
                                        };
                                        return (
                                          <label className="flex items-center gap-2 text-sm text-neutral-700">
                                            <span>final_mortality_rate_3 (%):</span>
                                            <input
                                              type="text"
                                              inputMode="decimal"
                                              value={displayStr3}
                                              onFocus={() => setQuadro1Edit((prev) => ({ ...prev, [keyQ13]: formatQuadro5Val(storedVal3) }))}
                                              onChange={(e) => setQuadro1Edit((prev) => ({ ...prev, [keyQ13]: filterQuadro5Input(e.target.value) }))}
                                              onBlur={applyQ13}
                                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyQ13(); (e.target as HTMLInputElement).blur(); } }}
                                              className="w-24 rounded border border-neutral-300 px-2 py-1 text-base min-w-0"
                                            />
                                            <span className="text-neutral-500 font-mono text-xs shrink-0">[0, 50]</span>
                                          </label>
                                        );
                                      })()}
                                      <div className="w-full space-y-1 text-sm font-mono text-neutral-700 border-t border-neutral-300 pt-2 mt-1">
                                        <p>annual_mortality_factor_3 = <span className="font-semibold">{(Math.floor(fatorExpAnual3 * 10000) / 10000).toFixed(4)}…</span> <span className="font-sans normal-case text-neutral-500">(annual factor)</span></p>
                                        <p className="text-xs text-neutral-600">Interval = <strong>{perDerivado3}</strong> (years)</p>
                                        <p className="font-sans normal-case text-neutral-600 pt-1">The rate went from <strong>{txInicialGrupo3.toFixed(1)}%</strong> to <strong>{txExpAnual3.toFixed(1)}%</strong> in the interval between <strong>{pi3}</strong> and <strong>{pf3}</strong> years.</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                      {renderedInputs.slice(expansionEndIdx + 1)}
                    </>
                  );
                })()}
              </div>
            </div>

            {fetchError && (
              <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
                {fetchError}
              </p>
            )}

            {/* Toolbar: mensagem ao definir início */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {mapMessage && (
                <span className={`text-sm ${mapMessage.startsWith("Escolha") ? "text-amber-700" : "text-neutral-600"}`} role="status">
                  {mapMessage}
                </span>
              )}
              {repositioningOrigemId && (
                <button type="button" onClick={() => { setRepositioningOrigemId(null); setGetStartMode(false); setMapMessage(null); }} className="text-sm text-amber-700 hover:underline">Cancelar</button>
              )}
            </div>
            {/* Formulário de adicionar origem está no menu 📌 (sidebar) */}
            {/* ResultadoJSON desabilitado para melhor performance - descomente se necessário para debug */}
            {/* {genesisResult && <ResultadoJSON genesisResult={genesisResult} />} */}
          </div>
        </div>
        {/* Rodapé de debug — fixo no fundo, abaixo do conteúdo */}
        {/* Painel lateral de debug — sobrepõe até 50% da tela à direita */}
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setDebugPanelOpen((o) => !o)}
              className={`fixed right-0 bottom-6 z-[60] flex items-center justify-center w-8 h-14 rounded-l-lg border border-neutral-300 bg-amber-50 hover:bg-amber-100 text-amber-800 shadow-md transition-all ${debugPanelOpen ? "opacity-0 pointer-events-none" : ""}`}
              aria-label={debugPanelOpen ? "Fechar painel Debug" : "Abrir painel Debug"}
              aria-expanded={debugPanelOpen}
              title={debugPanelOpen ? "Fechar Debug" : "Abrir Debug"}
            >
              <span className="text-lg">🐞</span>
            </button>
            <aside
              className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-[50vw] bg-white border-l border-neutral-200 shadow-xl flex flex-col transition-transform duration-200 ease-out ${debugPanelOpen ? "translate-x-0" : "translate-x-full"}`}
              aria-label="Painel Debug"
              aria-hidden={!debugPanelOpen}
            >
              <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-neutral-200 bg-amber-50">
                <h2 className="text-sm font-semibold text-amber-900">🐞 Debug</h2>
                <button
                  type="button"
                  onClick={() => setDebugPanelOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-amber-100"
                  aria-label="Fechar painel Debug"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <label className="flex items-center gap-2 text-sm text-amber-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showMask}
                    onChange={() => setShowMask((on) => !on)}
                    className="rounded border-amber-400 text-amber-600"
                  />
                  <span>Ver máscara (áreas válidas)</span>
                </label>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                  <p className="font-semibold text-neutral-800 mb-1.5">Variáveis fixas do sistema</p>
                  <ul className="space-y-1 font-mono">
                    <li><strong>max_idade</strong> = {Number(vals.max_idade ?? 140)} — limita a idade do par na origem</li>
                    <li><strong>min_form_grupo</strong> = {Number(vals.min_form_grupo ?? 50)} — tamanho mínimo do grupo (≥ este valor = 2 vetores agrupados)</li>
                    <li><strong>LIMITE_POPULACAO</strong> = {LIMITE_POPULACAO.toLocaleString("pt-BR")} (20 bilhões) — população máxima (parada da simulação)</li>
                  </ul>
                  <p className="font-semibold text-neutral-800 mt-3 mb-1.5">Fila (valores vêm do banco — BioAppConfig)</p>
                  <ul className="space-y-1 font-mono">
                    <li><strong>queuePollIntervalMs</strong> — intervalo do polling (ms). Default no cliente: {QUEUE_POLL_INTERVAL_MS_DEFAULT}</li>
                    <li><strong>queueMaxWaitMs</strong> — tempo máximo de espera antes da mensagem de timeout. Default no cliente: {QUEUE_MAX_WAIT_MS_DEFAULT} ({(QUEUE_MAX_WAIT_MS_DEFAULT / 60000).toFixed(1)} min)</li>
                    <li><strong>QUEUE_NAMES</strong> = fila_1x, fila_20x, fila_100x, fila_1000x</li>
                    <li><strong>bio_queue_max_fila_*</strong> — máx. jobs por fila (BioAppConfig). Defaults: fila_1x=6, fila_20x=4, fila_100x=3, fila_1000x=2</li>
                  </ul>
                </div>
                <BioDebugMenuContent />
                <div className="border-t border-neutral-200 pt-4 space-y-4">
                  {bioDebug?.flags.genesisId != null && (
                    <div className="px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-xs font-mono">
                      <p className="font-semibold text-violet-800 mb-1">__DEBUG_GENESIS_ID (menor id genero=0, qtde=1){typeof debugGenesisIdMinGenero0Qtde1 === "number" ? ` — id=${debugGenesisIdMinGenero0Qtde1}` : " — id=1 (fallback)"}</p>
                      <div className="overflow-y-auto max-h-64 space-y-1">
                        {genesisDebugLog.length > 0 ? genesisDebugLog.map((line, i) => (
                          <div key={i} className="text-violet-900 whitespace-pre-wrap">{line}</div>
                        )) : <p className="text-violet-700">{tSistema.awaitingRun}</p>}
                      </div>
                    </div>
                  )}
                  {bioDebug?.flags.genesisGrupo && (
                    <div className="px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-mono">
                      <p className="font-semibold text-indigo-800 mb-1">__DEBUG_GENESIS_GRUPO</p>
                      {genesisResult && (
                        <p className="text-indigo-900 mb-2">
                          Maior grupo (qtde):{" "}
                          {Math.max(
                            0,
                            ...genesisResult.vetor1.map((i) => i.qtde),
                            ...genesisResult.vetor2.map((i) => i.qtde)
                          )}
                        </p>
                      )}
                      <div className="overflow-y-auto max-h-64 space-y-1">
                        {genesisGrupoDebugLog.length > 0 ? genesisGrupoDebugLog.map((line, i) => (
                          <div key={i} className="text-indigo-900 whitespace-pre-wrap">{line}</div>
                        )) : <p className="text-indigo-700">{tSistema.awaitingRun}</p>}
                      </div>
                    </div>
                  )}
                  {bioDebug?.flags.performance && (
                    <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-mono">
                      <p className="font-semibold text-emerald-800 mb-1">Performance</p>
                      <div className="overflow-y-auto max-h-64 space-y-1">
                        {performanceDebugLog.length > 0 ? performanceDebugLog.map((line, i) => (
                          <div key={i} className="text-emerald-900 whitespace-pre-wrap">{line}</div>
                        )) : <p className="text-emerald-700">{tSistema.awaitingRun}</p>}
                      </div>
                    </div>
                  )}
                  {bioDebug?.flags.execLog && (
                    <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs font-mono">
                      <p className="font-semibold text-amber-800 mb-1">{tSistema.run}</p>
                      <p className="text-amber-900 mb-1">Estado: isExecuting={String(isExecuting)} parada={String(parada)}</p>
                      <div className="overflow-y-auto max-h-64 space-y-1">
                        {execDebugLog.map((line, i) => (
                          <div key={i} className="text-amber-900">{line}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {bioDebug?.flags.mapa && (
                    <div className="px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-xs font-mono">
                      <p className="font-semibold text-teal-800 mb-1">Mapa</p>
                      {mapaDebugInfo ? (
                        <div className="text-teal-900 space-y-1">
                          <p>mapa: {mapaDebugInfo.mapaNumero}</p>
                          <p>pixelsVálidos (não brancos): {mapaDebugInfo.pixelsValidos}</p>
                          <p>índiceBranco: {mapaDebugInfo.indiceBranco}</p>
                          <p>regiaoSize: {mapaDebugInfo.regiaoSize}</p>
                          <p>coresÚnicas nos pixels: {mapaDebugInfo.coresUnicas} (esperado 8 para máscara de 8 cores)</p>
                        </div>
                      ) : (
                        <p className="text-teal-700">Aguardando carregamento do mapa...</p>
                      )}
                    </div>
                  )}
                  {bioDebug?.flags.mortesAcum && (
                    <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs font-mono">
                      <p className="font-semibold text-rose-800 mb-1">Mortes acumuladas</p>
                      <p className="text-rose-900 mb-1">Atual: {genesisResult?.mortesAcumuladas ?? 0}</p>
                      <p className="text-rose-700 mb-1">Cada linha: origem | iter enviada→retornada | mortes enviada→retornada</p>
                      <div className="overflow-y-auto max-h-48 space-y-1">
                        {mortesAcumLog.length > 0 ? mortesAcumLog.map((e, i) => (
                          <div key={i} className={e.regressao ? "text-rose-700 font-bold" : "text-rose-900"}>
                            {e.origem} | iter {e.iterEnviada}→{e.iteracao} | mortes {e.anterior}→{e.mortesAcumuladas}
                            {e.regressao && " ⚠️ REGRESSÃO"}
                          </div>
                        )) : <p className="text-rose-700">{tSistema.awaitingRun}</p>}
                      </div>
                    </div>
                  )}
                  {bioDebug?.flags.dados && (genesisResult || isExecuting) && (
                    <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono">
                      <p className="font-semibold text-slate-800 mb-1">Dados (JSON)</p>
                      <pre className="overflow-x-auto overflow-y-auto max-h-64 whitespace-pre-wrap text-slate-900">
                        {JSON.stringify(
                          (() => {
                            const v1 = genesisResult?.vetor1 ?? [];
                            const v2 = genesisResult?.vetor2 ?? [];
                            let gruposQtde1 = 0;
                            let gruposQtdeGt1 = 0;
                            for (let i = 0; i < v1.length; i++) {
                              const q = v1[i]!.qtde;
                              if (q === 1) gruposQtde1++;
                              else if (q > 1) gruposQtdeGt1++;
                            }
                            for (let i = 0; i < v2.length; i++) {
                              const q = v2[i]!.qtde;
                              if (q === 1) gruposQtde1++;
                              else if (q > 1) gruposQtdeGt1++;
                            }
                            return {
                              ano: periodoInicialVal + iteracao,
                              populacao: genesisResult
                                ? v1.reduce((s, i) => s + i.qtde, 0) + v2.reduce((s, i) => s + i.qtde, 0)
                                : 0,
                              nascimentos: genesisResult?.resultadoPorId
                                ? Object.values(genesisResult.resultadoPorId).reduce((s, r) => s + (r.decendentes ?? 0), 0)
                                : 0,
                              mortesAnuais: genesisResult
                                ? v1.reduce((s, i) => s + (i.morte ?? 0), 0) + v2.reduce((s, i) => s + (i.morte ?? 0), 0)
                                : 0,
                              mortesAcumuladas: genesisResult?.mortesAcumuladas ?? 0,
                              gruposQtde1,
                              gruposQtdeGt1,
                              vetor1: genesisResult?.vetor1 ?? [],
                              vetor2: genesisResult?.vetor2 ?? [],
                              especie: genesisResult?.especie ?? null,
                              resultadoPorId: genesisResult?.resultadoPorId ?? {},
                            };
                          })(),
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}
                  {debugGenesisAtivo && iteracao >= 0 && (() => {
                    const periodoAtual = Number.isFinite(periodoInicialVal) ? periodoInicialVal + iteracao : iteracao;
                    const faixa = getFaixaForPeriodo(vals, periodoAtual);
                    const resolvida = getMortalidadeResolvida(vals, periodoAtual);
                    const fator1 = txExpAnualCalculado ?? 1;
                    const txAcumulada = iteracao >= 1 ? txInicialVal * Math.pow(fator1, iteracao - 1) : txInicialVal;
                    const txAnterior = iteracao <= 1 ? txInicialVal : txInicialVal * Math.pow(fator1, iteracao - 2);
                    return (
                      <div className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-xs">
                        <p className="font-semibold text-amber-800 mb-1">Taxa de mortalidade acumulada (iteração {iteracao})</p>
                        <p className="text-amber-900 font-sans mb-1">
                          Periodo (ano) = periodo_i1 + iteracao = {Number.isFinite(periodoInicialVal) ? periodoInicialVal : "—"} + {iteracao} = <strong className="font-mono">{periodoAtual}</strong>
                        </p>
                        <p className="text-amber-900 font-sans mb-1">
                          Range = <strong className="font-mono">{faixa}</strong> → initial_mortality_rate = initial_mortality_rate_{faixa} = <strong className="font-mono">{resolvida.tx_mortalidade_inicial.toFixed(2)}%</strong>, annual_mortality_factor = <strong className="font-mono">{(Math.floor(resolvida.fator_mortalidade_anual * 10000) / 10000).toFixed(4)}…</strong>
                        </p>
                        {iteracao >= 1 && (
                          <p className="text-amber-900 font-sans">
                            {iteracao === 1
                              ? <>i = 1: rate = initial_mortality_rate_1 = <strong className="font-mono">{txAcumulada.toFixed(4)}%</strong></>
                              : <>i &gt; 1: taxa(i−1) × fator = {txAnterior.toFixed(4)} × {fator1.toFixed(4)} = <strong className="font-mono">{txAcumulada.toFixed(4)}%</strong></>}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </aside>
          </>
        )}
      </div>
    </>
  );
}
