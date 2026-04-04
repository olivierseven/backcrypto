# Comunicação Vercel ↔ VPS (proxy Binance) + IP da VPS

**Estado (feito vs falta):** [`binance-proxy-status.md`](./binance-proxy-status.md)

Guia em passos para perceber o fluxo e preparar produção quando a **API key da Binance** só aceita pedidos a partir de **IPs na lista confiáveis** (e a Vercel não tem IP fixo por defeito).

**URL do proxy em produção (VPS):** `https://crypto.vps-kinghost.net`

---

## 1. Ideia geral

| Onde | O quê |
|------|--------|
| **Browser** | Chama só a tua app na Vercel (`/api/...`), com login (cookie/sessão). |
| **Vercel (Serverless)** | Valida o utilizador, monta o pedido e faz **`fetch` HTTPS para a VPS**. |
| **VPS (Ubuntu)** | Valida um **segredo** partilhado, usa as credenciais Binance do utilizador e chama **`api.binance.com`**. |
| **Binance** | Na lista de IPs confiáveis entra **só o IP público da VPS** (não o da Vercel). |

O utilizador **nunca** liga diretamente à VPS no browser; só servidor com servidor.

---

## 2. Como ver o IP da VPS (Ubuntu)

Há dois conceitos: **IP privado** (rede interna do datacenter) e **IP público** (o que a internet vê e o que a Binance quer na whitelist).

### 2.1 IP público (o que importa para a Binance)

Na VPS, em SSH:

```bash
curl -4 ifconfig.me
```

ou

```bash
curl -4 https://api.ipify.org
```

Mostra o **IPv4 público** de saída. É este (ou estes, se o provider der vários) que deves **registar na Binance** → API Management → Restrições de IP.

### 2.2 IPs configurados na máquina (referência)

```bash
ip -4 addr show
```

ou

```bash
hostname -I
```

O **primeiro** costuma ser o privado; o público confirma-se com `curl ifconfig.me` ou no **painel do provider** (Hetzner, DigitalOcean, AWS, etc.) — lá costuma aparecer “Public IPv4”.

### 2.3 IPv6

Se a Binance e o teu fluxo usarem só IPv4, garante regras e whitelist em **IPv4**. Se usares IPv6, a Binance pode pedir entrada separada; lê a documentação atual da Binance.

---

## 3. O que configurar na Vercel

1. **Variáveis de ambiente** (Production), por exemplo:

   - `BINANCE_PROXY_URL` = `https://crypto.vps-kinghost.net`  
     (URL base do serviço na VPS, **HTTPS**.)
   - `BINANCE_PROXY_SECRET` = uma string longa e aleatória (a mesma que vais guardar na VPS).

2. **No código** (Route Handler que hoje chama a Binance direto): em vez de `fetch` para `api.binance.com`, fazes `fetch` para:

   `process.env.BINANCE_PROXY_URL + "/caminho"`  

   com header tipo:

   `Authorization: Bearer <BINANCE_PROXY_SECRET>`  

   (ou outro nome de header, desde que VPS e Vercel coincidam.)

3. **Nunca** expor `BINANCE_PROXY_SECRET` ao browser — só `process.env` no servidor.

---

## 4. O que configurar na VPS (Ubuntu)

1. **Domínio + HTTPS**  
   - Subdomínio (ex.: `crypto.vps-kinghost.net`) a apontar para o **IP público** da VPS.  
   - **Let’s Encrypt** (Nginx + certbot) para TLS — **feito** na VPS atual.

2. **Serviço HTTP** (Node, Bun, etc.) que escute em `127.0.0.1` e o Nginx/Caddy faça reverse proxy para `https`, **ou** escuta direto em TLS com certificado.

3. **Middleware de segurança**  
   - Se o header `Authorization` (ou o que escolheres) não bater com o segredo → resposta **401**.  
   - Opcional: rate limit, timeout curto.

4. **Lógica**  
   - Recebe o pedido da Vercel (ex.: `userId`, `symbol`, `side`, tipo de ordem).  
   - Carrega credenciais Binance do utilizador (como já fazes hoje, ex. na Neon).  
   - Assina e chama a Binance; devolve JSON à Vercel.

5. **Firewall (opcional mas recomendado)**  
   - `ufw allow 22` (SSH)  
   - `ufw allow 80,443/tcp` (HTTP/HTTPS)  
   - `ufw enable`  

   Não é obrigatório “só IP da Vercel” na firewall — os IPs de saída da Vercel mudam; o segredo forte é o principal.

---

## 5. Lista de IPs na Binance

1. Obtém o IP público com `curl -4 ifconfig.me` (ou painel do provider).  
2. Binance → **API Management** → chave → **Restrições de IP** → adiciona esse IP (e mais algum se o provider tiver IP failover).  
3. Mantém **Leitura** e **Spot/Margin trading** conforme precisares; **levantamentos** desligados se não for preciso.

---

## 6. Ordem sugerida para testar

1. ~~Na VPS: serviço mínimo que responde `GET /health` com 200.~~ **Feito**  
2. ~~Testa `curl` **HTTPS** com domínio válido.~~ **Feito** (`https://crypto.vps-kinghost.net/health`)  
3. ~~Rota protegida pelo segredo (`POST /v1/ping`).~~ **Feito** (placeholder)  
4. **Falta:** proxy a chamar a Binance de verdade; IP na Binance já deve estar na whitelist.  
5. **Falta:** env na Vercel + código Next a usar o proxy; teste end-to-end em produção/preview.

---

## 7. Fila na base de dados

**Não é obrigatória** só para o IP fixo. Serve para tarefas **assíncronas** (retries, histórico pesado). O caminho principal pode ser **só HTTP síncrono**: Vercel → VPS → Binance → resposta.

---

## 8. Resumo numa frase

**Vercel** autentica o user e chama **HTTPS para a VPS** com um **segredo**; a **VPS** tem o **IP na Binance** e é a única que fala com `api.binance.com` para essas operações.

---

## Referências úteis

- [Vercel: Environment Variables](https://vercel.com/docs/projects/environment-variables)  
- [Binance: API Management](https://www.binance.com/en/my/settings/api-management) (UI pode mudar)
