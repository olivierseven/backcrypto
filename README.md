# Crypto Strategy (backcrypto)

App **Crypto Strategy** — Next.js com `basePath` `/crypto` em sevencoins.com.br (Capacitor Android: `com.sevencoins.cryptostrategy`).

## Desenvolvimento

```bash
npm install
npx prisma generate
npm run dev
```

Acesse: **http://localhost:3004/crypto/**

## App Android (Capacitor)

- `capacitor.config.ts`: `appId` = `com.sevencoins.cryptostrategy`
- Deep link OAuth: `cryptostrategy://oauth`
- Após mudar Capacitor: `npm run cap:sync:android`
- **Firebase:** no console, adicione app Android com o package acima e substitua `android/app/google-services.json` pelo arquivo gerado.

## Variáveis de ambiente

Copie do `.env` de referência ou defina (ver `docs/ENV_VARS_USO.md`):

- `DATABASE_URL` / Prisma
- `JWT_SECRET`, `JWT_COOKIE_NAME`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (redirect URI: `https://sevencoins.com.br/crypto/api/auth/google/callback`)
- Stripe / Pagar.me conforme uso

## Deploy

1. Push para o repo **backcrypto**
2. Vercel (ou CI) com `NEXT_PUBLIC_SITE_URL` / URLs de produção
3. Domínio: rotas em **`/crypto/...`**

## Crédito de coins e webhooks

Ver secções no histórico do README sobre Stripe CLI (`stripe listen --forward-to localhost:3004/crypto/api/webhooks/stripe`) e Pagar.me em túnel se necessário.
