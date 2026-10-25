-- SEC-011 — `anon` y `authenticated` NO deben tener privilegios de escritura ni de administración sobre tablas de negocio.
--
-- Estado confirmado en producción (PostgreSQL 17.6): en 16 tablas con RLS activado, `anon` y `authenticated` tienen
-- INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER y MAINTAIN (además de SELECT). Hoy la única barrera es RLS (sin
-- políticas de escritura = denegado), pero un privilegio sobrante basta para que una política mal puesta mañana abra la
-- escritura, y TRUNCATE/MAINTAIN ni siquiera pasan por RLS. Además, las tablas NUEVAS en `public` volvían a nacer con
-- esos mismos privilegios por los DEFAULT PRIVILEGES de `postgres` y `supabase_admin`.
--
-- Modelo: el navegador solo usa Supabase Auth y LEE su propia fila de `perfiles` (`perfiles_select_own`). Toda
-- escritura de negocio la hace el servidor con `service_role` / `postgres` / funciones y triggers internos. No hay
-- escrituras directas del navegador a estas tablas (comprobado en el código).
--
-- Qué hace:
--   1) Retira SOLO INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER y MAINTAIN a anon y authenticated en las 16 tablas.
--   2) Cambia los DEFAULT PRIVILEGES de TABLAS en `public` (propietarios `postgres` y `supabase_admin`) para que las
--      tablas nuevas tampoco nazcan con esos privilegios para anon/authenticated.
--
-- Qué NO hace: no usa REVOKE ALL; no retira SELECT (ni el de `authenticated` sobre `perfiles`, que debe seguir
-- funcionando con `perfiles_select_own`); no toca `service_role` ni `postgres`; no cambia RLS, políticas ni datos; no toca
-- funciones, secuencias, Storage, GraphQL ni Realtime. El SELECT que `anon`/`authenticated` conservan en estas tablas
-- (denegado por RLS al no haber política) y el de las tablas nuevas quedan para una fase posterior.
--
-- ANTES DE APLICAR en producción hay que comprobar los flujos externos que escriben en estas tablas (Make, ingesta de
-- reseñas, `analisis_ia`, `alertas_enviadas`, cualquier otro): deben usar una clave de servidor, nunca la clave `anon`.
-- (En los logs recientes, las escrituras de Make a `analisis_ia` y `alertas_enviadas` se aceptaron con una clave sin rol
-- anon/authenticated, lo que apunta a una clave de servidor; confirmarlo antes de aplicar.)
--
-- NOTA sobre `supabase_admin`: `postgres` NO es miembro de `supabase_admin`, así que PostgreSQL no le permite alterar los
-- default privileges de ese rol. El bloque correspondiente se ejecuta solo si el rol que aplica la migración puede
-- hacerlo; si no, avisa con NOTICE y sigue. Las tablas de negocio las crea `postgres`, que es el caso que importa.
--
-- Idempotente. Reversible con `sec_011_revoke_write_privileges_rollback.sql`. Verificación: `sec_011_verify.sql`.

begin;

-- 1) Tablas existentes (16) -----------------------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger, maintain on table public.alertas_enviadas from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.analisis_ia from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.conv_alertas_negativas from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.conv_informe_envios from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.empresas from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.kpi_semana_actual from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.nexo_bot_resumenes_envios from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.nexo_metric_validation_events from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.perfiles from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.resena_motivos from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.resenas_historial from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.restaurante_fuente_aliases from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.restaurante_integraciones from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.review_identity_shadow_events from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.usuario_marcas from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger, maintain on table public.usuario_restaurantes from anon, authenticated;

-- 2) DEFAULT PRIVILEGES de tablas nuevas en `public` --------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger, maintain on tables from anon, authenticated;

do $$
begin
  if pg_has_role(current_user, 'supabase_admin', 'member') then
    alter default privileges for role supabase_admin in schema public
      revoke insert, update, delete, truncate, references, trigger, maintain on tables from anon, authenticated;
  else
    raise notice 'SEC-011: % no es miembro de supabase_admin; sus default privileges de public no se pueden cambiar desde aquí (solo afectan a objetos creados por supabase_admin).', current_user;
  end if;
end
$$;

commit;
