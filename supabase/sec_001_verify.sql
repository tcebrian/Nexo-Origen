-- Verificación de SEC-001. SOLO LECTURA: todo ocurre en una transacción que termina en ROLLBACK.
-- Ejecutar DESPUÉS de aplicar `sec_001_revoke_anon_data_access.sql` (SQL Editor de Supabase o MCP).
-- Cada bloque lanza una excepción si el resultado no es el esperado; si llega al final imprime "SEC-001 OK".
-- (Un ROLLBACK final deja la base exactamente como estaba.)

begin;

do $$
declare
  obj  text;
  n    bigint;
begin
  -- ANON: sin SELECT en tablas, vistas, y sin EXECUTE en los RPC de métricas ----------------------------
  foreach obj in array array[
    'resenas', 'restaurantes', 'marcas', 'kpi_diario', 'kpi_semanal', 'kpi_mensual',
    'dashboard_kpis', 'dashboard_restaurantes', 'kpi_marcas', 'kpi_restaurantes', 'resumen_restaurantes',
    'v_motivos_base', 'motivos_diarios', 'motivos_semanales', 'motivos_mensuales'
  ] loop
    if has_table_privilege('anon', format('public.%I', obj), 'select')
       or has_table_privilege('authenticated', format('public.%I', obj), 'select') then
      raise exception 'SEC-001 FALLA: anon/authenticated todavía tienen SELECT sobre %', obj;
    end if;
    if has_table_privilege('service_role', format('public.%I', obj), 'select') is not true then
      raise exception 'SEC-001 FALLA: service_role perdió SELECT sobre %', obj;
    end if;
  end loop;

  foreach obj in array array[
    'public.get_kpis_periodo(bigint,date,date)',
    'public.nexo_window_reviews(timestamp,timestamp,bigint[])',
    'public.nexo_reputation_window_metrics(timestamp,timestamp,bigint[])'
  ] loop
    if has_function_privilege('anon', obj, 'execute') or has_function_privilege('authenticated', obj, 'execute') then
      raise exception 'SEC-001 FALLA: anon/authenticated todavía ejecutan %', obj;
    end if;
    if has_function_privilege('service_role', obj, 'execute') is not true then
      raise exception 'SEC-001 FALLA: service_role perdió EXECUTE sobre %', obj;
    end if;
  end loop;

  -- Políticas públicas eliminadas ----------------------------------------------------------------------
  select count(*) into n from pg_policies
   where schemaname = 'public' and policyname like 'Allow anon read %';
  if n > 0 then raise exception 'SEC-001 FALLA: quedan % políticas "Allow anon read *"', n; end if;

  -- Vistas sin bypass de RLS --------------------------------------------------------------------------
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'v'
     and c.relname in ('dashboard_kpis','dashboard_restaurantes','kpi_marcas','kpi_restaurantes','resumen_restaurantes',
                       'v_motivos_base','motivos_diarios','motivos_semanales','motivos_mensuales')
     and coalesce(c.reloptions::text, '') not like '%security_invoker=true%';
  if n > 0 then raise exception 'SEC-001 FALLA: % vistas sin security_invoker', n; end if;

  -- PERFILES: authenticated conserva su política de lectura propia ----------------------------------------
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'perfiles' and policyname = 'perfiles_select_own';
  if n <> 1 then raise exception 'SEC-001 FALLA: falta perfiles_select_own'; end if;
  if has_table_privilege('authenticated', 'public.perfiles', 'select') is not true then
    raise exception 'SEC-001 FALLA: authenticated perdió SELECT sobre perfiles';
  end if;
end
$$;

-- Prueba funcional con los roles reales: anon no puede leer nada (debe fallar con "permission denied").
do $$
begin
  set local role anon;
  begin
    perform 1 from public.resenas limit 1;
    raise exception 'SEC-001 FALLA: anon pudo leer resenas';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.kpi_restaurantes limit 1;
    raise exception 'SEC-001 FALLA: anon pudo leer kpi_restaurantes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.nexo_reputation_window_metrics(now()::timestamp, now()::timestamp, array[1]::bigint[]);
    raise exception 'SEC-001 FALLA: anon pudo ejecutar nexo_reputation_window_metrics';
  exception when insufficient_privilege then null;
  end;
  reset role;
end
$$;

select 'SEC-001 OK' as resultado;

rollback;
