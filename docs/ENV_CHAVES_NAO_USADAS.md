# Chaves do .env — uso no BioGenerator

Verificação feita por busca em `src/` e `prisma/`.

---

## Das variáveis que você declarou (lista recente)

**Todas são usadas no código do Bio.**

FIREBASE_PROJECT_ID e FIREBASE_SERVICE_ACCOUNT_JSON são usadas em `src/lib/push-notification.ts` (mesmas variáveis do SevenCoins). As demais da sua lista (BG_DATABASE_URL, APP_URL, NEXT_PUBLIC_APP_URL, JWT_*, EMAIL_ENC_KEY_B64, RESEND_API_KEY, MAIL_FROM, MAIL_REPLY_TO, STRIPE_* (ex-BG_STRIPE_*), UNVERIFIED_TTL_HOURS, SITE_MAINTENANCE, DEBUG_LOGS, NODE_ENV, GOOGLE_CLIENT_*, PAGARME_*, PIX_TEST_AMOUNT_BRL_CENTS) **estão em uso**.

---

## Outras chaves que às vezes aparecem no .env e não são usadas no Bio

| Chave | Observação |
|-------|------------|
| **DATABASE_URL** | O projeto usa apenas **BG_DATABASE_URL** (Prisma Bio). |
| **JWT_EXPIRES_DAYS**, **SECURE_COOKIES**, **ADMIN_EMAIL**, **EMAIL_VERIFICATION_TOKEN_TTL_MIN**, **MAIL_CONTACT**, **MAINT_BYPASS_TOKEN**, **CRON_SECRET** | Não referenciadas no código. |
| **BLOB_READ_WRITE_TOKEN**, **NEXT_PUBLIC_NEWS_IMAGES_BASE_URL** | Não referenciadas no código. |

**Observação:** Algumas podem ser usadas por outros apps (ex.: Seven Coins principal), por scripts ou pela Vercel. Remover do `.env` só se tiver certeza de que não são necessárias em nenhum contexto.
