# sync-temporal-cache

Processo na **VPS** que reconstrói `BinanceKlineCache` (gráficos temporais 5m–1d).

Usa a **mesma lógica** do botão **Debug → Refresh cache → Produção** (`runBinanceKlineCacheRefresh` em `src/lib/binance-kline-cache-refresh.ts`). Não chama cron Vercel nem HTTP.

## O que faz

1. `TRUNCATE` em `BinanceKlineCache`
2. Reinsere a partir das fontes (`openTime < hoje 00:00 UTC`):
   - `BinanceKlineFast` → 1m–4m
   - `BinanceKlineMonth` → 5m–45m
   - `BinanceKline` → 1h–1d
3. Expurgo nas fontes (9 / 90 / 730 dias por `KlineSymbol`)

## Config

- `DATABASE_URL` — Neon **prod** (equivalente a `URL_PROD` no Debug)
- Modo contínuo (`npm start` / PM2): **1× por dia à meia-noite** no fuso horário **local do servidor** (TZ do processo Node)
- `TEMPORAL_CACHE_HTTP_PORT` — health (default **3047**; `0` desliga)
- `TEMPORAL_CACHE_CYCLE_MAX_MS` — timeout do ciclo (default 45 min)
- `VPS_STALL_EXIT_MS` — watchdog sem progresso (default 15 min)

## Setup (VPS)

```bash
cd ~/backcrypto/sync-temporal-cache
cp .env.example .env
# Editar DATABASE_URL = URL prod Neon

npm install
npm run build
```

## Execução

```bash
# loop contínuo (PM2) — aguarda meia-noite local e corre 1×/dia
npm start

# corrida imediata (equivalente a clicar Refresh cache prod)
npm run once
```

## PM2

```bash
cd ~/backcrypto/sync-temporal-cache
pm2 start npm --name sync-temporal-cache -- start
pm2 save
```

Após `git pull`:

```bash
cd ~/backcrypto/sync-temporal-cache
npm install
npm run build
pm2 restart sync-temporal-cache
```

## Notas

- Garantir que `sync-klines` já preencheu as **fontes** antes do refresh; senão o cache fica incompleto.
- O Debug manual continua disponível em dev; este worker substitui a necessidade de cron Vercel em prod.
