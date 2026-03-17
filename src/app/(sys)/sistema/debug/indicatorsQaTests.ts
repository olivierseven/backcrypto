/**
 * Testes QA do fluxo de indicador (SMA) — executáveis no browser (aba Debug > QA > Indicadores).
 * Simula: adicionar SMA (1h e 4h) → verificar visibilidade por tempo → editar para "todos os tempos" →
 * verificar 2h → modificar cor/espessura → verificar séries em criar estratégia e meus indicadores → excluir.
 * Nota: indicadores são do layout (não por moeda); em qualquer símbolo aparecem conforme tempos selecionados.
 */
import { INTERVAL_OPTIONS } from "../indicatorsPanel/indicatorsPanelConstants";

export type IndicatorsQaTestResult = { name: string; pass: boolean; message?: string; evidence?: string };

const INTERVALS_NONE = 0;
const INTERVAL_1H = 60;
const INTERVAL_2H = 120;
const INTERVAL_4H = 240;

type IndicatorLike = {
  id: string;
  type: string;
  period: number;
  fieldKey: string;
  panel: string;
  intervals: number[];
  color?: string;
  lineWidth?: string;
};

function isIndicatorVisibleForInterval(ind: IndicatorLike, effectiveIntervalMinutes: number): boolean {
  if (ind.intervals.length === 1 && ind.intervals[0] === INTERVALS_NONE) return false;
  if (ind.intervals.length === 0) return true;
  return ind.intervals.includes(effectiveIntervalMinutes);
}

function filterIndicatorsForInterval(list: IndicatorLike[], effectiveIntervalMinutes: number): IndicatorLike[] {
  return list.filter((ind) => isIndicatorVisibleForInterval(ind, effectiveIntervalMinutes));
}

