-- Copia dados do schema gotai para backcrypto (ordem respeitando FKs)
-- Enums são convertidos via text para o tipo do schema backcrypto.
-- Executar DEPOIS de backcrypto_schema.sql

-- 1. User (enums: role, tier, userLevel, language)
INSERT INTO backcrypto."User" (
  "id", "emailEnc", "emailIv", "emailTag", "emailSearchHash", "emailVerifiedAt",
  "name", "passwordHash", "specialCodeHash", "specialExpiresAt", "createdAt", "updatedAt",
  "role", "tier", "nickname", "nicknameChanges", "avatarId", "avatarBorder",
  "avatarSkinTone", "avatarColorTone", "sevenPoints", "ganhoSimulado", "userLevel",
  "position", "tmp", "isDeleted", "dataExclusao", "dataExpiracao", "pushToken",
  "pushTokenUpdated", "notifyMegaSena", "notifyLotofacil", "notifyQuina", "hideStatusBar",
  "progress", "language"
)
SELECT
  "id", "emailEnc", "emailIv", "emailTag", "emailSearchHash", "emailVerifiedAt",
  "name", "passwordHash", "specialCodeHash", "specialExpiresAt", "createdAt", "updatedAt",
  "role"::text::backcrypto."Role",
  "tier"::text::backcrypto."Tier",
  "nickname", "nicknameChanges", "avatarId", "avatarBorder",
  "avatarSkinTone", "avatarColorTone", "sevenPoints", "ganhoSimulado",
  "userLevel"::text::backcrypto."UserLevel",
  "position", "tmp", "isDeleted", "dataExclusao", "dataExpiracao", "pushToken",
  "pushTokenUpdated", "notifyMegaSena", "notifyLotofacil", "notifyQuina", "hideStatusBar",
  "progress",
  "language"::text::backcrypto."BioLanguage"
FROM gotai."User"
ON CONFLICT ("id") DO NOTHING;

-- 2. Tabelas que referenciam apenas User
INSERT INTO backcrypto."AccessRequest"
SELECT * FROM gotai."AccessRequest"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO backcrypto."EmailVerificationToken"
SELECT * FROM gotai."EmailVerificationToken"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO backcrypto."PasswordResetToken"
SELECT * FROM gotai."PasswordResetToken"
ON CONFLICT ("tokenHash") DO NOTHING;

INSERT INTO backcrypto."UserCoinWallet"
SELECT * FROM gotai."UserCoinWallet"
ON CONFLICT ("id") DO NOTHING;

-- StripeCheckoutSession (enum: status)
INSERT INTO backcrypto."StripeCheckoutSession" (
  "id", "userId", "status", "amountTotalCents", "currency", "coinsToCredit",
  "pricingLabel", "completedAt", "createdAt"
)
SELECT
  "id", "userId",
  "status"::text::backcrypto."CheckoutStatus",
  "amountTotalCents", "currency", "coinsToCredit", "pricingLabel", "completedAt", "createdAt"
FROM gotai."StripeCheckoutSession"
ON CONFLICT ("id") DO NOTHING;

-- PagarMeOrder (enum: status)
INSERT INTO backcrypto."PagarMeOrder" (
  "id", "userId", "status", "amountTotalCents", "currency", "coinsToCredit",
  "pricingLabel", "qrCode", "qrCodeUrl", "pixCopyPaste", "expiresAt", "completedAt", "createdAt"
)
SELECT
  "id", "userId",
  "status"::text::backcrypto."CheckoutStatus",
  "amountTotalCents", "currency", "coinsToCredit", "pricingLabel",
  "qrCode", "qrCodeUrl", "pixCopyPaste", "expiresAt", "completedAt", "createdAt"
FROM gotai."PagarMeOrder"
ON CONFLICT ("id") DO NOTHING;

-- UserNotification (enum: senderType)
INSERT INTO backcrypto."UserNotification" (
  "idNotification", "senderType", "sender", "userId", "notification", "keySystem",
  "ativo", "createdAt", "updatedAt", "expiredDate"
)
SELECT
  "idNotification",
  "senderType"::text::backcrypto."SenderType",
  "sender", "userId", "notification", "keySystem", "ativo", "createdAt", "updatedAt", "expiredDate"
FROM gotai."UserNotification"
ON CONFLICT ("idNotification") DO NOTHING;

-- BioSimulationQueue (enum: status)
INSERT INTO backcrypto."BioSimulationQueue" (
  "id", "queueName", "userId", "status", "payload", "result", "createdAt"
)
SELECT
  "id", "queueName", "userId",
  "status"::text::backcrypto."BioQueueStatus",
  "payload", "result", "createdAt"
FROM gotai."BioSimulationQueue"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO backcrypto."BioSimulationState"
SELECT * FROM gotai."BioSimulationState"
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO backcrypto."BioSavedConfig"
SELECT * FROM gotai."BioSavedConfig"
ON CONFLICT ("id") DO NOTHING;

-- 3. CoinLedgerEntry (enums: type, source)
INSERT INTO backcrypto."CoinLedgerEntry" (
  "id", "userId", "walletId", "type", "source", "amount", "refId", "meta", "createdAt"
)
SELECT
  "id", "userId", "walletId",
  "type"::text::backcrypto."TxType",
  "source"::text::backcrypto."TxSource",
  "amount", "refId", "meta", "createdAt"
FROM gotai."CoinLedgerEntry"
ON CONFLICT ("id") DO NOTHING;

-- 4. WalletCredit
INSERT INTO backcrypto."WalletCredit"
SELECT * FROM gotai."WalletCredit"
ON CONFLICT ("id") DO NOTHING;

-- 5. Tabelas sem FK para outras tabelas do app
INSERT INTO backcrypto."StripeEvent"
SELECT * FROM gotai."StripeEvent"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO backcrypto."BioAppConfig"
SELECT * FROM gotai."BioAppConfig"
ON CONFLICT ("key") DO NOTHING;
