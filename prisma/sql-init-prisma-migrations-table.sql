-- Tabela de histórico do Prisma Migrate. Rodar UMA VEZ no banco de produção
-- se aparecer "migration persistence is not initialized".
-- Prisma usa o schema "public" por defeito para esta tabela.

CREATE TABLE IF NOT EXISTS public._prisma_migrations (
  id                      VARCHAR(36) PRIMARY KEY NOT NULL,
  checksum                VARCHAR(64) NOT NULL,
  finished_at             TIMESTAMPTZ,
  migration_name          VARCHAR(255) NOT NULL,
  logs                    TEXT,
  rolled_back_at          TIMESTAMPTZ,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_steps_count     INTEGER NOT NULL DEFAULT 0
);