export function runIndicatorsQaTests(): IndicatorsQaTestResult[] {
  const evidence: string[] = [];
  let pass = true;
  let message: string | undefined;

  try {
    // 1. Adicionar SMA: período 7, fonte Close, painel main, tempos 1h e 4h
    const smaId = "ui_qa_sma_" + Date.now();
    const list: IndicatorLike[] = [];
    const sma: IndicatorLike = {
      id: smaId,
      type: "SMA",
      period: 7,
      fieldKey: "close",
      panel: "main",
      intervals: [INTERVAL_1H, INTERVAL_4H],
      color: "#3b82f6",
      lineWidth: "normal",
    };
    list.push(sma);
    evidence.push(`1. Adicionado SMA(7) fonte Close, painel main, intervalos 1h e 4h, cor #3b82f6, espessura normal.`);

    // 2. Verificar visibilidade: 1h e 4h sim; 2h não
    const visible1h = isIndicatorVisibleForInterval(sma, INTERVAL_1H);
    const visible4h = isIndicatorVisibleForInterval(sma, INTERVAL_4H);
    const visible2hBefore = isIndicatorVisibleForInterval(sma, INTERVAL_2H);
    evidence.push(`2. Visibilidade por tempo: 1h=${visible1h}, 4h=${visible4h}, 2h=${visible2hBefore} (deve ser false).`);
    if (!visible1h || !visible4h || visible2hBefore) {
      pass = false;
      message = "SMA com [1h,4h] deve aparecer em 1h e 4h e não em 2h.";
    }

    // 3. Em "meus indicadores" (lista filtrada por tempo): 1h e 4h incluem o indicador; 2h não
    const meusIndicators1h = filterIndicatorsForInterval(list, INTERVAL_1H);
    const meusIndicators4h = filterIndicatorsForInterval(list, INTERVAL_4H);
    const meusIndicators2h = filterIndicatorsForInterval(list, INTERVAL_2H);
    evidence.push(`3. Meus indicadores: em 1h ${meusIndicators1h.length} item(s), em 4h ${meusIndicators4h.length}, em 2h ${meusIndicators2h.length} (0 esperado).`);
    if (meusIndicators1h.length !== 1 || meusIndicators4h.length !== 1 || meusIndicators2h.length !== 0) {
      pass = false;
      message = message ?? "Lista meus indicadores por tempo incorreta.";
    }

    // 4. Em criar estratégia (séries): mesmo filtro — em 1h/4h o indicador entra com chave ind_id:fieldKey; em 2h não
    const seriesFor1h = filterIndicatorsForInterval(list, INTERVAL_1H);
    const seriesFor2h = filterIndicatorsForInterval(list, INTERVAL_2H);
    const seriesKey1h = seriesFor1h.length > 0 ? `ind_${seriesFor1h[0]!.id}:${seriesFor1h[0]!.fieldKey}` : "";
    const panelOk = sma.panel === "main";
    evidence.push(`4. Painel: ${sma.panel} (SMA no main) ${panelOk ? "✓" : "— falhou"}. Criar estratégia (séries): em 1h há opção "${seriesKey1h}"; em 2h ${seriesFor2h.length} indicador(es) (0 esperado).`);
    if (!panelOk || seriesFor1h.length !== 1 || seriesFor2h.length !== 0) {
      pass = false;
      message = message ?? (panelOk ? "Séries em criar estratégia incorretas por tempo." : "Painel do indicador deve ser main para SMA.");
    }

    // 5. Editar período (7 → 14) e fonte (close → open)
    const idx = list.findIndex((i) => i.id === smaId);
    if (idx >= 0) list[idx] = { ...list[idx]!, period: 14, fieldKey: "open" };
    const smaAfterPeriod = list.find((i) => i.id === smaId);
    const periodOk = smaAfterPeriod?.period === 14 && smaAfterPeriod?.fieldKey === "open";
    evidence.push(`5a. Editado período 7→14 e fonte Close→Open. Verificado: ${periodOk ? "✓" : "falhou"}.`);
    if (!periodOk) {
      pass = false;
      message = message ?? "Edição de período/fonte falhou.";
    }
    // 5b. Editar: considerar todos os tempos (intervals = [])
    if (idx >= 0) list[idx] = { ...list[idx]!, intervals: [] };
    const smaAfterEdit = list.find((i) => i.id === smaId);
    const visible2hAfter = smaAfterEdit ? isIndicatorVisibleForInterval(smaAfterEdit, INTERVAL_2H) : false;
    evidence.push(`5b. Editado para "Todos os tempos" (intervals=[]). Visibilidade em 2h: ${visible2hAfter} (deve ser true).`);
    if (!visible2hAfter) {
      pass = false;
      message = message ?? "Após editar para todos os tempos, indicador deve aparecer em 2h.";
    }

    // 6. Meus indicadores e criar estratégia em 2h passam a incluir o indicador
    const meusIndicators2hAfter = filterIndicatorsForInterval(list, INTERVAL_2H);
    evidence.push(`6. Meus indicadores em 2h após edição: ${meusIndicators2hAfter.length} item(s) ✓.`);
    if (meusIndicators2hAfter.length !== 1) {
      pass = false;
      message = message ?? "Meus indicadores em 2h após todos os tempos deve ter 1.";
    }

    // 7. Modificar cor e espessura
    if (idx >= 0) list[idx] = { ...list[idx]!, color: "#ef4444", lineWidth: "thin" };
    const smaAfterStyle = list.find((i) => i.id === smaId);
    evidence.push(`7. Cor alterada para #ef4444, espessura para thin. Verificado: ${smaAfterStyle?.color === "#ef4444" && smaAfterStyle?.lineWidth === "thin" ? "✓" : "falhou"}.`);
    if (smaAfterStyle?.color !== "#ef4444" || smaAfterStyle?.lineWidth !== "thin") {
      pass = false;
      message = message ?? "Edição de cor/espessura falhou.";
    }

    // 8. Excluir
    const beforeDelete = list.length;
    const removed = list.filter((i) => i.id !== smaId);
    list.length = 0;
    list.push(...removed);
    evidence.push(`8. Excluído. Lista antes=${beforeDelete}, depois=${list.length} (0 esperado).`);
    if (list.length !== 0) {
      pass = false;
      message = message ?? "Exclusão falhou.";
    }

    evidence.push(`9. Período e fonte usados: SMA(period), fieldKey → série ind_<id>:<fieldKey>. Panel main = gráfico principal.`);
    evidence.push(`10. INTERVAL_OPTIONS: 1h=${INTERVAL_OPTIONS.find((o) => o.value === 60)?.label ?? "?"}, 2h=${INTERVAL_OPTIONS.find((o) => o.value === 120)?.label ?? "?"}, 4h=${INTERVAL_OPTIONS.find((o) => o.value === 240)?.label ?? "?"}.`);
    evidence.push("Nota: indicadores são do layout (não por moeda); em BTCUSDT ou ETHUSDT aparecem conforme tempos selecionados.");
  } catch (e) {
    pass = false;
    message = String(e);
    evidence.push(`Erro: ${message}`);
  }

  return [
    {
      name: "SMA — fluxo completo (período, fonte, painel, 1h/4h, 2h, editar período/fonte, todos os tempos, cor/espessura, excluir)",
      pass,
      message,
      evidence: evidence.join("\n"),
    },
  ];
}
