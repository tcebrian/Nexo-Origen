
drop function if exists public.nexo_reputation_daily_metrics(date,date,bigint[]);

create function public.nexo_reputation_daily_metrics(
  p_start date,
  p_end date,
  p_restaurant_ids bigint[] default null
)
returns table (
  fecha date,
  restaurante_id bigint,
  total_resenas bigint,
  rating_sum numeric,
  media_exacta numeric,
  positivas bigint,
  neutras bigint,
  negativas bigint,
  atencion bigint,
  network_total_resenas bigint,
  network_rating_sum numeric,
  network_media_exacta numeric,
  network_positivas bigint,
  network_neutras bigint,
  network_negativas bigint,
  network_atencion bigint
)
language sql
stable
set search_path = public
as $function$
with per_restaurant_day as (
  select
    c.activity_date as fecha,
    c.restaurante_id,
    count(*)::bigint as total_resenas,
    sum(c.estrellas)::numeric as rating_sum,
    avg(c.estrellas)::numeric as media_exacta,
    count(*) filter(where c.estrellas >= 4)::bigint as positivas,
    count(*) filter(where c.estrellas = 3)::bigint as neutras,
    count(*) filter(where c.estrellas <= 2)::bigint as negativas,
    count(*) filter(where c.estrellas <= 3)::bigint as atencion
  from public.nexo_canonical_reviews(
    least(p_start,p_end),
    greatest(p_start,p_end),
    p_restaurant_ids
  ) c
  group by c.activity_date,c.restaurante_id
),
network_day as (
  select
    prd.fecha,
    sum(prd.total_resenas)::bigint as total_resenas,
    sum(prd.rating_sum)::numeric as rating_sum,
    case when sum(prd.total_resenas)=0 then 0::numeric else sum(prd.rating_sum)/sum(prd.total_resenas) end as media_exacta,
    sum(prd.positivas)::bigint as positivas,
    sum(prd.neutras)::bigint as neutras,
    sum(prd.negativas)::bigint as negativas,
    sum(prd.atencion)::bigint as atencion
  from per_restaurant_day prd
  group by prd.fecha
)
select
  prd.fecha,
  prd.restaurante_id,
  prd.total_resenas,
  prd.rating_sum,
  prd.media_exacta,
  prd.positivas,
  prd.neutras,
  prd.negativas,
  prd.atencion,
  nd.total_resenas as network_total_resenas,
  nd.rating_sum as network_rating_sum,
  nd.media_exacta as network_media_exacta,
  nd.positivas as network_positivas,
  nd.neutras as network_neutras,
  nd.negativas as network_negativas,
  nd.atencion as network_atencion
from per_restaurant_day prd
join network_day nd on nd.fecha=prd.fecha
order by prd.fecha,prd.restaurante_id;
$function$;

revoke all on function public.nexo_reputation_daily_metrics(date,date,bigint[]) from public;
revoke all on function public.nexo_reputation_daily_metrics(date,date,bigint[]) from anon;
revoke all on function public.nexo_reputation_daily_metrics(date,date,bigint[]) from authenticated;
grant execute on function public.nexo_reputation_daily_metrics(date,date,bigint[]) to service_role;

comment on function public.nexo_reputation_daily_metrics(date,date,bigint[]) is
  'Official per-restaurant and network daily reputation metrics from the canonical review stream.';
