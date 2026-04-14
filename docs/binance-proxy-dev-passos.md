# Passo a passo: proxy Binance via VPS em **desenvolvimento** (local)

**Estado (feito vs falta):** [`binance-proxy-status.md`](./binance-proxy-status.md)

Objetivo: com `npm run dev` no PC, as rotas que hoje chamam a Binance passarem a ir **primeiro à VPS** (`crypto.vps-kinghost.net`), para a Binance continuar a ver só o **IP fixo da VPS** na whitelist.

Documento irmão (visão geral): [`vercel-vps-binance-proxy.md`](./vercel-vps-binance-proxy.md).

**Segredo do proxy:** `BINANCE_PROXY_SECRET` fica **só em variáveis de ambiente** (`.env.local`, Vercel, ficheiro env na VPS) — **não** em `AppConfig` nem noutra tabela na base de dados.

---

## Pré-requisitos

- [x] VPS Ubuntu com IP público fixo na **lista de IPs** da API key na Binance.
- [x] Domínio **`https://crypto.vps-kinghost.net`** com DNS → VPS + **HTTPS** (Nginx + Let’s Encrypt).
- [x] Firewall (ex.: UFW) com SSH + Nginx (80/443).
- [ ] Código no **Next** + **proxy** a encaminhar chamadas assinadas (ver [status](./binance-proxy-status.md)).

---

## 1. Gerar um segredo partilhado

No PC (PowerShell ou terminal):

```bash
# exemplo: 32 bytes em hex (ajusta o comprimento se quiseres)
openssl rand -hex 32
```

Guarda o valor — será **`BINANCE_PROXY_SECRET`** (igual no `.env.local` e na VPS).

---

## 2. Serviço na VPS (repo `crypto_vps`)

Esqueleto já criado em **`crypto_vps/binance-proxy/`** (Express, `/health`, verificação do `Bearer`, `POST /v1/ping` de teste). Ver `binance-proxy/README.md` nesse repositório.

O processo HTTP(S) na VPS deve:

1. Só aceite pedidos com header de autorização igual ao segredo (ex.: `Authorization: Bearer <BINANCE_PROXY_SECRET>`).
2. Receba o pedido “de negócio” (ex.: body JSON com o que a rota Next já valida).
3. Carregue as credenciais Binance do utilizador (mesma lógica que hoje no Next: Neon / `getUserBinanceCredentials`).
4. Chame `api.binance.com` (assinatura HMAC como em `lib/binance-user-api.ts`).
5. Devolva o JSON da Binance (ou erro) ao cliente.

**Nota:** Este repositório ainda pode não ter esse serviço — este guia é o roteiro; a implementação concreta (Express/Fastify, porta, paths) fica no servidor da VPS.

**Teste rápido sem app Next:** a partir do teu PC (`/health` é **público**, sem Bearer):

```bash
curl -sS https://crypto.vps-kinghost.net/health
```

Com Bearer (rotas protegidas, ex. `/v1/ping`):

```bash
curl -sS -H "Authorization: Bearer SEU_SEGREDO_AQUI" https://crypto.vps-kinghost.net/v1/ping -X POST
```

---

## 3. Variáveis no projeto Next (dev)

Na raiz do projeto `crypto`, cria ou edita **`.env.local`** (não commits — já deve estar no `.gitignore`):

```env
# URL base do proxy na VPS (sem barra final ou com paths — ser consistente no código)
BINANCE_PROXY_URL=https://crypto.vps-kinghost.net

# O mesmo segredo que a VPS valida
BINANCE_PROXY_SECRET=cole_aqui_o_hex_gerado_no_passo_1
```

Reinicia o `npm run dev` depois de alterar `.env.local`.

---

## 4. Alterar o código Next (padrão)

Rotas atuais sob:

`src/app/api/user/binance-connection/`

- `route.ts` (GET ligação)
- `balances/route.ts`
- `order/route.ts`
- `order/cancel/route.ts`
- `orders/route.ts`
- `spot-open-orders/route.ts`
- `trade-fee/route.ts`

**Padrão sugerido:**

1. Se **`BINANCE_PROXY_URL`** e **`BINANCE_PROXY_SECRET`** estiverem definidos, a rota faz **`fetch`** para a VPS com o body necessário + header `Authorization: Bearer ...`, em vez de chamar `binanceSignedGet` / `binanceSignedPost` / `binanceSignedDelete` direto na Binance.
2. Se as variáveis **não** estiverem definidas, mantém o comportamento atual (chamada direta à Binance) — útil enquanto o proxy não está pronto ou em ambientes sem VPS.

Assim, em **dev** com `.env.local` preenchido, tudo passa pela VPS; sem env, continua como hoje.

---

## 5. Ordem sugerida para não bloquear

| Ordem | O quê | Estado |
|-------|--------|--------|
| 1 | VPS **HTTPS** + `/health` | Feito |
| 2 | Rota com **Bearer** (ex. `POST /v1/ping`) | Feito (placeholder) |
| 3 | Proxy a chamar **Binance** de verdade + **uma** rota Next | **Falta** |
| 4 | Testar no browser com sessão logada | **Falta** |
| 5 | Restantes rotas `binance-connection` | **Falta** |

---

## 6. Como validar que “em dev já vai pela VPS”

1. **Logs na VPS:** ao usar a app em `localhost`, vês pedidos a bater no Nginx/serviço.
2. **Binance:** em princípio não vê o IP da tua casa nos pedidos assinados — só o da VPS (se **toda** a ligação assinada passar pelo proxy).
3. Se algo ainda for direto à Binance do Next local, esse pedido sai pelo **teu IP** e pode falhar com restrição de IP — aí falta migrar essa rota.

---

## 7. Problemas comuns

| Sintoma | O quê verificar |
|--------|------------------|
| `fetch` falha com certificado SSL | Certificado válido para `crypto.vps-kinghost.net`, cadeia completa. |
| 401 na VPS | `BINANCE_PROXY_SECRET` igual nos dois lados; header `Authorization` correto. |
| 403 / IP na Binance | Pedido ainda a sair do Next sem proxy; ou IP da VPS não está na whitelist. |
| Timeout | Firewall da VPS; serviço a escutar em `0.0.0.0` ou socket atrás do Nginx. |

---

## 8. Produção (Vercel)

- Repete as mesmas variáveis em **Project → Settings → Environment Variables** (Production [e Preview se quiseres testar]).
- O fluxo é o mesmo: Vercel **não** precisa de IP na Binance; só a **VPS** precisa.

---

## Referência rápida de env

| Variável | Onde |
|----------|------|
| `BINANCE_PROXY_URL` | `.env.local` (dev) e Vercel |
| `BINANCE_PROXY_SECRET` | `.env.local` (dev), Vercel e serviço na VPS |
