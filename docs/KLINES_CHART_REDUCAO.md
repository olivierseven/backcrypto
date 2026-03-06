# Redução do gráfico de candles (Klines)

Este documento descreve como é aplicada a **redução automática** da largura do plot quando a tela é estreita, as **proporções fixas** usadas e a **escala de texto** (indicadores e eixo Y).

---

## Quando a redução ocorre

- O gráfico observa a **largura da viewport** (`window.innerWidth`) via `resize`.
- Se o espaço disponível para o plot for **menor** que a largura máxima desejada, o plot **reduz** para caber na tela (sem barra de rolagem horizontal desnecessária).
- Ao **aumentar** a tela (ex.: celular na horizontal ou janela maior), o gráfico volta a crescer até o limite máximo.

Nenhum botão de “reduzir 50%” é usado: a redução é **só em função da largura da tela**.

---

## Constantes de largura

| Constante | Valor | Uso |
|-----------|--------|-----|
| `SIDEBAR_WIDTH` | 40 px | Largura da sidebar **quando vertical** (modo antigo). Atualmente a sidebar fica **no topo** e não consome largura horizontal do plot. |
| `Y_AXIS_WIDTH` | 60 px | Largura fixa do eixo Y (valores em USDT etc.). |
| `FIXED_WIDTH` | 60 px | Largura fixa que precisa ser reservada na horizontal (apenas eixo Y). |
| `MIN_PLOT_WIDTH` | 200 px | Largura mínima da área de plot. |
| `MAX_PLOT_WIDTH_BASE` | 600 px | Largura máxima do plot com tamanho 100%. Largura total máxima do chart = 660 px (600 + 60 eixo). |

- **Espaço disponível para o plot:**  
  `availableForPlot = Math.min(plotWidth, viewportWidth - FIXED_WIDTH)`  
  (`plotWidth` já é a largura disponível para o plot; também limitamos pela viewport; o eixo Y é reservado em `FIXED_WIDTH`).

- **Largura máxima do plot (com opção de tamanho):**  
  `maxPlotWidth = MAX_PLOT_WIDTH_BASE * (chartSizePercent / 100)`  
  - 100% → 600 px  
  - 125% → 750 px  
  - 150% → 900 px  
  - etc.

- **Largura efetiva do plot:**  
  - Se `availableForPlot >= maxPlotWidth` → usa `maxPlotWidth`.  
  - Caso contrário → usa o espaço disponível, limitado entre `MIN_PLOT_WIDTH` e `maxPlotWidth`:  
    `displayPlotWidth = Math.max(200, Math.min(availableForPlot, maxPlotWidth))`.

Ou seja: em telas estreitas o plot encolhe até 200 px; em telas largas fica no máximo definido por `chartSizePercent`.

---

## Proporções fixas (área principal e painéis)

As razões de aspecto são **fixas** para que, ao reduzir ou aumentar a largura, o gráfico mantenha a mesma “forma”.

- **Área principal (candles):**  
  Proporção de referência **592 × 320** (largura × altura; razão 592/320 = 1,85). A altura do retângulo dos candles tem **teto 320 px**: não passa de 320 mesmo com largura maior.  
  - Razão usada no código:  
    `MAIN_PLOT_HEIGHT_PER_WIDTH = 320 / 592`  
  - Altura do gráfico principal:  
    `chartH = min(320, displayPlotWidth * MAIN_PLOT_HEIGHT_PER_WIDTH)`  
    (com um mínimo aplicado em telas estreitas).

- **Painéis secundários (ex.: RSI, MACD):**  
  Cada painel tem altura igual a **1/3** da altura do gráfico principal.  
  - Razão:  
    `PANEL_TO_MAIN_RATIO = 1 / 3`  
  - Altura de cada painel (2, 3, 4 ou 5):  
    `panelHeight = chartH * PANEL_TO_MAIN_RATIO`.

Assim, na redução e no aumento, mantêm-se:
- a proporção **592 × 320** da área principal (razão 1,85);
- a proporção **1 : 3** entre cada painel e a área principal.

---

## Escala de texto (indicadores e eixo Y)

Quando o plot está **reduzido**, os textos (displays de indicadores e eixo Y) também reduzem, para não ficarem desproporcionais. A escala **não** segue exatamente a mesma proporção da largura; usa um fator entre **0,6 e 1**.

- **Fórmula:**  
  `textScale = Math.max(0.6, Math.min(1, displayPlotWidth / maxPlotWidth))`.

  - Se o plot está no tamanho máximo (`displayPlotWidth === maxPlotWidth`) → `textScale = 1`.  
  - Se o plot está reduzido → `textScale` fica entre 0,6 e 1 (ex.: plot a 80% da largura máxima → texto a 80%; plot a 50% → texto a 60%, pois há mínimo 0,6).

- **Onde é aplicado:**  
  - **KlinesChart** calcula `textScale` e repassa para:  
    - **KlinesChartSvg** (strip de indicadores, eixo de datas, crosshair, tooltip OHLC, rótulos de desenhos).  
    - **KlinesChartYAxis** (ticks do preço, ticks dos painéis 2–5, último fechamento, último valor dos indicadores, valor do crosshair).  
  - Em ambos os componentes, os tamanhos de fonte são derivados de `textScale`, por exemplo:  
    - Base 10 px → `fontSize = Math.round(10 * textScale)`;  
    - Base 9 px → `fontSizeSmall = Math.round(9 * textScale)`;  
    - Eixo de datas (base 12 px) → `fontSizeAxis = Math.round(12 * textScale)`.

Assim, na redução do gráfico (incluindo o do MACD e dos demais painéis), os textos do eixo Y e dos indicadores reduzem de forma consistente.

---

## Resumo

| Item | Regra |
|------|--------|
| Redução | Automática pela largura da viewport; sem botão de toggle. |
| Largura do plot | Entre 200 px e `maxPlotWidth`; em telas estreitas usa o espaço disponível (menos 60 px fixos). |
| Proporção área principal | 592 × 320 (fixa; razão 1,85). |
| Proporção dos painéis | Cada painel = 1/3 da altura do gráfico principal. |
| Texto | `textScale` entre 0,6 e 1, aplicado em KlinesChartSvg e KlinesChartYAxis. |

Arquivos principais: `KlinesChart.tsx` (cálculo de `displayPlotWidth`, proporções e `textScale`), `KlinesChartConstants.ts` (constantes), `KlinesChartSvg.tsx` e `KlinesChartYAxis.tsx` (uso de `textScale` nos textos).
