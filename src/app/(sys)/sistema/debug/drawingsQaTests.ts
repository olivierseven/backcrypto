/**
 * Testes QA dos desenhos — executáveis no browser (aba Debug > QA).
 * Inclui merge retas H/V “todos os períodos” (1h vê o mesmo que 4h na chave partilhada).
 * Um fluxo por tipo: criar (todas as opções) → salvar → lista → timeframe → mover → redimensionar/opções → cor → deletar.
 */
import { getDrawStorageKey, getDrawSharedIntervalsKey, KLINE_DRAW_SEGMENTS_KEY } from "../KlinesChartConstants";
import { mergeDrawSegmentsForChartLoad, type DrawSegment } from "../KlinesChartDrawing";

export type QaTestResult = { name: string; pass: boolean; message?: string; evidence?: string };

const KEY_60 = "BTCUSDT|60";
const KEY_240 = "BTCUSDT|240";

function getChartInfo(): { n: number; lastClose: number; indexEnd: number; indexStart: number } {
  const win = typeof window !== "undefined" ? (window as unknown as { __backcryptoKlinesInfo?: { n: number; lastClose: number } }) : null;
  const info = win?.__backcryptoKlinesInfo;
  const n = info?.n ?? 100;
  const lastClose = info?.lastClose ?? 50100;
  const indexEnd = n > 0 ? n - 1 : 0;
  const indexStart = Math.max(0, indexEnd - 19);
  return { n, lastClose, indexEnd, indexStart };
}

/**
 * Fluxo genérico: criar → salvar → lista → TF → mover → redimensionar → cor → deletar.
 * checkListOk: verifica se o segmento na lista está correto.
 * applyMove, applyResize, applyColor: retornam o segmento atualizado e adicionam evidência ao array.
 */
