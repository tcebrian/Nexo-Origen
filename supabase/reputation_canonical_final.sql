-- Final canonical reputation layer.
-- Base facts live in resenas/restaurantes/marcas/resena_motivos.
-- All deterministic reputation math is owned by Supabase/PostgreSQL.

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
  select least(p_start, p_end) as start_date,
         greatest(p_start, p_end) as end_date
),
scoped_restaurants as (
  select r.id
  from public.restaurantes r
  where r.activo = true
    and (p_restaurant_ids is null or r.id = any(p_restaurant_ids))
),
raw_reviews as (
  select
    s.id,
    nullif(btrim(s.review_id), '') as review_id,
    s.restaurante_id,
    s.restaurante_nombre,
    s.autor,
    s.estrellas,
    s.comentario,
    coalesce(s.fecha_resena, s.created_at) as original_ts,
    coalesce(s.fecha_resena, s.created_at)::date as original_date,
    case
      when s.editada is true and s.fecha_ultima_edicion is not null
        then (s.fecha_ultima_edicion at time zone 'Europe/Madrid')::date
      else coalesce(s.fecha_resena, s.created_at)::date
    end as activity_date,
    lower(regexp_replace(btrim(coalesce(s.restaurante_nombre, '')), '\s+', ' ', 'g')) as restaurant_name_norm,
    lower(regexp_replace(btrim(coalesce(s.autor, '')), '\s+', ' ', 'g')) as author_norm,
    lower(regexp_replace(btrim(coalesce(s.comentario, '')), '\s+', ' ', 'g')) as comment_norm
  from public.resenas s
  join scoped_restaurants sr on sr.id = s.restaurante_id
  cross join params p
  where (
    case
      when s.editada is true and s.fecha_ultima_edicion is not null
        then (s.fecha_ultima_edicion at time zone 'Europe/Madrid')::date
      else coalesce(s.fecha_resena, s.created_at)::date
    end
  ) between p.start_date and p.end_date
),
dedupe_review_id as (
  select *
  from (
    select
      rr.*,
      row_number() over (
        partition by case
          when rr.review_id is not null then 'review_id:' || rr.review_id
          else 'row_id:' || rr.id::text
        end
        order by rr.original_ts desc nulls last, rr.id desc
      ) as rn
    from raw_reviews rr
  ) ranked
  where rn = 1
),
dedupe_content as (
  select *
  from (
    select
      d.*,
      row_number() over (
        partition by case
          when d.comment_norm = '' and d.author_norm = ''
            then 'row_id:' || d.id::text
          else
            'content:' ||
            coalesce(d.restaurante_id::text, '0') || ':' ||
            d.restaurant_name_norm || ':' ||
            coalesce(to_char(d.original_date, 'YYYY-MM-DD'), '') || ':' ||
            d.author_norm || ':' ||
            d.estrellas::text || ':' ||
            d.comment_norm
        end
        order by (d.review_id is not null) desc, d.original_ts desc nulls last, d.id desc
      ) as rn_content
    from dedupe_review_id d
  ) ranked
  where rn_content = 1
),
per_restaurant_agg as (
  select
    d.restaurante_id,
    count(*)::bigint as total_resenas,
    coalesce(sum(d.estrellas),0)::numeric as rating_sum,
    count(*) filter(where d.estrellas >= 4)::bigint as positivas,
    count(*) filter(where d.estrellas = 3)::bigint as neutras,
    count(*) filter(where d.estrellas <= 2)::bigint as negativas,
    count(*) filter(where d.estrellas <= 3)::bigint as atencion,
    count(*) filter(where d.estrellas = 1)::bigint as stars_1,
    count(*) filter(where d.estrellas = 2)::bigint as stars_2,
    count(*) filter(where d.estrellas = 3)::bigint as stars_3,
    count(*) filter(where d.estrellas = 4)::bigint as stars_4,
    count(*) filter(where d.estrellas >= 5)::bigint as stars_5,
    max(d.original_ts at time zone 'Europe/Madrid') as ultima_resena
  from dedupe_content d
  group by d.restaurante_id
),
per_restaurant as (
  select
    sr.id as restaurante_id,
    coalesce(a.total_resenas,0)::bigint as total_resenas,
    coalesce(a.rating_sum,0)::numeric as rating_sum,
    coalesce(a.positivas,0)::bigint as positivas,
    coalesce(a.neutras,0)::bigint as neutras,
    coalesce(a.negativas,0)::bigint as negativas,
    coalesce(a.atencion,0)::bigint as atencion,
    coalesce(a.stars_1,0)::bigint as stars_1,
    coalesce(a.stars_2,0)::bigint as stars_2,
    coalesce(a.stars_3,0)::bigint as stars_3,
    coalesce(a.stars_4,0)::bigint as stars_4,
    coalesce(a.stars_5,0)::bigint as stars_5,
    a.ultima_resena
  from scoped_restaurants sr
  left join per_restaurant_agg a on a.restaurante_id = sr.id
),
with_status as (
  select
    pr.*,
    case when pr.total_resenas=0 then 0::numeric else pr.rating_sum/pr.total_resenas end as media_exacta,
    case
      when pr.total_resenas=0 then 'watch'
      when (pr.rating_sum/pr.total_resenas) >= 4.4 then 'on_target'
      when (pr.rating_sum/pr.total_resenas) >= 4.0 then 'watch'
      else 'critical'
    end as operational_status
  from per_restaurant pr
),
network as (
  select
    coalesce(sum(total_resenas),0)::bigint as total_resenas,
    coalesce(sum(rating_sum),0)::numeric as rating_sum,
    coalesce(sum(positivas),0)::bigint as positivas,
    coalesce(sum(neutras),0)::bigint as neutras,
    coalesce(sum(negativas),0)::bigint as negativas,
    coalesce(sum(atencion),0)::bigint as atencion,
    count(*)::bigint as total_restaurantes,
    max(ultima_resena) as ultima_resena
  from with_status
)
select
  ws.restaurante_id,
  ws.total_resenas,
  ws.rating_sum,
  ws.media_exacta,
  ws.positivas,
  ws.neutras,
  ws.negativas,
  ws.atencion,
  ws.stars_1,
  ws.stars_2,
  ws.stars_3,
  ws.stars_4,
  ws.stars_5,
  ws.ultima_resena,
  ws.operational_status,
  case when n.total_resenas > 0 then 'resenas' else 'empty' end as source,
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
from with_status ws
cross join network n
order by ws.restaurante_id;
$function$;

