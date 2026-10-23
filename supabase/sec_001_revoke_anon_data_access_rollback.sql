-- ROLLBACK de SEC-001. Devuelve el estado anterior a `sec_001_revoke_anon_data_access.sql`.
--
-- ADVERTENCIA: esto REABRE SEC-001 (cualquiera con la clave pública `anon` vuelve a leer reseñas, restaurantes,
-- marcas y KPIs de todas las empresas). Úsalo solo como medida de emergencia si una integración externa se rompe,
-- y vuelve a aplicar la migración en cuanto esa integración use una clave de servidor.
-- Estado restaurado (el que se observó en producción): políticas `Allow anon read *` con USING (true), todos los
-- privilegios de tabla/vista para `anon` y `authenticated`, vistas sin `security_invoker`, y EXECUTE para
-- public/anon/authenticated en los tres RPC.

begin;

create policy "Allow anon read resenas" on public.resenas for select to anon using (true);
create policy "Allow anon read restaurantes" on public.restaurantes for select to anon using (true);
create policy "Allow anon read marcas" on public.marcas for select to anon using (true);
create policy "Allow anon read kpi_diario" on public.kpi_diario for select to anon using (true);
create policy "Allow anon read kpi_semanal" on public.kpi_semanal for select to anon using (true);
create policy "Allow anon read kpi_mensual" on public.kpi_mensual for select to anon using (true);

do $$
declare
  rel text;
  vw  text;
begin
  foreach rel in array array['resenas', 'restaurantes', 'marcas', 'kpi_diario', 'kpi_semanal', 'kpi_mensual'] loop
    if to_regclass(format('public.%I', rel)) is not null then
      execute format('grant all on table public.%I to anon, authenticated', rel);
    end if;
  end loop;

  foreach vw in array array[
    'dashboard_kpis', 'dashboard_restaurantes', 'kpi_marcas', 'kpi_restaurantes', 'resumen_restaurantes',
    'v_motivos_base', 'motivos_diarios', 'motivos_semanales', 'motivos_mensuales'
  ] loop
    if to_regclass(format('public.%I', vw)) is not null then
      execute format('alter view public.%I reset (security_invoker)', vw);
      execute format('grant all on table public.%I to anon, authenticated', vw);
    end if;
  end loop;
end
$$;

grant execute on function public.get_kpis_periodo(bigint, date, date) to public, anon, authenticated;
grant execute on function public.nexo_window_reviews(timestamp, timestamp, bigint[]) to public, anon, authenticated;
grant execute on function public.nexo_reputation_window_metrics(timestamp, timestamp, bigint[]) to public, anon, authenticated;

commit;
