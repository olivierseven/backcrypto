# Plano de migração: layout em 3 colunas (layout / indicators / strategies)

Objetivo: separar o JSON único `config` da tabela `ChartLayout` em três colunas para que **layout**, **indicadores** e **estratégias** não se sobrescrevam e o carregamento seja “ler as 3 colunas e aplicar cada uma”.

---

## Visão do resultado

| Coluna       | Conteúdo |
|-------------|----------|
| **layout**  | Config só do gráfico: `visibleCount`, `candleColorPreset`, cores, eixos, volume no gráfico, volume no preço (VAP), `chartStyle`, etc. **Não** inclui `userIndicators`, `strategies`, `appliedStrategyIds`. |
| **indicators** | Array `userIndicators` (indicadores do usuário). |
| **strategies**  | Objeto `{ strategies: Strategy[], appliedStrategyIds: string[] }`. |

- **GET**: retorna as 3 colunas por slot; o cliente aplica cada uma no seu contexto.
- **POST**: aceita `slot` e opcionalmente `layout`, `indicators`, `strategies`; atualiza só as chaves enviadas.
- **PATCH**: pode aceitar `{ slot, layout?, indicators?, strategies? }` e atualizar só as colunas presentes (ex.: “Salvar no layout atual” envia só `strategies`).

---

## Passo a passo

### Fase 1: Schema e migração de dados (banco)

#### Passo 1.1 – Adicionar as novas colunas (sem remover `config`)

- Adicionar em `ChartLayout` (e, se quiser simetria, em `ChartModel` depois):
  - `layout    Json?`   — config só do gráfico
  - `indicators Json?` — array de indicadores
  - `strategies Json?` — `{ strategies, appliedStrategyIds }`
- Manter a coluna `config` por enquanto (compatibilidade e rollback).

**SQL sugerido** (rodar no banco; não criar pasta em `prisma/migrations/` conforme regra do projeto):

```sql
ALTER TABLE "backcrypto"."ChartLayout"
  ADD COLUMN IF NOT EXISTS "layout"    JSONB,
  ADD COLUMN IF NOT EXISTS "indicators" JSONB,
  ADD COLUMN IF NOT EXISTS "strategies"  JSONB;
```

- Atualizar o **schema Prisma** para refletir as novas colunas (e o comentário do model).

#### Passo 1.2 – Migração de dados (SQL)

Rodar no mesmo banco, **depois** do Passo 1.1. Preenche `layout`, `indicators` e `strategies` a partir de `config` (o cast `::jsonb` funciona tanto se `config` for `json` quanto `jsonb`):

```sql
UPDATE "backcrypto"."ChartLayout"
SET
  "layout"    = ((config)::jsonb - 'userIndicators' - 'strategies' - 'appliedStrategyIds'),
  "indicators" = COALESCE((config)::jsonb -> 'userIndicators', '[]'::jsonb),
  "strategies"  = jsonb_build_object(
    'strategies',          COALESCE((config)::jsonb -> 'strategies', '[]'::jsonb),
    'appliedStrategyIds',  COALESCE((config)::jsonb -> 'appliedStrategyIds', '[]'::jsonb)
  )
WHERE config IS NOT NULL;
```

#### Passo 1.3 – Validar dados

- Conferir que, para cada linha migrada, `layout` + `indicators` + `strategies` equivalem ao que estava em `config` (leitura lógica igual).
- Opcional: manter um backup da tabela ou do `config` antes de qualquer passo destrutivo.

---

### Fase 2: API `chart-layouts`

#### Passo 2.1 – GET: retornar as 3 colunas

- Na rota GET, selecionar `layout`, `indicators`, `strategies` além de `config` (por enquanto).
- Resposta por slot: incluir as 3 colunas. Se quiser compatibilidade com cliente antigo, pode manter também um `config` “virtual” montado juntando as 3 colunas (ou continuar lendo `config` se as 3 estiverem null).
- Critério de “fonte da verdade”: se `layout` (ou `indicators` / `strategies`) não for null, usar as 3 colunas para montar o objeto que o cliente espera; senão, fallback para `config`.

#### Passo 2.2 – POST: aceitar `layout`, `indicators`, `strategies`

