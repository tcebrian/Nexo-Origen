-- Canonical restaurant catalog for Nexo reputation.
-- Replaces kpi_restaurantes as a metadata source.

create or replace function public.nexo_reputation_restaurant_catalog(
  p_restaurant_ids bigint[] default null
)
returns table (
  restaurante_id bigint,
  restaurante text,
  ciudad text,
  direccion text,
  marca_id bigint,
  marca text,
  empresa_id bigint,
  empresa text,
  media_google numeric,
  total_resenas_google integer,
  ultima_actualizacion_google timestamp without time zone,
  place_id text,
  objetivo_media numeric,
  activo boolean
)
language sql
stable
set search_path = public
as $function$
select
  r.id as restaurante_id,
  r.nombre as restaurante,
  coalesce(r.ciudad,'') as ciudad,
  coalesce(r.direccion,'') as direccion,
  r.marca_id,
  coalesce(m.nombre,'') as marca,
  r.empresa_id,
  coalesce(e.nombre,'') as empresa,
  r.media_google,
  r.total_resenas_google,
  r.ultima_actualizacion_google,
  r.place_id,
  coalesce(m.objetivo_media,4.4) as objetivo_media,
  coalesce(r.activo,true) as activo
from public.restaurantes r
left join public.marcas m on m.id=r.marca_id
left join public.empresas e on e.id=r.empresa_id
where coalesce(r.activo,true)=true
  and (p_restaurant_ids is null or r.id=any(p_restaurant_ids))
order by r.id;
$function$;

revoke all on function public.nexo_reputation_restaurant_catalog(bigint[]) from public;
revoke all on function public.nexo_reputation_restaurant_catalog(bigint[]) from anon;
revoke all on function public.nexo_reputation_restaurant_catalog(bigint[]) from authenticated;
grant execute on function public.nexo_reputation_restaurant_catalog(bigint[]) to service_role;

comment on function public.nexo_reputation_restaurant_catalog(bigint[]) is
  'Canonical active restaurant metadata for Nexo. Replaces legacy kpi_restaurantes as a catalog source.';