revoke all on function public.nexo_reputation_period_metrics(date,date,bigint[]) from public, anon, authenticated;
grant execute on function public.nexo_reputation_period_metrics(date,date,bigint[]) to service_role;

drop function if exists public.nexo_review_rating_impacts(bigint[]);

create function public.nexo_review_rating_impacts(
  p_resena_ids bigint[]
)
returns table (
  resena_id bigint,
  restaurante_id bigint,
  media_before numeric,
  media_after numeric,
  impact numeric,
  review_count_before bigint,
  review_count_after bigint
)
language sql
stable
set search_path = public
as $function$
with all_raw as (
  select
    s.id,
    nullif(btrim(s.review_id),'') as review_id,
    s.restaurante_id,
    s.restaurante_nombre,
    s.autor,
    s.estrellas,
    s.comentario,
    coalesce(s.fecha_resena,s.created_at) as original_ts,
    coalesce(s.fecha_resena,s.created_at)::date as original_date,
    lower(regexp_replace(btrim(coalesce(s.restaurante_nombre,'')), '\s+', ' ', 'g')) as restaurant_name_norm,
    lower(regexp_replace(btrim(coalesce(s.autor,'')), '\s+', ' ', 'g')) as author_norm,
    lower(regexp_replace(btrim(coalesce(s.comentario,'')), '\s+', ' ', 'g')) as comment_norm
  from public.resenas s
  where s.restaurante_id is not null
),
dedupe_review_id as (
  select *
  from (
    select ar.*,
      row_number() over (
        partition by case
          when ar.review_id is not null then 'review_id:'||ar.review_id
          else 'row_id:'||ar.id::text
        end
        order by ar.original_ts desc nulls last, ar.id desc
      ) rn
    from all_raw ar
  ) x where rn=1
),
dedupe_content as (
  select *
  from (
    select d.*,
      row_number() over (
        partition by case
          when d.comment_norm='' and d.author_norm='' then 'row_id:'||d.id::text
          else 'content:'||d.restaurante_id::text||':'||d.restaurant_name_norm||':'||
               coalesce(to_char(d.original_date,'YYYY-MM-DD'),'')||':'||
               d.author_norm||':'||d.estrellas::text||':'||d.comment_norm
        end
        order by (d.review_id is not null) desc, d.original_ts desc nulls last, d.id desc
      ) rn_content
    from dedupe_review_id d
  ) x where rn_content=1
),
ordered as (
  select
    d.*,
    count(*) over (
      partition by d.restaurante_id
      order by d.original_ts,d.id
      rows between unbounded preceding and 1 preceding
    )::bigint as cnt_before,
    sum(d.estrellas) over (
      partition by d.restaurante_id
      order by d.original_ts,d.id
      rows between unbounded preceding and 1 preceding
    )::numeric as sum_before
  from dedupe_content d
)
select
  o.id,
  o.restaurante_id,
  case when o.cnt_before=0 then null else o.sum_before/o.cnt_before end as media_before,
  (coalesce(o.sum_before,0)+o.estrellas)/(o.cnt_before+1) as media_after,
  case
    when o.cnt_before=0 then 0::numeric
    else ((coalesce(o.sum_before,0)+o.estrellas)/(o.cnt_before+1)) - (o.sum_before/o.cnt_before)
  end as impact,
  o.cnt_before,
  o.cnt_before+1
