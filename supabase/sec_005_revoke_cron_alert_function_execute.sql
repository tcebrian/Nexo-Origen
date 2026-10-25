-- SEC-005 — `anon`/`authenticated` (y `PUBLIC`) no deben poder ejecutar las funciones SECURITY DEFINER del cron
-- y del trigger de alertas. Cualquiera con la clave pública podía llamar a `/rest/v1/rpc/nexo_call_daily_report_cron`
-- y hacer que la base disparase `/api/cron/informe-diario` con el secreto de Vault.
--
-- Quién las usa de verdad (por eso este cambio no rompe nada):
--   * `nexo_call_daily_report_cron()`: la ejecuta pg_cron (job `nexo_informe_diario_09_madrid`) como `postgres`,
--     que es su propietario y conserva EXECUTE siempre.
--   * `nexo_notify_negative_review_alert()`: es la función del trigger `nexo_negative_review_alert_webhook`
--     (AFTER INSERT ON resenas). PostgreSQL solo comprueba EXECUTE al CREAR el trigger, no al dispararlo, y
--     además la función es SECURITY DEFINER (corre como `postgres`): el insert de quien sea sigue disparándola.
--   * Ningún código de la aplicación ni de Make las llama por RPC (sin llamadas REST en los logs), así que
--     `service_role` tampoco las necesita: mínimo privilegio.
--
-- NO cambia: cuerpo, SECURITY DEFINER, search_path, Vault, pg_cron, el trigger, secretos ni endpoints.
-- No modifica datos. Idempotente. Reversible con `sec_005_revoke_cron_alert_function_execute_rollback.sql`.

begin;

revoke execute on function public.nexo_call_daily_report_cron() from public, anon, authenticated, service_role;
revoke execute on function public.nexo_notify_negative_review_alert() from public, anon, authenticated, service_role;

commit;
