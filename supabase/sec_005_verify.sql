-- Verificación de SEC-005. SOLO LECTURA (termina en ROLLBACK). Ejecutar DESPUÉS de aplicar la migración,
-- como `postgres` (SQL Editor de Supabase). Lanza una excepción si algo no es lo esperado; si no, "SEC-005 OK".
-- No ejecuta las funciones (enviarían una petición real): solo comprueba permisos y configuración.

begin;

do $$
declare
  fn   text;
  oid_ oid;
  n    bigint;
  job  record;
begin
  foreach fn in array array['public.nexo_call_daily_report_cron()', 'public.nexo_notify_negative_review_alert()'] loop
    oid_ := fn::regprocedure::oid;

    if has_function_privilege('anon', oid_, 'execute') then raise exception 'SEC-005 FALLA: anon ejecuta %', fn; end if;
    if has_function_privilege('authenticated', oid_, 'execute') then raise exception 'SEC-005 FALLA: authenticated ejecuta %', fn; end if;
    if has_function_privilege('service_role', oid_, 'execute') then raise exception 'SEC-005 FALLA: service_role ejecuta %', fn; end if;

    -- PUBLIC (grantee 0) no debe figurar en la ACL.
    select count(*) into n from pg_proc p, aclexplode(p.proacl) a where p.oid = oid_ and a.grantee = 0;
    if n > 0 then raise exception 'SEC-005 FALLA: PUBLIC conserva EXECUTE sobre %', fn; end if;

    -- El propietario (postgres) sigue pudiendo ejecutarla, y sigue siendo SECURITY DEFINER con search_path fijo.
    if has_function_privilege('postgres', oid_, 'execute') is not true then raise exception 'SEC-005 FALLA: postgres perdió EXECUTE sobre %', fn; end if;
    if not exists (select 1 from pg_proc where oid = oid_ and prosecdef and pg_get_userbyid(proowner) = 'postgres'
                   and coalesce(proconfig::text, '') like '%search_path=pg_catalog, public%') then
      raise exception 'SEC-005 FALLA: % ya no es SECURITY DEFINER de postgres con search_path fijo', fn;
    end if;
  end loop;

  -- El cron sigue siendo el mismo, activo y de postgres.
  select * into job from cron.job where jobname = 'nexo_informe_diario_09_madrid';
  if job.jobid is null then raise exception 'SEC-005 FALLA: no existe el job nexo_informe_diario_09_madrid'; end if;
  if job.username <> 'postgres' or job.active is not true
     or job.schedule <> '*/10 7-8 * * *' or btrim(job.command) <> 'select public.nexo_call_daily_report_cron();' then
    raise exception 'SEC-005 FALLA: el job del cron cambió';
  end if;

  -- El trigger sigue apuntando a la función y activo ('O' = habilitado).
  select count(*) into n
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid
   where t.tgname = 'nexo_negative_review_alert_webhook' and t.tgrelid = 'public.resenas'::regclass
     and p.proname = 'nexo_notify_negative_review_alert' and t.tgenabled = 'O';
  if n <> 1 then raise exception 'SEC-005 FALLA: el trigger no apunta a la función o no está activo'; end if;

  -- Los secretos siguen donde estaban (solo se comprueba que existen; nunca se leen sus valores).
  select count(*) into n from vault.secrets where name in ('nexo_cron_secret', 'negative_review_webhook_secret');
  if n <> 2 then raise exception 'SEC-005 FALLA: faltan secretos en Vault (esperados 2, hay %)', n; end if;
end
$$;

-- Con el rol real: anon recibe "permission denied" al llamarla.
do $$
begin
  set local role anon;
  begin
    perform public.nexo_call_daily_report_cron();
    raise exception 'SEC-005 FALLA: anon pudo ejecutar nexo_call_daily_report_cron';
  exception when insufficient_privilege then null;
  end;
  reset role;
end
$$;

select 'SEC-005 OK' as resultado;

rollback;