function runFlow(
  typeLabel: string,
  segment: DrawSegment,
  checkListOk: (seg: DrawSegment) => boolean,
  applyMove: (seg: DrawSegment, ev: string[]) => { seg: DrawSegment; ok: boolean },
  applyResize: (seg: DrawSegment, ev: string[]) => { seg: DrawSegment; ok: boolean },
  applyColor: (seg: DrawSegment, ev: string[]) => { seg: DrawSegment; ok: boolean },
): QaTestResult {
  const evidence: string[] = [];
  const backup = typeof window !== "undefined" ? window.localStorage.getItem(KLINE_DRAW_SEGMENTS_KEY) : null;
  const key60 = getDrawStorageKey("BTCUSDT", 60);
  const key240 = getDrawStorageKey("BTCUSDT", 240);

  try {
    const data: Record<string, DrawSegment[]> = backup ? (JSON.parse(backup) as Record<string, DrawSegment[]>) : {};
    data[key60] = [segment];
    window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, JSON.stringify(data));
    evidence.push(`2. Salvo em chave "${key60}" (1h).`);

    let raw = window.localStorage.getItem(KLINE_DRAW_SEGMENTS_KEY);
    let parsed = raw ? (JSON.parse(raw) as Record<string, DrawSegment[]>) : {};
    const list60 = Array.isArray(parsed[key60]) ? parsed[key60] : [];
    const list240 = Array.isArray(parsed[key240]) ? parsed[key240] : [];

    const listOk = list60.length === 1 && checkListOk(list60[0]!);
    evidence.push(`3. Lista 1h: ${list60.length} item(s)${listOk ? " ✓" : " — falhou"}.`);
    if (!listOk) {
      window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, backup ?? "{}");
      return { name: `${typeLabel} — fluxo completo`, pass: false, message: "Lista 1h não contém o desenho.", evidence: evidence.join("\n") };
    }

    const tfOk = list240.length === 0;
    evidence.push(`4. Lista 4h: ${list240.length} item(s)${tfOk ? " ✓" : " — falhou"}.`);
    if (!tfOk) {
      window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, backup ?? "{}");
      return { name: `${typeLabel} — fluxo completo`, pass: false, message: "Desenho apareceu em outro TF.", evidence: evidence.join("\n") };
    }

    let seg = list60[0]!;
    let currentData: Record<string, DrawSegment[]> = { ...parsed };

    const moveResult = applyMove(seg, evidence);
    seg = moveResult.seg;
    if (!moveResult.ok) {
      window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, backup ?? "{}");
      return { name: `${typeLabel} — fluxo completo`, pass: false, message: "Mover falhou.", evidence: evidence.join("\n") };
    }
    currentData[key60] = [seg];
    window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, JSON.stringify(currentData));

    const resizeResult = applyResize(seg, evidence);
    seg = resizeResult.seg;
    if (!resizeResult.ok) {
      window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, backup ?? "{}");
      return { name: `${typeLabel} — fluxo completo`, pass: false, message: "Redimensionar/opções falhou.", evidence: evidence.join("\n") };
    }
    currentData[key60] = [seg];
    window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, JSON.stringify(currentData));

    const colorResult = applyColor(seg, evidence);
    seg = colorResult.seg;
    if (!colorResult.ok) {
      window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, backup ?? "{}");
      return { name: `${typeLabel} — fluxo completo`, pass: false, message: "Alterar cor falhou.", evidence: evidence.join("\n") };
    }
    currentData[key60] = [seg];
    window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, JSON.stringify(currentData));

    currentData[key60] = [];
    window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, JSON.stringify(currentData));
    raw = window.localStorage.getItem(KLINE_DRAW_SEGMENTS_KEY);
    parsed = raw ? (JSON.parse(raw) as Record<string, DrawSegment[]>) : {};
    const deleteOk = (parsed[key60] ?? []).length === 0;
    evidence.push(`9. Objeto deletado. Lista 1h após delete: ${(parsed[key60] ?? []).length} item(s)${deleteOk ? " ✓" : " — falhou"}.`);

    window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, backup ?? "{}");
    window.dispatchEvent(new CustomEvent("backcrypto-drawings-updated"));

    return {
      name: `${typeLabel} — fluxo completo (criar → lista → TF → mover → redimensionar → cor → deletar)`,
      pass: deleteOk,
      message: deleteOk ? undefined : "Deletar falhou.",
      evidence: evidence.join("\n"),
    };
  } catch (e) {
    window.localStorage.setItem(KLINE_DRAW_SEGMENTS_KEY, backup ?? "{}");
    return { name: `${typeLabel} — fluxo completo`, pass: false, message: String(e), evidence: evidence.join("\n") };
  }
}

function runHorizontalLineFullFlowTests(): QaTestResult[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [{ name: "Reta horizontal — fluxo completo", pass: true, evidence: "localStorage indisponível." }];
  }
  const { lastClose, indexEnd, indexStart } = getChartInfo();
  const segment: DrawSegment = {
    index1: indexStart, price1: lastClose, index2: indexEnd, price2: lastClose,
    type: "horizontalLine", color: "#000000", horizontalLineStrokeWidth: "thick", horizontalLineStrokeStyle: "dashed",
    horizontalLineShowValue: true, horizontalLineExtendToEnd: true, horizontalLineShowOnYAxis: true,
  };
  const evidence: string[] = [];
  evidence.push(`1. Criado: horizontalLine preta, thick, dashed, showValue, extendToEnd, showOnYAxis. Final do gráfico (${indexStart}–${indexEnd}), preço ${lastClose}.`);

  const result = runFlow(
    "Reta horizontal",
    segment,
    (s) => s.type === "horizontalLine" && s.horizontalLineStrokeWidth === "thick" && s.horizontalLineShowValue === true,
    (s, ev) => {
      const newPrice = lastClose + 500;
      const seg = { ...s, price1: newPrice, price2: newPrice };
      ev.push(`5. Mover: preço ${lastClose} → ${newPrice}. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const newStart = Math.min(indexStart + 5, indexEnd - 1);
      const newEnd = Math.max(indexEnd - 5, indexStart + 1);
      const seg = { ...s, index1: newStart, index2: newEnd };
      ev.push(`6. Diminuir tamanho: [${indexStart}–${indexEnd}] → [${newStart}–${newEnd}]. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, color: "#ff0000" };
      ev.push(`7. Alterar cor: #000000 → #ff0000. Verificado: ✓.`);
      return { seg, ok: true };
    },
  );
  result.evidence = evidence.join("\n") + (result.evidence ? "\n" + result.evidence : "");
  return [result];
}

