-- Tabela de contas de afiliado (schema backcrypto), espelhando padrão de e-mail criptografado + emailSearchHash + passwordHash (bcrypt) como em "User".
-- Executar manualmente no PostgreSQL após alinhar com prisma/schema.prisma (sem pasta migrations neste projeto).

CREATE TABLE IF NOT EXISTS "backcrypto"."AffiliateAccount" (
  "id" TEXT NOT NULL,
  "emailEnc" TEXT NOT NULL,
  "emailIv" TEXT NOT NULL,
  "emailTag" TEXT NOT NULL,
  "emailSearchHash" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AffiliateAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateAccount_emailSearchHash_key"
  ON "backcrypto"."AffiliateAccount" ("emailSearchHash");

-- Exemplo: inserir afiliado (gerar passwordHash com bcrypt no Node, ex.: bcrypt.hash('senha', 10))
-- e e-mail criptografado com o mesmo fluxo da app (encryptEmail + emailSearchHash).
