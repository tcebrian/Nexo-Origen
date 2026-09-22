-- Centralize reputation targets in public.marcas and make canonical
-- restaurant status use the brand target instead of a hardcoded 4.4.

update public.marcas
set objetivo_media = 4.7
where lower(btrim(nombre)) = 'vault';

create or replace function public.nexo_reputation_period_metrics(
  p_start date,
  p_end date,
  p_restaurant_ids bigint[] default null
)
returns table (
  restaurante_id bigint,
  total_resenas bigint,
  rating_sum numeric,
  media_exacta numeric,
  positivas bigint,
  neutras bigint,
  negativas bigint,
  atencion bigint,
  stars_1 bigint,
  stars_2 bigint,
  stars_3 bigint,
  stars_4 bigint,
  stars_5 bigint,
  ultima_resena timestamptz,
  operational_status text,
  source text,
  network_total_resenas bigint,
  network_rating_sum numeric,
  network_media_exacta numeric,
  network_positivas bigint,
  network_neutras bigint,
  network_negativas bigint,
  network_atencion bigint,
  network_total_restaurantes bigint,
  network_positive_pct numeric,
  network_negative_pct numeric,
  network_ultima_resena timestamptz
)
language sql
stable
set search_path = public
as $function$
with params as (
  select least(p_start,p_end) as start_date,
         greatest(p_start,p_end) as end_date
),
scoped_restaurants as (
  select
    r.id,
    coalesce(m.objetivo_media,4.4)::numeric as objetivo_media
  from public.restaurantes r
  left join public.marcas m on m.id=r.marca_id
  where coalesce(r.activo,true)=true
    and (p_restaurant_ids is null or r.id=any(p_restaurant_ids))
),
canonical as (
  select c.*
  from params p
  cross join lateral public.nexo_canonical_reviews(
    p.start_date,
    p.end_date,
    p_restaurant_ids
  ) c
),
per_review as (
  select
    c.restaurante_id,
    count(*)::bigint as total_resenas,
    coalesce(sum(c.estrellas),0)::numeric as rating_sum,
    count(*) filter(where c.estrellas>=4)::bigint as positivas,
    count(*) filter(where c.estrellas=3)::bigint as neutras,
    count(*) filter(where c.estrellas<=2)::bigint as negativas,
    count(*) filter(where c.estrellas<=3)::bigint as atencion,
    count(*) filter(where c.estrellas=1)::bigint as stars_1,
    count(*) filter(where c.estrellas=2)::bigint as stars_2,
    count(*) filter(where c.estrellas=3)::bigint as stars_3,
    count(*) filter(where c.estrellas=4)::bigint as stars_4,
    count(*) filter(where c.estrellas>=5)::bigint as stars_5,
    max(c.original_ts at time zone 'Europe/Madrid') as ultima_resena
  from canonical c
  group by c.restaurante_id
),
per_restaurant as (
  select
    sr.id as restaurante_id,
    sr.objetivo_media,
    coalesce(pr.total_resenas,0)::bigint as total_resenas,
    coalesce(pr.rating_sum,0)::numeric as rating_sum,
    coalesce(pr.positivas,0)::bigint as positivas,
    coalesce(pr.neutras,0)::bigint as neutras,
    coalesce(pr.negativas,0)::bigint as negativas,
    coalesce(pr.atencion,0)::bigint as atencion,
    coalesce(pr.stars_1,0)::bigint as stars_1,
    coalesce(pr.stars_2,0)::bigint as stars_2,
    coalesce(pr.stars_3,0)::bigint as stars_3,
    coalesce(pr.stars_4,0)::bigint as stars_4,
    coalesce(pr.stars_5,0)::bigint as stars_5,
    pr.ultima_resena,
    case when coalesce(pr.total_resenas,0)=0 then 0::numeric
         else pr.rating_sum/pr.total_resenas end as media_exacta,
    case
      when coalesce(pr.total_resenas,0)=0 then 'watch'
      when (pr.rating_sum/pr.total_resenas)>=sr.objetivo_media then 'on_target'
      when (pr.rating_sum/pr.total_resenas)>=4.0 then 'watch'
      else 'critical'
    end as operational_status
  from scoped_restaurants sr
  left join per_review pr on pr.restaurante_id=sr.id
),
network as (
  select
    coalesce(sum(pr.total_resenas),0)::bigint as total_resenas,
    coalesce(sum(pr.rating_sum),0)::numeric as rating_sum,
    coalesce(sum(pr.positivas),0)::bigint as positivas,
    coalesce(sum(pr.neutras),0)::bigint as neutras,
    coalesce(sum(pr.negativas),0)::bigint as negativas,
    coalesce(sum(pr.atencion),0)::bigint as atencion,
    count(*)::bigint as total_restaurantes,
    max(pr.ultima_resena) as ultima_resena
  from per_restaurant pr
)
select
  pr.restaurante_id,
  pr.total_resenas,
  pr.rating_sum,
  pr.media_exacta,
  pr.positivas,
  pr.neutras,
  pr.negativas,
  pr.atencion,
  pr.stars_1,
  pr.stars_2,
  pr.stars_3,
  pr.stars_4,
  pr.stars_5,
  pr.ultima_resena,
  pr.operational_status,
  case when n.total_resenas>0 then 'resenas' else 'empty' end as source,
  n.total_resenas,
  n.rating_sum,
  case when n.total_resenas=0 then 0::numeric else n.rating_sum/n.total_resenas end,
  n.positivas,
  n.neutras,
  n.negativas,
  n.atencion,
  n.total_restaurantes,
  case when n.total_resenas=0 then 0::numeric else (n.positivas::numeric/n.total_resenas)*100 end,
  case when n.total_resenas=0 then 0::numeric else (n.negativas::numeric/n.total_resenas)*100 end,
  n.ultima_resena
from per_restaurant pr
cross join network n
order by pr.restaurante_id;
$function$;

revoke all on function public.nexo_reputation_period_metrics(date,date,bigint[]) from public,anon,authenticated;
grant execute on function public.nexo_reputation_period_metrics(date,date,bigint[]) to service_role;