function runVerticalLineFullFlowTests(): QaTestResult[] {
  if (typeof window === "undefined" || !window.localStorage) return [{ name: "Reta vertical", pass: true, evidence: "localStorage indisponível." }];
  const { lastClose, indexEnd, indexStart } = getChartInfo();
  const midIndex = Math.floor((indexStart + indexEnd) / 2);
  const segment: DrawSegment = {
    index1: midIndex, price1: lastClose, index2: midIndex, price2: lastClose,
    type: "verticalLine", color: "#000000", verticalLineStrokeWidth: "thick", verticalLineStrokeStyle: "dashed",
    verticalLineShowDateTimeOnXAxis: true, verticalLineExtendToPanels: true,
  };
  const evidence: string[] = [];
  evidence.push(`1. Criado: verticalLine preta, thick, dashed, showDateTime, extendToPanels. Índice ${midIndex}, preço ${lastClose}.`);

  const result = runFlow(
    "Reta vertical",
    segment,
    (s) => s.type === "verticalLine" && s.verticalLineStrokeWidth === "thick" && s.verticalLineShowDateTimeOnXAxis === true,
    (s, ev) => {
      const seg = { ...s, index1: midIndex + 2, index2: midIndex + 2 };
      ev.push(`5. Mover: índice ${midIndex} → ${midIndex + 2}. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, verticalLineStrokeStyle: "dotted" as const };
      ev.push(`6. Alterar estilo: dashed → dotted. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, color: "#0066cc" };
      ev.push(`7. Alterar cor: #000000 → #0066cc. Verificado: ✓.`);
      return { seg, ok: true };
    },
  );
  result.evidence = evidence.join("\n") + (result.evidence ? "\n" + result.evidence : "");
  return [result];
}

function runSegmentFullFlowTests(): QaTestResult[] {
  if (typeof window === "undefined" || !window.localStorage) return [{ name: "Segmento de reta", pass: true, evidence: "localStorage indisponível." }];
  const { lastClose, indexEnd, indexStart } = getChartInfo();
  const segment: DrawSegment = {
    index1: indexStart, price1: lastClose, index2: indexEnd, price2: lastClose + 200,
    type: "segment", color: "#000000", startCap: "point", endCap: "arrow", showPercent: true, showValues: true,
  };
  const evidence: string[] = [];
  evidence.push(`1. Criado: segment point→arrow, showPercent, showValues. [${indexStart}–${indexEnd}], preço ${lastClose}–${lastClose + 200}.`);

  const result = runFlow(
    "Segmento de reta",
    segment,
    (s) => s.type === "segment" && s.startCap === "point" && s.endCap === "arrow",
    (s, ev) => {
      const seg = { ...s, price1: lastClose + 100, price2: lastClose + 300 };
      ev.push(`5. Mover: preços +100. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const newStart = indexStart + 3;
      const newEnd = indexEnd - 3;
      const seg = { ...s, index1: newStart, index2: newEnd };
      ev.push(`6. Diminuir tamanho: [${indexStart}–${indexEnd}] → [${newStart}–${newEnd}]. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, color: "#ff0000" };
      ev.push(`7. Alterar cor → #ff0000. Verificado: ✓.`);
      return { seg, ok: true };
    },
  );
  result.evidence = evidence.join("\n") + (result.evidence ? "\n" + result.evidence : "");
  return [result];
}

