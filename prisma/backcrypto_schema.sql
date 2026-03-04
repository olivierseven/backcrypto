-- Schema backcrypto — mesmas tabelas e enums do gotai
-- Executar com: psql $GT_DATABASE_URL -f prisma/backcrypto_schema.sql

CREATE SCHEMA IF NOT EXISTS backcrypto;

-- Enums
CREATE TYPE backcrypto."Role" AS ENUM ('user', 'admin');
CREATE TYPE backcrypto."BioLanguage" AS ENUM ('en', 'pt');
CREATE TYPE backcrypto."Tier" AS ENUM ('free', 'plus', 'lite');
CREATE TYPE backcrypto."UserLevel" AS ENUM ('RECRUTA', 'APRENDIZ', 'EXPLORADOR', 'JOGADOR', 'AVANCADO', 'ESPECIALISTA', 'MESTRE', 'ELITE', 'LENDARIO', 'SUPREMO', 'MITICO', 'CELESTIAL', 'DIVINO');
CREATE TYPE backcrypto."TxType" AS ENUM ('CREDIT', 'DEBIT', 'ADJUSTMENT');
CREATE TYPE backcrypto."TxSource" AS ENUM ('STRIPE', 'PAGARME', 'SPEND', 'REFUND', 'ADMIN', 'EXPIRATION', 'BONUS', 'PRIZE');
CREATE TYPE backcrypto."CheckoutStatus" AS ENUM ('CREATED', 'COMPLETED', 'REFUNDED', 'CANCELED', 'PARTIALLY_REFUNDED', 'OVER_LIMIT');
CREATE TYPE backcrypto."SenderType" AS ENUM ('system', 'user');
CREATE TYPE backcrypto."BioQueueStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED');

-- User
CREATE TABLE backcrypto."User" (
    "id" TEXT NOT NULL,
    "emailEnc" TEXT NOT NULL,
    "emailIv" TEXT NOT NULL,
    "emailTag" TEXT NOT NULL,
    "emailSearchHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "specialCodeHash" TEXT,
    "specialExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" backcrypto."Role" NOT NULL DEFAULT 'user',
    "tier" backcrypto."Tier" NOT NULL DEFAULT 'free',
    "nickname" TEXT,
    "nicknameChanges" INTEGER NOT NULL DEFAULT 0,
    "avatarId" INTEGER NOT NULL DEFAULT 1,
    "avatarBorder" TEXT NOT NULL DEFAULT 'white',
    "avatarSkinTone" INTEGER,
    "avatarColorTone" INTEGER,
    "sevenPoints" INTEGER NOT NULL DEFAULT 0,
    "ganhoSimulado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "userLevel" backcrypto."UserLevel" NOT NULL DEFAULT 'RECRUTA',
    "position" INTEGER,
    "tmp" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "dataExclusao" TIMESTAMP(3),
    "dataExpiracao" TIMESTAMP(3),
    "pushToken" TEXT,
    "pushTokenUpdated" TIMESTAMP(3),
    "notifyMegaSena" BOOLEAN NOT NULL DEFAULT true,
    "notifyLotofacil" BOOLEAN NOT NULL DEFAULT true,
    "notifyQuina" BOOLEAN NOT NULL DEFAULT true,
    "hideStatusBar" BOOLEAN NOT NULL DEFAULT true,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "language" backcrypto."BioLanguage" NOT NULL DEFAULT 'en',
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_emailSearchHash_key" ON backcrypto."User"("emailSearchHash");
CREATE UNIQUE INDEX "User_nickname_key" ON backcrypto."User"("nickname");

-- AccessRequest
CREATE TABLE backcrypto."AccessRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccessRequest_userId_status_idx" ON backcrypto."AccessRequest"("userId", "status");
ALTER TABLE backcrypto."AccessRequest" ADD CONSTRAINT "AccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES backcrypto."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmailVerificationToken
CREATE TABLE backcrypto."EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON backcrypto."EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_idx" ON backcrypto."EmailVerificationToken"("userId");
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON backcrypto."EmailVerificationToken"("expiresAt");
ALTER TABLE backcrypto."EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES backcrypto."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PasswordResetToken
CREATE TABLE backcrypto."PasswordResetToken" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("tokenHash")
);
CREATE INDEX "PasswordResetToken_userId_idx" ON backcrypto."PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON backcrypto."PasswordResetToken"("expiresAt");
ALTER TABLE backcrypto."PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES backcrypto."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UserCoinWallet
CREATE TABLE backcrypto."UserCoinWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserCoinWallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserCoinWallet_userId_key" ON backcrypto."UserCoinWallet"("userId");
CREATE INDEX "UserCoinWallet_userId_idx" ON backcrypto."UserCoinWallet"("userId");
ALTER TABLE backcrypto."UserCoinWallet" ADD CONSTRAINT "UserCoinWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES backcrypto."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CoinLedgerEntry
CREATE TABLE backcrypto."CoinLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" backcrypto."TxType" NOT NULL,
    "source" backcrypto."TxSource" NOT NULL,
    "amount" INTEGER NOT NULL,
    "refId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinLedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CoinLedgerEntry_userId_createdAt_idx" ON backcrypto."CoinLedgerEntry"("userId", "createdAt");
