-- Verificación de SEC-011. Ejecutar DESPUÉS de aplicar `sec_011_revoke_write_privileges.sql`, como `postgres`
-- (SQL Editor de Supabase). Lanza una excepción si algo no es lo esperado; si no, imprime "SEC-011 OK".
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: la tabla de prueba NO queda creada.

begin;

do $$
declare
  tbl      text;
  r        text;
  p        text;
  n        bigint;
  writes   constant text[] := array['insert', 'update', 'delete', 'truncate', 'references', 'trigger', 'maintain'];
  tables   constant text[] := array[
    'alertas_enviadas', 'analisis_ia', 'conv_alertas_negativas', 'conv_informe_envios', 'empresas', 'kpi_semana_actual',
    'nexo_bot_resumenes_envios', 'nexo_metric_validation_events', 'perfiles', 'resena_motivos', 'resenas_historial',
    'restaurante_fuente_aliases', 'restaurante_integraciones', 'review_identity_shadow_events', 'usuario_marcas',
    'usuario_restaurantes'
  ];
begin
  -- 1) Tablas existentes: anon y authenticated sin NINGÚN privilegio de escritura/administración; RLS sigue activo;
  --    service_role conserva lectura y escritura.
  foreach tbl in array tables loop
    foreach r in array array['anon', 'authenticated'] loop
      foreach p in array writes loop
        if has_table_privilege(r, format('public.%I', tbl), upper(p)) then
          raise exception 'SEC-011 FALLA: % todavía tiene % sobre public.%', r, upper(p), tbl;
        end if;
      end loop;
    end loop;

    if not (select relrowsecurity from pg_class where oid = format('public.%I', tbl)::regclass) then
      raise exception 'SEC-011 FALLA: public.% ya no tiene RLS activado', tbl;
    end if;

    foreach p in array array['select', 'insert', 'update', 'delete'] loop
      if has_table_privilege('service_role', format('public.%I', tbl), upper(p)) is not true then
        raise exception 'SEC-011 FALLA: service_role perdió % sobre public.%', upper(p), tbl;
      end if;
    end loop;
  end loop;

  -- 2) perfiles: authenticated sigue leyendo SU fila con perfiles_select_own.
  if has_table_privilege('authenticated', 'public.perfiles', 'SELECT') is not true then
    raise exception 'SEC-011 FALLA: authenticated perdió SELECT sobre perfiles';
  end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'perfiles' and policyname = 'perfiles_select_own'
     and cmd = 'SELECT' and roles = '{authenticated}';
  if n <> 1 then raise exception 'SEC-011 FALLA: falta o cambió la política perfiles_select_own'; end if;

  -- 3) Default privileges de tablas nuevas en public (propietario postgres): sin escritura para anon/authenticated,
  --    y service_role conserva todo.
  select count(*) into n
    from pg_default_acl d, aclexplode(d.defaclacl) a
   where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'r'
     and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
     and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN');
  if n > 0 then raise exception 'SEC-011 FALLA: los default privileges de postgres en public aún dan escritura a anon/authenticated (% entradas)', n; end if;

  select count(*) into n
    from pg_default_acl d, aclexplode(d.defaclacl) a
   where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'r'
     and a.grantee = 'service_role'::regrole;
  if n < 7 then raise exception 'SEC-011 FALLA: service_role perdió default privileges de tablas'; end if;

  -- supabase_admin: solo exigible si el rol que ejecuta la migración podía alterarlo.
  select count(*) into n
    from pg_default_acl d, aclexplode(d.defaclacl) a
   where d.defaclrole = 'supabase_admin'::regrole and d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'r'
     and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
     and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN');
  if n > 0 then
    if pg_has_role(current_user, 'supabase_admin', 'member') then
      raise exception 'SEC-011 FALLA: los default privileges de supabase_admin en public aún dan escritura a anon/authenticated';
    end if;
    raise notice 'SEC-011 AVISO: % no puede alterar los default privileges de supabase_admin (quedan % entradas de escritura). Solo afectan a objetos creados por supabase_admin, no a las tablas de Nexo.', current_user, n;
  end if;

  -- 4) Prueba funcional: una tabla NUEVA creada ahora (por el rol actual) no nace con escritura para anon/authenticated.
  create table public.__sec011_probe (id integer);
  foreach r in array array['anon', 'authenticated'] loop
    foreach p in array writes loop
      if has_table_privilege(r, 'public.__sec011_probe', upper(p)) then
        raise exception 'SEC-011 FALLA: una tabla nueva nace con % para %', upper(p), r;
      end if;
    end loop;
  end loop;
  if has_table_privilege('service_role', 'public.__sec011_probe', 'INSERT') is not true
     or has_table_privilege('service_role', 'public.__sec011_probe', 'SELECT') is not true then
    raise exception 'SEC-011 FALLA: service_role no tiene acceso a una tabla nueva';
  end if;
end
$$;

select 'SEC-011 OK' as resultado;

rollback;