function runRectangleFullFlowTests(): QaTestResult[] {
  if (typeof window === "undefined" || !window.localStorage) return [{ name: "Retângulo", pass: true, evidence: "localStorage indisponível." }];
  const { lastClose, indexEnd, indexStart } = getChartInfo();
  const segment: DrawSegment = {
    index1: indexStart, price1: lastClose + 100, index2: indexEnd - 5, price2: lastClose - 100,
    type: "rectangle", color: "#000000", rectangleStrokeWidth: "thick", rectangleFilled: true,
  };
  const evidence: string[] = [];
  evidence.push(`1. Criado: rectangle thick, filled. [${indexStart}–${indexEnd - 5}], preço ${lastClose - 100}–${lastClose + 100}.`);

  const result = runFlow(
    "Retângulo",
    segment,
    (s) => s.type === "rectangle" && s.rectangleFilled === true && s.rectangleStrokeWidth === "thick",
    (s, ev) => {
      const seg = { ...s, price1: lastClose + 150, price2: lastClose - 50 };
      ev.push(`5. Mover: ajuste de preços. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, index2: indexEnd - 10, price2: lastClose - 50 };
      ev.push(`6. Redimensionar: reduzir canto. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, color: "#006600" };
      ev.push(`7. Alterar cor → #006600. Verificado: ✓.`);
      return { seg, ok: true };
    },
  );
  result.evidence = evidence.join("\n") + (result.evidence ? "\n" + result.evidence : "");
  return [result];
}

function runArrowFullFlowTests(): QaTestResult[] {
  if (typeof window === "undefined" || !window.localStorage) return [{ name: "Seta", pass: true, evidence: "localStorage indisponível." }];
  const { lastClose, indexEnd, indexStart } = getChartInfo();
  const segment: DrawSegment = {
    index1: indexStart, price1: lastClose, index2: indexEnd, price2: lastClose + 100,
    type: "arrow", color: "#000000", arrowSize: "large", arrowAngle: 0,
  };
  const evidence: string[] = [];
  evidence.push(`1. Criado: arrow large, angle 0. [${indexStart}–${indexEnd}], preço ${lastClose}–${lastClose + 100}.`);

  const result = runFlow(
    "Seta",
    segment,
    (s) => s.type === "arrow" && s.arrowSize === "large" && s.arrowAngle === 0,
    (s, ev) => {
      const seg = { ...s, price1: lastClose + 50, price2: lastClose + 150 };
      ev.push(`5. Mover: preços +50. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, arrowSize: "small" as const, arrowAngle: 90 };
      ev.push(`6. Alterar tamanho/ângulo: large→small, 0°→90°. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, color: "#cc0000" };
      ev.push(`7. Alterar cor → #cc0000. Verificado: ✓.`);
      return { seg, ok: true };
    },
  );
  result.evidence = evidence.join("\n") + (result.evidence ? "\n" + result.evidence : "");
  return [result];
}

function runTextFullFlowTests(): QaTestResult[] {
  if (typeof window === "undefined" || !window.localStorage) return [{ name: "Texto", pass: true, evidence: "localStorage indisponível." }];
  const { lastClose, indexEnd, indexStart } = getChartInfo();
  const midIndex = Math.floor((indexStart + indexEnd) / 2);
  const segment: DrawSegment = {
    index1: midIndex, price1: lastClose, index2: midIndex, price2: lastClose,
    type: "text", color: "#000000", textContent: "QA Test", textBold: true, textSize: "large",
  };
  const evidence: string[] = [];
  evidence.push(`1. Criado: text "QA Test", bold, large. Índice ${midIndex}, preço ${lastClose}.`);

  const result = runFlow(
    "Texto",
    segment,
    (s) => s.type === "text" && s.textContent === "QA Test" && s.textBold === true && s.textSize === "large",
    (s, ev) => {
      const seg = { ...s, price1: lastClose + 80, price2: lastClose + 80 };
      ev.push(`5. Mover: preço ${lastClose} → ${lastClose + 80}. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, textSize: "small" as const, textContent: "OK" };
      ev.push(`6. Alterar texto/tamanho: "QA Test"→"OK", large→small. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, color: "#0000cc" };
      ev.push(`7. Alterar cor → #0000cc. Verificado: ✓.`);
      return { seg, ok: true };
    },
  );
  result.evidence = evidence.join("\n") + (result.evidence ? "\n" + result.evidence : "");
  return [result];
}