CREATE INDEX "CoinLedgerEntry_walletId_createdAt_idx" ON backcrypto."CoinLedgerEntry"("walletId", "createdAt");
CREATE INDEX "CoinLedgerEntry_source_createdAt_idx" ON backcrypto."CoinLedgerEntry"("source", "createdAt");
CREATE UNIQUE INDEX "CoinLedgerEntry_source_refId_key" ON backcrypto."CoinLedgerEntry"("source", "refId");
ALTER TABLE backcrypto."CoinLedgerEntry" ADD CONSTRAINT "CoinLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES backcrypto."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE backcrypto."CoinLedgerEntry" ADD CONSTRAINT "CoinLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES backcrypto."UserCoinWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WalletCredit
CREATE TABLE backcrypto."WalletCredit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "consumed" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WalletCredit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WalletCredit_entryId_key" ON backcrypto."WalletCredit"("entryId");
CREATE INDEX "WalletCredit_userId_expiresAt_idx" ON backcrypto."WalletCredit"("userId", "expiresAt");
CREATE INDEX "WalletCredit_userId_createdAt_idx" ON backcrypto."WalletCredit"("userId", "createdAt");
ALTER TABLE backcrypto."WalletCredit" ADD CONSTRAINT "WalletCredit_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES backcrypto."CoinLedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE backcrypto."WalletCredit" ADD CONSTRAINT "WalletCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES backcrypto."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- StripeEvent
CREATE TABLE backcrypto."StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StripeEvent_type_idx" ON backcrypto."StripeEvent"("type");

-- StripeCheckoutSession
CREATE TABLE backcrypto."StripeCheckoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" backcrypto."CheckoutStatus" NOT NULL DEFAULT 'CREATED',
    "amountTotalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "coinsToCredit" INTEGER NOT NULL,
    "pricingLabel" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StripeCheckoutSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StripeCheckoutSession_userId_status_idx" ON backcrypto."StripeCheckoutSession"("userId", "status");
CREATE INDEX "StripeCheckoutSession_userId_completedAt_idx" ON backcrypto."StripeCheckoutSession"("userId", "completedAt");
CREATE INDEX "StripeCheckoutSession_completedAt_idx" ON backcrypto."StripeCheckoutSession"("completedAt");
ALTER TABLE backcrypto."StripeCheckoutSession" ADD CONSTRAINT "StripeCheckoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES backcrypto."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PagarMeOrder
CREATE TABLE backcrypto."PagarMeOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" backcrypto."CheckoutStatus" NOT NULL DEFAULT 'CREATED',
    "amountTotalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "coinsToCredit" INTEGER NOT NULL,
    "pricingLabel" TEXT NOT NULL,
    "qrCode" TEXT,
    "qrCodeUrl" TEXT,
    "pixCopyPaste" TEXT,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PagarMeOrder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PagarMeOrder_userId_status_idx" ON backcrypto."PagarMeOrder"("userId", "status");
CREATE INDEX "PagarMeOrder_userId_completedAt_idx" ON backcrypto."PagarMeOrder"("userId", "completedAt");
CREATE INDEX "PagarMeOrder_completedAt_idx" ON backcrypto."PagarMeOrder"("completedAt");
CREATE INDEX "PagarMeOrder_status_idx" ON backcrypto."PagarMeOrder"("status");
ALTER TABLE backcrypto."PagarMeOrder" ADD CONSTRAINT "PagarMeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES backcrypto."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UserNotification
CREATE TABLE backcrypto."UserNotification" (
    "idNotification" TEXT NOT NULL,
    "senderType" backcrypto."SenderType" NOT NULL,
    "sender" TEXT,
    "userId" TEXT NOT NULL,
    "notification" TEXT NOT NULL,
    "keySystem" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiredDate" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("idNotification")
);
CREATE INDEX "UserNotification_userId_idx" ON backcrypto."UserNotification"("userId");
CREATE INDEX "UserNotification_ativo_idx" ON backcrypto."UserNotification"("ativo");
CREATE INDEX "UserNotification_expiredDate_idx" ON backcrypto."UserNotification"("expiredDate");
ALTER TABLE backcrypto."UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES backcrypto."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BioAppConfig
CREATE TABLE backcrypto."BioAppConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BioAppConfig_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "BioAppConfig_key_idx" ON backcrypto."BioAppConfig"("key");

-- BioSimulationQueue
CREATE TABLE backcrypto."BioSimulationQueue" (
    "id" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" backcrypto."BioQueueStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BioSimulationQueue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BioSimulationQueue_queueName_status_idx" ON backcrypto."BioSimulationQueue"("queueName", "status");
CREATE INDEX "BioSimulationQueue_userId_createdAt_idx" ON backcrypto."BioSimulationQueue"("userId", "createdAt");
ALTER TABLE backcrypto."BioSimulationQueue" ADD CONSTRAINT "BioSimulationQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES backcrypto."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BioSimulationState
CREATE TABLE backcrypto."BioSimulationState" (
    "userId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "mapDisplayByYear" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BioSimulationState_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE backcrypto."BioSimulationState" ADD CONSTRAINT "BioSimulationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES backcrypto."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BioSavedConfig
CREATE TABLE backcrypto."BioSavedConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "private" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "mapDisplayByYear" JSONB,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BioSavedConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BioSavedConfig_name_key" ON backcrypto."BioSavedConfig"("name");
CREATE INDEX "BioSavedConfig_userId_idx" ON backcrypto."BioSavedConfig"("userId");
CREATE INDEX "BioSavedConfig_private_idx" ON backcrypto."BioSavedConfig"("private");
ALTER TABLE backcrypto."BioSavedConfig" ADD CONSTRAINT "BioSavedConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES backcrypto."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
