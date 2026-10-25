-- Verificación de SEC-006 (contador de frecuencia). Termina en ROLLBACK: no deja ni una fila.
-- Ejecutar DESPUÉS de aplicar `sec_006_rate_limit.sql`, como `postgres`. "SEC-006 OK" si todo es correcto.

begin;

do $$
declare
  r record;
  n integer;
begin
  -- Permisos: solo service_role.
  if has_function_privilege('anon', 'public.nexo_rate_limit_hit(text,integer,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.nexo_rate_limit_hit(text,integer,integer)', 'execute') then
    raise exception 'SEC-006 FALLA: anon/authenticated ejecutan nexo_rate_limit_hit';
  end if;
  if has_function_privilege('service_role', 'public.nexo_rate_limit_hit(text,integer,integer)', 'execute') is not true then
    raise exception 'SEC-006 FALLA: service_role no ejecuta nexo_rate_limit_hit';
  end if;
  if has_table_privilege('anon', 'public.api_rate_limits', 'select')
     or has_table_privilege('authenticated', 'public.api_rate_limits', 'select') then
    raise exception 'SEC-006 FALLA: anon/authenticated leen api_rate_limits';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.api_rate_limits'::regclass) then
    raise exception 'SEC-006 FALLA: api_rate_limits sin RLS';
  end if;

  -- Comportamiento: límite 3 -> 3 permitidas y la 4ª denegada; otro cubo no se ve afectado.
  for n in 1..3 loop
    select * into r from public.nexo_rate_limit_hit('verify-sec006-a', 3, 60);
    if r.allowed is not true then raise exception 'SEC-006 FALLA: la petición % debería permitirse', n; end if;
  end loop;
  select * into r from public.nexo_rate_limit_hit('verify-sec006-a', 3, 60);
  if r.allowed or r.retry_after_seconds < 1 or r.retry_after_seconds > 60 then
    raise exception 'SEC-006 FALLA: la 4ª petición debería denegarse con Retry-After 1..60';
  end if;
  select * into r from public.nexo_rate_limit_hit('verify-sec006-b', 3, 60);
  if r.allowed is not true then raise exception 'SEC-006 FALLA: un cubo ajeno consumió el cupo'; end if;
end
$$;

select 'SEC-006 OK' as resultado;

rollback;