- Body: `slot` obrigatório; opcionalmente `name`, `layout`, `indicators`, `strategies`.
- Se vier só `config` (cliente antigo): fazer o split como no Passo 1.2 e gravar nas 3 colunas (e opcionalmente ainda em `config` por um tempo).
- Se vier `layout` / `indicators` / `strategies`: atualizar só as colunas enviadas; não sobrescrever as outras com null a menos que o cliente envie explicitamente `null` ou array/objeto vazio.
- Limites de tamanho: aplicar ao payload de cada coluna (ou ao total), conforme política atual (ex.: 32KB por coluna ou total).

#### Passo 2.3 – PATCH: genérico por coluna

- Body: `slot` + opcionalmente `layout`, `indicators`, `strategies`.
- Atualizar apenas as colunas cujas chaves estão presentes no body (merge no banco: ler registro, substituir só a coluna correspondente, salvar).
- Com isso, “Salvar no layout atual” envia só `strategies`; salvar após remover indicador envia só `indicators`; etc.

#### Passo 2.4 – Remover dependência de `config` na leitura

- Quando todas as respostas passarem a ser baseadas nas 3 colunas, o GET pode deixar de montar ou ler `config` para resposta (e usar só `layout` + `indicators` + `strategies`).
- Manter escrita em `config` apenas se houver período de compatibilidade; senão, seguir para o Passo 2.5.

#### Passo 2.5 – (Opcional) Deixar de escrever em `config`

- Parar de preencher a coluna `config` em POST/PATCH.
- Mais adiante (Fase 4), remover a coluna `config` do schema e do banco.

---

### Fase 3: Cliente (front)

#### Passo 3.1 – Consumir as 3 colunas no GET

- Onde hoje o cliente recebe um único `config` por slot e aplica em `onLayoutConfigLoaded` / `applyLayoutConfig`:
  - Passar a receber `layout`, `indicators`, `strategies`.
  - Aplicar **layout** no gráfico (applyLayoutConfig com o objeto `layout`; e as prefs de VAP que hoje vêm do config único continuam vindo do objeto que representar o “layout”).
  - Aplicar **indicators** em `replaceUserIndicatorsFromLayout(indicators)`.
  - Aplicar **strategies** em `replaceStrategiesFromLayout(strategies.strategies)` e `replaceAppliedStrategyIdsFromLayout(strategies.appliedStrategyIds)`.
- Manter compatibilidade: se a API ainda enviar um `config` único (fallback), o cliente pode montar o mesmo fluxo atual a partir desse `config` até a API migrar totalmente para as 3 colunas.

#### Passo 3.2 – Montar payload por coluna ao salvar

- **Salvar layout completo** (ex.: botão “Salvar layout” no slot): construir 3 objetos (`layout`, `indicators`, `strategies`) a partir do estado atual e enviar os 3 no POST (ou PATCH, conforme definição da API).
- **Salvar só estratégias** (“Salvar no layout atual”): enviar PATCH com `slot` e `strategies` apenas.
- **Salvar só indicadores** (ex.: após remover indicador e chamar `saveLayoutNow()`): enviar PATCH com `slot` e `indicators` apenas.
- **Salvar só prefs do gráfico** (ex.: volume/VAP ao clicar “Salvar”): enviar PATCH com `slot` e `layout` apenas.

Isso exige que o cliente saiba “quem está salvando” para decidir se envia `layout`, `indicators` ou `strategies` (ou os três). O `saveLayoutNow()` atual pode passar a chamar um método que envia as 3 colunas de uma vez (estado atual), ou a API pode aceitar PATCH com só uma ou duas colunas e fazer merge no servidor.

#### Passo 3.3 – Ajustar `getLayoutExtraConfig` e persistência

- Hoje `getLayoutExtraConfig` devolve um único objeto com layout + indicators + strategies. Pode manter essa função para **montar** o que vai em cada coluna:
  - **layout**: mesmo objeto que hoje vai para “chart + VAP”, sem `userIndicators`, `strategies`, `appliedStrategyIds`.
  - **indicators**: `userIndicators`.
  - **strategies**: `{ strategies, appliedStrategyIds }`.
- Ao chamar a API (POST ou PATCH), enviar o body no novo formato (por coluna) em vez de um único `config`.

---

### Fase 4: Limpeza (opcional, depois de estável) — concluída 4.1

#### Passo 4.1 – Parar de ler e escrever `config` ✅

- **GET**: não lê mais `config`; resposta é sempre montada a partir de `layout`, `indicators`, `strategies`.
- **POST / PATCH**: não gravam mais na coluna `config`; apenas nas 3 colunas.
- Schema Prisma: `config` passou a ser opcional (`Json?`).

