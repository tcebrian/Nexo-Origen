-- Informe diario: pruebas manuales sin tocar la idempotencia del job real.
--
-- `origen` distingue los envíos del job de las 09:00 ('job') de las pruebas manuales desde Conversaciones
-- ('prueba'). La unicidad (contacto, día, plantilla) pasa a ser un índice único PARCIAL solo para 'job':
-- el job sigue sin poder mandar dos plantillas del mismo slot al mismo contacto, y una prueba manual crea
-- su propia fila (con su snapshot y su wamid) sin colisionar con el informe real ni con otras pruebas.
-- Las filas de prueba no cuentan como "ya enviado" para el job. Aditiva; la tabla estaba vacía.

alter table public.conv_informe_envios
  add column if not exists origen text not null default 'job' check (origen in ('job', 'prueba'));

alter table public.conv_informe_envios drop constraint if exists conv_informe_envios_contacto_slot_template_key;

create unique index if not exists conv_informe_envios_job_unique
  on public.conv_informe_envios (contacto_id, slot_date, template)
  where origen = 'job';

comment on column public.conv_informe_envios.origen is
  'job = envío real de las 09:00 (único por contacto, día y plantilla); prueba = envío manual desde Conversaciones.';