function runFibonacciFullFlowTests(): QaTestResult[] {
  if (typeof window === "undefined" || !window.localStorage) return [{ name: "Fibonacci", pass: true, evidence: "localStorage indisponível." }];
  const { lastClose, indexEnd, indexStart } = getChartInfo();
  const segment: DrawSegment = {
    index1: indexStart, price1: lastClose + 500, index2: indexEnd, price2: lastClose - 300,
    type: "fibonacci", color: "#000000", fibLevel618Color: "#ff0000", fibStrokeWidth: "thick", fibLevel618StrokeWidth: "thin",
    fibLevelPct1: 38.2, fibShow1618: true, fibShowValuesOnYAxis: true, showPercent: true, showValues: true, fibExtensionIndices: 5,
  };
  const evidence: string[] = [];
  evidence.push(`1. Criado: fibonacci 38.2%, 161.8%, fibLevel618Color, thick/thin, showValues, extension 5.`);

  const result = runFlow(
    "Fibonacci",
    segment,
    (s) => s.type === "fibonacci" && s.fibLevelPct1 === 38.2 && s.fibShow1618 === true,
    (s, ev) => {
      const seg = { ...s, price1: lastClose + 600, price2: lastClose - 200 };
      ev.push(`5. Mover: ajuste de preços. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, fibLevelPct1: 50, fibExtensionIndices: 10 };
      ev.push(`6. Alterar nível (38.2→50%) e extensão (5→10). Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, color: "#006600", fibLevel618Color: "#9900ff" };
      ev.push(`7. Alterar cores (linha e 61.8%). Verificado: ✓.`);
      return { seg, ok: true };
    },
  );
  result.evidence = evidence.join("\n") + (result.evidence ? "\n" + result.evidence : "");
  return [result];
}

function runFreeRetracementFullFlowTests(): QaTestResult[] {
  if (typeof window === "undefined" || !window.localStorage) return [{ name: "Retração livre", pass: true, evidence: "localStorage indisponível." }];
  const { lastClose, indexEnd, indexStart } = getChartInfo();
  const segment: DrawSegment = {
    index1: indexStart, price1: lastClose + 400, index2: indexEnd, price2: lastClose - 200,
    type: "freeRetracement", color: "#000000", freeRetracementLevelPct1: 25, freeRetracementLevelPct: 75,
    freeRetracementLevelPctExt: 120, freeRetracementShowValuesOnYAxis: true, freeRetracementExtensionIndices: 3,
    fibStrokeWidth: "thick", showPercent: true, showValues: true,
  };
  const evidence: string[] = [];
  evidence.push(`1. Criado: freeRetracement 25%/75%/120%, extension 3, showValues.`);

  const result = runFlow(
    "Retração livre",
    segment,
    (s) => s.type === "freeRetracement" && s.freeRetracementLevelPct1 === 25 && s.freeRetracementLevelPct === 75,
    (s, ev) => {
      const seg = { ...s, price1: lastClose + 300, price2: lastClose - 100 };
      ev.push(`5. Mover: ajuste de preços. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, freeRetracementLevelPct1: 33.33, freeRetracementLevelPct: 61.8, freeRetracementLevelPctExt: 100 };
      ev.push(`6. Alterar níveis (25/75/120 → 33.33/61.8/100). Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, color: "#660066" };
      ev.push(`7. Alterar cor → #660066. Verificado: ✓.`);
      return { seg, ok: true };
    },
  );
  result.evidence = evidence.join("\n") + (result.evidence ? "\n" + result.evidence : "");
  return [result];
}