#### Passo 4.2 – Remover a coluna `config` (opcional)

Quando quiser remover a coluna do banco (e do schema):

1. **Tornar a coluna anulável** (se ainda for NOT NULL):

```sql
ALTER TABLE "backcrypto"."ChartLayout"
  ALTER COLUMN "config" DROP NOT NULL;
```

2. **Remover a coluna**:

```sql
ALTER TABLE "backcrypto"."ChartLayout"
  DROP COLUMN IF EXISTS "config";
```

3. **No Prisma**: remover o campo `config` do model `ChartLayout` em `prisma/schema.prisma`.

---

### ChartModels (modelos: default + personalizados) — mesmo esquema de 3 colunas

**Schema**: `ChartModel` tem `layout`, `indicators`, `strategies` (e `config` opcional), igual a `ChartLayout`.

**SQL (rodar no banco):**

1. Adicionar colunas:

```sql
ALTER TABLE "backcrypto"."ChartModels"
  ADD COLUMN IF NOT EXISTS "layout"    JSONB,
  ADD COLUMN IF NOT EXISTS "indicators" JSONB,
  ADD COLUMN IF NOT EXISTS "strategies" JSONB;
```

2. Migrar dados:

```sql
UPDATE "backcrypto"."ChartModels"
SET
  "layout"     = ((config)::jsonb - 'userIndicators' - 'strategies' - 'appliedStrategyIds'),
  "indicators" = COALESCE((config)::jsonb -> 'userIndicators', '[]'::jsonb),
  "strategies" = jsonb_build_object(
    'strategies',          COALESCE((config)::jsonb -> 'strategies', '[]'::jsonb),
    'appliedStrategyIds',  COALESCE((config)::jsonb -> 'appliedStrategyIds', '[]'::jsonb)
  )
WHERE config IS NOT NULL;
```

3. (Opcional) Tornar `config` anulável e depois remover:

```sql
ALTER TABLE "backcrypto"."ChartModels" ALTER COLUMN "config" DROP NOT NULL;
-- quando quiser remover:
ALTER TABLE "backcrypto"."ChartModels" DROP COLUMN IF EXISTS "config";
```

**API** `chart-models`: GET usa as 3 colunas (merge em `config`); POST aceita `config` (faz split) ou `layout`/`indicators`/`strategies`. **chart-layouts**: `defaultLayout` (slot 0) é montado a partir de `layout`, `indicators`, `strategies` do `ChartModel`.

---

## Ordem sugerida de execução

1. **Fase 1**: Passos 1.1 → 1.2 → 1.3 (schema + migração de dados + validação).
2. **Fase 2**: Passos 2.1 → 2.2 → 2.3 (GET/POST/PATCH usando as 3 colunas; manter compatibilidade com `config` na leitura/escrita se desejado).
3. **Fase 3**: Passos 3.1 → 3.2 → 3.3 (cliente consome 3 colunas e envia por coluna).
4. **Fase 4**: Quando tudo estiver estável, Passos 4.1 e 4.2 (remover `config`).

---

## Chaves que vão em cada coluna (referência)

- **layout** (chart + VAP):  
  `visibleCount`, `invisibleCandlesEnd`, `candleColorPreset`, `yAxisAbbreviated`, `logScale`, `containerBackground`, `chartBackground`, `footerYAxisBgColor`, `backgroundTextColor`, `footerYAxisTextColor`, `lineTableColor`, `secondaryGridColor`, `showMainAxis`, `showSecondaryAxis`, `showLastCloseLine`, `showCandleCountdown`, `lastCloseLineColor`, `lastCloseTextColor`, `secondaryPanelHeightPercent`, `volumeOnPrice`, `volumeOnPriceOpacity`, `chartSizePercent`, `chartStyle`, `candleBodyStyle`,  
  `volumeAtPriceEnabled`, `volumeAtPriceBuckets`, `volumeAtPricePercent`, `volumeAtPriceOpacity`, `volumeAtPriceWidthPercent`, `volumeAtPriceSide`, `volumeAtPriceColorAbove`, `volumeAtPriceColorBelow`.

- **indicators**: array `userIndicators` (tal qual hoje).

- **strategies**:  
  `{ strategies: Strategy[], appliedStrategyIds: string[] }`.

---

*Documento para migração passo a passo; pode ser ajustado conforme decisões de compatibilidade e ordem de deploy (API antes do cliente ou vice-versa).*
