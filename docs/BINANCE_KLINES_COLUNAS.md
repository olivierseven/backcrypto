# Colunas da API de velas (klines) da Binance

Este documento explica, de forma simples, o que significa cada informação que a API da Binance devolve para cada “vela” (candle) de preço — por exemplo, do par **BTCUSDT** em intervalos de **1 minuto**.

---

## O que é uma vela (candle)?

Uma **vela** é um resumo do que aconteceu com o preço em um período de tempo. Por exemplo: em 1 minuto, qual foi o primeiro preço, o maior, o menor, o último, e quanto foi negociado. A API devolve uma lista de números e textos para cada vela; cada posição dessa lista é uma **coluna**.

---

## Colunas (em ordem)

### 1. **Open Time** (horário de abertura) — índice 0

- **Tipo:** número (timestamp em milissegundos).
- **O que é:** o instante em que essa vela **começou**, em horário universal (UTC).
- **Exemplo:** `1730189160000` = 28/02/2026 07:06:00 UTC.
- **Para o leigo:** “A que horas esse minuto de dados começou?”

---

### 2. **Open** (abertura) — índice 1

- **Tipo:** texto com número (ex.: `"63550.01"`).
- **O que é:** o **primeiro preço** do ativo nesse período (ex.: primeiro preço do BTC naquele minuto).
- **Para o leigo:** “Por quanto estava o Bitcoin quando esse minuto começou?”

---

### 3. **High** (máxima) — índice 2

- **Tipo:** texto com número.
- **O que é:** o **maior preço** que o ativo atingiu nesse período.
- **Para o leigo:** “Qual foi o preço mais alto do Bitcoin nesse minuto?”

---

### 4. **Low** (mínima) — índice 3

- **Tipo:** texto com número.
- **O que é:** o **menor preço** que o ativo atingiu nesse período.
- **Para o leigo:** “Qual foi o preço mais baixo do Bitcoin nesse minuto?”

---

### 5. **Close** (fechamento) — índice 4

- **Tipo:** texto com número.
- **O que é:** o **último preço** do ativo nesse período (preço no fim do minuto).
- **Para o leigo:** “Por quanto estava o Bitcoin quando esse minuto terminou?”

---

### 6. **Volume** (volume em ativo base) — índice 5

- **Tipo:** texto com número.
- **O que é:** quanto do **ativo base** foi negociado nesse período. No par **BTCUSDT**, o ativo base é o **BTC**.
- **Exemplo:** `25.93` = 25,93 BTC foram comprados ou vendidos naquele minuto.
- **Para o leigo:** “Quantos Bitcoin mudaram de mão nesse minuto?”

---

### 7. **Close Time** (horário de fechamento) — índice 6

- **Tipo:** número (timestamp em milissegundos).
- **O que é:** o instante em que essa vela **terminou**, em UTC.
- **Para o leigo:** “A que horas esse minuto de dados acabou?”

---

### 8. **Quote Asset Volume** (volume em moeda quote) — índice 7

- **Tipo:** texto com número.
- **O que é:** quanto da **moeda de referência** (quote) foi movimentado em valor. No **BTCUSDT**, a quote é o **USDT** (dólar atrelado).
- **Exemplo:** `1648000.50` = 1.648.000,50 USDT em negócios naquele minuto.
- **Para o leigo:** “Quanto dinheiro (em dólar/USDT) foi negociado nesse minuto?”

---

### 9. **Number of Trades** (número de negócios) — índice 8

- **Tipo:** número inteiro.
- **O que é:** **quantas operações** (compras ou vendas) aconteceram nesse período.
- **Para o leigo:** “Quantas compras e vendas diferentes ocorreram nesse minuto?”

---

### 10. **Taker Buy Base Asset Volume** (volume comprado “taker” em base) — índice 9

- **Tipo:** texto com número.
- **O que é:** do volume total em **base** (BTC), quanto foi de **compras feitas por quem “tira” liquidez** (taker) — ou seja, ordens que bateram direto no livro (ex.: ordem à mercado).
- **Para o leigo:** “Dos Bitcoin negociados, quantos foram comprados por quem entrou na ordem e executou na hora?”

---

### 11. **Taker Buy Quote Asset Volume** (volume comprado “taker” em quote) — índice 10

- **Tipo:** texto com número.
- **O que é:** o mesmo que o anterior, mas em **valor em USDT**: quanto em dólar foi gasto nessas compras “taker”.
- **Para o leigo:** “Quanto dinheiro (em USDT) foi gasto nessas compras que executaram na hora?”

---

### 12. **Ignore** (ignorar) — índice 11

- **Tipo:** número.
- **O que é:** campo reservado pela Binance; não tem uso prático.
- **Para o leigo:** Pode ignorar; não usamos essa coluna.

---

## Resumo rápido (BTCUSDT, 1 minuto)

| Coluna              | Em uma frase |
|---------------------|------------------------------------------------------------------|
| Open Time           | Quando o minuto começou (UTC).                                   |
| Open                | Preço do BTC no início do minuto.                                |
| High                | Maior preço do BTC no minuto.                                    |
| Low                 | Menor preço do BTC no minuto.                                    |
| Close               | Preço do BTC no fim do minuto.                                   |
| Volume              | Quantos BTC foram negociados no minuto.                          |
| Close Time          | Quando o minuto terminou (UTC).                                  |
| Quote Vol (USDT)    | Quanto dinheiro (USDT) foi negociado no minuto.                  |
| Trades              | Quantas operações (compra/venda) no minuto.                     |
| Taker Buy Base      | Quantos BTC foram comprados por quem “tira” liquidez.           |
| Taker Buy Quote     | Quanto USDT foi gasto nessas compras “taker”.                    |
| Ignore              | Não usar.                                                        |

---

## Referência da API

- **Endpoint:** `GET https://api.binance.com/api/v3/klines`
- **Exemplo:** `?symbol=BTCUSDT&interval=1m&limit=1000`
- **Documentação oficial:** [Binance API — Kline/Candlestick data](https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data)
