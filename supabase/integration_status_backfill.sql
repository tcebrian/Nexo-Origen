
-- Backfill integration status from evidence already present in production.

insert into public.restaurante_integraciones (
  restaurante_id,
  provider,
  status,
  external_ref,
  config,
  last_sync_at,
  created_at,
  updated_at
)
select
  r.id,
  'google_maps',
  'connected',
  r.place_id,
  '{}'::jsonb,
  r.ultima_actualizacion_google at time zone 'Europe/Madrid',
  now(),
  now()
from public.restaurantes r
where r.activo = true
  and r.place_id is not null
  and btrim(r.place_id) <> ''
on conflict (restaurante_id, provider)
do update set
  status = excluded.status,
  external_ref = excluded.external_ref,
  last_sync_at = coalesce(excluded.last_sync_at, public.restaurante_integraciones.last_sync_at),
  updated_at = now();

insert into public.restaurante_integraciones (
  restaurante_id,
  provider,
  status,
  external_ref,
  config,
  last_sync_at,
  created_at,
  updated_at
)
select
  r.id,
  'apify',
  'connected',
  r.place_id,
  jsonb_build_object('evidence', 'historical_resenas_fuente_apify'),
  max(s.created_at) at time zone 'Europe/Madrid',
  now(),
  now()
from public.restaurantes r
join public.resenas s
  on s.restaurante_id = r.id
 and lower(coalesce(s.fuente, '')) like '%apify%'
where r.activo = true
group by r.id, r.place_id
on conflict (restaurante_id, provider)
do update set
  status = case
    when public.restaurante_integraciones.status = 'pending' then 'connected'
    else public.restaurante_integraciones.status
  end,
  external_ref = coalesce(public.restaurante_integraciones.external_ref, excluded.external_ref),
  last_sync_at = greatest(
    coalesce(public.restaurante_integraciones.last_sync_at, excluded.last_sync_at),
    excluded.last_sync_at
  ),
  config = public.restaurante_integraciones.config || excluded.config,
  updated_at = now();
