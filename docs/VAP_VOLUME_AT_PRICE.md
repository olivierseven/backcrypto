# Volume no Preço (VAP)

Documentação geral do indicador **Volume no Preço** (Volume at Price) no gráfico de candles do sistema.

## O que é

O VAP exibe barras horizontais no eixo Y (à esquerda ou à direita do plot) que representam o **volume negociado por faixa de preço**. O preço usado para agregação é o **fechamento** de cada candle. As barras ficam visíveis apenas **dentro do retângulo do gráfico principal** (clip na área dos candles).

- **Metade superior** do range de preços: cor configurável (ex.: verde).
- **Metade inferior**: outra cor (ex.: vermelho).
- Largura de cada barra é proporcional ao volume da faixa; a barra mais larga corresponde ao `maxVolume` do conjunto.

## Fluxo geral

1. **Intervalo do gráfico** (ex.: 4h) define um **cache de klines** em intervalo menor via `getVapCacheConfig(groupMinutes)`.
2. A API é chamada com `interval` e `limit` desse cache (ex.: 600 velas de 1h).
3. O número efetivo de velas usadas é `maxCandles * (volumeAtPricePercent / 100)` (percentual configurável 20–100%).
4. Os klines do cache são agregados por **faixas de preço** (baseado no **close**), em `numBuckets` intervalos iguais entre o mínimo e o máximo dos closes.
5. O resultado (`buckets` + `maxVolume`) é desenhado no SVG do gráfico principal, com clip na área dos candles.

Código de agregação: `src/app/(sys)/sistema/klinesChart/volumeAtPrice.ts` (`computeVolumeAtPriceBuckets`).

## Limites por tempo (cache VAP)

Para cada intervalo do gráfico é usado um intervalo de cache e um teto de velas. Tabela em `getVapCacheConfig` (KlinesTable.tsx):

| Intervalo do gráfico | param (API) | maxCandles | paramLabel | paramMinutes |
|----------------------|------------|------------|------------|--------------|
| 1m                   | 1m         | 1440      | 1m         | 1            |
| 3m                   | 1m         | 450       | 1m         | 1            |
| 5m                   | 1m         | 750       | 1m         | 1            |
| 15m                  | 5m         | 450       | 5m         | 5            |
| 30m                  | 5m         | 900       | 5m         | 5            |
| 45m                  | 15m        | 450       | 15m        | 15           |
| 1h                   | 15m        | 600       | 15m        | 15           |
| 2h                   | 30m        | 600       | 30m        | 30           |
| 3h                   | 1h         | 450       | 1h         | 60           |
| 4h                   | 1h         | 600       | 1h         | 60           |
| 6h                   | 2h         | 450       | 2h         | 120          |
| 8h                   | 2h         | 600       | 2h         | 120          |
| 12h                  | 3h         | 600       | 3h         | 180          |
| 1D                   | 6h         | 600       | 6h         | 360          |
| 3D                   | 1d         | 450       | 1D         | 1440         |
| 1S                   | 3d         | 350       | 3D         | 4320         |
| 1M (4 sem)           | 1w         | 600       | 1S         | 10080        |

Intervalos não mapeados usam fallback: `param: "1m"`, `maxCandles: 1440`, `paramLabel: "1m"`, `paramMinutes: 1`.

O label de tempo exibido na UI (ex.: "12.5 dias") é o equivalente a `candlesToUse * paramMinutes` em dias/horas/minutos/meses (`formatVapTimeSpan`).

## Limites da UI e constantes

| Parâmetro            | Mínimo | Máximo | Default | Observação |
|----------------------|--------|--------|---------|------------|
| Intervalos (buckets) | 20     | 60     | 20      | Passo 2; valor par (clamp par). |
| Percentual de velas  | 20%    | 100%   | 100%    | Percentual de `maxCandles` usado no cache. |
| Opacidade            | 10%    | 70%    | 40%     | Passo 5%. |
| Largura das barras   | 30%    | 100%   | 100%    | % de `VOLUME_AT_PRICE_MAX_WIDTH_PX`. |
| Lado                 | —      | —      | esquerda| Esquerda ou direita do plot. |

Constantes em código:

- **VOLUME_AT_PRICE_MAX_WIDTH_PX** (KlinesChartConstants): 120 px; a largura efetiva é `min(120, chartW/3) * (volumeAtPriceWidthPercent/100)`.
- **KLINE_VOLUME_AT_PRICE_KEY**: `backcrypto-klines-volume-at-price` (localStorage para preferências do VAP).

## Onde está no código

- **Config cache por tempo:** `KlinesTable.tsx` — `getVapCacheConfig(groupMinutes)`, `formatVapTimeSpan(...)`.
- **Fetch do cache:** `KlinesTable.tsx` — `fetchVapCacheKlines`, uso de `volumeAtPriceKlines` (vapCacheKlines).
- **Cálculo dos buckets:** `klinesChart/volumeAtPrice.ts` — `computeVolumeAtPriceBuckets(klinesRaw, numBuckets)`.
- **Desenho no gráfico:** `klinesChart/KlinesChartSvg.tsx` — grupo `volume-at-price` com `clipPath` do plot; barras como `<rect>` por bucket.
- **Controles e persistência:** `klinesChart/KlinesChartSidebar.tsx` (UI), `KlinesTable.tsx` (estado, localStorage, layout save/load).

## Clip e visibilidade

O grupo do VAP usa `clipPath={url(#plotClipId)}`, o que restringe a visualização ao retângulo do gráfico principal (mesma área dos candles), limitado verticalmente pelo eixo Y do main.
