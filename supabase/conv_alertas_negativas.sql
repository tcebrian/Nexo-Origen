-- Alertas de reseñas negativas por WhatsApp (Conversations): una fila por (reseña, contacto).
--
-- Guarda qué se hizo con cada alerta y sirve de cola de "pendientes":
--   pending    → el contacto aún no activó WhatsApp (o no se pudo entregar): se mostrará cuando pulse "Ver alerta".
--   notified   → ventana de 24 h cerrada: se envió la plantilla `alerta_negativa`; falta que pulse "Ver alerta".
--   delivering → entrega en curso (reserva anti doble pulsación).
--   delivered  → imagen + texto enviados (directos o tras "Ver alerta").
--   failed     → rechazo definitivo; no se reintenta solo.
-- `origen = 'prueba'` son envíos manuales del super_admin: no chocan con la unicidad de las alertas reales.
-- Aditiva e idempotente.

-- Enlace de la ficha del restaurante en Google Maps (opcional; si es NULL se construye con place_id).
alter table public.restaurantes add column if not exists google_maps_url text;

create table if not exists public.conv_alertas_negativas (
  id               uuid primary key default gen_random_uuid(),
  resena_id        bigint not null,
  contacto_id      uuid not null references public.conv_contactos(id) on delete cascade,
  restaurante_id   bigint not null,
  conversacion_id  uuid references public.conv_conversaciones(id) on delete set null,
  origen           text not null default 'real' check (origen in ('real', 'prueba')),
  status           text not null default 'reserved'
                   check (status in ('reserved', 'pending', 'notified', 'delivering', 'delivered', 'failed')),
  -- Cómo se entregó o se avisó: 'direct' (ventana abierta) o 'template' (ventana cerrada).
  via              text check (via in ('direct', 'template')),
  template_wamid   text,
  error_code       text,
  error_reason     text,
  created_at       timestamptz not null default now(),
  notified_at      timestamptz,
  delivered_at     timestamptz
);

create unique index if not exists conv_alertas_negativas_real_unique
  on public.conv_alertas_negativas (resena_id, contacto_id) where origen = 'real';
create index if not exists conv_alertas_negativas_contacto_status_idx
  on public.conv_alertas_negativas (contacto_id, status, created_at);
create index if not exists conv_alertas_negativas_wamid_idx
  on public.conv_alertas_negativas (template_wamid) where template_wamid is not null;

alter table public.conv_alertas_negativas enable row level security;

comment on table public.conv_alertas_negativas is
  'Alertas de reseña negativa por contacto de WhatsApp: estado de entrega y cola de pendientes. Solo servidor (service role).';
