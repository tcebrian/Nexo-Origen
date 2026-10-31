-- Reintento de alertas negativas cuya imagen falló con la ventana de WhatsApp abierta (cada 5 min).
-- NO está aplicado en producción: ejecútalo UNA vez en el SQL Editor cuando se apruebe.
-- Mismo patrón que `nexo_call_daily_report_cron`: lee el secreto `nexo_cron_secret` de Vault y llama a la ruta
-- protegida con Bearer. No toca tablas ni datos; solo crea una función y un job de pg_cron.
-- Reversible:  select cron.unschedule('nexo_reintento_alertas_negativas');  drop function public.nexo_call_alert_retry_cron();

create or replace function public.nexo_call_alert_retry_cron()
returns bigint
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'nexo_cron_secret'
  order by created_at desc
  limit 1;

  if v_secret is null or btrim(v_secret) = '' then
    raise exception 'nexo_cron_secret is not configured';
  end if;

  select net.http_post(
    url := 'https://app.nexoorigen.com/api/cron/retry-negative-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || btrim(v_secret)),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

-- Igual que SEC-005: solo pg_cron (propietario) puede ejecutarla.
revoke execute on function public.nexo_call_alert_retry_cron() from public, anon, authenticated, service_role;

select cron.schedule('nexo_reintento_alertas_negativas', '*/5 * * * *', $$select public.nexo_call_alert_retry_cron();$$);
