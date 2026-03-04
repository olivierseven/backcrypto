# BioGenerator

App BioGenerator — projeto separado (Multi-Zone com sevencoins.com.br).

## Desenvolvimento

```bash
npm install
npx prisma generate
npm run dev
```

Acesse: http://localhost:3002/bioGenerator

## Teste com auth

O login posta em `/api/auth/login` (app principal). Para testar o Bio sozinho:

1. Rode o sevencoins na 3000: `cd .. && npm run dev`
2. No biogenerator .env, adicione: `NEXT_PUBLIC_APP_URL=http://localhost:3000`
3. Rode o Bio na 3002: `npm run dev`
4. Acesse http://localhost:3002/bioGenerator/login

Ou teste via sevencoins: http://localhost:3000/bioGenerator (com rewrites configurados).

## Variáveis de ambiente

Copie do projeto principal ou defina:

- BG_DATABASE_URL
- JWT_SECRET, JWT_COOKIE_NAME
- EMAIL_ENC_KEY_B64
- APP_URL
- EMAIL_APP_URL (opcional; URL usada em links de e-mails de recibo; se não definida, em localhost usa https://sevencoins.com.br para coincidir com o domínio de envio)
- BG_STRIPE_SECRET_KEY, BG_PRICE_COINS_7, BG_PRICE_COINS_49, BG_STRIPE_WEBHOOK_SECRET
- BG_PAGARME_SECRET_KEY, BG_PAGARME_WEBHOOK_USER, BG_PAGARME_WEBHOOK_PASSWORD, BG_PAGARME_ACCOUNT_ID

## Crédito de coins e e-mail de recibo após pagamento

Os coins são creditados e o **e-mail de recibo** é enviado **somente quando o webhook** do provedor de pagamento é processado. Se você pagou e não recebeu coins nem e-mail, em geral o webhook não foi chamado (ex.: em localhost o Stripe não acessa sua máquina).

**Caso comum:** você roda o app em localhost, paga no Stripe e volta para `/sistema?status=success`, mas o saldo não muda. No dashboard do Stripe o webhook está apontando para a **URL de produção** (ex.: `https://sevencoins.com.br/...`). O Stripe chama essa URL e o crédito vai para o **banco de produção**. Para ver os coins no seu ambiente local, use `stripe listen` (abaixo) para o webhook bater no localhost, ou use o mesmo `BG_DATABASE_URL` da produção ao testar localmente.

### Stripe (cartão)

O fluxo é o mesmo do sevencoins: crédito e recibo ocorrem no webhook `checkout.session.completed`. Em produção o Stripe chama a URL configurada no dashboard; em localhost use o CLI abaixo.

Para testar checkout em local e ver os coins na conta:

1. Instale o [Stripe CLI](https://stripe.com/docs/stripe-cli).
2. Em um terminal: `stripe listen --forward-to localhost:3002/biogenerator/api/webhooks/stripe`
3. O CLI exibe um **webhook signing secret** (ex.: `whsec_...`). No `.env` do biogenerator, use **esse mesmo valor** em `BG_STRIPE_WEBHOOK_SECRET`.
4. **Importante:** cada vez que você inicia o `stripe listen`, o CLI gera um **novo** secret. Se você reiniciar o CLI, copie de novo o `whsec_...` para o `.env` e reinicie o servidor do app (npm run dev), senão o webhook falha com "Invalid signature" e os coins não são creditados.
5. Rode o app na 3002 e faça um pagamento de teste; o CLI encaminha o evento e o webhook credita os coins e envia o e-mail de recibo. No terminal do CLI você verá o evento recebido; no terminal do app, algo como `[bio/stripe] credited coins=...`.

### PIX (Pagar.me)

O webhook do Pagar.me precisa de uma URL acessível pela internet. Em localhost use um túnel (ex.: ngrok) apontando para a rota do webhook, ou teste em ambiente deployado.

## Deploy

1. Push para o repo biogenerator
2. Vercel: import e deploy
3. No sevencoins: adicionar rewrites para /bioGenerator e /api/bioGenerator/*
