-- Canonical per-restaurant motive breakdown for reputation reports.

create or replace function public.nexo_reputation_motives_breakdown(
  p_start date,
  p_end date,
  p_restaurant_ids bigint[] default null
)
returns table (
  restaurante_id bigint,
  categoria text,
  motivo_count bigint,
  restaurante_total_categorizadas bigint,
  restaurante_percent numeric,
  network_motivo_count bigint,
  network_total_categorizadas bigint,
  network_percent numeric
)
language sql
stable
set search_path = public
as $function$
with categorized as (
  select
    c.restaurante_id,
    upper(btrim(rm.categoria)) as categoria
  from public.nexo_canonical_reviews(
    least(p_start,p_end),
    greatest(p_start,p_end),
    p_restaurant_ids
  ) c
  join public.resena_motivos rm on rm.review_id=c.review_id
  where c.estrellas <= 3
    and rm.categoria is not null
    and btrim(rm.categoria)<>''
),
per_restaurant as (
  select restaurante_id,categoria,count(*)::bigint as motivo_count
  from categorized
  group by restaurante_id,categoria
),
restaurant_totals as (
  select restaurante_id,count(*)::bigint as total_categorizadas
  from categorized
  group by restaurante_id
),
network_counts as (
  select categoria,count(*)::bigint as motivo_count
  from categorized
  group by categoria
),
network_total as (
  select count(*)::bigint as total_categorizadas from categorized
)
select
  pr.restaurante_id,
  pr.categoria,
  pr.motivo_count,
  rt.total_categorizadas as restaurante_total_categorizadas,
  case when rt.total_categorizadas=0 then 0::numeric
       else (pr.motivo_count::numeric/rt.total_categorizadas)*100 end as restaurante_percent,
  nc.motivo_count as network_motivo_count,
  nt.total_categorizadas as network_total_categorizadas,
  case when nt.total_categorizadas=0 then 0::numeric
       else (nc.motivo_count::numeric/nt.total_categorizadas)*100 end as network_percent
from per_restaurant pr
join restaurant_totals rt using(restaurante_id)
join network_counts nc using(categoria)
cross join network_total nt
order by pr.restaurante_id,pr.motivo_count desc,pr.categoria;
$function$;

revoke all on function public.nexo_reputation_motives_breakdown(date,date,bigint[]) from public;
revoke all on function public.nexo_reputation_motives_breakdown(date,date,bigint[]) from anon;
revoke all on function public.nexo_reputation_motives_breakdown(date,date,bigint[]) from authenticated;
grant execute on function public.nexo_reputation_motives_breakdown(date,date,bigint[]) to service_role;

comment on function public.nexo_reputation_motives_breakdown(date,date,bigint[]) is
  'Canonical motive counts and percentages by restaurant and network for Nexo reports.';
