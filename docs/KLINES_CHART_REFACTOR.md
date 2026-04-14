# Refatoração KlinesChart e KlinesChartSvg

Objetivo: reduzir o tamanho de `KlinesChart.tsx` e `KlinesChartSvg.tsx` extraindo blocos com responsabilidade clara, mantendo comportamento idêntico.

---

## Plano geral

| Fase | Descrição | Arquivo(s) alvo | Extração | Redução estimada |
|------|-----------|------------------|----------|------------------|
| **1** | Painel de opções do segmento | KlinesChart.tsx | `KlinesChartSegmentOptions.tsx` | ~400–500 linhas |
| **2** | Render de cada tipo de segmento (fibonacci, channel, rectangle, horizontalLine, segment) | KlinesChartSvg.tsx | `DrawSegmentRender.tsx` (ou um componente por tipo) | ~400–500 linhas |
| **3** | Overlay de desenho (pointer down/move/up + hit-test + criar segmento) | KlinesChartSvg.tsx | `DrawOverlay.tsx` | ~350–400 linhas |
| **4** | Handles do segmento selecionado (círculos, canal meio, extensão, horizontalLine move) | KlinesChartSvg.tsx | `DrawSegmentHandles.tsx` | ~150–200 linhas |

Ordem sugerida: 1 → 2 → 3 → 4 (da mais isolada à mais acoplada).

---

## Status

### Concluído

- **Fase 1** – Painel de opções do segmento extraído para `klinesChart/KlinesChartSegmentOptions.tsx`.  
  - KlinesChart.tsx: **2118 → 1490 linhas** (−628).  
  - Novo arquivo: `KlinesChartSegmentOptions.tsx` (~560 linhas).

- **Fase 2** – Render de cada tipo de segmento (fibonacci, channel, rectangle, horizontalLine, segment) extraído para `klinesChart/DrawSegmentRender.tsx`.  
  - KlinesChartSvg.tsx: **1861 → 1547 linhas** (−314).  
  - Novo arquivo: `DrawSegmentRender.tsx` (~334 linhas).

- **Fase 3** – Overlay de desenho (preview do draw-pending + rect com pointer down/move/up e hit-test para seleção/criação de segmentos) extraído para `klinesChart/DrawOverlay.tsx`.  
  - KlinesChartSvg.tsx: **1556 → 1181 linhas** (−375).  
  - Novo arquivo: `DrawOverlay.tsx` (~457 linhas).

- **Fase 4** – Handles do segmento selecionado (círculos nas pontas, canal meio/extensão, fib nível 1/extensão, reta horizontal mover) extraídos para `klinesChart/DrawSegmentHandles.tsx`.  
  - KlinesChartSvg.tsx: **1191 → 1045 linhas** (−146).  
  - Novo arquivo: `DrawSegmentHandles.tsx` (~166 linhas).

### Pendente

- Nenhuma. As quatro fases do plano foram concluídas.

---

## Fase 1 – Detalhamento (primeira refatoração)

**Objetivo:** Extrair o painel flutuante “Opções do segmento” (cor, tipo de traço, espessura, checkboxes, excluir) para um componente próprio.

**Novo arquivo:** `src/app/(sys)/sistema/klinesChart/KlinesChartSegmentOptions.tsx`

**Responsabilidades do componente:**

- Renderizar o painel (título, botão fechar, alça de arraste para mover).
- Seletor de cor (com listbox) para o segmento selecionado.
- Opções por tipo: horizontalLine (tipo de traço + espessura), channel (cor extremidades, larguras), rectangle (espessura, preenchimento), fibonacci (cor 61,8%, larguras, nível %), segment (início/fim, mostrar %, mostrar valores).
- Botão “Excluir segmento”.
- Estado local: abertura dos listboxes (cor, cor extremidades, cor 61,8%). Posição do painel e ref continuam no pai (para integração com layout e arraste dentro da área do gráfico).

**Props (interface):**

- `segmentOptionsRef`, `segmentOptionsPosition`, `setSegmentOptionsPosition`, `chartRowRef` (posição e arraste).
- `drawSegments`, `selectedSegmentIndex`, `setDrawSegments`, `setSelectedSegmentIndex`.
- `persistDrawDefault`.
- `t` (traduções), `DEFAULT_SEGMENT_COLOR`, `SEGMENT_COLOR_PALETTE`, `FIB_STROKE_WIDTH_OPTIONS` (ou receber já resolvidos).

**Em KlinesChart.tsx:**

- Remover o bloco JSX do painel de opções (~linhas 1278–1832).
- Renderizar `<KlinesChartSegmentOptions ... />` no mesmo lugar, passando as props acima.
- Manter em KlinesChart os estados `segmentOptionsPosition` e `segmentOptionsRef` (e `chartRowRef`) para posicionamento e arraste.

**Critério de sucesso:** Comportamento idêntico ao atual; KlinesChart.tsx com ~400–500 linhas a menos.

---

## Fase 2 – Detalhamento (concluída)

