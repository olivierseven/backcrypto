# Variáveis de ambiente — uso no projeto BioGenerator

Arquivo de referência: quais variáveis estão em uso no código e quais não aparecem.

---


## Usadas no projeto

| Variável | Onde é usada |
|----------|----------------|
| **BG_DATABASE_URL** | Prisma (schema Bio): `prisma/schema.prisma` e client em `src/lib/prisma-bio-client` |
| **APP_URL** | `src/app/api/checkout/route.ts` — URLs de success/cancel do Stripe |
| **NEXT_PUBLIC_APP_URL** | `src/app/BioLoginForm.tsx` — redirecionamento pós-login |
| **JWT_SECRET** | Login, conta, historico, plans, API auth, checkout, notificações, user, wallet, simulacao |
| **JWT_COOKIE_NAME** | Mesmos arquivos que usam JWT_SECRET |
| **NODE_ENV** | `api/auth/login/route.ts`, `api/simulacao/run/route.ts`, `lib/bio-db.ts`, `lib/logger.ts` |
| **EMAIL_ENC_KEY_B64** | `src/lib/crypto.ts` — criptografia de e-mail |
| **DEBUG_LOGS** | `src/app/api/simulacao/run/route.ts`, `src/lib/simulacao-genesis.ts` |
| **STRIPE_SECRET_KEY** | `api/checkout/route.ts`, `api/webhooks/stripe/route.ts` |
| **PRICE_COINS_7** | `api/checkout/route.ts` |
| **PRICE_COINS_49** | `api/checkout/route.ts` |
| **STRIPE_WEBHOOK_SECRET** | `api/webhooks/stripe/route.ts` |
| **PAGARME_SECRET_KEY** | `api/checkout-pix/route.ts` |
| **PAGARME_ACCOUNT_ID** | `api/checkout-pix/route.ts` |
| **PAGARME_WEBHOOK_USER** | `api/webhooks/pagarme/route.ts` |
| **PAGARME_WEBHOOK_PASSWORD** | `api/webhooks/pagarme/route.ts` |
| **PIX_TEST_AMOUNT_BRL_CENTS** | `api/checkout-pix/route.ts` (opcional; override valor teste PIX) |
| **BG_USD_BRL_CACHE_HOURS** | `src/lib/usd-brl-rate.ts` (opcional) |
| **BG_USD_TO_BRL_RATE** | `src/lib/usd-brl-rate.ts` (opcional) |
| **RESEND_API_KEY** | `src/lib/mailer.ts` — envio de e-mail de verificação (cadastro) |
| **MAIL_FROM** | `src/lib/mailer.ts` — remetente dos e-mails (opcional) |
| **MAIL_REPLY_TO** | `src/lib/mailer.ts` — resposta dos e-mails (opcional) |
| **UNVERIFIED_TTL_HOURS** | `src/app/api/auth/register/route.ts` — limpeza de contas não verificadas (padrão 24) |
| **GOOGLE_CLIENT_ID** | `src/app/api/auth/google/start/route.ts`, `callback/route.ts` — OAuth Google |
| **GOOGLE_CLIENT_SECRET** | `src/app/api/auth/google/callback/route.ts` — OAuth Google |
| **SITE_MAINTENANCE** | `src/app/(auth)/login/page.tsx`, `register/page.tsx`, `reset-password/page.tsx` — quando `"1"`, exibe tela de manutenção. |
| **MAINTENANCE_BYPASS_PASSWORD** | `src/lib/maintenance-bypass.ts`, `src/app/api/maintenance-bypass/route.ts` — senha para liberar acesso durante a manutenção (cookie 24h). Opcional. |
| **AUTH_PUBLIC_ORIGIN** | `src/lib/redirect-origin.ts` — origem usada no OAuth quando atrás de proxy (ex.: `https://sevencoins.com.br`). Opcional; em produção evita “Connection failed” se o proxy não enviar `X-Forwarded-Host`. |

**Google Cloud Console (OAuth):**

- **Redirect URI autorizado:** cadastre exatamente a URL de callback, por exemplo:
  - `https://sevencoins.com.br/biogenerator/api/auth/google/callback` (acesso pelo domínio customizado)
  - e/ou `https://biogenerator-three.vercel.app/biogenerator/api/auth/google/callback` (acesso direto na Vercel)
- **Domínios autorizados** (tela de consentimento): inclua todos os domínios em que o app é acessado, por exemplo:
  - `sevencoins.com.br`
  - `biogenerator-three.vercel.app`
  - `sevencoins.vercel.app` (se usar)
- Configuração: [Google Cloud Console → APIs e serviços → Credenciais → cliente OAuth 2.0](https://console.cloud.google.com/apis/credentials)

---


## Não usadas no código do BioGenerator

- **DATABASE_URL** — o projeto usa apenas **BG_DATABASE_URL**
- **RESEND_API_KEY**, **MAIL_FROM**, **MAIL_REPLY_TO**, **MAIL_CONTACT**
- **ADMIN_EMAIL**, **EMAIL_VERIFICATION_TOKEN_TTL_MIN**, **JWT_EXPIRES_DAYS**, **SECURE_COOKIES**
- **STRIPE_SECRET_KEY**, **PRICE_COINS_700**, **PRICE_COINS_4900**, **STRIPE_WEBHOOK_SECRET** (são do app principal; no Bio só os **BG_***)
- **UNVERIFIED_TTL_HOURS**
- **NEXT_PUBLIC_SHOW_COOKIE_BANNER**
- **NEXT_PUBLIC_ADS_MODE**, **NEXT_PUBLIC_ADS_CLIENT**, **NEXT_PUBLIC_ADS_SLOT_*****, **NEXT_PUBLIC_ADS_TEST**
- **ERBI_API_KEY**, **GEMINI_***, **SUMMARIZER_ENGINE**, **NEXT_PUBLIC_ERBI_API_KEY**
- **CRON_SECRET**
- **FIREBASE_PROJECT_ID**, **FIREBASE_SERVICE_ACCOUNT_JSON**
- **BLOB_READ_WRITE_TOKEN**, **NEXT_PUBLIC_NEWS_IMAGES_BASE_URL**

*(Busca feita em `src/`. Variáveis usadas só em scripts, Vercel ou outro app do monoreto podem não constar aqui.)*

---

## Resumo

- **Obrigatórias para o Bio:** BG_DATABASE_URL, JWT_SECRET, JWT_COOKIE_NAME, EMAIL_ENC_KEY_B64, APP_URL, NEXT_PUBLIC_APP_URL; RESEND_API_KEY (para e-mail de verificação no cadastro); e as STRIPE_* / PAGARME_* se usar Stripe/Pagar.me.
- **Opcionais:** DEBUG_LOGS, BG_USD_BRL_CACHE_HOURS, BG_USD_TO_BRL_RATE, NODE_ENV.
- **Não usadas neste projeto:** DATABASE_URL e toda a lista "Não usadas" acima (podem ser do app principal Seven Coins ou de outro serviço).
