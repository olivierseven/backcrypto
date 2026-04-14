-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "backcrypto";

-- CreateEnum
CREATE TYPE "backcrypto"."Role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "backcrypto"."AppLanguage" AS ENUM ('en', 'pt');

-- CreateEnum
CREATE TYPE "backcrypto"."Tier" AS ENUM ('free', 'plus', 'lite');

-- CreateEnum
CREATE TYPE "backcrypto"."UserLevel" AS ENUM ('RECRUTA', 'APRENDIZ', 'EXPLORADOR', 'JOGADOR', 'AVANCADO', 'ESPECIALISTA', 'MESTRE', 'ELITE', 'LENDARIO', 'SUPREMO', 'MITICO', 'CELESTIAL', 'DIVINO');

-- CreateEnum
CREATE TYPE "backcrypto"."TxType" AS ENUM ('CREDIT', 'DEBIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "backcrypto"."TxSource" AS ENUM ('STRIPE', 'PAGARME', 'SPEND', 'REFUND', 'ADMIN', 'EXPIRATION', 'BONUS', 'PRIZE');

-- CreateEnum
CREATE TYPE "backcrypto"."CheckoutStatus" AS ENUM ('CREATED', 'COMPLETED', 'REFUNDED', 'CANCELED', 'PARTIALLY_REFUNDED', 'OVER_LIMIT');

-- CreateEnum
CREATE TYPE "backcrypto"."SenderType" AS ENUM ('system', 'user');

-- CreateTable
CREATE TABLE "backcrypto"."User" (
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
    "role" "backcrypto"."Role" NOT NULL DEFAULT 'user',
    "tier" "backcrypto"."Tier" NOT NULL DEFAULT 'free',
    "nickname" TEXT,
    "nicknameChanges" INTEGER NOT NULL DEFAULT 0,
    "avatarId" INTEGER NOT NULL DEFAULT 1,
    "avatarBorder" TEXT NOT NULL DEFAULT 'white',
    "avatarSkinTone" INTEGER,
    "avatarColorTone" INTEGER,
    "sevenPoints" INTEGER NOT NULL DEFAULT 0,
    "ganhoSimulado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "userLevel" "backcrypto"."UserLevel" NOT NULL DEFAULT 'RECRUTA',
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
    "language" "backcrypto"."AppLanguage" NOT NULL DEFAULT 'en',
    "timezoneOffset" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backcrypto"."ChartLayout" (
    "user_id" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartLayout_pkey" PRIMARY KEY ("user_id","slot")
);

-- CreateTable
CREATE TABLE "backcrypto"."UserNotification" (
    "idNotification" TEXT NOT NULL,
    "senderType" "backcrypto"."SenderType" NOT NULL,
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

-- CreateTable
CREATE TABLE "backcrypto"."AccessRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backcrypto"."EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backcrypto"."PasswordResetToken" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "backcrypto"."UserCoinWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCoinWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backcrypto"."CoinLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "backcrypto"."TxType" NOT NULL,
    "source" "backcrypto"."TxSource" NOT NULL,
    "amount" INTEGER NOT NULL,
    "refId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backcrypto"."WalletCredit" (
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

-- CreateTable
CREATE TABLE "backcrypto"."StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backcrypto"."StripeCheckoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "backcrypto"."CheckoutStatus" NOT NULL DEFAULT 'CREATED',
    "amountTotalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "coinsToCredit" INTEGER NOT NULL,
    "pricingLabel" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeCheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backcrypto"."PagarMeOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "backcrypto"."CheckoutStatus" NOT NULL DEFAULT 'CREATED',
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

-- CreateTable
CREATE TABLE "backcrypto"."BinanceKline" (
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "openTime" BIGINT NOT NULL,
    "open" DECIMAL(32,8) NOT NULL,
    "high" DECIMAL(32,8) NOT NULL,
    "low" DECIMAL(32,8) NOT NULL,
    "close" DECIMAL(32,8) NOT NULL,
    "volume" DECIMAL(32,8) NOT NULL,
    "closeTime" BIGINT NOT NULL,
    "quoteAssetVolume" DECIMAL(32,8) NOT NULL,
    "numberOfTrades" INTEGER NOT NULL,
    "takerBuyBaseAssetVolume" DECIMAL(32,8) NOT NULL,
    "takerBuyQuoteAssetVolume" DECIMAL(32,8) NOT NULL,

    CONSTRAINT "BinanceKline_pkey" PRIMARY KEY ("symbol","interval","openTime")
);

-- CreateTable
CREATE TABLE "backcrypto"."BinanceKlineFast" (
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "openTime" BIGINT NOT NULL,
    "open" DECIMAL(32,8) NOT NULL,
    "high" DECIMAL(32,8) NOT NULL,
    "low" DECIMAL(32,8) NOT NULL,
    "close" DECIMAL(32,8) NOT NULL,
    "volume" DECIMAL(32,8) NOT NULL,
    "closeTime" BIGINT NOT NULL,
    "quoteAssetVolume" DECIMAL(32,8) NOT NULL,
    "numberOfTrades" INTEGER NOT NULL,
    "takerBuyBaseAssetVolume" DECIMAL(32,8) NOT NULL,
    "takerBuyQuoteAssetVolume" DECIMAL(32,8) NOT NULL,

    CONSTRAINT "BinanceKlineFast_pkey" PRIMARY KEY ("symbol","interval","openTime")
);

-- CreateTable
CREATE TABLE "backcrypto"."BinanceKlineCache" (
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "openTime" BIGINT NOT NULL,
    "open" DECIMAL(32,8) NOT NULL,
    "high" DECIMAL(32,8) NOT NULL,
    "low" DECIMAL(32,8) NOT NULL,
    "close" DECIMAL(32,8) NOT NULL,
    "volume" DECIMAL(32,8) NOT NULL,
    "closeTime" BIGINT NOT NULL,
    "quoteAssetVolume" DECIMAL(32,8) NOT NULL,
    "numberOfTrades" INTEGER NOT NULL,
    "takerBuyBaseAssetVolume" DECIMAL(32,8) NOT NULL,
    "takerBuyQuoteAssetVolume" DECIMAL(32,8) NOT NULL,

    CONSTRAINT "BinanceKlineCache_pkey" PRIMARY KEY ("symbol","interval","openTime")
);

-- CreateTable
CREATE TABLE "backcrypto"."BinanceKlineGap" (
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "gapFrom" BIGINT NOT NULL,
    "gapTo" BIGINT NOT NULL,

    CONSTRAINT "BinanceKlineGap_pkey" PRIMARY KEY ("symbol","interval","gapFrom","gapTo")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_emailSearchHash_key" ON "backcrypto"."User"("emailSearchHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_nickname_key" ON "backcrypto"."User"("nickname");

-- CreateIndex
CREATE INDEX "UserNotification_userId_idx" ON "backcrypto"."UserNotification"("userId");

-- CreateIndex
CREATE INDEX "UserNotification_ativo_idx" ON "backcrypto"."UserNotification"("ativo");

-- CreateIndex
CREATE INDEX "UserNotification_expiredDate_idx" ON "backcrypto"."UserNotification"("expiredDate");

-- CreateIndex
CREATE INDEX "AccessRequest_userId_status_idx" ON "backcrypto"."AccessRequest"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "backcrypto"."EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "backcrypto"."EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "backcrypto"."EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "backcrypto"."PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "backcrypto"."PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserCoinWallet_userId_key" ON "backcrypto"."UserCoinWallet"("userId");

-- CreateIndex
CREATE INDEX "UserCoinWallet_userId_idx" ON "backcrypto"."UserCoinWallet"("userId");

-- CreateIndex
CREATE INDEX "CoinLedgerEntry_userId_createdAt_idx" ON "backcrypto"."CoinLedgerEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinLedgerEntry_walletId_createdAt_idx" ON "backcrypto"."CoinLedgerEntry"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinLedgerEntry_source_createdAt_idx" ON "backcrypto"."CoinLedgerEntry"("source", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CoinLedgerEntry_source_refId_key" ON "backcrypto"."CoinLedgerEntry"("source", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletCredit_entryId_key" ON "backcrypto"."WalletCredit"("entryId");

-- CreateIndex
CREATE INDEX "WalletCredit_userId_expiresAt_idx" ON "backcrypto"."WalletCredit"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "WalletCredit_userId_createdAt_idx" ON "backcrypto"."WalletCredit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StripeEvent_type_idx" ON "backcrypto"."StripeEvent"("type");

-- CreateIndex
CREATE INDEX "StripeCheckoutSession_userId_status_idx" ON "backcrypto"."StripeCheckoutSession"("userId", "status");

-- CreateIndex
CREATE INDEX "StripeCheckoutSession_userId_completedAt_idx" ON "backcrypto"."StripeCheckoutSession"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "StripeCheckoutSession_completedAt_idx" ON "backcrypto"."StripeCheckoutSession"("completedAt");

-- CreateIndex
CREATE INDEX "PagarMeOrder_userId_status_idx" ON "backcrypto"."PagarMeOrder"("userId", "status");

-- CreateIndex
CREATE INDEX "PagarMeOrder_userId_completedAt_idx" ON "backcrypto"."PagarMeOrder"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "PagarMeOrder_completedAt_idx" ON "backcrypto"."PagarMeOrder"("completedAt");

-- CreateIndex
CREATE INDEX "PagarMeOrder_status_idx" ON "backcrypto"."PagarMeOrder"("status");

-- CreateIndex
CREATE INDEX "BinanceKline_symbol_interval_openTime_idx" ON "backcrypto"."BinanceKline"("symbol", "interval", "openTime");

-- CreateIndex
CREATE INDEX "BinanceKline_symbol_interval_openTime_desc_idx" ON "backcrypto"."BinanceKline"("symbol", "interval", "openTime" DESC);

-- CreateIndex
CREATE INDEX "BinanceKlineFast_symbol_interval_openTime_idx" ON "backcrypto"."BinanceKlineFast"("symbol", "interval", "openTime");

-- CreateIndex
CREATE INDEX "BinanceKlineFast_symbol_interval_openTime_desc_idx" ON "backcrypto"."BinanceKlineFast"("symbol", "interval", "openTime" DESC);

-- CreateIndex
CREATE INDEX "BinanceKlineCache_symbol_interval_openTime_idx" ON "backcrypto"."BinanceKlineCache"("symbol", "interval", "openTime");

-- CreateIndex
CREATE INDEX "BinanceKlineCache_symbol_interval_openTime_desc_idx" ON "backcrypto"."BinanceKlineCache"("symbol", "interval", "openTime" DESC);

-- CreateIndex
CREATE INDEX "BinanceKlineGap_symbol_interval_idx" ON "backcrypto"."BinanceKlineGap"("symbol", "interval");

-- AddForeignKey
ALTER TABLE "backcrypto"."ChartLayout" ADD CONSTRAINT "ChartLayout_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backcrypto"."UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backcrypto"."AccessRequest" ADD CONSTRAINT "AccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backcrypto"."EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backcrypto"."PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backcrypto"."UserCoinWallet" ADD CONSTRAINT "UserCoinWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backcrypto"."CoinLedgerEntry" ADD CONSTRAINT "CoinLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backcrypto"."CoinLedgerEntry" ADD CONSTRAINT "CoinLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "backcrypto"."UserCoinWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backcrypto"."WalletCredit" ADD CONSTRAINT "WalletCredit_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "backcrypto"."CoinLedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backcrypto"."WalletCredit" ADD CONSTRAINT "WalletCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backcrypto"."StripeCheckoutSession" ADD CONSTRAINT "StripeCheckoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backcrypto"."PagarMeOrder" ADD CONSTRAINT "PagarMeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "backcrypto"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

