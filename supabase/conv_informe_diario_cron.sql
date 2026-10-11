-- Informe diario de Nexo: cron de Supabase (pg_cron + pg_net). NO se aplica solo: necesita la URL de producción
-- y el secreto, que no deben vivir en el repositorio. Ejecútalo UNA vez en el SQL Editor sustituyendo los
-- valores marcados, o guarda el secreto en Vault y léelo desde ahí.
--
-- Cómo funciona:
--   · pg_cron trabaja en UTC. Las 09:00 de Madrid son las 07:00 UTC en verano (CEST) y las 08:00 UTC en
--     invierno (CET). Se programa en los dos tramos (07:00–08:59 UTC) varias veces.
--   · La ruta /api/cron/informe-diario decide: solo actúa cuando en Madrid son las 09:00–11:59, usa SIEMPRE
--     el slot lógico de las 09:00 y es idempotente por (contacto, día, plantilla). Las ejecuciones de más
--     son inofensivas (no envían nada) y las que llegan tarde recogen lo que quedó pendiente.
--   · Nada depende de que la ejecución real caiga exactamente a las 09:00.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Sustituye <URL_PRODUCCION> (p. ej. https://app.nexoorigen.com) y <CRON_SECRET> (el mismo valor que
-- CRON_SECRET en Vercel; mínimo 16 caracteres).
select cron.schedule(
  'nexo-informe-diario',
  '0,10,20,30,40,50 7,8 * * *',
  $$
  select net.http_post(
    url := '<URL_PRODUCCION>/api/cron/informe-diario',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <CRON_SECRET>'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- Para pausarlo:   select cron.unschedule('nexo-informe-diario');
-- Para ver ejecuciones:   select * from cron.job_run_details order by start_time desc limit 20;
