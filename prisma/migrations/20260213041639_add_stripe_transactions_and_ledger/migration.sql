-- CreateEnum
CREATE TYPE "public"."TxType" AS ENUM ('CREDIT', 'DEBIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."TxSource" AS ENUM ('STRIPE', 'PAGARME', 'SPEND', 'REFUND', 'ADMIN', 'EXPIRATION', 'BONUS', 'PRIZE');

-- CreateEnum
CREATE TYPE "public"."CheckoutStatus" AS ENUM ('CREATED', 'COMPLETED', 'REFUNDED', 'CANCELED', 'PARTIALLY_REFUNDED', 'OVER_LIMIT');

-- CreateTable
CREATE TABLE "public"."UserCoinWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCoinWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CoinLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "public"."TxType" NOT NULL,
    "source" "public"."TxSource" NOT NULL,
    "amount" INTEGER NOT NULL,
    "refId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WalletCredit" (
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
CREATE TABLE "public"."StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StripeCheckoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."CheckoutStatus" NOT NULL DEFAULT 'CREATED',
    "amountTotalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "coinsToCredit" INTEGER NOT NULL,
    "pricingLabel" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeCheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PagarMeOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."CheckoutStatus" NOT NULL DEFAULT 'CREATED',
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

-- CreateIndex
CREATE UNIQUE INDEX "UserCoinWallet_userId_key" ON "public"."UserCoinWallet"("userId");

-- CreateIndex
CREATE INDEX "UserCoinWallet_userId_idx" ON "public"."UserCoinWallet"("userId");

-- CreateIndex
CREATE INDEX "CoinLedgerEntry_userId_createdAt_idx" ON "public"."CoinLedgerEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinLedgerEntry_walletId_createdAt_idx" ON "public"."CoinLedgerEntry"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinLedgerEntry_source_createdAt_idx" ON "public"."CoinLedgerEntry"("source", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CoinLedgerEntry_source_refId_key" ON "public"."CoinLedgerEntry"("source", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletCredit_entryId_key" ON "public"."WalletCredit"("entryId");

-- CreateIndex
CREATE INDEX "WalletCredit_userId_expiresAt_idx" ON "public"."WalletCredit"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "WalletCredit_userId_createdAt_idx" ON "public"."WalletCredit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StripeEvent_type_idx" ON "public"."StripeEvent"("type");

-- CreateIndex
CREATE INDEX "StripeCheckoutSession_userId_status_idx" ON "public"."StripeCheckoutSession"("userId", "status");

-- CreateIndex
CREATE INDEX "StripeCheckoutSession_userId_completedAt_idx" ON "public"."StripeCheckoutSession"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "StripeCheckoutSession_completedAt_idx" ON "public"."StripeCheckoutSession"("completedAt");

-- CreateIndex
CREATE INDEX "PagarMeOrder_userId_status_idx" ON "public"."PagarMeOrder"("userId", "status");

-- CreateIndex
CREATE INDEX "PagarMeOrder_userId_completedAt_idx" ON "public"."PagarMeOrder"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "PagarMeOrder_completedAt_idx" ON "public"."PagarMeOrder"("completedAt");

-- CreateIndex
CREATE INDEX "PagarMeOrder_status_idx" ON "public"."PagarMeOrder"("status");

-- AddForeignKey
ALTER TABLE "public"."UserCoinWallet" ADD CONSTRAINT "UserCoinWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoinLedgerEntry" ADD CONSTRAINT "CoinLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoinLedgerEntry" ADD CONSTRAINT "CoinLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "public"."UserCoinWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletCredit" ADD CONSTRAINT "WalletCredit_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."CoinLedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletCredit" ADD CONSTRAINT "WalletCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StripeCheckoutSession" ADD CONSTRAINT "StripeCheckoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PagarMeOrder" ADD CONSTRAINT "PagarMeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
