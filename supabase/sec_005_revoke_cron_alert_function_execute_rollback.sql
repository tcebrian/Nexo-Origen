-- ROLLBACK de SEC-005. Restaura SOLO los permisos EXECUTE anteriores de estas dos funciones.
--
-- ADVERTENCIA: esto REABRE SEC-005 (cualquiera con la clave pública `anon` vuelve a poder llamar por RPC a
-- `nexo_call_daily_report_cron` y a la función del trigger de alertas). Úsalo solo como emergencia.
-- Estado restaurado (el observado en producción): EXECUTE para PUBLIC, anon, authenticated y service_role
-- (el propietario `postgres` nunca lo perdió).

begin;

grant execute on function public.nexo_call_daily_report_cron() to public, anon, authenticated, service_role;
grant execute on function public.nexo_notify_negative_review_alert() to public, anon, authenticated, service_role;

commit;
