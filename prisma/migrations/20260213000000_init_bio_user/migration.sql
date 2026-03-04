-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('free', 'plus', 'lite');

-- CreateEnum
CREATE TYPE "UserLevel" AS ENUM ('RECRUTA', 'APRENDIZ', 'EXPLORADOR', 'JOGADOR', 'AVANCADO', 'ESPECIALISTA', 'MESTRE', 'ELITE', 'LENDARIO', 'SUPREMO', 'MITICO', 'CELESTIAL', 'DIVINO');

-- CreateTable
CREATE TABLE "User" (
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
    "role" "Role" NOT NULL DEFAULT 'user',
    "tier" "Tier" NOT NULL DEFAULT 'free',
    "nickname" TEXT,
    "nicknameChanges" INTEGER NOT NULL DEFAULT 0,
    "avatarId" INTEGER NOT NULL DEFAULT 1,
    "avatarBorder" TEXT NOT NULL DEFAULT 'white',
    "avatarSkinTone" INTEGER,
    "avatarColorTone" INTEGER,
    "sevenPoints" INTEGER NOT NULL DEFAULT 0,
    "ganhoSimulado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "userLevel" "UserLevel" NOT NULL DEFAULT 'RECRUTA',
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

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_emailSearchHash_key" ON "User"("emailSearchHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");
