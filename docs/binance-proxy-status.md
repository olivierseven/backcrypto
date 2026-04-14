# Estado: proxy Binance (VPS ↔ Next/Vercel)

Última revisão: alinhar documentação com o que já está feito e o que falta implementar no **crypto** (dev + produção).

Documentos relacionados:

- [`binance-proxy-dev-passos.md`](./binance-proxy-dev-passos.md) — passos técnicos dev/env
- [`vercel-vps-binance-proxy.md`](./vercel-vps-binance-proxy.md) — arquitetura e Vercel
- Repo **`crypto_vps`**: [`binance-proxy/README.md`](../../crypto_vps/binance-proxy/README.md) — serviço Node na VPS

---

## Já feito (infra e VPS)

| Item | Detalhe |
|------|---------|
| Repositório **`crypto_vps/binance-proxy/`** | Express, porta default **3046**, `GET /health`, `POST /v1/relay` (repassa pedidos já assinados a `api.binance.com`), rotas protegidas com `Authorization: Bearer`, `POST /v1/ping` (teste) |
| **PM2** na VPS | Processo `binance-proxy` a correr 24h (recomendado: `pm2 save` + `pm2 startup`) |
| **`.env` na VPS** | `BINANCE_PROXY_SECRET` (e `BINANCE_PROXY_PORT` se não for 3046) |
| **DNS** | `crypto.vps-kinghost.net` → IP público da VPS (ex. `187.45.254.5`) |
| **HTTPS** | Nginx + Let’s Encrypt (Certbot); certificado ativo em `https://crypto.vps-kinghost.net` |
| **UFW** | `OpenSSH` + `Nginx Full` (80/443) |
| **Teste público** | `curl https://crypto.vps-kinghost.net/health` → `{"ok":true,"service":"binance-proxy"}` |
| **Binance** | IP da VPS na **whitelist** da API key (para quando o tráfego assinado sair só da VPS) |
| **Segredo** | Acordado guardar **só em env** (não em `AppConfig`) |

---

## Falta implementar — desenvolvimento (PC, `npm run dev`)

| # | O quê | Notas |
|---|--------|--------|
| 1 | **`.env.local`** no projeto `crypto` | `BINANCE_PROXY_URL=https://crypto.vps-kinghost.net` e `BINANCE_PROXY_SECRET=` (igual à VPS) |
| 2 | **Testes** | Uma rota de cada vez (ex. saldos / ligação Binance); confirmar que a Binance vê só o IP da VPS (whitelist) |

**Implementado:** o Next assina em `lib/binance-user-api.ts` como antes; se `BINANCE_PROXY_URL` e `BINANCE_PROXY_SECRET` estiverem definidos, GET/POST/DELETE assinados vão para `POST /v1/relay` na VPS, que só faz `fetch` a `https://api.binance.com` (sem base de dados na VPS para credenciais).

Sem essas envs, o comportamento continua **fetch direto** à Binance (útil se a whitelist incluir o IP do PC em dev).

---

## Falta implementar — produção (Vercel)

| # | O quê | Notas |
|---|--------|--------|
| 1 | **Environment Variables** no projeto Vercel | Mesmas chaves que em `.env.local`: `BINANCE_PROXY_URL`, `BINANCE_PROXY_SECRET` (Production; opcional Preview) |
| 2 | **Deploy** | O código que fizer `fetch` ao proxy sobe com o deploy; não é preciso IP fixo na Vercel |
| 3 | **Smoke test** | Após deploy: fluxo real (ligação Binance, saldo, ordem de teste) com IP só na VPS |

Não há passo extra na Vercel além de **env + código** — o fluxo é o mesmo que em dev, com URL/segredo de produção.

---

## Checklist rápido “proxy completo”

- [x] Proxy na VPS: `POST /v1/relay` repassa pedidos assinados à Binance.
- [x] Next usa relay quando `BINANCE_PROXY_URL` + `BINANCE_PROXY_SECRET` existem (`binance-user-api.ts`).
- [ ] `.env.local` testado em dev (saldos / ligação).
- [ ] Variáveis na Vercel + deploy testado.

---

## URLs e portas de referência

| Recurso | Valor |
|---------|--------|
| URL pública do proxy | `https://crypto.vps-kinghost.net` |
| Node (PM2) na VPS | `0.0.0.0:3046` (default `BINANCE_PROXY_PORT`) |
| Nginx | TLS em 443 → `proxy_pass` para `127.0.0.1:3046` |