from ordered o
where o.id = any(p_resena_ids)
order by o.id;
$function$;

revoke all on function public.nexo_review_rating_impacts(bigint[]) from public, anon, authenticated;
grant execute on function public.nexo_review_rating_impacts(bigint[]) to service_role;

drop function if exists public.nexo_reputation_period_motives(date,date,bigint[]);

create function public.nexo_reputation_period_motives(
  p_start date,
  p_end date,
  p_restaurant_ids bigint[] default null
)
returns table (
  categoria text,
  total bigint,
  percent numeric,
  restaurantes_afectados bigint
)
language sql
stable
set search_path = public
as $function$
with params as (
  select least(p_start,p_end) start_date, greatest(p_start,p_end) end_date
),
base as (
  select distinct
    s.review_id,
    s.restaurante_id,
    rm.categoria
  from public.resenas s
  join public.resena_motivos rm
    on rm.review_id = s.review_id
  cross join params p
  where s.restaurante_id is not null
    and s.estrellas <= 3
    and coalesce(s.fecha_resena,s.created_at)::date between p.start_date and p.end_date
    and (p_restaurant_ids is null or s.restaurante_id = any(p_restaurant_ids))
    and nullif(btrim(rm.categoria),'') is not null
),
agg as (
  select
    upper(btrim(categoria)) as categoria,
    count(*)::bigint as total,
    count(distinct restaurante_id)::bigint as restaurantes_afectados
  from base
  group by upper(btrim(categoria))
),
grand as (
  select coalesce(sum(total),0)::numeric as total from agg
)
select
  a.categoria,
  a.total,
  case when g.total=0 then 0::numeric else (a.total::numeric/g.total)*100 end as percent,
  a.restaurantes_afectados
from agg a cross join grand g
order by a.total desc,a.categoria;
$function$;

revoke all on function public.nexo_reputation_period_motives(date,date,bigint[]) from public, anon, authenticated;
grant execute on function public.nexo_reputation_period_motives(date,date,bigint[]) to service_role;
