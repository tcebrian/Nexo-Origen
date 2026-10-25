-- ROLLBACK de SEC-011.  >>> ESTO REABRE SEC-011 <<<
--
-- Devuelve a `anon` y `authenticated` EXACTAMENTE los privilegios que la migración retiró (INSERT, UPDATE, DELETE,
-- TRUNCATE, REFERENCES, TRIGGER y MAINTAIN) en las 16 tablas, y restaura los default privileges de tablas en `public`
-- de `postgres` y `supabase_admin`. No usa GRANT ALL ni toca SELECT, `service_role`, RLS, políticas ni datos.
-- Úsalo solo como emergencia (p. ej. si una integración externa que escribía con la clave `anon` se rompe) y vuelve a
-- aplicar la migración en cuanto esa integración use una clave de servidor.

begin;

grant insert, update, delete, truncate, references, trigger, maintain on table public.alertas_enviadas to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.analisis_ia to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.conv_alertas_negativas to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.conv_informe_envios to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.empresas to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.kpi_semana_actual to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.nexo_bot_resumenes_envios to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.nexo_metric_validation_events to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.perfiles to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.resena_motivos to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.resenas_historial to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.restaurante_fuente_aliases to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.restaurante_integraciones to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.review_identity_shadow_events to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.usuario_marcas to anon, authenticated;
grant insert, update, delete, truncate, references, trigger, maintain on table public.usuario_restaurantes to anon, authenticated;

alter default privileges for role postgres in schema public
  grant insert, update, delete, truncate, references, trigger, maintain on tables to anon, authenticated;

do $$
begin
  if pg_has_role(current_user, 'supabase_admin', 'member') then
    alter default privileges for role supabase_admin in schema public
      grant insert, update, delete, truncate, references, trigger, maintain on tables to anon, authenticated;
  else
    raise notice 'SEC-011 rollback: % no es miembro de supabase_admin; sus default privileges no se tocaron (la migración tampoco pudo cambiarlos).', current_user;
  end if;
end
$$;

commit;
