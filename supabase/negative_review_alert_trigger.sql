-- Trigger del aviso de reseñas alertables (1★, 2★ y 3★) hacia /api/webhooks/negative-review-alert.
-- La función `nexo_notify_negative_review_alert` (lee el secreto de Vault y llama al webhook) no cambia;
-- solo la condición del trigger: antes IN (1, 2), ahora IN (1, 2, 3). Debe coincidir con
-- NEGATIVE_ALERT_MAX_STARS (lib/alerts/negative-review/orchestrator.ts). Idempotente.
drop trigger if exists nexo_negative_review_alert_webhook on public.resenas;

create trigger nexo_negative_review_alert_webhook
  after insert on public.resenas
  for each row
  when (new.estrellas in (1, 2, 3))
  execute function public.nexo_notify_negative_review_alert();
