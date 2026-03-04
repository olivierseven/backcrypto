# mapDisplayByYear — Save de dados do display do mapa

Coluna que armazena, ano a ano, os dados exibidos no mapa (nascimentos, mortes, população, etc.) por iteração. Usada para histórico e possíveis análises futuras.

## Tabelas e colunas

| Tabela              | Coluna           | Tipo | Descrição |
|---------------------|------------------|------|-----------|
| `BioSimulationState`| `mapDisplayByYear` | `Json?` | Último estado da simulação do usuário (uma linha por user) |
| `BioSavedConfig`    | `mapDisplayByYear` | `Json?` | Dados do mapa salvos junto com a configuração |

## Formato do JSON

Objeto cujas chaves são o ano/iteração (string) e os valores são arrays de 5 números:

```
{
  "1": [births, deaths, groups, uniques, population],
  "2": [births, deaths, groups, uniques, population],
  ...
}
```

### Índices do array (0-based)

| Índice | Campo      | Descrição |
|--------|------------|-----------|
| 0      | births     | Nascimentos na iteração |
| 1      | deaths     | Mortes anuais |
| 2      | groups     | Grupos (qtde > 1) |
| 3      | uniques    | Únicos (qtde = 1) |
| 4      | population | População total |

### Exemplo

```json
{
  "1": [62697, 54600, 988, 47, 4031819],
  "2": [62700, 54650, 990, 48, 4032000]
}
```

## Quando é gravado

- **BioSimulationState**: a cada alteração de estado (genesisResult, iteracao etc.), junto com o persist automático; 20x/100x/1000x acumulam em memória no servidor e grava uma vez no fim
- **BioSavedConfig**: ao salvar configuração na nuvem ("Salvar na nuvem")

## Comportamento

- **1x**: o cliente acumula ano a ano e envia no persist
- **20x / 100x / 1000x**: o servidor acumula durante a execução e retorna o `mapDisplayByYear` completo no resultado; o cliente faz merge com o existente e grava
- **Continuação**: 20x + 20x = 40x — o segundo 20x continua do último `iteracao` e os anos são mesclados no `mapDisplayByYear`