**Objetivo:** Extrair o render de cada tipo de segmento (fibonacci, channel, rectangle, horizontalLine, segment) para um componente próprio.

**Novo arquivo:** `src/app/(sys)/sistema/klinesChart/DrawSegmentRender.tsx`

**Responsabilidades do componente:**

- Receber um único `DrawSegment` e seu índice; renderizar o `<g>` correspondente ao tipo (fibonacci, channel, horizontalLine, rectangle, segment/line).
- Props: `segment`, `index`, `segmentToPixel`, `isSelected`, `setDrawDragging`, `formatYAxis`, `fullReversed`, `n`, `fontSize`.
- Fibonacci: linha principal, seta, níveis, extensão pontilhada, handle de arraste da extensão, valores e percentuais.
- Canal: linha do meio tracejada + seta, paralelas, extensão, pontos nas extremidades, showValues.
- Reta horizontal: linha com strokeWidth e strokeDasharray.
- Retângulo: rect com opção de preenchimento.
- Segment (line): linha, startCap/endCap (point/arrow), showPercent (label com % e dias), showValues.

**Em KlinesChartSvg.tsx:**

- Substituir o bloco `drawSegments.map((seg, idx) => { ... })` por `drawSegments.map((seg, idx) => <DrawSegmentRender key={idx} ... />)`.
- Remover imports não mais usados (FIB_STROKE_WIDTH_VALUES, HORIZONTAL_LINE_STROKE_STYLE_DASH, FibStrokeWidth, MS_PER_DAY).

**Critério de sucesso:** Comportamento idêntico; KlinesChartSvg.tsx com ~300–400 linhas a menos.

---

## Fase 3 – Detalhamento (concluída)

**Objetivo:** Extrair o overlay de desenho (preview do segmento em construção + rect transparente com pointer down/move/up e hit-test) para um componente próprio.

**Novo arquivo:** `src/app/(sys)/sistema/klinesChart/DrawOverlay.tsx`

**Responsabilidades do componente:**

- Renderizar o preview do primeiro ponto (círculo) e dos segmentos em construção (rect, line, channel, horizontalLine, fibonacci) conforme drawPending e drawTool.
- Renderizar o `<rect>` transparente sobre o plot quando drawMode, com: onPointerDown (iniciar desenho ou pan do select), onPointerMove (atualizar segundo ponto), onPointerUp (confirmar segmento para line/rectangle/fibonacci/channel/horizontalLine), onClick (hit-test para selecionar segmento ou segundo clique para canal).
- Helper getSvgPoint(svgRef, clientX, clientY) para converter evento de ponteiro em coordenadas SVG.
- Props: chartSvgRef, chartW, chartH, drawMode, drawTool, todos os drawPending/setters, segmentToPixel, snapToCandlePoint, drawSegments/setDrawSegments, drawDefaults, selectedSegmentIndex/setSelectedSegmentIndex, drawingsVisible, callbacks (onChartDrawClick, onSegmentCreated, onSelectToolPan), selectPanActive/setSelectPanActive, selectPanLastClientXRef, justPannedRef.

**Em KlinesChartSvg.tsx:**

- Substituir o bloco de previews (drawPending) e o rect com pointer handlers por `<DrawOverlay ... />`.
- Remover imports não usados (flushSync, distanceToSegment, SEGMENT_COLOR_PALETTE).

**Critério de sucesso:** Comportamento idêntico; KlinesChartSvg.tsx com ~350–400 linhas a menos.

---

## Fase 4 – Detalhamento (concluída)

**Objetivo:** Extrair os handles do segmento selecionado (círculos de arraste, canal meio/extensão, fib nível 1/extensão, reta horizontal mover) para um componente próprio.

**Novo arquivo:** `src/app/(sys)/sistema/klinesChart/DrawSegmentHandles.tsx`

**Responsabilidades do componente:**

- Renderizar o `<g>` de handles quando há segmento selecionado: círculos transparentes (r=5) nas pontas com setDrawDragging(0/1); reta horizontal: linha transparente para arrastar (horizontalLineMove); canal: meio (channelMid) e dois círculos de extensão (channelExtension); fibonacci: handle do nível 1 (fibLevel1) e retângulo + seta de extensão (extension).
- Props: segment, selectedSegmentIndex, segmentToPixel, setDrawDragging, t (traduções para aria-label).

**Em KlinesChartSvg.tsx:**

- Substituir o bloco IIFE que desenhava os handles por `<DrawSegmentHandles segment={...} selectedSegmentIndex={...} ... />`.
- Remover import não usado (DEFAULT_SEGMENT_COLOR).

**Critério de sucesso:** Comportamento idêntico; KlinesChartSvg.tsx com ~150–200 linhas a menos.

---

## Atualização após refatorações

Ao concluir cada fase:

1. Marcar a fase em **Concluído** acima.
2. Mover o item correspondente de **Pendente** para **Concluído**.
3. Opcional: registrar data e redução de linhas (ex.: “Fase 1 – 2025-03 – KlinesChart.tsx: −420 linhas”).
