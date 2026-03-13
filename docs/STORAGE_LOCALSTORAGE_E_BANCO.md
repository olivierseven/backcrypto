# Onde ficam os dados: localStorage vs banco (API)

Visão geral do que é persistido **só no localStorage**, **só no banco** (API/Prisma) ou **nos dois**, no módulo do gráfico de klines e sistema.

---

## Somente localStorage

Estes dados **não** são enviados ao salvar layout e **não** são aplicados ao carregar layout da API. Valores vêm apenas do navegador.

| Chave / conceito | O que guarda | Default se não definido |
|------------------|--------------|-------------------------|
| `backcrypto-klines-symbol` | Moeda (ex.: BTCUSDT, ETHUSDT) | BTCUSDT |
| `backcrypto-klines-group-minutes` | Timeframe (ex.: 1440 = 1D, 240 = 4h) | 1440 (1 dia) |
| `backcrypto-klines-local-prefs` | `visibleCount`, `chartStyle`, `drawingsVisible` (persistidos após layout aplicado; tipo de gráfico e olho também vêm do layout ao carregar) | 1D, velas, visible true |
| `backcrypto-klines-draw-magnetic` | Magnético (snap aos OHLC nos desenhos) | `false` (desativado) |
| `backcrypto-klines-last-layout` | Qual slot de layout está ativo (0 = default, 1–7 = Layout 1…7) | usado só para decidir qual layout buscar na API |
| `backcrypto-klines-draw-segments` | Segmentos de desenho por intervalo (por `groupMinutes`) | — |
| `backcrypto-klines-draw-visible` | Exibir ou ocultar desenhos por intervalo | — |
| `backcrypto-klines-draw-defaults` | Padrões de estilo dos desenhos (cores, traços, etc.) | — |
| `backcrypto-klines-heikin-ashi` | Gráfico em Heikin Ashi ativado (1/0 ou true/false) | — |
| `backcrypto-klines-volume-at-price` | Preferência de “volume no preço” (enabled, buckets, percent, opacity, side, cores) | usado na tabela; pode ser sobrescrito pelo layout ao carregar |
| `backcrypto:spot_extremes:*` | Cache de máximas/mínimas spot por símbolo/intervalo | — |
| `backcrypto:spot_extremes_last_cleanup` | Último dia de limpeza do cache de spot extremes | — |
| `backcrypto-layout-debug` | Debug do carregamento de layout (sistema) | — |

---

## Somente banco (API / chart-layouts)

Persistido na tabela `ChartLayout` (Prisma), por usuário e slot. Não há espelho desses dados no localStorage.

| O que | Descrição |
|-------|-----------|
| **Layout por slot (1–7)** | Um registro por `(userId, slot)` em **ChartLayout**. Slot 0 não existe em ChartLayout. |
| **Layout default (slot 0)** | Fica na tabela **ChartModels** (não em ChartLayout): modelo com `(userId: admin, slot: 0)`. Carregado como "Default" para todos. |
| **Campo `config`** | JSON com: `visibleCount`, `invisibleCandlesEnd`, presets de cores (candle, fundo, eixos, linhas), `yAxisAbbreviated`, `logScale`, opções de eixo (main/secondary, last close, countdown), `secondaryPanelHeightPercent`, `volumeOnPrice`, `volumeOnPriceOpacity`, `chartSizePercent`, `chartStyle`, `candleBodyStyle`, `userIndicators`, `strategies`, `appliedStrategyIds`, `volumeAtPriceEnabled`, `volumeAtPriceBuckets`, etc. **Não** inclui: timeframe, símbolo, olho visible, magnético. |
| **Campo `name`** | Nome opcional do layout (máx. 24 caracteres). |

Ou seja: **indicadores, estratégias, cores e opções do gráfico** (exceto as listadas em “Somente localStorage”) vêm do layout no banco quando se carrega um slot 1–7 **ou o default (slot 0)**. O layout default é carregado **somente do banco** (não do localStorage), para evitar que prefs antigas no storage interfiram.

---

## localStorage + banco

Dados que existem nos dois: preferência no navegador e, quando há layout salvo, cópia no `config` do layout na API.

| Conceito | localStorage | Banco |
|----------|--------------|--------|
| **Quantidade de candles (`visibleCount`)** | Em `backcrypto-klines-local-prefs` (após layout aplicado). | Incluído ao salvar: slot 1–7 em ChartLayout; slot 0 (default) em ChartModels. Ao carregar layout (incluindo default), esse valor é aplicado a partir do banco. |
| **Prefs gerais do gráfico (default e slots 1–7)** | Não usadas para **carregar** layout: default e slots vêm só do banco. `backcrypto-klines-prefs` deixou de ser lido no init. | Layout default e slots 1–7 são carregados **somente da API**; o localStorage não interfere no carregamento. |
| **Volume (gráfico)** | Exibir volume no painel do gráfico (`volumeOnPrice`) e opacidade. | Incluído no `config` ao salvar. **Auto-save:** apenas o check (ativar/desativar) dispara salvamento automático do layout atual (slot 1–7); opacidade só é gravada ao clicar em Salvar layout. |
| **Volume no preço (VAP)** | `backcrypto-klines-volume-at-price`: enabled, buckets, percent, opacity, side, cores. | Incluído no `config` ao salvar. Ao carregar um layout, o config do banco aplica essas opções. **Auto-save:** apenas o check (ativar/desativar) e a quantidade de intervalos (buckets) disparam salvamento automático do layout atual (slot 1–7); demais prefs (percent, opacidade, lado, cores) só são gravadas ao clicar em Salvar layout. |

Resumo prático:

- **Timeframe, símbolo, olho visible e magnético:** só localStorage; nunca salvos no layout nem aplicados a partir do layout. **Estilo de gráfico (chartStyle/candleBodyStyle):** salvo e aplicado por layout (cada layout pode ser velas, barras, linha, etc.).
- **Indicadores, estratégias, cores, eixos, visibleCount, VAP, etc.:** no banco, dentro do `config` do layout; no cliente, ao carregar um layout (default ou 1–7), esses valores vêm **só da API**. O layout default não é mais inicializado a partir do localStorage.

---

## Referência rápida das chaves localStorage (klines)

| Chave | Conteúdo |
|-------|----------|
| `backcrypto-klines-prefs` | Não é mais lido no carregamento; layout default vem só do banco. (Chave pode existir de sessões antigas.) |
| `backcrypto-klines-local-prefs` | visibleCount, chartStyle, drawingsVisible (persistidos após layout aplicado; usados para init de estilo/olho). |
| `backcrypto-klines-last-layout` | Último slot selecionado: `"default"` / `"0"` ou `"1"` … `"7"`. |
| `backcrypto-klines-group-minutes` | Intervalo em minutos (ex.: 1440, 240). |
| `backcrypto-klines-symbol` | Símbolo (ex.: BTCUSDT). |
| `backcrypto-klines-draw-segments` | Desenhos por intervalo (JSON por `groupMinutes`). |
| `backcrypto-klines-draw-visible` | Visibilidade dos desenhos por intervalo. |
| `backcrypto-klines-draw-magnetic` | Magnético ativado: `"true"` / `"false"`. |
| `backcrypto-klines-draw-defaults` | Padrões visuais dos desenhos. |
| `backcrypto-klines-heikin-ashi` | Heikin Ashi ativo. |
| `backcrypto-klines-volume-at-price` | Config do volume no preço (enabled, buckets, percent, opacity, etc.). |

---

*Documento gerado a partir do comportamento atual do módulo de klines e da API `chart-layouts`.*
