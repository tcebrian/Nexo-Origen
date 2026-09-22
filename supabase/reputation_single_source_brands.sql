-- Canonical brand aggregates for dashboards and reports.

create or replace function public.nexo_reputation_brand_metrics(
  p_start date,
  p_end date,
  p_restaurant_ids bigint[] default null
)
returns table (
  marca_id bigint,
  marca text,
  total_restaurantes bigint,
  total_resenas bigint,
  rating_sum numeric,
  media_exacta numeric,
  positivas bigint,
  neutras bigint,
  negativas bigint,
  atencion bigint,
  positive_pct numeric,
  negative_pct numeric,
  on_target_count bigint,
  watch_count bigint,
  critical_count bigint
)
language sql
stable
set search_path = public
as $function$
with scoped as (
  select
    m.id as marca_id,
    m.nombre as marca,
    r.id as restaurante_id
  from public.restaurantes r
  join public.marcas m on m.id=r.marca_id
  where coalesce(r.activo,true)=true
    and (p_restaurant_ids is null or r.id=any(p_restaurant_ids))
),
per_rest as (
  select
    s.marca_id,
    s.marca,
    s.restaurante_id,
    pm.total_resenas,
    pm.rating_sum,
    pm.positivas,
    pm.neutras,
    pm.negativas,
    pm.atencion,
    pm.operational_status
  from scoped s
  join public.nexo_reputation_period_metrics(
    least(p_start,p_end),
    greatest(p_start,p_end),
    p_restaurant_ids
  ) pm on pm.restaurante_id=s.restaurante_id
)
select
  pr.marca_id,
  pr.marca,
  count(*)::bigint as total_restaurantes,
  sum(pr.total_resenas)::bigint as total_resenas,
  sum(pr.rating_sum)::numeric as rating_sum,
  case when sum(pr.total_resenas)=0 then 0::numeric
       else sum(pr.rating_sum)/sum(pr.total_resenas) end as media_exacta,
  sum(pr.positivas)::bigint as positivas,
  sum(pr.neutras)::bigint as neutras,
  sum(pr.negativas)::bigint as negativas,
  sum(pr.atencion)::bigint as atencion,
  case when sum(pr.total_resenas)=0 then 0::numeric
       else (sum(pr.positivas)::numeric/sum(pr.total_resenas))*100 end as positive_pct,
  case when sum(pr.total_resenas)=0 then 0::numeric
       else (sum(pr.negativas)::numeric/sum(pr.total_resenas))*100 end as negative_pct,
  count(*) filter(where pr.operational_status='on_target')::bigint as on_target_count,
  count(*) filter(where pr.operational_status='watch')::bigint as watch_count,
  count(*) filter(where pr.operational_status='critical')::bigint as critical_count
from per_rest pr
group by pr.marca_id,pr.marca
order by pr.marca;
$function$;

revoke all on function public.nexo_reputation_brand_metrics(date,date,bigint[]) from public;
revoke all on function public.nexo_reputation_brand_metrics(date,date,bigint[]) from anon;
revoke all on function public.nexo_reputation_brand_metrics(date,date,bigint[]) from authenticated;
grant execute on function public.nexo_reputation_brand_metrics(date,date,bigint[]) to service_role;

comment on function public.nexo_reputation_brand_metrics(date,date,bigint[]) is
  'Canonical reputation aggregates grouped by brand for dashboards and reports.';
