-- Seed variáveis da fila em BioAppConfig (valores padrão; alterar no banco dispensa redeploy)
INSERT INTO "BioAppConfig" ("key", "value", "description", "createdAt", "updatedAt")
VALUES
  ('bio_queue_max_fila_1x', '6', 'Máx. execuções simultâneas na fila 1x', NOW(), NOW()),
  ('bio_queue_max_fila_20x', '4', 'Máx. execuções simultâneas na fila 20x', NOW(), NOW()),
  ('bio_queue_max_fila_100x', '3', 'Máx. execuções simultâneas na fila 100x', NOW(), NOW()),
  ('bio_queue_max_fila_1000x', '2', 'Máx. execuções simultâneas na fila 1000x', NOW(), NOW()),
  ('bio_queue_poll_interval_ms', '1500', 'Intervalo do polling do cliente (ms)', NOW(), NOW()),
  ('bio_queue_max_wait_ms', '180000', 'Tempo máximo de espera do cliente antes do timeout (ms, 180000=3min)', NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;
