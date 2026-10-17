-- Alertas negativas por contacto: interruptor "Reseñas negativas" de la ficha del contacto.
--
-- true  → el contacto puede recibir automáticamente por WhatsApp las reseñas de 1★ y 2★, SOLO de los
--         restaurantes a los que ya tiene acceso (conv_contacto_empresas / conv_contacto_restaurantes).
-- false → no recibe ninguna alerta negativa automática ni se le crea alerta pendiente.
-- NUNCA concede acceso a restaurantes y no afecta al informe diario ni al bot. Por defecto desactivado.
-- Aditiva e idempotente.
alter table public.conv_contactos
  add column if not exists recibir_alertas_negativas boolean not null default false;

comment on column public.conv_contactos.recibir_alertas_negativas is
  'Recibir automáticamente por WhatsApp las reseñas 1★/2★ de sus restaurantes. No concede acceso: el alcance sale de conv_contacto_empresas/conv_contacto_restaurantes.';
