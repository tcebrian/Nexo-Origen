-- SEC-001 — La clave pública `anon` (y cualquier sesión `authenticated`) NO debe leer datos de negocio.
--
-- Problema: políticas `Allow anon read *` con USING (true) y privilegios de tabla/vista/función concedidos a
-- `anon` y `authenticated` permitían leer reseñas, restaurantes, marcas y KPIs de TODAS las empresas con solo la
-- clave pública del navegador, saltándose el alcance multiempresa de la aplicación (session.scope).
--
-- Decisión: el servidor accede siempre con service role (que ignora RLS y conserva todos sus privilegios), y el
-- navegador solo usa Supabase Auth + lectura de su propia fila de `perfiles`. Por tanto:
--   * `anon` y `authenticated` pierden TODO acceso directo a estas tablas, vistas y RPC de métricas.
--   * Las vistas pasan a `security_invoker = true`: aunque alguien volviera a concederles acceso, la vista
--     aplicaría los permisos y la RLS de quien consulta y NO sería un bypass de RLS (antes corrían como `postgres`).
--
-- NO toca: `perfiles` (conserva `perfiles_select_own` y sus privilegios), `service_role`, ni las funciones
-- `nexo_call_daily_report_cron` / `nexo_notify_negative_review_alert` (SEC-005). No modifica datos.
-- Idempotente. Reversible con `sec_001_revoke_anon_data_access_rollback.sql`.

begin;

-- 1) Políticas públicas -------------------------------------------------------------------------------
drop policy if exists "Allow anon read resenas" on public.resenas;
drop policy if exists "Allow anon read restaurantes" on public.restaurantes;
drop policy if exists "Allow anon read marcas" on public.marcas;
drop policy if exists "Allow anon read kpi_diario" on public.kpi_diario;
drop policy if exists "Allow anon read kpi_semanal" on public.kpi_semanal;
drop policy if exists "Allow anon read kpi_mensual" on public.kpi_mensual;

-- 2) Privilegios directos de tablas y vistas ---------------------------------------------------------------
-- Las vistas se tratan igual: sin acceso para `anon`/`authenticated` y, además, `security_invoker`.
do $$
declare
  tbl text;
  vw  text;
begin
  foreach tbl in array array['resenas', 'restaurantes', 'marcas', 'kpi_diario', 'kpi_semanal', 'kpi_mensual'] loop
    if to_regclass(format('public.%I', tbl)) is not null then
      execute format('revoke all on table public.%I from public, anon, authenticated', tbl);
    end if;
  end loop;

  foreach vw in array array[
    'dashboard_kpis', 'dashboard_restaurantes', 'kpi_marcas', 'kpi_restaurantes', 'resumen_restaurantes',
    'v_motivos_base', 'motivos_diarios', 'motivos_semanales', 'motivos_mensuales'
  ] loop
    if to_regclass(format('public.%I', vw)) is not null then
      execute format('alter view public.%I set (security_invoker = true)', vw);
      execute format('revoke all on table public.%I from public, anon, authenticated', vw);
    end if;
  end loop;
end
$$;

-- 3) RPC de métricas ------------------------------------------------------------------------------------
-- `public` también debe perder EXECUTE: es el privilegio por defecto de las funciones y `anon` lo hereda.
revoke execute on function public.get_kpis_periodo(bigint, date, date) from public, anon, authenticated;
revoke execute on function public.nexo_window_reviews(timestamp, timestamp, bigint[]) from public, anon, authenticated;
revoke execute on function public.nexo_reputation_window_metrics(timestamp, timestamp, bigint[]) from public, anon, authenticated;

-- El servidor (service role) conserva el acceso. Idempotente: ya lo tenía.
grant execute on function public.get_kpis_periodo(bigint, date, date) to service_role;
grant execute on function public.nexo_window_reviews(timestamp, timestamp, bigint[]) to service_role;
grant execute on function public.nexo_reputation_window_metrics(timestamp, timestamp, bigint[]) to service_role;

commit;
