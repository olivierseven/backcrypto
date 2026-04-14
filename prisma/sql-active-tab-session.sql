-- Controle de uma aba ativa por usuário (evitar múltiplas abas/navegadores sobrecarregando).
-- Rodar no banco backcrypto quando adicionar activeTabId/activeTabUpdatedAt ao User.
-- Schema: backcrypto (ajuste o search_path se necessário).

ALTER TABLE backcrypto."User"
  ADD COLUMN IF NOT EXISTS active_tab_id TEXT,
  ADD COLUMN IF NOT EXISTS active_tab_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN backcrypto."User".active_tab_id IS 'ID da aba/sessão atualmente ativa (uma por usuário)';
COMMENT ON COLUMN backcrypto."User".active_tab_updated_at IS 'Última atualização da aba ativa (expira após ~2 min sem requests)';

ALTER TABLE backcrypto."User"
  ADD COLUMN IF NOT EXISTS previous_tab_id TEXT,
  ADD COLUMN IF NOT EXISTS previous_tab_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN backcrypto."User".previous_tab_id IS 'Aba que acabou de ser substituída (bloqueada por ~60s)';
COMMENT ON COLUMN backcrypto."User".previous_tab_updated_at IS 'Quando a aba anterior foi substituída';
