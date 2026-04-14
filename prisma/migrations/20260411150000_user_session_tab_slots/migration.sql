-- Sessão do sistema: até N abas ativas por utilizador (lista JSON). Migração lazy a partir de active_tab_id.
ALTER TABLE "backcrypto"."User" ADD COLUMN IF NOT EXISTS "session_tab_slots" JSONB;
ALTER TABLE "backcrypto"."User" ADD COLUMN IF NOT EXISTS "session_evicted_tabs" JSONB;

COMMENT ON COLUMN "backcrypto"."User"."session_tab_slots" IS 'Lista JSON [{id, at}] das abas ativas (máximo em SISTEMA_MAX_SESSION_TABS)';
COMMENT ON COLUMN "backcrypto"."User"."session_evicted_tabs" IS 'Lista JSON [{id, until}] — cooldown após eviction LRU';
