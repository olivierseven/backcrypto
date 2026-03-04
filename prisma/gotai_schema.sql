-- Tabelas e enums no schema gotai (schema já existe)

-- Enums
CREATE TYPE gotai."Role" AS ENUM ('user', 'admin');
CREATE TYPE gotai."BioLanguage" AS ENUM ('en', 'pt');
CREATE TYPE gotai."Tier" AS ENUM ('free', 'plus', 'lite');
CREATE TYPE gotai."UserLevel" AS ENUM ('RECRUTA', 'APRENDIZ', 'EXPLORADOR', 'JOGADOR', 'AVANCADO', 'ESPECIALISTA', 'MESTRE', 'ELITE', 'LENDARIO', 'SUPREMO', 'MITICO', 'CELESTIAL', 'DIVINO');
CREATE TYPE gotai."TxType" AS ENUM ('CREDIT', 'DEBIT', 'ADJUSTMENT');
CREATE TYPE gotai."TxSource" AS ENUM ('STRIPE', 'PAGARME', 'SPEND', 'REFUND', 'ADMIN', 'EXPIRATION', 'BONUS', 'PRIZE');
CREATE TYPE gotai."CheckoutStatus" AS ENUM ('CREATED', 'COMPLETED', 'REFUNDED', 'CANCELED', 'PARTIALLY_REFUNDED', 'OVER_LIMIT');
CREATE TYPE gotai."SenderType" AS ENUM ('system', 'user');
CREATE TYPE gotai."BioQueueStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED');

-- User
CREATE TABLE gotai."User" (
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
    "role" gotai."Role" NOT NULL DEFAULT 'user',
    "tier" gotai."Tier" NOT NULL DEFAULT 'free',
    "nickname" TEXT,
    "nicknameChanges" INTEGER NOT NULL DEFAULT 0,
    "avatarId" INTEGER NOT NULL DEFAULT 1,
    "avatarBorder" TEXT NOT NULL DEFAULT 'white',
    "avatarSkinTone" INTEGER,
    "avatarColorTone" INTEGER,
    "sevenPoints" INTEGER NOT NULL DEFAULT 0,
    "ganhoSimulado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "userLevel" gotai."UserLevel" NOT NULL DEFAULT 'RECRUTA',
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
    "language" gotai."BioLanguage" NOT NULL DEFAULT 'en',
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_emailSearchHash_key" ON gotai."User"("emailSearchHash");
CREATE UNIQUE INDEX "User_nickname_key" ON gotai."User"("nickname");

-- AccessRequest
CREATE TABLE gotai."AccessRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccessRequest_userId_status_idx" ON gotai."AccessRequest"("userId", "status");
ALTER TABLE gotai."AccessRequest" ADD CONSTRAINT "AccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES gotai."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmailVerificationToken
CREATE TABLE gotai."EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON gotai."EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_idx" ON gotai."EmailVerificationToken"("userId");
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON gotai."EmailVerificationToken"("expiresAt");
ALTER TABLE gotai."EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES gotai."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PasswordResetToken
CREATE TABLE gotai."PasswordResetToken" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("tokenHash")
);
CREATE INDEX "PasswordResetToken_userId_idx" ON gotai."PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON gotai."PasswordResetToken"("expiresAt");
ALTER TABLE gotai."PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES gotai."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UserCoinWallet
CREATE TABLE gotai."UserCoinWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserCoinWallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserCoinWallet_userId_key" ON gotai."UserCoinWallet"("userId");
CREATE INDEX "UserCoinWallet_userId_idx" ON gotai."UserCoinWallet"("userId");
ALTER TABLE gotai."UserCoinWallet" ADD CONSTRAINT "UserCoinWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES gotai."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CoinLedgerEntry
CREATE TABLE gotai."CoinLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" gotai."TxType" NOT NULL,
    "source" gotai."TxSource" NOT NULL,
    "amount" INTEGER NOT NULL,
    "refId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinLedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CoinLedgerEntry_userId_createdAt_idx" ON gotai."CoinLedgerEntry"("userId", "createdAt");
