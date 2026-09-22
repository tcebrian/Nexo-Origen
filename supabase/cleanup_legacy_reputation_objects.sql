-- FINAL LEGACY CLEANUP
--
-- IMPORTANT: apply ONLY after the new production deployment is green.
-- The application must already be reading:
--   restaurantes + marcas
--   resenas
--   resena_motivos
--   nexo_reputation_period_metrics(...)
--   nexo_review_rating_impacts(...)
--   nexo_reputation_period_motives(...)
--
-- No CASCADE is used intentionally. If an unexpected dependency remains,
-- PostgreSQL must stop the migration instead of deleting it silently.

drop view if exists public.motivos_diarios;
drop view if exists public.motivos_semanales;
drop view if exists public.motivos_mensuales;
drop view if exists public.v_motivos_base;

drop view if exists public.dashboard_kpis;
drop view if exists public.dashboard_restaurantes;
drop view if exists public.kpi_marcas;
drop view if exists public.kpi_restaurantes;

drop function if exists public.actualizar_kpi_semana_actual();
drop function if exists public.get_kpis_periodo(bigint,date,date);

drop table if exists public.kpi_semana_actual;
drop table if exists public.kpi_semanal;
drop table if exists public.kpi_mensual;
drop table if exists public.kpi_diario;

comment on function public.nexo_reputation_period_metrics(date,date,bigint[]) is
  'Single canonical numeric reputation KPI source for Nexo. Reads canonical review facts only.';
comment on function public.nexo_review_rating_impacts(bigint[]) is
  'Canonical historical before/after rating impact for review images and alerts.';
comment on function public.nexo_reputation_period_motives(date,date,bigint[]) is
  'Canonical motive distribution from resena_motivos for the selected period/scope.';
