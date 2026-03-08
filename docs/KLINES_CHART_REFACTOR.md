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

### Pendente

- **Fase 2**: Extrair render de segmentos para `klinesChart/DrawSegmentRender.tsx` (ou componentes por tipo).
- **Fase 3**: Extrair overlay de desenho para `klinesChart/DrawOverlay.tsx`.
- **Fase 4**: Extrair handles do segmento selecionado para `klinesChart/DrawSegmentHandles.tsx`.

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

## Atualização após refatorações

Ao concluir cada fase:

1. Marcar a fase em **Concluído** acima.
2. Mover o item correspondente de **Pendente** para **Concluído**.
3. Opcional: registrar data e redução de linhas (ex.: “Fase 1 – 2025-03 – KlinesChart.tsx: −420 linhas”).