CREATE INDEX "CoinLedgerEntry_walletId_createdAt_idx" ON gotai."CoinLedgerEntry"("walletId", "createdAt");
CREATE INDEX "CoinLedgerEntry_source_createdAt_idx" ON gotai."CoinLedgerEntry"("source", "createdAt");
CREATE UNIQUE INDEX "CoinLedgerEntry_source_refId_key" ON gotai."CoinLedgerEntry"("source", "refId");
ALTER TABLE gotai."CoinLedgerEntry" ADD CONSTRAINT "CoinLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES gotai."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE gotai."CoinLedgerEntry" ADD CONSTRAINT "CoinLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES gotai."UserCoinWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WalletCredit
CREATE TABLE gotai."WalletCredit" (
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
CREATE UNIQUE INDEX "WalletCredit_entryId_key" ON gotai."WalletCredit"("entryId");
CREATE INDEX "WalletCredit_userId_expiresAt_idx" ON gotai."WalletCredit"("userId", "expiresAt");
CREATE INDEX "WalletCredit_userId_createdAt_idx" ON gotai."WalletCredit"("userId", "createdAt");
ALTER TABLE gotai."WalletCredit" ADD CONSTRAINT "WalletCredit_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES gotai."CoinLedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE gotai."WalletCredit" ADD CONSTRAINT "WalletCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES gotai."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- StripeEvent
CREATE TABLE gotai."StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StripeEvent_type_idx" ON gotai."StripeEvent"("type");

-- StripeCheckoutSession
CREATE TABLE gotai."StripeCheckoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" gotai."CheckoutStatus" NOT NULL DEFAULT 'CREATED',
    "amountTotalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "coinsToCredit" INTEGER NOT NULL,
    "pricingLabel" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StripeCheckoutSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StripeCheckoutSession_userId_status_idx" ON gotai."StripeCheckoutSession"("userId", "status");
CREATE INDEX "StripeCheckoutSession_userId_completedAt_idx" ON gotai."StripeCheckoutSession"("userId", "completedAt");
CREATE INDEX "StripeCheckoutSession_completedAt_idx" ON gotai."StripeCheckoutSession"("completedAt");
ALTER TABLE gotai."StripeCheckoutSession" ADD CONSTRAINT "StripeCheckoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES gotai."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PagarMeOrder
CREATE TABLE gotai."PagarMeOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" gotai."CheckoutStatus" NOT NULL DEFAULT 'CREATED',
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
CREATE INDEX "PagarMeOrder_userId_status_idx" ON gotai."PagarMeOrder"("userId", "status");
CREATE INDEX "PagarMeOrder_userId_completedAt_idx" ON gotai."PagarMeOrder"("userId", "completedAt");
CREATE INDEX "PagarMeOrder_completedAt_idx" ON gotai."PagarMeOrder"("completedAt");
CREATE INDEX "PagarMeOrder_status_idx" ON gotai."PagarMeOrder"("status");
ALTER TABLE gotai."PagarMeOrder" ADD CONSTRAINT "PagarMeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES gotai."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UserNotification
CREATE TABLE gotai."UserNotification" (
    "idNotification" TEXT NOT NULL,
    "senderType" gotai."SenderType" NOT NULL,
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
CREATE INDEX "UserNotification_userId_idx" ON gotai."UserNotification"("userId");
CREATE INDEX "UserNotification_ativo_idx" ON gotai."UserNotification"("ativo");
CREATE INDEX "UserNotification_expiredDate_idx" ON gotai."UserNotification"("expiredDate");
ALTER TABLE gotai."UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES gotai."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BioAppConfig
CREATE TABLE gotai."BioAppConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BioAppConfig_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "BioAppConfig_key_idx" ON gotai."BioAppConfig"("key");

-- BioSimulationQueue
CREATE TABLE gotai."BioSimulationQueue" (
    "id" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" gotai."BioQueueStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BioSimulationQueue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BioSimulationQueue_queueName_status_idx" ON gotai."BioSimulationQueue"("queueName", "status");
CREATE INDEX "BioSimulationQueue_userId_createdAt_idx" ON gotai."BioSimulationQueue"("userId", "createdAt");
ALTER TABLE gotai."BioSimulationQueue" ADD CONSTRAINT "BioSimulationQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES gotai."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BioSimulationState
CREATE TABLE gotai."BioSimulationState" (
    "userId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "mapDisplayByYear" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BioSimulationState_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE gotai."BioSimulationState" ADD CONSTRAINT "BioSimulationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES gotai."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BioSavedConfig
CREATE TABLE gotai."BioSavedConfig" (
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
CREATE UNIQUE INDEX "BioSavedConfig_name_key" ON gotai."BioSavedConfig"("name");
CREATE INDEX "BioSavedConfig_userId_idx" ON gotai."BioSavedConfig"("userId");
CREATE INDEX "BioSavedConfig_private_idx" ON gotai."BioSavedConfig"("private");
ALTER TABLE gotai."BioSavedConfig" ADD CONSTRAINT "BioSavedConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES gotai."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