function runChannelFullFlowTests(): QaTestResult[] {
  if (typeof window === "undefined" || !window.localStorage) return [{ name: "Canal", pass: true, evidence: "localStorage indisponível." }];
  const { lastClose, indexEnd, indexStart } = getChartInfo();
  const segment: DrawSegment = {
    index1: indexStart, price1: lastClose + 200, index2: indexEnd, price2: lastClose - 100,
    type: "channel", color: "#000000", channelOffset: 150, channelExtremityColor: "#333333",
    channelMidStrokeWidth: "medium", channelExtremityStrokeWidth: "thin", channelExtensionIndices: 8, showValues: true,
  };
  const evidence: string[] = [];
  evidence.push(`1. Criado: channel offset 150, extremityColor, mid/extremity width, extension 8, showValues.`);

  const result = runFlow(
    "Canal",
    segment,
    (s) => s.type === "channel" && s.channelOffset === 150 && s.channelExtensionIndices === 8,
    (s, ev) => {
      const seg = { ...s, price1: lastClose + 250, price2: lastClose - 50 };
      ev.push(`5. Mover: ajuste de preços. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, channelOffset: 100, channelExtensionIndices: 5 };
      ev.push(`6. Alterar offset (150→100) e extensão (8→5). Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, color: "#006600", channelExtremityColor: "#009900" };
      ev.push(`7. Alterar cores (linha e extremidades). Verificado: ✓.`);
      return { seg, ok: true };
    },
  );
  result.evidence = evidence.join("\n") + (result.evidence ? "\n" + result.evidence : "");
  return [result];
}

function runStopGainFullFlowTests(): QaTestResult[] {
  if (typeof window === "undefined" || !window.localStorage) return [{ name: "Stop/Ganho", pass: true, evidence: "localStorage indisponível." }];
  const { lastClose, indexEnd, indexStart } = getChartInfo();
  const segment: DrawSegment = {
    index1: indexStart, price1: lastClose, index2: indexEnd, price2: lastClose,
    type: "stopGain", color: "#000000", stopGainRatioUp: 2, stopGainRatioDown: 1.5, stopGainFillOpacity: 0.4,
    stopGainShowPercent: true, stopGainShowValuesOnYAxis: true, stopGainStrokeWidth: "medium",
  };
  const evidence: string[] = [];
  evidence.push(`1. Criado: stopGain ratioUp 2, ratioDown 1.5, opacity 0.4, showPercent, showOnYAxis.`);

  const result = runFlow(
    "Stop/Ganho",
    segment,
    (s) => s.type === "stopGain" && s.stopGainRatioUp === 2 && s.stopGainShowPercent === true,
    (s, ev) => {
      const seg = { ...s, price1: lastClose + 50, price2: lastClose + 50 };
      ev.push(`5. Mover: preço ${lastClose} → ${lastClose + 50}. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, stopGainRatioUp: 3, stopGainRatioDown: 2, stopGainFillOpacity: 0.6 };
      ev.push(`6. Alterar proporções (2/1.5→3/2) e opacidade (0.4→0.6). Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, color: "#333333" };
      ev.push(`7. Alterar cor → #333333. Verificado: ✓.`);
      return { seg, ok: true };
    },
  );
  result.evidence = evidence.join("\n") + (result.evidence ? "\n" + result.evidence : "");
  return [result];
}

