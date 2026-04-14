# Plano: feed Binance no VPS + WebSocket próprio + DNS na Vercel

Visão geral: **um processo no VPS** mantém ligação(ns) ao WebSocket da Binance (`aggTrade`, como em `src/app/(dev)/dev/ticks/page.tsx`), normaliza e **replica** para clientes via **WebSocket no teu domínio**. O Next na Vercel usa `wss://…` (env); histórico vem do **banco/cache**.

**Escala planeada:** ~**25 moedas** em simultâneo no servidor; por moeda: **até 500** linhas nas tabelas agregadas em memória (Renko/Range) + **até ~1000** linhas de log bruto recente (só no VPS). **Teto agregado em memória:** 25 × (500 + 1000) = **37 500 linhas** — referência para RAM. Os **500** são teto de **janela de trabalho** no serviço, não o que se envia ao browser.

**Cliente — três camadas:** (1) **cache/banco** via API — carrega a maior parte do histórico agregado; (2) **o que falta** entre o último ponto do cache e o “agora” (REST curto ou snapshot mínimo no `subscribe`); (3) **WebSocket** — só **vivo**: deltas (barra em formação, barra que fechou, etc.). Na prática o WS transporta **muito menos** que 500 linhas por sessão; o grosso vem sempre do cache.

**Código no repo:** pasta `vps/` — pacote Node autocontido para o que sobe ao servidor (ver `vps/README.md`). A UI de produção liga-se a partir da área **sys**; `dev` é só laboratório.

---

## 1. VPS (Ubuntu)

- Atualizar sistema; criar utilizador dedicado (opcional) para o serviço.
- Instalar **Node.js LTS** (via [NodeSource](https://github.com/nodesource/distributions) ou `nvm`).
- Clonar ou fazer deploy do código do serviço (repo privado, `rsync`, CI, etc.).
- `npm install` / `pnpm install` na pasta do serviço.
- Testar em foreground: `node dist/index.js` (ou equivalente).

---

## 2. Serviço Node no VPS

**Entrada (upstream):** Binance Spot — idealmente **uma** ligação WebSocket com **vários streams combinados** (ex. até ~25× `symbol@aggTrade` no mesmo URL `…/stream?streams=btcusdt@aggTrade/ethusdt@aggTrade/…`), em vez de 25 ligações separadas, para respeitar limites e simplificar reconexão.

**Lógica:** por moeda, o mesmo pipeline que na página dev — parse (`p`, `q`, `T`, `m`, símbolo no payload); agregações Renko / Range / Kagi com **cap de 500 linhas** por moeda (descartar as mais antigas).

**Saída (downstream):** servidor WebSocket (ex. `ws`) na porta local. Modelo recomendado: **subscrição por símbolo** — o cliente declara qual moeda está a ver; o servidor envia **apenas** eventos da **tabela agregada** dessa moeda (não o fan-out bruto das 25 `aggTrade` para todos). Trocar de moeda = nova subscrição ou mensagem `subscribe`/`unsubscribe`.

**Boas práticas:** reconexão à Binance com backoff; **re-subscrever** os 25 streams após reconnect; deduplicar por `a` (agg trade id) por símbolo se fizer sentido.

**Persistência (Postgres):** só gravar **linhas já agrupadas** (barra Renko / Range / Kagi **fechada**), nas tabelas `BinanceRenkoFast`, `BinanceRangeFast`, `BinanceKagiFast` (intervalo `5ticks`, alinhado ao `BRICK_TICK_UNITS` do serviço). No repositório, a página dev já usa **`DATABASE_URL`** via API `POST /crypto/api/dev/agg-fast-bars` (rotas dev); no VPS o padrão é o **mesmo**: Prisma (ou SQL) com a mesma connection string e a mesma lógica de buffer + intervalo. **Buffer em memória** + **flush periódico** para não sobrecarregar o banco:

- **Intervalo mínimo entre flushes:** **7000 ms** (7 s) por defeito no serviço (`FLUSH_INTERVAL_MS`, alinhado à página dev/ticks). A cada tick do timer, se existir pelo menos uma linha pendente, faz `createMany` (ou batch SQL) com todas as barras acumuladas desde o último flush.
- **Opcional:** flush extra se o buffer ultrapassar um teto (ex. 100–200 linhas) para não deixar RAM crescer em picos — o **atraso típico** de persistência continua dominado pelo intervalo configurado em condições normais.

---

## 3. Processo persistente e rede

- **systemd** (`/etc/systemd/system/sevencoins-stream.service`): `Restart=always`, `User`, `WorkingDirectory`, `ExecStart`.
- **Firewall** (ufw): abrir só SSH + **443** (se Nginx terminar TLS) ou a porta interna se for só rede privada (não é o caso típico).
- **Nginx** (ou Caddy) na frente: `proxy_pass` HTTP para `127.0.0.1:3044` com headers `Upgrade` e `Connection` para WebSocket; TLS na porta 443 com **Let’s Encrypt** (certbot).

---

## 4. Domínio (Vercel DNS)

- No **Registro.br** os NS já são `ns1/ns2.vercel-dns.com` → DNS gerido na **Vercel**.
- Na Vercel: **Domains** → `sevencoins.com.br` → adicionar registo **A** para o subdomínio escolhido (ex. `stream.sevencoins.com.br`) → **IP público do VPS**.
- O certificado do **browser** para `wss://stream.sevencoins.com.br` fica no **Nginx/Caddy do VPS** (não no projeto Vercel).

---

## 5. Aplicação Next (Vercel)

- Variável de ambiente, ex.: `NEXT_PUBLIC_WS_STREAM_URL=wss://stream.sevencoins.com.br` (ou nome que combinarem).
- Fluxo do gráfico: **REST/cache** para histórico + eventual **REST** (ou mensagem única) para o **intervalo em falta**; **WS** só para **tempo real** após alinhar o cursor. Subscrição por moeda; no wire, sobretudo **deltas** — bem menos de 500 linhas.
- CORS / `Origin`: validar no servidor WS se for só para o teu site.

---

## 6. Ordem sugerida

1. Script mínimo: **combined stream** com 2–3 moedas na Binance + `console.log`.  
2. Generalizar para ~25 streams; estado por moeda com **máx. 500 linhas**.  
3. Servidor WS próprio + **subscrição por símbolo** (payload = atualizações da tabela agregada, não broadcast bruto das 25 moedas).  
4. Nginx + TLS + subdomínio na Vercel DNS.  
5. systemd.  
6. Next: env `wss` + cliente a subscrever a moeda ativa.  
7. Persistência: buffer de barras fechadas + flush (ex. **≥ 7000 ms**) para todas as tabelas *Fast* e atualização de `BinanceKlineCache2` (como no serviço em `vps/`).  
8. Depois: auth, métricas, limite de clientes por IP/sessão.

---

## 7. Referência no repo

- Comportamento de referência do stream: `src/app/(dev)/dev/ticks/page.tsx` (parse, `aggTrade`).

Este ficheiro é um guia de alto nível; comandos exatos (certbot, bloco Nginx) ficam para o momento da implementação no servidor.
