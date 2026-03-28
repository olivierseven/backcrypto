-- AppConfig (schema backcrypto) — aplicar manualmente no Postgres/Neon se a tabela ainda não existir.
-- Depois: npx prisma generate (raiz do projeto crypto).

CREATE TABLE IF NOT EXISTS backcrypto."AppConfig" (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índice em key é redundante com PRIMARY KEY; o Neon pode listar AppConfig_key_idx como duplicado lógico do PK.
