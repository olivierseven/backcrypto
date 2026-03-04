-- CreateEnum
CREATE TYPE "public"."BioLanguage" AS ENUM ('en', 'pt');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "language" "public"."BioLanguage" NOT NULL DEFAULT 'en';