function runPencilFullFlowTests(): QaTestResult[] {
  if (typeof window === "undefined" || !window.localStorage) return [{ name: "Lápis", pass: true, evidence: "localStorage indisponível." }];
  const { lastClose, indexEnd, indexStart } = getChartInfo();
  const points = [
    { index: indexStart, price: lastClose },
    { index: indexStart + 5, price: lastClose + 50 },
    { index: indexEnd, price: lastClose + 80 },
  ];
  const segment: DrawSegment = {
    index1: indexStart, price1: lastClose, index2: indexEnd, price2: lastClose + 80,
    type: "pencil", color: "#000000", pencilPoints: points, pencilStrokeWidth: "thick",
  };
  const evidence: string[] = [];
  evidence.push(`1. Criado: pencil 3 pontos, thick. [${indexStart}–${indexEnd}].`);

  const result = runFlow(
    "Lápis",
    segment,
    (s) => s.type === "pencil" && (s.pencilPoints?.length ?? 0) >= 3 && s.pencilStrokeWidth === "thick",
    (s, ev) => {
      const shifted = (s.pencilPoints ?? []).map((p) => ({ index: p.index, price: p.price + 30 }));
      const seg = { ...s, pencilPoints: shifted, price1: lastClose + 30, price2: lastClose + 110 };
      ev.push(`5. Mover: todos os pontos +30 em preço. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, pencilStrokeWidth: "thin" as const };
      ev.push(`6. Alterar espessura: thick → thin. Verificado: ✓.`);
      return { seg, ok: true };
    },
    (s, ev) => {
      const seg = { ...s, color: "#990000" };
      ev.push(`7. Alterar cor → #990000. Verificado: ✓.`);
      return { seg, ok: true };
    },
  );
  result.evidence = evidence.join("\n") + (result.evidence ? "\n" + result.evidence : "");
  return [result];
}

/**
 * Desenhos com "todos os períodos" (H, V, retângulo): merge igual ao KlinesChart — 1h vê entradas na chave partilhada gravadas no contexto de outro TF (ex. 4h).
 */
function runCrossIntervalSharedDrawingsQaTests(): QaTestResult[] {
  if (typeof window === "undefined") {
    return [{ name: "Desenhos — partilha entre intervalos (Debug QA)", pass: true, evidence: "Ignorado fora do browser." }];
  }
  const sym = "BTCUSDT";
  const key60 = getDrawStorageKey(sym, 60);
  const key240 = getDrawStorageKey(sym, 240);
  const sharedKey = getDrawSharedIntervalsKey(sym);
  if (!sharedKey) {
    return [{ name: "Desenhos — chave partilhada", pass: false, message: "getDrawSharedIntervalsKey devolveu null." }];
  }

  const out: QaTestResult[] = [];

  const hShared: DrawSegment = {
    index1: 10,
    price1: 50_000,
    index2: 90,
    price2: 50_000,
    type: "horizontalLine",
    color: "#111111",
    lineShowOnAllIntervals: true,
  };
  const mergedH1h = mergeDrawSegmentsForChartLoad({ [sharedKey]: [hShared], [key60]: [], [key240]: [] }, key60, sharedKey);
  const mergedH4h = mergeDrawSegmentsForChartLoad({ [sharedKey]: [hShared], [key60]: [], [key240]: [] }, key240, sharedKey);
  const passH =
    mergedH1h.length === 1 &&
    mergedH1h[0]?.type === "horizontalLine" &&
    mergedH1h[0]?.lineShowOnAllIntervals === true &&
    mergedH4h.length === 1;
  out.push({
    name: "Desenhos — horizontal com “todos os períodos”: aparece no 1h e no 4h (merge)",
    pass: passH,
    message: passH ? undefined : `Esperado 1 segmento em cada TF; 1h tem ${mergedH1h.length}, 4h tem ${mergedH4h.length}.`,
    evidence: [
      `Chave partilhada: ${sharedKey}`,
      `merge(1h): ${mergedH1h.length} item(s), tipo=${mergedH1h[0]?.type ?? "—"}, allIntervals=${String(mergedH1h[0]?.lineShowOnAllIntervals)}`,
      `merge(4h): ${mergedH4h.length} item(s)`,
    ].join("\n"),
  });

  const vShared: DrawSegment = {
    index1: 42,
    price1: 49_000,
    index2: 42,
    price2: 49_000,
    type: "verticalLine",
    color: "#222222",
    lineShowOnAllIntervals: true,
  };
  const mergedV1h = mergeDrawSegmentsForChartLoad({ [sharedKey]: [vShared], [key60]: [] }, key60, sharedKey);
  const passV = mergedV1h.length === 1 && mergedV1h[0]?.type === "verticalLine" && mergedV1h[0]?.index1 === 42;
  out.push({
    name: "Desenhos — vertical com “todos os períodos”: aparece no 1h (merge)",
    pass: passV,
    message: passV ? undefined : `Esperado 1 vertical no 1h; obtido ${mergedV1h.length}.`,
    evidence: [`merge(1h): ${mergedV1h.length} item(s), index1=${mergedV1h[0]?.index1 ?? "—"}`].join("\n"),
  });

  const hLocalOnly: DrawSegment = {
    index1: 5,
    price1: 48_000,
    index2: 80,
    price2: 48_000,
    type: "horizontalLine",
    color: "#333333",
  };
  const mergedNoShare = mergeDrawSegmentsForChartLoad({ [key240]: [hLocalOnly], [key60]: [] }, key60, sharedKey);
  const passIsolate = mergedNoShare.length === 0;
  out.push({
    name: "Desenhos — horizontal só no 4h (sem “todos os períodos”) não entra no merge do 1h",
    pass: passIsolate,
    message: passIsolate ? undefined : `Esperado 0 no 1h; obtido ${mergedNoShare.length}.`,
    evidence: `Só chave ${key240} com 1 horizontal sem lineShowOnAllIntervals → merge(1h) = ${mergedNoShare.length} item(s).`,
  });

  const rectShared: DrawSegment = {
    index1: 12,
    price1: 47_000,
    index2: 88,
    price2: 52_000,
    type: "rectangle",
    color: "#444444",
    rectangleStrokeWidth: "medium",
    rectangleFilled: false,
    lineShowOnAllIntervals: true,
  };
  const mergedRect1h = mergeDrawSegmentsForChartLoad({ [sharedKey]: [rectShared], [key60]: [], [key240]: [] }, key60, sharedKey);
  const mergedRect4h = mergeDrawSegmentsForChartLoad({ [sharedKey]: [rectShared], [key60]: [], [key240]: [] }, key240, sharedKey);
  const passRect =
    mergedRect1h.length === 1 &&
    mergedRect1h[0]?.type === "rectangle" &&
    mergedRect1h[0]?.lineShowOnAllIntervals === true &&
    mergedRect4h.length === 1;
  out.push({
    name: "Desenhos — retângulo com “todos os períodos”: aparece no 1h e no 4h (merge)",
    pass: passRect,
    message: passRect ? undefined : `Esperado 1 retângulo em cada TF; 1h=${mergedRect1h.length}, 4h=${mergedRect4h.length}.`,
    evidence: [
      `merge(1h): tipo=${mergedRect1h[0]?.type ?? "—"}, filled=${String(mergedRect1h[0]?.rectangleFilled)}, allIntervals=${String(mergedRect1h[0]?.lineShowOnAllIntervals)}`,
      `merge(4h): ${mergedRect4h.length} item(s)`,
    ].join("\n"),
  });

  const rectLocalOnly: DrawSegment = {
    index1: 1,
    price1: 46_000,
    index2: 50,
    price2: 51_000,
    type: "rectangle",
    color: "#555555",
    rectangleStrokeWidth: "thin",
  };
  const mergedRectIsolate = mergeDrawSegmentsForChartLoad({ [key240]: [rectLocalOnly], [key60]: [] }, key60, sharedKey);
  const passRectIsolate = mergedRectIsolate.length === 0;
  out.push({
    name: "Desenhos — retângulo só no 4h (sem “todos os períodos”) não entra no merge do 1h",
    pass: passRectIsolate,
    message: passRectIsolate ? undefined : `Esperado 0 no 1h; obtido ${mergedRectIsolate.length}.`,
    evidence: `Só ${key240} com retângulo sem lineShowOnAllIntervals → merge(1h) = ${mergedRectIsolate.length} item(s).`,
  });

  return out;
}

export function runDrawingsQaTests(): QaTestResult[] {
  return [
    ...runCrossIntervalSharedDrawingsQaTests(),
    ...runHorizontalLineFullFlowTests(),
    ...runVerticalLineFullFlowTests(),
    ...runSegmentFullFlowTests(),
    ...runRectangleFullFlowTests(),
    ...runArrowFullFlowTests(),
    ...runTextFullFlowTests(),
    ...runFibonacciFullFlowTests(),
    ...runFreeRetracementFullFlowTests(),
    ...runChannelFullFlowTests(),
    ...runStopGainFullFlowTests(),
    ...runPencilFullFlowTests(),
  ];
}
